"use client"

import { useEffect, useState } from "react"
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
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Staff[]>([])
  const [classSubjects, setClassSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState<string>("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [assignmentsRes, classesRes, subjectsRes, staffRes, classSubjectsRes] = await Promise.all([
        fetch("/api/teacher-assignments"),
        fetch("/api/classes"),
        fetch("/api/subjects"),
        fetch("/api/staff"),
        fetch("/api/class-subjects"),
      ])
      setAssignments(await assignmentsRes.json())
      setClasses(await classesRes.json())
      setSubjects(await subjectsRes.json())
      const staff = await staffRes.json()
      setTeachers(staff.filter((s: Staff) => s.user && s.user.name))
      setClassSubjects(await classSubjectsRes.json())
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleClassChange = async (classId: string) => {
    setSelectedClassId(classId)
    if (classId) {
      try {
        const res = await fetch(`/api/class-subjects?classId=${classId}`)
        const data = await res.json()
        setClassSubjects(data)
      } catch (error) {
        console.error("Failed to fetch class subjects:", error)
      }
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
        setIsDialogOpen(false)
      }
    } catch (error) {
      console.error("Failed to assign teacher:", error)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teacher Assignments</h1>
          <p className="text-muted-foreground">Assign teachers to classes and subjects</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                Assign a teacher to a class and subject
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                const classSubjectId = formData.get("classSubjectId") as string
                const teacherId = formData.get("teacherId") as string
                if (classSubjectId && teacherId) {
                  await handleAssign(classSubjectId, teacherId)
                }
              }}
            >
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="classId">Class</Label>
                  <Select
                    name="classId"
                    value={selectedClassId}
                    onValueChange={handleClassChange}
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
                  <Label htmlFor="classSubjectId">Class & Subject</Label>
                  <Select name="classSubjectId" required disabled={!selectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedClassId ? "Select class subject" : "Select class first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {classSubjects.map((cs) => (
                        <SelectItem key={cs.id} value={cs.id}>
                          {cs.subject.name} ({cs.subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacherId">Teacher</Label>
                  <Select name="teacherId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.user.name} ({teacher.employeeId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Assign Teacher</Button>
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

