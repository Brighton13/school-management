import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")
    const action = searchParams.get("action")
    const entityType = searchParams.get("entityType")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limit = parseInt(searchParams.get("limit") || "100")
    const offset = parseInt(searchParams.get("offset") || "0")

    const whereClause: any = {}
    if (userId) {
      whereClause.userId = userId
    }
    if (action) {
      whereClause.action = action
    }
    if (entityType) {
      whereClause.entityType = entityType
    }
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate)
      }
    }

    const [auditTrails, total] = await Promise.all([
      prisma.auditTrail.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditTrail.count({ where: whereClause }),
    ])

    return NextResponse.json({
      data: auditTrails,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching audit trails:", error)
    return NextResponse.json(
      { error: "Failed to fetch audit trails" },
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

    const body = await request.json()
    const {
      action,
      entityType,
      entityId,
      description,
      ipAddress,
      userAgent,
      metadata,
    } = body

    // Validation
    if (!action || !entityType) {
      return NextResponse.json(
        { error: "Missing required fields: action, entityType" },
        { status: 400 }
      )
    }

    // Get IP address and user agent from request if not provided
    const clientIp =
      ipAddress ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown"
    const clientUserAgent =
      userAgent || request.headers.get("user-agent") || "unknown"

    const auditTrail = await prisma.auditTrail.create({
      data: {
        userId: session.user.id,
        action,
        entityType,
        entityId: entityId || null,
        description: description || null,
        ipAddress: clientIp,
        userAgent: clientUserAgent,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    return NextResponse.json(auditTrail, { status: 201 })
  } catch (error) {
    console.error("Error creating audit trail:", error)
    return NextResponse.json(
      { error: "Failed to create audit trail" },
      { status: 500 }
    )
  }
}

