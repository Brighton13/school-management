"use client"

import { useEffect, useState } from "react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Send, Download, CheckCircle, Clock } from "lucide-react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

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
  academicYear: {
    id: string
    year: string
  }
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
  const [permissionDenied, setPermissionDenied] = useState(false)

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
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
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
        fetch("/api/exams"),
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
        ...(selectedTermId && selectedTermId !== "all" ? { termId: selectedTermId } : {}),
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
          termId: selectedTermId !== "all" ? selectedTermId : undefined,
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
          termId: selectedTermId !== "all" ? selectedTermId : undefined,
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
          termId: selectedTermId !== "all" ? selectedTermId : undefined,
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
    // Fetch school config, signatures, remark templates, and points config
    let schoolConfig: any = null
    let principalSig: any = null
    let classTeacherSig: any = null
    let pointsConfig: any[] = []
    
    // Default points configuration
    const defaultPointsConfig = [
      { minPercentage: 75, maxPercentage: 100, points: 1 },
      { minPercentage: 65, maxPercentage: 74.99, points: 2 },
      { minPercentage: 50, maxPercentage: 64.99, points: 3 },
      { minPercentage: 40, maxPercentage: 49.99, points: 4 },
      { minPercentage: 30, maxPercentage: 39.99, points: 5 },
      { minPercentage: 1, maxPercentage: 29.99, points: 6 },
      { minPercentage: 0, maxPercentage: 0.99, points: 7 },
    ]
    
    try {
      const [schoolConfigRes, signaturesRes, pointsConfigRes] = await Promise.all([
        fetch("/api/settings/school-config"),
        fetch("/api/signatures"),
        fetch("/api/settings/points-config"),
      ])
      if (schoolConfigRes.ok) {
        schoolConfig = await schoolConfigRes.json()
      }
      if (signaturesRes.ok) {
        const signatures = await signaturesRes.json()
        principalSig = signatures.find((s: any) => s.signatureType === "PRINCIPAL")
        classTeacherSig = signatures.find((s: any) => s.signatureType === "CLASS_TEACHER")
      }
      if (pointsConfigRes.ok) {
        const dbPointsConfig = await pointsConfigRes.json()
        pointsConfig = dbPointsConfig.length > 0 ? dbPointsConfig : defaultPointsConfig
      } else {
        pointsConfig = defaultPointsConfig
      }
    } catch (error) {
      console.error("Error fetching config/signatures:", error)
      pointsConfig = defaultPointsConfig
    }
    
    // Helper function to get points based on percentage
    const getPoints = (percentage: number): number | undefined => {
      const rounded = Math.round(percentage)
      const config = pointsConfig.find(
        (pc: any) => rounded >= pc.minPercentage && rounded <= pc.maxPercentage
      )
      return config?.points
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    let yPos = 15

    // Helper function to get remark based on percentage
    const getRemark = (percentage: number): string => {
      if (percentage >= 90) return "Excellent"
      if (percentage >= 80) return "Very Good"
      if (percentage >= 70) return "Good"
      if (percentage >= 60) return "Satisfactory"
      if (percentage >= 50) return "Fair"
      if (percentage >= 40) return "Pass"
      return "Needs Improvement"
    }

    // Ministry Header
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(schoolConfig?.ministryHeader || "MINISTRY OF EDUCATION", pageWidth / 2, yPos, { align: "center" })
    yPos += 8

    // School name with crest
    doc.setFontSize(16)
    doc.text(schoolConfig?.schoolName || "SCHOOL NAME", pageWidth / 2, yPos, { align: "center" })
    yPos += 6

    // School motto
    if (schoolConfig?.schoolMotto) {
      doc.setFontSize(10)
      doc.setFont("helvetica", "italic")
      doc.text(`"${schoolConfig.schoolMotto}"`, pageWidth / 2, yPos, { align: "center" })
      yPos += 5
    }

    // Address and contact
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    if (schoolConfig?.schoolAddress) {
      doc.text(schoolConfig.schoolAddress, pageWidth / 2, yPos, { align: "center" })
      yPos += 4
    }
    if (schoolConfig?.schoolPhone || schoolConfig?.schoolEmail) {
      const contact = [
        schoolConfig?.schoolPhone ? `Tel: ${schoolConfig.schoolPhone}` : "",
        schoolConfig?.schoolEmail ? `Email: ${schoolConfig.schoolEmail}` : ""
      ].filter(Boolean).join(" | ")
      doc.text(contact, pageWidth / 2, yPos, { align: "center" })
      yPos += 4
    }

    // Line separator
    doc.setLineWidth(0.5)
    doc.line(15, yPos, pageWidth - 15, yPos)
    yPos += 6

    // Report Title
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    const termName = reportData.results[0]?.term?.name || "Term"
    const academicYear = reportData.results[0]?.term?.academicYear?.name || reportData.results[0]?.academicYear?.name || new Date().getFullYear()
    doc.text(`REPORT FORM - ${termName.toUpperCase()} ${academicYear}`, pageWidth / 2, yPos, { align: "center" })
    yPos += 8

    // Student Information Box
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    const studentName = reportData.student.user.name.toUpperCase()
    // Get class and section from enrollment (section has class relation)
    const sectionName = reportData.enrollment?.section?.name || "N/A"
    const classNameStr = reportData.enrollment?.section?.class?.name || "N/A"
    const className = `${classNameStr} - ${sectionName}`
    const admNo = reportData.student.admissionNumber || "N/A"
    
    // Calculate totals and position
    let totalMarks = 0
    let totalMax = 0
    reportData.results.forEach((r: any) => {
      totalMarks += r.marksObtained
      totalMax += r.maxMarks
    })
    const percentage = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
    
    // Get position and class size from API response
    const position = reportData.position || "-"
    const classSize = reportData.classSize || "-"

    // Student info grid
    doc.setFont("helvetica", "bold")
    doc.text("Student Name:", 20, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(studentName, 55, yPos)
    
    doc.setFont("helvetica", "bold")
    doc.text("Grade/Class:", pageWidth / 2 + 10, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(className, pageWidth / 2 + 45, yPos)
    yPos += 6

    doc.setFont("helvetica", "bold")
    doc.text("Admission No:", 20, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(admNo, 55, yPos)

    doc.setFont("helvetica", "bold")
    doc.text("No. of Pupils:", pageWidth / 2 + 10, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(String(classSize), pageWidth / 2 + 45, yPos)
    yPos += 6

    doc.setFont("helvetica", "bold")
    doc.text("Total Marks:", 20, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(`${totalMarks} / ${totalMax}`, 55, yPos)

    doc.setFont("helvetica", "bold")
    doc.text("Position:", pageWidth / 2 + 10, yPos)
    doc.setFont("helvetica", "normal")
    doc.text(`${position} out of ${classSize}`, pageWidth / 2 + 45, yPos)
    yPos += 10

    // Calculate total points
    let totalPoints = 0
    
    // Results table using autoTable - now with POINTS column
    const tableData = reportData.results.map((result: any) => {
      const pct = result.maxMarks > 0 ? Math.round((result.marksObtained / result.maxMarks) * 100) : 0
      const pts = getPoints(pct)
      if (pts !== undefined) totalPoints += pts
      return [
        result.classSubject.subject.name,
        `${result.marksObtained}/${result.maxMarks}`,
        `${pct}%`,
        pts !== undefined ? String(pts) : "-",
        getRemark(pct)
      ]
    })

    // Add total row with total points
    const totalPct = totalMax > 0 ? Math.round((totalMarks / totalMax) * 100) : 0
    tableData.push([
      "TOTAL",
      `${totalMarks}/${totalMax}`,
      `${percentage}%`,
      String(totalPoints),
      getRemark(percentage)
    ])

    autoTable(doc, {
      startY: yPos,
      head: [["SUBJECT", "SCORE", "%", "PTS", "REMARK"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [220, 220, 220],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center"
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 55 },
        1: { halign: "center", cellWidth: 30 },
        2: { halign: "center", cellWidth: 20 },
        3: { halign: "center", cellWidth: 20 },
        4: { halign: "center", cellWidth: 45 }
      },
      margin: { left: 20, right: 20 }
    })

    // Get final Y position after table
    yPos = (doc as any).lastAutoTable.finalY + 10

    // Performance summary boxes
    doc.setFillColor(240, 248, 255)
    doc.rect(20, yPos, 40, 20, "F")
    doc.rect(70, yPos, 40, 20, "F")
    doc.rect(120, yPos, 40, 20, "F")

    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(0, 100, 200)
    doc.text(`${percentage}%`, 40, yPos + 13, { align: "center" })
    
    // Grade
    let grade = "F"
    if (percentage >= 90) grade = "A+"
    else if (percentage >= 80) grade = "A"
    else if (percentage >= 70) grade = "B+"
    else if (percentage >= 60) grade = "B"
    else if (percentage >= 50) grade = "C+"
    else if (percentage >= 40) grade = "C"
    
    doc.setTextColor(0, 150, 0)
    doc.text(grade, 90, yPos + 13, { align: "center" })
    
    doc.setTextColor(128, 0, 128)
    doc.text(`${position || "-"}`, 140, yPos + 13, { align: "center" })

    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.setFont("helvetica", "normal")
    doc.text("Average", 40, yPos + 18, { align: "center" })
    doc.text("Grade", 90, yPos + 18, { align: "center" })
    doc.text("Position", 140, yPos + 18, { align: "center" })
    
    doc.setTextColor(0, 0, 0)
    yPos += 28

    // Class Teacher Comments Box
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.5)
    doc.rect(20, yPos, pageWidth - 40, 25)
    doc.setFillColor(220, 220, 220)
    doc.rect(20, yPos, pageWidth - 40, 8, "F")
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text("CLASS TEACHER'S COMMENTS:", 25, yPos + 6)
    
    // Auto comment based on percentage
    const teacherComment = percentage >= 80 ? "Excellent work! Keep it up!" :
      percentage >= 60 ? "Good performance. Continue to work hard." :
      percentage >= 50 ? "Fair performance. More effort needed." :
      "Needs improvement. Please seek help from teachers."
    
    doc.setFont("helvetica", "italic")
    doc.setFontSize(9)
    doc.text(teacherComment, 25, yPos + 16)
    yPos += 30

    // Head Teacher Comments Box
    doc.rect(20, yPos, pageWidth - 40, 25)
    doc.setFillColor(220, 220, 220)
    doc.rect(20, yPos, pageWidth - 40, 8, "F")
    doc.setFont("helvetica", "bold")
    doc.text("HEAD TEACHER'S COMMENTS:", 25, yPos + 6)
    
    const principalComment = percentage >= 80 ? "Outstanding achievement. The school is proud of you!" :
      percentage >= 60 ? "Good progress. Maintain your effort." :
      percentage >= 50 ? "Satisfactory. More dedication required." :
      "Below expectations. Parent consultation recommended."
    
    doc.setFont("helvetica", "italic")
    doc.text(principalComment, 25, yPos + 16)
    yPos += 35

    // Signatures section
    const sigY = Math.min(yPos, pageHeight - 45)
    
    // Class Teacher Signature
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    if (classTeacherSig?.signatureImage) {
      try {
        doc.addImage(classTeacherSig.signatureImage, "PNG", 30, sigY, 35, 15)
      } catch (e) {
        doc.line(25, sigY + 12, 70, sigY + 12)
      }
    } else {
      doc.line(25, sigY + 12, 70, sigY + 12)
    }
    doc.text("Class Teacher", 35, sigY + 20)
    doc.setFontSize(8)
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 30, sigY + 25)

    // Principal Signature
    if (principalSig?.signatureImage || schoolConfig?.principalSignature) {
      try {
        const sigImg = principalSig?.signatureImage || schoolConfig?.principalSignature
        doc.addImage(sigImg, "PNG", pageWidth - 70, sigY, 35, 15)
      } catch (e) {
        doc.line(pageWidth - 75, sigY + 12, pageWidth - 30, sigY + 12)
      }
    } else {
      doc.line(pageWidth - 75, sigY + 12, pageWidth - 30, sigY + 12)
    }
    doc.setFontSize(9)
    doc.text("Head Teacher", pageWidth - 60, sigY + 20)
    doc.setFontSize(8)
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 65, sigY + 25)

    // Footer
    doc.setFontSize(7)
    doc.setTextColor(128, 128, 128)
    doc.text("This is a computer-generated report.", pageWidth / 2, pageHeight - 10, { align: "center" })

    doc.save(`report-${reportData.student.admissionNumber || "student"}.pdf`)
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
                      {term.name} - {term.academicYear.year}
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
