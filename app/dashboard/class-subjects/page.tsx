"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Plus, Edit, Trash2 } from "lucide-react"

interface ClassSubject {
  id: string
  class: { name: string }
  subject: { name: string; code: string }
  teacher: {
    user: { name: string }
    employeeId: string
  } | null
  maxMarks: number | null
  passMarks: number | null
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

export default function ClassSubjectsPage() {
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingClassSubject, setEditingClassSubject] = useState<ClassSubject | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [classSubjectsRes, classesRes, subjectsRes] = await Promise.all([
        fetch("/api/class-subjects"),
        fetch("/api/classes"),
        fetch("/api/subjects"),
      ])
      setClassSubjects(await classSubjectsRes.json())
      setClasses(await classesRes.json())
      setSubjects(await subjectsRes.json())
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
      const url = editingClassSubject ? `/api/class-subjects/${editingClassSubject.id}` : "/api/class-subjects"
      const method = editingClassSubject ? "PUT" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: formData.get("classId"),
          subjectId: formData.get("subjectId"),
          teacherId: formData.get("teacherId") || null,
          maxMarks: formData.get("maxMarks") || null,
          passMarks: formData.get("passMarks") || null,
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingClassSubject(null)
        fetchData()
        e.currentTarget.reset()
      }
    } catch (error) {
      console.error("Failed to save class subject:", error)
    }
  }

  const handleEdit = async (classSubject: ClassSubject) => {
    setEditingClassSubject(classSubject)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (classSubjectId: string) => {
    if (!confirm("Are you sure you want to delete this class-subject? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/class-subjects/${classSubjectId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error("Failed to delete class subject:", error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Class Subjects</h1>
          <p className="text-muted-foreground">Manage class-subject combinations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Class Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Class Subject</DialogTitle>
              <DialogDescription>
                Assign a subject to a class
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="classId">Class</Label>
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
                  <Label htmlFor="subjectId">Subject</Label>
                  <Select name="subjectId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxMarks">Max Marks</Label>
                    <Input id="maxMarks" name="maxMarks" type="number" step="0.01" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passMarks">Pass Marks</Label>
                    <Input id="passMarks" name="passMarks" type="number" step="0.01" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Class Subjects</CardTitle>
          <CardDescription>
            {classSubjects.length} class-subject combination(s) found
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
                  <TableHead>Max Marks</TableHead>
                  <TableHead>Pass Marks</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classSubjects.map((cs) => (
                  <TableRow key={cs.id}>
                    <TableCell>{cs.class.name}</TableCell>
                    <TableCell>{cs.subject.name} ({cs.subject.code})</TableCell>
                    <TableCell>{cs.teacher?.user.name || "Not assigned"}</TableCell>
                    <TableCell>{cs.maxMarks || "-"}</TableCell>
                    <TableCell>{cs.passMarks || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(cs)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(cs.id)}
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
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class Subject</DialogTitle>
            <DialogDescription>
              Update class-subject information
            </DialogDescription>
          </DialogHeader>
          {editingClassSubject && (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-maxMarks">Max Marks</Label>
                    <Input id="edit-maxMarks" name="maxMarks" type="number" step="0.01" defaultValue={editingClassSubject.maxMarks || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-passMarks">Pass Marks</Label>
                    <Input id="edit-passMarks" name="passMarks" type="number" step="0.01" defaultValue={editingClassSubject.passMarks || ""} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Update</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

