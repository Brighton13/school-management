import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.ENROLLMENT_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const classId = formData.get("classId") as string
    const sectionId = formData.get("sectionId") as string
    const academicYearId = (formData.get("academicYearId") || formData.get("academicYear")) as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!classId || !sectionId || !academicYearId) {
      return NextResponse.json(
        { error: "Class, Section, and Academic Year are required" },
        { status: 400 }
      )
    }

    // Verify class and section exist and section belongs to class
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
    })

    if (!classRecord) {
      return NextResponse.json({ error: "Class not found" }, { status: 400 })
    }

    const section = await prisma.section.findFirst({
      where: {
        id: sectionId,
        classId: classId,
      },
    })

    if (!section) {
      return NextResponse.json(
        { error: "Section not found or does not belong to the selected class" },
        { status: 400 }
      )
    }

    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId.trim() },
    })

    if (!academicYear) {
      return NextResponse.json({ error: "Academic year not found" }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split("\n").filter(line => line.trim())
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase())
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(",").map(v => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ""
        })

        // Support both "admissionnumber" and "admission_number"
        const admissionNumber = row["admissionnumber"] || row["admission_number"] || row["admission no"] || row["admission_no"]

        if (!admissionNumber) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing admission number`)
          continue
        }

        // Find student by admission number
        const student = await prisma.student.findUnique({
          where: { admissionNumber: admissionNumber.trim() },
        })

        if (!student) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Student with admission number "${admissionNumber}" not found`)
          continue
        }

        // Check if student is already enrolled in this class/section
        const existingEnrollment = await prisma.classEnrollment.findFirst({
          where: {
            studentId: student.id,
            classId: classId,
            sectionId: sectionId,
          },
        })

        if (existingEnrollment) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Student "${admissionNumber}" is already enrolled in this class and section`)
          continue
        }

        // Create enrollment
        await prisma.classEnrollment.create({
          data: {
            studentId: student.id,
            classId: classId,
            sectionId: sectionId,
            academicYearId: academicYear.id,
          },
        })

        results.success++
      } catch (error: any) {
        results.failed++
        if (error.code === "P2002") {
          results.errors.push(`Row ${i + 1}: Student already enrolled`)
        } else {
          results.errors.push(`Row ${i + 1}: ${error.message}`)
        }
      }
    }

    // Log audit trail for bulk operation
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Enrollment",
      request,
      {
        description: `Bulk enrolled ${results.success} students (${results.failed} failed)`,
        metadata: { success: results.success, failed: results.failed, total: results.success + results.failed, classId, sectionId, academicYearId: academicYear.id },
      }
    )

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to process bulk upload", details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.ENROLLMENT_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const template = `AdmissionNumber
ADM001
ADM002
ADM003`

    return new Response(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=class_section_enrollment_template.csv",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}

