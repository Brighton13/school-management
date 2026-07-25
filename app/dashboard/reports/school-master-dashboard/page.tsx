"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  GraduationCap,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatDate } from "@/lib/utils"
import { AcademicYearReportSelector } from "@/components/reports/academic-year-report-selector"

type MasterDashboard = {
  meta: { schoolName: string; academicYear: string; term: string; generatedAt: string }
  academic: {
    overallPerformanceScore: number
    topPerformingClasses: Array<{ className: string; averageScore: number }>
    bottomPerformingClasses: Array<{ className: string; averageScore: number }>
    studentsNeedingInterventionCount: number
  }
  financial: {
    income: number
    expenses: number
    incomeVsExpenses: number
    collectionRate: number
    outstandingAmount: number
    daysToCashZero: number | null
  }
  student: {
    totalEnrollment: number
    retentionRate: number
    averageClassSize: number
    genderDistribution: Array<{ name: string; value: number; color: string }>
  }
  staff: {
    staffToStudentRatio: string
    totalStaffCount: number
    performanceRating: number | null
    totalPayrollCost: number
  }
  operations: {
    attendanceRate: number
    criticalAlertsCount: number
    criticalAlerts: Array<{ type: string; message: string }>
    upcomingEventsActions: string[]
  }
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
}: {
  title: string
  value: string
  description: string
  icon: typeof Users
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

function MiniRankList({
  title,
  items,
}: {
  title: string
  items: Array<{ className: string; averageScore: number }>
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No class performance data yet.</p>
        ) : (
          items.map((item) => (
            <div key={`${title}-${item.className}`} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{item.className}</span>
                <span>{item.averageScore}%</span>
              </div>
              <Progress value={item.averageScore} className="mt-2 h-2" />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default function SchoolMasterDashboardPage() {
  const [dashboard, setDashboard] = useState<MasterDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const fetchDashboard = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`/api/reports/school-master-dashboard${queryString ? `?${queryString}` : ""}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Failed to load master dashboard")
      }
      setDashboard(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load master dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboard()
  }, [queryString])

  if (loading) return <div className="p-6 text-muted-foreground">Loading school master dashboard...</div>

  if (error || !dashboard) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || "Master dashboard unavailable"}</AlertDescription>
        </Alert>
        <Button onClick={fetchDashboard}>
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
              School Master Dashboard
            </h1>
            <Badge variant={dashboard.operations.criticalAlertsCount > 0 ? "destructive" : "default"}>
              {dashboard.operations.criticalAlertsCount} Critical Alerts
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {dashboard.meta.schoolName} | {dashboard.meta.academicYear} | {dashboard.meta.term} | Generated {formatDate(dashboard.meta.generatedAt)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AcademicYearReportSelector />
          <Button variant="outline" onClick={fetchDashboard}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Academic Score"
          value={`${dashboard.academic.overallPerformanceScore}/100`}
          description={`${dashboard.academic.studentsNeedingInterventionCount} students need intervention`}
          icon={GraduationCap}
          tone={dashboard.academic.overallPerformanceScore >= 70 ? "good" : "warning"}
        />
        <KpiCard
          title="Collection Rate"
          value={`${dashboard.financial.collectionRate}%`}
          description={`${formatCurrency(dashboard.financial.outstandingAmount)} outstanding`}
          icon={Banknote}
          tone={dashboard.financial.collectionRate >= 85 ? "good" : "warning"}
        />
        <KpiCard
          title="Enrollment"
          value={String(dashboard.student.totalEnrollment)}
          description={`${dashboard.student.retentionRate}% retention, ${dashboard.student.averageClassSize} avg class size`}
          icon={Users}
        />
        <KpiCard
          title="Attendance"
          value={`${dashboard.operations.attendanceRate}%`}
          description="Current term attendance rate"
          icon={CalendarClock}
          tone={dashboard.operations.attendanceRate >= 85 ? "good" : "warning"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Academic</CardTitle>
            <CardDescription>Performance score, top/bottom classes, and intervention count.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Overall Performance</span>
                <span>{dashboard.academic.overallPerformanceScore}/100</span>
              </div>
              <Progress value={dashboard.academic.overallPerformanceScore} className="h-2" />
            </div>
            <MiniRankList title="Top Classes" items={dashboard.academic.topPerformingClasses} />
            <MiniRankList title="Bottom Classes" items={dashboard.academic.bottomPerformingClasses} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial</CardTitle>
            <CardDescription>Income, expenses, collection, arrears, and cash runway.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Income" value={formatCurrency(dashboard.financial.income)} />
            <Row label="Expenses" value={formatCurrency(dashboard.financial.expenses)} />
            <Row label="Income vs Expenses" value={formatCurrency(dashboard.financial.incomeVsExpenses)} />
            <Row label="Collection Rate" value={`${dashboard.financial.collectionRate}%`} />
            <Row label="Outstanding Amount" value={formatCurrency(dashboard.financial.outstandingAmount)} />
            <Row
              label="Days to Cash Zero"
              value={dashboard.financial.daysToCashZero === null ? "N/A" : `${dashboard.financial.daysToCashZero} days`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Student</CardTitle>
            <CardDescription>Enrollment, retention, class size, and gender distribution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <SummaryBox label="Enrollment" value={dashboard.student.totalEnrollment} />
              <SummaryBox label="Retention" value={`${dashboard.student.retentionRate}%`} />
              <SummaryBox label="Avg Class Size" value={dashboard.student.averageClassSize} />
              <SummaryBox label="Staff Ratio" value={dashboard.staff.staffToStudentRatio} />
            </div>
            {dashboard.student.genderDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={dashboard.student.genderDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                  >
                    {dashboard.student.genderDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No gender distribution data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Staff</CardTitle>
            <CardDescription>Staff count, ratio, payroll, and performance rating availability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Staff to Student Ratio" value={dashboard.staff.staffToStudentRatio} />
            <Row label="Total Staff Count" value={String(dashboard.staff.totalStaffCount)} />
            <Row label="Payroll Cost" value={formatCurrency(dashboard.staff.totalPayrollCost)} />
            <Row
              label="Performance Rating"
              value={dashboard.staff.performanceRating === null ? "Not tracked" : String(dashboard.staff.performanceRating)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5" />
              Critical Alerts
            </CardTitle>
            <CardDescription>Combined red flags from academic, financial, student, and operations KPIs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {dashboard.operations.criticalAlerts.length === 0 ? (
              <p className="text-muted-foreground">No critical alerts at this time.</p>
            ) : (
              dashboard.operations.criticalAlerts.map((alert) => (
                <div key={`${alert.type}-${alert.message}`} className="rounded-md border p-3">
                  <Badge variant="secondary" className="mb-2">{alert.type}</Badge>
                  <div>{alert.message}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Upcoming Actions
            </CardTitle>
            <CardDescription>Near-term items requiring owner or administrator follow-up.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {dashboard.operations.upcomingEventsActions.length === 0 ? (
              <p className="text-muted-foreground">No upcoming actions identified.</p>
            ) : (
              dashboard.operations.upcomingEventsActions.map((action) => (
                <div key={action} className="rounded-md border p-3">
                  {action}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function SummaryBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
