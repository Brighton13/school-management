import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, GraduationCap, BookOpen, DollarSign } from "lucide-react"
import { AdminAnalytics } from "@/components/analytics/admin-analytics"
import { TeacherDashboard } from "@/components/analytics/teacher-dashboard"
import { StudentDashboard } from "@/components/analytics/student-dashboard"
import { ParentDashboard } from "@/components/analytics/parent-dashboard"
import { AccountantDashboard } from "@/components/analytics/accountant-dashboard"
import { LibrarianDashboard } from "@/components/analytics/librarian-dashboard"
import { DashboardCharts } from "@/components/analytics/dashboard-charts"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  // Fetch stats with error handling
  let studentCount = 0
  let staffCount = 0
  let classCount = 0
  let pendingFees = 0
  let dbError = false

  try {
    const stats = await Promise.all([
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.staff.count({ where: { status: "ACTIVE" } }),
      prisma.class.count(),
      prisma.fee.count({ where: { status: "PENDING" } }),
    ])

    ;[studentCount, staffCount, classCount, pendingFees] = stats
  } catch (error) {
    console.error("Database connection error:", error)
    dbError = true
    // Use default values (0) when database is unavailable
  }

  // Show advanced analytics for ADMIN, PRINCIPAL, and TEACHER roles
  const showAdvancedAnalytics = 
    session?.user?.role === "ADMIN" || 
    session?.user?.role === "PRINCIPAL" || 
    session?.user?.role === "TEACHER"

  // Role-based dashboard rendering
  const renderRoleDashboard = () => {
    const role = session?.user?.role

    if (dbError) {
      return (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <CardHeader>
            <CardTitle className="text-yellow-800 dark:text-yellow-200">
              Database Connection Issue
            </CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              Unable to connect to the database. Please check your database connection settings.
              Statistics may not be available.
            </CardDescription>
          </CardHeader>
        </Card>
      )
    }

    switch (role) {
      case "ADMIN":
      case "PRINCIPAL":
        return (
          <>
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
                Administrator Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Welcome back, <span className="font-semibold text-foreground">{session?.user?.name}</span>
              </p>
            </div>
            <DashboardCharts />
            <div className="mt-8">
              <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  Detailed Analytics
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-2">
                  Comprehensive analytics and performance trends
                </p>
              </div>
              <AdminAnalytics />
            </div>
          </>
        )

      case "TEACHER":
        return (
          <>
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
                My Teaching Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Welcome back, <span className="font-semibold text-foreground">{session?.user?.name}</span>
              </p>
            </div>
            <TeacherDashboard />
          </>
        )

      case "STUDENT":
        return (
          <>
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
                Student Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Welcome back, <span className="font-semibold text-foreground">{session?.user?.name}</span>
              </p>
            </div>
            <StudentDashboard />
          </>
        )

      case "PARENT":
        return (
          <>
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
                Parent Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Welcome back, <span className="font-semibold text-foreground">{session?.user?.name}</span>
              </p>
            </div>
            <ParentDashboard />
          </>
        )

      case "ACCOUNTANT":
        return (
          <>
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
                Accountant Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Welcome back, <span className="font-semibold text-foreground">{session?.user?.name}</span>
              </p>
            </div>
            <AccountantDashboard />
          </>
        )

      case "LIBRARIAN":
        return (
          <>
            <div className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">
                Librarian Dashboard
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Welcome back, <span className="font-semibold text-foreground">{session?.user?.name}</span>
              </p>
            </div>
            <LibrarianDashboard />
          </>
        )

      default:
        return (
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-2">Welcome, {session?.user?.name}!</h1>
            <p className="text-muted-foreground">Dashboard for your role is being prepared.</p>
          </div>
        )
    }
  }

  return (
    <div className="w-full space-y-6 sm:space-y-8">
      {renderRoleDashboard()}
    </div>
  )
}

