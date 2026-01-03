import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const terms = await prisma.term.findMany({
      where: { academicYearId: params.id },
      orderBy: { termNumber: "asc" },
    })

    return NextResponse.json(terms)
  } catch (error) {
    console.error("Failed to fetch terms:", error)
    return NextResponse.json(
      { error: "Failed to fetch terms" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.TERMS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, termNumber, startDate, endDate, isCurrent } = body

    // Verify academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: params.id },
    })

    if (!academicYear) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 404 }
      )
    }

    // Check if term number already exists for this academic year
    const existingTerm = await prisma.term.findUnique({
      where: {
        academicYearId_termNumber: {
          academicYearId: params.id,
          termNumber: termNumber,
        },
      },
    })

    if (existingTerm) {
      return NextResponse.json(
        { error: `Term ${termNumber} already exists for this academic year` },
        { status: 400 }
      )
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
        academicYearId: params.id,
        termNumber,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: isCurrent || false,
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
        description: `Created term: ${name} for ${academicYear.year}`,
      }
    )

    return NextResponse.json(term, { status: 201 })
  } catch (error) {
    console.error("Failed to create term:", error)
    return NextResponse.json(
      { error: "Failed to create term" },
      { status: 500 }
    )
  }
}
