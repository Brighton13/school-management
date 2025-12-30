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
    const term = await prisma.academicTerm.findUnique({
      where: { id: params.id },
    })

    if (!term) {
      return NextResponse.json({ error: "Term not found" }, { status: 404 })
    }

    return NextResponse.json(term)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch term" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, academicYear, startDate, endDate, isCurrent } = body

    // Check if term exists
    const existingTerm = await prisma.academicTerm.findUnique({
      where: { id: params.id },
    })

    if (!existingTerm) {
      return NextResponse.json({ error: "Term not found" }, { status: 404 })
    }

    // If setting as current, unset all other current terms
    if (isCurrent === true) {
      await prisma.academicTerm.updateMany({
        where: { 
          isCurrent: true,
          id: { not: params.id }
        },
        data: { isCurrent: false },
      })
    }

    const updatedTerm = await prisma.academicTerm.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(academicYear && { academicYear }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(typeof isCurrent === 'boolean' && { isCurrent }),
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "AcademicTerm",
      request,
      {
        entityId: updatedTerm.id,
        description: `Updated academic term: ${updatedTerm.name} (${updatedTerm.academicYear})`,
        metadata: {
          changes: {
            before: existingTerm,
            after: updatedTerm,
          },
        },
      }
    )

    return NextResponse.json(updatedTerm)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update term", details: error.message },
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
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if term exists
    const existingTerm = await prisma.academicTerm.findUnique({
      where: { id: params.id },
      include: {
        results: true,
        fees: true,
        exams: true,
        reports: true,
      },
    })

    if (!existingTerm) {
      return NextResponse.json({ error: "Term not found" }, { status: 404 })
    }

    // Check if term has associated records
    const hasRecords = 
      existingTerm.results.length > 0 ||
      existingTerm.fees.length > 0 ||
      existingTerm.exams.length > 0 ||
      existingTerm.reports.length > 0

    if (hasRecords) {
      return NextResponse.json(
        {
          error: "Cannot delete term with associated records",
          details: "This term has associated results, fees, exams, or reports. Please remove or reassign them first.",
        },
        { status: 400 }
      )
    }

    await prisma.academicTerm.delete({
      where: { id: params.id },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "AcademicTerm",
      request,
      {
        entityId: params.id,
        description: `Deleted academic term: ${existingTerm.name} (${existingTerm.academicYear})`,
        metadata: { deletedData: existingTerm },
      }
    )

    return NextResponse.json({ message: "Term deleted successfully" })
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete term", details: error.message },
      { status: 500 }
    )
  }
}
