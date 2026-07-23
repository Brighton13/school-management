import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.FEES_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      target, // 'ALL_STUDENTS', 'CLASS', 'INDIVIDUAL'
      classId,
      sectionId,
      studentIds = [],
      termId,
      feeType,
      amount,
      dueDate,
      remarks,
    } = body

    if (!termId || !feeType || !amount || !dueDate) {
      return NextResponse.json(
        { error: "Term, fee type, amount, and due date are required" },
        { status: 400 }
      )
    }

    const term = await prisma.term.findUnique({
      where: { id: termId },
      select: { academicYearId: true },
    })

    if (!term) {
      return NextResponse.json({ error: "Invalid termId" }, { status: 400 })
    }

    let targetStudents: Array<{
      id: string
      admissionNumber: string
      user: { name: string }
    }> = []

    if (target === "ALL_STUDENTS") {
      const students = await prisma.student.findMany({
        select: {
          id: true,
          admissionNumber: true,
          user: {
            select: { name: true },
          },
        },
      })
      targetStudents = students
    } else if (target === "CLASS" && classId) {
      const enrollments = await prisma.classEnrollment.findMany({
        where: {
          classId,
          ...(sectionId ? { sectionId } : {}),
          status: "ACTIVE",
        },
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              user: {
                select: { name: true },
              },
            },
          },
        },
      })
      targetStudents = enrollments.map(e => e.student)
    } else if (target === "INDIVIDUAL" && studentIds.length > 0) {
      const students = await prisma.student.findMany({
        where: {
          id: { in: studentIds },
        },
        select: {
          id: true,
          admissionNumber: true,
          user: {
            select: { name: true },
          },
        },
      })
      targetStudents = students
    } else {
      return NextResponse.json(
        { error: "Invalid target specification" },
        { status: 400 }
      )
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    const targetStudentIds = targetStudents.map((student) => student.id)
    const existingFees = await prisma.fee.findMany({
      where: {
        studentId: { in: targetStudentIds },
        termId,
        feeType,
      },
      select: { studentId: true },
    })
    const existingStudentIds = new Set(existingFees.map((fee) => fee.studentId))
    const studentsToCreate = targetStudents.filter((student) => !existingStudentIds.has(student.id))
    const duplicateStudents = targetStudents.filter((student) => existingStudentIds.has(student.id))

    results.failed = duplicateStudents.length
    results.errors = duplicateStudents
      .slice(0, 100)
      .map((student) => `Fee already exists for ${student.user.name} (${student.admissionNumber})`)

    if (duplicateStudents.length > 100) {
      results.errors.push(`${duplicateStudents.length - 100} additional duplicate fee(s) omitted from this response`)
    }

    if (studentsToCreate.length > 0) {
      const created = await prisma.fee.createMany({
        data: studentsToCreate.map((student) => ({
          studentId: student.id,
          termId,
          feeType,
          amount: parseFloat(amount),
          dueDate: new Date(dueDate),
          remarks,
          createdBy: session.user.id,
          academicYearId: term.academicYearId,
        })),
      })

      results.success = created.count
    }

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Fee",
      request,
      {
        description: `Bulk created fees for ${results.success} students (${feeType})`,
        metadata: { target, feeType, amount, results },
      }
    )

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create bulk fees", details: error.message },
      { status: 500 }
    )
  }
}
