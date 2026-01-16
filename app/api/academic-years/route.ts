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
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {}
    if (search) {
      whereClause.OR = [
        { year: { contains: search, mode: "insensitive" } },
      ]
    }
    if (status) {
      whereClause.status = status
    }

    // Get total count
    const total = await prisma.academicYear.count({ where: whereClause })

    const academicYears = await prisma.academicYear.findMany({
      where: whereClause,
      include: {
        terms: {
          orderBy: { termNumber: "asc" },
        },
        _count: {
          select: {
            enrollments: true,
            applications: true,
            results: true,
            fees: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(academicYears)
    }

    return NextResponse.json(createPaginatedResponse(academicYears, total, page, limit))
  } catch (error) {
    console.error("Failed to fetch academic years:", error)
    return NextResponse.json(
      { error: "Failed to fetch academic years" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.ACADEMIC_YEARS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { year, startDate, endDate, isCurrent, isUpcoming, status } = body

    // Validate required fields
    if (!year || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Year, start date, and end date are required" },
        { status: 400 }
      )
    }

    // Check if year already exists
    const existingYear = await prisma.academicYear.findUnique({
      where: { year },
    })

    if (existingYear) {
      return NextResponse.json(
        { error: "Academic year already exists" },
        { status: 400 }
      )
    }

    // If setting as current, unset all other current years
    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      })
    }

    // If setting as upcoming, unset all other upcoming years
    if (isUpcoming) {
      await prisma.academicYear.updateMany({
        where: { isUpcoming: true },
        data: { isUpcoming: false },
      })
    }

    const academicYear = await prisma.academicYear.create({
      data: {
        year,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: isCurrent || false,
        isUpcoming: isUpcoming || false,
        status: status || "ACTIVE",
      },
      include: {
        terms: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "AcademicYear",
      request,
      {
        entityId: academicYear.id,
        description: `Created academic year: ${year}`,
      }
    )

    return NextResponse.json(academicYear, { status: 201 })
  } catch (error) {
    console.error("Failed to create academic year:", error)
    return NextResponse.json(
      { error: "Failed to create academic year" },
      { status: 500 }
    )
  }
}
