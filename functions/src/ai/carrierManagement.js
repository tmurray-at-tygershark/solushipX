const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Get all unified training carriers for a company
 */
const getUnifiedTrainingCarriers = onCall({
    cors: {
        origin: ['https://solushipx.web.app', 'http://localhost:3000'],
        credentials: true
    },
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        const { companyId } = request.data || {};
        
        // Query the trainingCarriers collection
        const carriersRef = db.collection('trainingCarriers');
        
        let query = carriersRef;
        if (companyId) {
            query = carriersRef.where('companyId', '==', companyId);
        }
        
        const snapshot = await query.get();
        
        const carriers = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            carriers.push({
                id: doc.id,
                name: data.name,
                confidence: data.confidence || 0,
                sampleCount: data.sampleCount || 0,
                source: data.source || 'manual',
                companyId: data.companyId,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
            });
        });
        
        // Sort by name
        carriers.sort((a, b) => a.name.localeCompare(b.name));
        
        console.log(`getUnifiedTrainingCarriers: Found ${carriers.length} carriers`);
        
        return {
            success: true,
            carriers: carriers
        };
        
    } catch (error) {
        console.error('Error in getUnifiedTrainingCarriers:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Add a new unified training carrier
 */
const addUnifiedTrainingCarrier = onCall({
    cors: {
        origin: ['https://solushipx.web.app', 'http://localhost:3000'],
        credentials: true
    },
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        const { name, companyId } = request.data || {};
        
        if (!name) {
            throw new Error('Name is required');
        }
        
        // For AI training system, use 'system' as default companyId if not provided
        const effectiveCompanyId = companyId || 'system';
        
        // Check if carrier with this name already exists (system-wide for AI training)
        const existingQuery = await db.collection('trainingCarriers')
            .where('name', '==', name)
            .where('active', '==', true)
            .get();
            
        if (!existingQuery.empty) {
            throw new Error('A carrier with this name already exists');
        }
        
        // Create new carrier document
        const carrierData = {
            name: name.trim(),
            companyId: effectiveCompanyId,
            confidence: 0,
            sampleCount: 0,
            source: 'manual',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('trainingCarriers').add(carrierData);
        
        console.log(`addUnifiedTrainingCarrier: Added carrier ${name} with ID ${docRef.id}`);
        
        return {
            success: true,
            carrierId: docRef.id,
            message: 'Carrier added successfully'
        };
        
    } catch (error) {
        console.error('Error in addUnifiedTrainingCarrier:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

/**
 * Delete a unified training carrier
 */
const deleteUnifiedTrainingCarrier = onCall({
    cors: {
        origin: ['https://solushipx.web.app', 'http://localhost:3000'],
        credentials: true
    },
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        const { carrierId } = request.data || {};
        
        if (!carrierId) {
            throw new Error('carrierId is required');
        }
        
        // Check if carrier exists
        const carrierDoc = await db.collection('trainingCarriers').doc(carrierId).get();
        
        if (!carrierDoc.exists) {
            throw new Error('Carrier not found');
        }
        
        const carrierData = carrierDoc.data();
        
        // Check if there are training samples for this carrier
        const samplesQuery = await db.collection('unifiedTraining')
            .where('carrierId', '==', carrierId)
            .limit(1)
            .get();
            
        if (!samplesQuery.empty) {
            // Don't delete, just mark as inactive
            await db.collection('trainingCarriers').doc(carrierId).update({
                active: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`deleteUnifiedTrainingCarrier: Marked carrier ${carrierId} as inactive (has training samples)`);
            
            return {
                success: true,
                message: 'Carrier marked as inactive (has training data)'
            };
        } else {
            // Safe to delete completely
            await db.collection('trainingCarriers').doc(carrierId).delete();
            
            console.log(`deleteUnifiedTrainingCarrier: Deleted carrier ${carrierId} (${carrierData.name})`);
            
            return {
                success: true,
                message: 'Carrier deleted successfully'
            };
        }
        
    } catch (error) {
        console.error('Error in deleteUnifiedTrainingCarrier:', error);
        return {
            success: false,
            error: error.message
        };
    }
});

module.exports = {
    getUnifiedTrainingCarriers,
    addUnifiedTrainingCarrier,
    deleteUnifiedTrainingCarrier
};
