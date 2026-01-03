"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PermissionDenied } from "@/components/ui/permission-denied"

interface ClassEnrollment {
  id: string
  student: {
    id: string
    user: {
      name: string
      email: string
      admissionNumber?: string
    }
  }
  section: {
    id: string
    name: string
    class: {
      id: string
      name: string
    }
  }
}

interface Term {
  id: string
  name: string
  academicYear: {
    year: string
  }
}

interface Exam {
  id: string
  name: string
  examType: string
}

export default function GenerateReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [sections, setSections] = useState<any[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [enrollments, setEnrollments] = useState<ClassEnrollment[]>([])

  const [selectedSection, setSelectedSection] = useState("")
  const [selectedTerm, setSelectedTerm] = useState("")
  const [selectedExam, setSelectedExam] = useState("")
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [generatingStudents, setGeneratingStudents] = useState<string[]>([])
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (session?.user?.role === "TEACHER") {
      fetchSections()
      fetchTerms()
      fetchExams()
    }
  }, [status, session])

  const fetchSections = async () => {
    try {
      const response = await fetch("/api/sections")
      if (!response.ok) throw new Error("Failed to fetch sections")
      const data = await response.json()
      setSections(data)
    } catch (err) {
      console.error("Error fetching sections:", err)
    }
  }

  const fetchTerms = async () => {
    try {
      const response = await fetch("/api/terms")
      if (!response.ok) throw new Error("Failed to fetch terms")
      const data = await response.json()
      setTerms(data)
    } catch (err) {
      console.error("Error fetching terms:", err)
    }
  }

  const fetchExams = async () => {
    try {
      const response = await fetch("/api/exams")
      if (!response.ok) throw new Error("Failed to fetch exams")
      const data = await response.json()
      setExams(data)
    } catch (err) {
      console.error("Error fetching exams:", err)
    }
  }

  const fetchEnrollments = async (sectionId: string, termId: string) => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/class-enrollments?sectionId=${sectionId}&termId=${termId}`
      )
      if (!response.ok) throw new Error("Failed to fetch enrollments")
      const data = await response.json()
      setEnrollments(data)
      setError("")
    } catch (err) {
      console.error("Error fetching enrollments:", err)
      setError("Failed to load students")
    } finally {
      setLoading(false)
    }
  }

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sectionId = e.target.value
    setSelectedSection(sectionId)
    setSelectedStudents([])
    setEnrollments([])

    if (sectionId && selectedTerm) {
      fetchEnrollments(sectionId, selectedTerm)
    }
  }

  const handleTermChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const termId = e.target.value
    setSelectedTerm(termId)
    setSelectedStudents([])
    setEnrollments([])

    if (selectedSection && termId) {
      fetchEnrollments(selectedSection, termId)
    }
  }

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    )
  }

  const handleGenerateReports = async () => {
    if (!selectedSection || !selectedTerm || selectedStudents.length === 0) {
      setError("Please select section, term, and at least one student")
      return
    }

    try {
      setLoading(true)
      setError("")
      setSuccess("")
      setGeneratingStudents([...selectedStudents])

      const promises = selectedStudents.map(studentId =>
        fetch("/api/reports/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            sectionId: selectedSection,
            termId: selectedTerm,
            examId: selectedExam || null
          })
        }).then(async res => {
          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || "Failed to generate report")
          }
          return res.json()
        })
      )

      const results = await Promise.allSettled(promises)

      const successful = results.filter(r => r.status === "fulfilled").length
      const failed = results.filter(r => r.status === "rejected").length

      if (successful > 0) {
        setSuccess(`Successfully generated ${successful} report(s)`)
        setSelectedStudents([])
      }

      if (failed > 0) {
        setError(`Failed to generate ${failed} report(s)`)
      }

      setGeneratingStudents([])
    } catch (err) {
      console.error("Error generating reports:", err)
      setError("Failed to generate reports")
      setGeneratingStudents([])
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading") {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (!session || session.user?.role !== "TEACHER") {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">You do not have access to this page</p>
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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Generate Student Reports</h1>
        <p className="text-gray-600">
          Generate report cards for students after all results have been approved
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Section
            </label>
            <select
              value={selectedSection}
              onChange={handleSectionChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
              disabled={loading}
            >
              <option value="">-- Select Section --</option>
              {sections.map(section => (
                <option key={section.id} value={section.id}>
                  {section.class.name} - {section.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Academic Term
            </label>
            <select
              value={selectedTerm}
              onChange={handleTermChange}
              className="w-full border border-gray-300 rounded px-3 py-2"
              disabled={loading}
            >
              <option value="">-- Select Term --</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>
                  {term.name} ({term.academicYear.year})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Exam (Optional)
            </label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              disabled={loading}
            >
              <option value="">-- All Exams --</option>
              {exams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.name} ({exam.examType})
                </option>
              ))}
            </select>
          </div>
        </div>

        {enrollments.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Select Students</h3>
              <button
                onClick={() =>
                  selectedStudents.length === enrollments.length
                    ? setSelectedStudents([])
                    : setSelectedStudents(enrollments.map(e => e.student.id))
                }
                className="text-blue-600 hover:underline text-sm"
              >
                {selectedStudents.length === enrollments.length ? "Deselect All" : "Select All"}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border border-gray-300 rounded p-4">
              {enrollments.map(enrollment => (
                <label key={enrollment.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(enrollment.student.id)}
                    onChange={() => toggleStudent(enrollment.student.id)}
                    disabled={generatingStudents.includes(enrollment.student.id)}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="flex-1">
                    {enrollment.student.user.name}
                  </span>
                  {generatingStudents.includes(enrollment.student.id) && (
                    <span className="text-xs text-gray-500">Generating...</span>
                  )}
                </label>
              ))}
            </div>

            <div className="mt-4 text-sm text-gray-600">
              {selectedStudents.length} of {enrollments.length} students selected
            </div>
          </div>
        )}

        <button
          onClick={handleGenerateReports}
          disabled={loading || !selectedSection || !selectedTerm || selectedStudents.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-3 rounded font-medium"
        >
          {loading ? "Generating Reports..." : "Generate Reports"}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-semibold text-blue-900 mb-2">Important Notes:</h3>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          <li>Reports can only be generated when all CORE subjects have approved results</li>
          <li>Reports will be submitted to the principal for approval</li>
          <li>Once approved, parents and students can view the reports</li>
          <li>Reports include student position in class and progress compared to last term</li>
        </ul>
      </div>
    </div>
  )
}
