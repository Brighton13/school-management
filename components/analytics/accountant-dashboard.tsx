"use client"

import { useEffect, useState } from "react"
import { StatCard } from "./stat-cards"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  BarChart3,
} from "lucide-react"
import { FeeChart, FeeCollectionRateChart } from "./fee-chart"
import { PieChartComponent, DonutChart } from "./pie-chart"

interface AccountantDashboardData {
  fees: {
    totalAmount: number
    paidAmount: number
    pendingAmount: number
    overdueAmount: number
    collectionRate: number
  }
  feeStatus: Array<{
    name: string
    value: number
    amount: number
  }>
  feeTrend: Array<{
    month: string
    total: string
    paid: string
    pending: string
    collectionRate: string
  }>
  recentPayments: Array<{
    id: string
    studentName: string
    amount: number
    paidDate: string
    feeType: string
  }>
}

export function AccountantDashboard() {
  const [data, setData] = useState<AccountantDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/analytics/accountant")
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

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
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
          description={`${data.fees.collectionRate.toFixed(1)}% collected`}
          icon={CheckCircle}
        />
        <StatCard
          title="Pending Amount"
          value={`$${data.fees.pendingAmount.toFixed(2)}`}
          description="Awaiting payment"
          icon={AlertCircle}
        />
        <StatCard
          title="Overdue Amount"
          value={`$${data.fees.overdueAmount.toFixed(2)}`}
          description="Requires attention"
          icon={TrendingUp}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <DonutChart
          data={data.feeStatus.map(f => ({ name: f.name, value: f.value }))}
          title="Fee Status Distribution"
          description="Breakdown by payment status"
        />
        {data.feeTrend.length > 0 && (
          <FeeCollectionRateChart data={data.feeTrend} />
        )}
      </div>

      {data.feeTrend.length > 0 && (
        <FeeChart data={data.feeTrend} />
      )}

      {/* Recent Payments */}
      {data.recentPayments.length > 0 && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              Recent Payments
            </CardTitle>
            <CardDescription className="text-sm">Latest fee payments received</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Student</TableHead>
                    <TableHead className="font-bold">Fee Type</TableHead>
                    <TableHead className="font-bold">Amount</TableHead>
                    <TableHead className="font-bold">Paid Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.studentName}</TableCell>
                      <TableCell>{payment.feeType}</TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ${payment.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{new Date(payment.paidDate).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

