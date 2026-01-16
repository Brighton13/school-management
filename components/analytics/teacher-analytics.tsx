"use client"

import { useEffect, useState } from "react"
import { StatCard } from "./stat-cards"
import { PerformanceChart, ClassPerformanceChart } from "./performance-chart"
import { AttendanceRateChart } from "./attendance-chart"
import { SubjectPerformanceChart } from "./subject-performance-chart"
import {
  Users,
  BookOpen,
  FileText,
  Calendar,
  TrendingUp,
  Award,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface TeacherAnalyticsData {
  overview: {
    totalStudents: number
    assignedSubjects: number
    assignedClasses: number
  }
  results: {
    total: number
    draft: number
    submitted: number
    approved: number
    published: number
  }
  subjectPerformance: Array<{
    subjectName: string
    className: string
    averageScore: string
    totalStudents: number
    passCount: number
    passRate: string
  }>
  topPerformers: Array<{
    studentId: string
    studentName: string
    averageScore: string
    subjectCount: number
  }>
  bottomPerformers: Array<{
    studentId: string
    studentName: string
    averageScore: string
    subjectCount: number
  }>
  attendance: {
    totalRecords: number
    presentCount: number
    attendanceRate: string
  }
  assignments: {
    total: number
    pending: number
    submitted: number
    graded: number
  }
  performanceTrend: Array<{
    month: string
    averageScore: string
  }>
  classPerformance: Array<{
    className: string
    averageScore: string
    studentCount: number
    resultCount: number
  }>
  currentTerm: {
    id: string
    name: string
    academicYear: { id: string; year: string }
  } | null
}

export function TeacherAnalytics() {
  const [data, setData] = useState<TeacherAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch("/api/analytics/teacher")
        if (response.ok) {
          const analyticsData = await response.json()
          setData(analyticsData)
        } else {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || "Failed to load analytics")
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error)
        setError("Network error. Please check your connection.")
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <CardTitle className="text-red-800 dark:text-red-200">
            Analytics Unavailable
          </CardTitle>
          <CardDescription className="text-red-700 dark:text-red-300">
            {error || "Failed to load analytics. Please try again later."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="My Students"
          value={data.overview.totalStudents}
          description={`${data.overview.assignedClasses} classes`}
          icon={Users}
        />
        <StatCard
          title="Assigned Subjects"
          value={data.overview.assignedSubjects}
          description="Subjects I teach"
          icon={BookOpen}
        />
        <StatCard
          title="Attendance Rate"
          value={`${data.attendance.attendanceRate}%`}
          description={`${data.attendance.presentCount} present (last 30 days)`}
          icon={Calendar}
        />
        <StatCard
          title="Results Status"
          value={data.results.published}
          description={`${data.results.draft} draft, ${data.results.approved} approved`}
          icon={FileText}
        />
      </div>

      {/* Results Statistics */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Results"
          value={data.results.total}
          description="All result entries"
          icon={FileText}
        />
        <StatCard
          title="Draft"
          value={data.results.draft}
          description="Not yet submitted"
          icon={AlertCircle}
        />
        <StatCard
          title="Submitted"
          value={data.results.submitted}
          description="Pending review"
        />
        <StatCard
          title="Approved"
          value={data.results.approved}
          description="Ready to publish"
          icon={TrendingUp}
        />
        <StatCard
          title="Published"
          value={data.results.published}
          description="Visible to students"
          icon={Award}
        />
      </div>

      {/* Assignment Statistics */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Assignments"
          value={data.assignments.total}
          description="All assignments created"
          icon={FileText}
        />
        <StatCard
          title="Pending"
          value={data.assignments.pending}
          description="Not yet submitted"
          icon={AlertCircle}
        />
        <StatCard
          title="Submitted"
          value={data.assignments.submitted}
          description="Awaiting grading"
        />
        <StatCard
          title="Graded"
          value={data.assignments.graded}
          description="Completed"
          icon={Award}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.performanceTrend.length > 0 && (
          <PerformanceChart
            data={data.performanceTrend}
            title="My Classes Performance Trend"
            description="Average scores over the last 6 months"
          />
        )}
        {data.classPerformance.length > 0 && (
          <ClassPerformanceChart
            data={data.classPerformance}
            title="Performance by Class"
          />
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.subjectPerformance.length > 0 && (
          <SubjectPerformanceChart
            data={data.subjectPerformance.map((sp) => ({
              subjectName: `${sp.subjectName} (${sp.className})`,
              averageScore: sp.averageScore,
              studentCount: sp.totalStudents,
            }))}
            title="Subject Performance"
            limit={10}
          />
        )}
        {data.attendance.attendanceRate && (
          <Card className="border-2 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Class Attendance Rate</CardTitle>
              <CardDescription className="text-sm">Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{data.attendance.attendanceRate}%</div>
              <p className="text-sm text-muted-foreground mt-2">
                {data.attendance.presentCount} present out of {data.attendance.totalRecords} records
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top and Bottom Performers */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.topPerformers.length > 0 && (
          <Card className="border-2 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Top Performers</CardTitle>
              <CardDescription className="text-sm">Students with highest average scores</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Average Score</TableHead>
                    <TableHead>Subjects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topPerformers.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell>{student.averageScore}%</TableCell>
                      <TableCell>{student.subjectCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {data.bottomPerformers.length > 0 && (
          <Card className="border-2 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Need Attention</CardTitle>
              <CardDescription className="text-sm">Students who may need extra support</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Average Score</TableHead>
                    <TableHead>Subjects</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.bottomPerformers.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell>{student.averageScore}%</TableCell>
                      <TableCell>{student.subjectCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Subject Performance Details */}
      {data.subjectPerformance.length > 0 && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Subject Performance Details</CardTitle>
            <CardDescription className="text-sm">Detailed performance by subject and class</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Average Score</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Pass Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.subjectPerformance.map((sp, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{sp.subjectName}</TableCell>
                    <TableCell>{sp.className}</TableCell>
                    <TableCell>{sp.averageScore}%</TableCell>
                    <TableCell>{sp.totalStudents}</TableCell>
                    <TableCell>{sp.passRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Current Term Info */}
      {data.currentTerm && (
        <Card className="border-2 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Current Academic Term</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">{data.currentTerm.name}</span> -{" "}
              {data.currentTerm.academicYear.year}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

