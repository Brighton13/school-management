"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, XCircle, Eye } from "lucide-react"

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
  exam: {
    name: string
    examType: string
  } | null
}

export default function ClassTeacherReviewPage() {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedResult, setSelectedResult] = useState<Result | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

  useEffect(() => {
    fetchPendingResults()
  }, [])

  const fetchPendingResults = async () => {
    try {
      const res = await fetch("/api/results/class-teacher-pending")
      const data = await res.json()
      setResults(data)
    } catch (error) {
      console.error("Failed to fetch pending results:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (resultId: string, approved: boolean, submitToPrincipal: boolean = false) => {
    try {
      const res = await fetch(`/api/results/${resultId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, submitToPrincipal }),
      })

      if (res.ok) {
        fetchPendingResults()
        setIsViewDialogOpen(false)
        setSelectedResult(null)
      } else {
        const error = await res.json()
        alert(error.error || "Failed to process review")
      }
    } catch (error) {
      console.error("Failed to process review:", error)
      alert("Failed to process review")
    }
  }

  const handleView = (result: Result) => {
    setSelectedResult(result)
    setIsViewDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Class Teacher Review</h1>
        <p className="text-muted-foreground">
          Review results submitted by subject teachers for your class
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Reviews</CardTitle>
          <CardDescription>
            {results.length} result(s) awaiting your review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No results pending review
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Subject Teacher</TableHead>
                  <TableHead>Exam</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(result)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleReview(result.id, true, true)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve & Submit
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleReview(result.id, true, false)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve Only
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to reject this result?")) {
                              handleReview(result.id, false, false)
                            }
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Result Details</DialogTitle>
            <DialogDescription>
              Review result before approval
            </DialogDescription>
          </DialogHeader>
          {selectedResult && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Student</label>
                  <p className="text-sm">{selectedResult.student.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedResult.student.admissionNumber}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subject</label>
                  <p className="text-sm">
                    {selectedResult.classSubject.subject.name} ({selectedResult.classSubject.subject.code})
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subject Teacher</label>
                  <p className="text-sm">
                    {selectedResult.classSubject.teacher?.user.name || "Not assigned"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Exam</label>
                  <p className="text-sm">
                    {selectedResult.exam?.name || "N/A"} ({selectedResult.exam?.examType || "N/A"})
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Marks</label>
                  <p className="text-sm font-semibold">
                    {selectedResult.marksObtained} / {selectedResult.maxMarks}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Grade</label>
                  <p className="text-sm">{selectedResult.grade || "-"}</p>
                </div>
                {selectedResult.remarks && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">Remarks</label>
                    <p className="text-sm">{selectedResult.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              Close
            </Button>
            {selectedResult && (
              <>
                <Button
                  variant="default"
                  onClick={() => {
                    handleReview(selectedResult.id, true, true)
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve & Submit to Principal
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    handleReview(selectedResult.id, true, false)
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve Only
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Are you sure you want to reject this result?")) {
                      handleReview(selectedResult.id, false, false)
                    }
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

