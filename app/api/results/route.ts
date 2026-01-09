import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createNotification, createBulkNotifications } from "@/lib/notifications"
import { requirePermission, Permissions, hasPermission } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse } from "@/lib/pagination"

// Default points configuration (fallback if no config in DB)
const defaultPointsConfig = [
  { minPercentage: 75, maxPercentage: 100, points: 1 },
  { minPercentage: 65, maxPercentage: 74.99, points: 2 },
  { minPercentage: 50, maxPercentage: 64.99, points: 3 },
  { minPercentage: 40, maxPercentage: 49.99, points: 4 },
  { minPercentage: 30, maxPercentage: 39.99, points: 5 },
  { minPercentage: 1, maxPercentage: 29.99, points: 6 },
  { minPercentage: 0, maxPercentage: 0.99, points: 7 },
]

// Helper function to calculate points based on percentage
async function calculatePoints(marksObtained: number, maxMarks: number): Promise<number> {
  if (maxMarks <= 0) return 7
  const percentage = Math.round((marksObtained / maxMarks) * 100)
  
  // Try to get points config from database
  const pointsConfig = await prisma.pointsConfig.findMany({
    where: { isActive: true },
    orderBy: { minPercentage: 'desc' },
  })
  
  const config = pointsConfig.length > 0 ? pointsConfig : defaultPointsConfig
  
  const matchingConfig = config.find(
    (pc) => percentage >= pc.minPercentage && percentage <= pc.maxPercentage
  )
  
  return matchingConfig?.points || 7
}

// Helper function to sync exam submission tracking
async function syncExamSubmissionTracking(
  examId: string,
  sectionId: string,
  classSubjectId: string,
  termId: string,
  academicYearId: string
) {
  try {
    // Get or create ExamResultSubmission for this exam/section
    let submission = await prisma.examResultSubmission.findUnique({
      where: {
        examId_sectionId: {
          examId,
          sectionId,
        },
      },
    })

    // Count total subjects for this section
    const totalSubjects = await prisma.classSubject.count({
      where: { sectionId },
    })

    // Count students in section
    const totalStudents = await prisma.classEnrollment.count({
      where: {
        sectionId,
        academicYearId,
        status: "ACTIVE",
      },
    })

    if (!submission) {
      // Create new submission tracking record
      submission = await prisma.examResultSubmission.create({
        data: {
          examId,
          sectionId,
          termId,
          academicYearId,
          totalSubjects,
          submittedSubjects: 0,
          totalStudents,
          status: "PENDING_SUBJECTS",
        },
      })
    }

    // Get or create ExamSubjectSubmission for this class subject
    let subjectSubmission = await prisma.examSubjectSubmission.findUnique({
      where: {
        examResultSubmissionId_classSubjectId: {
          examResultSubmissionId: submission.id,
          classSubjectId,
        },
      },
    })

    // Count results entered for this subject
    const resultsEntered = await prisma.result.count({
      where: {
        examId,
        classSubjectId,
      },
    })

    if (!subjectSubmission) {
      await prisma.examSubjectSubmission.create({
        data: {
          examResultSubmissionId: submission.id,
          classSubjectId,
          totalStudents,
          resultsEntered,
          isComplete: resultsEntered >= totalStudents,
        },
      })
    } else {
      await prisma.examSubjectSubmission.update({
        where: { id: subjectSubmission.id },
        data: {
          resultsEntered,
          isComplete: resultsEntered >= totalStudents,
        },
      })
    }

    // Update submission progress
    const completedSubjects = await prisma.examSubjectSubmission.count({
      where: {
        examResultSubmissionId: submission.id,
        isComplete: true,
      },
    })

    // Calculate averages and totals
    const allResults = await prisma.result.findMany({
      where: { examId, classSubject: { sectionId } },
      select: { marksObtained: true, maxMarks: true },
    })

    const totalMarks = allResults.reduce((sum, r) => sum + r.marksObtained, 0)
    const averageMarks = allResults.length > 0 ? totalMarks / allResults.length : 0
    const marksList = allResults.map(r => r.marksObtained)
    const highestMarks = marksList.length > 0 ? Math.max(...marksList) : 0
    const lowestMarks = marksList.length > 0 ? Math.min(...marksList) : 0

    await prisma.examResultSubmission.update({
      where: { id: submission.id },
      data: {
        submittedSubjects: completedSubjects,
        averageMarks: Math.round(averageMarks * 100) / 100,
        highestMarks,
        lowestMarks,
        status: completedSubjects >= totalSubjects ? "PENDING_CLASS_TEACHER" : "PENDING_SUBJECTS",
      },
    })
  } catch (error) {
    console.error("Error syncing exam submission tracking:", error)
    // Don't fail the main operation
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const termId = searchParams.get("termId")
    const academicYearId = searchParams.get("academicYearId")
    const status = searchParams.get("status")
    const examId = searchParams.get("examId")
    const classSubjectId = searchParams.get("classSubjectId")
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    // For teachers, only show results for their assigned subjects
    let teacherClassSubjectIds: string[] | undefined
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          classSubjects: {
            select: { id: true },
          },
        },
      })
      if (staff) {
        teacherClassSubjectIds = staff.classSubjects.map((cs: { id: any }) => cs.id)
      } else {
        // Teacher has no assignments, return empty
        return NextResponse.json(noPagination ? [] : createPaginatedResponse([], 0, page, limit))
      }
    }

    // Build where clause for filtering results
    const whereClause: any = {
      ...(studentId ? { studentId } : {}),
      ...(termId ? { termId } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(status ? { status } : {}),
      ...(examId ? { examId } : {}),
      ...(classSubjectId ? { classSubjectId } : {}),
      ...(teacherClassSubjectIds ? { classSubjectId: { in: teacherClassSubjectIds } } : {}),
    }

    // For teachers, show all their results that they can still edit (not yet approved by principal)
    // This includes: DRAFT, PENDING_CLASS_TEACHER, PENDING_APPROVAL, REJECTED
    if (session.user.role === "TEACHER" && !status) {
      whereClause.status = { in: ["DRAFT", "PENDING_CLASS_TEACHER", "PENDING_APPROVAL", "REJECTED"] }
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { student: { user: { name: { contains: search, mode: "insensitive" } } } },
        { student: { admissionNumber: { contains: search, mode: "insensitive" } } },
        { classSubject: { subject: { name: { contains: search, mode: "insensitive" } } } },
      ]
    }

    // Get total count
    const total = await prisma.result.count({ where: whereClause })

    const results = await prisma.result.findMany({
      where: whereClause,
      include: {
        student: {
          include: { user: true },
        },
        classSubject: {
          include: {
            subject: true,
            class: true,
            teacher: {
              include: { user: true },
            },
          },
        },
        term: true,
        academicYear: true,
      },
      orderBy: { createdAt: "desc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(results)
    }

    return NextResponse.json(createPaginatedResponse(results, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.RESULTS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      studentId,
      classSubjectId,
      termId,
      academicYearId,
      examId,
      marksObtained,
      maxMarks,
      grade,
      remarks,
    } = body

    // Get exam details if provided
    let exam = null
    if (examId) {
      exam = await prisma.exam.findUnique({
        where: { id: examId },
      })
      if (!exam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 404 })
      }
    }

    // For teachers, verify they are assigned to this class-subject
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          classSubjects: {
            where: { id: classSubjectId },
          },
        },
      })

      if (!staff || staff.classSubjects.length === 0) {
        return NextResponse.json(
          { error: "You are not assigned to this class-subject" },
          { status: 403 }
        )
      }
    }

    // Determine status based on role and exam settings
    let status = "DRAFT"
    let submittedBy = null
    let submittedAt = null
    let publishedValue = false
    let publishedAtValue = null

    // Check for duplicate result: same student, class-subject, term, and exam
    const existingResult = await prisma.result.findFirst({
      where: {
        studentId,
        classSubjectId,
        termId: termId,
        academicYearId,
        examId: examId || null,
      },
    })

    if (existingResult) {
      return NextResponse.json(
        {
          error: "A result already exists for this student, subject, term, and exam combination. Please update the existing result instead."
        },
        { status: 400 }
      )
    }

    // Check if user can directly approve results
    const canApprove = await hasPermission(session.user.id, Permissions.RESULTS_APPROVE)
    
    if (!canApprove) {
      // Check if student's section has a class teacher
      const studentEnrollment = await prisma.classEnrollment.findFirst({
        where: { studentId },
        include: {
          section: {
            include: {
              classTeacher: true,
            },
          },
        },
      })

      if (studentEnrollment?.section?.classTeacher) {
        // Submit to class teacher first (always)
        status = "PENDING_CLASS_TEACHER"
      } else {
        // No class teacher, submit directly to principal
        status = "PENDING_APPROVAL"
      }
      submittedBy = session.user.id
      submittedAt = new Date()
    } else {
      // Even users with approval permission must follow the workflow
      // All results go through class teacher -> principal approval
      const studentEnrollment = await prisma.classEnrollment.findFirst({
        where: { studentId },
        include: {
          section: {
            include: {
              classTeacher: true,
            },
          },
        },
      })

      if (studentEnrollment?.section?.classTeacher) {
        status = "PENDING_CLASS_TEACHER"
      } else {
        status = "PENDING_APPROVAL"
      }
      submittedBy = session.user.id
      submittedAt = new Date()
    }

    // Calculate points based on current configuration
    const points = await calculatePoints(parseFloat(marksObtained), parseFloat(maxMarks))

    const result = await prisma.result.create({
      data: {
        studentId,
        classSubjectId,
        termId,
        academicYearId,
        examId: examId || null,
        marksObtained: parseFloat(marksObtained),
        maxMarks: parseFloat(maxMarks),
        grade,
        points,
        remarks,
        status,
        submittedBy,
        submittedAt,
        published: publishedValue,
        publishedAt: publishedAtValue,
      },
      include: {
        student: {
          include: { user: true },
        },
        classSubject: {
          include: {
            subject: true,
            class: true,
            teacher: {
              include: { user: true },
            },
          },
        },
        term: true,
        academicYear: true,
      },
    })

    // Sync exam submission tracking if examId is provided
    if (examId) {
      // Get the section ID from the student's enrollment
      const enrollment = await prisma.classEnrollment.findFirst({
        where: {
          studentId,
          academicYearId,
          status: "ACTIVE",
        },
      })

      if (enrollment) {
        await syncExamSubmissionTracking(
          examId,
          enrollment.sectionId,
          classSubjectId,
          termId,
          academicYearId
        )
      }
    }

    // Notify the student about the new result
    await createNotification({
      userId: result.student.userId,
      title: "New Result Available",
      message: `Your result for ${result.classSubject.subject.name} has been recorded: ${result.marksObtained}/${result.maxMarks}`,
      type: "SUCCESS",
      category: "RESULT",
      link: `/dashboard/results`,
      metadata: { resultId: result.id },
    })

    // Notify class teacher if result is pending their review
    if (status === "PENDING_CLASS_TEACHER") {
      const studentEnrollment = await prisma.classEnrollment.findFirst({
        where: { studentId, academicYearId, status: "ACTIVE" },
        include: {
          section: {
            include: {
              classTeacher: {
                include: { user: true },
              },
            },
          },
        },
      })

      if (studentEnrollment?.section?.classTeacher?.user) {
        await createNotification({
          userId: studentEnrollment.section.classTeacher.user.id,
          title: "Result Submitted for Review",
          message: `${session.user.name} has submitted a result for ${result.student.user.name} in ${result.classSubject.subject.name}. Please review.`,
          type: "INFO",
          category: "RESULT",
          link: "/dashboard/class-results",
        })
      }
    }

    // Notify principal if result is pending their approval (no class teacher)
    if (status === "PENDING_APPROVAL") {
      const principal = await prisma.staff.findFirst({
        where: { designation: "PRINCIPAL" },
      })

      if (principal) {
        await createNotification({
          userId: principal.userId,
          title: "Result Pending Approval",
          message: `A result for ${result.student.user.name} in ${result.classSubject.subject.name} is pending your approval.`,
          type: "INFO",
          category: "RESULT",
          link: "/dashboard/principal-approvals",
        })
      }
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create result" },
      { status: 500 }
    )
  }
}

