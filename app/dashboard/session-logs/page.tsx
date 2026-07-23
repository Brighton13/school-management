"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { PermissionDenied } from "@/components/ui/permission-denied"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Monitor, Smartphone, Tablet, CheckCircle2, XCircle, Clock, Search } from "lucide-react"

interface SessionLog {
  id: string
  ipAddress: string | null
  userAgent: string | null
  deviceType: string | null
  browser: string | null
  os: string | null
  loginAt: string
  logoutAt: string | null
  duration: number | null
  isActive: boolean
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-"
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

export default function SessionLogsPage() {
  const { data: session } = useSession()
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 50

  // Filters
  const [userId, setUserId] = useState<string>("all")
  const [isActive, setIsActive] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchSessionLogs()
  }, [userId, isActive, searchTerm, startDate, endDate, offset])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users?noPagination=true")
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : (data.data || []))
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }

  const fetchSessionLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      })
      if (userId !== "all") params.append("userId", userId)
      if (isActive !== "all") params.append("isActive", isActive)
      if (searchTerm) params.append("search", searchTerm)
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)

      const res = await fetch(`/api/session-logs?${params}`)
      if (res.status === 401 || res.status === 403) {
        setPermissionDenied(true)
        setLoading(false)
        return
      }
      const data = await res.json()
      setSessionLogs(data.data || [])
      setTotal(data.pagination?.total || data.total || 0)
    } catch (error) {
      console.error("Failed to fetch session logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType) {
      case "MOBILE":
        return <Smartphone className="h-4 w-4" />
      case "TABLET":
        return <Tablet className="h-4 w-4" />
      case "DESKTOP":
        return <Monitor className="h-4 w-4" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  const exportToCSV = () => {
    const headers = [
      "Login Time",
      "Logout Time",
      "User",
      "Duration",
      "Device Type",
      "Browser",
      "OS",
      "IP Address",
      "Status",
    ]
    const rows = sessionLogs.map((log) => [
      new Date(log.loginAt).toLocaleString(),
      log.logoutAt ? new Date(log.logoutAt).toLocaleString() : "",
      log.user.name,
      formatDuration(log.duration),
      log.deviceType || "",
      log.browser || "",
      log.os || "",
      log.ipAddress || "",
      log.isActive ? "Active" : "Ended",
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `session-logs-${new Date().toISOString()}.csv`
    a.click()
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Session Logs</h1>
          <p className="text-muted-foreground">
            Track user login sessions and activity
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
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="User, IP, browser, device..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setOffset(0)
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userId} onValueChange={(value) => { setUserId(value); setOffset(0) }}>
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
              <Label>Status</Label>
              <Select value={isActive} onValueChange={(value) => { setIsActive(value); setOffset(0) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Ended</SelectItem>
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

      {/* Session Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Session History</CardTitle>
          <CardDescription>
            {total} total session(s) found
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
                      <TableHead>Login Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Browser/OS</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No session logs found
                        </TableCell>
                      </TableRow>
                    ) : (
                      sessionLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {new Date(log.loginAt).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.user.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {log.user.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(log.deviceType)}
                              <span className="text-sm">
                                {log.deviceType || "Unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{log.browser || "Unknown"}</div>
                              <div className="text-muted-foreground">
                                {log.os || "Unknown"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.isActive ? (
                              <span className="text-sm text-muted-foreground">
                                In progress...
                              </span>
                            ) : (
                              <span className="text-sm">
                                {formatDuration(log.duration)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {log.ipAddress || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.isActive ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                                Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-gray-600">
                                <XCircle className="h-4 w-4" />
                                Ended
                              </span>
                            )}
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

