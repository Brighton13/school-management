import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let studentId = searchParams.get("studentId")
    const status = searchParams.get("status")
    const feeType = searchParams.get("feeType")
    const termId = searchParams.get("termId")
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

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
        return NextResponse.json(noPagination ? [] : createPaginatedResponse([], 0, page, limit))
      }
    }

    // Build where clause
    const whereClause: any = {
      ...(studentId ? { studentId } : {}),
      ...(session.user.role === "PARENT" && !studentId ? { studentId: { in: parentStudentIds } } : {}),
      ...(status ? { status } : {}),
      ...(feeType ? { feeType } : {}),
      ...(termId ? { termId } : {}),
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { student: { admissionNumber: { contains: search, mode: "insensitive" } } },
        { student: { user: { name: { contains: search, mode: "insensitive" } } } },
        { feeType: { contains: search, mode: "insensitive" } },
      ]
    }

    // Get total count
    const total = await prisma.fee.count({ where: whereClause })

    const fees = await prisma.fee.findMany({
      where: whereClause,
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
            mobileMoneyTransaction: {
              select: { status: true, failureReason: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { dueDate: "desc" },
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(fees)
    }

    return NextResponse.json(createPaginatedResponse(fees, total, page, limit))
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
    const session = await requirePermission(request, Permissions.FEES_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      studentId,
      termId,
      academicYearId,
      feeType,
      amount,
      dueDate,
      remarks,
    } = body

    const fee = await prisma.fee.create({
      data: {
        studentId,
        termId,
        academicYearId,
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
        term: true,
        academicYear: true,
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

