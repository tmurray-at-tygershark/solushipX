/**
 * Cloud Functions for Rate Card Import/Export
 * Handles bulk import of rate cards from CSV/Excel templates
 */

const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { parse } = require('csv-parse/sync');
const { generateCompleteZoneData } = require('./comprehensiveZoneData');

// Initialize Firebase Admin if not already initialized
if (admin.apps.length === 0) {
    admin.initializeApp();
}

/**
 * Template structures for different rate types
 */
const RATE_CARD_TEMPLATES = {
    skid_based: {
        name: 'Skid Based Rate Card Template',
        headers: [
            'Rate Card Name',
            'Currency',
            'Enabled',
            'Effective Date',
            'Expiration Date',
            'Skid Count',
            'Sell',
            'Our Cost'
        ],
        sampleData: [
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '1', '185.00', '155.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '2', '285.00', '240.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '3', '375.00', '315.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '4', '450.00', '380.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '5', '520.00', '440.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '6', '585.00', '495.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '7', '645.00', '545.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '8', '700.00', '590.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '9', '750.00', '630.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '10', '795.00', '670.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '11', '835.00', '705.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '12', '870.00', '735.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '13', '900.00', '760.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '14', '925.00', '780.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '15', '945.00', '795.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '16', '960.00', '810.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '17', '975.00', '820.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '18', '985.00', '830.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '19', '995.00', '840.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '20', '1000.00', '845.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '21', '1005.00', '850.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '22', '1010.00', '855.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '23', '1015.00', '860.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '24', '1020.00', '865.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '25', '1025.00', '870.00'],
            ['Standard Skid Rates', 'CAD', 'true', '2024-01-01', '', '26', '1030.00', '875.00']
        ]
    },
    weight_based: {
        name: 'Weight Based Rate Card Template',
        headers: [
            'Rate Card Name',
            'Currency',
            'Enabled',
            'Effective Date',
            'Expiration Date',
            'Min Weight (lbs)',
            'Max Weight (lbs)',
            'Rate per LB',
            'Minimum Charge'
        ],
        sampleData: [
            ['Weight Break Rates', 'CAD', 'true', '2024-01-01', '', '0', '50', '2.50', '25.00'],
            ['Weight Break Rates', 'CAD', 'true', '2024-01-01', '', '51', '100', '2.25', '30.00'],
            ['Weight Break Rates', 'CAD', 'true', '2024-01-01', '', '101', '500', '2.00', '50.00'],
            ['Weight Break Rates', 'CAD', 'true', '2024-01-01', '', '501', '1000', '1.75', '75.00'],
            ['Weight Break Rates', 'CAD', 'true', '2024-01-01', '', '1001', '5000', '1.50', '100.00']
        ]
    },
    zone_based: {
        name: 'Zone Based Rate Card Template',
        headers: [
            'Rate Card Name',
            'Currency',
            'Enabled',
            'Effective Date',
            'Expiration Date',
            'Route Type',
            'Origin Zone',
            'Destination Zone',
            'Cost Per Mile',
            'Minimum Charge',
            'Notes'
        ],
        sampleData: generateCompleteZoneData() // This generates 1,456 complete route combinations!
    },
    flat: {
        name: 'Flat Rate Card Template',
        headers: [
            'Rate Card Name',
            'Currency',
            'Enabled',
            'Effective Date',
            'Expiration Date',
            'Flat Rate',
            'Description'
        ],
        sampleData: [
            ['Emergency Delivery', 'CAD', 'true', '2024-01-01', '', '500.00', 'Emergency same-day delivery service'],
            ['Weekend Service', 'CAD', 'true', '2024-01-01', '', '750.00', 'Weekend delivery premium service'],
            ['Holiday Service', 'CAD', 'true', '2024-01-01', '', '1000.00', 'Holiday delivery special rate']
        ]
    }
};

/**
 * Generate CSV template for download
 */
exports.generateRateCardTemplate = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            const { rateType } = data;

            if (!rateType || !RATE_CARD_TEMPLATES[rateType]) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Valid rate type is required'
                );
            }

            logger.info('📋 Generating rate card template', {
                userId: context.auth.uid,
                rateType
            });

            const template = RATE_CARD_TEMPLATES[rateType];
            
            // Convert to CSV format
            const csvContent = [
                template.headers,
                ...template.sampleData
            ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

            return {
                success: true,
                template: {
                    name: template.name,
                    filename: `${rateType}_rate_card_template.csv`,
                    content: csvContent,
                    headers: template.headers
                }
            };

        } catch (error) {
            logger.error('❌ Error generating rate card template', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to generate template',
                error.message
            );
        }
    });

/**
 * Process uploaded rate card data
 */
exports.importRateCards = functions
    .region('us-central1')
    .runWith({
        timeoutSeconds: 300, // 5 minutes for bulk operations
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        const logger = functions.logger;

        try {
            // Validate authentication
            if (!context.auth) {
                throw new functions.https.HttpsError(
                    'unauthenticated',
                    'Authentication required'
                );
            }

            // Validate user role
            const userDoc = await admin.firestore()
                .collection('users')
                .doc(context.auth.uid)
                .get();

            const userData = userDoc.data();
            if (!userData || !['admin', 'superadmin'].includes(userData.role)) {
                throw new functions.https.HttpsError(
                    'permission-denied',
                    'Insufficient permissions'
                );
            }

            const { carrierId, csvContent, rateType, preview = false } = data;

            if (!carrierId || !csvContent || !rateType) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Carrier ID, CSV content, and rate type are required'
                );
            }

            logger.info('📥 Processing rate card import', {
                userId: context.auth.uid,
                carrierId,
                rateType,
                preview
            });

            const db = admin.firestore();

            // Check if carrier exists
            const carrierDoc = await db.collection('quickshipCarriers').doc(carrierId).get();
            if (!carrierDoc.exists) {
                throw new functions.https.HttpsError(
                    'not-found',
                    'Carrier not found'
                );
            }

            const carrierData = carrierDoc.data();

            // Parse CSV data
            let records;
            try {
                records = parse(csvContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                });
            } catch (parseError) {
                throw new functions.https.HttpsError(
                    'invalid-argument',
                    'Invalid CSV format: ' + parseError.message
                );
            }

            logger.info('📊 Parsed CSV records', { count: records.length });

            // Group records by rate card name
            const rateCardGroups = {};
            const validationErrors = [];

            records.forEach((record, index) => {
                const rowNumber = index + 2; // +2 because CSV starts at row 1 and we have headers
                
                try {
                    const rateCardName = record['Rate Card Name']?.trim();
                    if (!rateCardName) {
                        validationErrors.push(`Row ${rowNumber}: Rate Card Name is required`);
                        return;
                    }

                    if (!rateCardGroups[rateCardName]) {
                        rateCardGroups[rateCardName] = {
                            rateCardName,
                            currency: record['Currency']?.trim() || 'CAD',
                            enabled: record['Enabled']?.toLowerCase() !== 'false',
                            effectiveDate: record['Effective Date']?.trim() || null,
                            expirationDate: record['Expiration Date']?.trim() || null,
                            rateType,
                            data: []
                        };
                    }

                    // Validate and parse rate-specific data
                    const rateData = parseRateData(record, rateType, rowNumber);
                    if (rateData.errors) {
                        validationErrors.push(...rateData.errors);
                    } else {
                        rateCardGroups[rateCardName].data.push(rateData.data);
                    }

                } catch (error) {
                    validationErrors.push(`Row ${rowNumber}: ${error.message}`);
                }
            });

            if (validationErrors.length > 0) {
                return {
                    success: false,
                    errors: validationErrors,
                    validationFailed: true
                };
            }

            const rateCards = Object.values(rateCardGroups);

            // If this is just a preview, return the parsed data
            if (preview) {
                return {
                    success: true,
                    preview: true,
                    rateCards: rateCards.map(card => ({
                        ...card,
                        dataCount: card.data.length
                    }))
                };
            }

            // Actually create the rate cards
            const results = [];
            const batch = db.batch();

            for (const rateCardData of rateCards) {
                try {
                    const finalRateData = {
                        carrierId,
                        carrierName: carrierData.name,
                        rateCardName: rateCardData.rateCardName,
                        rateType: rateCardData.rateType,
                        enabled: rateCardData.enabled,
                        currency: rateCardData.currency,
                        
                        // Rate configuration based on type
                        skidRates: rateType === 'skid_based' ? rateCardData.data : [],
                        weightBreaks: rateType === 'weight_based' ? rateCardData.data : [],
                        zones: rateType === 'zone_based' ? rateCardData.data : [],
                        flatRate: rateType === 'flat' ? rateCardData.data[0]?.amount || 0 : null,
                        
                        // Metadata
                        effectiveDate: rateCardData.effectiveDate ? new Date(rateCardData.effectiveDate) : admin.firestore.FieldValue.serverTimestamp(),
                        expirationDate: rateCardData.expirationDate ? new Date(rateCardData.expirationDate) : null,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        createdBy: context.auth.uid,
                        importedAt: admin.firestore.FieldValue.serverTimestamp()
                    };

                    const rateCardRef = db.collection('carrierRateCards').doc();
                    batch.set(rateCardRef, finalRateData);

                    results.push({
                        id: rateCardRef.id,
                        name: rateCardData.rateCardName,
                        success: true
                    });

                } catch (error) {
                    logger.error('❌ Error preparing rate card', {
                        rateCardName: rateCardData.rateCardName,
                        error: error.message
                    });

                    results.push({
                        name: rateCardData.rateCardName,
                        success: false,
                        error: error.message
                    });
                }
            }

            // Commit the batch
            await batch.commit();

            logger.info('✅ Rate cards imported successfully', {
                totalCards: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            });

            return {
                success: true,
                imported: true,
                results,
                summary: {
                    total: results.length,
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length
                }
            };

        } catch (error) {
            logger.error('❌ Error importing rate cards', {
                error: error.message,
                stack: error.stack
            });

            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            throw new functions.https.HttpsError(
                'internal',
                'Failed to import rate cards',
                error.message
            );
        }
    });

/**
 * Parse rate-specific data based on rate type
 */
function parseRateData(record, rateType, rowNumber) {
    try {
        switch (rateType) {
            case 'skid_based':
                return {
                    data: {
                        skidCount: parseInt(record['Skid Count']) || 1,
                        retailPrice: parseFloat(record['Sell']) || 0,
                        ourCost: parseFloat(record['Our Cost']) || 0,
                        alternateCarrier: null,
                        rushAvailable: false,
                        notes: ''
                    }
                };

            case 'weight_based':
                return {
                    data: {
                        minWeight: parseFloat(record['Min Weight (lbs)']) || 0,
                        maxWeight: parseFloat(record['Max Weight (lbs)']) || 0,
                        rate: parseFloat(record['Rate per LB']) || 0,
                        minimumCharge: parseFloat(record['Minimum Charge']) || 0
                    }
                };

            case 'zone_based':
                return {
                    data: {
                        routeType: record['Route Type']?.trim() || '',
                        originZone: record['Origin Zone']?.trim() || '',
                        destinationZone: record['Destination Zone']?.trim() || '',
                        costPerMile: parseFloat(record['Cost Per Mile']) || 0,
                        minimumCharge: parseFloat(record['Minimum Charge']) || 0,
                        notes: record['Notes']?.trim() || ''
                    }
                };

            case 'flat':
                return {
                    data: {
                        flatRate: parseFloat(record['Flat Rate']) || 0,
                        description: record['Description']?.trim() || ''
                    }
                };

            default:
                return {
                    errors: [`Row ${rowNumber}: Unsupported rate type: ${rateType}`]
                };
        }
    } catch (error) {
        return {
            errors: [`Row ${rowNumber}: Error parsing data - ${error.message}`]
        };
    }
}
