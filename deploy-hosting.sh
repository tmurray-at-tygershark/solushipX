#!/bin/bash

# Deploy Hosting Script for SolushipX
# This script builds and deploys the frontend application

set -e  # Exit on any error

echo "🚀 Starting Frontend Build & Deployment..."
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

# Install dependencies if needed
echo "📦 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the application
echo "🔨 Building the application..."
if npm run build; then
    echo "✅ Build completed successfully!"
else
    echo "❌ Build failed!"
    exit 1
fi

# Deploy to Firebase Hosting
echo "🔥 Deploying to Firebase Hosting..."
echo "   This may take a few minutes..."

if firebase deploy --only hosting; then
    echo "✅ Hosting deployed successfully!"
    echo ""
    echo "🎉 Deployment Complete!"
    echo "🌐 Your app is live at: https://solushipx.web.app"
    echo "📊 Check your hosting at: https://console.firebase.google.com/project/solushipx/hosting"
else
    echo "❌ Hosting deployment failed!"
    exit 1
fi

echo "================================================"
echo "✅ Frontend Deployment Complete!" 