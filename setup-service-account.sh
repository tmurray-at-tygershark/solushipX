#!/bin/bash

# Setup Service Account
# This script helps to set up Firebase service account files securely

echo "🔒 Setting up Firebase Service Account securely"
echo "=============================================="

# Check if input file was provided
if [ -z "$1" ]; then
  echo "❌ Error: No service account file provided"
  echo "Usage: ./setup-service-account.sh path/to/your-service-account-file.json"
  exit 1
fi

SOURCE_FILE="$1"

# Check if source file exists
if [ ! -f "$SOURCE_FILE" ]; then
  echo "❌ Error: File $SOURCE_FILE does not exist"
  exit 1
fi

# Copy to standard locations
echo "📄 Copying service account file to standardized locations..."
cp "$SOURCE_FILE" "./service-account.json"
cp "$SOURCE_FILE" "./functions/service-account.json"

# Set permissions
chmod 600 "./service-account.json"
chmod 600 "./functions/service-account.json"

echo "✅ Service account setup complete!"
echo ""
echo "⚠️  Important: These files have been added to .gitignore to prevent them"
echo "   from being committed to your repository. Never commit service account"
echo "   files to GitHub or any public repository."
echo ""
echo "📋 Next steps:"
echo "1. Deploy your functions to apply the new service account:"
echo "   firebase deploy --only functions"
echo ""
echo "2. If you want to save these changes to git, only commit the .gitignore changes:"
echo "   git add .gitignore"
echo "   git commit -m \"Add service account files to .gitignore\""
echo "" 