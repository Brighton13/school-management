"use client"

import { useEffect, useMemo, useState } from "react"
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
import { AlertTriangle, CalendarDays, Clock, RefreshCw, TrendingUp, Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/lib/utils"
import { AcademicYearReportSelector } from "@/components/reports/academic-year-report-selector"

type ClassAttendance = {
  className: string
  attendanceRate: number
  absenceRate: number
  lateRate: number
  studentCount: number
  records: number
}

type StudentAttendance = {
  studentId: string
  studentName: string
  admissionNumber: string
  className: string
  present: number
  absent: number
  late: number
  excused: number
  total: number
  attendanceRate: number
  absenceRate: number
  lateRate: number
}

type HeatCell = {
  date: string
  className: string
  attendanceRate: number
  present: number
  total: number
}

type AttendanceReport = {
  meta: { schoolName: string; academicYear: string; term: string; generatedAt: string }
  executiveSummary: {
    overallAttendanceRate: number
    bestAttendanceClass: ClassAttendance | null
    worstAttendanceClass: ClassAttendance | null
    attendanceAcademicPerformanceCorrelation: number | null
    correlationDescription: string
    commonReasonsForAbsence: Array<{ reason: string; count: number }>
    summaryParagraphs: string[]
  }
  visualizations: {
    dailyAttendanceHeatMap: { title: string; data: HeatCell[] }
    attendanceByClass: { title: string; data: ClassAttendance[] }
    attendanceOverDays: {
      title: string
      data: Array<{ date: string; attendanceRate: number; absentRate: number; lateRate: number }>
    }
    calendarAttendanceIndicators: {
      title: string
      data: Array<{ date: string; attendanceRate: number; status: string }>
    }
  }
  absenteeismPatterns: Array<{
    weekday: string
    absent: number
    late: number
    absentRate: number
    lateRate: number
  }>
  lateArrivals: StudentAttendance[]
  actionableInsights: {
    studentsWithPoorAttendance: StudentAttendance[]
    attendanceImprovementSuggestions: string[]
    patternIdentification: Array<{
      pattern: string
      absentRate: number
      lateRate: number
      recommendation: string
    }>
  }
}

function scoreColor(score: number) {
  if (score >= 90) return "#16a34a"
  if (score >= 75) return "#ca8a04"
  return "#dc2626"
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

export default function AttendanceSummaryReportPage() {
  const [report, setReport] = useState<AttendanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`/api/reports/attendance-summary${queryString ? `?${queryString}` : ""}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Failed to load attendance report")
      }
      setReport(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [queryString])

  const heatMap = useMemo(() => {
    const cells = report?.visualizations.dailyAttendanceHeatMap.data || []
    const dates = Array.from(new Set(cells.map((cell) => cell.date))).sort()
    const classes = Array.from(new Set(cells.map((cell) => cell.className))).sort()
    const lookup = new Map(cells.map((cell) => [`${cell.date}:${cell.className}`, cell]))
    return { dates, classes, lookup }
  }, [report])

  if (loading) return <div className="p-6 text-muted-foreground">Loading attendance report...</div>

  if (error || !report) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || "Attendance report unavailable"}</AlertDescription>
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
              Attendance Summary Report
            </h1>
            <Badge>{report.executiveSummary.overallAttendanceRate}% Attendance</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {report.meta.schoolName} | {report.meta.academicYear} | {report.meta.term} | Generated {formatDate(report.meta.generatedAt)}
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
        <MetricCard title="Overall Attendance" value={`${report.executiveSummary.overallAttendanceRate}%`} description="Present and late records counted as attended" icon={CalendarDays} />
        <MetricCard title="Best Class" value={report.executiveSummary.bestAttendanceClass?.className || "N/A"} description={report.executiveSummary.bestAttendanceClass ? `${report.executiveSummary.bestAttendanceClass.attendanceRate}% attendance` : "No class data"} icon={TrendingUp} />
        <MetricCard title="Worst Class" value={report.executiveSummary.worstAttendanceClass?.className || "N/A"} description={report.executiveSummary.worstAttendanceClass ? `${report.executiveSummary.worstAttendanceClass.attendanceRate}% attendance` : "No class data"} icon={AlertTriangle} />
        <MetricCard title="Correlation" value={report.executiveSummary.attendanceAcademicPerformanceCorrelation === null ? "N/A" : String(report.executiveSummary.attendanceAcademicPerformanceCorrelation)} description="Attendance vs academic performance" icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
          <CardDescription>Attendance health, class highlights, patterns, and academic correlation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 text-sm leading-6 text-muted-foreground">
            {report.executiveSummary.summaryParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="rounded-md border p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Overall Attendance Rate</span>
              <span className="text-muted-foreground">{report.executiveSummary.overallAttendanceRate}%</span>
            </div>
            <Progress value={report.executiveSummary.overallAttendanceRate} className="h-2" />
            <p className="mt-3 text-xs text-muted-foreground">
              {report.executiveSummary.correlationDescription}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.attendanceByClass.title}</CardTitle>
            <CardDescription>Bar chart: attendance rate by class.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.visualizations.attendanceByClass.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={report.visualizations.attendanceByClass.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="className" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Bar dataKey="attendanceRate" name="Attendance Rate" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No class attendance records are available." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.attendanceOverDays.title}</CardTitle>
            <CardDescription>Trend line: daily attendance rate over the current term.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={report.visualizations.attendanceOverDays.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                <Line type="monotone" dataKey="attendanceRate" name="Attendance" stroke="#16a34a" strokeWidth={2} />
                <Line type="monotone" dataKey="lateRate" name="Late" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{report.visualizations.dailyAttendanceHeatMap.title}</CardTitle>
          <CardDescription>Daily heat map: class attendance rates by date.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {heatMap.dates.length > 0 ? (
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2 text-left">Date</th>
                  {heatMap.classes.map((className) => (
                    <th key={className} className="border p-2 text-left">{className}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatMap.dates.map((date) => (
                  <tr key={date}>
                    <td className="border p-2 font-medium">{date}</td>
                    {heatMap.classes.map((className) => {
                      const cell = heatMap.lookup.get(`${date}:${className}`)
                      return (
                        <td key={className} className="border p-2">
                          {cell ? (
                            <span
                              className="inline-flex min-w-14 justify-center rounded px-2 py-1 text-xs font-semibold text-white"
                              style={{ backgroundColor: scoreColor(cell.attendanceRate) }}
                            >
                              {cell.attendanceRate}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No daily attendance data is available." />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{report.visualizations.calendarAttendanceIndicators.title}</CardTitle>
            <CardDescription>Calendar indicators: strong, watch, or concern by day.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.visualizations.calendarAttendanceIndicators.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No calendar indicators are available.</p>
            ) : (
              report.visualizations.calendarAttendanceIndicators.data.map((day) => (
                <div key={day.date} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{day.date}</span>
                    <Badge variant={day.status === "Concern" ? "destructive" : "secondary"}>{day.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{day.attendanceRate}% attendance</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Common Reasons for Absence</CardTitle>
            <CardDescription>Summarized from attendance remarks where recorded.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reason</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.executiveSummary.commonReasonsForAbsence.map((reason) => (
                  <TableRow key={reason.reason}>
                    <TableCell className="font-medium">{reason.reason}</TableCell>
                    <TableCell>{reason.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StudentTable title="Students With Poor Attendance" description="Students below 85% attendance or with repeated absences." students={report.actionableInsights.studentsWithPoorAttendance} />
        <StudentTable title="Late Arrivals" description="Students with the highest late-arrival counts." students={report.lateArrivals} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Pattern Identification
            </CardTitle>
            <CardDescription>Weekday absenteeism and lateness patterns.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {report.actionableInsights.patternIdentification.map((pattern) => (
              <div key={pattern.pattern} className="rounded-md border p-3">
                <div className="font-medium">{pattern.pattern}</div>
                <div className="mt-1 text-muted-foreground">
                  {pattern.absentRate}% absent, {pattern.lateRate}% late. {pattern.recommendation}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Attendance Improvement Suggestions</CardTitle>
            <CardDescription>Actions for improving attendance consistency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {report.actionableInsights.attendanceImprovementSuggestions.map((suggestion) => (
              <div key={suggestion} className="rounded-md border p-3">
                {suggestion}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StudentTable({
  title,
  description,
  students,
}: {
  title: string
  description: string
  students: StudentAttendance[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {students.length === 0 ? (
          <EmptyState message="No matching students are currently recorded." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Late</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={`${student.studentId}-${title}`}>
                  <TableCell>
                    <div className="font-medium">{student.studentName}</div>
                    <div className="text-xs text-muted-foreground">{student.admissionNumber}</div>
                  </TableCell>
                  <TableCell>{student.className}</TableCell>
                  <TableCell>{student.attendanceRate}%</TableCell>
                  <TableCell>{student.absent}</TableCell>
                  <TableCell>{student.late}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
