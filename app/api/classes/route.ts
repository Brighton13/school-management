import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET() {
  try {
    const classes = await prisma.class.findMany({
      include: {
        sections: true,
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { level: "asc" },
    })

    return NextResponse.json(classes)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch classes" },
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

