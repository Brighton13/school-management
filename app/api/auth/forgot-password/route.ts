import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail, loadEmailConfigFromDB } from "@/lib/email"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      return NextResponse.json({
        message: "If an account with that email exists, we've sent a password reset link.",
      })
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1) // Token expires in 1 hour

    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false,
      },
    })

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    })

    // Generate reset link
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
    const resetLink = `${baseUrl}/reset-password?token=${token}`

    // Ensure email config is loaded
    await loadEmailConfigFromDB()

    // Send email
    try {
      await sendPasswordResetEmail(user.email, resetLink, user.name)
    } catch (emailError: any) {
      console.error("Failed to send password reset email:", emailError)
      return NextResponse.json(
        { error: "Failed to send password reset email. Please check email configuration." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "If an account with that email exists, we've sent a password reset link.",
    })
  } catch (error: any) {
    console.error("Error in forgot password:", error)
    return NextResponse.json(
      { error: "Failed to process password reset request" },
      { status: 500 }
    )
  }
}

