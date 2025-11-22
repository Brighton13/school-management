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
    const session = await requirePermission(request, Permissions.USERS_READ)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userRoles = await prisma.userRole.findMany({
      where: { userId: params.id },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json(userRoles)
  } catch (error) {
    console.error("Error fetching user roles:", error)
    return NextResponse.json(
      { error: "Failed to fetch user roles" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.USERS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { roleId } = body

    if (!roleId) {
      return NextResponse.json(
        { error: "Role ID is required" },
        { status: 400 }
      )
    }

    // Check if user and role exist
    const [user, role] = await Promise.all([
      prisma.user.findUnique({ where: { id: params.id } }),
      prisma.role.findUnique({ where: { id: roleId } }),
    ])

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 })
    }

    const userRole = await prisma.userRole.create({
      data: {
        userId: params.id,
        roleId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
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
      "User",
      request,
      {
        entityId: params.id,
        description: `Assigned role ${role.name} to user ${user.name}`,
      }
    )

    return NextResponse.json(userRole, { status: 201 })
  } catch (error: any) {
    console.error("Error assigning role to user:", error)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "User already has this role" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Failed to assign role to user" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.USERS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const roleId = searchParams.get("roleId")

    if (!roleId) {
      return NextResponse.json(
        { error: "Role ID is required" },
        { status: 400 }
      )
    }

    const userRole = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: params.id,
          roleId,
        },
      },
      include: {
        user: true,
        role: true,
      },
    })

    if (!userRole) {
      return NextResponse.json(
        { error: "User role not found" },
        { status: 404 }
      )
    }

    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId: params.id,
          roleId,
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "User",
      request,
      {
        entityId: params.id,
        description: `Removed role ${userRole.role.name} from user ${userRole.user.name}`,
      }
    )

    return NextResponse.json({ message: "Role removed from user" })
  } catch (error) {
    console.error("Error removing role from user:", error)
    return NextResponse.json(
      { error: "Failed to remove role from user" },
      { status: 500 }
    )
  }
}

