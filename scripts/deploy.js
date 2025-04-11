const { execSync } = require('child_process');

function deploy() {
    try {
        console.log('🚀 Starting deployment process...');
        
        // Step 1: Build the application
        console.log('\n📦 Building the application...');
        execSync('npm run build', { stdio: 'inherit' });
        console.log('✅ Build completed successfully!');
        
        // Step 2: Deploy to Firebase
        console.log('\n🔥 Deploying to Firebase...');
        execSync('firebase deploy', { stdio: 'inherit' });
        console.log('✅ Deployment completed successfully!');
        
        console.log('\n🎉 Your application is now live!');
        console.log('🌐 Visit: https://solushipx.web.app');
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

// Run the deployment if this script is called directly
if (require.main === module) {
    deploy();
}

module.exports = deploy; 