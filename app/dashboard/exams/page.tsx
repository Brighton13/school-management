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
import { Plus, Edit, Trash2, CheckCircle, XCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Exam {
  id: string
  name: string
  description: string | null
  examType: string
  termId: string
  classId: string | null
  term: {
    id: string
    name: string
    academicYear: {
      year: string
    }
  }
  academicYear: {
    year: string
  }
  class: {
    id: string
    name: string
    sections: Array<{ id: string; name: string }>
  } | null
  startDate: string | null
  endDate: string | null
  isFinal: boolean
  requiresApproval: boolean
  status: string
  _count: {
    results: number
  }
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
  sections: Array<{ id: string; name: string }>
}

export default function ExamsPage() {
  const { data: session } = useSession()
  const [exams, setExams] = useState<Exam[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExam, setEditingExam] = useState<Exam | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("all")
  
  // Form state for Select components
  const [formExamType, setFormExamType] = useState("")
  const [formTermId, setFormTermId] = useState("")
  const [formClassId, setFormClassId] = useState("")
  const [formStatus, setFormStatus] = useState("DRAFT")
  const [editFormExamType, setEditFormExamType] = useState("")
  const [editFormTermId, setEditFormTermId] = useState("")
  const [editFormClassId, setEditFormClassId] = useState("")
  const [editFormStatus, setEditFormStatus] = useState("DRAFT")
  
  const canApprove = session?.user.role === "ADMIN" || session?.user.role === "PRINCIPAL"
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [examsRes, termsRes, classesRes] = await Promise.all([
        fetch("/api/exams"),
        fetch("/api/terms"),
        fetch("/api/classes"),
      ])
      if (examsRes.status === 401 || examsRes.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      setExams(await examsRes.json())
      setTerms(await termsRes.json())
      if (classesRes.ok) {
        setClasses(await classesRes.json())
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
    
    // Use state values for Select components
    const examType = editingExam ? editFormExamType : formExamType
    const termId = editingExam ? editFormTermId : formTermId
    const classId = editingExam ? editFormClassId : formClassId
    const status = editingExam ? editFormStatus : formStatus
    
    // Validation
    if (!examType) {
      alert("Please select an exam type")
      return
    }
    
    if (!termId) {
      alert("Please select a term")
      return
    }
    
    try {
      const url = editingExam ? `/api/exams/${editingExam.id}` : "/api/exams"
      const method = editingExam ? "PUT" : "POST"
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          description: formData.get("description"),
          examType,
          termId,
          classId: classId || null,
          startDate: formData.get("startDate") || null,
          endDate: formData.get("endDate") || null,
          isFinal: formData.get("isFinal") === "on",
          requiresApproval: formData.get("requiresApproval") !== "off",
          status,
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setIsEditDialogOpen(false)
        setEditingExam(null)
        setFormExamType("")
        setFormTermId("")
        setFormClassId("")
        setFormStatus("DRAFT")
        setEditFormExamType("")
        setEditFormClassId("")
        setEditFormStatus("DRAFT")
        fetchData()
        if (e.currentTarget) {
          e.currentTarget.reset()
        }
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to save exam")
      }
    } catch (error) {
      console.error("Failed to save exam:", error)
      alert("Failed to save exam. Please try again.")
    }
  }

  const handleEdit = async (exam: Exam) => {
    setEditingExam(exam)
    setEditFormExamType(exam.examType)
    setEditFormTermId(exam.termId)
    setEditFormClassId(exam.classId || "")
    setEditFormStatus(exam.status)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (examId: string) => {
    if (!confirm("Are you sure you want to delete this exam? This action cannot be undone.")) {
      return
    }

    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchData()
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to delete exam")
      }
    } catch (error) {
      console.error("Failed to delete exam:", error)
      alert("Failed to delete exam. Please try again.")
    }
  }

  const handleApprove = async (examId: string, action: "approve" | "reject") => {
    if (!confirm(`Are you sure you want to ${action === "approve" ? "approve" : "reject"} this exam?`)) {
      return
    }

    try {
      const res = await fetch(`/api/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (res.ok) {
        fetchData()
        alert(`Exam ${action === "approve" ? "approved" : "rejected"} successfully`)
      } else {
        const errorData = await res.json()
        alert(errorData.error || `Failed to ${action} exam`)
      }
    } catch (error) {
      console.error(`Failed to ${action} exam:`, error)
      alert(`Failed to ${action} exam. Please try again.`)
    }
  }

  // Filter exams based on active tab
  const filteredExams = exams.filter((exam) => {
    if (activeTab === "pending") {
      return exam.status === "DRAFT" && exam.requiresApproval
    }
    if (activeTab === "active") {
      return exam.status === "ACTIVE"
    }
    if (activeTab === "completed") {
      return exam.status === "COMPLETED"
    }
    return true // "all" tab
  })

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
          <h1 className="text-3xl font-bold">Exam Management</h1>
          <p className="text-muted-foreground">Create and manage exams</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) {
            setFormExamType("")
            setFormTermId("")
            setFormClassId("")
            setFormStatus("DRAFT")
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Exam
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Exam</DialogTitle>
              <DialogDescription>
                Create a new exam for teachers to enter results
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Exam Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="examType">Exam Type</Label>
                    <Select value={formExamType} onValueChange={setFormExamType} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MID_TERM">Mid Term</SelectItem>
                        <SelectItem value="FINAL">Final</SelectItem>
                        <SelectItem value="QUIZ">Quiz</SelectItem>
                        <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                        <SelectItem value="CONTINUOUS_ASSESSMENT">Continuous Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="termId">Term</Label>
                    <Select value={formTermId} onValueChange={setFormTermId} required>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classId">Class (Optional)</Label>
                  <Select value={formClassId} onValueChange={setFormClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Classes (School-wide)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Classes (School-wide)</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} ({cls.sections?.length || 0} sections)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a class to create this exam for that class and all its sections only
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" name="startDate" type="date" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input id="endDate" name="endDate" type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isFinal"
                      name="isFinal"
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isFinal">Final Exam</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="requiresApproval"
                      name="requiresApproval"
                      defaultChecked
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="requiresApproval">Requires Approval</Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formStatus} onValueChange={setFormStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Create Exam</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exams</CardTitle>
          <CardDescription>
            {filteredExams.length} exam(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              {canApprove && (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                  <TabsList>
                    <TabsTrigger value="all">All Exams</TabsTrigger>
                    <TabsTrigger value="pending">
                      Pending Approval ({exams.filter(e => e.status === "DRAFT" && e.requiresApproval).length})
                    </TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="completed">Completed</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Final</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Results</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No exams found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExams.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">{exam.name}</TableCell>
                        <TableCell>{exam.examType}</TableCell>
                        <TableCell>
                          {exam.class ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {exam.class.name}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                              All Classes
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {exam.term.name} - {exam.term.academicYear.year}
                        </TableCell>
                        <TableCell>
                          {exam.isFinal ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                              Yes
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                              No
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              exam.status === "ACTIVE"
                                ? "bg-green-100 text-green-800"
                                : exam.status === "COMPLETED"
                                ? "bg-gray-100 text-gray-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {exam.status}
                          </span>
                        </TableCell>
                        <TableCell>{exam._count.results}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {canApprove && exam.status === "DRAFT" && exam.requiresApproval && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApprove(exam.id, "approve")}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleApprove(exam.id, "reject")}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {session?.user.role === "ADMIN" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(exam)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(exam.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) {
          setEditingExam(null)
          setEditFormExamType("")
          setEditFormTermId("")
          setEditFormClassId("")
          setEditFormStatus("DRAFT")
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Exam</DialogTitle>
            <DialogDescription>
              Update exam information
            </DialogDescription>
          </DialogHeader>
          {editingExam && (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Exam Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editingExam.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input id="edit-description" name="description" defaultValue={editingExam.description || ""} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-examType">Exam Type</Label>
                    <Select value={editFormExamType} onValueChange={setEditFormExamType} required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MID_TERM">Mid Term</SelectItem>
                        <SelectItem value="FINAL">Final</SelectItem>
                        <SelectItem value="QUIZ">Quiz</SelectItem>
                        <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                        <SelectItem value="CONTINUOUS_ASSESSMENT">Continuous Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-termId">Term</Label>
                    <Select value={editFormTermId} onValueChange={setEditFormTermId} required>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-classId">Class (Optional)</Label>
                  <Select value={editFormClassId} onValueChange={setEditFormClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Classes (School-wide)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Classes (School-wide)</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name} ({cls.sections?.length || 0} sections)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a class to limit this exam to that class and all its sections only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={editFormStatus} onValueChange={setEditFormStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-startDate">Start Date</Label>
                    <Input
                      id="edit-startDate"
                      name="startDate"
                      type="date"
                      defaultValue={editingExam.startDate ? new Date(editingExam.startDate).toISOString().split("T")[0] : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-endDate">End Date</Label>
                    <Input
                      id="edit-endDate"
                      name="endDate"
                      type="date"
                      defaultValue={editingExam.endDate ? new Date(editingExam.endDate).toISOString().split("T")[0] : ""}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-isFinal"
                      name="isFinal"
                      defaultChecked={editingExam.isFinal}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="edit-isFinal">Final Exam</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-requiresApproval"
                      name="requiresApproval"
                      defaultChecked={editingExam.requiresApproval}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="edit-requiresApproval">Requires Approval</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">Update Exam</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

