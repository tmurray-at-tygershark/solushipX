const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, writeBatch } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

const db = getFirestore();

/**
 * Charge Type Migration Script for Existing Shipments
 * 
 * This script analyzes existing shipments and migrates their charge codes
 * to be compatible with the new dynamic charge type system while preserving
 * all existing data and maintaining backward compatibility.
 * 
 * Usage:
 * node scripts/migrateChargeTypesInShipments.js [options]
 * 
 * Options:
 * --dry-run    : Only analyze, don't make changes
 * --batch-size : Number of documents to process per batch (default: 50)
 * --company    : Migrate only specific company (optional)
 * --force      : Skip confirmation prompts
 */

// Legacy charge code mapping (matches chargeTypeCompatibility.js)
const LEGACY_CHARGE_CODE_MAPPING = {
    // Core freight codes
    'FRT': 'FRT',
    'FREIGHT': 'FRT',
    'BASE': 'FRT',
    
    // Fuel codes
    'FUE': 'FUE',
    'FUEL': 'FUE',
    'FUEL_SURCHARGE': 'FUE',
    'FSC': 'FUE',
    
    // Accessorial codes
    'ACC': 'ACC',
    'ACCESSORIAL': 'ACC',
    'ACCESS': 'ACC',
    
    // Service/Logistics codes
    'SUR': 'SUR',
    'SURCHARGE': 'SUR',
    'LOG': 'LOG',
    'LOGISTICS': 'LOG',
    'SERVICE': 'SUR',
    
    // Tax codes (preserve all variations)
    'HST': 'HST',
    'HST ON': 'HST ON',
    'HST BC': 'HST BC',
    'HST NB': 'HST NB',
    'HST NF': 'HST NF',
    'HST NS': 'HST NS',
    'HST PE': 'HST PE',
    'GST': 'GST',
    'QST': 'QST',
    'PST': 'PST',
    'TAX': 'HST',
    'SALES_TAX': 'HST',
    
    // Government/Customs codes
    'GOVT': 'GOVT',
    'GOVD': 'GOVD',
    'GOVERNMENT': 'GOVT',
    'CUSTOMS': 'GOVT',
    'DUTY': 'GOVD',
    'GSTIMP': 'GSTIMP',
    'BROKERAGE': 'GOVT',
    
    // Miscellaneous codes
    'MSC': 'MSC',
    'MISC': 'MSC',
    'MISCELLANEOUS': 'MSC',
    'OTHER': 'MSC',
    'CLAIMS': 'CLAIMS',
    'INSURANCE': 'ACC',
    'INS': 'ACC',
    
    // Special/legacy codes
    'IC LOG': 'IC LOG',
    'IC SUR': 'IC SUR',
    'INTEGRATED_CARRIERS_LOG': 'IC LOG',
    'INTEGRATED_CARRIERS_SUR': 'IC SUR'
};

// Migration statistics
const migrationStats = {
    totalShipments: 0,
    shipmentsWithRates: 0,
    shipmentsNeedingMigration: 0,
    shipmentsMigrated: 0,
    ratesAnalyzed: 0,
    ratesMigrated: 0,
    unknownCodes: new Set(),
    mappedCodes: new Map(),
    errors: [],
    companies: new Set()
};

/**
 * Load dynamic charge types from database
 */
async function loadDynamicChargeTypes() {
    console.log('📦 Loading dynamic charge types from database...');
    
    try {
        const chargeTypesSnapshot = await db.collection('chargeTypes')
            .where('enabled', '==', true)
            .get();
        
        const dynamicChargeTypes = new Map();
        
        chargeTypesSnapshot.forEach(doc => {
            const data = doc.data();
            dynamicChargeTypes.set(data.code, {
                code: data.code,
                label: data.label,
                category: data.category,
                taxable: data.taxable,
                commissionable: data.commissionable
            });
        });
        
        console.log(`📦 Loaded ${dynamicChargeTypes.size} dynamic charge types`);
        return dynamicChargeTypes;
        
    } catch (error) {
        console.error('❌ Failed to load dynamic charge types:', error);
        console.log('⚠️  Will use legacy mapping only');
        return new Map();
    }
}

/**
 * Validate and normalize a charge code
 */
function validateAndNormalizeChargeCode(code, dynamicChargeTypes) {
    if (!code || typeof code !== 'string') {
        return {
            isValid: false,
            originalCode: code,
            normalizedCode: null,
            migrationNeeded: false,
            error: 'Invalid or missing charge code'
        };
    }

    const upperCode = code.trim().toUpperCase();
    
    // Check if code exists in dynamic system
    if (dynamicChargeTypes.has(upperCode)) {
        return {
            isValid: true,
            originalCode: code,
            normalizedCode: upperCode,
            migrationNeeded: false,
            source: 'dynamic'
        };
    }

    // Check legacy mapping
    const mappedCode = LEGACY_CHARGE_CODE_MAPPING[upperCode];
    if (mappedCode) {
        // Check if mapped code exists in dynamic system
        if (dynamicChargeTypes.has(mappedCode)) {
            return {
                isValid: true,
                originalCode: code,
                normalizedCode: mappedCode,
                migrationNeeded: upperCode !== mappedCode,
                source: 'legacy_mapped',
                migrationNote: `Code '${upperCode}' mapped to '${mappedCode}'`
            };
        } else {
            // Mapped code exists in legacy but not in dynamic system
            return {
                isValid: true,
                originalCode: code,
                normalizedCode: mappedCode,
                migrationNeeded: upperCode !== mappedCode,
                source: 'legacy_only',
                warning: `Mapped code '${mappedCode}' not found in dynamic system`
            };
        }
    }

    // Code not found in either system
    return {
        isValid: false,
        originalCode: code,
        normalizedCode: upperCode,
        migrationNeeded: true,
        error: `Unknown charge code: ${upperCode}`,
        source: 'unknown'
    };
}

/**
 * Analyze manual rates in a shipment
 */
function analyzeManualRates(manualRates, dynamicChargeTypes) {
    if (!manualRates || !Array.isArray(manualRates)) {
        return {
            needsMigration: false,
            rates: [],
            changes: [],
            warnings: [],
            errors: []
        };
    }

    const analysis = {
        needsMigration: false,
        rates: [],
        changes: [],
        warnings: [],
        errors: []
    };

    manualRates.forEach((rate, index) => {
        migrationStats.ratesAnalyzed++;
        
        if (!rate.code) {
            analysis.rates.push(rate);
            return;
        }

        const validation = validateAndNormalizeChargeCode(rate.code, dynamicChargeTypes);
        
        if (validation.isValid) {
            const migratedRate = { ...rate };
            
            if (validation.migrationNeeded) {
                analysis.needsMigration = true;
                migratedRate.code = validation.normalizedCode;
                
                analysis.changes.push({
                    rateIndex: index,
                    originalCode: rate.code,
                    newCode: validation.normalizedCode,
                    note: validation.migrationNote,
                    source: validation.source
                });
                
                // Track mapping statistics
                const mappingKey = `${rate.code} → ${validation.normalizedCode}`;
                migrationStats.mappedCodes.set(mappingKey, 
                    (migrationStats.mappedCodes.get(mappingKey) || 0) + 1);
            }
            
            if (validation.warning) {
                analysis.warnings.push({
                    rateIndex: index,
                    code: rate.code,
                    warning: validation.warning
                });
            }
            
            analysis.rates.push(migratedRate);
        } else {
            // Keep invalid codes but flag them
            analysis.rates.push(rate);
            analysis.errors.push({
                rateIndex: index,
                code: rate.code,
                error: validation.error
            });
            
            migrationStats.unknownCodes.add(rate.code);
        }
    });

    return analysis;
}

/**
 * Process a single shipment
 */
async function processShipment(shipmentDoc, dynamicChargeTypes, dryRun = true) {
    const data = shipmentDoc.data();
    const shipmentId = shipmentDoc.id;
    
    migrationStats.totalShipments++;
    migrationStats.companies.add(data.companyID || 'unknown');
    
    // Check if shipment has manual rates
    if (!data.manualRates || !Array.isArray(data.manualRates) || data.manualRates.length === 0) {
        return null; // No rates to migrate
    }
    
    migrationStats.shipmentsWithRates++;
    
    // Analyze the manual rates
    const analysis = analyzeManualRates(data.manualRates, dynamicChargeTypes);
    
    if (!analysis.needsMigration && analysis.errors.length === 0) {
        return null; // No migration needed
    }
    
    migrationStats.shipmentsNeedingMigration++;
    
    const migrationRecord = {
        shipmentId: shipmentId,
        shipmentID: data.shipmentID || shipmentId,
        companyID: data.companyID || 'unknown',
        creationMethod: data.creationMethod || 'unknown',
        originalRates: data.manualRates,
        migratedRates: analysis.rates,
        changes: analysis.changes,
        warnings: analysis.warnings,
        errors: analysis.errors,
        migrationNeeded: analysis.needsMigration,
        hasErrors: analysis.errors.length > 0
    };
    
    // Perform the migration if not a dry run
    if (!dryRun && analysis.needsMigration) {
        try {
            await shipmentDoc.ref.update({
                manualRates: analysis.rates,
                migrationMetadata: {
                    migratedAt: new Date(),
                    migrationVersion: '1.0',
                    originalRates: data.manualRates,
                    changes: analysis.changes,
                    script: 'migrateChargeTypesInShipments.js'
                }
            });
            
            migrationStats.shipmentsMigrated++;
            migrationStats.ratesMigrated += analysis.changes.length;
            
            console.log(`✅ Migrated shipment ${data.shipmentID || shipmentId} (${analysis.changes.length} rate changes)`);
            
        } catch (error) {
            const errorMsg = `Failed to migrate shipment ${shipmentId}: ${error.message}`;
            migrationStats.errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
        }
    }
    
    return migrationRecord;
}

/**
 * Process shipments in batches
 */
async function processShipmentsBatch(query, dynamicChargeTypes, dryRun = true, batchSize = 50) {
    console.log(`📊 Processing shipments in batches of ${batchSize}...`);
    
    const migrations = [];
    let lastDoc = null;
    let batchNumber = 1;
    
    while (true) {
        console.log(`\n📦 Processing batch ${batchNumber}...`);
        
        // Build query with pagination
        let batchQuery = query.limit(batchSize);
        if (lastDoc) {
            batchQuery = batchQuery.startAfter(lastDoc);
        }
        
        const snapshot = await batchQuery.get();
        
        if (snapshot.empty) {
            console.log('✅ No more shipments to process');
            break;
        }
        
        // Process each shipment in the batch
        for (const doc of snapshot.docs) {
            const migration = await processShipment(doc, dynamicChargeTypes, dryRun);
            if (migration) {
                migrations.push(migration);
            }
        }
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        batchNumber++;
        
        console.log(`📊 Batch ${batchNumber - 1} complete. Progress: ${migrationStats.totalShipments} shipments processed`);
    }
    
    return migrations;
}

/**
 * Generate migration report
 */
function generateReport(migrations) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 CHARGE TYPE MIGRATION REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📈 OVERALL STATISTICS:`);
    console.log(`  Total Shipments: ${migrationStats.totalShipments}`);
    console.log(`  Shipments with Rates: ${migrationStats.shipmentsWithRates}`);
    console.log(`  Shipments Needing Migration: ${migrationStats.shipmentsNeedingMigration}`);
    console.log(`  Shipments Migrated: ${migrationStats.shipmentsMigrated}`);
    console.log(`  Rates Analyzed: ${migrationStats.ratesAnalyzed}`);
    console.log(`  Rates Migrated: ${migrationStats.ratesMigrated}`);
    console.log(`  Companies Affected: ${migrationStats.companies.size}`);
    console.log(`  Errors: ${migrationStats.errors.length}`);
    
    if (migrationStats.mappedCodes.size > 0) {
        console.log(`\n🔄 CODE MAPPINGS:`);
        [...migrationStats.mappedCodes.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20) // Top 20
            .forEach(([mapping, count]) => {
                console.log(`  ${mapping}: ${count} occurrences`);
            });
    }
    
    if (migrationStats.unknownCodes.size > 0) {
        console.log(`\n❓ UNKNOWN CHARGE CODES:`);
        [...migrationStats.unknownCodes].sort().forEach(code => {
            console.log(`  ${code}`);
        });
    }
    
    if (migrationStats.errors.length > 0) {
        console.log(`\n❌ ERRORS:`);
        migrationStats.errors.slice(0, 10).forEach(error => {
            console.log(`  ${error}`);
        });
        if (migrationStats.errors.length > 10) {
            console.log(`  ... and ${migrationStats.errors.length - 10} more errors`);
        }
    }
    
    console.log('\n' + '='.repeat(80));
    
    return {
        stats: migrationStats,
        migrations: migrations
    };
}

/**
 * Main migration function
 */
async function runMigration() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 50;
    const companyFilter = args.find(arg => arg.startsWith('--company='))?.split('=')[1];
    const force = args.includes('--force');
    
    console.log('🚀 Starting Charge Type Migration for Shipments');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
    console.log(`Batch Size: ${batchSize}`);
    if (companyFilter) console.log(`Company Filter: ${companyFilter}`);
    
    if (!dryRun && !force) {
        console.log('\n⚠️  WARNING: This will modify shipment data in the database!');
        console.log('Use --dry-run first to see what changes would be made.');
        console.log('Use --force to skip this confirmation.');
        return;
    }
    
    try {
        // Load dynamic charge types
        const dynamicChargeTypes = await loadDynamicChargeTypes();
        
        // Build query
        let query = db.collection('shipments');
        
        if (companyFilter) {
            query = query.where('companyID', '==', companyFilter);
        }
        
        query = query.orderBy('createdAt', 'desc');
        
        console.log('\n📊 Starting shipment analysis...');
        
        // Process shipments
        const migrations = await processShipmentsBatch(query, dynamicChargeTypes, dryRun, batchSize);
        
        // Generate report
        const report = generateReport(migrations);
        
        // Save detailed report to file if there are migrations
        if (migrations.length > 0) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `charge-type-migration-${dryRun ? 'analysis' : 'report'}-${timestamp}.json`;
            
            const fs = require('fs');
            fs.writeFileSync(filename, JSON.stringify(report, null, 2));
            console.log(`\n💾 Detailed report saved to: ${filename}`);
        }
        
        if (dryRun && migrationStats.shipmentsNeedingMigration > 0) {
            console.log('\n🔄 To perform the actual migration, run:');
            console.log(`node scripts/migrateChargeTypesInShipments.js --batch-size=${batchSize}${companyFilter ? ` --company=${companyFilter}` : ''}`);
        }
        
    } catch (error) {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    }
}

// Run migration if this script is executed directly
if (require.main === module) {
    runMigration();
}

module.exports = {
    runMigration,
    validateAndNormalizeChargeCode,
    analyzeManualRates,
    LEGACY_CHARGE_CODE_MAPPING
}; 