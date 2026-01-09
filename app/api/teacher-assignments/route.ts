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
    const teacherId = searchParams.get("teacherId")
    const classId = searchParams.get("classId")
    const sectionId = searchParams.get("sectionId")
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {
      ...(teacherId ? { teacherId } : {}),
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { subject: { name: { contains: search, mode: "insensitive" } } },
        { class: { name: { contains: search, mode: "insensitive" } } },
        { teacher: { user: { name: { contains: search, mode: "insensitive" } } } },
      ]
    }

    // Get total count
    const total = await prisma.classSubject.count({ where: whereClause })

    const assignments = await prisma.classSubject.findMany({
      where: whereClause,
      include: {
        class: true,
        section: true,
        subject: true,
        teacher: {
          include: { user: true },
        },
      },
      orderBy: [{ class: { name: "asc" } }, { section: { name: "asc" } }, { createdAt: "desc" }],
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(assignments)
    }

    return NextResponse.json(createPaginatedResponse(assignments, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch teacher assignments" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.TEACHER_ASSIGNMENTS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { classSubjectId, teacherId } = body

    const assignment = await prisma.classSubject.update({
      where: { id: classSubjectId },
      data: { teacherId },
      include: {
        class: true,
        section: true,
        subject: true,
        teacher: {
          include: { user: true },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "ClassSubject",
      request,
      {
        entityId: classSubjectId,
        description: `Assigned teacher ${assignment.teacher?.user.name || "N/A"} to ${assignment.class.name} ${assignment.section?.name || ""} - ${assignment.subject.name}`,
      }
    )

    return NextResponse.json(assignment, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to assign teacher" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.TEACHER_ASSIGNMENTS_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classSubjectId = searchParams.get("classSubjectId")

    if (!classSubjectId) {
      return NextResponse.json({ error: "classSubjectId required" }, { status: 400 })
    }

    // Get class-subject info before update for audit trail
    const classSubject = await prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      include: {
        class: true,
        section: true,
        subject: true,
        teacher: { include: { user: true } },
      },
    })

    await prisma.classSubject.update({
      where: { id: classSubjectId },
      data: { teacherId: null },
    })

    // Log audit trail
    if (classSubject) {
      await logAuditTrail(
        session.user.id,
        "UPDATE",
        "ClassSubject",
        request,
        {
          entityId: classSubjectId,
          description: `Removed teacher assignment from ${classSubject.class.name} ${classSubject.section?.name || ""} - ${classSubject.subject.name}`,
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to remove assignment" },
      { status: 500 }
    )
  }
}

