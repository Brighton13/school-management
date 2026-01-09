"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PermissionDenied } from "@/components/ui/permission-denied"

interface CommentConfig {
  id: string
  marksLowerBound: number
  marksUpperBound: number
  commentTemplate: string
  performanceArea: string
  section: {
    id: string
    name: string
    class: {
      id: string
      name: string
    }
  }
}

interface GroupedConfig {
  section: {
    id: string
    name: string
    class: {
      id: string
      name: string
    }
  }
  configs: CommentConfig[]
}

export default function CommentConfigPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [sections, setSections] = useState<any[]>([])
  const [configs, setConfigs] = useState<GroupedConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [selectedSection, setSelectedSection] = useState("")
  const [marksLower, setMarksLower] = useState("")
  const [marksUpper, setMarksUpper] = useState("")
  const [commentTemplate, setCommentTemplate] = useState("")
  const [performanceArea, setPerformanceArea] = useState("OVERALL")
  const [saving, setSaving] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (session?.user?.role === "TEACHER") {
      fetchSections()
      fetchConfigs()
    }
  }, [status, session])

  const fetchSections = async () => {
    try {
      const response = await fetch("/api/sections?noPagination=true")
      if (!response.ok) throw new Error("Failed to fetch sections")
      const data = await response.json()
      setSections(Array.isArray(data) ? data : (data.data || []))
    } catch (err) {
      console.error("Error fetching sections:", err)
    }
  }

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/reports/comment-config")
      if (response.status === 401 || response.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      if (!response.ok) throw new Error("Failed to fetch configs")
      const data = await response.json()
      setConfigs(data)
      setError("")
    } catch (err) {
      console.error("Error fetching configs:", err)
      setError("Failed to load comment configurations")
    } finally {
      setLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedSection || !marksLower || !marksUpper || !commentTemplate.trim()) {
      setError("Please fill all fields")
      return
    }

    const lowerNum = parseFloat(marksLower)
    const upperNum = parseFloat(marksUpper)

    if (lowerNum < 0 || upperNum > 100 || lowerNum >= upperNum) {
      setError("Invalid marks range. Must be 0-100 and lower < upper")
      return
    }

    try {
      setSaving(true)
      const response = await fetch("/api/reports/comment-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSection,
          marksLowerBound: lowerNum,
          marksUpperBound: upperNum,
          commentTemplate,
          performanceArea
        })
      })

      if (!response.ok) {
        throw new Error("Failed to save configuration")
      }

      setSuccess("Configuration saved successfully")
      setSelectedSection("")
      setMarksLower("")
      setMarksUpper("")
      setCommentTemplate("")
      setPerformanceArea("OVERALL")
      fetchConfigs()
    } catch (err) {
      console.error("Error saving config:", err)
      setError("Failed to save configuration")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) return

    try {
      const response = await fetch(`/api/reports/comment-config?id=${configId}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        throw new Error("Failed to delete configuration")
      }

      setSuccess("Configuration deleted successfully")
      fetchConfigs()
    } catch (err) {
      console.error("Error deleting config:", err)
      setError("Failed to delete configuration")
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
      <h1 className="text-3xl font-bold mb-6">Comment Configuration</h1>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Configuration Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Add New Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Section
                </label>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2"
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lower Bound (%)
                  </label>
                  <input
                    type="number"
                    value={marksLower}
                    onChange={(e) => setMarksLower(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upper Bound (%)
                  </label>
                  <input
                    type="number"
                    value={marksUpper}
                    onChange={(e) => setMarksUpper(e.target.value)}
                    placeholder="100"
                    min="0"
                    max="100"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comment Template
                </label>
                <textarea
                  value={commentTemplate}
                  onChange={(e) => setCommentTemplate(e.target.value)}
                  placeholder="e.g., Excellent performance, keep it up!"
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  rows={4}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use {"{"}studentName{"}"}, {"{"}marks{"}"}, {"{"}average{"}"} for variables
                </p>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded"
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>

        {/* Existing Configurations */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Existing Configurations</h2>

          {loading ? (
            <div className="text-center py-8">Loading configurations...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No configurations created yet
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map(group => (
                <div key={group.section.id} className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold text-gray-700 mb-3">
                    {group.section.class.name} - Section {group.section.name}
                  </h3>

                  <div className="space-y-2">
                    {group.configs.map(config => (
                      <div
                        key={config.id}
                        className="flex justify-between items-start p-3 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex gap-2 mb-1">
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              {config.marksLowerBound}-{config.marksUpperBound}%
                            </span>
                            <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              {config.performanceArea}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{config.commentTemplate}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteConfig(config.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium ml-2"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How to Use:</h3>
        <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
          <li>Create comment templates for different marks ranges</li>
          <li>Comments will be automatically suggested when adding marks-based feedback</li>
          <li>You can have different templates for different performance areas</li>
          <li>Each section can have unique comment configurations</li>
        </ul>
      </div>
    </div>
  )
}
