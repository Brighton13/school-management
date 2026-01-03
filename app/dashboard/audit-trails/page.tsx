"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Download, Clock } from "lucide-react"

interface AuditTrail {
  id: string
  action: string
  entityType: string
  entityId: string | null
  description: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface User {
  id: string
  name: string
  email: string
}

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "VIEW",
  "LOGIN",
  "LOGOUT",
  "APPROVE",
  "REJECT",
  "PUBLISH",
  "UNPUBLISH",
]

const ENTITY_TYPES = [
  "User",
  "Student",
  "Staff",
  "Class",
  "Section",
  "Subject",
  "Result",
  "Fee",
  "Exam",
  "Announcement",
  "Enrollment",
]

export default function AuditTrailsPage() {
  const { data: session } = useSession()
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 50

  // Filters
  const [userId, setUserId] = useState<string>("all")
  const [action, setAction] = useState<string>("all")
  const [entityType, setEntityType] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchAuditTrails()
  }, [userId, action, entityType, startDate, endDate, offset])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      if (!res.ok) {
        console.error("Failed to fetch users:", res.statusText)
        return
      }
      const data = await res.json()
      setUsers(data)
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }

  const fetchAuditTrails = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })
      if (userId !== "all") params.append("userId", userId)
      if (action !== "all") params.append("action", action)
      if (entityType !== "all") params.append("entityType", entityType)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)

      const res = await fetch(`/api/audit-trails?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch audit trails: ${res.statusText}`)
      }
      const data = await res.json()
      setAuditTrails(data.data)
      setTotal(data.total)
    } catch (error) {
      console.error("Failed to fetch audit trails:", error)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      CREATE: "bg-green-100 text-green-800",
      UPDATE: "bg-blue-100 text-blue-800",
      DELETE: "bg-red-100 text-red-800",
      VIEW: "bg-gray-100 text-gray-800",
      LOGIN: "bg-purple-100 text-purple-800",
      LOGOUT: "bg-orange-100 text-orange-800",
      APPROVE: "bg-teal-100 text-teal-800",
      REJECT: "bg-pink-100 text-pink-800",
      PUBLISH: "bg-indigo-100 text-indigo-800",
      UNPUBLISH: "bg-yellow-100 text-yellow-800",
    }
    return colors[action] || "bg-gray-100 text-gray-800"
  }

  const exportToCSV = () => {
    const headers = ["Date", "User", "Action", "Entity Type", "Entity ID", "Description", "IP Address"]
    const rows = auditTrails.map((trail) => [
      new Date(trail.createdAt).toLocaleString(),
      trail.user.name,
      trail.action,
      trail.entityType,
      trail.entityId || "",
      trail.description || "",
      trail.ipAddress || "",
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-trails-${new Date().toISOString()}.csv`
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Trails</h1>
          <p className="text-muted-foreground">
            Track all system activities and user actions
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {ACTIONS.map((act) => (
                    <SelectItem key={act} value={act}>
                      {act}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Trails Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            {total} total record(s) found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditTrails.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No audit trails found
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditTrails.map((trail) => (
                        <TableRow key={trail.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {new Date(trail.createdAt).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{trail.user.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {trail.user.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${getActionColor(
                                trail.action
                              )}`}
                            >
                              {trail.action}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{trail.entityType}</div>
                              {trail.entityId && (
                                <div className="text-sm text-muted-foreground">
                                  ID: {trail.entityId}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="truncate" title={trail.description || ""}>
                              {trail.description || "-"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {trail.ipAddress || "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} results
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

