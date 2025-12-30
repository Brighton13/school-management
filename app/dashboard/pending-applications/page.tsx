"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"

interface Application {
  id: string
  studentId: string
  appliedClassId: string
  appliedSectionId: string | null
  academicYear: string
  applicationStatus: string
  notes: string | null
  createdAt: string
  student: {
    admissionNumber: string
    user: {
      id: string
      name: string
      email: string
      phone: string | null
    }
    classEnrollment: Array<{
      class: { name: string }
      section: { name: string }
      academicYear: string
    }>
  }
  appliedClass: {
    id: string
    name: string
  }
  appliedSection: {
    id: string
    name: string
  } | null
  creator: {
    id: string
    name: string
    email: string
  }
}

interface Section {
  id: string
  name: string
  classId: string
}

export default function PendingApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [actionType, setActionType] = useState<"approve" | "reject" | "bulkApprove" | "bulkReject" | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string>("")
  const [rejectionReason, setRejectionReason] = useState<string>("")
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchPendingApplications()
  }, [])

  useEffect(() => {
    if (selectedApplication && actionType === "approve") {
      fetchSections(selectedApplication.appliedClassId)
      if (selectedApplication.appliedSectionId) {
        setSelectedSectionId(selectedApplication.appliedSectionId)
      }
    }
    if (actionType === "bulkApprove" && applications.length > 0) {
      const classIds = Array.from(new Set(applications.map(app => app.appliedClassId)))
      Promise.all(classIds.map(classId => 
        fetch(`/api/sections?classId=${classId}`).then(res => res.json())
      )).then(results => {
        setSections(results.flat())
      })
    }
  }, [selectedApplication, actionType, applications])

  const fetchPendingApplications = async () => {
    try {
      const res = await fetch("/api/applications/pending")
      const data = await res.json()
      setApplications(data)
    } catch (error) {
      console.error("Failed to fetch pending applications:", error)
      toast({
        title: "Error",
        description: "Failed to fetch pending applications",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchSections = async (classId: string) => {
    try {
      const res = await fetch(`/api/sections?classId=${classId}`)
      const data = await res.json()
      setSections(data)
    } catch (error) {
      console.error("Failed to fetch sections:", error)
      setSections([])
    }
  }

  const handleApprove = (application: Application) => {
    setSelectedApplication(application)
    setActionType("approve")
    setSelectedSectionId(application.appliedSectionId || "")
  }

  const handleReject = (application: Application) => {
    setSelectedApplication(application)
    setActionType("reject")
    setRejectionReason("")
  }

  const handleBulkApprove = () => {
    if (applications.length === 0) return
    setActionType("bulkApprove")
    setSelectedSectionId("")
  }

  const handleBulkReject = () => {
    if (applications.length === 0) return
    setActionType("bulkReject")
    setRejectionReason("")
  }

  const handleSubmitApproval = async () => {
    if (!selectedApplication || !selectedSectionId) {
      toast({
        title: "Error",
        description: "Please select a section",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const res = await fetch(`/api/applications/${selectedApplication.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSectionId,
          academicYear: selectedApplication.academicYear,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: "Application Approved",
          description: `${selectedApplication.student.user.name} has been enrolled successfully`,
        })
        setSelectedApplication(null)
        setActionType(null)
        fetchPendingApplications()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to approve application",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to approve application:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleSubmitRejection = async () => {
    if (!selectedApplication || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      })
      return
    }

    setProcessing(true)
    try {
      const res = await fetch(`/api/applications/${selectedApplication.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: "Application Rejected",
          description: `Application for ${selectedApplication.student.user.name} has been rejected`,
        })
        setSelectedApplication(null)
        setActionType(null)
        fetchPendingApplications()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to reject application",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to reject application:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleSubmitBulkApproval = async () => {
    if (!selectedSectionId) {
      toast({
        title: "Error",
        description: "Please select a section",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`Are you sure you want to approve all ${applications.length} pending applications and enroll them in the current academic year?`)) {
      return
    }

    setProcessing(true)
    try {
      const res = await fetch("/api/applications/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSectionId,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: "Bulk Approval Complete",
          description: `Successfully approved ${data.success} application(s). Failed: ${data.failed}`,
        })
        if (data.errors.length > 0) {
          console.error("Bulk approval errors:", data.errors)
        }
        setActionType(null)
        fetchPendingApplications()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to bulk approve applications",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to bulk approve:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleSubmitBulkRejection = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      })
      return
    }

    if (!confirm(`Are you sure you want to reject all ${applications.length} pending applications?`)) {
      return
    }

    setProcessing(true)
    try {
      const res = await fetch("/api/applications/bulk-reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: "Bulk Rejection Complete",
          description: `Successfully rejected ${data.success} application(s). Failed: ${data.failed}`,
        })
        if (data.errors.length > 0) {
          console.error("Bulk rejection errors:", data.errors)
        }
        setActionType(null)
        fetchPendingApplications()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to bulk reject applications",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to bulk reject:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleCloseDialog = () => {
    setSelectedApplication(null)
    setActionType(null)
    setSelectedSectionId("")
    setRejectionReason("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pending Applications</h1>
          <p className="text-muted-foreground">
            Review and approve student enrollment applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            <span className="text-lg font-semibold">{applications.length} Pending</span>
          </div>
          {applications.length > 0 && (
            <>
              <Button
                onClick={handleBulkApprove}
                disabled={processing}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve All
              </Button>
              <Button
                onClick={handleBulkReject}
                disabled={processing}
                variant="destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject All
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Application Queue</CardTitle>
          <CardDescription>
            Students waiting for enrollment approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending applications</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Applied Class</TableHead>
                  <TableHead>Suggested Section</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Previous Enrollment</TableHead>
                  <TableHead>Applied By</TableHead>
                  <TableHead>Applied Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((application) => {
                  const previousEnrollment = application.student.classEnrollment[0]
                  return (
                    <TableRow key={application.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{application.student.user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {application.student.user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{application.student.admissionNumber}</TableCell>
                      <TableCell>
                        <span className="font-medium">{application.appliedClass.name}</span>
                      </TableCell>
                      <TableCell>
                        {application.appliedSection?.name || (
                          <span className="text-muted-foreground italic">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell>{application.academicYear}</TableCell>
                      <TableCell>
                        {previousEnrollment ? (
                          <div className="text-sm">
                            <div>{previousEnrollment.class.name} - {previousEnrollment.section.name}</div>
                            <div className="text-muted-foreground">
                              ({previousEnrollment.academicYear})
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">New student</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{application.creator.name}</div>
                          <div className="text-muted-foreground">
                            {application.creator.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(application.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(application)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(application)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={actionType === "approve"} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Application</DialogTitle>
            <DialogDescription>
              Confirm enrollment details for {selectedApplication?.student.user.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <div className="p-2 bg-muted rounded">
                <div className="font-medium">{selectedApplication?.student.user.name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedApplication?.student.admissionNumber}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Class</Label>
              <div className="p-2 bg-muted rounded font-medium">
                {selectedApplication?.appliedClass.name}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="section">Section *</Label>
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                <SelectTrigger id="section">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <div className="p-2 bg-muted rounded">
                {selectedApplication?.academicYear}
              </div>
            </div>
            {selectedApplication?.notes && (
              <div className="space-y-2">
                <Label>Notes</Label>
                <div className="p-2 bg-muted rounded text-sm">
                  {selectedApplication.notes}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={processing}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitApproval} 
              disabled={!selectedSectionId || processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? "Processing..." : "Approve & Enroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={actionType === "reject"} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting {selectedApplication?.student.user.name}'s application
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <div className="p-2 bg-muted rounded">
                <div className="font-medium">{selectedApplication?.student.user.name}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedApplication?.student.admissionNumber}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={processing}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleSubmitRejection}
              disabled={!rejectionReason.trim() || processing}
            >
              {processing ? "Processing..." : "Reject Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approval Dialog */}
      <Dialog open={actionType === "bulkApprove"} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Approve Applications</DialogTitle>
            <DialogDescription>
              Approve all {applications.length} pending applications and enroll them in the current academic year
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-orange-50 border border-orange-200 rounded">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium">Important</p>
                  <p>All students will be enrolled in the same section for the current academic year</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-section">Section *</Label>
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                <SelectTrigger id="bulk-section">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={processing}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitBulkApproval}
              disabled={!selectedSectionId || processing}
              className="bg-green-600 hover:bg-green-700"
            >
              {processing ? "Processing..." : `Approve All ${applications.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Rejection Dialog */}
      <Dialog open={actionType === "bulkReject"} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Reject Applications</DialogTitle>
            <DialogDescription>
              Reject all {applications.length} pending applications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-medium">Warning</p>
                  <p>This action cannot be undone</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Rejection Reason *</Label>
              <Textarea
                id="bulk-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for bulk rejection..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={processing}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleSubmitBulkRejection}
              disabled={!rejectionReason.trim() || processing}
            >
              {processing ? "Processing..." : `Reject All ${applications.length}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
