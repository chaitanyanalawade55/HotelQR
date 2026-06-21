#!/bin/bash
set -e

START=$(date +%s)
timestamp=$(TZ="Asia/Kolkata" date "+%b %d, %Y, %I:%M %p")
commitMsg="GG System Last Synced $timestamp"

echo -e "\033[36m⚡ Deploy: $commitMsg\033[0m"

# 1. Git add + commit
git add -A
if [ -n "$(git status --porcelain --ignore-submodules)" ]; then
    git commit -m "$commitMsg" --quiet
    echo -e "\033[32m✓ Committed\033[0m"
else
    echo -e "\033[33m✓ No new changes\033[0m"
fi

# 2. Push to remote (triggers Vercel auto-deploy)
git push --quiet
echo -e "\033[32m✓ Pushed — Vercel auto-deploying\033[0m"

echo -e "\033[32m\n✅ Done in $(($(date +%s) - START))s — deploying at https://menu-qr-hotels.vercel.app\033[0m"
