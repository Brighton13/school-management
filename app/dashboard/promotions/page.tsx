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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  ArrowRight,
  Users,
  GraduationCap,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  RefreshCw,
  Award,
  Ban,
  UserMinus,
  Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Enrollment status options
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active", color: "bg-green-100 text-green-800" },
  { value: "PROMOTED", label: "Promoted", color: "bg-blue-100 text-blue-800" },
  { value: "GRADUATED", label: "Graduated", color: "bg-purple-100 text-purple-800" },
  { value: "REPEATED", label: "Repeated", color: "bg-orange-100 text-orange-800" },
  { value: "WITHDRAWN", label: "Withdrawn", color: "bg-gray-100 text-gray-800" },
  { value: "TRANSFERRED", label: "Transferred", color: "bg-yellow-100 text-yellow-800" },
  { value: "EXPELLED", label: "Expelled", color: "bg-red-100 text-red-800" },
  { value: "SUSPENDED", label: "Suspended", color: "bg-amber-100 text-amber-800" },
]

interface Section {
  id: string
  name: string
}

interface ClassWithDetails {
  id: string
  name: string
  level: number
  sections: Section[]
  enrollmentCount: number
  nextClass: {
    id: string
    name: string
    level: number
  } | null
}

interface Enrollment {
  id: string
  student: {
    id: string
    admissionNumber: string
    user: {
      name: string
      email: string
    }
  }
  class: { id: string; name: string }
  section: { id: string; name: string }
  academicYear: { id: string; year: string }
  status: string
}

interface AcademicYear {
  id: string
  year: string
  isCurrent: boolean
  isUpcoming: boolean
}

interface PromotionResult {
  promoted: number
  graduated: number
  failed: number
  errors: string[]
}

export default function PromotionsPage() {
  const { toast } = useToast()
  const [classes, setClasses] = useState<ClassWithDetails[]>([])
  const [currentAcademicYear, setCurrentAcademicYear] = useState<AcademicYear | null>(null)
  const [upcomingAcademicYear, setUpcomingAcademicYear] = useState<AcademicYear | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Selection states
  const [selectedClassId, setSelectedClassId] = useState<string>("")
  const [selectedSectionId, setSelectedSectionId] = useState<string>("all")
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)

  // Dialog states
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false)
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [promotionResult, setPromotionResult] = useState<PromotionResult | null>(null)
  const [currentClassInfo, setCurrentClassInfo] = useState<ClassWithDetails | null>(null)
  const [nextClassInfo, setNextClassInfo] = useState<{ id: string; name: string } | null>(null)
  const [isGraduationMode, setIsGraduationMode] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>("")
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("")

  useEffect(() => {
    fetchClasses()
  }, [])

  useEffect(() => {
    if (selectedClassId) {
      fetchEnrollments()
    } else {
      setEnrollments([])
      setSelectedStudents([])
      setSelectAll(false)
    }
  }, [selectedClassId, selectedSectionId])

  useEffect(() => {
    if (selectAll) {
      setSelectedStudents(enrollments.map((e) => e.student.id))
    } else if (selectedStudents.length === enrollments.length && enrollments.length > 0) {
      // Keep as is - all were manually selected
    }
  }, [selectAll])

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/promotions")
      const data = await res.json()

      if (res.ok) {
        setClasses(data.classes || [])
        setCurrentAcademicYear(data.currentAcademicYear)
        setUpcomingAcademicYear(data.upcomingAcademicYear)
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to fetch classes",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch promotion data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEnrollments = async () => {
    if (!selectedClassId) return

    try {
      const sectionParam = selectedSectionId !== "all" ? `&sectionId=${selectedSectionId}` : ""
      const res = await fetch(`/api/promotions?classId=${selectedClassId}${sectionParam}`)
      const data = await res.json()

      if (res.ok) {
        setEnrollments(data.enrollments || [])
        setCurrentClassInfo(data.currentClass)
        setNextClassInfo(data.nextClass)
        setSelectedStudents([])
        setSelectAll(false)
      }
    } catch (error) {
      console.error("Failed to fetch enrollments:", error)
    }
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setSelectedStudents(enrollments.map((e) => e.student.id))
    } else {
      setSelectedStudents([])
    }
  }

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents([...selectedStudents, studentId])
    } else {
      setSelectedStudents(selectedStudents.filter((id) => id !== studentId))
      setSelectAll(false)
    }
  }

  const handleOpenConfirmDialog = (graduationMode = false) => {
    if (selectedStudents.length === 0) {
      toast({
        title: "No Students Selected",
        description: "Please select at least one student",
        variant: "destructive",
      })
      return
    }

    // For graduation, we don't need upcoming year or next class
    if (graduationMode) {
      setIsGraduationMode(true)
      setIsConfirmDialogOpen(true)
      return
    }

    // For promotion, check requirements
    if (!nextClassInfo) {
      toast({
        title: "Final Level Class",
        description: `${currentClassInfo?.name} is the highest level. Use "Graduate" instead.`,
        variant: "destructive",
      })
      return
    }

    if (!upcomingAcademicYear) {
      toast({
        title: "No Upcoming Academic Year",
        description: "Please create an upcoming academic year before promoting students",
        variant: "destructive",
      })
      return
    }

    setIsGraduationMode(false)
    setIsConfirmDialogOpen(true)
  }

  const handlePromote = async () => {
    setProcessing(true)
    try {
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: selectedClassId,
          sectionId: selectedSectionId !== "all" ? selectedSectionId : undefined,
          studentIds: selectedStudents,
          targetAcademicYearId: upcomingAcademicYear?.id,
          action: isGraduationMode ? "graduate" : "promote",
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setPromotionResult(data.results)
        setIsConfirmDialogOpen(false)
        setIsResultDialogOpen(true)
        // Refresh data
        fetchClasses()
        fetchEnrollments()
      } else {
        toast({
          title: "Promotion Failed",
          description: data.error || "Failed to promote students",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const handlePromoteAll = async (classId: string, graduateMode = false) => {
    const cls = classes.find((c) => c.id === classId)
    if (!cls) return

    if (!graduateMode && !cls.nextClass) {
      toast({
        title: "Final Level Class",
        description: `${cls.name} is the highest level. Use "Graduate All" instead.`,
        variant: "destructive",
      })
      return
    }

    if (!graduateMode && !upcomingAcademicYear) {
      toast({
        title: "No Upcoming Academic Year",
        description: "Please create an upcoming academic year before promoting students",
        variant: "destructive",
      })
      return
    }

    setCurrentClassInfo(cls)
    setNextClassInfo(cls.nextClass)
    setSelectedClassId(classId)
    setSelectedSectionId("all")
    setIsGraduationMode(graduateMode)

    // Fetch all enrollments for this class
    const res = await fetch(`/api/promotions?classId=${classId}`)
    const data = await res.json()
    
    if (data.enrollments) {
      setEnrollments(data.enrollments)
      setSelectedStudents(data.enrollments.map((e: Enrollment) => e.student.id))
      setIsConfirmDialogOpen(true)
    }
  }

  const handleOpenStatusDialog = (enrollmentId: string, currentStatus: string) => {
    setSelectedEnrollmentId(enrollmentId)
    setSelectedStatus(currentStatus)
    setIsStatusDialogOpen(true)
  }

  const handleUpdateStatus = async () => {
    if (!selectedEnrollmentId || !selectedStatus) return

    setProcessing(true)
    try {
      const res = await fetch(`/api/enrollment/${selectedEnrollmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus }),
      })

      if (res.ok) {
        toast({
          title: "Status Updated",
          description: `Enrollment status updated to ${selectedStatus}`,
        })
        setIsStatusDialogOpen(false)
        fetchEnrollments()
        fetchClasses()
      } else {
        const data = await res.json()
        toast({
          title: "Error",
          description: data.error || "Failed to update status",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status)
    return statusOption ? statusOption.color : "bg-gray-100 text-gray-800"
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId)
  const sections = selectedClass?.sections || []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Student Promotions</h1>
          <p className="text-muted-foreground">
            Promote students to the next class level for the upcoming academic year
          </p>
        </div>
        <div className="flex items-center gap-4">
          {currentAcademicYear && (
            <Badge variant="outline" className="text-sm py-1 px-3">
              Current: {currentAcademicYear.year}
            </Badge>
          )}
          {upcomingAcademicYear ? (
            <Badge className="bg-green-100 text-green-800 text-sm py-1 px-3">
              Upcoming: {upcomingAcademicYear.year}
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-sm py-1 px-3">
              No Upcoming Year Set
            </Badge>
          )}
        </div>
      </div>

      {!upcomingAcademicYear && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800">Upcoming Academic Year Required</p>
                <p className="text-sm text-orange-700">
                  Please create an upcoming academic year in Academic Year Management before promoting students.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classes.map((cls) => (
          <Card key={cls.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{cls.name}</CardTitle>
                <Badge variant="secondary">Level {cls.level}</Badge>
              </div>
              <CardDescription>
                {cls.sections.length} section(s) • {cls.enrollmentCount} student(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{cls.enrollmentCount} enrolled</span>
                </div>
                {cls.nextClass ? (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span>→</span>
                    <span>{cls.nextClass.name}</span>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs">Final Level</Badge>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setSelectedClassId(cls.id)
                    setSelectedSectionId("all")
                  }}
                >
                  View Students
                </Button>
                {cls.nextClass && cls.enrollmentCount > 0 && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handlePromoteAll(cls.id, false)}
                    disabled={!upcomingAcademicYear}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    Promote All
                  </Button>
                )}
                {!cls.nextClass && cls.enrollmentCount > 0 && (
                  <Button
                    size="sm"
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    onClick={() => handlePromoteAll(cls.id, true)}
                  >
                    <Award className="h-4 w-4 mr-1" />
                    Graduate All
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Student Selection Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Select Students to Promote
          </CardTitle>
          <CardDescription>
            Choose a class and section to view and select students for promotion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="w-64">
              <Label>Class</Label>
              <Select value={selectedClassId} onValueChange={(value) => {
                setSelectedClassId(value)
                setSelectedSectionId("all")
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.enrollmentCount} students)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedClassId && sections.length > 0 && (
              <div className="w-48">
                <Label>Section</Label>
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        Section {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedClassId && nextClassInfo && (
              <div className="flex items-end gap-2 ml-auto">
                <div className="text-sm text-muted-foreground mb-2">
                  {selectedStudents.length} of {enrollments.length} selected
                </div>
                <Button
                  onClick={() => handleOpenConfirmDialog(false)}
                  disabled={selectedStudents.length === 0 || !upcomingAcademicYear}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Promote Selected
                </Button>
              </div>
            )}

            {selectedClassId && !nextClassInfo && (
              <div className="flex items-end gap-2 ml-auto">
                <div className="text-sm text-muted-foreground mb-2">
                  {selectedStudents.length} of {enrollments.length} selected
                </div>
                <Button
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => handleOpenConfirmDialog(true)}
                  disabled={selectedStudents.length === 0}
                >
                  <Award className="h-4 w-4 mr-2" />
                  Graduate Selected
                </Button>
              </div>
            )}
          </div>

          {selectedClassId && currentClassInfo && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${!nextClassInfo ? 'bg-purple-50' : 'bg-blue-50'}`}>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{currentClassInfo.name}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                {nextClassInfo ? (
                  <Badge className="bg-green-100 text-green-800">
                    {nextClassInfo.name}
                  </Badge>
                ) : (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Award className="h-3 w-3 mr-1" />
                    GRADUATED
                  </Badge>
                )}
              </div>
              <span className="text-sm text-muted-foreground ml-2">
                {nextClassInfo 
                  ? `Students will be promoted to the same section in ${nextClassInfo.name}`
                  : "Final level - students will be marked as GRADUATED"
                }
              </span>
            </div>
          )}

          {selectedClassId && enrollments.length > 0 && (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectAll || (selectedStudents.length === enrollments.length && enrollments.length > 0)}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Current Section</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => {
                    const isSelected = selectedStudents.includes(enrollment.student.id)
                    return (
                      <TableRow key={enrollment.id}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectStudent(enrollment.student.id, checked as boolean)
                            }
                            disabled={enrollment.status !== "ACTIVE"}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {enrollment.student.user.name}
                        </TableCell>
                        <TableCell>{enrollment.student.admissionNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {enrollment.class.name} - {enrollment.section.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {nextClassInfo ? (
                            <Badge className="bg-green-100 text-green-800">
                              {nextClassInfo.name} - {enrollment.section.name}
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-100 text-purple-800">
                              <Award className="h-3 w-3 mr-1" />
                              GRADUATED
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(enrollment.status)}>
                            {enrollment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStatusDialog(enrollment.id, enrollment.status)}
                          >
                            Change Status
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {selectedClassId && enrollments.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active enrollments found for this class/section</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isGraduationMode ? "Confirm Graduation" : "Confirm Promotion"}
            </DialogTitle>
            <DialogDescription>
              {isGraduationMode
                ? "You are about to graduate students from their final level"
                : "You are about to promote students to the next class level"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className={`flex items-center justify-between p-3 rounded-lg ${isGraduationMode ? 'bg-purple-50' : 'bg-muted'}`}>
              <div>
                <p className="font-medium">{currentClassInfo?.name}</p>
                <p className="text-sm text-muted-foreground">Current Class</p>
              </div>
              <ArrowRight className="h-5 w-5" />
              <div>
                <p className="font-medium">
                  {isGraduationMode ? (
                    <span className="flex items-center gap-1">
                      <Award className="h-4 w-4" />
                      GRADUATED
                    </span>
                  ) : (
                    nextClassInfo?.name
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isGraduationMode ? "Final Status" : "Target Class"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Students to {isGraduationMode ? "graduate" : "promote"}:</span>
                <span className="font-medium">{selectedStudents.length}</span>
              </div>
              {!isGraduationMode && (
                <div className="flex justify-between text-sm">
                  <span>Target Academic Year:</span>
                  <span className="font-medium">{upcomingAcademicYear?.year}</span>
                </div>
              )}
            </div>
            <div className={`p-3 border rounded ${isGraduationMode ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex gap-2">
                <AlertCircle className={`h-5 w-5 flex-shrink-0 ${isGraduationMode ? 'text-purple-600' : 'text-blue-600'}`} />
                <p className={`text-sm ${isGraduationMode ? 'text-purple-800' : 'text-blue-800'}`}>
                  {isGraduationMode
                    ? "Students will be marked as GRADUATED. They will no longer appear in active enrollments."
                    : "Students will be promoted to the same section name in the new class. Their current enrollment status will be marked as \"PROMOTED\"."
                  }
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePromote} 
              disabled={processing}
              className={isGraduationMode ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : isGraduationMode ? (
                <>
                  <Award className="h-4 w-4 mr-2" />
                  Confirm Graduation
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Confirm Promotion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={isResultDialogOpen} onOpenChange={setIsResultDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {(promotionResult?.graduated || 0) > 0 ? "Graduation Complete" : "Promotion Complete"}
            </DialogTitle>
            <DialogDescription>
              Review the results below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              {(promotionResult?.promoted || 0) > 0 && (
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-700">
                    {promotionResult?.promoted || 0}
                  </p>
                  <p className="text-sm text-green-600">Promoted</p>
                </div>
              )}
              {(promotionResult?.graduated || 0) > 0 && (
                <div className="p-4 bg-purple-50 rounded-lg text-center">
                  <Award className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-700">
                    {promotionResult?.graduated || 0}
                  </p>
                  <p className="text-sm text-purple-600">Graduated</p>
                </div>
              )}
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-700">
                  {promotionResult?.failed || 0}
                </p>
                <p className="text-sm text-red-600">Failed</p>
              </div>
            </div>
            {promotionResult?.errors && promotionResult.errors.length > 0 && (
              <div className="space-y-2">
                <Label>Errors:</Label>
                <div className="max-h-40 overflow-y-auto p-3 bg-red-50 rounded text-sm text-red-700">
                  {promotionResult.errors.map((error, index) => (
                    <p key={index}>• {error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsResultDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Enrollment Status</DialogTitle>
            <DialogDescription>
              Update the enrollment status for this student
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <Badge className={status.color}>{status.label}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Status Descriptions:</Label>
              <div className="text-xs space-y-1 p-3 bg-muted rounded">
                <p><strong>Active:</strong> Currently enrolled and attending</p>
                <p><strong>Promoted:</strong> Moved to next class level</p>
                <p><strong>Graduated:</strong> Completed final level</p>
                <p><strong>Repeated:</strong> Repeating the same class</p>
                <p><strong>Withdrawn:</strong> Voluntarily left the school</p>
                <p><strong>Transferred:</strong> Moved to another school</p>
                <p><strong>Expelled:</strong> Permanently removed from school</p>
                <p><strong>Suspended:</strong> Temporarily removed from classes</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={processing}>
              {processing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
