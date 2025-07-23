/**
 * SAFE Canadian Tax Backfill Script
 * Adds Canadian taxes to existing Canada-to-Canada shipments
 * 
 * SAFETY FEATURES:
 * - Only processes Canada-to-Canada shipments
 * - Preserves all existing data
 * - No notification triggers
 * - Comprehensive logging
 * - Rollback capability
 * - Batch processing with delays
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (if not already initialized)
if (!admin.apps.length) {
    const serviceAccount = require('../functions/config/admin.js');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://solushipx-default-rtdb.firebaseio.com"
    });
}

const db = admin.firestore();

// Import tax calculation logic
const CANADIAN_TAX_CONFIG = {
    'ON': { taxes: [{ code: 'HST ON', name: 'HST Ontario', rate: 13.0, type: 'HST' }], totalRate: 13.0 },
    'NB': { taxes: [{ code: 'HST NB', name: 'HST New Brunswick', rate: 15.0, type: 'HST' }], totalRate: 15.0 },
    'NL': { taxes: [{ code: 'HST NL', name: 'HST Newfoundland and Labrador', rate: 15.0, type: 'HST' }], totalRate: 15.0 },
    'PE': { taxes: [{ code: 'HST PE', name: 'HST Prince Edward Island', rate: 15.0, type: 'HST' }], totalRate: 15.0 },
    'NS': { taxes: [{ code: 'HST NS', name: 'HST Nova Scotia', rate: 14.0, type: 'HST' }], totalRate: 14.0 },
    'BC': { taxes: [{ code: 'GST', name: 'GST British Columbia', rate: 5.0, type: 'GST' }, { code: 'PST BC', name: 'PST British Columbia', rate: 7.0, type: 'PST' }], totalRate: 12.0 },
    'MB': { taxes: [{ code: 'GST', name: 'GST Manitoba', rate: 5.0, type: 'GST' }, { code: 'PST MB', name: 'PST Manitoba', rate: 7.0, type: 'PST' }], totalRate: 12.0 },
    'SK': { taxes: [{ code: 'GST', name: 'GST Saskatchewan', rate: 5.0, type: 'GST' }, { code: 'PST SK', name: 'PST Saskatchewan', rate: 6.0, type: 'PST' }], totalRate: 11.0 },
    'QC': { taxes: [{ code: 'GST', name: 'GST Quebec', rate: 5.0, type: 'GST' }, { code: 'QST', name: 'QST Quebec', rate: 9.975, type: 'QST' }], totalRate: 14.975 },
    'AB': { taxes: [{ code: 'GST', name: 'GST Alberta', rate: 5.0, type: 'GST' }], totalRate: 5.0 },
    'NT': { taxes: [{ code: 'GST', name: 'GST Northwest Territories', rate: 5.0, type: 'GST' }], totalRate: 5.0 },
    'NU': { taxes: [{ code: 'GST', name: 'GST Nunavut', rate: 5.0, type: 'GST' }], totalRate: 5.0 },
    'YT': { taxes: [{ code: 'GST', name: 'GST Yukon', rate: 5.0, type: 'GST' }], totalRate: 5.0 }
};

// Logging setup
const LOG_FILE = path.join(__dirname, `canadian-tax-backfill-${new Date().toISOString().split('T')[0]}.log`);
const BACKUP_FILE = path.join(__dirname, `canadian-tax-backfill-backup-${new Date().toISOString().split('T')[0]}.json`);

const log = (message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data, null, 2) : ''}`;
    console.log(logEntry);
    fs.appendFileSync(LOG_FILE, logEntry + '\n');
};

// Tax charge codes that should be excluded from tax calculation base
const TAX_CODES = ['HST', 'GST', 'QST', 'HST ON', 'HST BC', 'HST NB', 'HST NS', 'HST NL', 'HST PE', 'PST BC', 'PST SK', 'PST MB'];

const isTaxCharge = (code) => {
    return TAX_CODES.includes(code?.toUpperCase());
};

const isCanadianDomesticShipment = (shipFrom, shipTo) => {
    if (!shipFrom || !shipTo) return false;
    const fromCountry = shipFrom.country?.toUpperCase();
    const toCountry = shipTo.country?.toUpperCase();
    return fromCountry === 'CA' && toCountry === 'CA';
};

const calculateTaxableAmount = (rateBreakdown, chargeTypes) => {
    if (!rateBreakdown || !Array.isArray(rateBreakdown)) return 0;
    
    let taxableAmount = 0;
    
    rateBreakdown.forEach(rate => {
        // Skip existing tax charges
        if (rate.isTax || isTaxCharge(rate.code)) return;
        
        // Find charge type to check if taxable
        const chargeType = chargeTypes.find(ct => ct.code === rate.code);
        const isTaxable = chargeType?.taxable || false;
        
        if (isTaxable) {
            // Use actual charge if available, otherwise quoted charge
            const chargeAmount = parseFloat(rate.actualCharge || rate.charge || 0);
            taxableAmount += chargeAmount;
        }
    });
    
    return taxableAmount;
};

const calculateTaxes = (taxableAmount, province) => {
    const taxConfig = CANADIAN_TAX_CONFIG[province?.toUpperCase()];
    if (!taxConfig) return [];
    
    const taxes = [];
    
    taxConfig.taxes.forEach(tax => {
        const taxAmount = (taxableAmount * tax.rate) / 100;
        
        taxes.push({
            code: tax.code,
            chargeName: tax.name,
            rate: tax.rate,
            amount: taxAmount,
            type: tax.type,
            cost: 0.00,
            charge: taxAmount,
            costCurrency: 'CAD',
            chargeCurrency: 'CAD',
            isTax: true,
            taxable: false
        });
    });
    
    return taxes;
};

const removeTaxCharges = (rateBreakdown) => {
    if (!rateBreakdown || !Array.isArray(rateBreakdown)) return [];
    return rateBreakdown.filter(rate => !rate.isTax && !isTaxCharge(rate.code));
};

const generateTaxLineItems = (rateBreakdown, province, chargeTypes, nextId = 1) => {
    const taxableAmount = calculateTaxableAmount(rateBreakdown, chargeTypes);
    
    if (taxableAmount <= 0) return [];
    
    const taxes = calculateTaxes(taxableAmount, province);
    
    return taxes.map((tax, index) => ({
        id: nextId + index,
        carrier: '',
        code: tax.code,
        chargeName: tax.chargeName,
        cost: tax.cost.toFixed(2),
        costCurrency: tax.costCurrency,
        charge: tax.charge.toFixed(2),
        chargeCurrency: tax.chargeCurrency,
        isTax: true,
        taxable: false
    }));
};

const processShipmentBatch = async (batch, chargeTypes, backupData) => {
    const results = {
        processed: 0,
        updated: 0,
        skipped: 0,
        errors: 0
    };

    for (const doc of batch) {
        try {
            const shipmentData = doc.data();
            const shipmentId = doc.id;

            log(`Processing shipment: ${shipmentId}`);

            // Check if Canadian domestic shipment
            if (!isCanadianDomesticShipment(shipmentData.shipFrom, shipmentData.shipTo)) {
                log(`Skipping non-Canadian shipment: ${shipmentId}`);
                results.skipped++;
                continue;
            }

            const province = shipmentData.shipTo?.state;
            if (!province) {
                log(`Skipping shipment without province: ${shipmentId}`);
                results.skipped++;
                continue;
            }

            log(`Canadian domestic shipment found: ${shipmentId}, province: ${province}`);

            // Backup original data
            backupData[shipmentId] = {
                manualRates: shipmentData.manualRates || null,
                carrierConfirmationRates: shipmentData.carrierConfirmationRates || null
            };

            let updated = false;
            const updates = {};

            // Process manual rates
            if (shipmentData.manualRates && Array.isArray(shipmentData.manualRates)) {
                const nonTaxRates = removeTaxCharges(shipmentData.manualRates);
                
                // Only add taxes if there are non-tax rates
                if (nonTaxRates.length > 0) {
                    const nextId = Math.max(...nonTaxRates.map(r => r.id || 0), 0) + 1;
                    const taxLineItems = generateTaxLineItems(nonTaxRates, province, chargeTypes, nextId);
                    
                    if (taxLineItems.length > 0) {
                        updates.manualRates = [...nonTaxRates, ...taxLineItems];
                        updated = true;
                        log(`Added ${taxLineItems.length} tax line items to manual rates for shipment: ${shipmentId}`);
                    }
                }
            }

            // Process carrier confirmation rates
            if (shipmentData.carrierConfirmationRates && Array.isArray(shipmentData.carrierConfirmationRates)) {
                const nonTaxRates = removeTaxCharges(shipmentData.carrierConfirmationRates);
                
                // Only add taxes if there are non-tax rates
                if (nonTaxRates.length > 0) {
                    const nextId = Math.max(...nonTaxRates.map(r => r.id || 0), 0) + 1;
                    const taxLineItems = generateTaxLineItems(nonTaxRates, province, chargeTypes, nextId);
                    
                    if (taxLineItems.length > 0) {
                        updates.carrierConfirmationRates = [...nonTaxRates, ...taxLineItems];
                        updated = true;
                        log(`Added ${taxLineItems.length} tax line items to carrier confirmation rates for shipment: ${shipmentId}`);
                    }
                }
            }

            // Update the shipment if changes were made
            if (updated) {
                // Add metadata about the tax backfill
                updates.taxBackfillApplied = {
                    appliedAt: new Date().toISOString(),
                    appliedBy: 'canadian-tax-backfill-script',
                    province: province,
                    version: '1.0'
                };

                await doc.ref.update(updates);
                log(`Successfully updated shipment: ${shipmentId}`);
                results.updated++;
            } else {
                log(`No tax updates needed for shipment: ${shipmentId}`);
                results.skipped++;
            }

            results.processed++;

            // Small delay to avoid overwhelming Firestore
            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            log(`Error processing shipment ${doc.id}`, { error: error.message });
            results.errors++;
        }
    }

    return results;
};

const main = async () => {
    try {
        log('🍁 Starting Canadian Tax Backfill Script');
        log('='.repeat(50));

        // Load charge types
        log('Loading charge types...');
        const chargeTypesSnapshot = await db.collection('chargeTypes').where('enabled', '==', true).get();
        const chargeTypes = chargeTypesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        log(`Loaded ${chargeTypes.length} charge types`);

        // Validate that required tax charge types exist
        const requiredTaxCodes = ['HST', 'GST', 'QST', 'HST ON', 'HST BC', 'HST NB', 'HST NS', 'HST NL', 'HST PE', 'PST BC', 'PST SK', 'PST MB'];
        const existingCodes = chargeTypes.map(ct => ct.code.toUpperCase());
        const missingCodes = requiredTaxCodes.filter(code => !existingCodes.includes(code));
        
        if (missingCodes.length > 0) {
            log(`❌ Missing required tax charge types: ${missingCodes.join(', ')}`);
            log('Please create these charge types before running the backfill script.');
            process.exit(1);
        }

        log('✅ All required tax charge types found');

        // Initialize backup data
        const backupData = {};

        // Query shipments in batches (avoid processing drafts)
        const batchSize = 50;
        let lastDoc = null;
        let totalResults = { processed: 0, updated: 0, skipped: 0, errors: 0 };
        let batchNumber = 1;

        while (true) {
            log(`Processing batch ${batchNumber}...`);

            let query = db.collection('shipments')
                .where('status', '!=', 'draft') // Exclude drafts
                .limit(batchSize);

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                log('No more shipments to process');
                break;
            }

            const batchResults = await processShipmentBatch(snapshot.docs, chargeTypes, backupData);
            
            // Aggregate results
            totalResults.processed += batchResults.processed;
            totalResults.updated += batchResults.updated;
            totalResults.skipped += batchResults.skipped;
            totalResults.errors += batchResults.errors;

            log(`Batch ${batchNumber} completed:`, batchResults);

            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            batchNumber++;

            // Delay between batches to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Save backup data
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(backupData, null, 2));
        log(`Backup data saved to: ${BACKUP_FILE}`);

        // Final results
        log('='.repeat(50));
        log('🍁 Canadian Tax Backfill Completed Successfully!');
        log('Final Results:', totalResults);
        log(`Log file: ${LOG_FILE}`);
        log(`Backup file: ${BACKUP_FILE}`);

        if (totalResults.errors > 0) {
            log(`⚠️  ${totalResults.errors} errors occurred. Check the log file for details.`);
        }

    } catch (error) {
        log('❌ Fatal error occurred', { error: error.message, stack: error.stack });
        process.exit(1);
    }
};

// Rollback function (can be called separately)
const rollback = async () => {
    try {
        log('🔄 Starting Canadian Tax Backfill Rollback');
        
        if (!fs.existsSync(BACKUP_FILE)) {
            log('❌ Backup file not found. Cannot rollback.');
            process.exit(1);
        }

        const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        let rollbackCount = 0;

        for (const [shipmentId, originalData] of Object.entries(backupData)) {
            try {
                const updates = {};
                
                if (originalData.manualRates !== null) {
                    updates.manualRates = originalData.manualRates;
                }
                
                if (originalData.carrierConfirmationRates !== null) {
                    updates.carrierConfirmationRates = originalData.carrierConfirmationRates;
                }
                
                // Remove the backfill metadata
                updates.taxBackfillApplied = admin.firestore.FieldValue.delete();

                await db.collection('shipments').doc(shipmentId).update(updates);
                log(`Rolled back shipment: ${shipmentId}`);
                rollbackCount++;

            } catch (error) {
                log(`Error rolling back shipment ${shipmentId}`, { error: error.message });
            }
        }

        log(`🔄 Rollback completed. ${rollbackCount} shipments restored.`);

    } catch (error) {
        log('❌ Rollback failed', { error: error.message });
        process.exit(1);
    }
};

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--rollback')) {
    rollback();
} else if (args.includes('--help')) {
    console.log(`
Canadian Tax Backfill Script

Usage:
  node backfillCanadianTaxes.js          # Run the backfill
  node backfillCanadianTaxes.js --rollback  # Rollback changes
  node backfillCanadianTaxes.js --help      # Show this help

Features:
  - Only processes Canada-to-Canada shipments
  - Preserves all existing data
  - No notification triggers
  - Comprehensive logging and backup
  - Safe rollback capability
    `);
} else {
    main();
}

module.exports = { main, rollback }; 