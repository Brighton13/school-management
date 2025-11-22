import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"

export async function GET() {
  try {
    const staff = await prisma.staff.findMany({
      include: {
        user: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      email,
      password,
      name,
      phone,
      employeeId,
      designation,
      department,
      qualification,
      experience,
      salary,
      joiningDate,
    } = body

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: designation === "PRINCIPAL" ? "PRINCIPAL" : 
              designation === "ACCOUNTANT" ? "ACCOUNTANT" :
              designation === "LIBRARIAN" ? "LIBRARIAN" : "TEACHER",
        staff: {
          create: {
            employeeId,
            designation,
            department,
            qualification,
            experience: experience ? parseInt(experience) : null,
            salary: salary ? parseFloat(salary) : null,
            joiningDate: joiningDate ? new Date(joiningDate) : null,
          },
        },
      },
      include: {
        staff: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Staff",
      request,
      {
        entityId: user.staff?.id,
        description: `Created staff member: ${name} (${employeeId}) - ${designation}`,
      }
    )

    return NextResponse.json(user, { status: 201 })
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email or employee ID already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create staff member" },
      { status: 500 }
    )
  }
}

