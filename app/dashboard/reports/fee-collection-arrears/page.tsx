"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, CheckCircle2, RefreshCw, Users, WalletCards } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/utils"
import { AcademicYearReportSelector } from "@/components/reports/academic-year-report-selector"

interface ClassCollection {
  className: string
  expected: number
  collected: number
  outstanding: number
  defaulters: number
  collectionRate: number
}

interface Defaulter {
  student: string
  admissionNumber: string
  className: string
  outstanding: number
  feeTypes: string[]
  status: string
  daysOverdue: number
}

interface FeeReport {
  meta: {
    schoolName: string
    academicYear: string
    term: string
    generatedAt: string
    scope: string
  }
  executiveSummary: {
    collectionRate: number
    totalExpectedFees: number
    totalCollectedFees: number
    totalOutstandingAmount: number
    defaulterCount: number
    highestCollectionClass: ClassCollection | null
    lowestCollectionClass: ClassCollection | null
    summaryParagraph: string
  }
  visualizations: {
    paidVsUnpaidFees: { data: Array<{ name: string; value: number; color: string }> }
    collectionRateByClass: { data: ClassCollection[] }
    monthlyCollectionTrends: { data: Array<{ month: string; collected: number }> }
    topDefaultersTable: { data: Defaulter[] }
  }
  feeStructureEffectiveness: Array<{
    feeType: string
    expected: number
    collected: number
    outstanding: number
    collectionRate: number
  }>
  actionableInsights: {
    overdueMoreThan30Days: Defaulter[]
    recommendedActionsForDefaulters: string[]
  }
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: typeof CheckCircle2
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-5">
        <div className="rounded-md bg-sky-50 p-2 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function FeeCollectionArrearsPage() {
  const [report, setReport] = useState<FeeReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const searchParams = useSearchParams()
  const queryString = searchParams.toString()

  const fetchReport = async () => {
    try {
      setLoading(true)
      setError("")
      const response = await fetch(`/api/reports/fee-collection-arrears${queryString ? `?${queryString}` : ""}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Failed to load fee collection report")
      }
      setReport(await response.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fee collection report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [queryString])

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading fee collection report...</div>
  }

  if (error || !report) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertDescription>{error || "Fee collection report unavailable"}</AlertDescription>
        </Alert>
        <Button onClick={fetchReport}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    )
  }

  const hasPaidVsUnpaid = report.visualizations.paidVsUnpaidFees.data.some(
    (item) => item.value > 0
  )

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Fee Collection & Arrears
            </h1>
            <Badge variant={report.executiveSummary.collectionRate >= 85 ? "default" : "secondary"}>
              {report.executiveSummary.collectionRate.toFixed(1)}% collected
            </Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {report.meta.schoolName} | {report.meta.academicYear} | {report.meta.term} |{" "}
            {report.meta.scope}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Generated {formatDate(report.meta.generatedAt)}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AcademicYearReportSelector />
          <Button variant="outline" onClick={fetchReport}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Expected Fees"
          value={formatCurrency(report.executiveSummary.totalExpectedFees)}
          description="Total billed fees"
          icon={WalletCards}
        />
        <MetricCard
          title="Collected"
          value={formatCurrency(report.executiveSummary.totalCollectedFees)}
          description="Actual collections"
          icon={CheckCircle2}
        />
        <MetricCard
          title="Outstanding"
          value={formatCurrency(report.executiveSummary.totalOutstandingAmount)}
          description="Unpaid arrears"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Defaulters"
          value={String(report.executiveSummary.defaulterCount)}
          description="Students with balances"
          icon={Users}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Executive Summary</CardTitle>
          <CardDescription>Collection position for the school owner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>{report.executiveSummary.summaryParagraph}</p>
          <p>
            {report.executiveSummary.highestCollectionClass
              ? `${report.executiveSummary.highestCollectionClass.className} has the highest collection rate at ${report.executiveSummary.highestCollectionClass.collectionRate.toFixed(1)}%.`
              : "No highest-performing class is available yet."}{" "}
            {report.executiveSummary.lowestCollectionClass
              ? `${report.executiveSummary.lowestCollectionClass.className} has the lowest collection rate at ${report.executiveSummary.lowestCollectionClass.collectionRate.toFixed(1)}%.`
              : "No lowest-performing class is available yet."}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Paid vs Unpaid Fees</CardTitle>
            <CardDescription>Donut chart of collected and outstanding fees.</CardDescription>
          </CardHeader>
          <CardContent>
            {hasPaidVsUnpaid ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={report.visualizations.paidVsUnpaidFees.data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {report.visualizations.paidVsUnpaidFees.data.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No paid or unpaid fee values are available yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Collection Rate by Class</CardTitle>
            <CardDescription>Class comparison for collections follow-up.</CardDescription>
          </CardHeader>
          <CardContent>
            {report.visualizations.collectionRateByClass.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={report.visualizations.collectionRateByClass.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="className" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                  <Bar dataKey="collectionRate" name="Collection Rate" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No class fee records are available yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Monthly Collection Trends</CardTitle>
            <CardDescription>Successful payments over the last six months.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={report.visualizations.monthlyCollectionTrends.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line type="monotone" dataKey="collected" name="Collected" stroke="#16a34a" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recommended Actions</CardTitle>
            <CardDescription>Collections workflow for defaulters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {report.actionableInsights.recommendedActionsForDefaulters.map((action) => (
              <div key={action} className="rounded-md border p-3">
                {action}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Defaulters</CardTitle>
          <CardDescription>Students with the highest outstanding balances.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.visualizations.topDefaultersTable.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Fee Types</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.visualizations.topDefaultersTable.data.map((defaulter) => (
                  <TableRow key={defaulter.admissionNumber}>
                    <TableCell>
                      <div className="font-medium">{defaulter.student}</div>
                      <div className="text-xs text-muted-foreground">{defaulter.admissionNumber}</div>
                    </TableCell>
                    <TableCell>{defaulter.className}</TableCell>
                    <TableCell>{defaulter.feeTypes.join(", ")}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(defaulter.outstanding)}</TableCell>
                    <TableCell>{defaulter.daysOverdue}</TableCell>
                    <TableCell>
                      <Badge variant={defaulter.daysOverdue > 30 ? "destructive" : "secondary"}>
                        {defaulter.status || "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState message="No fee defaulters are currently recorded." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fee Structure Effectiveness</CardTitle>
          <CardDescription>Expected fees compared with actual collections.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.feeStructureEffectiveness.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Collected</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.feeStructureEffectiveness.map((fee) => (
                  <TableRow key={fee.feeType}>
                    <TableCell className="font-medium">{fee.feeType}</TableCell>
                    <TableCell>{formatCurrency(fee.expected)}</TableCell>
                    <TableCell>{formatCurrency(fee.collected)}</TableCell>
                    <TableCell>{formatCurrency(fee.outstanding)}</TableCell>
                    <TableCell>{fee.collectionRate.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState message="No fee structure records are available yet." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
