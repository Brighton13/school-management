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

    // Get pending applications
    const applications = await prisma.application.findMany({
      where: {
        applicationStatus: "PENDING",
      },
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
              },
            },
          },
        },
        appliedClass: true,
        appliedSection: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(applications)
  } catch (error) {
    console.error("Failed to fetch pending applications:", error)
    return NextResponse.json(
      { error: "Failed to fetch pending applications" },
      { status: 500 }
    )
  }
}
