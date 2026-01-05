import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let studentId = searchParams.get("studentId")
    const feeId = searchParams.get("feeId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Students can only see their own payments
    if (session.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
      })
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      studentId = student.id
    }

    // Parents can see their children's payments
    let parentStudentIds: string[] = []
    if (session.user.role === "PARENT") {
      const parent = await prisma.parent.findUnique({
        where: { userId: session.user.id },
        include: {
          students: {
            select: { id: true },
          },
        },
      })
      if (parent) {
        parentStudentIds = parent.students.map(student => student.id)
      }
      if (parentStudentIds.length === 0) {
        return NextResponse.json([])
      }
    }

    const whereClause: any = {
      ...(studentId ? { studentId } : {}),
      ...(session.user.role === "PARENT" && !studentId ? { studentId: { in: parentStudentIds } } : {}),
      ...(feeId ? { feeId } : {}),
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate)
      }
    }

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        student: {
          include: { user: true },
        },
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
    })

    // Calculate summary statistics
    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
    const paymentCount = payments.length

    return NextResponse.json({
      payments,
      summary: {
        totalPayments,
        paymentCount,
      },
    })
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    )
  }
}
