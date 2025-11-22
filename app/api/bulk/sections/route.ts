import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
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
          name,
          classname,
          capacity,
          classteacheremail,
        } = row

        if (!name || !classname) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing required fields (Name and ClassName are required)`)
          continue
        }

        // Find the class by name (exact match)
        const classRecord = await prisma.class.findFirst({
          where: {
            name: classname.trim(),
          },
        })

        if (!classRecord) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Class "${classname}" not found`)
          continue
        }

        // Find class teacher by email if provided (exact match)
        let classTeacherId: string | null = null
        if (classteacheremail) {
          const teacher = await prisma.staff.findFirst({
            where: {
              user: {
                email: classteacheremail.trim(),
              },
              designation: "TEACHER",
            },
          })

          if (!teacher) {
            results.failed++
            results.errors.push(`Row ${i + 1}: Teacher with email "${classteacheremail}" not found or is not a teacher`)
            continue
          }

          classTeacherId = teacher.id
        }

        // Parse capacity
        let parsedCapacity: number | null = null
        if (capacity && capacity.trim()) {
          const parsed = parseInt(capacity)
          if (!isNaN(parsed) && parsed > 0) {
            parsedCapacity = parsed
          }
        }

        await prisma.section.create({
          data: {
            name: name.trim(),
            classId: classRecord.id,
            capacity: parsedCapacity,
            classTeacherId: classTeacherId,
          },
        })

        results.success++
      } catch (error: any) {
        results.failed++
        if (error.code === "P2002") {
          results.errors.push(`Row ${i + 1}: A section with this name already exists for this class`)
        } else if (error.code === "P2003") {
          results.errors.push(`Row ${i + 1}: Invalid class or class teacher`)
        } else {
          results.errors.push(`Row ${i + 1}: ${error.message}`)
        }
      }
    }

    // Log audit trail for bulk operation
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Section",
      request,
      {
        description: `Bulk created ${results.success} sections (${results.failed} failed)`,
        metadata: { success: results.success, failed: results.failed, total: results.success + results.failed },
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const template = `Name,ClassName,Capacity,ClassTeacherEmail
A,Grade 1,30,teacher1@example.com
B,Grade 1,30,
Science,Grade 2,25,teacher2@example.com
A,Grade 3,35,`

    return new Response(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=sections_template.csv",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}

