import { doc, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Comprehensive Shipment Conversion System
 * Safely converts between QuickShip and Advanced shipment formats
 * with backup, validation, and rollback capabilities
 */

export class ShipmentConverter {
    constructor() {
        this.backupData = null;
        this.conversionId = null;
    }

    /**
     * Convert shipment between formats with full safety measures
     * @param {string} shipmentDocId - Firestore document ID
     * @param {string} fromFormat - 'quickship' or 'advanced'
     * @param {string} toFormat - 'quickship' or 'advanced'
     * @param {Object} convertedData - New data structure
     * @param {string} userId - User performing conversion
     * @returns {Promise<Object>} - Conversion result with success/error info
     */
    async convertShipment(shipmentDocId, fromFormat, toFormat, convertedData, userId) {
        this.conversionId = `conversion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`🔄 Starting shipment conversion [${this.conversionId}]`, {
            shipmentDocId,
            fromFormat,
            toFormat,
            userId
        });

        try {
            // Step 1: Validate inputs
            await this._validateConversionInputs(shipmentDocId, fromFormat, toFormat, convertedData);

            // Step 2: Create full backup of original data
            const originalData = await this._createBackup(shipmentDocId);

            // Step 3: Validate original data structure
            await this._validateOriginalData(originalData, fromFormat);

            // Step 4: Validate converted data structure
            await this._validateConvertedData(convertedData, toFormat);

            // Step 5: Perform atomic conversion with transaction
            const conversionResult = await this._performAtomicConversion(
                shipmentDocId,
                fromFormat,
                toFormat,
                convertedData,
                originalData,
                userId
            );

            // Step 6: Verify conversion success
            await this._verifyConversion(shipmentDocId, toFormat);

            console.log(`✅ Conversion completed successfully [${this.conversionId}]`);

            return {
                success: true,
                conversionId: this.conversionId,
                fromFormat,
                toFormat,
                shipmentDocId,
                backup: this.backupData,
                message: `Successfully converted from ${fromFormat} to ${toFormat}`
            };

        } catch (error) {
            console.error(`❌ Conversion failed [${this.conversionId}]:`, error);

            // Attempt automatic rollback
            try {
                await this._rollback(shipmentDocId);
                return {
                    success: false,
                    error: error.message,
                    conversionId: this.conversionId,
                    rollbackSuccessful: true,
                    message: 'Conversion failed but data was restored successfully'
                };
            } catch (rollbackError) {
                console.error(`🚨 CRITICAL: Rollback failed [${this.conversionId}]:`, rollbackError);
                return {
                    success: false,
                    error: error.message,
                    rollbackError: rollbackError.message,
                    conversionId: this.conversionId,
                    rollbackSuccessful: false,
                    backup: this.backupData,
                    message: 'CRITICAL: Conversion and rollback both failed. Manual recovery required.'
                };
            }
        }
    }

    /**
     * Validate conversion inputs
     */
    async _validateConversionInputs(shipmentDocId, fromFormat, toFormat, convertedData) {
        if (!shipmentDocId || typeof shipmentDocId !== 'string') {
            throw new Error('Invalid shipment document ID');
        }

        if (!['quickship', 'advanced'].includes(fromFormat)) {
            throw new Error(`Invalid fromFormat: ${fromFormat}`);
        }

        if (!['quickship', 'advanced'].includes(toFormat)) {
            throw new Error(`Invalid toFormat: ${toFormat}`);
        }

        if (fromFormat === toFormat) {
            throw new Error('Cannot convert to same format');
        }

        if (!convertedData || typeof convertedData !== 'object') {
            throw new Error('Invalid converted data');
        }

        // Verify shipment exists
        const shipmentRef = doc(db, 'shipments', shipmentDocId);
        const shipmentSnap = await getDoc(shipmentRef);
        
        if (!shipmentSnap.exists()) {
            throw new Error(`Shipment not found: ${shipmentDocId}`);
        }

        console.log(`✅ Input validation passed [${this.conversionId}]`);
    }

    /**
     * Create full backup of original shipment data
     */
    async _createBackup(shipmentDocId) {
        console.log(`💾 Creating backup [${this.conversionId}]`);

        const shipmentRef = doc(db, 'shipments', shipmentDocId);
        const shipmentSnap = await getDoc(shipmentRef);
        
        if (!shipmentSnap.exists()) {
            throw new Error('Shipment not found for backup');
        }

        const originalData = shipmentSnap.data();
        
        // Store backup with metadata
        this.backupData = {
            shipmentDocId,
            originalData,
            backupTimestamp: new Date(),
            conversionId: this.conversionId,
            dataIntegrity: this._calculateChecksum(originalData)
        };

        console.log(`✅ Backup created [${this.conversionId}]`, {
            dataSize: JSON.stringify(originalData).length,
            checksum: this.backupData.dataIntegrity
        });

        return originalData;
    }

    /**
     * Validate original data structure matches expected format
     */
    async _validateOriginalData(originalData, expectedFormat) {
        console.log(`🔍 Validating original data structure [${this.conversionId}]`);

        // Check creation method
        if (originalData.creationMethod !== expectedFormat) {
            console.warn(`⚠️ Creation method mismatch: expected ${expectedFormat}, found ${originalData.creationMethod}`);
        }

        // Validate required fields based on format
        if (expectedFormat === 'quickship') {
            this._validateQuickShipStructure(originalData);
        } else if (expectedFormat === 'advanced') {
            this._validateAdvancedStructure(originalData);
        }

        console.log(`✅ Original data validation passed [${this.conversionId}]`);
    }

    /**
     * Validate converted data structure
     */
    async _validateConvertedData(convertedData, targetFormat) {
        console.log(`🔍 Validating converted data structure [${this.conversionId}]`);

        // Validate required fields based on target format
        if (targetFormat === 'quickship') {
            this._validateQuickShipStructure(convertedData);
        } else if (targetFormat === 'advanced') {
            this._validateAdvancedStructure(convertedData);
        }

        // Ensure shipmentID is preserved
        if (!convertedData.shipmentID) {
            throw new Error('Converted data missing shipmentID');
        }

        console.log(`✅ Converted data validation passed [${this.conversionId}]`);
    }

    /**
     * Perform atomic conversion using Firestore transaction
     */
    async _performAtomicConversion(shipmentDocId, fromFormat, toFormat, convertedData, originalData, userId) {
        console.log(`⚡ Performing atomic conversion [${this.conversionId}]`);

        return await runTransaction(db, async (transaction) => {
            const shipmentRef = doc(db, 'shipments', shipmentDocId);
            
            // Re-read current data to check for concurrent modifications
            const currentSnap = await transaction.get(shipmentRef);
            
            if (!currentSnap.exists()) {
                throw new Error('Shipment was deleted during conversion');
            }

            const currentData = currentSnap.data();
            
            // Verify data hasn't changed since backup
            if (this._calculateChecksum(currentData) !== this._calculateChecksum(originalData)) {
                throw new Error('Shipment was modified during conversion. Please retry.');
            }

            // Prepare update data with conversion metadata
            const updateData = {
                ...convertedData,
                
                // Preserve critical fields
                shipmentID: originalData.shipmentID, // Never change
                companyID: originalData.companyID,   // Never change
                createdAt: originalData.createdAt,   // Never change
                createdBy: originalData.createdBy,   // Never change
                
                // Update format and metadata
                creationMethod: toFormat,
                updatedAt: new Date(),
                
                // Conversion tracking
                conversionHistory: [
                    ...(originalData.conversionHistory || []),
                    {
                        conversionId: this.conversionId,
                        fromFormat,
                        toFormat,
                        convertedAt: new Date(),
                        convertedBy: userId,
                        originalDataChecksum: this._calculateChecksum(originalData)
                    }
                ],
                
                // Mark as converted
                isConverted: true,
                lastConvertedAt: new Date(),
                lastConvertedFrom: fromFormat,
                lastConvertedTo: toFormat
            };

            // Perform the atomic update
            transaction.update(shipmentRef, updateData);

            console.log(`✅ Atomic transaction completed [${this.conversionId}]`);

            return updateData;
        });
    }

    /**
     * Verify conversion was successful
     */
    async _verifyConversion(shipmentDocId, expectedFormat) {
        console.log(`🔍 Verifying conversion [${this.conversionId}]`);

        const shipmentRef = doc(db, 'shipments', shipmentDocId);
        const shipmentSnap = await getDoc(shipmentRef);
        
        if (!shipmentSnap.exists()) {
            throw new Error('Shipment disappeared after conversion');
        }

        const updatedData = shipmentSnap.data();
        
        // Verify format changed correctly
        if (updatedData.creationMethod !== expectedFormat) {
            throw new Error(`Conversion verification failed: expected ${expectedFormat}, found ${updatedData.creationMethod}`);
        }

        // Verify shipmentID preserved
        if (updatedData.shipmentID !== this.backupData.originalData.shipmentID) {
            throw new Error('ShipmentID was corrupted during conversion');
        }

        console.log(`✅ Conversion verification passed [${this.conversionId}]`);
    }

    /**
     * Rollback to original data
     */
    async _rollback(shipmentDocId) {
        if (!this.backupData) {
            throw new Error('No backup data available for rollback');
        }

        console.log(`🔄 Performing rollback [${this.conversionId}]`);

        const shipmentRef = doc(db, 'shipments', shipmentDocId);
        
        // Restore original data
        await updateDoc(shipmentRef, {
            ...this.backupData.originalData,
            updatedAt: new Date(),
            rollbackHistory: [
                ...(this.backupData.originalData.rollbackHistory || []),
                {
                    rollbackId: `rollback_${this.conversionId}`,
                    rolledBackAt: new Date(),
                    originalConversionId: this.conversionId
                }
            ]
        });

        console.log(`✅ Rollback completed [${this.conversionId}]`);
    }

    /**
     * Calculate data checksum for integrity verification
     */
    _calculateChecksum(data) {
        // Simple checksum based on JSON string length and content hash
        const jsonString = JSON.stringify(data, Object.keys(data).sort());
        let hash = 0;
        for (let i = 0; i < jsonString.length; i++) {
            const char = jsonString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `${jsonString.length}_${hash}`;
    }

    /**
     * Validate QuickShip data structure
     */
    _validateQuickShipStructure(data) {
        const required = ['shipmentInfo', 'packages', 'manualRates'];
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`QuickShip validation failed: missing ${field}`);
            }
        }

        // Validate packages array
        if (!Array.isArray(data.packages) || data.packages.length === 0) {
            throw new Error('QuickShip validation failed: packages must be non-empty array');
        }

        // Validate manual rates array
        if (!Array.isArray(data.manualRates) || data.manualRates.length === 0) {
            throw new Error('QuickShip validation failed: manualRates must be non-empty array');
        }
    }

    /**
     * Validate Advanced shipment data structure
     */
    _validateAdvancedStructure(data) {
        const required = ['shipmentInfo', 'packages'];
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`Advanced validation failed: missing ${field}`);
            }
        }

        // Validate packages array
        if (!Array.isArray(data.packages) || data.packages.length === 0) {
            throw new Error('Advanced validation failed: packages must be non-empty array');
        }
    }

    /**
     * Manual recovery helper - restore from backup
     */
    async manualRestore(shipmentDocId, backupData) {
        console.log('🚨 Performing manual recovery');
        
        if (!backupData || !backupData.originalData) {
            throw new Error('Invalid backup data for manual recovery');
        }

        const shipmentRef = doc(db, 'shipments', shipmentDocId);
        
        await updateDoc(shipmentRef, {
            ...backupData.originalData,
            updatedAt: new Date(),
            manualRecoveryHistory: [
                ...(backupData.originalData.manualRecoveryHistory || []),
                {
                    recoveredAt: new Date(),
                    recoveredFrom: backupData.conversionId,
                    recoveryReason: 'Manual recovery after conversion failure'
                }
            ]
        });

        console.log('✅ Manual recovery completed');
    }
}

// Export singleton instance
export const shipmentConverter = new ShipmentConverter();

// Export conversion result types
export const CONVERSION_RESULT = {
    SUCCESS: 'success',
    FAILURE_WITH_ROLLBACK: 'failure_with_rollback',
    CRITICAL_FAILURE: 'critical_failure'
}; 