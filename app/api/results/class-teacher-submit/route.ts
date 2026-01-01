import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

/**
 * POST - Class teacher submits all results for their section to principal
 * Requirements:
 * - All subjects must have complete results (all students)
 * - Only class teacher can submit
 * - Updates all results status to PENDING_APPROVAL
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { examId, sectionId, comments } = body

    if (!examId || !sectionId) {
      return NextResponse.json(
        { error: "Missing required fields: examId, sectionId" },
        { status: 400 }
      )
    }

    // Verify user is class teacher for this section
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        sections: {
          where: { id: sectionId },
        },
      },
    })

    if (!staff || staff.sections.length === 0) {
      return NextResponse.json(
        { error: "You are not the class teacher for this section" },
        { status: 403 }
      )
    }

    // Get the submission tracking record
    const submission = await prisma.examResultSubmission.findUnique({
      where: {
        examId_sectionId: { examId, sectionId },
      },
      include: {
        subjectSubmissions: true,
        section: {
          include: { class: true },
        },
        exam: true,
      },
    })

    if (!submission) {
      return NextResponse.json(
        { error: "No submission tracking found for this exam and section" },
        { status: 404 }
      )
    }

    // Check if all subjects are complete
    const incompleteSubjects = submission.subjectSubmissions.filter(s => !s.isComplete)
    if (incompleteSubjects.length > 0) {
      return NextResponse.json(
        {
          error: "Not all subjects have complete results",
          incompleteCount: incompleteSubjects.length,
          totalSubjects: submission.totalSubjects,
        },
        { status: 400 }
      )
    }

    // Check if already submitted
    if (submission.status !== "PENDING_SUBJECTS" && submission.status !== "PENDING_CLASS_TEACHER") {
      return NextResponse.json(
        { error: `Results already ${submission.status.toLowerCase().replace("_", " ")}` },
        { status: 400 }
      )
    }

    // Get all results for this exam/section with PENDING_CLASS_TEACHER status
    const results = await prisma.result.findMany({
      where: {
        examId,
        classSubject: { sectionId },
        status: { in: ["PENDING_CLASS_TEACHER", "DRAFT"] },
      },
    })

    if (results.length === 0) {
      return NextResponse.json(
        { error: "No results found to submit" },
        { status: 400 }
      )
    }

    // Update all results to PENDING_APPROVAL
    await prisma.result.updateMany({
      where: {
        id: { in: results.map(r => r.id) },
      },
      data: {
        status: "PENDING_APPROVAL",
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
    })

    // Update the submission tracking
    const updatedSubmission = await prisma.examResultSubmission.update({
      where: { id: submission.id },
      data: {
        status: "PENDING_PRINCIPAL",
        classTeacherReviewedBy: session.user.id,
        classTeacherReviewedAt: new Date(),
        classTeacherComments: comments,
      },
      include: {
        exam: { include: { term: true, academicYear: true } },
        section: {
          include: {
            class: true,
            classTeacher: { include: { user: true } },
          },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "ExamResultSubmission",
      request,
      {
        entityId: submission.id,
        description: `Class teacher submitted ${results.length} results for ${submission.section.class.name} ${submission.section.name} - ${submission.exam.name}`,
        metadata: { resultsCount: results.length },
      }
    )

    // Notify principal
    const principal = await prisma.staff.findFirst({
      where: { designation: "PRINCIPAL" },
    })

    if (principal) {
      await createNotification({
        userId: principal.userId,
        title: "Results Submitted for Approval",
        message: `${submission.section.class.name} ${submission.section.name} results for ${submission.exam.name} are ready for approval`,
        type: "INFO",
        category: "RESULT",
        link: `/dashboard/principal-approvals`,
        metadata: {
          examId,
          sectionId,
          submissionId: submission.id,
        },
      })
    }

    return NextResponse.json({
      message: `Successfully submitted ${results.length} results for principal approval`,
      submission: updatedSubmission,
    })
  } catch (error) {
    console.error("Error submitting class results:", error)
    return NextResponse.json(
      { error: "Failed to submit class results" },
      { status: 500 }
    )
  }
}
