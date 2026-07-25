import { NextResponse } from "next/server"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveReportingAcademicScope } from "@/lib/reporting-academic-scope"

const VALID_RESULT_STATUSES = ["APPROVED", "PUBLISHED"]

const round = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 10) / 10

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function weekdayName(date: Date) {
  return date.toLocaleDateString("en-US", { weekday: "long" })
}

function pearsonCorrelation(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return null

  const xMean = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const yMean = points.reduce((sum, point) => sum + point.y, 0) / points.length
  let numerator = 0
  let xDenominator = 0
  let yDenominator = 0

  for (const point of points) {
    const xDelta = point.x - xMean
    const yDelta = point.y - yMean
    numerator += xDelta * yDelta
    xDenominator += xDelta * xDelta
    yDenominator += yDelta * yDelta
  }

  const denominator = Math.sqrt(xDenominator * yDenominator)
  return denominator === 0 ? null : round(numerator / denominator)
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
    const context = await resolveReportingAcademicScope(request)
    const [schoolConfig, attendance, results] = await Promise.all([
      prisma.schoolConfig.findFirst(),
      prisma.attendance.findMany({
        where: {
          academicYearId: context.academicYearId,
          ...(context.termId ? { termId: context.termId } : {}),
          studentId: { not: null },
          isArchived: false,
        },
        include: {
          student: {
            include: {
              user: { select: { name: true } },
              classEnrollment: {
                where: {
                  academicYearId: context.academicYearId,
                  status: "ACTIVE",
                },
                include: { class: true, section: true },
                take: 1,
              },
            },
          },
          section: { include: { class: true } },
        },
        orderBy: { date: "asc" },
      }),
      prisma.result.findMany({
        where: {
          academicYearId: context.academicYearId,
          ...(context.termId ? { termId: context.termId } : {}),
          status: { in: VALID_RESULT_STATUSES },
        },
        select: {
          studentId: true,
          marksObtained: true,
          maxMarks: true,
        },
      }),
    ])

    const overall = { present: 0, absent: 0, late: 0, excused: 0, total: 0 }
    const dailyMap = new Map<
      string,
      { date: string; present: number; absent: number; late: number; excused: number; total: number }
    >()
    const classMap = new Map<
      string,
      {
        className: string
        present: number
        absent: number
        late: number
        excused: number
        total: number
        students: Set<string>
      }
    >()
    const heatMap = new Map<
      string,
      { date: string; className: string; attendanceRate: number; present: number; total: number }
    >()
    const studentMap = new Map<
      string,
      {
        studentId: string
        studentName: string
        admissionNumber: string
        className: string
        present: number
        absent: number
        late: number
        excused: number
        total: number
      }
    >()
    const weekdayMap = new Map<string, { weekday: string; absent: number; late: number; total: number }>()
    const reasonMap = new Map<string, number>()

    for (const record of attendance) {
      const status = record.status.toUpperCase()
      const key = dateKey(record.date)
      const enrollment = record.student?.classEnrollment[0]
      const className =
        record.section?.class?.name ||
        enrollment?.class?.name ||
        "Unassigned"

      overall.total += 1
      if (status === "PRESENT") overall.present += 1
      if (status === "ABSENT") overall.absent += 1
      if (status === "LATE") overall.late += 1
      if (status === "EXCUSED") overall.excused += 1

      const daily =
        dailyMap.get(key) || { date: key, present: 0, absent: 0, late: 0, excused: 0, total: 0 }
      daily.total += 1
      if (status === "PRESENT") daily.present += 1
      if (status === "ABSENT") daily.absent += 1
      if (status === "LATE") daily.late += 1
      if (status === "EXCUSED") daily.excused += 1
      dailyMap.set(key, daily)

      const classStats =
        classMap.get(className) || {
          className,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
          students: new Set<string>(),
        }
      classStats.total += 1
      if (record.studentId) classStats.students.add(record.studentId)
      if (status === "PRESENT") classStats.present += 1
      if (status === "ABSENT") classStats.absent += 1
      if (status === "LATE") classStats.late += 1
      if (status === "EXCUSED") classStats.excused += 1
      classMap.set(className, classStats)

      const heatKey = `${key}:${className}`
      const heat = heatMap.get(heatKey) || {
        date: key,
        className,
        attendanceRate: 0,
        present: 0,
        total: 0,
      }
      heat.total += 1
      if (status === "PRESENT" || status === "LATE") heat.present += 1
      heat.attendanceRate = round((heat.present / heat.total) * 100)
      heatMap.set(heatKey, heat)

      if (record.student && record.studentId) {
        const studentStats =
          studentMap.get(record.studentId) || {
            studentId: record.studentId,
            studentName: record.student.user.name,
            admissionNumber: record.student.admissionNumber,
            className,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            total: 0,
          }
        studentStats.total += 1
        if (status === "PRESENT") studentStats.present += 1
        if (status === "ABSENT") studentStats.absent += 1
        if (status === "LATE") studentStats.late += 1
        if (status === "EXCUSED") studentStats.excused += 1
        studentMap.set(record.studentId, studentStats)
      }

      const weekday = weekdayName(record.date)
      const weekdayStats =
        weekdayMap.get(weekday) || { weekday, absent: 0, late: 0, total: 0 }
      weekdayStats.total += 1
      if (status === "ABSENT") weekdayStats.absent += 1
      if (status === "LATE") weekdayStats.late += 1
      weekdayMap.set(weekday, weekdayStats)

      if ((status === "ABSENT" || status === "EXCUSED") && record.remarks) {
        const reason = record.remarks.trim()
        if (reason) reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1)
      }
    }

    const dailyAttendance = Array.from(dailyMap.values()).map((day) => ({
      ...day,
      attendanceRate: day.total > 0 ? round(((day.present + day.late) / day.total) * 100) : 0,
      absentRate: day.total > 0 ? round((day.absent / day.total) * 100) : 0,
      lateRate: day.total > 0 ? round((day.late / day.total) * 100) : 0,
    }))

    const classAttendance = Array.from(classMap.values())
      .map((item) => ({
        className: item.className,
        attendanceRate:
          item.total > 0 ? round(((item.present + item.late) / item.total) * 100) : 0,
        absenceRate: item.total > 0 ? round((item.absent / item.total) * 100) : 0,
        lateRate: item.total > 0 ? round((item.late / item.total) * 100) : 0,
        studentCount: item.students.size,
        records: item.total,
      }))
      .sort((a, b) => b.attendanceRate - a.attendanceRate)

    const studentAttendance = Array.from(studentMap.values())
      .map((student) => ({
        ...student,
        attendanceRate:
          student.total > 0
            ? round(((student.present + student.late) / student.total) * 100)
            : 0,
        absenceRate: student.total > 0 ? round((student.absent / student.total) * 100) : 0,
        lateRate: student.total > 0 ? round((student.late / student.total) * 100) : 0,
      }))
      .sort((a, b) => a.attendanceRate - b.attendanceRate)

    const studentResultMap = new Map<string, { sum: number; count: number }>()
    for (const result of results) {
      if (!result.maxMarks) continue
      const stats = studentResultMap.get(result.studentId) || { sum: 0, count: 0 }
      stats.sum += (result.marksObtained / result.maxMarks) * 100
      stats.count += 1
      studentResultMap.set(result.studentId, stats)
    }

    const correlationPoints = studentAttendance
      .map((student) => {
        const resultStats = studentResultMap.get(student.studentId)
        if (!resultStats || resultStats.count === 0) return null
        return {
          x: student.attendanceRate,
          y: resultStats.sum / resultStats.count,
        }
      })
      .filter((point): point is { x: number; y: number } => point !== null)

    const correlation = pearsonCorrelation(correlationPoints)
    const bestClass = classAttendance[0] || null
    const worstClass = classAttendance.length > 0 ? classAttendance[classAttendance.length - 1] : null
    const overallAttendanceRate =
      overall.total > 0 ? round(((overall.present + overall.late) / overall.total) * 100) : 0
    const commonReasons = Array.from(reasonMap.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    const absenteeismPatterns = Array.from(weekdayMap.values())
      .map((item) => ({
        weekday: item.weekday,
        absent: item.absent,
        late: item.late,
        absentRate: item.total > 0 ? round((item.absent / item.total) * 100) : 0,
        lateRate: item.total > 0 ? round((item.late / item.total) * 100) : 0,
      }))
      .sort((a, b) => b.absentRate - a.absentRate)

    return NextResponse.json({
      meta: {
        schoolName: schoolConfig?.schoolName || "School",
        academicYear: context.academicYear,
        term: context.termName,
        generatedAt: now.toISOString(),
      },
      executiveSummary: {
        overallAttendanceRate,
        bestAttendanceClass: bestClass,
        worstAttendanceClass: worstClass,
        attendanceAcademicPerformanceCorrelation: correlation,
        correlationDescription:
          correlation === null
            ? "Not enough overlapping attendance and result data to calculate correlation."
            : correlation >= 0.4
              ? "Positive relationship between attendance and academic performance."
              : correlation <= -0.4
                ? "Negative relationship detected; review data quality and outliers."
                : "Weak or limited relationship detected in current records.",
        commonReasonsForAbsence:
          commonReasons.length > 0
            ? commonReasons
            : [{ reason: "No absence remarks recorded", count: 0 }],
        summaryParagraphs: [
          `Overall attendance is ${overallAttendanceRate}% for ${context.termName}. ${bestClass ? `${bestClass.className} has the best attendance at ${bestClass.attendanceRate}%.` : "No class attendance data is available yet."}`,
          `${worstClass ? `${worstClass.className} has the weakest attendance at ${worstClass.attendanceRate}%.` : "No worst-attendance class is available yet."} Late arrivals account for ${overall.total > 0 ? round((overall.late / overall.total) * 100) : 0}% of attendance records.`,
          correlation === null
            ? "Attendance vs academic performance correlation is unavailable until students have both attendance and approved or published result records."
            : `Attendance vs academic performance correlation is ${correlation}, indicating ${correlation >= 0.4 ? "a meaningful positive relationship" : correlation <= -0.4 ? "a negative relationship requiring data review" : "a weak relationship in current records"}.`,
        ],
      },
      visualizations: {
        dailyAttendanceHeatMap: {
          chartType: "heat_map",
          title: "Daily Attendance Heat Map",
          rowKey: "date",
          columnKey: "className",
          valueKey: "attendanceRate",
          data: Array.from(heatMap.values()).sort((a, b) =>
            a.date.localeCompare(b.date) || a.className.localeCompare(b.className)
          ),
        },
        attendanceByClass: {
          chartType: "bar",
          title: "Attendance by Class",
          data: classAttendance,
        },
        attendanceOverDays: {
          chartType: "line",
          title: "Attendance Over Days",
          data: dailyAttendance,
        },
        calendarAttendanceIndicators: {
          chartType: "calendar",
          title: "Calendar View with Attendance Indicators",
          data: dailyAttendance.map((day) => ({
            date: day.date,
            attendanceRate: day.attendanceRate,
            status:
              day.attendanceRate >= 90
                ? "Strong"
                : day.attendanceRate >= 75
                  ? "Watch"
                  : "Concern",
          })),
        },
      },
      absenteeismPatterns,
      lateArrivals: studentAttendance
        .filter((student) => student.late > 0)
        .sort((a, b) => b.late - a.late)
        .slice(0, 20),
      actionableInsights: {
        studentsWithPoorAttendance: studentAttendance
          .filter((student) => student.attendanceRate < 85 || student.absent >= 3)
          .slice(0, 25),
        attendanceImprovementSuggestions: [
          "Contact guardians for students below 85% attendance or with repeated absences.",
          "Review daily attendance before midday so same-day follow-up is possible.",
          "Track reasons for absence consistently in attendance remarks to identify preventable patterns.",
          "Pair attendance follow-up with academic support for students who also have low performance.",
        ],
        patternIdentification: absenteeismPatterns.map((pattern) => ({
          pattern: `${pattern.weekday} absenteeism`,
          absentRate: pattern.absentRate,
          lateRate: pattern.lateRate,
          recommendation:
            pattern.absentRate >= 10
              ? `Investigate why ${pattern.weekday} has elevated absences.`
              : `Monitor ${pattern.weekday}; no severe absence pattern detected.`,
        })),
      },
      dataAvailability: {
        attendance: attendance.length > 0,
        absenceRemarks: commonReasons.some((reason) => reason.count > 0),
        academicCorrelation: correlation !== null,
      },
    })
  } catch (error) {
    console.error("Attendance summary report error:", error)
    return NextResponse.json(
      { error: "Failed to generate attendance summary report" },
      { status: 500 }
    )
  }
}
