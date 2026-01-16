/**
 * Database Setup Script
 * 
 * This script runs all database migrations and seeds in one command.
 * Run with: npm run db:setup
 * 
 * What it does:
 * 1. Runs Prisma migrations (creates/updates tables)
 * 2. Generates Prisma client
 * 3. Seeds the database with:
 *    - All permissions (77 permissions)
 *    - All roles (ADMIN, PRINCIPAL, TEACHER, ACCOUNTANT, LIBRARIAN, STUDENT, PARENT)
 *    - Role-permission assignments
 *    - Sample users (admin, principal, teacher)
 *    - Sample data (classes, sections, subjects, academic year, etc.)
 */

import { execSync } from 'child_process'
import path from 'path'

const rootDir = path.resolve(__dirname, '..')

function runCommand(command: string, description: string) {
  console.log(`\n🔄 ${description}...`)
  try {
    execSync(command, { 
      cwd: rootDir, 
      stdio: 'inherit',
      env: { ...process.env }
    })
    console.log(`✅ ${description} completed`)
    return true
  } catch (error) {
    console.error(`❌ ${description} failed`)
    throw error
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗')
  console.log('║           DATABASE SETUP - School Management             ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log('║  This will set up your database with all migrations,    ║')
  console.log('║  roles, permissions, and seed data.                      ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  
  const startTime = Date.now()

  try {
    // Step 1: Generate Prisma Client
    runCommand('npx prisma generate', 'Generating Prisma Client')

    // Step 2: Run database migrations
    runCommand('npx prisma migrate deploy', 'Running database migrations')

    // Step 3: Seed the database
    runCommand('npx ts-node --project tsconfig.seed.json prisma/seed.ts', 'Seeding database')

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log('\n╔══════════════════════════════════════════════════════════╗')
    console.log('║           ✅ DATABASE SETUP COMPLETE                     ║')
    console.log('╠══════════════════════════════════════════════════════════╣')
    console.log(`║  Total time: ${duration}s`)
    console.log('╠══════════════════════════════════════════════════════════╣')
    console.log('║  What was created:                                       ║')
    console.log('║  • Database tables (via migrations)                      ║')
    console.log('║  • 77 permissions across all modules                     ║')
    console.log('║  • 7 roles: ADMIN, PRINCIPAL, TEACHER, ACCOUNTANT,      ║')
    console.log('║             LIBRARIAN, STUDENT, PARENT                   ║')
    console.log('║  • Role-permission assignments                           ║')
    console.log('║  • Sample users, classes, subjects, academic year        ║')
    console.log('╠══════════════════════════════════════════════════════════╣')
    console.log('║  Login Credentials:                                      ║')
    console.log('║  • admin@school.com / admin123                           ║')
    console.log('║  • principal@school.com / principal123                   ║')
    console.log('║  • teacher@school.com / teacher123                       ║')
    console.log('╚══════════════════════════════════════════════════════════╝')

  } catch (error) {
    console.error('\n❌ Database setup failed!')
    console.error('Please check the error above and try again.')
    process.exit(1)
  }
}

main()
