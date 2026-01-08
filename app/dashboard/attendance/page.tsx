"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Student {
  studentId: string
  studentName: string
  admissionNumber: string
  attendance: {
    status: string
    remarks?: string
  } | null
}

interface Section {
  id: string
  name: string
  class: {
    name: string
  }
}

export default function AttendancePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sections, setSections] = useState<Section[]>([])
  const [selectedSection, setSelectedSection] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  )
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attendanceStatus, setAttendanceStatus] = useState<
    Record<string, { status: string; remarks?: string }>
  >({})
  const [permissionDenied, setPermissionDenied] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.id) {
      fetchSections()
    }
  }, [session])

  const showMessage = (type: string, text: string) => {
    toast({
      title: type === "error" ? "Error" : "Success",
      description: text,
      variant: type === "error" ? "destructive" : "default",
    })
  }

  const fetchSections = async () => {
    try {
      const response = await fetch("/api/sections?teacherId=true")
      if (response.status === 401 || response.status === 403) {
        setPermissionDenied(true)
        return
      }
      const data = await response.json()
      setSections(data || [])
    } catch (error) {
      console.error("Error fetching sections:", error)
      showMessage("error", "Failed to load sections")
    }
  }

  const fetchAttendance = async () => {
    if (!selectedSection || !selectedDate) {
      showMessage("error", "Please select section and date")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `/api/attendance?sectionId=${selectedSection}&date=${selectedDate}`
      )

      const data = await response.json()

      if (!response.ok) {
        showMessage("error", data.error || "Failed to load attendance records")
        setStudents([])
        return
      }

      setStudents(data.students || [])

      const statusMap: Record<string, { status: string; remarks?: string }> = {}
      data.students.forEach((student: Student) => {
        if (student.attendance) {
          statusMap[student.studentId] = {
            status: student.attendance.status,
            remarks: student.attendance.remarks,
          }
        } else {
          statusMap[student.studentId] = { status: "ABSENT", remarks: "" }
        }
      })
      setAttendanceStatus(statusMap)
    } catch (error: any) {
      console.error("Error fetching attendance:", error)
      showMessage("error", error.message || "Failed to load attendance records")
    } finally {
      setLoading(false)
    }
  }

  const handleAttendanceChange = (
    studentId: string,
    status: string,
    remarks?: string
  ) => {
    setAttendanceStatus((prev) => ({
      ...prev,
      [studentId]: { status, remarks: remarks || "" },
    }))
  }

  const handleSaveAttendance = async () => {
    if (!selectedSection || !selectedDate) {
      showMessage("error", "Please select section and date")
      return
    }

    setSaving(true)
    try {
      const attendance = Object.entries(attendanceStatus).map(
        ([studentId, data]) => ({
          studentId,
          status: data.status,
          remarks: data.remarks,
        })
      )

      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sectionId: selectedSection,
          date: selectedDate,
          attendance,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        showMessage("error", result.error || "Failed to save attendance")
        return
      }

      showMessage("success", `Attendance saved successfully (${result.successCount} records)`)
      fetchAttendance()
    } catch (error: any) {
      console.error("Error saving attendance:", error)
      showMessage("error", error.message || "Failed to save attendance")
    } finally {
      setSaving(false)
    }
  }

  const markAllPresent = () => {
    const newStatus: Record<string, { status: string; remarks?: string }> = {}
    students.forEach((student) => {
      newStatus[student.studentId] = { status: "PRESENT", remarks: "" }
    })
    setAttendanceStatus(newStatus)
    showMessage("success", "All students marked as present")
  }

  const markAllAbsent = () => {
    const newStatus: Record<string, { status: string; remarks?: string }> = {}
    students.forEach((student) => {
      newStatus[student.studentId] = { status: "ABSENT", remarks: "" }
    })
    setAttendanceStatus(newStatus)
    showMessage("success", "All students marked as absent")
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-muted-foreground">
          Mark attendance for your class sections
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Section and Date</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Section</label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.class.name} - {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>

          <Button
            onClick={fetchAttendance}
            disabled={!selectedSection || !selectedDate || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load Attendance"
            )}
          </Button>
        </CardContent>
      </Card>

      {students.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Mark Attendance</CardTitle>
                <CardDescription>
                  {students.length} students in this section
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllPresent}
                  disabled={saving}
                >
                  Mark All Present
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAbsent}
                  disabled={saving}
                >
                  Mark All Absent
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Admission No.</TableHead>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium">
                        {student.admissionNumber}
                      </TableCell>
                      <TableCell>{student.studentName}</TableCell>
                      <TableCell>
                        <Select
                          value={attendanceStatus[student.studentId]?.status || "ABSENT"}
                          onValueChange={(value) =>
                            handleAttendanceChange(student.studentId, value)
                          }
                          disabled={saving}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRESENT">Present</SelectItem>
                            <SelectItem value="ABSENT">Absent</SelectItem>
                            <SelectItem value="LATE">Late</SelectItem>
                            <SelectItem value="EXCUSED">Excused</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          placeholder="Add remarks..."
                          value={
                            attendanceStatus[student.studentId]?.remarks || ""
                          }
                          onChange={(e) =>
                            handleAttendanceChange(
                              student.studentId,
                              attendanceStatus[student.studentId]?.status,
                              e.target.value
                            )
                          }
                          disabled={saving}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 flex gap-2">
              <Button
                onClick={handleSaveAttendance}
                disabled={saving || students.length === 0}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Save Attendance
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedSection && (
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
          <CardContent className="flex items-center gap-2 py-4">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Select a section to view and mark attendance
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

