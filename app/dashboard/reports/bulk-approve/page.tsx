"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PermissionDenied } from "@/components/ui/permission-denied"
import Link from "next/link"

interface GroupedReports {
  key: string
  sectionId: string
  termId: string
  academicYearId: string
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
  academicYear: {
    id: string
    year: string
  }
  count: number
  reports: any[]
}

export default function BulkApprovePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [groupedReports, setGroupedReports] = useState<GroupedReports[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [approvingGroup, setApprovingGroup] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (session?.user?.role === "PRINCIPAL") {
      fetchPendingReports()
    }
  }, [status, session])

  const fetchPendingReports = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/reports/bulk-approve")
      if (response.status === 401 || response.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      if (!response.ok) {
        throw new Error("Failed to fetch pending reports")
      }
      const data = await response.json()
      setGroupedReports(data)
      setError("")
    } catch (err) {
      console.error("Error fetching pending reports:", err)
      setError("Failed to load pending reports")
    } finally {
      setLoading(false)
    }
  }

  const toggleGroup = (groupKey: string) => {
    setSelectedGroups(prev =>
      prev.includes(groupKey)
        ? prev.filter(k => k !== groupKey)
        : [...prev, groupKey]
    )
  }

  const handleApproveGroup = async (groupKey: string) => {
    const group = groupedReports.find(g => g.key === groupKey)
    if (!group) return

    try {
      setApprovingGroup(groupKey)
      const reportIds = group.reports.map(r => r.id)

      const response = await fetch("/api/reports/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: group.sectionId,
          termId: group.termId,
          reportIds
        })
      })

      if (!response.ok) {
        throw new Error("Failed to approve reports")
      }

      setSuccess(`Approved ${group.count} report(s) for ${group.section.name}`)
      setSelectedGroups(prev => prev.filter(k => k !== groupKey))
      fetchPendingReports()
    } catch (err) {
      console.error("Error approving reports:", err)
      setError("Failed to approve reports")
    } finally {
      setApprovingGroup(null)
    }
  }

  const handleApproveAll = async () => {
    const selectedGroupObjects = groupedReports.filter(g => selectedGroups.includes(g.key))

    try {
      setLoading(true)
      const promises = selectedGroupObjects.map(group =>
        fetch("/api/reports/bulk-approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: group.sectionId,
            termId: group.termId,
            reportIds: group.reports.map(r => r.id)
          })
        })
      )

      const results = await Promise.allSettled(promises)
      const successful = results.filter(r => r.status === "fulfilled").length

      if (successful > 0) {
        setSuccess(`Approved reports for ${successful} section(s)`)
        setSelectedGroups([])
        fetchPendingReports()
      }
    } catch (err) {
      console.error("Error approving reports:", err)
      setError("Failed to approve some reports")
    } finally {
      setLoading(false)
    }
  }

  if (status === "loading") {
    return <div className="flex justify-center items-center h-screen">Loading...</div>
  }

  if (!session || session.user?.role !== "PRINCIPAL") {
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Bulk Report Approvals</h1>
        <Link
          href="/dashboard/reports"
          className="text-blue-600 hover:underline"
        >
          Back to Reports
        </Link>
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

      {loading ? (
        <div className="text-center py-8">Loading pending reports...</div>
      ) : groupedReports.length === 0 ? (
        <div className="text-center py-8 text-gray-600">
          <p>No pending reports for approval</p>
        </div>
      ) : (
        <div>
          {selectedGroups.length > 0 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded p-4 flex justify-between items-center">
              <p className="text-blue-800">
                {selectedGroups.length} section(s) selected for approval
              </p>
              <button
                onClick={handleApproveAll}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Approve Selected
              </button>
            </div>
          )}

          <div className="space-y-4">
            {groupedReports.map(group => (
              <div key={group.key} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {group.section.class.name} - Section {group.section.name}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {group.term.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {group.count}
                    </div>
                    <p className="text-gray-600 text-sm">Reports</p>
                  </div>
                </div>

                <div className="mb-4 max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left px-2 py-1">Student Name</th>
                        <th className="text-right px-2 py-1">Total Marks</th>
                        <th className="text-center px-2 py-1">Position</th>
                        <th className="text-right px-2 py-1">Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.reports.map(report => (
                        <tr key={report.id} className="border-t hover:bg-gray-50">
                          <td className="px-2 py-2">{report.student.user.name}</td>
                          <td className="text-right px-2 py-2">
                            {report.totalMarksObtained}/{report.maxTotalMarks}
                          </td>
                          <td className="text-center px-2 py-2">
                            {report.positionInClass}/{report.classSize}
                          </td>
                          <td className="text-right px-2 py-2">
                            <span className={report.progressRatio >= 0 ? "text-green-600" : "text-red-600"}>
                              {report.progressRatio > 0 ? "+" : ""}{Math.round(report.progressRatio)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 justify-between">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.key)}
                      onChange={() => toggleGroup(group.key)}
                      className="mr-2 w-4 h-4"
                    />
                    <span className="text-sm text-gray-600">Select for approval</span>
                  </label>

                  <button
                    onClick={() => handleApproveGroup(group.key)}
                    disabled={approvingGroup === group.key}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded text-sm"
                  >
                    {approvingGroup === group.key ? "Approving..." : "Approve Now"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
