import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const isActive = searchParams.get("isActive")
    const search = searchParams.get("search")

    const whereClause: any = {}
    if (role) {
      whereClause.role = role
    }
    if (isActive !== null) {
      whereClause.isActive = isActive === "true"
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        student: {
          select: {
            admissionNumber: true,
          },
        },
        staff: {
          select: {
            employeeId: true,
            designation: true,
          },
        },
        parent: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Remove password from response
    const usersWithoutPassword = users.map(({ password, ...user }) => user)

    return NextResponse.json(usersWithoutPassword)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { email, password, name, phone, role, isActive, permissions } = body

    // Validation
    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: "Missing required fields: email, password, name, role" },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = [
      "ADMIN",
      "PRINCIPAL",
      "TEACHER",
      "ACCOUNTANT",
      "LIBRARIAN",
      "STUDENT",
      "PARENT",
    ]
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone: phone || null,
        role,
        isActive: isActive !== false,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    // Assign permissions if provided
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      await Promise.all(
        permissions.map((permissionId: string) =>
          prisma.userPermission.create({
            data: {
              userId: user.id,
              permissionId,
              granted: true,
            },
          })
        )
      )
    }

    // Fetch user with permissions
    const userWithPermissions = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    const { password: _, ...userWithoutPassword } = userWithPermissions!

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "User",
      request,
      {
        entityId: user.id,
        description: `Created user: ${name} (${email}) with role ${role}`,
        metadata: { role, permissionsCount: permissions?.length || 0 },
      }
    )

    return NextResponse.json(userWithoutPassword, { status: 201 })
  } catch (error: any) {
    console.error("Error creating user:", error)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    )
  }
}

