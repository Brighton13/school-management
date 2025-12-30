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
  await prisma.student.deleteMany()
  await prisma.parent.deleteMany()
  await prisma.userPermission.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.signature.deleteMany()
  await prisma.user.deleteMany()

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
