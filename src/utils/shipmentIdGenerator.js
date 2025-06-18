import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Generate a short, airline-style shipment ID
 * Format: {companyId}-{shortCode}
 * Example: IC-A7X9K2
 * 
 * The short code is a 6-character alphanumeric string that's unique per company
 * Uses base-36 encoding with collision detection for uniqueness
 */

// Characters used for encoding (excludes confusing characters like 0, O, I, 1)
const ENCODING_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

/**
 * Generate a random short code
 */
const generateRandomCode = () => {
    let result = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        result += ENCODING_CHARS[Math.floor(Math.random() * ENCODING_CHARS.length)];
    }
    return result;
};

/**
 * Generate a sequential-based code with randomization
 * This approach uses the company's shipment count as a base but adds randomization
 */
const generateSequentialCode = (sequenceNumber) => {
    // Convert sequence to base-32 and pad
    let baseCode = sequenceNumber.toString(32).toUpperCase().padStart(3, '2');
    
    // Add 3 random characters for uniqueness and security
    for (let i = 0; i < 3; i++) {
        baseCode += ENCODING_CHARS[Math.floor(Math.random() * ENCODING_CHARS.length)];
    }
    
    return baseCode.substring(0, CODE_LENGTH);
};

/**
 * Check if a shipment ID already exists
 */
const checkShipmentIdExists = async (shipmentId) => {
    try {
        const shipmentsRef = collection(db, 'shipments');
        const q = query(shipmentsRef, where('shipmentID', '==', shipmentId), limit(1));
        const snapshot = await getDocs(q);
        return !snapshot.empty;
    } catch (error) {
        console.error('Error checking shipment ID existence:', error);
        return false;
    }
};

/**
 * Get the next sequence number for a company (company-wide, not customer-specific)
 */
const getNextSequenceNumber = async (companyId) => {
    try {
        const shipmentsRef = collection(db, 'shipments');
        const q = query(
            shipmentsRef,
            where('companyID', '==', companyId),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            return 1; // First shipment for this company
        }
        
        // Count all shipments for this company to get the next sequence
        const countQuery = query(
            shipmentsRef,
            where('companyID', '==', companyId)
        );
        
        const countSnapshot = await getDocs(countQuery);
        return countSnapshot.size + 1;
        
    } catch (error) {
        console.error('Error getting sequence number:', error);
        return Math.floor(Math.random() * 10000) + 1; // Fallback to random with larger range for company-wide uniqueness
    }
};

/**
 * Generate a unique shipment ID
 * @param {string} companyId - Company identifier
 * @param {object} options - Generation options
 * @returns {Promise<string>} - Unique shipment ID
 */
export const generateShipmentId = async (companyId, options = {}) => {
    const { 
        useSequential = true, // Use sequential-based codes for better distribution
        maxRetries = 15 // Increased retries for company-wide uniqueness
    } = options;
    
    if (!companyId) {
        throw new Error('Company ID is required');
    }
    
    let attempts = 0;
    
    while (attempts < maxRetries) {
        let shortCode;
        
        if (useSequential && attempts === 0) {
            // First attempt: use sequential-based code
            const sequenceNumber = await getNextSequenceNumber(companyId);
            shortCode = generateSequentialCode(sequenceNumber);
        } else {
            // Fallback or subsequent attempts: use random code
            shortCode = generateRandomCode();
        }
        
        const shipmentId = `${companyId}-${shortCode}`;
        
        // Check if this ID already exists
        const exists = await checkShipmentIdExists(shipmentId);
        
        if (!exists) {
            console.log(`Generated unique shipment ID: ${shipmentId} (attempt ${attempts + 1})`);
            return shipmentId;
        }
        
        console.warn(`Shipment ID collision detected: ${shipmentId} (attempt ${attempts + 1})`);
        attempts++;
    }
    
    // If we've exhausted retries, throw an error
    throw new Error(`Failed to generate unique shipment ID after ${maxRetries} attempts`);
};

/**
 * Validate shipment ID format
 */
export const validateShipmentId = (shipmentId) => {
    if (!shipmentId || typeof shipmentId !== 'string') {
        return false;
    }
    
    // Check format: COMPANY-CODE
    const parts = shipmentId.split('-');
    if (parts.length < 2) {
        return false;
    }
    
    // Last part should be the code (6 characters)
    const code = parts[parts.length - 1];
    if (code.length !== CODE_LENGTH) {
        return false;
    }
    
    // Code should only contain valid characters
    return [...code].every(char => ENCODING_CHARS.includes(char));
};

/**
 * Extract components from shipment ID
 */
export const parseShipmentId = (shipmentId) => {
    if (!validateShipmentId(shipmentId)) {
        return null;
    }
    
    const parts = shipmentId.split('-');
    const code = parts.pop(); // Remove and get the last part (code)
    const companyId = parts.join('-'); // Everything else is company ID
    
    return {
        companyId,
        code,
        fullId: shipmentId
    };
};

/**
 * Generate a batch of unique shipment IDs (useful for bulk operations)
 */
export const generateBatchShipmentIds = async (companyId, count, options = {}) => {
    const ids = [];
    
    for (let i = 0; i < count; i++) {
        try {
            const id = await generateShipmentId(companyId, options);
            ids.push(id);
        } catch (error) {
            console.error(`Failed to generate shipment ID ${i + 1}/${count}:`, error);
            throw error;
        }
    }
    
    return ids;
};

export default {
    generateShipmentId,
    validateShipmentId,
    parseShipmentId,
    generateBatchShipmentIds
}; 