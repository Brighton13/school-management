import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

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
          email,
          // password,
          name,
          phone,
          //admissionnumber,
          dateofbirth,
          gender,
          address,
          emergencycontact,
        } = row

        if (!email ||  !name || !gender ) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing required fields`)
          continue
        }
        const admissionnumber = await generateAdmissionNumber();
        const password = "Test1234"
        const hashedPassword = await bcrypt.hash(password, 10)

        await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            phone: phone || null,
            role: "STUDENT",
            student: {
              create: {
                admissionNumber: admissionnumber,
                dateOfBirth: new Date(dateofbirth),
                gender: gender || "OTHER",
                address: address || null,
                emergencyContact: emergencycontact || null,
              },
            },
          },
        })

        results.success++
      } catch (error: any) {
        results.failed++
        if (error.code === "P2002") {
          results.errors.push(`Row ${i + 1}: Email or admission number already exists`)
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

    const template = `Email,Name,Phone,AdmissionNumber,DateOfBirth,Gender,Address,EmergencyContact
student1@example.com,John Doe,1234567890,ADM001,2010-01-15,MALE,123 Main St,9876543210
student2@example.com,Jane Smith,1234567891,ADM002,2010-02-20,FEMALE,456 Oak Ave,9876543211`

    return new Response(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=students_template.csv",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}


export async function generateAdmissionNumber(): Promise<string> {
  const now = new Date()

  const year = now.getFullYear().toString().slice(-2) // YY
  const month = (now.getMonth() + 1).toString().padStart(2, '0') // MM
  const prefix = `${year}${month}` // YYMM

  // Find the latest student for the current month
  const lastStudent = await prisma.student.findFirst({
    where: {
      admissionNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      admissionNumber: 'desc',
    },
  })

  let sequence = 1

  if (lastStudent?.admissionNumber) {
    const lastSequence = parseInt(
      lastStudent.admissionNumber.slice(4),
      10
    )
    sequence = lastSequence + 1
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`
}
