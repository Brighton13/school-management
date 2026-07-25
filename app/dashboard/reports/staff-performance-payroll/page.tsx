"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, Banknote, RefreshCw, Star, TrendingUp, Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"
import { AcademicYearReportSelector } from "@/components/reports/academic-year-report-selector"

type SalaryRow = {
  staffName: string
  employeeId: string
  department: string
  role: string
  salary: number
  status: string
  joiningDate: string | null
}

type StaffReport = {
  meta: { schoolName: string; academicYear: string; generatedAt: string; currency: string }
  executiveSummary: {
    totalStaff: number
    activeStaff: number
    staffToStudentRatio: number
    totalPayrollCost: number
    averageSalary: number
    averagePerformanceRating: number | null
    staffSatisfactionTrend: string | null
    staffTurnoverRate: number
    summaryParagraphs: string[]
  }
  visualizations: {
    staffDistributionByDepartment: {
      title: string
      data: Array<Record<string, string | number>>
      roles: string[]
    }
    payrollTrends: { title: string; data: Array<{ month: string; payrollCost: number }> }
    performanceRatingsByDepartment: {
      title: string
      data: Array<{ department: string; averageRating: number | null }>
      dataAvailable: boolean
    }
    staffSalarySummary: { title: string; data: SalaryRow[] }
  }
  salaryDistribution: Array<{
    department: string
    staffCount: number
    payrollCost: number
    averageSalary: number
  }>
  attendancePatterns: Array<{
    department: string
    present: number
    absent: number
    late: number
    attendanceRate: number
  }>
  actionableInsights: {
    departmentsNeedingAdditionalStaff: Array<{
      department: string
      currentStaff: number
      recommendation: string
    }>
    highPerformersDeservingRecognition: unknown[]
    trainingNeedsIdentified: string[]
    payrollOptimizationOpportunities: string[]
  }
}

const roleColors = ["#2563eb", "#16a34a", "#f97316", "#a855f7", "#ca8a04", "#64748b"]

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
}: {
  title: string
  value: string
  description: string
  icon: typeof Users
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-md bg-sky-50 p-2 text-sky-700">
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

export default function StaffPerformancePayrollReportPage() {
  const [report, setReport] = useState<StaffReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`/api/reports/staff-performance-payroll${queryString ? `?${queryString}` : ""}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Failed to load staff report")
      }
      setReport(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [queryString])

  if (loading) return <div className="p-6 text-muted-foreground">Loading staff report...</div>

  if (error || !report) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || "Staff report unavailable"}</AlertDescription>
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
          <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
            Staff Performance & Payroll Summary
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {report.meta.schoolName} | {report.meta.academicYear} | Generated {formatDate(report.meta.generatedAt)}
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Active Staff" value={String(report.executiveSummary.activeStaff)} description={`${report.executiveSummary.totalStaff} total records`} icon={Users} />
        <MetricCard title="Staff to Student Ratio" value={`1:${report.executiveSummary.staffToStudentRatio}`} description="Active students per active staff" icon={TrendingUp} />
        <MetricCard title="Total Payroll Cost" value={formatCurrency(report.executiveSummary.totalPayrollCost)} description="Monthly active-staff salary total" icon={Banknote} />
        <MetricCard title="Turnover Rate" value={`${report.executiveSummary.staffTurnoverRate}%`} description="Inactive staff share of all staff records" icon={AlertTriangle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
          <CardDescription>Staffing, payroll, and available performance context.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          {report.executiveSummary.summaryParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.staffDistributionByDepartment.title}</CardTitle>
            <CardDescription>Stacked bar chart: department headcount by staff role.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.visualizations.staffDistributionByDepartment.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={report.visualizations.staffDistributionByDepartment.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis />
                  <Tooltip />
                  {report.visualizations.staffDistributionByDepartment.roles.map((role, index) => (
                    <Bar key={role} dataKey={role} stackId="staff" fill={roleColors[index % roleColors.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No active staff department assignments are available." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.payrollTrends.title}</CardTitle>
            <CardDescription>Line graph: payroll trend over the last six months.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={report.visualizations.payrollTrends.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="payrollCost" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.performanceRatingsByDepartment.title}</CardTitle>
            <CardDescription>Column chart: average ratings by department.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState message="Performance ratings are not yet tracked in the database." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance Patterns</CardTitle>
            <CardDescription>Staff attendance rate by department over the last six months.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.attendancePatterns.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Late</TableHead>
                    <TableHead>Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.attendancePatterns.map((row) => (
                    <TableRow key={row.department}>
                      <TableCell className="font-medium">{row.department}</TableCell>
                      <TableCell>{row.present}</TableCell>
                      <TableCell>{row.absent}</TableCell>
                      <TableCell>{row.late}</TableCell>
                      <TableCell>{row.attendanceRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState message="No staff attendance records are available for the last six months." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{report.visualizations.staffSalarySummary.title}</CardTitle>
          <CardDescription>Table: staff salary summary and payroll exposure.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.visualizations.staffSalarySummary.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Salary</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.visualizations.staffSalarySummary.data.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell>
                      <div className="font-medium">{row.staffName}</div>
                      <div className="text-xs text-muted-foreground">{row.employeeId}</div>
                    </TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>{row.role}</TableCell>
                    <TableCell>{formatCurrency(row.salary)}</TableCell>
                    <TableCell>{row.joiningDate ? formatDate(row.joiningDate) : "Not set"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState message="No salary records are available." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <InsightCard title="Departments Needing Additional Staff" icon={Users} items={report.actionableInsights.departmentsNeedingAdditionalStaff.map((item) => `${item.department}: ${item.recommendation}`)} empty="No departments are currently flagged for staffing review." />
        <InsightCard title="High Performers Deserving Recognition" icon={Star} items={[]} empty="Performance ratings are not yet tracked." />
        <InsightCard title="Training & Payroll Opportunities" icon={TrendingUp} items={[...report.actionableInsights.trainingNeedsIdentified, ...report.actionableInsights.payrollOptimizationOpportunities]} empty="No training or payroll actions identified." />
      </div>
    </div>
  )
}

function InsightCard({
  title,
  icon: Icon,
  items,
  empty,
}: {
  title: string
  icon: typeof Users
  items: string[]
  empty: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {items.length === 0 ? (
          <p className="text-muted-foreground">{empty}</p>
        ) : (
          items.map((item) => (
            <div key={item} className="rounded-md border p-3">
              {item}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
