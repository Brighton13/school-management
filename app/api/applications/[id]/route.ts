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
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: { user: true },
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
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(application)
  } catch (error) {
    console.error("Failed to fetch application:", error)
    return NextResponse.json(
      { error: "Failed to fetch application" },
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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { appliedClassId, appliedSectionId, academicYear, notes } = body

    const application = await prisma.application.update({
      where: { id: params.id },
      data: {
        ...(appliedClassId && { appliedClassId }),
        ...(appliedSectionId !== undefined && { appliedSectionId }),
        ...(academicYear && { academicYear }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        student: {
          include: { user: true },
        },
        appliedClass: true,
        appliedSection: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Application",
      request,
      {
        entityId: application.id,
        description: `Updated application for ${application.student.user.name}`,
      }
    )

    return NextResponse.json(application)
  } catch (error) {
    console.error("Failed to update application:", error)
    return NextResponse.json(
      { error: "Failed to update application" },
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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const application = await prisma.application.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: { user: true },
        },
      },
    })

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      )
    }

    await prisma.application.delete({
      where: { id: params.id },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "Application",
      request,
      {
        entityId: params.id,
        description: `Deleted application for ${application.student.user.name}`,
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete application:", error)
    return NextResponse.json(
      { error: "Failed to delete application" },
      { status: 500 }
    )
  }
}
