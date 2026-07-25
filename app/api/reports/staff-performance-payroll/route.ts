import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveReportingAcademicScope } from "@/lib/reporting-academic-scope"

const money = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return monthKey(date)
    })

    const scope = await resolveReportingAcademicScope(request)

    const [schoolConfig, staff, activeEnrollments, attendance] =
      await Promise.all([
        prisma.schoolConfig.findFirst(),
        prisma.staff.findMany({
          include: {
            user: { select: { name: true, email: true } },
            departmentRef: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.classEnrollment.count({
          where: {
            status: "ACTIVE",
            academicYearId: scope.academicYearId,
          },
        }),
        prisma.attendance.findMany({
          where: {
            staffId: { not: null },
            date: { gte: sixMonthsAgo },
            academicYearId: scope.academicYearId,
          },
          include: {
            staff: {
              include: {
                user: { select: { name: true } },
                departmentRef: true,
              },
            },
          },
        }),
      ])

    const activeStaff = staff.filter((member) => member.status === "ACTIVE")
    const inactiveStaff = staff.filter((member) => member.status !== "ACTIVE")
    const totalPayrollCost = activeStaff.reduce((sum, member) => sum + (member.salary || 0), 0)
    const staffToStudentRatio =
      activeStaff.length > 0 ? activeEnrollments / activeStaff.length : 0
    const turnoverRate =
      staff.length > 0 ? (inactiveStaff.length / staff.length) * 100 : 0

    const departmentRoleMap = new Map<string, Record<string, string | number>>()
    const departmentSalary = new Map<
      string,
      { department: string; staffCount: number; payrollCost: number; averageSalary: number }
    >()
    const roleCounts = new Map<string, number>()

    for (const member of activeStaff) {
      const department = member.departmentRef?.name || member.department || "Unassigned"
      const role = member.designation || "Staff"
      const row = departmentRoleMap.get(department) || { department }
      row[role] = Number(row[role] || 0) + 1
      departmentRoleMap.set(department, row)
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1)

      const salaryRow =
        departmentSalary.get(department) || {
          department,
          staffCount: 0,
          payrollCost: 0,
          averageSalary: 0,
        }
      salaryRow.staffCount += 1
      salaryRow.payrollCost += member.salary || 0
      salaryRow.averageSalary = salaryRow.payrollCost / salaryRow.staffCount
      departmentSalary.set(department, salaryRow)
    }

    const payrollTrend = monthKeys.map((key) => {
      const monthStart = new Date(`${key}-01T00:00:00.000Z`)
      const monthlyCost = staff
        .filter((member) => !member.joiningDate || new Date(member.joiningDate) <= monthStart)
        .filter((member) => member.status === "ACTIVE")
        .reduce((sum, member) => sum + (member.salary || 0), 0)

      return {
        month: monthLabel(key),
        payrollCost: money(monthlyCost),
      }
    })

    const attendanceByDepartment = new Map<
      string,
      { department: string; present: number; absent: number; late: number; total: number }
    >()

    for (const record of attendance) {
      const department =
        record.staff?.departmentRef?.name || record.staff?.department || "Unassigned"
      const row =
        attendanceByDepartment.get(department) || {
          department,
          present: 0,
          absent: 0,
          late: 0,
          total: 0,
        }
      row.total += 1
      if (record.status === "PRESENT") row.present += 1
      if (record.status === "ABSENT") row.absent += 1
      if (record.status === "LATE") row.late += 1
      attendanceByDepartment.set(department, row)
    }

    const salarySummary = activeStaff
      .map((member) => ({
        staffName: member.user.name,
        employeeId: member.employeeId,
        department: member.departmentRef?.name || member.department || "Unassigned",
        role: member.designation,
        salary: money(member.salary || 0),
        status: member.status,
        joiningDate: member.joiningDate?.toISOString().slice(0, 10) || null,
      }))
      .sort((a, b) => b.salary - a.salary)

    const departmentsNeedingStaff = Array.from(departmentRoleMap.values())
      .filter((department) => {
        const total = Object.entries(department).reduce(
          (sum, [key, value]) => (key === "department" ? sum : sum + Number(value || 0)),
          0
        )
        return total < 2
      })
      .map((department) => ({
        department: String(department.department),
        currentStaff: Object.entries(department).reduce(
          (sum, [key, value]) => (key === "department" ? sum : sum + Number(value || 0)),
          0
        ),
        recommendation: "Review workload and consider additional staffing if demand is active.",
      }))

    return NextResponse.json({
      meta: {
        schoolName: schoolConfig?.schoolName || "School",
        academicYear: scope.academicYear,
        generatedAt: now.toISOString(),
        currency: "ZMW",
      },
      executiveSummary: {
        totalStaff: staff.length,
        activeStaff: activeStaff.length,
        staffToStudentRatio: money(staffToStudentRatio),
        totalPayrollCost: money(totalPayrollCost),
        averageSalary:
          activeStaff.length > 0 ? money(totalPayrollCost / activeStaff.length) : 0,
        averagePerformanceRating: null,
        staffSatisfactionTrend: null,
        staffTurnoverRate: money(turnoverRate),
        summaryParagraphs: [
          `The school currently has ${activeStaff.length} active staff serving ${activeEnrollments} active students, giving a staff-to-student ratio of 1:${money(staffToStudentRatio)}.`,
          `Total monthly payroll exposure is ${money(totalPayrollCost)}, with an average salary of ${activeStaff.length > 0 ? money(totalPayrollCost / activeStaff.length) : 0}. Staff turnover is ${money(turnoverRate)}% based on inactive staff records.`,
          "Performance ratings and staff satisfaction trends are not yet represented in the database, so those measures are marked as unavailable until review or survey tracking is added.",
        ],
      },
      visualizations: {
        staffDistributionByDepartment: {
          chartType: "stacked_bar",
          title: "Staff Distribution by Department",
          data: Array.from(departmentRoleMap.values()),
          roles: Array.from(roleCounts.keys()).sort(),
        },
        payrollTrends: {
          chartType: "line",
          title: "Payroll Trends Over Time",
          data: payrollTrend,
        },
        performanceRatingsByDepartment: {
          chartType: "column",
          title: "Performance Ratings by Department",
          data: Array.from(departmentSalary.values()).map((department) => ({
            department: department.department,
            averageRating: null,
          })),
          dataAvailable: false,
        },
        staffSalarySummary: {
          chartType: "table",
          title: "Staff Salary Summary",
          data: salarySummary,
        },
      },
      staffCountsByRole: Array.from(roleCounts.entries()).map(([role, count]) => ({
        role,
        count,
      })),
      salaryDistribution: Array.from(departmentSalary.values()).map((department) => ({
        department: department.department,
        staffCount: department.staffCount,
        payrollCost: money(department.payrollCost),
        averageSalary: money(department.averageSalary),
      })),
      attendancePatterns: Array.from(attendanceByDepartment.values()).map((row) => ({
        department: row.department,
        present: row.present,
        absent: row.absent,
        late: row.late,
        attendanceRate: row.total > 0 ? money((row.present / row.total) * 100) : 0,
      })),
      actionableInsights: {
        departmentsNeedingAdditionalStaff: departmentsNeedingStaff,
        highPerformersDeservingRecognition: [],
        trainingNeedsIdentified: [
          "Add performance review records to identify staff training needs by department.",
          ...Array.from(attendanceByDepartment.values())
            .filter((row) => row.total > 0 && (row.present / row.total) * 100 < 85)
            .map((row) => `${row.department} attendance is below 85%; review attendance discipline and support needs.`),
        ],
        payrollOptimizationOpportunities: [
          "Review departments with high payroll cost against workload and student demand.",
          "Confirm all active staff records have current salary and department assignments.",
          "Use payroll trend reviews before approving new hires or salary adjustments.",
        ],
      },
      dataAvailability: {
        staff: staff.length > 0,
        salary: activeStaff.some((member) => member.salary !== null),
        attendance: attendance.length > 0,
        performanceRatings: false,
        satisfactionTrends: false,
      },
    })
  } catch (error) {
    console.error("Staff performance payroll report error:", error)
    return NextResponse.json(
      { error: "Failed to generate staff performance and payroll report" },
      { status: 500 }
    )
  }
}
