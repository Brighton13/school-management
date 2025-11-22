"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckCircle, XCircle, Eye } from "lucide-react"

interface Result {
  id: string
  examType: string
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
      employeeId: string
    } | null
  }
  academicTerm: {
    name: string
    academicYear: string
  }
}

export default function ApprovalsPage() {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedResult, setSelectedResult] = useState<Result | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)

  useEffect(() => {
    fetchPendingResults()
  }, [])

  const fetchPendingResults = async () => {
    try {
      const res = await fetch("/api/results/pending-approval")
      const data = await res.json()
      setResults(data)
    } catch (error) {
      console.error("Failed to fetch pending results:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (resultId: string, approved: boolean, published: boolean = false) => {
    try {
      const res = await fetch(`/api/results/${resultId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved, published }),
      })

      if (res.ok) {
        fetchPendingResults()
        setIsViewDialogOpen(false)
        setSelectedResult(null)
      } else {
        const error = await res.json()
        alert(error.error || "Failed to process approval")
      }
    } catch (error) {
      console.error("Failed to process approval:", error)
      alert("Failed to process approval")
    }
  }

  const handleView = (result: Result) => {
    setSelectedResult(result)
    setIsViewDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Result Approvals</h1>
        <p className="text-muted-foreground">
          Review and approve results submitted by teachers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>
            {results.length} result(s) awaiting approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No results pending approval
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Exam Type</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell>{result.student.user.name}</TableCell>
                    <TableCell>{result.classSubject.class.name}</TableCell>
                    <TableCell>
                      {result.classSubject.subject.name} ({result.classSubject.subject.code})
                    </TableCell>
                    <TableCell>
                      {result.classSubject.teacher?.user.name || "Not assigned"}
                    </TableCell>
                    <TableCell>{result.examType}</TableCell>
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
                          onClick={() => handleApproval(result.id, true, true)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve & Publish
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApproval(result.id, true, false)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to reject this result?")) {
                              handleApproval(result.id, false, false)
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
                  <label className="text-sm font-medium text-muted-foreground">Class</label>
                  <p className="text-sm">{selectedResult.classSubject.class.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Subject</label>
                  <p className="text-sm">
                    {selectedResult.classSubject.subject.name} ({selectedResult.classSubject.subject.code})
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Teacher</label>
                  <p className="text-sm">
                    {selectedResult.classSubject.teacher?.user.name || "Not assigned"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Academic Term</label>
                  <p className="text-sm">
                    {selectedResult.academicTerm.name} - {selectedResult.academicTerm.academicYear}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Exam Type</label>
                  <p className="text-sm">{selectedResult.examType}</p>
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
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted At</label>
                  <p className="text-sm">
                    {selectedResult.submittedAt
                      ? new Date(selectedResult.submittedAt).toLocaleString()
                      : "-"}
                  </p>
                </div>
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
                    handleApproval(selectedResult.id, true, true)
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve & Publish
                </Button>
                <Button
                  variant="default"
                  onClick={() => {
                    handleApproval(selectedResult.id, true, false)
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
                      handleApproval(selectedResult.id, false, false)
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

