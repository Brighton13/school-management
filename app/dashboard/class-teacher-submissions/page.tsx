"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle, XCircle, Eye, Send, AlertCircle, Clock, Users, BookOpen } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface SubjectSubmission {
  id: string
  totalStudents: number
  resultsEntered: number
  isComplete: boolean
  submittedAt: string | null
  classSubject: {
    id: string
    subject: {
      name: string
      code: string
    }
    teacher: {
      user: { name: string }
    } | null
  }
}

interface ExamSubmission {
  id: string
  status: string
  totalSubjects: number
  submittedSubjects: number
  totalStudents: number | null
  averageMarks: number | null
  highestMarks: number | null
  lowestMarks: number | null
  passRate: number | null
  classTeacherReviewedAt: string | null
  classTeacherComments: string | null
  exam: {
    id: string
    name: string
    examType: string
    term: {
      name: string
      academicYear: { year: string }
    }
  }
  section: {
    id: string
    name: string
    class: { name: string }
    classTeacher: {
      user: { name: string }
    } | null
  }
  subjectSubmissions: SubjectSubmission[]
}

interface Result {
  id: string
  marksObtained: number
  maxMarks: number
  grade: string | null
  remarks: string | null
  status: string
  submittedAt: string | null
  student: {
    user: { name: string }
    admissionNumber: string
  }
  classSubject: {
    subject: { name: string; code: string }
    class: { name: string }
    teacher: { user: { name: string } } | null
  }
  exam: {
    name: string
    examType: string
  } | null
}

export default function ClassTeacherSubmissionPage() {
  const { data: session } = useSession()
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([])
  const [pendingResults, setPendingResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState<ExamSubmission | null>(null)
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [submitComments, setSubmitComments] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("submissions")

  useEffect(() => {
    if (session?.user.role === "TEACHER") {
      fetchData()
    }
  }, [session])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [submissionsRes, pendingRes] = await Promise.all([
        fetch("/api/results/exam-submissions"),
        fetch("/api/results/class-teacher-pending"),
      ])

      if (submissionsRes.ok) {
        const data = await submissionsRes.json()
        setSubmissions(data)
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setPendingResults(data)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitToPrincipal = async () => {
    if (!selectedSubmission) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/results/class-teacher-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId: selectedSubmission.exam.id,
          sectionId: selectedSubmission.section.id,
          comments: submitComments,
        }),
      })

      if (res.ok) {
        setIsSubmitDialogOpen(false)
        setSelectedSubmission(null)
        setSubmitComments("")
        fetchData()
        alert("Results submitted to principal successfully!")
      } else {
        const error = await res.json()
        alert(error.error || "Failed to submit results")
      }
    } catch (error) {
      console.error("Error submitting:", error)
      alert("Failed to submit results")
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; label: string }> = {
      PENDING_SUBJECTS: { color: "bg-yellow-100 text-yellow-800", label: "Awaiting Subject Results" },
      PENDING_CLASS_TEACHER: { color: "bg-orange-100 text-orange-800", label: "Ready for Review" },
      PENDING_PRINCIPAL: { color: "bg-blue-100 text-blue-800", label: "Submitted to Principal" },
      APPROVED: { color: "bg-green-100 text-green-800", label: "Approved" },
      PUBLISHED: { color: "bg-green-100 text-green-800", label: "Published" },
    }

    const { color, label } = config[status] || { color: "bg-gray-100 text-gray-800", label: status }

    return <Badge className={color}>{label}</Badge>
  }

  const getProgressPercent = (submitted: number, total: number) => {
    return total > 0 ? (submitted / total) * 100 : 0
  }

  if (session?.user.role !== "TEACHER") {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            This page is only accessible to class teachers.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Class Teacher Submissions</h1>
        <p className="text-muted-foreground">
          Review and submit exam results for your class to the principal
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="submissions">
            Exam Submissions
            {submissions.filter(s => s.status === "PENDING_CLASS_TEACHER").length > 0 && (
              <Badge className="ml-2 bg-orange-500">
                {submissions.filter(s => s.status === "PENDING_CLASS_TEACHER").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending Results
            {pendingResults.length > 0 && (
              <Badge className="ml-2 bg-yellow-500">{pendingResults.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : submissions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No exam submissions found for your classes
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {submissions.map((submission) => (
                <Card key={submission.id} className={submission.status === "PENDING_CLASS_TEACHER" ? "border-orange-300" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {submission.section.class.name} {submission.section.name} - {submission.exam.name}
                        </CardTitle>
                        <CardDescription>
                          {submission.exam.examType} • {submission.exam.term.name} {submission.exam.term.academicYear.year}
                        </CardDescription>
                      </div>
                      {getStatusBadge(submission.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Subject Progress</span>
                        <span>{submission.submittedSubjects}/{submission.totalSubjects} subjects complete</span>
                      </div>
                      <Progress value={getProgressPercent(submission.submittedSubjects, submission.totalSubjects)} />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{submission.totalStudents || 0} Students</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span>{submission.totalSubjects} Subjects</span>
                      </div>
                      {submission.averageMarks !== null && (
                        <div>
                          <span className="text-muted-foreground">Average: </span>
                          <span className="font-medium">{submission.averageMarks.toFixed(1)}%</span>
                        </div>
                      )}
                      {submission.passRate !== null && (
                        <div>
                          <span className="text-muted-foreground">Pass Rate: </span>
                          <span className="font-medium">{submission.passRate.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>

                    {/* Subject Breakdown */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead>Teacher</TableHead>
                            <TableHead className="text-center">Results</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {submission.subjectSubmissions.map((sub) => (
                            <TableRow key={sub.id}>
                              <TableCell>
                                {sub.classSubject.subject.name} ({sub.classSubject.subject.code})
                              </TableCell>
                              <TableCell>
                                {sub.classSubject.teacher?.user.name || "Not assigned"}
                              </TableCell>
                              <TableCell className="text-center">
                                {sub.resultsEntered}/{sub.totalStudents}
                              </TableCell>
                              <TableCell className="text-center">
                                {sub.isComplete ? (
                                  <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                                ) : (
                                  <Clock className="h-5 w-5 text-yellow-500 mx-auto" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedSubmission(submission)
                          setIsDetailsDialogOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                      {submission.status === "PENDING_CLASS_TEACHER" && (
                        <Button
                          onClick={() => {
                            setSelectedSubmission(submission)
                            setIsSubmitDialogOpen(true)
                          }}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Submit to Principal
                        </Button>
                      )}
                      {submission.status === "PENDING_SUBJECTS" && (
                        <Button disabled variant="outline">
                          <Clock className="h-4 w-4 mr-2" />
                          Awaiting All Subjects
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Individual Pending Results</CardTitle>
              <CardDescription>
                Results submitted by subject teachers awaiting your review (legacy flow)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingResults.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No individual results pending review
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell>{result.student.user.name}</TableCell>
                        <TableCell>
                          {result.classSubject.subject.name} ({result.classSubject.subject.code})
                        </TableCell>
                        <TableCell>
                          {result.classSubject.teacher?.user.name || "Not assigned"}
                        </TableCell>
                        <TableCell>
                          {result.exam?.name || "N/A"} ({result.exam?.examType || "N/A"})
                        </TableCell>
                        <TableCell>
                          {result.marksObtained}/{result.maxMarks}
                          {result.grade && ` (${result.grade})`}
                        </TableCell>
                        <TableCell>
                          {result.submittedAt
                            ? new Date(result.submittedAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit to Principal Dialog */}
      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Results to Principal</DialogTitle>
            <DialogDescription>
              You are about to submit all results for{" "}
              {selectedSubmission?.section.class.name} {selectedSubmission?.section.name} -{" "}
              {selectedSubmission?.exam.name} for principal approval.
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4 py-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Ready for Submission</AlertTitle>
                <AlertDescription>
                  All {selectedSubmission.totalSubjects} subjects have complete results for{" "}
                  {selectedSubmission.totalStudents} students.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Average Marks: </span>
                  <span className="font-medium">{selectedSubmission.averageMarks?.toFixed(1) || "N/A"}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pass Rate: </span>
                  <span className="font-medium">{selectedSubmission.passRate?.toFixed(1) || "N/A"}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Highest: </span>
                  <span className="font-medium">{selectedSubmission.highestMarks || "N/A"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lowest: </span>
                  <span className="font-medium">{selectedSubmission.lowestMarks || "N/A"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Comments (Optional)</label>
                <Textarea
                  placeholder="Add any comments for the principal..."
                  value={submitComments}
                  onChange={(e) => setSubmitComments(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitToPrincipal}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? "Submitting..." : "Submit to Principal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedSubmission?.section.class.name} {selectedSubmission?.section.name} - Details
            </DialogTitle>
            <DialogDescription>
              {selectedSubmission?.exam.name} • {selectedSubmission?.exam.term.name}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6 py-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">{selectedSubmission.totalStudents}</div>
                  <div className="text-sm text-muted-foreground">Students</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">{selectedSubmission.totalSubjects}</div>
                  <div className="text-sm text-muted-foreground">Subjects</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">{selectedSubmission.averageMarks?.toFixed(1) || "N/A"}%</div>
                  <div className="text-sm text-muted-foreground">Average</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">{selectedSubmission.passRate?.toFixed(1) || "N/A"}%</div>
                  <div className="text-sm text-muted-foreground">Pass Rate</div>
                </Card>
              </div>

              {/* Subject Details */}
              <div>
                <h3 className="font-semibold mb-2">Subject Breakdown</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead className="text-center">Results Entered</TableHead>
                      <TableHead className="text-center">Complete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSubmission.subjectSubmissions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {sub.classSubject.subject.name}
                        </TableCell>
                        <TableCell>{sub.classSubject.subject.code}</TableCell>
                        <TableCell>
                          {sub.classSubject.teacher?.user.name || "Not assigned"}
                        </TableCell>
                        <TableCell className="text-center">
                          {sub.resultsEntered} / {sub.totalStudents}
                        </TableCell>
                        <TableCell className="text-center">
                          {sub.isComplete ? (
                            <Badge className="bg-green-100 text-green-800">Complete</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {selectedSubmission.classTeacherComments && (
                <div>
                  <h3 className="font-semibold mb-2">Class Teacher Comments</h3>
                  <p className="text-sm bg-muted p-3 rounded">
                    {selectedSubmission.classTeacherComments}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
