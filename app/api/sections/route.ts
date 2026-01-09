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

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")
    const teacherId = searchParams.get("teacherId")
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    // If requesting teacher's sections, get the teacher's sections
    let where: any = classId ? { classId } : {}

    if (teacherId === "true") {
      // Get current user's staff record
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
      })

      if (!staff) {
        return NextResponse.json(
          { error: "User is not a staff member" },
          { status: 403 }
        )
      }

      where = { classTeacherId: staff.id }
    }

    // Add search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { class: { name: { contains: search, mode: "insensitive" } } },
      ]
    }

    // Get total count
    const total = await prisma.section.count({ where })

    const sections = await prisma.section.findMany({
      where,
      include: {
        class: true,
        classTeacher: {
          include: { user: true },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { name: "asc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(sections)
    }

    return NextResponse.json(createPaginatedResponse(sections, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sections" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.SECTIONS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, classId, capacity, classTeacherId } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Section name is required" },
        { status: 400 }
      )
    }

    if (!classId) {
      return NextResponse.json(
        { error: "Class is required" },
        { status: 400 }
      )
    }

    // Parse capacity - handle both string and number inputs
    let parsedCapacity: number | null = null
    if (capacity !== null && capacity !== undefined && capacity !== "") {
      const parsed = typeof capacity === "number" ? capacity : parseInt(capacity)
      if (!isNaN(parsed) && parsed > 0) {
        parsedCapacity = parsed
      }
    }

    const section = await prisma.section.create({
      data: {
        name: name.trim(),
        classId,
        capacity: parsedCapacity,
        classTeacherId: classTeacherId || null,
      },
      include: {
        class: true,
        classTeacher: {
          include: { user: true },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Section",
      request,
      {
        entityId: section.id,
        description: `Created section: ${section.name} for class ${section.class.name}`,
      }
    )

    return NextResponse.json(section, { status: 201 })
  } catch (error: any) {
    console.error("Error creating section:", error)
    
    // Handle Prisma errors
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A section with this name already exists for this class" },
        { status: 400 }
      )
    }
    
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Invalid class or class teacher selected" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Failed to create section" },
      { status: 500 }
    )
  }
}
