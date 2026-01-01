"use client"

import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

interface SchoolConfig {
  ministryHeader: string
  schoolName: string
  schoolLogo: string | null
  schoolMotto: string | null
  schoolAddress: string | null
  schoolPhone: string | null
  schoolEmail: string | null
  principalName: string | null
  principalSignature: string | null
}

interface SubjectResult {
  id: string
  marksObtained: number
  maxMarks: number
  percentage: number
  remark: string
  classSubject: {
    subject: {
      name: string
      code: string
      type: string
    }
    teacher: {
      user: {
        name: string
      }
    }
  }
}

interface ReportDetail {
  schoolConfig: SchoolConfig
  report: {
    id: string
    student: {
      id: string
      admissionNumber: string
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
    academicYear?: {
      name: string
      startDate: string
      endDate: string
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
      overallRemark: string
      classStatistics: {
        average: number
        highest: number
        lowest: number
        studentCount: number
      }
    }
  }
  subjectResults: SubjectResult[]
  commentsByArea: any[]
  autoComments: {
    classTeacher: string
    principal: string
  }
  signatures: {
    classTeacher: {
      name: string | null
      signature: string | null
    }
    principal: {
      name: string | null
      signature: string | null
    }
  }
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

  const formatDate = () => {
    return new Date().toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center no-print">
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
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded inline-block"
          >
            Back
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 no-print">
          {error}
        </div>
      )}

      <div ref={printRef} className="bg-white rounded-lg shadow print-area" style={{ maxWidth: "900px", margin: "0 auto" }}>
        <style jsx>{`
          @media print {
            .no-print { display: none !important; }
            .print-area { box-shadow: none; }
          }
        `}</style>
        
        {/* Ministry Header */}
        <div className="text-center pt-6 pb-2 border-b-2 border-gray-800">
          <h2 className="text-lg font-bold uppercase tracking-wider">
            {report.schoolConfig.ministryHeader || "MINISTRY OF EDUCATION"}
          </h2>
        </div>

        {/* School Header with Logo */}
        <div className="text-center py-4 border-b-2 border-gray-400">
          <div className="flex justify-center items-center gap-4 mb-2">
            {report.schoolConfig.schoolLogo && (
              <img
                src={report.schoolConfig.schoolLogo}
                alt="School Logo"
                className="h-16 w-16 object-contain"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold uppercase">
                {report.schoolConfig.schoolName || "School Name"}
              </h1>
              {report.schoolConfig.schoolMotto && (
                <p className="text-sm italic text-gray-600">"{report.schoolConfig.schoolMotto}"</p>
              )}
            </div>
            {report.schoolConfig.schoolLogo && (
              <img
                src={report.schoolConfig.schoolLogo}
                alt="School Logo"
                className="h-16 w-16 object-contain"
              />
            )}
          </div>
          {report.schoolConfig.schoolAddress && (
            <p className="text-sm text-gray-600">{report.schoolConfig.schoolAddress}</p>
          )}
          {(report.schoolConfig.schoolPhone || report.schoolConfig.schoolEmail) && (
            <p className="text-sm text-gray-600">
              {report.schoolConfig.schoolPhone && `Tel: ${report.schoolConfig.schoolPhone}`}
              {report.schoolConfig.schoolPhone && report.schoolConfig.schoolEmail && " | "}
              {report.schoolConfig.schoolEmail && `Email: ${report.schoolConfig.schoolEmail}`}
            </p>
          )}
        </div>

        {/* Report Title */}
        <div className="text-center py-3 bg-gray-100 border-b">
          <h2 className="text-xl font-bold">
            REPORT FORM - {report.report.term?.name?.toUpperCase()} {report.report.academicYear?.name || new Date().getFullYear()}
          </h2>
        </div>

        {/* Student Information */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 text-sm">
            <div className="flex">
              <span className="font-semibold w-32">Student Name:</span>
              <span className="uppercase">{report.report.student.user.name}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-32">Grade/Class:</span>
              <span>{report.report.section.class.name} - {report.report.section.name}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-32">Admission No:</span>
              <span>{report.report.student.admissionNumber || "N/A"}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-32">No. of Pupils:</span>
              <span>{report.report.classSize}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-32">Marks Obtained:</span>
              <span className="font-bold">{report.report.totalMarksObtained} / {report.report.maxTotalMarks}</span>
            </div>
            <div className="flex">
              <span className="font-semibold w-32">Position:</span>
              <span className="font-bold text-blue-700">{report.report.positionInClass} out of {report.report.classSize}</span>
            </div>
          </div>

          {/* Subject Results Table */}
          <div className="mb-6">
            <table className="w-full border-collapse border-2 border-gray-800 text-sm">
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-800 px-3 py-2 text-left font-bold">SUBJECT</th>
                  <th className="border border-gray-800 px-3 py-2 text-center font-bold w-20">SCORE</th>
                  <th className="border border-gray-800 px-3 py-2 text-center font-bold w-16">%</th>
                  <th className="border border-gray-800 px-3 py-2 text-center font-bold w-28">REMARK</th>
                </tr>
              </thead>
              <tbody>
                {report.subjectResults.map((result, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-800 px-3 py-2">
                      {result.classSubject.subject.name}
                    </td>
                    <td className="border border-gray-800 px-3 py-2 text-center font-medium">
                      {result.marksObtained}/{result.maxMarks}
                    </td>
                    <td className="border border-gray-800 px-3 py-2 text-center font-medium">
                      {result.percentage}%
                    </td>
                    <td className="border border-gray-800 px-3 py-2 text-center text-xs">
                      {result.remark}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-gray-300 font-bold">
                  <td className="border border-gray-800 px-3 py-2">TOTAL</td>
                  <td className="border border-gray-800 px-3 py-2 text-center">
                    {report.report.totalMarksObtained}/{report.report.maxTotalMarks}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-center">
                    {report.report.metadata.percentage}%
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-center text-xs">
                    {report.report.metadata.overallRemark}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Performance Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6 text-center">
            <div className="bg-blue-50 rounded p-3 border border-blue-200">
              <div className="text-2xl font-bold text-blue-700">{report.report.metadata.percentage}%</div>
              <p className="text-xs text-gray-600">Average</p>
            </div>
            <div className="bg-green-50 rounded p-3 border border-green-200">
              <div className="text-2xl font-bold text-green-700">{report.report.metadata.grade}</div>
              <p className="text-xs text-gray-600">Grade</p>
            </div>
            <div className="bg-purple-50 rounded p-3 border border-purple-200">
              <div className="text-2xl font-bold text-purple-700">
                {report.report.positionInClass}/{report.report.classSize}
              </div>
              <p className="text-xs text-gray-600">Position</p>
            </div>
            <div className={`rounded p-3 border ${report.report.progressRatio >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className={`text-2xl font-bold ${report.report.progressRatio >= 0 ? "text-green-700" : "text-red-700"}`}>
                {report.report.progressRatio > 0 ? "+" : ""}{Math.round(report.report.progressRatio)}%
              </div>
              <p className="text-xs text-gray-600">Progress</p>
            </div>
          </div>

          {/* Class Teacher Comments */}
          <div className="mb-4">
            <div className="border-2 border-gray-800 rounded">
              <div className="bg-gray-200 px-3 py-2 border-b border-gray-800">
                <h3 className="font-bold text-sm">CLASS TEACHER'S COMMENTS:</h3>
              </div>
              <div className="px-3 py-3 min-h-[60px]">
                {/* Show manual comments first, then auto-comment */}
                {report.commentsByArea.find(a => a.area === "OVERALL")?.comments?.length > 0 ? (
                  report.commentsByArea.find(a => a.area === "OVERALL").comments.map((c: any, i: number) => (
                    <p key={i} className="text-sm">{c.commentText}</p>
                  ))
                ) : (
                  <p className="text-sm italic">{report.autoComments.classTeacher}</p>
                )}
              </div>
            </div>
          </div>

          {/* Head Teacher / Principal Comments */}
          <div className="mb-6">
            <div className="border-2 border-gray-800 rounded">
              <div className="bg-gray-200 px-3 py-2 border-b border-gray-800">
                <h3 className="font-bold text-sm">HEAD TEACHER'S COMMENTS:</h3>
              </div>
              <div className="px-3 py-3 min-h-[60px]">
                {report.commentsByArea.find(a => a.area === "PRINCIPAL")?.comments?.length > 0 ? (
                  report.commentsByArea.find(a => a.area === "PRINCIPAL").comments.map((c: any, i: number) => (
                    <p key={i} className="text-sm">{c.commentText}</p>
                  ))
                ) : (
                  <p className="text-sm italic">{report.autoComments.principal}</p>
                )}
              </div>
            </div>
          </div>

          {/* Signatures Section */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-gray-400">
            {/* Class Teacher Signature */}
            <div className="text-center">
              <div className="h-16 flex items-end justify-center mb-1">
                {report.signatures.classTeacher.signature ? (
                  <img 
                    src={report.signatures.classTeacher.signature} 
                    alt="Class Teacher Signature"
                    className="max-h-14 max-w-[150px] object-contain"
                  />
                ) : (
                  <div className="border-b border-gray-400 w-40"></div>
                )}
              </div>
              <p className="text-sm font-semibold">{report.signatures.classTeacher.name || "Class Teacher"}</p>
              <p className="text-xs text-gray-600">Class Teacher</p>
              <p className="text-xs text-gray-500 mt-1">Date: {formatDate()}</p>
            </div>

            {/* Principal Signature */}
            <div className="text-center">
              <div className="h-16 flex items-end justify-center mb-1">
                {report.signatures.principal.signature ? (
                  <img 
                    src={report.signatures.principal.signature} 
                    alt="Principal Signature"
                    className="max-h-14 max-w-[150px] object-contain"
                  />
                ) : (
                  <div className="border-b border-gray-400 w-40"></div>
                )}
              </div>
              <p className="text-sm font-semibold">{report.signatures.principal.name || "Head Teacher"}</p>
              <p className="text-xs text-gray-600">Head Teacher</p>
              <p className="text-xs text-gray-500 mt-1">Date: {formatDate()}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 pt-4 border-t text-xs text-gray-500">
            <p>This is a computer-generated report. For any queries, please contact the school office.</p>
          </div>
        </div>
      </div>

      {/* Add Comment Section - Non-printable */}
      {canAddComments && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 no-print" style={{ maxWidth: "900px", margin: "24px auto 0" }}>
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
                <option value="OVERALL">Overall (Class Teacher)</option>
                <option value="PRINCIPAL">Principal/Head Teacher</option>
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
