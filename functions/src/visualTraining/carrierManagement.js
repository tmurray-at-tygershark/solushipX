const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

const db = admin.firestore();

/**
 * Production-ready carrier management system for invoice training
 * Handles CRUD operations for training carriers with full audit trails
 */

// Create a new training carrier
exports.createTrainingCarrier = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        // Authentication check
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { name, description, category, externalId } = request.data || {};
        
        // Validation
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw new Error('Carrier name is required and must be a non-empty string');
        }

        const trimmedName = name.trim();
        if (trimmedName.length > 100) {
            throw new Error('Carrier name must be 100 characters or less');
        }

        // Generate unique carrier ID
        const carrierId = `training_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
        
        // Check for duplicate names
        const existingCarrier = await db.collection('trainingCarriers')
            .where('name', '==', trimmedName)
            .where('active', '==', true)
            .limit(1)
            .get();

        if (!existingCarrier.empty) {
            throw new Error('A carrier with this name already exists');
        }

        // Create carrier document
        const carrierData = {
            id: carrierId,
            name: trimmedName,
            description: description?.trim() || '',
            category: category || 'general',
            externalId: externalId?.trim() || null,
            active: true,
            
            // Training statistics
            stats: {
                totalSamples: 0,
                totalTemplates: 0,
                averageConfidence: 0,
                lastTrainingDate: null,
                lastUsedDate: null,
                successfulExtractions: 0,
                failedExtractions: 0
            },
            
            // Version control
            version: 1,
            
            // Audit trail
            audit: {
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: request.auth.uid,
                lastModifiedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastModifiedBy: request.auth.uid,
                revisions: []
            },
            
            // Metadata
            metadata: {
                tags: [],
                priority: 'normal', // low, normal, high, critical
                status: 'active', // active, inactive, archived
                notes: ''
            }
        };

        // Save to Firestore
        await db.collection('trainingCarriers').doc(carrierId).set(carrierData);

        // Log creation event
        await db.collection('carrierAuditLog').add({
            carrierId,
            action: 'CREATE',
            userId: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: {
                name: trimmedName,
                category: category || 'general'
            }
        });

        return {
            success: true,
            carrierId,
            message: 'Training carrier created successfully'
        };

    } catch (error) {
        console.error('Create training carrier error:', error);
        return {
            success: false,
            error: error.message || 'Failed to create training carrier'
        };
    }
});

// Get all training carriers with pagination and filtering
exports.getTrainingCarriers = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { 
            page = 1, 
            limit = 50, 
            search = '', 
            category = '', 
            status = 'active',
            sortBy = 'name',
            sortOrder = 'asc'
        } = request.data || {};

        // Build query
        let query = db.collection('trainingCarriers');

        // Filter by status
        if (status && status !== 'all') {
            query = query.where('metadata.status', '==', status);
        }

        // Filter by category
        if (category && category !== 'all') {
            query = query.where('category', '==', category);
        }

        // Apply sorting
        const validSortFields = ['name', 'audit.createdAt', 'stats.totalSamples', 'stats.averageConfidence'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
        query = query.orderBy(sortField, sortOrder === 'desc' ? 'desc' : 'asc');

        // Execute query
        const snapshot = await query.get();
        let carriers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Apply search filter (post-query since Firestore doesn't support full-text search)
        if (search && search.trim()) {
            const searchTerm = search.trim().toLowerCase();
            carriers = carriers.filter(carrier => 
                carrier.name.toLowerCase().includes(searchTerm) ||
                carrier.description.toLowerCase().includes(searchTerm) ||
                (carrier.externalId && carrier.externalId.toLowerCase().includes(searchTerm))
            );
        }

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedCarriers = carriers.slice(startIndex, endIndex);

        // Get total count for pagination
        const totalCount = carriers.length;
        const totalPages = Math.ceil(totalCount / limit);

        return {
            success: true,
            data: {
                carriers: paginatedCarriers,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalCount,
                    limit,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        };

    } catch (error) {
        console.error('Get training carriers error:', error);
        return {
            success: false,
            error: error.message || 'Failed to retrieve training carriers'
        };
    }
});

// Update a training carrier
exports.updateTrainingCarrier = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId, updates } = request.data || {};
        
        if (!carrierId) {
            throw new Error('Carrier ID is required');
        }

        if (!updates || typeof updates !== 'object') {
            throw new Error('Updates object is required');
        }

        // Get existing carrier
        const carrierRef = db.collection('trainingCarriers').doc(carrierId);
        const carrierDoc = await carrierRef.get();

        if (!carrierDoc.exists) {
            throw new Error('Carrier not found');
        }

        const existingData = carrierDoc.data();

        // Validate updates
        const allowedFields = ['name', 'description', 'category', 'externalId', 'metadata'];
        const sanitizedUpdates = {};

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                if (key === 'name') {
                    if (!value || typeof value !== 'string' || value.trim().length === 0) {
                        throw new Error('Name is required and must be a non-empty string');
                    }
                    if (value.trim().length > 100) {
                        throw new Error('Name must be 100 characters or less');
                    }
                    sanitizedUpdates.name = value.trim();
                } else if (key === 'description') {
                    sanitizedUpdates.description = (value || '').toString().trim();
                } else if (key === 'category') {
                    sanitizedUpdates.category = value || 'general';
                } else if (key === 'externalId') {
                    sanitizedUpdates.externalId = value ? value.toString().trim() : null;
                } else if (key === 'metadata') {
                    // Merge metadata
                    sanitizedUpdates.metadata = {
                        ...existingData.metadata,
                        ...value
                    };
                }
            }
        }

        // Check for duplicate names if name is being updated
        if (sanitizedUpdates.name && sanitizedUpdates.name !== existingData.name) {
            const duplicateCheck = await db.collection('trainingCarriers')
                .where('name', '==', sanitizedUpdates.name)
                .where('active', '==', true)
                .limit(1)
                .get();

            if (!duplicateCheck.empty && duplicateCheck.docs[0].id !== carrierId) {
                throw new Error('A carrier with this name already exists');
            }
        }

        // Create revision record
        const revision = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            userId: request.auth.uid,
            changes: sanitizedUpdates,
            previousValues: Object.keys(sanitizedUpdates).reduce((prev, key) => {
                prev[key] = existingData[key];
                return prev;
            }, {})
        };

        // Update carrier
        const updateData = {
            ...sanitizedUpdates,
            version: existingData.version + 1,
            'audit.lastModifiedAt': admin.firestore.FieldValue.serverTimestamp(),
            'audit.lastModifiedBy': request.auth.uid,
            'audit.revisions': admin.firestore.FieldValue.arrayUnion(revision)
        };

        await carrierRef.update(updateData);

        // Log update event
        await db.collection('carrierAuditLog').add({
            carrierId,
            action: 'UPDATE',
            userId: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: {
                fieldsUpdated: Object.keys(sanitizedUpdates),
                changes: sanitizedUpdates
            }
        });

        return {
            success: true,
            message: 'Training carrier updated successfully'
        };

    } catch (error) {
        console.error('Update training carrier error:', error);
        return {
            success: false,
            error: error.message || 'Failed to update training carrier'
        };
    }
});

// Delete (soft delete) a training carrier
exports.deleteTrainingCarrier = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId, force = false } = request.data || {};
        
        if (!carrierId) {
            throw new Error('Carrier ID is required');
        }

        const carrierRef = db.collection('trainingCarriers').doc(carrierId);
        const carrierDoc = await carrierRef.get();

        if (!carrierDoc.exists) {
            throw new Error('Carrier not found');
        }

        const carrierData = carrierDoc.data();

        if (force) {
            // Hard delete - remove all data
            const batch = db.batch();
            
            // Delete carrier document
            batch.delete(carrierRef);
            
            // Delete all training samples
            const samplesQuery = await db.collection('carrierInvoiceExamples')
                .doc(carrierId)
                .collection('examples')
                .get();
            
            samplesQuery.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            // Delete all templates
            const templatesQuery = await db.collection('carrierInvoiceTemplates')
                .doc(carrierId)
                .collection('templates')
                .get();
            
            templatesQuery.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            
            // Log deletion
            await db.collection('carrierAuditLog').add({
                carrierId,
                action: 'HARD_DELETE',
                userId: request.auth.uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                details: {
                    carrierName: carrierData.name
                }
            });
            
        } else {
            // Soft delete - mark as inactive
            await carrierRef.update({
                active: false,
                'metadata.status': 'archived',
                'audit.lastModifiedAt': admin.firestore.FieldValue.serverTimestamp(),
                'audit.lastModifiedBy': request.auth.uid,
                'audit.deletedAt': admin.firestore.FieldValue.serverTimestamp(),
                'audit.deletedBy': request.auth.uid
            });
            
            // Log soft deletion
            await db.collection('carrierAuditLog').add({
                carrierId,
                action: 'SOFT_DELETE',
                userId: request.auth.uid,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                details: {
                    carrierName: carrierData.name
                }
            });
        }

        return {
            success: true,
            message: force ? 'Training carrier permanently deleted' : 'Training carrier archived'
        };

    } catch (error) {
        console.error('Delete training carrier error:', error);
        return {
            success: false,
            error: error.message || 'Failed to delete training carrier'
        };
    }
});

// Get detailed carrier information including training data
exports.getCarrierDetails = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId } = request.data || {};
        
        if (!carrierId) {
            throw new Error('Carrier ID is required');
        }

        // Get carrier data
        const carrierDoc = await db.collection('trainingCarriers').doc(carrierId).get();
        
        if (!carrierDoc.exists) {
            throw new Error('Carrier not found');
        }

        const carrierData = carrierDoc.data();

        // Get training samples count
        const samplesSnapshot = await db.collection('carrierInvoiceExamples')
            .doc(carrierId)
            .collection('examples')
            .get();

        // Get templates count
        const templatesSnapshot = await db.collection('carrierInvoiceTemplates')
            .doc(carrierId)
            .collection('templates')
            .get();

        // Get recent activity
        const recentActivitySnapshot = await db.collection('carrierAuditLog')
            .where('carrierId', '==', carrierId)
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();

        const recentActivity = recentActivitySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return {
            success: true,
            data: {
                carrier: {
                    id: carrierId,
                    ...carrierData
                },
                samplesCount: samplesSnapshot.size,
                templatesCount: templatesSnapshot.size,
                recentActivity
            }
        };

    } catch (error) {
        console.error('Get carrier details error:', error);
        return {
            success: false,
            error: error.message || 'Failed to get carrier details'
        };
    }
});

// Retrain a carrier (trigger reprocessing of all samples)
exports.retrainCarrier = onCall({
    cors: true,
    timeoutSeconds: 300,
    memory: '512MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        const { carrierId, options = {} } = request.data || {};
        
        if (!carrierId) {
            throw new Error('Carrier ID is required');
        }

        // Get carrier
        const carrierDoc = await db.collection('trainingCarriers').doc(carrierId).get();
        
        if (!carrierDoc.exists) {
            throw new Error('Carrier not found');
        }

        // Mark carrier as retraining
        await db.collection('trainingCarriers').doc(carrierId).update({
            'metadata.status': 'retraining',
            'audit.lastModifiedAt': admin.firestore.FieldValue.serverTimestamp(),
            'audit.lastModifiedBy': request.auth.uid
        });

        // Get all training samples for this carrier
        const samplesSnapshot = await db.collection('carrierInvoiceExamples')
            .doc(carrierId)
            .collection('examples')
            .get();

        // Create retraining job
        const retrainingJobId = uuidv4();
        await db.collection('retrainingJobs').doc(retrainingJobId).set({
            carrierId,
            status: 'pending',
            totalSamples: samplesSnapshot.size,
            processedSamples: 0,
            failedSamples: 0,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            options,
            createdBy: request.auth.uid
        });

        // Log retraining start
        await db.collection('carrierAuditLog').add({
            carrierId,
            action: 'RETRAIN_START',
            userId: request.auth.uid,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: {
                jobId: retrainingJobId,
                samplesCount: samplesSnapshot.size,
                options
            }
        });

        // Note: Actual retraining processing would be handled by a separate background job
        // This is just the initiation
        
        return {
            success: true,
            jobId: retrainingJobId,
            message: 'Retraining job initiated successfully'
        };

    } catch (error) {
        console.error('Retrain carrier error:', error);
        return {
            success: false,
            error: error.message || 'Failed to initiate retraining'
        };
    }
});

// Get available carrier categories
exports.getCarrierCategories = onCall({
    cors: true,
    timeoutSeconds: 30,
    memory: '128MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        if (!request.auth) {
            throw new Error('Authentication required');
        }

        // Get unique categories from existing carriers
        const carriersSnapshot = await db.collection('trainingCarriers')
            .where('active', '==', true)
            .get();

        const categories = new Set(['general', 'courier', 'freight', 'ltl', 'postal']);
        
        carriersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.category) {
                categories.add(data.category);
            }
        });

        return {
            success: true,
            categories: Array.from(categories).sort()
        };

    } catch (error) {
        console.error('Get carrier categories error:', error);
        return {
            success: false,
            error: error.message || 'Failed to get carrier categories'
        };
    }
});
