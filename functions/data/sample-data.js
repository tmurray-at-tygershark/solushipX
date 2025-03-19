exports.defaultShipment = {
    shipmentInfo: {
        shipperReferenceNumber: "TEST123",
        bookingReferenceNumber: "BOOK123",
        bookingReferenceType: "STANDARD",
        shipmentBillType: "PREPAID",
        shipmentType: "DOMESTIC",
        shipmentDate: new Date().toISOString().split('T')[0],
        earliestPickupTime: "09:00",
        latestPickupTime: "17:00",
        earliestDeliveryTime: "09:00",
        latestDeliveryTime: "17:00"
    },
    origin: {
        company: "Test Company",
        street: "123 Test St",
        street2: "Suite 100",
        postalCode: "12345",
        city: "Test City",
        state: "TS",
        country: "US",
        contactName: "John Doe",
        contactPhone: "555-0123",
        contactEmail: "john@test.com",
        contactFax: "555-0124",
        specialInstructions: "Call before delivery"
    },
    destination: {
        company: "Dest Company",
        street: "456 Dest St",
        street2: "Floor 2",
        postalCode: "67890",
        city: "Dest City",
        state: "DS",
        country: "US",
        contactName: "Jane Smith",
        contactPhone: "555-5678",
        contactEmail: "jane@dest.com",
        contactFax: "555-5679",
        specialInstructions: "Delivery entrance in back"
    },
    items: [
        {
            itemDescription: "Test Package",
            packagingType: "BOX",
            packagingQuantity: 1,
            stackable: true,
            weight: 10.5,
            height: 12,
            width: 12,
            length: 12,
            freightClass: "70",
            declaredValue: 100.00
        }
    ]
}; 