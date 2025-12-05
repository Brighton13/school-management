import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Checking admin user role assignment...")

  // Find admin user
  const admin = await prisma.user.findUnique({
    where: { email: "admin@school.com" },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  })

  if (!admin) {
    console.log("❌ Admin user not found!")
    return
  }

  console.log(`✅ Admin user found: ${admin.name} (${admin.email})`)
  console.log(`   Legacy role: ${admin.role}`)
  console.log(`   Assigned roles: ${admin.roles.length}`)

  if (admin.roles.length === 0) {
    console.log("\n⚠️  Admin user has no roles assigned!")
    
    // Find ADMIN role
    const adminRole = await prisma.role.findUnique({
      where: { name: "ADMIN" },
    })

    if (adminRole) {
      console.log("✅ ADMIN role exists, assigning to admin user...")
      await prisma.userRole.create({
        data: {
          userId: admin.id,
          roleId: adminRole.id,
        },
      })
      console.log("✅ Admin role assigned successfully!")
    } else {
      console.log("❌ ADMIN role not found! Please run: npm run db:seed:rbac")
    }
  } else {
    console.log("\n✅ Admin user has roles assigned:")
    admin.roles.forEach((ur) => {
      console.log(`   - ${ur.role.name}`)
    })
  }

  // Check permissions
  const adminWithPermissions = await prisma.user.findUnique({
    where: { email: "admin@school.com" },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
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

  if (adminWithPermissions && adminWithPermissions.roles.length > 0) {
    const totalPermissions = new Set<string>()
    adminWithPermissions.roles.forEach((ur) => {
      ur.role.permissions.forEach((rp) => {
        if (rp.granted) {
          totalPermissions.add(rp.permission.name)
        }
      })
    })
    console.log(`\n📊 Total permissions from roles: ${totalPermissions.size}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

