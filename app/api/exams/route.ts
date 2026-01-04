import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const termId = searchParams.get("termId")
    const academicYearId = searchParams.get("academicYearId")
    const status = searchParams.get("status")
    const classId = searchParams.get("classId")
    const hasApprovedResults = searchParams.get("hasApprovedResults")

    // Build the where clause
    const whereClause: any = {
      ...(termId ? { termId } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(status ? { status } : {}),
      ...(classId ? { classId } : {}),
    }

    // If hasApprovedResults is true, only return exams that have at least one approved/published result
    if (hasApprovedResults === "true") {
      whereClause.results = {
        some: {
          status: { in: ["APPROVED", "PUBLISHED"] }
        }
      }
    }

    const exams = await prisma.exam.findMany({
      where: whereClause,
      include: {
        term: {
          include: { academicYear: true },
        },
        academicYear: true,
        class: {
          include: {
            sections: true,
          },
        },
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
    const session = await requirePermission(request, Permissions.EXAMS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      description,
      examType,
      termId,
      academicYearId,
      classId,
      startDate,
      endDate,
      isFinal,
      requiresApproval,
      status,
    } = body

    // If termId provided but not academicYearId, fetch it from the term
    let resolvedAcademicYearId = academicYearId
    if (termId && !academicYearId) {
      const term = await prisma.term.findUnique({
        where: { id: termId },
        select: { academicYearId: true },
      })

      if (!term) {
        return NextResponse.json({ error: "Invalid termId" }, { status: 400 })
      }
      resolvedAcademicYearId = term.academicYearId
    }

    if (!resolvedAcademicYearId) {
      return NextResponse.json({ error: "academicYearId is required" }, { status: 400 })
    }

    // If classId provided, verify it exists
    if (classId) {
      const classExists = await prisma.class.findUnique({
        where: { id: classId },
        include: { sections: true },
      })
      if (!classExists) {
        return NextResponse.json({ error: "Invalid classId" }, { status: 400 })
      }
    }

    const exam = await prisma.exam.create({
      data: {
        name,
        description: description || null,
        examType,
        termId,
        academicYearId: resolvedAcademicYearId,
        classId: classId || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isFinal: isFinal || false,
        requiresApproval: requiresApproval !== false,
        status: status || "DRAFT",
        createdBy: session.user.id,
      },
      include: {
        term: {
          include: { academicYear: true },
        },
        academicYear: true,
        class: {
          include: { sections: true },
        },
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
        description: `Created exam: ${name} (${examType})${classId ? ` for class` : ''}`,
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

