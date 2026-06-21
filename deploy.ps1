$ErrorActionPreference = "Stop"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$ist = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "India Standard Time")
$timestamp = $ist.ToString("MMM dd, yyyy, hh:mm tt")
$commitMsg = "CC System Last Synced $timestamp"

Write-Host "⚡ Fast Deploy: $commitMsg" -ForegroundColor Cyan

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

# 2. Git push in background
$gitJob = Start-Job -ScriptBlock { Set-Location $using:PWD; git push --quiet 2>&1 }

# 3. Build locally (faster than Vercel's 2-core machine)
Write-Host "📦 Building locally..." -ForegroundColor Cyan
$buildStart = $sw.Elapsed.TotalSeconds
vercel build --prod --yes 2>&1 | Select-String -Pattern "✓|Done|error|Error|Build"
$buildTime = [math]::Round($sw.Elapsed.TotalSeconds - $buildStart)
Write-Host "✓ Built in ${buildTime}s" -ForegroundColor Green

# 4. Deploy pre-built (skips remote install + build!)
Write-Host "🚀 Deploying pre-built to Vercel..." -ForegroundColor Cyan
vercel deploy --prebuilt --prod --yes
Write-Host "✓ Deployed" -ForegroundColor Green

# 5. Wait for git push
$gitJob | Wait-Job | Out-Null
Write-Host "✓ Git synced" -ForegroundColor Green

$sw.Stop()
$totalTime = [math]::Round($sw.Elapsed.TotalSeconds)
Write-Host "`n✅ Deploy complete in ${totalTime}s" -ForegroundColor Green
