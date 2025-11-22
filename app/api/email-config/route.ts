import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { initializeEmail, encrypt, decrypt } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch from database
    const config = await prisma.emailConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    })

    if (config) {
      return NextResponse.json({
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        from: config.from,
        configured: true,
      })
    }

    return NextResponse.json({ configured: false })
  } catch (error) {
    console.error("Error fetching email config:", error)
    return NextResponse.json(
      { error: "Failed to fetch email configuration" },
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
    const { host, port, secure, user, password, from } = body

    // Validation
    if (!host || !port || !user || !password || !from) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // Initialize email with new config to test connection
    try {
      initializeEmail({
        host,
        port: parseInt(port),
        secure: secure === true || secure === "true",
        user,
        password,
        from,
      })

      // Deactivate existing configs
      await prisma.emailConfig.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      })

      // Save to database with encrypted password
      const encryptedPassword = encrypt(password)
      const emailConfig = await prisma.emailConfig.create({
        data: {
          host,
          port: parseInt(port),
          secure: secure === true || secure === "true",
          user,
          password,
          from,
          isActive: true,
        },
      })

      await logAuditTrail(
        session.user.id,
        "CREATE",
        "EmailConfig",
        request,
        {
          entityId: emailConfig.id,
          description: "Created email configuration",
        }
      )

      return NextResponse.json({
        message: "Email configuration saved successfully",
        config: {
          host,
          port: parseInt(port),
          secure: secure === true || secure === "true",
          user,
          from,
          configured: true,
        },
      })
    } catch (error: any) {
      console.error("Error initializing email:", error)
      return NextResponse.json(
        { error: `Failed to initialize email: ${error.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error saving email config:", error)
    return NextResponse.json(
      { error: "Failed to save email configuration" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get existing config
    const existingConfig = await prisma.emailConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    })

    if (!existingConfig) {
      return NextResponse.json(
        { error: "Email configuration not found. Please create it first." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { host, port, secure, user, password, from } = body

    // Build update data
    const updateData: any = {}
    if (host) updateData.host = host
    if (port) updateData.port = parseInt(port)
    if (secure !== undefined) updateData.secure = secure === true || secure === "true"
    if (user) updateData.user = user
    if (password) updateData.password = encrypt(password)
    if (from) updateData.from = from

    // Prepare config for testing
    const testConfig = {
      host: host || existingConfig.host,
      port: port ? parseInt(port) : existingConfig.port,
      secure: secure !== undefined ? (secure === true || secure === "true") : existingConfig.secure,
      user: user || existingConfig.user,
      password: password || (existingConfig.password.includes(":") && existingConfig.password.length > 32 ? decrypt(existingConfig.password) : existingConfig.password),
      from: from || existingConfig.from,
    }

    // Test email connection
    try {
      initializeEmail(testConfig)

      // Update in database
      const updatedConfig = await prisma.emailConfig.update({
        where: { id: existingConfig.id },
        data: updateData,
      })

      await logAuditTrail(
        session.user.id,
        "UPDATE",
        "EmailConfig",
        request,
        {
          entityId: updatedConfig.id,
          description: "Updated email configuration",
        }
      )

      return NextResponse.json({
        message: "Email configuration updated successfully",
        config: {
          host: updatedConfig.host,
          port: updatedConfig.port,
          secure: updatedConfig.secure,
          user: updatedConfig.user,
          from: updatedConfig.from,
          configured: true,
        },
      })
    } catch (error: any) {
      console.error("Error updating email:", error)
      return NextResponse.json(
        { error: `Failed to update email: ${error.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error updating email config:", error)
    return NextResponse.json(
      { error: "Failed to update email configuration" },
      { status: 500 }
    )
  }
}
