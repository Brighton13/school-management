"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Award, 
  BookOpen, 
  TrendingUp, 
  Calendar,
  BarChart3,
  FileText,
  Clock,
  CheckCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@radix-ui/react-accordion"


interface StudentResult {
  id: string
  subjectName: string
  subjectCode: string
  examName: string | null
  examType: string
  marksObtained: number
  maxMarks: number
  percentage: number
  grade: string | null
  submittedAt: string | null
  approvedAt: string | null
}

interface TermData {
  termName: string
  termInfo: {
    id: string
    name: string
    academicYear: string
  }
  continuousAssessments: StudentResult[]
  endOfTermResults: StudentResult[]
  termAverage: number
  termGrade: string | null
  totalAssessments: number
}

interface AcademicYearData {
  academicYear: string
  terms: TermData[]
}

interface StudentResultsData {
  student: {
    name: string
    admissionNumber: string
    className: string
  }
  overallAverage: number
  totalResults: number
  academicYears: AcademicYearData[]
  summary: {
    totalContinuousAssessments: number
    totalEndOfTermExams: number
    yearsWithResults: number
  }
}

export function StudentResultsView() {
  const [data, setData] = useState<StudentResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>("")

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/students/results")
        if (response.ok) {
          const resultsData = await response.json()
          setData(resultsData)
          // Set the most recent year as default
          if (resultsData.academicYears.length > 0) {
            setSelectedYear(resultsData.academicYears[0].academicYear)
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || "Failed to load results")
        }
      } catch (error) {
        console.error("Failed to fetch results:", error)
        setError("Network error. Please check your connection.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your results...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <CardTitle className="text-red-800 dark:text-red-200">Results Unavailable</CardTitle>
          <CardDescription className="text-red-700 dark:text-red-300">
            {error || "Failed to load results. Please try again later."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const getGradeColor = (grade: string | null, percentage: number) => {
    if (grade === "A" || percentage >= 80) return "bg-green-100 text-green-800"
    if (grade === "B" || percentage >= 70) return "bg-blue-100 text-blue-800"
    if (grade === "C" || percentage >= 60) return "bg-yellow-100 text-yellow-800"
    if (grade === "D" || percentage >= 50) return "bg-orange-100 text-orange-800"
    return "bg-red-100 text-red-800"
  }

  const getExamTypeColor = (examType: string) => {
    switch (examType) {
      case "CONTINUOUS_ASSESSMENT":
        return "bg-blue-100 text-blue-800"
      case "QUIZ":
        return "bg-purple-100 text-purple-800"
      case "ASSIGNMENT":
        return "bg-indigo-100 text-indigo-800"
      case "FINAL":
        return "bg-red-100 text-red-800"
      case "MID_TERM":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatExamType = (examType: string) => {
    switch (examType) {
      case "CONTINUOUS_ASSESSMENT":
        return "CA"
      case "QUIZ":
        return "Quiz"
      case "ASSIGNMENT":
        return "Assignment"
      case "FINAL":
        return "Final Exam"
      case "MID_TERM":
        return "Mid-Term"
      default:
        return examType
    }
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">My Academic Results</h1>
        <p className="text-indigo-100">
          {data.student.name} • {data.student.admissionNumber} • {data.student.className}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Average</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overallAverage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Across all subjects
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Results</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalResults}</div>
            <p className="text-xs text-muted-foreground">
              All assessments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Continuous Assessments</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalContinuousAssessments}</div>
            <p className="text-xs text-muted-foreground">
              Tests & assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">End of Term Exams</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalEndOfTermExams}</div>
            <p className="text-xs text-muted-foreground">
              Final examinations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Academic Years Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Academic Results by Year
          </CardTitle>
          <CardDescription>
            View your results organized by academic year and terms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedYear} onValueChange={setSelectedYear}>
            <TabsList className="grid w-full grid-cols-auto">
              {data.academicYears.map((yearData) => (
                <TabsTrigger key={yearData.academicYear} value={yearData.academicYear}>
                  {yearData.academicYear}
                </TabsTrigger>
              ))}
            </TabsList>

            {data.academicYears.map((yearData) => (
              <TabsContent key={yearData.academicYear} value={yearData.academicYear} className="space-y-6">
                <div className="grid gap-4">
                  <Accordion type="multiple" defaultValue={yearData.terms.map(t => t.termName)}>
                    {yearData.terms.map((term) => (
                      <AccordionItem key={term.termName} value={term.termName}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-4">
                            <div className="flex items-center gap-3">
                              <BarChart3 className="h-5 w-5 text-blue-600" />
                              <span className="font-semibold">{term.termName}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={getGradeColor(term.termGrade, term.termAverage)}>
                                {term.termAverage.toFixed(1)}% ({term.termGrade})
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {term.totalAssessments} results
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6">
                          {/* Continuous Assessments */}
                          {term.continuousAssessments.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-600" />
                                Continuous Assessments
                              </h4>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Subject</TableHead>
                                      <TableHead>Assessment</TableHead>
                                      <TableHead>Type</TableHead>
                                      <TableHead>Marks</TableHead>
                                      <TableHead>Score</TableHead>
                                      <TableHead>Grade</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {term.continuousAssessments.map((result) => (
                                      <TableRow key={result.id}>
                                        <TableCell className="font-medium">
                                          {result.subjectName}
                                          {result.subjectCode && (
                                            <div className="text-xs text-muted-foreground">
                                              {result.subjectCode}
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {result.examName || "Assessment"}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="secondary" className={getExamTypeColor(result.examType)}>
                                            {formatExamType(result.examType)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {result.marksObtained.toFixed(0)} / {result.maxMarks.toFixed(0)}
                                        </TableCell>
                                        <TableCell>
                                          <span className={`font-bold ${
                                            result.percentage >= 80
                                              ? "text-green-600"
                                              : result.percentage >= 60
                                              ? "text-blue-600"
                                              : result.percentage >= 50
                                              ? "text-orange-600"
                                              : "text-red-600"
                                          }`}>
                                            {result.percentage.toFixed(1)}%
                                          </span>
                                        </TableCell>
                                        <TableCell>
                                          {result.grade && (
                                            <Badge variant="outline" className={getGradeColor(result.grade, result.percentage)}>
                                              {result.grade}
                                            </Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}

                          {/* End of Term Results */}
                          {term.endOfTermResults.length > 0 && (
                            <div>
                              <h4 className="font-semibold mb-3 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-red-600" />
                                End of Term Examinations
                              </h4>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Subject</TableHead>
                                      <TableHead>Exam</TableHead>
                                      <TableHead>Type</TableHead>
                                      <TableHead>Marks</TableHead>
                                      <TableHead>Score</TableHead>
                                      <TableHead>Grade</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {term.endOfTermResults.map((result) => (
                                      <TableRow key={result.id}>
                                        <TableCell className="font-medium">
                                          {result.subjectName}
                                          {result.subjectCode && (
                                            <div className="text-xs text-muted-foreground">
                                              {result.subjectCode}
                                            </div>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {result.examName || "Final Exam"}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="secondary" className={getExamTypeColor(result.examType)}>
                                            {formatExamType(result.examType)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {result.marksObtained.toFixed(0)} / {result.maxMarks.toFixed(0)}
                                        </TableCell>
                                        <TableCell>
                                          <span className={`font-bold ${
                                            result.percentage >= 80
                                              ? "text-green-600"
                                              : result.percentage >= 60
                                              ? "text-blue-600"
                                              : result.percentage >= 50
                                              ? "text-orange-600"
                                              : "text-red-600"
                                          }`}>
                                            {result.percentage.toFixed(1)}%
                                          </span>
                                        </TableCell>
                                        <TableCell>
                                          {result.grade && (
                                            <Badge variant="outline" className={getGradeColor(result.grade, result.percentage)}>
                                              {result.grade}
                                            </Badge>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}