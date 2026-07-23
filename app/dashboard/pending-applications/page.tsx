"use client"

import { useEffect, useState } from "react"
import { PermissionDenied } from "@/components/ui/permission-denied"
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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Clock, AlertCircle, Eye, Pencil, Users, Search } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import { Pagination, usePagination, PaginationInfo, buildPaginatedQuery } from "@/components/ui/pagination"

interface Application {
  id: string
  studentId: string
  appliedClassId: string
  appliedSectionId: string | null
  academicYear: {
    id: string
    year: string
  }
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
      academicYear: {
        id: string
        year: string
      }
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
  capacity?: number
  _count?: {
    enrollments: number
  }
}

interface ClassOption {
  id: string
  name: string
}

export default function PendingApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [actionType, setActionType] = useState<"approve" | "reject" | "bulkApprove" | "bulkReject" | "review" | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState<string>("")
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [rejectionReason, setRejectionReason] = useState<string>("")
  const [editNotes, setEditNotes] = useState<string>("")
  const [processing, setProcessing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const { toast } = useToast()
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClassId, setFilterClassId] = useState("all")
  const { page, limit, setPage, setLimit, reset: resetPagination } = usePagination(25)
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
    hasMore: false,
  })

  useEffect(() => {
    fetchPendingApplications()
    fetchClasses()
  }, [])

  useEffect(() => {
    fetchPendingApplications()
  }, [page, limit, filterClassId])

  useEffect(() => {
    const timer = setTimeout(() => {
      resetPagination()
      fetchPendingApplications()
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    if (selectedApplication && (actionType === "approve" || actionType === "review")) {
      fetchSectionsWithCount(selectedApplication.appliedClassId)
      if (selectedApplication.appliedSectionId) {
        setSelectedSectionId(selectedApplication.appliedSectionId)
      }
      setSelectedClassId(selectedApplication.appliedClassId)
      setEditNotes(selectedApplication.notes || "")
    }
    if (actionType === "bulkApprove" && applications.length > 0) {
      const classIds = Array.from(new Set(applications.map(app => app.appliedClassId)))
      Promise.all(classIds.map(classId => 
        fetch(`/api/sections?classId=${classId}&noPagination=true`).then(res => res.json())
      )).then(results => {
        const flatResults = results.flat()
        setSections(Array.isArray(flatResults) ? flatResults : [])
      })
    }
  }, [selectedApplication, actionType, applications])

  // Fetch sections when class changes in review mode
  useEffect(() => {
    if (selectedClassId && actionType === "review") {
      fetchSectionsWithCount(selectedClassId)
    }
  }, [selectedClassId, actionType])

  const fetchPendingApplications = async () => {
    try {
      setLoading(true)
      const queryString = buildPaginatedQuery(
        {
          search: searchTerm || undefined,
          classId: filterClassId === "all" ? undefined : filterClassId,
        },
        { page, limit }
      )
      const res = await fetch(`/api/applications/pending?${queryString}`)
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setApplications(data.data || [])
      if (data.pagination) setPaginationInfo(data.pagination)
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

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/classes?noPagination=true")
      const data = await res.json()
      setClasses(Array.isArray(data) ? data : (data.data || []))
    } catch (error) {
      console.error("Failed to fetch classes:", error)
    }
  }

  const fetchSectionsWithCount = async (classId: string) => {
    try {
      const res = await fetch(`/api/sections?classId=${classId}&noPagination=true`)
      const data = await res.json()
      setSections(Array.isArray(data) ? data : (data.data || []))
    } catch (error) {
      console.error("Failed to fetch sections:", error)
      setSections([])
    }
  }

  const handleReview = (application: Application) => {
    setSelectedApplication(application)
    setActionType("review")
    setSelectedSectionId(application.appliedSectionId || "")
    setSelectedClassId(application.appliedClassId)
    setEditNotes(application.notes || "")
    setIsEditing(false)
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

  const handleUpdateApplication = async () => {
    if (!selectedApplication) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/applications/${selectedApplication.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appliedClassId: selectedClassId,
          appliedSectionId: selectedSectionId || null,
          notes: editNotes.trim() || null,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        toast({
          title: "Application Updated",
          description: "Application details have been updated successfully",
        })
        setIsEditing(false)
        fetchPendingApplications()
        // Update the selected application with new data
        setSelectedApplication({
          ...selectedApplication,
          appliedClassId: selectedClassId,
          appliedSectionId: selectedSectionId || null,
          notes: editNotes.trim() || null,
          appliedClass: classes.find(c => c.id === selectedClassId) || selectedApplication.appliedClass,
          appliedSection: sections.find(s => s.id === selectedSectionId) || null,
        } as Application)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update application",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to update application:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleApproveFromReview = () => {
    if (!selectedApplication) return
    setActionType("approve")
    // Keep the same section if already selected
    if (!selectedSectionId && selectedApplication.appliedSectionId) {
      setSelectedSectionId(selectedApplication.appliedSectionId)
    }
  }

  const handleRejectFromReview = () => {
    if (!selectedApplication) return
    setActionType("reject")
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
          academicYear: selectedApplication.academicYear.year,
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
    if (!confirm(`Are you sure you want to approve all ${applications.length} pending applications? Each student will be enrolled in their applied class and section.`)) {
      return
    }

    setProcessing(true)
    try {
      const res = await fetch("/api/applications/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
    setSelectedClassId("")
    setRejectionReason("")
    setEditNotes("")
    setIsEditing(false)
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
            Search and filter pending applications without loading the full queue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_240px]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Select
              value={filterClassId}
              onValueChange={(value) => {
                setFilterClassId(value)
                resetPagination()
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Applied class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                      <TableCell>{application.academicYear.year}</TableCell>
                      <TableCell>
                        {previousEnrollment ? (
                          <div className="text-sm">
                            <div>{previousEnrollment.class.name} - {previousEnrollment.section.name}</div>
                            <div className="text-muted-foreground">
                              ({previousEnrollment.academicYear.year})
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
                            variant="outline"
                            onClick={() => handleReview(application)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Review
                          </Button>
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
          {paginationInfo.total > 0 && (
            <Pagination pagination={paginationInfo} onPageChange={setPage} onLimitChange={setLimit} />
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
                {selectedApplication?.academicYear?.year}
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

      {/* Review & Edit Dialog */}
      <Dialog open={actionType === "review"} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Review Application
            </DialogTitle>
            <DialogDescription>
              Review and edit application details before approval or rejection
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Student Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Student Name</Label>
                <div className="p-2 bg-muted rounded">
                  <div className="font-medium">{selectedApplication?.student.user.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedApplication?.student.user.email}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Admission Number</Label>
                <div className="p-2 bg-muted rounded font-medium">
                  {selectedApplication?.student.admissionNumber}
                </div>
              </div>
            </div>

            {/* Previous Enrollment */}
            {selectedApplication?.student.classEnrollment[0] && (
              <div className="space-y-2">
                <Label>Previous Enrollment</Label>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                  <span className="font-medium">
                    {selectedApplication.student.classEnrollment[0].class.name} - {selectedApplication.student.classEnrollment[0].section.name}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    ({selectedApplication.student.classEnrollment[0].academicYear.year})
                  </span>
                </div>
              </div>
            )}

            {/* Editable Fields */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Application Details</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  {isEditing ? "Cancel Edit" : "Edit"}
                </Button>
              </div>

              {/* Class Selection */}
              <div className="space-y-2">
                <Label htmlFor="review-class">Class</Label>
                {isEditing ? (
                  <Select 
                    value={selectedClassId} 
                    onValueChange={(value) => {
                      setSelectedClassId(value)
                      setSelectedSectionId("")
                      // Fetch sections for new class
                      const selectedClass = classes.find(c => c.id === value)
                      if (selectedClass) {
                        fetchSectionsWithCount(value)
                      }
                    }}
                  >
                    <SelectTrigger id="review-class">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 bg-muted rounded font-medium">
                    {selectedApplication?.appliedClass.name}
                  </div>
                )}
              </div>

              {/* Section Selection with Enrollment Count */}
              <div className="space-y-2">
                <Label htmlFor="review-section" className="flex items-center gap-2">
                  Section
                  <Badge variant="outline" className="font-normal">
                    <Users className="h-3 w-3 mr-1" />
                    Shows enrollment count
                  </Badge>
                </Label>
                {isEditing ? (
                  <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                    <SelectTrigger id="review-section">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{section.name}</span>
                            <Badge variant="secondary" className="ml-2">
                              <Users className="h-3 w-3 mr-1" />
                              {section._count?.enrollments || 0} students
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2 bg-muted rounded">
                    {selectedApplication?.appliedSection ? (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{selectedApplication.appliedSection.name}</span>
                        {sections.find(s => s.id === selectedApplication.appliedSection?.id) && (
                          <Badge variant="secondary">
                            <Users className="h-3 w-3 mr-1" />
                            {sections.find(s => s.id === selectedApplication.appliedSection?.id)?._count?.enrollments || 0} students
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Not specified</span>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="review-notes">Notes</Label>
                {isEditing ? (
                  <Textarea
                    id="review-notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this application..."
                    rows={3}
                  />
                ) : (
                  <div className="p-2 bg-muted rounded text-sm min-h-[60px]">
                    {selectedApplication?.notes || (
                      <span className="text-muted-foreground italic">No notes</span>
                    )}
                  </div>
                )}
              </div>

              {/* Academic Year */}
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <div className="p-2 bg-muted rounded">
                  {selectedApplication?.academicYear?.year}
                </div>
              </div>
            </div>

            {/* Application Meta */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Applied By</Label>
                <div className="mt-1">
                  {selectedApplication?.creator.name}
                  <span className="text-muted-foreground ml-1">
                    ({selectedApplication?.creator.email})
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Applied Date</Label>
                <div className="mt-1">
                  {selectedApplication && formatDate(selectedApplication.createdAt)}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isEditing && (
              <Button 
                variant="outline" 
                onClick={handleUpdateApplication}
                disabled={processing}
                className="sm:mr-auto"
              >
                {processing ? "Saving..." : "Save Changes"}
              </Button>
            )}
            <Button variant="outline" onClick={handleCloseDialog} disabled={processing}>
              Close
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRejectFromReview}
              disabled={processing}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
            <Button 
              onClick={handleApproveFromReview}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
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
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">How it works</p>
                  <p>Each student will be enrolled in their applied class and section as specified in their application.</p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800">
                  <p className="font-medium">Note</p>
                  <p>Applications without a specified section will fail. Review individual applications if needed.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={processing}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitBulkApproval}
              disabled={processing}
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
