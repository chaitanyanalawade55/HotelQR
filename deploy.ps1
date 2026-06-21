$ErrorActionPreference = "Stop"

$ist = [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, "India Standard Time")
$timestamp = $ist.ToString("MMM dd, yyyy, hh:mm tt")
$commitMsg = "CC System Last Synced $timestamp"

Write-Host "Deploying with commit: $commitMsg" -ForegroundColor Cyan

git add -A

$hasChanges = git status --porcelain
if ($hasChanges) {
    git commit -m $commitMsg
    Write-Host "Committed" -ForegroundColor Green
}
else {
    Write-Host "Nothing new to commit, pushing existing" -ForegroundColor Yellow
}

git push
Write-Host "Pushed to remote" -ForegroundColor Green

$vercelExists = Get-Command vercel -ErrorAction SilentlyContinue
if ($vercelExists) {
    Write-Host "Deploying to Vercel..." -ForegroundColor Cyan
    vercel --prod
    Write-Host "Deployment completed" -ForegroundColor Green
}
else {
    Write-Host "Vercel CLI not found. Git push will trigger auto-deploy." -ForegroundColor Yellow
}
