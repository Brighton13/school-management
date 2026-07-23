const { execFileSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

function readPackage() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
}

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(' ')}`)
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  })
}

function copyIfExists(source, destination) {
  if (!fs.existsSync(source)) return
  fs.cpSync(source, destination, { recursive: true, force: true })
}

function removePackagedEnvFiles(releaseDir) {
  for (const name of fs.readdirSync(releaseDir)) {
    if (name === '.env' || (name.startsWith('.env.') && name !== '.env.example')) {
      fs.rmSync(path.join(releaseDir, name), { recursive: true, force: true })
    }
  }
}

function cleanDir(directory) {
  const resolved = path.resolve(directory)
  const resolvedDist = path.resolve(distDir)
  if (!resolved.startsWith(resolvedDist + path.sep)) {
    throw new Error(`Refusing to clean outside dist: ${resolved}`)
  }

  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 })
  fs.mkdirSync(resolved, { recursive: true })
}

function cleanNextOutput() {
  const nextDir = path.join(rootDir, '.next')
  const resolved = path.resolve(nextDir)
  if (resolved !== path.join(rootDir, '.next')) {
    throw new Error(`Refusing to clean unexpected Next output path: ${resolved}`)
  }

  fs.rmSync(nextDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 })
}

function cleanDistOutput() {
  const resolved = path.resolve(distDir)
  if (resolved !== path.join(rootDir, 'dist')) {
    throw new Error(`Refusing to clean unexpected dist path: ${resolved}`)
  }

  fs.rmSync(distDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 })
  fs.mkdirSync(distDir, { recursive: true })
}

function writeText(filePath, content, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content.replace(/\r?\n/g, '\n'), 'utf8')
  if (mode) fs.chmodSync(filePath, mode)
}

function createRelease(platform) {
  const pkg = readPackage()
  const releaseName = `${pkg.name}-${pkg.version}-${platform}`
  const releaseDir = path.join(distDir, releaseName)

  cleanDistOutput()
  cleanNextOutput()
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'])

  if (!fs.existsSync(path.join(rootDir, '.next', 'standalone', 'server.js'))) {
    throw new Error('Missing .next/standalone/server.js. Ensure next.config.js has output: "standalone".')
  }

  cleanDir(releaseDir)

  fs.cpSync(path.join(rootDir, '.next', 'standalone'), releaseDir, { recursive: true, force: true })
  removePackagedEnvFiles(releaseDir)
  copyIfExists(path.join(rootDir, '.next', 'static'), path.join(releaseDir, '.next', 'static'))
  copyIfExists(path.join(rootDir, 'public'), path.join(releaseDir, 'public'))
  copyIfExists(path.join(rootDir, 'prisma'), path.join(releaseDir, 'prisma'))
  copyIfExists(path.join(rootDir, 'env.example'), path.join(releaseDir, '.env.example'))
  copyIfExists(path.join(rootDir, 'README.md'), path.join(releaseDir, 'README.md'))

  copyIfExists(path.join(rootDir, 'node_modules', 'prisma'), path.join(releaseDir, 'node_modules', 'prisma'))
  copyIfExists(path.join(rootDir, 'node_modules', '@prisma'), path.join(releaseDir, 'node_modules', '@prisma'))
  copyIfExists(path.join(rootDir, 'node_modules', '.prisma'), path.join(releaseDir, 'node_modules', '.prisma'))

  writeText(path.join(releaseDir, 'start.js'), startScript())
  writeText(path.join(releaseDir, 'FIRST_RUN.txt'), firstRunText())

  return { pkg, releaseName, releaseDir }
}

function firstRunText() {
  return `
School Management packaged app

Before first start:
1. Create a PostgreSQL database.
2. Copy .env.example to .env.
3. Edit DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, FILESERVER_URL, and any payment/email settings.
4. Start the app.

On the first successful start, the launcher runs:
  prisma db push --schema prisma/schema.prisma --skip-generate

That creates/updates the PostgreSQL tables using the DATABASE_URL from .env.
The marker file .first-run-db-complete prevents this from running on every start.
Delete that marker if you intentionally want the startup schema push to run again.
`.trimStart()
}

function startScript() {
  return `
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const appDir = __dirname
const envFile = path.join(appDir, '.env')
const markerFile = path.join(appDir, '.first-run-db-complete')
const schemaFile = path.join(appDir, 'prisma', 'schema.prisma')
const prismaCli = path.join(appDir, 'node_modules', 'prisma', 'build', 'index.js')

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\\r?\\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) continue

    const key = trimmed.slice(0, equalIndex).trim()
    let value = trimmed.slice(equalIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function runFirstStartDatabaseSetup() {
  if (fs.existsSync(markerFile)) return

  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is missing. Copy .env.example to .env and set your PostgreSQL connection string.')
  }

  if (!fs.existsSync(schemaFile)) {
    fail('Missing prisma/schema.prisma in the packaged app.')
  }

  if (!fs.existsSync(prismaCli)) {
    fail('Missing packaged Prisma CLI. Rebuild the package from the project root.')
  }

  console.log('First run detected. Creating/updating PostgreSQL tables from prisma/schema.prisma...')
  const result = spawnSync(process.execPath, [
    prismaCli,
    'db',
    'push',
    '--schema',
    schemaFile,
    '--skip-generate',
  ], {
    cwd: appDir,
    env: process.env,
    stdio: 'inherit',
  })

  if (result.status !== 0) {
    fail('Database setup failed. Fix .env/PostgreSQL, then start the app again.')
  }

  fs.writeFileSync(markerFile, new Date().toISOString() + '\\n', 'utf8')
}

loadEnv(envFile)
runFirstStartDatabaseSetup()

process.env.NODE_ENV = process.env.NODE_ENV || 'production'
process.env.PORT = process.env.PORT || '3000'
process.env.HOSTNAME = process.env.HOSTNAME || '0.0.0.0'

console.log('Starting School Management on http://' + process.env.HOSTNAME + ':' + process.env.PORT)
require(path.join(appDir, 'server.js'))
`.trimStart()
}

function copyNodeRuntime(releaseDir, outputName) {
  fs.copyFileSync(process.execPath, path.join(releaseDir, outputName))
}

function findCommand(candidates) {
  for (const candidate of candidates) {
    const result = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [candidate], {
      encoding: 'utf8',
    })
    if (result.status === 0) return result.stdout.split(/\r?\n/).find(Boolean)
  }
  return null
}

module.exports = {
  cleanDir,
  copyNodeRuntime,
  createRelease,
  distDir,
  findCommand,
  rootDir,
  run,
  writeText,
}
