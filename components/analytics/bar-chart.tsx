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

interface BarChartData {
  name: string
  value: number
  [key: string]: string | number
}

interface BarChartProps {
  data: BarChartData[]
  title?: string
  description?: string
  dataKey?: string
  xAxisKey?: string
  bars?: Array<{
    dataKey: string
    name: string
    fill?: string
  }>
}

export function BarChartComponent({
  data,
  title,
  description,
  dataKey = "value",
  xAxisKey = "name",
  bars,
}: BarChartProps) {
  const defaultBars = bars || [
    {
      dataKey: dataKey,
      name: "Value",
      fill: "#8884d8",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxisKey}
              angle={data.length > 5 ? -45 : 0}
              textAnchor={data.length > 5 ? "end" : "middle"}
              height={data.length > 5 ? 100 : undefined}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            {defaultBars.map((bar, index) => (
              <Bar
                key={index}
                dataKey={bar.dataKey}
                name={bar.name}
                fill={bar.fill || `#${Math.floor(Math.random() * 16777215).toString(16)}`}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

