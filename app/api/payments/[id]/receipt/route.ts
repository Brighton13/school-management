import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"

// Get payment details for receipt
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    
    console.log("Fetching payment with ID:", id)

    const payment = await prisma.$queryRaw`
      SELECT p.*, 
             s.id as "studentId", s."admissionNumber",
             u.name as "studentName", u.email as "studentEmail",
             c.name as "className",
             sec.name as "sectionName",
             f.id as "feeId", f."feeType", f.amount as "feeAmount", f."paidAmount" as "feePaidAmount",
             t.name as "termName",
             ay.year as "academicYear",
             ru.name as "receiverName"
      FROM "Payment" p
      LEFT JOIN "Student" s ON p."studentId" = s.id
      LEFT JOIN "User" u ON s."userId" = u.id
      LEFT JOIN "ClassEnrollment" ce ON s.id = ce."studentId" AND ce.status = 'ACTIVE'
      LEFT JOIN "Class" c ON ce."classId" = c.id
      LEFT JOIN "Section" sec ON ce."sectionId" = sec.id
      LEFT JOIN "Fee" f ON p."feeId" = f.id
      LEFT JOIN "Term" t ON f."termId" = t.id
      LEFT JOIN "AcademicYear" ay ON f."academicYearId" = ay.id
      LEFT JOIN "User" ru ON p."receivedBy" = ru.id
      WHERE p.id = ${id}
      LIMIT 1
    ` as any[]
    
    console.log("Payment query result:", payment)

    if (!payment || payment.length === 0) {
      return NextResponse.json({ error: "Payment not found", id }, { status: 404 })
    }
    
    const paymentRow = payment[0]
    
    // Transform to expected format
    const paymentData = {
      id: paymentRow.id,
      amount: paymentRow.amount,
      paymentMethod: paymentRow.paymentMethod,
      transactionId: paymentRow.transactionId,
      receiptNumber: paymentRow.receiptNumber,
      remarks: paymentRow.remarks,
      createdAt: paymentRow.createdAt,
      studentId: paymentRow.studentId,
      student: {
        user: { 
          name: paymentRow.studentName,
          email: paymentRow.studentEmail,
        },
        admissionNumber: paymentRow.admissionNumber,
        class: paymentRow.className ? { name: paymentRow.className } : null,
        section: paymentRow.sectionName ? { name: paymentRow.sectionName } : null,
      },
      fee: {
        feeType: paymentRow.feeType,
        amount: paymentRow.feeAmount,
        paidAmount: paymentRow.feePaidAmount,
        term: { name: paymentRow.termName },
        academicYear: { year: paymentRow.academicYear },
      },
      receiver: paymentRow.receiverName ? { name: paymentRow.receiverName } : null,
    }

    // Check access - students/parents can only see their own
    if (session.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
      })
      if (!student || student.id !== paymentData.studentId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    if (session.user.role === "PARENT") {
      const parent = await prisma.parent.findUnique({
        where: { userId: session.user.id },
        include: { students: { select: { id: true } } },
      })
      if (!parent || !parent.students.some(s => s.id === paymentData.studentId)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 })
      }
    }

    // Get school settings for receipt header
    const schoolConfig = await prisma.schoolConfig.findFirst()
    const schoolName = schoolConfig?.schoolName || "School Management System"

    return NextResponse.json({
      payment: paymentData,
      schoolName,
    })
  } catch (error: any) {
    console.error("Error fetching payment:", error)
    console.error("Error details:", error.message, error.stack)
    return NextResponse.json(
      { error: "Failed to fetch payment details", details: error.message },
      { status: 500 }
    )
  }
}

// Send receipt via email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { email } = body

    const paymentResult = await prisma.$queryRaw`
      SELECT p.*, 
             s.id as "studentId", s."admissionNumber",
             u.name as "studentName", u.email as "studentEmail",
             c.name as "className",
             sec.name as "sectionName",
             f.id as "feeId", f."feeType", f.amount as "feeAmount", f."paidAmount" as "feePaidAmount",
             t.name as "termName",
             ay.year as "academicYear",
             ru.name as "receiverName"
      FROM "Payment" p
      LEFT JOIN "Student" s ON p."studentId" = s.id
      LEFT JOIN "User" u ON s."userId" = u.id
      LEFT JOIN "ClassEnrollment" ce ON s.id = ce."studentId" AND ce.status = 'ACTIVE'
      LEFT JOIN "Class" c ON ce."classId" = c.id
      LEFT JOIN "Section" sec ON ce."sectionId" = sec.id
      LEFT JOIN "Fee" f ON p."feeId" = f.id
      LEFT JOIN "Term" t ON f."termId" = t.id
      LEFT JOIN "AcademicYear" ay ON f."academicYearId" = ay.id
      LEFT JOIN "User" ru ON p."receivedBy" = ru.id
      WHERE p.id = ${id}
      LIMIT 1
    ` as any[]

    if (!paymentResult || paymentResult.length === 0) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    const paymentRow = paymentResult[0]
    
    // Transform to expected format
    const payment = {
      id: paymentRow.id,
      amount: paymentRow.amount,
      paymentMethod: paymentRow.paymentMethod,
      transactionId: paymentRow.transactionId,
      receiptNumber: paymentRow.receiptNumber,
      remarks: paymentRow.remarks,
      createdAt: paymentRow.createdAt,
      student: {
        user: { 
          name: paymentRow.studentName,
          email: paymentRow.studentEmail,
        },
        admissionNumber: paymentRow.admissionNumber,
        class: paymentRow.className ? { name: paymentRow.className } : null,
        section: paymentRow.sectionName ? { name: paymentRow.sectionName } : null,
      },
      fee: {
        feeType: paymentRow.feeType,
        amount: paymentRow.feeAmount,
        paidAmount: paymentRow.feePaidAmount,
        term: { name: paymentRow.termName },
        academicYear: { year: paymentRow.academicYear },
      },
      receiver: paymentRow.receiverName ? { name: paymentRow.receiverName } : null,
    }

    // Get school config
    const schoolConfig = await prisma.schoolConfig.findFirst()
    const schoolName = schoolConfig?.schoolName || "School Management System"

    // Format currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'ZMW',
        minimumFractionDigits: 2,
      }).format(amount)
    }

    // Format date
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    const totalPaid = payment.fee.paidAmount
    const remainingBalance = payment.fee.amount - payment.fee.paidAmount

    // Generate email HTML
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0 0 5px 0; font-size: 24px; }
        .header p { margin: 0; opacity: 0.9; font-size: 14px; }
        .receipt-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; margin-top: 15px; font-size: 12px; }
        .content { padding: 30px; }
        .success-icon { text-align: center; margin-bottom: 20px; }
        .success-icon .circle { display: inline-block; width: 60px; height: 60px; background: #10B981; border-radius: 50%; line-height: 60px; font-size: 30px; color: white; }
        .amount-box { background: #F0FDF4; border: 2px solid #10B981; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
        .amount-box .label { color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .amount-box .amount { font-size: 36px; font-weight: bold; color: #10B981; margin: 5px 0; }
        .details { background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { color: #666; }
        .detail-value { font-weight: 600; color: #333; }
        .summary-box { background: #EFF6FF; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .summary-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .balance { color: ${remainingBalance > 0 ? '#EF4444' : '#10B981'}; font-weight: bold; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .footer p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${schoolName}</h1>
          <p>Official Payment Receipt</p>
          <div class="receipt-badge">Receipt #${payment.receiptNumber}</div>
        </div>
        
        <div class="content">
          <div class="success-icon">
            <div class="circle">✓</div>
          </div>
          
          <div class="amount-box">
            <div class="label">Amount Paid</div>
            <div class="amount">${formatCurrency(payment.amount)}</div>
            <div style="color: #666; font-size: 14px;">${formatDate(payment.createdAt)}</div>
          </div>

          <div class="details">
            <h3 style="margin-top: 0; color: #333;">Student Information</h3>
            <div class="detail-row">
              <span class="detail-label">Name</span>
              <span class="detail-value">${payment.student.user.name}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Admission No.</span>
              <span class="detail-value">${payment.student.admissionNumber}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Class</span>
              <span class="detail-value">${payment.student.class?.name || 'N/A'} ${payment.student.section?.name || ''}</span>
            </div>
          </div>

          <div class="details">
            <h3 style="margin-top: 0; color: #333;">Payment Details</h3>
            <div class="detail-row">
              <span class="detail-label">Fee Type</span>
              <span class="detail-value">${payment.fee.feeType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Term</span>
              <span class="detail-value">${payment.fee.term.name} - ${payment.fee.academicYear.year}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment Method</span>
              <span class="detail-value">${payment.paymentMethod.replace('_', ' ')}</span>
            </div>
            ${payment.transactionId ? `
            <div class="detail-row">
              <span class="detail-label">Transaction ID</span>
              <span class="detail-value">${payment.transactionId}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Received By</span>
              <span class="detail-value">${payment.receiver?.name || 'System'}</span>
            </div>
          </div>

          <div class="summary-box">
            <h3 style="margin-top: 0; color: #1E40AF;">Fee Summary</h3>
            <div class="summary-row">
              <span>Total Fee Amount</span>
              <span>${formatCurrency(payment.fee.amount)}</span>
            </div>
            <div class="summary-row">
              <span>Total Paid</span>
              <span style="color: #10B981;">${formatCurrency(totalPaid)}</span>
            </div>
            <div class="summary-row" style="border-top: 1px solid #BFDBFE; padding-top: 10px; margin-top: 5px;">
              <span><strong>Balance Due</strong></span>
              <span class="balance">${formatCurrency(remainingBalance)}</span>
            </div>
          </div>

          ${payment.remarks ? `
          <div style="background: #FEF3C7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <strong style="color: #92400E;">Remarks:</strong>
            <p style="margin: 5px 0 0 0; color: #78350F;">${payment.remarks}</p>
          </div>
          ` : ''}
        </div>

        <div class="footer">
          <p><strong>Thank you for your payment!</strong></p>
          <p>This is a computer-generated receipt. For any queries, please contact the school accounts office.</p>
          <p style="color: #999; margin-top: 15px;">Generated on ${formatDate(new Date())}</p>
        </div>
      </div>
    </body>
    </html>
    `

    // Send email
    const recipientEmail = email || payment.student.user.email
    if (!recipientEmail) {
      return NextResponse.json({ error: "No email address available" }, { status: 400 })
    }

    await sendEmail(
      recipientEmail,
      `Payment Receipt - ${payment.receiptNumber}`,
      emailHtml
    )

    return NextResponse.json({
      success: true,
      message: `Receipt sent to ${recipientEmail}`,
    })
  } catch (error: any) {
    console.error("Error sending receipt:", error)
    return NextResponse.json(
      { error: error.message || "Failed to send receipt" },
      { status: 500 }
    )
  }
}
