#Requires -Version 5.1
<#
.SYNOPSIS
    Creates the WoCow five-branch layout on a fresh clone.

.DESCRIPTION
    Run this once, from anywhere, after cloning the repository:

        pwsh -File scripts/setup-branches.ps1

    It is idempotent: branches that already exist are left untouched, and it
    never deletes or resets anything. It refuses to run if there is no first
    commit yet, because Git cannot create a branch without one.

.PARAMETER Push
    Also push every branch to origin, so the rest of the team can check them
    out immediately.

.EXAMPLE
    pwsh -File scripts/setup-branches.ps1 -Push
#>
[CmdletBinding()]
param(
    [string]$MainBranch = 'main',
    [switch]$Push
)

$ErrorActionPreference = 'Stop'

$branches = @(
    @{ Name = 'feature/frontend';    Owner = 'Person 1'; Area = 'UI / 界面' }
    @{ Name = 'feature/map';         Owner = 'Person 2'; Area = '地图' }
    @{ Name = 'feature/backend';     Owner = 'Person 3'; Area = '数据库与活动' }
    @{ Name = 'feature/matching';    Owner = 'Person 4'; Area = '匹配算法' }
    @{ Name = 'feature/integration'; Owner = 'Person 5'; Area = '集成与测试' }
)

function Find-Git {
    $command = Get-Command git -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    # winget installs Git outside the PATH of already-open terminals.
    $candidates = @(
        "$env:ProgramFiles\Git\cmd\git.exe"
        "${env:ProgramFiles(x86)}\Git\cmd\git.exe"
        "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    throw 'Git was not found. Install it from https://git-scm.com/downloads and reopen your terminal.'
}

$git = Find-Git
Write-Host "Using $git" -ForegroundColor DarkGray

# Always operate on the repository root, whatever the current directory is.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot
Write-Host "Repository: $repoRoot" -ForegroundColor DarkGray
Write-Host ''

# --- initialise if needed -----------------------------------------------------
& $git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'No Git repository here — running git init.' -ForegroundColor Yellow
    & $git init -b $MainBranch | Out-Null
}

# --- a branch needs at least one commit ---------------------------------------
& $git rev-parse --verify HEAD *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'There is no commit yet, so there is nothing for a branch to point at.' -ForegroundColor Red
    Write-Host 'Make the first commit, then run this script again:'
    Write-Host ''
    Write-Host '    git add .' -ForegroundColor Cyan
    Write-Host '    git commit -m "Initialize WoCow React application"' -ForegroundColor Cyan
    Write-Host ''
    exit 1
}

# --- make sure we start from the main branch ----------------------------------
$current = (& $git rev-parse --abbrev-ref HEAD).Trim()
if ($current -ne $MainBranch) {
    & $git switch $MainBranch 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Could not switch to '$MainBranch' (currently on '$current')." -ForegroundColor Yellow
        Write-Host 'Resolve that first — there may be uncommitted changes.'
        exit 1
    }
}

function Test-LocalBranch([string]$Name) {
    & $git show-ref --verify --quiet "refs/heads/$Name" 2>$null
    return $LASTEXITCODE -eq 0
}

# --- create the branches ------------------------------------------------------
$created = 0
$existing = 0
$results = @()

foreach ($branch in $branches) {
    if (Test-LocalBranch $branch.Name) {
        $existing++
        $results += [pscustomobject]@{
            Branch = $branch.Name
            Owner  = $branch.Owner
            Area   = $branch.Area
            Status = 'already existed'
        }
        continue
    }

    & $git branch $branch.Name 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        # A branch name containing '/' works fine in Git, but be explicit if
        # something rejects it.
        Write-Host "Failed to create $($branch.Name)" -ForegroundColor Red
        continue
    }

    $created++
    $results += [pscustomobject]@{
        Branch = $branch.Name
        Owner  = $branch.Owner
        Area   = $branch.Area
        Status = 'created'
    }
}

Write-Host 'Branch layout:' -ForegroundColor Green
$results | Format-Table -AutoSize

# --- optionally publish them --------------------------------------------------
if ($Push) {
    Write-Host 'Pushing branches to origin…' -ForegroundColor DarkGray
    foreach ($branch in $branches) {
        & $git push -u origin $branch.Name 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  pushed $($branch.Name)" -ForegroundColor DarkGray
        } else {
            Write-Host "  could not push $($branch.Name) — is 'origin' set up?" -ForegroundColor Yellow
        }
    }
    Write-Host ''
}

Write-Host "Done. Created $created, already present $existing." -ForegroundColor Green
Write-Host ''
Write-Host 'Next, each person gets on their own branch:' -ForegroundColor Cyan
Write-Host '    git switch feature/matching' -ForegroundColor Cyan
Write-Host ''
Write-Host 'See docs/GIT_WORKFLOW.md for the daily loop.' -ForegroundColor DarkGray
