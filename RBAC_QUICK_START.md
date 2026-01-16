# RBAC Implementation Checklist & Visual Guide

## Quick Start Checklist

### Phase 1: Database Setup (Estimated time: 15 minutes)

- [ ] Run `RBAC_SETUP_GUIDE.md` - Step 1: Create All Permissions (SQL script)
  - Creates 108+ permissions in the database
  - Estimated: 2 minutes
  
- [ ] Run `RBAC_SETUP_GUIDE.md` - Step 2: Create All Roles (SQL script)
  - Creates 10 standard roles
  - Estimated: 1 minute
  
- [ ] Run `RBAC_SETUP_GUIDE.md` - Step 3: Assign Permissions to Roles (SQL scripts)
  - Assigns permissions to each role
  - Estimated: 5 minutes
  
- [ ] Run `RBAC_SETUP_GUIDE.md` - Step 4: Assign Roles to Existing Users (SQL script)
  - Maps legacy roles to new RBAC system
  - Estimated: 2 minutes
  
- [ ] Run verification queries from `RBAC_SETUP_GUIDE.md`
  - Verify all permissions, roles, and assignments are in place
  - Estimated: 3 minutes

### Phase 2: Code Implementation (Estimated time: 2-4 hours)

#### Backend API Updates

- [ ] Add permission checks to all API routes
  - Use `requirePermission(request, Permissions.MODULE_ACTION)`
  - Files to update: All files in `app/api/**/*.ts`
  - Estimated: 1.5 hours
  - Example:
    ```typescript
    export async function POST(request: NextRequest) {
      const session = await requirePermission(request, Permissions.STUDENTS_CREATE)
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    ```

- [ ] Add data filtering based on user role
  - Filter query results based on role/permissions
  - Example: Teachers only see their sections
  - Estimated: 1 hour

#### Frontend Updates

- [ ] Update navigation/menu based on permissions
  - Show/hide menu items based on user permissions
  - Use `usePermissions` hook
  - Estimated: 30 minutes

- [ ] Update dashboard pages
  - Show/hide sections based on user role
  - Hide actions user doesn't have permission for
  - Estimated: 30 minutes

- [ ] Add permission-based UI components
  - Hide buttons/forms user can't access
  - Show "No permission" messages
  - Estimated: 30 minutes

### Phase 3: Testing (Estimated time: 1-2 hours)

- [ ] Test ADMIN user - should have access to everything
  - [ ] Create student
  - [ ] Create staff
  - [ ] Enter results
  - [ ] Generate reports
  - [ ] Manage users and roles

- [ ] Test PRINCIPAL user - should have approval powers
  - [ ] Can view all students
  - [ ] Can review and approve results
  - [ ] Can bulk approve reports
  - [ ] Cannot create new students

- [ ] Test TEACHER user - should have limited access
  - [ ] Can enter marks for their students only
  - [ ] Can add comments to reports
  - [ ] Cannot view other sections' marks
  - [ ] Cannot manage users

- [ ] Test STUDENT user - should have read-only access
  - [ ] Can view own marks
  - [ ] Can view own report card
  - [ ] Cannot modify any data
  - [ ] Cannot see other students' data

- [ ] Test PARENT user - should see child data only
  - [ ] Can view child's marks
  - [ ] Can view child's attendance
  - [ ] Cannot see other students' data
  - [ ] Cannot modify any data

- [ ] Test permission inheritance
  - [ ] User with role gets all role permissions
  - [ ] Removing role removes permissions
  - [ ] Assigning new role adds new permissions

### Phase 4: Production Deployment

- [ ] Backup database before making changes
- [ ] Run setup scripts in test environment first
- [ ] Verify all users have appropriate roles assigned
- [ ] Test with real users in test environment
- [ ] Deploy to production
- [ ] Monitor for permission-related errors
- [ ] Train users on new system
- [ ] Document any custom roles or permissions

---

## Visual Role Hierarchy

### Access Level Pyramid

```
┌─────────────────────────────────────┐
│           SYSTEM ADMIN              │  ← Full system control
│      (All permissions)              │
├─────────────────────────────────────┤
│          PRINCIPAL                  │  ← Academic oversight
│   (Approval + Reporting)            │
├──────────────────┬──────────────────┤
│    ACADEMIC      │   CLASS TEACHER  │  ← Specialized roles
│  COORDINATOR     │   + TEACHER      │     with broad access
├─────────────────────────────────────┤
│  FINANCE | INVENTORY | ATTENDANCE   │  ← Specialized functions
│  MANAGER  MANAGER     OFFICER       │
├─────────────────────────────────────┤
│    TEACHER | STAFF | PARENT         │  ← Limited to scope
├─────────────────────────────────────┤
│         STUDENT                     │  ← Personal access only
└─────────────────────────────────────┘
```

### Permission Flow by Role

```
ADMIN
  ├─ Students (full CRUD)
  ├─ Staff (full CRUD)
  ├─ Classes (full CRUD)
  ├─ Sections (full CRUD)
  ├─ Subjects (full CRUD)
  ├─ Results (full CRUD + approve)
  ├─ Reports (full CRUD + approve)
  ├─ Exams (full CRUD)
  ├─ Fees (full CRUD)
  ├─ Attendance (full CRUD)
  ├─ Inventory (full CRUD)
  ├─ Users (full CRUD + assign roles)
  ├─ Roles (full CRUD)
  ├─ Permissions (full CRUD)
  └─ Audit (view + export)

PRINCIPAL
  ├─ Students (read)
  ├─ Staff (read)
  ├─ Results (review + approve)
  ├─ Reports (review + bulk approve)
  ├─ Exams (view + schedule + publish)
  ├─ Announcements (full CRUD)
  ├─ Users (read + assign roles)
  └─ Audit (read)

TEACHER (Section-specific)
  ├─ Students (read - their section)
  ├─ Results (create + submit - their section)
  ├─ Reports (generate + add comments - their section)
  ├─ Attendance (mark + report - their section)
  ├─ Exams (read)
  └─ Announcements (read)

STUDENT (Self-only)
  ├─ Own marks (read)
  ├─ Own reports (read + print)
  ├─ Own profile (read)
  └─ Announcements (read)

PARENT (Child-specific)
  ├─ Child marks (read)
  ├─ Child reports (read + print)
  ├─ Child attendance (read)
  ├─ Child profile (read)
  ├─ Fees (read)
  └─ Announcements (read)
```

---

## Code Implementation Examples

### Example 1: API Route with Permission Check

```typescript
// app/api/students/route.ts

import { NextRequest, NextResponse } from "next/server"
import { requirePermission, Permissions } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

// CREATE - Requires permission
export async function POST(request: NextRequest) {
  const session = await requirePermission(request, Permissions.STUDENTS_CREATE)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const student = await prisma.student.create({
    data: body,
  })
  return NextResponse.json(student, { status: 201 })
}

// READ - Different permissions based on role
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const permissions = await getUserPermissions(session.user.id)
  
  // STUDENT can only read self
  if (permissions.includes("students.read") && !permissions.includes("users.assign_roles")) {
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    })
    return NextResponse.json([student])
  }
  
  // ADMIN/PRINCIPAL can read all
  if (permissions.includes("students.read")) {
    const students = await prisma.student.findMany()
    return NextResponse.json(students)
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

### Example 2: Frontend Component with Permission Check

```typescript
// components/student-form.tsx

import { useSession } from "next-auth/react"
import { usePermissions } from "@/hooks/use-permissions"

export function StudentForm() {
  const { data: session } = useSession()
  const { hasPermission, loading } = usePermissions()

  if (loading) return <Skeleton />
  if (!hasPermission("students.create")) {
    return <div className="text-red-500">You don't have permission to create students</div>
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      
      {/* Show delete button only if user can delete */}
      {hasPermission("students.delete") && (
        <button type="button" onClick={handleDelete} className="text-red-500">
          Delete
        </button>
      )}
    </form>
  )
}
```

### Example 3: Navigation with Permission-based Menu

```typescript
// components/layout/navigation.tsx

import { usePermissions } from "@/hooks/use-permissions"

export function Navigation() {
  const { hasPermission } = usePermissions()

  return (
    <nav className="space-y-2">
      {/* Dashboard - everyone */}
      <NavItem href="/dashboard">Dashboard</NavItem>

      {/* Students - only if can read or manage students */}
      {(hasPermission("students.read") || hasPermission("students.create")) && (
        <NavItem href="/dashboard/students">Students</NavItem>
      )}

      {/* Results - teachers can enter, principal can approve */}
      {(hasPermission("results.create") || hasPermission("results.approve")) && (
        <NavItem href="/dashboard/results">Results</NavItem>
      )}

      {/* Reports - teachers can generate, principal can approve */}
      {(hasPermission("reports.generate") || hasPermission("reports.bulk_approve")) && (
        <NavItem href="/dashboard/reports">Reports</NavItem>
      )}

      {/* Admin only - users and roles management */}
      {(hasPermission("users.assign_roles") || hasPermission("roles.create")) && (
        <>
          <NavDivider />
          <NavItem href="/dashboard/users">Users</NavItem>
          <NavItem href="/dashboard/roles">Roles</NavItem>
          <NavItem href="/dashboard/audit">Audit Logs</NavItem>
        </>
      )}

      {/* Principal only - announcements */}
      {hasPermission("announcements.create") && (
        <NavItem href="/dashboard/announcements">Announcements</NavItem>
      )}
    </nav>
  )
}
```

### Example 4: Custom Hook for Permission Checking

```typescript
// hooks/use-permissions.ts

import { useSession } from "next-auth/react"
import { useEffect, useState, useCallback } from "react"
import { hasPermission as checkPermission, hasAnyPermission, hasAllPermissions } from "@/lib/permissions"

export function usePermissions() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    async function loadPermissions() {
      if (!session?.user?.id) {
        setLoading(false)
        return
      }

      try {
        const perms = await getUserPermissions(session.user.id)
        setPermissions(perms)
      } finally {
        setLoading(false)
      }
    }

    loadPermissions()
  }, [session?.user?.id])

  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions]
  )

  const hasAny = useCallback(
    (permissionList: string[]) => permissionList.some(p => permissions.includes(p)),
    [permissions]
  )

  const hasAll = useCallback(
    (permissionList: string[]) => permissionList.every(p => permissions.includes(p)),
    [permissions]
  )

  return {
    loading,
    permissions,
    hasPermission,
    hasAny,
    hasAll,
  }
}
```

---

## File-by-File Implementation Guide

### 1. API Routes to Update

Priority order (do in this order):

```
High Priority (Core operations):
├─ app/api/students/**/*.ts
├─ app/api/staff/**/*.ts
├─ app/api/results/**/*.ts
├─ app/api/reports/**/*.ts
├─ app/api/users/**/*.ts
├─ app/api/roles/**/*.ts
└─ app/api/permissions/**/*.ts

Medium Priority (Supporting operations):
├─ app/api/classes/**/*.ts
├─ app/api/sections/**/*.ts
├─ app/api/subjects/**/*.ts
├─ app/api/enrollment/**/*.ts
├─ app/api/exams/**/*.ts
├─ app/api/fees/**/*.ts
├─ app/api/attendance/**/*.ts
└─ app/api/announcements/**/*.ts

Low Priority (Administrative):
├─ app/api/inventory/**/*.ts
├─ app/api/audit-trails/**/*.ts
├─ app/api/session-logs/**/*.ts
└─ app/api/notifications/**/*.ts
```

### 2. Dashboard Pages to Update

```
High Priority:
├─ app/dashboard/users/page.tsx
├─ app/dashboard/results/page.tsx
├─ app/dashboard/reports/page.tsx
└─ app/dashboard/students/page.tsx

Medium Priority:
├─ app/dashboard/staff/page.tsx
├─ app/dashboard/classes/page.tsx
├─ app/dashboard/sections/page.tsx
├─ app/dashboard/exams/page.tsx
└─ app/dashboard/attendance/page.tsx

Low Priority:
├─ app/dashboard/fees/page.tsx
├─ app/dashboard/inventory/page.tsx
├─ app/dashboard/announcements/page.tsx
└─ app/dashboard/audit-trails/page.tsx
```

### 3. Components to Update

```
Navigation Components:
├─ components/layout/navigation.tsx (PRIMARY)
├─ components/layout/sidebar.tsx
└─ components/layout/header.tsx

Form Components:
├─ components/**/*-form.tsx (Hide disabled actions)

Table Components:
├─ components/**/*-table.tsx (Show/hide columns based on role)

Dialog/Modal Components:
├─ components/**/actions.tsx (Hide unsupported actions)
```

---

## Database Verification Checklist

After setup, run these queries to verify:

```sql
-- 1. Check total permissions created
SELECT COUNT(*) as total_permissions FROM "Permission";
-- Expected: 100+

-- 2. Check total roles created
SELECT COUNT(*) as total_roles FROM "Role";
-- Expected: 10

-- 3. Check ADMIN has all permissions
SELECT COUNT(*) as admin_permissions FROM "RolePermission"
WHERE "roleId" = (SELECT id FROM "Role" WHERE name = 'ADMIN');
-- Expected: 100+ (same as total permissions)

-- 4. Check TEACHER has expected permissions
SELECT COUNT(*) as teacher_permissions FROM "RolePermission"
WHERE "roleId" = (SELECT id FROM "Role" WHERE name = 'TEACHER')
AND granted = true;
-- Expected: 15-20

-- 5. Check users assigned to roles
SELECT COUNT(*) as users_with_roles FROM "UserRole";
-- Expected: Should be non-zero after migration

-- 6. View user permissions
SELECT u.name, COUNT(p.id) as permission_count
FROM "User" u
LEFT JOIN "UserRole" ur ON u.id = ur."userId"
LEFT JOIN "RolePermission" rp ON ur."roleId" = rp."roleId"
LEFT JOIN "Permission" p ON rp."permissionId" = p.id
WHERE p."name" IS NOT NULL
GROUP BY u.id, u.name
ORDER BY permission_count DESC;
```

---

## Troubleshooting Guide

### Issue: "Permission Denied" on valid operation

**Cause**: API route not checking permission, or permission not assigned

**Solution**:
1. Add permission check to API route
2. Verify permission exists in database
3. Verify role has permission assigned
4. Test with `SELECT * FROM "RolePermission" WHERE roleId = '...'`

### Issue: User can't see certain menu items

**Cause**: Frontend not updated with permission checks

**Solution**:
1. Add `usePermissions()` hook to component
2. Wrap UI with `{hasPermission("...")} && <UI />`
3. Clear browser cache
4. Test in incognito window

### Issue: Permission checks not working in frontend

**Cause**: Session not loaded or permission check async

**Solution**:
1. Wrap in `{!loading && hasPermission(...) && <UI />}`
2. Use `useEffect` to load permissions
3. Check browser console for errors

### Issue: All users getting ADMIN access

**Cause**: Legacy code still checking `session.user.role === 'ADMIN'`

**Solution**:
1. Replace all role checks with permission checks
2. Use `requirePermission(request, Permissions.MODULE_ACTION)`
3. Use `hasPermission(userId, permissionName)`

---

## Testing Scenarios

### Scenario 1: Teacher Workflow

```
1. Teacher logs in
   → Should see Dashboard (personal view only)
   
2. Teacher clicks "Results"
   → Should see only their assigned sections
   → Should see "Mark Attendance" button
   → Should NOT see "Approve Results" button
   
3. Teacher enters marks
   → Should be able to create/update results
   → Should be able to submit for approval
   
4. Teacher adds comment to report
   → Should be able to add comments
   → Should see their comments
   → Should NOT see "Bulk Approve" button
```

### Scenario 2: Principal Workflow

```
1. Principal logs in
   → Should see Dashboard (school overview)
   
2. Principal clicks "Results"
   → Should see ALL students' results
   → Should see "Approve" button
   → Should see "Review" statuses
   
3. Principal clicks "Reports"
   → Should see ALL reports
   → Should see "Bulk Approve" button
   → Should be able to approve multiple
   
4. Principal clicks "Announcements"
   → Should see "Create Announcement" button
   → Should be able to create/edit
```

### Scenario 3: Student Workflow

```
1. Student logs in
   → Should see Dashboard (personal view)
   
2. Student clicks "Results"
   → Should see ONLY their own marks
   → Should NOT see other students' marks
   
3. Student clicks "Reports"
   → Should see ONLY their own report
   → Should see "Print" button
   → Should NOT see "Edit" or "Delete"
```

---

## Performance Considerations

### Optimize Permission Checks

```typescript
// ❌ DON'T - Checks permission on every render
{hasPermission("students.read") && <StudentList />}

// ✅ DO - Memoize the check
const canReadStudents = useMemo(
  () => hasPermission("students.read"),
  [permissions]
)
{canReadStudents && <StudentList />}
```

### Cache User Permissions

```typescript
// ✅ Load permissions once on mount
useEffect(() => {
  if (session?.user?.id) {
    getUserPermissions(session.user.id).then(setPermissions)
  }
}, [session?.user?.id])
```

### Batch Permission Checks

```typescript
// ❌ DON'T - Multiple separate checks
if (await hasPermission(userId, "results.create")) { ... }
if (await hasPermission(userId, "results.read")) { ... }
if (await hasPermission(userId, "results.update")) { ... }

// ✅ DO - Single batch check
const permissions = await getUserPermissions(userId)
if (permissions.includes("results.create")) { ... }
```

---

## Deployment Checklist

- [ ] Back up production database
- [ ] Test RBAC in staging environment
- [ ] Verify all users have roles assigned
- [ ] Run permission seeding scripts
- [ ] Verify API routes have permission checks
- [ ] Verify frontend shows/hides UI based on permissions
- [ ] Test with sample users from each role
- [ ] Update user documentation
- [ ] Train support team on troubleshooting
- [ ] Monitor for "unauthorized" errors in logs
- [ ] Gather feedback from users
- [ ] Make adjustments as needed

---

## Success Metrics

After implementation, you should see:

✅ Users can only access features their role permits
✅ API requests return 401 Unauthorized for insufficient permissions
✅ Frontend UI shows/hides features appropriately
✅ Audit logs track all permission-related actions
✅ Reports generated successfully with proper access control
✅ Teachers can only see their sections' data
✅ Students can only see their own data
✅ Principals can see all school data
✅ Admins can manage users and permissions
✅ No unauthorized data access incidents

---

## Summary

Total Implementation Time: **4-6 hours**
- Database Setup: 15 minutes
- Code Implementation: 2-4 hours  
- Testing: 1-2 hours

Expected Outcome:
- Secure, scalable RBAC system
- Clear role definitions
- Easy permission management
- Comprehensive audit trail
- Production-ready access control

Get started with `RBAC_SETUP_GUIDE.md` - Step 1!
