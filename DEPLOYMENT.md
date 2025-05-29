# SolushipX Deployment Guide

This guide covers all deployment options for the SolushipX application with the Universal Data Model implementation.

## 🚀 Quick Start

### Full Deployment (Recommended)
```bash
npm run deploy:full
```
This deploys everything: builds the frontend, deploys functions, and deploys hosting.

### Alternative Full Deployment
```bash
npm run deploy
```
Same as `deploy:full` - shorthand command.

## 📋 Available Deployment Commands

### Main Deployment Commands

| Command | Description | What it does |
|---------|-------------|--------------|
| `npm run deploy:full` | Complete deployment | Build + Functions + Hosting |
| `npm run deploy` | Same as deploy:full | Build + Functions + Hosting |
| `npm run deploy:functions` | Functions only | Deploy Firebase Functions |
| `npm run deploy:hosting` | Frontend only | Build + Deploy Hosting |
| `npm run deploy:quick` | Quick deploy | Build + Deploy everything (no dependency checks) |

### Development & Testing Commands

| Command | Description | What it does |
|---------|-------------|--------------|
| `npm run serve` | Local testing | Serve both hosting and functions locally |
| `npm run serve:hosting` | Test frontend | Serve only hosting locally |
| `npm run serve:functions` | Test functions | Serve only functions locally |
| `npm run functions:logs` | View logs | Show Firebase function logs |
| `npm run functions:shell` | Function shell | Interactive function testing |

### Firebase Management Commands

| Command | Description | What it does |
|---------|-------------|--------------|
| `npm run firebase:login` | Login to Firebase | Authenticate with Firebase |
| `npm run firebase:logout` | Logout from Firebase | Clear Firebase authentication |
| `npm run firebase:projects` | List projects | Show available Firebase projects |
| `npm run firebase:use` | Switch project | Change active Firebase project |

## 🔧 Deployment Scripts

### 1. `deploy-full.sh` - Complete Deployment
- ✅ Checks Firebase CLI installation
- ✅ Verifies Firebase authentication
- ✅ Installs frontend dependencies
- ✅ Builds the React application
- ✅ Installs function dependencies
- ✅ Deploys Firebase Functions
- ✅ Deploys to Firebase Hosting
- ✅ Provides deployment URLs

### 2. `deploy-functions.sh` - Functions Only
- ✅ Checks Firebase CLI and authentication
- ✅ Installs function dependencies
- ✅ Deploys only Firebase Functions
- ✅ Provides function console URL

### 3. `deploy-hosting.sh` - Frontend Only
- ✅ Checks Firebase CLI and authentication
- ✅ Installs frontend dependencies if needed
- ✅ Builds the React application
- ✅ Deploys only to Firebase Hosting
- ✅ Provides hosting URL

## 🛠️ Prerequisites

### Required Tools
1. **Node.js** (v18 or higher)
2. **npm** (comes with Node.js)
3. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

### Firebase Setup
1. **Login to Firebase**
   ```bash
   npm run firebase:login
   ```

2. **Verify Project**
   ```bash
   npm run firebase:projects
   ```

3. **Set Active Project** (if needed)
   ```bash
   firebase use solushipx
   ```

## 📊 Deployment Process

### Full Deployment Flow
```
1. 📦 Check Dependencies
   ├── Frontend dependencies (npm install)
   └── Function dependencies (functions/npm install)

2. 🔨 Build Application
   ├── React build process
   ├── Code optimization
   └── Asset bundling

3. 🔥 Deploy Functions
   ├── Upload function code
   ├── Update function configurations
   └── Verify function endpoints

4. 🌐 Deploy Hosting
   ├── Upload build files
   ├── Update hosting configuration
   └── Activate new version

5. ✅ Verification
   ├── Function URLs
   ├── Hosting URL
   └── Console links
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Firebase CLI Not Found
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Verify installation
firebase --version
```

#### 2. Not Logged In
```bash
# Login to Firebase
npm run firebase:login

# Verify login
npm run firebase:projects
```

#### 3. Wrong Project
```bash
# Check current project
firebase use

# Switch to correct project
firebase use solushipx
```

#### 4. Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Try build again
npm run build
```

#### 5. Function Deployment Issues
```bash
# Check function dependencies
cd functions
npm install
cd ..

# Deploy functions only
npm run deploy:functions
```

### Error Codes

| Exit Code | Meaning | Solution |
|-----------|---------|----------|
| 1 | General error | Check error message and logs |
| 127 | Command not found | Install missing dependencies |
| 130 | User interrupted | Re-run the command |

## 🔍 Monitoring Deployment

### Live URLs
- **Frontend**: https://solushipx.web.app
- **Firebase Console**: https://console.firebase.google.com/project/solushipx
- **Functions Console**: https://console.firebase.google.com/project/solushipx/functions
- **Hosting Console**: https://console.firebase.google.com/project/solushipx/hosting

### Checking Deployment Status
```bash
# View function logs
npm run functions:logs

# Test functions locally
npm run serve:functions

# Test hosting locally
npm run serve:hosting

# Test everything locally
npm run serve
```

## 🎯 Best Practices

### Before Deployment
1. ✅ Test locally with `npm run serve`
2. ✅ Run tests with `npm test`
3. ✅ Check for ESLint warnings
4. ✅ Verify all environment variables are set

### During Deployment
1. ✅ Use `npm run deploy:full` for complete deployments
2. ✅ Use specific commands for targeted deployments
3. ✅ Monitor deployment logs for errors
4. ✅ Verify deployment URLs after completion

### After Deployment
1. ✅ Test the live application
2. ✅ Check function logs for errors
3. ✅ Verify all features work correctly
4. ✅ Monitor performance metrics

## 📈 Universal Data Model Deployment

The current deployment includes the complete Universal Data Model implementation:

### ✅ Deployed Features
- **Universal Rate Schema** - Consistent rate structure across all carriers
- **Intelligent Data Normalization** - Automatic format detection and conversion
- **Backward Compatibility** - Existing shipments continue to work
- **Scalable Architecture** - Easy addition of new carriers
- **Enhanced Booking System** - Improved booking with universal format support

### 🔄 Migration Status
- **eShipPlus Integration** - ✅ Updated to universal format
- **Canpar Integration** - ✅ Updated to universal format
- **Legacy Data Support** - ✅ Backward compatible
- **UI Components** - ✅ All updated for universal format
- **Database Schema** - ✅ Enhanced with universal fields

## 🆘 Support

If you encounter issues during deployment:

1. **Check the logs** in the terminal output
2. **Verify prerequisites** are installed and configured
3. **Try individual deployment steps** to isolate issues
4. **Check Firebase Console** for additional error details
5. **Review the troubleshooting section** above

For additional help, check the Firebase documentation or contact the development team. 