import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"
import { createPaginatedResponse, parsePaginationParams } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check permission, but allow legacy ADMIN role as fallback for initial setup
    const hasPermission = await requirePermission(request, Permissions.PERMISSIONS_READ)
    if (!hasPermission && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const module = searchParams.get("module")
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {}
    if (module) {
      whereClause.module = module
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { module: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
      ]
    }

    const [total, permissions] = await Promise.all([
      prisma.permission.count({ where: whereClause }),
      prisma.permission.findMany({
        where: whereClause,
        orderBy: [{ module: "asc" }, { name: "asc" }],
        ...(noPagination ? {} : { skip: offset, take: limit }),
      }),
    ])

    if (noPagination) return NextResponse.json(permissions)
    return NextResponse.json(createPaginatedResponse(permissions, total, page, limit))
  } catch (error) {
    console.error("Error fetching permissions:", error)
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    )
  }
}

// Permission creation is disabled - permissions are system-managed and initialized during setup only.
// Users can only read and assign existing permissions to roles.
// Do not add POST endpoint here.

