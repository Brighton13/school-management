import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"
import { sendStaffWelcomeEmail, loadEmailConfigFromDB } from "@/lib/email"
import crypto from "crypto"

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

    // Generate password reset token for new staff member
    const resetToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24) // Token expires in 24 hours

    // Create password reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt,
      },
    })

    // Generate reset link
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`

    // Send welcome email with password reset link
    try {
      // Ensure email config is loaded
      await loadEmailConfigFromDB()
      
      await sendStaffWelcomeEmail(
        user.email,
        resetLink,
        user.name,
        employeeId,
        designation
      )
    } catch (emailError: any) {
      // Log error but don't fail the staff creation
      console.error("Failed to send welcome email to staff member:", emailError)
      // Continue with the response even if email fails
    }

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

