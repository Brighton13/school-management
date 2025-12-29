# Permissions and Role-Based Access Control (RBAC)

## Overview

This document outlines the complete permission system for the school management application, along with recommended role mappings. The system uses a flexible, module-based permission model where:

- **Permissions** are **predefined and fixed** (108+ permissions)
- **Roles** are collections of permissions selected from the fixed set
- **Users** get permissions through role assignments

⚠️ **IMPORTANT**: Permissions CANNOT be created by users. Users must select from the predefined list of 108+ permissions when creating or modifying roles.

## Permission Structure

All permissions are **predefined** and follow the format: `module.action`

✅ **What users can do**: Select from existing permissions, assign permissions to roles
❌ **What users cannot do**: Create new permissions, delete permissions, modify permission definitions

### Module Categories

1. **Students** - Student management operations
2. **Staff** - Staff/Teacher management
3. **Classes & Sections** - Class and section management
4. **Subjects** - Subject and curriculum management
5. **Enrollment** - Student enrollment management
6. **Results** - Academic result management
7. **Exams** - Examination management
8. **Reports** - Student report card system
9. **Fees** - Fee and payment management
10. **Attendance** - Attendance tracking
11. **Inventory** - School inventory management
12. **Announcements** - School announcements
13. **Permissions & Roles** - RBAC management
14. **Users** - User account management
15. **Settings** - System configuration
16. **Audit & Logs** - Activity logging and monitoring

---

## Complete Permission List

### 1. Student Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `students.create` | Create new student records | Add new students to system |
| `students.read` | View student information | Access student profiles |
| `students.update` | Modify student details | Update student information |
| `students.delete` | Remove student records | Permanently delete student data |
| `students.bulk_upload` | Bulk import students | Upload multiple students via CSV |
| `students.export` | Export student data | Export student lists |

### 2. Staff Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `staff.create` | Create new staff records | Hire new teachers/staff |
| `staff.read` | View staff information | Access staff profiles |
| `staff.update` | Modify staff details | Update staff information |
| `staff.delete` | Remove staff records | Permanently delete staff data |
| `staff.bulk_upload` | Bulk import staff | Upload multiple staff via CSV |

### 3. Class Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `classes.create` | Create new classes | Add new class levels |
| `classes.read` | View class information | Access class details |
| `classes.update` | Modify class details | Update class information |
| `classes.delete` | Remove class records | Delete class structures |
| `classes.manage_teachers` | Assign/manage class teachers | Set who teaches each class |

### 4. Section Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `sections.create` | Create class sections | Create divisions (A, B, C) |
| `sections.read` | View section information | Access section details |
| `sections.update` | Modify section details | Update section info |
| `sections.delete` | Remove sections | Delete section divisions |

### 5. Subject Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `subjects.create` | Create new subjects | Add curriculum subjects |
| `subjects.read` | View subject information | Access subject details |
| `subjects.update` | Modify subject details | Update subject info |
| `subjects.delete` | Remove subjects | Delete subject records |
| `subjects.assign_to_class` | Assign subjects to classes | Link subjects with classes |

### 6. Enrollment Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `enrollment.create` | Create student enrollments | Enroll students in classes |
| `enrollment.read` | View enrollment records | See who is enrolled |
| `enrollment.update` | Modify enrollment details | Change enrollment status |
| `enrollment.delete` | Remove enrollments | Delete enrollment records |
| `enrollment.bulk_upload` | Bulk enroll students | Upload multiple enrollments |
| `enrollment.manage_subjects` | Manage student subjects | Control subject selections |

### 7. Teacher Assignment Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `teacher_assignments.create` | Create teacher assignments | Assign teachers to classes/subjects |
| `teacher_assignments.read` | View assignments | See teacher-subject-class links |
| `teacher_assignments.update` | Modify assignments | Update teacher assignments |
| `teacher_assignments.delete` | Remove assignments | Unassign teachers |
| `teacher_assignments.bulk_upload` | Bulk assign teachers | Upload multiple assignments |

### 8. Academic Results Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `results.create` | Create result records | Enter student marks |
| `results.read` | View results | See student marks |
| `results.update` | Modify results | Change entered marks |
| `results.delete` | Remove results | Delete mark entries |
| `results.bulk_upload` | Bulk upload results | Import marks via CSV |
| `results.submit` | Submit results for approval | Submit marks to principal |
| `results.class_teacher_review` | Review class results | Class teacher can review marks |
| `results.principal_review` | Review and approve results | Principal final approval |
| `results.approve` | Final result approval | Approve marks permanently |
| `results.reject` | Reject results | Send back for correction |
| `results.view_all` | View all students' results | See comprehensive result view |

### 9. Report Card System

| Permission | Description | Impact |
|-----------|-------------|--------|
| `reports.generate` | Generate student reports | Create report cards from results |
| `reports.read` | View generated reports | Access report cards |
| `reports.delete` | Remove reports | Delete generated reports |
| `reports.submit` | Submit reports to principal | Submit for approval |
| `reports.bulk_approve` | Approve multiple reports | Principal bulk approval |
| `reports.add_comments` | Add teacher comments | Provide feedback on reports |
| `reports.edit_comments` | Modify teacher comments | Edit existing feedback |
| `reports.delete_comments` | Remove comments | Delete feedback |
| `reports.configure_templates` | Configure comment templates | Create reusable comment templates |
| `reports.view_all` | View all reports | See all student reports |
| `reports.print` | Print reports | Generate PDF/print reports |

### 10. Examination Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `exams.create` | Create exam records | Set up new exams |
| `exams.read` | View exam information | See exam details |
| `exams.update` | Modify exam details | Update exam information |
| `exams.delete` | Remove exam records | Delete exams |
| `exams.schedule` | Schedule exams | Set exam dates/times |
| `exams.publish` | Publish exam schedule | Make visible to students |

### 11. Fee Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `fees.create` | Create fee records | Define school fees |
| `fees.read` | View fee information | See fee details |
| `fees.update` | Modify fee details | Update fee amounts |
| `fees.delete` | Remove fee records | Delete fee entries |
| `fees.track_payments` | Track fee payments | Monitor payment status |
| `fees.generate_reports` | Generate fee reports | Create payment summaries |
| `fees.adjust` | Adjust or waive fees | Change fee amounts for students |

### 12. Attendance Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `attendance.create` | Mark attendance | Record student presence |
| `attendance.read` | View attendance records | See attendance history |
| `attendance.update` | Modify attendance | Change attendance records |
| `attendance.delete` | Remove attendance | Delete attendance entries |
| `attendance.bulk_upload` | Bulk upload attendance | Import attendance data |
| `attendance.report` | Generate attendance reports | Create attendance summaries |

### 13. Inventory Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `inventory.create` | Create inventory items | Add items to inventory |
| `inventory.read` | View inventory | See inventory details |
| `inventory.update` | Modify inventory | Update item information |
| `inventory.delete` | Remove inventory items | Delete inventory records |
| `inventory.track_transactions` | Track inventory transactions | Monitor usage |

### 14. Announcement Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `announcements.create` | Create announcements | Post school announcements |
| `announcements.read` | View announcements | See posted announcements |
| `announcements.update` | Modify announcements | Edit announcements |
| `announcements.delete` | Remove announcements | Delete announcements |
| `announcements.publish` | Publish announcements | Make announcements visible |

### 15. System Administration

| Permission | Description | Impact |
|-----------|-------------|--------|
| `roles.create` | Create new roles | Define custom roles |
| `roles.read` | View role information | See role definitions |
| `roles.update` | Modify roles | Change role definitions |
| `roles.delete` | Remove roles | Delete custom roles |
| `permissions.create` | Create permissions | Define new permissions |
| `permissions.read` | View permissions | See all permissions |
| `permissions.update` | Modify permissions | Change permission definitions |
| `permissions.delete` | Remove permissions | Delete permissions |

### 16. User Management

| Permission | Description | Impact |
|-----------|-------------|--------|
| `users.create` | Create user accounts | Add new users |
| `users.read` | View user information | See user profiles |
| `users.update` | Modify user details | Update user information |
| `users.delete` | Remove user accounts | Delete users |
| `users.assign_roles` | Assign roles to users | Grant role membership |
| `users.reset_password` | Reset user passwords | Change user passwords |
| `users.activate_deactivate` | Activate/deactivate users | Control user access |

### 17. System Settings

| Permission | Description | Impact |
|-----------|-------------|--------|
| `settings.read` | View system settings | Access configuration |
| `settings.update` | Modify settings | Change configuration |
| `settings.email_config` | Configure email settings | Set up email system |
| `settings.manage_terms` | Manage academic terms | Create/modify terms |

### 18. Audit & Monitoring

| Permission | Description | Impact |
|-----------|-------------|--------|
| `audit.read` | View audit logs | See activity history |
| `audit.export` | Export audit logs | Download activity logs |
| `session_logs.read` | View session logs | Monitor login/logout |
| `notifications.read` | View notifications | See system notifications |
| `notifications.manage` | Manage notifications | Control notification settings |

---

## Standard Roles and Permissions Mapping

### Role 1: ADMIN (System Administrator)

**Description**: Full system access. Manages all aspects of the application.

**Permissions Granted**:
```
✓ students.*              (all student permissions)
✓ staff.*                 (all staff permissions)
✓ classes.*               (all class permissions)
✓ sections.*              (all section permissions)
✓ subjects.*              (all subject permissions)
✓ enrollment.*            (all enrollment permissions)
✓ teacher_assignments.*   (all assignment permissions)
✓ results.*               (all result permissions)
✓ reports.*               (all report permissions)
✓ exams.*                 (all exam permissions)
✓ fees.*                  (all fee permissions)
✓ attendance.*            (all attendance permissions)
✓ inventory.*             (all inventory permissions)
✓ announcements.*         (all announcement permissions)
✓ roles.*                 (all role permissions)
✓ permissions.*           (all permission permissions)
✓ users.*                 (all user permissions)
✓ settings.*              (all setting permissions)
✓ audit.*                 (all audit permissions)
✓ session_logs.read       (view session logs)
```

**Dashboard Access**: All modules
**Special Capabilities**: System-wide management, user management, role definition

---

### Role 2: PRINCIPAL (School Principal/Administration)

**Description**: Educational leadership and approval authority. Oversees academic matters and approves critical operations.

**Permissions Granted**:

**Academic Operations**:
- `students.read` - View all students
- `staff.read` - View all staff
- `classes.read`, `classes.manage_teachers` - View and manage class teachers
- `sections.read` - View all sections
- `subjects.read` - View all subjects
- `enrollment.read` - View all enrollments
- `teacher_assignments.read` - View teacher assignments
- `exams.read`, `exams.schedule`, `exams.publish` - Manage exams

**Result & Report Operations**:
- `results.read`, `results.view_all` - View all results
- `results.principal_review`, `results.approve`, `results.reject` - Approve/reject results
- `reports.read`, `reports.view_all` - View all reports
- `reports.bulk_approve` - Bulk approve reports
- `reports.print` - Print reports

**Administrative**:
- `announcements.create`, `announcements.read`, `announcements.update`, `announcements.delete` - Manage announcements
- `fees.read`, `fees.track_payments`, `fees.generate_reports` - Fee oversight
- `attendance.read`, `attendance.report` - View attendance
- `inventory.read` - View inventory
- `users.read`, `users.assign_roles` - User management oversight
- `audit.read` - View audit logs
- `notifications.read` - View notifications
- `settings.read` - View settings

**Bulk Operations** (with restrictions):
- `students.bulk_upload` - Enroll students
- `enrollment.bulk_upload` - Bulk enrollment

**Dashboard Pages**: 
- Dashboard (Overview)
- Results (view all, approve)
- Reports (view all, bulk approve)
- Students (view only)
- Staff (view only)
- Announcements (create, edit)
- Audit Logs
- Fees (reporting)

---

### Role 3: TEACHER (Classroom Teacher)

**Description**: Teaches classes, enters marks, provides feedback. Primary day-to-day user.

**Permissions Granted**:

**Their Own Data**:
- `students.read` - View students in their sections only
- `subjects.read` - View subjects they teach
- `enrollment.read` - View enrollments in their sections

**Academic Operations** (Section-specific):
- `results.create`, `results.read`, `results.update` - Enter and manage their marks
- `results.submit` - Submit results for approval
- `results.class_teacher_review` - Review class results (class teachers only)
- `results.bulk_upload` - Upload marks via CSV
- `exams.read` - View exam information
- `attendance.create`, `attendance.read`, `attendance.update` - Manage attendance
- `attendance.bulk_upload` - Bulk upload attendance
- `attendance.report` - Generate attendance reports

**Report Operations** (For their sections):
- `reports.generate` - Generate reports for their students
- `reports.read` - View reports for their sections
- `reports.add_comments` - Add comments to reports
- `reports.edit_comments` - Edit their own comments
- `reports.delete_comments` - Delete their own comments
- `reports.configure_templates` - Configure their comment templates
- `reports.print` - Print reports

**Communications**:
- `announcements.read` - View announcements

**Profile**:
- `users.read` (self only) - View their own profile

**Dashboard Pages**:
- Dashboard (Their overview)
- Results (enter marks, submit)
- Reports (generate, add comments)
- Attendance (mark, view)
- Classes (view assigned)
- Students (view section students only)
- Announcements (view only)
- Settings (view personal settings)

---

### Role 4: CLASS_TEACHER (Lead Teacher for a Section)

**Description**: Senior teacher overseeing a specific class section. Reviews results before principal approval.

**Permissions** (Same as TEACHER, plus):
- `results.class_teacher_review` - Review all results in their section
- `results.reject` - Send back results for correction
- `enrollment.read` - Manage their section's enrollment

**Additional Dashboard Pages**:
- Results (class review view with approve/reject buttons)

---

### Role 5: ACADEMIC_COORDINATOR

**Description**: Manages academic structure, curriculum, and exam scheduling.

**Permissions Granted**:
- `classes.create`, `classes.read`, `classes.update` - Manage classes
- `sections.create`, `sections.read`, `sections.update` - Manage sections
- `subjects.create`, `subjects.read`, `subjects.update`, `subjects.assign_to_class` - Manage curriculum
- `enrollment.create`, `enrollment.read`, `enrollment.update`, `enrollment.bulk_upload` - Manage enrollments
- `enrollment.manage_subjects` - Manage subject selections
- `teacher_assignments.create`, `teacher_assignments.read`, `teacher_assignments.update`, `teacher_assignments.bulk_upload` - Assign teachers
- `exams.create`, `exams.read`, `exams.update`, `exams.schedule`, `exams.publish` - Manage exams
- `results.read` - View results
- `announcements.read` - View announcements

**Dashboard Pages**:
- Classes
- Sections
- Subjects
- Enrollments
- Teacher Assignments
- Exams
- Results (view only)

---

### Role 6: STUDENT

**Description**: Student account. View own academic information.

**Permissions Granted**:
- `students.read` (self only) - View own profile
- `enrollment.read` (own only) - View own enrollment
- `results.read` (own only) - View own marks
- `reports.read` (own only) - View own report card
- `reports.print` (own only) - Print own report
- `announcements.read` - View announcements
- `users.read` (self only) - View own profile

**Dashboard Pages**:
- Dashboard (Student view)
- Results (their own only)
- Reports (their own only)
- Announcements (view only)
- Settings (personal settings only)

---

### Role 7: PARENT

**Description**: Parent/Guardian access. View student progress.

**Permissions Granted**:
- `students.read` (linked children only) - View child's profile
- `enrollment.read` (child's only) - View child's enrollment
- `results.read` (child's only) - View child's marks
- `reports.read` (child's only) - View child's report card
- `reports.print` (child's only) - Print child's report
- `announcements.read` - View announcements
- `fees.read` - View fee status
- `attendance.read` (child's only) - View child's attendance
- `notifications.read` - View notifications

**Dashboard Pages**:
- Dashboard (Parent view with child summary)
- Students (child information only)
- Results (child's results only)
- Reports (child's reports only)
- Attendance (child's attendance only)
- Fees (payment tracking)
- Announcements (view only)

---

### Role 8: FINANCE_MANAGER

**Description**: Manages financial operations and fee tracking.

**Permissions Granted**:
- `students.read` - View student information
- `fees.create`, `fees.read`, `fees.update`, `fees.delete` - Manage fees
- `fees.track_payments` - Track payments
- `fees.generate_reports` - Generate financial reports
- `fees.adjust` - Adjust or waive fees
- `announcements.read` - View announcements
- `users.read` - View users
- `audit.read` - View audit logs

**Dashboard Pages**:
- Dashboard (Finance overview)
- Students (view only)
- Fees (management)
- Reports (fee reports)

---

### Role 9: ATTENDANCE_OFFICER

**Description**: Manages school-wide attendance tracking.

**Permissions Granted**:
- `students.read` - View students
- `classes.read` - View classes
- `sections.read` - View sections
- `attendance.create`, `attendance.read`, `attendance.update` - Record attendance
- `attendance.bulk_upload` - Bulk upload attendance
- `attendance.delete` - Remove attendance records
- `attendance.report` - Generate attendance reports
- `announcements.read` - View announcements
- `users.read` - View users

**Dashboard Pages**:
- Dashboard (Attendance overview)
- Attendance (mark and manage)
- Classes (view)
- Students (view)

---

### Role 10: INVENTORY_MANAGER

**Description**: Manages school inventory and assets.

**Permissions Granted**:
- `inventory.create`, `inventory.read`, `inventory.update`, `inventory.delete` - Manage inventory
- `inventory.track_transactions` - Track usage
- `staff.read` - View staff
- `announcements.read` - View announcements
- `users.read` - View users
- `audit.read` - View audit logs

**Dashboard Pages**:
- Dashboard (Inventory overview)
- Inventory (management)

---

## Permission Implementation Guidelines

### ✅ Implementation Complete

The system has been fully implemented with:

✅ **Permissions Page** (`/dashboard/permissions`):
- Read-only reference of all 108+ predefined permissions
- Grouped by module for easy browsing
- No create, edit, or delete buttons
- Display only mode

✅ **Roles Page** (`/dashboard/roles`):
- Create new roles with permission selection
- Permission selection via checkboxes (grouped by module)
- Edit existing roles to modify permission assignments
- Delete custom roles (system roles protected)

✅ **API Implementation**:
- `GET /api/permissions` - List all predefined permissions (read-only)
- `POST /api/roles` - Create role with selected permissions
- `PATCH /api/roles/[id]` - Update role and reassign permissions
- `DELETE /api/roles/[id]` - Delete custom roles

⚠️ **Removed**:
- Permission creation page
- `POST /api/permissions` endpoint (disabled)
- Edit/delete buttons for permissions
- Permission creation form

### 1. Permissions Are Predefined (Fixed Set)

All 108+ permissions are **predefined during system initialization** and cannot be created by users:

```typescript
// ✅ CORRECT: Permissions are predefined
const existingPermissions = await prisma.permission.findMany()
// Returns all 108+ predefined permissions

// ❌ NOT ALLOWED: Users cannot create permissions
const newPermission = await prisma.permission.create({...})
// POST endpoint removed
```

### 2. Role Creation Workflow

Users can **only select from existing predefined permissions** when creating roles:

**Step 1: Navigate to Roles Page**
- Visit `/dashboard/roles`
- Click "Create Role" button

**Step 2: Fill in Role Details**
- Enter role name (e.g., "Content Manager")
- Enter role description
- Select permissions from the predefined list

**Step 3: Assign Permissions**
- Permissions displayed grouped by module
- Use checkboxes to select which permissions to assign
- Only existing permissions can be selected
- No option to create new permissions

**Step 4: Save Role**
- Click "Create Role" to save
- Role is created with selected permissions

```typescript
// Step 1: Get all available permissions
const availablePermissions = await prisma.permission.findMany({
  orderBy: [{ module: "asc" }, { action: "asc" }]
})

// Step 2: Create role with selected permissions
const role = await prisma.role.create({
  data: {
    name: "Content Manager",
    description: "Manages course content"
  }
})

// Step 3: Assign EXISTING permissions to role
for (const permissionId of selectedPermissionIds) {
  const permission = await prisma.permission.findUnique({
    where: { id: permissionId }
  })
  
  if (!permission) {
    throw new Error("Permission does not exist")
  }
  
  await prisma.rolePermission.create({
    data: {
      roleId: role.id,
      permissionId: permission.id
    }
  })
}
```

### 3. Permission Selection UI (Role Management)

The role creation and editing dialogs show permission selection checkboxes:

```typescript
// Display available permissions grouped by module
<div className="space-y-4">
  {Object.entries(groupedPermissions).map(([module, perms]) => (
    <div key={module}>
      <h4 className="font-semibold mb-2">{module}</h4>
      <div className="grid grid-cols-2 gap-2">
        {perms.map((perm) => (
          <label key={perm.id} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedPermissions.includes(perm.id)}
              onChange={() => togglePermission(perm.id)}
            />
            <span className="text-sm">
              {perm.action}
              {perm.description && ` - ${perm.description}`}
            </span>
          </label>
        ))}
      </div>
    </div>
  ))}
</div>
```

### 4. Permissions Reference Page

The permissions page is now **read-only and for reference only**:

```typescript
// Permissions page displays all available permissions
// - Shows permissions grouped by module
// - Displays permission names, actions, and descriptions
// - No create/edit/delete UI
// - Useful for understanding what permissions are available
// - Users refer to this when creating roles
```

### 5. Permission Validation

Always validate that assigned permissions exist in the predefined set:

```typescript
// Validate permission exists before assigning to role
const permission = await prisma.permission.findUnique({
  where: { id: permissionId }
})

if (!permission) {
  throw new Error("Permission does not exist")
}

// Only allow assigning existing permissions
const rolePermission = await prisma.rolePermission.create({
  data: {
    roleId,
    permissionId, // Must exist
  }
})
```

### 6. User Workflow Summary

**To manage access control**:

1. **Check Available Permissions**: Visit `/dashboard/permissions` to see all available permissions
2. **Create a Role**: Go to `/dashboard/roles` and click "Create Role"
3. **Assign Permissions**: Select permissions from the predefined list using checkboxes
4. **Save Role**: Click "Create Role" to save
5. **Assign Role to Users**: In user management, assign this role to users
6. **Edit Role**: Use the edit button in roles list to modify permission assignments
7. **Delete Role**: Use the delete button to remove custom roles (system roles cannot be deleted)

**Cannot do**:
- Create new permissions
- Edit permission definitions
- Delete permissions
- Change permission names or descriptions

### 7. Frontend Implementation

Display permissions as **selectable options** only, not creatable items:

```typescript
// ✅ Correct: Show predefined permissions as checkboxes in role management
<div className="space-y-2">
  {permissions.map(perm => (
    <label key={perm.id}>
      <input 
        type="checkbox"

        checked={selectedPermissions.includes(perm.id)}
        onChange={(e) => handleSelect(perm.id, e.checked)}
      />
      {perm.name} - {perm.description}
    </label>
  ))}
</div>

// ❌ Incorrect: Show text input to create permissions
<input type="text" placeholder="Create new permission..." />
```

---

## Backend Implementation

All API routes should check permissions using the `requirePermission` middleware:

```typescript
import { requirePermission, Permissions } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  const session = await requirePermission(request, Permissions.RESULTS_CREATE)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // ... implementation
}
```

### 2. Frontend Implementation

Show/hide UI components based on permissions:

```typescript
import { useSession } from "next-auth/react"
import { hasPermission } from "@/lib/permissions"

export function ResultsForm() {
  const { data: session } = useSession()
  const [canCreate, setCanCreate] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      hasPermission(session.user.id, "results.create").then(setCanCreate)
    }
  }, [session])

  if (!canCreate) return <div>You don't have permission</div>
  return <form>{/* form */}</form>
}
```

### 3. Data Filtering

Filter returned data based on user's role and permissions:

```typescript
// For teachers - only their sections
if (userRole === "TEACHER") {
  const teacher = await prisma.staff.findUnique({
    where: { userId: session.user.id }
  })
  results = await prisma.result.findMany({
    where: {
      classSubject: {
        section: {
          classTeacher: { id: teacher.id }
        }
      }
    }
  })
}

// For admin - all data
if (userRole === "ADMIN") {
  results = await prisma.result.findMany()
}
```

---

## Permission Assignment Workflow

### For Users Without Roles (Legacy)

Use direct permission assignment via database:

```typescript
// Grant a specific permission to a user
await prisma.userPermission.create({
  data: {
    userId: "user-id",
    permissionId: "permission-id",
    granted: true,
  },
})
```

### For Users With Roles (Recommended)

Assign roles to users, permissions are inherited:

```typescript
// Assign role to user
await prisma.userRole.create({
  data: {
    userId: "user-id",
    roleId: "teacher-role-id",
  },
})

// All permissions of that role are automatically inherited
```

---

## Permission Hierarchy

```
System Admin (ADMIN)
    ↓
Principal (PRINCIPAL)
    ↓
Academic Coordinator (ACADEMIC_COORDINATOR) | Class Teacher (CLASS_TEACHER)
    ↓
Teacher (TEACHER) | Finance Manager (FINANCE_MANAGER) | etc.
    ↓
Student (STUDENT) | Parent (PARENT)
```

---

## Security Best Practices

### 1. Principle of Least Privilege
Grant users only the minimum permissions needed for their role.

### 2. Regular Audits
Use `audit.read` permission to monitor who accesses what.

### 3. Session Management
Monitor `session_logs` for suspicious login patterns.

### 4. Role Segregation
Separate duties where possible:
- Different people for data entry (TEACHER) and approval (CLASS_TEACHER, PRINCIPAL)
- Finance from academic operations

### 5. Permission Inheritance
Users with roles get all role permissions. Don't mix:
- Direct permissions (for users without roles)
- Role-based permissions (for users with roles)

---

## Database Schema

### Permission Setup Query

```sql
-- Create PREDEFINED permissions (during system initialization)
-- These are the ONLY permissions available
INSERT INTO "Permission" (id, name, description, module, action)
VALUES (
  'perm-001',
  'students.create',
  'Create new student records',
  'students',
  'create'
);

-- Assign EXISTING permission to role
INSERT INTO "RolePermission" (roleId, permissionId, granted)
VALUES ('role-teacher-001', 'perm-students-create', true);

-- Assign role to user
INSERT INTO "UserRole" (userId, roleId)
VALUES ('user-001', 'role-teacher-001');
```

⚠️ **IMPORTANT**: Users cannot execute permission creation in production. Only system admins during initialization create the predefined 108+ permissions.

---

## Migration Plan for Existing System

If migrating from the legacy `User.role` field to the new RBAC system:

1. **Create Standard Roles**
   - Map existing roles to new Role records
   - STUDENT → STUDENT role
   - TEACHER → TEACHER role
   - PRINCIPAL → PRINCIPAL role
   - ADMIN → ADMIN role

2. **Create All Permissions**
   - Create Permission records for all operations

3. **Assign Permissions to Roles**
   - Based on permission mapping above

4. **Assign Roles to Users**
   - Create UserRole records based on legacy User.role

5. **Enable New System**
   - Update permission checks to use new system
   - Keep legacy `User.role` for backward compatibility temporarily

6. **Decommission Legacy System**
   - Remove User.role usage once fully migrated

---

## Monitoring and Auditing

### View User Permissions

```typescript
const userPermissions = await getUserPermissions(userId)
console.log("User can:", userPermissions)
```

### Audit Permission Changes

```typescript
await logAuditTrail(userId, "UPDATE", "UserRole", request, {
  entityId: userRoleId,
  description: `Assigned TEACHER role to user`,
})
```

### Permission Change History

Query AuditTrail table filtered by entity type "UserRole" or "RolePermission"

---

## API Endpoints for RBAC Management

### User Management
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user details
- `PUT /api/users/[id]` - Update user

### User Roles
- `GET /api/users/[id]/roles` - Get user's roles
- `POST /api/users/[id]/roles` - Assign role to user
- `DELETE /api/users/[id]/roles/[roleId]` - Remove role from user

### Roles
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create new role and assign permissions
- `GET /api/roles/[id]` - Get role details
- `PATCH /api/roles/[id]` - Update role and permissions
- `DELETE /api/roles/[id]` - Delete custom role

### Role Permissions
- `GET /api/roles/[id]/permissions` - Get permissions for role
- `POST /api/roles/[id]/permissions` - Assign permission to role (validation ensures permission exists)
- `DELETE /api/roles/[id]/permissions/[permissionId]` - Remove permission from role

### Permissions (Read-Only)
- `GET /api/permissions` - List all predefined permissions (grouped by module)
- `GET /api/permissions?module=students` - List permissions for specific module
- ⚠️ `POST /api/permissions` - **DISABLED** (permissions cannot be created by users)
- ⚠️ `PUT /api/permissions/[id]` - **NOT AVAILABLE** (permissions cannot be modified)
- ⚠️ `DELETE /api/permissions/[id]` - **NOT AVAILABLE** (permissions cannot be deleted)

#### Permission Endpoint Details
```typescript
// GET /api/permissions - Returns all predefined permissions
GET /api/permissions
Response: [
  {
    id: "perm-001",
    name: "students.create",
    description: "Create new student records",
    module: "students",
    action: "create"
  },
  // ... 107 more permissions
]

// Permission creation is disabled
POST /api/permissions → 405 Method Not Allowed
// Permissions are system-managed only
```

---

## Dashboard Pages

### Permissions Reference Page
- **Location**: `/dashboard/permissions`
- **Purpose**: Display all available predefined permissions
- **Features**:
  - Grouped by module for easy browsing
  - Shows permission names, actions, and descriptions
  - Read-only reference - no create/edit/delete UI
  - Helps users understand what permissions are available

### Roles Management Page
- **Location**: `/dashboard/roles`
- **Purpose**: Create, edit, and delete roles with permission assignments
- **Features**:
  - **Create Role**: Click "Create Role" → Enter name/description → Select permissions from checklist → Save
  - **Edit Role**: Click edit button → Modify name/description → Update permission assignments → Save
  - **Delete Role**: Remove custom roles (system roles protected from deletion)
  - **View Roles**: See all roles with user count and permission count

---

## Conclusion

This RBAC system provides:
- ✅ Granular permission control
- ✅ Flexible role assignment
- ✅ Audit trail integration
- ✅ Clear role definitions
- ✅ **Selection-only permission management** (no creation)
- ✅ Scalable to custom roles
- ✅ System-managed, predefined permissions

Implement this system to ensure secure, organized access control across your school management application.
