// TODO: Get the actual companyId from auth/context
// const DUMMY_COMPANY_ID = "DUMMY_COMPANY_ID_REPLACE_ME";

// Function declaration for getCompany
export const getCompanyDeclaration = {
    name: "getCompany",
    description: "Fetches details for the currently logged-in company.",
    parameters: {
        type: "object",
        properties: {
            // Assuming companyId is handled implicitly
        },
        required: []
    },
};

// Function declaration for getCompanyCustomers - now using direct Firestore access
export const getCompanyCustomersDeclaration = {
    name: "getCompanyCustomers",
    description: "Fetches a list of saved customer (destination) addresses for the company using direct Firestore access.",
    parameters: {
        type: "object",
        properties: {
            companyId: {
                type: "string",
                description: "The ID of the company"
            }
        },
        required: ["companyId"]
    },
};


// Function declaration for getRatesEShipPlus
// NOTE: This schema needs to precisely match the *expected input* of your
// getRatesEShipPlus Cloud Function, based on how it's called from Rates.jsx.
// We'll need to refine this based on the actual payload structure.
export const getRatesEShipPlusDeclaration = {
    name: "getRatesEShipPlus",
    description: "Fetches shipping rates based on the provided shipment details. Requires full origin, destination, package, and service details.",
    parameters: {
        type: "object",
        properties: {
            // --- Top Level ---
            companyId: { type: "string", description: "The ID of the company booking the shipment." },
            userId: { type: "string", description: "The ID of the user booking the shipment." },
            shipmentDate: { type: "string", description: "Shipment date (YYYY-MM-DD)." },
            isProduction: { type: "boolean", description: "Flag for production environment."},
            carrierIds: { type: "array", items: { type: "number" }, description: "List of carrier IDs to get rates for."},

            // --- Addresses (Assuming structure similar to your components) ---
            fromAddress: {
                type: "object",
                description: "Origin address details.",
                properties: {
                    companyName: { type: "string" },
                    address1: { type: "string" },
                    address2: { type: "string", nullable: true },
                    city: { type: "string" },
                    stateProvince: { type: "string" },
                    postalCode: { type: "string" },
                    countryCode: { type: "string" },
                    contactName: { type: "string" },
                    phoneNumber: { type: "string" },
                    email: { type: "string", nullable: true },
                    accountNumber: { type: "string", nullable: true },
                    instructions: { type: "string", nullable: true },
                },
                required: ["companyName", "address1", "city", "stateProvince", "postalCode", "countryCode", "contactName", "phoneNumber"]
            },
            toAddress: {
                type: "object",
                description: "Destination address details.",
                 properties: {
                    companyName: { type: "string" },
                    address1: { type: "string" },
                    address2: { type: "string", nullable: true },
                    city: { type: "string" },
                    stateProvince: { type: "string" },
                    postalCode: { type: "string" },
                    countryCode: { type: "string" },
                    contactName: { type: "string" },
                    phoneNumber: { type: "string" },
                    email: { type: "string", nullable: true },
                    accountNumber: { type: "string", nullable: true },
                    instructions: { type: "string", nullable: true },
                },
                 required: ["companyName", "address1", "city", "stateProvince", "postalCode", "countryCode", "contactName", "phoneNumber"]
            },

            // --- Items/Packages ---
            items: {
                type: "array",
                description: "List of packages in the shipment.",
                items: {
                    type: "object",
                    properties: {
                        description: { type: "string" },
                        quantity: { type: "integer" },
                        weight: { type: "number" },
                        weightUnit: { type: "string", description: "e.g., 'lb', 'kg'" },
                        length: { type: "number" },
                        width: { type: "number" },
                        height: { type: "number" },
                        dimensionUnit: { type: "string", description: "e.g., 'in', 'cm'" },
                        freightClass: { type: "string", nullable: true },
                        nmfcCode: { type: "string", nullable: true },
                        insuranceAmount: { type: "number", nullable: true },
                        isStackable: { type: "boolean", nullable: true },
                    },
                    required: ["description", "quantity", "weight", "weightUnit", "length", "width", "height", "dimensionUnit"]
                }
            },

            // --- Other Details (Based on your proposed microservices) ---
             pickupWindow: {
                 type: "object",
                 properties: {
                     earliest: { type: "string", description: "Earliest pickup time (HH:MM)" },
                     latest: { type: "string", description: "Latest pickup time (HH:MM)" }
                 },
                 required: ["earliest", "latest"]
             },
             deliveryWindow: {
                 type: "object",
                 nullable: true,
                 properties: {
                     earliest: { type: "string", description: "Earliest delivery time (HH:MM)" },
                     latest: { type: "string", description: "Latest delivery time (HH:MM)" }
                 },
                 required: ["earliest", "latest"]
             },
             bookingReferenceNumber: { type: "string", nullable: true },
             bookingReferenceNumberType: { type: "string", enum: ["Shipment", "Order"], nullable: true },
             shipmentBillType: { type: "string", enum: ["Prepaid", "Third Party", "Collect"], nullable: true },
             hazardousMaterial: { type: "boolean", nullable: true },
             signatureRequiredType: { type: "string", enum: ["none", "any", "adult"], nullable: true },

        },
        required: ["companyId", "userId", "shipmentDate", "isProduction", "carrierIds", "fromAddress", "toAddress", "items"]
    },
};


// Combine all declarations for the tool configuration
export const firebaseFunctionDeclarations = [
    getCompanyDeclaration,
    getCompanyCustomersDeclaration,
    getRatesEShipPlusDeclaration,
    // Add declarations for any other Firebase functions the agent might call
];

export const tools = [
    {
        functionDeclarations: [
            // ===== COMPANY & AUTHENTICATION =====
            {
                name: "getCompany",
                description: "Get information about the company including contact details, addresses, and settings",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: {
                            type: "string",
                            description: "The ID of the company"
                        }
                    },
                    required: ["companyId"]
                }
            },

            // ===== SHIPMENT TRACKING & STATUS =====
            {
                name: "trackShipment",
                description: "Track a shipment by shipment ID or tracking number. Returns comprehensive tracking information including status, location, and delivery estimates.",
                parameters: {
                    type: "object",
                    properties: {
                        identifier: {
                            type: "string",
                            description: "The shipment ID or tracking number to track"
                        },
                        companyId: {
                            type: "string",
                            description: "The company ID (optional, for filtering)"
                        }
                    },
                    required: ["identifier"]
                }
            },
            {
                name: "getShipmentStatus",
                description: "Get detailed status information for a specific shipment including carrier tracking data",
                parameters: {
                    type: "object",
                    properties: {
                        shipmentId: {
                            type: "string",
                            description: "The shipment ID"
                        },
                        trackingNumber: {
                            type: "string",
                            description: "The tracking number"
                        },
                        carrier: {
                            type: "string",
                            description: "The carrier name (optional)"
                        }
                    }
                }
            },

            // ===== UNIVERSAL RATE FETCHING =====
            {
                name: "getRatesUniversal",
                description: "Get shipping rates from ALL available carriers (eShip Plus, Canpar, etc.). This is the recommended function for comprehensive rate shopping.",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: {
                            type: "string",
                            description: "The company ID"
                        },
                        originAddress: {
                            type: "object",
                            description: "The pickup/origin address",
                            properties: {
                                company: { type: "string" },
                                street: { type: "string" },
                                street2: { type: "string" },
                                city: { type: "string" },
                                state: { type: "string" },
                                postalCode: { type: "string" },
                                country: { type: "string" },
                                contactName: { type: "string" },
                                contactPhone: { type: "string" },
                                contactEmail: { type: "string" }
                            },
                            required: ["street", "city", "state", "postalCode"]
                        },
                        destinationAddress: {
                            type: "object",
                            description: "The delivery/destination address",
                            properties: {
                                company: { type: "string" },
                                street: { type: "string" },
                                street2: { type: "string" },
                                city: { type: "string" },
                                state: { type: "string" },
                                postalCode: { type: "string" },
                                country: { type: "string" },
                                contactName: { type: "string" },
                                contactPhone: { type: "string" },
                                contactEmail: { type: "string" }
                            },
                            required: ["street", "city", "state", "postalCode"]
                        },
                        packages: {
                            type: "array",
                            description: "Array of packages to ship",
                            items: {
                                type: "object",
                                properties: {
                                    description: { type: "string", description: "Package description" },
                                    weight: { type: "number", description: "Weight in pounds" },
                                    length: { type: "number", description: "Length in inches" },
                                    width: { type: "number", description: "Width in inches" },
                                    height: { type: "number", description: "Height in inches" },
                                    quantity: { type: "number", description: "Number of packages" },
                                    freightClass: { type: "string", description: "Freight class" },
                                    value: { type: "number", description: "Declared value" }
                                },
                                required: ["weight", "length", "width", "height"]
                            }
                        },
                        shipmentInfo: {
                            type: "object",
                            description: "Additional shipment information",
                            properties: {
                                shipmentDate: { type: "string" },
                                earliestPickup: { type: "string" },
                                latestPickup: { type: "string" },
                                earliestDelivery: { type: "string" },
                                latestDelivery: { type: "string" },
                                hazardousGoods: { type: "boolean" },
                                signatureRequired: { type: "boolean" },
                                adultSignatureRequired: { type: "boolean" }
                            }
                        }
                    },
                    required: ["companyId", "originAddress", "destinationAddress", "packages"]
                }
            },
            {
                name: "getRatesEShipPlus",
                description: "Get rates specifically from eShip Plus (freight/LTL carrier). Use for freight shipments.",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: { type: "string" },
                        originAddress: { 
                            type: "object",
                            properties: {
                                company: { type: "string" },
                                street: { type: "string" },
                                city: { type: "string" },
                                state: { type: "string" },
                                postalCode: { type: "string" },
                                country: { type: "string" }
                            }
                        },
                        destinationAddress: { 
                            type: "object",
                            properties: {
                                company: { type: "string" },
                                street: { type: "string" },
                                city: { type: "string" },
                                state: { type: "string" },
                                postalCode: { type: "string" },
                                country: { type: "string" }
                            }
                        },
                        packages: { 
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    description: { type: "string" },
                                    weight: { type: "number" },
                                    length: { type: "number" },
                                    width: { type: "number" },
                                    height: { type: "number" },
                                    quantity: { type: "number" }
                                }
                            }
                        },
                        shipmentInfo: { type: "object" }
                    },
                    required: ["companyId", "originAddress", "destinationAddress", "packages"]
                }
            },
            {
                name: "getRatesCanpar",
                description: "Get rates specifically from Canpar (courier carrier). Use for courier/parcel shipments.",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: { type: "string" },
                        originAddress: { 
                            type: "object",
                            properties: {
                                company: { type: "string" },
                                street: { type: "string" },
                                city: { type: "string" },
                                state: { type: "string" },
                                postalCode: { type: "string" },
                                country: { type: "string" }
                            }
                        },
                        destinationAddress: { 
                            type: "object",
                            properties: {
                                company: { type: "string" },
                                street: { type: "string" },
                                city: { type: "string" },
                                state: { type: "string" },
                                postalCode: { type: "string" },
                                country: { type: "string" }
                            }
                        },
                        packages: { 
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    description: { type: "string" },
                                    weight: { type: "number" },
                                    length: { type: "number" },
                                    width: { type: "number" },
                                    height: { type: "number" },
                                    quantity: { type: "number" }
                                }
                            }
                        },
                        shipmentInfo: { type: "object" }
                    },
                    required: ["companyId", "originAddress", "destinationAddress", "packages"]
                }
            },

            // ===== CUSTOMER MANAGEMENT =====
            {
                name: "createCustomer",
                description: "Create a new customer with contact and address information",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: {
                            type: "string",
                            description: "The company ID"
                        },
                        customerData: {
                            type: "object",
                            description: "Customer information",
                            properties: {
                                companyName: { type: "string", description: "Customer company name" },
                                contactName: { type: "string", description: "Primary contact name" },
                                contactPhone: { type: "string", description: "Contact phone number" },
                                contactEmail: { type: "string", description: "Contact email address" },
                                address: {
                                    type: "object",
                                    description: "Primary address",
                                    properties: {
                                        street: { type: "string" },
                                        street2: { type: "string" },
                                        city: { type: "string" },
                                        state: { type: "string" },
                                        postalCode: { type: "string" },
                                        country: { type: "string" }
                                    },
                                    required: ["street", "city", "state", "postalCode"]
                                },
                                notes: { type: "string", description: "Additional notes about the customer" }
                            },
                            required: ["companyName", "contactName", "contactPhone", "address"]
                        }
                    },
                    required: ["companyId", "customerData"]
                }
            },
            {
                name: "createCustomerDestination",
                description: "Add a new destination address for an existing customer",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: {
                            type: "string",
                            description: "The company ID"
                        },
                        customerId: {
                            type: "string",
                            description: "The customer ID to add destination to"
                        },
                        destinationData: {
                            type: "object",
                            description: "Destination address information",
                            properties: {
                                name: { type: "string", description: "Name/label for this destination" },
                                company: { type: "string", description: "Company name at destination" },
                                contactName: { type: "string", description: "Contact person name" },
                                contactPhone: { type: "string", description: "Contact phone number" },
                                contactEmail: { type: "string", description: "Contact email address" },
                                street: { type: "string", description: "Street address" },
                                street2: { type: "string", description: "Additional address line" },
                                city: { type: "string", description: "City" },
                                state: { type: "string", description: "State/Province" },
                                postalCode: { type: "string", description: "Postal/ZIP code" },
                                country: { type: "string", description: "Country code" },
                                specialInstructions: { type: "string", description: "Delivery instructions" }
                            },
                            required: ["name", "contactName", "street", "city", "state", "postalCode"]
                        }
                    },
                    required: ["companyId", "customerId", "destinationData"]
                }
            },
            {
                name: "getCompanyCustomers",
                description: "Get all customers for a company",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: { type: "string" }
                    },
                    required: ["companyId"]
                }
            },
            {
                name: "getCompanyCustomerDestinations",
                description: "Get all destination addresses for a specific customer",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: { type: "string" },
                        customerId: { type: "string" }
                    },
                    required: ["companyId", "customerId"]
                }
            },

            // ===== SHIPPING ORIGINS MANAGEMENT =====
            {
                name: "createShippingOrigin",
                description: "Create a new shipping origin/pickup location for the company",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: {
                            type: "string",
                            description: "The company ID"
                        },
                        originData: {
                            type: "object",
                            description: "Origin address information",
                            properties: {
                                name: { type: "string", description: "Name/label for this origin location" },
                                company: { type: "string", description: "Company name at origin" },
                                contactName: { type: "string", description: "Contact person name" },
                                contactPhone: { type: "string", description: "Contact phone number" },
                                contactEmail: { type: "string", description: "Contact email address" },
                                street: { type: "string", description: "Street address" },
                                street2: { type: "string", description: "Additional address line" },
                                city: { type: "string", description: "City" },
                                state: { type: "string", description: "State/Province" },
                                postalCode: { type: "string", description: "Postal/ZIP code" },
                                country: { type: "string", description: "Country code" },
                                specialInstructions: { type: "string", description: "Pickup instructions" },
                                isDefault: { type: "boolean", description: "Set as default origin" }
                            },
                            required: ["name", "contactName", "street", "city", "state", "postalCode"]
                        }
                    },
                    required: ["companyId", "originData"]
                }
            },
            {
                name: "listShippingOrigins",
                description: "Get all shipping origins/pickup locations for a company",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: { type: "string" }
                    },
                    required: ["companyId"]
                }
            },

            // ===== SHIPMENT CREATION =====
            {
                name: "createShipment",
                description: "Create and book a new shipment with the selected rate",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: { type: "string" },
                        selectedRate: { type: "object", description: "The selected rate from rate shopping" },
                        shipmentData: {
                            type: "object",
                            description: "Complete shipment information",
                            properties: {
                                originAddress: { type: "object" },
                                destinationAddress: { type: "object" },
                                packages: { 
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            description: { type: "string" },
                                            weight: { type: "number" },
                                            length: { type: "number" },
                                            width: { type: "number" },
                                            height: { type: "number" },
                                            quantity: { type: "number" }
                                        }
                                    }
                                },
                                shipmentInfo: { type: "object" },
                                customerReference: { type: "string" },
                                specialInstructions: { type: "string" }
                            }
                        }
                    },
                    required: ["companyId", "selectedRate", "shipmentData"]
                }
            }
        ]
    }
]; 