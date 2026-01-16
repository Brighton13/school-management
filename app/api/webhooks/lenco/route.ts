import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lenco Webhook Handler for payment status updates
// Configure this URL in your Lenco dashboard as the webhook endpoint

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (recommended for production)
    // const signature = request.headers.get("x-lenco-signature");
    // TODO: Implement signature verification using your webhook secret

    const body = await request.json();
    const { event, data } = body;

    console.log("Lenco webhook received:", { event, reference: data?.reference });

    // Handle collection events
    if (event === "collection.successful" || event === "collection.failed") {
      const { reference, status, reasonForFailure, completedAt, mobileMoneyDetails } =
        data;

      // Find the transaction by reference
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
        console.log("Transaction not found for reference:", reference);
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }

      // Update transaction status
      await prisma.mobileMoneyTransaction.update({
        where: { reference },
        data: {
          status,
          completedAt: completedAt ? new Date(completedAt) : null,
          failureReason: reasonForFailure,
          operatorTransactionId: mobileMoneyDetails?.operatorTransactionId,
          accountName: mobileMoneyDetails?.accountName,
        },
      });

      if (status === "successful" && transaction.payment) {
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

        // Update payment with final transaction details
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            transactionId: data.lencoReference,
            remarks: `Mobile money payment SUCCESSFUL - ${transaction.operator.toUpperCase()} - Operator TX: ${mobileMoneyDetails?.operatorTransactionId || "N/A"}`,
          },
        });

        // Create notification for the payment
        try {
          await prisma.notification.create({
            data: {
              userId: fee.student.userId,
              title: "Payment Received",
              message: `Your mobile money payment of K${payment.amount.toFixed(2)} for ${fee.feeType} has been received. Receipt: ${payment.receiptNumber}`,
              type: "PAYMENT",
            },
          });
        } catch (notifError) {
          console.log("Failed to create notification:", notifError);
        }

        console.log("Payment successful:", {
          reference,
          amount: payment.amount,
          feeId: fee.id,
          newStatus,
        });
      } else if (status === "failed" && transaction.payment) {
        // Delete the pending payment record
        await prisma.payment.delete({
          where: { id: transaction.payment.id },
        });

        // Notify user about failed payment
        try {
          await prisma.notification.create({
            data: {
              userId: transaction.payment.fee.student.userId,
              title: "Payment Failed",
              message: `Your mobile money payment of K${transaction.amount.toFixed(2)} failed. Reason: ${reasonForFailure || "Unknown error"}. Please try again.`,
              type: "PAYMENT",
            },
          });
        } catch (notifError) {
          console.log("Failed to create notification:", notifError);
        }

        console.log("Payment failed:", { reference, reason: reasonForFailure });
      }

      return NextResponse.json({ received: true, status: "processed" });
    }

    // Handle other events if needed
    console.log("Unhandled webhook event:", event);
    return NextResponse.json({ received: true, status: "ignored" });
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed", details: error.message },
      { status: 500 }
    );
  }
}

// Allow GET for webhook verification (if Lenco requires it)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: "active",
    message: "Lenco webhook endpoint is active",
  });
}
