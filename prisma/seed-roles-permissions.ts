import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding roles and permissions...")

  // Create default permissions
  const permissions = [
    // Students
    { name: "students.create", module: "students", action: "create", description: "Create new students" },
    { name: "students.read", module: "students", action: "read", description: "View students" },
    { name: "students.update", module: "students", action: "update", description: "Update student information" },
    { name: "students.delete", module: "students", action: "delete", description: "Delete students" },

    // Staff
    { name: "staff.create", module: "staff", action: "create", description: "Create new staff members" },
    { name: "staff.read", module: "staff", action: "read", description: "View staff members" },
    { name: "staff.update", module: "staff", action: "update", description: "Update staff information" },
    { name: "staff.delete", module: "staff", action: "delete", description: "Delete staff members" },

    // Classes
    { name: "classes.create", module: "classes", action: "create", description: "Create new classes" },
    { name: "classes.read", module: "classes", action: "read", description: "View classes" },
    { name: "classes.update", module: "classes", action: "update", description: "Update class information" },
    { name: "classes.delete", module: "classes", action: "delete", description: "Delete classes" },

    // Sections
    { name: "sections.create", module: "sections", action: "create", description: "Create new sections" },
    { name: "sections.read", module: "sections", action: "read", description: "View sections" },
    { name: "sections.update", module: "sections", action: "update", description: "Update section information" },
    { name: "sections.delete", module: "sections", action: "delete", description: "Delete sections" },

    // Subjects
    { name: "subjects.create", module: "subjects", action: "create", description: "Create new subjects" },
    { name: "subjects.read", module: "subjects", action: "read", description: "View subjects" },
    { name: "subjects.update", module: "subjects", action: "update", description: "Update subject information" },
    { name: "subjects.delete", module: "subjects", action: "delete", description: "Delete subjects" },

    // Results
    { name: "results.create", module: "results", action: "create", description: "Create new results" },
    { name: "results.read", module: "results", action: "read", description: "View results" },
    { name: "results.update", module: "results", action: "update", description: "Update results" },
    { name: "results.delete", module: "results", action: "delete", description: "Delete results" },
    { name: "results.approve", module: "results", action: "approve", description: "Approve results" },
    { name: "results.review", module: "results", action: "review", description: "Review results" },

    // Fees
    { name: "fees.create", module: "fees", action: "create", description: "Create new fees" },
    { name: "fees.read", module: "fees", action: "read", description: "View fees" },
    { name: "fees.update", module: "fees", action: "update", description: "Update fee information" },
    { name: "fees.delete", module: "fees", action: "delete", description: "Delete fees" },

    // Exams
    { name: "exams.create", module: "exams", action: "create", description: "Create new exams" },
    { name: "exams.read", module: "exams", action: "read", description: "View exams" },
    { name: "exams.update", module: "exams", action: "update", description: "Update exam information" },
    { name: "exams.delete", module: "exams", action: "delete", description: "Delete exams" },

    // Enrollment
    { name: "enrollment.create", module: "enrollment", action: "create", description: "Create new enrollments" },
    { name: "enrollment.read", module: "enrollment", action: "read", description: "View enrollments" },
    { name: "enrollment.update", module: "enrollment", action: "update", description: "Update enrollment information" },
    { name: "enrollment.delete", module: "enrollment", action: "delete", description: "Delete enrollments" },

    // Inventory
    { name: "inventory.create", module: "inventory", action: "create", description: "Create new inventory items" },
    { name: "inventory.read", module: "inventory", action: "read", description: "View inventory" },
    { name: "inventory.update", module: "inventory", action: "update", description: "Update inventory items" },
    { name: "inventory.delete", module: "inventory", action: "delete", description: "Delete inventory items" },

    // Announcements
    { name: "announcements.create", module: "announcements", action: "create", description: "Create new announcements" },
    { name: "announcements.read", module: "announcements", action: "read", description: "View announcements" },
    { name: "announcements.update", module: "announcements", action: "update", description: "Update announcements" },
    { name: "announcements.delete", module: "announcements", action: "delete", description: "Delete announcements" },

    // Roles & Permissions
    { name: "roles.create", module: "roles", action: "create", description: "Create new roles" },
    { name: "roles.read", module: "roles", action: "read", description: "View roles" },
    { name: "roles.update", module: "roles", action: "update", description: "Update roles" },
    { name: "roles.delete", module: "roles", action: "delete", description: "Delete roles" },
    { name: "permissions.create", module: "permissions", action: "create", description: "Create new permissions" },
    { name: "permissions.read", module: "permissions", action: "read", description: "View permissions" },
    { name: "permissions.update", module: "permissions", action: "update", description: "Update permissions" },
    { name: "permissions.delete", module: "permissions", action: "delete", description: "Delete permissions" },

    // Users
    { name: "users.create", module: "users", action: "create", description: "Create new users" },
    { name: "users.read", module: "users", action: "read", description: "View users" },
    { name: "users.update", module: "users", action: "update", description: "Update user information" },
    { name: "users.delete", module: "users", action: "delete", description: "Delete users" },

    // Settings
    { name: "settings.read", module: "settings", action: "read", description: "View settings" },
    { name: "settings.update", module: "settings", action: "update", description: "Update settings" },

    // Audit & Logs
    { name: "audit.read", module: "audit", action: "read", description: "View audit trails" },
    { name: "session_logs.read", module: "session_logs", action: "read", description: "View session logs" },
  ]

  // Create permissions
  const createdPermissions = []
  for (const perm of permissions) {
    const existing = await prisma.permission.findUnique({
      where: { name: perm.name },
    })
    if (!existing) {
      const created = await prisma.permission.create({
        data: perm,
      })
      createdPermissions.push(created)
      console.log(`Created permission: ${perm.name}`)
    } else {
      createdPermissions.push(existing)
      console.log(`Permission already exists: ${perm.name}`)
    }
  }

  // Create default roles
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "System Administrator with full access",
      isSystem: true,
    },
  })

  const principalRole = await prisma.role.upsert({
    where: { name: "PRINCIPAL" },
    update: {},
    create: {
      name: "PRINCIPAL",
      description: "School Principal with administrative access",
      isSystem: true,
    },
  })

  const teacherRole = await prisma.role.upsert({
    where: { name: "TEACHER" },
    update: {},
    create: {
      name: "TEACHER",
      description: "Teacher with access to classes and results",
      isSystem: true,
    },
  })

  const accountantRole = await prisma.role.upsert({
    where: { name: "ACCOUNTANT" },
    update: {},
    create: {
      name: "ACCOUNTANT",
      description: "Accountant with access to fees and financial data",
      isSystem: true,
    },
  })

  const librarianRole = await prisma.role.upsert({
    where: { name: "LIBRARIAN" },
    update: {},
    create: {
      name: "LIBRARIAN",
      description: "Librarian with access to inventory",
      isSystem: true,
    },
  })

  const studentRole = await prisma.role.upsert({
    where: { name: "STUDENT" },
    update: {},
    create: {
      name: "STUDENT",
      description: "Student with limited read access",
      isSystem: true,
    },
  })

  const parentRole = await prisma.role.upsert({
    where: { name: "PARENT" },
    update: {},
    create: {
      name: "PARENT",
      description: "Parent with access to their children's data",
      isSystem: true,
    },
  })

  // Assign permissions to ADMIN role (all permissions)
  const adminPermissions = createdPermissions.map((p) => ({
    roleId: adminRole.id,
    permissionId: p.id,
    granted: true,
  }))

  for (const perm of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: perm.roleId,
          permissionId: perm.permissionId,
        },
      },
      update: { granted: true },
      create: perm,
    })
  }
  console.log("Assigned all permissions to ADMIN role")

  // Assign permissions to PRINCIPAL role
  const principalPermissions = createdPermissions
    .filter((p) => !p.name.startsWith("roles.") && !p.name.startsWith("permissions."))
    .map((p) => ({
      roleId: principalRole.id,
      permissionId: p.id,
      granted: true,
    }))

  for (const perm of principalPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: perm.roleId,
          permissionId: perm.permissionId,
        },
      },
      update: { granted: true },
      create: perm,
    })
  }
  console.log("Assigned permissions to PRINCIPAL role")

  // Assign permissions to TEACHER role
  const teacherPermissions = createdPermissions
    .filter((p) =>
      p.name.includes("results.") ||
      p.name.includes("students.read") ||
      p.name.includes("classes.read") ||
      p.name.includes("subjects.read") ||
      p.name.includes("exams.read") ||
      p.name.includes("announcements.")
    )
    .map((p) => ({
      roleId: teacherRole.id,
      permissionId: p.id,
      granted: true,
    }))

  for (const perm of teacherPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: perm.roleId,
          permissionId: perm.permissionId,
        },
      },
      update: { granted: true },
      create: perm,
    })
  }
  console.log("Assigned permissions to TEACHER role")

  // Assign permissions to ACCOUNTANT role
  const accountantPermissions = createdPermissions
    .filter((p) => p.name.includes("fees.") || p.name.includes("students.read"))
    .map((p) => ({
      roleId: accountantRole.id,
      permissionId: p.id,
      granted: true,
    }))

  for (const perm of accountantPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: perm.roleId,
          permissionId: perm.permissionId,
        },
      },
      update: { granted: true },
      create: perm,
    })
  }
  console.log("Assigned permissions to ACCOUNTANT role")

  // Assign permissions to LIBRARIAN role
  const librarianPermissions = createdPermissions
    .filter((p) => p.name.includes("inventory."))
    .map((p) => ({
      roleId: librarianRole.id,
      permissionId: p.id,
      granted: true,
    }))

  for (const perm of librarianPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: perm.roleId,
          permissionId: perm.permissionId,
        },
      },
      update: { granted: true },
      create: perm,
    })
  }
  console.log("Assigned permissions to LIBRARIAN role")

  // Assign permissions to STUDENT role (read-only)
  const studentPermissions = createdPermissions
    .filter((p) =>
      p.name.includes("results.read") ||
      p.name.includes("fees.read") ||
      p.name.includes("announcements.read") ||
      p.name.includes("exams.read")
    )
    .map((p) => ({
      roleId: studentRole.id,
      permissionId: p.id,
      granted: true,
    }))

  for (const perm of studentPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: perm.roleId,
          permissionId: perm.permissionId,
        },
      },
      update: { granted: true },
      create: perm,
    })
  }
  console.log("Assigned permissions to STUDENT role")

  // Assign permissions to PARENT role (read-only for their children)
  const parentPermissions = createdPermissions
    .filter((p) =>
      p.name.includes("results.read") ||
      p.name.includes("fees.read") ||
      p.name.includes("announcements.read")
    )
    .map((p) => ({
      roleId: parentRole.id,
      permissionId: p.id,
      granted: true,
    }))

  for (const perm of parentPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: perm.roleId,
          permissionId: perm.permissionId,
        },
      },
      update: { granted: true },
      create: perm,
    })
  }
  console.log("Assigned permissions to PARENT role")

  console.log("✅ Roles and permissions seeded successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

