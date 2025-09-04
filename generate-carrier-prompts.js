/**
 * Script to generate AI prompts for existing carriers (Landliner & Polaris)
 * Run this from the project root: node generate-carrier-prompts.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'solushipx'
    });
}

async function generateCarrierPrompts() {
    console.log('🚀 Starting AI prompt generation for existing carriers...\n');

    const carriers = [
        { id: 'landliner', name: 'Landliner Inc' },
        { id: 'polaris', name: 'Polaris Transportation' }, // Based on the MASTER_CARRIERS config
        // Add more carriers as needed
    ];

    for (const carrier of carriers) {
        console.log(`🧠 Generating AI prompt for ${carrier.name} (ID: ${carrier.id})`);
        
        try {
            // Call the generateCarrierPrompt cloud function using HTTP call
            const functions = admin.functions();
            
            const result = await functions.httpsCallable('generateCarrierPrompt')({
                carrierId: carrier.id,
                regenerate: true // Force new generation
            });

            if (result.data.success) {
                console.log(`✅ Successfully generated prompt for ${carrier.name}`);
                console.log(`   Training Samples: ${result.data.prompt.trainingDataSummary?.sampleCount || 0}`);
                console.log(`   Annotation Types: ${result.data.prompt.trainingDataSummary?.annotationTypes?.length || 0}`);
                console.log(`   Analysis: ${result.data.prompt.analysisData?.carrierName || 'N/A'}`);
                console.log(`   Version: ${result.data.prompt.version}`);
            } else {
                console.log(`⚠️  Could not generate prompt for ${carrier.name}: ${result.data.error}`);
                
                // Check if it's due to insufficient training data
                if (result.data.error?.includes('Insufficient training data')) {
                    console.log(`   📝 This is normal if ${carrier.name} hasn't been visually trained yet.`);
                    console.log(`   💡 To generate a prompt: Visit Invoice Training → Visual Training → Train ${carrier.name} with sample invoices`);
                }
            }
        } catch (error) {
            console.error(`❌ Error generating prompt for ${carrier.name}:`, error.message);
        }
        
        console.log(''); // Add spacing
    }

    console.log('🎯 Prompt generation process completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Visit Admin > Billing > Invoice Training');
    console.log('2. Go to the "Trained Carriers" tab');
    console.log('3. Click the purple ✨ button next to any carrier to manage their AI prompt');
    console.log('4. For carriers without prompts, train them first using "Visual Training" tab');
    
    process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

// Run the script
generateCarrierPrompts();
