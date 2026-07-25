import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSchoolConfig } from "@/lib/report-utils"
import { hasPermission, Permissions } from "@/lib/permissions"
import { resolveReportingAcademicScope } from "@/lib/reporting-academic-scope"

export const dynamic = "force-dynamic"

const VALID_RESULT_STATUSES = ["APPROVED", "PUBLISHED"]
const INTERVENTION_THRESHOLD = 50
const CURRICULUM_REVIEW_THRESHOLD = 55
const EXCEPTIONAL_TEACHER_THRESHOLD = 75

type ResultRecord = {
  id: string
  studentId: string
  termId: string
  marksObtained: number
  maxMarks: number
  student: {
    user: { name: string; email: string }
  }
  term: {
    id: string
    name: string
    termNumber: number
  }
  classSubject: {
    class: { id: string; name: string; level: number }
    section: { id: string; name: string }
    subject: { id: string; name: string }
    teacher: {
      id: string
      user: { name: string; email: string }
    } | null
  }
}

type Aggregate = {
  sum: number
  count: number
  passCount: number
  studentIds: Set<string>
}

function percentage(result: Pick<ResultRecord, "marksObtained" | "maxMarks">) {
  if (!result.maxMarks) return 0
  return (result.marksObtained / result.maxMarks) * 100
}

function average(stats: Pick<Aggregate, "sum" | "count">) {
  return stats.count > 0 ? stats.sum / stats.count : 0
}

function round(value: number) {
  return Math.round(value * 10) / 10
}

function healthRating(averageScore: number) {
  if (averageScore >= 80) return "Excellent"
  if (averageScore >= 70) return "Good"
  if (averageScore >= 60) return "Satisfactory"
  return "Needs Improvement"
}

function getAggregate(map: Map<string, Aggregate>, key: string) {
  let aggregate = map.get(key)
  if (!aggregate) {
    aggregate = { sum: 0, count: 0, passCount: 0, studentIds: new Set<string>() }
    map.set(key, aggregate)
  }
  return aggregate
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role
    const canViewReports =
      role === "ADMIN" ||
      role === "PRINCIPAL" ||
      (await hasPermission(session.user.id, Permissions.REPORTS_VIEW))

    if (!canViewReports) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const [context, schoolConfig] = await Promise.all([
      resolveReportingAcademicScope(request),
      getSchoolConfig(),
    ])

    const trendTerms = await prisma.term.findMany({
      where: {
        academicYearId: context.academicYearId,
        ...(context.termNumber ? { termNumber: { lte: context.termNumber } } : {}),
      },
      orderBy: { termNumber: "desc" },
      take: 3,
    })

    const orderedTrendTerms = trendTerms.sort((a, b) => a.termNumber - b.termNumber)
    const trendTermIds = orderedTrendTerms.map((term) => term.id)

    const results = await prisma.result.findMany({
      where: {
        academicYearId: context.academicYearId,
        termId: { in: trendTermIds },
        status: { in: VALID_RESULT_STATUSES },
      },
      include: {
        student: { include: { user: { select: { name: true, email: true } } } },
        term: { select: { id: true, name: true, termNumber: true } },
        classSubject: {
          include: {
            class: { select: { id: true, name: true, level: true } },
            section: { select: { id: true, name: true } },
            subject: { select: { id: true, name: true } },
            teacher: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
        },
      },
    }) as ResultRecord[]

    const currentResults = context.termId
      ? results.filter((result) => result.termId === context.termId)
      : results
    const overallAggregate: Aggregate = {
      sum: 0,
      count: 0,
      passCount: 0,
      studentIds: new Set<string>(),
    }

    const classMap = new Map<string, Aggregate & { className: string; level: number }>()
    const subjectClassMap = new Map<string, Aggregate & { className: string; subjectName: string }>()
    const subjectMap = new Map<string, Aggregate & { subjectName: string }>()
    const teacherMap = new Map<string, Aggregate & { teacherName: string; subjectNames: Set<string> }>()
    const studentMap = new Map<string, Aggregate & { studentName: string; className: string }>()

    currentResults.forEach((result) => {
      const score = percentage(result)
      overallAggregate.sum += score
      overallAggregate.count += 1
      overallAggregate.passCount += score >= INTERVENTION_THRESHOLD ? 1 : 0
      overallAggregate.studentIds.add(result.studentId)

      const classKey = result.classSubject.class.id
      const classAggregate = getAggregate(classMap, classKey) as Aggregate & {
        className: string
        level: number
      }
      classAggregate.className = result.classSubject.class.name
      classAggregate.level = result.classSubject.class.level
      classAggregate.sum += score
      classAggregate.count += 1
      classAggregate.passCount += score >= INTERVENTION_THRESHOLD ? 1 : 0
      classAggregate.studentIds.add(result.studentId)

      const subjectClassKey = `${result.classSubject.class.id}:${result.classSubject.subject.id}`
      const subjectClassAggregate = getAggregate(subjectClassMap, subjectClassKey) as Aggregate & {
        className: string
        subjectName: string
      }
      subjectClassAggregate.className = result.classSubject.class.name
      subjectClassAggregate.subjectName = result.classSubject.subject.name
      subjectClassAggregate.sum += score
      subjectClassAggregate.count += 1
      subjectClassAggregate.passCount += score >= INTERVENTION_THRESHOLD ? 1 : 0
      subjectClassAggregate.studentIds.add(result.studentId)

      const subjectAggregate = getAggregate(subjectMap, result.classSubject.subject.id) as Aggregate & {
        subjectName: string
      }
      subjectAggregate.subjectName = result.classSubject.subject.name
      subjectAggregate.sum += score
      subjectAggregate.count += 1
      subjectAggregate.passCount += score >= INTERVENTION_THRESHOLD ? 1 : 0
      subjectAggregate.studentIds.add(result.studentId)

      if (result.classSubject.teacher) {
        const teacherAggregate = getAggregate(teacherMap, result.classSubject.teacher.id) as Aggregate & {
          teacherName: string
          subjectNames: Set<string>
        }
        teacherAggregate.teacherName = result.classSubject.teacher.user.name
        teacherAggregate.subjectNames ||= new Set<string>()
        teacherAggregate.subjectNames.add(result.classSubject.subject.name)
        teacherAggregate.sum += score
        teacherAggregate.count += 1
        teacherAggregate.passCount += score >= INTERVENTION_THRESHOLD ? 1 : 0
        teacherAggregate.studentIds.add(result.studentId)
      }

      const studentAggregate = getAggregate(studentMap, result.studentId) as Aggregate & {
        studentName: string
        className: string
      }
      studentAggregate.studentName = result.student.user.name
      studentAggregate.className = result.classSubject.class.name
      studentAggregate.sum += score
      studentAggregate.count += 1
      studentAggregate.passCount += score >= INTERVENTION_THRESHOLD ? 1 : 0
      studentAggregate.studentIds.add(result.studentId)
    })

    const classPerformance = Array.from(classMap.values())
      .map((stats) => ({
        className: stats.className,
        averageScore: round(average(stats)),
        passRate: round((stats.passCount / Math.max(stats.count, 1)) * 100),
        studentCount: stats.studentIds.size,
        resultCount: stats.count,
        level: stats.level,
      }))
      .sort((a, b) => b.averageScore - a.averageScore || a.level - b.level)

    const performanceTrend = orderedTrendTerms.map((term) => {
      const termResults = results.filter((result) => result.termId === term.id)
      const termAggregate = termResults.reduce(
        (stats, result) => {
          const score = percentage(result)
          stats.sum += score
          stats.count += 1
          return stats
        },
        { sum: 0, count: 0 }
      )

      return {
        termId: term.id,
        termName: term.name,
        averageScore: round(average(termAggregate)),
        resultCount: termAggregate.count,
      }
    })

    const subjectHeatMap = Array.from(subjectClassMap.values())
      .map((stats) => ({
        className: stats.className,
        subjectName: stats.subjectName,
        averageScore: round(average(stats)),
        passRate: round((stats.passCount / Math.max(stats.count, 1)) * 100),
        resultCount: stats.count,
      }))
      .sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName))

    const subjectsForReview = Array.from(subjectMap.values())
      .map((stats) => ({
        subjectName: stats.subjectName,
        averageScore: round(average(stats)),
        passRate: round((stats.passCount / Math.max(stats.count, 1)) * 100),
        studentCount: stats.studentIds.size,
      }))
      .filter(
        (subject) =>
          subject.averageScore < CURRICULUM_REVIEW_THRESHOLD ||
          subject.passRate < 65
      )
      .sort((a, b) => a.averageScore - b.averageScore)

    const studentsNeedingIntervention = Array.from(studentMap.entries())
      .map(([studentId, stats]) => ({
        studentId,
        studentName: stats.studentName,
        className: stats.className,
        averageScore: round(average(stats)),
        failingSubjects: stats.count - stats.passCount,
        subjectsTaken: stats.count,
      }))
      .filter((student) => student.averageScore < INTERVENTION_THRESHOLD || student.failingSubjects >= 2)
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 25)

    const exceptionalTeachers = Array.from(teacherMap.values())
      .map((stats) => ({
        teacherName: stats.teacherName,
        averageScore: round(average(stats)),
        passRate: round((stats.passCount / Math.max(stats.count, 1)) * 100),
        studentCount: stats.studentIds.size,
        resultCount: stats.count,
        subjects: Array.from(stats.subjectNames).sort(),
      }))
      .filter((teacher) => teacher.averageScore >= EXCEPTIONAL_TEACHER_THRESHOLD && teacher.resultCount >= 5)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 10)

    const overallAverage = round(average(overallAggregate))
    const overallPassRate = round((overallAggregate.passCount / Math.max(overallAggregate.count, 1)) * 100)
    const topClasses = classPerformance.slice(0, 3)
    const bottomClasses = [...classPerformance]
      .sort((a, b) => a.averageScore - b.averageScore || a.level - b.level)
      .slice(0, 3)

    return NextResponse.json({
      context: {
        schoolName: schoolConfig.schoolName,
        academicYear: context.academicYear,
        currentTerm: context.termName,
        generatedFor: "School Owner/Administrator",
        generatedAt: new Date().toISOString(),
      },
      executiveSummary: {
        academicHealthRating: healthRating(overallAverage),
        overallAverage,
        overallPassRate,
        totalStudents: overallAggregate.studentIds.size,
        resultCount: overallAggregate.count,
        topClasses,
        bottomClasses,
        keyAchievements: [
          topClasses[0]
            ? `${topClasses[0].className} leads current term performance at ${topClasses[0].averageScore}%.`
            : "No approved or published current-term results are available yet.",
          exceptionalTeachers[0]
            ? `${exceptionalTeachers[0].teacherName} is producing exceptional results at ${exceptionalTeachers[0].averageScore}%.`
            : "Teacher performance highlights will appear once enough approved results are available.",
        ],
        keyConcerns: [
          subjectsForReview[0]
            ? `${subjectsForReview[0].subjectName} requires review at ${subjectsForReview[0].averageScore}% average.`
            : "No subject currently falls below the review threshold.",
          studentsNeedingIntervention.length > 0
            ? `${studentsNeedingIntervention.length} students are flagged for intervention.`
            : "No students are currently flagged for intervention.",
        ],
      },
      visualizations: {
        classPerformanceComparison: {
          chartType: "bar",
          title: "Class Performance Comparison",
          xAxis: "className",
          yAxis: "averageScore",
          data: classPerformance,
        },
        performanceTrends: {
          chartType: "line",
          title: "Performance Trends Over Last 3 Terms",
          xAxis: "termName",
          yAxis: "averageScore",
          data: performanceTrend,
        },
        subjectWiseHeatMap: {
          chartType: "heat_map",
          title: "Subject-wise Performance Across Classes",
          rowKey: "className",
          columnKey: "subjectName",
          valueKey: "averageScore",
          data: subjectHeatMap,
        },
      },
      actionableInsights: {
        subjectsRequiringCurriculumReview: subjectsForReview,
        studentsNeedingIntervention,
        teachersWithExceptionalResults: exceptionalTeachers,
        recommendedInterventions: [
          "Schedule subject-level reviews for any subject below 55% average or below 65% pass rate.",
          "Create a two-week remediation plan for students below 50% average or failing two or more subjects.",
          "Pair high-performing teachers with lower-performing subject teams for lesson review and assessment moderation.",
          "Review class-level workload, attendance, and assessment coverage for the bottom three grade levels.",
        ],
      },
    })
  } catch (error) {
    console.error("Owner performance report error:", error)
    const message = error instanceof Error ? error.message : "Failed to generate owner performance report"

    return NextResponse.json(
      {
        error: "Failed to generate owner performance report",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    )
  }
}
