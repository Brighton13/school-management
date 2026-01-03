"use client"

import { useEffect, useState } from "react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Plus, UserCheck, X } from "lucide-react"

interface TeacherAssignment {
  id: string
  class: { name: string }
  section: { name: string } | null
  subject: { name: string; code: string }
  teacher: {
    user: { name: string }
    employeeId: string
  } | null
}

interface Class {
  id: string
  name: string
}

interface Section {
  id: string
  name: string
  classId: string
}

interface Subject {
  id: string
  name: string
  code: string
}

interface Staff {
  id: string
  employeeId: string
  user: { name: string }
}

export default function TeacherAssignmentsPage() {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Staff[]>([])
  const [classSubjects, setClassSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [selectedSectionId, setSelectedSectionId] = useState<string>("")
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string>("")
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("")
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [assignmentsRes, classesRes, sectionsRes, subjectsRes, staffRes, classSubjectsRes] = await Promise.all([
        fetch("/api/teacher-assignments"),
        fetch("/api/classes"),
        fetch("/api/sections"),
        fetch("/api/subjects"),
        fetch("/api/staff"),
        fetch("/api/class-subjects"),
      ])
      if (assignmentsRes.status === 401 || assignmentsRes.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      setAssignments(await assignmentsRes.json())
      setClasses(await classesRes.json())
      setSections(await sectionsRes.json())
      setSubjects(await subjectsRes.json())
      const staff = await staffRes.json()
      // Filter for staff with user info (teachers)
      setTeachers(staff.filter((s: Staff) => s.user && s.user.name))
      setClassSubjects(await classSubjectsRes.json())
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const getSectionsForClass = (classId: string) => {
    return sections.filter(s => s.classId === classId)
  }

  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId)
    setSelectedSectionId("") // Reset section when class changes
    setSelectedClassSubjectId("") // Reset class subject when class changes
    setClassSubjects([])
  }

  const handleSectionChange = async (sectionId: string) => {
    setSelectedSectionId(sectionId)
    setSelectedClassSubjectId("") // Reset class subject when section changes
    if (selectedClassId && sectionId) {
      try {
        const res = await fetch(`/api/class-subjects?classId=${selectedClassId}&sectionId=${sectionId}`)
        const data = await res.json()
        setClassSubjects(data)
      } catch (error) {
        console.error("Failed to fetch class subjects:", error)
      }
    } else {
      setClassSubjects([])
    }
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      // Reset form state when dialog closes
      setSelectedClassId("")
      setSelectedSectionId("")
      setSelectedClassSubjectId("")
      setSelectedTeacherId("")
      setClassSubjects([])
    }
  }

  const handleAssign = async (classSubjectId: string, teacherId: string) => {
    try {
      const res = await fetch("/api/teacher-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classSubjectId, teacherId }),
      })

      if (res.ok) {
        fetchData()
        handleDialogOpenChange(false)
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to assign teacher")
      }
    } catch (error) {
      console.error("Failed to assign teacher:", error)
      alert("Failed to assign teacher")
    }
  }

  const handleRemove = async (classSubjectId: string) => {
    if (!confirm("Are you sure you want to remove this assignment?")) return

    try {
      const res = await fetch(`/api/teacher-assignments?classSubjectId=${classSubjectId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error("Failed to remove assignment:", error)
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
          <h1 className="text-3xl font-bold">Teacher Assignments</h1>
          <p className="text-muted-foreground">Assign teachers to classes and subjects</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Assignment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Teacher</DialogTitle>
              <DialogDescription>
                Assign a teacher to a class section and subject
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (selectedClassSubjectId && selectedTeacherId) {
                  await handleAssign(selectedClassSubjectId, selectedTeacherId)
                } else {
                  alert("Please select both a class subject and a teacher")
                }
              }}
            >
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="classId">Class</Label>
                    <Select
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
                    <Select
                      value={selectedSectionId}
                      onValueChange={handleSectionChange}
                      disabled={!selectedClassId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedClassId ? "Select section" : "Select class first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {getSectionsForClass(selectedClassId).length === 0 ? (
                          <SelectItem value="none" disabled>
                            No sections for this class
                          </SelectItem>
                        ) : (
                          getSectionsForClass(selectedClassId).map((section) => (
                            <SelectItem key={section.id} value={section.id}>
                              {section.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classSubjectId">Subject</Label>
                  <Select 
                    value={selectedClassSubjectId} 
                    onValueChange={setSelectedClassSubjectId}
                    disabled={!selectedSectionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedSectionId ? "Select subject" : "Select section first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {classSubjects.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No subjects assigned to this section
                        </SelectItem>
                      ) : (
                        classSubjects.map((cs) => (
                          <SelectItem key={cs.id} value={cs.id}>
                            {cs.subject.name} ({cs.subject.code}) {cs.teacher ? `- ${cs.teacher.user.name}` : "- Not assigned"}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherId">Teacher</Label>
                  <Select 
                    value={selectedTeacherId} 
                    onValueChange={setSelectedTeacherId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No teachers found
                        </SelectItem>
                      ) : (
                        teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.user.name} ({teacher.employeeId})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!selectedClassSubjectId || !selectedTeacherId}>
                  Assign Teacher
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Assignments</CardTitle>
          <CardDescription>
            {assignments.length} assignment(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>{assignment.class.name}</TableCell>
                    <TableCell>{assignment.section?.name || "-"}</TableCell>
                    <TableCell>
                      {assignment.subject.name} ({assignment.subject.code})
                    </TableCell>
                    <TableCell>
                      {assignment.teacher ? (
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-green-500" />
                          {assignment.teacher.user.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {assignment.teacher?.employeeId || "-"}
                    </TableCell>
                    <TableCell>
                      {assignment.teacher && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(assignment.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

