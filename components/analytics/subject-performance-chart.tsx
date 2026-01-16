"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

interface SubjectPerformanceData {
  subjectName: string
  averageScore: string
  studentCount: number
}

interface SubjectPerformanceChartProps {
  data: SubjectPerformanceData[]
  title?: string
  limit?: number
}

export function SubjectPerformanceChart({
  data,
  title = "Subject Performance",
  limit = 10,
}: SubjectPerformanceChartProps) {
  const chartData = data.slice(0, limit).map((item) => ({
    subject: item.subjectName,
    score: parseFloat(item.averageScore),
    students: item.studentCount,
  }))

  return (
    <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription className="text-sm">Average performance by subject</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
            <XAxis 
              type="number" 
              domain={[0, 100]} 
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis 
              dataKey="subject" 
              type="category" 
              width={150}
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
              dataKey="score" 
              fill="#3b82f6" 
              name="Average Score (%)"
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

