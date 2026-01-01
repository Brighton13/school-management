import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

/**
 * GET - Get exam submission status for tracking
 * Returns the status of result submissions for each exam/section
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")
    const sectionId = searchParams.get("sectionId")
    const status = searchParams.get("status")

    let whereClause: any = {}

    // Apply filters
    if (examId) whereClause.examId = examId
    if (sectionId) whereClause.sectionId = sectionId
    if (status) whereClause.status = status

    // For class teachers, only show their sections
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          sections: { select: { id: true } },
        },
      })

      if (!staff || staff.sections.length === 0) {
        return NextResponse.json([])
      }

      whereClause.sectionId = { in: staff.sections.map(s => s.id) }
    }

    const submissions = await prisma.examResultSubmission.findMany({
      where: whereClause,
      include: {
        exam: {
          include: {
            term: true,
            academicYear: true,
          },
        },
        section: {
          include: {
            class: true,
            classTeacher: {
              include: { user: true },
            },
          },
        },
        subjectSubmissions: {
          include: {
            classSubject: {
              include: {
                subject: true,
                teacher: {
                  include: { user: true },
                },
              },
            },
            submitter: true,
          },
        },
        classTeacherReviewer: true,
        principalApprover: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(submissions)
  } catch (error) {
    console.error("Error fetching exam submissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch exam submissions" },
      { status: 500 }
    )
  }
}

/**
 * POST - Initialize or update exam submission tracking for a section
 * Called when results are first entered for an exam/section combination
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { examId, sectionId, academicYearId, termId } = body

    if (!examId || !sectionId || !academicYearId || !termId) {
      return NextResponse.json(
        { error: "Missing required fields: examId, sectionId, academicYearId, termId" },
        { status: 400 }
      )
    }

    // Check if submission tracking already exists
    const existingSubmission = await prisma.examResultSubmission.findUnique({
      where: {
        examId_sectionId: { examId, sectionId },
      },
    })

    if (existingSubmission) {
      // Recalculate subject submissions
      const updatedSubmission = await updateSubmissionProgress(examId, sectionId)
      return NextResponse.json(updatedSubmission)
    }

    // Get all core subjects for this section
    const coreSubjects = await prisma.classSubject.findMany({
      where: {
        sectionId,
        subject: { type: "CORE" },
      },
    })

    // Get total students in this section
    const enrollmentCount = await prisma.classEnrollment.count({
      where: {
        sectionId,
        academicYearId,
        status: "ACTIVE",
      },
    })

    // Create new submission tracking
    const newSubmission = await prisma.examResultSubmission.create({
      data: {
        examId,
        sectionId,
        academicYearId,
        termId,
        totalSubjects: coreSubjects.length,
        submittedSubjects: 0,
        totalStudents: enrollmentCount,
        status: "PENDING_SUBJECTS",
        subjectSubmissions: {
          create: coreSubjects.map(cs => ({
            classSubjectId: cs.id,
            totalStudents: enrollmentCount,
            resultsEntered: 0,
            isComplete: false,
          })),
        },
      },
      include: {
        exam: true,
        section: {
          include: { class: true },
        },
        subjectSubmissions: {
          include: {
            classSubject: {
              include: { subject: true },
            },
          },
        },
      },
    })

    await logAuditTrail(
      session.user.id,
      "CREATE",
      "ExamResultSubmission",
      request,
      {
        entityId: newSubmission.id,
        description: `Initialized exam submission tracking for ${newSubmission.section.class.name} ${newSubmission.section.name}`,
      }
    )

    return NextResponse.json(newSubmission, { status: 201 })
  } catch (error) {
    console.error("Error creating exam submission:", error)
    return NextResponse.json(
      { error: "Failed to create exam submission tracking" },
      { status: 500 }
    )
  }
}

/**
 * Helper function to update submission progress
 */
async function updateSubmissionProgress(examId: string, sectionId: string) {
  const submission = await prisma.examResultSubmission.findUnique({
    where: { examId_sectionId: { examId, sectionId } },
    include: {
      subjectSubmissions: {
        include: {
          classSubject: true,
        },
      },
    },
  })

  if (!submission) return null

  // Count results for each subject
  for (const subjectSub of submission.subjectSubmissions) {
    const resultCount = await prisma.result.count({
      where: {
        examId,
        classSubjectId: subjectSub.classSubjectId,
      },
    })

    const isComplete = resultCount >= subjectSub.totalStudents

    await prisma.examSubjectSubmission.update({
      where: { id: subjectSub.id },
      data: {
        resultsEntered: resultCount,
        isComplete,
      },
    })
  }

  // Update overall submission stats
  const completedSubjects = await prisma.examSubjectSubmission.count({
    where: {
      examResultSubmissionId: submission.id,
      isComplete: true,
    },
  })

  // Calculate aggregate stats
  const results = await prisma.result.findMany({
    where: {
      examId,
      classSubject: { sectionId },
    },
    select: {
      marksObtained: true,
      maxMarks: true,
      classSubject: {
        select: { passMarks: true },
      },
    },
  })

  let totalMarks = 0
  let maxMarks = 0
  let passCount = 0

  results.forEach(r => {
    totalMarks += r.marksObtained
    maxMarks += r.maxMarks
    const passMarks = r.classSubject.passMarks || (r.maxMarks * 0.4)
    if (r.marksObtained >= passMarks) passCount++
  })

  const avgMarks = results.length > 0 ? totalMarks / results.length : 0
  const passRate = results.length > 0 ? (passCount / results.length) * 100 : 0

  const marksList = results.map(r => r.marksObtained)
  const highestMarks = marksList.length > 0 ? Math.max(...marksList) : 0
  const lowestMarks = marksList.length > 0 ? Math.min(...marksList) : 0

  return await prisma.examResultSubmission.update({
    where: { id: submission.id },
    data: {
      submittedSubjects: completedSubjects,
      averageMarks: avgMarks,
      highestMarks,
      lowestMarks,
      passRate,
      status: completedSubjects >= submission.totalSubjects ? "PENDING_CLASS_TEACHER" : "PENDING_SUBJECTS",
    },
    include: {
      exam: {
        include: { term: true, academicYear: true },
      },
      section: {
        include: {
          class: true,
          classTeacher: { include: { user: true } },
        },
      },
      subjectSubmissions: {
        include: {
          classSubject: {
            include: {
              subject: true,
              teacher: { include: { user: true } },
            },
          },
        },
      },
    },
  })
}
