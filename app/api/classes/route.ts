import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse, parseBoundedListLimit } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {}
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
      ]
    }

    // Get total count
    const total = await prisma.class.count({ where: whereClause })

    const classes = await prisma.class.findMany({
      where: whereClause,
      include: {
        sections: true,
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { level: "asc" },
      ...(noPagination ? { take: parseBoundedListLimit(searchParams) } : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(classes)
    }

    return NextResponse.json(createPaginatedResponse(classes, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch classes" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.CLASSES_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, level, capacity } = body

    const newClass = await prisma.class.create({
      data: {
        name,
        level,
        capacity,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Class",
      request,
      {
        entityId: newClass.id,
        description: `Created class: ${name} (Level ${level})`,
      }
    )

    return NextResponse.json(newClass, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create class" },
      { status: 500 }
    )
  }
}

