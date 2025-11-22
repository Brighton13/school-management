"use client"

import { useEffect, useState } from "react"
import { StatCard } from "./stat-cards"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BookOpen,
  Calendar,
  Award,
  DollarSign,
  TrendingUp,
  FileText,
} from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface StudentDashboardData {
  student: {
    name: string
    admissionNumber: string
    className: string
  }
  results: Array<{
    subjectName: string
    marksObtained: number
    maxMarks: number
    percentage: number
    grade: string | null
    termName: string
  }>
  attendance: {
    present: number
    absent: number
    late: number
    total: number
    rate: number
  }
  fees: {
    total: number
    paid: number
    pending: number
    overdue: number
  }
  performanceTrend: Array<{
    term: string
    averageScore: number
  }>
}

export function StudentDashboard() {
  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/analytics/student")
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

  const averageScore = data.results.length > 0
    ? data.results.reduce((sum, r) => sum + r.percentage, 0) / data.results.length
    : 0

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome, {data.student.name}!</h1>
        <p className="text-blue-100">
          Admission Number: {data.student.admissionNumber} • Class: {data.student.className}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Average Score"
          value={`${averageScore.toFixed(1)}%`}
          description="Across all subjects"
          icon={Award}
        />
        <StatCard
          title="Attendance Rate"
          value={`${data.attendance.rate.toFixed(1)}%`}
          description={`${data.attendance.present} present days`}
          icon={Calendar}
        />
        <StatCard
          title="Subjects"
          value={data.results.length}
          description="Enrolled subjects"
          icon={BookOpen}
        />
        <StatCard
          title="Fees Status"
          value={data.fees.pending === 0 ? "Paid" : `${data.fees.pending} Pending`}
          description={`$${data.fees.paid.toFixed(2)} / $${data.fees.total.toFixed(2)}`}
          icon={DollarSign}
        />
      </div>

      {/* Performance Chart */}
      {data.performanceTrend.length > 0 && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Performance Trend</CardTitle>
            <CardDescription className="text-sm">Your academic performance over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.performanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis dataKey="term" tick={{ fill: "#6b7280", fontSize: 12 }} />
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
                <Legend />
                <Line
                  type="monotone"
                  dataKey="averageScore"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  name="Average Score (%)"
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            My Results
          </CardTitle>
          <CardDescription className="text-sm">All subject results and grades</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-bold">Subject</TableHead>
                  <TableHead className="font-bold">Marks</TableHead>
                  <TableHead className="font-bold">Score</TableHead>
                  <TableHead className="font-bold">Grade</TableHead>
                  <TableHead className="font-bold">Term</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{result.subjectName}</TableCell>
                    <TableCell>
                      {result.marksObtained.toFixed(0)} / {result.maxMarks.toFixed(0)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-bold ${
                          result.percentage >= 80
                            ? "text-green-600"
                            : result.percentage >= 60
                            ? "text-blue-600"
                            : result.percentage >= 50
                            ? "text-orange-600"
                            : "text-red-600"
                        }`}
                      >
                        {result.percentage.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell>{result.grade || "N/A"}</TableCell>
                    <TableCell>{result.termName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

