import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.RESULTS_APPROVE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { approved, published } = body

    const existingResult = await prisma.result.findUnique({
      where: { id: params.id },
    })

    if (!existingResult) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 })
    }

    if (existingResult.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        { error: "Result is not pending approval" },
        { status: 400 }
      )
    }

    const updatedResult = await prisma.result.update({
      where: { id: params.id },
      data: {
        status: approved ? (published ? "PUBLISHED" : "APPROVED") : "REJECTED",
        approvedBy: approved ? session.user.id : null,
        approvedAt: approved ? new Date() : null,
        published: published || false,
        publishedAt: published ? new Date() : null,
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
      approved ? (published ? "PUBLISH" : "APPROVE") : "REJECT",
      "Result",
      request,
      {
        entityId: params.id,
        description: `${approved ? (published ? "Published" : "Approved") : "Rejected"} result for ${updatedResult.student.user.name} - ${updatedResult.classSubject.subject.name}`,
      }
    )

    // Create notification for student
    if (approved) {
      await createNotification({
        userId: updatedResult.student.userId,
        title: published ? "Result Published" : "Result Approved",
        message: `Your result for ${updatedResult.classSubject.subject.name} has been ${published ? "published" : "approved"}`,
        type: "SUCCESS",
        category: "RESULT",
        link: `/dashboard/results`,
        metadata: { resultId: params.id },
      })
    } else {
      await createNotification({
        userId: updatedResult.student.userId,
        title: "Result Rejected",
        message: `Your result for ${updatedResult.classSubject.subject.name} has been rejected. Please contact your teacher.`,
        type: "WARNING",
        category: "RESULT",
        link: `/dashboard/results`,
        metadata: { resultId: params.id },
      })
    }

    return NextResponse.json(updatedResult)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    )
  }
}

