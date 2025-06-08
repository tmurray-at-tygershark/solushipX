// Translator for Canpar rate requests
// Maps frontend shipment form data to Canpar API request format

// Helper to format date to ISO format for Canpar
const formatCanparDate = (dateString) => {
    if (!dateString) return new Date().toISOString();
    
    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return new Date().toISOString();
    
    return date.toISOString();
};

// Helper to sanitize postal codes for Canpar (remove spaces, uppercase)
const sanitizePostalCode = (postalCode) => {
    if (!postalCode) return '';
    return postalCode.replace(/\s+/g, '').toUpperCase();
};

export function toCanparRequest(formData) {
    // Ensure we have the required data
    if (!formData) {
        throw new Error('Form data is required for Canpar request');
    }

    // Transform the data to Canpar's expected format
    return {
        shipmentInfo: formData.shipmentInfo, // Pass through for signature service
        shipment: {
            shipping_date: formatCanparDate(formData.shipmentInfo?.shipmentDate),
            service_type: 1, // Default to Canpar Ground
            reference: formData.shipmentInfo?.shipperReferenceNumber || "",
            packages: (formData.packages || []).map(pkg => ({
                reported_weight: parseFloat(pkg.weight) || 1,
                length: parseFloat(pkg.length) || 10,
                width: parseFloat(pkg.width) || 10,
                height: parseFloat(pkg.height) || 10,
                declared_value: parseFloat(pkg.declaredValue) || 0
            })),
            pickup_address: {
                name: formData.shipFrom?.company || formData.shipFrom?.name || 'Shipper',
                address_line_1: formData.shipFrom?.street || '',
                address_line_2: formData.shipFrom?.street2 || '',
                city: formData.shipFrom?.city || '',
                province: formData.shipFrom?.state || '',
                country: formData.shipFrom?.country || 'CA',
                postal_code: sanitizePostalCode(formData.shipFrom?.postalCode || formData.shipFrom?.zipPostal || ''),
                phone: formData.shipFrom?.phone || formData.shipFrom?.contactPhone || '',
                residential: false
            },
            delivery_address: {
                name: formData.shipTo?.company || formData.shipTo?.name || 'Recipient',
                address_line_1: formData.shipTo?.street || '',
                address_line_2: formData.shipTo?.street2 || '',
                city: formData.shipTo?.city || '',
                province: formData.shipTo?.state || '',
                country: formData.shipTo?.country || 'CA',
                postal_code: sanitizePostalCode(formData.shipTo?.postalCode || formData.shipTo?.zipPostal || ''),
                phone: formData.shipTo?.phone || formData.shipTo?.contactPhone || '',
                residential: false
            }
        }
    };
} 