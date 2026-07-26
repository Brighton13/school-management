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
import { Plus, Download, CheckCircle, XCircle, Clock, Upload, Pencil } from "lucide-react"
import jsPDF from "jspdf"
import { useSession } from "next-auth/react"
import { BulkResultsUpload } from "@/components/bulk-results-upload"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StudentResultsView } from "@/components/analytics/student-results-view"
import { ParentResultsView } from "@/components/analytics/parent-results-view"
import { Pagination, PaginationInfo, usePagination, buildPaginatedQuery } from "@/components/ui/pagination"

interface Result {
  id: string
  marksObtained: number
  maxMarks: number
  grade: string | null
  status: string
  published: boolean
  submittedAt: string | null
  approvedAt: string | null
  student: {
    user: { name: string }
    admissionNumber: string
  }
  classSubject: {
    subject: { name: string }
    class: { name: string }
    teacher: {
      user: { name: string }
    } | null
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
  exam: {
    name: string
    examType: string
  } | null
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
    id: string
    year: string
  }
}

interface ClassSubject {
  id: string
  classId: string
  sectionId: string | null
  class: { id: string; name: string }
  section: { id: string; name: string } | null
  subject: { name: string; code: string }
}

interface Exam {
  id: string
  name: string
  examType: string
  isFinal: boolean
  requiresApproval: boolean
  status: string
}

export default function ResultsPage() {
  const { data: session, status } = useSession()
  const [results, setResults] = useState<Result[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string>("")
  const [selectedExamId, setSelectedExamId] = useState<string>("")
  const [selectedTermId, setSelectedTermId] = useState<string>("")
  const [marksObtained, setMarksObtained] = useState<string>("")
  const [maxMarks, setMaxMarks] = useState<string>("")
  const [calculatedGrade, setCalculatedGrade] = useState<string>("")
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const { page, limit, setPage, setLimit } = usePagination(50)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })
  
  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingResult, setEditingResult] = useState<Result | null>(null)
  const [editMarksObtained, setEditMarksObtained] = useState<string>("")
  const [editMaxMarks, setEditMaxMarks] = useState<string>("")
  const [editGrade, setEditGrade] = useState<string>("")
  const [editRemarks, setEditRemarks] = useState<string>("")

  // Function to calculate grade based on percentage
  const calculateGrade = (marks: number, max: number): string => {
    if (max <= 0) return ""
    const percentage = (marks / max) * 100
    if (percentage >= 90) return "A+"
    if (percentage >= 80) return "A"
    if (percentage >= 70) return "B+"
    if (percentage >= 60) return "B"
    if (percentage >= 50) return "C+"
    if (percentage >= 40) return "C"
    if (percentage >= 30) return "D"
    return "F"
  }

  // Update grade when marks change
  useEffect(() => {
    const marks = parseFloat(marksObtained)
    const max = parseFloat(maxMarks)
    if (!isNaN(marks) && !isNaN(max) && max > 0) {
      setCalculatedGrade(calculateGrade(marks, max))
    } else {
      setCalculatedGrade("")
    }
  }, [marksObtained, maxMarks])

  // Update grade when edit marks change
  useEffect(() => {
    const marks = parseFloat(editMarksObtained)
    const max = parseFloat(editMaxMarks)
    if (!isNaN(marks) && !isNaN(max) && max > 0) {
      setEditGrade(calculateGrade(marks, max))
    }
  }, [editMarksObtained, editMaxMarks])

  // Fetch students when class-subject is selected
  useEffect(() => {
    const fetchStudentsForClassSubject = async () => {
      if (!selectedClassSubjectId) {
        setFilteredStudents([])
        return
      }

      const selectedCS = classSubjects.find(cs => cs.id === selectedClassSubjectId)
      if (!selectedCS) {
        setFilteredStudents([])
        return
      }

      setLoadingStudents(true)
      try {
        // Fetch students enrolled in this class/section for current academic year
        const params = new URLSearchParams({
          classId: selectedCS.classId,
          currentAcademicYear: "true",
          noPagination: "true",
          compact: "true",
          limit: "1000",
        })
        if (selectedCS.sectionId) {
          params.append("sectionId", selectedCS.sectionId)
        }
        
        const res = await fetch(`/api/students?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setFilteredStudents(Array.isArray(data) ? data : (data.data || []))
        } else {
          setFilteredStudents([])
        }
      } catch (error) {
        console.error("Failed to fetch students for class:", error)
        setFilteredStudents([])
      } finally {
        setLoadingStudents(false)
      }
    }

    fetchStudentsForClassSubject()
  }, [selectedClassSubjectId, classSubjects])

  // Auto-select class-subject if teacher has only one
  useEffect(() => {
    if (classSubjects.length === 1 && !selectedClassSubjectId) {
      setSelectedClassSubjectId(classSubjects[0].id)
    }
  }, [classSubjects, selectedClassSubjectId])

  const fetchData = async () => {
    try {
      const resultsQuery = buildPaginatedQuery({}, { page, limit })
      const [resultsRes, termsRes, classSubjectsRes, examsRes] = await Promise.all([
        fetch(`/api/results?${resultsQuery}`),
        fetch("/api/terms?noPagination=true"),
        fetch("/api/class-subjects?noPagination=true"),
        fetch("/api/exams?status=ACTIVE&noPagination=true"),
      ])
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json()
        setResults(Array.isArray(resultsData) ? resultsData : (resultsData.data || []))
        if (!Array.isArray(resultsData) && resultsData.pagination) {
          setPaginationInfo(resultsData.pagination)
        }
      }
      if (termsRes.ok) {
        const termsData = await termsRes.json()
        setTerms(Array.isArray(termsData) ? termsData : (termsData.data || []))
      }
      if (classSubjectsRes.ok) {
        const classSubjectsData = await classSubjectsRes.json()
        setClassSubjects(Array.isArray(classSubjectsData) ? classSubjectsData : (classSubjectsData.data || []))
      }
      if (examsRes.ok) {
        const examsData = await examsRes.json()
        setExams(Array.isArray(examsData) ? examsData : (examsData.data || []))
      } else {
        console.error("Failed to fetch exams:", await examsRes.text())
        setExams([])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      setResults([])
      setTerms([])
      setClassSubjects([])
      setExams([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Only fetch data if not a student and session is loaded
    if (status === "authenticated" && !["STUDENT", "PARENT"].includes(session?.user.role || "")) {
      fetchData()
    }
  }, [session, status, page, limit])
  
  // Show loading while session is being fetched
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If user is a student, show the student-specific results view
  if (session?.user.role === "STUDENT") {
    return <StudentResultsView />
  }

  if (session?.user.role === "PARENT") {
    return <ParentResultsView />
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    // Get academicYearId from selected term
    const termId = formData.get("termId") as string
    const selectedTerm = terms.find(t => t.id === termId)
    const academicYearId = selectedTerm?.academicYear?.id || null
    
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: formData.get("studentId"),
          classSubjectId: formData.get("classSubjectId"),
          termId: termId,
          academicYearId: academicYearId,
          examId: formData.get("examId") || null,
          marksObtained: formData.get("marksObtained"),
          maxMarks: formData.get("maxMarks"),
          grade: formData.get("grade"),
          remarks: formData.get("remarks"),
        }),
      })

      if (res.ok) {
        setIsDialogOpen(false)
        setSelectedClassSubjectId("")
        setSelectedExamId("")
        setSelectedTermId("")
        setMarksObtained("")
        setMaxMarks("")
        setCalculatedGrade("")
        setPage(1)
        fetchData()
        e.currentTarget.reset()
      } else {
        const error = await res.json()
        alert(error.error || "Failed to create result")
      }
    } catch (error) {
      console.error("Failed to create result:", error)
      alert("Failed to create result")
    }
  }

  // Open edit dialog with result data
  const openEditDialog = (result: Result) => {
    setEditingResult(result)
    setEditMarksObtained(result.marksObtained.toString())
    setEditMaxMarks(result.maxMarks.toString())
    setEditGrade(result.grade || "")
    setEditRemarks("")
    setIsEditDialogOpen(true)
  }

  // Handle edit form submission
  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingResult) return

    try {
      const res = await fetch(`/api/results/${editingResult.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marksObtained: editMarksObtained,
          maxMarks: editMaxMarks,
          grade: editGrade,
          remarks: editRemarks,
        }),
      })

      if (res.ok) {
        setIsEditDialogOpen(false)
        setEditingResult(null)
        setEditMarksObtained("")
        setEditMaxMarks("")
        setEditGrade("")
        setEditRemarks("")
        setPage(1)
        fetchData()
        alert("Result updated successfully")
      } else {
        const error = await res.json()
        alert(error.error || "Failed to update result")
      }
    } catch (error) {
      console.error("Failed to update result:", error)
      alert("Failed to update result")
    }
  }

  // Check if result can be edited by current user
  const canEditResult = (result: Result) => {
    if (session?.user.role === "ADMIN" || session?.user.role === "PRINCIPAL") {
      // Admin/Principal can edit any result that's not published
      return result.status !== "PUBLISHED" && result.status !== "APPROVED"
    }
    if (session?.user.role === "TEACHER") {
      // Teachers can edit until principal approves
      const editableStatuses = ["DRAFT", "PENDING_CLASS_TEACHER", "PENDING_APPROVAL", "REJECTED"]
      return editableStatuses.includes(result.status)
    }
    return false
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
      DRAFT: { color: "bg-gray-100 text-gray-800", icon: Clock, label: "Draft" },
      PENDING_CLASS_TEACHER: { color: "bg-orange-100 text-orange-800", icon: Clock, label: "Pending Class Teacher" },
      PENDING_APPROVAL: { color: "bg-yellow-100 text-yellow-800", icon: Clock, label: "Pending Approval" },
      APPROVED: { color: "bg-blue-100 text-blue-800", icon: CheckCircle, label: "Approved" },
      REJECTED: { color: "bg-red-100 text-red-800", icon: XCircle, label: "Rejected" },
      PUBLISHED: { color: "bg-green-100 text-green-800", icon: CheckCircle, label: "Published" },
    }

    const config = statusConfig[status] || statusConfig.DRAFT
    const Icon = config.icon

    return (
      <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${config.color}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
    )
  }

  const generateReport = async (result: Result) => {
    // Fetch signatures and school config
    let principalSig: any[] = []
    let classTeacherSig: any[] = []
    let schoolConfig: any = null
    
    try {
      const [principalSigRes, classTeacherSigRes, schoolConfigRes] = await Promise.all([
        fetch("/api/signatures?signatureType=PRINCIPAL"),
        fetch("/api/signatures?signatureType=CLASS_TEACHER"),
        fetch("/api/settings/school-config"),
      ])
      if (principalSigRes.ok) {
        principalSig = await principalSigRes.json()
      }
      if (classTeacherSigRes.ok) {
        classTeacherSig = await classTeacherSigRes.json()
      }
      if (schoolConfigRes.ok) {
        schoolConfig = await schoolConfigRes.json()
      }
    } catch (error) {
      console.error("Error fetching signatures and school config:", error)
    }

    const doc = new jsPDF()
    
    // Add school logo if available
    if (schoolConfig?.schoolLogo) {
      try {
        const logoBase64 = schoolConfig.schoolLogo.replace(/^data:image\/\w+;base64,/, "")
        doc.addImage(logoBase64, "PNG", 20, 10, 30, 30) // Logo at top-left
      } catch (e) {
        console.error("Error adding school logo:", e)
      }
    }
    
    // School header
    doc.setFontSize(16)
    doc.text(schoolConfig?.schoolName || "School Name", 105, 15, { align: "center" })
    
    if (schoolConfig?.ministryHeader) {
      doc.setFontSize(12)
      doc.text(schoolConfig.ministryHeader, 105, 25, { align: "center" })
    }
    
    if (schoolConfig?.schoolAddress) {
      doc.setFontSize(10)
      doc.text(schoolConfig.schoolAddress, 105, 32, { align: "center" })
    }
    
    // Report title
    doc.setFontSize(18)
    doc.text("Result Report", 105, 50, { align: "center" })
    
    doc.setFontSize(12)
    doc.text(`Student: ${result.student.user.name}`, 20, 70)
    doc.text(`Admission Number: ${result.student.admissionNumber}`, 20, 80)
    doc.text(`Class: ${result.classSubject.class.name}`, 20, 90)
    doc.text(`Subject: ${result.classSubject.subject.name}`, 20, 100)
    doc.text(`Exam: ${result.exam?.name || "N/A"} (${result.exam?.examType || "N/A"})`, 20, 110)
    doc.text(`Term: ${result.term.name} ${result.academicYear.year}`, 20, 120)
    doc.text(`Marks: ${result.marksObtained}/${result.maxMarks}`, 20, 130)
    if (result.grade) {
      doc.text(`Grade: ${result.grade}`, 20, 140)
    }

    // Add signatures at the bottom
    const pageHeight = doc.internal.pageSize.height
    const yPos = pageHeight - 50

    if (principalSig.length > 0 && principalSig[0].signatureImage) {
      try {
        // Extract base64 data (remove data:image/...;base64, prefix if present)
        const base64Data = principalSig[0].signatureImage.replace(/^data:image\/\w+;base64,/, "")
        doc.addImage(base64Data, "PNG", 20, yPos, 40, 20)
        doc.text("Principal", 30, yPos + 25)
      } catch (e) {
        console.error("Error adding principal signature:", e)
      }
    }

    if (classTeacherSig.length > 0 && classTeacherSig[0].signatureImage) {
      try {
        // Extract base64 data
        const base64Data = classTeacherSig[0].signatureImage.replace(/^data:image\/\w+;base64,/, "")
        doc.addImage(base64Data, "PNG", 150, yPos, 40, 20)
        doc.text("Class Teacher", 155, yPos + 25)
      } catch (e) {
        console.error("Error adding class teacher signature:", e)
      }
    }
    
    doc.save(`result-${result.student.admissionNumber}-${result.id}.pdf`)
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
      <div>
        <h1 className="text-3xl font-bold">Enter Results</h1>
        <p className="text-muted-foreground">
          Enter results for students taking subjects you teach. Results will be sent to class teacher for review.
        </p>
      </div>

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single">Single Entry</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-6">
          <div className="flex items-center justify-end">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {session?.user.role === "TEACHER" ? "Submit Result" : "Add Result"}
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Result</DialogTitle>
              <DialogDescription>
                Record a new result for a student
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="classSubjectId">Class & Subject *</Label>
                  {classSubjects.length > 0 ? (
                    <Select 
                      name="classSubjectId" 
                      value={selectedClassSubjectId}
                      onValueChange={(value) => {
                        setSelectedClassSubjectId(value)
                        // Reset student selection when class changes
                        setFilteredStudents([])
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class and subject first" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSubjects.map((cs) => (
                          <SelectItem key={cs.id} value={cs.id}>
                            {cs.class.name}{cs.section ? ` ${cs.section.name}` : ""} - {cs.subject.name} ({cs.subject.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground p-2 border rounded">
                      No class-subjects available. Please create class-subject combinations first in the Class Subjects page.
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="studentId">Student *</Label>
                  {!selectedClassSubjectId ? (
                    <div className="text-sm text-muted-foreground p-2 border rounded">
                      Please select a class and subject first to see enrolled students.
                    </div>
                  ) : loadingStudents ? (
                    <div className="text-sm text-muted-foreground p-2 border rounded">
                      Loading students...
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2 border rounded">
                      No students enrolled in this class for the current academic year.
                    </div>
                  ) : (
                    <Select name="studentId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStudents.map((student) => (
                          <SelectItem key={student.id} value={student.id}>
                            {student.user?.name} ({student.admissionNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="termId">Term</Label>
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
                    <Label htmlFor="examId">Exam</Label>
                    {exams.length > 0 ? (
                      <Select
                        name="examId"
                        value={selectedExamId}
                        onValueChange={setSelectedExamId}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select exam" />
                        </SelectTrigger>
                        <SelectContent>
                          {exams.map((exam) => (
                            <SelectItem key={exam.id} value={exam.id}>
                              {exam.name} ({exam.examType}) {exam.isFinal && "- Final"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm text-muted-foreground p-2 border rounded">
                        No active exams available. Please create an exam first.
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="marksObtained">Marks Obtained</Label>
                    <Input 
                      id="marksObtained" 
                      name="marksObtained" 
                      type="number" 
                      step="0.01" 
                      value={marksObtained}
                      onChange={(e) => setMarksObtained(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxMarks">Max Marks</Label>
                    <Input 
                      id="maxMarks" 
                      name="maxMarks" 
                      type="number" 
                      step="0.01" 
                      value={maxMarks}
                      onChange={(e) => setMaxMarks(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade</Label>
                    <Input 
                      id="grade" 
                      name="grade" 
                      value={calculatedGrade}
                      readOnly
                      className="bg-muted"
                      placeholder="Auto-calculated"
                    />
                  </div>
                </div>
                {session?.user.role !== "TEACHER" && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="published"
                      name="published"
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="published">Publish result</Label>
                  </div>
                )}
                {session?.user.role === "TEACHER" && (
                  <div className="text-sm text-muted-foreground p-2 bg-blue-50 rounded">
                    Results will be automatically sent to the class teacher for review and submission to principal.
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button type="submit">
                  {session?.user.role === "TEACHER" ? "Submit Result" : "Add Result"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
        </TabsContent>

        <TabsContent value="bulk">
          <BulkResultsUpload />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>
            {session?.user.role === "TEACHER" ? "My Subject Results" : "All Results"}
          </CardTitle>
          <CardDescription>
            {session?.user.role === "TEACHER" 
              ? "Results you can view and edit (until principal approves). Once approved, results cannot be modified."
              : `${paginationInfo.total} result(s) found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Exam Type</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Approval Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {session?.user.role === "TEACHER" 
                        ? "No results found. Create a new result to get started."
                        : "No results found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  results.map((result) => (
                    <TableRow key={result.id}>
                    <TableCell>{result.student.user.name}</TableCell>
                    <TableCell>{result.classSubject.subject.name}</TableCell>
                    <TableCell>
                      {result.classSubject.teacher?.user.name || "Not assigned"}
                    </TableCell>
                    <TableCell>{result.term.name}</TableCell>
                    <TableCell>
                      {result.exam?.name || "N/A"} ({result.exam?.examType || "N/A"})
                    </TableCell>
                    <TableCell>
                      {result.marksObtained}/{result.maxMarks}
                    </TableCell>
                    <TableCell>{result.grade || "-"}</TableCell>
                    <TableCell>
                      {getStatusBadge(result.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {canEditResult(result) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(result)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateReport(result)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Report
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          {!loading && paginationInfo.total > 0 && (
            <Pagination
              pagination={paginationInfo}
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Result Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Result</DialogTitle>
            <DialogDescription>
              {editingResult && (
                <>
                  Update marks for {editingResult.student.user.name} - {editingResult.classSubject.subject.name}
                  <div className="mt-2 text-xs text-muted-foreground">
                    Current Status: {editingResult.status.replace(/_/g, " ")}
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              {editingResult && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Student</Label>
                      <p className="font-medium">{editingResult.student.user.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Subject</Label>
                      <p className="font-medium">{editingResult.classSubject.subject.name}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Term</Label>
                      <p className="font-medium">{editingResult.term.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Exam</Label>
                      <p className="font-medium">{editingResult.exam?.name || "N/A"}</p>
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editMarksObtained">Marks Obtained</Label>
                  <Input
                    id="editMarksObtained"
                    type="number"
                    step="0.01"
                    value={editMarksObtained}
                    onChange={(e) => setEditMarksObtained(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editMaxMarks">Max Marks</Label>
                  <Input
                    id="editMaxMarks"
                    type="number"
                    step="0.01"
                    value={editMaxMarks}
                    onChange={(e) => setEditMaxMarks(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editGrade">Grade</Label>
                  <Input
                    id="editGrade"
                    value={editGrade}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRemarks">Remarks (Optional)</Label>
                <Input
                  id="editRemarks"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Add remarks about the edit..."
                />
              </div>
              {session?.user.role === "TEACHER" && editingResult?.status !== "DRAFT" && (
                <div className="text-sm text-amber-600 p-2 bg-amber-50 rounded">
                  Note: Editing this result will reset it to pending review status.
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

