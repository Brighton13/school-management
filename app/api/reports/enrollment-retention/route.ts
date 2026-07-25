import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveReportingAcademicScope } from "@/lib/reporting-academic-scope"

const round = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10

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
    const scope = await resolveReportingAcademicScope(request)

    const [schoolConfig, academicYears, classes, students, applications] =
      await Promise.all([
        prisma.schoolConfig.findFirst(),
        prisma.academicYear.findMany({
          where: { status: { in: ["ACTIVE", "COMPLETED", "ARCHIVED"] } },
          orderBy: { startDate: "desc" },
          take: 3,
        }),
        prisma.class.findMany({
          include: {
            sections: true,
            enrollments: {
              include: {
                student: { include: { user: true } },
                academicYear: true,
              },
            },
          },
          orderBy: { level: "asc" },
        }),
        prisma.student.findMany({
          include: {
            user: true,
            classEnrollment: {
              include: { class: true, section: true, academicYear: true },
              orderBy: { enrolledAt: "desc" },
            },
          },
        }),
        prisma.application.findMany({
          include: { academicYear: true, appliedClass: true },
        }),
      ])

    const currentYearId = scope.academicYearId
    const currentEnrollments = classes.flatMap((classItem) =>
      classItem.enrollments.filter(
        (enrollment) =>
          enrollment.academicYearId === currentYearId && enrollment.status === "ACTIVE"
      )
    )

    const totalStudentCount = currentEnrollments.length
    const trendYears = [...academicYears].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    )
    const enrollmentTrends = trendYears.map((year) => {
      const yearEnrollments = classes.flatMap((classItem) =>
        classItem.enrollments.filter((enrollment) => enrollment.academicYearId === year.id)
      )
      const active = yearEnrollments.filter((enrollment) => enrollment.status === "ACTIVE").length
      const dropped = yearEnrollments.filter((enrollment) =>
        ["DROPPED", "WITHDRAWN", "TRANSFERRED"].includes(enrollment.status)
      ).length

      return {
        academicYear: year.year,
        totalEnrollment: active,
        newAdmissions: applications.filter(
          (application) =>
            application.academicYearId === year.id &&
            application.applicationStatus === "APPROVED"
        ).length,
        dropouts: dropped,
      }
    })

    const previousYear = enrollmentTrends[enrollmentTrends.length - 2]
    const currentYearTrend = enrollmentTrends[enrollmentTrends.length - 1]
    const yearOverYearGrowthRate =
      previousYear && previousYear.totalEnrollment > 0 && currentYearTrend
        ? ((currentYearTrend.totalEnrollment - previousYear.totalEnrollment) /
            previousYear.totalEnrollment) *
          100
        : 0

    const retentionByClass = classes.map((classItem) => {
      const classEnrollments = classItem.enrollments.filter(
        (enrollment) => enrollment.academicYearId === currentYearId
      )
      const active = classEnrollments.filter((enrollment) => enrollment.status === "ACTIVE").length
      const retained = classEnrollments.filter((enrollment) =>
        ["ACTIVE", "PROMOTED", "GRADUATED"].includes(enrollment.status)
      ).length
      const dropouts = classEnrollments.filter((enrollment) =>
        ["DROPPED", "WITHDRAWN", "TRANSFERRED"].includes(enrollment.status)
      ).length
      const total = classEnrollments.length
      const capacity =
        classItem.capacity ||
        classItem.sections.reduce((sum, section) => sum + (section.capacity || 0), 0)

      return {
        className: classItem.name,
        activeEnrollment: active,
        retained,
        dropouts,
        retentionRate: total > 0 ? round((retained / total) * 100) : 0,
        capacity,
        occupancyRate: capacity > 0 ? round((active / capacity) * 100) : null,
      }
    })

    const overallRetentionRate =
      retentionByClass.reduce((sum, item) => sum + item.retained, 0) /
      Math.max(
        retentionByClass.reduce((sum, item) => sum + item.retained + item.dropouts, 0),
        1
      )

    const demographicMap = new Map<string, number>()
    for (const enrollment of currentEnrollments) {
      const gender = enrollment.student.gender || "Not specified"
      demographicMap.set(gender, (demographicMap.get(gender) || 0) + 1)
    }

    const demographicBreakdown = Array.from(demographicMap.entries()).map(
      ([name, value], index) => ({
        name,
        value,
        color: ["#2563eb", "#ec4899", "#16a34a", "#64748b"][index] || "#64748b",
      })
    )

    const maleCount = demographicMap.get("MALE") || demographicMap.get("Male") || 0
    const femaleCount = demographicMap.get("FEMALE") || demographicMap.get("Female") || 0
    const genderRatio =
      maleCount || femaleCount ? `${maleCount}:${femaleCount}` : "Not available"

    const pendingApplications = applications.filter(
      (application) =>
        application.academicYearId === currentYearId &&
        application.applicationStatus === "PENDING"
    ).length
    const approvedApplications = applications.filter(
      (application) =>
        application.academicYearId === currentYearId &&
        application.applicationStatus === "APPROVED"
    ).length

    const classesWithAttritionProblems = retentionByClass
      .filter((item) => item.dropouts > 0 || (item.retentionRate > 0 && item.retentionRate < 90))
      .sort((a, b) => a.retentionRate - b.retentionRate)

    return NextResponse.json({
      meta: {
        schoolName: schoolConfig?.schoolName || "School",
        academicYear: scope.academicYear,
        generatedAt: now.toISOString(),
      },
      executiveSummary: {
        totalStudentCount,
        yearOverYearGrowthRate: round(yearOverYearGrowthRate),
        overallRetentionRate: round(overallRetentionRate * 100),
        genderRatio,
        demographicBreakdown,
        summaryParagraphs: [
          `Current enrollment is ${totalStudentCount} active students for ${scope.academicYear}. Year-over-year growth is ${round(yearOverYearGrowthRate)}%.`,
          `Overall retention is ${round(overallRetentionRate * 100)}%. Gender ratio is ${genderRatio}, based on active enrollment records.`,
          `${classesWithAttritionProblems.length} classes show potential attrition concerns and ${retentionByClass.filter((item) => item.occupancyRate !== null && item.occupancyRate >= 90).length} classes are near or above 90% occupancy.`,
        ],
      },
      visualizations: {
        enrollmentTrends: {
          chartType: "area",
          title: "Enrollment Trends",
          data: enrollmentTrends,
        },
        studentJourneyFunnel: {
          chartType: "funnel",
          title: "Student Journey",
          data: [
            { stage: "Applications", value: applications.filter((a) => a.academicYearId === currentYearId).length },
            { stage: "Approved", value: approvedApplications },
            { stage: "Enrolled", value: totalStudentCount },
            {
              stage: "Retained",
              value: retentionByClass.reduce((sum, item) => sum + item.retained, 0),
            },
          ],
        },
        demographicDistribution: {
          chartType: "pie",
          title: "Demographic Distribution",
          data: demographicBreakdown,
        },
        classOccupancyRates: {
          chartType: "bar",
          title: "Class Occupancy Rates",
          data: retentionByClass,
        },
      },
      currentEnrollmentByClass: retentionByClass,
      newAdmissionsVsDropouts: enrollmentTrends.map((item) => ({
        academicYear: item.academicYear,
        newAdmissions: item.newAdmissions,
        dropouts: item.dropouts,
      })),
      actionableInsights: {
        classesWithAttritionProblems,
        marketingOpportunities: [
          pendingApplications > 0
            ? `Follow up ${pendingApplications} pending applications for the current academic year.`
            : "Build a pending-application pipeline to track prospects before admission.",
          "Promote classes with available capacity and strong retention rates.",
          "Use gender and class distribution to target underrepresented segments in outreach.",
        ],
        capacityPlanningSuggestions: retentionByClass
          .filter((item) => item.occupancyRate !== null)
          .map((item) => ({
            className: item.className,
            occupancyRate: item.occupancyRate,
            suggestion:
              item.occupancyRate !== null && item.occupancyRate >= 90
                ? "Near capacity; consider adding a section or limiting admissions."
                : item.occupancyRate !== null && item.occupancyRate < 50
                  ? "Under capacity; prioritize recruitment for this class."
                  : "Capacity is currently balanced.",
          })),
        factorsAffectingRetention: [
          "Review dropout and transfer reasons in enrollment notes where available.",
          "Compare classes with low retention against attendance, fees, and academic performance.",
          "Strengthen parent engagement for classes showing repeated withdrawals.",
        ],
      },
      dataAvailability: {
        enrollment: currentEnrollments.length > 0,
        threeYearTrend: enrollmentTrends.length > 1,
        demographics: demographicBreakdown.length > 0,
        retentionReasons: false,
      },
    })
  } catch (error) {
    console.error("Enrollment retention report error:", error)
    return NextResponse.json(
      { error: "Failed to generate enrollment and retention report" },
      { status: 500 }
    )
  }
}
