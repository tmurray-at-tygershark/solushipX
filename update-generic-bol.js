const fs = require('fs');
const path = require('path');

// Read the Polaris BOL file
const polarisPath = path.join(__dirname, 'functions/src/carrier-api/polaristransportation/generateBOL.js');
const genericPath = path.join(__dirname, 'functions/src/carrier-api/generic/generateGenericBOL.js');

const polarisContent = fs.readFileSync(polarisPath, 'utf8');
const genericContent = fs.readFileSync(genericPath, 'utf8');

// Replace the layout functions in Generic BOL with Polaris layout
let updatedGeneric = genericContent;

// Replace the buildBOL function with buildExactBOLDocument
updatedGeneric = updatedGeneric.replace(
    /function buildBOL\(doc, bolData\) \{[\s\S]*?\n\}/,
    `function buildBOL(doc, bolData) {
    // Set default stroke and fill colors
    doc.strokeColor('#000000').fillColor('#000000');
    
    // Main container border (full page border) - SIZED FOR 8.5x11
    doc.lineWidth(2)
       .rect(20, 20, 572, 752) // Standard letter size with margins
       .stroke();
    
    // Header Section (Y: 20-100)
    drawExactHeader(doc, bolData);
    
    // Ship From/To Section (Y: 100-260)
    drawExactShippingSection(doc, bolData);
    
    // Third Party Billing Section (Y: 260-340)
    drawExactThirdPartySection(doc, bolData);
    
    // Special Instructions Section (Y: 340-400)
    drawExactSpecialInstructions(doc, bolData);
    
    // Freight Table Section (Y: 400-520) - ADJUSTED HEIGHT
    drawExactFreightTable(doc, bolData);
    
    // Value Declaration Section (Y: 525-565) - REPOSITIONED
    drawExactValueDeclaration(doc, bolData);
    
    // Trailer Information Section (Y: 570-620) - REPOSITIONED
    drawExactTrailerSection(doc, bolData);
    
    // Signature Section (Y: 625-725) - REPOSITIONED
    drawExactSignatureSection(doc, bolData);
    
    // Legal disclaimer at bottom (Y: 735-750) - FITS ON PAGE
    drawExactLegalDisclaimer(doc);
}`
);

// Extract the exact drawing functions from Polaris and add them to Generic
const exactFunctions = [
    'drawExactHeader',
    'drawExactShippingSection', 
    'drawExactThirdPartySection',
    'drawExactSpecialInstructions',
    'drawExactFreightTable',
    'drawExactValueDeclaration',
    'drawExactTrailerSection',
    'drawExactSignatureSection',
    'drawExactLegalDisclaimer'
];

exactFunctions.forEach(funcName => {
    const regex = new RegExp(`function ${funcName}\\([^{]*\\) \\{[\\s\\S]*?\\n\\}`, 'g');
    const match = polarisContent.match(regex);
    if (match && match[0]) {
        // Replace Generic function with Polaris function
        const oldFuncRegex = new RegExp(`function ${funcName.replace('Exact', '')}\\([^{]*\\) \\{[\\s\\S]*?\\n\\}`, 'g');
        updatedGeneric = updatedGeneric.replace(oldFuncRegex, match[0]);
    }
});

// Update the metadata in storeBOLDocument to indicate Polaris layout
updatedGeneric = updatedGeneric.replace(
    /isQuickShip: true/,
    'isQuickShip: true,\n                exactPositioning: true,\n                polarisLayoutMatch: true'
);

// Write the updated file
fs.writeFileSync(genericPath, updatedGeneric);

console.log('✅ Generic BOL updated with Polaris Transportation layout!');
console.log('📄 Updated file:', genericPath);
console.log('🎨 Applied exact positioning and professional layout from Polaris BOL'); 