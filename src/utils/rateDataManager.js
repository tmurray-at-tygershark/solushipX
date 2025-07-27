/**
 * RATE DATA MANAGER
 * Single Source of Truth for all rate data operations in SolushipX
 * 
 * This utility consolidates all the fragmented rate data models:
 * - manualRates (QuickShip format)
 * - selectedRate (Universal format) 
 * - actualRates/markupRates (Markup system)
 * - updatedCharges/chargesBreakdown (Inline edit format)
 * 
 * Into a unified system with consistent read/write operations.
 */

import { db } from '../firebase/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

// UNIVERSAL RATE STRUCTURE - Single source of truth
export const RATE_STRUCTURE = {
    // Core metadata
    id: '',
    shipmentId: '',
    lastModified: null,
    modifiedBy: '',
    
    // Carrier information
    carrier: {
        name: '',
        code: '',
        logo: ''
    },
    
    // Service information  
    service: {
        name: '',
        code: '',
        type: ''
    },
    
    // Line items - standardized charge structure
    charges: [
        {
            id: '',
            code: '', // FRT, FUE, ACC, SUR, etc.
            name: '', // Human readable name
            category: '', // freight, fuel, accessorial, tax, etc.
            
            // Cost vs Charge (for markup system)
            cost: 0,        // What we pay the carrier (actualRates)
            charge: 0,      // What we charge the customer (markupRates)
            currency: 'CAD',
            
            // Admin fields
            invoiceNumber: '',
            ediNumber: '',
            commissionable: false,
            
            // Metadata
            source: '', // api, manual, inline_edit
            addedBy: '',
            addedAt: null
        }
    ],
    
    // Calculated totals
    totals: {
        cost: 0,     // Total carrier cost
        charge: 0,   // Total customer charge  
        currency: 'CAD'
    },
    
    // Audit trail
    history: [
        {
            action: '', // created, updated, deleted, charge_added, charge_removed
            timestamp: null,
            user: '',
            changes: {}
        }
    ]
};

/**
 * READ OPERATIONS - Get rate data in standardized format
 */

export async function getRateData(shipmentId) {
    try {
        const shipmentDoc = await getDoc(doc(db, 'shipments', shipmentId));
        if (!shipmentDoc.exists()) {
            throw new Error(`Shipment ${shipmentId} not found`);
        }
        
        const shipment = shipmentDoc.data();
        return convertToUniversalFormat(shipment);
    } catch (error) {
        console.error('Error getting rate data:', error);
        throw error;
    }
}

export function convertToUniversalFormat(shipment) {
    // Determine shipment type and data source priority
    const isQuickShip = shipment.creationMethod === 'quickship';
    
    let charges = [];
    let carrier = { name: '', code: '', logo: '' };
    let service = { name: '', code: '', type: '' };
    
    if (isQuickShip) {
        // QuickShip: manualRates is the source of truth
        if (shipment.manualRates && Array.isArray(shipment.manualRates)) {
            charges = shipment.manualRates.map(rate => ({
                id: rate.id || Math.random().toString(),
                code: rate.code || 'FRT',
                name: rate.chargeName || 'Freight',
                category: mapCodeToCategory(rate.code),
                cost: parseFloat(rate.cost || rate.charge || 0),
                charge: parseFloat(rate.charge || rate.cost || 0),
                currency: rate.chargeCurrency || rate.costCurrency || 'CAD',
                invoiceNumber: rate.invoiceNumber || '-',
                ediNumber: rate.ediNumber || '-',
                commissionable: rate.commissionable || false,
                source: 'manual',
                addedBy: shipment.createdBy || '',
                addedAt: shipment.createdAt
            }));
            
            carrier.name = shipment.manualRates[0]?.carrier || shipment.selectedCarrier || '';
        }
    } else {
        // Regular shipments: check multiple sources with priority
        
        // Priority 1: updatedCharges (latest inline edits)
        if (shipment.updatedCharges && Array.isArray(shipment.updatedCharges)) {
            charges = shipment.updatedCharges.map(charge => ({
                id: charge.id || Math.random().toString(),
                code: charge.code || 'FRT',
                name: charge.description || charge.chargeName || 'Freight',
                category: charge.category || mapCodeToCategory(charge.code),
                cost: parseFloat(charge.quotedCost || charge.actualCost || charge.cost || 0),
                charge: parseFloat(charge.quotedCharge || charge.actualCharge || charge.charge || 0),
                currency: charge.currency || 'CAD',
                invoiceNumber: charge.invoiceNumber || '-',
                ediNumber: charge.ediNumber || '-',
                commissionable: charge.commissionable || false,
                source: 'inline_edit',
                addedBy: charge.modifiedBy || '',
                addedAt: charge.modifiedAt
            }));
        }
        // Priority 2: actualRates/markupRates (markup system)
        else if (shipment.actualRates && shipment.markupRates) {
            // Use markup system data
            charges = shipment.markupRates.charges || [];
        }
        // Priority 3: selectedRate breakdown
        else if (shipment.selectedRate?.billingDetails) {
            charges = shipment.selectedRate.billingDetails.map(detail => ({
                id: Math.random().toString(),
                code: detail.code || mapNameToCode(detail.name),
                name: detail.name,
                category: detail.category || mapCodeToCategory(detail.code),
                cost: parseFloat(detail.actualAmount || detail.amount || 0),
                charge: parseFloat(detail.amount || 0),
                currency: shipment.selectedRate.pricing?.currency || 'CAD',
                invoiceNumber: '-',
                ediNumber: '-',
                commissionable: false,
                source: 'api',
                addedBy: shipment.createdBy || '',
                addedAt: shipment.createdAt
            }));
            
            carrier = shipment.selectedRate.carrier || {};
            service = shipment.selectedRate.service || {};
        }
    }
    
    // Calculate totals
    const totalCost = charges.reduce((sum, charge) => sum + charge.cost, 0);
    const totalCharge = charges.reduce((sum, charge) => sum + charge.charge, 0);
    
    return {
        id: `rates_${shipment.id}`,
        shipmentId: shipment.id,
        lastModified: shipment.updatedAt || shipment.createdAt,
        modifiedBy: shipment.updatedBy || shipment.createdBy || '',
        carrier,
        service,
        charges,
        totals: {
            cost: totalCost,
            charge: totalCharge,
            currency: charges[0]?.currency || 'CAD'
        },
        history: [] // TODO: Implement audit trail
    };
}

/**
 * WRITE OPERATIONS - Save rate data to appropriate format
 */

export async function saveRateData(shipmentId, rateData, user) {
    try {
        const shipmentRef = doc(db, 'shipments', shipmentId);
        const shipmentDoc = await getDoc(shipmentRef);
        
        if (!shipmentDoc.exists()) {
            throw new Error(`Shipment ${shipmentId} not found`);
        }
        
        const shipment = shipmentDoc.data();
        const isQuickShip = shipment.creationMethod === 'quickship';
        
        let updateData = {
            updatedAt: new Date(),
            updatedBy: user.email || user.uid
        };
        
        if (isQuickShip) {
            // QuickShip: Save to manualRates
            updateData.manualRates = rateData.charges.map((charge, index) => ({
                id: index + 1,
                carrier: rateData.carrier.name,
                code: charge.code,
                chargeName: charge.name,
                cost: charge.cost.toString(),
                costCurrency: charge.currency,
                charge: charge.charge.toString(),
                chargeCurrency: charge.currency,
                invoiceNumber: charge.invoiceNumber,
                ediNumber: charge.ediNumber,
                commissionable: charge.commissionable
            }));
            
            // Clear conflicting fields
            updateData.updatedCharges = null;
            updateData.chargesBreakdown = null;
        } else {
            // Regular shipments: Save to updatedCharges
            updateData.updatedCharges = rateData.charges.map(charge => ({
                id: charge.id,
                code: charge.code,
                description: charge.name,
                category: charge.category,
                quotedCost: charge.cost,
                quotedCharge: charge.charge,
                actualCost: charge.cost,
                actualCharge: charge.charge,
                currency: charge.currency,
                invoiceNumber: charge.invoiceNumber,
                ediNumber: charge.ediNumber,
                commissionable: charge.commissionable,
                modifiedBy: user.email,
                modifiedAt: new Date()
            }));
            
            updateData.chargesBreakdown = updateData.updatedCharges;
        }
        
        await updateDoc(shipmentRef, updateData);
        
        console.log(`✅ Rate data saved for ${isQuickShip ? 'QuickShip' : 'regular'} shipment:`, {
            shipmentId,
            chargeCount: rateData.charges.length,
            totalCost: rateData.totals.cost,
            totalCharge: rateData.totals.charge
        });
        
        return { success: true, data: updateData };
    } catch (error) {
        console.error('Error saving rate data:', error);
        throw error;
    }
}

/**
 * UTILITY FUNCTIONS
 */

function mapCodeToCategory(code) {
    const mapping = {
        'FRT': 'freight',
        'FUE': 'fuel', 
        'FSC': 'fuel',
        'ACC': 'accessorial',
        'SUR': 'surcharge',
        'TAX': 'tax',
        'GST': 'tax',
        'HST': 'tax',
        'PST': 'tax'
    };
    return mapping[code] || 'other';
}

function mapNameToCode(name) {
    const mapping = {
        'Freight': 'FRT',
        'Fuel Surcharge': 'FSC',
        'Fuel': 'FUE',
        'Accessorial': 'ACC',
        'Surcharge': 'SUR',
        'Tax': 'TAX',
        'GST': 'GST',
        'HST': 'HST',
        'PST': 'PST'
    };
    
    // Try exact match first
    if (mapping[name]) return mapping[name];
    
    // Try partial matches
    const nameLower = name.toLowerCase();
    if (nameLower.includes('freight')) return 'FRT';
    if (nameLower.includes('fuel')) return 'FSC';
    if (nameLower.includes('tax')) return 'TAX';
    if (nameLower.includes('surcharge')) return 'SUR';
    
    return 'OTHER';
}

/**
 * MIGRATION UTILITIES - For converting existing data
 */

export async function migrateShipmentRates(shipmentId) {
    try {
        const rateData = await getRateData(shipmentId);
        // The getRateData function already converts to universal format
        // This serves as a validation that migration is working
        console.log(`✅ Migrated rates for shipment ${shipmentId}:`, {
            chargeCount: rateData.charges.length,
            totalCost: rateData.totals.cost,
            totalCharge: rateData.totals.charge
        });
        return rateData;
    } catch (error) {
        console.error(`❌ Failed to migrate rates for shipment ${shipmentId}:`, error);
        throw error;
    }
}

export default {
    getRateData,
    saveRateData,
    convertToUniversalFormat,
    migrateShipmentRates,
    RATE_STRUCTURE
}; 