import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

// Generate receipt number
function generateReceiptNumber(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `RCP-${year}${month}${day}-${random}`
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const fee = await prisma.fee.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: { user: true },
        },
        term: true,
        academicYear: true,
        payments: {
          include: {
            receiver: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!fee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    }

    return NextResponse.json(fee)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch fee" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.FEES_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      paymentAmount, // New payment amount (not total paid)
      paymentMethod,
      transactionId,
      remarks,
      status,
    } = body

    // Get current fee details with existing payments
    const currentFee = await prisma.fee.findUnique({
      where: { id: params.id },
      include: {
        student: {
          include: { user: true },
        },
        payments: true,
      },
    })

    if (!currentFee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 })
    }

    // If a payment amount is provided, create a payment record
    if (paymentAmount !== undefined && parseFloat(paymentAmount) > 0) {
      const paymentAmountNum = parseFloat(paymentAmount)
      const remainingBalance = currentFee.amount - currentFee.paidAmount
      
      // Validate payment doesn't exceed remaining balance
      if (paymentAmountNum > remainingBalance) {
        return NextResponse.json(
          { error: `Payment amount (${paymentAmountNum}) exceeds remaining balance (${remainingBalance})` },
          { status: 400 }
        )
      }

      // Create payment record
      const payment = await prisma.payment.create({
        data: {
          feeId: params.id,
          studentId: currentFee.studentId,
          amount: paymentAmountNum,
          paymentMethod: paymentMethod || "CASH",
          transactionId: transactionId || null,
          receiptNumber: generateReceiptNumber(),
          remarks: remarks || null,
          receivedBy: session.user.id,
        },
      })

      // Calculate new total paid amount
      const newPaidAmount = currentFee.paidAmount + paymentAmountNum
      
      // Determine new status
      let newStatus = "PARTIAL"
      if (newPaidAmount >= currentFee.amount) {
        newStatus = "PAID"
      } else if (newPaidAmount > 0) {
        newStatus = "PARTIAL"
      } else {
        newStatus = "PENDING"
      }

      // Check if overdue (only if not fully paid)
      if (newStatus !== "PAID" && new Date() > currentFee.dueDate) {
        newStatus = "OVERDUE"
      }

      // Update fee with new paid amount
      const updatedFee = await prisma.fee.update({
        where: { id: params.id },
        data: {
          paidAmount: newPaidAmount,
          paidDate: new Date(),
          paymentMethod: paymentMethod || currentFee.paymentMethod,
          transactionId: transactionId || currentFee.transactionId,
          remarks: remarks !== undefined ? remarks : currentFee.remarks,
          status: newStatus,
        },
        include: {
          student: {
            include: { user: true },
          },
          term: true,
          academicYear: true,
          payments: {
            include: {
              receiver: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      // Log audit trail
      await logAuditTrail(
        session.user.id,
        "CREATE",
        "Payment",
        request,
        {
          entityId: payment.id,
          description: `Payment of K${paymentAmountNum} received for ${currentFee.student.user.name} - ${currentFee.feeType}. Receipt: ${payment.receiptNumber}. Total paid: K${newPaidAmount}/${currentFee.amount}`,
          metadata: { 
            paymentId: payment.id,
            feeId: params.id,
            amount: paymentAmountNum,
            receiptNumber: payment.receiptNumber,
            previousPaid: currentFee.paidAmount,
            newTotalPaid: newPaidAmount,
            remainingBalance: currentFee.amount - newPaidAmount,
          },
        }
      )

      return NextResponse.json({
        ...updatedFee,
        latestPayment: payment,
        message: `Payment of K${paymentAmountNum} recorded successfully. Receipt: ${payment.receiptNumber}`,
      })
    }

    // If no payment amount, just update other fields (status update, remarks, etc.)
    let newStatus = status || currentFee.status
    
    // Recalculate status based on current paid amount
    if (!status) {
      if (currentFee.paidAmount >= currentFee.amount) {
        newStatus = "PAID"
      } else if (currentFee.paidAmount > 0) {
        newStatus = "PARTIAL"
      } else {
        newStatus = "PENDING"
      }
      
      if (newStatus !== "PAID" && new Date() > currentFee.dueDate) {
        newStatus = "OVERDUE"
      }
    }

    const updatedFee = await prisma.fee.update({
      where: { id: params.id },
      data: {
        ...(remarks !== undefined ? { remarks } : {}),
        status: newStatus,
      },
      include: {
        student: {
          include: { user: true },
        },
        term: true,
        academicYear: true,
        payments: {
          include: {
            receiver: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
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
        metadata: { oldStatus: currentFee.status, newStatus },
      }
    )

    return NextResponse.json(updatedFee)
  } catch (error: any) {
    console.error("Error updating fee:", error)
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
    const session = await requirePermission(request, Permissions.FEES_DELETE)
    if (!session) {
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