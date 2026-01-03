import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.SUBJECTS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { teacherId, maxMarks, passMarks } = body

    const updated = await prisma.classSubject.update({
      where: { id: params.id },
      data: {
        teacherId: teacherId || null,
        maxMarks: maxMarks ? parseFloat(maxMarks) : null,
        passMarks: passMarks ? parseFloat(passMarks) : null,
      },
      include: {
        class: true,
        section: true,
        subject: true,
        teacher: {
          include: { user: true },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "ClassSubject",
      request,
      {
        entityId: params.id,
        description: `Updated class-subject: ${updated.class.name} ${updated.section?.name || ""} - ${updated.subject.name}`,
      }
    )

    return NextResponse.json(updated)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update class subject" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.SUBJECTS_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get class-subject info before deletion for audit trail
    const classSubject = await prisma.classSubject.findUnique({
      where: { id: params.id },
      include: {
        class: true,
        section: true,
        subject: true,
      },
    })

    // Log audit trail before deletion
    if (classSubject) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "ClassSubject",
        request,
        {
          entityId: params.id,
          description: `Deleted class-subject: ${classSubject.class.name} ${classSubject.section?.name || ""} - ${classSubject.subject.name}`,
        }
      )
    }

    await prisma.classSubject.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete class subject" },
      { status: 500 }
    )
  }
}

