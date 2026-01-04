import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"
import { sendStaffVerificationEmail, loadEmailConfigFromDB } from "@/lib/email"
import { generateEmployeeId } from "@/lib/admission_number_gen"
import crypto from "crypto"
import { requirePermission, Permissions } from "@/lib/permissions"

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
    const session = await requirePermission(request, Permissions.STAFF_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      email,
      name,
      phone,
      designation,
      department,
      qualification,
      experience,
      salary,
      joiningDate,
      gender,
      dateOfBirth,
      address,
    } = body

    // Auto-generate employee ID based on designation
    const employeeId = await generateEmployeeId(designation)

    // Generate a random placeholder password that cannot be used for login
    // Staff will set their own password via the email verification link
    const placeholderPassword = crypto.randomBytes(32).toString("hex")
    const hashedPassword = await bcrypt.hash(placeholderPassword, 10)

    // Determine the role based on designation
    const roleName = designation === "PRINCIPAL" ? "PRINCIPAL" : 
                     designation === "ACCOUNTANT" ? "ACCOUNTANT" :
                     designation === "LIBRARIAN" ? "LIBRARIAN" : "TEACHER"

    // Find the role in the database
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    })

    if (!role) {
      return NextResponse.json(
        { error: `Role "${roleName}" not found. Please run the seed script first.` },
        { status: 400 }
      )
    }

    // Create user with role assignment in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          role: roleName,
          staff: {
            create: {
              employeeId,
              designation,
              department,
              qualification,
              experience: experience ? parseInt(experience) : null,
              salary: salary ? parseFloat(salary) : null,
              joiningDate: joiningDate ? new Date(joiningDate) : null,
              gender: gender || null,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
              address: address || null,
            },
          },
        },
        include: {
          staff: true,
        },
      })

      // Automatically assign the user to the role in UserRole table
      // This ensures permissions are inherited from the role
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: role.id,
        },
      })

      return newUser
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

    // Generate email verification token for new staff member
    const verificationToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 72) // Token expires in 72 hours (3 days)

    // Create verification token (using PasswordResetToken for this purpose)
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        expiresAt,
      },
    })

    // Generate verification link
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`

    // Send verification email
    let emailSent = false
    try {
      // Ensure email config is loaded
      await loadEmailConfigFromDB()
      
      await sendStaffVerificationEmail(
        user.email,
        verificationLink,
        user.name,
        employeeId,
        designation
      )
      emailSent = true
    } catch (emailError: any) {
      // Log error but don't fail the staff creation
      console.error("Failed to send verification email to staff member:", emailError)
    }

    return NextResponse.json({ 
      ...user, 
      emailSent,
      message: emailSent 
        ? "Staff created successfully. Verification email sent." 
        : "Staff created but email could not be sent. Please configure email settings or manually share the verification link."
    }, { status: 201 })
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

