"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Download,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"
import { AcademicYearReportSelector } from "@/components/reports/academic-year-report-selector"

interface ClassCollection {
  className: string
  expected: number
  collected: number
  outstanding: number
  defaulters: number
  collectionRate: number
}

interface Defaulter {
  student: string
  admissionNumber: string
  className: string
  expected: number
  collected: number
  outstanding: number
  feeTypes: string[]
  status: string
  oldestDueDate: string | null
  daysOverdue: number
}

interface FeeStructure {
  feeType: string
  expected: number
  collected: number
  outstanding: number
  collectionRate: number
}

interface FinancialOwnerReport {
  meta: {
    schoolName: string
    academicYear: string
    term: string
    generatedAt: string
    scope: string
    currency: string
  }
  summary: {
    financialHealth: string
    totalExpectedFees: number
    totalCollectedFees: number
    totalOutstandingFees: number
    overdueAmount: number
    collectionRate: number
    defaulterCount: number
    totalIncome: number
    totalExpenses: number
    operatingVariance: number
    accountsReceivable: number
    accountsPayable: number
    highestClass: ClassCollection | null
    lowestClass: ClassCollection | null
  }
  executiveSummary: {
    financialHealth: string
    totalIncome: number
    totalExpenses: number
    variance: number
    cashFlowStatus: string
    topIncomeSources: Array<{ name: string; value: number; color: string }>
    biggestExpenses: Array<{ name: string; value: number; color: string }>
    summaryParagraphs: string[]
  }
  visualizations: {
    incomeBreakdownBySource: {
      chartType: string
      title: string
      data: Array<{ name: string; value: number; color: string }>
    }
    expenseBreakdownByCategory: {
      chartType: string
      title: string
      data: Array<{ name: string; value: number; color: string }>
    }
    monthlyIncomeVsExpenses: {
      chartType: string
      title: string
      data: Array<{ month: string; income: number; expenses: number }>
    }
    budgetUtilization: {
      chartType: string
      title: string
      value: number | null
      dataAvailable: boolean
    }
  }
  charts: {
    paidVsUnpaid: Array<{ name: string; value: number; color: string }>
    collectionRateByClass: ClassCollection[]
    monthlyCollectionTrend: Array<{ month: string; collected: number }>
    monthlyIncomeVsExpenses: Array<{ month: string; income: number; expenses: number }>
    budgetUtilization: number | null
  }
  financialHealthMetrics: {
    operatingSurplusDeficit: number
    collectionEfficiencyRate: number
    feeDefaulters: Defaulter[]
    upcomingMajorExpenses: Array<{ name: string; amount: number; dueDate: string }>
    budgetAdherencePercentage: number | null
    accountsReceivable: number
    accountsPayable: number
  }
  paymentPatterns: {
    early: number
    late: number
    defaulters: number
  }
  feeStructureAnalysis: FeeStructure[]
  topDefaulters: Defaulter[]
  overdueMoreThan30Days: Defaulter[]
  actionableInsights: {
    overdueFeeCollections: Defaulter[]
    costOptimizationOpportunities: string[]
    revenueEnhancementSuggestions: string[]
  }
  dataAvailability: {
    fees: boolean
    payments: boolean
    expenses: boolean
    accountsPayable: boolean
    budget: boolean
    message: string
  }
}

const emptyReport: FinancialOwnerReport | null = null

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string
  value: string
  description: string
  icon: typeof Banknote
  tone?: "default" | "good" | "warning" | "danger"
}) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "bg-red-50 text-red-700"
          : "bg-sky-50 text-sky-700"

  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`rounded-md p-2 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function FinancialOwnerReportPage() {
  const [report, setReport] = useState<FinancialOwnerReport | null>(emptyReport)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`/api/reports/financial-owner${queryString ? `?${queryString}` : ""}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Failed to load financial report")
      }
      setReport(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load financial report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [queryString])

  const healthTone = useMemo(() => {
    if (!report) return "secondary"
    if (report.summary.financialHealth === "Stable") return "default"
    if (report.summary.financialHealth === "Critical") return "destructive"
    return "secondary"
  }, [report])

  const incomeChartHasData = Boolean(
    report &&
      report.visualizations.incomeBreakdownBySource.data.some((item) => item.value > 0)
  )
  const expenseChartHasData = Boolean(
    report &&
      report.visualizations.expenseBreakdownByCategory.data.some((item) => item.value > 0)
  )

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading owner financial report...</div>
  }

  if (error || !report) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || "Financial report unavailable"}</AlertDescription>
        </Alert>
        <Button onClick={fetchReport}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Owner Financial Reports
            </h1>
            <Badge variant={healthTone}>{report.summary.financialHealth}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {report.meta.schoolName} | {report.meta.academicYear} | {report.meta.term} |{" "}
            {report.meta.scope}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {formatDate(report.meta.generatedAt)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AcademicYearReportSelector />
          <Button variant="outline" onClick={fetchReport}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{report.dataAvailability.message}</AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total Income"
          value={formatCurrency(report.summary.totalIncome)}
          description="Successful payments recorded in scope"
          icon={CircleDollarSign}
        />
        <MetricCard
          title="Total Expenses"
          value={formatCurrency(report.summary.totalExpenses)}
          description="Tracked expense categories"
          icon={CheckCircle2}
          tone={report.summary.totalExpenses > report.summary.totalIncome ? "danger" : "default"}
        />
        <MetricCard
          title="Operating Variance"
          value={formatCurrency(report.summary.operatingVariance)}
          description="Income less recorded expenses"
          icon={Users}
          tone={report.summary.operatingVariance >= 0 ? "good" : "danger"}
        />
        <MetricCard
          title="Accounts Receivable"
          value={formatCurrency(report.summary.accountsReceivable)}
          description={`${report.summary.defaulterCount} students with arrears`}
          icon={CalendarClock}
          tone={report.summary.accountsReceivable > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
          <CardDescription>Designed for quick owner review and follow-up decisions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            {report.executiveSummary.summaryParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="rounded-md border p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Budget Utilization</span>
              <span className="text-muted-foreground">
                {report.visualizations.budgetUtilization.value === null
                  ? "Not tracked"
                  : `${report.visualizations.budgetUtilization.value}%`}
              </span>
            </div>
            <Progress value={report.visualizations.budgetUtilization.value || 0} className="h-2" />
            <p className="mt-3 text-xs text-muted-foreground">
              Add budget and expense records to enable operating surplus, budget adherence, and
              accounts payable reporting.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={report.visualizations.incomeBreakdownBySource.title}
          description="Pie chart: income from tuition, fees, donations, and other income."
        >
          {incomeChartHasData ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={report.visualizations.incomeBreakdownBySource.data.filter((item) => item.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={105}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {report.visualizations.incomeBreakdownBySource.data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No income transactions are available yet." />
          )}
        </ChartCard>

        <ChartCard
          title={report.visualizations.expenseBreakdownByCategory.title}
          description="Pie chart: salaries, utilities, maintenance, supplies, and other expenses."
        >
          {expenseChartHasData ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={report.visualizations.expenseBreakdownByCategory.data.filter((item) => item.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={105}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {report.visualizations.expenseBreakdownByCategory.data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="Expense records are not yet tracked in the database." />
          )}
        </ChartCard>

        <ChartCard
          title={report.visualizations.monthlyIncomeVsExpenses.title}
          description="Bar chart: monthly income vs expenses for the last six months."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.visualizations.monthlyIncomeVsExpenses.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="income" name="Income" fill="#16a34a" />
              <Bar dataKey="expenses" name="Expenses" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={report.visualizations.budgetUtilization.title}
          description="Gauge chart: budget utilization percentage."
        >
          {report.visualizations.budgetUtilization.value === null ? (
            <EmptyState message="Budget records are not yet tracked in the database." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <RadialBarChart
                cx="50%"
                cy="70%"
                innerRadius="70%"
                outerRadius="100%"
                barSize={18}
                data={[{ name: "Budget", value: report.visualizations.budgetUtilization.value, fill: "#2563eb" }]}
                startAngle={180}
                endAngle={0}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar background dataKey="value" />
                <Tooltip formatter={(value: number) => `${value}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Operating Surplus/Deficit"
          value={formatCurrency(report.financialHealthMetrics.operatingSurplusDeficit)}
          description="Total income less tracked expenses"
          icon={TrendingUp}
          tone={report.financialHealthMetrics.operatingSurplusDeficit >= 0 ? "good" : "danger"}
        />
        <MetricCard
          title="Collection Efficiency"
          value={`${report.financialHealthMetrics.collectionEfficiencyRate.toFixed(1)}%`}
          description="Collected fees divided by expected fees"
          icon={CheckCircle2}
          tone={report.financialHealthMetrics.collectionEfficiencyRate >= 85 ? "good" : "warning"}
        />
        <MetricCard
          title="Accounts Payable"
          value={formatCurrency(report.financialHealthMetrics.accountsPayable)}
          description="Pending bills tracked in system"
          icon={Banknote}
        />
        <MetricCard
          title="Budget Adherence"
          value={
            report.financialHealthMetrics.budgetAdherencePercentage === null
              ? "Not tracked"
              : `${report.financialHealthMetrics.budgetAdherencePercentage.toFixed(1)}%`
          }
          description="Requires budget and expense records"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fee Structure vs Actual Collections</CardTitle>
            <CardDescription>Collection effectiveness by income category.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.feeStructureAnalysis.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee Type</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Collected</TableHead>
                    <TableHead>Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.feeStructureAnalysis.map((fee) => (
                    <TableRow key={fee.feeType}>
                      <TableCell className="font-medium">{fee.feeType}</TableCell>
                      <TableCell>{formatCurrency(fee.expected)}</TableCell>
                      <TableCell>{formatCurrency(fee.collected)}</TableCell>
                      <TableCell>{fee.collectionRate.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No fee structure records are available for this scope." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cost Optimization Opportunities</CardTitle>
            <CardDescription>Recommended next decisions based on the report.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {report.actionableInsights.costOptimizationOpportunities.map((opportunity) => (
              <div key={opportunity} className="flex gap-3 rounded-md border p-3">
                <Download className="mt-0.5 h-4 w-4 text-amber-600" />
                <p>{opportunity}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revenue Enhancement Suggestions</CardTitle>
            <CardDescription>Actions to improve income reliability and diversification.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {report.actionableInsights.revenueEnhancementSuggestions.map((suggestion) => (
              <div key={suggestion} className="flex gap-3 rounded-md border p-3">
                <TrendingUp className="mt-0.5 h-4 w-4 text-emerald-600" />
                <p>{suggestion}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upcoming Major Expenses</CardTitle>
            <CardDescription>Pending major expenses and planned commitments.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.financialHealthMetrics.upcomingMajorExpenses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Expense</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.financialHealthMetrics.upcomingMajorExpenses.map((expense) => (
                    <TableRow key={`${expense.name}-${expense.dueDate}`}>
                      <TableCell className="font-medium">{expense.name}</TableCell>
                      <TableCell>{formatCurrency(expense.amount)}</TableCell>
                      <TableCell>{formatDate(expense.dueDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="Upcoming major expenses are not yet tracked in the database." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overdue Fee Collections: Top 10 Defaulters</CardTitle>
          <CardDescription>Highest outstanding balances for immediate collections follow-up.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.topDefaulters.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Fees</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topDefaulters.map((defaulter) => (
                  <TableRow key={defaulter.admissionNumber}>
                    <TableCell>
                      <div className="font-medium">{defaulter.student}</div>
                      <div className="text-xs text-muted-foreground">
                        {defaulter.admissionNumber}
                      </div>
                    </TableCell>
                    <TableCell>{defaulter.className}</TableCell>
                    <TableCell>{defaulter.feeTypes.join(", ")}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(defaulter.outstanding)}
                    </TableCell>
                    <TableCell>{defaulter.daysOverdue}</TableCell>
                    <TableCell>
                      <Badge variant={defaulter.daysOverdue > 30 ? "destructive" : "secondary"}>
                        {defaulter.status || "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState message="No defaulters are currently recorded." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
