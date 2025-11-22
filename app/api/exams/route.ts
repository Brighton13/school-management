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
    const academicTermId = searchParams.get("academicTermId")
    const status = searchParams.get("status")

    const exams = await prisma.exam.findMany({
      where: {
        ...(academicTermId ? { academicTermId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        academicTerm: true,
        creator: true,
        _count: {
          select: { results: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(exams)
  } catch (error: any) {
    console.error("Error fetching exams:", error)
    return NextResponse.json(
      { error: "Failed to fetch exams", details: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      examType,
      academicTermId,
      startDate,
      endDate,
      isFinal,
      requiresApproval,
      status,
    } = body

    const exam = await prisma.exam.create({
      data: {
        name,
        description: description || null,
        examType,
        academicTermId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isFinal: isFinal || false,
        requiresApproval: requiresApproval !== false,
        status: status || "DRAFT",
        createdBy: session.user.id,
      },
      include: {
        academicTerm: true,
        creator: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Exam",
      request,
      {
        entityId: exam.id,
        description: `Created exam: ${name} (${examType})`,
      }
    )

    return NextResponse.json(exam, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create exam" },
      { status: 500 }
    )
  }
}

