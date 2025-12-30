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

    const exam = await prisma.exam.findUnique({
      where: { id: params.id },
      include: {
        term: true,
        academicYear: true,
        creator: true,
        _count: {
          select: { results: true },
        },
      },
    })

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    return NextResponse.json(exam)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch exam" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      examType,
      startDate,
      endDate,
      isFinal,
      requiresApproval,
      status,
    } = body

    const updatedExam = await prisma.exam.update({
      where: { id: params.id },
      data: {
        name,
        description: description !== undefined ? description : null,
        examType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isFinal,
        requiresApproval,
        status,
      },
      include: {
        term: true,
        academicYear: true,
        creator: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Exam",
      request,
      {
        entityId: params.id,
        description: `Updated exam: ${updatedExam.name}`,
      }
    )

    return NextResponse.json(updatedExam)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update exam" },
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
    const { action } = body // "approve" or "reject"

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'" },
        { status: 400 }
      )
    }

    const exam = await prisma.exam.findUnique({
      where: { id: params.id },
    })

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    const updatedExam = await prisma.exam.update({
      where: { id: params.id },
      data: {
        status: action === "approve" ? "ACTIVE" : "DRAFT",
      },
      include: {
        term: true,
        academicYear: true,
        creator: true,
        _count: {
          select: { results: true },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      action === "approve" ? "APPROVE" : "REJECT",
      "Exam",
      request,
      {
        entityId: params.id,
        description: `${action === "approve" ? "Approved" : "Rejected"} exam: ${updatedExam.name}`,
      }
    )

    return NextResponse.json(updatedExam)
  } catch (error) {
    console.error("Error updating exam approval:", error)
    return NextResponse.json(
      { error: "Failed to update exam approval" },
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

    // Get exam info before deletion for audit trail
    const exam = await prisma.exam.findUnique({
      where: { id: params.id },
    })

    // Log audit trail before deletion
    if (exam) {
      await logAuditTrail(
        session.user.id,
        "DELETE",
        "Exam",
        request,
        {
          entityId: params.id,
          description: `Deleted exam: ${exam.name}`,
        }
      )
    }

    await prisma.exam.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete exam" },
      { status: 500 }
    )
  }
}

