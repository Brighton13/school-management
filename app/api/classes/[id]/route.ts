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
    const classRecord = await prisma.class.findUnique({
      where: { id: params.id },
      include: {
        sections: true,
      },
    })

    if (!classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 })
    }

    return NextResponse.json(classRecord)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch class" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.CLASSES_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, level, capacity } = body

    const updatedClass = await prisma.class.update({
      where: { id: params.id },
      data: {
        name,
        level: level ? parseInt(level) : undefined,
        capacity: capacity ? parseInt(capacity) : null,
      },
      include: {
        sections: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Class",
      request,
      {
        entityId: params.id,
        description: `Updated class: ${updatedClass.name}`,
      }
    )

    return NextResponse.json(updatedClass)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update class" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.CLASSES_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get class info before deletion for audit trail
    const classRecord = await prisma.class.findUnique({
      where: { id: params.id },
    })

    // Log audit trail before deletion
    if (classRecord) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "Class",
        request,
        {
          entityId: params.id,
          description: `Deleted class: ${classRecord.name}`,
        }
      )
    }

    await prisma.class.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete class" },
      { status: 500 }
    )
  }
}

