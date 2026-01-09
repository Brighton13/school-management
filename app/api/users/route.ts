import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.USERS_READ)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role")
    const isActive = searchParams.get("isActive")
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    const whereClause: any = {}
    if (role) {
      whereClause.role = role
    }
    if (isActive !== null && isActive !== undefined) {
      whereClause.isActive = isActive === "true"
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    // Get total count
    const total = await prisma.user.count({ where: whereClause })

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        permissions: {
          where: { granted: true },
          include: {
            permission: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  where: { granted: true },
                  include: {
                    permission: true,
                  },
                },
              },
            },
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
      ...(noPagination ? {} : { skip: offset, take: limit }),
    })

    // Remove password from response
    const usersWithoutPassword = users.map(({ password, ...user }) => user)

    if (noPagination) {
      return NextResponse.json(usersWithoutPassword)
    }

    return NextResponse.json(createPaginatedResponse(usersWithoutPassword, total, page, limit))
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
    const session = await requirePermission(request, Permissions.USERS_CREATE)
    if (!session) {
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

    // Validate role exists in database
    const roleExists = await prisma.role.findUnique({
      where: { name: role },
    })
    if (!roleExists) {
      return NextResponse.json(
        { error: `Invalid role. Role "${role}" does not exist in the system.` },
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

    // Create user with role assignment in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
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

      // Automatically assign the user to the role in UserRole table
      // This ensures permissions are inherited from the role
      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: roleExists.id,
        },
      })

      return newUser
    })

    // Note: Direct permissions are no longer assigned when creating users with roles
    // All permissions come from the assigned role. This ensures consistency.
    // If direct permissions are needed for fine-grained control, they can be added separately.

    // Fetch user with permissions and roles
    const userWithPermissions = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        permissions: {
          where: { granted: true },
          include: {
            permission: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  where: { granted: true },
                  include: {
                    permission: true,
                  },
                },
              },
            },
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

