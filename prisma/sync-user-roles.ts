import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * This script syncs users' role string field to the UserRole table.
 * It ensures that all users with a role string have a corresponding UserRole entry,
 * so they properly inherit permissions from their role.
 * 
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/sync-user-roles.ts
 * Or: npm run sync-roles
 */
async function main() {
  console.log("🔄 Starting user role synchronization...")
  console.log("================================================\n")

  // Get all roles from the database
  const roles = await prisma.role.findMany()
  const roleMap = new Map(roles.map(r => [r.name, r.id]))
  
  console.log(`📋 Found ${roles.length} roles in the system:`)
  roles.forEach(r => console.log(`   - ${r.name} (${r.id})`))
  console.log()

  // Get all users with their current role assignments
  const users = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  })

  console.log(`👥 Found ${users.length} users in the system\n`)

  let syncedCount = 0
  let alreadySyncedCount = 0
  let errorCount = 0

  for (const user of users) {
    const userRoleName = user.role // Legacy role field
    const hasUserRoleEntry = user.roles.length > 0
    
    // Check if the user's role string matches any entry in UserRole
    const hasMatchingRole = user.roles.some(ur => ur.role.name === userRoleName)

    if (!roleMap.has(userRoleName)) {
      console.log(`⚠️  User "${user.name}" (${user.email}) has invalid role "${userRoleName}" - skipping`)
      errorCount++
      continue
    }

    if (hasUserRoleEntry && hasMatchingRole) {
      console.log(`✅ User "${user.name}" (${user.email}) already has correct role assignment`)
      alreadySyncedCount++
      continue
    }

    // Need to sync: either no UserRole entry or mismatch
    const roleId = roleMap.get(userRoleName)!
    
    try {
      // Remove any existing role assignments that don't match
      if (hasUserRoleEntry && !hasMatchingRole) {
        await prisma.userRole.deleteMany({
          where: { userId: user.id }
        })
        console.log(`   🗑️  Removed mismatched role assignments for "${user.name}"`)
      }

      // Create the correct role assignment
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: roleId
        }
      })
      
      console.log(`🔗 Synced "${user.name}" (${user.email}) to role "${userRoleName}"`)
      syncedCount++
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - role already assigned
        console.log(`✅ User "${user.name}" already has role "${userRoleName}" assigned`)
        alreadySyncedCount++
      } else {
        console.error(`❌ Error syncing user "${user.name}":`, error.message)
        errorCount++
      }
    }
  }

  console.log("\n================================================")
  console.log("📊 Synchronization Summary:")
  console.log(`   ✅ Already synced: ${alreadySyncedCount}`)
  console.log(`   🔗 Newly synced: ${syncedCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log("================================================")

  // Verify the sync by showing permission counts
  console.log("\n📋 Verifying permissions after sync:\n")
  
  const verifyUsers = await prisma.user.findMany({
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                where: { granted: true }
              }
            }
          }
        }
      },
      permissions: {
        where: { granted: true }
      }
    }
  })

  for (const user of verifyUsers) {
    const rolePermCount = user.roles.reduce((sum, ur) => sum + ur.role.permissions.length, 0)
    const directPermCount = user.permissions.length
    const roleName = user.roles.length > 0 ? user.roles.map(ur => ur.role.name).join(', ') : 'NO ROLE ASSIGNED'
    
    console.log(`   ${user.name} (${user.email})`)
    console.log(`      Role: ${roleName}`)
    console.log(`      Permissions from role: ${rolePermCount}`)
    if (directPermCount > 0) {
      console.log(`      Direct permissions: ${directPermCount} (will be ignored since role is assigned)`)
    }
    console.log()
  }

  console.log("✅ User role synchronization complete!")
}

main()
  .catch((e) => {
    console.error("❌ Synchronization failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
