const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

/**
 * Simple test function to check what's in training data
 */
exports.testPromptGenerator = onCall({
    cors: true,
    timeoutSeconds: 60,
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId } = request.data || {};
        
        if (!carrierId) {
            throw new Error('carrierId is required');
        }

        const db = admin.firestore();
        
        console.log(`🔍 Testing training data for carrier: ${carrierId}`);
        
        const results = {
            carrierId,
            tests: []
        };

        // Test 1: Check if carrier exists in trainingCarriers
        try {
            const carrierDoc = await db.collection('trainingCarriers').doc(carrierId).get();
            results.tests.push({
                test: 'Carrier Document Exists',
                result: carrierDoc.exists,
                data: carrierDoc.exists ? carrierDoc.data() : null
            });
        } catch (error) {
            results.tests.push({
                test: 'Carrier Document Exists',
                result: false,
                error: error.message
            });
        }

        // Test 2: Check unifiedTraining document
        try {
            const unifiedDoc = await db.collection('unifiedTraining').doc(carrierId).get();
            results.tests.push({
                test: 'UnifiedTraining Document Exists',
                result: unifiedDoc.exists,
                data: unifiedDoc.exists ? unifiedDoc.data() : null
            });
        } catch (error) {
            results.tests.push({
                test: 'UnifiedTraining Document Exists',
                result: false,
                error: error.message
            });
        }

        // Test 3: Check samples in unifiedTraining
        try {
            const samplesQuery = await db.collection('unifiedTraining')
                .doc(carrierId)
                .collection('samples')
                .limit(10)
                .get();
            
            const samples = [];
            samplesQuery.forEach(doc => {
                const data = doc.data();
                samples.push({
                    id: doc.id,
                    trainingMethod: data.trainingMethod,
                    trainingType: data.trainingType,
                    processingStatus: data.processingStatus,
                    fileName: data.fileName,
                    hasAnnotations: !!data.visualAnnotations,
                    hasExtractedFeatures: !!data.extractedFeatures
                });
            });
            
            results.tests.push({
                test: 'Samples in UnifiedTraining',
                result: samples.length > 0,
                count: samples.length,
                samples: samples
            });
        } catch (error) {
            results.tests.push({
                test: 'Samples in UnifiedTraining',
                result: false,
                error: error.message
            });
        }

        // Test 4: Check specific query that prompt generator uses
        try {
            const targetQuery = await db.collection('unifiedTraining')
                .doc(carrierId)
                .collection('samples')
                .where('trainingMethod', '==', 'visual_annotation')
                .where('processingStatus', '==', 'completed')
                .limit(5)
                .get();
            
            const targetSamples = [];
            targetQuery.forEach(doc => {
                targetSamples.push({
                    id: doc.id,
                    fileName: doc.data().fileName,
                    trainingMethod: doc.data().trainingMethod,
                    processingStatus: doc.data().processingStatus
                });
            });
            
            results.tests.push({
                test: 'Target Query (trainingMethod=visual_annotation, status=completed)',
                result: targetSamples.length > 0,
                count: targetSamples.length,
                samples: targetSamples
            });
        } catch (error) {
            results.tests.push({
                test: 'Target Query (trainingMethod=visual_annotation, status=completed)',
                result: false,
                error: error.message
            });
        }

        console.log('🔍 Test results:', JSON.stringify(results, null, 2));

        return {
            success: true,
            results
        };

    } catch (error) {
        console.error('❌ Test error:', error);
        return {
            success: false,
            error: error.message
        };
    }
});
