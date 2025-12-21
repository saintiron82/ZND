#!/bin/bash

# Stop execution if any command fails
set -e

echo "🚀 Starting deployment..."

# 1. Pull latest code
echo "📥 Pulling latest changes..."
CURRENT_BRANCH=$(git branch --show-current)
git pull origin $CURRENT_BRANCH

# 2. Web Deployment
echo "🏗️ Building Web App..."
cd web

echo "📦 Installing dependencies..."
npm install

echo "⚡ Building Next.js..."
npm run build

# Return to root
cd ..

# 3. Restart PM2
echo "🔄 Restarting PM2 service..."
pm2 restart znd-web

echo "✅ Deployment complete!"
