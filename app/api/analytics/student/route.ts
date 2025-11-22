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

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get student record
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        user: true,
        classEnrollment: {
          include: {
            class: true,
            section: true,
          },
          where: {
            status: "ACTIVE",
          },
          take: 1,
        },
        results: {
          include: {
            classSubject: {
              include: {
                subject: true,
              },
            },
            academicTerm: true,
          },
          where: {
            status: { in: ["APPROVED", "PUBLISHED"] },
          },
        },
        attendance: {
          where: {
            date: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            },
          },
        },
        fees: {
          include: {
            academicTerm: true,
          },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: "Student record not found" }, { status: 404 })
    }

    const currentEnrollment = student.classEnrollment[0]
    const className = currentEnrollment
      ? `${currentEnrollment.class.name} - ${currentEnrollment.section.name}`
      : "Not Enrolled"

    // Calculate attendance
    const attendance = {
      present: student.attendance.filter((a) => a.status === "PRESENT").length,
      absent: student.attendance.filter((a) => a.status === "ABSENT").length,
      late: student.attendance.filter((a) => a.status === "LATE").length,
      total: student.attendance.length,
      rate:
        student.attendance.length > 0
          ? (student.attendance.filter((a) => a.status === "PRESENT").length /
              student.attendance.length) *
            100
          : 0,
    }

    // Calculate fees
    const fees = {
      total: student.fees.reduce((sum, f) => sum + f.amount, 0),
      paid: student.fees.reduce((sum, f) => sum + f.paidAmount, 0),
      pending: student.fees.filter((f) => f.status === "PENDING").length,
      overdue: student.fees.filter((f) => f.status === "OVERDUE").length,
    }

    // Performance trend by term
    const performanceByTerm = new Map<string, { total: number; count: number }>()
    student.results.forEach((result) => {
      const termName = result.academicTerm.name
      const percentage = (result.marksObtained / result.maxMarks) * 100

      if (!performanceByTerm.has(termName)) {
        performanceByTerm.set(termName, { total: 0, count: 0 })
      }

      const stats = performanceByTerm.get(termName)!
      stats.total += percentage
      stats.count += 1
    })

    const performanceTrend = Array.from(performanceByTerm.entries())
      .map(([term, stats]) => ({
        term,
        averageScore: stats.count > 0 ? stats.total / stats.count : 0,
      }))
      .sort((a, b) => a.term.localeCompare(b.term))

    return NextResponse.json({
      student: {
        name: student.user.name,
        admissionNumber: student.admissionNumber,
        className,
      },
      results: student.results.map((r) => ({
        subjectName: r.classSubject.subject.name,
        marksObtained: r.marksObtained,
        maxMarks: r.maxMarks,
        percentage: (r.marksObtained / r.maxMarks) * 100,
        grade: r.grade,
        termName: r.academicTerm.name,
      })),
      attendance,
      fees,
      performanceTrend,
    })
  } catch (error) {
    console.error("Student analytics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch student analytics" },
      { status: 500 }
    )
  }
}

