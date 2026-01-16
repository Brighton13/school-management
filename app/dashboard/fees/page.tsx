"use client"

import { useEffect, useState, useCallback } from "react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Edit, DollarSign, Users, School, User, History, Receipt, Printer, Mail, Download, Smartphone, Loader2, RefreshCw, CheckCircle, XCircle, Clock, Search } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useSession } from "next-auth/react"
import { Pagination, usePagination, PaginationInfo, buildPaginatedQuery } from "@/components/ui/pagination"

interface Payment {
  id: string
  amount: number
  paymentMethod: string
  transactionId?: string
  receiptNumber: string
  remarks?: string
  createdAt: string
  receiver?: {
    name: string
  }
}

interface Fee {
  id: string
  feeType: string
  amount: number
  paidAmount: number
  dueDate: string
  paidDate: string | null
  status: string
  paymentMethod?: string
  transactionId?: string
  remarks?: string
  payments?: Payment[]
  student: {
    id: string
    user: { name: string }
    admissionNumber: string
  }
  term: {
    name: string
    academicYear: {
      year: string
    }
  }
  academicYear: {
    year: string
  }
}

interface Student {
  id: string
  admissionNumber: string
  user: { name: string }
}

interface Term {
  id: string
  name: string
  academicYear: {
    year: string
  }
}

interface Class {
  id: string
  name: string
  sections: { id: string; name: string }[]
}

export default function FeesPage() {
  const { data: session } = useSession()
  const [fees, setFees] = useState<Fee[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false)
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null)
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [emailSending, setEmailSending] = useState(false)
  const [bulkTarget, setBulkTarget] = useState<string>("")
  const [permissionDenied, setPermissionDenied] = useState(false)
  
  // Mobile Money Payment State
  const [isMobileMoneyDialogOpen, setIsMobileMoneyDialogOpen] = useState(false)
  const [mobileMoneyLoading, setMobileMoneyLoading] = useState(false)
  const [mobileMoneyStatus, setMobileMoneyStatus] = useState<{
    status: "idle" | "pending" | "pay-offline" | "successful" | "failed"
    message: string
    reference?: string
    receiptNumber?: string
  }>({ status: "idle", message: "" })
  const [selectedCountry, setSelectedCountry] = useState<"zm" | "mw">("zm")
  const [selectedOperator, setSelectedOperator] = useState<string>("")
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  
  // Pagination state
  const { page, limit, setPage, setLimit, reset: resetPagination } = usePagination(25)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })

  const canManage = ["ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(session?.user.role || "")

  useEffect(() => {
    fetchData()
  }, [page, limit])

  // Refetch when search or status filter changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      resetPagination()
      fetchFees()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, statusFilter])

  const fetchFees = async () => {
    try {
      setLoading(true)
      const params: Record<string, string | undefined> = {
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      }
      const queryString = buildPaginatedQuery(params, { page, limit })
      const res = await fetch(`/api/fees?${queryString}`)
      
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      
      if (res.ok) {
        const data = await res.json()
        // Handle paginated response
        if (data.data && data.pagination) {
          setFees(data.data)
          setPaginationInfo(data.pagination)
        } else {
          // Fallback for non-paginated response
          setFees(Array.isArray(data) ? data : [])
        }
      }
    } catch (error) {
      console.error("Failed to fetch fees:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const params: Record<string, string | undefined> = {
        search: searchTerm || undefined,
        status: statusFilter || undefined,
      }
      const queryString = buildPaginatedQuery(params, { page, limit })
      
      const [feesRes, studentsRes, termsRes, classesRes] = await Promise.all([
        fetch(`/api/fees?${queryString}`),
        fetch("/api/students?noPagination=true"),
        fetch("/api/terms?noPagination=true"),
        fetch("/api/classes?noPagination=true"),
      ])
      if (feesRes.status === 401 || feesRes.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      if (feesRes.ok) {
        const data = await feesRes.json()
        // Handle paginated response
        if (data.data && data.pagination) {
          setFees(data.data)
          setPaginationInfo(data.pagination)
        } else {
          setFees(Array.isArray(data) ? data : [])
        }
      }
      if (studentsRes.ok) {
        const data = await studentsRes.json()
        setStudents(Array.isArray(data) ? data : (data.data || []))
      }
      if (termsRes.ok) {
        const data = await termsRes.json()
        setTerms(Array.isArray(data) ? data : (data.data || []))
      }
      if (classesRes.ok) {
        const data = await classesRes.json()
        setClasses(Array.isArray(data) ? data : (data.data || []))
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await fetch("/api/fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: formData.get("studentId"),
          termId: formData.get("termId"),
          feeType: formData.get("feeType"),
          amount: formData.get("amount"),
          dueDate: formData.get("dueDate"),
          remarks: formData.get("remarks"),
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        fetchData()
        e.currentTarget.reset()
        alert("Fee created successfully")
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to create fee")
      }
    } catch (error) {
      console.error("Failed to create fee:", error)
      alert("Failed to create fee")
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const payload = {
      target: bulkTarget,
      classId: formData.get("classId") as string,
      sectionId: formData.get("sectionId") as string,
      studentIds: bulkTarget === "INDIVIDUAL" ? 
        (formData.get("studentIds") as string).split(",").filter(Boolean) : [],
      termId: formData.get("termId") as string,
      feeType: formData.get("feeType") as string,
      amount: formData.get("amount") as string,
      dueDate: formData.get("dueDate") as string,
      remarks: formData.get("remarks") as string,
    }
    
    try {
      const res = await fetch("/api/fees/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await res.json()
      if (res.ok) {
        setIsBulkDialogOpen(false)
        fetchData()
        alert(`Success: ${result.success} fees created. Failed: ${result.failed}.`)
        if (result.errors.length > 0) {
          console.log("Errors:", result.errors)
        }
      } else {
        alert(result.error || "Failed to create bulk fees")
      }
    } catch (error) {
      console.error("Failed to create bulk fees:", error)
      alert("Failed to create bulk fees")
    }
  }

  const handlePaymentUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFee) return

    const formData = new FormData(e.currentTarget)
    const paymentAmount = parseFloat(formData.get("paymentAmount") as string)
    
    if (paymentAmount <= 0) {
      alert("Payment amount must be greater than 0")
      return
    }
    
    const remaining = selectedFee.amount - selectedFee.paidAmount
    if (paymentAmount > remaining) {
      alert(`Payment amount cannot exceed remaining balance of ${formatCurrency(remaining)}`)
      return
    }
    
    try {
      const res = await fetch(`/api/fees/${selectedFee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentAmount: paymentAmount,
          paymentMethod: formData.get("paymentMethod"),
          transactionId: formData.get("transactionId"),
          remarks: formData.get("remarks"),
        }),
      })

      if (res.ok) {
        const result = await res.json()
        setIsPaymentDialogOpen(false)
        setSelectedFee(null)
        fetchData()
        alert(`Payment recorded successfully! Receipt: ${result.payment?.receiptNumber || 'N/A'}`)
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to record payment")
      }
    } catch (error) {
      console.error("Failed to record payment:", error)
      alert("Failed to record payment")
    }
  }

  // Mobile Money Payment Handler (Lenco API)
  const handleMobileMoneyPayment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFee) return

    const formData = new FormData(e.currentTarget)
    const paymentAmount = parseFloat(formData.get("paymentAmount") as string)
    const phone = formData.get("phone") as string
    const operator = formData.get("operator") as string
    const country = formData.get("country") as string
    
    if (paymentAmount <= 0) {
      alert("Payment amount must be greater than 0")
      return
    }
    
    const remaining = selectedFee.amount - selectedFee.paidAmount
    if (paymentAmount > remaining) {
      alert(`Payment amount cannot exceed remaining balance of ${formatCurrency(remaining)}`)
      return
    }

    if (!phone || !operator) {
      alert("Please enter phone number and select operator")
      return
    }

    setMobileMoneyLoading(true)
    setMobileMoneyStatus({ status: "idle", message: "" })

    try {
      const res = await fetch("/api/payments/mobile-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeId: selectedFee.id,
          amount: paymentAmount,
          phone,
          operator,
          country,
          bearer: "merchant",
        }),
      })

      const result = await res.json()

      if (res.ok && result.success) {
        setMobileMoneyStatus({
          status: result.data.status,
          message: result.message,
          reference: result.data.reference,
          receiptNumber: result.data.receiptNumber,
        })
      } else {
        setMobileMoneyStatus({
          status: "failed",
          message: result.error || result.details || "Failed to initiate payment",
        })
      }
    } catch (error: any) {
      console.error("Mobile money payment error:", error)
      setMobileMoneyStatus({
        status: "failed",
        message: "Failed to connect to payment service",
      })
    } finally {
      setMobileMoneyLoading(false)
    }
  }

  // Check Mobile Money Payment Status
  const checkMobileMoneyStatus = useCallback(async () => {
    if (!mobileMoneyStatus.reference) return

    setCheckingStatus(true)
    try {
      const res = await fetch("/api/payments/mobile-money/check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: mobileMoneyStatus.reference }),
      })

      const result = await res.json()

      if (result.data?.status === "successful") {
        setMobileMoneyStatus({
          status: "successful",
          message: "Payment completed successfully!",
          reference: mobileMoneyStatus.reference,
          receiptNumber: mobileMoneyStatus.receiptNumber,
        })
        fetchData() // Refresh fees data
      } else if (result.data?.status === "failed") {
        setMobileMoneyStatus({
          status: "failed",
          message: result.data.failureReason || "Payment failed",
          reference: mobileMoneyStatus.reference,
        })
      } else {
        setMobileMoneyStatus((prev) => ({
          ...prev,
          status: result.data?.status || "pending",
          message: result.message || "Payment is being processed...",
        }))
      }
    } catch (error) {
      console.error("Check status error:", error)
    } finally {
      setCheckingStatus(false)
    }
  }, [mobileMoneyStatus.reference, mobileMoneyStatus.receiptNumber])

  // Reset mobile money state when dialog closes
  const handleMobileMoneyDialogClose = (open: boolean) => {
    setIsMobileMoneyDialogOpen(open)
    if (!open) {
      setMobileMoneyStatus({ status: "idle", message: "" })
      setSelectedOperator("")
    }
  }

  // Get operators based on selected country
  const getOperators = () => {
    if (selectedCountry === "zm") {
      return [
        { value: "airtel", label: "Airtel Money" },
        { value: "mtn", label: "MTN Mobile Money" },
      ]
    }
    return [
      { value: "airtel", label: "Airtel Money" },
      { value: "tnm", label: "TNM Mpamba" },
    ]
  }

  // Print receipt function
  const handlePrintReceipt = async (payment: Payment) => {
    try {
      const res = await fetch(`/api/payments/${payment.id}/receipt`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        console.error("Receipt fetch error:", res.status, errorData)
        throw new Error(errorData.error || `Failed to fetch receipt data (${res.status})`)
      }
      
      const data = await res.json()
      const { payment: paymentData, schoolName } = data
      
      if (!paymentData) {
        throw new Error("No payment data returned")
      }
      
      // Open print window
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert("Please allow popups to print receipts")
        return
      }
      
      const totalPaid = paymentData.fee.paidAmount
      const remainingBalance = paymentData.fee.amount - paymentData.fee.paidAmount
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Receipt - ${payment.receiptNumber}</title>
          <style>
            @media print {
              body { margin: 0; padding: 20px; }
              .no-print { display: none !important; }
            }
            body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
            .header { text-align: center; border-bottom: 3px double #4F46E5; padding-bottom: 20px; margin-bottom: 20px; }
            .header h1 { color: #4F46E5; margin: 0; font-size: 28px; }
            .header p { color: #666; margin: 5px 0; }
            .receipt-title { background: #4F46E5; color: white; text-align: center; padding: 10px; margin: 20px 0; font-size: 18px; }
            .receipt-number { text-align: center; font-size: 14px; color: #666; margin-bottom: 20px; }
            .amount-box { background: #F0FDF4; border: 2px solid #10B981; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
            .amount-box .label { color: #666; font-size: 12px; text-transform: uppercase; }
            .amount-box .amount { font-size: 36px; font-weight: bold; color: #10B981; }
            .section { margin: 20px 0; }
            .section-title { font-weight: bold; color: #4F46E5; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; }
            .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #e5e7eb; }
            .detail-row:last-child { border-bottom: none; }
            .detail-label { color: #666; }
            .detail-value { font-weight: 600; }
            .summary-box { background: #EFF6FF; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .summary-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .balance-due { color: ${remainingBalance > 0 ? '#EF4444' : '#10B981'}; font-weight: bold; font-size: 18px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px; }
            .signature-line { margin-top: 50px; display: flex; justify-content: space-between; }
            .signature-box { width: 200px; text-align: center; }
            .signature-box .line { border-top: 1px solid #333; margin-bottom: 5px; }
            .print-btn { background: #4F46E5; color: white; border: none; padding: 10px 30px; font-size: 16px; cursor: pointer; border-radius: 5px; margin: 10px; }
            .print-btn:hover { background: #4338CA; }
          </style>
        </head>
        <body>
          <div class="no-print" style="text-align: center; margin-bottom: 20px;">
            <button class="print-btn" onclick="window.print()">🖨️ Print Receipt</button>
            <button class="print-btn" onclick="window.close()">✕ Close</button>
          </div>
          
          <div class="header">
            <h1>${schoolName}</h1>
            <p>Official Payment Receipt</p>
          </div>
          
          <div class="receipt-title">PAYMENT RECEIPT</div>
          <div class="receipt-number">Receipt No: <strong>${payment.receiptNumber}</strong> | Date: ${formatDate(paymentData.createdAt)}</div>
          
          <div class="amount-box">
            <div class="label">Amount Paid</div>
            <div class="amount">${formatCurrency(paymentData.amount)}</div>
          </div>
          
          <div class="section">
            <div class="section-title">Student Information</div>
            <div class="detail-row">
              <span class="detail-label">Student Name</span>
              <span class="detail-value">${paymentData.student.user.name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Admission Number</span>
              <span class="detail-value">${paymentData.student.admissionNumber}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Class</span>
              <span class="detail-value">${paymentData.student.class?.name || 'N/A'} ${paymentData.student.section?.name || ''}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Payment Details</div>
            <div class="detail-row">
              <span class="detail-label">Fee Type</span>
              <span class="detail-value">${paymentData.fee.feeType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Term</span>
              <span class="detail-value">${paymentData.fee.term.name} - ${paymentData.fee.academicYear.year}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment Method</span>
              <span class="detail-value">${paymentData.paymentMethod.replace('_', ' ')}</span>
            </div>
            ${paymentData.transactionId ? `
            <div class="detail-row">
              <span class="detail-label">Transaction ID</span>
              <span class="detail-value">${paymentData.transactionId}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Received By</span>
              <span class="detail-value">${paymentData.receiver?.name || 'System'}</span>
            </div>
          </div>
          
          <div class="summary-box">
            <div class="section-title" style="border-bottom: none; margin-bottom: 10px;">Fee Summary</div>
            <div class="summary-row">
              <span>Total Fee Amount</span>
              <span>${formatCurrency(paymentData.fee.amount)}</span>
            </div>
            <div class="summary-row">
              <span>Total Paid to Date</span>
              <span style="color: #10B981;">${formatCurrency(totalPaid)}</span>
            </div>
            <div class="summary-row" style="border-top: 1px solid #BFDBFE; padding-top: 10px; margin-top: 5px;">
              <span><strong>Balance Due</strong></span>
              <span class="balance-due">${formatCurrency(remainingBalance)}</span>
            </div>
          </div>
          
          ${paymentData.remarks ? `
          <div style="background: #FEF3C7; padding: 10px; border-radius: 5px; margin: 15px 0;">
            <strong>Remarks:</strong> ${paymentData.remarks}
          </div>
          ` : ''}
          
          <div class="signature-line">
            <div class="signature-box">
              <div class="line"></div>
              <div>Parent/Guardian Signature</div>
            </div>
            <div class="signature-box">
              <div class="line"></div>
              <div>Accountant Signature</div>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Thank you for your payment!</strong></p>
            <p>This is a computer-generated receipt.</p>
            <p>For any queries, please contact the school accounts office.</p>
          </div>
        </body>
        </html>
      `)
      printWindow.document.close()
    } catch (error) {
      console.error("Error printing receipt:", error)
      alert("Failed to generate receipt")
    }
  }

  // Email receipt function
  const handleEmailReceipt = async (payment: Payment, email?: string) => {
    setEmailSending(true)
    try {
      const res = await fetch(`/api/payments/${payment.id}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      if (res.ok) {
        alert(data.message || "Receipt sent successfully!")
        setIsReceiptDialogOpen(false)
      } else {
        alert(data.error || "Failed to send receipt")
      }
    } catch (error) {
      console.error("Error sending receipt:", error)
      alert("Failed to send receipt")
    } finally {
      setEmailSending(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      PENDING: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      PARTIAL: { color: "bg-orange-100 text-orange-800", label: "Partial" },
      PAID: { color: "bg-green-100 text-green-800", label: "Paid" },
      OVERDUE: { color: "bg-red-100 text-red-800", label: "Overdue" },
    }

    const config = statusConfig[status] || statusConfig.PENDING
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    )
  }

  const isStudentOrParent = ["STUDENT", "PARENT"].includes(session?.user.role || "")

  // Calculate summary for student view
  const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0)
  const totalPaid = fees.reduce((sum, fee) => sum + fee.paidAmount, 0)
  const totalPending = totalFees - totalPaid
  const overdueCount = fees.filter(f => f.status === "OVERDUE").length

  // Student/Parent view - simplified
  if (isStudentOrParent) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Fees</h1>
          <p className="text-muted-foreground">View your fee details and payment status</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalFees)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalPending)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Fees Table */}
        <Card>
          <CardHeader>
            <CardTitle>Fee History</CardTitle>
            <CardDescription>Your fee records and payment status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading fees...</div>
            ) : fees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No fees found</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {session?.user.role === "PARENT" && <TableHead>Student</TableHead>}
                      <TableHead>Term</TableHead>
                      <TableHead>Fee Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fees.map((fee) => (
                      <TableRow key={fee.id}>
                        {session?.user.role === "PARENT" && (
                          <TableCell>
                            <div className="font-medium">{fee.student.user.name}</div>
                          </TableCell>
                        )}
                        <TableCell>{fee.term.name} - {fee.academicYear.year}</TableCell>
                        <TableCell>{fee.feeType}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(fee.amount)}</TableCell>
                        <TableCell className="text-green-600">{formatCurrency(fee.paidAmount)}</TableCell>
                        <TableCell className="text-orange-600">{formatCurrency(fee.amount - fee.paidAmount)}</TableCell>
                        <TableCell>{formatDate(fee.dueDate)}</TableCell>
                        <TableCell>{getStatusBadge(fee.status)}</TableCell>
                        <TableCell>
                          {fee.payments && fee.payments.length > 0 ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedFee(fee)
                                setIsHistoryDialogOpen(true)
                              }}
                            >
                              <Receipt className="h-4 w-4 mr-1" />
                              {fee.payments.length}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment History Dialog for Students/Parents */}
        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Payment History</DialogTitle>
              <DialogDescription>
                Payment receipts for {selectedFee?.feeType} - {selectedFee?.term.name}
              </DialogDescription>
            </DialogHeader>
            {selectedFee && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Fee</Label>
                    <div className="font-medium">{formatCurrency(selectedFee.amount)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Paid</Label>
                    <div className="font-medium text-green-600">{formatCurrency(selectedFee.paidAmount)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Balance</Label>
                    <div className="font-medium text-red-600">{formatCurrency(selectedFee.amount - selectedFee.paidAmount)}</div>
                  </div>
                </div>

                {selectedFee.payments && selectedFee.payments.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Receipt #</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFee.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.createdAt)}</TableCell>
                            <TableCell className="font-mono text-sm">{payment.receiptNumber}</TableCell>
                            <TableCell className="font-medium text-green-600">{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{payment.paymentMethod}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePrintReceipt(payment)}
                                  title="Print Receipt"
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPayment(payment)
                                    setIsReceiptDialogOpen(true)
                                  }}
                                  title="Email Receipt"
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No payments recorded yet
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Email Receipt Dialog for Students/Parents */}
        <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Email Receipt</DialogTitle>
              <DialogDescription>
                Send receipt {selectedPayment?.receiptNumber} via email
              </DialogDescription>
            </DialogHeader>
            {selectedPayment && (
              <form onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const email = formData.get("email") as string
                handleEmailReceipt(selectedPayment, email || undefined)
              }}>
                <div className="grid gap-4 py-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Receipt Number</Label>
                        <div className="font-mono font-medium">{selectedPayment.receiptNumber}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Amount</Label>
                        <div className="font-medium text-green-600">{formatCurrency(selectedPayment.amount)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input 
                      name="email" 
                      type="email" 
                      placeholder="Leave empty to send to your registered email"
                    />
                    <p className="text-xs text-muted-foreground">
                      If left empty, the receipt will be sent to your registered email address
                    </p>
                  </div>
                </div>
                <DialogFooter className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => handlePrintReceipt(selectedPayment)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Instead
                  </Button>
                  <Button type="submit" disabled={emailSending}>
                    <Mail className="h-4 w-4 mr-2" />
                    {emailSending ? "Sending..." : "Send Email"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (permissionDenied) {
    return (
      <PermissionDenied 
        title="Access Denied"
        message="You don't have permission to access this page. Please contact your administrator if you believe this is an error."
      />
    )
  }

  // Admin/Accountant view - full management
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fee Management</h1>
          <p className="text-muted-foreground">Manage student fees and payments</p>
        </div>
        <div className="flex gap-2">
          {canManage && (
            <>
              <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Users className="mr-2 h-4 w-4" />
                    Bulk Create
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Bulk Fees</DialogTitle>
                    <DialogDescription>
                      Create fees for multiple students at once
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleBulkSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Target</Label>
                        <Select value={bulkTarget} onValueChange={setBulkTarget} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select target" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL_STUDENTS">
                              <div className="flex items-center gap-2">
                                <School className="h-4 w-4" />
                                All Students
                              </div>
                            </SelectItem>
                            <SelectItem value="CLASS">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                Specific Class
                              </div>
                            </SelectItem>
                            <SelectItem value="INDIVIDUAL">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Individual Students
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {bulkTarget === "CLASS" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Class</Label>
                            <Select name="classId" required>
                              <SelectTrigger>
                                <SelectValue placeholder="Select class" />
                              </SelectTrigger>
                              <SelectContent>
                                {classes.map((cls) => (
                                  <SelectItem key={cls.id} value={cls.id}>
                                    {cls.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Section (Optional)</Label>
                            <Select name="sectionId">
                              <SelectTrigger>
                                <SelectValue placeholder="All sections" />
                              </SelectTrigger>
                              <SelectContent>
                                {classes.flatMap(cls => 
                                  cls.sections.map(section => (
                                    <SelectItem key={section.id} value={section.id}>
                                      {section.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {bulkTarget === "INDIVIDUAL" && (
                        <div className="space-y-2">
                          <Label>Student IDs (comma-separated)</Label>
                          <Input name="studentIds" placeholder="student-id-1,student-id-2,..." required />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Term</Label>
                          <Select name="termId" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                            <SelectContent>
                              {terms.map((term) => (
                                <SelectItem key={term.id} value={term.id}>
                                  {term.name} - {term.academicYear.year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Fee Type</Label>
                          <Select name="feeType" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select fee type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TUITION">Tuition</SelectItem>
                              <SelectItem value="LIBRARY">Library</SelectItem>
                              <SelectItem value="LAB">Laboratory</SelectItem>
                              <SelectItem value="SPORTS">Sports</SelectItem>
                              <SelectItem value="TRANSPORT">Transport</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input name="amount" type="number" step="0.01" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input name="dueDate" type="date" required />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Remarks (Optional)</Label>
                        <Input name="remarks" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create Bulk Fees</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Fee
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Fee</DialogTitle>
                    <DialogDescription>
                      Create a new fee for a student
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label>Student</Label>
                        <Select name="studentId" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select student" />
                          </SelectTrigger>
                          <SelectContent>
                            {students.map((student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.user.name} ({student.admissionNumber})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Term</Label>
                          <Select name="termId" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select term" />
                            </SelectTrigger>
                            <SelectContent>
                              {terms.map((term) => (
                                <SelectItem key={term.id} value={term.id}>
                                  {term.name} - {term.academicYear.year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Fee Type</Label>
                          <Select name="feeType" required>
                            <SelectTrigger>
                              <SelectValue placeholder="Select fee type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="TUITION">Tuition</SelectItem>
                              <SelectItem value="LIBRARY">Library</SelectItem>
                              <SelectItem value="LAB">Laboratory</SelectItem>
                              <SelectItem value="SPORTS">Sports</SelectItem>
                              <SelectItem value="TRANSPORT">Transport</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Amount</Label>
                          <Input name="amount" type="number" step="0.01" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input name="dueDate" type="date" required />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Remarks (Optional)</Label>
                        <Input name="remarks" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit">Create Fee</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Student Fees</CardTitle>
          <CardDescription>View and manage all student fees</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading fees...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Fee Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee) => (
                    <TableRow key={fee.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{fee.student.user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {fee.student.admissionNumber}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {fee.term.name} {fee.academicYear.year}
                      </TableCell>
                      <TableCell>{fee.feeType}</TableCell>
                      <TableCell>{formatCurrency(fee.amount)}</TableCell>
                      <TableCell>{formatCurrency(fee.paidAmount)}</TableCell>
                      <TableCell>
                        <span className={fee.amount - fee.paidAmount > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                          {formatCurrency(fee.amount - fee.paidAmount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={new Date(fee.dueDate) < new Date() && fee.status !== "PAID" ? "text-red-600" : ""}>
                          {formatDate(fee.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(fee.status)}</TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedFee(fee)
                                setIsPaymentDialogOpen(true)
                              }}
                              disabled={fee.status === "PAID"}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Pay
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedFee(fee)
                                setIsMobileMoneyDialogOpen(true)
                              }}
                              disabled={fee.status === "PAID"}
                              className="bg-green-50 hover:bg-green-100 border-green-200"
                            >
                              <Smartphone className="h-4 w-4 mr-1" />
                              Mobile
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedFee(fee)
                                setIsHistoryDialogOpen(true)
                              }}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

{/* Record Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a new payment for {selectedFee?.student.user.name}
            </DialogDescription>
          </DialogHeader>
          {selectedFee && (
            <form onSubmit={handlePaymentUpdate}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Fee</Label>
                    <div className="font-medium">{formatCurrency(selectedFee.amount)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Paid So Far</Label>
                    <div className="font-medium text-green-600">{formatCurrency(selectedFee.paidAmount)}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Balance</Label>
                    <div className="font-medium text-red-600">{formatCurrency(selectedFee.amount - selectedFee.paidAmount)}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Payment Amount *</Label>
                  <Input 
                    name="paymentAmount" 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    max={selectedFee.amount - selectedFee.paidAmount}
                    placeholder={`Max: ${formatCurrency(selectedFee.amount - selectedFee.paidAmount)}`}
                    required 
                  />
                  <p className="text-xs text-muted-foreground">Enter the amount being paid now</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Payment Method *</Label>
                  <Select name="paymentMethod" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="MOBILE_MONEY">Mobile Money</SelectItem>
                      <SelectItem value="ONLINE">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Transaction/Reference ID</Label>
                  <Input name="transactionId" placeholder="Optional - for card/bank/mobile payments" />
                </div>
                
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Input name="remarks" placeholder="Optional notes about this payment" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  <Receipt className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment History</DialogTitle>
            <DialogDescription>
              All payments for {selectedFee?.student.user.name} - {selectedFee?.feeType}
            </DialogDescription>
          </DialogHeader>
          {selectedFee && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Total Fee</Label>
                  <div className="font-medium">{formatCurrency(selectedFee.amount)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Total Paid</Label>
                  <div className="font-medium text-green-600">{formatCurrency(selectedFee.paidAmount)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Balance</Label>
                  <div className="font-medium text-red-600">{formatCurrency(selectedFee.amount - selectedFee.paidAmount)}</div>
                </div>
              </div>

              {selectedFee.payments && selectedFee.payments.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedFee.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.createdAt)}</TableCell>
                          <TableCell className="font-mono text-sm">{payment.receiptNumber}</TableCell>
                          <TableCell className="font-medium text-green-600">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{payment.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrintReceipt(payment)}
                                title="Print Receipt"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPayment(payment)
                                  setIsReceiptDialogOpen(true)
                                }}
                                title="Email Receipt"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No payments recorded yet
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Receipt Dialog */}
      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Receipt</DialogTitle>
            <DialogDescription>
              Send receipt {selectedPayment?.receiptNumber} via email
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const email = formData.get("email") as string
              handleEmailReceipt(selectedPayment, email || undefined)
            }}>
              <div className="grid gap-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Receipt Number</Label>
                      <div className="font-mono font-medium">{selectedPayment.receiptNumber}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Amount</Label>
                      <div className="font-medium text-green-600">{formatCurrency(selectedPayment.amount)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input 
                    name="email" 
                    type="email" 
                    placeholder="Leave empty to send to student's registered email"
                  />
                  <p className="text-xs text-muted-foreground">
                    If left empty, the receipt will be sent to the student&apos;s registered email address
                  </p>
                </div>
              </div>
              <DialogFooter className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => handlePrintReceipt(selectedPayment)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Instead
                </Button>
                <Button type="submit" disabled={emailSending}>
                  <Mail className="h-4 w-4 mr-2" />
                  {emailSending ? "Sending..." : "Send Email"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Money Payment Dialog */}
      <Dialog open={isMobileMoneyDialogOpen} onOpenChange={handleMobileMoneyDialogClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-600" />
              Mobile Money Payment
            </DialogTitle>
            <DialogDescription>
              Pay via Mobile Money for {selectedFee?.student.user.name}
            </DialogDescription>
          </DialogHeader>
          {selectedFee && (
            <>
              {mobileMoneyStatus.status === "idle" ? (
                <form onSubmit={handleMobileMoneyPayment}>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Fee</Label>
                        <div className="font-medium">{formatCurrency(selectedFee.amount)}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Paid So Far</Label>
                        <div className="font-medium text-green-600">{formatCurrency(selectedFee.paidAmount)}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Balance</Label>
                        <div className="font-medium text-red-600">{formatCurrency(selectedFee.amount - selectedFee.paidAmount)}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Payment Amount *</Label>
                      <Input 
                        name="paymentAmount" 
                        type="number" 
                        step="0.01" 
                        min="0.01"
                        max={selectedFee.amount - selectedFee.paidAmount}
                        placeholder={`Max: ${formatCurrency(selectedFee.amount - selectedFee.paidAmount)}`}
                        required 
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Country *</Label>
                      <Select 
                        name="country" 
                        value={selectedCountry}
                        onValueChange={(value: "zm" | "mw") => {
                          setSelectedCountry(value)
                          setSelectedOperator("")
                        }}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zm">🇿🇲 Zambia</SelectItem>
                          <SelectItem value="mw">🇲🇼 Malawi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Mobile Money Operator *</Label>
                      <Select 
                        name="operator" 
                        value={selectedOperator}
                        onValueChange={setSelectedOperator}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperators().map((op) => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Phone Number *</Label>
                      <Input 
                        name="phone" 
                        type="tel"
                        placeholder={selectedCountry === "zm" ? "e.g., 097XXXXXXX or +26097XXXXXXX" : "e.g., 099XXXXXXX"}
                        required 
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the mobile money registered phone number
                      </p>
                    </div>

                    <Alert className="bg-blue-50 border-blue-200">
                      <Smartphone className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 text-sm">
                        After submitting, the customer will receive a prompt on their phone to authorize the payment.
                      </AlertDescription>
                    </Alert>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={mobileMoneyLoading} className="bg-green-600 hover:bg-green-700">
                      {mobileMoneyLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-4 w-4 mr-2" />
                          Request Payment
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              ) : (
                <div className="py-6 space-y-6">
                  {/* Payment Status Display */}
                  <div className="text-center">
                    {mobileMoneyStatus.status === "pay-offline" || mobileMoneyStatus.status === "pending" ? (
                      <div className="space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
                          <Clock className="h-8 w-8 text-yellow-600 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">Awaiting Authorization</h3>
                          <p className="text-muted-foreground text-sm mt-1">
                            {mobileMoneyStatus.message}
                          </p>
                        </div>
                        <Alert className="bg-yellow-50 border-yellow-200 text-left">
                          <AlertDescription className="text-yellow-800 text-sm">
                            <strong>Customer Action Required:</strong> The customer must authorize this payment on their mobile phone. 
                            Please ask them to check their phone for the payment prompt.
                          </AlertDescription>
                        </Alert>
                        <div className="text-sm text-muted-foreground">
                          Reference: <span className="font-mono">{mobileMoneyStatus.reference}</span>
                        </div>
                      </div>
                    ) : mobileMoneyStatus.status === "successful" ? (
                      <div className="space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-green-700">Payment Successful!</h3>
                          <p className="text-muted-foreground text-sm mt-1">
                            {mobileMoneyStatus.message}
                          </p>
                        </div>
                        {mobileMoneyStatus.receiptNumber && (
                          <div className="p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-800">
                              Receipt Number: <span className="font-mono font-semibold">{mobileMoneyStatus.receiptNumber}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    ) : mobileMoneyStatus.status === "failed" ? (
                      <div className="space-y-4">
                        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle className="h-8 w-8 text-red-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-red-700">Payment Failed</h3>
                          <p className="text-muted-foreground text-sm mt-1">
                            {mobileMoneyStatus.message}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 justify-center">
                    {(mobileMoneyStatus.status === "pay-offline" || mobileMoneyStatus.status === "pending") && (
                      <Button 
                        onClick={checkMobileMoneyStatus}
                        disabled={checkingStatus}
                        variant="outline"
                      >
                        {checkingStatus ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Check Status
                          </>
                        )}
                      </Button>
                    )}
                    
                    {mobileMoneyStatus.status === "successful" && (
                      <Button 
                        onClick={() => handleMobileMoneyDialogClose(false)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Done
                      </Button>
                    )}
                    
                    {mobileMoneyStatus.status === "failed" && (
                      <Button 
                        onClick={() => setMobileMoneyStatus({ status: "idle", message: "" })}
                        variant="outline"
                      >
                        Try Again
                      </Button>
                    )}
                    
                    <Button 
                      variant="ghost" 
                      onClick={() => handleMobileMoneyDialogClose(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
