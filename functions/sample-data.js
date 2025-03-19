// Sample shipment data for testing
exports.defaultShipment = {
    shipmentInfo: {
        shipmentType: "courier",
        internationalShipment: false,
        shipperReferenceNumber: "SAMPLE001",
        bookingReferenceNumber: "REF-001",
        bookingReferenceType: "Shipment",
        shipmentBillType: "DefaultLogisticsPlus",
        shipmentDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        earliestPickupTime: "09:00",
        latestPickupTime: "17:00",
        earliestDeliveryTime: "09:00",
        latestDeliveryTime: "17:00",
        dangerousGoodsType: "none",
        signatureServiceType: "none",
        holdForPickup: false,
        saturdayDelivery: false,
        dutibleAmount: 0.00,
        dutibleCurrency: "CAD",
        numberOfPackages: 2
    },
    origin: {
        company: "Sample Shipping Co.",
        attentionName: "Shipping Manager",
        street: "123 Shipping Lane",
        street2: "Unit 1",
        postalCode: "90210",
        city: "Los Angeles",
        state: "CA",
        country: "US",
        contactName: "John Smith",
        contactPhone: "555-0123",
        contactEmail: "shipping@example.com",
        contactFax: "555-0124",
        specialInstructions: "Sample pickup instructions"
    },
    destination: {
        company: "Sample Receiving Inc.",
        attentionName: "Receiving Manager",
        street: "456 Receiving Road",
        street2: "Suite 2",
        postalCode: "M5V 2H1",
        city: "Toronto",
        state: "ON",
        country: "CA",
        contactName: "Jane Doe",
        contactPhone: "555-5678",
        contactEmail: "receiving@example.com",
        contactFax: "555-5679",
        specialInstructions: "Sample delivery instructions"
    },
    items: [
        {
            itemDescription: "Sample Product A",
            packagingType: 258, // Standard Box
            packagingQuantity: 1,
            stackable: true,
            weight: 10.00,
            height: 12,
            width: 12,
            length: 12,
            freightClass: 55,
            declaredValue: 100.00
        },
        {
            itemDescription: "Sample Product B",
            packagingType: 258, // Standard Box
            packagingQuantity: 1,
            stackable: true,
            weight: 15.00,
            height: 15,
            width: 15,
            length: 15,
            freightClass: 60,
            declaredValue: 150.00
        }
    ]
}; 