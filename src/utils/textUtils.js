// Text utilities for handling character encoding issues
// Specifically for fixing Quebec French characters that were double-encoded

/**
 * Fixes double-encoded UTF-8 characters commonly found in Quebec addresses
 * This addresses the QuÃ©bec -> Québec issue
 */
export const fixDoubleEncodedText = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    // Common double-encoded character mappings for French Canadian text
    const encodingFixes = {
        'Ã©': 'é',  // é (e with acute accent)
        'Ã¨': 'è',  // è (e with grave accent) 
        'Ã ': 'à',  // à (a with grave accent)
        'Ã¢': 'â',  // â (a with circumflex)
        'Ã´': 'ô',  // ô (o with circumflex)
        'Ã»': 'û',  // û (u with circumflex)
        'Ã§': 'ç',  // ç (c with cedilla)
        'Ã®': 'î',  // î (i with circumflex)
        'Ã¯': 'ï',  // ï (i with diaeresis)
        'Ã«': 'ë',  // ë (e with diaeresis)
        'Ã¹': 'ù',  // ù (u with grave accent)
        'Ãª': 'ê',  // ê (e with circumflex)
        'Ã¤': 'ä',  // ä (a with diaeresis)
        'Ã¶': 'ö',  // ö (o with diaeresis)
        'Ã¼': 'ü',  // ü (u with diaeresis)
        'À': 'À',   // À (A with grave accent)
        'É': 'É',   // É (E with acute accent)
        'Ë': 'Ë',   // Ë (E with diaeresis)
        'Ê': 'Ê',   // Ê (E with circumflex)
        'Ç': 'Ç',   // Ç (C with cedilla)
        'Ó': 'Ó',   // Ó (O with acute accent)
        'Ô': 'Ô',   // Ô (O with circumflex)
        'Û': 'Û',   // Û (U with circumflex)
        'Ù': 'Ù',   // Ù (U with grave accent)
        'Î': 'Î',   // Î (I with circumflex)
        'Ï': 'Ï',   // Ï (I with diaeresis)
        'Â': 'Â',   // Â (A with circumflex)
        'Ä': 'Ä',   // Ä (A with diaeresis)
        'Ö': 'Ö',   // Ö (O with diaeresis)
        'Ü': 'Ü'    // Ü (U with diaeresis)
    };
    
    let fixedText = text;
    
    // Apply all encoding fixes
    for (const [encoded, correct] of Object.entries(encodingFixes)) {
        fixedText = fixedText.replace(new RegExp(encoded, 'g'), correct);
    }
    
    return fixedText;
};

/**
 * Fixes encoding issues in address objects
 */
export const fixAddressEncoding = (address) => {
    if (!address || typeof address !== 'object') return address;
    
    const fixedAddress = { ...address };
    
    // Fix encoding in common address fields
    const fieldsToFix = [
        'city', 'state', 'province', 'stateProv', 'street', 'street2', 
        'address1', 'address2', 'companyName', 'company', 'name',
        'firstName', 'lastName', 'contactName', 'attention', 'nickname',
        'specialInstructions', 'country'
    ];
    
    fieldsToFix.forEach(field => {
        if (fixedAddress[field]) {
            fixedAddress[field] = fixDoubleEncodedText(fixedAddress[field]);
        }
    });
    
    return fixedAddress;
};

/**
 * Fixes encoding issues in shipment data
 */
export const fixShipmentEncoding = (shipment) => {
    if (!shipment || typeof shipment !== 'object') return shipment;
    
    const fixedShipment = { ...shipment };
    
    // Fix encoding in shipFrom and shipTo addresses
    if (fixedShipment.shipFrom) {
        fixedShipment.shipFrom = fixAddressEncoding(fixedShipment.shipFrom);
    }
    
    if (fixedShipment.shipTo) {
        fixedShipment.shipTo = fixAddressEncoding(fixedShipment.shipTo);
    }
    
    // Fix encoding in other text fields
    const fieldsToFix = [
        'description', 'specialInstructions', 'customerNotes', 'carrierNotes'
    ];
    
    fieldsToFix.forEach(field => {
        if (fixedShipment[field]) {
            fixedShipment[field] = fixDoubleEncodedText(fixedShipment[field]);
        }
    });
    
    return fixedShipment;
};

/**
 * Utility to detect if text has double-encoding issues
 */
export const hasEncodingIssues = (text) => {
    if (!text || typeof text !== 'string') return false;
    
    // Check for common double-encoded patterns
    const encodingPatterns = [
        'Ã©', 'Ã¨', 'Ã ', 'Ã¢', 'Ã´', 'Ã»', 'Ã§', 'Ã®', 'Ã¯', 'Ã«', 'Ã¹', 'Ãª'
    ];
    
    return encodingPatterns.some(pattern => text.includes(pattern));
};

export default {
    fixDoubleEncodedText,
    fixAddressEncoding,
    fixShipmentEncoding,
    hasEncodingIssues
}; 