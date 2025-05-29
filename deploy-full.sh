#!/bin/bash

# Full Deployment Script for SolushipX
# This script handles the complete deployment: build, functions, and hosting

set -e  # Exit on any error

echo "🚀 Starting Full SolushipX Deployment..."
echo "================================================"
echo "This will deploy:"
echo "  📦 Build the frontend application"
echo "  🔥 Deploy Firebase Functions"
echo "  🌐 Deploy Frontend to Hosting"
echo "================================================"

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Check if we're logged in to Firebase
if ! firebase projects:list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please run:"
    echo "   firebase login"
    exit 1
fi

# Step 1: Install dependencies if needed
echo "📦 Checking frontend dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Step 2: Build the application
echo "🔨 Building the frontend application..."
if npm run build; then
    echo "✅ Frontend build completed successfully!"
else
    echo "❌ Frontend build failed!"
    exit 1
fi

# Step 3: Install function dependencies and deploy functions
echo "🔥 Preparing Firebase Functions..."
cd functions
if [ -f "package.json" ]; then
    echo "Installing function dependencies..."
    npm install
    echo "✅ Function dependencies installed"
else
    echo "❌ No package.json found in functions directory"
    exit 1
fi
cd ..

echo "🔥 Deploying Firebase Functions..."
if firebase deploy --only functions; then
    echo "✅ Functions deployed successfully!"
else
    echo "❌ Functions deployment failed!"
    exit 1
fi

# Step 4: Deploy to Firebase Hosting
echo "🌐 Deploying to Firebase Hosting..."
if firebase deploy --only hosting; then
    echo "✅ Hosting deployed successfully!"
else
    echo "❌ Hosting deployment failed!"
    exit 1
fi

# Success message
echo ""
echo "🎉 FULL DEPLOYMENT COMPLETE! 🎉"
echo "================================================"
echo "✅ Frontend Application: https://solushipx.web.app"
echo "✅ Firebase Console: https://console.firebase.google.com/project/solushipx"
echo "✅ Functions Console: https://console.firebase.google.com/project/solushipx/functions"
echo "✅ Hosting Console: https://console.firebase.google.com/project/solushipx/hosting"
echo "================================================"
echo "🚀 Your SolushipX application is now live with all updates!" 