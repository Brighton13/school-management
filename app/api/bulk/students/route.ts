import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { generateAdmissionNumber } from "@/lib/admission_number_gen"

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

        // Validate required fields
        const missingFields = []
        if (!email) missingFields.push("Email")
        if (!name) missingFields.push("Name")
        if (!dateofbirth) missingFields.push("DateOfBirth")
        if (!gender) missingFields.push("Gender")

        if (missingFields.length > 0) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing required fields: ${missingFields.join(", ")}`)
          continue
        }

        // Parse date - support multiple formats
        let parsedDate: Date
        try {
          // Try parsing M/D/YYYY format first (e.g., 2/21/2010)
          if (dateofbirth.includes("/")) {
            const [month, day, year] = dateofbirth.split("/")
            parsedDate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
          } else {
            // ISO format (2010-02-21)
            parsedDate = new Date(dateofbirth)
          }
          
          if (isNaN(parsedDate.getTime())) {
            throw new Error("Invalid date")
          }
        } catch (dateError) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Invalid date format. Use MM/DD/YYYY or YYYY-MM-DD`)
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
                dateOfBirth: parsedDate,
                gender: gender.toUpperCase() || "OTHER",
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

    const template = `Email,Name,Phone,DateOfBirth,Gender,Address,EmergencyContact
student1@example.com,John Doe,1234567890,1/15/2010,MALE,123 Main St,9876543210
student2@example.com,Jane Smith,1234567891,2/20/2010,FEMALE,456 Oak Ave,9876543211`

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



