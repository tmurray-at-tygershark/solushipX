// Carrier list with eShipPlus sub-carriers
export const carrierOptions = [
    {
        group: 'Courier Services', carriers: [
            { id: 'canpar', name: 'Canpar Express', normalized: 'canpar' },
            { id: 'purolator', name: 'Purolator', normalized: 'purolator' },
            { id: 'fedex', name: 'FedEx', normalized: 'fedex' },
            { id: 'ups', name: 'UPS', normalized: 'ups' },
            { id: 'dhl', name: 'DHL', normalized: 'dhl' }
        ]
    },
    {
        group: 'Freight Services (eShipPlus)', carriers: [
            { id: 'eShipPlus_fedexfreight', name: 'FedEx Freight', normalized: 'fedexfreight' },
            { id: 'eShipPlus_roadrunner', name: 'Road Runner', normalized: 'roadrunner' },
            { id: 'eShipPlus_estes', name: 'ESTES', normalized: 'estes' },
            { id: 'eShipPlus_yrc', name: 'YRC Freight', normalized: 'yrc' },
            { id: 'eShipPlus_xpo', name: 'XPO Logistics', normalized: 'xpo' },
            { id: 'eShipPlus_odfl', name: 'Old Dominion', normalized: 'odfl' },
            { id: 'eShipPlus_saia', name: 'SAIA', normalized: 'saia' }
        ]
    }
];

// Helper function to get shipment carrier
export const getShipmentCarrier = (shipment, carrierData, normalizeCarrierName) => {
    // Check for eShipPlus first
    const isEShipPlus =
        carrierData[shipment.id]?.displayCarrierId === 'ESHIPPLUS' ||
        carrierData[shipment.id]?.sourceCarrierName === 'eShipPlus' ||
        shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
        shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS';

    if (isEShipPlus) {
        // For eShipPlus, return the actual carrier name
        const subCarrier = shipment.selectedRate?.carrier ||
            shipment.selectedRateRef?.carrier ||
            shipment.carrier;
        return {
            name: subCarrier || 'eShipPlus',
            isEShipPlus: true,
            normalizedName: normalizeCarrierName(subCarrier || 'eShipPlus')
        };
    }

    // For regular carriers
    const carrierName = carrierData[shipment.id]?.carrier ||
        shipment.selectedRateRef?.carrier ||
        shipment.selectedRate?.carrier ||
        shipment.carrier ||
        'N/A';

    return {
        name: carrierName,
        isEShipPlus: false,
        normalizedName: normalizeCarrierName(carrierName)
    };
}; 