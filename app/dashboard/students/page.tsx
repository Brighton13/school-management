"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Search, Upload, Edit, Trash2, CheckCircle, Clock, XCircle, Download } from "lucide-react"
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
    academicYear:{ year: string } | null
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
    academicYear: { year: string } | null
  }>
}

interface TeacherClassSection {
  id: string
  name: string
  isClassTeacher: boolean
  subjects: string[]
}

interface TeacherClass {
  id: string
  name: string
  sections: TeacherClassSection[]
}

export default function StudentsPage() {
  const { data: session } = useSession()
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([])
  const [sections, setSections] = useState<Array<{ id: string; name: string; classId: string }>>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [selectedSectionId, setSelectedSectionId] = useState<string>("")
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [teacherSections, setTeacherSections] = useState<Array<{ id: string; name: string; class: { name: string } }>>([])
  const [downloadSectionId, setDownloadSectionId] = useState<string>("")
  const [showDownloadDialog, setShowDownloadDialog] = useState(false)
  
  // Teacher filter states
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([])
  const [filterClassId, setFilterClassId] = useState<string>("")
  const [filterSectionId, setFilterSectionId] = useState<string>("")
  const [availableFilterSections, setAvailableFilterSections] = useState<TeacherClassSection[]>([])

  useEffect(() => {
    if (session?.user?.role === "TEACHER") {
      fetchTeacherClasses()
      fetchTeacherSections()
    } else {
      fetchStudents()
    }
    fetchClasses()
  }, [session])

  // Fetch students when teacher filter changes
  useEffect(() => {
    if (session?.user?.role === "TEACHER") {
      fetchStudents()
    }
  }, [filterClassId, filterSectionId])

  // Update available sections when filter class changes
  useEffect(() => {
    if (filterClassId && filterClassId !== "all_classes") {
      const selectedClass = teacherClasses.find(c => c.id === filterClassId)
      setAvailableFilterSections(selectedClass?.sections || [])
      setFilterSectionId("") // Reset section when class changes
    } else {
      setAvailableFilterSections([])
      setFilterSectionId("")
    }
  }, [filterClassId, teacherClasses])

  const fetchStudents = async () => {
    try {
      setLoading(true)
      let url = "/api/students"
      
      // Add teacher filter params if role is TEACHER
      if (session?.user?.role === "TEACHER" && filterClassId && filterClassId !== "all_classes") {
        const params = new URLSearchParams()
        params.set("teacherFilter", "true")
        params.set("classId", filterClassId)
        if (filterSectionId && filterSectionId !== "all") params.set("sectionId", filterSectionId)
        url = `/api/students?${params.toString()}`
      }
      
      const res = await fetch(url)
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setStudents(data)
    } catch (error) {
      console.error("Failed to fetch students:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeacherClasses = async () => {
    try {
      const res = await fetch("/api/teacher-classes")
      if (res.ok) {
        const data = await res.json()
        setTeacherClasses(data)
      }
    } catch (error) {
      console.error("Failed to fetch teacher classes:", error)
    }
  }

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes")
      const data = await res.json()
      setClasses(data)
    } catch (error) {
      console.error("Failed to fetch classes:", error)
    }
  }

  const fetchTeacherSections = async () => {
    try {
      const res = await fetch("/api/teacher-sections")
      if (res.ok) {
        const data = await res.json()
        setTeacherSections(data)
      }
    } catch (error) {
      console.error("Failed to fetch teacher sections:", error)
    }
  }

  const fetchSections = async (classId: string) => {
    try {
      const res = await fetch(`/api/sections?classId=${classId}`)
      const data = await res.json()
      setSections(data)
    } catch (error) {
      console.error("Failed to fetch sections:", error)
      setSections([])
    }
  }

  useEffect(() => {
    if (selectedClassId) {
      fetchSections(selectedClassId)
    } else {
      setSections([])
      setSelectedSectionId("")
    }
  }, [selectedClassId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const url = editingStudent ? `/api/students/${editingStudent.id}` : "/api/students"
      const method = editingStudent ? "PUT" : "POST"
      
      const body: any = {
        email: formData.get("email"),
        name: formData.get("name"),
        phone: formData.get("phone"),
        admissionNumber: formData.get("admissionNumber"),
        dateOfBirth: formData.get("dateOfBirth"),
        gender: formData.get("gender"),
        address: formData.get("address"),
        emergencyContact: formData.get("emergencyContact"),
      }

      if (!editingStudent) {
        body.password = formData.get("password")
        
        // Add application fields if class is selected
        if (selectedClassId) {
          body.appliedClassId = selectedClassId
          body.appliedSectionId = selectedSectionId || null
          body.academicYear = formData.get("academicYear")
          body.applicationNotes = formData.get("applicationNotes")
        }
      }
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingStudent(null)
        setSelectedClassId("")
        setSelectedSectionId("")
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

  const handleDownloadClassStudents = async (sectionId?: string) => {
    setDownloading(true)
    try {
      const url = sectionId 
        ? `/api/class-students/download?sectionId=${sectionId}`
        : "/api/class-students/download"
      
      const res = await fetch(url)
      
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || "Failed to download student list")
        return
      }

      // Get the blob from response
      const blob = await res.blob()
      
      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      
      // Get filename from Content-Disposition header if available
      const contentDisposition = res.headers.get("Content-Disposition")
      let filename = "class_students.csv"
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=(.+)/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
      
      setShowDownloadDialog(false)
      setDownloadSectionId("")
    } catch (error) {
      console.error("Failed to download class students:", error)
      alert("Failed to download student list")
    } finally {
      setDownloading(false)
    }
  }

  const handleOpenDownloadDialog = () => {
    if (teacherSections.length === 1) {
      // If only one section, download directly
      handleDownloadClassStudents(teacherSections[0].id)
    } else if (teacherSections.length > 1) {
      // If multiple sections, show dialog to choose
      setShowDownloadDialog(true)
    } else {
      alert("You are not assigned as a class teacher to any section")
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
        academicYear: student.classEnrollment[0].academicYear?.year || null
      }
    } else if (pendingApplication) {
      return {
        type: "pending",
        label: "Pending Enrollment",
        color: "bg-orange-100 text-orange-800",
        icon: Clock,
        details: `Applied: ${pendingApplication.appliedClass.name}${pendingApplication.appliedSection ? ` - ${pendingApplication.appliedSection.name}` : ""}`,
        academicYear: pendingApplication.academicYear?.year || null
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
          <h1 className="text-3xl font-bold">Students</h1>
          <p className="text-muted-foreground">Manage student records</p>
        </div>
        <div className="flex gap-2">
          {session?.user?.role === "TEACHER" && (
            <Button 
              variant="outline" 
              onClick={handleOpenDownloadDialog}
              disabled={downloading}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Downloading..." : "Download My Class Students"}
            </Button>
          )}

          {session?.user?.role !== "TEACHER"&& (
          <Link href="/dashboard/bulk-upload">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Bulk Upload
            </Button>
          </Link>
        )}
         
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
             {session?.user?.role !== "TEACHER"&& (
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
               )}
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
                    <Select name="gender" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
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

                {/* Application Intent Section */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold mb-4">Intended Class (Optional)</h3>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="appliedClass">Intended Class</Label>
                        <Select 
                          value={selectedClassId} 
                          onValueChange={setSelectedClassId}
                        >
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
                        <Label htmlFor="appliedSection">Intended Section</Label>
                        <Select 
                          value={selectedSectionId} 
                          onValueChange={setSelectedSectionId}
                          disabled={!selectedClassId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                          <SelectContent>
                            {sections.map((section) => (
                              <SelectItem key={section.id} value={section.id}>
                                {section.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="academicYear">Academic Year</Label>
                      <Input 
                        id="academicYear" 
                        name="academicYear" 
                        placeholder="e.g., 2024-2025" 
                        disabled={!selectedClassId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="applicationNotes">Teacher Remarks</Label>
                      <Textarea 
                        id="applicationNotes" 
                        name="applicationNotes" 
                        placeholder="Add any notes about this student (e.g., special needs, background info, etc.)"
                        className="min-h-[80px]"
                        disabled={!selectedClassId}
                      />
                    </div>
                  </div>
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

      {/* Teacher Class/Section Filter */}
      {session?.user?.role === "TEACHER" && teacherClasses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filter Students by Class</CardTitle>
            <CardDescription>
              Select a class and section to view students. You can only see students in classes you are assigned to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label htmlFor="filter-class">Class</Label>
                <Select 
                  value={filterClassId} 
                  onValueChange={setFilterClassId}
                >
                  <SelectTrigger id="filter-class">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_classes">All My Classes</SelectItem>
                    {teacherClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label htmlFor="filter-section">Section</Label>
                <Select 
                  value={filterSectionId} 
                  onValueChange={setFilterSectionId}
                  disabled={!filterClassId || filterClassId === "all_classes"}
                >
                  <SelectTrigger id="filter-section">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {availableFilterSections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                        {section.isClassTeacher && " (Class Teacher)"}
                        {section.subjects.length > 0 && ` - ${section.subjects.join(", ")}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterClassId("")
                  setFilterSectionId("")
                }}
                disabled={!filterClassId && !filterSectionId}
              >
                Clear Filter
              </Button>
            </div>
            {filterClassId && filterClassId !== "all_classes" && (
              <p className="text-sm text-muted-foreground mt-3">
                Showing students from: {teacherClasses.find(c => c.id === filterClassId)?.name}
                {filterSectionId && filterSectionId !== "all" && ` - ${availableFilterSections.find(s => s.id === filterSectionId)?.name}`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
            <p className="text-xs text-muted-foreground">
              {session?.user?.role === "TEACHER" ? "Students in your classes" : "All registered students"}
            </p>
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
            <p className="text-xs text-muted-foreground">
              {session?.user?.role === "TEACHER" ? "Currently enrolled" : "Currently enrolled in classes"}
            </p>
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
              <CardTitle>
                {session?.user?.role === "TEACHER" 
                  ? (filterClassId && filterClassId !== "all_classes"
                      ? `Students - ${teacherClasses.find(c => c.id === filterClassId)?.name}${filterSectionId && filterSectionId !== "all" ? ` (${availableFilterSections.find(s => s.id === filterSectionId)?.name})` : ""}`
                      : "My Students")
                  : "All Students"}
              </CardTitle>
              <CardDescription>
                {filteredStudents.length} student(s) found
                {session?.user?.role === "TEACHER" && !filterClassId && " across all your assigned classes"}
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

      {/* Download Section Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Class Students</DialogTitle>
            <DialogDescription>
              Select a section to download the student list
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="download-section">Section</Label>
              <Select 
                value={downloadSectionId} 
                onValueChange={setDownloadSectionId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All My Sections</SelectItem>
                  {teacherSections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.class.name} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDownloadDialog(false)}
              disabled={downloading}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleDownloadClassStudents(downloadSectionId === "all" ? undefined : downloadSectionId)}
              disabled={!downloadSectionId || downloading}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Downloading..." : "Download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

