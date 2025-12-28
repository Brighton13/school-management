import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      target, // 'ALL_STUDENTS', 'CLASS', 'INDIVIDUAL'
      classId,
      sectionId,
      studentIds = [],
      academicTermId,
      feeType,
      amount,
      dueDate,
      remarks,
    } = body

    if (!academicTermId || !feeType || !amount || !dueDate) {
      return NextResponse.json(
        { error: "Academic term, fee type, amount, and due date are required" },
        { status: 400 }
      )
    }

    let targetStudents = []

    if (target === "ALL_STUDENTS") {
      const students = await prisma.student.findMany({
        include: { user: true },
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
            include: { user: true },
          },
        },
      })
      targetStudents = enrollments.map(e => e.student)
    } else if (target === "INDIVIDUAL" && studentIds.length > 0) {
      const students = await prisma.student.findMany({
        where: {
          id: { in: studentIds },
        },
        include: { user: true },
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

    for (const student of targetStudents) {
      try {
        // Check if fee already exists for this student, term, and fee type
        const existingFee = await prisma.fee.findFirst({
          where: {
            studentId: student.id,
            academicTermId,
            feeType,
          },
        })

        if (existingFee) {
          results.failed++
          results.errors.push(`Fee already exists for ${student.user.name} (${student.admissionNumber})`)
          continue
        }

        await prisma.fee.create({
          data: {
            studentId: student.id,
            academicTermId,
            feeType,
            amount: parseFloat(amount),
            dueDate: new Date(dueDate),
            remarks,
            createdBy: session.user.id,
          },
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push(`Failed to create fee for ${student.user.name}: ${error.message}`)
      }
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