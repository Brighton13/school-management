"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
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
import { AlertCircle, Award, BookOpen, GraduationCap, TrendingUp, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AcademicYearReportSelector } from "@/components/reports/academic-year-report-selector"

type ClassPerformance = {
  className: string
  averageScore: number
  passRate: number
  studentCount: number
  resultCount: number
}

type StudentIntervention = {
  studentId: string
  studentName: string
  className: string
  averageScore: number
  failingSubjects: number
  subjectsTaken: number
}

type SubjectReview = {
  subjectName: string
  averageScore: number
  passRate: number
  studentCount: number
}

type ExceptionalTeacher = {
  teacherName: string
  averageScore: number
  passRate: number
  studentCount: number
  resultCount: number
  subjects: string[]
}

type HeatMapCell = {
  className: string
  subjectName: string
  averageScore: number
  passRate: number
  resultCount: number
}

type OwnerReport = {
  context: {
    schoolName: string
    academicYear: string
    currentTerm: string
    generatedFor: string
    generatedAt: string
  }
  executiveSummary: {
    academicHealthRating: "Excellent" | "Good" | "Satisfactory" | "Needs Improvement"
    overallAverage: number
    overallPassRate: number
    totalStudents: number
    resultCount: number
    topClasses: ClassPerformance[]
    bottomClasses: ClassPerformance[]
    keyAchievements: string[]
    keyConcerns: string[]
  }
  visualizations: {
    classPerformanceComparison: {
      chartType: string
      title: string
      xAxis: string
      yAxis: string
      data: ClassPerformance[]
    }
    performanceTrends: {
      chartType: string
      title: string
      xAxis: string
      yAxis: string
      data: Array<{ termId: string; termName: string; averageScore: number; resultCount: number }>
    }
    subjectWiseHeatMap: {
      chartType: string
      title: string
      rowKey: string
      columnKey: string
      valueKey: string
      data: HeatMapCell[]
    }
  }
  actionableInsights: {
    subjectsRequiringCurriculumReview: SubjectReview[]
    studentsNeedingIntervention: StudentIntervention[]
    teachersWithExceptionalResults: ExceptionalTeacher[]
    recommendedInterventions: string[]
  }
}

function scoreColor(score: number) {
  if (score >= 80) return "#16a34a"
  if (score >= 70) return "#2563eb"
  if (score >= 60) return "#ca8a04"
  if (score >= 50) return "#f97316"
  return "#dc2626"
}

function ratingVariant(rating: OwnerReport["executiveSummary"]["academicHealthRating"]) {
  if (rating === "Needs Improvement") return "destructive"
  if (rating === "Satisfactory") return "secondary"
  return "default"
}

export function OwnerAcademicPerformanceDashboard() {
  const [report, setReport] = useState<OwnerReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch(`/api/reports/owner-performance${queryString ? `?${queryString}` : ""}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to load report")
        }

        setReport(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load report")
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [queryString])

  const heatMap = useMemo(() => {
    const cells = report?.visualizations.subjectWiseHeatMap.data || []
    const classes = Array.from(new Set(cells.map((cell) => cell.className))).sort()
    const subjects = Array.from(new Set(cells.map((cell) => cell.subjectName))).sort()
    const lookup = new Map(cells.map((cell) => [`${cell.className}:${cell.subjectName}`, cell]))

    return { classes, subjects, lookup }
  }, [report])

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading owner performance report...</div>
  }

  if (error || !report) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-800">Report Unavailable</CardTitle>
          <CardDescription className="text-red-700">{error || "Unable to load report."}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const summary = report.executiveSummary

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Student Academic Performance Dashboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {report.context.schoolName} | {report.context.academicYear} | {report.context.currentTerm} | Generated for {report.context.generatedFor}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <AcademicYearReportSelector />
            <Badge variant={ratingVariant(summary.academicHealthRating)} className="w-fit">
              {summary.academicHealthRating}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Overall Average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overallAverage}%</div>
            <Progress value={summary.overallAverage} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <GraduationCap className="h-4 w-4" />
              Students Covered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalStudents}</div>
            <p className="mt-2 text-xs text-muted-foreground">{summary.resultCount} approved/published result entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              Pass Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overallPassRate}%</div>
            <Progress value={summary.overallPassRate} className="mt-3" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="h-4 w-4" />
              Interventions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.actionableInsights.studentsNeedingIntervention.length}</div>
            <p className="mt-2 text-xs text-muted-foreground">Students flagged for support</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Executive Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Academic health is rated <span className="font-semibold text-foreground">{summary.academicHealthRating}</span> with an overall average of{" "}
            <span className="font-semibold text-foreground">{summary.overallAverage}%</span> and a pass rate of{" "}
            <span className="font-semibold text-foreground">{summary.overallPassRate}%</span>. The report covers{" "}
            <span className="font-semibold text-foreground">{summary.totalStudents}</span> students across approved or published results for the current term.
          </p>
          <p>
            Top performing classes are {summary.topClasses.map((item) => `${item.className} (${item.averageScore}%)`).join(", ") || "not yet available"}.
            Bottom performing classes are {summary.bottomClasses.map((item) => `${item.className} (${item.averageScore}%)`).join(", ") || "not yet available"}.
          </p>
          <p>
            Key achievements: {summary.keyAchievements.join(" ")} Key concerns: {summary.keyConcerns.join(" ")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{report.visualizations.classPerformanceComparison.title}</CardTitle>
            <CardDescription>Bar chart: class average score comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={report.visualizations.classPerformanceComparison.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="className" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="averageScore" name="Average Score" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{report.visualizations.performanceTrends.title}</CardTitle>
            <CardDescription>Line graph: average score over the last three terms</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={report.visualizations.performanceTrends.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="termName" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="averageScore" name="Average Score" stroke="#16a34a" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{report.visualizations.subjectWiseHeatMap.title}</CardTitle>
          <CardDescription>Heat map: subject average by class</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border p-2 text-left">Class</th>
                {heatMap.subjects.map((subject) => (
                  <th key={subject} className="border p-2 text-left">{subject}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatMap.classes.map((className) => (
                <tr key={className}>
                  <td className="border p-2 font-medium">{className}</td>
                  {heatMap.subjects.map((subject) => {
                    const cell = heatMap.lookup.get(`${className}:${subject}`)
                    const score = cell?.averageScore
                    return (
                      <td key={subject} className="border p-2">
                        {score === undefined ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <span
                            className="inline-flex min-w-14 justify-center rounded px-2 py-1 text-xs font-semibold text-white"
                            style={{ backgroundColor: scoreColor(score) }}
                          >
                            {score}%
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <InsightTable
          title="Subjects Requiring Curriculum Review"
          description="Subjects below 55% average or 65% pass rate"
          emptyText="No subjects currently require curriculum review."
          rows={report.actionableInsights.subjectsRequiringCurriculumReview}
          columns={[
            ["Subject", (row) => row.subjectName],
            ["Average", (row) => `${row.averageScore}%`],
            ["Pass Rate", (row) => `${row.passRate}%`],
            ["Students", (row) => row.studentCount],
          ]}
        />
        <InsightTable
          title="Teachers With Exceptional Results"
          description="Teachers at or above 75% average with enough result coverage"
          emptyText="No exceptional teacher records are available yet."
          rows={report.actionableInsights.teachersWithExceptionalResults}
          columns={[
            ["Teacher", (row) => row.teacherName],
            ["Average", (row) => `${row.averageScore}%`],
            ["Pass Rate", (row) => `${row.passRate}%`],
            ["Subjects", (row) => row.subjects.join(", ")],
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Students Needing Intervention</CardTitle>
          <CardDescription>Students below 50% average or failing two or more subjects</CardDescription>
        </CardHeader>
        <CardContent>
          {report.actionableInsights.studentsNeedingIntervention.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students are currently flagged for intervention.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Average</TableHead>
                  <TableHead>Failing Subjects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.actionableInsights.studentsNeedingIntervention.map((student) => (
                  <TableRow key={student.studentId}>
                    <TableCell className="font-medium">{student.studentName}</TableCell>
                    <TableCell>{student.className}</TableCell>
                    <TableCell>{student.averageScore}%</TableCell>
                    <TableCell>{student.failingSubjects} of {student.subjectsTaken}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Recommended Interventions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {report.actionableInsights.recommendedInterventions.map((intervention) => (
            <div key={intervention} className="flex gap-3 rounded-md border p-3 text-sm">
              <BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span>{intervention}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function InsightTable<T>({
  title,
  description,
  emptyText,
  rows,
  columns,
}: {
  title: string
  description: string
  emptyText: string
  rows: T[]
  columns: Array<[string, (row: T) => ReactNode]>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(([label]) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map(([label, render]) => (
                    <TableCell key={label}>{render(row)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
