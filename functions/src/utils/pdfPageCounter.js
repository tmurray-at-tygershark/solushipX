const pdfParse = require('pdf-parse');

/**
 * Count the number of pages in a PDF buffer
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<number>} - Number of pages in the PDF
 */
async function countPdfPages(pdfBuffer) {
    try {
        // Use pdf-parse to extract basic info without processing content
        const data = await pdfParse(pdfBuffer, {
            max: 0, // Don't extract text content, just metadata
            version: 'v1.10.100', // Use stable version
            pagerender: null // Don't render pages
        });
        
        console.log(`PDF page count: ${data.numpages}`);
        return data.numpages;
    } catch (error) {
        console.error('Error counting PDF pages:', error);
        // Return null to indicate counting failed, not 0 pages
        return null;
    }
}

/**
 * Get PDF metadata including page count and basic info
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<Object>} - PDF metadata object
 */
async function getPdfMetadata(pdfBuffer) {
    try {
        const data = await pdfParse(pdfBuffer, {
            max: 0, // Don't extract text content
            version: 'v1.10.100',
            pagerender: null
        });
        
        return {
            pageCount: data.numpages,
            title: data.info?.Title || null,
            author: data.info?.Author || null,
            creator: data.info?.Creator || null,
            producer: data.info?.Producer || null,
            creationDate: data.info?.CreationDate || null,
            modificationDate: data.info?.ModDate || null,
            version: data.version || null
        };
    } catch (error) {
        console.error('Error extracting PDF metadata:', error);
        return {
            pageCount: null,
            error: error.message
        };
    }
}

module.exports = {
    countPdfPages,
    getPdfMetadata
}; 