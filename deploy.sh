#!/bin/bash
set -e

START=$(date +%s)
timestamp=$(TZ="Asia/Kolkata" date "+%b %d, %Y, %I:%M %p")
commitMsg="GG System Last Synced $timestamp"

echo -e "\033[36m⚡ Fast Deploy: $commitMsg\033[0m"

# 1. Git add + commit
git add -A
if [ -n "$(git status --porcelain --ignore-submodules)" ]; then
    git commit -m "$commitMsg" --quiet
    echo -e "\033[32m✓ Committed\033[0m"
else
    echo -e "\033[33m✓ No new changes\033[0m"
fi

# 2. Git push in background
git push --quiet 2>/dev/null &
GIT_PID=$!

# 3. Build locally using Vercel CLI (creates .vercel/output)
echo -e "\033[36m📦 Building locally...\033[0m"
BUILD_START=$(date +%s)
vercel build --prod --yes 2>&1 | tail -10
echo -e "\033[32m✓ Built in $(($(date +%s) - BUILD_START))s\033[0m"

# 4. Deploy pre-built output (NO remote build — just upload + deploy!)
echo -e "\033[36m🚀 Deploying pre-built to Vercel...\033[0m"
DEPLOY_START=$(date +%s)
vercel deploy --prebuilt --prod --yes 2>&1 | grep -E "(Production|Aliased|Completing|error|Error)" || true
echo -e "\033[32m✓ Deployed in $(($(date +%s) - DEPLOY_START))s\033[0m"

# 5. Wait for git push
wait $GIT_PID 2>/dev/null && echo -e "\033[32m✓ Git synced\033[0m" || true

echo -e "\033[32m\n✅ Done in $(($(date +%s) - START))s\033[0m"
