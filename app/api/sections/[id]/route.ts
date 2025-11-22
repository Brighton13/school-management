import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const section = await prisma.section.findUnique({
      where: { id: params.id },
      include: {
        class: true,
        classTeacher: {
          include: { user: true },
        },
        _count: {
          select: { enrollments: true },
        },
      },
    })

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    return NextResponse.json(section)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch section" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const section = await prisma.section.update({
      where: { id: params.id },
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
      "UPDATE",
      "Section",
      request,
      {
        entityId: params.id,
        description: `Updated section: ${section.name} for class ${section.class.name}`,
      }
    )

    return NextResponse.json(section, { status: 200 })
  } catch (error: any) {
    console.error("Error updating section:", error)
    
    // Handle Prisma errors
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Section not found" },
        { status: 404 }
      )
    }
    
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
      { error: error.message || "Failed to update section" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get section info before deletion for audit trail
    const section = await prisma.section.findUnique({
      where: { id: params.id },
      include: { class: true },
    })

    // Log audit trail before deletion
    if (section) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "Section",
        request,
        {
          entityId: params.id,
          description: `Deleted section: ${section.name} from class ${section.class.name}`,
        }
      )
    }

    await prisma.section.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Section deleted successfully" })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete section" },
      { status: 500 }
    )
  }
}

