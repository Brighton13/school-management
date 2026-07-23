const fs = require('fs')
const path = require('path')
const {
  copyNodeRuntime,
  createRelease,
  distDir,
  rootDir,
  run,
  writeText,
} = require('./package-common')

if (process.platform === 'win32') {
  console.warn('Linux packages should be built on Linux so the bundled node binary and Prisma engines match Linux.')
}

const { releaseName, releaseDir } = createRelease('linux')

copyNodeRuntime(releaseDir, 'node')
fs.chmodSync(path.join(releaseDir, 'node'), 0o755)

writeText(
  path.join(releaseDir, 'school-management'),
  `#!/usr/bin/env sh
set -eu
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$APP_DIR/node" "$APP_DIR/start.js"
`,
  0o755
)

const archivePath = path.join(distDir, `${releaseName}.tar.gz`)
if (fs.existsSync(archivePath)) fs.rmSync(archivePath, { force: true })

run('tar', ['-czf', archivePath, '-C', distDir, releaseName], { cwd: rootDir, shell: false })

console.log(`Created ${archivePath}`)
