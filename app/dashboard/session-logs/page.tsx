"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Monitor, Smartphone, Tablet, CheckCircle2, XCircle, Clock } from "lucide-react"

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
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    fetchSessionLogs()
  }, [userId, isActive, startDate, endDate, offset])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users")
      const data = await res.json()
      setUsers(data)
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
      if (startDate) params.append("startDate", startDate)
      if (endDate) params.append("endDate", endDate)

      const res = await fetch(`/api/session-logs?${params}`)
      const data = await res.json()
      setSessionLogs(data.data)
      setTotal(data.total)
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
          <div className="grid grid-cols-4 gap-4">
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
              <Label>Status</Label>
              <Select value={isActive} onValueChange={setIsActive}>
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

