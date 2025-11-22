import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * Complete End-to-End Integration Test
 * Tests the full workflow from admin setup to result publication
 */
describe('Complete Integration Workflow Test', () => {
  let adminUser: any
  let principalUser: any
  let classTeacherUser: any
  let classTeacherStaff: any
  let subjectTeacherUser: any
  let subjectTeacherStaff: any
  let student1: any
  let student2: any
  let term: any
  let class1: any
  let section: any
  let mathSubject: any
  let englishSubject: any
  let mathClassSubject: any
  let englishClassSubject: any
  let exam: any

  beforeAll(async () => {
    // Step 1: Admin creates users
    const adminPassword = await bcrypt.hash('admin123', 10)
    adminUser = await prisma.user.create({
      data: {
        email: 'integration-admin@school.com',
        password: adminPassword,
        name: 'Integration Admin',
        role: 'ADMIN',
        isActive: true,
        staff: {
          create: {
            employeeId: 'INT-ADMIN-001',
            designation: 'ADMIN',
            status: 'ACTIVE',
          },
        },
      },
    })

    const principalPassword = await bcrypt.hash('principal123', 10)
    principalUser = await prisma.user.create({
      data: {
        email: 'integration-principal@school.com',
        password: principalPassword,
        name: 'Integration Principal',
        role: 'PRINCIPAL',
        isActive: true,
        staff: {
          create: {
            employeeId: 'INT-PRINCIPAL-001',
            designation: 'PRINCIPAL',
            status: 'ACTIVE',
          },
        },
      },
    })

    const classTeacherPassword = await bcrypt.hash('teacher123', 10)
    classTeacherUser = await prisma.user.create({
      data: {
        email: 'integration-classteacher@school.com',
        password: classTeacherPassword,
        name: 'Integration Class Teacher',
        role: 'TEACHER',
        isActive: true,
        staff: {
          create: {
            employeeId: 'INT-CLASS-TEACHER-001',
            designation: 'TEACHER',
            status: 'ACTIVE',
          },
        },
      },
    })

    classTeacherStaff = await prisma.staff.findUnique({
      where: { userId: classTeacherUser.id },
    })

    const subjectTeacherPassword = await bcrypt.hash('teacher123', 10)
    subjectTeacherUser = await prisma.user.create({
      data: {
        email: 'integration-subjectteacher@school.com',
        password: subjectTeacherPassword,
        name: 'Integration Subject Teacher',
        role: 'TEACHER',
        isActive: true,
        staff: {
          create: {
            employeeId: 'INT-SUBJECT-TEACHER-001',
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

    // Step 2: Admin creates academic term
    term = await prisma.academicTerm.create({
      data: {
        name: 'Integration Test Term',
        academicYear: '2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2024-12-20'),
        isCurrent: true,
      },
    })

    // Step 3: Admin creates class
    class1 = await prisma.class.create({
      data: {
        name: 'Integration Grade 9',
        level: 9,
        capacity: 30,
      },
    })

    // Step 4: Admin creates section and assigns class teacher
    section = await prisma.section.create({
      data: {
        name: 'A',
        classId: class1.id,
        capacity: 30,
        classTeacherId: classTeacherStaff!.id,
      },
    })

    // Step 5: Admin creates subjects
    mathSubject = await prisma.subject.create({
      data: {
        name: 'Integration Mathematics',
        code: 'INT-MATH',
        type: 'CORE',
      },
    })

    englishSubject = await prisma.subject.create({
      data: {
        name: 'Integration English',
        code: 'INT-ENG',
        type: 'CORE',
      },
    })

    // Step 6: Admin assigns teachers to class-subjects
    mathClassSubject = await prisma.classSubject.create({
      data: {
        classId: class1.id,
        subjectId: mathSubject.id,
        teacherId: subjectTeacherStaff!.id,
        maxMarks: 100,
        passMarks: 40,
      },
    })

    englishClassSubject = await prisma.classSubject.create({
      data: {
        classId: class1.id,
        subjectId: englishSubject.id,
        teacherId: subjectTeacherStaff!.id,
        maxMarks: 100,
        passMarks: 40,
      },
    })

    // Step 7: Admin creates exam
    exam = await prisma.exam.create({
      data: {
        name: 'Integration Mid Term Exam',
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

    // Step 8: Admin enrolls students
    const student1User = await prisma.user.create({
      data: {
        email: 'integration-student1@school.com',
        password: await bcrypt.hash('student123', 10),
        name: 'Integration Student 1',
        role: 'STUDENT',
        isActive: true,
      },
    })

    student1 = await prisma.student.create({
      data: {
        admissionNumber: 'INT-001',
        userId: student1User.id,
        dateOfBirth: new Date('2010-01-01'),
        gender: 'MALE',
        status: 'ACTIVE',
      },
    })

    const student2User = await prisma.user.create({
      data: {
        email: 'integration-student2@school.com',
        password: await bcrypt.hash('student123', 10),
        name: 'Integration Student 2',
        role: 'STUDENT',
        isActive: true,
      },
    })

    student2 = await prisma.student.create({
      data: {
        admissionNumber: 'INT-002',
        userId: student2User.id,
        dateOfBirth: new Date('2010-02-01'),
        gender: 'FEMALE',
        status: 'ACTIVE',
      },
    })

    await prisma.classEnrollment.createMany({
      data: [
        {
          studentId: student1.id,
          classId: class1.id,
          sectionId: section.id,
          academicYear: '2024-2025',
          term: 'First Term',
          status: 'ACTIVE',
        },
        {
          studentId: student2.id,
          classId: class1.id,
          sectionId: section.id,
          academicYear: '2024-2025',
          term: 'First Term',
          status: 'ACTIVE',
        },
      ],
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.result.deleteMany()
    await prisma.classEnrollment.deleteMany()
    await prisma.exam.deleteMany()
    await prisma.classSubject.deleteMany()
    await prisma.section.deleteMany()
    await prisma.class.deleteMany()
    await prisma.subject.deleteMany()
    await prisma.student.deleteMany()
    await prisma.academicTerm.deleteMany()
    await prisma.staff.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  test('Complete Workflow: Admin → Teacher → Class Teacher → Principal', async () => {
    // Step 9: Subject teacher enters results
    const result1 = await prisma.result.create({
      data: {
        studentId: student1.id,
        classSubjectId: mathClassSubject.id,
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

    const result2 = await prisma.result.create({
      data: {
        studentId: student1.id,
        classSubjectId: englishClassSubject.id,
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

    const result3 = await prisma.result.create({
      data: {
        studentId: student2.id,
        classSubjectId: mathClassSubject.id,
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

    const result4 = await prisma.result.create({
      data: {
        studentId: student2.id,
        classSubjectId: englishClassSubject.id,
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

    // Verify results are pending class teacher review
    expect(result1.status).toBe('PENDING_CLASS_TEACHER')
    expect(result2.status).toBe('PENDING_CLASS_TEACHER')
    expect(result3.status).toBe('PENDING_CLASS_TEACHER')
    expect(result4.status).toBe('PENDING_CLASS_TEACHER')

    // Step 10: Class teacher reviews and submits all results
    const enrollments = await prisma.classEnrollment.findMany({
      where: { sectionId: section.id },
    })

    const studentIds = enrollments.map((e) => e.studentId)

    const pendingResults = await prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        status: 'PENDING_CLASS_TEACHER',
      },
    })

    expect(pendingResults.length).toBe(4)

    // Update each result individually to ensure proper update
    for (const result of pendingResults) {
      await prisma.result.update({
        where: { id: result.id },
        data: {
          status: 'PENDING_APPROVAL',
          reviewedBy: classTeacherUser.id,
          reviewedAt: new Date(),
        },
      })
    }

    // Verify all results are pending approval
    const updatedResults = await prisma.result.findMany({
      where: {
        id: { in: [result1.id, result2.id, result3.id, result4.id] },
      },
    })

    expect(updatedResults.length).toBe(4)
    updatedResults.forEach((result) => {
      expect(result.status).toBe('PENDING_APPROVAL')
      expect(result.reviewedBy).toBe(classTeacherUser.id)
    })

    // Step 11: Principal approves all results
    await prisma.result.updateMany({
      where: {
        id: { in: [result1.id, result2.id, result3.id, result4.id] },
      },
      data: {
        status: 'APPROVED',
        approvedBy: principalUser.id,
        approvedAt: new Date(),
      },
    })

    // Step 12: Principal publishes results
    await prisma.result.updateMany({
      where: {
        id: { in: [result1.id, result2.id, result3.id, result4.id] },
      },
      data: {
        status: 'PUBLISHED',
        published: true,
        publishedAt: new Date(),
      },
    })

    // Verify final state
    const finalResults = await prisma.result.findMany({
      where: {
        id: { in: [result1.id, result2.id, result3.id, result4.id] },
      },
      include: {
        submitter: true,
        reviewer: true,
        approver: true,
      },
    })

    finalResults.forEach((result) => {
      expect(result.status).toBe('PUBLISHED')
      expect(result.published).toBe(true)
      expect(result.submittedBy).toBe(subjectTeacherUser.id)
      expect(result.reviewedBy).toBe(classTeacherUser.id)
      expect(result.approvedBy).toBe(principalUser.id)
    })

    console.log('\n✅ Complete workflow test passed!')
    console.log(`   - ${finalResults.length} results successfully published`)
    console.log('   - Workflow: Teacher → Class Teacher → Principal → Published')
  })
})

