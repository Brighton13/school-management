import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
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

        const {
          admissionnumber,
          classname,
          sectionname,
          academicyear,
        } = row

        if (!admissionnumber || !classname || !sectionname || !academicyear) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing required fields`)
          continue
        }

        // Find student
        const student = await prisma.student.findUnique({
          where: { admissionNumber: admissionnumber },
        })

        if (!student) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Student not found`)
          continue
        }

        // Find class
        const classRecord = await prisma.class.findFirst({
          where: { name: classname },
        })

        if (!classRecord) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Class not found`)
          continue
        }

        // Find section
        const section = await prisma.section.findFirst({
          where: {
            name: sectionname,
            classId: classRecord.id,
          },
        })

        if (!section) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Section not found`)
          continue
        }

        await prisma.classEnrollment.create({
          data: {
            studentId: student.id,
            classId: classRecord.id,
            sectionId: section.id,
            academicYear: academicyear,
            // term field removed because it does not exist in the model
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

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to process bulk upload", details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const template = `AdmissionNumber,ClassName,SectionName,AcademicYear
ADM001,Grade 1,A,2024-2025
ADM002,Grade 1,B,2024-2025`

    return new Response(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=enrollment_template.csv",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}
