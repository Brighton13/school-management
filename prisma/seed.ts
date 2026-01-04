import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')
  console.log('ℹ️  Using upsert operations - existing data will be preserved')

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

    // Terms
    { name: "terms.create", module: "terms", action: "create", description: "Create new terms" },
    { name: "terms.read", module: "terms", action: "read", description: "View terms" },
    { name: "terms.update", module: "terms", action: "update", description: "Update term information" },
    { name: "terms.delete", module: "terms", action: "delete", description: "Delete terms" },

    // Results
    { name: "results.create", module: "results", action: "create", description: "Create new results" },
    { name: "results.read", module: "results", action: "read", description: "View results" },
    { name: "results.update", module: "results", action: "update", description: "Update results" },
    { name: "results.delete", module: "results", action: "delete", description: "Delete results" },
    { name: "results.approve", module: "results", action: "approve", description: "Approve results" },
    { name: "results.review", module: "results", action: "review", description: "Review results" },
    { name: "results.class_teacher_submit", module: "results", action: "class_teacher_submit", description: "Class teacher submit results" },
    { name: "results.principal_approve", module: "results", action: "principal_approve", description: "Principal approve results" },

    // Reports
    { name: "reports.generate", module: "reports", action: "generate", description: "Generate reports" },
    { name: "reports.view", module: "reports", action: "view", description: "View reports" },
    { name: "reports.download", module: "reports", action: "download", description: "Download reports" },
    { name: "reports.bulk_generate", module: "reports", action: "bulk_generate", description: "Bulk generate reports" },
    { name: "reports.comments.create", module: "reports", action: "comments.create", description: "Create report comments" },
    { name: "reports.comments.read", module: "reports", action: "comments.read", description: "View report comments" },
    { name: "reports.comments.update", module: "reports", action: "comments.update", description: "Update report comments" },
    { name: "reports.comments.delete", module: "reports", action: "comments.delete", description: "Delete report comments" },

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

    // Signatures
    { name: "signatures.create", module: "signatures", action: "create", description: "Create signatures" },
    { name: "signatures.read", module: "signatures", action: "read", description: "View signatures" },
    { name: "signatures.update", module: "signatures", action: "update", description: "Update signatures" },
    { name: "signatures.delete", module: "signatures", action: "delete", description: "Delete signatures" },

    // Teacher Assignments
    { name: "teacher_assignments.create", module: "teacher_assignments", action: "create", description: "Create teacher assignments" },
    { name: "teacher_assignments.read", module: "teacher_assignments", action: "read", description: "View teacher assignments" },
    { name: "teacher_assignments.update", module: "teacher_assignments", action: "update", description: "Update teacher assignments" },
    { name: "teacher_assignments.delete", module: "teacher_assignments", action: "delete", description: "Delete teacher assignments" },

    // Promotions
    { name: "promotions.create", module: "promotions", action: "create", description: "Create student promotions" },
    { name: "promotions.read", module: "promotions", action: "read", description: "View promotions" },
    { name: "promotions.update", module: "promotions", action: "update", description: "Update promotions" },
    { name: "promotions.delete", module: "promotions", action: "delete", description: "Delete promotions" },

    // Timetable
    { name: "timetable.create", module: "timetable", action: "create", description: "Create timetable entries" },
    { name: "timetable.read", module: "timetable", action: "read", description: "View timetable" },
    { name: "timetable.update", module: "timetable", action: "update", description: "Update timetable" },
    { name: "timetable.delete", module: "timetable", action: "delete", description: "Delete timetable entries" },

    // Dashboard
    { name: "dashboard.view", module: "dashboard", action: "view", description: "View dashboard" },
    { name: "dashboard.analytics", module: "dashboard", action: "analytics", description: "View analytics on dashboard" },

    // Parents
    { name: "parents.create", module: "parents", action: "create", description: "Create parent records" },
    { name: "parents.read", module: "parents", action: "read", description: "View parents" },
    { name: "parents.update", module: "parents", action: "update", description: "Update parent information" },
    { name: "parents.delete", module: "parents", action: "delete", description: "Delete parent records" },
  ]

  const createdPermissions = await Promise.all(
    permissions.map(perm => prisma.permission.upsert({
      where: { name: perm.name },
      update: { module: perm.module, action: perm.action, description: perm.description },
      create: perm,
    }))
  )
  console.log(`✅ Upserted ${createdPermissions.length} permissions`)

  // ============================================
  // SEED ROLES
  // ============================================
  console.log('Creating roles...')
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: { description: "System Administrator with full access", isSystem: true },
    create: {
      name: "ADMIN",
      description: "System Administrator with full access",
      isSystem: true,
    },
  })

  const principalRole = await prisma.role.upsert({
    where: { name: "PRINCIPAL" },
    update: { description: "School Principal with administrative access", isSystem: true },
    create: {
      name: "PRINCIPAL",
      description: "School Principal with administrative access",
      isSystem: true,
    },
  })

  const teacherRole = await prisma.role.upsert({
    where: { name: "TEACHER" },
    update: { description: "Teacher with access to classes and results", isSystem: true },
    create: {
      name: "TEACHER",
      description: "Teacher with access to classes and results",
      isSystem: true,
    },
  })

  const accountantRole = await prisma.role.upsert({
    where: { name: "ACCOUNTANT" },
    update: { description: "Accountant with access to fees and financial data", isSystem: true },
    create: {
      name: "ACCOUNTANT",
      description: "Accountant with access to fees and financial data",
      isSystem: true,
    },
  })

  const librarianRole = await prisma.role.upsert({
    where: { name: "LIBRARIAN" },
    update: { description: "Librarian with access to inventory", isSystem: true },
    create: {
      name: "LIBRARIAN",
      description: "Librarian with access to inventory",
      isSystem: true,
    },
  })

  const studentRole = await prisma.role.upsert({
    where: { name: "STUDENT" },
    update: { description: "Student with limited read access", isSystem: true },
    create: {
      name: "STUDENT",
      description: "Student with limited read access",
      isSystem: true,
    },
  })

  const parentRole = await prisma.role.upsert({
    where: { name: "PARENT" },
    update: { description: "Parent with access to their children's data", isSystem: true },
    create: {
      name: "PARENT",
      description: "Parent with access to their children's data",
      isSystem: true,
    },
  })
  console.log('✅ Upserted roles')

  // ============================================
  // ASSIGN PERMISSIONS TO ROLES
  // ============================================
  console.log('Assigning permissions to roles...')

  // Helper function to upsert role permissions
  const upsertRolePermission = async (roleId: string, permissionId: string) => {
    return prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: { granted: true },
      create: { roleId, permissionId, granted: true },
    })
  }

  // ADMIN gets all permissions
  await Promise.all(
    createdPermissions.map(p => upsertRolePermission(adminRole.id, p.id))
  )

  // PRINCIPAL gets all except roles/permissions management
  const principalPerms = createdPermissions.filter(
    p => !p.name.startsWith("roles.") && !p.name.startsWith("permissions.")
  )
  await Promise.all(
    principalPerms.map(p => upsertRolePermission(principalRole.id, p.id))
  )

  // TEACHER gets specific permissions
  const teacherPerms = createdPermissions.filter(p =>
    p.name.includes("results.") ||
    p.name === "students.read" ||
    p.name === "classes.read" ||
    p.name === "sections.read" ||
    p.name === "subjects.read" ||
    p.name === "terms.read" ||
    p.name === "academic_years.read" ||
    p.name === "exams.read" ||
    p.name.includes("announcements.") ||
    p.name.includes("attendance.") ||
    p.name.includes("signatures.") ||
    p.name.includes("reports.") ||
    p.name === "timetable.read" ||
    p.name === "dashboard.view" ||
    p.name === "teacher_assignments.read"
  )
  await Promise.all(
    teacherPerms.map(p => upsertRolePermission(teacherRole.id, p.id))
  )

  // ACCOUNTANT gets fees-related permissions
  const accountantPerms = createdPermissions.filter(p =>
    p.name.includes("fees.") || 
    p.name === "students.read" ||
    p.name === "dashboard.view" ||
    p.name === "reports.view" ||
    p.name === "reports.generate"
  )
  await Promise.all(
    accountantPerms.map(p => upsertRolePermission(accountantRole.id, p.id))
  )

  // LIBRARIAN gets inventory permissions
  const librarianPerms = createdPermissions.filter(p => 
    p.name.includes("inventory.") ||
    p.name === "dashboard.view" ||
    p.name === "announcements.read"
  )
  await Promise.all(
    librarianPerms.map(p => upsertRolePermission(librarianRole.id, p.id))
  )

  // STUDENT gets read-only permissions
  const studentPerms = createdPermissions.filter(p =>
    p.name === "results.read" ||
    p.name === "fees.read" ||
    p.name === "announcements.read" ||
    p.name === "exams.read" ||
    p.name === "timetable.read" ||
    p.name === "reports.view" ||
    p.name === "dashboard.view"
  )
  await Promise.all(
    studentPerms.map(p => upsertRolePermission(studentRole.id, p.id))
  )

  // PARENT gets read-only permissions
  const parentPerms = createdPermissions.filter(p =>
    p.name === "results.read" ||
    p.name === "fees.read" ||
    p.name === "announcements.read" ||
    p.name === "reports.view" ||
    p.name === "dashboard.view" ||
    p.name === "attendance.read"
  )
  await Promise.all(
    parentPerms.map(p => upsertRolePermission(parentRole.id, p.id))
  )
  console.log('✅ Upserted role permissions')

  // ============================================
  // CREATE USERS (only if they don't exist)
  // ============================================
  console.log('Creating default users (if not exist)...')
  
  // Helper to create user with staff and role if not exists
  const createUserIfNotExists = async (
    email: string,
    password: string,
    name: string,
    role: string,
    employeeId: string,
    designation: string,
    roleId: string,
    department?: string
  ) => {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      console.log(`  ℹ️  User ${email} already exists, skipping...`)
      return existingUser
    }
    
    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        isActive: true,
        staff: {
          create: {
            employeeId,
            designation,
            department,
            status: 'ACTIVE',
          },
        },
        roles: {
          create: { roleId },
        },
      },
    })
    console.log(`  ✅ Created ${role.toLowerCase()} user: ${email}`)
    return user
  }

  const admin = await createUserIfNotExists(
    'admin@school.com', 'admin123', 'Admin User', 'ADMIN', 'EMP001', 'ADMIN', adminRole.id
  )

  const principal = await createUserIfNotExists(
    'principal@school.com', 'principal123', 'Principal', 'PRINCIPAL', 'EMP002', 'PRINCIPAL', principalRole.id
  )

  const teacher = await createUserIfNotExists(
    'teacher@school.com', 'teacher123', 'John Teacher', 'TEACHER', 'EMP003', 'TEACHER', teacherRole.id, 'Mathematics'
  )

  // ============================================
  // CREATE SAMPLE DATA (only if not exist)
  // ============================================
  console.log('Creating sample data (if not exist)...')

  // Helper function to create class if not exists
  const createClassIfNotExists = async (name: string, level: number, capacity: number) => {
    const existing = await prisma.class.findFirst({ where: { name } })
    if (existing) return existing
    return prisma.class.create({ data: { name, level, capacity } })
  }

  // Create sample classes
  const class1 = await createClassIfNotExists('Grade 1', 1, 30)
  const class2 = await createClassIfNotExists('Grade 2', 2, 30)
  const class3 = await createClassIfNotExists('Grade 10', 10, 40)
  console.log('  ✅ Upserted classes')

  // Get teacher staff record (for sections and class-subject assignments)
  const teacherStaff = await prisma.staff.findFirst({
    where: { designation: 'TEACHER' },
  })

  // Create sections (check if exist first)
  const existingSections = await prisma.section.findMany({ 
    where: { classId: { in: [class1.id, class3.id] } } 
  })
  
  if (existingSections.length === 0) {
    await prisma.section.createMany({
      data: [
        { name: 'A', classId: class1.id, capacity: 30 },
        { name: 'B', classId: class1.id, capacity: 30 },
        { name: 'A', classId: class3.id, capacity: 40, classTeacherId: teacherStaff?.id },
        { name: 'B', classId: class3.id, capacity: 40 },
      ],
      skipDuplicates: true,
    })
    console.log('  ✅ Created sections')
  } else {
    console.log('  ℹ️  Sections already exist, skipping...')
  }

  // Create sample subjects
  const math = await prisma.subject.upsert({
    where: { code: 'MATH' },
    update: {},
    create: { name: 'Mathematics', code: 'MATH', type: 'CORE' },
  })

  const english = await prisma.subject.upsert({
    where: { code: 'ENG' },
    update: {},
    create: { name: 'English', code: 'ENG', type: 'CORE' },
  })

  const science = await prisma.subject.upsert({
    where: { code: 'SCI' },
    update: {},
    create: { name: 'Science', code: 'SCI', type: 'CORE' },
  })

  const physics = await prisma.subject.upsert({
    where: { code: 'PHY' },
    update: {},
    create: { name: 'Physics', code: 'PHY', type: 'CORE' },
  })

  const chemistry = await prisma.subject.upsert({
    where: { code: 'CHEM' },
    update: {},
    create: { name: 'Chemistry', code: 'CHEM', type: 'CORE' },
  })
  console.log('  ✅ Upserted subjects')

  // Create academic year
  const academicYear = await prisma.academicYear.upsert({
    where: { year: '2024-2025' },
    update: {},
    create: {
      year: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-06-30'),
      isCurrent: true,
      status: 'ACTIVE',
    },
  })
  console.log('  ✅ Upserted academic year')

  // Create academic term (check if exists)
  const existingTerm = await prisma.term.findFirst({
    where: { academicYearId: academicYear.id, termNumber: 1 },
  })
  
  const term = existingTerm || await prisma.term.create({
    data: {
      name: 'First Term',
      termNumber: 1,
      academicYearId: academicYear.id,
      startDate: new Date('2024-09-01'),
      endDate: new Date('2024-12-20'),
      isCurrent: true,
    },
  })
  console.log(existingTerm ? '  ℹ️  Term already exists, skipping...' : '  ✅ Created academic term')

  // Create class-subject assignments (only if not exist)
  if (teacherStaff) {
    const existingAssignments = await prisma.classSubject.count()
    if (existingAssignments === 0) {
      await prisma.classSubject.createMany({
        data: [
          { classId: class1.id, subjectId: math.id, teacherId: teacherStaff.id, maxMarks: 100, passMarks: 40 },
          { classId: class1.id, subjectId: english.id, maxMarks: 100, passMarks: 40 },
          { classId: class3.id, subjectId: math.id, teacherId: teacherStaff.id, maxMarks: 100, passMarks: 40 },
          { classId: class3.id, subjectId: physics.id, teacherId: teacherStaff.id, maxMarks: 100, passMarks: 40 },
        ],
        skipDuplicates: true,
      })
      console.log('  ✅ Created class-subject assignments')
    } else {
      console.log('  ℹ️  Class-subject assignments already exist, skipping...')
    }
  }

  // Create sample exam (only if not exist)
  const existingExam = await prisma.exam.findFirst({
    where: { name: 'Mid Term Examination', academicYearId: academicYear.id },
  })
  
  if (!existingExam) {
    await prisma.exam.create({
      data: {
        name: 'Mid Term Examination',
        description: 'First term mid-term examination',
        examType: 'MID_TERM',
        academicYearId: academicYear.id,
        termId: term.id,
        startDate: new Date('2024-10-15'),
        endDate: new Date('2024-10-25'),
        isFinal: false,
        requiresApproval: true,
        status: 'ACTIVE',
        createdBy: admin.id,
      },
    })
    console.log('  ✅ Created exam')
  } else {
    console.log('  ℹ️  Exam already exists, skipping...')
  }

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
