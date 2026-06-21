#!/bin/bash
set -e

START=$(date +%s)
timestamp=$(TZ="Asia/Kolkata" date "+%b %d, %Y, %I:%M %p")
commitMsg="GG System Last Synced $timestamp"

echo -e "\033[36m⚡ Fast Deploy: $commitMsg\033[0m"

# 1. Git add + commit (quick)
git add -A
if [ -n "$(git status --porcelain --ignore-submodules)" ]; then
    git commit -m "$commitMsg" --quiet
    echo -e "\033[32m✓ Committed\033[0m"
else
    echo -e "\033[33m✓ No new changes\033[0m"
fi

# 2. Git push in background (non-blocking)
git push --quiet 2>/dev/null &
GIT_PID=$!

# 3. Build locally (your Mac is faster than Vercel's 2-core machine)
echo -e "\033[36m📦 Building locally...\033[0m"
BUILD_START=$(date +%s)
vercel build --prod --yes 2>&1 | grep -E "(✓|Done|error|Error|Build)" || true
BUILD_END=$(date +%s)
echo -e "\033[32m✓ Built in $((BUILD_END - BUILD_START))s\033[0m"

# 4. Deploy pre-built output (skips remote install + build entirely!)
echo -e "\033[36m🚀 Deploying pre-built to Vercel...\033[0m"
DEPLOY_OUTPUT=$(vercel deploy --prebuilt --prod --yes 2>&1)
PROD_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://[^ ]*vercel\.app' | tail -1)
echo -e "\033[32m✓ Live: ${PROD_URL:-deployed}\033[0m"

# 5. Wait for background git push
wait $GIT_PID 2>/dev/null && echo -e "\033[32m✓ Git synced\033[0m" || echo -e "\033[33m⚠ Git push pending\033[0m"

END=$(date +%s)
echo -e "\033[32m\n✅ Deploy complete in $((END - START))s\033[0m"
