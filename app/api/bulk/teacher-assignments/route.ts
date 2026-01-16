import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.TEACHER_ASSIGNMENTS_CREATE)
    if (!session) {
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
          classname,
          sectionname,
          subjectcode,
          employeeid,
        } = row

        if (!classname || !sectionname || !subjectcode || !employeeid) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing required fields (classname, sectionname, subjectcode, employeeid)`)
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
          results.errors.push(`Row ${i + 1}: Section not found for class ${classname}`)
          continue
        }

        // Find subject
        const subject = await prisma.subject.findUnique({
          where: { code: subjectcode },
        })

        if (!subject) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Subject not found`)
          continue
        }

        // Find teacher
        const teacher = await prisma.staff.findUnique({
          where: { employeeId: employeeid },
        })

        if (!teacher) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Teacher not found`)
          continue
        }

        // Find or create class subject
        const classSubject = await prisma.classSubject.upsert({
          where: {
            classId_sectionId_subjectId: {
              classId: classRecord.id,
              sectionId: section.id,
              subjectId: subject.id,
            },
          },
          update: {
            teacherId: teacher.id,
          },
          create: {
            classId: classRecord.id,
            sectionId: section.id,
            subjectId: subject.id,
            teacherId: teacher.id,
          },
        })

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push(`Row ${i + 1}: ${error.message}`)
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

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.TEACHER_ASSIGNMENTS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const template = `ClassName,SubjectCode,EmployeeID
Grade 1,MATH,EMP001
Grade 1,ENG,EMP002
Grade 2,MATH,EMP001`

    return new Response(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=teacher_assignments_template.csv",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}

