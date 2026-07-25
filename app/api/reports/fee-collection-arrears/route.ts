import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resolveReportingAcademicScope } from "@/lib/reporting-academic-scope"

export const dynamic = "force-dynamic"

const money = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()
    const monthKeys = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
      return monthKey(date)
    })

    const [schoolConfig, scope, fees, payments] =
      await Promise.all([
        prisma.schoolConfig.findFirst(),
        resolveReportingAcademicScope(request),
        prisma.fee.findMany({
          include: {
            student: {
              include: {
                user: true,
                classEnrollment: {
                  where: { status: "ACTIVE" },
                  include: { class: true, section: true },
                  orderBy: { enrolledAt: "desc" },
                  take: 1,
                },
              },
            },
            term: { include: { academicYear: true } },
            academicYear: true,
          },
        }),
        prisma.payment.findMany({
          where: { status: "SUCCESS" },
          include: { fee: true },
          orderBy: { createdAt: "asc" },
        }),
      ])

    const scopedFees = fees.filter((fee) =>
      scope.termId
        ? fee.termId === scope.termId
        : fee.academicYearId === scope.academicYearId
    )

    const scopedPayments = payments.filter((payment) =>
      scope.termId
        ? payment.fee.termId === scope.termId
        : payment.fee.academicYearId === scope.academicYearId
    )

    const totalExpectedFees = scopedFees.reduce((sum, fee) => sum + fee.amount, 0)
    const totalCollectedFees = scopedFees.reduce((sum, fee) => sum + fee.paidAmount, 0)
    const totalOutstandingFees = scopedFees.reduce(
      (sum, fee) => sum + Math.max(fee.amount - fee.paidAmount, 0),
      0
    )
    const collectionRate =
      totalExpectedFees > 0 ? (totalCollectedFees / totalExpectedFees) * 100 : 0

    const byClass = new Map<
      string,
      {
        className: string
        expected: number
        collected: number
        outstanding: number
        defaulters: Set<string>
      }
    >()
    const feeStructure = new Map<
      string,
      { feeType: string; expected: number; collected: number; outstanding: number }
    >()
    const studentArrears = new Map<
      string,
      {
        student: string
        admissionNumber: string
        className: string
        expected: number
        collected: number
        outstanding: number
        oldestDueDate: Date | null
        feeTypes: Set<string>
        statuses: Set<string>
      }
    >()
    const paymentPatterns = { early: 0, late: 0, defaulters: 0 }

    for (const fee of scopedFees) {
      const enrollment = fee.student.classEnrollment[0]
      const className = enrollment
        ? `${enrollment.class.name}${enrollment.section ? ` - ${enrollment.section.name}` : ""}`
        : "Unassigned"
      const outstanding = Math.max(fee.amount - fee.paidAmount, 0)
      const dueDate = new Date(fee.dueDate)

      if (!byClass.has(className)) {
        byClass.set(className, {
          className,
          expected: 0,
          collected: 0,
          outstanding: 0,
          defaulters: new Set(),
        })
      }

      const classStats = byClass.get(className)!
      classStats.expected += fee.amount
      classStats.collected += fee.paidAmount
      classStats.outstanding += outstanding
      if (outstanding > 0) classStats.defaulters.add(fee.studentId)

      if (!feeStructure.has(fee.feeType)) {
        feeStructure.set(fee.feeType, {
          feeType: fee.feeType,
          expected: 0,
          collected: 0,
          outstanding: 0,
        })
      }
      const feeStats = feeStructure.get(fee.feeType)!
      feeStats.expected += fee.amount
      feeStats.collected += fee.paidAmount
      feeStats.outstanding += outstanding

      if (outstanding > 0) {
        paymentPatterns.defaulters += 1
      } else if (fee.paidDate && new Date(fee.paidDate) <= dueDate) {
        paymentPatterns.early += 1
      } else if (fee.paidDate && new Date(fee.paidDate) > dueDate) {
        paymentPatterns.late += 1
      }

      if (outstanding > 0) {
        if (!studentArrears.has(fee.studentId)) {
          studentArrears.set(fee.studentId, {
            student: fee.student.user.name,
            admissionNumber: fee.student.admissionNumber,
            className,
            expected: 0,
            collected: 0,
            outstanding: 0,
            oldestDueDate: null,
            feeTypes: new Set(),
            statuses: new Set(),
          })
        }

        const arrears = studentArrears.get(fee.studentId)!
        arrears.expected += fee.amount
        arrears.collected += fee.paidAmount
        arrears.outstanding += outstanding
        arrears.feeTypes.add(fee.feeType)
        arrears.statuses.add(fee.status)
        if (!arrears.oldestDueDate || dueDate < arrears.oldestDueDate) {
          arrears.oldestDueDate = dueDate
        }
      }
    }

    const collectionRateByClass = Array.from(byClass.values())
      .map((stats) => ({
        className: stats.className,
        expected: money(stats.expected),
        collected: money(stats.collected),
        outstanding: money(stats.outstanding),
        defaulters: stats.defaulters.size,
        collectionRate:
          stats.expected > 0 ? money((stats.collected / stats.expected) * 100) : 0,
      }))
      .sort((a, b) => b.collectionRate - a.collectionRate || b.expected - a.expected)

    const feeStructureEffectiveness = Array.from(feeStructure.values())
      .map((stats) => {
        const collectionEfficiency =
          stats.expected > 0 ? (stats.collected / stats.expected) * 100 : 0
        return {
          feeType: stats.feeType,
          expected: money(stats.expected),
          collected: money(stats.collected),
          outstanding: money(stats.outstanding),
          collectionRate: money(collectionEfficiency),
          effectiveness:
            collectionEfficiency >= 85
              ? "Effective"
              : collectionEfficiency >= 65
                ? "Needs follow-up"
                : "Weak",
        }
      })
      .sort((a, b) => b.expected - a.expected)

    const monthlyTrend = Object.fromEntries(
      monthKeys.map((key) => [key, { month: monthLabel(key), collected: 0 }])
    )
    for (const payment of scopedPayments) {
      const key = monthKey(new Date(payment.createdAt))
      if (monthlyTrend[key]) {
        monthlyTrend[key].collected += payment.amount
      }
    }

    const defaulters = Array.from(studentArrears.values())
      .map((item) => ({
        student: item.student,
        admissionNumber: item.admissionNumber,
        className: item.className,
        expected: money(item.expected),
        collected: money(item.collected),
        outstanding: money(item.outstanding),
        feeTypes: Array.from(item.feeTypes).sort(),
        status: Array.from(item.statuses).sort().join(", "),
        oldestDueDate: item.oldestDueDate?.toISOString().slice(0, 10) || null,
        daysOverdue:
          item.oldestDueDate && item.oldestDueDate < now
            ? Math.floor((now.getTime() - item.oldestDueDate.getTime()) / 86400000)
            : 0,
      }))
      .sort((a, b) => b.outstanding - a.outstanding || b.daysOverdue - a.daysOverdue)

    const highestClass = collectionRateByClass[0] || null
    const lowestClass =
      collectionRateByClass.length > 0
        ? collectionRateByClass[collectionRateByClass.length - 1]
        : null

    return NextResponse.json({
      meta: {
        schoolName: schoolConfig?.schoolName || "School",
        academicYear: scope.academicYear,
        term: scope.termName,
        generatedAt: now.toISOString(),
        scope: scope.termId ? "Selected term" : "Selected academic year",
        currency: "ZMW",
      },
      executiveSummary: {
        collectionRate: money(collectionRate),
        totalExpectedFees: money(totalExpectedFees),
        totalCollectedFees: money(totalCollectedFees),
        totalOutstandingAmount: money(totalOutstandingFees),
        defaulterCount: defaulters.length,
        highestCollectionClass: highestClass,
        lowestCollectionClass: lowestClass,
        summaryParagraph:
          `Overall collection rate is ${money(collectionRate)}%, with ${money(totalCollectedFees)} collected against ${money(totalExpectedFees)} expected fees. Outstanding arrears total ${money(totalOutstandingFees)} across ${defaulters.length} defaulters.`,
      },
      visualizations: {
        paidVsUnpaidFees: {
          chartType: "donut",
          title: "Paid vs Unpaid Fees",
          data: [
            { name: "Paid", value: money(totalCollectedFees), color: "#16a34a" },
            { name: "Unpaid", value: money(totalOutstandingFees), color: "#dc2626" },
          ],
        },
        collectionRateByClass: {
          chartType: "bar",
          title: "Collection Rate by Class",
          data: collectionRateByClass,
        },
        monthlyCollectionTrends: {
          chartType: "line",
          title: "Monthly Collection Trends",
          data: Object.values(monthlyTrend).map((item) => ({
            month: item.month,
            collected: money(item.collected),
          })),
        },
        topDefaultersTable: {
          chartType: "table",
          title: "Top Defaulters List",
          data: defaulters.slice(0, 10),
        },
      },
      paymentPatterns,
      feeStructureEffectiveness,
      actionableInsights: {
        overdueMoreThan30Days: defaulters.filter((item) => item.daysOverdue > 30),
        recommendedActionsForDefaulters: [
          "Send immediate reminders to students or guardians with balances overdue by more than 30 days.",
          "Offer written payment plans for high-balance defaulters before restricting non-essential services.",
          "Escalate persistent arrears to administration after two missed follow-up dates.",
          "Review class-level collection rates weekly until the lowest-performing classes reach at least 85%.",
        ],
        feeStructureEffectiveness,
      },
    })
  } catch (error) {
    console.error("Fee collection arrears report error:", error)
    return NextResponse.json(
      { error: "Failed to generate fee collection and arrears report" },
      { status: 500 }
    )
  }
}
