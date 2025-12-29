import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let studentId = searchParams.get("studentId")
    const status = searchParams.get("status")

    // Students can only see their own fees
    if (session.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
      })
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      studentId = student.id
    }

    // Parents can see their children's fees
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

    const fees = await prisma.fee.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(session.user.role === "PARENT" && !studentId ? { studentId: { in: parentStudentIds } } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        student: {
          include: { user: true },
        },
        academicTerm: true,
      },
      orderBy: { dueDate: "desc" },
    })

    return NextResponse.json(fees)
  } catch (error) {
    console.error("Error fetching fees:", error)
    return NextResponse.json(
      { error: "Failed to fetch fees" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      studentId,
      academicTermId,
      feeType,
      amount,
      dueDate,
      remarks,
    } = body

    const fee = await prisma.fee.create({
      data: {
        studentId,
        academicTermId,
        feeType,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        remarks,
        createdBy: session.user.id,
      },
      include: {
        student: {
          include: { user: true },
        },
        academicTerm: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Fee",
      request,
      {
        entityId: fee.id,
        description: `Created fee for ${fee.student.user.name}: ${feeType} - ${amount}`,
      }
    )

    return NextResponse.json(fee, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create fee" },
      { status: 500 }
    )
  }
}

