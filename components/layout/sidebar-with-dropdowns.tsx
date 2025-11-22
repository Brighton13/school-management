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
  ChevronDown,
  ChevronRight,
  X,
  User,
  Shield,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState, useEffect } from "react"

interface MenuItem {
  name: string
  href: string
  icon: any
  roles: string[]
  children?: MenuItem[]
}

const menuGroups: { title: string; items: MenuItem[]; roles: string[] }[] = [
  {
    title: "Main",
    roles: ["ALL"],
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ALL"] },
    ],
  },
  {
    title: "Academic Management",
    roles: ["ADMIN"],
    items: [
      { name: "Terms", href: "/dashboard/terms", icon: Calendar, roles: ["ADMIN"] },
      { name: "Classes", href: "/dashboard/classes", icon: BookOpen, roles: ["ADMIN"] },
      { name: "Sections", href: "/dashboard/sections", icon: BookOpen, roles: ["ADMIN"] },
      { name: "Subjects", href: "/dashboard/subjects", icon: FileText, roles: ["ADMIN"] },
      { name: "Exams", href: "/dashboard/exams", icon: FileText, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Student Management",
    roles: ["ADMIN"],
    items: [
      { name: "Enrollment", href: "/dashboard/enrollment", icon: UserCheck, roles: ["ADMIN"] },
      { name: "Subject Selection", href: "/dashboard/student-subjects", icon: BookOpen, roles: ["ADMIN", "STUDENT"] },
    ],
  },
  {
    title: "Staff Management",
    roles: ["ADMIN"],
    items: [
      { name: "Users", href: "/dashboard/users", icon: UserCog, roles: ["ADMIN"] },
      { name: "Roles", href: "/dashboard/roles", icon: Shield, roles: ["ADMIN"] },
      { name: "Permissions", href: "/dashboard/permissions", icon: Shield, roles: ["ADMIN"] },
      { name: "Staff", href: "/dashboard/staff", icon: Users, roles: ["ADMIN"] },
      { name: "Teacher Assignments", href: "/dashboard/teacher-assignments", icon: UserCog, roles: ["ADMIN"] },
    ],
  },
  {
    title: "Results",
    roles: ["TEACHER", "ADMIN", "PRINCIPAL", "STUDENT", "PARENT"],
    items: [
      { name: "Enter Results", href: "/dashboard/results", icon: BarChart3, roles: ["TEACHER"] },
      { name: "Class Results", href: "/dashboard/class-results", icon: BarChart3, roles: ["TEACHER"] },
      { name: "Approvals", href: "/dashboard/approvals", icon: CheckCircle, roles: ["PRINCIPAL", "ADMIN"] },
      { name: "View Results", href: "/dashboard/results", icon: BarChart3, roles: ["STUDENT", "PARENT", "PRINCIPAL", "ADMIN"] },
    ],
  },
  {
    title: "Operations",
    roles: ["ADMIN", "PRINCIPAL", "ACCOUNTANT", "LIBRARIAN"],
    items: [
      { name: "Attendance", href: "/dashboard/attendance", icon: ClipboardList, roles: ["ADMIN", "PRINCIPAL", "TEACHER", "STUDENT", "PARENT"] },
      { name: "Fees", href: "/dashboard/fees", icon: DollarSign, roles: ["ADMIN", "PRINCIPAL", "ACCOUNTANT", "STUDENT", "PARENT"] },
      { name: "Inventory", href: "/dashboard/inventory", icon: Package, roles: ["ADMIN", "PRINCIPAL", "LIBRARIAN"] },
    ],
  },
  {
    title: "Communication",
    roles: ["ALL"],
    items: [
      { name: "Announcements", href: "/dashboard/announcements", icon: Bell, roles: ["ALL"] },
    ],
  },
  {
    title: "Tools",
    roles: ["ADMIN"],
    items: [
      { name: "Bulk Upload", href: "/dashboard/bulk-upload", icon: Upload, roles: ["ADMIN"] },
      { name: "Signatures", href: "/dashboard/signatures", icon: Settings, roles: ["ADMIN", "PRINCIPAL", "TEACHER"] },
    ],
  },
  {
    title: "System",
    roles: ["ADMIN", "PRINCIPAL"],
    items: [
      { name: "Audit Trails", href: "/dashboard/audit-trails", icon: History, roles: ["ADMIN", "PRINCIPAL"] },
      { name: "Session Logs", href: "/dashboard/session-logs", icon: Activity, roles: ["ADMIN", "PRINCIPAL"] },
      { name: "Email Config", href: "/dashboard/email-config", icon: Mail, roles: ["ADMIN", "PRINCIPAL"] },
      { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["ADMIN", "PRINCIPAL"] },
    ],
  },
]

interface SidebarProps {
  userRole: string
  userName?: string
  onClose?: () => void
}

export function Sidebar({ userRole, userName, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  const filteredGroups = menuGroups.filter((group) =>
    group.roles.includes("ALL") || group.roles.includes(userRole)
  )

  // Auto-open groups with active items on mount
  useEffect(() => {
    const groupsToOpen = new Set<string>()
    filteredGroups.forEach((group) => {
      const hasActiveItem = group.items.some(
        (item) =>
          (item.roles.includes("ALL") || item.roles.includes(userRole)) &&
          pathname === item.href
      )
      if (hasActiveItem) {
        groupsToOpen.add(group.title)
      }
    })
    if (groupsToOpen.size > 0) {
      setOpenGroups((prev) => {
        // Merge with existing open groups
        const merged = new Set(prev)
        groupsToOpen.forEach((title) => merged.add(title))
        return merged
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]) // Only run when pathname changes

  const handleLinkClick = () => {
    // Close mobile sidebar when a link is clicked
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-14 sm:h-16 items-center justify-between border-b px-4 sm:px-6">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="text-base sm:text-xl font-bold truncate">School Management</h1>
        </div>
        {/* Mobile close button */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* User info in sidebar - shown on desktop */}
      {userName && (
        <div className="hidden lg:flex items-center gap-2 px-4 sm:px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-muted-foreground capitalize">{userRole.toLowerCase()}</p>
          </div>
        </div>
      )}
      
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 sm:p-4">
        {filteredGroups.map((group) => {
          const filteredItems = group.items.filter(
            (item) =>
              item.roles.includes("ALL") || item.roles.includes(userRole)
          )

          if (filteredItems.length === 0) return null

          const isOpen = openGroups.has(group.title)
          const hasActiveItem = filteredItems.some(
            (item) => pathname === item.href
          )

          return (
            <Collapsible
              key={group.title}
              open={isOpen}
              onOpenChange={() => toggleGroup(group.title)}
            >
              <CollapsibleTrigger className="w-full">
                <div
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2 sm:px-3 py-2 text-sm font-medium transition-colors",
                    hasActiveItem
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span className="truncate">{group.title}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 ml-2" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="ml-2 mt-1 space-y-1 border-l-2 border-muted pl-2 sm:pl-3">
                  {filteredItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={handleLinkClick}
                        className={cn(
                          "flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </nav>
      <div className="border-t p-3 sm:p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={async () => {
            try {
              await fetch("/api/session-logs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
              })
            } catch (error) {
              console.error("Failed to log session logout:", error)
            }
            signOut({ callbackUrl: "/login" })
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span className="truncate">Logout</span>
        </Button>
      </div>
    </div>
  )
}

