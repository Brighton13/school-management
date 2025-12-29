"use client"

import { useEffect, useState } from "react"
import { StatCard } from "./stat-cards"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Package,
  BookOpen,
  AlertCircle,
  TrendingDown,
  CheckCircle,
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

interface LibrarianDashboardData {
  inventory: {
    totalItems: number
    lowStockItems: number
    outOfStockItems: number
    totalValue: number
  }
  itemsByCategory: Array<{
    category: string
    count: number
    value: number
  }>
  recentTransactions: Array<{
    id: string
    itemName: string
    type: string
    quantity: number
    date: string
  }>
  lowStockItems: Array<{
    id: string
    name: string
    category: string
    quantity: number
    minStock: number
  }>
}

export function LibrarianDashboard() {
  const [data, setData] = useState<LibrarianDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/analytics/librarian")
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
          title="Total Items"
          value={data.inventory.totalItems}
          description="In inventory"
          icon={Package}
        />
        <StatCard
          title="Low Stock"
          value={data.inventory.lowStockItems}
          description="Items below threshold"
          icon={AlertCircle}
        />
        <StatCard
          title="Out of Stock"
          value={data.inventory.outOfStockItems}
          description="Requires restocking"
          icon={TrendingDown}
        />
        <StatCard
          title="Total Value"
          value={`ZMW ${data.inventory.totalValue.toFixed(2)}`}
          description="Inventory value"
          icon={CheckCircle}
        />
      </div>

      {/* Items by Category Chart */}
      {data.itemsByCategory.length > 0 && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Inventory by Category</CardTitle>
            <CardDescription className="text-sm">Distribution of items across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.itemsByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
                <XAxis dataKey="category" tick={{ fill: "#6b7280", fontSize: 12 }} />
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
                  name="Item Count"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Low Stock Items */}
      {data.lowStockItems.length > 0 && (
        <Card className="border-2 shadow-lg border-amber-500">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Low Stock Items
            </CardTitle>
            <CardDescription className="text-sm">Items that need restocking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Item Name</TableHead>
                    <TableHead className="font-bold">Category</TableHead>
                    <TableHead className="font-bold">Current Stock</TableHead>
                    <TableHead className="font-bold">Min Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lowStockItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell className="text-red-600 font-semibold">{item.quantity}</TableCell>
                      <TableCell>{item.minStock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      {data.recentTransactions.length > 0 && (
        <Card className="border-2 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Recent Transactions
            </CardTitle>
            <CardDescription className="text-sm">Latest inventory movements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Item</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                    <TableHead className="font-bold">Quantity</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">{transaction.itemName}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            transaction.type === "IN"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {transaction.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-semibold">{transaction.quantity}</TableCell>
                      <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
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

