"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, CreditCard, DollarSign, Receipt, WalletCards } from "lucide-react"

interface FeeRow {
  id: string
  feeType: string
  academicYear: string
  term: string
  amount: number
  paidAmount: number
  remainingAmount: number
  dueDate: string
  status: string
}

interface PaymentRow {
  id: string
  amount: number
  paymentMethod: string
  receiptNumber: string | null
  status: string
  paidAt: string
  receivedBy: string
  feeType: string
  academicYear: string
  term: string
}

interface StudentFinancials {
  student: {
    id: string
    name: string
    admissionNumber: string
    className: string
  }
  summary: {
    totalBilled: number
    totalPaid: number
    outstanding: number
    overdue: number
    pendingFeeCount: number
    paymentCount: number
  }
  pendingFees: FeeRow[]
  payments: PaymentRow[]
  fees: FeeRow[]
}

interface FinancialsResponse {
  students: StudentFinancials[]
  summary: StudentFinancials["summary"]
}

const money = (value: number) => `ZMW ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function statusVariant(status: string) {
  if (status === "PAID" || status === "SUCCESS") return "default"
  if (status === "OVERDUE" || status === "FAILED") return "destructive"
  return "secondary"
}

export default function PortalFinancialsPage() {
  const { data: session, status } = useSession()
  const [data, setData] = useState<FinancialsResponse | null>(null)
  const [selectedStudentId, setSelectedStudentId] = useState("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFinancials() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/portal/financials")
        const body = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(body.error || "Failed to load financials")
        }
        setData(body)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load financials")
      } finally {
        setLoading(false)
      }
    }

    if (status === "authenticated") {
      fetchFinancials()
    }
  }, [status])

  const visibleStudents = useMemo(() => {
    if (!data) return []
    if (selectedStudentId === "all") return data.students
    return data.students.filter((item) => item.student.id === selectedStudentId)
  }, [data, selectedStudentId])

  const summary = useMemo(() => {
    return visibleStudents.reduce(
      (totals, item) => ({
        totalBilled: totals.totalBilled + item.summary.totalBilled,
        totalPaid: totals.totalPaid + item.summary.totalPaid,
        outstanding: totals.outstanding + item.summary.outstanding,
        overdue: totals.overdue + item.summary.overdue,
        pendingFeeCount: totals.pendingFeeCount + item.summary.pendingFeeCount,
        paymentCount: totals.paymentCount + item.summary.paymentCount,
      }),
      { totalBilled: 0, totalPaid: 0, outstanding: 0, overdue: 0, pendingFeeCount: 0, paymentCount: 0 }
    )
  }, [visibleStudents])

  const pendingFees = visibleStudents.flatMap((item) =>
    item.pendingFees.map((fee) => ({ ...fee, studentName: item.student.name }))
  )
  const payments = visibleStudents.flatMap((item) =>
    item.payments.map((payment) => ({ ...payment, studentName: item.student.name }))
  )
  const allFees = visibleStudents.flatMap((item) =>
    item.fees.map((fee) => ({ ...fee, studentName: item.student.name }))
  )

  if (status === "loading" || loading) {
    return <div className="p-6 text-muted-foreground">Loading financials...</div>
  }

  if (!["STUDENT", "PARENT"].includes(session?.user.role || "")) {
    return <div className="p-6 text-muted-foreground">This financials page is available to students and parents.</div>
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financials Unavailable</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financials</h1>
          <p className="text-muted-foreground">Pending fees and historical payment records.</p>
        </div>
        {session?.user.role === "PARENT" && data && data.students.length > 1 && (
          <div className="w-full max-w-sm space-y-2">
            <Label htmlFor="financial-child">Child</Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger id="financial-child">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All linked children</SelectItem>
                {data.students.map((item) => (
                  <SelectItem key={item.student.id} value={item.student.id}>
                    {item.student.name} ({item.student.admissionNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(summary.totalBilled)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <WalletCards className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(summary.totalPaid)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(summary.outstanding)}</div>
            <p className="text-xs text-muted-foreground">{summary.pendingFeeCount} pending fee item(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Records</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.paymentCount}</div>
            <p className="text-xs text-muted-foreground">Historical payments</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending Fees</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="fees">All Fees</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Fees</CardTitle>
              <CardDescription>Outstanding balances for the selected student scope.</CardDescription>
            </CardHeader>
            <CardContent>
              <FinancialFeesTable rows={pendingFees} emptyText="No pending fees found." showStudent={session?.user.role === "PARENT"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
              <CardDescription>All successful, pending, and failed payment records.</CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentsTable rows={payments} showStudent={session?.user.role === "PARENT"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees">
          <Card>
            <CardHeader>
              <CardTitle>All Fee Records</CardTitle>
              <CardDescription>Historical fee structure and actual collections since joining.</CardDescription>
            </CardHeader>
            <CardContent>
              <FinancialFeesTable rows={allFees} emptyText="No fee records found." showStudent={session?.user.role === "PARENT"} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FinancialFeesTable({ rows, emptyText, showStudent }: { rows: Array<FeeRow & { studentName: string }>; emptyText: string; showStudent: boolean }) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">{emptyText}</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showStudent && <TableHead>Student</TableHead>}
          <TableHead>Fee</TableHead>
          <TableHead>Academic Year</TableHead>
          <TableHead>Term</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead className="text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((fee) => (
          <TableRow key={fee.id}>
            {showStudent && <TableCell>{fee.studentName}</TableCell>}
            <TableCell>{fee.feeType}</TableCell>
            <TableCell>{fee.academicYear}</TableCell>
            <TableCell>{fee.term}</TableCell>
            <TableCell>{new Date(fee.dueDate).toLocaleDateString()}</TableCell>
            <TableCell><Badge variant={statusVariant(fee.status)}>{fee.status}</Badge></TableCell>
            <TableCell className="text-right">{money(fee.amount)}</TableCell>
            <TableCell className="text-right">{money(fee.paidAmount)}</TableCell>
            <TableCell className="text-right">{money(fee.remainingAmount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function PaymentsTable({ rows, showStudent }: { rows: Array<PaymentRow & { studentName: string }>; showStudent: boolean }) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No payment history found.</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showStudent && <TableHead>Student</TableHead>}
          <TableHead>Receipt</TableHead>
          <TableHead>Fee</TableHead>
          <TableHead>Academic Year</TableHead>
          <TableHead>Term</TableHead>
          <TableHead>Paid On</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((payment) => (
          <TableRow key={payment.id}>
            {showStudent && <TableCell>{payment.studentName}</TableCell>}
            <TableCell>{payment.receiptNumber || "-"}</TableCell>
            <TableCell>{payment.feeType}</TableCell>
            <TableCell>{payment.academicYear}</TableCell>
            <TableCell>{payment.term}</TableCell>
            <TableCell>{new Date(payment.paidAt).toLocaleDateString()}</TableCell>
            <TableCell className="flex items-center gap-2"><CreditCard className="h-4 w-4" />{payment.paymentMethod}</TableCell>
            <TableCell><Badge variant={statusVariant(payment.status)}>{payment.status}</Badge></TableCell>
            <TableCell className="text-right">{money(payment.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
