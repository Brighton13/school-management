import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const academicYearId = searchParams.get("academicYearId")
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {}
    if (academicYearId) {
      whereClause.academicYearId = academicYearId
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
      ]
    }

    // Get total count
    const total = await prisma.term.count({ where: whereClause })

    const terms = await prisma.term.findMany({
      where: whereClause,
      include: {
        academicYear: true,
      },
      orderBy: { startDate: "desc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(terms)
    }

    return NextResponse.json(createPaginatedResponse(terms, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch terms" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.TERMS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, academicYearId, startDate, endDate, isCurrent, termNumber } = body

    if (!academicYearId) {
      return NextResponse.json({ error: "Academic year is required" }, { status: 400 })
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
    })

    if (!academicYear) {
      return NextResponse.json({ error: "Academic year not found" }, { status: 404 })
    }

    // If setting as current, unset all other current terms
    if (isCurrent) {
      await prisma.term.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      })
    }

    const term = await prisma.term.create({
      data: {
        name,
        academicYearId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: isCurrent || false,
        termNumber: termNumber || 1,
      },
      include: {
        academicYear: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Term",
      request,
      {
        entityId: term.id,
        description: `Created term: ${name} (${academicYear.year})`,
      }
    )

    return NextResponse.json(term, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create term" },
      { status: 500 }
    )
  }
}

