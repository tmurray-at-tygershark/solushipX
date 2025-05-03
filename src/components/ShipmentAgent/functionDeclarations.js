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
            {
                name: "getCompany",
                description: "Get information about the company",
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
            {
                name: "listShippingOrigins",
                description: "Get all shipping origins (ship from addresses) for a company",
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
            {
                name: "getCompanyCustomers",
                description: "Get all customers for a company that can be shipped to (using direct Firestore access)",
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
            {
                name: "getRatesEShipPlus",
                description: "Get shipping rates from different carriers for a specific shipment",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: {
                            type: "string",
                            description: "The ID of the company"
                        },
                        originAddress: {
                            type: "object",
                            description: "The address to ship from",
                            properties: {
                                street1: { type: "string", description: "Street address line 1" },
                                street2: { type: "string", description: "Street address line 2 (optional)" },
                                city: { type: "string", description: "City" },
                                state: { type: "string", description: "State or province" },
                                zip: { type: "string", description: "ZIP or postal code" },
                                country: { type: "string", description: "Country code (e.g., US)" },
                                company: { type: "string", description: "Company name (optional)" },
                                name: { type: "string", description: "Contact name (optional)" },
                                phone: { type: "string", description: "Phone number (optional)" },
                                email: { type: "string", description: "Email address (optional)" }
                            },
                            required: ["street1", "city", "state", "zip", "country"]
                        },
                        destinationAddress: {
                            type: "object",
                            description: "The address to ship to",
                            properties: {
                                street1: { type: "string", description: "Street address line 1" },
                                street2: { type: "string", description: "Street address line 2 (optional)" },
                                city: { type: "string", description: "City" },
                                state: { type: "string", description: "State or province" },
                                zip: { type: "string", description: "ZIP or postal code" },
                                country: { type: "string", description: "Country code (e.g., US)" },
                                company: { type: "string", description: "Company name (optional)" },
                                name: { type: "string", description: "Contact name (optional)" },
                                phone: { type: "string", description: "Phone number (optional)" },
                                email: { type: "string", description: "Email address (optional)" }
                            },
                            required: ["street1", "city", "state", "zip", "country"]
                        },
                        packages: {
                            type: "array",
                            description: "List of packages in the shipment",
                            items: {
                                type: "object",
                                properties: {
                                    weight: { type: "number", description: "Weight of the package in oz" },
                                    length: { type: "number", description: "Length of the package in inches" },
                                    width: { type: "number", description: "Width of the package in inches" },
                                    height: { type: "number", description: "Height of the package in inches" }
                                },
                                required: ["weight", "length", "width", "height"]
                            }
                        }
                    },
                    required: ["companyId", "originAddress", "destinationAddress", "packages"]
                }
            },
            {
                name: "createShipment",
                description: "Create a new shipment with selected carrier and service",
                parameters: {
                    type: "object",
                    properties: {
                        companyId: {
                            type: "string",
                            description: "The ID of the company"
                        },
                        originId: {
                            type: "string",
                            description: "The ID of the origin address"
                        },
                        customerId: {
                            type: "string",
                            description: "The ID of the customer"
                        },
                        destinationId: {
                            type: "string",
                            description: "The ID of the destination address"
                        },
                        packages: {
                            type: "array",
                            description: "List of packages in the shipment",
                            items: {
                                type: "object",
                                properties: {
                                    weight: { type: "number", description: "Weight of the package in oz" },
                                    length: { type: "number", description: "Length of the package in inches" },
                                    width: { type: "number", description: "Width of the package in inches" },
                                    height: { type: "number", description: "Height of the package in inches" }
                                },
                                required: ["weight", "length", "width", "height"]
                            }
                        },
                        serviceId: {
                            type: "string",
                            description: "The ID of the selected shipping service"
                        },
                        carrierId: {
                            type: "string",
                            description: "The ID of the selected carrier"
                        }
                    },
                    required: ["companyId", "originId", "customerId", "destinationId", "packages", "serviceId", "carrierId"]
                }
            }
        ]
    }
]; 