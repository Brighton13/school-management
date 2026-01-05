"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { 
  Award, 
  BookOpen, 
  TrendingUp, 
  Calendar,
  BarChart3,
  FileText,
  DollarSign,
  Filter,
  Trophy,
  MessageSquare,
  User,
  GraduationCap,
  Target,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

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
  points?: number
  submittedAt: string | null
  approvedAt: string | null
}

interface ExamTypeSection {
  examType: string
  results: StudentResult[]
  average: number
  totalResults: number
}

interface TermData {
  termName: string
  termInfo: {
    id: string
    name: string
    academicYear: string
  }
  examTypeSections: ExamTypeSection[]
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
  blocked?: boolean
  reason?: string
  message?: string
  pendingFees?: Array<{
    id: string
    feeType: string
    amount: number
    paidAmount: number
    remainingAmount: number
    dueDate: string
    status: string
  }>
  totalPendingAmount?: number
  overallAverage: number
  totalResults: number
  academicYears: AcademicYearData[]
  summary: {
    examTypeCounts: Record<string, number>
    yearsWithResults: number
  }
}

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

export function StudentResultsView() {
  const [data, setData] = useState<StudentResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter states
  const [selectedYear, setSelectedYear] = useState<string>("all")
  const [selectedTerm, setSelectedTerm] = useState<string>("all")
  const [selectedExamType, setSelectedExamType] = useState<string>("all")
  
  // Points configuration
  const [pointsConfig, setPointsConfig] = useState(defaultPointsConfig)

  useEffect(() => {
    async function fetchData() {
      try {
        const [resultsRes, pointsRes] = await Promise.all([
          fetch("/api/students/results"),
          fetch("/api/settings/points-config")
        ])
        
        if (resultsRes.ok) {
          const resultsData = await resultsRes.json()
          setData(resultsData)
          // Set the most recent year as default (only if not blocked and has results)
          if (resultsData.academicYears && resultsData.academicYears.length > 0 && !resultsData.blocked) {
            setSelectedYear(resultsData.academicYears[0].academicYear)
          }
        } else {
          const errorData = await resultsRes.json().catch(() => ({}))
          setError(errorData.error || "Failed to load results")
        }
        
        if (pointsRes.ok) {
          const pointsData = await pointsRes.json()
          if (pointsData.length > 0) {
            setPointsConfig(pointsData)
          }
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

  // Get points for a result - use stored points if available, otherwise calculate
  const getPoints = (percentage: number, storedPoints?: number | null): number => {
    // Use stored points if available (preserves historical points configuration)
    if (storedPoints !== undefined && storedPoints !== null) {
      return storedPoints
    }
    // Fallback to calculation for old results without stored points
    const rounded = Math.round(percentage)
    const config = pointsConfig.find(
      (pc) => rounded >= pc.minPercentage && rounded <= pc.maxPercentage
    )
    return config?.points || 7
  }

  // Get auto comment based on percentage
  const getComment = (percentage: number): string => {
    if (percentage >= 90) return "Outstanding performance! Excellent work!"
    if (percentage >= 80) return "Excellent work! Keep it up!"
    if (percentage >= 70) return "Very good performance. Well done!"
    if (percentage >= 60) return "Good performance. Continue working hard."
    if (percentage >= 50) return "Fair performance. More effort needed."
    if (percentage >= 40) return "Below average. Seek help from teachers."
    return "Needs significant improvement. Parent consultation recommended."
  }

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

  // Handle fee block
  if (data.blocked && data.reason === "PENDING_FEES") {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-lg p-6 text-white">
          <h1 className="text-3xl font-bold mb-2">Results Access Blocked</h1>
          <p className="text-red-100">
            {data.student.name} • {data.student.admissionNumber} • {data.student.className}
          </p>
        </div>

        <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
              <DollarSign className="h-6 w-6" />
              Payment Required
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              {data.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-white dark:bg-red-900/40 p-4 rounded-lg border border-red-200 dark:border-red-700">
                <h3 className="font-semibold text-red-800 dark:text-red-200 mb-3">Pending Fees</h3>
                <div className="space-y-3">
                  {data.pendingFees?.map((fee) => (
                    <div key={fee.id} className="flex justify-between items-center p-3 bg-red-100 dark:bg-red-900/60 rounded-lg">
                      <div>
                        <p className="font-medium text-red-900 dark:text-red-100">{fee.feeType}</p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          Due: {new Date(fee.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-900 dark:text-red-100">
                          ZMW {fee.remainingAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">({fee.status})</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-red-200 dark:border-red-700 mt-4 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-red-800 dark:text-red-200">Total Outstanding:</span>
                    <span className="text-xl font-bold text-red-900 dark:text-red-100">
                      ZMW {data.totalPendingAmount?.toFixed(2) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <a
                  href="/dashboard/fees"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg text-center transition-colors"
                >
                  View Fee Details
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get available terms for selected year
  const availableTerms = selectedYear === "all" 
    ? data.academicYears.flatMap(y => y.terms.map(t => ({ name: t.termName, year: y.academicYear })))
    : data.academicYears.find(y => y.academicYear === selectedYear)?.terms.map(t => ({ name: t.termName, year: selectedYear })) || []

  // Get unique term names
  const uniqueTermNames = Array.from(new Set(availableTerms.map(t => t.name)))

  // Get all unique exam types
  const allExamTypes = Array.from(new Set(
    data.academicYears.flatMap(y => 
      y.terms.flatMap(t => 
        t.examTypeSections.map(e => e.examType)
      )
    )
  ))

  // Filter and flatten results based on selections
  const getFilteredResults = () => {
    const results: Array<StudentResult & { termName: string; academicYear: string }> = []
    
    data.academicYears.forEach(yearData => {
      if (selectedYear !== "all" && yearData.academicYear !== selectedYear) return
      
      yearData.terms.forEach(term => {
        if (selectedTerm !== "all" && term.termName !== selectedTerm) return
        
        term.examTypeSections.forEach(section => {
          if (selectedExamType !== "all" && section.examType !== selectedExamType) return
          
          section.results.forEach(result => {
            results.push({
              ...result,
              termName: term.termName,
              academicYear: yearData.academicYear,
            })
          })
        })
      })
    })
    
    return results
  }

  const filteredResults = getFilteredResults()

  // Calculate statistics for filtered results
  const totalMarks = filteredResults.reduce((sum, r) => sum + r.marksObtained, 0)
  const maxMarks = filteredResults.reduce((sum, r) => sum + r.maxMarks, 0)
  const overallPercentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0
  const totalPoints = filteredResults.reduce((sum, r) => sum + getPoints(r.percentage, r.points), 0)

  // Calculate position (mock - would need API support for real position)
  const getGrade = (percentage: number): string => {
    if (percentage >= 90) return "A+"
    if (percentage >= 80) return "A"
    if (percentage >= 70) return "B+"
    if (percentage >= 60) return "B"
    if (percentage >= 50) return "C+"
    if (percentage >= 40) return "C"
    if (percentage >= 30) return "D"
    return "F"
  }

  const getGradeColor = (grade: string | null, percentage: number) => {
    if (grade === "A+" || grade === "A" || percentage >= 80) return "bg-green-100 text-green-800 border-green-300"
    if (grade === "B+" || grade === "B" || percentage >= 70) return "bg-blue-100 text-blue-800 border-blue-300"
    if (grade === "C+" || grade === "C" || percentage >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-300"
    if (grade === "D" || percentage >= 50) return "bg-orange-100 text-orange-800 border-orange-300"
    return "bg-red-100 text-red-800 border-red-300"
  }

  const formatExamType = (examType: string) => {
    switch (examType) {
      case "CONTINUOUS_ASSESSMENT": return "Continuous Assessment"
      case "QUIZ": return "Quiz"
      case "ASSIGNMENT": return "Assignment"
      case "FINAL": return "Final Exam"
      case "MID_TERM": return "Mid-Term"
      default: return examType
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="h-8 w-8" />
          <h1 className="text-3xl font-bold">My Report Card</h1>
        </div>
        <p className="text-indigo-100">
          <User className="inline h-4 w-4 mr-1" />
          {data.student.name} • {data.student.admissionNumber} • {data.student.className}
        </p>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Results
          </CardTitle>
          <CardDescription>Choose what results you want to view</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Academic Year Filter */}
            <div className="space-y-2">
              <Label htmlFor="year-filter" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Academic Year
              </Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="year-filter">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {data.academicYears.map(y => (
                    <SelectItem key={y.academicYear} value={y.academicYear}>
                      {y.academicYear}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Term Filter */}
            <div className="space-y-2">
              <Label htmlFor="term-filter" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Term
              </Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger id="term-filter">
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {uniqueTermNames.map(termName => (
                    <SelectItem key={termName} value={termName}>
                      {termName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exam Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="exam-filter" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Exam Type
              </Label>
              <Select value={selectedExamType} onValueChange={setSelectedExamType}>
                <SelectTrigger id="exam-filter">
                  <SelectValue placeholder="Select exam type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exam Types</SelectItem>
                  {allExamTypes.map(examType => (
                    <SelectItem key={examType} value={examType}>
                      {formatExamType(examType)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredResults.length > 0 ? (
        <>
          {/* Performance Summary Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="text-3xl font-bold text-blue-700">{overallPercentage.toFixed(1)}%</p>
                <p className="text-sm text-blue-600">Average Score</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4 text-center">
                <Award className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p className="text-3xl font-bold text-green-700">{getGrade(overallPercentage)}</p>
                <p className="text-sm text-green-600">Overall Grade</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-4 text-center">
                <Trophy className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <p className="text-3xl font-bold text-purple-700">{totalPoints}</p>
                <p className="text-sm text-purple-600">Total Points</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                <p className="text-3xl font-bold text-orange-700">{totalMarks}/{maxMarks}</p>
                <p className="text-sm text-orange-600">Total Marks</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
              <CardContent className="p-4 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                <p className="text-3xl font-bold text-indigo-700">{filteredResults.length}</p>
                <p className="text-sm text-indigo-600">Subjects</p>
              </CardContent>
            </Card>
          </div>

          {/* Results Table - Report Card Style */}
          <Card>
            <CardHeader className="bg-gray-100 border-b">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Subject Results
              </CardTitle>
              <CardDescription>
                {selectedYear !== "all" ? selectedYear : "All Years"} • 
                {selectedTerm !== "all" ? ` ${selectedTerm}` : " All Terms"} • 
                {selectedExamType !== "all" ? ` ${formatExamType(selectedExamType)}` : " All Exams"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-bold">Subject</TableHead>
                      <TableHead className="font-bold text-center">Assessment</TableHead>
                      <TableHead className="font-bold text-center">Score</TableHead>
                      <TableHead className="font-bold text-center">%</TableHead>
                      <TableHead className="font-bold text-center">Points</TableHead>
                      <TableHead className="font-bold text-center">Grade</TableHead>
                      <TableHead className="font-bold">Remark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResults.map((result, index) => {
                      const points = getPoints(result.percentage, result.points)
                      const remark = result.percentage >= 75 ? "Excellent" :
                                     result.percentage >= 65 ? "Very Good" :
                                     result.percentage >= 50 ? "Good" :
                                     result.percentage >= 40 ? "Fair" :
                                     result.percentage >= 30 ? "Poor" : "Fail"
                      return (
                        <TableRow key={result.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <TableCell className="font-medium">
                            {result.subjectName}
                            {result.subjectCode && (
                              <div className="text-xs text-muted-foreground">{result.subjectCode}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {result.examName || formatExamType(result.examType)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {result.marksObtained}/{result.maxMarks}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${
                              result.percentage >= 75 ? "text-green-600" :
                              result.percentage >= 50 ? "text-blue-600" :
                              result.percentage >= 40 ? "text-orange-600" : "text-red-600"
                            }`}>
                              {result.percentage.toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              {points}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={getGradeColor(result.grade, result.percentage)}>
                              {result.grade || getGrade(result.percentage)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {remark}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {/* Totals Row */}
                    <TableRow className="bg-gray-100 font-bold border-t-2">
                      <TableCell>TOTAL</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-center">{totalMarks}/{maxMarks}</TableCell>
                      <TableCell className="text-center text-blue-600">{overallPercentage.toFixed(1)}%</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-purple-600 text-white">{totalPoints}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={getGradeColor(null, overallPercentage)}>
                          {getGrade(overallPercentage)}
                        </Badge>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Teacher Comment Section */}
          <Card className="border-2">
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <MessageSquare className="h-5 w-5" />
                Performance Comment
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-gray-700 italic">
                &quot;{getComment(overallPercentage)}&quot;
              </p>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Best Performing Subjects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...filteredResults]
                    .sort((a, b) => b.percentage - a.percentage)
                    .slice(0, 3)
                    .map((result, index) => (
                      <div key={result.id} className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <span className="font-medium">{index + 1}. {result.subjectName}</span>
                        <Badge className="bg-green-600">{result.percentage.toFixed(0)}%</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4 text-orange-600" />
                  Needs Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...filteredResults]
                    .sort((a, b) => a.percentage - b.percentage)
                    .slice(0, 3)
                    .map((result, index) => (
                      <div key={result.id} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <span className="font-medium">{index + 1}. {result.subjectName}</span>
                        <Badge variant="outline" className="border-orange-300 text-orange-700">
                          {result.percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Results Found</h3>
            <p className="text-muted-foreground text-center">
              No results match your selected filters. Try adjusting the filters above.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
