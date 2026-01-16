"use client"

import { useEffect, useState, Fragment } from "react"
import { useSession } from "next-auth/react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Users, 
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  CheckCheck,
  Ban,
  GraduationCap,
  BookOpen,
  RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"

interface StudentResult {
  id: string
  subjectName: string
  subjectCode: string
  marksObtained: number
  maxMarks: number
  percentage: number
  grade: string | null
  status: string
}

interface StudentData {
  studentId: string
  studentName: string
  admissionNumber: string
  results: StudentResult[]
  totalMarks: number
  totalMaxMarks: number
  averagePercentage: number
  passed: boolean
  overallGrade: string
}

interface SectionStats {
  totalStudents: number
  totalPassed: number
  totalFailed: number
  averagePercentage: number
  highestPercentage: number
  lowestPercentage: number
}

interface SectionData {
  sectionId: string
  sectionName: string
  classTeacher: string | null
  submissionId: string | null
  submissionStatus: string | null
  students: StudentData[]
  stats: SectionStats
}

interface ClassData {
  classId: string
  className: string
  sections: SectionData[]
}

interface ExamStats {
  totalExpectedSections: number
  totalPendingSections: number
  totalApprovedSections: number
  allSectionsSubmitted: boolean
  canApprove: boolean
}

interface ExamData {
  exam: {
    id: string
    name: string
    examType: string
    status: string
    term: {
      name: string
      academicYear: string
    }
  }
  stats: ExamStats
  groupedResults: ClassData[]
}

export default function ApprovalsPage() {
  const { data: session } = useSession()
  const [examData, setExamData] = useState<ExamData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExam, setSelectedExam] = useState<ExamData | null>(null)
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set())
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false)
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject" | "publish">("approve")
  const [approvalComments, setApprovalComments] = useState("")
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState("pending")
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([])
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (session?.user.role === "PRINCIPAL" || session?.user.role === "ADMIN") {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/results/principal-approval/grouped")
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      if (res.ok) {
        const data = await res.json()
        setExamData(data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const toggleClass = (classId: string) => {
    const newSet = new Set(expandedClasses)
    if (newSet.has(classId)) {
      newSet.delete(classId)
    } else {
      newSet.add(classId)
    }
    setExpandedClasses(newSet)
  }

  const toggleSection = (sectionId: string) => {
    const newSet = new Set(expandedSections)
    if (newSet.has(sectionId)) {
      newSet.delete(sectionId)
    } else {
      newSet.add(sectionId)
    }
    setExpandedSections(newSet)
  }

  const toggleStudent = (studentId: string) => {
    const newSet = new Set(expandedStudents)
    if (newSet.has(studentId)) {
      newSet.delete(studentId)
    } else {
      newSet.add(studentId)
    }
    setExpandedStudents(newSet)
  }

  const handleApproval = async () => {
    if (!selectedExam) return

    setProcessing(true)
    try {
      const res = await fetch("/api/results/principal-approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedExam.exam.id,
          sectionIds: selectedSectionIds.length > 0 ? selectedSectionIds : undefined,
          action: approvalAction,
          comments: approvalComments,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        setIsApprovalDialogOpen(false)
        setSelectedExam(null)
        setSelectedSectionIds([])
        setApprovalComments("")
        fetchData()
        alert(result.message)
      } else {
        const error = await res.json()
        alert(error.error || "Failed to process approval")
      }
    } catch (error) {
      console.error("Error processing approval:", error)
      alert("Failed to process approval")
    } finally {
      setProcessing(false)
    }
  }

  const openApprovalDialog = (exam: ExamData, action: "approve" | "reject" | "publish", sectionIds?: string[]) => {
    setSelectedExam(exam)
    setApprovalAction(action)
    setSelectedSectionIds(sectionIds || [])
    setApprovalComments("")
    setIsApprovalDialogOpen(true)
  }

  const getGradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "text-green-600 bg-green-100"
    if (grade.startsWith("B")) return "text-blue-600 bg-blue-100"
    if (grade.startsWith("C")) return "text-yellow-600 bg-yellow-100"
    if (grade.startsWith("D")) return "text-orange-600 bg-orange-100"
    return "text-red-600 bg-red-100"
  }

  const getPassFailBadge = (passed: boolean) => {
    return passed ? (
      <Badge className="bg-green-100 text-green-800">
        <CheckCircle className="h-3 w-3 mr-1" />
        Passed
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    )
  }

  // Filter exams based on tab
  const pendingExams = examData.filter(e => e.stats.totalPendingSections > 0)
  const approvedExams = examData.filter(e => e.stats.totalApprovedSections > 0)

  if (!["PRINCIPAL", "ADMIN"].includes(session?.user.role || "")) {
    return (
      <PermissionDenied 
        title="Access Denied"
        message="This page is only accessible to the principal and administrators."
      />
    )
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
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Results Approval</h1>
          <p className="text-muted-foreground">
            Review and approve exam results grouped by class and section
          </p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending Approval
            {pendingExams.length > 0 && (
              <Badge className="ml-2 bg-blue-500">{pendingExams.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            {approvedExams.length > 0 && (
              <Badge className="ml-2 bg-green-500">{approvedExams.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6 mt-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : pendingExams.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">All caught up!</p>
                <p>No exams pending approval</p>
              </CardContent>
            </Card>
          ) : (
            pendingExams.map((examItem) => (
              <Card key={examItem.exam.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{examItem.exam.name}</CardTitle>
                      <CardDescription>
                        {examItem.exam.examType} • {examItem.exam.term.name} {examItem.exam.term.academicYear}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openApprovalDialog(examItem, "reject")}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Reject All
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => openApprovalDialog(examItem, "approve")}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve All
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => openApprovalDialog(examItem, "publish")}
                      >
                        <CheckCheck className="h-4 w-4 mr-1" />
                        Approve & Publish All
                      </Button>
                    </div>
                  </div>

                  {/* Exam Overview Stats */}
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Total Sections</div>
                      <div className="text-2xl font-bold">{examItem.stats.totalExpectedSections}</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-sm text-blue-600">Pending Approval</div>
                      <div className="text-2xl font-bold text-blue-700">{examItem.stats.totalPendingSections}</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <div className="text-sm text-green-600">Approved</div>
                      <div className="text-2xl font-bold text-green-700">{examItem.stats.totalApprovedSections}</div>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="text-sm text-muted-foreground">Progress</div>
                      <Progress 
                        value={(examItem.stats.totalApprovedSections / Math.max(examItem.stats.totalExpectedSections, 1)) * 100} 
                        className="mt-2"
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Grouped Results by Class */}
                  {examItem.groupedResults.map((classItem) => (
                    <Collapsible
                      key={classItem.classId}
                      open={expandedClasses.has(classItem.classId)}
                      onOpenChange={() => toggleClass(classItem.classId)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                          <div className="flex items-center gap-3">
                            {expandedClasses.has(classItem.classId) ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                            <GraduationCap className="h-5 w-5 text-primary" />
                            <span className="font-semibold text-lg">{classItem.className}</span>
                          </div>
                          <Badge variant="outline">
                            {classItem.sections.length} Section(s)
                          </Badge>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="pl-8 space-y-3 mt-3">
                        {classItem.sections.map((section) => (
                          <Collapsible
                            key={section.sectionId}
                            open={expandedSections.has(section.sectionId)}
                            onOpenChange={() => toggleSection(section.sectionId)}
                          >
                            {/* Section Header with Stats */}
                            <div className="border rounded-lg overflow-hidden">
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-4 bg-card hover:bg-muted/30 transition-colors">
                                  <div className="flex items-center gap-3">
                                    {expandedSections.has(section.sectionId) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    <div className="text-left">
                                      <div className="font-medium">
                                        {classItem.className} {section.sectionName}
                                      </div>
                                      {section.classTeacher && (
                                        <div className="text-sm text-muted-foreground">
                                          Class Teacher: {section.classTeacher}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Section Stats Summary */}
                                  <div className="flex items-center gap-6 text-sm">
                                    <div className="flex items-center gap-1">
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{section.stats.totalStudents}</span>
                                      <span className="text-muted-foreground">students</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <TrendingUp className="h-4 w-4 text-green-500" />
                                      <span className="font-medium text-green-600">{section.stats.totalPassed}</span>
                                      <span className="text-muted-foreground">passed</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <TrendingDown className="h-4 w-4 text-red-500" />
                                      <span className="font-medium text-red-600">{section.stats.totalFailed}</span>
                                      <span className="text-muted-foreground">failed</span>
                                    </div>
                                    <div className="text-center px-3 py-1 bg-primary/10 rounded">
                                      <span className="font-bold">{section.stats.averagePercentage.toFixed(1)}%</span>
                                      <span className="text-muted-foreground ml-1">avg</span>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        openApprovalDialog(examItem, "approve", [section.sectionId])
                                      }}
                                    >
                                      Approve Section
                                    </Button>
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                {/* Section Details - Stats Bar */}
                                <div className="px-4 py-3 bg-muted/30 border-t grid grid-cols-5 gap-4 text-center text-sm">
                                  <div>
                                    <div className="text-muted-foreground">Total Students</div>
                                    <div className="font-bold text-lg">{section.stats.totalStudents}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Passed</div>
                                    <div className="font-bold text-lg text-green-600">{section.stats.totalPassed}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Failed</div>
                                    <div className="font-bold text-lg text-red-600">{section.stats.totalFailed}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Highest</div>
                                    <div className="font-bold text-lg">{section.stats.highestPercentage.toFixed(1)}%</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Lowest</div>
                                    <div className="font-bold text-lg">{section.stats.lowestPercentage.toFixed(1)}%</div>
                                  </div>
                                </div>

                                {/* Students Table */}
                                <div className="p-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="w-10"></TableHead>
                                        <TableHead>Admission No.</TableHead>
                                        <TableHead>Student Name</TableHead>
                                        <TableHead className="text-center">Subjects</TableHead>
                                        <TableHead className="text-center">Total Marks</TableHead>
                                        <TableHead className="text-center">Average %</TableHead>
                                        <TableHead className="text-center">Grade</TableHead>
                                        <TableHead className="text-center">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {section.students.map((student) => (
                                        <Fragment key={student.studentId}>
                                          <TableRow
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => toggleStudent(student.studentId)}
                                          >
                                            <TableCell>
                                              {expandedStudents.has(student.studentId) ? (
                                                <ChevronDown className="h-4 w-4" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4" />
                                              )}
                                            </TableCell>
                                            <TableCell className="font-mono">
                                              {student.admissionNumber}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                              {student.studentName}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              {student.results.length}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              {student.totalMarks}/{student.totalMaxMarks}
                                            </TableCell>
                                            <TableCell className="text-center font-medium">
                                              {student.averagePercentage.toFixed(1)}%
                                            </TableCell>
                                            <TableCell className="text-center">
                                              <Badge className={getGradeColor(student.overallGrade)}>
                                                {student.overallGrade}
                                              </Badge>
                                            </TableCell>
                                            <TableCell className="text-center">
                                              {getPassFailBadge(student.passed)}
                                            </TableCell>
                                          </TableRow>
                                          {/* Expanded Student Results */}
                                          {expandedStudents.has(student.studentId) && (
                                            <TableRow>
                                              <TableCell colSpan={8} className="bg-muted/20 p-0">
                                                <div className="p-4">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead>Subject</TableHead>
                                                        <TableHead className="text-center">Marks</TableHead>
                                                        <TableHead className="text-center">Percentage</TableHead>
                                                        <TableHead className="text-center">Grade</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {student.results.map((result) => (
                                                        <TableRow key={result.id}>
                                                          <TableCell>
                                                            {result.subjectName} ({result.subjectCode})
                                                          </TableCell>
                                                          <TableCell className="text-center">
                                                            {result.marksObtained}/{result.maxMarks}
                                                          </TableCell>
                                                          <TableCell className="text-center">
                                                            {result.percentage.toFixed(1)}%
                                                          </TableCell>
                                                          <TableCell className="text-center">
                                                            <Badge className={getGradeColor(result.grade || "F")}>
                                                              {result.grade || "N/A"}
                                                            </Badge>
                                                          </TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </Fragment>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-6 mt-4">
          {approvedExams.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No approved exams yet
              </CardContent>
            </Card>
          ) : (
            approvedExams.map((examItem) => (
              <Card key={examItem.exam.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{examItem.exam.name}</CardTitle>
                        {examItem.exam.status === "COMPLETED" && (
                          <Badge className="bg-green-100 text-green-800">Completed</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {examItem.exam.examType} • {examItem.exam.term.name} {examItem.exam.term.academicYear}
                      </CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800">
                      {examItem.stats.totalApprovedSections} Section(s) Approved
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    All results for this exam have been approved.
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === "approve" 
                ? "Approve Results" 
                : approvalAction === "publish" 
                ? "Approve & Publish Results" 
                : "Reject Results"}
            </DialogTitle>
            <DialogDescription>
              {selectedExam?.exam.name} - {selectedExam?.exam.term.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {approvalAction === "reject" ? (
              <Card className="border-destructive bg-destructive/10">
                <CardContent className="flex items-start gap-3 pt-4">
                  <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Reject Results</p>
                    <p className="text-sm text-destructive/80">
                      This will send {selectedSectionIds.length > 0 ? "the selected section's" : "all"} results back to 
                      class teachers for review and correction.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/50 bg-primary/10">
                <CardContent className="flex items-start gap-3 pt-4">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">
                      {approvalAction === "publish" ? "Approve and Publish" : "Approve Results"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {approvalAction === "publish"
                        ? `This will approve ${selectedSectionIds.length > 0 ? "the selected section's" : "all"} results and make them visible to students and parents.`
                        : `This will approve ${selectedSectionIds.length > 0 ? "the selected section's" : "all"} results. You can publish them later.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedSectionIds.length > 0 && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-sm font-medium mb-1">Selected Sections:</div>
                <div className="text-sm text-muted-foreground">
                  {selectedSectionIds.length} section(s) will be processed
                </div>
              </div>
            )}

            {selectedSectionIds.length === 0 && (
              <div className="bg-muted p-3 rounded-lg">
                <div className="text-sm font-medium mb-1">All Sections</div>
                <div className="text-sm text-muted-foreground">
                  All pending sections for this exam will be processed
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Comments (Optional)</label>
              <Textarea
                placeholder="Add any comments for the class teachers..."
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApproval}
              disabled={processing}
              variant={approvalAction === "reject" ? "destructive" : "default"}
              className={approvalAction === "publish" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {processing
                ? "Processing..."
                : approvalAction === "approve"
                ? "Approve"
                : approvalAction === "publish"
                ? "Approve & Publish"
                : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

