import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

/**
 * POST - Add comment and signature to a report
 * Teachers add comments based on student performance
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["TEACHER", "ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { reportId, commentText, performanceArea, teacherSignature, marksLowerBound, marksUpperBound } = body

    if (!reportId || !commentText) {
      return NextResponse.json(
        { error: "Missing required fields: reportId, commentText" },
        { status: 400 }
      )
    }

    // Get report details
    const report = await prisma.studentReport.findUnique({
      where: { id: reportId },
      include: {
        student: { include: { user: true } },
        section: { include: { class: true } }
      }
    })

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      )
    }

    // Verify teacher is assigned to this section
    let staffId: string | null = null
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          sections: {
            where: { id: report.sectionId }
          }
        }
      })

      if (!staff || staff.sections.length === 0) {
        return NextResponse.json(
          { error: "You are not assigned to this section" },
          { status: 403 }
        )
      }
      staffId = staff.id
    } else {
      // For admin/principal, get staff record if exists
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id }
      })
      staffId = staff?.id || session.user.id
    }

    // Create comment
    const comment = await prisma.reportComment.create({
      data: {
        reportId,
        teacherId: staffId as string,
        commentText,
        performanceArea: performanceArea || "OVERALL",
        marksLowerBound: marksLowerBound || null,
        marksUpperBound: marksUpperBound || null,
        teacherSignature: teacherSignature || null,
        signedAt: teacherSignature ? new Date() : null
      },
      include: {
        teacher: { include: { user: true } }
      }
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "ReportComment",
      request,
      {
        entityId: comment.id,
        description: `Added comment to report for ${report.student.user.name}`
      }
    )

    // Notify student if comment is added
    await createNotification({
      userId: report.student.userId,
      title: "New Comment on Report",
      message: `Teacher ${comment.teacher.user.name} has added a comment to your report`,
      type: "INFO",
      category: "RESULT",
      link: `/dashboard/reports/${reportId}`,
      metadata: { reportId, commentId: comment.id }
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error("Add comment error:", error)
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 }
    )
  }
}

/**
 * GET - Retrieve comments for a report
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const reportId = searchParams.get("reportId")

    if (!reportId) {
      return NextResponse.json(
        { error: "Missing reportId parameter" },
        { status: 400 }
      )
    }

    // Verify access to this report
    const report = await prisma.studentReport.findUnique({
      where: { id: reportId },
      select: { studentId: true, sectionId: true }
    })

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      )
    }

    // Check access permissions
    if (session.user.role !== "ADMIN" && session.user.role !== "PRINCIPAL") {
      if (session.user.role === "TEACHER") {
        const staff = await prisma.staff.findUnique({
          where: { userId: session.user.id },
          include: { sections: { where: { id: report.sectionId } } }
        })
        if (!staff || staff.sections.length === 0) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 403 }
          )
        }
      } else {
        // Student can only see their own report comments
        const student = await prisma.student.findUnique({
          where: { userId: session.user.id },
          select: { id: true }
        })
        if (!student || student.id !== report.studentId) {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 403 }
          )
        }
      }
    }

    const comments = await prisma.reportComment.findMany({
      where: { reportId },
      include: {
        teacher: { include: { user: true } }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Fetch comments error:", error)
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update a comment
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["TEACHER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { commentId, commentText, teacherSignature, performanceArea } = body

    if (!commentId) {
      return NextResponse.json(
        { error: "Missing commentId" },
        { status: 400 }
      )
    }

    // Verify ownership
    const existingComment = await prisma.reportComment.findUnique({
      where: { id: commentId },
      include: {
        teacher: { select: { userId: true } }
      }
    })

    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      )
    }

    if (session.user.role === "TEACHER" && existingComment.teacher.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to update this comment" },
        { status: 403 }
      )
    }

    const updatedComment = await prisma.reportComment.update({
      where: { id: commentId },
      data: {
        ...(commentText && { commentText }),
        ...(performanceArea && { performanceArea }),
        ...(teacherSignature !== undefined && { teacherSignature, signedAt: teacherSignature ? new Date() : null })
      },
      include: {
        teacher: { include: { user: true } }
      }
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "ReportComment",
      request,
      {
        entityId: commentId,
        description: `Updated comment on report`
      }
    )

    return NextResponse.json(updatedComment)
  } catch (error) {
    console.error("Update comment error:", error)
    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove a comment
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["TEACHER", "ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get("id")

    if (!commentId) {
      return NextResponse.json(
        { error: "Missing commentId parameter" },
        { status: 400 }
      )
    }

    // Verify ownership
    const comment = await prisma.reportComment.findUnique({
      where: { id: commentId },
      include: {
        teacher: { select: { userId: true } }
      }
    })

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      )
    }

    if (session.user.role === "TEACHER" && comment.teacher.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to delete this comment" },
        { status: 403 }
      )
    }

    await prisma.reportComment.delete({
      where: { id: commentId }
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "ReportComment",
      request,
      {
        entityId: commentId,
        description: `Deleted comment from report`
      }
    )

    return NextResponse.json(
      { message: "Comment deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete comment error:", error)
    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    )
  }
}
