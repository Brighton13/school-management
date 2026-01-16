import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"

// GET - Fetch current user's profile
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        student: {
          include: {
            classEnrollment: {
              where: { status: "ACTIVE" },
              include: {
                class: true,
                section: true,
                academicYear: true,
              },
              orderBy: { enrolledAt: "desc" },
              take: 1,
            },
          },
        },
        staff: true,
        parent: {
          include: {
            students: {
              include: {
                student: {
                  include: {
                    user: {
                      select: {
                        name: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Remove sensitive data
    const { password, ...userWithoutPassword } = user

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error("Error fetching profile:", error)
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    )
  }
}

// PUT - Update current user's profile
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      name,
      phone,
      currentPassword,
      newPassword,
      // Student-specific fields
      gender,
      dateOfBirth,
      address,
      emergencyContact,
      bloodGroup,
      // Staff-specific fields
      department,
      qualification,
    } = body

    // Fetch current user with related data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        student: true,
        staff: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Build user update data
    const userUpdateData: any = {}
    if (name !== undefined && name.trim() !== "") {
      userUpdateData.name = name.trim()
    }
    if (phone !== undefined) {
      userUpdateData.phone = phone || null
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to change password" },
          { status: 400 }
        )
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password)
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        )
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "New password must be at least 6 characters" },
          { status: 400 }
        )
      }

      userUpdateData.password = await bcrypt.hash(newPassword, 10)
    }

    // Use transaction to update all related data
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user data if there are changes
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id: session.user.id },
          data: userUpdateData,
        })
      }

      // Update student-specific data
      if (user.student) {
        const studentUpdateData: any = {}
        if (gender !== undefined) studentUpdateData.gender = gender
        if (dateOfBirth !== undefined) {
          studentUpdateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : user.student.dateOfBirth
        }
        if (address !== undefined) studentUpdateData.address = address || null
        if (emergencyContact !== undefined) studentUpdateData.emergencyContact = emergencyContact || null
        if (bloodGroup !== undefined) studentUpdateData.bloodGroup = bloodGroup || null

        if (Object.keys(studentUpdateData).length > 0) {
          await tx.student.update({
            where: { id: user.student.id },
            data: studentUpdateData,
          })
        }
      }

      // Update staff-specific data
      if (user.staff) {
        const staffUpdateData: any = {}
        if (gender !== undefined) staffUpdateData.gender = gender || null
        if (dateOfBirth !== undefined) {
          staffUpdateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null
        }
        if (address !== undefined) staffUpdateData.address = address || null
        if (department !== undefined) staffUpdateData.department = department || null
        if (qualification !== undefined) staffUpdateData.qualification = qualification || null

        if (Object.keys(staffUpdateData).length > 0) {
          await tx.staff.update({
            where: { id: user.staff.id },
            data: staffUpdateData,
          })
        }
      }

      // Fetch and return updated user
      return tx.user.findUnique({
        where: { id: session.user.id },
        include: {
          student: {
            include: {
              classEnrollment: {
                where: { status: "ACTIVE" },
                include: {
                  class: true,
                  section: true,
                  academicYear: true,
                },
                orderBy: { enrolledAt: "desc" },
                take: 1,
              },
            },
          },
          staff: true,
          parent: {
            include: {
              students: {
                include: {
                  student: {
                    include: {
                      user: {
                        select: {
                          name: true,
                          email: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          roles: {
            include: {
              role: true,
            },
          },
        },
      })
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Profile",
      request,
      {
        entityId: session.user.id,
        description: `Updated own profile`,
      }
    )

    // Remove sensitive data
    const { password, ...userWithoutPassword } = updatedUser as any

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error("Error updating profile:", error)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }
}
