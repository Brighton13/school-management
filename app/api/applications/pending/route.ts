import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createPaginatedResponse, parseBoundedListLimit, parsePaginationParams } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search")
    const classId = searchParams.get("classId")
    const academicYearId = searchParams.get("academicYearId")
    const noPagination = searchParams.get("noPagination") === "true"
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {
      applicationStatus: "PENDING",
      ...(classId ? { appliedClassId: classId } : {}),
      ...(academicYearId ? { academicYearId } : {}),
    }

    if (search) {
      whereClause.OR = [
        { student: { admissionNumber: { contains: search, mode: "insensitive" } } },
        { student: { user: { name: { contains: search, mode: "insensitive" } } } },
        { student: { user: { email: { contains: search, mode: "insensitive" } } } },
        { appliedClass: { name: { contains: search, mode: "insensitive" } } },
      ]
    }

    const [total, applications] = await Promise.all([
      prisma.application.count({ where: whereClause }),
      prisma.application.findMany({
        where: whereClause,
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
              classEnrollment: {
                orderBy: { createdAt: "desc" },
                take: 1,
                include: {
                  class: true,
                  section: true,
                  academicYear: true,
                },
              },
            },
          },
          appliedClass: true,
          appliedSection: true,
          academicYear: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        ...(noPagination ? { take: parseBoundedListLimit(searchParams) } : { skip: offset, take: limit }),
      }),
    ])

    if (noPagination) return NextResponse.json(applications)
    return NextResponse.json(createPaginatedResponse(applications, total, page, limit))
  } catch (error) {
    console.error("Failed to fetch pending applications:", error)
    return NextResponse.json(
      { error: "Failed to fetch pending applications" },
      { status: 500 }
    )
  }
}
