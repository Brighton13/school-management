import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET() {
  try {
    const terms = await prisma.academicTerm.findMany({
      orderBy: { startDate: "desc" },
    })

    return NextResponse.json(terms)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch terms" },
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
    const { name, academicYear, startDate, endDate, isCurrent } = body

    // If setting as current, unset all other current terms
    if (isCurrent) {
      await prisma.academicTerm.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      })
    }

    const term = await prisma.academicTerm.create({
      data: {
        name,
        academicYear,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: isCurrent || false,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "AcademicTerm",
      request,
      {
        entityId: term.id,
        description: `Created academic term: ${name} (${academicYear})`,
      }
    )

    return NextResponse.json(term, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create term" },
      { status: 500 }
    )
  }
}

