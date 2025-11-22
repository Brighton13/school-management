import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

describe('Class Teacher Workflow Tests', () => {
  let adminUser: any
  let classTeacherUser: any
  let classTeacherStaff: any
  let subjectTeacherUser: any
  let subjectTeacherStaff: any
  let student1: any
  let student2: any
  let term: any
  let class1: any
  let section: any
  let subject1: any
  let subject2: any
  let classSubject1: any
  let classSubject2: any
  let exam: any

  beforeAll(async () => {
    // Setup: Create admin, class teacher, subject teacher, students
    const adminPassword = await bcrypt.hash('testadmin123', 10)
    adminUser = await prisma.user.create({
      data: {
        email: 'testadmin3@school.com',
        password: adminPassword,
        name: 'Test Admin 3',
        role: 'ADMIN',
        isActive: true,
        staff: {
          create: {
            employeeId: 'TEST-ADMIN-003',
            designation: 'ADMIN',
            status: 'ACTIVE',
          },
        },
      },
    })

    // Class teacher
    const timestamp = Date.now()
    const classTeacherPassword = await bcrypt.hash('testclassteacher123', 10)
    classTeacherUser = await prisma.user.create({
      data: {
        email: `testclassteacher-${timestamp}@school.com`,
        password: classTeacherPassword,
        name: 'Test Class Teacher',
        role: 'TEACHER',
        isActive: true,
        staff: {
          create: {
            employeeId: `TEST-CLASS-TEACHER-001-${timestamp}`,
            designation: 'TEACHER',
            department: 'General',
            status: 'ACTIVE',
          },
        },
      },
    })

    classTeacherStaff = await prisma.staff.findUnique({
      where: { userId: classTeacherUser.id },
    })

    // Subject teacher
    const subjectTeacherPassword = await bcrypt.hash('testsubjectteacher123', 10)
    subjectTeacherUser = await prisma.user.create({
      data: {
        email: `testsubjectteacher-${timestamp}@school.com`,
        password: subjectTeacherPassword,
        name: 'Test Subject Teacher',
        role: 'TEACHER',
        isActive: true,
        staff: {
          create: {
            employeeId: `TEST-SUBJECT-TEACHER-001-${timestamp}`,
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

    // Students - use unique emails and admission numbers
    const timestamp = Date.now()
    const student1User = await prisma.user.create({
      data: {
        email: `teststudent1-${timestamp}@school.com`,
        password: await bcrypt.hash('test123', 10),
        name: 'Test Student 1',
        role: 'STUDENT',
        isActive: true,
      },
    })

    student1 = await prisma.student.create({
      data: {
        admissionNumber: `TEST-002-${timestamp}`,
        userId: student1User.id,
        dateOfBirth: new Date('2010-01-01'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    })

    const student2User = await prisma.user.create({
      data: {
        email: `teststudent2-${timestamp}@school.com`,
        password: await bcrypt.hash('test123', 10),
        name: 'Test Student 2',
        role: 'STUDENT',
        isActive: true,
      },
    })

    student2 = await prisma.student.create({
      data: {
        admissionNumber: `TEST-003-${timestamp}`,
        userId: student2User.id,
        dateOfBirth: new Date('2010-02-01'),
        gender: 'FEMALE',
        status: 'ACTIVE',
      },
    })

    term = await prisma.academicTerm.create({
      data: {
        name: 'Test Term 3',
        academicYear: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2024-12-20'),
        isCurrent: true,
      },
    })

    class1 = await prisma.class.create({
      data: {
        name: 'Test Grade 7',
        level: 7,
        capacity: 30,
      },
    })

    if (!classTeacherStaff) {
      throw new Error('Class teacher staff not found')
    }

    section = await prisma.section.create({
      data: {
        name: 'A',
        classId: class1.id,
        capacity: 30,
        classTeacherId: classTeacherStaff.id,
      },
    })

    subject1 = await prisma.subject.create({
      data: {
        name: 'Test Math',
        code: 'TEST-MATH-3',
        type: 'CORE',
      },
    })

    subject2 = await prisma.subject.create({
      data: {
        name: 'Test English',
        code: 'TEST-ENG-3',
        type: 'CORE',
      },
    })

    classSubject1 = await prisma.classSubject.create({
      data: {
        classId: class1.id,
        subjectId: subject1.id,
        teacherId: subjectTeacherStaff!.id,
        maxMarks: 100,
        passMarks: 40,
      },
    })

    classSubject2 = await prisma.classSubject.create({
      data: {
        classId: class1.id,
        subjectId: subject2.id,
        teacherId: subjectTeacherStaff!.id,
        maxMarks: 100,
        passMarks: 40,
      },
    })

    exam = await prisma.exam.create({
      data: {
        name: 'Test Exam 3',
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

    // Enroll students - check if already exists first
    let enrollment1 = await prisma.classEnrollment.findFirst({
      where: {
        studentId: student1.id,
        classId: class1.id,
        sectionId: section.id,
        academicYear: '2024-2025',
        term: 'First Term',
      },
    })

    if (!enrollment1) {
      enrollment1 = await prisma.classEnrollment.create({
        data: {
          studentId: student1.id,
          classId: class1.id,
          sectionId: section.id,
          academicYear: '2024-2025',
          term: 'First Term',
          status: 'ACTIVE',
        },
      })
    }

    let enrollment2 = await prisma.classEnrollment.findFirst({
      where: {
        studentId: student2.id,
        classId: class1.id,
        sectionId: section.id,
        academicYear: '2024-2025',
        term: 'First Term',
      },
    })

    if (!enrollment2) {
      enrollment2 = await prisma.classEnrollment.create({
        data: {
          studentId: student2.id,
          classId: class1.id,
          sectionId: section.id,
          academicYear: '2024-2025',
          term: 'First Term',
          status: 'ACTIVE',
        },
      })
    }

    // Verify enrollments were created
    expect(enrollment1).toBeDefined()
    expect(enrollment2).toBeDefined()

    // Subject teacher enters results (create individually to handle potential errors)
    await prisma.result.create({
      data: {
        studentId: student1.id,
        classSubjectId: classSubject1.id,
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

    await prisma.result.create({
      data: {
        studentId: student1.id,
        classSubjectId: classSubject2.id,
        academicTermId: term.id,
        examId: exam.id,
        marksObtained: 90,
        maxMarks: 100,
        grade: 'A',
        status: 'PENDING_CLASS_TEACHER',
        submittedBy: subjectTeacherUser.id,
        submittedAt: new Date(),
      },
    })

    await prisma.result.create({
      data: {
        studentId: student2.id,
        classSubjectId: classSubject1.id,
        academicTermId: term.id,
        examId: exam.id,
        marksObtained: 75,
        maxMarks: 100,
        grade: 'B',
        status: 'PENDING_CLASS_TEACHER',
        submittedBy: subjectTeacherUser.id,
        submittedAt: new Date(),
      },
    })

    await prisma.result.create({
      data: {
        studentId: student2.id,
        classSubjectId: classSubject2.id,
        academicTermId: term.id,
        examId: exam.id,
        marksObtained: 80,
        maxMarks: 100,
        grade: 'B',
        status: 'PENDING_CLASS_TEACHER',
        submittedBy: subjectTeacherUser.id,
        submittedAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    await prisma.result.deleteMany()
    await prisma.classEnrollment.deleteMany()
    await prisma.exam.deleteMany()
    await prisma.classSubject.deleteMany()
    await prisma.section.deleteMany()
    await prisma.class.deleteMany()
    await prisma.subject.deleteMany()
    
    // Delete students and their users
    if (student1) {
      await prisma.student.deleteMany({ where: { id: student1.id } })
    }
    if (student2) {
      await prisma.student.deleteMany({ where: { id: student2.id } })
    }
    
    await prisma.academicTerm.deleteMany()
    
    // Delete staff and users
    const userIds = [adminUser?.id, classTeacherUser?.id, subjectTeacherUser?.id].filter(Boolean)
    if (userIds.length > 0) {
      await prisma.staff.deleteMany({
        where: { userId: { in: userIds } },
      })
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      })
    }
    
    // Clean up student users
    const studentUserIds = []
    if (student1) {
      const s1 = await prisma.student.findUnique({ where: { id: student1.id }, select: { userId: true } })
      if (s1) studentUserIds.push(s1.userId)
    }
    if (student2) {
      const s2 = await prisma.student.findUnique({ where: { id: student2.id }, select: { userId: true } })
      if (s2) studentUserIds.push(s2.userId)
    }
    if (studentUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: studentUserIds } } })
    }
    
    await prisma.$disconnect()
  })

  test('1. Class teacher can view all results for their class', async () => {
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        sectionId: section.id,
      },
    })

    const studentIds = enrollments.map((e) => e.studentId)

    const results = await prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'PENDING_CLASS_TEACHER',
      },
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBe(4) // 2 students × 2 subjects
  })

  test('2. Class teacher can submit all class results for approval', async () => {
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        sectionId: section.id,
      },
    })

    const studentIds = enrollments.map((e) => e.studentId)

    const pendingResults = await prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'PENDING_CLASS_TEACHER',
      },
    })

    // Update all to pending approval
    const updated = await prisma.result.updateMany({
      where: {
        id: { in: pendingResults.map((r) => r.id) },
      },
      data: {
        status: 'PENDING_APPROVAL',
        reviewedBy: classTeacherUser.id,
        reviewedAt: new Date(),
      },
    })

    expect(updated.count).toBe(4)

    // Verify status changed
    const updatedResults = await prisma.result.findMany({
      where: {
        id: { in: pendingResults.map((r) => r.id) },
      },
    })

    updatedResults.forEach((result) => {
      expect(result.status).toBe('PENDING_APPROVAL')
      expect(result.reviewedBy).toBe(classTeacherUser.id)
    })
  })
})

