// Translator for EShipPlus rate requests
// Maps frontend shipment form data to EShipPlus API request format

// Helper to format date to full ISO with local timezone offset
const formatFullTimestamp = (dateString) => { // dateString is YYYY-MM-DD
    if (!dateString) return null; 
    
    const date = new Date(dateString + 'T00:00:00');
    if (isNaN(date.getTime())) return null; 

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const milliseconds = date.getMilliseconds().toString().padStart(3, '0') + "0000";

    const timezoneOffset = -date.getTimezoneOffset();
    const offsetSign = timezoneOffset >= 0 ? '+' : '-';
    const offsetHours = Math.abs(Math.floor(timezoneOffset / 60)).toString().padStart(2, '0');
    const offsetMinutes = Math.abs(timezoneOffset % 60).toString().padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds.slice(0,7)}${offsetSign}${offsetHours}:${offsetMinutes}`;
};

export function toEShipPlusRequest(formData) {
    return {
        BookingReferenceNumber: formData.shipmentInfo?.shipperReferenceNumber || '',
        BookingReferenceNumberType: 2,
        ShipmentBillType: "DefaultLogisticsPlus",
        ShipmentDate: formatFullTimestamp(formData.shipmentInfo?.shipmentDate),
        EarliestPickup: {
            Time: formData.shipmentInfo?.pickupWindow?.earliest || '09:00',
        },
        LatestPickup: {
            Time: formData.shipmentInfo?.pickupWindow?.latest || '17:00',
        },
        EarliestDelivery: {
            Time: formData.shipmentInfo?.deliveryWindow?.earliest || '09:00',
        },
        LatestDelivery: {
            Time: formData.shipmentInfo?.deliveryWindow?.latest || '17:00',
        },
        Origin: {
            Description: formData.shipFrom?.company || formData.shipFrom?.name || '', 
            Street: formData.shipFrom?.street || '', 
            StreetExtra: formData.shipFrom?.street2 || '', 
            PostalCode: formData.shipFrom?.postalCode || formData.shipFrom?.zipPostal || '',
            City: formData.shipFrom?.city || '',
            State: formData.shipFrom?.state || '',
            Country: { Code: formData.shipFrom?.country || 'US' }, 
            Contact: formData.shipFrom?.contactName || formData.shipFrom?.attention || '', 
            Phone: formData.shipFrom?.phone || formData.shipFrom?.contactPhone || '',
            Email: formData.shipFrom?.email || formData.shipFrom?.contactEmail || '',
            SpecialInstructions: formData.shipFrom?.specialInstructions || 'none',
        },
        Destination: {
            Description: formData.shipTo?.company || formData.shipTo?.name || '', 
            Street: formData.shipTo?.street || '', 
            StreetExtra: formData.shipTo?.street2 || '', 
            PostalCode: formData.shipTo?.postalCode || formData.shipTo?.zipPostal || '',
            City: formData.shipTo?.city || '',
            State: formData.shipTo?.state || '',
            Country: { Code: formData.shipTo?.country || 'US' }, 
            Contact: formData.shipTo?.contactName || formData.shipTo?.attention || '',
            Phone: formData.shipTo?.phone || formData.shipTo?.contactPhone || '',
            Email: formData.shipTo?.email || formData.shipTo?.contactEmail || '',
            SpecialInstructions: formData.shipTo?.specialInstructions || 'none',
        },
        Items: (formData.packages || []).map(pkg => ({
            Description: pkg.itemDescription || "Package",
            Weight: parseFloat(pkg.weight) || 0,
            PackagingQuantity: parseInt(pkg.packagingQuantity) || 1,
            Height: parseFloat(pkg.height) || 0,
            Width: parseFloat(pkg.width) || 0,
            Length: parseFloat(pkg.length) || 0,
            FreightClass: { FreightClass: parseFloat(pkg.freightClass) || 50.0 },
            DeclaredValue: parseFloat(pkg.declaredValue) || 0,
            Stackable: typeof pkg.stackable === 'boolean' ? pkg.stackable : true,
        })),
        DeclineAdditionalInsuranceIfApplicable: true,
        HazardousMaterialShipment: (formData.packages || []).some(pkg => pkg.hazardous || false),
    };
} 