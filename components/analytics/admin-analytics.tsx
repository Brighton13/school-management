"use client"

import { useEffect, useState } from "react"
import { StatCard } from "./stat-cards"
import { PerformanceChart, ClassPerformanceChart } from "./performance-chart"
import { AttendanceChart, AttendanceRateChart } from "./attendance-chart"
import { FeeChart, FeeCollectionRateChart } from "./fee-chart"
import { SubjectPerformanceChart } from "./subject-performance-chart"
import {
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  TrendingUp,
  Calendar,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DonutChart } from "./pie-chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface AdminAnalyticsData {
  overview: {
    totalStudents: number
    activeStudents: number
    totalStaff: number
    activeStaff: number
    totalClasses: number
    totalSections: number
  }
  fees: {
    totalAmount: number
    paidAmount: number
    pendingAmount: number
    pendingCount: number
    overdueCount: number
    collectionRate: string
  }
  attendance: {
    totalRecords: number
    presentCount: number
    absentCount: number
    lateCount: number
    attendanceRate: string
  }
  classPerformance: Array<{
    className: string
    averageScore: string
    studentCount: number
  }>
  performanceTrend: Array<{
    month: string
    averageScore: string
  }>
  attendanceTrend: Array<{
    month: string
    present: number
    absent: number
    late: number
    rate: string
  }>
  feeTrend: Array<{
    month: string
    total: string
    paid: string
    pending: string
    collectionRate: string
  }>
  subjectPerformance: Array<{
    subjectName: string
    averageScore: string
    studentCount: number
  }>
  staffByQualification: Array<{
    qualification: string
    count: number
  }>
  recentActivity: Array<{
    id: string
    action: string
    entityType: string
    description: string | null
    userName: string
    userRole: string
    createdAt: string
  }>
  currentTerm: {
    id: string
    name: string
    academicYear: string
  } | null
}

export function AdminAnalytics() {
  const [data, setData] = useState<AdminAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch("/api/analytics/admin")
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
          title="Active Students"
          value={data.overview.activeStudents}
          description={`Total: ${data.overview.totalStudents}`}
          icon={GraduationCap}
        />
        <StatCard
          title="Active Staff"
          value={data.overview.activeStaff}
          description={`Total: ${data.overview.totalStaff}`}
          icon={Users}
        />
        <StatCard
          title="Classes"
          value={data.overview.totalClasses}
          description={`${data.overview.totalSections} sections`}
          icon={BookOpen}
        />
        <StatCard
          title="Fee Collection Rate"
          value={`${data.fees.collectionRate}%`}
          description={`$${data.fees.paidAmount.toFixed(2)} / $${data.fees.totalAmount.toFixed(2)}`}
          icon={DollarSign}
        />
      </div>

      {/* Fee Statistics */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Fees"
          value={`$${data.fees.totalAmount.toFixed(2)}`}
          description="All fee records"
          icon={DollarSign}
        />
        <StatCard
          title="Paid Amount"
          value={`$${data.fees.paidAmount.toFixed(2)}`}
          description={`${data.fees.collectionRate}% collected`}
          icon={TrendingUp}
        />
        <StatCard
          title="Pending Fees"
          value={data.fees.pendingCount}
          description={`$${data.fees.pendingAmount.toFixed(2)} pending`}
          icon={AlertCircle}
        />
        <StatCard
          title="Overdue Fees"
          value={data.fees.overdueCount}
          description="Requires attention"
          icon={AlertCircle}
        />
      </div>

      {/* Attendance Statistics */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Attendance Rate"
          value={`${data.attendance.attendanceRate}%`}
          description="Last 30 days"
          icon={Calendar}
        />
        <StatCard
          title="Present"
          value={data.attendance.presentCount}
          description={`${data.attendance.totalRecords} total records`}
        />
        <StatCard
          title="Absent"
          value={data.attendance.absentCount}
          description="Last 30 days"
        />
        <StatCard
          title="Late"
          value={data.attendance.lateCount}
          description="Last 30 days"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.performanceTrend.length > 0 && (
          <PerformanceChart
            data={data.performanceTrend}
            title="Student Performance Trend"
            description="Average scores over the last 6 months"
          />
        )}
        {data.attendanceTrend.length > 0 && (
          <AttendanceChart data={data.attendanceTrend} />
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.feeTrend.length > 0 && (
          <FeeChart data={data.feeTrend} />
        )}
        {data.feeTrend.length > 0 && (
          <FeeCollectionRateChart data={data.feeTrend} />
        )}
      </div>

      {/* Charts Row 3 */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.classPerformance.length > 0 && (
          <ClassPerformanceChart
            data={data.classPerformance}
            title="Class Performance Comparison"
          />
        )}
        {data.subjectPerformance.length > 0 && (
          <SubjectPerformanceChart
            data={data.subjectPerformance}
            title="Top Performing Subjects"
            limit={10}
          />
        )}
      </div>

      {/* Charts Row 4: Staff by Qualification */}
      {data.staffByQualification && data.staffByQualification.length > 0 && (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Staff by Qualification
              </CardTitle>
              <CardDescription className="text-sm">
                Distribution of staff members by their qualifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data.staffByQualification}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis
                    dataKey="qualification"
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
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="#8b5cf6"
                    name="Number of Staff"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <DonutChart
            data={data.staffByQualification.map((s) => ({
              name: s.qualification,
              value: s.count,
            }))}
            title="Staff Qualification Distribution"
            description="Percentage breakdown by qualification"
          />
        </div>
      )}

      {/* Recent Activity */}
      {data.recentActivity.length > 0 && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Recent Activity</CardTitle>
            <CardDescription className="text-sm">System activities in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentActivity.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell className="font-medium">{activity.action}</TableCell>
                    <TableCell>{activity.entityType}</TableCell>
                    <TableCell>{activity.userName}</TableCell>
                    <TableCell>{activity.userRole}</TableCell>
                    <TableCell>
                      {new Date(activity.createdAt).toLocaleString()}
                    </TableCell>
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
              {data.currentTerm.academicYear}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

