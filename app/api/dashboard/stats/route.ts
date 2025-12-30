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

    // Student Status Distribution
    const studentStatus = await prisma.student.groupBy({
      by: ["status"],
      _count: { status: true },
    })

    // Staff Status Distribution
    const staffStatus = await prisma.staff.groupBy({
      by: ["status"],
      _count: { status: true },
    })

    // Staff by Designation
    const staffByDesignation = await prisma.staff.groupBy({
      by: ["designation"],
      _count: { designation: true },
    })

    // Fee Status Distribution
    const feeStatus = await prisma.fee.groupBy({
      by: ["status"],
      _count: { status: true },
      _sum: { amount: true, paidAmount: true },
    })

    // Attendance Status (Last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const attendanceStatus = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        studentId: { not: null },
        date: { gte: thirtyDaysAgo },
      },
      _count: { status: true },
    })

    // Results Status Distribution
    const currentTerm = await prisma.term.findFirst({
      where: { isCurrent: true },
    })

    let resultsStatus: any[] = []
    if (currentTerm) {
      const results = await prisma.result.groupBy({
        by: ["status"],
        where: {
          termId: currentTerm.id,
        },
        _count: { status: true },
      })
      resultsStatus = results
    }

    // Students by Class
    const studentsByClass = await prisma.classEnrollment.groupBy({
      by: ["classId"],
      where: {
        status: "ACTIVE",
      },
      _count: { classId: true },
    })

    const classDetails = await prisma.class.findMany({
      where: {
        id: { in: studentsByClass.map((s) => s.classId) },
      },
      select: {
        id: true,
        name: true,
      },
    })

    const classMap = new Map(classDetails.map((c) => [c.id, c.name]))
    const studentsByClassName = studentsByClass.map((s) => ({
      className: classMap.get(s.classId) || "Unknown",
      count: s._count.classId,
    }))

    // Fee Collection by Type
    const feesByType = await prisma.fee.groupBy({
      by: ["feeType"],
      _sum: { amount: true, paidAmount: true },
      _count: { feeType: true },
    })

    // Monthly Enrollment Trend (Last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        enrolledAt: { gte: sixMonthsAgo },
      },
      select: {
        enrolledAt: true,
      },
    })

    const enrollmentByMonth = new Map<string, number>()
    enrollments.forEach((enrollment) => {
      const month = new Date(enrollment.enrolledAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      })
      enrollmentByMonth.set(month, (enrollmentByMonth.get(month) || 0) + 1)
    })

    const enrollmentTrend = Array.from(enrollmentByMonth.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

    return NextResponse.json({
      studentStatus: studentStatus.map((s) => ({
        name: s.status,
        value: s._count.status,
      })),
      staffStatus: staffStatus.map((s) => ({
        name: s.status,
        value: s._count.status,
      })),
      staffByDesignation: staffByDesignation.map((s) => ({
        name: s.designation,
        value: s._count.designation,
      })),
      feeStatus: feeStatus.map((f) => ({
        name: f.status,
        value: f._count.status,
        amount: f._sum.amount || 0,
        paidAmount: f._sum.paidAmount || 0,
      })),
      attendanceStatus: attendanceStatus.map((a) => ({
        name: a.status,
        value: a._count.status,
      })),
      resultsStatus: resultsStatus.map((r) => ({
        name: r.status,
        value: r._count.status,
      })),
      studentsByClass: studentsByClassName,
      feesByType: feesByType.map((f) => ({
        name: f.feeType,
        value: f._count.feeType,
        amount: f._sum.amount || 0,
        paidAmount: f._sum.paidAmount || 0,
      })),
      enrollmentTrend,
    })
  } catch (error) {
    console.error("Dashboard stats error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch dashboard stats"
    const isDbError =
      errorMessage.includes("Can't reach database server") ||
      errorMessage.includes("database server")

    return NextResponse.json(
      {
        error: isDbError
          ? "Database connection error. Please check your database connection."
          : "Failed to fetch dashboard stats",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}

