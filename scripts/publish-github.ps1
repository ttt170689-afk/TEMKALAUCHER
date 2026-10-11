$ErrorActionPreference = 'Stop'
$Repo = 'ttt170689-afk/TEMKALAUCHER'
$Source = Split-Path $PSScriptRoot -Parent

function Run-Native([string] $Command, [string[]] $Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Command failed (exit $LASTEXITCODE)." }
}

try {
    foreach ($tool in @('git', 'gh')) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            throw "Install Git and GitHub CLI first, then reopen this window. Missing: $tool"
        }
    }
    & gh auth status
    if ($LASTEXITCODE -ne 0) { Run-Native 'gh' @('auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web', '--scopes', 'workflow') }
    Run-Native 'gh' @('auth', 'refresh', '--hostname', 'github.com', '--scopes', 'workflow')
    Run-Native 'gh' @('auth', 'setup-git')
    $UserJson = & gh api user
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read GitHub account.' }
    $User = $UserJson | ConvertFrom-Json
    $RepoJson = & gh repo view $Repo --json defaultBranchRef,viewerPermission
    if ($LASTEXITCODE -ne 0) { throw 'Repository not accessible.' }
    $RemoteInfo = $RepoJson | ConvertFrom-Json
    if ($RemoteInfo.viewerPermission -notin @('ADMIN', 'MAINTAIN', 'WRITE')) { throw 'This account cannot push to the repository.' }
    $Branch = $RemoteInfo.defaultBranchRef.name
    if (-not $Branch) { throw 'No default branch. This script expects the existing repository.' }
    $Version = (Get-Content (Join-Path $Source 'package.json') -Raw | ConvertFrom-Json).version
    Write-Host "`nAccount: $($User.login)"
    Write-Host "Repository: $Repo | branch: $Branch | version: $Version"
    Write-Host 'This replaces launcher project files, removes obsolete ZIP updater files, pushes a normal commit (no force),'
    Write-Host 'and starts GitHub Actions to build and publish a public Windows release.'
    Write-Host 'Unrelated files in the repository are preserved. Existing releases are never overwritten.'
    if ((Read-Host 'Type PUBLISH to continue') -cne 'PUBLISH') { Write-Host 'Cancelled.'; exit 0 }

    $Work = Join-Path ([IO.Path]::GetTempPath()) ('temka-publish-' + [guid]::NewGuid().ToString('N'))
    Run-Native 'git' @('clone', '--branch', $Branch, '--single-branch', "https://github.com/$Repo.git", $Work)
    $Items = @(
        '.gitignore', '.github/workflows/windows.yml', 'assets', 'electron', 'src', 'public', 'scripts', 'tests',
        'package.json', 'package-lock.json', 'electron-builder.cjs', 'vite.config.ts', 'tsconfig.json', 'index.html',
        'README.md', 'CHANGELOG.md', 'TEST-REPORT.md', 'BUILD-EXE.bat', 'BUILD-EXE-ELECTRON.bat', 'PUBLISH-GITHUB.bat'
    )
    # Explicit removals ensure old config/tooling cannot accidentally build the obsolete ZIP updater.
    $Obsolete = @('electron-builder.yml', 'neutralino.config.json', 'updater-source.txt', 'version.json',
        'MAKE-UPDATE-ZIP.bat', 'PUBLISH-UPDATE.bat', 'updater', 'updates', 'public/updates',
        'scripts/pack-update.mjs', 'scripts/publish-update.mjs')
    $Removed = @()
    foreach ($Item in $Obsolete) {
        $Target = Join-Path $Work $Item
        if (Test-Path $Target) { Remove-Item $Target -Recurse -Force; $Removed += $Item }
    }
    foreach ($Item in $Items) {
        $From = Join-Path $Source $Item
        $To = Join-Path $Work $Item
        if (-not (Test-Path $From)) { throw "Missing project file: $From" }
        New-Item -ItemType Directory -Path (Split-Path $To -Parent) -Force | Out-Null
        if ((Get-Item $From).PSIsContainer) {
            New-Item -ItemType Directory -Path $To -Force | Out-Null
            Get-ChildItem $From -Force | Copy-Item -Destination $To -Recurse -Force
        } else { Copy-Item $From $To -Force }
    }
    Push-Location $Work
    try {
        # Use the full project allowlist, never add downloaded EXEs or node_modules.
        Run-Native 'git' (@('add', '-A', '--') + $Items + $Removed)
        & git diff --cached --quiet
        if ($LASTEXITCODE -eq 1) {
            $Email = "$($User.id)+$($User.login)@users.noreply.github.com"
            Run-Native 'git' @('-c', "user.name=$($User.login)", '-c', "user.email=$Email", 'commit', '-m', "Fix TemkaLauncher $Version Windows build and auto-updates")
        } elseif ($LASTEXITCODE -ne 0) { throw 'Cannot inspect staged changes.' }
        Run-Native 'git' @('push', 'origin', $Branch)
        # Unlike a workflow created with GITHUB_TOKEN, this user-authenticated push can trigger Actions.
        Run-Native 'gh' @('workflow', 'run', 'windows.yml', '--repo', $Repo, '--ref', $Branch, '-f', 'publish=true')
        Write-Host "`nPushed. Build/publish status: https://github.com/$Repo/actions"
        Write-Host "Installer when the workflow succeeds: https://github.com/$Repo/releases/latest"
        Write-Host "Working clone retained at: $Work"
    } finally { Pop-Location }
} catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'No force push is used. Check GitHub permissions / Actions settings, then retry.'
    exit 1
}
