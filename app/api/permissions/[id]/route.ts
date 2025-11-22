import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.PERMISSIONS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, module, action } = body

    // Check if permission exists
    const existingPermission = await prisma.permission.findUnique({
      where: { id: params.id },
    })

    if (!existingPermission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 })
    }

    // Update permission
    const permission = await prisma.permission.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(module && { module }),
        ...(action && { action }),
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Permission",
      request,
      {
        entityId: permission.id,
        description: `Updated permission: ${permission.name}`,
      }
    )

    return NextResponse.json(permission)
  } catch (error: any) {
    console.error("Error updating permission:", error)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Permission with this name already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Failed to update permission" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.PERMISSIONS_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: params.id },
    })

    if (!permission) {
      return NextResponse.json({ error: "Permission not found" }, { status: 404 })
    }

    // Delete permission (cascade will handle related records)
    await prisma.permission.delete({
      where: { id: params.id },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "Permission",
      request,
      {
        entityId: permission.id,
        description: `Deleted permission: ${permission.name}`,
      }
    )

    return NextResponse.json({ message: "Permission deleted successfully" })
  } catch (error) {
    console.error("Error deleting permission:", error)
    return NextResponse.json(
      { error: "Failed to delete permission" },
      { status: 500 }
    )
  }
}

