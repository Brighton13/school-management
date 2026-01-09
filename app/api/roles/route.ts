import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission, but allow legacy ADMIN role as fallback for initial setup
    const hasPermission = await requirePermission(request, Permissions.ROLES_READ)
    if (!hasPermission && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includePermissions = searchParams.get("includePermissions") === "true"
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {}
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    // Get total count
    const total = await prisma.role.count({ where: whereClause })

    const roles = await prisma.role.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
        ...(includePermissions && {
          permissions: {
            where: { granted: true },
            include: {
              permission: true,
            },
          },
        }),
      },
      orderBy: { name: "asc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(roles)
    }

    return NextResponse.json(createPaginatedResponse(roles, total, page, limit))
  } catch (error) {
    console.error("Error fetching roles:", error)
    return NextResponse.json(
      { error: "Failed to fetch roles" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission, but allow legacy ADMIN role as fallback for initial setup
    const hasPermission = await requirePermission(request, Permissions.ROLES_CREATE)
    if (!hasPermission && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, permissionIds } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Role name is required" },
        { status: 400 }
      )
    }

    // Create role with permissions
    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        description: description || null,
        permissions: permissionIds
          ? {
              create: permissionIds.map((permissionId: string) => ({
                permissionId,
                granted: true,
              })),
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Role",
      request,
      {
        entityId: role.id,
        description: `Created role: ${name}`,
      }
    )

    return NextResponse.json(role, { status: 201 })
  } catch (error: any) {
    console.error("Error creating role:", error)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Role with this name already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Failed to create role" },
      { status: 500 }
    )
  }
}

