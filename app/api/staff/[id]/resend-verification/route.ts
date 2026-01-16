import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendStaffVerificationEmail, loadEmailConfigFromDB } from "@/lib/email"
import crypto from "crypto"
import { requirePermission, Permissions } from "@/lib/permissions"
import { logAuditTrail } from "@/lib/audit"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await requirePermission(request, Permissions.STAFF_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find the staff member
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        user: true,
      },
    })

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      )
    }

    // Invalidate any existing unused tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: staff.userId,
        used: false,
      },
      data: {
        used: true,
      },
    })

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 72) // Token expires in 72 hours

    // Create new verification token
    await prisma.passwordResetToken.create({
      data: {
        userId: staff.userId,
        token: verificationToken,
        expiresAt,
      },
    })

    // Generate verification link
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const verificationLink = `${baseUrl}/verify-email?token=${verificationToken}`

    // Send verification email
    try {
      await loadEmailConfigFromDB()
      
      await sendStaffVerificationEmail(
        staff.user.email,
        verificationLink,
        staff.user.name,
        staff.employeeId,
        staff.designation
      )

      // Log audit trail
      await logAuditTrail(
        session.user.id,
        "UPDATE",
        "Staff",
        request,
        {
          entityId: staff.id,
          description: `Resent verification email to staff member: ${staff.user.name} (${staff.employeeId})`,
        }
      )

      return NextResponse.json({
        success: true,
        message: "Verification email sent successfully",
      })
    } catch (emailError: any) {
      console.error("Failed to send verification email:", emailError)
      return NextResponse.json(
        { error: "Failed to send verification email. Please check email configuration." },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error resending verification email:", error)
    return NextResponse.json(
      { error: "Failed to resend verification email" },
      { status: 500 }
    )
  }
}
