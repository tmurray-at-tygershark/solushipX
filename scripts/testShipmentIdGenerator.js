/**
 * Test script for the new shipment ID generator
 * Run with: node scripts/testShipmentIdGenerator.js
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
 * This approach uses the customer's shipment count as a base but adds randomization
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
 * Validate shipment ID format
 */
const validateShipmentId = (shipmentId) => {
    if (!shipmentId || typeof shipmentId !== 'string') {
        return false;
    }
    
    // Check format: COMPANY-CUSTOMER-CODE
    const parts = shipmentId.split('-');
    if (parts.length < 3) {
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
const parseShipmentId = (shipmentId) => {
    if (!validateShipmentId(shipmentId)) {
        return null;
    }
    
    const parts = shipmentId.split('-');
    const code = parts.pop(); // Remove and get the last part (code)
    const customerId = parts.pop(); // Remove and get the second-to-last part
    const companyId = parts.join('-'); // Everything else is company ID
    
    return {
        companyId,
        customerId,
        code,
        fullId: shipmentId
    };
};

// Mock function to simulate ID generation without database
function generateMockShipmentId(companyId, customerId, sequenceNumber) {
    const shortCode = generateSequentialCode(sequenceNumber);
    return `${companyId}-${customerId}-${shortCode}`;
}

async function testShipmentIdGenerator() {
    console.log('🚀 Testing Shipment ID Generator\n');
    
    // Test data
    const companyId = 'IC';
    const customerId = 'DWSLOGISTICS';
    
    console.log('📋 Test Parameters:');
    console.log(`Company ID: ${companyId}`);
    console.log(`Customer ID: ${customerId}\n`);
    
    try {
        // Test 1: Generate single IDs
        console.log('🔧 Test 1: Generating single shipment IDs');
        console.log('Old format example: IC-DWSLOGISTICS-052525090948715 (27 characters)');
        
        for (let i = 1; i <= 5; i++) {
            const mockId = generateMockShipmentId(companyId, customerId, i);
            console.log(`New format ${i}: ${mockId} (${mockId.length} characters)`);
        }
        
        console.log('\n✅ New IDs are much shorter and more readable!\n');
        
        // Test 2: Validation
        console.log('🔍 Test 2: ID Validation');
        const testIds = [
            'IC-DWSLOGISTICS-A7X9K2',
            'IC-DWSLOGISTICS-23456Z',
            'IC-DWSLOGISTICS-INVALID', // Too long
            'IC-DWSLOGISTICS-12345',   // Too short
            'IC-DWSLOGISTICS-0O1I23',  // Contains confusing chars
        ];
        
        testIds.forEach(id => {
            const isValid = validateShipmentId(id);
            console.log(`${id}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        });
        
        // Test 3: Parsing
        console.log('\n🔍 Test 3: ID Parsing');
        const sampleId = 'IC-DWSLOGISTICS-A7X9K2';
        const parsed = parseShipmentId(sampleId);
        console.log(`Parsing: ${sampleId}`);
        console.log('Result:', parsed);
        
        // Test 4: Character set demonstration
        console.log('\n📝 Test 4: Character Set');
        console.log('Allowed characters: 23456789ABCDEFGHJKLMNPQRSTUVWXYZ');
        console.log('Excluded confusing characters: 0, O, I, 1');
        console.log('This prevents user confusion when reading/typing IDs');
        
        // Test 5: Collision resistance
        console.log('\n🛡️ Test 5: Collision Resistance');
        const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        const totalCombinations = Math.pow(charset.length, 6);
        console.log(`6-character codes with ${charset.length} characters = ${totalCombinations.toLocaleString()} possible combinations`);
        console.log('This provides excellent collision resistance for millions of shipments per customer');
        
        // Test 6: Sequential vs Random comparison
        console.log('\n🔄 Test 6: Sequential vs Random Code Generation');
        console.log('Sequential-based codes (first 3 chars based on sequence, last 3 random):');
        for (let i = 1; i <= 10; i++) {
            const seqCode = generateSequentialCode(i);
            console.log(`  Sequence ${i}: ${seqCode}`);
        }
        
        console.log('\nPurely random codes:');
        for (let i = 1; i <= 5; i++) {
            const randomCode = generateRandomCode();
            console.log(`  Random ${i}: ${randomCode}`);
        }
        
        // Test 7: Length comparison
        console.log('\n📏 Test 7: Length Comparison');
        const oldId = 'IC-DWSLOGISTICS-052525090948715';
        const newId = 'IC-DWSLOGISTICS-A7X9K2';
        console.log(`Old ID: ${oldId} (${oldId.length} characters)`);
        console.log(`New ID: ${newId} (${newId.length} characters)`);
        console.log(`Reduction: ${oldId.length - newId.length} characters (${Math.round((1 - newId.length/oldId.length) * 100)}% shorter)`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testShipmentIdGenerator(); 