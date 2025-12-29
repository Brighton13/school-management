"use client"

import { useEffect, useState } from "react"
import { StatCard } from "./stat-cards"
import { StudentSubjectSelection } from "./student-subject-selection"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BookOpen,
  Calendar,
  Award,
  DollarSign,
  FileText,
  Megaphone,
} from "lucide-react"

interface StudentDashboardData {
  student: {
    name: string
    admissionNumber: string
    className: string
  }
  totalSubjects: number
  averageScore: number
  attendance: {
    present: number
    absent: number
    late: number
    total: number
    rate: number
  }
  fees: {
    total: number
    paid: number
    pending: number
    overdue: number
  }
  upcomingExams: Array<{
    examName: string
    subjectName: string
    date: string
    examType: string
  }>
  announcements: Array<{
    id: string
    title: string
    content: string
    type: string
    targetAudience: string
    createdBy: string
    createdAt: string
    publishedAt: string | null
    expiresAt: string | null
  }>
}

export function StudentDashboard() {
  const [data, setData] = useState<StudentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/analytics/student")
        if (response.ok) {
          const dashboardData = await response.json()
          setData(dashboardData)
        } else {
          const errorData = await response.json().catch(() => ({}))
          setError(errorData.error || "Failed to load dashboard")
        }
      } catch (error) {
        console.error("Failed to fetch dashboard:", error)
        setError("Network error. Please check your connection.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
        <CardHeader>
          <CardTitle className="text-red-800 dark:text-red-200">Dashboard Unavailable</CardTitle>
          <CardDescription className="text-red-700 dark:text-red-300">
            {error || "Failed to load dashboard. Please try again later."}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const averageScore = data.averageScore

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome, {data.student.name}!</h1>
        <p className="text-blue-100">
          Admission Number: {data.student.admissionNumber} • Class: {data.student.className}
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Average Score"
          value={`${averageScore.toFixed(1)}%`}
          description="Across all subjects"
          icon={Award}
        />
        <StatCard
          title="Attendance Rate"
          value={`${data.attendance.rate.toFixed(1)}%`}
          description={`${data.attendance.present} present days`}
          icon={Calendar}
        />
        <StatCard
          title="Subjects"
          value={data.totalSubjects}
          description="Enrolled subjects"
          icon={BookOpen}
        />
        <StatCard
          title="Fees Status"
          value={data.fees.pending === 0 ? "Paid" : `${data.fees.pending} Pending`}
          description={`ZMW ${data.fees.paid.toFixed(2)} / ZMW ${data.fees.total.toFixed(2)}`}
          icon={DollarSign}
        />
      </div>

      {/* Announcements */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-green-600" />
            Important Announcements
          </CardTitle>
          <CardDescription className="text-sm">Latest updates and notifications</CardDescription>
        </CardHeader>
        <CardContent>
          {data.announcements.length > 0 ? (
            <div className="space-y-4">
              {data.announcements.map((announcement) => (
                <div key={announcement.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg">{announcement.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        announcement.type === 'URGENT' 
                          ? 'bg-red-100 text-red-800' 
                          : announcement.type === 'ACADEMIC'
                          ? 'bg-blue-100 text-blue-800'
                          : announcement.type === 'EVENT'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {announcement.type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(announcement.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm mb-2">
                    {announcement.content.length > 150 
                      ? `${announcement.content.substring(0, 150)}...` 
                      : announcement.content
                    }
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>By: {announcement.createdBy}</span>
                    {announcement.expiresAt && (
                      <span>Expires: {new Date(announcement.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No announcements at this time.</p>
          )}
        </CardContent>
      </Card>

      {/* Subject Selection */}
      <StudentSubjectSelection />

      {/* Upcoming Exams */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Upcoming Exams
          </CardTitle>
          <CardDescription className="text-sm">Your scheduled examinations</CardDescription>
        </CardHeader>
        <CardContent>
          {data.upcomingExams.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold">Exam</TableHead>
                    <TableHead className="font-bold">Subject</TableHead>
                    <TableHead className="font-bold">Date</TableHead>
                    <TableHead className="font-bold">Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcomingExams.map((exam, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{exam.examName}</TableCell>
                      <TableCell>{exam.subjectName}</TableCell>
                      <TableCell>{new Date(exam.date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          exam.examType === 'CONTINUOUS_ASSESSMENT' 
                            ? 'bg-blue-100 text-blue-800' 
                            : exam.examType === 'FINAL'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {exam.examType === 'CONTINUOUS_ASSESSMENT' ? 'CA' : exam.examType}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No upcoming exams scheduled.</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
          <CardDescription className="text-sm">Navigate to important sections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <a
              href="/dashboard/results"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <Award className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="font-medium">View Results</h3>
                <p className="text-sm text-muted-foreground">Check your academic performance</p>
              </div>
            </a>
            <a
              href="/dashboard/attendance"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <Calendar className="h-6 w-6 text-green-600" />
              <div>
                <h3 className="font-medium">Attendance</h3>
                <p className="text-sm text-muted-foreground">View attendance records</p>
              </div>
            </a>
            <a
              href="/dashboard/fees"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
            >
              <DollarSign className="h-6 w-6 text-orange-600" />
              <div>
                <h3 className="font-medium">Fees</h3>
                <p className="text-sm text-muted-foreground">Check fee payments</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

