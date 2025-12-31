import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if academic year exists
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: params.id },
    })

    if (!academicYear) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 404 }
      )
    }

    // Unset all current academic years
    await prisma.academicYear.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    })

    // Set the selected year as current
    const updatedYear = await prisma.academicYear.update({
      where: { id: params.id },
      data: { 
        isCurrent: true,
        isUpcoming: false, // If it was upcoming, it's no longer upcoming
        status: "ACTIVE",
      },
      include: {
        terms: {
          orderBy: { termNumber: "asc" },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "AcademicYear",
      request,
      {
        entityId: updatedYear.id,
        description: `Set ${updatedYear.year} as current academic year`,
      }
    )

    return NextResponse.json(updatedYear)
  } catch (error) {
    console.error("Failed to set current academic year:", error)
    return NextResponse.json(
      { error: "Failed to set current academic year" },
      { status: 500 }
    )
  }
}
