import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createBulkNotifications, createNotification } from "@/lib/notifications"
import { requirePermission, Permissions } from "@/lib/permissions"

/**
 * GET - Get submissions pending principal approval
 * Only shows when ALL sections for an exam have submitted
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.RESULTS_APPROVE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")
    const status = searchParams.get("status") || "PENDING_PRINCIPAL"

    // Get all exams with their submission status
    const exams = await prisma.exam.findMany({
      where: {
        status: "ACTIVE",
        ...(examId ? { id: examId } : {}),
      },
      include: {
        term: { include: { academicYear: true } },
        academicYear: true,
        examResultSubmissions: {
          include: {
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
            classTeacherReviewer: true,
            principalApprover: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Calculate approval readiness for each exam
    const examStatuses = await Promise.all(
      exams.map(async (exam) => {
        // Get all sections that should have results for this exam
        const allSections = await prisma.section.findMany({
          where: {
            classSubjects: {
              some: {
                subject: { type: "CORE" },
              },
            },
          },
          include: {
            class: true,
            classTeacher: { include: { user: true } },
            enrollments: {
              where: {
                academicYearId: exam.academicYearId,
                status: "ACTIVE",
              },
            },
          },
        })

        // Only include sections that have students enrolled
        const sectionsWithStudents = allSections.filter(s => s.enrollments.length > 0)

        const submittedSections = exam.examResultSubmissions.filter(
          s => s.status === "PENDING_PRINCIPAL" || s.status === "APPROVED" || s.status === "PUBLISHED"
        )

        const pendingSections = exam.examResultSubmissions.filter(
          s => s.status === "PENDING_PRINCIPAL"
        )

        const approvedSections = exam.examResultSubmissions.filter(
          s => s.status === "APPROVED" || s.status === "PUBLISHED"
        )

        const allSectionsSubmitted = submittedSections.length >= sectionsWithStudents.length && sectionsWithStudents.length > 0
        const canApprove = pendingSections.length > 0 && allSectionsSubmitted

        return {
          exam: {
            id: exam.id,
            name: exam.name,
            examType: exam.examType,
            term: exam.term,
            academicYear: exam.academicYear,
          },
          totalSections: sectionsWithStudents.length,
          submittedSections: submittedSections.length,
          pendingSections: pendingSections.length,
          approvedSections: approvedSections.length,
          allSectionsSubmitted,
          canApprove,
          submissions: exam.examResultSubmissions.map(sub => ({
            id: sub.id,
            section: sub.section,
            status: sub.status,
            totalStudents: sub.totalStudents,
            totalSubjects: sub.totalSubjects,
            averageMarks: sub.averageMarks,
            highestMarks: sub.highestMarks,
            lowestMarks: sub.lowestMarks,
            passRate: sub.passRate,
            classTeacherReviewedAt: sub.classTeacherReviewedAt,
            classTeacherComments: sub.classTeacherComments,
            principalApprovedAt: sub.principalApprovedAt,
            subjectSubmissions: sub.subjectSubmissions,
          })),
        }
      })
    )

    // Filter based on status parameter
    let filteredExams = examStatuses
    if (status === "PENDING_PRINCIPAL") {
      filteredExams = examStatuses.filter(e => e.pendingSections > 0)
    } else if (status === "APPROVED") {
      filteredExams = examStatuses.filter(e => e.approvedSections > 0)
    }

    return NextResponse.json(filteredExams)
  } catch (error) {
    console.error("Error fetching pending approvals:", error)
    return NextResponse.json(
      { error: "Failed to fetch pending approvals" },
      { status: 500 }
    )
  }
}

/**
 * POST - Principal approves results for section(s)
 * Can approve individual sections or all sections for an exam at once
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.RESULTS_APPROVE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { examId, sectionIds, action, comments } = body

    if (!examId || !action) {
      return NextResponse.json(
        { error: "Missing required fields: examId, action" },
        { status: 400 }
      )
    }

    if (!["approve", "reject", "publish"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve', 'reject', or 'publish'" },
        { status: 400 }
      )
    }

    // Get submissions to process
    const whereClause: any = {
      examId,
      status: "PENDING_PRINCIPAL",
    }

    if (sectionIds && sectionIds.length > 0) {
      whereClause.sectionId = { in: sectionIds }
    }

    const submissions = await prisma.examResultSubmission.findMany({
      where: whereClause,
      include: {
        section: {
          include: { class: true, classTeacher: { include: { user: true } } },
        },
        exam: true,
      },
    })

    // If no submissions found, check if there are results pending approval directly
    // This handles cases where results were submitted without the full submission workflow
    if (submissions.length === 0) {
      // Find results with PENDING_APPROVAL status for this exam
      const pendingResults = await prisma.result.findMany({
        where: {
          examId,
          status: "PENDING_APPROVAL",
          ...(sectionIds && sectionIds.length > 0 
            ? { classSubject: { sectionId: { in: sectionIds } } } 
            : {}),
        },
        include: {
          classSubject: {
            include: {
              section: { include: { class: true } },
            },
          },
          exam: true,
        },
      })

      if (pendingResults.length === 0) {
        return NextResponse.json(
          { error: "No pending results found to process" },
          { status: 404 }
        )
      }

      // Process results directly (without submission records)
      const newStatus = action === "reject" ? "REJECTED" : action === "publish" ? "PUBLISHED" : "APPROVED"
      
      // Get unique section IDs from results
      const resultSectionIds = Array.from(new Set(pendingResults.map(r => r.classSubject.sectionId)))
      
      // Update all pending results
      const updateResult = await prisma.result.updateMany({
        where: {
          examId,
          status: "PENDING_APPROVAL",
          ...(sectionIds && sectionIds.length > 0 
            ? { classSubject: { sectionId: { in: sectionIds } } } 
            : {}),
        },
        data: {
          status: newStatus,
          approvedBy: session.user.id,
          approvedAt: new Date(),
          published: action === "publish",
          publishedAt: action === "publish" ? new Date() : null,
        },
      })

      // Check if all results for this exam are now approved/published - mark exam as completed
      const remainingPendingResults = await prisma.result.count({
        where: {
          examId,
          status: { in: ["DRAFT", "PENDING_CLASS_TEACHER", "PENDING_APPROVAL"] },
        },
      })

      if (remainingPendingResults === 0 && action !== "reject") {
        await prisma.exam.update({
          where: { id: examId },
          data: { status: "COMPLETED" },
        })
      }

      // Log audit trail
      await logAuditTrail(
        session.user.id,
        "RESULT_APPROVAL",
        "Result",
        request,
        {
          entityId: examId,
          description: `Principal ${action}d ${updateResult.count} result(s) directly`,
          metadata: {
            resultsUpdated: updateResult.count,
            sections: resultSectionIds,
            comments,
          },
        }
      )

      return NextResponse.json({
        message: `Successfully ${action === "reject" ? "rejected" : action === "publish" ? "approved and published" : "approved"} ${updateResult.count} result(s)`,
        processedCount: updateResult.count,
        sectionsProcessed: resultSectionIds.length,
      })
    }

    // Check if all sections have been submitted before allowing approval
    const allSubmissions = await prisma.examResultSubmission.findMany({
      where: { examId },
    })

    const pendingClassTeacherCount = allSubmissions.filter(
      s => s.status === "PENDING_SUBJECTS" || s.status === "PENDING_CLASS_TEACHER"
    ).length

    if (pendingClassTeacherCount > 0 && action !== "reject") {
      // Get sections that haven't submitted
      const allSections = await prisma.section.findMany({
        where: {
          classSubjects: {
            some: {
              subject: { type: "CORE" },
            },
          },
        },
        include: {
          class: true,
          enrollments: {
            where: {
              academicYearId: submissions[0].exam.academicYearId,
              status: "ACTIVE",
            },
          },
        },
      })

      const sectionsWithStudents = allSections.filter(s => s.enrollments.length > 0)
      const submittedSectionIds = allSubmissions
        .filter(s => s.status === "PENDING_PRINCIPAL" || s.status === "APPROVED")
        .map(s => s.sectionId)

      const missingSections = sectionsWithStudents.filter(
        s => !submittedSectionIds.includes(s.id)
      )

      if (missingSections.length > 0) {
        return NextResponse.json(
          {
            error: "Cannot approve until all sections have submitted results",
            missingSections: missingSections.map(s => ({
              id: s.id,
              name: `${s.class.name} ${s.name}`,
            })),
          },
          { status: 400 }
        )
      }
    }

    // Process each submission
    const newStatus = action === "reject" ? "PENDING_CLASS_TEACHER" : action === "publish" ? "PUBLISHED" : "APPROVED"
    const resultStatus = action === "reject" ? "REJECTED" : action === "publish" ? "PUBLISHED" : "APPROVED"

    const processedSubmissions = []
    const notificationTargets: { userId: string; sectionName: string }[] = []

    for (const submission of submissions) {
      // Update all results for this exam/section
      await prisma.result.updateMany({
        where: {
          examId,
          classSubject: { sectionId: submission.sectionId },
          status: "PENDING_APPROVAL",
        },
        data: {
          status: resultStatus,
          approvedBy: session.user.id,
          approvedAt: new Date(),
          published: action === "publish",
          publishedAt: action === "publish" ? new Date() : null,
        },
      })

      // Update submission tracking
      const updatedSubmission = await prisma.examResultSubmission.update({
        where: { id: submission.id },
        data: {
          status: newStatus,
          principalApprovedBy: session.user.id,
          principalApprovedAt: new Date(),
          principalComments: comments,
        },
      })

      processedSubmissions.push(updatedSubmission)

      // Collect class teacher for notification
      if (submission.section.classTeacher) {
        notificationTargets.push({
          userId: submission.section.classTeacher.userId,
          sectionName: `${submission.section.class.name} ${submission.section.name}`,
        })
      }
    }

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "ExamResultSubmission",
      request,
      {
        entityId: examId,
        description: `Principal ${action}d results for ${submissions.length} section(s) - ${submissions[0].exam.name}`,
        metadata: {
          examId,
          sectionIds: submissions.map(s => s.sectionId),
          action,
        },
      }
    )

    // Check if all sections are now approved/published - if so, mark exam as COMPLETED
    if (action === "approve" || action === "publish") {
      const remainingPending = await prisma.examResultSubmission.count({
        where: {
          examId,
          status: { in: ["PENDING_SUBJECTS", "PENDING_CLASS_TEACHER", "PENDING_PRINCIPAL"] },
        },
      })

      if (remainingPending === 0) {
        // All sections approved - mark exam as completed
        await prisma.exam.update({
          where: { id: examId },
          data: { status: "COMPLETED" },
        })

        await logAuditTrail(
          session.user.id,
          "UPDATE",
          "Exam",
          request,
          {
            entityId: examId,
            description: `Exam marked as COMPLETED - all sections approved`,
          }
        )
      }
    }

    // Send notifications to class teachers
    const actionText = action === "approve" ? "approved" : action === "reject" ? "rejected" : "published"
    for (const target of notificationTargets) {
      await createNotification({
        userId: target.userId,
        title: `Results ${actionText.charAt(0).toUpperCase() + actionText.slice(1)}`,
        message: `Results for ${target.sectionName} have been ${actionText} by the principal`,
        type: action === "reject" ? "WARNING" : "SUCCESS",
        category: "RESULT",
        link: action === "approve" || action === "publish" 
          ? `/dashboard/reports/generate` 
          : `/dashboard/class-teacher-review`,
      })
    }

    return NextResponse.json({
      message: `Successfully ${actionText} results for ${submissions.length} section(s)`,
      processedCount: submissions.length,
    })
  } catch (error) {
    console.error("Error processing approval:", error)
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    )
  }
}
