const fs = require('fs')
const path = require('path')
const {
  copyNodeRuntime,
  createRelease,
  findCommand,
  rootDir,
  run,
  writeText,
} = require('./package-common')

const { releaseDir } = createRelease('windows')

copyNodeRuntime(releaseDir, 'node.exe')

writeText(
  path.join(releaseDir, 'school-management.cmd'),
  `@echo off
setlocal
set APP_DIR=%~dp0
"%APP_DIR%node.exe" "%APP_DIR%start.js"
`,
)

const launcherSource = path.join(releaseDir, 'school-management-launcher.cs')
const launcherExe = path.join(releaseDir, 'school-management.exe')

writeText(
  launcherSource,
  `
using System;
using System.Diagnostics;
using System.IO;

class SchoolManagementLauncher
{
    static int Main()
    {
        string appDir = AppDomain.CurrentDomain.BaseDirectory;
        string nodePath = Path.Combine(appDir, "node.exe");
        string startPath = Path.Combine(appDir, "start.js");

        if (!File.Exists(nodePath))
        {
            Console.Error.WriteLine("Missing node.exe beside school-management.exe.");
            return 1;
        }

        if (!File.Exists(startPath))
        {
            Console.Error.WriteLine("Missing start.js beside school-management.exe.");
            return 1;
        }

        var process = new Process();
        process.StartInfo.FileName = nodePath;
        process.StartInfo.Arguments = "\\\"" + startPath + "\\\"";
        process.StartInfo.WorkingDirectory = appDir;
        process.StartInfo.UseShellExecute = false;
        process.Start();
        process.WaitForExit();
        return process.ExitCode;
    }
}
`.trimStart()
)

const csc = findCommand(['csc'])
if (csc) {
  run(csc, ['/nologo', `/out:${launcherExe}`, launcherSource], { cwd: rootDir, shell: false })
} else {
  const powershell = findCommand(['powershell.exe', 'powershell'])
  if (!powershell) {
    throw new Error(
      'Could not find csc.exe or powershell.exe, so school-management.exe could not be built. A school-management.cmd fallback was created in dist.'
    )
  }

  run(
    powershell,
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '& { param($src, $out) Add-Type -TypeDefinition (Get-Content -LiteralPath $src -Raw) -OutputAssembly $out -OutputType ConsoleApplication }',
      launcherSource,
      launcherExe,
    ],
    { cwd: rootDir, shell: false }
  )
}

fs.rmSync(launcherSource, { force: true })

console.log(`Created ${launcherExe}`)
