import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")
    const sectionId = searchParams.get("sectionId")
    const studentId = searchParams.get("studentId")
    const academicYear = searchParams.get("academicYear")
    const term = searchParams.get("term")

    // For teachers, only show their assigned class-subjects
    let teacherId: string | undefined
    if (session?.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
      })
      if (staff) {
        teacherId = staff.id
      } else {
        return NextResponse.json([])
      }
    }

    let classSubjects = await prisma.classSubject.findMany({
      where: {
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(teacherId ? { teacherId } : {}),
      },
      include: {
        class: true,
        section: true,
        subject: true,
        teacher: {
          include: { user: true },
        },
      },
      orderBy: [{ class: { name: "asc" } }, { section: { name: "asc" } }, { createdAt: "desc" }],
    })

    // If studentId is provided, filter by student subject selections
    // Show: Core subjects (always) + Elective/Optional subjects that student has selected
    if (studentId && academicYear) {
      // Get student's selected elective/optional subjects
      const studentSelections = await prisma.studentSubjectSelection.findMany({
        where: {
          studentId,
          academicYearId: academicYear,
          status: "ACTIVE",
        },
        select: {
          classSubjectId: true,
        },
      })

      const selectedClassSubjectIds = new Set(
        studentSelections.map((s) => s.classSubjectId)
      )

      // Filter: Keep core subjects + selected elective/optional subjects
      classSubjects = classSubjects.filter((cs) => {
        // Always include CORE subjects
        if (cs.subject.type === "CORE") {
          return true
        }
        // Only include ELECTIVE/OPTIONAL if student has selected them
        if (cs.subject.type === "ELECTIVE" || cs.subject.type === "OPTIONAL") {
          return selectedClassSubjectIds.has(cs.id)
        }
        return false
      })
    }

    return NextResponse.json(classSubjects)
  } catch (error) {
    console.error("Error fetching class subjects:", error)
    return NextResponse.json(
      { error: "Failed to fetch class subjects" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.SUBJECTS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { classId, sectionId, subjectId, teacherId, maxMarks, passMarks } = body

    if (!classId || !sectionId || !subjectId) {
      return NextResponse.json(
        { error: "Class, Section, and Subject are required" },
        { status: 400 }
      )
    }

    // Verify section belongs to the class
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    })

    if (!section || section.classId !== classId) {
      return NextResponse.json(
        { error: "Invalid section for this class" },
        { status: 400 }
      )
    }

    // Check if this combination already exists using the unique constraint
    const existing = await prisma.classSubject.findUnique({
      where: { 
        classId_sectionId_subjectId: {
          classId,
          sectionId,
          subjectId
        }
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: "This subject is already assigned to this class section" },
        { status: 400 }
      )
    }

    const classSubject = await prisma.classSubject.create({
      data: {
        classId,
        sectionId,
        subjectId,
        teacherId: teacherId || null,
        maxMarks: maxMarks ? parseFloat(maxMarks) : null,
        passMarks: passMarks ? parseFloat(passMarks) : null,
      },
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
      "CREATE",
      "ClassSubject",
      request,
      {
        entityId: classSubject.id,
        description: `Created class-subject: ${classSubject.class.name} ${classSubject.section?.name || ""} - ${classSubject.subject.name}`,
      }
    )

    return NextResponse.json(classSubject, { status: 201 })
  } catch (error) {
    console.error("Error creating class subject:", error)
    return NextResponse.json(
      { error: "Failed to create class subject" },
      { status: 500 }
    )
  }
}

