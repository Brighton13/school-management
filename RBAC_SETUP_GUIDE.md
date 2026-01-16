# RBAC Implementation - Database Setup Guide

## Overview

This guide provides the complete SQL and TypeScript scripts to set up the Role-Based Access Control (RBAC) system in your database.

---

## Step 1: Create All Permissions

Run this script to create all system permissions in the database.

### SQL Script

```sql
-- Insert all system permissions
INSERT INTO "Permission" (id, name, description, module, action) VALUES

-- Student Management (6 permissions)
('perm-001', 'students.create', 'Create new student records', 'students', 'create'),
('perm-002', 'students.read', 'View student information', 'students', 'read'),
('perm-003', 'students.update', 'Modify student details', 'students', 'update'),
('perm-004', 'students.delete', 'Remove student records', 'students', 'delete'),
('perm-005', 'students.bulk_upload', 'Bulk import students', 'students', 'bulk_upload'),
('perm-006', 'students.export', 'Export student data', 'students', 'export'),

-- Staff Management (5 permissions)
('perm-011', 'staff.create', 'Create new staff records', 'staff', 'create'),
('perm-012', 'staff.read', 'View staff information', 'staff', 'read'),
('perm-013', 'staff.update', 'Modify staff details', 'staff', 'update'),
('perm-014', 'staff.delete', 'Remove staff records', 'staff', 'delete'),
('perm-015', 'staff.bulk_upload', 'Bulk import staff', 'staff', 'bulk_upload'),

-- Classes Management (5 permissions)
('perm-021', 'classes.create', 'Create new classes', 'classes', 'create'),
('perm-022', 'classes.read', 'View class information', 'classes', 'read'),
('perm-023', 'classes.update', 'Modify class details', 'classes', 'update'),
('perm-024', 'classes.delete', 'Remove class records', 'classes', 'delete'),
('perm-025', 'classes.manage_teachers', 'Assign/manage class teachers', 'classes', 'manage_teachers'),

-- Sections Management (4 permissions)
('perm-031', 'sections.create', 'Create class sections', 'sections', 'create'),
('perm-032', 'sections.read', 'View section information', 'sections', 'read'),
('perm-033', 'sections.update', 'Modify section details', 'sections', 'update'),
('perm-034', 'sections.delete', 'Remove sections', 'sections', 'delete'),

-- Subjects Management (5 permissions)
('perm-041', 'subjects.create', 'Create new subjects', 'subjects', 'create'),
('perm-042', 'subjects.read', 'View subject information', 'subjects', 'read'),
('perm-043', 'subjects.update', 'Modify subject details', 'subjects', 'update'),
('perm-044', 'subjects.delete', 'Remove subjects', 'subjects', 'delete'),
('perm-045', 'subjects.assign_to_class', 'Assign subjects to classes', 'subjects', 'assign_to_class'),

-- Enrollment Management (6 permissions)
('perm-051', 'enrollment.create', 'Create student enrollments', 'enrollment', 'create'),
('perm-052', 'enrollment.read', 'View enrollment records', 'enrollment', 'read'),
('perm-053', 'enrollment.update', 'Modify enrollment details', 'enrollment', 'update'),
('perm-054', 'enrollment.delete', 'Remove enrollments', 'enrollment', 'delete'),
('perm-055', 'enrollment.bulk_upload', 'Bulk enroll students', 'enrollment', 'bulk_upload'),
('perm-056', 'enrollment.manage_subjects', 'Manage student subjects', 'enrollment', 'manage_subjects'),

-- Teacher Assignments (5 permissions)
('perm-061', 'teacher_assignments.create', 'Create teacher assignments', 'teacher_assignments', 'create'),
('perm-062', 'teacher_assignments.read', 'View assignments', 'teacher_assignments', 'read'),
('perm-063', 'teacher_assignments.update', 'Modify assignments', 'teacher_assignments', 'update'),
('perm-064', 'teacher_assignments.delete', 'Remove assignments', 'teacher_assignments', 'delete'),
('perm-065', 'teacher_assignments.bulk_upload', 'Bulk assign teachers', 'teacher_assignments', 'bulk_upload'),

-- Results Management (10 permissions)
('perm-101', 'results.create', 'Create result records', 'results', 'create'),
('perm-102', 'results.read', 'View results', 'results', 'read'),
('perm-103', 'results.update', 'Modify results', 'results', 'update'),
('perm-104', 'results.delete', 'Remove results', 'results', 'delete'),
('perm-105', 'results.bulk_upload', 'Bulk upload results', 'results', 'bulk_upload'),
('perm-106', 'results.submit', 'Submit results for approval', 'results', 'submit'),
('perm-107', 'results.class_teacher_review', 'Review class results', 'results', 'class_teacher_review'),
('perm-108', 'results.principal_review', 'Review and approve results', 'results', 'principal_review'),
('perm-109', 'results.approve', 'Final result approval', 'results', 'approve'),
('perm-110', 'results.reject', 'Reject results', 'results', 'reject'),
('perm-111', 'results.view_all', 'View all students results', 'results', 'view_all'),

-- Reports Management (11 permissions)
('perm-121', 'reports.generate', 'Generate student reports', 'reports', 'generate'),
('perm-122', 'reports.read', 'View generated reports', 'reports', 'read'),
('perm-123', 'reports.delete', 'Remove reports', 'reports', 'delete'),
('perm-124', 'reports.submit', 'Submit reports to principal', 'reports', 'submit'),
('perm-125', 'reports.bulk_approve', 'Approve multiple reports', 'reports', 'bulk_approve'),
('perm-126', 'reports.add_comments', 'Add teacher comments', 'reports', 'add_comments'),
('perm-127', 'reports.edit_comments', 'Modify teacher comments', 'reports', 'edit_comments'),
('perm-128', 'reports.delete_comments', 'Remove comments', 'reports', 'delete_comments'),
('perm-129', 'reports.configure_templates', 'Configure comment templates', 'reports', 'configure_templates'),
('perm-130', 'reports.view_all', 'View all reports', 'reports', 'view_all'),
('perm-131', 'reports.print', 'Print reports', 'reports', 'print'),

-- Exams Management (6 permissions)
('perm-141', 'exams.create', 'Create exam records', 'exams', 'create'),
('perm-142', 'exams.read', 'View exam information', 'exams', 'read'),
('perm-143', 'exams.update', 'Modify exam details', 'exams', 'update'),
('perm-144', 'exams.delete', 'Remove exam records', 'exams', 'delete'),
('perm-145', 'exams.schedule', 'Schedule exams', 'exams', 'schedule'),
('perm-146', 'exams.publish', 'Publish exam schedule', 'exams', 'publish'),

-- Fees Management (7 permissions)
('perm-151', 'fees.create', 'Create fee records', 'fees', 'create'),
('perm-152', 'fees.read', 'View fee information', 'fees', 'read'),
('perm-153', 'fees.update', 'Modify fee details', 'fees', 'update'),
('perm-154', 'fees.delete', 'Remove fee records', 'fees', 'delete'),
('perm-155', 'fees.track_payments', 'Track fee payments', 'fees', 'track_payments'),
('perm-156', 'fees.generate_reports', 'Generate fee reports', 'fees', 'generate_reports'),
('perm-157', 'fees.adjust', 'Adjust or waive fees', 'fees', 'adjust'),

-- Attendance Management (6 permissions)
('perm-161', 'attendance.create', 'Mark attendance', 'attendance', 'create'),
('perm-162', 'attendance.read', 'View attendance records', 'attendance', 'read'),
('perm-163', 'attendance.update', 'Modify attendance', 'attendance', 'update'),
('perm-164', 'attendance.delete', 'Remove attendance', 'attendance', 'delete'),
('perm-165', 'attendance.bulk_upload', 'Bulk upload attendance', 'attendance', 'bulk_upload'),
('perm-166', 'attendance.report', 'Generate attendance reports', 'attendance', 'report'),

-- Inventory Management (5 permissions)
('perm-171', 'inventory.create', 'Create inventory items', 'inventory', 'create'),
('perm-172', 'inventory.read', 'View inventory', 'inventory', 'read'),
('perm-173', 'inventory.update', 'Modify inventory', 'inventory', 'update'),
('perm-174', 'inventory.delete', 'Remove inventory items', 'inventory', 'delete'),
('perm-175', 'inventory.track_transactions', 'Track inventory transactions', 'inventory', 'track_transactions'),

-- Announcements Management (5 permissions)
('perm-181', 'announcements.create', 'Create announcements', 'announcements', 'create'),
('perm-182', 'announcements.read', 'View announcements', 'announcements', 'read'),
('perm-183', 'announcements.update', 'Modify announcements', 'announcements', 'update'),
('perm-184', 'announcements.delete', 'Remove announcements', 'announcements', 'delete'),
('perm-185', 'announcements.publish', 'Publish announcements', 'announcements', 'publish'),

-- Roles & Permissions Management (8 permissions)
('perm-201', 'roles.create', 'Create new roles', 'roles', 'create'),
('perm-202', 'roles.read', 'View role information', 'roles', 'read'),
('perm-203', 'roles.update', 'Modify roles', 'roles', 'update'),
('perm-204', 'roles.delete', 'Remove roles', 'roles', 'delete'),
('perm-205', 'permissions.create', 'Create permissions', 'permissions', 'create'),
('perm-206', 'permissions.read', 'View permissions', 'permissions', 'read'),
('perm-207', 'permissions.update', 'Modify permissions', 'permissions', 'update'),
('perm-208', 'permissions.delete', 'Remove permissions', 'permissions', 'delete'),

-- Users Management (7 permissions)
('perm-211', 'users.create', 'Create user accounts', 'users', 'create'),
('perm-212', 'users.read', 'View user information', 'users', 'read'),
('perm-213', 'users.update', 'Modify user details', 'users', 'update'),
('perm-214', 'users.delete', 'Remove user accounts', 'users', 'delete'),
('perm-215', 'users.assign_roles', 'Assign roles to users', 'users', 'assign_roles'),
('perm-216', 'users.reset_password', 'Reset user passwords', 'users', 'reset_password'),
('perm-217', 'users.activate_deactivate', 'Activate/deactivate users', 'users', 'activate_deactivate'),

-- Settings Management (4 permissions)
('perm-221', 'settings.read', 'View system settings', 'settings', 'read'),
('perm-222', 'settings.update', 'Modify settings', 'settings', 'update'),
('perm-223', 'settings.email_config', 'Configure email settings', 'settings', 'email_config'),
('perm-224', 'settings.manage_terms', 'Manage academic terms', 'settings', 'manage_terms'),

-- Audit & Monitoring (3 permissions)
('perm-231', 'audit.read', 'View audit logs', 'audit', 'read'),
('perm-232', 'audit.export', 'Export audit logs', 'audit', 'export'),
('perm-233', 'session_logs.read', 'View session logs', 'session_logs', 'read'),
('perm-234', 'notifications.read', 'View notifications', 'notifications', 'read'),
('perm-235', 'notifications.manage', 'Manage notifications', 'notifications', 'manage')

ON CONFLICT ("name") DO NOTHING;
```

---

## Step 2: Create All Roles

Run this script to create the standard roles.

### SQL Script

```sql
INSERT INTO "Role" (id, name, description, isSystem) VALUES
('role-admin', 'ADMIN', 'System Administrator - Full access to all features', true),
('role-principal', 'PRINCIPAL', 'School Principal - Academic oversight and approvals', true),
('role-teacher', 'TEACHER', 'Classroom Teacher - Day-to-day operations', true),
('role-class-teacher', 'CLASS_TEACHER', 'Class Teacher - Section lead with review authority', true),
('role-student', 'STUDENT', 'Student Account - Access to own academic information', true),
('role-parent', 'PARENT', 'Parent/Guardian - Monitor child progress', true),
('role-academic-coordinator', 'ACADEMIC_COORDINATOR', 'Academic Coordinator - Manage curriculum and structure', true),
('role-finance-manager', 'FINANCE_MANAGER', 'Finance Manager - Manage school finances', true),
('role-attendance-officer', 'ATTENDANCE_OFFICER', 'Attendance Officer - Track student attendance', true),
('role-inventory-manager', 'INVENTORY_MANAGER', 'Inventory Manager - Manage school assets', true)

ON CONFLICT ("name") DO NOTHING;
```

---

## Step 3: Assign Permissions to Roles

Run these scripts to assign permissions to each role.

### ADMIN Role - All Permissions

```sql
-- ADMIN gets all permissions
INSERT INTO "RolePermission" (roleId, permissionId, granted)
SELECT 'role-admin', id, true FROM "Permission"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### PRINCIPAL Role Permissions

```sql
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
-- Students
('role-principal', 'perm-002', true),  -- students.read

-- Staff
('role-principal', 'perm-012', true),  -- staff.read

-- Classes
('role-principal', 'perm-022', true),  -- classes.read
('role-principal', 'perm-025', true),  -- classes.manage_teachers

-- Sections
('role-principal', 'perm-032', true),  -- sections.read

-- Subjects
('role-principal', 'perm-042', true),  -- subjects.read

-- Enrollment
('role-principal', 'perm-052', true),  -- enrollment.read

-- Teacher Assignments
('role-principal', 'perm-062', true),  -- teacher_assignments.read

-- Results
('role-principal', 'perm-102', true),  -- results.read
('role-principal', 'perm-108', true),  -- results.principal_review
('role-principal', 'perm-109', true),  -- results.approve
('role-principal', 'perm-110', true),  -- results.reject
('role-principal', 'perm-111', true),  -- results.view_all

-- Reports
('role-principal', 'perm-122', true),  -- reports.read
('role-principal', 'perm-125', true),  -- reports.bulk_approve
('role-principal', 'perm-130', true),  -- reports.view_all
('role-principal', 'perm-131', true),  -- reports.print

-- Exams
('role-principal', 'perm-142', true),  -- exams.read
('role-principal', 'perm-145', true),  -- exams.schedule
('role-principal', 'perm-146', true),  -- exams.publish

-- Fees
('role-principal', 'perm-152', true),  -- fees.read
('role-principal', 'perm-155', true),  -- fees.track_payments
('role-principal', 'perm-156', true),  -- fees.generate_reports

-- Attendance
('role-principal', 'perm-162', true),  -- attendance.read
('role-principal', 'perm-166', true),  -- attendance.report

-- Inventory
('role-principal', 'perm-172', true),  -- inventory.read

-- Announcements
('role-principal', 'perm-181', true),  -- announcements.create
('role-principal', 'perm-182', true),  -- announcements.read
('role-principal', 'perm-183', true),  -- announcements.update
('role-principal', 'perm-184', true),  -- announcements.delete
('role-principal', 'perm-185', true),  -- announcements.publish

-- Users
('role-principal', 'perm-212', true),  -- users.read
('role-principal', 'perm-215', true),  -- users.assign_roles

-- Settings
('role-principal', 'perm-221', true),  -- settings.read

-- Audit
('role-principal', 'perm-231', true),  -- audit.read
('role-principal', 'perm-234', true),  -- notifications.read

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### TEACHER Role Permissions

```sql
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
-- Students
('role-teacher', 'perm-002', true),  -- students.read

-- Subjects
('role-teacher', 'perm-042', true),  -- subjects.read

-- Enrollment
('role-teacher', 'perm-052', true),  -- enrollment.read

-- Results
('role-teacher', 'perm-101', true),  -- results.create
('role-teacher', 'perm-102', true),  -- results.read
('role-teacher', 'perm-103', true),  -- results.update
('role-teacher', 'perm-105', true),  -- results.bulk_upload
('role-teacher', 'perm-106', true),  -- results.submit

-- Reports
('role-teacher', 'perm-121', true),  -- reports.generate
('role-teacher', 'perm-122', true),  -- reports.read
('role-teacher', 'perm-126', true),  -- reports.add_comments
('role-teacher', 'perm-127', true),  -- reports.edit_comments
('role-teacher', 'perm-128', true),  -- reports.delete_comments
('role-teacher', 'perm-129', true),  -- reports.configure_templates
('role-teacher', 'perm-131', true),  -- reports.print

-- Exams
('role-teacher', 'perm-142', true),  -- exams.read

-- Attendance
('role-teacher', 'perm-161', true),  -- attendance.create
('role-teacher', 'perm-162', true),  -- attendance.read
('role-teacher', 'perm-163', true),  -- attendance.update
('role-teacher', 'perm-165', true),  -- attendance.bulk_upload
('role-teacher', 'perm-166', true),  -- attendance.report

-- Announcements
('role-teacher', 'perm-182', true),  -- announcements.read

-- Users (self only - enforced in code)
('role-teacher', 'perm-212', true),  -- users.read

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### CLASS_TEACHER Role Permissions

```sql
-- CLASS_TEACHER gets all TEACHER permissions plus:
INSERT INTO "RolePermission" (roleId, permissionId, granted)
SELECT 'role-class-teacher', permissionId, granted FROM "RolePermission"
WHERE roleId = 'role-teacher'

UNION ALL

-- Plus additional permissions
SELECT 'role-class-teacher' as roleId, id as permissionId, true as granted
FROM "Permission" 
WHERE name IN ('results.class_teacher_review', 'results.reject')

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### ACADEMIC_COORDINATOR Role Permissions

```sql
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
-- Classes
('role-academic-coordinator', 'perm-021', true),  -- classes.create
('role-academic-coordinator', 'perm-022', true),  -- classes.read
('role-academic-coordinator', 'perm-023', true),  -- classes.update

-- Sections
('role-academic-coordinator', 'perm-031', true),  -- sections.create
('role-academic-coordinator', 'perm-032', true),  -- sections.read
('role-academic-coordinator', 'perm-033', true),  -- sections.update

-- Subjects
('role-academic-coordinator', 'perm-041', true),  -- subjects.create
('role-academic-coordinator', 'perm-042', true),  -- subjects.read
('role-academic-coordinator', 'perm-043', true),  -- subjects.update
('role-academic-coordinator', 'perm-045', true),  -- subjects.assign_to_class

-- Enrollment
('role-academic-coordinator', 'perm-051', true),  -- enrollment.create
('role-academic-coordinator', 'perm-052', true),  -- enrollment.read
('role-academic-coordinator', 'perm-053', true),  -- enrollment.update
('role-academic-coordinator', 'perm-055', true),  -- enrollment.bulk_upload
('role-academic-coordinator', 'perm-056', true),  -- enrollment.manage_subjects

-- Teacher Assignments
('role-academic-coordinator', 'perm-061', true),  -- teacher_assignments.create
('role-academic-coordinator', 'perm-062', true),  -- teacher_assignments.read
('role-academic-coordinator', 'perm-063', true),  -- teacher_assignments.update
('role-academic-coordinator', 'perm-065', true),  -- teacher_assignments.bulk_upload

-- Exams
('role-academic-coordinator', 'perm-141', true),  -- exams.create
('role-academic-coordinator', 'perm-142', true),  -- exams.read
('role-academic-coordinator', 'perm-143', true),  -- exams.update
('role-academic-coordinator', 'perm-145', true),  -- exams.schedule
('role-academic-coordinator', 'perm-146', true),  -- exams.publish

-- Results
('role-academic-coordinator', 'perm-102', true),  -- results.read

-- Students
('role-academic-coordinator', 'perm-002', true),  -- students.read

-- Staff
('role-academic-coordinator', 'perm-012', true),  -- staff.read

-- Announcements
('role-academic-coordinator', 'perm-182', true),  -- announcements.read

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### STUDENT Role Permissions

```sql
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
-- Students (self only - enforced in code)
('role-student', 'perm-002', true),  -- students.read

-- Enrollment (self only - enforced in code)
('role-student', 'perm-052', true),  -- enrollment.read

-- Results (self only - enforced in code)
('role-student', 'perm-102', true),  -- results.read

-- Reports (self only - enforced in code)
('role-student', 'perm-122', true),  -- reports.read
('role-student', 'perm-131', true),  -- reports.print

-- Announcements
('role-student', 'perm-182', true),  -- announcements.read

-- Users (self only - enforced in code)
('role-student', 'perm-212', true),  -- users.read

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### PARENT Role Permissions

```sql
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
-- Students (child's only - enforced in code)
('role-parent', 'perm-002', true),  -- students.read

-- Enrollment (child's only - enforced in code)
('role-parent', 'perm-052', true),  -- enrollment.read

-- Results (child's only - enforced in code)
('role-parent', 'perm-102', true),  -- results.read

-- Reports (child's only - enforced in code)
('role-parent', 'perm-122', true),  -- reports.read
('role-parent', 'perm-131', true),  -- reports.print

-- Attendance (child's only - enforced in code)
('role-parent', 'perm-162', true),  -- attendance.read

-- Fees
('role-parent', 'perm-152', true),  -- fees.read

-- Announcements
('role-parent', 'perm-182', true),  -- announcements.read

-- Notifications
('role-parent', 'perm-234', true),  -- notifications.read

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### FINANCE_MANAGER Role Permissions

```sql
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
-- Students
('role-finance-manager', 'perm-002', true),  -- students.read

-- Fees
('role-finance-manager', 'perm-151', true),  -- fees.create
('role-finance-manager', 'perm-152', true),  -- fees.read
('role-finance-manager', 'perm-153', true),  -- fees.update
('role-finance-manager', 'perm-154', true),  -- fees.delete
('role-finance-manager', 'perm-155', true),  -- fees.track_payments
('role-finance-manager', 'perm-156', true),  -- fees.generate_reports
('role-finance-manager', 'perm-157', true),  -- fees.adjust

-- Announcements
('role-finance-manager', 'perm-182', true),  -- announcements.read

-- Users
('role-finance-manager', 'perm-212', true),  -- users.read

-- Audit
('role-finance-manager', 'perm-231', true),  -- audit.read

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### ATTENDANCE_OFFICER Role Permissions

```sql
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
-- Students
('role-attendance-officer', 'perm-002', true),  -- students.read

-- Classes
('role-attendance-officer', 'perm-022', true),  -- classes.read

-- Sections
('role-attendance-officer', 'perm-032', true),  -- sections.read

-- Attendance
('role-attendance-officer', 'perm-161', true),  -- attendance.create
('role-attendance-officer', 'perm-162', true),  -- attendance.read
('role-attendance-officer', 'perm-163', true),  -- attendance.update
('role-attendance-officer', 'perm-164', true),  -- attendance.delete
('role-attendance-officer', 'perm-165', true),  -- attendance.bulk_upload
('role-attendance-officer', 'perm-166', true),  -- attendance.report

-- Announcements
('role-attendance-officer', 'perm-182', true),  -- announcements.read

-- Users
('role-attendance-officer', 'perm-212', true),  -- users.read

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

### INVENTORY_MANAGER Role Permissions

```sql
INSERT INTO "RolePermission" (roleId, permissionId, granted) VALUES
-- Inventory
('role-inventory-manager', 'perm-171', true),  -- inventory.create
('role-inventory-manager', 'perm-172', true),  -- inventory.read
('role-inventory-manager', 'perm-173', true),  -- inventory.update
('role-inventory-manager', 'perm-174', true),  -- inventory.delete
('role-inventory-manager', 'perm-175', true),  -- inventory.track_transactions

-- Staff
('role-inventory-manager', 'perm-012', true),  -- staff.read

-- Announcements
('role-inventory-manager', 'perm-182', true),  -- announcements.read

-- Users
('role-inventory-manager', 'perm-212', true),  -- users.read

-- Audit
('role-inventory-manager', 'perm-231', true),  -- audit.read

ON CONFLICT ("roleId", "permissionId") DO NOTHING;
```

---

## Step 4: Assign Roles to Existing Users (Optional)

Run this script to assign roles to your existing users based on their legacy `role` field.

### SQL Script

```sql
-- Assign STUDENT role to users with legacy role = 'STUDENT'
INSERT INTO "UserRole" (userId, roleId)
SELECT id, 'role-student' FROM "User" WHERE role = 'STUDENT'
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Assign TEACHER role to users with legacy role = 'TEACHER'
INSERT INTO "UserRole" (userId, roleId)
SELECT id, 'role-teacher' FROM "User" WHERE role = 'TEACHER'
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Assign PRINCIPAL role to users with legacy role = 'PRINCIPAL'
INSERT INTO "UserRole" (userId, roleId)
SELECT id, 'role-principal' FROM "User" WHERE role = 'PRINCIPAL'
ON CONFLICT ("userId", "roleId") DO NOTHING;

-- Assign ADMIN role to users with legacy role = 'ADMIN'
INSERT INTO "UserRole" (userId, roleId)
SELECT id, 'role-admin' FROM "User" WHERE role = 'ADMIN'
ON CONFLICT ("userId", "roleId") DO NOTHING;
```

---

## Step 5: TypeScript Seed Script (Alternative)

If you prefer to use TypeScript/Node.js, here's a seed script:

### File: `prisma/seed-rbac.ts`

```typescript
import { prisma } from "@/lib/prisma"

const PERMISSIONS = [
  // Students (6)
  { name: "students.create", description: "Create new student records", module: "students", action: "create" },
  { name: "students.read", description: "View student information", module: "students", action: "read" },
  { name: "students.update", description: "Modify student details", module: "students", action: "update" },
  { name: "students.delete", description: "Remove student records", module: "students", action: "delete" },
  { name: "students.bulk_upload", description: "Bulk import students", module: "students", action: "bulk_upload" },
  { name: "students.export", description: "Export student data", module: "students", action: "export" },

  // Results (11)
  { name: "results.create", description: "Create result records", module: "results", action: "create" },
  { name: "results.read", description: "View results", module: "results", action: "read" },
  { name: "results.update", description: "Modify results", module: "results", action: "update" },
  { name: "results.delete", description: "Remove results", module: "results", action: "delete" },
  { name: "results.bulk_upload", description: "Bulk upload results", module: "results", action: "bulk_upload" },
  { name: "results.submit", description: "Submit results for approval", module: "results", action: "submit" },
  { name: "results.class_teacher_review", description: "Review class results", module: "results", action: "class_teacher_review" },
  { name: "results.principal_review", description: "Review and approve results", module: "results", action: "principal_review" },
  { name: "results.approve", description: "Final result approval", module: "results", action: "approve" },
  { name: "results.reject", description: "Reject results", module: "results", action: "reject" },
  { name: "results.view_all", description: "View all students results", module: "results", action: "view_all" },

  // Add remaining permissions...
]

const ROLES = [
  {
    name: "ADMIN",
    description: "System Administrator - Full access to all features",
    isSystem: true,
  },
  {
    name: "PRINCIPAL",
    description: "School Principal - Academic oversight and approvals",
    isSystem: true,
  },
  {
    name: "TEACHER",
    description: "Classroom Teacher - Day-to-day operations",
    isSystem: true,
  },
  {
    name: "CLASS_TEACHER",
    description: "Class Teacher - Section lead with review authority",
    isSystem: true,
  },
  {
    name: "STUDENT",
    description: "Student Account - Access to own academic information",
    isSystem: true,
  },
  {
    name: "PARENT",
    description: "Parent/Guardian - Monitor child progress",
    isSystem: true,
  },
  {
    name: "ACADEMIC_COORDINATOR",
    description: "Academic Coordinator - Manage curriculum and structure",
    isSystem: true,
  },
  {
    name: "FINANCE_MANAGER",
    description: "Finance Manager - Manage school finances",
    isSystem: true,
  },
  {
    name: "ATTENDANCE_OFFICER",
    description: "Attendance Officer - Track student attendance",
    isSystem: true,
  },
  {
    name: "INVENTORY_MANAGER",
    description: "Inventory Manager - Manage school assets",
    isSystem: true,
  },
]

async function main() {
  console.log("🌱 Seeding permissions and roles...")

  // 1. Create all permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    })
  }
  console.log(`✅ Created ${PERMISSIONS.length} permissions`)

  // 2. Create all roles
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    })
  }
  console.log(`✅ Created ${ROLES.length} roles`)

  // 3. Assign permissions to roles
  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } })
  const allPermissions = await prisma.permission.findMany()

  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole!.id,
          permissionId: perm.id,
        },
      },
      update: { granted: true },
      create: {
        roleId: adminRole!.id,
        permissionId: perm.id,
        granted: true,
      },
    })
  }
  console.log(`✅ Assigned all permissions to ADMIN role`)

  console.log("✨ Seeding completed!")
}

main()
  .catch((error) => {
    console.error("Seeding error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### Run the seed script:

```bash
npx ts-node prisma/seed-rbac.ts
```

---

## Verification Queries

After running the setup, verify everything is in place:

### Check Permissions Created

```sql
SELECT COUNT(*) FROM "Permission";
-- Should return 108+ permissions
```

### Check Roles Created

```sql
SELECT name, "isSystem" FROM "Role" ORDER BY name;
```

### Check ADMIN Role Permissions

```sql
SELECT p.name, rp.granted
FROM "RolePermission" rp
JOIN "Role" r ON rp."roleId" = r.id
JOIN "Permission" p ON rp."permissionId" = p.id
WHERE r.name = 'ADMIN'
ORDER BY p.module, p.action;
```

### Check User Roles

```sql
SELECT u.name, r.name
FROM "UserRole" ur
JOIN "User" u ON ur."userId" = u.id
JOIN "Role" r ON ur."roleId" = r.id
ORDER BY u.name;
```

---

## Complete Setup Checklist

- [ ] All permissions created (108+)
- [ ] All roles created (10)
- [ ] Permissions assigned to roles
- [ ] Users assigned to roles
- [ ] Test permission checking function
- [ ] Test role inheritance
- [ ] Update API routes with permission checks
- [ ] Update frontend with permission-based UI
- [ ] Test access control in each role
- [ ] Document any custom roles or permissions
- [ ] Train users on the new system

---

## Troubleshooting

### "User doesn't have permission"

Verify:
1. User is assigned to a role
2. Role has the required permission
3. Permission is in the database
4. API route checks for correct permission name

### Permissions not updating

Clear the app cache:
```bash
npm run dev
# Clear browser cache
# Logout and login again
```

### Need to assign multiple permissions quickly

Use direct SQL:
```sql
INSERT INTO "UserPermission" (userId, permissionId, granted)
SELECT 'user-id', id, true FROM "Permission"
WHERE module = 'results';
```

---

## Next Steps

1. Run the setup scripts in order
2. Assign roles to existing users
3. Update API routes to check permissions
4. Update frontend UI based on permissions
5. Test thoroughly with different user roles
6. Document any custom permissions added
7. Train users on the system

Your RBAC system is now ready for production use!
