import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveReportingAcademicScope } from "@/lib/reporting-academic-scope"

const VALID_RESULT_STATUSES = ["APPROVED", "PUBLISHED"]

const round = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10

const money = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()
    const context = await resolveReportingAcademicScope(request)

    const [
      schoolConfig,
      classes,
      results,
      fees,
      staff,
      enrollments,
      applications,
      attendance,
      announcements,
    ] = await Promise.all([
      prisma.schoolConfig.findFirst(),
      prisma.class.findMany({
        include: {
          sections: true,
          enrollments: {
            where: { academicYearId: context.academicYearId },
            include: { student: true },
          },
        },
        orderBy: { level: "asc" },
      }),
      prisma.result.findMany({
        where: {
          academicYearId: context.academicYearId,
          ...(context.termId ? { termId: context.termId } : {}),
          status: { in: VALID_RESULT_STATUSES },
        },
        include: {
          student: {
            include: {
              user: true,
              classEnrollment: {
                where: { academicYearId: context.academicYearId, status: "ACTIVE" },
                include: { class: true },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.fee.findMany({
        where: {
          academicYearId: context.academicYearId,
          ...(context.termId ? { termId: context.termId } : {}),
        },
      }),
      prisma.staff.findMany(),
      prisma.classEnrollment.findMany({
        where: { academicYearId: context.academicYearId },
        include: { student: true, class: true },
      }),
      prisma.application.findMany({
        where: { academicYearId: context.academicYearId },
      }),
      prisma.attendance.findMany({
        where: {
          academicYearId: context.academicYearId,
          ...(context.termId ? { termId: context.termId } : {}),
          studentId: { not: null },
          isArchived: false,
        },
      }),
      prisma.announcement.findMany({
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ])

    const activeEnrollments = enrollments.filter((item) => item.status === "ACTIVE")
    const totalEnrollment = activeEnrollments.length
    const activeStaff = staff.filter((member) => member.status === "ACTIVE")
    const totalPayrollCost = activeStaff.reduce((sum, member) => sum + (member.salary || 0), 0)

    const resultPercentages = results
      .filter((result) => result.maxMarks > 0)
      .map((result) => ({
        studentId: result.studentId,
        className: result.student.classEnrollment[0]?.class.name || "Unassigned",
        percentage: (result.marksObtained / result.maxMarks) * 100,
      }))

    const overallPerformanceScore =
      resultPercentages.length > 0
        ? round(
            resultPercentages.reduce((sum, result) => sum + result.percentage, 0) /
              resultPercentages.length
          )
        : 0

    const classPerformanceMap = new Map<string, { className: string; sum: number; count: number }>()
    const studentPerformanceMap = new Map<string, { sum: number; count: number; failing: number }>()

    for (const result of resultPercentages) {
      const classStats =
        classPerformanceMap.get(result.className) || {
          className: result.className,
          sum: 0,
          count: 0,
        }
      classStats.sum += result.percentage
      classStats.count += 1
      classPerformanceMap.set(result.className, classStats)

      const studentStats =
        studentPerformanceMap.get(result.studentId) || { sum: 0, count: 0, failing: 0 }
      studentStats.sum += result.percentage
      studentStats.count += 1
      if (result.percentage < 50) studentStats.failing += 1
      studentPerformanceMap.set(result.studentId, studentStats)
    }

    const classPerformance = Array.from(classPerformanceMap.values())
      .map((item) => ({
        className: item.className,
        averageScore: item.count > 0 ? round(item.sum / item.count) : 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore)

    const studentsNeedingInterventionCount = Array.from(studentPerformanceMap.values()).filter(
      (item) => item.count > 0 && (item.sum / item.count < 50 || item.failing >= 2)
    ).length

    const totalExpectedFees = fees.reduce((sum, fee) => sum + fee.amount, 0)
    const totalCollectedFees = fees.reduce((sum, fee) => sum + fee.paidAmount, 0)
    const outstandingAmount = fees.reduce(
      (sum, fee) => sum + Math.max(fee.amount - fee.paidAmount, 0),
      0
    )
    const collectionRate =
      totalExpectedFees > 0 ? (totalCollectedFees / totalExpectedFees) * 100 : 0
    const incomeVsExpenses = totalCollectedFees - totalPayrollCost

    const successfulPaymentsByDay = await prisma.payment.findMany({
      where: {
        status: "SUCCESS",
        fee: {
          academicYearId: context.academicYearId,
          ...(context.termId ? { termId: context.termId } : {}),
        },
      },
      select: {
        amount: true,
        createdAt: true,
      },
    })

    const paymentDayMap = new Map<string, number>()
    for (const payment of successfulPaymentsByDay) {
      const key = dateKey(payment.createdAt)
      paymentDayMap.set(key, (paymentDayMap.get(key) || 0) + payment.amount)
    }
    const averageDailyCollections =
      paymentDayMap.size > 0
        ? Array.from(paymentDayMap.values()).reduce((sum, value) => sum + value, 0) /
          paymentDayMap.size
        : 0
    const monthlyPayrollBurn = totalPayrollCost / 30
    const cashBurnRate = Math.max(monthlyPayrollBurn - averageDailyCollections, 0)
    const daysToCashZero =
      cashBurnRate > 0 && totalCollectedFees > 0
        ? Math.ceil(totalCollectedFees / cashBurnRate)
        : null

    const retainedCount = enrollments.filter((item) =>
      ["ACTIVE", "PROMOTED", "GRADUATED"].includes(item.status)
    ).length
    const dropoutCount = enrollments.filter((item) =>
      ["DROPPED", "WITHDRAWN", "TRANSFERRED"].includes(item.status)
    ).length
    const retentionRate =
      retainedCount + dropoutCount > 0
        ? (retainedCount / (retainedCount + dropoutCount)) * 100
        : 0

    const averageClassSize =
      classes.length > 0 ? totalEnrollment / Math.max(classes.length, 1) : 0

    const genderMap = new Map<string, number>()
    for (const enrollment of activeEnrollments) {
      const gender = enrollment.student.gender || "Not specified"
      genderMap.set(gender, (genderMap.get(gender) || 0) + 1)
    }

    const attendanceTotals = { present: 0, late: 0, absent: 0, total: 0 }
    for (const record of attendance) {
      const status = record.status.toUpperCase()
      attendanceTotals.total += 1
      if (status === "PRESENT") attendanceTotals.present += 1
      if (status === "LATE") attendanceTotals.late += 1
      if (status === "ABSENT") attendanceTotals.absent += 1
    }
    const attendanceRate =
      attendanceTotals.total > 0
        ? ((attendanceTotals.present + attendanceTotals.late) / attendanceTotals.total) * 100
        : 0

    const criticalAlerts = [
      ...(overallPerformanceScore > 0 && overallPerformanceScore < 60
        ? [{ type: "Academic", message: "Overall performance is below 60%." }]
        : []),
      ...(studentsNeedingInterventionCount > 0
        ? [
            {
              type: "Academic",
              message: `${studentsNeedingInterventionCount} students need intervention.`,
            },
          ]
        : []),
      ...(collectionRate < 65 && totalExpectedFees > 0
        ? [{ type: "Financial", message: "Fee collection rate is below 65%." }]
        : []),
      ...(outstandingAmount > 0
        ? [{ type: "Financial", message: `Outstanding fees total ${money(outstandingAmount)}.` }]
        : []),
      ...(attendanceRate > 0 && attendanceRate < 75
        ? [{ type: "Operations", message: "Attendance rate is below 75%." }]
        : []),
      ...(classes.filter((item) => {
        const active = item.enrollments.filter((enrollment) => enrollment.status === "ACTIVE").length
        const capacity =
          item.capacity ||
          item.sections.reduce((sum, section) => sum + (section.capacity || 0), 0)
        return capacity > 0 && active / capacity >= 0.95
      }).length > 0
        ? [{ type: "Student", message: "One or more classes are at or above 95% capacity." }]
        : []),
    ]

    const pendingApplications = applications.filter(
      (application) => application.applicationStatus === "PENDING"
    ).length
    const upcomingActions = [
      ...(pendingApplications > 0
        ? [`Review ${pendingApplications} pending enrollment applications.`]
        : []),
      ...(outstandingAmount > 0 ? ["Follow up top fee defaulters and overdue accounts."] : []),
      ...(studentsNeedingInterventionCount > 0
        ? ["Schedule academic intervention planning for flagged students."]
        : []),
      ...(attendanceRate > 0 && attendanceRate < 85
        ? ["Run attendance improvement follow-ups for poor attendance classes."]
        : []),
      ...announcements.slice(0, 3).map((announcement) => `Announcement: ${announcement.title}`),
    ].slice(0, 8)

    return NextResponse.json({
      meta: {
        schoolName: schoolConfig?.schoolName || "School",
        academicYear: context.academicYear,
        term: context.termName,
        generatedAt: now.toISOString(),
        currency: "ZMW",
      },
      academic: {
        overallPerformanceScore,
        topPerformingClasses: classPerformance.slice(0, 3),
        bottomPerformingClasses: [...classPerformance].reverse().slice(0, 3),
        studentsNeedingInterventionCount,
      },
      financial: {
        income: money(totalCollectedFees),
        expenses: money(totalPayrollCost),
        incomeVsExpenses: money(incomeVsExpenses),
        collectionRate: round(collectionRate),
        outstandingAmount: money(outstandingAmount),
        daysToCashZero,
      },
      student: {
        totalEnrollment,
        retentionRate: round(retentionRate),
        averageClassSize: round(averageClassSize),
        genderDistribution: Array.from(genderMap.entries()).map(([name, value], index) => ({
          name,
          value,
          color: ["#2563eb", "#ec4899", "#16a34a", "#64748b"][index] || "#64748b",
        })),
      },
      staff: {
        staffToStudentRatio:
          activeStaff.length > 0 ? `1:${round(totalEnrollment / activeStaff.length)}` : "N/A",
        totalStaffCount: activeStaff.length,
        performanceRating: null,
        totalPayrollCost: money(totalPayrollCost),
      },
      operations: {
        attendanceRate: round(attendanceRate),
        criticalAlertsCount: criticalAlerts.length,
        criticalAlerts,
        upcomingEventsActions: upcomingActions,
      },
    })
  } catch (error) {
    console.error("School master dashboard error:", error)
    return NextResponse.json(
      { error: "Failed to generate school master dashboard" },
      { status: 500 }
    )
  }
}
