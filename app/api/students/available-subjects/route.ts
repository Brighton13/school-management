import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET - Get available subjects for the logged-in student to select
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only students can access this endpoint
    if (session.user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students can access this endpoint" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const academicYear = searchParams.get("academicYear")
    const term = searchParams.get("term")

    // Get the student record
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        classEnrollment: {
          include: {
            class: true,
            section: true,
          },
          orderBy: { enrolledAt: "desc" },
          take: 1,
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const currentEnrollment = student.classEnrollment[0]
    if (!currentEnrollment) {
      return NextResponse.json(
        { error: "Student is not enrolled in any class" },
        { status: 400 }
      )
    }

    // Get current academic term if not provided
    let currentTerm = null
    if (!academicYear || !term) {
      currentTerm = await prisma.academicTerm.findFirst({
        where: {
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
        },
        orderBy: { startDate: "desc" },
      })
    }

    const targetAcademicYear = academicYear || currentTerm?.academicYear || new Date().getFullYear().toString()
    const targetTerm = term || currentTerm?.name || "Term 1"

    // Get all class subjects for the student's class
    const classSubjects = await prisma.classSubject.findMany({
      where: {
        classId: currentEnrollment.classId,
      },
      include: {
        subject: true,
        teacher: {
          include: {
            user: true,
          },
        },
      },
    })

    // Get student's current selections
    const currentSelections = await prisma.studentSubjectSelection.findMany({
      where: {
        studentId: student.id,
        academicYear: targetAcademicYear,
        // term: targetTerm, // Removed because 'term' is not a valid property
      },
      select: {
        classSubjectId: true,
        status: true,
      },
    })

    const selectionMap = new Map(
      currentSelections.map((s) => [s.classSubjectId, s.status])
    )

    // Categorize subjects
    const coreSubjects = classSubjects
      .filter((cs) => cs.subject.type === "CORE")
      .map((cs) => ({
        id: cs.id,
        subjectId: cs.subject.id,
        name: cs.subject.name,
        code: cs.subject.code,
        type: cs.subject.type,
        teacher: cs.teacher ? {
          name: cs.teacher.user.name,
          employeeId: cs.teacher.employeeId,
        } : null,
        maxMarks: cs.maxMarks,
        passMarks: cs.passMarks,
        isSelected: true, // Core subjects are always selected
        selectionStatus: "MANDATORY",
      }))

    const electiveSubjects = classSubjects
      .filter((cs) => cs.subject.type === "ELECTIVE")
      .map((cs) => ({
        id: cs.id,
        subjectId: cs.subject.id,
        name: cs.subject.name,
        code: cs.subject.code,
        type: cs.subject.type,
        teacher: cs.teacher ? {
          name: cs.teacher.user.name,
          employeeId: cs.teacher.employeeId,
        } : null,
        maxMarks: cs.maxMarks,
        passMarks: cs.passMarks,
        isSelected: selectionMap.has(cs.id),
        selectionStatus: selectionMap.get(cs.id) || null,
      }))

    const optionalSubjects = classSubjects
      .filter((cs) => cs.subject.type === "OPTIONAL")
      .map((cs) => ({
        id: cs.id,
        subjectId: cs.subject.id,
        name: cs.subject.name,
        code: cs.subject.code,
        type: cs.subject.type,
        teacher: cs.teacher ? {
          name: cs.teacher.user.name,
          employeeId: cs.teacher.employeeId,
        } : null,
        maxMarks: cs.maxMarks,
        passMarks: cs.passMarks,
        isSelected: selectionMap.has(cs.id),
        selectionStatus: selectionMap.get(cs.id) || null,
      }))

    return NextResponse.json({
      student: {
        id: student.id,
        name: session.user.name,
        admissionNumber: student.admissionNumber,
        className: currentEnrollment.class.name,
        sectionName: currentEnrollment.section.name,
      },
      academicYear: targetAcademicYear,
      term: targetTerm,
      subjects: {
        core: coreSubjects,
        elective: electiveSubjects,
        optional: optionalSubjects,
      },
      summary: {
        totalCore: coreSubjects.length,
        totalElective: electiveSubjects.length,
        totalOptional: optionalSubjects.length,
        selectedElective: electiveSubjects.filter((s) => s.isSelected).length,
        selectedOptional: optionalSubjects.filter((s) => s.isSelected).length,
      },
    })
  } catch (error) {
    console.error("Error fetching available subjects:", error)
    return NextResponse.json(
      { error: "Failed to fetch available subjects" },
      { status: 500 }
    )
  }
}

// POST - Select/deselect a subject
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students can select subjects" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { classSubjectId, academicYear, term, action } = body

    if (!classSubjectId || !academicYear || !term || !action) {
      return NextResponse.json(
        { error: "Missing required fields: classSubjectId, academicYear, term, action" },
        { status: 400 }
      )
    }

    if (!["select", "drop"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'select' or 'drop'" },
        { status: 400 }
      )
    }

    // Get student
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        classEnrollment: {
          orderBy: { enrolledAt: "desc" },
          take: 1,
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const currentEnrollment = student.classEnrollment[0]
    if (!currentEnrollment) {
      return NextResponse.json(
        { error: "Student is not enrolled in any class" },
        { status: 400 }
      )
    }

    // Verify the class subject belongs to student's class
    const classSubject = await prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      include: { subject: true },
    })

    if (!classSubject) {
      return NextResponse.json(
        { error: "Class subject not found" },
        { status: 404 }
      )
    }

    if (classSubject.classId !== currentEnrollment.classId) {
      return NextResponse.json(
        { error: "This subject is not available for your class" },
        { status: 403 }
      )
    }

    // Can't select/drop core subjects
    if (classSubject.subject.type === "CORE") {
      return NextResponse.json(
        { error: "Core subjects cannot be selected or dropped" },
        { status: 400 }
      )
    }

    if (action === "select") {
      // Check if already selected
      const existing = await prisma.studentSubjectSelection.findUnique({
        where: {
          studentId_classSubjectId_academicYear: {
            studentId: student.id,
            classSubjectId,
            academicYear,
          },
        },
      })

      if (existing) {
        // Reactivate if dropped
        if (existing.status === "DROPPED") {
          const updated = await prisma.studentSubjectSelection.update({
            where: { id: existing.id },
            data: { status: "ACTIVE" },
            include: {
              classSubject: {
                include: { subject: true },
              },
            },
          })
          return NextResponse.json({
            message: "Subject reactivated successfully",
            selection: updated,
          })
        }
        return NextResponse.json(
          { error: "Subject already selected" },
          { status: 400 }
        )
      }

      // Create new selection
      const selection = await prisma.studentSubjectSelection.create({
        data: {
          studentId: student.id,
          classSubjectId,
          academicYear,
          status: "ACTIVE",
        },
        include: {
          classSubject: {
            include: { subject: true },
          },
        },
      })

      return NextResponse.json({
        message: "Subject selected successfully",
        selection,
      })
    } else {
      // Drop the subject
      const existing = await prisma.studentSubjectSelection.findUnique({
        where: {
          studentId_classSubjectId_academicYear: {
            studentId: student.id,
            classSubjectId,
            academicYear,
          },
        },
      })

      if (!existing || existing.status === "DROPPED") {
        return NextResponse.json(
          { error: "Subject is not currently selected" },
          { status: 400 }
        )
      }

      const updated = await prisma.studentSubjectSelection.update({
        where: { id: existing.id },
        data: { status: "DROPPED" },
        include: {
          classSubject: {
            include: { subject: true },
          },
        },
      })

      return NextResponse.json({
        message: "Subject dropped successfully",
        selection: updated,
      })
    }
  } catch (error) {
    console.error("Error updating subject selection:", error)
    return NextResponse.json(
      { error: "Failed to update subject selection" },
      { status: 500 }
    )
  }
}
