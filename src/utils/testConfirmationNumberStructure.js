/**
 * Test script to verify confirmation number structure
 * Ensures confirmation numbers are stored in selectedRateRef map, not at root level
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Test the confirmation number structure in shipment documents
 */
export const testConfirmationNumberStructure = async () => {
    console.log('🧪 Testing Confirmation Number Structure');
    console.log('=======================================');
    
    try {
        // Query for booked shipments
        const shipmentsRef = collection(db, 'shipments');
        const bookedQuery = query(shipmentsRef, where('status', '==', 'booked'));
        const querySnapshot = await getDocs(bookedQuery);
        
        const results = {
            totalBooked: 0,
            withRootConfirmation: 0,
            withRateRefConfirmation: 0,
            withBothConfirmations: 0,
            withNoConfirmation: 0,
            examples: []
        };
        
        for (const docSnap of querySnapshot.docs) {
            results.totalBooked++;
            const data = docSnap.data();
            const docId = docSnap.id;
            
            const hasRootConfirmation = data.hasOwnProperty('confirmationNumber');
            const hasRateRefConfirmation = data.selectedRateRef?.confirmationNumber;
            
            if (hasRootConfirmation && hasRateRefConfirmation) {
                results.withBothConfirmations++;
            } else if (hasRootConfirmation) {
                results.withRootConfirmation++;
            } else if (hasRateRefConfirmation) {
                results.withRateRefConfirmation++;
            } else {
                results.withNoConfirmation++;
            }
            
            // Collect examples for the first few documents
            if (results.examples.length < 5) {
                results.examples.push({
                    shipmentID: data.shipmentID,
                    docId: docId,
                    hasRootConfirmation,
                    hasRateRefConfirmation,
                    rootConfirmationNumber: data.confirmationNumber || null,
                    rateRefConfirmationNumber: data.selectedRateRef?.confirmationNumber || null,
                    carrier: data.selectedRateRef?.carrier || 'Unknown'
                });
            }
        }
        
        console.log('\n📊 Confirmation Number Structure Results:');
        console.log(`📄 Total booked shipments: ${results.totalBooked}`);
        console.log(`🏠 With root-level confirmation: ${results.withRootConfirmation}`);
        console.log(`📦 With selectedRateRef confirmation: ${results.withRateRefConfirmation}`);
        console.log(`🔄 With both confirmations: ${results.withBothConfirmations}`);
        console.log(`❌ With no confirmation: ${results.withNoConfirmation}`);
        
        if (results.examples.length > 0) {
            console.log('\n🔍 Examples:');
            results.examples.forEach((example, index) => {
                console.log(`\n${index + 1}. Shipment ${example.shipmentID} (${example.carrier})`);
                console.log(`   Root confirmation: ${example.rootConfirmationNumber || 'None'}`);
                console.log(`   Rate ref confirmation: ${example.rateRefConfirmationNumber || 'None'}`);
            });
        }
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        if (results.withRootConfirmation > 0) {
            console.log(`⚠️  Found ${results.withRootConfirmation} shipments with root-level confirmation numbers`);
            console.log('   Consider running cleanup to move them to selectedRateRef');
        }
        
        if (results.withRateRefConfirmation > 0) {
            console.log(`✅ Found ${results.withRateRefConfirmation} shipments with properly structured confirmation numbers`);
        }
        
        if (results.withNoConfirmation > 0) {
            console.log(`⚠️  Found ${results.withNoConfirmation} booked shipments without confirmation numbers`);
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ Error testing confirmation number structure:', error);
        throw error;
    }
};

/**
 * Test a specific shipment's confirmation number structure
 */
export const testSingleShipmentConfirmation = async (shipmentId) => {
    try {
        console.log(`🔍 Testing shipment: ${shipmentId}`);
        
        const shipmentsRef = collection(db, 'shipments');
        const querySnapshot = await getDocs(shipmentsRef);
        
        let shipmentFound = false;
        
        for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data();
            
            if (data.shipmentID === shipmentId || docSnap.id === shipmentId) {
                shipmentFound = true;
                
                console.log('\n📋 Shipment Details:');
                console.log(`📄 Document ID: ${docSnap.id}`);
                console.log(`🆔 Shipment ID: ${data.shipmentID}`);
                console.log(`📊 Status: ${data.status}`);
                console.log(`🚚 Carrier: ${data.selectedRateRef?.carrier || 'Unknown'}`);
                
                console.log('\n🔢 Confirmation Numbers:');
                console.log(`🏠 Root level: ${data.confirmationNumber || 'None'}`);
                console.log(`📦 Rate ref level: ${data.selectedRateRef?.confirmationNumber || 'None'}`);
                
                if (data.selectedRateRef) {
                    console.log('\n📦 Selected Rate Reference:');
                    console.log(`   Rate ID: ${data.selectedRateRef.rateId || 'N/A'}`);
                    console.log(`   Carrier: ${data.selectedRateRef.carrier || 'N/A'}`);
                    console.log(`   Service: ${data.selectedRateRef.service || 'N/A'}`);
                    console.log(`   Status: ${data.selectedRateRef.status || 'N/A'}`);
                    console.log(`   Confirmation: ${data.selectedRateRef.confirmationNumber || 'N/A'}`);
                    console.log(`   Booked At: ${data.selectedRateRef.bookedAt?.toDate?.() || 'N/A'}`);
                }
                
                break;
            }
        }
        
        if (!shipmentFound) {
            console.log(`❌ Shipment ${shipmentId} not found`);
        }
        
        return shipmentFound;
        
    } catch (error) {
        console.error('❌ Error testing single shipment:', error);
        throw error;
    }
};

/**
 * Test that rateDetails field is not being saved to shipment documents
 */
export const testRateDetailsNotSaved = async () => {
    console.log('🧪 Testing RateDetails Field Removal');
    console.log('====================================');
    
    try {
        const shipmentsRef = collection(db, 'shipments');
        const querySnapshot = await getDocs(shipmentsRef);
        
        const results = {
            totalDocuments: 0,
            documentsWithRateDetails: 0,
            examples: []
        };
        
        for (const docSnap of querySnapshot.docs) {
            results.totalDocuments++;
            const data = docSnap.data();
            
            if (data.hasOwnProperty('rateDetails')) {
                results.documentsWithRateDetails++;
                
                // Collect examples for the first few documents
                if (results.examples.length < 5) {
                    results.examples.push({
                        shipmentID: data.shipmentID,
                        docId: docSnap.id,
                        rateDetailsValue: data.rateDetails,
                        rateDetailsType: typeof data.rateDetails,
                        isEmpty: Object.keys(data.rateDetails || {}).length === 0
                    });
                }
            }
        }
        
        console.log('\n📊 RateDetails Field Test Results:');
        console.log(`📄 Total documents: ${results.totalDocuments}`);
        console.log(`🗂️  Documents with rateDetails: ${results.documentsWithRateDetails}`);
        console.log(`✅ Clean documents: ${results.totalDocuments - results.documentsWithRateDetails}`);
        
        if (results.examples.length > 0) {
            console.log('\n🔍 Examples of documents with rateDetails:');
            results.examples.forEach((example, index) => {
                console.log(`\n${index + 1}. Shipment ${example.shipmentID}`);
                console.log(`   Document ID: ${example.docId}`);
                console.log(`   RateDetails value: ${JSON.stringify(example.rateDetailsValue)}`);
                console.log(`   Type: ${example.rateDetailsType}`);
                console.log(`   Is empty: ${example.isEmpty}`);
            });
        }
        
        // Recommendations
        console.log('\n💡 Test Results:');
        if (results.documentsWithRateDetails === 0) {
            console.log('✅ SUCCESS: No documents found with rateDetails field');
            console.log('   The fix is working correctly!');
        } else {
            console.log(`⚠️  FOUND: ${results.documentsWithRateDetails} documents still have rateDetails field`);
            console.log('   Consider running the cleanup utility to remove these legacy fields');
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ Error testing rateDetails field:', error);
        throw error;
    }
};

/**
 * Test that charge breakdown fields are properly saved in selectedRateRef
 */
export const testChargeBreakdownStructure = async () => {
    console.log('🧪 Testing Charge Breakdown Structure');
    console.log('====================================');
    
    try {
        const shipmentsRef = collection(db, 'shipments');
        const querySnapshot = await getDocs(shipmentsRef);
        
        const results = {
            totalDocuments: 0,
            documentsWithSelectedRateRef: 0,
            documentsWithChargeBreakdown: 0,
            chargeBreakdownFields: {
                accessorialCharges: 0,
                freightCharge: 0,
                fuelCharge: 0,
                guaranteeCharge: 0,
                serviceCharges: 0
            },
            examples: []
        };
        
        for (const docSnap of querySnapshot.docs) {
            results.totalDocuments++;
            const data = docSnap.data();
            
            if (data.selectedRateRef) {
                results.documentsWithSelectedRateRef++;
                
                const rateRef = data.selectedRateRef;
                let hasChargeBreakdown = false;
                
                // Check each charge breakdown field
                if (rateRef.hasOwnProperty('accessorialCharges')) {
                    results.chargeBreakdownFields.accessorialCharges++;
                    hasChargeBreakdown = true;
                }
                if (rateRef.hasOwnProperty('freightCharge')) {
                    results.chargeBreakdownFields.freightCharge++;
                    hasChargeBreakdown = true;
                }
                if (rateRef.hasOwnProperty('fuelCharge')) {
                    results.chargeBreakdownFields.fuelCharge++;
                    hasChargeBreakdown = true;
                }
                if (rateRef.hasOwnProperty('guaranteeCharge')) {
                    results.chargeBreakdownFields.guaranteeCharge++;
                    hasChargeBreakdown = true;
                }
                if (rateRef.hasOwnProperty('serviceCharges')) {
                    results.chargeBreakdownFields.serviceCharges++;
                    hasChargeBreakdown = true;
                }
                
                if (hasChargeBreakdown) {
                    results.documentsWithChargeBreakdown++;
                }
                
                // Collect examples for the first few documents with charge breakdown
                if (hasChargeBreakdown && results.examples.length < 5) {
                    results.examples.push({
                        shipmentID: data.shipmentID,
                        docId: docSnap.id,
                        carrier: rateRef.carrier,
                        totalCharges: rateRef.totalCharges,
                        accessorialCharges: rateRef.accessorialCharges,
                        freightCharge: rateRef.freightCharge,
                        fuelCharge: rateRef.fuelCharge,
                        guaranteeCharge: rateRef.guaranteeCharge,
                        serviceCharges: rateRef.serviceCharges
                    });
                }
            }
        }
        
        console.log('\n📊 Charge Breakdown Structure Results:');
        console.log(`📄 Total documents: ${results.totalDocuments}`);
        console.log(`📦 Documents with selectedRateRef: ${results.documentsWithSelectedRateRef}`);
        console.log(`💰 Documents with charge breakdown: ${results.documentsWithChargeBreakdown}`);
        
        console.log('\n💳 Charge Breakdown Field Coverage:');
        console.log(`   Accessorial Charges: ${results.chargeBreakdownFields.accessorialCharges}`);
        console.log(`   Freight Charge: ${results.chargeBreakdownFields.freightCharge}`);
        console.log(`   Fuel Charge: ${results.chargeBreakdownFields.fuelCharge}`);
        console.log(`   Guarantee Charge: ${results.chargeBreakdownFields.guaranteeCharge}`);
        console.log(`   Service Charges: ${results.chargeBreakdownFields.serviceCharges}`);
        
        if (results.examples.length > 0) {
            console.log('\n🔍 Examples with Charge Breakdown:');
            results.examples.forEach((example, index) => {
                console.log(`\n${index + 1}. Shipment ${example.shipmentID} (${example.carrier})`);
                console.log(`   Total: $${example.totalCharges || 0}`);
                console.log(`   Freight: $${example.freightCharge || 0}`);
                console.log(`   Fuel: $${example.fuelCharge || 0}`);
                console.log(`   Service: $${example.serviceCharges || 0}`);
                console.log(`   Accessorial: $${example.accessorialCharges || 0}`);
                console.log(`   Guarantee: $${example.guaranteeCharge || 0}`);
            });
        }
        
        // Recommendations
        console.log('\n💡 Recommendations:');
        if (results.documentsWithChargeBreakdown === 0) {
            console.log('⚠️  No documents found with charge breakdown fields');
            console.log('   This is expected for existing shipments created before this feature');
        } else {
            console.log(`✅ Found ${results.documentsWithChargeBreakdown} shipments with charge breakdown`);
        }
        
        const coveragePercentage = results.documentsWithSelectedRateRef > 0 
            ? Math.round((results.documentsWithChargeBreakdown / results.documentsWithSelectedRateRef) * 100)
            : 0;
        console.log(`📈 Charge breakdown coverage: ${coveragePercentage}% of shipments with selectedRateRef`);
        
        return results;
        
    } catch (error) {
        console.error('❌ Error testing charge breakdown structure:', error);
        throw error;
    }
};

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
    window.testConfirmationNumberStructure = testConfirmationNumberStructure;
    window.testSingleShipmentConfirmation = testSingleShipmentConfirmation;
    window.testRateDetailsNotSaved = testRateDetailsNotSaved;
    window.testChargeBreakdownStructure = testChargeBreakdownStructure;
    
    console.log('🔧 Confirmation number test functions loaded!');
    console.log('📝 Available commands:');
    console.log('  - testConfirmationNumberStructure() - Check all booked shipments');
    console.log('  - testSingleShipmentConfirmation(shipmentId) - Check specific shipment');
    console.log('  - testRateDetailsNotSaved() - Check that rateDetails is not being saved');
    console.log('  - testChargeBreakdownStructure() - Check that charge breakdown fields are properly saved');
}

export default {
    testConfirmationNumberStructure,
    testSingleShipmentConfirmation,
    testRateDetailsNotSaved,
    testChargeBreakdownStructure
}; 