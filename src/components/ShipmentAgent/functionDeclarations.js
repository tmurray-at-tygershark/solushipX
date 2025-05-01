import { Type } from "@google/generative-ai";

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

// Function declaration for getCompanyShipmentOrigins
export const getCompanyShipmentOriginsDeclaration = {
    name: "getCompanyShipmentOrigins",
    description: "Fetches a list of saved shipment origin addresses for the company.",
    parameters: {
        type: "object",
        properties: {
           // Assuming companyId is handled implicitly
        },
        required: []
    },
};

// Function declaration for getCompanyCustomers
export const getCompanyCustomersDeclaration = {
    name: "getCompanyCustomers",
    description: "Fetches a list of saved customer (destination) addresses for the company.",
    parameters: {
        type: "object",
        properties: {
            // Assuming companyId is handled implicitly
        },
        required: []
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
    getCompanyShipmentOriginsDeclaration,
    getCompanyCustomersDeclaration,
    getRatesEShipPlusDeclaration,
    // Add declarations for any other Firebase functions the agent might call
];

export const tools = [
  {
    functionDeclarations: [
      {
        name: "getCompany",
        description: "Get detailed information about the user's company. ALWAYS call this function when the user asks about company information, company name, or anything related to company details.",
        parameters: { 
          type: "object", 
          properties: {
            companyId: { 
              type: "string", 
              description: "ID of the company to get information for"
            }
          }, 
          required: ["companyId"] 
        }
      },
      {
        name: "listShippingOrigins",
        description: "List all available shipping origins/addresses for the user. ALWAYS call this function when the user asks about origins, shipping locations, shipping addresses, or where they can ship from.",
        parameters: { 
          type: "object", 
          properties: {
            companyId: { 
              type: "string", 
              description: "ID of the company to get shipping origins for"
            }
          }, 
          required: ["companyId"] 
        }
      },
      {
        name: "getCompanyCustomers",
        description: "Get a list of the company's customers. Call this when the user asks about customers, shipping destinations, or recipient addresses.",
        parameters: { 
          type: "object", 
          properties: {
            companyId: { 
              type: "string", 
              description: "ID of the company to get customers for"
            }
          }, 
          required: ["companyId"] 
        }
      },
      {
        name: "createShipment",
        description: "Create a new shipment with the specified details",
        parameters: {
          type: "object",
          properties: {
            shipFrom: {
              type: "object",
              description: "The origin address for the shipment",
              properties: {
                name: { type: "string" },
                companyName: { type: "string" },
                streetAddress: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                zipCode: { type: "string" },
                country: { type: "string" }
              }
            },
            shipTo: {
              type: "object",
              description: "The destination address for the shipment",
              properties: {
                name: { type: "string" },
                companyName: { type: "string" },
                streetAddress: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                zipCode: { type: "string" },
                country: { type: "string" }
              }
            },
            packages: {
              type: "array",
              description: "Array of packages in the shipment",
              items: {
                type: "object",
                properties: {
                  weight: { type: "number" },
                  weightUnit: { type: "string" },
                  length: { type: "number" },
                  width: { type: "number" },
                  height: { type: "number" },
                  dimensionUnit: { type: "string" }
                }
              }
            }
          },
          required: ["shipFrom", "shipTo", "packages"]
        }
      },
      {
        name: "getRates",
        description: "Get shipping rates for a shipment",
        parameters: {
          type: "object",
          properties: {
            shipmentId: { type: "string" }
          },
          required: ["shipmentId"]
        }
      }
    ]
  }
]; 