import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const results = await prisma.result.findMany({
      where: {
        status: "PENDING_APPROVAL",
      },
      include: {
        student: {
          include: { user: true },
        },
        classSubject: {
          include: {
            subject: true,
            class: true,
            teacher: {
              include: { user: true },
            },
          },
        },
        term: true,
        academicYear: true,
      },
      orderBy: { submittedAt: "desc" },
    })

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch pending results" },
      { status: 500 }
    )
  }
}

