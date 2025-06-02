const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join(__dirname, 'src/components/ShipmentDetail/ShipmentDetail.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find where the partial Documents section ends (after Labels)
const labelsEndPattern = /(\s*)\}\)\}\n(\s*)<\/Grid>\n(\s*)\)\}\n\n(\s*)\{\/\* Main Content Grid/;
const labelsEndMatch = content.match(labelsEndPattern);

if (!labelsEndMatch) {
    console.error('Could not find end of Labels section');
    process.exit(1);
}

// Find the duplicate BOL, Invoices, Other sections
const duplicateStartPattern = /(\s*)\{\/\* BOL \*\/\}\n(\s*)\{shipmentDocuments\.bol\?\.length > 0 && \(/;
const duplicateMatch = content.match(duplicateStartPattern);

if (!duplicateMatch) {
    console.error('Could not find duplicate BOL section');
    process.exit(1);
}

// Extract the duplicate sections (BOL, Invoices, Other)
const duplicateStartIndex = content.indexOf(duplicateMatch[0]);
const duplicateEndPattern = /(\s*)\}\)\}\n(\s*)<\/Grid>\n(\s*)\)\}\n(\s*)<\/Grid>\n(\s*)\)\}\n(\s*)<\/Box>\n(\s*)<\/Collapse>\n(\s*)<\/Paper>\n(\s*)<\/Grid>\n(\s*)\)\}/;

// Find the end of the duplicate sections
let searchContent = content.substring(duplicateStartIndex);
const endMatch = searchContent.match(duplicateEndPattern);

if (!endMatch) {
    console.error('Could not find end of duplicate sections');
    process.exit(1);
}

const duplicateEndIndex = duplicateStartIndex + searchContent.indexOf(endMatch[0]) + endMatch[0].length;

// Extract the BOL, Invoices, Other sections
const duplicateSections = content.substring(duplicateStartIndex, duplicateEndIndex);

// Remove the duplicate sections
content = content.substring(0, duplicateStartIndex) + content.substring(duplicateEndIndex);

// Now insert the sections in the correct place (after Labels in the Documents section)
// Find where to insert (after the Labels section ends)
const insertPattern = /(\s*)\}\)\}\n(\s*)<\/Grid>\n(\s*)\)\}\n\n(\s*)(\{\/\* Main Content Grid)/;
const insertMatch = content.match(insertPattern);

if (!insertMatch) {
    console.error('Could not find insertion point');
    process.exit(1);
}

// Extract just the BOL, Invoices, Other parts without the closing tags
const bolStart = duplicateSections.indexOf('{/* BOL */}');
const otherEnd = duplicateSections.lastIndexOf('</Grid>');
const sectionsToInsert = duplicateSections.substring(bolStart, otherEnd + 7);

// Insert the sections
const insertIndex = content.indexOf(insertMatch[0]);
const beforeInsert = content.substring(0, insertIndex);
const afterInsert = content.substring(insertIndex);

// Build the new content with proper indentation
const newContent = beforeInsert + 
    insertMatch[1] + '})}' + '\n' +
    insertMatch[2] + '</Grid>' + '\n' +
    insertMatch[3] + ')}' + '\n\n' +
    '                                                            ' + sectionsToInsert + '\n' +
    '                                                        </Grid>\n' +
    '                                                    )}\n' +
    '                                                </Box>\n' +
    '                                            </Collapse>\n' +
    '                                        </Paper>\n' +
    '                                    </Grid>\n' +
    '                                )}\n\n' +
    insertMatch[4] + insertMatch[5] +
    afterInsert.substring(insertMatch[0].length);

// Write the updated content
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully fixed Documents section'); 