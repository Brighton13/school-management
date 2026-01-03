import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextRequest } from "next/server"

/**
 * Check if a user has a specific permission
 * This checks both direct user permissions and permissions from roles
 */
export async function hasPermission(
  userId: string,
  permissionName: string
): Promise<boolean> {
  try {
    // Get user with all permissions (direct and from roles)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: {
          where: { granted: true },
          include: { permission: true },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  where: { granted: true },
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    })

    if (!user) return false

    const hasRoles = user.roles && user.roles.length > 0

    if (hasRoles) {
      // User has roles - ONLY check permissions from roles (ignore direct permissions)
      for (const userRole of user.roles) {
        const rolePermission = userRole.role.permissions.find(
          (rp) => rp.permission.name === permissionName && rp.granted
        )
        if (rolePermission) return true
      }
      return false
    } else {
      // No roles assigned - check direct permissions
      const directPermission = user.permissions.find(
        (up) => up.permission.name === permissionName && up.granted
      )
      return !!directPermission
    }
  } catch (error) {
    console.error("Error checking permission:", error)
    return false
  }
}

/**
 * Check if a user has any of the specified permissions
 */
export async function hasAnyPermission(
  userId: string,
  permissionNames: string[]
): Promise<boolean> {
  for (const permissionName of permissionNames) {
    if (await hasPermission(userId, permissionName)) {
      return true
    }
  }
  return false
}

/**
 * Check if a user has all of the specified permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissionNames: string[]
): Promise<boolean> {
  for (const permissionName of permissionNames) {
    if (!(await hasPermission(userId, permissionName))) {
      return false
    }
  }
  return true
}

/**
 * Get all permissions for a user (from roles and direct assignments)
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        permissions: {
          where: { granted: true },
          include: { permission: true },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  where: { granted: true },
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    })

    if (!user) return []

    const permissionSet = new Set<string>()
    const hasRoles = user.roles && user.roles.length > 0

    if (hasRoles) {
      // User has roles - ONLY use permissions from roles (ignore direct permissions)
      user.roles.forEach((userRole) => {
        userRole.role.permissions.forEach((rp) => {
          if (rp.granted) {
            permissionSet.add(rp.permission.name)
          }
        })
      })
    } else {
      // No roles assigned - use direct permissions
      user.permissions.forEach((up) => {
        if (up.granted) {
          permissionSet.add(up.permission.name)
        }
      })
    }

    return Array.from(permissionSet)
  } catch (error) {
    console.error("Error getting user permissions:", error)
    return []
  }
}

/**
 * Middleware helper to check permissions in API routes
 * Returns the session if authorized, null otherwise
 */
export async function requirePermission(
  request: NextRequest,
  permissionName: string
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }

  // Allow legacy ADMIN role as fallback for initial setup
  if (session.user.role === "ADMIN") {
    return session
  }

  const hasAccess = await hasPermission(session.user.id, permissionName)
  if (!hasAccess) {
    return null
  }

  return session
}

/**
 * Middleware helper to check if user has any of the specified permissions
 */
export async function requireAnyPermission(
  request: NextRequest,
  permissionNames: string[]
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }

  // Allow legacy ADMIN role as fallback for initial setup
  if (session.user.role === "ADMIN") {
    return session
  }

  const hasAccess = await hasAnyPermission(session.user.id, permissionNames)
  if (!hasAccess) {
    return null
  }

  return session
}

/**
 * Generate permission name from module and action
 */
export function getPermissionName(module: string, action: string): string {
  return `${module}.${action}`
}

/**
 * Common permission names for easy reference
 */
export const Permissions = {
  // Students
  STUDENTS_CREATE: "students.create",
  STUDENTS_READ: "students.read",
  STUDENTS_UPDATE: "students.update",
  STUDENTS_DELETE: "students.delete",

  // Staff
  STAFF_CREATE: "staff.create",
  STAFF_READ: "staff.read",
  STAFF_UPDATE: "staff.update",
  STAFF_DELETE: "staff.delete",

  // Classes
  CLASSES_CREATE: "classes.create",
  CLASSES_READ: "classes.read",
  CLASSES_UPDATE: "classes.update",
  CLASSES_DELETE: "classes.delete",

  // Sections
  SECTIONS_CREATE: "sections.create",
  SECTIONS_READ: "sections.read",
  SECTIONS_UPDATE: "sections.update",
  SECTIONS_DELETE: "sections.delete",

  // Terms
  TERMS_CREATE: "terms.create",
  TERMS_READ: "terms.read",
  TERMS_UPDATE: "terms.update",
  TERMS_DELETE: "terms.delete",

  // Academic Years
  ACADEMIC_YEARS_CREATE: "academic_years.create",
  ACADEMIC_YEARS_READ: "academic_years.read",
  ACADEMIC_YEARS_UPDATE: "academic_years.update",
  ACADEMIC_YEARS_DELETE: "academic_years.delete",

  // Subjects
  SUBJECTS_CREATE: "subjects.create",
  SUBJECTS_READ: "subjects.read",
  SUBJECTS_UPDATE: "subjects.update",
  SUBJECTS_DELETE: "subjects.delete",

  // Results
  RESULTS_CREATE: "results.create",
  RESULTS_READ: "results.read",
  RESULTS_UPDATE: "results.update",
  RESULTS_DELETE: "results.delete",
  RESULTS_APPROVE: "results.approve",
  RESULTS_REVIEW: "results.review",
  RESULTS_CLASS_TEACHER_SUBMIT: "results.class_teacher_submit",
  RESULTS_PRINCIPAL_APPROVE: "results.principal_approve",

  // Reports
  REPORTS_GENERATE: "reports.generate",
  REPORTS_VIEW: "reports.view",
  REPORTS_DOWNLOAD: "reports.download",
  REPORTS_BULK_GENERATE: "reports.bulk_generate",
  REPORTS_COMMENTS_CREATE: "reports.comments.create",
  REPORTS_COMMENTS_READ: "reports.comments.read",
  REPORTS_COMMENTS_UPDATE: "reports.comments.update",
  REPORTS_COMMENTS_DELETE: "reports.comments.delete",

  // Signatures
  SIGNATURES_CREATE: "signatures.create",
  SIGNATURES_READ: "signatures.read",
  SIGNATURES_UPDATE: "signatures.update",
  SIGNATURES_DELETE: "signatures.delete",

  // Fees
  FEES_CREATE: "fees.create",
  FEES_READ: "fees.read",
  FEES_UPDATE: "fees.update",
  FEES_DELETE: "fees.delete",

  // Exams
  EXAMS_CREATE: "exams.create",
  EXAMS_READ: "exams.read",
  EXAMS_UPDATE: "exams.update",
  EXAMS_DELETE: "exams.delete",

  // Enrollment
  ENROLLMENT_CREATE: "enrollment.create",
  ENROLLMENT_READ: "enrollment.read",
  ENROLLMENT_UPDATE: "enrollment.update",
  ENROLLMENT_DELETE: "enrollment.delete",

  // Inventory
  INVENTORY_CREATE: "inventory.create",
  INVENTORY_READ: "inventory.read",
  INVENTORY_UPDATE: "inventory.update",
  INVENTORY_DELETE: "inventory.delete",

  // Announcements
  ANNOUNCEMENTS_CREATE: "announcements.create",
  ANNOUNCEMENTS_READ: "announcements.read",
  ANNOUNCEMENTS_UPDATE: "announcements.update",
  ANNOUNCEMENTS_DELETE: "announcements.delete",

  // Roles & Permissions
  ROLES_CREATE: "roles.create",
  ROLES_READ: "roles.read",
  ROLES_UPDATE: "roles.update",
  ROLES_DELETE: "roles.delete",
  PERMISSIONS_CREATE: "permissions.create",
  PERMISSIONS_READ: "permissions.read",
  PERMISSIONS_UPDATE: "permissions.update",
  PERMISSIONS_DELETE: "permissions.delete",

  // Users
  USERS_CREATE: "users.create",
  USERS_READ: "users.read",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",

  // Settings
  SETTINGS_READ: "settings.read",
  SETTINGS_UPDATE: "settings.update",

  // Audit & Logs
  AUDIT_READ: "audit.read",
  SESSION_LOGS_READ: "session_logs.read",

  // Teacher Assignments
  TEACHER_ASSIGNMENTS_CREATE: "teacher_assignments.create",
  TEACHER_ASSIGNMENTS_READ: "teacher_assignments.read",
  TEACHER_ASSIGNMENTS_UPDATE: "teacher_assignments.update",
  TEACHER_ASSIGNMENTS_DELETE: "teacher_assignments.delete",

  // Promotions
  PROMOTIONS_CREATE: "promotions.create",
  PROMOTIONS_READ: "promotions.read",
  PROMOTIONS_UPDATE: "promotions.update",
  PROMOTIONS_DELETE: "promotions.delete",

  // Applications
  APPLICATIONS_CREATE: "applications.create",
  APPLICATIONS_READ: "applications.read",
  APPLICATIONS_UPDATE: "applications.update",
  APPLICATIONS_DELETE: "applications.delete",
}

