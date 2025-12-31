"use client"

import { useEffect, useState } from "react"
import { StatCard } from "./stat-cards"
import { PieChartComponent, DonutChart } from "./pie-chart"
import { PerformanceChart, ClassPerformanceChart } from "./performance-chart"
import { AttendanceChart, AttendanceRateChart } from "./attendance-chart"
import {
  Users,
  BookOpen,
  TrendingUp,
  Award,
  AlertCircle,
  GraduationCap,
  Calendar,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts"

interface TeacherDashboardData {
  overview: {
    totalStudents: number
    assignedSubjects: number
    assignedClasses: number
    currentTerm: {
      id: string
      name: string
      academicYear: { id: string; year: string }
    } | null
  }
  studentPerformanceBySubject: Array<{
    subjectName: string
    subjectCode: string
    className: string
    students: Array<{
      studentId: string
      studentName: string
      admissionNumber: string
      marksObtained: number
      maxMarks: number
      percentage: number
      grade: string | null
    }>
    averageScore: number
    totalStudents: number
  }>
  studentRankings: Array<{
    studentId: string
    studentName: string
    admissionNumber: string
    averageScore: number
    totalScore: number
    maxScore: number
    subjectCount: number
    subjects: string[]
  }>
  studentAttendanceList: Array<{
    studentId: string
    studentName: string
    present: number
    absent: number
    late: number
    excused: number
    total: number
    attendanceRate: number
  }>
  attendanceTrend: Array<{
    month: string
    present: number
    absent: number
    late: number
    rate: number
  }>
  subjectPerformanceDistribution: Array<{
    subjectName: string
    averageScore: number
    totalStudents: number
    passCount: number
    failCount: number
  }>
  classStatistics: Array<{
    className: string
    studentCount: number
    attendanceRate: number
    presentCount: number
    totalAttendanceRecords: number
  }>
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"]

export function TeacherDashboard() {
  const [data, setData] = useState<TeacherDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/analytics/teacher/detailed")
        if (response.ok) {
          const dashboardData = await response.json()
          setData(dashboardData)
        } else {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || "Failed to load dashboard")
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error)
        setError("Network error. Please check your connection.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <CardTitle className="text-red-800 dark:text-red-200">Dashboard Unavailable</CardTitle>
          <CardDescription className="text-red-700 dark:text-red-300">
            {error || "Failed to load dashboard. Please try again later."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Prepare chart data
  const subjectPerformanceChart = data.subjectPerformanceDistribution.map((s) => ({
    name: s.subjectName,
    averageScore: parseFloat(s.averageScore.toFixed(1)),
    passCount: s.passCount,
    failCount: s.failCount,
  }))

  const classAttendanceChart = data.classStatistics.map((c) => ({
    name: c.className,
    attendanceRate: parseFloat(c.attendanceRate.toFixed(1)),
    studentCount: c.studentCount,
  }))

  const topPerformers = data.studentRankings.slice(0, 10)
  const attendanceDistribution = [
    {
      name: "Present",
      value: data.studentAttendanceList.reduce((sum, s) => sum + s.present, 0),
    },
    {
      name: "Absent",
      value: data.studentAttendanceList.reduce((sum, s) => sum + s.absent, 0),
    },
    {
      name: "Late",
      value: data.studentAttendanceList.reduce((sum, s) => sum + s.late, 0),
    },
  ]

  const passFailDistribution = data.subjectPerformanceDistribution.reduce(
    (acc, subject) => {
      acc.pass += subject.passCount
      acc.fail += subject.failCount
      return acc
    },
    { pass: 0, fail: 0 }
  )

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="My Students"
          value={data.overview.totalStudents}
          description={`Across ${data.overview.assignedClasses} classes`}
          icon={Users}
        />
        <StatCard
          title="Subjects Teaching"
          value={data.overview.assignedSubjects}
          description="Subjects assigned to me"
          icon={BookOpen}
        />
        <StatCard
          title="Average Attendance"
          value={`${data.classStatistics.length > 0 ? (data.classStatistics.reduce((sum, c) => sum + c.attendanceRate, 0) / data.classStatistics.length).toFixed(1) : 0}%`}
          description="Across all my classes"
          icon={Calendar}
        />
        <StatCard
          title="Top Performer"
          value={topPerformers.length > 0 ? `${topPerformers[0].averageScore.toFixed(1)}%` : "N/A"}
          description={topPerformers.length > 0 ? topPerformers[0].studentName : "No data"}
          icon={Award}
        />
      </div>

      {/* Charts Row 1: Subject Performance & Attendance Distribution */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Subject Performance Bar Chart */}
        <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Subject Performance Overview
            </CardTitle>
            <CardDescription className="text-sm">
              Average scores and pass/fail distribution by subject
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={subjectPerformanceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar
                  dataKey="averageScore"
                  fill="#3b82f6"
                  name="Average Score (%)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Attendance Distribution Pie Chart */}
        <DonutChart
          data={attendanceDistribution}
          title="Attendance Distribution (Last 30 Days)"
          description="Overall attendance breakdown"
        />
      </div>

      {/* Charts Row 2: Attendance Trend & Class Performance */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.attendanceTrend.length > 0 && (
          <AttendanceChart data={data.attendanceTrend.map((a) => ({ ...a, rate: a.rate.toFixed(1) }))} />
        )}

        {/* Class Attendance Rate */}
        <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Class Attendance Rates</CardTitle>
            <CardDescription className="text-sm">Attendance percentage by class</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={classAttendanceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar
                  dataKey="attendanceRate"
                  fill="#10b981"
                  name="Attendance Rate (%)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Pass/Fail Distribution */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <PieChartComponent
          data={[
            { name: "Pass", value: passFailDistribution.pass },
            { name: "Fail", value: passFailDistribution.fail },
          ]}
          title="Overall Pass/Fail Distribution"
          description="Total students who passed vs failed across all subjects"
        />

        {/* Subject-wise Pass/Fail */}
        <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Pass/Fail by Subject</CardTitle>
            <CardDescription className="text-sm">Pass and fail counts for each subject</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={subjectPerformanceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Bar dataKey="passCount" fill="#10b981" name="Passed" radius={[8, 8, 0, 0]} />
                <Bar dataKey="failCount" fill="#ef4444" name="Failed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers Table */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-600" />
            Top Performing Students
          </CardTitle>
          <CardDescription className="text-sm">
            Students ranked by their average performance across all subjects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Rank</TableHead>
                  <TableHead className="font-bold">Student Name</TableHead>
                  <TableHead className="font-bold">Admission No.</TableHead>
                  <TableHead className="font-bold">Average Score</TableHead>
                  <TableHead className="font-bold">Total Score</TableHead>
                  <TableHead className="font-bold">Subjects</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPerformers.map((student, index) => (
                  <TableRow
                    key={student.studentId}
                    className={index < 3 ? "bg-amber-50 dark:bg-amber-950/20" : ""}
                  >
                    <TableCell className="font-semibold">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                    </TableCell>
                    <TableCell className="font-medium">{student.studentName}</TableCell>
                    <TableCell>{student.admissionNumber}</TableCell>
                    <TableCell>
                      <span
                        className={`font-bold ${
                          student.averageScore >= 80
                            ? "text-green-600"
                            : student.averageScore >= 60
                            ? "text-blue-600"
                            : "text-orange-600"
                        }`}
                      >
                        {student.averageScore.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {student.totalScore.toFixed(0)} / {student.maxScore.toFixed(0)}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                        {student.subjectCount} subjects
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Student Performance by Subject - Detailed Tables */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Student Performance by Subject</h2>
        </div>
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {data.studentPerformanceBySubject.map((subject, idx) => (
            <Card key={idx} className="border-2 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold">{subject.subjectName}</CardTitle>
                <CardDescription className="text-sm">
                  {subject.className} • Code: {subject.subjectCode}
                </CardDescription>
                <div className="mt-2 flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Average: </span>
                    <span className="font-bold text-blue-600">
                      {subject.averageScore.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Students: </span>
                    <span className="font-bold">{subject.totalStudents}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">Student</TableHead>
                        <TableHead className="font-bold">Marks</TableHead>
                        <TableHead className="font-bold">Score</TableHead>
                        <TableHead className="font-bold">Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subject.students
                        .sort((a, b) => b.percentage - a.percentage)
                        .map((student) => (
                          <TableRow key={student.studentId}>
                            <TableCell className="font-medium">{student.studentName}</TableCell>
                            <TableCell>
                              {student.marksObtained.toFixed(0)} / {student.maxMarks.toFixed(0)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`font-bold ${
                                  student.percentage >= 80
                                    ? "text-green-600"
                                    : student.percentage >= 60
                                    ? "text-blue-600"
                                    : student.percentage >= 50
                                    ? "text-orange-600"
                                    : "text-red-600"
                                }`}
                              >
                                {student.percentage.toFixed(1)}%
                              </span>
                            </TableCell>
                            <TableCell>
                              {student.grade || (
                                <span className="text-xs text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Student Attendance Table */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600" />
            Student Attendance (Last 30 Days)
          </CardTitle>
          <CardDescription className="text-sm">
            Detailed attendance records for all students
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Student Name</TableHead>
                  <TableHead className="font-bold">Present</TableHead>
                  <TableHead className="font-bold">Absent</TableHead>
                  <TableHead className="font-bold">Late</TableHead>
                  <TableHead className="font-bold">Excused</TableHead>
                  <TableHead className="font-bold">Total Days</TableHead>
                  <TableHead className="font-bold">Attendance Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.studentAttendanceList
                  .sort((a, b) => b.attendanceRate - a.attendanceRate)
                  .map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell>
                        <span className="text-green-600 font-semibold">{student.present}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-red-600 font-semibold">{student.absent}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-orange-600 font-semibold">{student.late}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-blue-600 font-semibold">{student.excused}</span>
                      </TableCell>
                      <TableCell>{student.total}</TableCell>
                      <TableCell>
                        <span
                          className={`font-bold ${
                            student.attendanceRate >= 90
                              ? "text-green-600"
                              : student.attendanceRate >= 75
                              ? "text-blue-600"
                              : student.attendanceRate >= 60
                              ? "text-orange-600"
                              : "text-red-600"
                          }`}
                        >
                          {student.attendanceRate.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Current Term Info */}
      {data.overview.currentTerm && (
        <Card className="border-2 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Current Academic Term</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">{data.overview.currentTerm.name}</span> -{" "}
              {data.overview.currentTerm.academicYear.year}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

