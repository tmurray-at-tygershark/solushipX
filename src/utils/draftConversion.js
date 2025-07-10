import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Convert a draft shipment between QuickShip and CreateShipmentX formats
 * Updates the draft in-place in the database
 * 
 * @param {string} draftId - The Firestore document ID of the draft
 * @param {string} targetFormat - Either 'quickship' or 'advanced'
 * @returns {Promise<boolean>} - Success status
 */
export const convertDraftInDatabase = async (draftId, targetFormat) => {
    console.log(`🔄 Converting draft ${draftId} to ${targetFormat} format`);
    
    try {
        // Load the current draft
        const draftRef = doc(db, 'shipments', draftId);
        const draftDoc = await getDoc(draftRef);
        
        if (!draftDoc.exists()) {
            console.error('Draft not found:', draftId);
            return false;
        }
        
        const currentData = draftDoc.data();
        console.log('📄 Current draft data:', currentData);
        
        let updatedData = {};
        
        if (targetFormat === 'advanced') {
            // Converting from QuickShip to Advanced
            console.log('🔄 Converting QuickShip → Advanced');
            
            // Change the creation method
            updatedData.creationMethod = 'advanced';
            
            // Convert manual rates to selectedRate format
            if (currentData.manualRates && currentData.manualRates.length > 0) {
                const convertedRate = convertManualRatesToSelectedRate(
                    currentData.manualRates,
                    currentData.selectedCarrier
                );
                updatedData.selectedRate = convertedRate;
                
                // Remove QuickShip-specific fields
                updatedData.manualRates = deleteField();
                updatedData.selectedCarrier = deleteField();
            }
            
        } else if (targetFormat === 'quickship') {
            // Converting from Advanced to QuickShip
            console.log('🔄 Converting Advanced → QuickShip');
            
            // Change the creation method
            updatedData.creationMethod = 'quickship';
            
            // Convert selectedRate to manual rates format
            if (currentData.selectedRate) {
                const { manualRates, carrier } = convertSelectedRateToManualRates(
                    currentData.selectedRate
                );
                updatedData.manualRates = manualRates;
                updatedData.selectedCarrier = carrier;
                
                // Remove Advanced-specific fields
                updatedData.selectedRate = deleteField();
            }
        }
        
        // Preserve important fields during conversion
        if (currentData.selectedCustomerId) {
            updatedData.selectedCustomerId = currentData.selectedCustomerId;
        }
        
        // Ensure packages have proper weight format (string for QuickShip)
        if (targetFormat === 'quickship' && currentData.packages) {
            updatedData.packages = currentData.packages.map(pkg => ({
                ...pkg,
                weight: String(pkg.weight || ''),
                length: String(pkg.length || ''),
                width: String(pkg.width || ''),
                height: String(pkg.height || '')
            }));
        }
        
        // Add conversion metadata
        updatedData.lastConvertedFrom = currentData.creationMethod || 'unknown';
        updatedData.lastConvertedAt = new Date();
        updatedData.updatedAt = new Date();
        
        console.log('📝 Updating draft with:', updatedData);
        
        // Update the draft in the database
        await updateDoc(draftRef, updatedData);
        
        console.log('✅ Draft converted successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Error converting draft:', error);
        return false;
    }
};

/**
 * Convert manual rates array to selectedRate object format
 */
function convertManualRatesToSelectedRate(manualRates, selectedCarrier) {
    // Extract individual rate types
    const freightRate = manualRates.find(rate => rate.code === 'FRT');
    const fuelRate = manualRates.find(rate => rate.code === 'FUE');
    const serviceRates = manualRates.filter(rate => rate.code === 'SUR' || rate.code === 'ACC');
    
    // Calculate totals
    const freightCharges = parseFloat(freightRate?.charge || 0);
    const fuelCharges = parseFloat(fuelRate?.charge || 0);
    const serviceCharges = serviceRates.reduce((sum, rate) => sum + parseFloat(rate.charge || 0), 0);
    const totalCharges = manualRates.reduce((sum, rate) => sum + parseFloat(rate.charge || 0), 0);
    
    return {
        carrier: {
            name: selectedCarrier || 'Manual Entry',
            logo: '/images/integratedcarrriers_logo_blk.png'
        },
        sourceCarrierName: selectedCarrier || 'Manual Entry',
        pricing: {
            freight: freightCharges,
            fuel: fuelCharges,
            service: serviceCharges,
            accessorial: 0,
            total: totalCharges,
            currency: manualRates[0]?.chargeCurrency || 'CAD'
        },
        freightCharges: freightCharges,
        fuelCharges: fuelCharges,
        serviceCharges: serviceCharges,
        accessorialCharges: 0,
        totalCharges: totalCharges,
        serviceType: 'Manual Entry',
        transitTime: 'N/A',
        source: 'manual',
        billingDetails: manualRates.filter(rate => rate.charge && parseFloat(rate.charge) > 0).map(rate => ({
            name: rate.chargeName,
            amount: parseFloat(rate.charge || 0),
            actualAmount: parseFloat(rate.cost || rate.charge || 0),
            category: getChargeCategory(rate.code)
        }))
    };
}

/**
 * Convert selectedRate object to manual rates array format
 */
function convertSelectedRateToManualRates(selectedRate) {
    const manualRates = [];
    let rateId = 1;
    
    // Extract carrier name
    const carrierName = selectedRate.carrier?.name || 
                       selectedRate.sourceCarrierName || 
                       selectedRate.displayCarrier?.name || 
                       'Manual Entry';
    
    // Use billingDetails if available (most accurate)
    if (selectedRate.billingDetails && selectedRate.billingDetails.length > 0) {
        selectedRate.billingDetails.forEach(detail => {
            if (detail.amount && detail.amount > 0) {
                const code = getCategoryCode(detail.category);
                manualRates.push({
                    id: rateId++,
                    carrier: carrierName,
                    code: code,
                    chargeName: detail.name || getDefaultChargeName(code),
                    cost: (detail.actualAmount || detail.amount).toString(),
                    costCurrency: selectedRate.pricing?.currency || 'CAD',
                    charge: detail.amount.toString(),
                    chargeCurrency: selectedRate.pricing?.currency || 'CAD'
                });
            }
        });
    } else {
        // Fallback to pricing breakdown
        if (selectedRate.pricing?.freight || selectedRate.freightCharges) {
            manualRates.push({
                id: rateId++,
                carrier: carrierName,
                code: 'FRT',
                chargeName: 'Freight',
                cost: (selectedRate.pricing?.freight || selectedRate.freightCharges || 0).toString(),
                costCurrency: selectedRate.pricing?.currency || 'CAD',
                charge: (selectedRate.pricing?.freight || selectedRate.freightCharges || 0).toString(),
                chargeCurrency: selectedRate.pricing?.currency || 'CAD'
            });
        }
        
        if (selectedRate.pricing?.fuel || selectedRate.fuelCharges) {
            manualRates.push({
                id: rateId++,
                carrier: carrierName,
                code: 'FUE',
                chargeName: 'Fuel Surcharge',
                cost: (selectedRate.pricing?.fuel || selectedRate.fuelCharges || 0).toString(),
                costCurrency: selectedRate.pricing?.currency || 'CAD',
                charge: (selectedRate.pricing?.fuel || selectedRate.fuelCharges || 0).toString(),
                chargeCurrency: selectedRate.pricing?.currency || 'CAD'
            });
        }
    }
    
    // Ensure we have at least basic rates
    if (manualRates.length === 0) {
        manualRates.push({
            id: 1,
            carrier: carrierName,
            code: 'FRT',
            chargeName: 'Freight',
            cost: '',
            costCurrency: 'CAD',
            charge: '',
            chargeCurrency: 'CAD'
        });
        manualRates.push({
            id: 2,
            carrier: carrierName,
            code: 'FUE',
            chargeName: 'Fuel Surcharge',
            cost: '',
            costCurrency: 'CAD',
            charge: '',
            chargeCurrency: 'CAD'
        });
    }
    
    return {
        manualRates,
        carrier: carrierName
    };
}

/**
 * Helper function to get charge category from code
 */
function getChargeCategory(code) {
    if (code === 'FRT') return 'freight';
    if (code === 'FUE') return 'fuel';
    if (code === 'SUR') return 'service';
    if (code === 'ACC') return 'accessorial';
    return 'miscellaneous';
}

/**
 * Helper function to get code from category
 */
function getCategoryCode(category) {
    const categoryMap = {
        'freight': 'FRT',
        'fuel': 'FUE',
        'service': 'SUR',
        'accessorial': 'ACC'
    };
    return categoryMap[category] || 'MSC';
}

/**
 * Helper function to get default charge name from code
 */
function getDefaultChargeName(code) {
    const nameMap = {
        'FRT': 'Freight',
        'FUE': 'Fuel Surcharge',
        'SUR': 'Service Charge',
        'ACC': 'Accessorial',
        'MSC': 'Miscellaneous'
    };
    return nameMap[code] || 'Other Charge';
} 