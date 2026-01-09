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
import { Plus, Upload, Edit, Trash2 } from "lucide-react"
import Link from "next/link"

interface Enrollment {
  id: string
  student: {
    id: string
    user: { name: string }
    admissionNumber: string
  }
  class: { id: string; name: string }
  section: { id: string; name: string }
  academicYear: { id: string; year: string }
  status: string
}

interface Student {
  id: string
  admissionNumber: string
  user: { name: string }
}

interface Class {
  id: string
  name: string
  sections: Array<{ id: string; name: string }>
}

interface Term {
  id: string
  name: string
  academicYear: {
    id: string
    year: string
  }
  isCurrent: boolean
}

export default function EnrollmentPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [sections, setSections] = useState<Array<{ id: string; name: string; classId: string }>>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editSelectedClassId, setEditSelectedClassId] = useState<string>("")
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [enrollmentsRes, studentsRes, classesRes, termsRes] = await Promise.all([
        fetch("/api/enrollment?noPagination=true"),
        fetch("/api/students?noPagination=true"),
        fetch("/api/classes?noPagination=true"),
        fetch("/api/terms?noPagination=true"),
      ])
      if (enrollmentsRes.status === 401 || enrollmentsRes.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      const enrollmentsData = await enrollmentsRes.json()
      const studentsData = await studentsRes.json()
      const classesData = await classesRes.json()
      const termsData = await termsRes.json()
      
      // Handle both paginated and non-paginated responses
      setEnrollments(Array.isArray(enrollmentsData) ? enrollmentsData : (enrollmentsData.data || []))
      setStudents(Array.isArray(studentsData) ? studentsData : (studentsData.data || []))
      setClasses(Array.isArray(classesData) ? classesData : (classesData.data || []))
      setTerms(Array.isArray(termsData) ? termsData : (termsData.data || []))
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSections = async (classId: string) => {
    try {
      const res = await fetch(`/api/sections?classId=${classId}&noPagination=true`)
      const data = await res.json()
      setSections(Array.isArray(data) ? data : (data.data || []))
    } catch (error) {
      console.error("Failed to fetch sections:", error)
    }
  }

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId)
    if (classId) {
      fetchSections(classId)
    } else {
      setSections([])
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const url = editingEnrollment ? `/api/enrollment/${editingEnrollment.id}` : "/api/enrollment"
      const method = editingEnrollment ? "PUT" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: formData.get("studentId"),
          classId: formData.get("classId"),
          sectionId: formData.get("sectionId"),
          academicYear: formData.get("academicYear"),
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingEnrollment(null)
        setSelectedClassId("")
        setEditSelectedClassId("")
        fetchData()
        e.currentTarget.reset()
      }
    } catch (error) {
      console.error("Failed to save enrollment:", error)
    }
  }

  const handleEdit = async (enrollment: Enrollment) => {
    try {
      const res = await fetch(`/api/enrollment/${enrollment.id}`)
      const data = await res.json()
      setEditingEnrollment(data)
      const classId = data.class.id
      setEditSelectedClassId(classId)
      if (classId) {
        const sectionsRes = await fetch(`/api/sections?classId=${classId}&noPagination=true`)
        const sectionsData = await sectionsRes.json()
        setSections(Array.isArray(sectionsData) ? sectionsData : (sectionsData.data || []))
      }
      setIsEditDialogOpen(true)
    } catch (error) {
      console.error("Failed to fetch enrollment:", error)
    }
  }

  const handleDelete = async (enrollmentId: string) => {
    if (!confirm("Are you sure you want to delete this enrollment? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/enrollment/${enrollmentId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error("Failed to delete enrollment:", error)
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Student Enrollment</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Enroll students in classes and sections</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/dashboard/bulk-upload" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Bulk Upload</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </Link>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Enrollment</span>
                <span className="sm:hidden">New</span>
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Enroll Student</DialogTitle>
              <DialogDescription>
                Enroll a student in a class and section
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="classId">Class</Label>
                  <Select
                    name="classId"
                    required
                    value={selectedClassId}
                    onValueChange={handleClassChange}
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
                  <Label htmlFor="sectionId">Section</Label>
                  <Select name="sectionId" required disabled={!selectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedClassId ? "Select section" : "Select class first"} />
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
                <div className="space-y-2">
                  <Label htmlFor="academicYear">Academic Year</Label>
                  <Select name="academicYear" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(terms.map(term => term.academicYear.year))).map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Students enroll once per academic year. Terms are tracked automatically.
                  </p>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="submit" className="w-full sm:w-auto">Enroll Student</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Enrollment</DialogTitle>
            <DialogDescription>
              Update enrollment information
            </DialogDescription>
          </DialogHeader>
          {editingEnrollment && (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-studentId">Student</Label>
                  <Select name="studentId" defaultValue={editingEnrollment.student.id} required>
                    <SelectTrigger>
                      <SelectValue />
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
                <div className="space-y-2">
                  <Label htmlFor="edit-classId">Class</Label>
                  <Select
                    name="classId"
                    value={editSelectedClassId}
                    onValueChange={(value) => {
                      setEditSelectedClassId(value)
                      if (value) {
                        fetchSections(value)
                      }
                    }}
                    required
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
                  <Label htmlFor="edit-sectionId">Section</Label>
                  <Select name="sectionId" defaultValue={editingEnrollment.section.id} required disabled={!editSelectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder={editSelectedClassId ? "Select section" : "Select class first"} />
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
                <div className="space-y-2">
                  <Label htmlFor="edit-academicYear">Academic Year</Label>
                  <Select name="academicYear" defaultValue={editingEnrollment.academicYear.year} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(terms.map(term => term.academicYear.year))).map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Students enroll once per academic year. Terms are tracked automatically.
                  </p>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="submit" className="w-full sm:w-auto">Update Enrollment</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Card className="shadow-sm">
        <CardHeader className="pb-3 sm:pb-6">
          <CardTitle className="text-lg sm:text-xl">Enrollments</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {enrollments.length} enrollment(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-sm sm:text-base">Loading...</div>
          ) : (
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <div className="inline-block min-w-full align-middle px-3 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Student</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Admission No.</TableHead>
                      <TableHead className="text-xs sm:text-sm">Class</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">Section</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Academic Year</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrollments.map((enrollment) => (
                      <TableRow key={enrollment.id}>
                        <TableCell className="text-xs sm:text-sm font-medium">
                          <div>
                            <div>{enrollment.student.user.name}</div>
                            <div className="text-muted-foreground sm:hidden text-xs">
                              {enrollment.student.admissionNumber}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                          {enrollment.student.admissionNumber}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          <div>
                            <div>{enrollment.class.name}</div>
                            <div className="text-muted-foreground md:hidden text-xs">
                              {enrollment.section.name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                          {enrollment.section.name}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                          {enrollment.academicYear.year}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              enrollment.status === "ACTIVE"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }`}
                          >
                            {enrollment.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEdit(enrollment)}
                              aria-label="Edit enrollment"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDelete(enrollment.id)}
                              aria-label="Delete enrollment"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

