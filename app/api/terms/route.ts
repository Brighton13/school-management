import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function GET() {
  try {
    const terms = await prisma.term.findMany({
      include: {
        academicYear: true,
      },
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
    const session = await requirePermission(request, Permissions.TERMS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, academicYearId, startDate, endDate, isCurrent, termNumber } = body

    if (!academicYearId) {
      return NextResponse.json({ error: "Academic year is required" }, { status: 400 })
    }

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
    })

    if (!academicYear) {
      return NextResponse.json({ error: "Academic year not found" }, { status: 404 })
    }

    // If setting as current, unset all other current terms
    if (isCurrent) {
      await prisma.term.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      })
    }

    const term = await prisma.term.create({
      data: {
        name,
        academicYearId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: isCurrent || false,
        termNumber: termNumber || 1,
      },
      include: {
        academicYear: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Term",
      request,
      {
        entityId: term.id,
        description: `Created term: ${name} (${academicYear.year})`,
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

