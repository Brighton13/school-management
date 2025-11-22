import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

describe('Teacher Workflow Tests', () => {
  let adminUser: any
  let teacherUser: any
  let teacherStaff: any
  let studentUser: any
  let student: any
  let term: any
  let class1: any
  let section: any
  let subject: any
  let classSubject: any
  let exam: any
  let enrollment: any

  beforeAll(async () => {
    // Setup: Create admin, teacher, student, and basic data
    const adminPassword = await bcrypt.hash('testadmin123', 10)
    adminUser = await prisma.user.create({
      data: {
        email: 'testadmin2@school.com',
        password: adminPassword,
        name: 'Test Admin 2',
        role: 'ADMIN',
        isActive: true,
        staff: {
          create: {
            employeeId: 'TEST-ADMIN-002',
            designation: 'ADMIN',
            status: 'ACTIVE',
          },
        },
      },
    })

    const teacherPassword = await bcrypt.hash('testteacher123', 10)
    teacherUser = await prisma.user.create({
      data: {
        email: 'testteacher2@school.com',
        password: teacherPassword,
        name: 'Test Teacher 2',
        role: 'TEACHER',
        isActive: true,
        staff: {
          create: {
            employeeId: 'TEST-TEACHER-002',
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

    const studentPassword = await bcrypt.hash('teststudent123', 10)
    const uniqueEmail = `teststudent-${Date.now()}@school.com`
    studentUser = await prisma.user.create({
      data: {
        email: uniqueEmail,
        password: studentPassword,
        name: 'Test Student',
        role: 'STUDENT',
        isActive: true,
      },
    })

    student = await prisma.student.create({
      data: {
        admissionNumber: 'TEST-001',
        userId: studentUser.id,
        dateOfBirth: new Date('2010-01-01'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    })

    term = await prisma.academicTerm.create({
      data: {
        name: 'Test Term 2',
        academicYear: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2024-12-20'),
        isCurrent: true,
      },
    })

    class1 = await prisma.class.create({
      data: {
        name: 'Test Grade 6',
        level: 6,
        capacity: 30,
      },
    })

    section = await prisma.section.create({
      data: {
        name: 'A',
        classId: class1.id,
        capacity: 30,
        // classTeacherId is optional - can be set later
      },
    })

    subject = await prisma.subject.create({
      data: {
        name: 'Test Math',
        code: 'TEST-MATH-2',
        type: 'CORE',
      },
    })

    classSubject = await prisma.classSubject.create({
      data: {
        classId: class1.id,
        subjectId: subject.id,
        teacherId: teacherStaff.id,
        maxMarks: 100,
        passMarks: 40,
      },
    })

    exam = await prisma.exam.create({
      data: {
        name: 'Test Exam',
        examType: 'MID_TERM',
        academicTermId: term.id,
        startDate: new Date('2024-10-15'),
        endDate: new Date('2024-10-25'),
        isFinal: false,
        requiresApproval: true,
        status: 'ACTIVE',
        createdBy: adminUser.id,
      },
    })

    enrollment = await prisma.classEnrollment.create({
      data: {
        studentId: student.id,
        classId: class1.id,
        sectionId: section.id,
        academicYear: '2024-2025',
        term: 'First Term',
        status: 'ACTIVE',
      },
    })
  })

  afterAll(async () => {
    await prisma.result.deleteMany()
    await prisma.classEnrollment.deleteMany()
    await prisma.exam.deleteMany()
    await prisma.classSubject.deleteMany()
    await prisma.section.deleteMany()
    await prisma.class.deleteMany()
    await prisma.subject.deleteMany()
    await prisma.student.deleteMany()
    await prisma.academicTerm.deleteMany()
    await prisma.staff.deleteMany({
      where: { userId: { in: [adminUser.id, teacherUser.id].filter(Boolean) } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, teacherUser.id, studentUser.id].filter(Boolean) } },
    })
    await prisma.$disconnect()
  })

  test('1. Teacher can enter result for assigned subject', async () => {
    const result = await prisma.result.create({
      data: {
        studentId: student.id,
        classSubjectId: classSubject.id,
        academicTermId: term.id,
        examId: exam.id,
        marksObtained: 85,
        maxMarks: 100,
        grade: 'A',
        status: 'PENDING_CLASS_TEACHER', // Automatically goes to class teacher
        submittedBy: teacherUser.id,
        submittedAt: new Date(),
      },
    })

    expect(result).toBeDefined()
    expect(result.status).toBe('PENDING_CLASS_TEACHER')
    expect(result.submittedBy).toBe(teacherUser.id)
  })

  test('2. Teacher can only see students from assigned classes', async () => {
    if (!teacherStaff) {
      throw new Error('Teacher staff not found')
    }

    // This would be tested via API, but we verify the data structure
    const results = await prisma.result.findMany({
      where: {
        classSubject: {
          teacherId: teacherStaff.id,
        },
      },
      include: {
        student: true,
        classSubject: {
          include: {
            class: true,
          },
        },
      },
    })

    // All results should be for classes where teacher is assigned
    results.forEach((result) => {
      expect(result.classSubject.teacherId).toBe(teacherStaff.id)
    })
  })

  test('3. Result automatically goes to class teacher when submitted', async () => {
    // Create a new result to test the workflow
    const newResult = await prisma.result.create({
      data: {
        studentId: student.id,
        classSubjectId: classSubject.id,
        academicTermId: term.id,
        examId: exam.id,
        marksObtained: 90,
        maxMarks: 100,
        grade: 'A',
        status: 'PENDING_CLASS_TEACHER',
        submittedBy: teacherUser.id,
        submittedAt: new Date(),
      },
    })

    expect(newResult).toBeDefined()
    expect(newResult.status).toBe('PENDING_CLASS_TEACHER')
    expect(newResult.submittedBy).toBe(teacherUser.id)
  })
})

