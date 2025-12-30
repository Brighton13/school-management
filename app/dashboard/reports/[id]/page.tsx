"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import Link from "next/link"

interface ReportDetail {
  report: {
    id: string
    student: {
      id: string
      user: {
        name: string
        email: string
      }
    }
    section: {
      id: string
      name: string
      class: {
        id: string
        name: string
      }
      classTeacher: {
        id: string
        user: {
          name: string
        }
      }
    }
    term: {
      id: string
      name: string
    }
    status: string
    totalMarksObtained: number
    maxTotalMarks: number
    positionInClass: number
    classSize: number
    progressRatio: number
    previousTermAverage: number
    currentTermAverage: number
    comments: any[]
    metadata: {
      totalResults: number
      percentage: number
      grade: string
      classStatistics: {
        average: number
        highest: number
        lowest: number
        studentCount: number
      }
    }
  }
  subjectResults: any[]
  commentsByArea: any[]
}

export default function ReportDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const reportId = params.id as string

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [newComment, setNewComment] = useState("")
  const [performanceArea, setPerformanceArea] = useState("OVERALL")
  const [addingComment, setAddingComment] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (reportId) {
      fetchReport()
    }
  }, [status, reportId])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/reports/${reportId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch report")
      }
      const data = await response.json()
      setReport(data)
      setError("")
    } catch (err) {
      console.error("Error fetching report:", err)
      setError("Failed to load report")
    } finally {
      setLoading(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      setError("Comment cannot be empty")
      return
    }

    try {
      setAddingComment(true)
      const response = await fetch("/api/reports/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          commentText: newComment,
          performanceArea
        })
      })

      if (!response.ok) {
        throw new Error("Failed to add comment")
      }

      setNewComment("")
      fetchReport()
    } catch (err) {
      console.error("Error adding comment:", err)
      setError("Failed to add comment")
    } finally {
      setAddingComment(false)
    }
  }

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open("", "", "height=800,width=900")
      if (printWindow) {
        printWindow.document.write(printRef.current.innerHTML)
        printWindow.document.close()
        printWindow.print()
      }
    }
  }

  if (status === "loading" || loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (!report) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error || "Report not found"}
        </div>
        <Link href="/dashboard/reports" className="text-blue-600 hover:underline mt-4 block">
          Back to Reports
        </Link>
      </div>
    )
  }

  const canAddComments =
    session?.user?.role === "TEACHER" ||
    session?.user?.role === "ADMIN" ||
    session?.user?.role === "PRINCIPAL"
  const canApprove = session?.user?.role === "PRINCIPAL"

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Student Report Card</h1>
        <div className="space-x-2">
          <button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Print
          </button>
          <Link
            href="/dashboard/reports"
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            Back
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div ref={printRef} className="bg-white rounded-lg shadow p-8 mb-6">
        {/* Header */}
        <div className="text-center mb-8 border-b-2 pb-4">
          <h2 className="text-2xl font-bold">STUDENT REPORT CARD</h2>
          <p className="text-gray-600">{report.report.section.class.name}</p>
        </div>

        {/* Student & School Info */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div>
            <h3 className="font-semibold text-gray-700">Student Information</h3>
            <p><strong>Name:</strong> {report.report.student.user.name}</p>
            <p><strong>Email:</strong> {report.report.student.user.email}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700">Academic Information</h3>
            <p><strong>Class:</strong> {report.report.section.class.name}</p>
            <p><strong>Section:</strong> {report.report.section.name}</p>
            <p><strong>Term:</strong> {report.report.term.name}</p>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="bg-gray-50 rounded p-4 mb-8">
          <h3 className="font-semibold text-gray-700 mb-3">Performance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {report.report.metadata.percentage}%
              </div>
              <p className="text-gray-600 text-sm">Overall Percentage</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {report.report.metadata.grade}
              </div>
              <p className="text-gray-600 text-sm">Grade</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {report.report.positionInClass}
              </div>
              <p className="text-gray-600 text-sm">Position in Class</p>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${report.report.progressRatio >= 0 ? "text-green-600" : "text-red-600"}`}>
                {report.report.progressRatio > 0 ? "+" : ""}{Math.round(report.report.progressRatio)}%
              </div>
              <p className="text-gray-600 text-sm">Progress</p>
            </div>
          </div>
        </div>

        {/* Subject Results */}
        <div className="mb-8">
          <h3 className="font-semibold text-gray-700 mb-3">Subject Marks</h3>
          <table className="w-full border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-left">Subject</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Marks Obtained</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Max Marks</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {report.subjectResults.map((result, idx) => {
                const percentage = (result.marksObtained / result.maxMarks) * 100
                return (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">
                      {result.classSubject.subject.name}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {result.marksObtained}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {result.maxMarks}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {Math.round(percentage)}%
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-gray-100 font-semibold">
                <td className="border border-gray-300 px-4 py-2">Total</td>
                <td className="border border-gray-300 px-4 py-2 text-right">
                  {report.report.totalMarksObtained}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right">
                  {report.report.maxTotalMarks}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right">
                  {report.report.metadata.percentage}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Class Statistics */}
        <div className="bg-gray-50 rounded p-4 mb-8">
          <h3 className="font-semibold text-gray-700 mb-3">Class Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Class Average</p>
              <p className="text-xl font-bold">
                {report.report.metadata.classStatistics.average}%
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Highest Marks</p>
              <p className="text-xl font-bold">
                {report.report.metadata.classStatistics.highest}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Lowest Marks</p>
              <p className="text-xl font-bold">
                {report.report.metadata.classStatistics.lowest}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Class Size</p>
              <p className="text-xl font-bold">
                {report.report.metadata.classStatistics.studentCount}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Ratio */}
        {report.report.previousTermAverage > 0 && (
          <div className="bg-blue-50 rounded p-4 mb-8">
            <h3 className="font-semibold text-gray-700 mb-3">Progress Analysis</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Previous Term</p>
                <p className="text-xl font-bold">{Math.round(report.report.previousTermAverage)}%</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Current Term</p>
                <p className="text-xl font-bold">{Math.round(report.report.currentTermAverage)}%</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Change</p>
                <p className={`text-xl font-bold ${report.report.progressRatio >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {report.report.progressRatio > 0 ? "+" : ""}{Math.round(report.report.progressRatio)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Comments Section */}
        {report.commentsByArea && report.commentsByArea.length > 0 && (
          <div className="mb-8">
            <h3 className="font-semibold text-gray-700 mb-3">Teacher Comments</h3>
            {report.commentsByArea.map((area, idx) => (
              <div key={idx} className="mb-4 p-4 border-l-4 border-blue-500 bg-blue-50">
                <h4 className="font-medium text-gray-700">{area.area}</h4>
                {area.comments.map((comment: any, cidx: number) => (
                  <p key={cidx} className="text-gray-600 mt-2">
                    {comment.commentText}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Class Teacher Signature */}
        {report.report.section.classTeacher && (
          <div className="mt-8 pt-8 border-t-2 grid grid-cols-3 gap-8">
            <div>
              <p className="text-gray-600 text-sm">Class Teacher</p>
              <p className="font-semibold">{report.report.section.classTeacher.user.name}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600 text-sm mb-8">Date</p>
              <p>_________________</p>
            </div>
            <div className="text-right">
              <p className="text-gray-600 text-sm mb-8">Signature</p>
              <p>_________________</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Comment Section */}
      {canAddComments && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="font-semibold text-gray-700 mb-4">Add Comment</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Performance Area
              </label>
              <select
                value={performanceArea}
                onChange={(e) => setPerformanceArea(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="OVERALL">Overall</option>
                <option value="CONDUCT">Conduct</option>
                <option value="PARTICIPATION">Participation</option>
                <option value="EFFORT">Effort</option>
                <option value="ATTENDANCE">Attendance</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comment
              </label>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Enter your comment..."
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={4}
              />
            </div>
            <button
              onClick={handleAddComment}
              disabled={addingComment || !newComment.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
            >
              {addingComment ? "Adding..." : "Add Comment"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
