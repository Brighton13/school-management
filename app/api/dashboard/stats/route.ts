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

    // Get current academic year
    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: { isCurrent: true },
    })

    // Student Status Distribution
    const studentStatus = await prisma.student.groupBy({
      by: ["status"],
      _count: { status: true },
    })

    // Student Gender Distribution - current academic year enrollments
    const studentGender = currentAcademicYear
      ? await prisma.student.groupBy({
          by: ["gender"],
          where: { 
            classEnrollment: {
              some: {
                status: "ACTIVE",
                academicYearId: currentAcademicYear.id
              }
            }
          },
          _count: { gender: true },
        })
      : await prisma.student.groupBy({
          by: ["gender"],
          where: { status: "ACTIVE" },
          _count: { gender: true },
        })

    // Staff Status Distribution
    const staffStatus = await prisma.staff.groupBy({
      by: ["status"],
      _count: { status: true },
    })

    // Staff Gender Distribution
    const staffGender = await prisma.staff.groupBy({
      by: ["gender"],
      where: { 
        status: "ACTIVE",
        gender: { not: null },
      },
      _count: { gender: true },
    })

    // Staff by Designation
    const staffByDesignation = await prisma.staff.groupBy({
      by: ["designation"],
      _count: { designation: true },
    })

    // Fee Status Distribution - current academic year
    const feeStatus = currentAcademicYear
      ? await prisma.fee.groupBy({
          by: ["status"],
          where: {
            academicYearId: currentAcademicYear.id
          },
          _count: { status: true },
          _sum: { amount: true, paidAmount: true },
        })
      : await prisma.fee.groupBy({
          by: ["status"],
          _count: { status: true },
          _sum: { amount: true, paidAmount: true },
        })

    // Attendance Status (Last 30 days) - current academic year
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const attendanceStatus = currentAcademicYear
      ? await prisma.attendance.groupBy({
          by: ["status"],
          where: {
            studentId: { not: null },
            date: { gte: thirtyDaysAgo },
            academicYearId: currentAcademicYear.id,
          },
          _count: { status: true },
        })
      : await prisma.attendance.groupBy({
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

    // Students by Class - current academic year
    const studentsByClass = currentAcademicYear
      ? await prisma.classEnrollment.groupBy({
          by: ["classId"],
          where: {
            status: "ACTIVE",
            academicYearId: currentAcademicYear.id,
          },
          _count: { classId: true },
        })
      : await prisma.classEnrollment.groupBy({
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

    // Fee Collection by Type - current academic year
    const feesByType = currentAcademicYear
      ? await prisma.fee.groupBy({
          by: ["feeType"],
          where: {
            academicYearId: currentAcademicYear.id
          },
          _sum: { amount: true, paidAmount: true },
          _count: { feeType: true },
        })
      : await prisma.fee.groupBy({
          by: ["feeType"],
          _sum: { amount: true, paidAmount: true },
          _count: { feeType: true },
        })

    // Monthly Enrollment Trend (Last 6 months) - current academic year
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const enrollments = currentAcademicYear
      ? await prisma.classEnrollment.findMany({
          where: {
            enrolledAt: { gte: sixMonthsAgo },
            academicYearId: currentAcademicYear.id,
          },
          select: {
            enrolledAt: true,
          },
        })
      : await prisma.classEnrollment.findMany({
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
      studentGender: studentGender.map((s) => ({
        name: s.gender || "Not Specified",
        value: s._count.gender,
      })),
      staffStatus: staffStatus.map((s) => ({
        name: s.status,
        value: s._count.status,
      })),
      staffGender: staffGender.map((s) => ({
        name: s.gender || "Not Specified",
        value: s._count.gender,
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

