# Role-Based Access Control (RBAC) Migration Guide

This guide explains how to migrate to the new flexible RBAC system where users can create roles and assign permissions dynamically.

## Overview

The new RBAC system allows:
- **Dynamic Role Creation**: Users can create custom roles (not just predefined ones)
- **Permission-Based Access**: Access control is based on permissions, not hardcoded roles
- **Flexible Assignment**: Users can have multiple roles, and roles can have multiple permissions
- **Direct Permissions**: Users can also be assigned permissions directly (in addition to role-based permissions)

## Database Migration

1. **Run Prisma Migration**:
   ```bash
   npx prisma migrate dev --name add_rbac_models
   ```

2. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

3. **Seed Default Roles and Permissions**:
   ```bash
   npm run db:seed:rbac
   ```

   This will create all default permissions and system roles (ADMIN, PRINCIPAL, TEACHER, etc.) with appropriate permissions assigned.

## New Database Models

### Role
- `id`: Unique identifier
- `name`: Role name (e.g., "ADMIN", "TEACHER", "Custom Role")
- `description`: Optional description
- `isSystem`: Boolean flag for system roles (cannot be deleted)

### RolePermission
- Links roles to permissions
- `roleId`: Reference to Role
- `permissionId`: Reference to Permission
- `granted`: Boolean (can be used to deny specific permissions)

### UserRole
- Links users to roles
- `userId`: Reference to User
- `roleId`: Reference to Role

## Using the New System

### Creating Roles

1. Navigate to `/dashboard/roles`
2. Click "Create Role"
3. Enter role name and description
4. Select permissions to assign
5. Save

### Assigning Roles to Users

1. Navigate to `/dashboard/users`
2. Edit a user
3. Assign roles from the available list

### Creating Permissions

1. Navigate to `/dashboard/permissions`
2. Click "Create Permission"
3. Enter permission name (e.g., "students.create")
4. Select module and action
5. Save

### Using Permissions in API Routes

Replace role checks with permission checks:

**Before:**
```typescript
const session = await getServerSession(authOptions)
if (!session || session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

**After:**
```typescript
import { requirePermission, Permissions } from "@/lib/permissions"

const session = await requirePermission(request, Permissions.STUDENTS_CREATE)
if (!session) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

### Checking Permissions in Code

```typescript
import { hasPermission, getUserPermissions } from "@/lib/permissions"

// Check if user has a specific permission
const canCreate = await hasPermission(userId, "students.create")

// Get all user permissions
const permissions = await getUserPermissions(userId)
```

## Default Roles and Permissions

The seed script creates the following system roles:

- **ADMIN**: Full access to all permissions
- **PRINCIPAL**: Administrative access (except role/permission management)
- **TEACHER**: Access to results, students (read), classes, subjects, exams, announcements
- **ACCOUNTANT**: Access to fees and students (read)
- **LIBRARIAN**: Access to inventory
- **STUDENT**: Read-only access to results, fees, announcements, exams
- **PARENT**: Read-only access to results, fees, announcements

## Migration from Old System

The old `User.role` field is kept for backward compatibility but is no longer used for authorization. The system now:

1. Loads permissions from assigned roles
2. Loads direct user permissions
3. Combines both for authorization checks

To migrate existing users:

1. Create roles matching the old role names (ADMIN, PRINCIPAL, etc.)
2. Assign these roles to users based on their `User.role` field
3. The seed script creates these roles automatically

## API Endpoints

### Roles
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create a role
- `GET /api/roles/[id]` - Get role details
- `PATCH /api/roles/[id]` - Update a role
- `DELETE /api/roles/[id]` - Delete a role (non-system only)

### Permissions
- `GET /api/permissions` - List all permissions
- `POST /api/permissions` - Create a permission
- `PATCH /api/permissions/[id]` - Update a permission
- `DELETE /api/permissions/[id]` - Delete a permission

### User Roles
- `GET /api/users/[id]/roles` - Get user's roles
- `POST /api/users/[id]/roles` - Assign role to user
- `DELETE /api/users/[id]/roles?roleId=...` - Remove role from user

## Best Practices

1. **Use Permission Checks**: Always check permissions, not roles, in your code
2. **Create Granular Permissions**: Create specific permissions for each action
3. **Use Role Templates**: Create roles with common permission sets
4. **Audit Changes**: All role and permission changes are logged in audit trails
5. **Test Thoroughly**: Test permission checks after creating new roles

## Troubleshooting

### Users can't access features after migration
- Check if roles are assigned to users
- Verify permissions are assigned to roles
- Check if permissions are granted (not denied)

### Permission checks not working
- Ensure Prisma client is regenerated after migration
- Check that session includes permissions (may need to re-login)
- Verify permission names match exactly

### System roles can't be deleted
- This is by design - system roles are protected
- Create custom roles for testing/deletion

