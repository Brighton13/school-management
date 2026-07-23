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
    const type = searchParams.get("type")
    const departmentId = searchParams.get("departmentId")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {}
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { department: { name: { contains: search, mode: "insensitive" } } },
      ]
    }
    if (type) {
      whereClause.type = type
    }
    if (departmentId) {
      whereClause.departmentId = departmentId
    }

    // Get total count
    const total = await prisma.subject.count({ where: whereClause })

    const subjects = await prisma.subject.findMany({
      where: whereClause,
      include: {
        department: true,
        staffSubjects: { include: { staff: { include: { user: true } } } },
      },
      orderBy: { name: "asc" },
      ...(noPagination ? { take: parseBoundedListLimit(searchParams) } : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(subjects)
    }

    return NextResponse.json(createPaginatedResponse(subjects, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.SUBJECTS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, code, description, type, departmentId } = body

    const subject = await prisma.subject.create({
      data: {
        name,
        code,
        departmentId: departmentId || null,
        description,
        type,
      },
      include: { department: true },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Subject",
      request,
      {
        entityId: subject.id,
        description: `Created subject: ${name} (${code})`,
      }
    )

    return NextResponse.json(subject, { status: 201 })
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Subject code already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create subject" },
      { status: 500 }
    )
  }
}

