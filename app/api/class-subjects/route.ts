import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")
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
        ...(teacherId ? { teacherId } : {}),
      },
      include: {
        class: true,
        subject: true,
        teacher: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // If studentId is provided, filter by student subject selections
    // Show: Core subjects (always) + Elective/Optional subjects that student has selected
    if (studentId && academicYear && term) {
      // Get student's selected elective/optional subjects
      const studentSelections = await prisma.studentSubjectSelection.findMany({
        where: {
          studentId,
          academicYear,
          term,
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
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { classId, subjectId, teacherId, maxMarks, passMarks } = body

    const classSubject = await prisma.classSubject.create({
      data: {
        classId,
        subjectId,
        teacherId: teacherId || null,
        maxMarks: maxMarks ? parseFloat(maxMarks) : null,
        passMarks: passMarks ? parseFloat(passMarks) : null,
      },
      include: {
        class: true,
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
        description: `Created class-subject: ${classSubject.class.name} - ${classSubject.subject.name}`,
      }
    )

    return NextResponse.json(classSubject, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create class subject" },
      { status: 500 }
    )
  }
}

