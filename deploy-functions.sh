#!/bin/bash

# Script to deploy Firebase functions for eShipPlus API

echo "🚀 Deploying Firebase functions for eShipPlus API..."

# Make sure firebase-tools is installed
if ! command -v firebase &> /dev/null
then
    echo "Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Load environment variables
echo "📋 Setting environment variables..."
source .env

# Set Firebase environment variables for functions
echo "🔧 Configuring Firebase Functions environment..."
firebase functions:config:set eshipplus.access_code="TENANT1" \
                             eshipplus.username="ryan.blakey" \
                             eshipplus.password="Reynard123$" \
                             eshipplus.access_key="a33b98de-a066-4766-ac9e-1eab39ce6806" \
                             eshipplus.api_key="eshipplus-demo-key"

# Make sure all dependencies are installed
echo "📦 Installing dependencies..."
cd functions
npm install
cd ..

# Deploy the eShipPlus function
echo "🔥 Deploying to Firebase..."
firebase deploy --only functions:getRatesEShipPlus

echo "✅ Deployment complete!"
echo "API endpoint: https://us-central1-solushipx.cloudfunctions.net/getRatesEShipPlus"
echo ""
echo "To call the API, use:"
echo "curl -X POST https://us-central1-solushipx.cloudfunctions.net/getRatesEShipPlus \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"apiKey\": \"$REACT_APP_ESHIP_PLUS_API_KEY\", ...}'"
echo ""
echo "Note: We've streamlined the code to only use one function for better maintainability." 