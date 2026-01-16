"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface AttendanceTrendData {
  month: string
  present: number
  absent: number
  late: number
  rate: string
}

interface AttendanceChartProps {
  data: AttendanceTrendData[]
  title?: string
}

export function AttendanceChart({ data, title = "Attendance Trend" }: AttendanceChartProps) {
  const chartData = data.map((item) => ({
    month: item.month,
    present: item.present,
    absent: item.absent,
    late: item.late,
    rate: parseFloat(item.rate),
  }))

  return (
    <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription className="text-sm">Attendance statistics over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
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
            <Line
              type="monotone"
              dataKey="present"
              stroke="#10b981"
              strokeWidth={3}
              name="Present"
              dot={{ fill: '#10b981', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="absent"
              stroke="#ef4444"
              strokeWidth={3}
              name="Absent"
              dot={{ fill: '#ef4444', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="late"
              stroke="#f59e0b"
              strokeWidth={3}
              name="Late"
              dot={{ fill: '#f59e0b', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface AttendanceRateChartProps {
  data: AttendanceTrendData[]
  title?: string
}

export function AttendanceRateChart({ data, title = "Attendance Rate" }: AttendanceRateChartProps) {
  const chartData = data.map((item) => ({
    month: item.month,
    rate: parseFloat(item.rate),
  }))

  return (
    <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription className="text-sm">Percentage of students present</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis 
              dataKey="month" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value: number) => `${value.toFixed(1)}%`}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }} 
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar 
              dataKey="rate" 
              fill="#10b981" 
              name="Attendance Rate (%)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

