import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCollectionStatus } from "@/lib/lenco";

// POST - Check and update payment status from Lenco
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json(
        { error: "Reference is required" },
        { status: 400 }
      );
    }

    // Get transaction from database
    const transaction = await prisma.mobileMoneyTransaction.findUnique({
      where: { reference },
      include: {
        payment: {
          include: {
            fee: {
              include: {
                student: { include: { user: true } },
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // If already completed or failed, return current status
    if (transaction.status === "successful" || transaction.status === "failed") {
      return NextResponse.json({
        success: true,
        message: `Payment already ${transaction.status}`,
        data: {
          status: transaction.status,
          completedAt: transaction.completedAt,
          failureReason: transaction.failureReason,
        },
      });
    }

    try {
      // Query Lenco for current status
      const lencoStatus = await getCollectionStatus(reference);

      // Update transaction status
      const updatedTransaction = await prisma.mobileMoneyTransaction.update({
        where: { reference },
        data: {
          status: lencoStatus.data.status,
          completedAt: lencoStatus.data.completedAt
            ? new Date(lencoStatus.data.completedAt)
            : null,
          failureReason: lencoStatus.data.reasonForFailure,
          operatorTransactionId:
            lencoStatus.data.mobileMoneyDetails?.operatorTransactionId,
          accountName: lencoStatus.data.mobileMoneyDetails?.accountName,
        },
      });

      // If payment is successful, update the fee
      if (lencoStatus.data.status === "successful" && transaction.payment) {
        const payment = transaction.payment;
        const fee = payment.fee;

        // Update fee paid amount
        const newPaidAmount = fee.paidAmount + payment.amount;
        let newStatus = fee.status;

        if (newPaidAmount >= fee.amount) {
          newStatus = "PAID";
        } else if (newPaidAmount > 0) {
          newStatus = "PARTIAL";
        }

        await prisma.fee.update({
          where: { id: fee.id },
          data: {
            paidAmount: newPaidAmount,
            status: newStatus,
            paidDate: newStatus === "PAID" ? new Date() : fee.paidDate,
          },
        });

        // Update payment remarks and status
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            transactionId: lencoStatus.data.lencoReference,
            status: "SUCCESS",
            remarks: `Mobile money payment SUCCESSFUL - ${transaction.operator.toUpperCase()} - Operator TX: ${lencoStatus.data.mobileMoneyDetails?.operatorTransactionId || "N/A"}`,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Payment completed successfully!",
          data: {
            status: "successful",
            completedAt: updatedTransaction.completedAt,
            newFeeStatus: newStatus,
            newPaidAmount,
            remainingBalance: fee.amount - newPaidAmount,
          },
        });
      }

      // If payment failed
      if (lencoStatus.data.status === "failed") {
        // Mark the payment as failed (keep for tracking)
        if (transaction.payment) {
          await prisma.payment.update({
            where: { id: transaction.payment.id },
            data: {
              status: "FAILED",
              remarks: `Mobile money payment FAILED - ${transaction.operator.toUpperCase()} - Reason: ${lencoStatus.data.reasonForFailure || "Unknown error"}`,
            },
          });
        }

        return NextResponse.json({
          success: false,
          message: "Payment failed",
          data: {
            status: "failed",
            failureReason: lencoStatus.data.reasonForFailure,
          },
        });
      }

      // Still pending or pay-offline
      return NextResponse.json({
        success: true,
        message:
          lencoStatus.data.status === "pay-offline"
            ? "Waiting for customer authorization on mobile phone"
            : "Payment is being processed",
        data: {
          status: lencoStatus.data.status,
          requiresAction: lencoStatus.data.status === "pay-offline",
        },
      });
    } catch (lencoError: any) {
      console.error("Lenco status check error:", lencoError);
      return NextResponse.json(
        {
          error: "Failed to check payment status with Lenco",
          details: lencoError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Check status error:", error);
    return NextResponse.json(
      { error: "Failed to check payment status", details: error.message },
      { status: 500 }
    );
  }
}
