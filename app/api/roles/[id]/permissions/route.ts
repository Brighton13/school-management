import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.ROLES_READ)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: params.id },
      include: {
        permission: true,
      },
    })

    return NextResponse.json(rolePermissions)
  } catch (error) {
    console.error("Error fetching role permissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch role permissions" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.ROLES_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { permissionId, granted = true } = body

    if (!permissionId) {
      return NextResponse.json(
        { error: "Permission ID is required" },
        { status: 400 }
      )
    }

    const rolePermission = await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: params.id,
          permissionId,
        },
      },
      update: {
        granted,
      },
      create: {
        roleId: params.id,
        permissionId,
        granted,
      },
      include: {
        permission: true,
      },
    })

    return NextResponse.json(rolePermission, { status: 201 })
  } catch (error: any) {
    console.error("Error updating role permission:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update role permission" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.ROLES_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const permissionId = searchParams.get("permissionId")

    if (!permissionId) {
      return NextResponse.json(
        { error: "Permission ID is required" },
        { status: 400 }
      )
    }

    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId: params.id,
          permissionId,
        },
      },
    })

    return NextResponse.json({ message: "Permission removed from role" })
  } catch (error) {
    console.error("Error removing role permission:", error)
    return NextResponse.json(
      { error: "Failed to remove role permission" },
      { status: 500 }
    )
  }
}

