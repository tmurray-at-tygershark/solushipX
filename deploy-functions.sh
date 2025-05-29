#!/bin/bash

# Deploy Functions Script for SolushipX
# This script deploys Firebase functions with proper error handling

set -e  # Exit on any error

echo "🚀 Starting Firebase Functions Deployment..."
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

# Navigate to functions directory and install dependencies
echo "📦 Installing function dependencies..."
cd functions
if [ -f "package.json" ]; then
    npm install
    echo "✅ Dependencies installed successfully"
else
    echo "❌ No package.json found in functions directory"
    exit 1
fi

# Return to root directory
cd ..

# Deploy functions
echo "🔥 Deploying Firebase Functions..."
echo "   This may take a few minutes..."

if firebase deploy --only functions; then
    echo "✅ Functions deployed successfully!"
    echo ""
    echo "🎉 Deployment Complete!"
    echo "📊 Check your functions at: https://console.firebase.google.com/project/solushipx/functions"
else
    echo "❌ Functions deployment failed!"
    exit 1
fi

echo "================================================"
echo "✅ Firebase Functions Deployment Complete!" 