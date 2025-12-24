#!/bin/bash

# Stop execution if any command fails
set -e

# 0. Branch Selection & Confirmation
CURRENT_BRANCH=$(git branch --show-current)
TARGET_BRANCH=$1

# If no argument provided, ask user
if [ -z "$TARGET_BRANCH" ]; then
    echo "Current branch is: $CURRENT_BRANCH"
    read -p "Enter branch to deploy (default: $CURRENT_BRANCH): " INPUT_BRANCH
    TARGET_BRANCH=${INPUT_BRANCH:-$CURRENT_BRANCH}
fi

echo ""
echo "============================================"
echo "🚀 Deployment Configuration"
echo "============================================"
echo "Target Branch: $TARGET_BRANCH"
echo "============================================"
echo ""

read -p "Are you sure you want to deploy this branch? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled."
    exit 0
fi

echo "🚀 Starting deployment for branch: $TARGET_BRANCH"

# 1. Pull latest code
echo "📥 Pulling latest changes..."
git fetch origin

# 기존 빌드 파일로 인한 충돌 방지: 로컬 변경사항 강제 리셋
echo "🔄 Resetting local changes..."
git reset --hard HEAD
# dev 캐시만 정리 (프로덕션 빌드 파일은 보존)
rm -rf web/.next/dev 2>/dev/null || true

git checkout $TARGET_BRANCH
git pull origin $TARGET_BRANCH

# 2. Python Backend Update
echo "🐍 Updating Python Backend..."
cd desk
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate
cd ..

# 3. Web Deployment
cd web

echo "📦 Installing dependencies..."
npm install

# 빌드 여부 선택 (기본값: N - 로컬에서 빌드 후 push한 경우 스킵)
read -p "Do you want to build on VM? (y/N): " BUILD_CONFIRM
if [[ "$BUILD_CONFIRM" =~ ^[Yy]$ ]]; then
    echo "⚡ Building Next.js..."
    npm run build
else
    echo "⏭️ Skipping build (using pre-built from local)..."
fi

# Return to root
cd ..

# 4. Restart PM2
echo "🔄 Restarting PM2 services..."
pm2 restart all

echo "✅ Deployment complete!"
echo "📊 PM2 Status:"
pm2 status
