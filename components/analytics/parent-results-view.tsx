"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StudentResultsView } from "@/components/analytics/student-results-view"

interface ChildOption {
  id: string
  admissionNumber: string
  user: {
    name: string
  }
}

export function ParentResultsView() {
  const [children, setChildren] = useState<ChildOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchChildren() {
      try {
        setLoading(true)
        const response = await fetch("/api/profile")
        if (!response.ok) {
          throw new Error("Failed to load linked students")
        }
        const profile = await response.json()
        const linkedChildren = (profile.parent?.students || [])
          .map((item: { student?: ChildOption }) => item.student)
          .filter(Boolean)
        setChildren(linkedChildren)
        setSelectedStudentId(linkedChildren[0]?.id || "")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load linked students")
      } finally {
        setLoading(false)
      }
    }

    fetchChildren()
  }, [])

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading linked students...</div>
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Results Unavailable</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (children.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Linked Students</CardTitle>
          <CardDescription>Your parent account is not linked to any student records yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Student Results</CardTitle>
          <CardDescription>Select a child to view their approved and historical results.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="child-results">Child</Label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger id="child-results">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.user.name} ({child.admissionNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedStudentId && <StudentResultsView studentId={selectedStudentId} />}
    </div>
  )
}
