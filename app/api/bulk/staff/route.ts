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
          password,
          name,
          phone,
          employeeid,
          designation,
          department,
          qualification,
          experience,
          salary,
          joiningdate,
        } = row

        if (!email || !password || !name || !employeeid || !designation) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing required fields`)
          continue
        }

        const hashedPassword = await bcrypt.hash(password, 10)
        const role = designation === "PRINCIPAL" ? "PRINCIPAL" :
                     designation === "ACCOUNTANT" ? "ACCOUNTANT" :
                     designation === "LIBRARIAN" ? "LIBRARIAN" : "TEACHER"

        await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            phone: phone || null,
            role,
            staff: {
              create: {
                employeeId: employeeid,
                designation,
                department: department || null,
                qualification: qualification || null,
                experience: experience ? parseInt(experience) : null,
                salary: salary ? parseFloat(salary) : null,
                joiningDate: joiningdate ? new Date(joiningdate) : null,
              },
            },
          },
        })

        results.success++
      } catch (error: any) {
        results.failed++
        if (error.code === "P2002") {
          results.errors.push(`Row ${i + 1}: Email or employee ID already exists`)
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

    const template = `Email,Password,Name,Phone,EmployeeID,Designation,Department,Qualification,Experience,Salary,JoiningDate
teacher1@example.com,password123,John Teacher,1234567890,EMP001,TEACHER,Mathematics,Master's Degree,5,50000,2020-01-15
principal@example.com,password123,Jane Principal,1234567891,EMP002,PRINCIPAL,Administration,PhD,10,80000,2018-06-01`

    return new Response(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=staff_template.csv",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}
