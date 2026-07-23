"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  FileText,
  DollarSign,
  Package,
  Bell,
  Settings,
  Calendar,
  UserCheck,
  ClipboardList,
  BarChart3,
  LogOut,
  Upload,
  UserCog,
  CheckCircle,
  History,
  Activity,
  Mail,
  Shield,
  KeyRound,
} from "lucide-react"
import { useSecureLogout } from "@/hooks/use-secure-logout"
import { Button } from "@/components/ui/button"

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ALL"] },
  // Admin-only management
  { name: "Academic Years", href: "/dashboard/academic-years", icon: Calendar, roles: ["ADMIN"] },
  { name: "Terms", href: "/dashboard/terms", icon: Calendar, roles: ["ADMIN"] },
  { name: "Classes", href: "/dashboard/classes", icon: BookOpen, roles: ["ADMIN"] },
  { name: "Sections", href: "/dashboard/sections", icon: BookOpen, roles: ["ADMIN"] },
  { name: "Exams", href: "/dashboard/exams", icon: FileText, roles: ["ADMIN"] },
  { name: "Subjects", href: "/dashboard/subjects", icon: FileText, roles: ["ADMIN"] },
  { name: "Enrollment", href: "/dashboard/enrollment", icon: UserCheck, roles: ["ADMIN"] },
  { name: "Promotions", href: "/dashboard/promotions", icon: GraduationCap, roles: ["ADMIN"] },
  { name: "Subject Selection", href: "/dashboard/student-subjects", icon: BookOpen, roles: ["ADMIN", "STUDENT"] },
  { name: "Users", href: "/dashboard/users", icon: UserCog, roles: ["ADMIN"] },
  { name: "Roles", href: "/dashboard/roles", icon: Shield, roles: ["ADMIN"] },
  { name: "Permissions", href: "/dashboard/permissions", icon: Shield, roles: ["ADMIN"] },
  { name: "Staff", href: "/dashboard/staff", icon: Users, roles: ["ADMIN"] },
  { name: "Teacher Assignments", href: "/dashboard/teacher-assignments", icon: UserCog, roles: ["ADMIN"] },
  { name: "Bulk Upload", href: "/dashboard/bulk-upload", icon: Upload, roles: ["ADMIN"] },
  // Teacher results entry (subject teachers)
  { name: "My Students", href: "/dashboard/students", icon: Users, roles: ["TEACHER"] },
  { name: "Enter Results", href: "/dashboard/results", icon: BarChart3, roles: ["TEACHER"] },
  // Class teacher dashboard
  { name: "Class Results", href: "/dashboard/class-results", icon: BarChart3, roles: ["TEACHER"] },
  // Principal approvals
  { name: "Approvals", href: "/dashboard/approvals", icon: CheckCircle, roles: ["PRINCIPAL", "ADMIN"] },
  // View-only for others
  { name: "Results", href: "/dashboard/results", icon: BarChart3, roles: ["STUDENT", "PARENT", "PRINCIPAL", "ADMIN"] },
  { name: "Attendance", href: "/dashboard/attendance", icon: ClipboardList, roles: ["ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"] },
  { name: "Fees Management", href: "/dashboard/fees", icon: DollarSign, roles: ["ADMIN", "PRINCIPAL", "ACCOUNTANT"] },
  { name: "My Fees", href: "/dashboard/fees", icon: DollarSign, roles: ["STUDENT", "PARENT"] },
  { name: "Inventory", href: "/dashboard/inventory", icon: Package, roles: ["ADMIN", "PRINCIPAL", "LIBRARIAN"] },
  { name: "Announcements", href: "/dashboard/announcements", icon: Bell, roles: ["ALL"] },
  { name: "Report Config", href: "/dashboard/settings/report-config", icon: Settings, roles: ["ADMIN", "PRINCIPAL", "TEACHER"] },
  { name: "Audit Trails", href: "/dashboard/audit-trails", icon: History, roles: ["ADMIN", "PRINCIPAL"] },
  { name: "Session Logs", href: "/dashboard/session-logs", icon: Activity, roles: ["ADMIN", "PRINCIPAL"] },
  { name: "Subscription License", href: "/dashboard/license", icon: KeyRound, roles: ["ADMIN", "PRINCIPAL"] },
  { name: "Email Config", href: "/dashboard/email-config", icon: Mail, roles: ["ADMIN", "PRINCIPAL"] },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["ADMIN", "PRINCIPAL"] },
]

export function Sidebar({ userRole }: { userRole: string }) {
  const pathname = usePathname()
  const { performSecureLogout } = useSecureLogout()

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes("ALL") || item.roles.includes(userRole)
  )

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold">School Management</h1>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={async () => {
            // Log session logout
            try {
              await fetch("/api/session-logs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
              })
            } catch (error) {
              console.error("Failed to log session logout:", error)
            }
            performSecureLogout("manual_logout")
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}

