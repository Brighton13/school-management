"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BookOpen,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
} from "lucide-react"

interface SubjectInfo {
  id: string
  subjectId: string
  name: string
  code: string
  type: string
  teacher: {
    name: string
    employeeId: string
  } | null
  maxMarks: number | null
  passMarks: number | null
  isSelected: boolean
  selectionStatus: string | null
}

interface AvailableSubjectsData {
  student: {
    id: string
    name: string
    admissionNumber: string
    className: string
    sectionName: string
  }
  academicYear: string
  term: string
  subjects: {
    core: SubjectInfo[]
    elective: SubjectInfo[]
    optional: SubjectInfo[]
  }
  summary: {
    totalCore: number
    totalElective: number
    totalOptional: number
    selectedElective: number
    selectedOptional: number
  }
}

export function StudentSubjectSelection() {
  const [data, setData] = useState<AvailableSubjectsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetchAvailableSubjects()
  }, [])

  const fetchAvailableSubjects = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/students/available-subjects")
      if (response.ok) {
        const result = await response.json()
        setData(result)
        setError(null)
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Failed to load subjects")
      }
    } catch (err) {
      console.error("Error fetching available subjects:", err)
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleSubjectToggle = async (classSubjectId: string, currentlySelected: boolean) => {
    if (!data) return

    setUpdating(classSubjectId)
    try {
      const response = await fetch("/api/students/available-subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classSubjectId,
          academicYear: data.academicYear,
          term: data.term,
          action: currentlySelected ? "drop" : "select",
        }),
      })

      if (response.ok) {
        // Refresh data
        await fetchAvailableSubjects()
      } else {
        const errorData = await response.json()
        alert(errorData.error || "Failed to update subject selection")
      }
    } catch (err) {
      console.error("Error updating subject selection:", err)
      alert("Failed to update subject selection")
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
        <CardHeader>
          <CardTitle className="text-yellow-800 dark:text-yellow-200">
            Subject Selection Unavailable
          </CardTitle>
          <CardDescription className="text-yellow-700 dark:text-yellow-300">
            {error || "Unable to load subject options. You may not be enrolled in a class yet."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const SubjectCard = ({ subject, canToggle = false }: { subject: SubjectInfo; canToggle?: boolean }) => (
    <div
      className={`border rounded-lg p-4 transition-all ${
        subject.isSelected
          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{subject.name}</h4>
            <Badge variant="outline" className="text-xs">
              {subject.code}
            </Badge>
          </div>
          {subject.teacher && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <User className="h-3 w-3" />
              {subject.teacher.name}
            </div>
          )}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Max: {subject.maxMarks || 100}</span>
            <span>•</span>
            <span>Pass: {subject.passMarks || 40}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {subject.isSelected ? (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Selected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-gray-500">
              Not Selected
            </Badge>
          )}
          {canToggle && (
            <Button
              variant={subject.isSelected ? "outline" : "default"}
              size="sm"
              disabled={updating === subject.id}
              onClick={() => handleSubjectToggle(subject.id, subject.isSelected)}
            >
              {updating === subject.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : subject.isSelected ? (
                <>
                  <XCircle className="h-4 w-4 mr-1" />
                  Drop
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Select
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-purple-600" />
          Subject Selection
        </CardTitle>
        <CardDescription>
          {data.academicYear} - {data.term} • {data.student.className} ({data.student.sectionName})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{data.summary.totalCore}</div>
            <div className="text-xs text-muted-foreground">Core Subjects</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {data.summary.selectedElective}/{data.summary.totalElective}
            </div>
            <div className="text-xs text-muted-foreground">Electives Selected</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {data.summary.selectedOptional}/{data.summary.totalOptional}
            </div>
            <div className="text-xs text-muted-foreground">Optionals Selected</div>
          </div>
        </div>

        <Tabs defaultValue="elective" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="core">
              <GraduationCap className="h-4 w-4 mr-2" />
              Core ({data.summary.totalCore})
            </TabsTrigger>
            <TabsTrigger value="elective">
              Elective ({data.summary.totalElective})
            </TabsTrigger>
            <TabsTrigger value="optional">
              Optional ({data.summary.totalOptional})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="core" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Core subjects are mandatory and cannot be changed.
              </p>
              {data.subjects.core.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No core subjects assigned to your class.
                </p>
              ) : (
                data.subjects.core.map((subject) => (
                  <SubjectCard key={subject.id} subject={subject} canToggle={false} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="elective" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Select the elective subjects you want to take. You may be required to select a minimum number.
              </p>
              {data.subjects.elective.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No elective subjects available for your class.
                </p>
              ) : (
                data.subjects.elective.map((subject) => (
                  <SubjectCard key={subject.id} subject={subject} canToggle={true} />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="optional" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Optional subjects are additional subjects you can take based on your interest.
              </p>
              {data.subjects.optional.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No optional subjects available for your class.
                </p>
              ) : (
                data.subjects.optional.map((subject) => (
                  <SubjectCard key={subject.id} subject={subject} canToggle={true} />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
