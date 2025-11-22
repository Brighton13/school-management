"use client"

import { useEffect, useState } from "react"
import { StatCard } from "./stat-cards"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  GraduationCap,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react"
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

interface ParentDashboardData {
  children: Array<{
    id: string
    name: string
    admissionNumber: string
    className: string
    averageScore: number
    attendanceRate: number
    pendingFees: number
  }>
  totalFees: {
    total: number
    paid: number
    pending: number
  }
}

export function ParentDashboard() {
  const [data, setData] = useState<ParentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/analytics/parent")
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

  const averageScore = data.children.length > 0
    ? data.children.reduce((sum, c) => sum + c.averageScore, 0) / data.children.length
    : 0

  const averageAttendance = data.children.length > 0
    ? data.children.reduce((sum, c) => sum + c.attendanceRate, 0) / data.children.length
    : 0

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Parent Dashboard</h1>
        <p className="text-purple-100">
          Monitoring {data.children.length} {data.children.length === 1 ? "child" : "children"}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Children"
          value={data.children.length}
          description="Enrolled students"
          icon={Users}
        />
        <StatCard
          title="Average Score"
          value={`${averageScore.toFixed(1)}%`}
          description="Across all children"
          icon={TrendingUp}
        />
        <StatCard
          title="Average Attendance"
          value={`${averageAttendance.toFixed(1)}%`}
          description="Overall attendance rate"
          icon={Calendar}
        />
        <StatCard
          title="Total Fees"
          value={`$${data.totalFees.paid.toFixed(2)}`}
          description={`$${data.totalFees.pending.toFixed(2)} pending`}
          icon={DollarSign}
        />
      </div>

      {/* Children Performance Chart */}
      {data.children.length > 0 && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Children Performance</CardTitle>
            <CardDescription className="text-sm">Performance comparison across all children</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.children.map(c => ({ name: c.name, score: c.averageScore }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fill: "#6b7280", fontSize: 12 }} />
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
                <Bar
                  dataKey="score"
                  fill="#8b5cf6"
                  name="Average Score (%)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Children Details */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.children.map((child) => (
          <Card key={child.id} className="border-2 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-purple-600" />
                {child.name}
              </CardTitle>
              <CardDescription className="text-sm">
                {child.admissionNumber} • {child.className}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold text-blue-600">{child.averageScore.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Attendance</p>
                  <p className="text-2xl font-bold text-green-600">{child.attendanceRate.toFixed(1)}%</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pending Fees</p>
                <p className="text-xl font-semibold text-amber-600">${child.pendingFees.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

