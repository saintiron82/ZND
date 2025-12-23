#!/bin/bash

# Stop execution if any command fails
set -e

# 배포할 브랜치 (인자로 받거나 기본값 사용)
TARGET_BRANCH=${1:-$(git branch --show-current)}

echo "🚀 Starting deployment for branch: $TARGET_BRANCH"

# 1. Pull latest code
echo "📥 Pulling latest changes..."
git fetch origin
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
echo "🏗️ Building Web App..."
cd web

echo "📦 Installing dependencies..."
npm install

echo "⚡ Building Next.js..."
npm run build

# Return to root
cd ..

# 4. Restart PM2
echo "🔄 Restarting PM2 services..."
pm2 restart all

echo "✅ Deployment complete!"
echo "📊 PM2 Status:"
pm2 status
