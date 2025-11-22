import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only TEACHER can access teacher analytics
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
                  },
                },
                academicTerm: true,
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

    const { searchParams } = new URL(request.url)
    const termId = searchParams.get("termId")

    // Get current term if not specified
    let currentTerm = null
    if (termId) {
      currentTerm = await prisma.academicTerm.findUnique({
        where: { id: termId },
      })
    } else {
      currentTerm = await prisma.academicTerm.findFirst({
        where: { isCurrent: true },
      })
    }

    // Get all classes and subjects assigned to this teacher
    const assignedSubjects = staff.classSubjects
    const assignedClasses = staff.sections

    // Count students in assigned classes
    const totalStudents = assignedClasses.reduce(
      (sum, section) => sum + section.enrollments.length,
      0
    )

    // Results Statistics
    let resultsStats = {
      total: 0,
      draft: 0,
      submitted: 0,
      approved: 0,
      published: 0,
    }

    if (currentTerm) {
      const allResults = await prisma.result.findMany({
        where: {
          classSubjectId: { in: assignedSubjects.map((s) => s.id) },
          academicTermId: currentTerm.id,
        },
      })

      resultsStats = {
        total: allResults.length,
        draft: allResults.filter((r) => r.status === "DRAFT").length,
        submitted: allResults.filter((r) => r.status === "PENDING_CLASS_TEACHER").length,
        approved: allResults.filter((r) => r.status === "APPROVED").length,
        published: allResults.filter((r) => r.status === "PUBLISHED").length,
      }
    }

    // Performance by Subject
    const subjectPerformance: any[] = []
    if (currentTerm) {
      for (const classSubject of assignedSubjects) {
        const results = await prisma.result.findMany({
          where: {
            classSubjectId: classSubject.id,
            academicTermId: currentTerm.id,
            status: { in: ["APPROVED", "PUBLISHED"] },
          },
        })

        if (results.length > 0) {
          const averageScore =
            results.reduce(
              (sum, r) => sum + (r.marksObtained / r.maxMarks) * 100,
              0
            ) / results.length

          const passCount = results.filter(
            (r) => (r.marksObtained / r.maxMarks) * 100 >= (classSubject.passMarks || 0)
          ).length

          subjectPerformance.push({
            subjectName: classSubject.subject.name,
            className: classSubject.class.name,
            averageScore: averageScore.toFixed(1),
            totalStudents: results.length,
            passCount,
            passRate: ((passCount / results.length) * 100).toFixed(1),
          })
        }
      }
    }

    // Student Performance (Top and Bottom performers)
    let topPerformers: any[] = []
    let bottomPerformers: any[] = []
    if (currentTerm) {
      const allResults = await prisma.result.findMany({
        where: {
          classSubjectId: { in: assignedSubjects.map((s) => s.id) },
          academicTermId: currentTerm.id,
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
        { name: string; scores: number[]; subjects: string[] }
      >()

      allResults.forEach((result) => {
        const studentId = result.studentId
        const percentage = (result.marksObtained / result.maxMarks) * 100

        if (!studentScores.has(studentId)) {
          studentScores.set(studentId, {
            name: result.student.user.name,
            scores: [],
            subjects: [],
          })
        }

        const student = studentScores.get(studentId)!
        student.scores.push(percentage)
        student.subjects.push(result.classSubject.subject.name)
      })

      const studentAverages = Array.from(studentScores.entries()).map(([id, data]) => ({
        studentId: id,
        studentName: data.name,
        averageScore:
          data.scores.length > 0
            ? (data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(1)
            : "0",
        subjectCount: data.scores.length,
      }))

      topPerformers = studentAverages
        .sort((a, b) => parseFloat(b.averageScore) - parseFloat(a.averageScore))
        .slice(0, 5)

      bottomPerformers = studentAverages
        .sort((a, b) => parseFloat(a.averageScore) - parseFloat(b.averageScore))
        .slice(0, 5)
    }

    // Attendance for assigned classes (Last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const studentIds = assignedClasses.flatMap((section) =>
      section.enrollments.map((e) => e.studentId)
    )

    const attendanceStats = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        studentId: { in: studentIds },
        date: { gte: thirtyDaysAgo },
      },
      _count: { status: true },
    })

    const totalAttendanceRecords = attendanceStats.reduce(
      (sum, a) => sum + a._count.status,
      0
    )
    const presentCount = attendanceStats.find((a) => a.status === "PRESENT")?._count.status || 0
    const attendanceRate = totalAttendanceRecords > 0 
      ? ((presentCount / totalAttendanceRecords) * 100).toFixed(1) 
      : "0"

    // Assignment Statistics
    const assignments = await prisma.assignment.findMany({
      where: {
        teacherId: staff.id,
      },
      include: {
        studentAssignments: true,
      },
    })

    const assignmentStats = {
      total: assignments.length,
      pending: 0,
      submitted: 0,
      graded: 0,
    }

    assignments.forEach((assignment) => {
      assignment.studentAssignments.forEach((sa) => {
        if (sa.status === "PENDING") assignmentStats.pending += 1
        if (sa.status === "SUBMITTED") assignmentStats.submitted += 1
        if (sa.status === "GRADED") assignmentStats.graded += 1
      })
    })

    // Performance Trends (Last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyResults = await prisma.result.findMany({
      where: {
        classSubjectId: { in: assignedSubjects.map((s) => s.id) },
        status: { in: ["APPROVED", "PUBLISHED"] },
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        marksObtained: true,
        maxMarks: true,
        createdAt: true,
      },
    })

    const monthlyPerformance = new Map<string, { sum: number; count: number }>()
    monthlyResults.forEach((result) => {
      const month = new Date(result.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      })
      const percentage = (result.marksObtained / result.maxMarks) * 100

      if (!monthlyPerformance.has(month)) {
        monthlyPerformance.set(month, { sum: 0, count: 0 })
      }

      const stats = monthlyPerformance.get(month)!
      stats.sum += percentage
      stats.count += 1
    })

    const performanceTrend = Array.from(monthlyPerformance.entries())
      .map(([month, stats]) => ({
        month,
        averageScore: stats.count > 0 ? (stats.sum / stats.count).toFixed(1) : "0",
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

    // Class-wise Performance
    const classPerformance: any[] = []
    if (currentTerm) {
      for (const section of assignedClasses) {
        const sectionResults = await prisma.result.findMany({
          where: {
            classSubjectId: { in: assignedSubjects.map((s) => s.id) },
            academicTermId: currentTerm.id,
            studentId: { in: section.enrollments.map((e) => e.studentId) },
            status: { in: ["APPROVED", "PUBLISHED"] },
          },
        })

        if (sectionResults.length > 0) {
          const averageScore =
            sectionResults.reduce(
              (sum, r) => sum + (r.marksObtained / r.maxMarks) * 100,
              0
            ) / sectionResults.length

          classPerformance.push({
            className: `${section.class.name} - ${section.name}`,
            averageScore: averageScore.toFixed(1),
            studentCount: section.enrollments.length,
            resultCount: sectionResults.length,
          })
        }
      }
    }

    return NextResponse.json({
      overview: {
        totalStudents,
        assignedSubjects: assignedSubjects.length,
        assignedClasses: assignedClasses.length,
      },
      results: resultsStats,
      subjectPerformance,
      topPerformers,
      bottomPerformers,
      attendance: {
        totalRecords: totalAttendanceRecords,
        presentCount,
        attendanceRate,
      },
      assignments: assignmentStats,
      performanceTrend,
      classPerformance,
      currentTerm: currentTerm
        ? {
            id: currentTerm.id,
            name: currentTerm.name,
            academicYear: currentTerm.academicYear,
          }
        : null,
    })
  } catch (error) {
    console.error("Teacher analytics error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch teacher analytics"
    const isDbError = errorMessage.includes("Can't reach database server") || 
                     errorMessage.includes("database server")
    
    return NextResponse.json(
      { 
        error: isDbError 
          ? "Database connection error. Please check your database connection." 
          : "Failed to fetch teacher analytics",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

