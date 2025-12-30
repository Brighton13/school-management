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
    const studentId = searchParams.get("studentId")
    const classId = searchParams.get("classId")
    const academicYear = searchParams.get("academicYear")
    const term = searchParams.get("term")

    // For students, only show their own selections
    let queryStudentId = studentId
    if (session.user.role === "STUDENT") {
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
      })
      if (!student) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      queryStudentId = student.id
    }

    const selections = await prisma.studentSubjectSelection.findMany({
      where: {
        ...(queryStudentId ? { studentId: queryStudentId } : {}),
        ...(academicYear ? { academicYear } : {}),
        ...(term ? { term } : {}),
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        classSubject: {
          include: {
            class: true,
            subject: true,
            teacher: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: { selectedAt: "desc" },
    })

    // If classId is provided, filter by class
    let filteredSelections = selections
    if (classId) {
      filteredSelections = selections.filter(
        (selection) => selection.classSubject.classId === classId
      )
    }

    return NextResponse.json(filteredSelections)
  } catch (error) {
    console.error("Error fetching student subject selections:", error)
    return NextResponse.json(
      { error: "Failed to fetch student subject selections" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { studentId, classSubjectId, academicYear, term } = body

    // Validation
    if (!studentId || !classSubjectId || !academicYear || !term) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, classSubjectId, academicYear, term" },
        { status: 400 }
      )
    }

    // Check if student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    })
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Check if class-subject exists and is ELECTIVE or OPTIONAL
    const classSubject = await prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      include: {
        subject: true,
      },
    })
    if (!classSubject) {
      return NextResponse.json({ error: "Class subject not found" }, { status: 404 })
    }

    // Only allow selection of ELECTIVE or OPTIONAL subjects
    if (classSubject.subject.type === "CORE") {
      return NextResponse.json(
        { error: "Core subjects are automatically assigned and cannot be selected" },
        { status: 400 }
      )
    }

    // Check if student is enrolled in the class
    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        studentId,
        classId: classSubject.classId,
        academicYear,
        status: "ACTIVE",
      },
    })
    if (!enrollment) {
      return NextResponse.json(
        { error: "Student is not enrolled in this class for the specified academic year" },
        { status: 400 }
      )
    }

    // Check for duplicate selection
    const existingSelection = await prisma.studentSubjectSelection.findUnique({
      where: {
        studentId_classSubjectId_academicYear: {
          studentId,
          classSubjectId,
          academicYear,
        },
      },
    })
    if (existingSelection) {
      return NextResponse.json(
        { error: "Student has already selected this subject for this academic year" },
        { status: 400 }
      )
    }

    const selection = await prisma.studentSubjectSelection.create({
      data: {
        studentId,
        classSubjectId,
        academicYear,
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        classSubject: {
          include: {
            class: true,
            subject: true,
            teacher: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "StudentSubjectSelection",
      request,
      {
        entityId: selection.id,
        description: `${selection.student.user.name} selected ${selection.classSubject.subject.name} (${selection.classSubject.subject.type})`,
      }
    )

    return NextResponse.json(selection, { status: 201 })
  } catch (error: any) {
    console.error("Error creating student subject selection:", error)
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Student has already selected this subject for this academic year and term" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error.message || "Failed to create student subject selection" },
      { status: 500 }
    )
  }
}

