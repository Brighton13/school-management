"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Users,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface EligibleStudent {
  studentId: string
  studentName: string
  admissionNumber: string
  sectionId: string
  sectionName: string
  examId: string
  examName: string
  termName: string
  academicYear: string
  subjectsCount: number
  totalMarks: number
  maxMarks: number
  canGenerate: boolean
}

interface Exam {
  id: string
  name: string
  examType: string
  term: {
    id: string
    name: string
    academicYear: {
      id: string
      year: string
    }
  }
}

interface Section {
  id: string
  name: string
  class: {
    id: string
    name: string
  }
}

interface GeneratedReport {
  studentId: string
  studentName: string
  pdf: string
}

export default function GenerateReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // State
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [exams, setExams] = useState<Exam[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([])
  const [selectedExam, setSelectedExam] = useState<string>("")
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([])
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewPdf, setPreviewPdf] = useState<string | null>(null)
  const [previewStudentName, setPreviewStudentName] = useState<string>("")
  const [generationProgress, setGenerationProgress] = useState(0)

  // Check authorization
  useEffect(() => {
    if (status === "loading") return
    if (!session || !["TEACHER", "ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      router.push("/login")
    }
  }, [session, status, router])

  // Fetch exams and sections
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [examsRes, sectionsRes] = await Promise.all([
          fetch("/api/exams?hasApprovedResults=true"),
          fetch("/api/sections?classTeacher=true"),
        ])

        if (examsRes.ok) {
          const examsData = await examsRes.json()
          setExams(examsData.exams || examsData || [])
        }

        if (sectionsRes.ok) {
          const sectionsData = await sectionsRes.json()
          setSections(sectionsData.sections || sectionsData || [])
        }
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    if (session) {
      fetchData()
    }
  }, [session])

  // Fetch eligible students when exam or section changes
  useEffect(() => {
    const fetchEligibleStudents = async () => {
      if (!selectedExam) {
        setEligibleStudents([])
        return
      }

      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({ examId: selectedExam })
        if (selectedSection) params.append("sectionId", selectedSection)

        const res = await fetch(`/api/reports/class-teacher-generate?${params}`)
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || "Failed to fetch eligible students")
        }

        const data = await res.json()
        setEligibleStudents(data)
        setSelectedStudents(new Set())
      } catch (err: any) {
        console.error("Error fetching eligible students:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchEligibleStudents()
  }, [selectedExam, selectedSection])

  const handleSelectAll = () => {
    if (selectedStudents.size === eligibleStudents.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(eligibleStudents.map(s => s.studentId)))
    }
  }

  const handleSelectStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents)
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId)
    } else {
      newSelected.add(studentId)
    }
    setSelectedStudents(newSelected)
  }

  const generateReports = async (studentIds?: string[]) => {
    try {
      setGenerating(true)
      setError(null)
      setSuccessMessage(null)
      setGenerationProgress(0)

      const targetIds = studentIds || Array.from(selectedStudents)
      if (targetIds.length === 0) {
        setError("No students selected")
        return
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const res = await fetch("/api/reports/class-teacher-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedExam,
          sectionId: selectedSection,
          studentIds: targetIds,
          returnPdf: true,
        }),
      })

      clearInterval(progressInterval)
      setGenerationProgress(100)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate reports")
      }

      const data = await res.json()
      setGeneratedReports(data.reports || [])
      setSuccessMessage(data.message)

      if (data.errors && data.errors.length > 0) {
        setError(`${data.errors.length} student(s) failed: ${data.errors.map((e: any) => e.error).join(", ")}`)
      }
    } catch (err: any) {
      console.error("Error generating reports:", err)
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const previewReport = (report: GeneratedReport) => {
    setPreviewPdf(report.pdf)
    setPreviewStudentName(report.studentName)
    setShowPreviewDialog(true)
  }

  const downloadReport = (report: GeneratedReport) => {
    const link = document.createElement("a")
    link.href = report.pdf
    link.download = `Report_${report.studentName.replace(/\s+/g, "_")}.pdf`
    link.click()
  }

  const downloadAllReports = () => {
    generatedReports.forEach((report, index) => {
      setTimeout(() => {
        downloadReport(report)
      }, index * 500) // Stagger downloads to prevent browser issues
    })
  }

  const printReport = (pdfData: string) => {
    const iframe = document.createElement("iframe")
    iframe.style.display = "none"
    document.body.appendChild(iframe)
    iframe.src = pdfData
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => document.body.removeChild(iframe), 1000)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Generate Report Forms</h1>
          <p className="text-muted-foreground">
            Generate student report forms for approved exam results
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">Success</AlertTitle>
          <AlertDescription className="text-green-600">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Select Exam & Class</CardTitle>
          <CardDescription>
            Choose an exam and optionally filter by your assigned class section
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Exam</label>
              <Select value={selectedExam} onValueChange={setSelectedExam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an exam" />
                </SelectTrigger>
                <SelectContent>
                  {exams.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} - {exam.term?.name} ({exam.term?.academicYear?.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Section (Optional)</label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All sections</SelectItem>
                  {sections.map(section => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.class?.name} {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Eligible Students */}
      {selectedExam && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Students with Approved Results
                </CardTitle>
                <CardDescription>
                  {eligibleStudents.length} student(s) eligible for report generation
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => generateReports()}
                  disabled={generating || selectedStudents.size === 0}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Generate Selected ({selectedStudents.size})
                </Button>
                <Button
                  onClick={() => generateReports(eligibleStudents.map(s => s.studentId))}
                  disabled={generating || eligibleStudents.length === 0}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Generate All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {generating && (
              <div className="mb-4 space-y-2">
                <Progress value={generationProgress} />
                <p className="text-sm text-center text-muted-foreground">
                  Generating reports... {generationProgress}%
                </p>
              </div>
            )}

            {eligibleStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-20" />
                <p>No students with approved results found for this exam.</p>
                <p className="text-sm">Make sure results are approved by the principal before generating reports.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedStudents.size === eligibleStudents.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Class/Section</TableHead>
                    <TableHead>Subjects</TableHead>
                    <TableHead>Total Marks</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleStudents.map(student => (
                    <TableRow key={student.studentId}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.has(student.studentId)}
                          onCheckedChange={() => handleSelectStudent(student.studentId)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell>{student.admissionNumber}</TableCell>
                      <TableCell>{student.sectionName}</TableCell>
                      <TableCell>{student.subjectsCount}</TableCell>
                      <TableCell>
                        {student.totalMarks} / {student.maxMarks}
                        <span className="text-muted-foreground text-sm ml-1">
                          ({Math.round((student.totalMarks / student.maxMarks) * 100)}%)
                        </span>
                      </TableCell>
                      <TableCell>
                        {student.canGenerate ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Missing Subjects
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Generated Reports */}
      {generatedReports.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Generated Reports
                </CardTitle>
                <CardDescription>
                  {generatedReports.length} report(s) generated successfully
                </CardDescription>
              </div>
              <Button onClick={downloadAllReports}>
                <Download className="mr-2 h-4 w-4" />
                Download All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedReports.map(report => (
                  <TableRow key={report.studentId}>
                    <TableCell className="font-medium">{report.studentName}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => previewReport(report)}
                      >
                        <FileText className="mr-1 h-4 w-4" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadReport(report)}
                      >
                        <Download className="mr-1 h-4 w-4" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printReport(report.pdf)}
                      >
                        <Printer className="mr-1 h-4 w-4" />
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Report Preview - {previewStudentName}</DialogTitle>
            <DialogDescription>
              Preview the generated report form
            </DialogDescription>
          </DialogHeader>
          <div className="h-[70vh]">
            {previewPdf && (
              <iframe
                src={previewPdf}
                className="w-full h-full border rounded"
                title="Report Preview"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            {previewPdf && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    const report = generatedReports.find(r => r.studentName === previewStudentName)
                    if (report) downloadReport(report)
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button onClick={() => printReport(previewPdf)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
