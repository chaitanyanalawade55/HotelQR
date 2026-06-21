#!/bin/bash
set -e

timestamp=$(TZ="Asia/Kolkata" date "+%d-%m-%Y %H:%M:%S")
commitMsg="Push Updated $timestamp IST"

echo -e "\033[36mDeploying with commit: $commitMsg\033[0m"

git add -A

if [ -n "$(git status --porcelain --ignore-submodules)" ]; then
    git commit -m "$commitMsg"
    echo -e "\033[32mCommitted\033[0m"
else
    echo -e "\033[33mNothing new to commit, pushing existing\033[0m"
fi

git push
echo -e "\033[32mPushed to remote\033[0m"

if command -v vercel &> /dev/null; then
    echo -e "\033[36mDeploying to Vercel...\033[0m"
    vercel --prod
    echo -e "\033[32mDeployment completed\033[0m"
else
    echo -e "\033[33mVercel CLI not found. Git push will trigger auto-deploy.\033[0m"
fi
