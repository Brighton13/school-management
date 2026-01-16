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
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { rejectionReason } = body

    if (!rejectionReason) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      )
    }

    // Get the application
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

    if (application.applicationStatus !== "PENDING") {
      return NextResponse.json(
        { error: "Application has already been processed" },
        { status: 400 }
      )
    }

    // Update application status
    const updatedApplication = await prisma.application.update({
      where: { id: params.id },
      data: {
        applicationStatus: "REJECTED",
        rejectionReason,
        approvedBy: session.user.id,
        approvedAt: new Date(),
      },
      include: {
        student: {
          include: { user: true },
        },
        appliedClass: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "REJECT",
      "Application",
      request,
      {
        entityId: params.id,
        description: `Rejected application for ${application.student.user.name}. Reason: ${rejectionReason}`,
      }
    )

    return NextResponse.json(updatedApplication)
  } catch (error) {
    console.error("Failed to reject application:", error)
    return NextResponse.json(
      { error: "Failed to reject application" },
      { status: 500 }
    )
  }
}
