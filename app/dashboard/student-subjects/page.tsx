"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, BookOpen } from "lucide-react"

interface Student {
  id: string
  admissionNumber: string
  user: {
    name: string
    email: string
  }
}

interface ClassSubject {
  id: string
  class: {
    id: string
    name: string
  }
  subject: {
    id: string
    name: string
    code: string
    type: string
  }
  teacher: {
    id: string
    user: {
      name: string
    }
  } | null
}

interface StudentSubjectSelection {
  createdAt: number
  id: string
  studentId: string
  classSubjectId: string
  academicYear: string
  term: string
  status: string
  classSubject: ClassSubject
}

interface Term {
  id: string
  name: string
  academicYear: {
    id: string
    year: string
  }
  startDate: string
  endDate: string
  isCurrent: boolean

}

export default function StudentSubjectsPage() {
  const { data: session } = useSession()
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>("")
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("")
  const [selectedTerm, setSelectedTerm] = useState<string>("")
  const [availableSubjects, setAvailableSubjects] = useState<ClassSubject[]>([])
  const [selectedSubjects, setSelectedSubjects] = useState<StudentSubjectSelection[]>([])
  const [loading, setLoading] = useState(true)
  const [isStudent, setIsStudent] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (session?.user.role === "STUDENT") {
      setIsStudent(true)
      fetchStudentData()
    } else {
      fetchData()
    }
  }, [session])

  useEffect(() => {
    if (selectedStudentId && selectedAcademicYear && selectedTerm) {
      fetchAvailableSubjects()
      fetchSelectedSubjects()
    }
  }, [selectedStudentId, selectedAcademicYear, selectedTerm])

  const fetchStudentData = async () => {
    try {
      // Get current student
      const studentRes = await fetch("/api/students")
      const studentsData = await studentRes.json()
      const currentStudent = studentsData.find(
        (s: any) => s.user.email === session?.user.email
      )
      if (currentStudent) {
        setSelectedStudentId(currentStudent.id)
        setStudents([currentStudent])
      }

      // Get current term
      const termsRes = await fetch("/api/terms")
      const termsData = await termsRes.json()
      const currentTerm = termsData.find((t: Term) => t.isCurrent)
      if (currentTerm) {
        setSelectedAcademicYear(currentTerm.academicYear.year)
        setSelectedTerm(currentTerm.name)
      }
    } catch (error) {
      console.error("Failed to fetch student data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      const [studentsRes, termsRes] = await Promise.all([
        fetch("/api/students"),
        fetch("/api/terms"),
      ])
      setStudents(await studentsRes.json())
      const terms = await termsRes.json()
      const currentTerm = terms.find((t: Term) => t.isCurrent)
      if (currentTerm) {
        setSelectedAcademicYear(currentTerm.academicYear.year)
        setSelectedTerm(currentTerm.name)
      }
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableSubjects = async () => {
    if (!selectedStudentId || !selectedAcademicYear || !selectedTerm) return

    try {
      // Get student's enrollment to find their class
      const enrollmentRes = await fetch(
        `/api/enrollment?studentId=${selectedStudentId}&academicYear=${selectedAcademicYear}&term=${selectedTerm}`
      )
      const enrollments = await enrollmentRes.json()
      const enrollment = enrollments.find(
        (e: any) => e.status === "ACTIVE"
      )

      if (!enrollment) {
        setAvailableSubjects([])
        return
      }

      // Get all class subjects for the student's class
      const classSubjectsRes = await fetch(
        `/api/class-subjects?classId=${enrollment.classId}`
      )
      const classSubjects = await classSubjectsRes.json()

      // Filter for ELECTIVE and OPTIONAL subjects only
      const electiveOptionalSubjects = classSubjects.filter(
        (cs: ClassSubject) =>
          cs.subject.type === "ELECTIVE" || cs.subject.type === "OPTIONAL"
      )

      setAvailableSubjects(electiveOptionalSubjects)
    } catch (error) {
      console.error("Failed to fetch available subjects:", error)
    }
  }

  const fetchSelectedSubjects = async () => {
    if (!selectedStudentId || !selectedAcademicYear || !selectedTerm) return

    try {
      const res = await fetch(
        `/api/student-subjects?studentId=${selectedStudentId}&academicYear=${selectedAcademicYear}&term=${selectedTerm}`
      )
      const data = await res.json()
      // Ensure we always set an array, even if API returns an error
      setSelectedSubjects(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to fetch selected subjects:", error)
      setSelectedSubjects([])
    }
  }

  const handleSelectSubject = async (classSubjectId: string) => {
    if (!selectedStudentId || !selectedAcademicYear || !selectedTerm) {
      alert("Please select student, academic year, and term")
      return
    }

    try {
      const res = await fetch("/api/student-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedStudentId,
          classSubjectId,
          academicYear: selectedAcademicYear,
          term: selectedTerm,
        }),
      })

      if (res.ok) {
        fetchSelectedSubjects()
        alert("Subject selected successfully")
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to select subject")
      }
    } catch (error) {
      console.error("Failed to select subject:", error)
      alert("Failed to select subject. Please try again.")
    }
  }

  const handleDeselectSubject = async (selectionId: string) => {
    if (!confirm("Are you sure you want to remove this subject selection?")) {
      return
    }

    try {
      const res = await fetch(`/api/student-subjects/${selectionId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        fetchSelectedSubjects()
        alert("Subject removed successfully")
      } else {
        const errorData = await res.json()
        alert(errorData.error || "Failed to remove subject")
      }
    } catch (error) {
      console.error("Failed to remove subject:", error)
      alert("Failed to remove subject. Please try again.")
    }
  }

  const isSubjectSelected = (classSubjectId: string) => {
    return selectedSubjects.some(
      (selection) =>
        selection.classSubjectId === classSubjectId &&
        selection.status === "ACTIVE"
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">Loading...</div>
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
        <h1 className="text-3xl font-bold">Subject Selection</h1>
        <p className="text-muted-foreground">
          Select elective and optional subjects for students
        </p>
      </div>

      {!isStudent && (
        <Card>
          <CardHeader>
            <CardTitle>Select Student</CardTitle>
            <CardDescription>Choose a student to manage their subject selections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="student">Student</Label>
                <Select
                  value={selectedStudentId}
                  onValueChange={setSelectedStudentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.user.name} ({student.admissionNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="academicYear">Academic Year</Label>
                <Select
                  value={selectedAcademicYear}
                  onValueChange={setSelectedAcademicYear}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select academic year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2023-2024">2023-2024</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">Term</Label>
                <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="First Term">First Term</SelectItem>
                    <SelectItem value="Second Term">Second Term</SelectItem>
                    <SelectItem value="Third Term">Third Term</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedStudentId && selectedAcademicYear && selectedTerm && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Available Subjects</CardTitle>
              <CardDescription>
                Select elective and optional subjects for the student
              </CardDescription>
            </CardHeader>
            <CardContent>
              {availableSubjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No elective or optional subjects available for this class
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableSubjects.map((subject) => {
                      const isSelected = isSubjectSelected(subject.id)
                      return (
                        <TableRow key={subject.id}>
                          <TableCell className="font-medium">
                            {subject.subject.name}
                          </TableCell>
                          <TableCell>{subject.subject.code}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                subject.subject.type === "ELECTIVE"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {subject.subject.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            {subject.teacher?.user.name || "Not assigned"}
                          </TableCell>
                          <TableCell>
                            {isSelected ? (
                              <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                                Selected
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 border">
                                Available
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {isSelected ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const selection = selectedSubjects.find(
                                    (s) => s.classSubjectId === subject.id
                                  )
                                  if (selection) {
                                    handleDeselectSubject(selection.id)
                                  }
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Remove
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectSubject(subject.id)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Select
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selected Subjects</CardTitle>
              <CardDescription>
                Currently selected elective and optional subjects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedSubjects.filter((s) => s.status === "ACTIVE").length ===
              0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No subjects selected yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Selected At</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSubjects
                      .filter((s) => s.status === "ACTIVE")
                      .map((selection) => (
                        <TableRow key={selection.id}>
                          <TableCell className="font-medium">
                            {selection.classSubject.subject.name}
                          </TableCell>
                          <TableCell>
                            {selection.classSubject.subject.code}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                selection.classSubject.subject.type === "ELECTIVE"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {selection.classSubject.subject.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            {selection.classSubject.teacher?.user.name ||
                              "Not assigned"}
                          </TableCell>
                          <TableCell>
                            {new Date(selection.createdAt || Date.now()).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeselectSubject(selection.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

