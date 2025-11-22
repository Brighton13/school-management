import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")

    const sections = await prisma.section.findMany({
      where: classId ? { classId } : undefined,
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
    })

    return NextResponse.json(sections)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sections" },
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
