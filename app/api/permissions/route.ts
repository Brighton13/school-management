import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

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

    const whereClause: any = {}
    if (module) {
      whereClause.module = module
    }

    const permissions = await prisma.permission.findMany({
      where: whereClause,
      orderBy: [{ module: "asc" }, { name: "asc" }],
    })

    return NextResponse.json(permissions)
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

