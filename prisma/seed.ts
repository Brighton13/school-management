import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clear existing data (in reverse order of dependencies)
  console.log('Clearing existing data...')
  await prisma.result.deleteMany()
  await prisma.exam.deleteMany()
  await prisma.studentAssignment.deleteMany()
  await prisma.assignment.deleteMany()
  await prisma.timetable.deleteMany()
  await prisma.classEnrollment.deleteMany()
  await prisma.studentParent.deleteMany()
  await prisma.attendance.deleteMany()
  await prisma.fee.deleteMany()
  await prisma.inventoryTransaction.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.announcement.deleteMany()
  await prisma.classSubject.deleteMany()
  await prisma.section.deleteMany()
  await prisma.class.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.term.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.application.deleteMany()
  await prisma.student.deleteMany()
  await prisma.parent.deleteMany()
  await prisma.userPermission.deleteMany()
  await prisma.userRole.deleteMany()
  await prisma.rolePermission.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.role.deleteMany()
  await prisma.signature.deleteMany()
  await prisma.user.deleteMany()
  await prisma.academicYear.deleteMany()

  // ============================================
  // SEED PERMISSIONS
  // ============================================
  console.log('Creating permissions...')
  const permissions = [
    // Students
    { name: "students.create", module: "students", action: "create", description: "Create new students" },
    { name: "students.read", module: "students", action: "read", description: "View students" },
    { name: "students.update", module: "students", action: "update", description: "Update student information" },
    { name: "students.delete", module: "students", action: "delete", description: "Delete students" },
    { name: "students.bulk_upload", module: "students", action: "bulk_upload", description: "Bulk import students" },

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
    { name: "enrollment.bulk_upload", module: "enrollment", action: "bulk_upload", description: "Bulk enroll students" },

    // Applications
    { name: "applications.create", module: "applications", action: "create", description: "Create applications" },
    { name: "applications.read", module: "applications", action: "read", description: "View applications" },
    { name: "applications.update", module: "applications", action: "update", description: "Update applications" },
    { name: "applications.delete", module: "applications", action: "delete", description: "Delete applications" },
    { name: "applications.approve", module: "applications", action: "approve", description: "Approve applications" },

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

    // Academic Years
    { name: "academic_years.create", module: "academic_years", action: "create", description: "Create academic years" },
    { name: "academic_years.read", module: "academic_years", action: "read", description: "View academic years" },
    { name: "academic_years.update", module: "academic_years", action: "update", description: "Update academic years" },
    { name: "academic_years.delete", module: "academic_years", action: "delete", description: "Delete academic years" },

    // Attendance
    { name: "attendance.create", module: "attendance", action: "create", description: "Create attendance records" },
    { name: "attendance.read", module: "attendance", action: "read", description: "View attendance" },
    { name: "attendance.update", module: "attendance", action: "update", description: "Update attendance" },
    { name: "attendance.delete", module: "attendance", action: "delete", description: "Delete attendance records" },
  ]

  const createdPermissions = await Promise.all(
    permissions.map(perm => prisma.permission.create({ data: perm }))
  )
  console.log(`✅ Created ${createdPermissions.length} permissions`)

  // ============================================
  // SEED ROLES
  // ============================================
  console.log('Creating roles...')
  const adminRole = await prisma.role.create({
    data: {
      name: "ADMIN",
      description: "System Administrator with full access",
      isSystem: true,
    },
  })

  const principalRole = await prisma.role.create({
    data: {
      name: "PRINCIPAL",
      description: "School Principal with administrative access",
      isSystem: true,
    },
  })

  const teacherRole = await prisma.role.create({
    data: {
      name: "TEACHER",
      description: "Teacher with access to classes and results",
      isSystem: true,
    },
  })

  const accountantRole = await prisma.role.create({
    data: {
      name: "ACCOUNTANT",
      description: "Accountant with access to fees and financial data",
      isSystem: true,
    },
  })

  const librarianRole = await prisma.role.create({
    data: {
      name: "LIBRARIAN",
      description: "Librarian with access to inventory",
      isSystem: true,
    },
  })

  const studentRole = await prisma.role.create({
    data: {
      name: "STUDENT",
      description: "Student with limited read access",
      isSystem: true,
    },
  })

  const parentRole = await prisma.role.create({
    data: {
      name: "PARENT",
      description: "Parent with access to their children's data",
      isSystem: true,
    },
  })
  console.log('✅ Created roles')

  // ============================================
  // ASSIGN PERMISSIONS TO ROLES
  // ============================================
  console.log('Assigning permissions to roles...')

  // ADMIN gets all permissions
  await Promise.all(
    createdPermissions.map(p =>
      prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: p.id, granted: true },
      })
    )
  )

  // PRINCIPAL gets all except roles/permissions management
  const principalPerms = createdPermissions.filter(
    p => !p.name.startsWith("roles.") && !p.name.startsWith("permissions.")
  )
  await Promise.all(
    principalPerms.map(p =>
      prisma.rolePermission.create({
        data: { roleId: principalRole.id, permissionId: p.id, granted: true },
      })
    )
  )

  // TEACHER gets specific permissions
  const teacherPerms = createdPermissions.filter(p =>
    p.name.includes("results.") ||
    p.name === "students.read" ||
    p.name === "classes.read" ||
    p.name === "sections.read" ||
    p.name === "subjects.read" ||
    p.name === "exams.read" ||
    p.name.includes("announcements.") ||
    p.name.includes("attendance.")
  )
  await Promise.all(
    teacherPerms.map(p =>
      prisma.rolePermission.create({
        data: { roleId: teacherRole.id, permissionId: p.id, granted: true },
      })
    )
  )

  // ACCOUNTANT gets fees-related permissions
  const accountantPerms = createdPermissions.filter(p =>
    p.name.includes("fees.") || p.name === "students.read"
  )
  await Promise.all(
    accountantPerms.map(p =>
      prisma.rolePermission.create({
        data: { roleId: accountantRole.id, permissionId: p.id, granted: true },
      })
    )
  )

  // LIBRARIAN gets inventory permissions
  const librarianPerms = createdPermissions.filter(p => p.name.includes("inventory."))
  await Promise.all(
    librarianPerms.map(p =>
      prisma.rolePermission.create({
        data: { roleId: librarianRole.id, permissionId: p.id, granted: true },
      })
    )
  )

  // STUDENT gets read-only permissions
  const studentPerms = createdPermissions.filter(p =>
    p.name === "results.read" ||
    p.name === "fees.read" ||
    p.name === "announcements.read" ||
    p.name === "exams.read"
  )
  await Promise.all(
    studentPerms.map(p =>
      prisma.rolePermission.create({
        data: { roleId: studentRole.id, permissionId: p.id, granted: true },
      })
    )
  )

  // PARENT gets read-only permissions
  const parentPerms = createdPermissions.filter(p =>
    p.name === "results.read" ||
    p.name === "fees.read" ||
    p.name === "announcements.read"
  )
  await Promise.all(
    parentPerms.map(p =>
      prisma.rolePermission.create({
        data: { roleId: parentRole.id, permissionId: p.id, granted: true },
      })
    )
  )
  console.log('✅ Assigned permissions to roles')

  // ============================================
  // CREATE USERS
  // ============================================
  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@school.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true,
      staff: {
        create: {
          employeeId: 'EMP001',
          designation: 'ADMIN',
          status: 'ACTIVE',
        },
      },
      roles: {
        create: {
          roleId: adminRole.id,
        },
      },
    },
  })
  console.log('✅ Created admin user')

  // Create principal
  const principalPassword = await bcrypt.hash('principal123', 10)
  const principal = await prisma.user.create({
    data: {
      email: 'principal@school.com',
      password: principalPassword,
      name: 'Principal',
      role: 'PRINCIPAL',
      isActive: true,
      staff: {
        create: {
          employeeId: 'EMP002',
          designation: 'PRINCIPAL',
          status: 'ACTIVE',
        },
      },
      roles: {
        create: {
          roleId: principalRole.id,
        },
      },
    },
  })
  console.log('✅ Created principal user')

  // Create sample teacher
  const teacherPassword = await bcrypt.hash('teacher123', 10)
  const teacher = await prisma.user.create({
    data: {
      email: 'teacher@school.com',
      password: teacherPassword,
      name: 'John Teacher',
      role: 'TEACHER',
      isActive: true,
      staff: {
        create: {
          employeeId: 'EMP003',
          designation: 'TEACHER',
          department: 'Mathematics',
          status: 'ACTIVE',
        },
      },
      roles: {
        create: {
          roleId: teacherRole.id,
        },
      },
    },
  })
  console.log('✅ Created teacher user')

  // Create sample classes
  const class1 = await prisma.class.create({
    data: {
      name: 'Grade 1',
      level: 1,
      capacity: 30,
    },
  })

  const class2 = await prisma.class.create({
    data: {
      name: 'Grade 2',
      level: 2,
      capacity: 30,
    },
  })

  const class3 = await prisma.class.create({
    data: {
      name: 'Grade 10',
      level: 10,
      capacity: 40,
    },
  })
  console.log('✅ Created classes')

  // Create sections
  const section1 = await prisma.section.create({
    data: {
      name: 'A',
      classId: class1.id,
      capacity: 30,
    },
  })

  const section2 = await prisma.section.create({
    data: {
      name: 'B',
      classId: class1.id,
      capacity: 30,
    },
  })

  // Get teacher staff record
  const teacherStaff = await prisma.staff.findUnique({
    where: { userId: teacher.id },
  })

  if (!teacherStaff) {
    throw new Error('Failed to create teacher staff record')
  }

  const section3 = await prisma.section.create({
    data: {
      name: 'A',
      classId: class3.id,
      capacity: 40,
      classTeacherId: teacherStaff.id,
    },
  })

  const section4 = await prisma.section.create({
    data: {
      name: 'B',
      classId: class3.id,
      capacity: 40,
    },
  })
  console.log('✅ Created sections')

  // Create sample subjects
  const math = await prisma.subject.create({
    data: {
      name: 'Mathematics',
      code: 'MATH',
      type: 'CORE',
    },
  })

  const english = await prisma.subject.create({
    data: {
      name: 'English',
      code: 'ENG',
      type: 'CORE',
    },
  })

  const science = await prisma.subject.create({
    data: {
      name: 'Science',
      code: 'SCI',
      type: 'CORE',
    },
  })

  const physics = await prisma.subject.create({
    data: {
      name: 'Physics',
      code: 'PHY',
      type: 'CORE',
    },
  })

  const chemistry = await prisma.subject.create({
    data: {
      name: 'Chemistry',
      code: 'CHEM',
      type: 'CORE',
    },
  })
  console.log('✅ Created subjects')

  // Create academic year first
  const academicYear = await prisma.academicYear.create({
    data: {
      year: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-06-30'),
      isCurrent: true,
      status: 'ACTIVE',
    },
  })
  console.log('✅ Created academic year')

  // Create academic term
  const term = await prisma.term.create({
    data: {
      name: 'First Term',
      termNumber: 1,
      academicYearId: academicYear.id,
      startDate: new Date('2024-09-01'),
      endDate: new Date('2024-12-20'),
      isCurrent: true,
    },
  })
  console.log('✅ Created academic term')

  // Create class-subject assignments
  await prisma.classSubject.create({
    data: {
      classId: class1.id,
      subjectId: math.id,
      teacherId: teacherStaff.id,
      maxMarks: 100,
      passMarks: 40,
    },
  })

  await prisma.classSubject.create({
    data: {
      classId: class1.id,
      subjectId: english.id,
      maxMarks: 100,
      passMarks: 40,
    },
  })

  await prisma.classSubject.create({
    data: {
      classId: class3.id,
      subjectId: math.id,
      teacherId: teacherStaff.id,
      maxMarks: 100,
      passMarks: 40,
    },
  })

  await prisma.classSubject.create({
    data: {
      classId: class3.id,
      subjectId: physics.id,
      teacherId: teacherStaff.id,
      maxMarks: 100,
      passMarks: 40,
    },
  })
  console.log('✅ Created class-subject assignments')

  // Create sample exam
  const exam = await prisma.exam.create({
    data: {
      name: 'Mid Term Examination',
      description: 'First term mid-term examination',
      examType: 'MID_TERM',
      academicYearId: term.academicYearId, // Use the correct property and value
      termId: term.id,
      startDate: new Date('2024-10-15'),
      endDate: new Date('2024-10-25'),
      isFinal: false,
      requiresApproval: true,
      status: 'ACTIVE',
      createdBy: admin.id,
    },
  })
  console.log('✅ Created exam')

  console.log('\n🎉 Seeding completed successfully!')
  console.log('\n📋 Login Credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Admin:')
  console.log('  Email: admin@school.com')
  console.log('  Password: admin123')
  console.log('\nPrincipal:')
  console.log('  Email: principal@school.com')
  console.log('  Password: principal123')
  console.log('\nTeacher:')
  console.log('  Email: teacher@school.com')
  console.log('  Password: teacher123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
