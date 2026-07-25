"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, GraduationCap, RefreshCw, TrendingUp, Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/utils"
import { AcademicYearReportSelector } from "@/components/reports/academic-year-report-selector"

type ClassRetention = {
  className: string
  activeEnrollment: number
  retained: number
  dropouts: number
  retentionRate: number
  capacity: number | null
  occupancyRate: number | null
}

type EnrollmentReport = {
  meta: { schoolName: string; academicYear: string; generatedAt: string }
  executiveSummary: {
    totalStudentCount: number
    yearOverYearGrowthRate: number
    overallRetentionRate: number
    genderRatio: string
    demographicBreakdown: Array<{ name: string; value: number; color: string }>
    summaryParagraphs: string[]
  }
  visualizations: {
    enrollmentTrends: {
      title: string
      data: Array<{
        academicYear: string
        totalEnrollment: number
        newAdmissions: number
        dropouts: number
      }>
    }
    studentJourneyFunnel: {
      title: string
      data: Array<{ stage: string; value: number }>
    }
    demographicDistribution: {
      title: string
      data: Array<{ name: string; value: number; color: string }>
    }
    classOccupancyRates: {
      title: string
      data: ClassRetention[]
    }
  }
  currentEnrollmentByClass: ClassRetention[]
  newAdmissionsVsDropouts: Array<{ academicYear: string; newAdmissions: number; dropouts: number }>
  actionableInsights: {
    classesWithAttritionProblems: ClassRetention[]
    marketingOpportunities: string[]
    capacityPlanningSuggestions: Array<{
      className: string
      occupancyRate: number | null
      suggestion: string
    }>
    factorsAffectingRetention: string[]
  }
}

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

export default function EnrollmentRetentionReportPage() {
  const [report, setReport] = useState<EnrollmentReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`/api/reports/enrollment-retention${queryString ? `?${queryString}` : ""}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Failed to load enrollment report")
      }
      setReport(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enrollment report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [queryString])

  const maxFunnelValue = useMemo(
    () => Math.max(...(report?.visualizations.studentJourneyFunnel.data.map((item) => item.value) || [1]), 1),
    [report]
  )

  if (loading) return <div className="p-6 text-muted-foreground">Loading enrollment report...</div>

  if (error || !report) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || "Enrollment report unavailable"}</AlertDescription>
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
              Student Enrollment & Retention Report
            </h1>
            <Badge>{report.executiveSummary.overallRetentionRate}% Retention</Badge>
          </div>
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
        <MetricCard title="Total Students" value={String(report.executiveSummary.totalStudentCount)} description="Current active enrollment" icon={GraduationCap} />
        <MetricCard title="YoY Growth" value={`${report.executiveSummary.yearOverYearGrowthRate}%`} description="Compared with previous academic year" icon={TrendingUp} />
        <MetricCard title="Retention Rate" value={`${report.executiveSummary.overallRetentionRate}%`} description="Active, promoted, or graduated records" icon={Users} />
        <MetricCard title="Gender Ratio" value={report.executiveSummary.genderRatio} description="Male to female active enrollment" icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
          <CardDescription>Population growth, retention, and demographic overview.</CardDescription>
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
            <CardTitle className="text-lg">{report.visualizations.enrollmentTrends.title}</CardTitle>
            <CardDescription>Area chart: enrollment trends over the last three years.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={report.visualizations.enrollmentTrends.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="academicYear" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="totalEnrollment" name="Enrollment" stroke="#2563eb" fill="#bfdbfe" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.studentJourneyFunnel.title}</CardTitle>
            <CardDescription>Funnel chart: admission to enrollment to retention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.visualizations.studentJourneyFunnel.data.map((item) => (
              <div key={item.stage}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{item.stage}</span>
                  <span className="text-muted-foreground">{item.value}</span>
                </div>
                <div className="h-8 overflow-hidden rounded-md bg-muted">
                  <div
                    className="flex h-full items-center justify-center bg-blue-600 text-xs font-semibold text-white"
                    style={{ width: `${Math.max((item.value / maxFunnelValue) * 100, item.value > 0 ? 8 : 0)}%` }}
                  >
                    {item.value > 0 ? item.value : ""}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.demographicDistribution.title}</CardTitle>
            <CardDescription>Pie chart: demographic distribution by gender.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.visualizations.demographicDistribution.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={report.visualizations.demographicDistribution.data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {report.visualizations.demographicDistribution.data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No demographic records are available." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.classOccupancyRates.title}</CardTitle>
            <CardDescription>Bar chart: class occupancy rates against configured capacity.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={report.visualizations.classOccupancyRates.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="className" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => (value === null ? "No capacity" : `${Number(value).toFixed(1)}%`)} />
                <Bar dataKey="occupancyRate" name="Occupancy Rate" fill="#16a34a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Enrollment by Class</CardTitle>
            <CardDescription>Enrollment, capacity, occupancy, and retention by class.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Enrollment</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Retention</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.currentEnrollmentByClass.map((row) => (
                  <TableRow key={row.className}>
                    <TableCell className="font-medium">{row.className}</TableCell>
                    <TableCell>{row.activeEnrollment}</TableCell>
                    <TableCell>{row.capacity || "Not set"}</TableCell>
                    <TableCell>{row.occupancyRate === null ? "Not set" : `${row.occupancyRate}%`}</TableCell>
                    <TableCell>{row.retentionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">New Admissions vs Dropouts</CardTitle>
            <CardDescription>Annual admissions and attrition movement.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={report.newAdmissionsVsDropouts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="academicYear" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="newAdmissions" name="New Admissions" fill="#2563eb" />
                <Bar dataKey="dropouts" name="Dropouts" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <InsightCard title="Classes With Attrition Problems" icon={AlertTriangle} items={report.actionableInsights.classesWithAttritionProblems.map((item) => `${item.className}: ${item.dropouts} dropout/withdrawal records, ${item.retentionRate}% retention.`)} empty="No class attrition problems are currently flagged." />
        <InsightCard title="Marketing Opportunities" icon={TrendingUp} items={report.actionableInsights.marketingOpportunities} empty="No marketing opportunities identified." />
        <InsightCard title="Capacity Planning Suggestions" icon={Users} items={report.actionableInsights.capacityPlanningSuggestions.map((item) => `${item.className}: ${item.occupancyRate === null ? "capacity not set" : `${item.occupancyRate}% occupancy`} - ${item.suggestion}`)} empty="No capacity suggestions identified." />
        <InsightCard title="Factors Affecting Retention" icon={GraduationCap} items={report.actionableInsights.factorsAffectingRetention} empty="No retention factors identified." />
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
