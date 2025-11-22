import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const selection = await prisma.studentSubjectSelection.findUnique({
      where: { id: params.id },
      include: {
        student: true,
      },
    })

    if (!selection) {
      return NextResponse.json({ error: "Selection not found" }, { status: 404 })
    }

    // Students can only delete their own selections
    if (session.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
      })
      if (!student || student.id !== selection.studentId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    // Only ADMIN can delete selections (students should use status update instead)
    if (session.user.role !== "ADMIN" && session.user.role !== "PRINCIPAL") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get selection info before deletion for audit trail
    const selectionInfo = await prisma.studentSubjectSelection.findUnique({
      where: { id: params.id },
      include: {
        student: { include: { user: true } },
        classSubject: { include: { subject: true } },
      },
    })

    // Log audit trail before deletion
    if (selectionInfo) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "StudentSubjectSelection",
        request,
        {
          entityId: params.id,
          description: `Removed ${selectionInfo.student.user.name}'s selection of ${selectionInfo.classSubject.subject.name}`,
        }
      )
    }

    await prisma.studentSubjectSelection.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting student subject selection:", error)
    return NextResponse.json(
      { error: "Failed to delete student subject selection" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { status } = body

    const selection = await prisma.studentSubjectSelection.findUnique({
      where: { id: params.id },
      include: {
        student: true,
      },
    })

    if (!selection) {
      return NextResponse.json({ error: "Selection not found" }, { status: 404 })
    }

    // Students can only update their own selections
    if (session.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
      })
      if (!student || student.id !== selection.studentId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
      }
    }

    // Only allow status updates
    if (status && !["ACTIVE", "DROPPED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ACTIVE or DROPPED" },
        { status: 400 }
      )
    }

    const updatedSelection = await prisma.studentSubjectSelection.update({
      where: { id: params.id },
      data: {
        ...(status ? { status } : {}),
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        classSubject: {
          include: {
            class: true,
            subject: true,
            teacher: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "StudentSubjectSelection",
      request,
      {
        entityId: params.id,
        description: `Updated ${updatedSelection.student.user.name}'s subject selection: ${updatedSelection.classSubject.subject.name} - Status: ${status}`,
      }
    )

    return NextResponse.json(updatedSelection)
  } catch (error) {
    console.error("Error updating student subject selection:", error)
    return NextResponse.json(
      { error: "Failed to update student subject selection" },
      { status: 500 }
    )
  }
}

