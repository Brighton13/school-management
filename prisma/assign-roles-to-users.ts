import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("Assigning roles to existing users...")

  // Get all roles
  const roles = await prisma.role.findMany()
  const roleMap = new Map(roles.map((r) => [r.name, r]))

  // Get all users
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  })

  let assignedCount = 0

  for (const user of users) {
    // Skip if user already has roles assigned
    if (user.roles.length > 0) {
      console.log(`User ${user.email} already has roles assigned, skipping...`)
      continue
    }

    // Get role based on legacy role field
    const roleName = user.role.toUpperCase()
    const role = roleMap.get(roleName)

    if (role) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      })
      console.log(`✅ Assigned ${roleName} role to ${user.email}`)
      assignedCount++
    } else {
      console.log(`⚠️  No role found for ${roleName}, skipping user ${user.email}`)
    }
  }

  console.log(`\n✅ Successfully assigned roles to ${assignedCount} user(s)!`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

