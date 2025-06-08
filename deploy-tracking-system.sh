#!/bin/bash

# SolushipX Tracking System Deployment Script
# This script deploys all tracking-related cloud functions and ensures proper configuration

echo "🚀 Starting SolushipX Tracking System Deployment..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the correct directory
if [ ! -f "functions/index.js" ]; then
    print_error "This script must be run from the project root directory!"
    exit 1
fi

print_status "Checking prerequisites..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    print_error "Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if logged into Firebase
if ! firebase projects:list &> /dev/null; then
    print_error "Not logged into Firebase. Please run: firebase login"
    exit 1
fi

print_success "Prerequisites check passed"

# Navigate to functions directory
cd functions

print_status "Installing/updating dependencies..."
npm install

# Check for any dependency issues
if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

print_success "Dependencies installed successfully"

# Deploy specific tracking-related functions
print_status "Deploying tracking system functions..."

echo ""
print_status "📦 Deploying core tracking functions..."

# Deploy core tracking functions
firebase deploy --only functions:smartStatusUpdate,functions:forceStatusRefresh

if [ $? -ne 0 ]; then
    print_error "Failed to deploy core tracking functions"
    exit 1
fi

echo ""
print_status "⏰ Deploying scheduled polling functions..."

# Deploy scheduled functions
firebase deploy --only functions:pollActiveShipments,functions:backgroundStatusPoll

if [ $? -ne 0 ]; then
    print_error "Failed to deploy scheduled functions"
    exit 1
fi

echo ""
print_status "🔍 Deploying status checking functions..."

# Deploy status checking functions
firebase deploy --only functions:checkShipmentStatus

if [ $? -ne 0 ]; then
    print_error "Failed to deploy status checking functions"
    exit 1
fi

echo ""
print_status "🚚 Deploying carrier-specific functions..."

# Deploy carrier API functions
firebase deploy --only functions:getStatusPolarisTransportation

if [ $? -ne 0 ]; then
    print_warning "Failed to deploy some carrier functions, but continuing..."
fi

print_success "Core tracking functions deployed successfully!"

# Go back to project root
cd ..

echo ""
print_status "🎯 Deploying frontend updates..."

# Build the frontend
npm run build

if [ $? -ne 0 ]; then
    print_error "Failed to build frontend"
    exit 1
fi

print_success "Frontend built successfully"

# Deploy hosting
firebase deploy --only hosting

if [ $? -ne 0 ]; then
    print_error "Failed to deploy hosting"
    exit 1
fi

print_success "Frontend deployed successfully"

echo ""
echo "=================================================="
print_success "🎉 Tracking System Deployment Complete!"
echo "=================================================="

echo ""
print_status "📋 Deployed Components:"
echo "   ✅ smartStatusUpdate - Core intelligent status updates"
echo "   ✅ forceStatusRefresh - Manual refresh capability"
echo "   ✅ pollActiveShipments - Legacy 30-min polling (keeping for compatibility)"
echo "   ✅ backgroundStatusPoll - New intelligent background polling"
echo "   ✅ checkShipmentStatus - HTTP status checking"
echo "   ✅ Frontend with carrier hierarchy system"

echo ""
print_status "⏰ Scheduled Functions:"
echo "   🕐 pollActiveShipments: every 30 minutes"
echo "   🕐 backgroundStatusPoll: every 30 minutes"

echo ""
print_status "🔧 Post-Deployment Checklist:"
echo "   1. Verify scheduled functions are running in Firebase Console"
echo "   2. Test status refresh buttons in the UI"
echo "   3. Check carrier hierarchy detection with different shipment types"
echo "   4. Monitor function logs for any errors"
echo "   5. Test batch status updates from Shipments page"

echo ""
print_warning "⚠️  Manual Steps Required:"
echo "   1. Update Canpar API credentials in Firebase Console (functions config)"
echo "   2. Verify eShipPlus API endpoints are still working"
echo "   3. Test Polaris Transportation status checking"

echo ""
print_status "📊 Monitoring:"
echo "   • Function logs: https://console.firebase.google.com/project/solushipx/functions/logs"
echo "   • System events: Check 'systemEvents' collection in Firestore"
echo "   • Performance: Monitor function execution times and error rates"

echo ""
print_success "Deployment completed successfully! 🚀" 