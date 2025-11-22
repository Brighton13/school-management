"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Send, Download, CheckCircle, Clock } from "lucide-react"
import jsPDF from "jspdf"

interface Section {
  id: string
  name: string
  class: { name: string }
}

interface StudentData {
  student: {
    id: string
    user: { name: string; email: string }
    admissionNumber: string
  }
  enrollment?: {
    section?: { name: string }
    class?: { name: string }
  } | null
  results: Array<{
    id: string
    marksObtained: number
    maxMarks: number
    grade: string | null
    status: string
    classSubject: {
      subject: { name: string; code: string }
      teacher: { user: { name: string } } | null
    }
    exam: { name: string } | null
  }>
}

interface Term {
  id: string
  name: string
  academicYear: string
}

interface Exam {
  id: string
  name: string
  examType: string
}

export default function ClassResultsPage() {
  const [sections, setSections] = useState<Section[]>([])
  const [students, setStudents] = useState<StudentData[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string>("")
  const [selectedTermId, setSelectedTermId] = useState<string>("all")
  const [selectedExamId, setSelectedExamId] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInitialData()
    fetchSections()
  }, [])

  useEffect(() => {
    if (selectedSectionId) {
      fetchClassResults()
    }
  }, [selectedSectionId, selectedTermId, selectedExamId])

  const fetchSections = async () => {
    try {
      const res = await fetch("/api/results/class-results")
      if (res.ok) {
        const data = await res.json()
        setSections(data.sections || [])
      }
    } catch (error) {
      console.error("Failed to fetch sections:", error)
    }
  }

  const fetchInitialData = async () => {
    try {
      const [termsRes, examsRes] = await Promise.all([
        fetch("/api/terms"),
        fetch("/api/exams?status=ACTIVE"),
      ])
      if (termsRes.ok) {
        setTerms(await termsRes.json())
      }
      if (examsRes.ok) {
        setExams(await examsRes.json())
      } else {
        console.error("Failed to fetch exams:", await examsRes.text())
        setExams([])
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
      setTerms([])
      setExams([])
    } finally {
      setLoading(false)
    }
  }

  const fetchClassResults = async () => {
    if (!selectedSectionId) {
      return
    }
    
    try {
      const params = new URLSearchParams({
        sectionId: selectedSectionId,
        ...(selectedTermId && selectedTermId !== "all" ? { academicTermId: selectedTermId } : {}),
        ...(selectedExamId && selectedExamId !== "all" ? { examId: selectedExamId } : {}),
      })

      const res = await fetch(`/api/results/class-results?${params}`)
      if (res.ok) {
        const data = await res.json()
        setStudents(data.students || [])
      } else {
        const error = await res.json()
        console.error("Failed to fetch class results:", error)
        setStudents([])
      }
    } catch (error) {
      console.error("Failed to fetch class results:", error)
      setStudents([])
    }
  }

  const handleSubmitClass = async () => {
    if (!selectedSectionId) {
      alert("Please select a section")
      return
    }

    if (!confirm("Are you sure you want to submit all class results for approval?")) {
      return
    }

    try {
      const res = await fetch("/api/results/submit-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          academicTermId: selectedTermId !== "all" ? selectedTermId : undefined,
          examId: selectedExamId !== "all" ? selectedExamId : undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        alert(data.message)
        fetchClassResults()
      } else {
        alert(data.error || "Failed to submit class results")
      }
    } catch (error) {
      console.error("Failed to submit class results:", error)
      alert("Failed to submit class results")
    }
  }

  const handleGenerateReport = async (studentId: string) => {
    try {
      const res = await fetch("/api/results/generate-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          sectionId: selectedSectionId,
          academicTermId: selectedTermId !== "all" ? selectedTermId : undefined,
          examId: selectedExamId !== "all" ? selectedExamId : undefined,
          sendToStudent: false,
        }),
      })

      const data = await res.json()
      if (res.ok && data.report) {
        generatePDFReport(data.report)
      } else {
        alert(data.error || "Failed to generate report")
      }
    } catch (error) {
      console.error("Failed to generate report:", error)
      alert("Failed to generate report")
    }
  }

  const handleSendReport = async (studentId: string) => {
    if (!confirm("Send report to student?")) {
      return
    }

    try {
      const res = await fetch("/api/results/generate-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          sectionId: selectedSectionId,
          academicTermId: selectedTermId !== "all" ? selectedTermId : undefined,
          examId: selectedExamId !== "all" ? selectedExamId : undefined,
          sendToStudent: true,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        alert("Report sent to student successfully")
      } else {
        alert(data.error || "Failed to send report")
      }
    } catch (error) {
      console.error("Failed to send report:", error)
      alert("Failed to send report")
    }
  }

  const generatePDFReport = async (reportData: any) => {
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
    doc.text("Student Result Report", 105, 20, { align: "center" })

    doc.setFontSize(12)
    let yPos = 40
    doc.text(`Student: ${reportData.student.user.name}`, 20, yPos)
    yPos += 10
    doc.text(`Admission Number: ${reportData.student.admissionNumber}`, 20, yPos)
    yPos += 10
    doc.text(`Class: ${reportData.enrollment?.class?.name || "N/A"} - ${reportData.enrollment?.section?.name || "N/A"}`, 20, yPos)
    yPos += 10
    doc.text(`Academic Term: ${reportData.results[0]?.academicTerm.name || "N/A"}`, 20, yPos)
    yPos += 15

    // Results table
    doc.setFontSize(14)
    doc.text("Results", 20, yPos)
    yPos += 10

    doc.setFontSize(10)
    doc.text("Subject", 20, yPos)
    doc.text("Teacher", 70, yPos)
    doc.text("Exam", 120, yPos)
    doc.text("Marks", 160, yPos)
    doc.text("Grade", 180, yPos)
    yPos += 8

    reportData.results.forEach((result: any) => {
      doc.text(result.classSubject.subject.name, 20, yPos)
      doc.text(result.classSubject.teacher?.user.name || "N/A", 70, yPos)
      doc.text(result.exam?.name || "N/A", 120, yPos)
      doc.text(`${result.marksObtained}/${result.maxMarks}`, 160, yPos)
      doc.text(result.grade || "-", 180, yPos)
      yPos += 8
    })

    // Add signatures
    const pageHeight = doc.internal.pageSize.height
    const sigYPos = pageHeight - 50

    if (principalSig.length > 0 && principalSig[0].signatureImage) {
      try {
        // Extract base64 data (remove data:image/...;base64, prefix if present)
        const base64Data = principalSig[0].signatureImage.replace(/^data:image\/\w+;base64,/, "")
        doc.addImage(base64Data, "PNG", 20, sigYPos, 40, 20)
        doc.text("Principal", 30, sigYPos + 25)
      } catch (e) {
        console.error("Error adding principal signature:", e)
      }
    }

    if (classTeacherSig.length > 0 && classTeacherSig[0].signatureImage) {
      try {
        // Extract base64 data
        const base64Data = classTeacherSig[0].signatureImage.replace(/^data:image\/\w+;base64,/, "")
        doc.addImage(base64Data, "PNG", 150, sigYPos, 40, 20)
        doc.text("Class Teacher", 155, sigYPos + 25)
      } catch (e) {
        console.error("Error adding class teacher signature:", e)
      }
    }

    doc.save(`result-${reportData.student.admissionNumber}.pdf`)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      PENDING_CLASS_TEACHER: { color: "bg-orange-100 text-orange-800", label: "Pending Review" },
      PENDING_APPROVAL: { color: "bg-yellow-100 text-yellow-800", label: "Pending Approval" },
      APPROVED: { color: "bg-blue-100 text-blue-800", label: "Approved" },
      PUBLISHED: { color: "bg-green-100 text-green-800", label: "Published" },
    }

    const config = statusConfig[status] || { color: "bg-gray-100 text-gray-800", label: status }
    return (
      <span className={`px-2 py-1 rounded-full text-xs ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const pendingCount = students.reduce((count, student) => {
    return count + student.results.filter(r => r.status === "PENDING_CLASS_TEACHER").length
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Class Results Management</h1>
          <p className="text-muted-foreground">
            Review and submit class results for approval
          </p>
        </div>
        {pendingCount > 0 && (
          <Button onClick={handleSubmitClass} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="mr-2 h-4 w-4" />
            Submit All Pending Results ({pendingCount})
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.length > 0 ? (
                    sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.class.name} - {section.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No sections assigned</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Academic Term</Label>
              <Select value={selectedTermId} onValueChange={setSelectedTermId}>
                <SelectTrigger>
                  <SelectValue placeholder="All terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name} - {term.academicYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Exam</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger>
                  <SelectValue placeholder="All exams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exams</SelectItem>
                  {exams.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} ({exam.examType})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedSectionId && (
        <Card>
          <CardHeader>
            <CardTitle>Class Results</CardTitle>
            <CardDescription>
              {students.length} student(s) with results
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No results found for this class
              </div>
            ) : (
              <div className="space-y-6">
                {students.map((studentData) => (
                  <Card key={studentData.student.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{studentData.student.user.name}</CardTitle>
                          <CardDescription>
                            {studentData.student.admissionNumber}
                            {studentData.enrollment && (
                              <> - {studentData.enrollment.class?.name || "N/A"} {studentData.enrollment.section?.name || "N/A"}</>
                            )}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateReport(studentData.student.id)}
                            disabled={studentData.results.some(r => r.status !== "APPROVED" && r.status !== "PUBLISHED")}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Generate Report
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendReport(studentData.student.id)}
                            disabled={studentData.results.some(r => r.status !== "APPROVED" && r.status !== "PUBLISHED")}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send to Student
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead>Teacher</TableHead>
                            <TableHead>Exam</TableHead>
                            <TableHead>Marks</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentData.results.map((result) => (
                            <TableRow key={result.id}>
                              <TableCell>
                                {result.classSubject.subject.name} ({result.classSubject.subject.code})
                              </TableCell>
                              <TableCell>
                                {result.classSubject.teacher?.user.name || "Not assigned"}
                              </TableCell>
                              <TableCell>
                                {result.exam?.name || "N/A"}
                              </TableCell>
                              <TableCell>
                                {result.marksObtained}/{result.maxMarks}
                              </TableCell>
                              <TableCell>{result.grade || "-"}</TableCell>
                              <TableCell>
                                {getStatusBadge(result.status)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
