import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, module, action } = body

    // Validation
    if (!name || !module || !action) {
      return NextResponse.json(
        { error: "Missing required fields: name, module, action" },
        { status: 400 }
      )
    }

    const permission = await prisma.permission.create({
      data: {
        name,
        description: description || null,
        module,
        action,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Permission",
      request,
      {
        entityId: permission.id,
        description: `Created permission: ${name} (${module}.${action})`,
      }
    )

    return NextResponse.json(permission, { status: 201 })
  } catch (error: any) {
    console.error("Error creating permission:", error)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Permission with this name already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Failed to create permission" },
      { status: 500 }
    )
  }
}

