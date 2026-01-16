import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  initiateMobileMoneyCollection,
  generatePaymentReference,
  LencoMobileMoneyRequest,
} from "@/lib/lenco";
import { requirePermission, Permissions } from "@/lib/permissions";
import { logAuditTrail } from "@/lib/audit";

// Helper to generate receipt number
function generateReceiptNumber(): string {
  const prefix = "RCP";
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// POST - Initiate mobile money payment
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.FEES_UPDATE);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      feeId,
      amount,
      phone,
      operator,
      country = "zm",
      bearer = "merchant",
    } = body;

    // Validate required fields
    if (!feeId || !amount || !phone || !operator) {
      return NextResponse.json(
        { error: "Missing required fields: feeId, amount, phone, operator" },
        { status: 400 }
      );
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?\d{10,15}$/;
    if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    // Get the fee details
    const fee = await prisma.fee.findUnique({
      where: { id: feeId },
      include: {
        student: {
          include: { user: true },
        },
      },
    });

    if (!fee) {
      return NextResponse.json({ error: "Fee not found" }, { status: 404 });
    }

    // Validate payment amount
    const paymentAmount = parseFloat(amount);
    const remainingBalance = fee.amount - fee.paidAmount;

    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be greater than 0" },
        { status: 400 }
      );
    }

    if (paymentAmount > remainingBalance) {
      return NextResponse.json(
        {
          error: `Payment amount (${paymentAmount}) exceeds remaining balance (${remainingBalance})`,
        },
        { status: 400 }
      );
    }

    // Generate unique reference
    const reference = generatePaymentReference("FEE");

    // Create pending payment record in database
    const pendingPayment = await prisma.payment.create({
      data: {
        feeId,
        studentId: fee.studentId,
        amount: paymentAmount,
        paymentMethod: "MOBILE_MONEY",
        transactionId: reference, // Store reference temporarily
        receiptNumber: generateReceiptNumber(),
        remarks: `Mobile money payment initiated - ${operator.toUpperCase()} (${country.toUpperCase()}) - Phone: ${phone} - Status: PENDING`,
        receivedBy: session.user.id,
      },
    });

    // Store mobile money transaction details
    await prisma.mobileMoneyTransaction.create({
      data: {
        paymentId: pendingPayment.id,
        reference,
        phone: phone.replace(/\s/g, ""),
        operator,
        country,
        amount: paymentAmount,
        status: "pending",
        bearer,
      },
    });

    try {
      // Initiate Lenco mobile money collection
      const lencoRequest: LencoMobileMoneyRequest = {
        amount: paymentAmount,
        reference,
        phone: phone.replace(/\s/g, ""),
        operator: operator as "airtel" | "mtn" | "tnm",
        country: country as "zm" | "mw",
        bearer: bearer as "merchant" | "customer",
      };

      const lencoResponse = await initiateMobileMoneyCollection(lencoRequest);

      // Update transaction with Lenco response
      await prisma.mobileMoneyTransaction.update({
        where: { reference },
        data: {
          lencoId: lencoResponse.data.id,
          lencoReference: lencoResponse.data.lencoReference,
          status: lencoResponse.data.status,
          initiatedAt: new Date(lencoResponse.data.initiatedAt),
        },
      });

      // Update payment remarks with status
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          remarks: `Mobile money payment - ${operator.toUpperCase()} (${country.toUpperCase()}) - Status: ${lencoResponse.data.status.toUpperCase()} - Customer must authorize on phone`,
        },
      });

      // Log audit trail
      await logAuditTrail(session.user.id, "CREATE", "MobileMoneyPayment", request, {
        entityId: pendingPayment.id,
        description: `Mobile money payment initiated for ${fee.student.user.name}`,
        metadata: {
          feeId,
          studentId: fee.studentId,
          studentName: fee.student.user.name,
          amount: paymentAmount,
          reference,
          operator,
          country,
          lencoStatus: lencoResponse.data.status,
        },
      });

      return NextResponse.json({
        success: true,
        message:
          lencoResponse.data.status === "pay-offline"
            ? "Payment initiated. Customer must authorize on their mobile phone."
            : "Payment request sent successfully.",
        data: {
          paymentId: pendingPayment.id,
          reference,
          lencoReference: lencoResponse.data.lencoReference,
          status: lencoResponse.data.status,
          amount: paymentAmount,
          phone,
          operator,
          receiptNumber: pendingPayment.receiptNumber,
        },
      });
    } catch (lencoError: any) {
      // If Lenco API fails, update the payment and transaction status
      await prisma.mobileMoneyTransaction.update({
        where: { reference },
        data: {
          status: "failed",
          failureReason: lencoError.message,
        },
      });

      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          remarks: `Mobile money payment FAILED - ${lencoError.message}`,
        },
      });

      // Delete the failed payment record (or keep for audit)
      await prisma.payment.delete({
        where: { id: pendingPayment.id },
      });

      return NextResponse.json(
        {
          error: "Failed to initiate mobile money payment",
          details: lencoError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Mobile money payment error:", error);
    return NextResponse.json(
      { error: "Failed to process mobile money payment", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Get mobile money payment status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const reference = searchParams.get("reference");
    const paymentId = searchParams.get("paymentId");

    if (!reference && !paymentId) {
      return NextResponse.json(
        { error: "Reference or paymentId is required" },
        { status: 400 }
      );
    }

    const whereClause: { reference?: string; paymentId?: string } = {};
    if (reference) {
      whereClause.reference = reference;
    } else if (paymentId) {
      whereClause.paymentId = paymentId;
    }

    const transaction = await prisma.mobileMoneyTransaction.findFirst({
      where: whereClause,
      include: {
        payment: {
          include: {
            fee: true,
            student: {
              include: { user: true },
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

    return NextResponse.json({
      success: true,
      data: {
        id: transaction.id,
        paymentId: transaction.paymentId,
        reference: transaction.reference,
        lencoReference: transaction.lencoReference,
        phone: transaction.phone,
        operator: transaction.operator,
        country: transaction.country,
        amount: transaction.amount,
        status: transaction.status,
        initiatedAt: transaction.initiatedAt,
        completedAt: transaction.completedAt,
        failureReason: transaction.failureReason,
        payment: transaction.payment,
      },
    });
  } catch (error: any) {
    console.error("Get mobile money status error:", error);
    return NextResponse.json(
      { error: "Failed to get payment status", details: error.message },
      { status: 500 }
    );
  }
}
