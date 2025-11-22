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

    if (session.user.role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all fees
    const allFees = await prisma.fee.findMany({
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Calculate fee statistics
    const fees = {
      totalAmount: allFees.reduce((sum, f) => sum + f.amount, 0),
      paidAmount: allFees.reduce((sum, f) => sum + f.paidAmount, 0),
      pendingAmount: allFees
        .filter((f) => f.status === "PENDING")
        .reduce((sum, f) => sum + (f.amount - f.paidAmount), 0),
      overdueAmount: allFees
        .filter((f) => f.status === "OVERDUE")
        .reduce((sum, f) => sum + (f.amount - f.paidAmount), 0),
      collectionRate:
        allFees.reduce((sum, f) => sum + f.amount, 0) > 0
          ? (allFees.reduce((sum, f) => sum + f.paidAmount, 0) /
              allFees.reduce((sum, f) => sum + f.amount, 0)) *
            100
          : 0,
    }

    // Fee status distribution
    const feeStatusMap = new Map<string, { count: number; amount: number }>()
    allFees.forEach((fee) => {
      if (!feeStatusMap.has(fee.status)) {
        feeStatusMap.set(fee.status, { count: 0, amount: 0 })
      }
      const stats = feeStatusMap.get(fee.status)!
      stats.count += 1
      stats.amount += fee.amount
    })

    const feeStatus = Array.from(feeStatusMap.entries()).map(([name, stats]) => ({
      name,
      value: stats.count,
      amount: stats.amount,
    }))

    // Fee trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const monthlyFees = allFees.filter((f) => f.createdAt >= sixMonthsAgo)
    const feeByMonth = new Map<
      string,
      { total: number; paid: number; pending: number }
    >()

    monthlyFees.forEach((fee) => {
      const month = new Date(fee.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      })

      if (!feeByMonth.has(month)) {
        feeByMonth.set(month, { total: 0, paid: 0, pending: 0 })
      }

      const stats = feeByMonth.get(month)!
      stats.total += fee.amount
      stats.paid += fee.paidAmount
      stats.pending += fee.amount - fee.paidAmount
    })

    const feeTrend = Array.from(feeByMonth.entries())
      .map(([month, stats]) => ({
        month,
        total: stats.total.toFixed(2),
        paid: stats.paid.toFixed(2),
        pending: stats.pending.toFixed(2),
        collectionRate:
          stats.total > 0 ? ((stats.paid / stats.total) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime())

    // Recent payments
    const recentPayments = allFees
      .filter((f) => f.paidDate && f.paidAmount > 0)
      .sort((a, b) => new Date(b.paidDate!).getTime() - new Date(a.paidDate!).getTime())
      .slice(0, 10)
      .map((f) => ({
        id: f.id,
        studentName: f.student.user.name,
        amount: f.paidAmount,
        paidDate: f.paidDate!,
        feeType: f.feeType,
      }))

    return NextResponse.json({
      fees,
      feeStatus,
      feeTrend,
      recentPayments,
    })
  } catch (error) {
    console.error("Accountant analytics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch accountant analytics" },
      { status: 500 }
    )
  }
}

