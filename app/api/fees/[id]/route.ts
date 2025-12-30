import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      paidAmount,
      paymentMethod,
      transactionId,
      remarks,
      status,
    } = body

    // Get current fee details
    const currentFee = await prisma.fee.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: { user: true },
        },
      },
    })

    if (!currentFee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    }

    // Calculate new status based on payment
    let newStatus = status
    if (paidAmount !== undefined) {
      const totalPaid = parseFloat(paidAmount)
      if (totalPaid >= currentFee.amount) {
        newStatus = "PAID"
      } else if (totalPaid > 0) {
        newStatus = "PARTIAL"
      } else {
        newStatus = "PENDING"
      }

      // Check if overdue
      if (newStatus !== "PAID" && new Date() > currentFee.dueDate) {
        newStatus = "OVERDUE"
      }
    }

    const updatedFee = await prisma.fee.update({
      where: { id: params.id },
      data: {
        ...(paidAmount !== undefined ? { 
          paidAmount: parseFloat(paidAmount),
          paidDate: parseFloat(paidAmount) > 0 ? new Date() : null,
        } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(transactionId ? { transactionId } : {}),
        ...(remarks !== undefined ? { remarks } : {}),
        status: newStatus,
      },
      include: {
        student: {
          include: { user: true },
        },
        term: true,
        academicYear: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Fee",
      request,
      {
        entityId: params.id,
        description: `Updated fee for ${currentFee.student.user.name} - Status: ${newStatus}`,
        metadata: { oldStatus: currentFee.status, newStatus, paidAmount },
      }
    )

    return NextResponse.json(updatedFee)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update fee", details: error.message },
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

    const fee = await prisma.fee.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: { user: true },
        },
      },
    })

    if (!fee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    }

    await prisma.fee.delete({
      where: { id: params.id },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "Fee",
      request,
      {
        entityId: params.id,
        description: `Deleted fee for ${fee.student.user.name} (${fee.feeType})`,
      }
    )

    return NextResponse.json({ message: "Fee deleted successfully" })
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete fee", details: error.message },
      { status: 500 }
    )
  }
}