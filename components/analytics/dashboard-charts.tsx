"use client"

import { useEffect, useState } from "react"
import { PieChartComponent, DonutChart } from "./pie-chart"
import { ClassPerformanceChart } from "./performance-chart"
import { AttendanceRateChart } from "./attendance-chart"
import { FeeChart } from "./fee-chart"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardStats {
  studentStatus: Array<{ name: string; value: number }>
  staffStatus: Array<{ name: string; value: number }>
  staffByDesignation: Array<{ name: string; value: number }>
  feeStatus: Array<{ name: string; value: number; amount: number; paidAmount: number }>
  attendanceStatus: Array<{ name: string; value: number }>
  resultsStatus: Array<{ name: string; value: number }>
  studentsByClass: Array<{ className: string; count: number }>
  feesByType: Array<{ name: string; value: number; amount: number; paidAmount: number }>
  enrollmentTrend: Array<{ month: string; count: number }>
}

export function DashboardCharts() {
  const [data, setData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/dashboard/stats")
        if (response.ok) {
          const statsData = await response.json()
          setData(statsData)
        } else {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || "Failed to load dashboard charts")
        }
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error)
        setError("Network error. Please check your connection.")
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading charts...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <CardTitle className="text-red-800 dark:text-red-200">
            Charts Unavailable
          </CardTitle>
          <CardDescription className="text-red-700 dark:text-red-300">
            {error || "Failed to load dashboard charts. Please try again later."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {/* Row 1: Student and Staff Status */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {data.studentStatus.length > 0 && (
          <PieChartComponent
            data={data.studentStatus}
            title="Student Status Distribution"
            description="Breakdown of students by status"
          />
        )}
        {data.staffStatus.length > 0 && (
          <PieChartComponent
            data={data.staffStatus}
            title="Staff Status Distribution"
            description="Breakdown of staff by status"
          />
        )}
        {data.staffByDesignation.length > 0 && (
          <DonutChart
            data={data.staffByDesignation}
            title="Staff by Designation"
            description="Distribution of staff roles"
          />
        )}
      </div>

      {/* Row 2: Fee and Attendance Status */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {data.feeStatus.length > 0 && (
          <DonutChart
            data={data.feeStatus.map((f) => ({ name: f.name, value: f.value }))}
            title="Fee Status Distribution"
            description="Breakdown of fees by payment status"
          />
        )}
        {data.attendanceStatus.length > 0 && (
          <PieChartComponent
            data={data.attendanceStatus}
            title="Attendance Status (Last 30 Days)"
            description="Student attendance breakdown"
          />
        )}
        {data.resultsStatus.length > 0 && (
          <DonutChart
            data={data.resultsStatus}
            title="Results Status"
            description="Distribution of result statuses"
          />
        )}
      </div>

      {/* Row 3: Students by Class and Fees by Type */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {data.studentsByClass.length > 0 && (
          <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Students by Class</CardTitle>
              <CardDescription className="text-sm">Distribution of students across classes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data.studentsByClass}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis 
                    dataKey="className" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }} 
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar 
                    dataKey="count" 
                    fill="#3b82f6" 
                    name="Number of Students"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {data.feesByType.length > 0 && (
          <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Fees by Type</CardTitle>
              <CardDescription className="text-sm">Distribution of different fee types</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={data.feesByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={100}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }} 
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar 
                    dataKey="amount" 
                    fill="#3b82f6" 
                    name="Total Amount"
                    radius={[8, 8, 0, 0]}
                  />
                  <Bar 
                    dataKey="paidAmount" 
                    fill="#10b981" 
                    name="Paid Amount"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 4: Enrollment Trend */}
      {data.enrollmentTrend.length > 0 && (
        <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Enrollment Trend</CardTitle>
            <CardDescription className="text-sm">New student enrollments over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.enrollmentTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }} 
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar 
                  dataKey="count" 
                  fill="#10b981" 
                  name="New Enrollments"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

