import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only teachers can access this endpoint
    if (session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Only teachers can access this endpoint" }, { status: 403 })
    }

    // Get the staff record for this teacher
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        sections: {
          include: {
            class: {
              select: {
                name: true,
              },
            },
          },
          orderBy: {
            class: {
              name: "asc",
            },
          },
        },
      },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff record not found" }, { status: 404 })
    }

    // Return only the sections where this teacher is a class teacher
    return NextResponse.json(staff.sections)
  } catch (error) {
    console.error("Error fetching teacher sections:", error)
    return NextResponse.json(
      { error: "Failed to fetch teacher sections" },
      { status: 500 }
    )
  }
}
