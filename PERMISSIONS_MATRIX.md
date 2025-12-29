# Permissions Matrix - Quick Reference

## Visual Permission Summary by Role

### All Roles vs All Modules

| Module | ADMIN | PRINCIPAL | CLASS_TEACHER | TEACHER | ACADEMIC_COORD | STUDENT | PARENT | FINANCE_MGR | ATTENDANCE_OFF | INVENTORY_MGR |
|--------|-------|-----------|---------------|---------|----------------|---------|--------|-------------|----------------|---------------|
| **Students** | CRUD | R | R (sec) | R (sec) | R | Self | Child | R | R | R |
| **Staff** | CRUD | R | - | - | R | - | - | - | - | - |
| **Classes** | CRUD | R | R | - | CRU | - | - | - | R | - |
| **Sections** | CRUD | R | R | - | CRU | - | - | - | R | - |
| **Subjects** | CRUD | R | - | R | CRUD | - | - | - | - | - |
| **Enrollment** | CRUD | R | R (sec) | R (sec) | CRUD | Self | Child | R | - | - |
| **Teacher Assign** | CRUD | R | - | - | CRUD | - | - | - | - | - |
| **Results** | CRUD+ | R+Approve | Review+Reject | CRU+Submit | R | Self | Child | R | - | - |
| **Exams** | CRUD+ | CRUD+ | - | R | CRUD+ | - | - | - | - | - |
| **Reports** | CRUD+ | CRU+Approve | CRU+Comment | CRU+Comment | - | Self | Child | - | - | - |
| **Fees** | CRUD | R+Report | - | - | - | - | View | CRUD+ | - | - |
| **Attendance** | CRUD | R+Report | CRU | CRU+Report | - | - | Child | - | CRUD | - |
| **Inventory** | CRUD | R | - | - | - | - | - | - | - | CRUD |
| **Announcements** | CRUD | CRUD | R | R | R | R | R | R | R | R |
| **Roles & Perms** | CRUD | - | - | - | - | - | - | - | - | - |
| **Users** | CRUD+ | R+Assign | - | - | - | Self | - | R | - | - |
| **Settings** | CRUD | R | - | - | - | Personal | Personal | - | - | - |
| **Audit** | R+Export | R | - | - | - | - | - | R | - | R |

**Legend**: 
- **C** = Create
- **R** = Read
- **U** = Update
- **D** = Delete
- **(sec)** = Section-specific only
- **(child)** = Own child only
- **+** = Additional actions (approve, submit, etc.)
- **-** = No access

---

## Permission Action Flow Chart

### Student Results Entry & Approval

```
TEACHER enters marks
    ↓
    └─→ results.create, results.update
    ↓
TEACHER submits for review
    └─→ results.submit
    ↓
CLASS_TEACHER reviews marks
    └─→ results.class_teacher_review
    ├─→ Approve (auto forward) OR
    └─→ Reject (results.reject + notify teacher)
    ↓
If approved:
PRINCIPAL reviews & approves
    └─→ results.principal_review, results.approve
    ↓
Marks finalized
```

### Report Generation & Approval

```
TEACHER generates report
    ├─→ System validates all core subjects approved
    ├─→ reports.generate
    ↓
TEACHER adds comments & signature
    └─→ reports.add_comments
    ↓
TEACHER submits report
    └─→ reports.submit (status: PENDING_PRINCIPAL)
    ↓
PRINCIPAL reviews multiple reports
    └─→ reports.bulk_approve
    ↓
PRINCIPAL approves
    └─→ reports.approve (status: APPROVED)
    ↓
Report visible to students & parents
```

### Class Structure Management

```
ACADEMIC_COORDINATOR creates class
    └─→ classes.create
    ↓
ACADEMIC_COORDINATOR creates sections
    └─→ sections.create
    ↓
ACADEMIC_COORDINATOR assigns subjects
    └─→ subjects.assign_to_class
    ↓
ACADEMIC_COORDINATOR enrolls students
    └─→ enrollment.create / enrollment.bulk_upload
    ↓
ACADEMIC_COORDINATOR assigns teachers
    └─→ teacher_assignments.create / teacher_assignments.bulk_upload
    ↓
PRINCIPAL reviews setup
    ↓
TEACHER can access assigned sections
```

---

## Detailed Permission Breakdown by Role

### ADMIN - Complete System Access

```typescript
const ADMIN_PERMISSIONS = {
  students: ["create", "read", "update", "delete", "bulk_upload", "export"],
  staff: ["create", "read", "update", "delete", "bulk_upload"],
  classes: ["create", "read", "update", "delete", "manage_teachers"],
  sections: ["create", "read", "update", "delete"],
  subjects: ["create", "read", "update", "delete", "assign_to_class"],
  enrollment: ["create", "read", "update", "delete", "bulk_upload", "manage_subjects"],
  teacher_assignments: ["create", "read", "update", "delete", "bulk_upload"],
  results: ["create", "read", "update", "delete", "bulk_upload", "submit", 
            "class_teacher_review", "principal_review", "approve", "reject", "view_all"],
  exams: ["create", "read", "update", "delete", "schedule", "publish"],
  reports: ["generate", "read", "delete", "submit", "bulk_approve", 
            "add_comments", "edit_comments", "delete_comments", 
            "configure_templates", "view_all", "print"],
  fees: ["create", "read", "update", "delete", "track_payments", 
         "generate_reports", "adjust"],
  attendance: ["create", "read", "update", "delete", "bulk_upload", "report"],
  inventory: ["create", "read", "update", "delete", "track_transactions"],
  announcements: ["create", "read", "update", "delete", "publish"],
  roles: ["create", "read", "update", "delete"],
  permissions: ["create", "read", "update", "delete"],
  users: ["create", "read", "update", "delete", "assign_roles", 
          "reset_password", "activate_deactivate"],
  settings: ["read", "update", "email_config", "manage_terms"],
  audit: ["read", "export"],
  session_logs: ["read"],
}
```

### PRINCIPAL - Educational Leadership

```typescript
const PRINCIPAL_PERMISSIONS = {
  // Read access to all data
  students: ["read"],
  staff: ["read"],
  classes: ["read", "manage_teachers"],
  sections: ["read"],
  subjects: ["read"],
  enrollment: ["read"],
  teacher_assignments: ["read"],
  
  // Academic approval authority
  results: ["read", "principal_review", "approve", "reject", "view_all"],
  exams: ["read", "schedule", "publish"],
  
  // Report oversight
  reports: ["read", "bulk_approve", "view_all", "print"],
  
  // School management
  announcements: ["create", "read", "update", "delete", "publish"],
  fees: ["read", "track_payments", "generate_reports"],
  attendance: ["read", "report"],
  inventory: ["read"],
  
  // User management
  users: ["read", "assign_roles"],
  
  // Monitoring
  audit: ["read"],
  notifications: ["read"],
  settings: ["read"],
}
```

### TEACHER - Daily Operations

```typescript
const TEACHER_PERMISSIONS = {
  // Their students and sections
  students: ["read"],  // Section-specific
  
  // Their subjects
  subjects: ["read"],
  enrollment: ["read"],  // Section-specific
  
  // Core responsibilities
  results: ["create", "read", "update", "bulk_upload", "submit"],
  attendance: ["create", "read", "update", "bulk_upload", "report"],
  
  // Feedback & reports
  reports: ["generate", "read", "add_comments", "edit_comments", 
            "delete_comments", "configure_templates", "print"],
  
  // Information access
  exams: ["read"],
  announcements: ["read"],
  
  // Personal
  users: ["read"],  // Self only
}
```

### CLASS_TEACHER - Section Leadership

```typescript
const CLASS_TEACHER_PERMISSIONS = {
  // Same as TEACHER plus:
  
  // Result review authority
  results: ["read", "class_teacher_review", "reject"],
  
  // Section oversight
  enrollment: ["read"],  // Section-specific with update
  students: ["read"],    // Section-specific
}
```

### ACADEMIC_COORDINATOR - Curriculum Management

```typescript
const ACADEMIC_COORDINATOR_PERMISSIONS = {
  // Structure management
  classes: ["create", "read", "update"],
  sections: ["create", "read", "update"],
  subjects: ["create", "read", "update", "assign_to_class"],
  
  // Enrollment & assignment
  enrollment: ["create", "read", "update", "bulk_upload", "manage_subjects"],
  teacher_assignments: ["create", "read", "update", "bulk_upload"],
  
  // Exam scheduling
  exams: ["create", "read", "update", "schedule", "publish"],
  
  // View results
  results: ["read"],
  
  // Information
  students: ["read"],
  staff: ["read"],
  announcements: ["read"],
}
```

### STUDENT - Own Academic Info

```typescript
const STUDENT_PERMISSIONS = {
  students: ["read"],      // Self only
  enrollment: ["read"],    // Self only
  results: ["read"],       // Self only
  reports: ["read", "print"],  // Self only
  announcements: ["read"],
  users: ["read"],         // Self only
}
```

### PARENT - Child Monitoring

```typescript
const PARENT_PERMISSIONS = {
  students: ["read"],      // Linked children only
  enrollment: ["read"],    // Child's only
  results: ["read"],       // Child's only
  reports: ["read", "print"],  // Child's only
  attendance: ["read"],    // Child's only
  fees: ["read"],          // View payment status
  announcements: ["read"],
  notifications: ["read"],
}
```

### FINANCE_MANAGER - Financial Operations

```typescript
const FINANCE_MANAGER_PERMISSIONS = {
  students: ["read"],
  fees: ["create", "read", "update", "delete", "track_payments", 
         "generate_reports", "adjust"],
  announcements: ["read"],
  users: ["read"],
  audit: ["read"],
}
```

### ATTENDANCE_OFFICER - Attendance Tracking

```typescript
const ATTENDANCE_OFFICER_PERMISSIONS = {
  students: ["read"],
  classes: ["read"],
  sections: ["read"],
  attendance: ["create", "read", "update", "delete", "bulk_upload", "report"],
  announcements: ["read"],
  users: ["read"],
}
```

### INVENTORY_MANAGER - Asset Management

```typescript
const INVENTORY_MANAGER_PERMISSIONS = {
  inventory: ["create", "read", "update", "delete", "track_transactions"],
  staff: ["read"],
  announcements: ["read"],
  users: ["read"],
  audit: ["read"],
}
```

---

## Implementation Code Examples

### Check Permission in Backend

```typescript
// Option 1: Single permission check
import { requirePermission, Permissions } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  const session = await requirePermission(request, Permissions.RESULTS_CREATE)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Implementation...
}

// Option 2: Multiple permissions check
import { requireAnyPermission } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  const session = await requireAnyPermission(request, [
    Permissions.RESULTS_READ,
    Permissions.REPORTS_READ,
  ])
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // Implementation...
}
```

### Filter Data Based on Permissions

```typescript
import { getUserPermissions } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const permissions = await getUserPermissions(session.user.id)
  
  let query: any = {}
  
  // Teacher - only their sections
  if (permissions.includes("results.read") && !permissions.includes("results.view_all")) {
    const teacher = await prisma.staff.findUnique({
      where: { userId: session.user.id }
    })
    query = {
      classSubject: {
        sectionId: { in: teacher.managedSections.map(s => s.id) }
      }
    }
  }
  
  // Admin/Principal - all data
  if (permissions.includes("results.view_all")) {
    query = {}
  }
  
  const results = await prisma.result.findMany({ where: query })
  return NextResponse.json(results)
}
```

### Check Permission in Frontend

```typescript
import { useSession } from "next-auth/react"
import { hasPermission } from "@/lib/permissions"

export function ResultsForm() {
  const { data: session } = useSession()
  const [canCreate, setCanCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkPermission() {
      if (session?.user?.id) {
        const can = await hasPermission(session.user.id, "results.create")
        setCanCreate(can)
      }
      setLoading(false)
    }
    checkPermission()
  }, [session])

  if (loading) return <div>Checking permissions...</div>
  if (!canCreate) return <div>You don't have permission to create results</div>
  
  return (
    <form>
      {/* Form content */}
    </form>
  )
}
```

### Conditional UI Rendering

```typescript
import { usePermissions } from "@/hooks/use-permissions"

export function DashboardNav() {
  const { hasPermission, loading } = usePermissions()

  if (loading) return <Skeleton />

  return (
    <nav>
      {hasPermission("students.create") && (
        <NavItem href="/dashboard/students/new">Add Student</NavItem>
      )}
      
      {hasPermission("results.create") && (
        <NavItem href="/dashboard/results">Enter Results</NavItem>
      )}
      
      {hasPermission("reports.bulk_approve") && (
        <NavItem href="/dashboard/reports/bulk-approve">Approve Reports</NavItem>
      )}
      
      {hasPermission("users.assign_roles") && (
        <NavItem href="/dashboard/users">Manage Users</NavItem>
      )}
    </nav>
  )
}
```

---

## Database Setup Script

### Create Permissions

```sql
-- Create all permissions
INSERT INTO "Permission" (id, name, description, module, action) VALUES
-- Students
('perm-001', 'students.create', 'Create new student records', 'students', 'create'),
('perm-002', 'students.read', 'View student information', 'students', 'read'),
('perm-003', 'students.update', 'Modify student details', 'students', 'update'),
('perm-004', 'students.delete', 'Remove student records', 'students', 'delete'),
('perm-005', 'students.bulk_upload', 'Bulk import students', 'students', 'bulk_upload'),

-- Results
('perm-101', 'results.create', 'Create result records', 'results', 'create'),
('perm-102', 'results.read', 'View results', 'results', 'read'),
('perm-103', 'results.update', 'Modify results', 'results', 'update'),
('perm-104', 'results.delete', 'Remove results', 'results', 'delete'),
('perm-105', 'results.submit', 'Submit results for approval', 'results', 'submit'),
('perm-106', 'results.class_teacher_review', 'Review class results', 'results', 'class_teacher_review'),
('perm-107', 'results.principal_review', 'Review and approve results', 'results', 'principal_review'),
('perm-108', 'results.approve', 'Final result approval', 'results', 'approve'),
('perm-109', 'results.reject', 'Reject results', 'results', 'reject'),
('perm-110', 'results.view_all', 'View all results', 'results', 'view_all');

-- Add more permissions for other modules...
```

### Create Roles

```sql
INSERT INTO "Role" (id, name, description, isSystem) VALUES
('role-001', 'ADMIN', 'System Administrator', true),
('role-002', 'PRINCIPAL', 'School Principal', true),
('role-003', 'TEACHER', 'Classroom Teacher', true),
('role-004', 'CLASS_TEACHER', 'Class Teacher (Lead)', true),
('role-005', 'STUDENT', 'Student Account', true),
('role-006', 'PARENT', 'Parent/Guardian', true),
('role-007', 'ACADEMIC_COORDINATOR', 'Academic Coordinator', true),
('role-008', 'FINANCE_MANAGER', 'Finance Manager', true),
('role-009', 'ATTENDANCE_OFFICER', 'Attendance Officer', true),
('role-010', 'INVENTORY_MANAGER', 'Inventory Manager', true);
```

### Assign Permissions to TEACHER Role

```sql
-- First, get role ID
SELECT id FROM "Role" WHERE name = 'TEACHER';
-- Result: role-003

-- Then assign permissions
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
('role-003', 'perm-002', true),  -- students.read
('role-003', 'perm-101', true),  -- results.create
('role-003', 'perm-102', true),  -- results.read
('role-003', 'perm-103', true),  -- results.update
-- ... more permissions
```

### Assign Role to User

```sql
-- Assign TEACHER role to user
INSERT INTO "UserRole" (userId, roleId) VALUES
('user-id-123', 'role-003');  -- TEACHER role

-- User automatically inherits all permissions from TEACHER role
```

---

## Testing Permissions

### Test Permission Checking

```typescript
import { hasPermission, hasAllPermissions, hasAnyPermission } from "@/lib/permissions"

// Test single permission
const canCreate = await hasPermission("user-123", "results.create")
console.log("Can create results?", canCreate)

// Test all permissions
const canApprove = await hasAllPermissions("user-123", [
  "results.view_all",
  "results.approve"
])
console.log("Can approve results?", canApprove)

// Test any permission
const canAccess = await hasAnyPermission("user-123", [
  "results.read",
  "results.create"
])
console.log("Can access results?", canAccess)
```

### Test Role Assignment

```typescript
// Assign role to user
await prisma.userRole.create({
  data: {
    userId: "user-123",
    roleId: "role-003",  // TEACHER
  },
})

// Check permissions are inherited
const permissions = await getUserPermissions("user-123")
console.log("User permissions:", permissions)
// Should include: results.create, results.read, results.update, ...
```

---

## Summary

This permissions system provides:

✅ **Granular Control** - Define permissions for every action
✅ **Flexible Roles** - Create custom roles or use standard ones
✅ **Easy Assignment** - Assign roles to users for simplicity
✅ **Backward Compatibility** - Support legacy systems
✅ **Audit Trail** - Track permission changes
✅ **Security** - Principle of least privilege
✅ **Scalability** - Handle custom requirements

Use this matrix as a reference guide for implementing access control in your school management system.
