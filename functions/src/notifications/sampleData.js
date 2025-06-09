/**
 * Sample shipment data for testing email notifications
 */

const sampleShipments = {
  test_shipment_1: {
    shipmentNumber: 'SX123456789',
    companyId: 'sample_company_1',
    selectedRate: {
      displayCarrierId: 'FedEx',
      serviceName: 'FedEx Ground'
    },
    createdAt: new Date(),
    trackingNumber: 'FX123456789',
    origin: {
      city: 'Toronto',
      state: 'ON',
      country: 'Canada'
    },
    destination: {
      city: 'New York',
      state: 'NY',
      country: 'USA'
    },
    status: 'in_transit'
  },
  
  test_shipment_2: {
    shipmentNumber: 'SX987654321',
    companyId: 'sample_company_1',
    selectedRate: {
      displayCarrierId: 'UPS',
      serviceName: 'UPS Ground'
    },
    createdAt: new Date(),
    trackingNumber: 'UPS987654321',
    origin: {
      city: 'Vancouver',
      state: 'BC',
      country: 'Canada'
    },
    destination: {
      city: 'Los Angeles',
      state: 'CA',
      country: 'USA'
    },
    status: 'delivered'
  },
  
  demo_shipment: {
    shipmentNumber: 'DEMO123456',
    companyId: 'sample_company_1',
    selectedRate: {
      displayCarrierId: 'Canpar',
      serviceName: 'Canpar Ground'
    },
    createdAt: new Date(),
    trackingNumber: 'CP123456789',
    origin: {
      city: 'Montreal',
      state: 'QC',
      country: 'Canada'
    },
    destination: {
      city: 'Chicago',
      state: 'IL',
      country: 'USA'
    },
    status: 'delayed',
    estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    delayReason: 'Weather delay'
  }
};

const sampleUsers = {
  sample_company_1: [
    {
      userId: 'user1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      notifications: {
        shipment_created: true,
        shipment_delivered: true,
        shipment_delayed: true,
        status_changed: true,
        hawkeye_mode: false
      }
    },
    {
      userId: 'user2',
      email: 'manager@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      notifications: {
        shipment_created: false,
        shipment_delivered: true,
        shipment_delayed: true,
        status_changed: false,
        hawkeye_mode: true // This user gets all notifications
      }
    }
  ]
};

module.exports = {
  sampleShipments,
  sampleUsers
}; 