"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts"

interface PieChartData {
  name: string
  value: number
  color?: string
}

interface PieChartProps {
  data: PieChartData[]
  title?: string
  description?: string
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
]

// Status-based color mapping
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "#10b981", // Green
  INACTIVE: "#6b7280", // Gray
  PENDING: "#f59e0b", // Amber
  PAID: "#10b981", // Green
  OVERDUE: "#ef4444", // Red
  PARTIAL: "#f59e0b", // Amber
  PRESENT: "#10b981", // Green
  ABSENT: "#ef4444", // Red
  LATE: "#f59e0b", // Amber
  EXCUSED: "#3b82f6", // Blue
  DRAFT: "#6b7280", // Gray
  APPROVED: "#10b981", // Green
  PUBLISHED: "#10b981", // Green
  REJECTED: "#ef4444", // Red
  GRADUATED: "#8b5cf6", // Purple
  TRANSFERRED: "#6366f1", // Indigo
  DROPPED: "#ef4444", // Red
  RESIGNED: "#ef4444", // Red
  RETIRED: "#6b7280", // Gray
}

function getColorForItem(name: string, index: number, customColor?: string): string {
  if (customColor) return customColor
  
  // Check if the name matches any status
  const upperName = name.toUpperCase()
  if (STATUS_COLORS[upperName]) {
    return STATUS_COLORS[upperName]
  }
  
  // Check for partial matches (e.g., "PENDING_CLASS_TEACHER" contains "PENDING")
  for (const [status, color] of Object.entries(STATUS_COLORS)) {
    if (upperName.includes(status)) {
      return color
    }
  }
  
  // Default to color palette
  return COLORS[index % COLORS.length]
}

export function PieChartComponent({ data, title, description }: PieChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: getColorForItem(item.name, index, item.color),
  }))

  return (
    <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        {description && <CardDescription className="text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              stroke="#fff"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }} 
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

interface DonutChartProps {
  data: PieChartData[]
  title?: string
  description?: string
  innerRadius?: number
}

export function DonutChart({ data, title, description, innerRadius = 60 }: DonutChartProps) {
  const chartData = data.map((item, index) => ({
    ...item,
    color: getColorForItem(item.name, index, item.color),
  }))

  return (
    <Card className="border-2 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        {description && <CardDescription className="text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              innerRadius={innerRadius}
              fill="#8884d8"
              dataKey="value"
              stroke="#fff"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }} 
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

