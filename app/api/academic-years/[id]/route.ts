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
    const academicYear = await prisma.academicYear.findUnique({
      where: { id: params.id },
      include: {
        terms: {
          orderBy: { termNumber: "asc" },
        },
        _count: {
          select: {
            enrollments: true,
            applications: true,
            results: true,
            fees: true,
          },
        },
      },
    })

    if (!academicYear) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(academicYear)
  } catch (error) {
    console.error("Failed to fetch academic year:", error)
    return NextResponse.json(
      { error: "Failed to fetch academic year" },
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
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { year, startDate, endDate, isCurrent, isUpcoming, status } = body

    // Check if academic year exists
    const existingYear = await prisma.academicYear.findUnique({
      where: { id: params.id },
    })

    if (!existingYear) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 404 }
      )
    }

    // Check if new year name conflicts with existing
    if (year && year !== existingYear.year) {
      const conflictingYear = await prisma.academicYear.findUnique({
        where: { year },
      })
      if (conflictingYear) {
        return NextResponse.json(
          { error: "Academic year already exists" },
          { status: 400 }
        )
      }
    }

    // If setting as current, unset all other current years
    if (isCurrent && !existingYear.isCurrent) {
      await prisma.academicYear.updateMany({
        where: { isCurrent: true, id: { not: params.id } },
        data: { isCurrent: false },
      })
    }

    // If setting as upcoming, unset all other upcoming years
    if (isUpcoming && !existingYear.isUpcoming) {
      await prisma.academicYear.updateMany({
        where: { isUpcoming: true, id: { not: params.id } },
        data: { isUpcoming: false },
      })
    }

    const academicYear = await prisma.academicYear.update({
      where: { id: params.id },
      data: {
        ...(year && { year }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(typeof isCurrent === "boolean" && { isCurrent }),
        ...(typeof isUpcoming === "boolean" && { isUpcoming }),
        ...(status && { status }),
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
        entityId: academicYear.id,
        description: `Updated academic year: ${academicYear.year}`,
      }
    )

    return NextResponse.json(academicYear)
  } catch (error) {
    console.error("Failed to update academic year:", error)
    return NextResponse.json(
      { error: "Failed to update academic year" },
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

    // Check if academic year exists
    const existingYear = await prisma.academicYear.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            enrollments: true,
            applications: true,
            results: true,
            fees: true,
            terms: true,
          },
        },
      },
    })

    if (!existingYear) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 404 }
      )
    }

    // Prevent deletion if it's the current year
    if (existingYear.isCurrent) {
      return NextResponse.json(
        { error: "Cannot delete the current academic year. Please set another year as current first." },
        { status: 400 }
      )
    }

    // Check for related data
    const totalRelatedRecords =
      existingYear._count.enrollments +
      existingYear._count.applications +
      existingYear._count.results +
      existingYear._count.fees

    if (totalRelatedRecords > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete academic year with existing data. Found ${existingYear._count.enrollments} enrollments, ${existingYear._count.applications} applications, ${existingYear._count.results} results, and ${existingYear._count.fees} fee records.`,
        },
        { status: 400 }
      )
    }

    // Delete associated terms first
    await prisma.term.deleteMany({
      where: { academicYearId: params.id },
    })

    // Delete the academic year
    await prisma.academicYear.delete({
      where: { id: params.id },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "AcademicYear",
      request,
      {
        entityId: params.id,
        description: `Deleted academic year: ${existingYear.year}`,
      }
    )

    return NextResponse.json({ message: "Academic year deleted successfully" })
  } catch (error) {
    console.error("Failed to delete academic year:", error)
    return NextResponse.json(
      { error: "Failed to delete academic year" },
      { status: 500 }
    )
  }
}
