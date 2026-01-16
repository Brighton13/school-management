import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: params.id },
    })

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 })
    }

    return NextResponse.json(subject)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch subject" },
      { status: 500 }
    )
  }
}

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
    const { name, code, description, type } = body

    const updatedSubject = await prisma.subject.update({
      where: { id: params.id },
      data: {
        name,
        code,
        description: description !== undefined ? description : null,
        type,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Subject",
      request,
      {
        entityId: params.id,
        description: `Updated subject: ${updatedSubject.name} (${updatedSubject.code})`,
      }
    )

    return NextResponse.json(updatedSubject)
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Subject code already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update subject" },
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

    // Get subject info before deletion for audit trail
    const subject = await prisma.subject.findUnique({
      where: { id: params.id },
    })

    // Log audit trail before deletion
    if (subject) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "Subject",
        request,
        {
          entityId: params.id,
          description: `Deleted subject: ${subject.name} (${subject.code})`,
        }
      )
    }

    await prisma.subject.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete subject" },
      { status: 500 }
    )
  }
}

