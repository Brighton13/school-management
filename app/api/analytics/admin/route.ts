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

    // Only ADMIN and PRINCIPAL can access admin analytics
    if (session.user.role !== "ADMIN" && session.user.role !== "PRINCIPAL") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const academicYear = searchParams.get("academicYear")
    const termId = searchParams.get("termId")

    // Get current academic context
    const context = await getAcademicContext()
    
    // Use specified term or default to current
    let currentTerm = null
    if (termId) {
      currentTerm = await prisma.term.findUnique({
        where: { id: termId },
        include: { academicYear: true },
      })
    } else {
      currentTerm = await prisma.term.findUnique({
        where: { id: context.termId },
        include: { academicYear: true },
      })
    }

    // Overall Statistics
    const [
      totalStudents,
      activeStudents,
      totalStaff,
      activeStaff,
      totalClasses,
      totalSections,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.staff.count(),
      prisma.staff.count({ where: { status: "ACTIVE" } }),
      prisma.class.count(),
      prisma.section.count(),
    ])

    // Fee Analytics
    const feeStats = await prisma.fee.groupBy({
      by: ["status"],
      _count: { status: true },
      _sum: { amount: true, paidAmount: true },
    })

    const totalFeeAmount = feeStats.reduce((sum, f) => sum + (f._sum.amount || 0), 0)
    const totalPaidAmount = feeStats.reduce((sum, f) => sum + (f._sum.paidAmount || 0), 0)
    const pendingFees = feeStats.find((f) => f.status === "PENDING")?._count.status || 0
    const overdueFees = feeStats.find((f) => f.status === "OVERDUE")?._count.status || 0

    // Attendance Analytics (Last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const attendanceStats = await prisma.attendance.groupBy({
      by: ["status"],
      where: {
        studentId: { not: null },
        date: { gte: thirtyDaysAgo },
      },
      _count: { status: true },
    })

    const totalAttendanceRecords = attendanceStats.reduce(
      (sum, a) => sum + a._count.status,
      0
    )
    const presentCount = attendanceStats.find((a) => a.status === "PRESENT")?._count.status || 0
    const absentCount = attendanceStats.find((a) => a.status === "ABSENT")?._count.status || 0
    const lateCount = attendanceStats.find((a) => a.status === "LATE")?._count.status || 0
    const attendanceRate = totalAttendanceRecords > 0 
      ? ((presentCount / totalAttendanceRecords) * 100).toFixed(1) 
      : "0"

    // Student Performance by Class (if term is available)
    let classPerformance: any[] = []
    if (currentTerm) {
      const results = await prisma.result.findMany({
        where: {
          termId: currentTerm.id,
          academicYearId: currentTerm.academicYear.id,
          status: { in: ["APPROVED", "PUBLISHED"] },
        },
        include: {
          student: {
            include: {
              classEnrollment: {
                where: {
                  academicYearId: currentTerm.academicYear.id,
                },
                include: {
                  class: true,
                },
              },
            },
          },
        },
      })

      // Group by class
      const classMap = new Map<string, { total: number; sum: number; count: number }>()
      
      results.forEach((result) => {
        const enrollment = result.student.classEnrollment[0]
        if (enrollment) {
          const className = enrollment.class.name
          const percentage = (result.marksObtained / result.maxMarks) * 100
          
          if (!classMap.has(className)) {
            classMap.set(className, { total: 0, sum: 0, count: 0 })
          }
          
          const stats = classMap.get(className)!
          stats.sum += percentage
          stats.count += 1
        }
      })

      classPerformance = Array.from(classMap.entries()).map(([className, stats]) => ({
        className,
        averageScore: stats.count > 0 ? (stats.sum / stats.count).toFixed(1) : "0",
        studentCount: stats.count,
      }))
    }

    // Performance Trends (Last 6 months by month)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyResults = await prisma.result.findMany({
      where: {
        status: { in: ["APPROVED", "PUBLISHED"] },
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        marksObtained: true,
        maxMarks: true,
        createdAt: true,
      },
    })

    // Group by month
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

    // Attendance Trends (Last 6 months)
    const monthlyAttendance = await prisma.attendance.findMany({
      where: {
        studentId: { not: null },
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
        rate: stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

    // Fee Collection Trends
    const monthlyFees = await prisma.fee.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
      },
      select: {
        amount: true,
        paidAmount: true,
        status: true,
        createdAt: true,
      },
    })

    const feeCollectionByMonth = new Map<
      string,
      { total: number; paid: number; pending: number }
    >()

    monthlyFees.forEach((fee) => {
      const month = new Date(fee.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      })

      if (!feeCollectionByMonth.has(month)) {
        feeCollectionByMonth.set(month, { total: 0, paid: 0, pending: 0 })
      }

      const stats = feeCollectionByMonth.get(month)!
      stats.total += fee.amount
      stats.paid += fee.paidAmount
      stats.pending += fee.amount - fee.paidAmount
    })

    const feeTrend = Array.from(feeCollectionByMonth.entries())
      .map(([month, stats]) => ({
        month,
        total: stats.total.toFixed(2),
        paid: stats.paid.toFixed(2),
        pending: stats.pending.toFixed(2),
        collectionRate: stats.total > 0 
          ? ((stats.paid / stats.total) * 100).toFixed(1) 
          : "0",
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

    // Staff by Qualification
    const staffByQualification = await prisma.staff.groupBy({
      by: ["qualification"],
      where: {
        qualification: { not: null },
      },
      _count: { qualification: true },
    })

    const staffQualificationData = staffByQualification.map((s) => ({
      qualification: s.qualification || "Not Specified",
      count: s._count.qualification,
    }))

    // Subject Performance (Top and Bottom performing subjects)
    let subjectPerformance: any[] = []
    if (currentTerm) {
      const subjectResults = await prisma.result.findMany({
        where: {
          termId: currentTerm.id,
          academicYearId: currentTerm.academicYear.id,
          status: { in: ["APPROVED", "PUBLISHED"] },
        },
        include: {
          classSubject: {
            include: {
              subject: true,
            },
          },
        },
      })

      const subjectMap = new Map<string, { sum: number; count: number; name: string }>()

      subjectResults.forEach((result) => {
        const subjectName = result.classSubject.subject.name
        const percentage = (result.marksObtained / result.maxMarks) * 100

        if (!subjectMap.has(subjectName)) {
          subjectMap.set(subjectName, { sum: 0, count: 0, name: subjectName })
        }

        const stats = subjectMap.get(subjectName)!
        stats.sum += percentage
        stats.count += 1
      })

      subjectPerformance = Array.from(subjectMap.values())
        .map((stats) => ({
          subjectName: stats.name,
          averageScore: stats.count > 0 ? (stats.sum / stats.count).toFixed(1) : "0",
          studentCount: stats.count,
        }))
        .sort((a, b) => parseFloat(b.averageScore) - parseFloat(a.averageScore))
        .slice(0, 10) // Top 10
    }

    // Recent Activity (Last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentActivity = await prisma.auditTrail.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    })

    return NextResponse.json({
      overview: {
        totalStudents,
        activeStudents,
        totalStaff,
        activeStaff,
        totalClasses,
        totalSections,
      },
      fees: {
        totalAmount: totalFeeAmount,
        paidAmount: totalPaidAmount,
        pendingAmount: totalFeeAmount - totalPaidAmount,
        pendingCount: pendingFees,
        overdueCount: overdueFees,
        collectionRate: totalFeeAmount > 0 
          ? ((totalPaidAmount / totalFeeAmount) * 100).toFixed(1) 
          : "0",
      },
      attendance: {
        totalRecords: totalAttendanceRecords,
        presentCount,
        absentCount,
        lateCount,
        attendanceRate,
      },
      classPerformance,
      performanceTrend,
      attendanceTrend,
      feeTrend,
      subjectPerformance,
      staffByQualification: staffQualificationData,
      recentActivity: recentActivity.map((activity) => ({
        id: activity.id,
        action: activity.action,
        entityType: activity.entityType,
        description: activity.description,
        userName: activity.user.name,
        userRole: activity.user.role,
        createdAt: activity.createdAt,
      })),
      currentTerm: currentTerm
        ? {
            id: currentTerm.id,
            name: currentTerm.name,
            academicYear: currentTerm.academicYear,
          }
        : null,
    })
  } catch (error) {
    console.error("Analytics error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch analytics"
    const isDbError = errorMessage.includes("Can't reach database server") || 
                     errorMessage.includes("database server")
    
    return NextResponse.json(
      { 
        error: isDbError 
          ? "Database connection error. Please check your database connection." 
          : "Failed to fetch analytics",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

