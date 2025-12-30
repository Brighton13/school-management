"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Report {
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
  }
  term: {
    id: string
    name: string
  }
  totalMarksObtained: number
  maxTotalMarks: number
  positionInClass: number
  classSize: number
  progressRatio: number
  status: string
  createdAt: string
}

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (session?.user?.role) {
      fetchReports()
    }
  }, [status, session, statusFilter])

  const fetchReports = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter) params.append("status", statusFilter)

      const response = await fetch(
        `/api/reports/generate?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      )

      if (!response.ok) {
        throw new Error("Failed to fetch reports")
      }

      const data = await response.json()
      setReports(Array.isArray(data) ? data : [])
      setError("")
    } catch (err) {
      console.error("Error fetching reports:", err)
      setError("Failed to load reports")
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800",
      PENDING_CLASS_TEACHER: "bg-yellow-100 text-yellow-800",
      PENDING_PRINCIPAL: "bg-blue-100 text-blue-800",
      APPROVED: "bg-green-100 text-green-800",
      REJECTED: "bg-red-100 text-red-800"
    }
    return colors[status] || "bg-gray-100 text-gray-800"
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      DRAFT: "Draft",
      PENDING_CLASS_TEACHER: "Pending Review",
      PENDING_PRINCIPAL: "Pending Approval",
      APPROVED: "Approved",
      REJECTED: "Rejected"
    }
    return labels[status] || status
  }

  if (status === "loading") {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (!session || !["TEACHER", "ADMIN", "PRINCIPAL"].includes(session.user?.role)) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">You do not have access to this page</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Student Reports</h1>
        {session.user?.role === "TEACHER" && (
          <Link
            href="/dashboard/reports/generate"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Generate Report
          </Link>
        )}
        {session.user?.role === "PRINCIPAL" && (
          <Link
            href="/dashboard/reports/bulk-approve"
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Bulk Approvals
          </Link>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Status Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filter by Status
        </label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        >
          <option value="">All</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_CLASS_TEACHER">Pending Review</option>
          <option value="PENDING_PRINCIPAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          No reports found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-4 py-2 text-left">Student</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Section</th>
                <th className="border border-gray-300 px-4 py-2 text-left">Term</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Total Marks</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Position</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Progress</th>
                <th className="border border-gray-300 px-4 py-2">Status</th>
                <th className="border border-gray-300 px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2">
                    {report.student.user.name}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {report.section.class.name} - {report.section.name}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {report.term.name}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-right">
                    {report.totalMarksObtained}/{report.maxTotalMarks}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-center">
                    {report.positionInClass}/{report.classSize}
                  </td>
                  <td className="border border-gray-300 px-4 py-2 text-right">
                    <span className={report.progressRatio >= 0 ? "text-green-600" : "text-red-600"}>
                      {report.progressRatio > 0 ? "+" : ""}{Math.round(report.progressRatio)}%
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <span className={`px-2 py-1 rounded text-sm ${getStatusColor(report.status)}`}>
                      {getStatusLabel(report.status)}
                    </span>
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <Link
                      href={`/dashboard/reports/${report.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
