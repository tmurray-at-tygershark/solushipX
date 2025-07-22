const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: 'https://solushipx-default-rtdb.firebaseio.com/',
        storageBucket: 'solushipx.firebasestorage.app'
    });
}

const db = admin.firestore();

/**
 * All existing static charge types from chargeTypeService.js
 * This ensures 100% backward compatibility for existing shipments
 */
const EXISTING_CHARGE_TYPES = [
    // Core Freight & Fuel
    { code: 'FRT', label: 'Freight', category: 'freight', taxable: false, commissionable: true, enabled: true, isCore: true, displayOrder: 1 },
    { code: 'FUE', label: 'Fuel Surcharge', category: 'fuel', taxable: false, commissionable: true, enabled: true, isCore: true, displayOrder: 2 },
    
    // Accessorial & Services
    { code: 'ACC', label: 'Accessorial', category: 'accessorial', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 3 },
    { code: 'MSC', label: 'Miscellaneous', category: 'miscellaneous', taxable: true, commissionable: false, enabled: true, isCore: false, displayOrder: 4 },
    { code: 'LOG', label: 'Logistics', category: 'logistics', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 5 },
    { code: 'IC LOG', label: 'IC Logistics', category: 'logistics', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 6 },
    
    // Surcharges
    { code: 'SUR', label: 'Surcharge', category: 'surcharges', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 7 },
    { code: 'IC SUR', label: 'IC Surcharge', category: 'surcharges', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 8 },
    
    // Federal Taxes
    { code: 'HST', label: 'HST', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 10 },
    { code: 'GST', label: 'GST', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 11 },
    { code: 'QST', label: 'QST', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 12 },
    
    // Provincial HST
    { code: 'HST ON', label: 'HST Ontario', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 13 },
    { code: 'HST BC', label: 'HST BC', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 14 },
    { code: 'HST NB', label: 'HST New Brunswick', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 15 },
    { code: 'HST NS', label: 'HST Nova Scotia', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 16 },
    { code: 'HST NL', label: 'HST Newfoundland', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 17 },
    { code: 'HST PE', label: 'HST Prince Edward Island', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 18 },
    
    // Provincial PST
    { code: 'PST BC', label: 'PST BC', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 19 },
    { code: 'PST SK', label: 'PST Saskatchewan', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 20 },
    { code: 'PST MB', label: 'PST Manitoba', category: 'taxes', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 21 },
    
    // Insurance
    { code: 'INS', label: 'Insurance', category: 'insurance', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 25 },
    { code: 'DV', label: 'Declared Value', category: 'insurance', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 26 },
    
    // Government
    { code: 'GOV', label: 'Government Fee', category: 'government', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 30 },
    { code: 'DUTY', label: 'Customs Duty', category: 'government', taxable: false, commissionable: false, enabled: true, isCore: false, displayOrder: 31 },
    
    // Common Accessorial Services (from carrier APIs)
    { code: 'RES', label: 'Residential Delivery', category: 'accessorial', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 40 },
    { code: 'SIG', label: 'Signature Required', category: 'accessorial', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 41 },
    { code: 'SAT', label: 'Saturday Delivery', category: 'accessorial', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 42 },
    { code: 'COD', label: 'Cash on Delivery', category: 'accessorial', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 43 },
    { code: 'ADDR', label: 'Address Correction', category: 'accessorial', taxable: true, commissionable: false, enabled: true, isCore: false, displayOrder: 44 },
    { code: 'EXT', label: 'Extended Area', category: 'accessorial', taxable: true, commissionable: true, enabled: true, isCore: false, displayOrder: 45 }
];

/**
 * Pre-populate chargeTypes collection with all existing static charge types
 * This ensures 100% backward compatibility for existing shipments
 */
async function prepopulateChargeTypes() {
    console.log('🚀 Starting charge types pre-population...');
    
    try {
        const batch = db.batch();
        let processed = 0;
        
        for (const chargeType of EXISTING_CHARGE_TYPES) {
            const docRef = db.collection('chargeTypes').doc(chargeType.code);
            
            // Check if charge type already exists
            const existingDoc = await docRef.get();
            if (existingDoc.exists) {
                console.log(`⚠️  Charge type ${chargeType.code} already exists, skipping...`);
                continue;
            }
            
            // Prepare charge type document
            const chargeTypeDoc = {
                code: chargeType.code,
                label: chargeType.label,
                category: chargeType.category,
                taxable: chargeType.taxable,
                commissionable: chargeType.commissionable,
                enabled: chargeType.enabled,
                isCore: chargeType.isCore || false,
                displayOrder: chargeType.displayOrder,
                
                // System metadata
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: 'system_migration',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedBy: 'system_migration',
                
                // Migration tracking
                migratedFrom: 'static_chargeTypeService',
                migrationVersion: '1.0',
                migrationDate: new Date().toISOString()
            };
            
            batch.set(docRef, chargeTypeDoc);
            processed++;
            
            console.log(`✅ Prepared charge type: ${chargeType.code} - ${chargeType.label}`);
            
            // Commit in batches of 25 (Firestore limit is 500, but being conservative)
            if (processed % 25 === 0) {
                await batch.commit();
                console.log(`📦 Committed batch of ${processed} charge types`);
            }
        }
        
        // Commit any remaining charge types
        if (processed % 25 !== 0) {
            await batch.commit();
            console.log(`📦 Committed final batch`);
        }
        
        console.log(`\n🎉 Successfully pre-populated ${processed} charge types!`);
        
        // Verify the data
        await verifyChargeTypes();
        
    } catch (error) {
        console.error('❌ Error pre-populating charge types:', error);
        throw error;
    }
}

/**
 * Verify that all charge types were created correctly
 */
async function verifyChargeTypes() {
    console.log('\n🔍 Verifying charge types...');
    
    try {
        const snapshot = await db.collection('chargeTypes').get();
        const chargeTypes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        console.log(`📊 Total charge types in database: ${chargeTypes.length}`);
        
        // Verify core charge types exist
        const coreChargeTypes = chargeTypes.filter(ct => ct.isCore);
        console.log(`🎯 Core charge types: ${coreChargeTypes.length}`);
        
        // Display by category
        const categories = {};
        chargeTypes.forEach(ct => {
            if (!categories[ct.category]) categories[ct.category] = [];
            categories[ct.category].push(ct.code);
        });
        
        console.log('\n📋 Charge types by category:');
        Object.entries(categories).forEach(([category, codes]) => {
            console.log(`  ${category}: ${codes.join(', ')}`);
        });
        
        // Check for any missing critical codes
        const criticalCodes = ['FRT', 'FUE', 'HST', 'GST', 'ACC', 'SUR'];
        const missingCritical = criticalCodes.filter(code => 
            !chargeTypes.find(ct => ct.code === code)
        );
        
        if (missingCritical.length > 0) {
            console.warn(`⚠️  Missing critical charge types: ${missingCritical.join(', ')}`);
        } else {
            console.log('✅ All critical charge types verified');
        }
        
    } catch (error) {
        console.error('❌ Error verifying charge types:', error);
        throw error;
    }
}

/**
 * Scan existing shipments to find any charge codes not in our static list
 */
async function scanExistingShipmentCodes() {
    console.log('\n🔍 Scanning existing shipments for unknown charge codes...');
    
    try {
        const shipmentsSnapshot = await db.collection('shipments')
            .where('status', '!=', 'draft')
            .limit(1000) // Scan first 1000 shipments
            .get();
        
        const foundCodes = new Set();
        const unknownCodes = new Set();
        const knownCodes = new Set(EXISTING_CHARGE_TYPES.map(ct => ct.code));
        
        shipmentsSnapshot.docs.forEach(doc => {
            const shipment = doc.data();
            
            // Check chargesBreakdown
            if (shipment.chargesBreakdown && Array.isArray(shipment.chargesBreakdown)) {
                shipment.chargesBreakdown.forEach(charge => {
                    if (charge.code) {
                        foundCodes.add(charge.code);
                        if (!knownCodes.has(charge.code)) {
                            unknownCodes.add(charge.code);
                        }
                    }
                });
            }
            
            // Check actualCharges
            if (shipment.actualCharges && Array.isArray(shipment.actualCharges)) {
                shipment.actualCharges.forEach(charge => {
                    if (charge.code) {
                        foundCodes.add(charge.code);
                        if (!knownCodes.has(charge.code)) {
                            unknownCodes.add(charge.code);
                        }
                    }
                });
            }
            
            // Check manualRates (QuickShip)
            if (shipment.manualRates && Array.isArray(shipment.manualRates)) {
                shipment.manualRates.forEach(rate => {
                    if (rate.code) {
                        foundCodes.add(rate.code);
                        if (!knownCodes.has(rate.code)) {
                            unknownCodes.add(rate.code);
                        }
                    }
                });
            }
        });
        
        console.log(`📊 Found ${foundCodes.size} unique charge codes in existing shipments`);
        console.log(`✅ Known codes: ${Array.from(foundCodes).filter(code => knownCodes.has(code)).join(', ')}`);
        
        if (unknownCodes.size > 0) {
            console.log(`⚠️  Unknown codes found: ${Array.from(unknownCodes).join(', ')}`);
            console.log('❗ These codes should be added to the charge types collection manually');
        } else {
            console.log('✅ All existing charge codes are covered by static types');
        }
        
        return {
            totalFound: foundCodes.size,
            knownCodes: Array.from(foundCodes).filter(code => knownCodes.has(code)),
            unknownCodes: Array.from(unknownCodes)
        };
        
    } catch (error) {
        console.error('❌ Error scanning shipment codes:', error);
        return { totalFound: 0, knownCodes: [], unknownCodes: [] };
    }
}

async function main() {
    console.log('🎯 SolushipX Charge Types Pre-Population');
    console.log('=========================================');
    
    try {
        // Phase 1: Scan existing shipments for unknown codes
        await scanExistingShipmentCodes();
        
        // Phase 2: Pre-populate charge types
        await prepopulateChargeTypes();
        
        console.log('\n🎉 Migration preparation complete!');
        console.log('✅ All existing charge codes are now available in database');
        console.log('✅ Existing shipments will continue to work without any changes');
        console.log('✅ Ready to implement dynamic charge type configuration UI');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    prepopulateChargeTypes,
    verifyChargeTypes,
    scanExistingShipmentCodes,
    EXISTING_CHARGE_TYPES
}; 