import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

describe('Admin Workflow Tests', () => {
  let adminUser: any
  let createdTerm: any
  let createdClass: any
  let createdSection: any
  let createdSubject: any
  let createdExam: any
  let teacherUser: any
  let teacherStaff: any

  beforeAll(async () => {
    // Create admin user
    const adminPassword = await bcrypt.hash('testadmin123', 10)
    adminUser = await prisma.user.create({
      data: {
        email: 'testadmin@school.com',
        password: adminPassword,
        name: 'Test Admin',
        role: 'ADMIN',
        isActive: true,
        staff: {
          create: {
            employeeId: 'TEST-ADMIN-001',
            designation: 'ADMIN',
            status: 'ACTIVE',
          },
        },
      },
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.result.deleteMany({ where: { exam: { createdBy: adminUser.id } } })
    await prisma.exam.deleteMany({ where: { createdBy: adminUser.id } })
    await prisma.classSubject.deleteMany()
    await prisma.classEnrollment.deleteMany()
    await prisma.section.deleteMany()
    await prisma.class.deleteMany()
    await prisma.subject.deleteMany()
    await prisma.academicTerm.deleteMany()
    await prisma.staff.deleteMany({ where: { userId: { in: [adminUser.id, teacherUser?.id].filter(Boolean) } } })
    await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, teacherUser?.id].filter(Boolean) } } })
    await prisma.$disconnect()
  })

  test('1. Admin can create academic term', async () => {
    createdTerm = await prisma.academicTerm.create({
      data: {
        name: 'Test Term',
        academicYear: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2024-12-20'),
        isCurrent: true,
      },
    })

    expect(createdTerm).toBeDefined()
    expect(createdTerm.name).toBe('Test Term')
    expect(createdTerm.academicYear).toBe('2024-2025')
  })

  test('2. Admin can create class', async () => {
    createdClass = await prisma.class.create({
      data: {
        name: 'Test Grade 5',
        level: 5,
        capacity: 30,
      },
    })

    expect(createdClass).toBeDefined()
    expect(createdClass.name).toBe('Test Grade 5')
    expect(createdClass.level).toBe(5)
  })

  test('3. Admin can create section', async () => {
    createdSection = await prisma.section.create({
      data: {
        name: 'A',
        classId: createdClass.id,
        capacity: 30,
      },
    })

    expect(createdSection).toBeDefined()
    expect(createdSection.name).toBe('A')
    expect(createdSection.classId).toBe(createdClass.id)
  })

  test('4. Admin can create subject', async () => {
    createdSubject = await prisma.subject.create({
      data: {
        name: 'Test Mathematics',
        code: 'TEST-MATH',
        type: 'CORE',
      },
    })

    expect(createdSubject).toBeDefined()
    expect(createdSubject.name).toBe('Test Mathematics')
    expect(createdSubject.code).toBe('TEST-MATH')
  })

  test('5. Admin can create exam', async () => {
    createdExam = await prisma.exam.create({
      data: {
        name: 'Test Mid Term Exam',
        description: 'Test examination',
        examType: 'MID_TERM',
        academicTermId: createdTerm.id,
        startDate: new Date('2024-10-15'),
        endDate: new Date('2024-10-25'),
        isFinal: false,
        requiresApproval: true,
        status: 'ACTIVE',
        createdBy: adminUser.id,
      },
    })

    expect(createdExam).toBeDefined()
    expect(createdExam.name).toBe('Test Mid Term Exam')
    expect(createdExam.status).toBe('ACTIVE')
  })

  test('6. Admin can create teacher and staff record', async () => {
    const teacherPassword = await bcrypt.hash('testteacher123', 10)
    teacherUser = await prisma.user.create({
      data: {
        email: 'testteacher@school.com',
        password: teacherPassword,
        name: 'Test Teacher',
        role: 'TEACHER',
        isActive: true,
        staff: {
          create: {
            employeeId: 'TEST-TEACHER-001',
            designation: 'TEACHER',
            department: 'Mathematics',
            status: 'ACTIVE',
          },
        },
      },
    })

    teacherStaff = await prisma.staff.findUnique({
      where: { userId: teacherUser.id },
    })

    expect(teacherUser).toBeDefined()
    expect(teacherUser.role).toBe('TEACHER')
    expect(teacherStaff).toBeDefined()
  })

  test('7. Admin can assign teacher to class-subject', async () => {
    const classSubject = await prisma.classSubject.create({
      data: {
        classId: createdClass.id,
        subjectId: createdSubject.id,
        teacherId: teacherStaff!.id,
        maxMarks: 100,
        passMarks: 40,
      },
    })

    expect(classSubject).toBeDefined()
    expect(classSubject.teacherId).toBe(teacherStaff!.id)
  })

  test('8. Admin can assign class teacher to section', async () => {
    const updatedSection = await prisma.section.update({
      where: { id: createdSection.id },
      data: {
        classTeacherId: teacherStaff!.id,
      },
    })

    expect(updatedSection.classTeacherId).toBe(teacherStaff!.id)
  })
})

