$ErrorActionPreference = "Stop"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$ist = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "India Standard Time")
$timestamp = $ist.ToString("MMM dd, yyyy, hh:mm tt")
$commitMsg = "CC System Last Synced $timestamp"

Write-Host "⚡ Deploy: $commitMsg" -ForegroundColor Cyan

# 1. Git add + commit
git add -A
$hasChanges = git status --porcelain --ignore-submodules
if ($hasChanges) {
    git commit -m $commitMsg --quiet
    Write-Host "✓ Committed" -ForegroundColor Green
}
else {
    Write-Host "✓ No new changes" -ForegroundColor Yellow
}

# 2. Push to remote (triggers Vercel auto-deploy)
git push --quiet
Write-Host "✓ Pushed — Vercel auto-deploying" -ForegroundColor Green

$sw.Stop()
$totalTime = [math]::Round($sw.Elapsed.TotalSeconds)
Write-Host "`n✅ Done in ${totalTime}s — deploying at https://menu-qr-hotels.vercel.app" -ForegroundColor Green
