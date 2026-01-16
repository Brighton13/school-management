import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

describe('Principal Workflow Tests', () => {
  let adminUser: any
  let principalUser: any
  let classTeacherUser: any
  let classTeacherStaff: any
  let subjectTeacherUser: any
  let subjectTeacherStaff: any
  let student: any
  let term: any
  let class1: any
  let section: any
  let subject: any
  let classSubject: any
  let exam: any
  let result: any

  beforeAll(async () => {
    // Setup complete workflow
    const timestamp = Date.now()
    const adminPassword = await bcrypt.hash('testadmin123', 10)
    adminUser = await prisma.user.create({
      data: {
        email: `testadmin4-${timestamp}@school.com`,
        password: adminPassword,
        name: 'Test Admin 4',
        role: 'ADMIN',
        isActive: true,
        staff: {
          create: {
            employeeId: `TEST-ADMIN-004-${timestamp}`,
            designation: 'ADMIN',
            status: 'ACTIVE',
          },
        },
      },
    })

    const principalPassword = await bcrypt.hash('testprincipal123', 10)
    principalUser = await prisma.user.create({
      data: {
        email: `testprincipal-${timestamp}@school.com`,
        password: principalPassword,
        name: 'Test Principal',
        role: 'PRINCIPAL',
        isActive: true,
        staff: {
          create: {
            employeeId: `TEST-PRINCIPAL-001-${timestamp}`,
            designation: 'PRINCIPAL',
            status: 'ACTIVE',
          },
        },
      },
    })

    const classTeacherPassword = await bcrypt.hash('testclassteacher123', 10)
    classTeacherUser = await prisma.user.create({
      data: {
        email: `testclassteacher2-${timestamp}@school.com`,
        password: classTeacherPassword,
        name: 'Test Class Teacher 2',
        role: 'TEACHER',
        isActive: true,
        staff: {
          create: {
            employeeId: `TEST-CLASS-TEACHER-002-${timestamp}`,
            designation: 'TEACHER',
            status: 'ACTIVE',
          },
        },
      },
    })

    classTeacherStaff = await prisma.staff.findUnique({
      where: { userId: classTeacherUser.id },
    })

    const subjectTeacherPassword = await bcrypt.hash('testsubjectteacher123', 10)
    subjectTeacherUser = await prisma.user.create({
      data: {
        email: `testsubjectteacher2-${timestamp}@school.com`,
        password: subjectTeacherPassword,
        name: 'Test Subject Teacher 2',
        role: 'TEACHER',
        isActive: true,
        staff: {
          create: {
            employeeId: `TEST-SUBJECT-TEACHER-002-${timestamp}`,
            designation: 'TEACHER',
            department: 'Mathematics',
            status: 'ACTIVE',
          },
        },
      },
    })

    subjectTeacherStaff = await prisma.staff.findUnique({
      where: { userId: subjectTeacherUser.id },
    })

    const studentUser = await prisma.user.create({
      data: {
        email: `teststudent3-${timestamp}@school.com`,
        password: await bcrypt.hash('test123', 10),
        name: 'Test Student 3',
        role: 'STUDENT',
        isActive: true,
      },
    })

    student = await prisma.student.create({
      data: {
        admissionNumber: `TEST-004-${timestamp}`,
        userId: studentUser.id,
        dateOfBirth: new Date('2010-01-01'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    })

    term = await prisma.academicTerm.create({
      data: {
        name: 'Test Term 4',
        academicYear: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2024-12-20'),
        isCurrent: true,
      },
    })

    class1 = await prisma.class.create({
      data: {
        name: 'Test Grade 8',
        level: 8,
        capacity: 30,
      },
    })

    section = await prisma.section.create({
      data: {
        name: 'A',
        classId: class1.id,
        capacity: 30,
        classTeacherId: classTeacherStaff!.id,
      },
    })

    subject = await prisma.subject.create({
      data: {
        name: 'Test Math 4',
        code: 'TEST-MATH-4',
        type: 'CORE',
      },
    })

    classSubject = await prisma.classSubject.create({
      data: {
        classId: class1.id,
        subjectId: subject.id,
        teacherId: subjectTeacherStaff!.id,
        maxMarks: 100,
        passMarks: 40,
      },
    })

    exam = await prisma.exam.create({
      data: {
        name: 'Test Exam 4',
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

    await prisma.classEnrollment.create({
      data: {
        studentId: student.id,
        classId: class1.id,
        sectionId: section.id,
        academicYear: '2024-2025',
        term: 'First Term',
        status: 'ACTIVE',
      },
    })

    // Subject teacher enters result
    result = await prisma.result.create({
      data: {
        studentId: student.id,
        classSubjectId: classSubject.id,
        academicTermId: term.id,
        examId: exam.id,
        marksObtained: 85,
        maxMarks: 100,
        grade: 'A',
        status: 'PENDING_CLASS_TEACHER',
        submittedBy: subjectTeacherUser.id,
        submittedAt: new Date(),
      },
    })

    expect(result).toBeDefined()
    expect(result.id).toBeDefined()

    // Class teacher reviews and submits
    result = await prisma.result.update({
      where: { id: result.id },
      data: {
        status: 'PENDING_APPROVAL',
        reviewedBy: classTeacherUser.id,
        reviewedAt: new Date(),
      },
    })

    expect(result.status).toBe('PENDING_APPROVAL')
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
      where: {
        userId: {
          in: [adminUser.id, principalUser.id, classTeacherUser.id, subjectTeacherUser.id].filter(Boolean),
        },
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [adminUser.id, principalUser.id, classTeacherUser.id, subjectTeacherUser.id].filter(Boolean),
        },
      },
    })
    await prisma.$disconnect()
  })

  test('1. Principal can view pending approvals', async () => {
    const pendingResults = await prisma.result.findMany({
      where: {
        status: 'PENDING_APPROVAL',
      },
    })

    expect(pendingResults.length).toBeGreaterThan(0)
    expect(pendingResults[0].status).toBe('PENDING_APPROVAL')
  })

  test('2. Principal can approve results', async () => {
    const updatedResult = await prisma.result.update({
      where: { id: result.id },
      data: {
        status: 'APPROVED',
        approvedBy: principalUser.id,
        approvedAt: new Date(),
      },
    })

    expect(updatedResult.status).toBe('APPROVED')
    expect(updatedResult.approvedBy).toBe(principalUser.id)
    expect(updatedResult.approvedAt).toBeDefined()
  })

  test('3. Principal can publish approved results', async () => {
    const publishedResult = await prisma.result.update({
      where: { id: result.id },
      data: {
        status: 'PUBLISHED',
        published: true,
        publishedAt: new Date(),
      },
    })

    expect(publishedResult.status).toBe('PUBLISHED')
    expect(publishedResult.published).toBe(true)
    expect(publishedResult.publishedAt).toBeDefined()
  })

  test('4. Complete workflow: Teacher → Class Teacher → Principal → Published', async () => {
    // Verify result exists
    expect(result).toBeDefined()
    expect(result.id).toBeDefined()

    // Verify the complete workflow
    const finalResult = await prisma.result.findUnique({
      where: { id: result.id },
      include: {
        submitter: true,
        reviewer: true,
        approver: true,
      },
    })

    expect(finalResult).toBeDefined()
    if (finalResult) {
      expect(finalResult.status).toBe('PUBLISHED')
      expect(finalResult.submittedBy).toBe(subjectTeacherUser.id)
      expect(finalResult.reviewedBy).toBe(classTeacherUser.id)
      expect(finalResult.approvedBy).toBe(principalUser.id)
    }
  })
})

