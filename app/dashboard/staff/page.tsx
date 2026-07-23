"use client"

import { useEffect, useState } from "react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Upload, Edit, Trash2, Mail, CheckCircle, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Pagination, usePagination, PaginationInfo, buildPaginatedQuery } from "@/components/ui/pagination"

interface Staff {
  id: string
  employeeId: string
  designation: string
  department: string | null
  departmentId?: string | null
  departmentRef?: {
    id: string
    name: string
    code: string
  } | null
  staffSubjects?: Array<{
    subject: {
      id: string
      name: string
      code: string
    }
  }>
  status: string
  user: {
    name: string
    email: string
    phone: string | null
  }
}

interface Department {
  id: string
  name: string
  code: string
}

interface Subject {
  id: string
  name: string
  code: string
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const { toast } = useToast()
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [designationFilter, setDesignationFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const { page, limit, setPage, setLimit, reset: resetPagination } = usePagination(25)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })

  useEffect(() => {
    fetchStaff()
    fetchDepartments()
    fetchSubjects()
  }, [])

  useEffect(() => {
    fetchStaff()
  }, [page, limit, designationFilter, departmentFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      resetPagination()
      fetchStaff()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchStaff = async () => {
    try {
      setLoading(true)
      const queryString = buildPaginatedQuery(
        {
          search: searchTerm || undefined,
          designation: designationFilter === "all" ? undefined : designationFilter,
          departmentId: departmentFilter === "all" ? undefined : departmentFilter,
        },
        { page, limit }
      )
      const res = await fetch(`/api/staff?${queryString}`)
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setStaff(data.data || [])
      if (data.pagination) setPaginationInfo(data.pagination)
    } catch (error) {
      console.error("Failed to fetch staff:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const res = await fetch("/api/departments?noPagination=true")
      const data = await res.json()
      setDepartments(Array.isArray(data) ? data : (data.data || []))
    } catch (error) {
      console.error("Failed to fetch departments:", error)
    }
  }

  const fetchSubjects = async () => {
    try {
      const res = await fetch("/api/subjects?noPagination=true")
      const data = await res.json()
      setSubjects(Array.isArray(data) ? data : (data.data || []))
    } catch (error) {
      console.error("Failed to fetch subjects:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const isNewStaff = !editingStaff
    const staffEmail = formData.get("email") as string
    
    try {
      const url = editingStaff ? `/api/staff/${editingStaff.id}` : "/api/staff"
      const method = editingStaff ? "PUT" : "POST"
      
      // For new staff, employeeId is auto-generated; for edit, include it
      const payload: Record<string, any> = {
        email: staffEmail,
        name: formData.get("name"),
        phone: formData.get("phone"),
        role: formData.get("role"),
        designation: formData.get("designation"),
        departmentId: formData.get("departmentId") === "none" ? null : formData.get("departmentId"),
        department: formData.get("department"),
        subjectIds: formData.getAll("subjectIds"),
        qualification: formData.get("qualification"),
        experience: formData.get("experience"),
        salary: formData.get("salary"),
        joiningDate: formData.get("joiningDate"),
        gender: formData.get("gender"),
        dateOfBirth: formData.get("dateOfBirth"),
        address: formData.get("address"),
      }
      
      // Only include employeeId for updates (editing existing staff)
      if (editingStaff) {
        payload.employeeId = formData.get("employeeId")
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        setIsDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingStaff(null)
        fetchStaff()
        
        // Reset form safely
        try {
          form.reset()
        } catch (resetError) {
          // Form reset failed, but that's okay - dialog is closing anyway
        }
        
        // Show appropriate toast message
        if (isNewStaff) {
          if (data.emailSent) {
            toast({
              title: "Staff Created Successfully",
              description: `A verification email has been sent to ${staffEmail}. They will need to verify their email and set a password to access the system.`,
            })
          } else {
            toast({
              title: "Staff Created",
              description: `Staff account created but verification email could not be sent. Please check email configuration or manually send credentials.`,
              variant: "destructive",
            })
          }
        } else {
          toast({
            title: "Staff Updated",
            description: "Staff information has been updated successfully.",
          })
        }
      } else {
        const errorData = await res.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to save staff member.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to save staff:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEdit = async (staffMember: Staff) => {
    try {
      const res = await fetch(`/api/staff/${staffMember.id}`)
      const data = await res.json()
      setEditingStaff(data)
      setIsEditDialogOpen(true)
    } catch (error) {
      console.error("Failed to fetch staff:", error)
    }
  }

  const handleDelete = async (staffId: string) => {
    if (!confirm("Are you sure you want to delete this staff member? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/staff/${staffId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchStaff()
        toast({
          title: "Staff Deleted",
          description: "Staff member has been deleted successfully.",
        })
      }
    } catch (error) {
      console.error("Failed to delete staff:", error)
      toast({
        title: "Error",
        description: "Failed to delete staff member.",
        variant: "destructive",
      })
    }
  }

  const handleResendVerification = async (staffId: string, email: string) => {
    try {
      const res = await fetch(`/api/staff/${staffId}/resend-verification`, {
        method: "POST",
      })

      if (res.ok) {
        toast({
          title: "Verification Email Sent",
          description: `A new verification email has been sent to ${email}.`,
        })
      } else {
        const data = await res.json()
        toast({
          title: "Error",
          description: data.error || "Failed to send verification email.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to resend verification:", error)
      toast({
        title: "Error",
        description: "Failed to send verification email.",
        variant: "destructive",
      })
    }
  }

  if (permissionDenied) {
    return (
      <PermissionDenied 
        title="Access Denied"
        message="You don't have permission to access this page. Please contact your administrator if you believe this is an error."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Manage staff members</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/bulk-upload">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Bulk Upload
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Staff
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
              <DialogDescription>
                Create a new staff account
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" />
                </div>
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>A verification email will be sent to the staff member to set their password.</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select name="role" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEACHER">Teacher</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="PRINCIPAL">Principal</SelectItem>
                        <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                        <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation">Designation</Label>
                    <Select name="designation" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select designation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEACHER">Teacher</SelectItem>
                        <SelectItem value="PRINCIPAL">Principal</SelectItem>
                        <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                        <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Employee ID will be auto-generated based on designation</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="departmentId">Department</Label>
                    <Select name="departmentId" defaultValue="none">
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No department</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.code} - {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="qualification">Qualification</Label>
                    <Input id="qualification" name="qualification" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select name="gender">
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input id="dateOfBirth" name="dateOfBirth" type="date" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="experience">Experience (Years)</Label>
                    <Input id="experience" name="experience" type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="salary">Salary</Label>
                    <Input id="salary" name="salary" type="number" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Subjects</Label>
                  <div className="grid max-h-36 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                    {subjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No subjects available.</p>
                    ) : (
                      subjects.map((subject) => (
                        <label key={subject.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="subjectIds" value={subject.id} />
                          <span>{subject.code} - {subject.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="joiningDate">Joining Date</Label>
                  <Input id="joiningDate" name="joiningDate" type="date" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Staff</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update staff member information
            </DialogDescription>
          </DialogHeader>
          {editingStaff && (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input id="edit-name" name="name" defaultValue={editingStaff.user.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input id="edit-email" name="email" type="email" defaultValue={editingStaff.user.email} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editingStaff.user.phone || ""} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-employeeId">Employee ID</Label>
                    <Input id="edit-employeeId" name="employeeId" defaultValue={editingStaff.employeeId} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-role">Role</Label>
                    <Select name="role" defaultValue={(editingStaff as any).user?.role || "TEACHER"} required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TEACHER">Teacher</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="PRINCIPAL">Principal</SelectItem>
                        <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                        <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-designation">Designation</Label>
                  <Select name="designation" defaultValue={editingStaff.designation} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEACHER">Teacher</SelectItem>
                      <SelectItem value="PRINCIPAL">Principal</SelectItem>
                      <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                      <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-departmentId">Department</Label>
                    <Select name="departmentId" defaultValue={editingStaff.departmentId || "none"}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No department</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.code} - {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-qualification">Qualification</Label>
                    <Input id="edit-qualification" name="qualification" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-gender">Gender</Label>
                    <Select name="gender" defaultValue={(editingStaff as any).gender || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
                    <Input 
                      id="edit-dateOfBirth" 
                      name="dateOfBirth" 
                      type="date" 
                      defaultValue={(editingStaff as any).dateOfBirth ? new Date((editingStaff as any).dateOfBirth).toISOString().split('T')[0] : ""} 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" name="address" defaultValue={(editingStaff as any).address || ""} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-experience">Experience (Years)</Label>
                    <Input id="edit-experience" name="experience" type="number" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-salary">Salary</Label>
                    <Input id="edit-salary" name="salary" type="number" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Subjects</Label>
                  <div className="grid max-h-36 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                    {subjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No subjects available.</p>
                    ) : (
                      subjects.map((subject) => {
                        const assigned = editingStaff.staffSubjects?.some((item) => item.subject.id === subject.id)
                        return (
                          <label key={subject.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" name="subjectIds" value={subject.id} defaultChecked={assigned} />
                            <span>{subject.code} - {subject.name}</span>
                          </label>
                        )
                      })
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-joiningDate">Joining Date</Label>
                  <Input id="edit-joiningDate" name="joiningDate" type="date" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Update Staff</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>All Staff</CardTitle>
          <CardDescription>
            Search and filter staff records at the database layer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_260px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search staff..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Select
              value={designationFilter}
              onValueChange={(value) => {
                setDesignationFilter(value)
                resetPagination()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All designations</SelectItem>
                <SelectItem value="TEACHER">Teacher</SelectItem>
                <SelectItem value="PRINCIPAL">Principal</SelectItem>
                <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={departmentFilter}
              onValueChange={(value) => {
                setDepartmentFilter(value)
                resetPagination()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.code} - {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.employeeId}</TableCell>
                    <TableCell>{member.user.name}</TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell>{member.designation}</TableCell>
                    <TableCell>{member.departmentRef ? `${member.departmentRef.code} - ${member.departmentRef.name}` : member.department || "-"}</TableCell>
                    <TableCell>
                      {member.staffSubjects && member.staffSubjects.length > 0
                        ? member.staffSubjects.map((item) => item.subject.code).join(", ")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          member.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {member.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(member)}
                          title="Edit staff"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendVerification(member.id, member.user.email)}
                          title="Resend verification email"
                        >
                          <Mail className="h-4 w-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(member.id)}
                          title="Delete staff"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {paginationInfo.total > 0 && (
            <Pagination pagination={paginationInfo} onPageChange={setPage} onLimitChange={setLimit} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

