#!/usr/bin/env pwsh
# deploy.ps1 - Auto-commit with IST timestamp, push, and deploy to Vercel.
# NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads a script with no
# BOM as ANSI, and non-ASCII characters (emoji) break the parser, so avoid them.

$ErrorActionPreference = "Stop"

# Generate IST timestamp (UTC+5:30)
$ist = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "India Standard Time")
$timestamp = $ist.ToString("dd-MM-yyyy HH:mm:ss")
$commitMsg = "Push Updated $timestamp IST"

Write-Host "`n==> Deploying with commit: $commitMsg`n" -ForegroundColor Cyan

# Stage all changes
git add -A

# Commit (skip if nothing to commit)
$status = git status --porcelain
if ($status) {
    git commit -m $commitMsg
    Write-Host "[OK] Committed" -ForegroundColor Green
} else {
    Write-Host "[..] Nothing to commit - pushing existing commits" -ForegroundColor Yellow
}

# Push to remote (Vercel's Git integration auto-deploys on push)
git push
Write-Host "[OK] Pushed to remote" -ForegroundColor Green

# Deploy to Vercel production via CLI if available; otherwise the push above
# already triggered Vercel's automatic deployment.
if (Get-Command vercel -ErrorAction SilentlyContinue) {
    Write-Host "`n==> Deploying to Vercel (CLI)...`n" -ForegroundColor Cyan
    vercel --prod
    Write-Host "`n[OK] Deployment to Vercel completed." -ForegroundColor Green
} else {
    Write-Host "`n[..] Vercel CLI not found - your git push will trigger Vercel's auto-deploy." -ForegroundColor Yellow
}
