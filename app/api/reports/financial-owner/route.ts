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
    const overdueAmount = scopedFees.reduce((sum, fee) => {
      const outstanding = Math.max(fee.amount - fee.paidAmount, 0)
      return new Date(fee.dueDate) < now ? sum + outstanding : sum
    }, 0)

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
      const feeTypeStats = feeStructure.get(fee.feeType)!
      feeTypeStats.expected += fee.amount
      feeTypeStats.collected += fee.paidAmount
      feeTypeStats.outstanding += outstanding

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

    const feeStructureAnalysis = Array.from(feeStructure.values())
      .map((stats) => ({
        feeType: stats.feeType,
        expected: money(stats.expected),
        collected: money(stats.collected),
        outstanding: money(stats.outstanding),
        collectionRate:
          stats.expected > 0 ? money((stats.collected / stats.expected) * 100) : 0,
      }))
      .sort((a, b) => b.expected - a.expected)

    const monthlyTrend = Object.fromEntries(
      monthKeys.map((key) => [key, { month: monthLabel(key), income: 0, expenses: 0 }])
    )
    for (const payment of scopedPayments) {
      const key = monthKey(new Date(payment.createdAt))
      if (monthlyTrend[key]) {
        monthlyTrend[key].income += payment.amount
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

    const financialHealth =
      totalExpectedFees === 0
        ? "Needs Setup"
        : collectionRate >= 85
          ? "Stable"
          : collectionRate >= 65
            ? "Needs Attention"
            : "Critical"

    const incomeBySource = new Map<string, number>([
      ["Tuition", 0],
      ["Fees", 0],
      ["Donations", 0],
      ["Other income", 0],
    ])

    for (const payment of scopedPayments) {
      const source = payment.fee.feeType === "TUITION" ? "Tuition" : "Fees"
      incomeBySource.set(source, (incomeBySource.get(source) || 0) + payment.amount)
    }

    const expenseByCategory = [
      { name: "Salaries", value: 0, color: "#2563eb" },
      { name: "Utilities", value: 0, color: "#16a34a" },
      { name: "Maintenance", value: 0, color: "#f97316" },
      { name: "Supplies", value: 0, color: "#ca8a04" },
      { name: "Other expenses", value: 0, color: "#64748b" },
    ]

    const incomeBreakdown = Array.from(incomeBySource.entries()).map(
      ([name, value], index) => ({
        name,
        value: money(value),
        color: ["#16a34a", "#2563eb", "#a855f7", "#64748b"][index],
      })
    )

    const totalIncome = totalCollectedFees
    const totalExpenses = 0
    const operatingVariance = totalIncome - totalExpenses
    const budgetUtilization = null
    const budgetAdherence = null
    const accountsReceivable = totalOutstandingFees
    const accountsPayable = 0
    const topIncomeSource = incomeBreakdown
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)[0] || null
    const biggestExpense = null

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
        financialHealth,
        totalIncome: money(totalIncome),
        totalExpenses: money(totalExpenses),
        variance: money(operatingVariance),
        cashFlowStatus:
          totalIncome === 0
            ? "No successful income transactions recorded for this scope."
            : operatingVariance >= 0
              ? "Positive based on recorded income and currently tracked expenses."
              : "Negative based on recorded income and expenses.",
        topIncomeSources: incomeBreakdown
          .filter((item) => item.value > 0)
          .sort((a, b) => b.value - a.value),
        biggestExpenses: expenseByCategory.filter((item) => item.value > 0),
        summaryParagraphs: [
          `Financial health is ${financialHealth}. The school recorded ${money(totalIncome)} in income against ${money(totalExpenses)} in tracked expenses, creating a variance of ${money(operatingVariance)}.`,
          `Cash flow is ${operatingVariance >= 0 ? "positive" : "negative"} using currently available records. ${topIncomeSource ? `${topIncomeSource.name} is the leading income source at ${money(topIncomeSource.value)}.` : "No income source has recorded successful payments yet."} ${biggestExpense ? "A major expense category is available." : "Expense categories are not yet backed by database records."}`,
          `Accounts receivable stands at ${money(accountsReceivable)}, including ${defaulters.length} students with outstanding balances. Accounts payable, budgets, donations, and non-fee income require dedicated database tables before they can be measured automatically.`,
        ],
      },
      summary: {
        financialHealth,
        totalExpectedFees: money(totalExpectedFees),
        totalCollectedFees: money(totalCollectedFees),
        totalOutstandingFees: money(totalOutstandingFees),
        overdueAmount: money(overdueAmount),
        collectionRate: money(collectionRate),
        defaulterCount: defaulters.length,
        highestClass: collectionRateByClass[0] || null,
        lowestClass:
          collectionRateByClass.length > 0
            ? collectionRateByClass[collectionRateByClass.length - 1]
            : null,
        totalIncome: money(totalIncome),
        totalExpenses: money(totalExpenses),
        operatingVariance: money(operatingVariance),
        accountsReceivable: money(accountsReceivable),
        accountsPayable: money(accountsPayable),
      },
      visualizations: {
        incomeBreakdownBySource: {
          chartType: "pie",
          title: "Income Breakdown by Source",
          data: incomeBreakdown,
        },
        expenseBreakdownByCategory: {
          chartType: "pie",
          title: "Expense Breakdown by Category",
          data: expenseByCategory,
        },
        monthlyIncomeVsExpenses: {
          chartType: "bar",
          title: "Monthly Income vs Expenses",
          data: Object.values(monthlyTrend).map((item) => ({
            month: item.month,
            income: money(item.income),
            expenses: money(item.expenses),
          })),
        },
        budgetUtilization: {
          chartType: "gauge",
          title: "Budget Utilization Percentage",
          value: budgetUtilization,
          dataAvailable: false,
        },
      },
      charts: {
        paidVsUnpaid: [
          { name: "Paid", value: money(totalCollectedFees), color: "#16a34a" },
          { name: "Unpaid", value: money(totalOutstandingFees), color: "#dc2626" },
        ],
        collectionRateByClass,
        monthlyCollectionTrend: Object.values(monthlyTrend).map((item) => ({
          month: item.month,
          collected: money(item.income),
        })),
        monthlyIncomeVsExpenses: Object.values(monthlyTrend).map((item) => ({
          month: item.month,
          income: money(item.income),
          expenses: money(item.expenses),
        })),
        budgetUtilization,
      },
      financialHealthMetrics: {
        operatingSurplusDeficit: money(operatingVariance),
        collectionEfficiencyRate: money(collectionRate),
        feeDefaulters: defaulters,
        upcomingMajorExpenses: [],
        budgetAdherencePercentage: budgetAdherence,
        accountsReceivable: money(accountsReceivable),
        accountsPayable: money(accountsPayable),
      },
      paymentPatterns,
      feeStructureAnalysis,
      topDefaulters: defaulters.slice(0, 10),
      overdueMoreThan30Days: defaulters.filter((item) => item.daysOverdue > 30),
      actionableInsights: {
        overdueFeeCollections: defaulters.slice(0, 10),
        costOptimizationOpportunities: [
          "Add salary, utility, maintenance, supply, and supplier bill tracking so cost trends can be reviewed monthly.",
          "Review any manually tracked recurring costs against enrollment and fee collection before approving new spending.",
          "Prioritize maintenance and supply purchases by urgency until expense budget controls are available in the system.",
        ],
        revenueEnhancementSuggestions: [
          "Follow up top defaulters with payment plans and scheduled reminders.",
          "Compare fee-type collection rates and revise due dates or reminder timing for low-performing fee categories.",
          "Add donation and other-income records to separate tuition dependency from supplementary revenue.",
        ],
      },
      dataAvailability: {
        fees: scopedFees.length > 0,
        payments: scopedPayments.length > 0,
        expenses: false,
        accountsPayable: false,
        budget: false,
        message:
          "The current database tracks fees and payments. Expenses, accounts payable, donations, and budgets are not yet represented by database tables.",
      },
    })
  } catch (error) {
    console.error("Financial owner report error:", error)
    return NextResponse.json(
      { error: "Failed to generate financial owner report" },
      { status: 500 }
    )
  }
}
