// Helper function to check if company has any enabled carriers
export const hasEnabledCarriers = (companyData) => {
    if (!companyData?.connectedCarriers) {
        return false;
    }

    return companyData.connectedCarriers.some(carrier =>
        carrier.enabled === true && carrier.carrierID
    );
};

// Helper function to format address
export const formatAddress = (address, label = '', searchTerm = '') => {
    if (!address || typeof address !== 'object') {
        if (label) {
            console.warn(`No valid address object for ${label}:`, address);
        }
        return 'N/A';
    }
    return address;
};

// Helper function to capitalize shipment type
export const capitalizeShipmentType = (type) => {
    if (!type) return 'N/A';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

// Helper function to get country flag emoji
export const getCountryFlag = (address) => {
    if (!address || !address.country) return '';

    const country = address.country.toLowerCase();
    if (country.includes('canada') || country.includes('ca')) {
        return '🇨🇦';
    } else if (country.includes('united states') || country.includes('usa') || country.includes('us')) {
        return '🇺🇸';
    }
    return '';
};

// Helper function to format route (origin → destination)
export const formatRoute = (shipFrom, shipTo, searchTermOrigin = '', searchTermDestination = '') => {
    const formatLocation = (address) => {
        if (!address || typeof address !== 'object') {
            return { text: 'N/A', flag: '' };
        }
        // Format as "City, State/Province" for compact display
        const parts = [];
        if (address.city) parts.push(address.city);
        if (address.state || address.province) parts.push(address.state || address.province);

        return {
            text: parts.length > 0 ? parts.join(', ') : 'N/A',
            flag: getCountryFlag(address)
        };
    };

    const origin = formatLocation(shipFrom);
    const destination = formatLocation(shipTo);

    return { origin, destination };
};

// Helper function to format date and time
export const formatDateTime = (timestamp) => {
    if (!timestamp) return null;

    try {
        let date;
        
        // Handle Firestore Timestamp objects
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            date = timestamp.toDate();
        } else if (timestamp.seconds !== undefined) {
            // Handle timestamp objects with seconds (and optional nanoseconds)
            const milliseconds = timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000;
            date = new Date(milliseconds);
        } else {
            // Handle regular date strings/objects
            date = new Date(timestamp);
        }

        // Check if the date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid timestamp encountered:', timestamp);
            return null;
        }

        // Format date as MM/DD/YY
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        const formattedDate = `${month}/${day}/${year}`;

        // Format time
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        const formattedTime = timeFormatter.format(date);

        return { date: formattedDate, time: formattedTime };
    } catch (error) {
        console.warn('Error formatting timestamp:', timestamp, error);
        return null;
    }
};

// Helper function to get shipment status group using enhanced status model
export const getShipmentStatusGroup = (shipment) => {
    // Get the status and normalize it
    const status = shipment.status?.toLowerCase()?.trim();

    // Check for draft status first (highest priority)
    if (status === 'draft') {
        return 'DRAFTS';
    }

    // Fallback to legacy status mapping
    if (status === 'pending' || status === 'scheduled' || status === 'awaiting_shipment' || status === 'booked') return 'PRE_SHIPMENT';
    if (status === 'in_transit' || status === 'in transit' || status === 'picked_up' || status === 'on_route') return 'TRANSIT';
    if (status === 'delivered') return 'COMPLETED';
    if (status === 'cancelled' || status === 'canceled' || status === 'void' || status === 'voided') return 'CANCELLED';
    if (status === 'exception' || status === 'delayed' || status === 'on_hold') return 'EXCEPTIONS';

    return 'PRE_SHIPMENT'; // Default for unknown statuses
};

// Helper function to normalize carrier names for comparison
export const normalizeCarrierName = (name) => {
    if (!name) return '';
    const normalized = name.toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove special characters and spaces
        .replace(/express/g, '')    // Remove common suffixes
        .replace(/freight/g, '')
        .replace(/logistics/g, '');
    return normalized;
};

// Helper function to highlight search terms
export const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm || !text) return text;

    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts;
};

// Helper function to check if shipment is freight
export const isFreightShipment = (shipment) => {
    const shipmentType = shipment.shipmentInfo?.shipmentType || shipment.shipmentType || '';
    const carrierName = shipment.selectedRateRef?.carrier ||
        shipment.selectedRate?.carrier ||
        shipment.carrier || '';

    return shipmentType.toLowerCase().includes('freight') ||
        shipmentType.toLowerCase().includes('ltl') ||
        carrierName.toLowerCase().includes('freight') ||
        carrierName.toLowerCase().includes('ltl');
};

// Helper function to check document availability
export const checkDocumentAvailability = async (shipment, getShipmentDocumentsFunction) => {
    if (shipment.status === 'draft') {
        return { hasLabels: false, hasBOLs: false };
    }

    try {
        const documentsResult = await getShipmentDocumentsFunction({
            shipmentId: shipment.id,
            organized: true
        });

        if (!documentsResult.data || !documentsResult.data.success) {
            return { hasLabels: false, hasBOLs: false };
        }

        const documents = documentsResult.data.data;

        // Check for labels
        let hasLabels = false;
        if (documents.labels && documents.labels.length > 0) {
            hasLabels = true;
        } else {
            // Check in other documents for potential labels
            const allDocs = Object.values(documents).flat();
            const potentialLabels = allDocs.filter(doc => {
                const filename = (doc.filename || '').toLowerCase();
                const documentType = (doc.documentType || '').toLowerCase();
                const isGeneratedBOL = doc.isGeneratedBOL === true || doc.metadata?.eshipplus?.generated === true;

                // Exclude any BOL documents
                if (filename.includes('bol') ||
                    filename.includes('billoflading') ||
                    filename.includes('bill-of-lading') ||
                    documentType.includes('bol') ||
                    isGeneratedBOL) {
                    return false;
                }

                return filename.includes('label') ||
                    filename.includes('shipping') ||
                    filename.includes('ship') ||
                    filename.includes('print') ||
                    filename.includes('prolabel') ||
                    filename.includes('pro-label') ||
                    documentType.includes('label') ||
                    documentType.includes('shipping');
            });
            hasLabels = potentialLabels.length > 0;
        }

        // Check for BOLs
        const hasBOLs = documents.bol && documents.bol.length > 0;

        return { hasLabels, hasBOLs };
    } catch (error) {
        console.error('Error checking document availability:', error);
        return { hasLabels: false, hasBOLs: false };
    }
}; 