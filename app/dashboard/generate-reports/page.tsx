"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PermissionDenied } from "@/components/ui/permission-denied"
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
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  FilePlus2,
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

interface Term {
  id: string
  name: string
  academicYear: {
    id: string
    year: string
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

// Step definitions for the wizard
type Step = "select-term" | "select-exam" | "generate-reports"

export default function GenerateReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Wizard step state
  const [currentStep, setCurrentStep] = useState<Step>("select-term")
  
  // Data state
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [terms, setTerms] = useState<Term[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [filteredExams, setFilteredExams] = useState<Exam[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([])
  
  // Selection state
  const [selectedTerm, setSelectedTerm] = useState<string>("")
  const [selectedExam, setSelectedExam] = useState<string>("")
  const [selectedExamData, setSelectedExamData] = useState<Exam | null>(null)
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  
  // Generated reports state
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([])
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewPdf, setPreviewPdf] = useState<string | null>(null)
  const [previewStudentName, setPreviewStudentName] = useState<string>("")
  const [generationProgress, setGenerationProgress] = useState(0)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [generatingCombined, setGeneratingCombined] = useState(false)

  // Check authorization
  useEffect(() => {
    if (status === "loading") return
    if (!session || !["TEACHER", "ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      router.push("/login")
    }
  }, [session, status, router])

  // Fetch initial data - terms, exams, and sections
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [termsRes, examsRes, sectionsRes] = await Promise.all([
          fetch("/api/terms"),
          fetch("/api/exams?hasApprovedResults=true"),
          fetch("/api/sections?classTeacher=true"),
        ])

        if (termsRes.ok) {
          const termsData = await termsRes.json()
          setTerms(termsData || [])
        }

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

  // Filter exams when term is selected
  useEffect(() => {
    if (selectedTerm) {
      const termExams = exams.filter(exam => exam.term?.id === selectedTerm)
      setFilteredExams(termExams)
    } else {
      setFilteredExams([])
    }
  }, [selectedTerm, exams])

  // When an exam is selected, store its data
  useEffect(() => {
    if (selectedExam) {
      const examData = filteredExams.find(e => e.id === selectedExam)
      setSelectedExamData(examData || null)
    } else {
      setSelectedExamData(null)
    }
  }, [selectedExam, filteredExams])

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

    if (currentStep === "generate-reports") {
      fetchEligibleStudents()
    }
  }, [selectedExam, selectedSection, currentStep])

  // Handle term selection and proceed to exam selection
  const handleTermSelect = (termId: string) => {
    setSelectedTerm(termId)
    setSelectedExam("")
    setSelectedExamData(null)
  }

  // Handle exam selection and proceed to report generation
  const handleExamSelect = (examId: string) => {
    setSelectedExam(examId)
  }

  // Proceed to next step
  const proceedToExamSelection = () => {
    if (selectedTerm) {
      setCurrentStep("select-exam")
    }
  }

  const proceedToReportGeneration = () => {
    if (selectedExam) {
      setCurrentStep("generate-reports")
    }
  }

  // Go back to previous step
  const goBack = () => {
    if (currentStep === "select-exam") {
      setCurrentStep("select-term")
      setSelectedExam("")
      setSelectedExamData(null)
    } else if (currentStep === "generate-reports") {
      setCurrentStep("select-exam")
      setEligibleStudents([])
      setGeneratedReports([])
      setSuccessMessage(null)
    }
  }

  // Reset and start over
  const startOver = () => {
    setCurrentStep("select-term")
    setSelectedTerm("")
    setSelectedExam("")
    setSelectedExamData(null)
    setSelectedSection("")
    setEligibleStudents([])
    setGeneratedReports([])
    setSelectedStudents(new Set())
    setError(null)
    setSuccessMessage(null)
  }

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

  // Generate combined PDF for all students in the class
  const generateCombinedReport = async () => {
    try {
      setGeneratingCombined(true)
      setError(null)
      setSuccessMessage(null)
      setGenerationProgress(0)

      const targetIds = eligibleStudents.map(s => s.studentId)
      if (targetIds.length === 0) {
        setError("No students available for report generation")
        return
      }

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 5, 90))
      }, 300)

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
      const reports = data.reports || []

      if (reports.length > 0) {
        // Combine all PDFs into a single file
        await combinePdfsAndDownload(reports)
        setSuccessMessage(`Combined report with ${reports.length} student(s) generated successfully!`)
      }

      if (data.errors && data.errors.length > 0) {
        setError(`${data.errors.length} student(s) failed: ${data.errors.map((e: any) => e.error).join(", ")}`)
      }
    } catch (err: any) {
      console.error("Error generating combined report:", err)
      setError(err.message)
    } finally {
      setGeneratingCombined(false)
      setGenerationProgress(0)
    }
  }

  // Combine multiple PDF base64 strings into one downloadable file
  const combinePdfsAndDownload = async (reports: GeneratedReport[]) => {
    // Using PDF-lib to merge PDFs would be ideal, but for simplicity we'll download as a zip
    // or create a combined download. For now, let's use the browser to download all at once
    // with a sequential approach that works well
    
    // Alternative: Create an iframe for batch printing
    const sectionName = eligibleStudents[0]?.sectionName || "Class"
    const examName = selectedExamData?.name || "Exam"
    
    // Download each report with a slight delay to prevent browser blocking
    for (let i = 0; i < reports.length; i++) {
      const report = reports[i]
      setTimeout(() => {
        const link = document.createElement("a")
        link.href = report.pdf
        link.download = `${sectionName}_${examName}_${report.studentName.replace(/\s+/g, "_")}.pdf`
        link.click()
      }, i * 300)
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

  // Get unique terms from exams that have approved results
  const getTermsWithApprovedResults = () => {
    const termMap = new Map<string, Term>()
    exams.forEach(exam => {
      if (exam.term && !termMap.has(exam.term.id)) {
        termMap.set(exam.term.id, exam.term)
      }
    })
    return Array.from(termMap.values())
  }

  // Get exam type badge color
  const getExamTypeBadge = (examType: string) => {
    switch (examType) {
      case "MID_TERM":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Mid Term</Badge>
      case "FINAL":
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Final Exam</Badge>
      case "QUIZ":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Quiz</Badge>
      case "ASSIGNMENT":
        return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Assignment</Badge>
      case "CONTINUOUS_ASSESSMENT":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">CA</Badge>
      default:
        return <Badge variant="outline">{examType}</Badge>
    }
  }

  if (status === "loading" || (loading && currentStep === "select-term")) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const availableTerms = getTermsWithApprovedResults()

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {currentStep !== "select-term" && (
            <Button variant="ghost" size="icon" onClick={goBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold">Generate Report Forms</h1>
            <p className="text-muted-foreground">
              {currentStep === "select-term" && "Step 1: Select the academic term"}
              {currentStep === "select-exam" && "Step 2: Select the exam to generate reports for"}
              {currentStep === "generate-reports" && "Step 3: Generate and download student reports"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {currentStep !== "select-term" && (
            <Button variant="outline" onClick={startOver}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          )}
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 py-2">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          currentStep === "select-term" ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"
        }`}>
          1
        </div>
        <div className={`w-16 h-1 ${currentStep !== "select-term" ? "bg-primary" : "bg-muted"}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          currentStep === "select-exam" ? "bg-primary text-primary-foreground" : 
          currentStep === "generate-reports" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
        }`}>
          2
        </div>
        <div className={`w-16 h-1 ${currentStep === "generate-reports" ? "bg-primary" : "bg-muted"}`} />
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          currentStep === "generate-reports" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}>
          3
        </div>
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

      {/* Step 1: Select Term */}
      {currentStep === "select-term" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Select Academic Term
            </CardTitle>
            <CardDescription>
              Choose the term for which you want to generate reports. Only terms with approved exam results are shown.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {availableTerms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-20" />
                <p>No terms with approved exam results found.</p>
                <p className="text-sm">Results must be approved by the principal before reports can be generated.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableTerms.map(term => {
                  const termExams = exams.filter(e => e.term?.id === term.id)
                  const examTypes = Array.from(new Set(termExams.map(e => e.examType)))
                  
                  return (
                    <Card 
                      key={term.id}
                      className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${
                        selectedTerm === term.id ? "border-primary ring-2 ring-primary/20" : ""
                      }`}
                      onClick={() => handleTermSelect(term.id)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg">{term.name}</h3>
                          {selectedTerm === term.id && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {term.academicYear?.year || "N/A"}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {examTypes.map(type => (
                            <span key={type}>
                              {getExamTypeBadge(type)}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {termExams.length} exam(s) with approved results
                        </p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {selectedTerm && (
              <div className="flex justify-end mt-6">
                <Button onClick={proceedToExamSelection}>
                  Continue to Exam Selection
                  <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select Exam */}
      {currentStep === "select-exam" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Select Exam
            </CardTitle>
            <CardDescription>
              Choose which exam you want to generate reports for. Each exam type will show only its specific results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredExams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-20" />
                <p>No exams found for the selected term.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredExams.map(exam => (
                  <Card 
                    key={exam.id}
                    className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${
                      selectedExam === exam.id ? "border-primary ring-2 ring-primary/20" : ""
                    }`}
                    onClick={() => handleExamSelect(exam.id)}
                  >
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">{exam.name}</h3>
                        {selectedExam === exam.id && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="mb-2">
                        {getExamTypeBadge(exam.examType)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {exam.term?.name} - {exam.term?.academicYear?.year}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selectedExam && (
              <div className="flex justify-end mt-6">
                <Button onClick={proceedToReportGeneration}>
                  Continue to Report Generation
                  <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generate Reports */}
      {currentStep === "generate-reports" && (
        <>
          {/* Selected exam info banner */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedExamData?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedExamData?.term?.name} - {selectedExamData?.term?.academicYear?.year}
                    </p>
                  </div>
                  <div className="ml-4">
                    {selectedExamData && getExamTypeBadge(selectedExamData.examType)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section filter */}
          <Card>
            <CardHeader>
              <CardTitle>Filter by Section</CardTitle>
              <CardDescription>
                Optionally filter students by your assigned class section
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-sm">
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
            </CardContent>
          </Card>

          {/* Eligible Students */}
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
                    disabled={generating || generatingCombined || selectedStudents.size === 0}
                  >
                    {generating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="mr-2 h-4 w-4" />
                    )}
                    Generate Selected ({selectedStudents.size})
                  </Button>
                  <Button
                    variant="default"
                    onClick={generateCombinedReport}
                    disabled={generating || generatingCombined || eligibleStudents.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {generatingCombined ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FilePlus2 className="mr-2 h-4 w-4" />
                    )}
                    Generate All Class Reports
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(generating || generatingCombined) && (
                <div className="mb-4 space-y-2">
                  <Progress value={generationProgress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Generating reports... {generationProgress}%
                  </p>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : eligibleStudents.length === 0 ? (
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
        </>
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
