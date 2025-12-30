"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, DollarSign, Users, School, User } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useSession } from "next-auth/react"

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
  const [selectedFee, setSelectedFee] = useState<Fee | null>(null)
  const [bulkTarget, setBulkTarget] = useState<string>("")

  const canManage = ["ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(session?.user.role || "")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [feesRes, studentsRes, termsRes, classesRes] = await Promise.all([
        fetch("/api/fees"),
        fetch("/api/students"),
        fetch("/api/terms"),
        fetch("/api/classes"),
      ])
      if (feesRes.ok) setFees(await feesRes.json())
      if (studentsRes.ok) setStudents(await studentsRes.json())
      if (termsRes.ok) setTerms(await termsRes.json())
      if (classesRes.ok) setClasses(await classesRes.json())
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
    
    try {
      const res = await fetch(`/api/fees/${selectedFee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidAmount: formData.get("paidAmount"),
          paymentMethod: formData.get("paymentMethod"),
          transactionId: formData.get("transactionId"),
          remarks: formData.get("remarks"),
        }),
      })

      if (res.ok) {
        setIsPaymentDialogOpen(false)
        setSelectedFee(null)
        fetchData()
        alert("Payment updated successfully")
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to update payment")
      }
    } catch (error) {
      console.error("Failed to update payment:", error)
      alert("Failed to update payment")
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedFee(fee)
                              setIsPaymentDialogOpen(true)
                            }}
                            className="mr-2"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Update
                          </Button>
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

      {/* Payment Update Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment</DialogTitle>
            <DialogDescription>
              Update payment information for {selectedFee?.student.user.name}
            </DialogDescription>
          </DialogHeader>
          {selectedFee && (
            <form onSubmit={handlePaymentUpdate}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fee Amount</Label>
                    <div className="font-medium">{formatCurrency(selectedFee.amount)}</div>
                  </div>
                  <div>
                    <Label>Current Paid</Label>
                    <div className="font-medium">{formatCurrency(selectedFee.paidAmount)}</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Paid Amount</Label>
                  <Input 
                    name="paidAmount" 
                    type="number" 
                    step="0.01" 
                    defaultValue={selectedFee.paidAmount}
                    max={selectedFee.amount}
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select name="paymentMethod" defaultValue={selectedFee.paymentMethod || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="CARD">Card</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="ONLINE">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Transaction ID</Label>
                  <Input name="transactionId" defaultValue={selectedFee.transactionId || ""} />
                </div>
                
                <div className="space-y-2">
                  <Label>Remarks</Label>
                  <Input name="remarks" defaultValue={selectedFee.remarks || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Update Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

