import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"
import { createNotification } from "@/lib/notifications"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.RESULTS_REVIEW)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { approved, submitToPrincipal } = body

    const existingResult = await prisma.result.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: {
            classEnrollment: {
              include: {
                section: {
                  include: {
                    classTeacher: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!existingResult) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 })
    }

    // Verify the teacher is the class teacher
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
    })

    const studentEnrollment = await prisma.classEnrollment.findFirst({
      where: { studentId: existingResult.studentId },
      include: {
        section: {
          include: {
            classTeacher: true,
          },
        },
      },
    })

    if (!studentEnrollment?.section?.classTeacher || 
        studentEnrollment.section.classTeacher.id !== staff?.id) {
      return NextResponse.json(
        { error: "You are not the class teacher for this student" },
        { status: 403 }
      )
    }

    if (existingResult.status !== "PENDING_CLASS_TEACHER") {
      return NextResponse.json(
        { error: "Result is not pending class teacher review" },
        { status: 400 }
      )
    }

    const updatedResult = await prisma.result.update({
      where: { id: params.id },
      data: {
        status: approved
          ? submitToPrincipal
            ? "PENDING_APPROVAL"
            : "APPROVED"
          : "REJECTED",
        reviewedBy: approved ? session.user.id : null,
        reviewedAt: approved ? new Date() : null,
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
        exam: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      approved ? (submitToPrincipal ? "REVIEW" : "APPROVE") : "REJECT",
      "Result",
      request,
      {
        entityId: params.id,
        description: `Class teacher ${approved ? (submitToPrincipal ? "reviewed and submitted" : "approved") : "rejected"} result for ${updatedResult.student.user.name} - ${updatedResult.classSubject.subject.name}`,
      }
    )

    // Notify subject teacher about the review decision
    if (updatedResult.classSubject.teacher?.user) {
      if (approved) {
        await createNotification({
          userId: updatedResult.classSubject.teacher.user.id,
          title: submitToPrincipal ? "Result Submitted to Principal" : "Result Approved",
          message: `Class teacher has ${submitToPrincipal ? "submitted" : "approved"} the result for ${updatedResult.student.user.name} in ${updatedResult.classSubject.subject.name}.`,
          type: "SUCCESS",
          category: "RESULT",
          link: "/dashboard/results",
        })
      } else {
        await createNotification({
          userId: updatedResult.classSubject.teacher.user.id,
          title: "Result Rejected",
          message: `Class teacher has rejected the result for ${updatedResult.student.user.name} in ${updatedResult.classSubject.subject.name}. Please review and resubmit.`,
          type: "WARNING",
          category: "RESULT",
          link: "/dashboard/results",
        })
      }
    }

    // Notify principal when submitted for approval
    if (approved && submitToPrincipal) {
      const principal = await prisma.staff.findFirst({
        where: { designation: "PRINCIPAL" },
      })

      if (principal) {
        await createNotification({
          userId: principal.userId,
          title: "Result Pending Approval",
          message: `A result for ${updatedResult.student.user.name} in ${updatedResult.classSubject.subject.name} is pending your approval.`,
          type: "INFO",
          category: "RESULT",
          link: "/dashboard/principal-approvals",
        })
      }
    }

    return NextResponse.json(updatedResult)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process review" },
      { status: 500 }
    )
  }
}

