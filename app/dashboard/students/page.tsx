"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Search, Upload, Edit, Trash2, CheckCircle, Clock, XCircle } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

interface Student {
  id: string
  admissionNumber: string
  user: {
    name: string
    email: string
    phone: string | null
  }
  dateOfBirth: string
  gender: string
  status: string
  classEnrollment: Array<{
    class: { name: string }
    section: { name: string }
    academicYear: string
  }>
  applications: Array<{
    id: string
    applicationStatus: string
    appliedClass: {
      name: string
    }
    appliedSection: {
      name: string
    } | null
    academicYear: string
  }>
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    fetchStudents()
  }, [])

  const fetchStudents = async () => {
    try {
      const res = await fetch("/api/students")
      const data = await res.json()
      setStudents(data)
    } catch (error) {
      console.error("Failed to fetch students:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const url = editingStudent ? `/api/students/${editingStudent.id}` : "/api/students"
      const method = editingStudent ? "PUT" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password") || undefined,
          name: formData.get("name"),
          phone: formData.get("phone"),
          admissionNumber: formData.get("admissionNumber"),
          dateOfBirth: formData.get("dateOfBirth"),
          gender: formData.get("gender"),
          address: formData.get("address"),
          emergencyContact: formData.get("emergencyContact"),
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingStudent(null)
        fetchStudents()
        e.currentTarget.reset()
      }
    } catch (error) {
      console.error("Failed to save student:", error)
    }
  }

  const handleEdit = async (student: Student) => {
    try {
      const res = await fetch(`/api/students/${student.id}`)
      const data = await res.json()
      setEditingStudent(data)
      setIsEditDialogOpen(true)
    } catch (error) {
      console.error("Failed to fetch student:", error)
    }
  }

  const handleDelete = async (studentId: string) => {
    if (!confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchStudents()
      }
    } catch (error) {
      console.error("Failed to delete student:", error)
    }
  }

  const filteredStudents = students.filter(
    (student) =>
      student.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.admissionNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getEnrollmentStatus = (student: Student) => {
    const hasEnrollment = student.classEnrollment && student.classEnrollment.length > 0
    const pendingApplication = student.applications?.find(app => app.applicationStatus === "PENDING")
    
    if (hasEnrollment) {
      return {
        type: "enrolled",
        label: "Enrolled",
        color: "bg-green-100 text-green-800",
        icon: CheckCircle,
        details: `${student.classEnrollment[0].class.name} - ${student.classEnrollment[0].section.name}`,
        academicYear: student.classEnrollment[0].academicYear
      }
    } else if (pendingApplication) {
      return {
        type: "pending",
        label: "Pending Enrollment",
        color: "bg-orange-100 text-orange-800",
        icon: Clock,
        details: `Applied: ${pendingApplication.appliedClass.name}${pendingApplication.appliedSection ? ` - ${pendingApplication.appliedSection.name}` : ""}`,
        academicYear: pendingApplication.academicYear
      }
    } else {
      return {
        type: "none",
        label: "No Enrollment",
        color: "bg-gray-100 text-gray-800",
        icon: XCircle,
        details: "Not enrolled or applied",
        academicYear: null
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground">Manage student records</p>
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
                Add Student
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Student</DialogTitle>
              <DialogDescription>
                Create a new student account and record
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" name="password" type="password" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admissionNumber">Admission Number</Label>
                    <Input id="admissionNumber" name="admissionNumber" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Input id="gender" name="gender" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input id="emergencyContact" name="emergencyContact" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" name="address" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Student</Button>
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
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information
            </DialogDescription>
          </DialogHeader>
          {editingStudent && (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input id="edit-name" name="name" defaultValue={editingStudent.user.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input id="edit-email" name="email" type="email" defaultValue={editingStudent.user.email} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-password">Password (leave blank to keep current)</Label>
                    <Input id="edit-password" name="password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input id="edit-phone" name="phone" defaultValue={editingStudent.user.phone || ""} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-admissionNumber">Admission Number</Label>
                    <Input id="edit-admissionNumber" name="admissionNumber" defaultValue={editingStudent.admissionNumber} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
                    <Input id="edit-dateOfBirth" name="dateOfBirth" type="date" defaultValue={editingStudent.dateOfBirth.split('T')[0]} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-gender">Gender</Label>
                    <Input id="edit-gender" name="gender" defaultValue={editingStudent.gender} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-emergencyContact">Emergency Contact</Label>
                    <Input id="edit-emergencyContact" name="emergencyContact" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" name="address" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Update Student</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
            <p className="text-xs text-muted-foreground">All registered students</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enrolled</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => s.classEnrollment && s.classEnrollment.length > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">Currently enrolled in classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Enrollment</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => 
                (!s.classEnrollment || s.classEnrollment.length === 0) && 
                s.applications?.some(app => app.applicationStatus === "PENDING")
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting enrollment approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Enrollment</CardTitle>
            <XCircle className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => 
                (!s.classEnrollment || s.classEnrollment.length === 0) && 
                (!s.applications || !s.applications.some(app => app.applicationStatus === "PENDING"))
              ).length}
            </div>
            <p className="text-xs text-muted-foreground">No enrollment or application</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Students</CardTitle>
              <CardDescription>
                {filteredStudents.length} student(s) found
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                className="pl-8 w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Enrollment Status</TableHead>
                  <TableHead>Class/Application</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const enrollmentStatus = getEnrollmentStatus(student)
                  const StatusIcon = enrollmentStatus.icon
                  
                  return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.admissionNumber}
                    </TableCell>
                    <TableCell>{student.user.name}</TableCell>
                    <TableCell>{student.user.email}</TableCell>
                    <TableCell>{student.user.phone || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4" />
                        <Badge variant="outline" className={enrollmentStatus.color}>
                          {enrollmentStatus.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{enrollmentStatus.details}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {enrollmentStatus.academicYear || "-"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          student.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {student.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(student)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(student.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

