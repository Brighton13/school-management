import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAcademicContext } from "@/lib/academic-year"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get teacher's staff record
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        classSubjects: {
          include: {
            class: true,
            subject: true,
            results: {
              include: {
                student: {
                  include: {
                    user: true,
                    classEnrollment: {
                      include: {
                        class: true,
                        section: true,
                      },
                    },
                  },
                },
                academicYear: true,
                term: true,
              },
            },
          },
        },
        sections: {
          include: {
            class: true,
            enrollments: {
              include: {
                student: {
                  include: {
                    user: true,
                    attendance: {
                      where: {
                        date: {
                          gte: new Date(new Date().setDate(new Date().getDate() - 30)),
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff record not found" }, { status: 404 })
    }

    // Get current academic context
    const context = await getAcademicContext()
    const currentTerm = await prisma.term.findUnique({
      where: { id: context.termId },
      include: { academicYear: true },
    })

    // Get all students in teacher's classes
    const allStudents = staff.sections.flatMap((section) =>
      section.enrollments.map((e) => ({
        ...e.student,
        className: `${section.class.name} - ${section.name}`,
        sectionId: section.id,
      }))
    )

    // Remove duplicates
    const uniqueStudents = Array.from(
      new Map(allStudents.map((s) => [s.id, s])).values()
    )

    // Student Performance by Subject
    const studentPerformanceBySubject: any[] = []
    if (currentTerm) {
      for (const classSubject of staff.classSubjects) {
        const results = await prisma.result.findMany({
          where: {
            classSubjectId: classSubject.id,
            termId: currentTerm.id,
            academicYearId: currentTerm.academicYear.id,
            status: { in: ["APPROVED", "PUBLISHED"] },
          },
          include: {
            student: {
              include: {
                user: true,
              },
            },
          },
        })

        const subjectData = {
          subjectName: classSubject.subject.name,
          subjectCode: classSubject.subject.code,
          className: classSubject.class.name,
          classSubjectId: classSubject.id,
          students: results.map((r) => ({
            studentId: r.student.id,
            studentName: r.student.user.name,
            admissionNumber: r.student.admissionNumber,
            marksObtained: r.marksObtained,
            maxMarks: r.maxMarks,
            percentage: (r.marksObtained / r.maxMarks) * 100,
            grade: r.grade,
          })),
          averageScore:
            results.length > 0
              ? results.reduce(
                  (sum, r) => sum + (r.marksObtained / r.maxMarks) * 100,
                  0
                ) / results.length
              : 0,
          totalStudents: results.length,
        }

        studentPerformanceBySubject.push(subjectData)
      }
    }

    // Overall Student Rankings
    let studentRankings: any[] = []
    if (currentTerm) {
      const allResults = await prisma.result.findMany({
        where: {
          classSubjectId: { in: staff.classSubjects.map((s) => s.id) },
          termId: currentTerm.id,
          academicYearId: currentTerm.academicYear.id,
          status: { in: ["APPROVED", "PUBLISHED"] },
        },
        include: {
          student: {
            include: {
              user: true,
            },
          },
          classSubject: {
            include: {
              subject: true,
            },
          },
        },
      })

      // Calculate average per student
      const studentScores = new Map<
        string,
        {
          name: string
          admissionNumber: string
          scores: number[]
          subjects: string[]
          totalMarks: number
          maxMarks: number
        }
      >()

      allResults.forEach((result) => {
        const studentId = result.studentId
        const percentage = (result.marksObtained / result.maxMarks) * 100

        if (!studentScores.has(studentId)) {
          studentScores.set(studentId, {
            name: result.student.user.name,
            admissionNumber: result.student.admissionNumber,
            scores: [],
            subjects: [],
            totalMarks: 0,
            maxMarks: 0,
          })
        }

        const student = studentScores.get(studentId)!
        student.scores.push(percentage)
        student.subjects.push(result.classSubject.subject.name)
        student.totalMarks += result.marksObtained
        student.maxMarks += result.maxMarks
      })

      studentRankings = Array.from(studentScores.entries())
        .map(([id, data]) => ({
          studentId: id,
          studentName: data.name,
          admissionNumber: data.admissionNumber,
          averageScore:
            data.scores.length > 0
              ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
              : 0,
          totalScore: data.totalMarks,
          maxScore: data.maxMarks,
          subjectCount: data.scores.length,
          subjects: data.subjects,
        }))
        .sort((a, b) => b.averageScore - a.averageScore)
    }

    // Attendance Analytics
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const attendanceData = await prisma.attendance.findMany({
      where: {
        studentId: { in: uniqueStudents.map((s) => s.id) },
        date: { gte: thirtyDaysAgo },
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
    })

    // Attendance by Student
    const attendanceByStudent = new Map<
      string,
      { name: string; present: number; absent: number; late: number; excused: number; total: number }
    >()

    attendanceData.forEach((attendance) => {
      const studentId = attendance.studentId!
      if (!attendanceByStudent.has(studentId)) {
        attendanceByStudent.set(studentId, {
          name: attendance.student!.user.name,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
        })
      }

      const stats = attendanceByStudent.get(studentId)!
      stats.total += 1
      if (attendance.status === "PRESENT") stats.present += 1
      if (attendance.status === "ABSENT") stats.absent += 1
      if (attendance.status === "LATE") stats.late += 1
      if (attendance.status === "EXCUSED") stats.excused += 1
    })

    const studentAttendanceList = Array.from(attendanceByStudent.entries()).map(
      ([studentId, stats]) => ({
        studentId,
        studentName: stats.name,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        excused: stats.excused,
        total: stats.total,
        attendanceRate: stats.total > 0 ? (stats.present / stats.total) * 100 : 0,
      })
    )

    // Attendance Trends (Last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyAttendance = await prisma.attendance.findMany({
      where: {
        studentId: { in: uniqueStudents.map((s) => s.id) },
        date: { gte: sixMonthsAgo },
      },
      select: {
        status: true,
        date: true,
      },
    })

    const attendanceByMonth = new Map<
      string,
      { present: number; absent: number; late: number; total: number }
    >()

    monthlyAttendance.forEach((attendance) => {
      const month = new Date(attendance.date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      })

      if (!attendanceByMonth.has(month)) {
        attendanceByMonth.set(month, { present: 0, absent: 0, late: 0, total: 0 })
      }

      const stats = attendanceByMonth.get(month)!
      stats.total += 1
      if (attendance.status === "PRESENT") stats.present += 1
      if (attendance.status === "ABSENT") stats.absent += 1
      if (attendance.status === "LATE") stats.late += 1
    })

    const attendanceTrend = Array.from(attendanceByMonth.entries())
      .map(([month, stats]) => ({
        month,
        present: stats.present,
        absent: stats.absent,
        late: stats.late,
        rate: stats.total > 0 ? (stats.present / stats.total) * 100 : 0,
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

    // Subject Performance Distribution
    const subjectPerformanceDistribution = studentPerformanceBySubject.map((subject) => ({
      subjectName: subject.subjectName,
      averageScore: subject.averageScore,
      totalStudents: subject.totalStudents,
      passCount: subject.students.filter((s: any) => s.percentage >= 50).length,
      failCount: subject.students.filter((s: any) => s.percentage < 50).length,
    }))

    // Class-wise Statistics
    const classStatistics = staff.sections.map((section) => {
      const sectionStudents = section.enrollments.map((e) => e.student)
      const sectionAttendance = attendanceData.filter((a) =>
        sectionStudents.some((s) => s.id === a.studentId)
      )

      const presentCount = sectionAttendance.filter((a) => a.status === "PRESENT").length
      const totalCount = sectionAttendance.length
      const attendanceRate = totalCount > 0 ? (presentCount / totalCount) * 100 : 0

      return {
        className: `${section.class.name} - ${section.name}`,
        studentCount: sectionStudents.length,
        attendanceRate,
        presentCount,
        totalAttendanceRecords: totalCount,
      }
    })

    return NextResponse.json({
      overview: {
        totalStudents: uniqueStudents.length,
        assignedSubjects: staff.classSubjects.length,
        assignedClasses: staff.sections.length,
        currentTerm: currentTerm
          ? {
              id: currentTerm.id,
              name: currentTerm.name,
              academicYear: currentTerm.academicYear,
            }
          : null,
      },
      studentPerformanceBySubject,
      studentRankings,
      studentAttendanceList,
      attendanceTrend,
      subjectPerformanceDistribution,
      classStatistics,
    })
  } catch (error) {
    console.error("Detailed teacher analytics error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch analytics"
    const isDbError =
      errorMessage.includes("Can't reach database server") ||
      errorMessage.includes("database server")

    return NextResponse.json(
      {
        error: isDbError
          ? "Database connection error. Please check your database connection."
          : "Failed to fetch teacher analytics",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}

