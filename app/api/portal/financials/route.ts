import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function remainingAmount(fee: { amount: number; paidAmount: number }) {
  return Math.max(0, fee.amount - fee.paidAmount)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!["STUDENT", "PARENT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const requestedStudentId = searchParams.get("studentId")

    let allowedStudentIds: string[] = []
    if (session.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      if (!student) {
        return NextResponse.json({ error: "Student record not found" }, { status: 404 })
      }
      allowedStudentIds = [student.id]
    } else {
      const parent = await prisma.parent.findUnique({
        where: { userId: session.user.id },
        include: {
          students: {
            select: { studentId: true },
          },
        },
      })
      allowedStudentIds = parent?.students.map((student) => student.studentId) || []
      if (allowedStudentIds.length === 0) {
        return NextResponse.json({
          students: [],
          summary: { totalBilled: 0, totalPaid: 0, outstanding: 0, overdue: 0, pendingFeeCount: 0, paymentCount: 0 },
        })
      }
      if (requestedStudentId && !allowedStudentIds.includes(requestedStudentId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const scopedStudentIds = requestedStudentId ? [requestedStudentId] : allowedStudentIds

    const students = await prisma.student.findMany({
      where: { id: { in: scopedStudentIds } },
      include: {
        user: {
          select: { name: true, email: true },
        },
        classEnrollment: {
          where: { status: "ACTIVE" },
          include: {
            class: true,
            section: true,
            academicYear: true,
          },
          orderBy: { enrolledAt: "desc" },
          take: 1,
        },
        fees: {
          include: {
            term: true,
            academicYear: true,
            payments: {
              include: {
                receiver: {
                  select: { id: true, name: true },
                },
                mobileMoneyTransaction: {
                  select: { status: true, failureReason: true, operator: true, phone: true },
                },
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: [{ academicYear: { year: "desc" } }, { dueDate: "desc" }],
        },
        payments: {
          include: {
            fee: {
              include: {
                term: true,
                academicYear: true,
              },
            },
            receiver: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { admissionNumber: "asc" },
    })

    const studentFinancials = students.map((student) => {
      const totalBilled = student.fees.reduce((sum, fee) => sum + fee.amount, 0)
      const totalPaid = student.fees.reduce((sum, fee) => sum + fee.paidAmount, 0)
      const pendingFees = student.fees.filter((fee) => remainingAmount(fee) > 0)
      const overdueFees = pendingFees.filter((fee) => fee.status === "OVERDUE" || fee.dueDate < new Date())
      const enrollment = student.classEnrollment[0]

      return {
        student: {
          id: student.id,
          name: student.user.name,
          admissionNumber: student.admissionNumber,
          className: enrollment ? `${enrollment.class.name} - ${enrollment.section.name}` : "Not enrolled",
        },
        summary: {
          totalBilled,
          totalPaid,
          outstanding: totalBilled - totalPaid,
          overdue: overdueFees.reduce((sum, fee) => sum + remainingAmount(fee), 0),
          pendingFeeCount: pendingFees.length,
          paymentCount: student.payments.length,
        },
        pendingFees: pendingFees.map((fee) => ({
          id: fee.id,
          feeType: fee.feeType,
          academicYear: fee.academicYear.year,
          term: fee.term.name,
          amount: fee.amount,
          paidAmount: fee.paidAmount,
          remainingAmount: remainingAmount(fee),
          dueDate: fee.dueDate.toISOString(),
          status: fee.status,
        })),
        payments: student.payments.map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          receiptNumber: payment.receiptNumber,
          status: payment.status,
          paidAt: payment.createdAt.toISOString(),
          receivedBy: payment.receiver.name,
          feeType: payment.fee.feeType,
          academicYear: payment.fee.academicYear.year,
          term: payment.fee.term.name,
        })),
        fees: student.fees.map((fee) => ({
          id: fee.id,
          feeType: fee.feeType,
          academicYear: fee.academicYear.year,
          term: fee.term.name,
          amount: fee.amount,
          paidAmount: fee.paidAmount,
          remainingAmount: remainingAmount(fee),
          dueDate: fee.dueDate.toISOString(),
          status: fee.status,
        })),
      }
    })

    const summary = studentFinancials.reduce(
      (totals, item) => ({
        totalBilled: totals.totalBilled + item.summary.totalBilled,
        totalPaid: totals.totalPaid + item.summary.totalPaid,
        outstanding: totals.outstanding + item.summary.outstanding,
        overdue: totals.overdue + item.summary.overdue,
        pendingFeeCount: totals.pendingFeeCount + item.summary.pendingFeeCount,
        paymentCount: totals.paymentCount + item.summary.paymentCount,
      }),
      { totalBilled: 0, totalPaid: 0, outstanding: 0, overdue: 0, pendingFeeCount: 0, paymentCount: 0 }
    )

    return NextResponse.json({ students: studentFinancials, summary })
  } catch (error) {
    console.error("Portal financials error:", error)
    return NextResponse.json({ error: "Failed to load financials" }, { status: 500 })
  }
}
