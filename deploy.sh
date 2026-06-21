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

# 2. Git push in background (non-blocking)
git push --quiet 2>/dev/null &
GIT_PID=$!

# 3. Build locally (your Mac is faster than Vercel's 2-core server)
echo -e "\033[36m📦 Building...\033[0m"
BUILD_START=$(date +%s)
npx next build 2>&1 | tail -5
echo -e "\033[32m✓ Built in $(($(date +%s) - BUILD_START))s\033[0m"

# 4. Deploy to Vercel production
echo -e "\033[36m🚀 Deploying to Vercel...\033[0m"
vercel deploy --prod --yes 2>&1 | grep -E "(Production|Aliased|✓|error)" || true
echo -e "\033[32m✓ Deployed\033[0m"

# 5. Wait for background git push
wait $GIT_PID 2>/dev/null && echo -e "\033[32m✓ Git synced\033[0m" || true

echo -e "\033[32m\n✅ Done in $(($(date +%s) - START))s\033[0m"
