"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Download, CheckCircle, XCircle, Clock, Upload } from "lucide-react"
import jsPDF from "jspdf"
import { useSession } from "next-auth/react"
import { BulkResultsUpload } from "@/components/bulk-results-upload"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StudentResultsView } from "@/components/analytics/student-results-view"

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
  academicTerm: {
    name: string
    academicYear: string
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
  academicYear: string
}

interface ClassSubject {
  id: string
  class: { name: string }
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
  const { data: session } = useSession()
  
  // If user is a student, show the student-specific results view
  if (session?.user.role === "STUDENT") {
    return <StudentResultsView />
  }

  const [results, setResults] = useState<Result[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClassSubjectId, setSelectedClassSubjectId] = useState<string>("")
  const [selectedExamId, setSelectedExamId] = useState<string>("")

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [resultsRes, studentsRes, termsRes, classSubjectsRes, examsRes] = await Promise.all([
        fetch("/api/results"),
        fetch("/api/students"),
        fetch("/api/terms"),
        fetch("/api/class-subjects"),
        fetch("/api/exams?status=ACTIVE"),
      ])
      if (resultsRes.ok) setResults(await resultsRes.json())
      if (studentsRes.ok) setStudents(await studentsRes.json())
      if (termsRes.ok) setTerms(await termsRes.json())
      if (classSubjectsRes.ok) setClassSubjects(await classSubjectsRes.json())
      if (examsRes.ok) {
        setExams(await examsRes.json())
      } else {
        console.error("Failed to fetch exams:", await examsRes.text())
        setExams([])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      setResults([])
      setStudents([])
      setTerms([])
      setClassSubjects([])
      setExams([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: formData.get("studentId"),
          classSubjectId: formData.get("classSubjectId"),
          academicTermId: formData.get("academicTermId"),
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
    // Fetch signatures
    let principalSig: any[] = []
    let classTeacherSig: any[] = []
    
    try {
      const [principalSigRes, classTeacherSigRes] = await Promise.all([
        fetch("/api/signatures?signatureType=PRINCIPAL"),
        fetch("/api/signatures?signatureType=CLASS_TEACHER"),
      ])
      if (principalSigRes.ok) {
        principalSig = await principalSigRes.json()
      }
      if (classTeacherSigRes.ok) {
        classTeacherSig = await classTeacherSigRes.json()
      }
    } catch (error) {
      console.error("Error fetching signatures:", error)
    }

    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.text("Result Report", 105, 20, { align: "center" })
    
    doc.setFontSize(12)
    doc.text(`Student: ${result.student.user.name}`, 20, 40)
    doc.text(`Admission Number: ${result.student.admissionNumber}`, 20, 50)
    doc.text(`Class: ${result.classSubject.class.name}`, 20, 60)
    doc.text(`Subject: ${result.classSubject.subject.name}`, 20, 70)
    doc.text(`Exam: ${result.exam?.name || "N/A"} (${result.exam?.examType || "N/A"})`, 20, 80)
    doc.text(`Term: ${result.academicTerm.name} ${result.academicTerm.academicYear}`, 20, 90)
    doc.text(`Marks: ${result.marksObtained}/${result.maxMarks}`, 20, 100)
    if (result.grade) {
      doc.text(`Grade: ${result.grade}`, 20, 110)
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
                  <Label htmlFor="classSubjectId">Class & Subject</Label>
                  {classSubjects.length > 0 ? (
                    <Select 
                      name="classSubjectId" 
                      value={selectedClassSubjectId}
                      onValueChange={setSelectedClassSubjectId}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class and subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {classSubjects.map((cs) => (
                          <SelectItem key={cs.id} value={cs.id}>
                            {cs.class.name} - {cs.subject.name} ({cs.subject.code})
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="academicTermId">Academic Term</Label>
                    <Select name="academicTermId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        {terms.map((term) => (
                          <SelectItem key={term.id} value={term.id}>
                            {term.name} - {term.academicYear}
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
                    <Input id="marksObtained" name="marksObtained" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxMarks">Max Marks</Label>
                    <Input id="maxMarks" name="maxMarks" type="number" step="0.01" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">Grade</Label>
                    <Input id="grade" name="grade" />
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
            {session?.user.role === "TEACHER" ? "Draft Results" : "All Results"}
          </CardTitle>
          <CardDescription>
            {session?.user.role === "TEACHER" 
              ? "Only draft results are shown here. Submitted results can be viewed on the Class Results page."
              : `${results.length} result(s) found`}
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
                        ? "No draft results. Create a new result to get started."
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
                    <TableCell>{result.academicTerm.name}</TableCell>
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateReport(result)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Report
                      </Button>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

