/**
 * North American Zone Population Script
 * Populates comprehensive geographic data for Zone Management system
 * 
 * Coverage:
 * - Countries: CA, US, MX
 * - States/Provinces: All 13 Canadian provinces, 50 US states, 32 Mexican states
 * - FSAs: Canadian Forward Sortation Areas (634 FSAs)
 * - ZIP3: US 3-digit ZIP codes (000-999)
 * 
 * Usage: node scripts/populateNorthAmericanZones.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    // Initialize with service account or use default credentials
    try {
        const serviceAccount = require('../serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'solushipx'
        });
    } catch (error) {
        console.log('Using default credentials...');
        admin.initializeApp({
            projectId: 'solushipx'
        });
    }
}

const db = admin.firestore();

// North American Geographic Data
const countries = [
    {
        code: 'CA',
        name: 'Canada',
        type: 'country',
        patterns: ['CA'],
        metadata: { iso3: 'CAN', continent: 'North America' }
    },
    {
        code: 'US', 
        name: 'United States',
        type: 'country',
        patterns: ['US', 'USA'],
        metadata: { iso3: 'USA', continent: 'North America' }
    },
    {
        code: 'MX',
        name: 'Mexico', 
        type: 'country',
        patterns: ['MX', 'MEX'],
        metadata: { iso3: 'MEX', continent: 'North America' }
    }
];

const canadianProvinces = [
    { code: 'AB', name: 'Alberta', country: 'CA' },
    { code: 'BC', name: 'British Columbia', country: 'CA' },
    { code: 'MB', name: 'Manitoba', country: 'CA' },
    { code: 'NB', name: 'New Brunswick', country: 'CA' },
    { code: 'NL', name: 'Newfoundland and Labrador', country: 'CA' },
    { code: 'NT', name: 'Northwest Territories', country: 'CA' },
    { code: 'NS', name: 'Nova Scotia', country: 'CA' },
    { code: 'NU', name: 'Nunavut', country: 'CA' },
    { code: 'ON', name: 'Ontario', country: 'CA' },
    { code: 'PE', name: 'Prince Edward Island', country: 'CA' },
    { code: 'QC', name: 'Quebec', country: 'CA' },
    { code: 'SK', name: 'Saskatchewan', country: 'CA' },
    { code: 'YT', name: 'Yukon', country: 'CA' }
];

const usStates = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
    { code: 'DC', name: 'District of Columbia' }
];

const mexicanStates = [
    { code: 'AGU', name: 'Aguascalientes' }, { code: 'BCN', name: 'Baja California' },
    { code: 'BCS', name: 'Baja California Sur' }, { code: 'CAM', name: 'Campeche' },
    { code: 'CHP', name: 'Chiapas' }, { code: 'CHH', name: 'Chihuahua' },
    { code: 'CMX', name: 'Ciudad de México' }, { code: 'COA', name: 'Coahuila' },
    { code: 'COL', name: 'Colima' }, { code: 'DUR', name: 'Durango' },
    { code: 'GUA', name: 'Guanajuato' }, { code: 'GRO', name: 'Guerrero' },
    { code: 'HID', name: 'Hidalgo' }, { code: 'JAL', name: 'Jalisco' },
    { code: 'MEX', name: 'México' }, { code: 'MIC', name: 'Michoacán' },
    { code: 'MOR', name: 'Morelos' }, { code: 'NAY', name: 'Nayarit' },
    { code: 'NLE', name: 'Nuevo León' }, { code: 'OAX', name: 'Oaxaca' },
    { code: 'PUE', name: 'Puebla' }, { code: 'QUE', name: 'Querétaro' },
    { code: 'ROO', name: 'Quintana Roo' }, { code: 'SLP', name: 'San Luis Potosí' },
    { code: 'SIN', name: 'Sinaloa' }, { code: 'SON', name: 'Sonora' },
    { code: 'TAB', name: 'Tabasco' }, { code: 'TAM', name: 'Tamaulipas' },
    { code: 'TLA', name: 'Tlaxcala' }, { code: 'VER', name: 'Veracruz' },
    { code: 'YUC', name: 'Yucatán' }, { code: 'ZAC', name: 'Zacatecas' }
];

// Canadian FSA patterns (634 total FSAs)
const generateCanadianFSAs = () => {
    const fsas = [];
    const provinceFSAPatterns = {
        'NL': ['A0A', 'A0B', 'A0C', 'A0E', 'A0G', 'A0H', 'A0J', 'A0K', 'A0L', 'A0M', 'A0N', 'A0P', 'A1A', 'A1B', 'A1C', 'A1E', 'A1G', 'A1H', 'A1K', 'A1L', 'A1M', 'A1N', 'A1S', 'A1V', 'A1W', 'A1X', 'A1Y', 'A2A', 'A2B', 'A2H', 'A2N', 'A2V', 'A5A'],
        'PE': ['C0A', 'C0B', 'C1A', 'C1B', 'C1C', 'C1E', 'C1N'],
        'NS': ['B0E', 'B0H', 'B0J', 'B0K', 'B0L', 'B0M', 'B0N', 'B0P', 'B0R', 'B0S', 'B0T', 'B0V', 'B0W', 'B1A', 'B1B', 'B1C', 'B1E', 'B1G', 'B1H', 'B1K', 'B1L', 'B1M', 'B1N', 'B1P', 'B1R', 'B1S', 'B1T', 'B1V', 'B1W', 'B1X', 'B1Y', 'B2A', 'B2G', 'B2H', 'B2N', 'B2R', 'B2S', 'B2T', 'B2V', 'B2W', 'B2X', 'B2Y', 'B2Z', 'B3A', 'B3B', 'B3E', 'B3G', 'B3H', 'B3J', 'B3K', 'B3L', 'B3M', 'B3N', 'B3P', 'B3R', 'B3S', 'B3T', 'B3V', 'B3Z', 'B4A', 'B4B', 'B4C', 'B4E', 'B4G', 'B4H', 'B4N', 'B4P', 'B4R', 'B4V', 'B5A'],
        'NB': ['E0A', 'E0B', 'E0C', 'E0G', 'E0H', 'E0J', 'E0K', 'E0L', 'E0M', 'E0N', 'E1A', 'E1B', 'E1C', 'E1E', 'E1G', 'E1H', 'E1J', 'E1N', 'E1W', 'E1X', 'E2A', 'E2E', 'E2G', 'E2H', 'E2J', 'E2K', 'E2L', 'E2M', 'E2N', 'E2P', 'E2R', 'E2S', 'E2V', 'E3A', 'E3B', 'E3C', 'E3E', 'E3L', 'E3N', 'E3V', 'E3W', 'E3Y', 'E3Z', 'E4A', 'E4B', 'E4C', 'E4E', 'E4G', 'E4H', 'E4J', 'E4K', 'E4L', 'E4M', 'E4N', 'E4P', 'E4R', 'E4S', 'E4T', 'E4V', 'E4W', 'E4X', 'E4Y', 'E4Z', 'E5A', 'E5B', 'E5C', 'E5E', 'E5G', 'E5H', 'E5J', 'E5K', 'E5L', 'E5M', 'E5N', 'E5P', 'E5R', 'E5S', 'E5T', 'E5V', 'E6A', 'E6B', 'E6C', 'E6E', 'E6G', 'E6H', 'E6J', 'E6K', 'E7A', 'E7B', 'E7C', 'E7E', 'E7G', 'E7H', 'E7J', 'E7K', 'E7L', 'E7M', 'E7N', 'E7P', 'E8A', 'E8B', 'E8C', 'E8E', 'E8G', 'E8J', 'E8K', 'E8L', 'E8M', 'E8N', 'E8P', 'E8R', 'E8S', 'E8T', 'E9A', 'E9B', 'E9C', 'E9E', 'E9G', 'E9H'],
        'QC': ['G0A', 'G0B', 'G0C', 'G0E', 'G0G', 'G0H', 'G0J', 'G0K', 'G0L', 'G0M', 'G0N', 'G0P', 'G0R', 'G0S', 'G0T', 'G0V', 'G0W', 'G0X', 'G0Y', 'G0Z', 'G1A', 'G1B', 'G1C', 'G1E', 'G1G', 'G1H', 'G1J', 'G1K', 'G1L', 'G1M', 'G1N', 'G1P', 'G1R', 'G1S', 'G1T', 'G1V', 'G1W', 'G1X', 'G1Y', 'G2A', 'G2B', 'G2C', 'G2E', 'G2G', 'G2H', 'G2J', 'G2K', 'G2L', 'G2M', 'G2N', 'G3A', 'G3B', 'G3C', 'G3E', 'G3G', 'G3H', 'G3J', 'G3K', 'G3L', 'G3M', 'G3N', 'G3Z', 'G4A', 'G4R', 'G4S', 'G4T', 'G4V', 'G4W', 'G4X', 'G4Z', 'G5A', 'G5B', 'G5C', 'G5H', 'G5J', 'G5L', 'G5M', 'G5N', 'G5R', 'G5T', 'G5V', 'G5W', 'G5X', 'G5Y', 'G5Z', 'G6A', 'G6B', 'G6C', 'G6E', 'G6G', 'G6H', 'G6J', 'G6K', 'G6L', 'G6P', 'G6R', 'G6S', 'G6T', 'G6V', 'G6W', 'G6X', 'G6Y', 'G6Z', 'G7A', 'G7B', 'G7G', 'G7H', 'G7J', 'G7K', 'G7N', 'G7P', 'G7S', 'G7T', 'G7X', 'G7Y', 'G7Z', 'G8A', 'G8B', 'G8C', 'G8E', 'G8G', 'G8H', 'G8J', 'G8K', 'G8L', 'G8M', 'G8N', 'G8P', 'G8T', 'G8V', 'G8W', 'G8Y', 'G8Z', 'G9A', 'G9B', 'G9C', 'G9H', 'G9N', 'G9P', 'G9R', 'G9T', 'G9X', 'H0H', 'H0M', 'H1A', 'H1B', 'H1C', 'H1E', 'H1G', 'H1H', 'H1J', 'H1K', 'H1L', 'H1M', 'H1N', 'H1P', 'H1R', 'H1S', 'H1T', 'H1V', 'H1W', 'H1X', 'H1Y', 'H1Z', 'H2A', 'H2B', 'H2C', 'H2E', 'H2G', 'H2H', 'H2J', 'H2K', 'H2L', 'H2M', 'H2N', 'H2P', 'H2R', 'H2S', 'H2T', 'H2V', 'H2W', 'H2X', 'H2Y', 'H2Z', 'H3A', 'H3B', 'H3C', 'H3E', 'H3G', 'H3H', 'H3J', 'H3K', 'H3L', 'H3M', 'H3N', 'H3P', 'H3R', 'H3S', 'H3T', 'H3V', 'H3W', 'H3X', 'H3Y', 'H3Z', 'H4A', 'H4B', 'H4C', 'H4E', 'H4G', 'H4H', 'H4J', 'H4K', 'H4L', 'H4M', 'H4N', 'H4P', 'H4R', 'H4S', 'H4T', 'H4V', 'H4W', 'H4X', 'H4Y', 'H4Z', 'H5A', 'H5B', 'H7A', 'H7B', 'H7C', 'H7E', 'H7G', 'H7H', 'H7J', 'H7K', 'H7L', 'H7M', 'H7N', 'H7P', 'H7R', 'H7S', 'H7T', 'H7V', 'H7W', 'H7X', 'H7Y', 'H8N', 'H8P', 'H8R', 'H8S', 'H8T', 'H8Y', 'H8Z', 'H9A', 'H9B', 'H9C', 'H9E', 'H9G', 'H9H', 'H9J', 'H9K', 'H9P', 'H9R', 'H9S', 'H9W', 'H9X', 'J0A', 'J0B', 'J0E', 'J0G', 'J0H', 'J0J', 'J0K', 'J0L', 'J0M', 'J0N', 'J0P', 'J0R', 'J0S', 'J0T', 'J0V', 'J0W', 'J0X', 'J0Y', 'J0Z', 'J1A', 'J1E', 'J1G', 'J1H', 'J1J', 'J1K', 'J1L', 'J1M', 'J1N', 'J1R', 'J1S', 'J1T', 'J1X', 'J1Z', 'J2A', 'J2B', 'J2C', 'J2E', 'J2G', 'J2H', 'J2J', 'J2K', 'J2L', 'J2M', 'J2N', 'J2R', 'J2S', 'J2T', 'J2W', 'J2X', 'J2Y', 'J3A', 'J3B', 'J3E', 'J3G', 'J3H', 'J3L', 'J3M', 'J3N', 'J3P', 'J3R', 'J3V', 'J3X', 'J3Y', 'J4B', 'J4G', 'J4H', 'J4J', 'J4K', 'J4L', 'J4M', 'J4N', 'J4P', 'J4R', 'J4S', 'J4T', 'J4V', 'J4W', 'J4X', 'J4Y', 'J4Z', 'J5A', 'J5B', 'J5C', 'J5J', 'J5K', 'J5L', 'J5M', 'J5R', 'J5T', 'J5V', 'J5W', 'J5X', 'J5Y', 'J5Z', 'J6A', 'J6E', 'J6J', 'J6K', 'J6N', 'J6R', 'J6S', 'J6T', 'J6V', 'J6W', 'J6X', 'J6Y', 'J6Z', 'J7A', 'J7B', 'J7C', 'J7E', 'J7G', 'J7H', 'J7J', 'J7K', 'J7L', 'J7M', 'J7N', 'J7P', 'J7R', 'J7S', 'J7T', 'J7V', 'J7W', 'J7X', 'J7Y', 'J7Z', 'J8A', 'J8B', 'J8C', 'J8E', 'J8G', 'J8H', 'J8L', 'J8M', 'J8N', 'J8P', 'J8R', 'J8T', 'J8V', 'J8X', 'J8Y', 'J8Z', 'J9A', 'J9B', 'J9E', 'J9H', 'J9J', 'J9L', 'J9P', 'J9T', 'J9V', 'J9X', 'J9Y', 'J9Z'],
        'ON': ['K0A', 'K0B', 'K0C', 'K0E', 'K0G', 'K0H', 'K0J', 'K0K', 'K0L', 'K0M', 'K1A', 'K1B', 'K1C', 'K1E', 'K1G', 'K1H', 'K1J', 'K1K', 'K1L', 'K1M', 'K1N', 'K1P', 'K1R', 'K1S', 'K1T', 'K1V', 'K1W', 'K1X', 'K1Y', 'K1Z', 'K2A', 'K2B', 'K2C', 'K2E', 'K2G', 'K2H', 'K2J', 'K2K', 'K2L', 'K2M', 'K2P', 'K2R', 'K2S', 'K2T', 'K2V', 'K2W', 'K4A', 'K4B', 'K4C', 'K4K', 'K4M', 'K4P', 'K4R', 'K6A', 'K6H', 'K6J', 'K6K', 'K6T', 'K6V', 'K7A', 'K7C', 'K7G', 'K7H', 'K7K', 'K7L', 'K7M', 'K7N', 'K7P', 'K7R', 'K7S', 'K7V', 'K8A', 'K8B', 'K8H', 'K8N', 'K8P', 'K8R', 'K8V', 'K9A', 'K9H', 'K9J', 'K9K', 'K9L', 'K9V', 'L0A', 'L0B', 'L0C', 'L0E', 'L0G', 'L0H', 'L0J', 'L0K', 'L0L', 'L0M', 'L0N', 'L0P', 'L0R', 'L0S', 'L1A', 'L1B', 'L1C', 'L1E', 'L1G', 'L1H', 'L1J', 'L1K', 'L1L', 'L1M', 'L1N', 'L1P', 'L1R', 'L1S', 'L1T', 'L1V', 'L1W', 'L1X', 'L1Y', 'L1Z', 'L2A', 'L2E', 'L2G', 'L2H', 'L2J', 'L2M', 'L2N', 'L2P', 'L2R', 'L2S', 'L2T', 'L2V', 'L2W', 'L3B', 'L3C', 'L3K', 'L3M', 'L3P', 'L3R', 'L3S', 'L3T', 'L3V', 'L3W', 'L3X', 'L3Y', 'L3Z', 'L4A', 'L4B', 'L4C', 'L4E', 'L4G', 'L4H', 'L4J', 'L4K', 'L4L', 'L4M', 'L4N', 'L4P', 'L4R', 'L4S', 'L4T', 'L4V', 'L4W', 'L4X', 'L4Y', 'L4Z', 'L5A', 'L5B', 'L5C', 'L5E', 'L5G', 'L5H', 'L5J', 'L5K', 'L5L', 'L5M', 'L5N', 'L5P', 'L5R', 'L5S', 'L5T', 'L5V', 'L5W', 'L6A', 'L6B', 'L6C', 'L6E', 'L6G', 'L6H', 'L6J', 'L6K', 'L6L', 'L6M', 'L6P', 'L6R', 'L6S', 'L6T', 'L6V', 'L6W', 'L6X', 'L6Y', 'L6Z', 'L7A', 'L7B', 'L7C', 'L7E', 'L7G', 'L7J', 'L7K', 'L7L', 'L7M', 'L7N', 'L7P', 'L7R', 'L7S', 'L7T', 'L8A', 'L8B', 'L8E', 'L8G', 'L8H', 'L8J', 'L8K', 'L8L', 'L8M', 'L8N', 'L8P', 'L8R', 'L8S', 'L8T', 'L8V', 'L8W', 'L9A', 'L9B', 'L9C', 'L9G', 'L9H', 'L9K', 'L9L', 'L9M', 'L9N', 'L9P', 'L9R', 'L9S', 'L9T', 'L9V', 'L9W', 'L9X', 'L9Y', 'L9Z', 'M1B', 'M1C', 'M1E', 'M1G', 'M1H', 'M1J', 'M1K', 'M1L', 'M1M', 'M1N', 'M1P', 'M1R', 'M1S', 'M1T', 'M1V', 'M1W', 'M1X', 'M2H', 'M2J', 'M2K', 'M2L', 'M2M', 'M2N', 'M2P', 'M2R', 'M3A', 'M3B', 'M3C', 'M3H', 'M3J', 'M3K', 'M3L', 'M3M', 'M3N', 'M4A', 'M4B', 'M4C', 'M4E', 'M4G', 'M4H', 'M4J', 'M4K', 'M4L', 'M4M', 'M4N', 'M4P', 'M4R', 'M4S', 'M4T', 'M4V', 'M4W', 'M4X', 'M4Y', 'M5A', 'M5B', 'M5C', 'M5E', 'M5G', 'M5H', 'M5J', 'M5K', 'M5L', 'M5M', 'M5N', 'M5P', 'M5R', 'M5S', 'M5T', 'M5V', 'M5W', 'M5X', 'M6A', 'M6B', 'M6C', 'M6E', 'M6G', 'M6H', 'M6J', 'M6K', 'M6L', 'M6M', 'M6N', 'M6P', 'M6R', 'M6S', 'M7A', 'M7R', 'M7Y', 'M8V', 'M8W', 'M8X', 'M8Y', 'M8Z', 'M9A', 'M9B', 'M9C', 'M9L', 'M9M', 'M9N', 'M9P', 'M9R', 'M9V', 'M9W', 'N0A', 'N0B', 'N0C', 'N0E', 'N0G', 'N0H', 'N0J', 'N0K', 'N0L', 'N0M', 'N0N', 'N0P', 'N0R', 'N1A', 'N1C', 'N1E', 'N1G', 'N1H', 'N1K', 'N1L', 'N1M', 'N1P', 'N1R', 'N1S', 'N1T', 'N2A', 'N2B', 'N2C', 'N2E', 'N2G', 'N2H', 'N2J', 'N2K', 'N2L', 'N2M', 'N2N', 'N2P', 'N2R', 'N2T', 'N2V', 'N2W', 'N2X', 'N2Y', 'N2Z', 'N3A', 'N3B', 'N3C', 'N3E', 'N3H', 'N3L', 'N3N', 'N3P', 'N3R', 'N3S', 'N3T', 'N3V', 'N3W', 'N3Y', 'N4B', 'N4G', 'N4K', 'N4L', 'N4N', 'N4S', 'N4T', 'N4V', 'N4W', 'N4X', 'N4Y', 'N4Z', 'N5A', 'N5C', 'N5H', 'N5L', 'N5P', 'N5R', 'N5V', 'N5W', 'N5X', 'N5Y', 'N5Z', 'N6A', 'N6B', 'N6C', 'N6E', 'N6G', 'N6H', 'N6J', 'N6K', 'N6L', 'N6M', 'N6N', 'N6P', 'N7A', 'N7G', 'N7L', 'N7M', 'N7S', 'N7T', 'N7V', 'N7W', 'N7X', 'N8A', 'N8H', 'N8M', 'N8N', 'N8P', 'N8R', 'N8S', 'N8T', 'N8V', 'N8W', 'N8X', 'N8Y', 'N9A', 'N9B', 'N9C', 'N9E', 'N9G', 'N9H', 'N9J', 'N9K', 'N9V', 'N9Y', 'P0A', 'P0B', 'P0C', 'P0E', 'P0G', 'P0H', 'P0J', 'P0K', 'P0L', 'P0M', 'P0N', 'P0P', 'P0R', 'P0S', 'P0T', 'P0V', 'P0W', 'P0X', 'P0Y', 'P1A', 'P1B', 'P1C', 'P1H', 'P1L', 'P1P', 'P2A', 'P2B', 'P2N', 'P3A', 'P3B', 'P3C', 'P3E', 'P3G', 'P3L', 'P3N', 'P3P', 'P3Y', 'P4N', 'P4P', 'P4R', 'P5A', 'P5E', 'P5N', 'P6A', 'P6B', 'P6C', 'P7A', 'P7B', 'P7C', 'P7E', 'P7G', 'P7J', 'P7K', 'P7L', 'P8N', 'P8T', 'P9A', 'P9N'],
        'MB': ['R0A', 'R0B', 'R0C', 'R0E', 'R0G', 'R0H', 'R0J', 'R0K', 'R0L', 'R0M', 'R1A', 'R1B', 'R1C', 'R1N', 'R2A', 'R2B', 'R2C', 'R2G', 'R2H', 'R2J', 'R2K', 'R2L', 'R2M', 'R2N', 'R2P', 'R2R', 'R2V', 'R2W', 'R2X', 'R2Y', 'R3A', 'R3B', 'R3C', 'R3E', 'R3G', 'R3H', 'R3J', 'R3K', 'R3L', 'R3M', 'R3N', 'R3P', 'R3R', 'R3S', 'R3T', 'R3V', 'R3W', 'R3X', 'R3Y', 'R4A', 'R4H', 'R4J', 'R4K', 'R4L', 'R5A', 'R5G', 'R5H', 'R6M', 'R6W', 'R7A', 'R7B', 'R7C', 'R7N', 'R8A', 'R8N', 'R9A'],
        'SK': ['S0A', 'S0B', 'S0C', 'S0E', 'S0G', 'S0H', 'S0J', 'S0K', 'S0L', 'S0M', 'S0N', 'S0P', 'S2V', 'S3N', 'S4A', 'S4H', 'S4L', 'S4M', 'S4N', 'S4P', 'S4R', 'S4S', 'S4T', 'S4V', 'S4W', 'S4X', 'S4Y', 'S4Z', 'S6H', 'S6J', 'S6K', 'S6V', 'S6W', 'S6X', 'S7H', 'S7J', 'S7K', 'S7L', 'S7M', 'S7N', 'S7P', 'S7R', 'S7S', 'S7T', 'S7V', 'S7W', 'S8A', 'S9A', 'S9H', 'S9K', 'S9V', 'S9X'],
        'AB': ['T0A', 'T0B', 'T0C', 'T0E', 'T0G', 'T0H', 'T0J', 'T0K', 'T0L', 'T0M', 'T0P', 'T1A', 'T1B', 'T1C', 'T1G', 'T1H', 'T1J', 'T1K', 'T1L', 'T1M', 'T1P', 'T1R', 'T1S', 'T1V', 'T1W', 'T1X', 'T1Y', 'T2A', 'T2B', 'T2C', 'T2E', 'T2G', 'T2H', 'T2J', 'T2K', 'T2L', 'T2M', 'T2N', 'T2P', 'T2R', 'T2S', 'T2T', 'T2V', 'T2W', 'T2X', 'T2Y', 'T2Z', 'T3A', 'T3B', 'T3C', 'T3E', 'T3G', 'T3H', 'T3J', 'T3K', 'T3L', 'T3M', 'T3N', 'T3P', 'T3R', 'T3S', 'T3T', 'T3Z', 'T4A', 'T4B', 'T4C', 'T4E', 'T4G', 'T4H', 'T4J', 'T4L', 'T4M', 'T4N', 'T4P', 'T4R', 'T4S', 'T4T', 'T4V', 'T4X', 'T5A', 'T5B', 'T5C', 'T5E', 'T5G', 'T5H', 'T5J', 'T5K', 'T5L', 'T5M', 'T5N', 'T5P', 'T5R', 'T5S', 'T5T', 'T5V', 'T5W', 'T5X', 'T5Y', 'T5Z', 'T6A', 'T6B', 'T6C', 'T6E', 'T6G', 'T6H', 'T6J', 'T6K', 'T6L', 'T6M', 'T6N', 'T6P', 'T6R', 'T6S', 'T6T', 'T6V', 'T6W', 'T6X', 'T7A', 'T7E', 'T7N', 'T7P', 'T7S', 'T7V', 'T7X', 'T7Y', 'T7Z', 'T8A', 'T8B', 'T8C', 'T8E', 'T8G', 'T8H', 'T8L', 'T8N', 'T8R', 'T8S', 'T8T', 'T8V', 'T8W', 'T8X', 'T9A', 'T9C', 'T9E', 'T9G', 'T9H', 'T9J', 'T9K', 'T9M', 'T9N', 'T9S', 'T9V', 'T9W', 'T9X'],
        'BC': ['V0A', 'V0B', 'V0C', 'V0E', 'V0G', 'V0H', 'V0J', 'V0K', 'V0L', 'V0M', 'V0N', 'V0P', 'V0R', 'V0S', 'V0T', 'V0V', 'V0W', 'V0X', 'V1A', 'V1B', 'V1C', 'V1E', 'V1G', 'V1H', 'V1J', 'V1K', 'V1L', 'V1M', 'V1N', 'V1P', 'V1R', 'V1S', 'V1T', 'V1V', 'V1W', 'V1X', 'V1Y', 'V1Z', 'V2A', 'V2B', 'V2C', 'V2E', 'V2G', 'V2H', 'V2J', 'V2K', 'V2L', 'V2M', 'V2N', 'V2P', 'V2R', 'V2S', 'V2T', 'V2V', 'V2W', 'V2X', 'V2Y', 'V2Z', 'V3A', 'V3B', 'V3C', 'V3E', 'V3G', 'V3H', 'V3J', 'V3K', 'V3L', 'V3M', 'V3N', 'V3R', 'V3S', 'V3T', 'V3V', 'V3W', 'V3X', 'V3Y', 'V3Z', 'V4A', 'V4B', 'V4C', 'V4E', 'V4G', 'V4K', 'V4L', 'V4M', 'V4N', 'V4P', 'V4R', 'V4S', 'V4T', 'V4V', 'V4W', 'V4X', 'V5A', 'V5B', 'V5C', 'V5E', 'V5G', 'V5H', 'V5J', 'V5K', 'V5L', 'V5M', 'V5N', 'V5P', 'V5R', 'V5S', 'V5T', 'V5V', 'V5W', 'V5X', 'V5Y', 'V5Z', 'V6A', 'V6B', 'V6C', 'V6E', 'V6G', 'V6H', 'V6J', 'V6K', 'V6L', 'V6M', 'V6N', 'V6P', 'V6R', 'V6S', 'V6T', 'V6V', 'V6W', 'V6X', 'V6Y', 'V6Z', 'V7A', 'V7B', 'V7C', 'V7E', 'V7G', 'V7H', 'V7J', 'V7K', 'V7L', 'V7M', 'V7N', 'V7P', 'V7R', 'V7S', 'V7T', 'V7V', 'V7W', 'V7X', 'V7Y', 'V8A', 'V8B', 'V8C', 'V8G', 'V8J', 'V8K', 'V8N', 'V8P', 'V8R', 'V8S', 'V8T', 'V8V', 'V8W', 'V8X', 'V8Y', 'V8Z', 'V9A', 'V9B', 'V9C', 'V9E', 'V9G', 'V9H', 'V9J', 'V9K', 'V9L', 'V9M', 'V9N', 'V9P', 'V9R', 'V9S', 'V9T', 'V9V', 'V9W', 'V9X', 'V9Y'],
        'YT': ['Y0A', 'Y0B', 'Y1A'],
        'NT': ['X0A', 'X0B', 'X0C', 'X0E', 'X0G', 'X1A'],
        'NU': ['X0A', 'X0B', 'X0C']
    };
    
    // Generate FSAs
    Object.entries(provinceFSAPatterns).forEach(([province, patterns]) => {
        patterns.forEach(fsa => {
            fsas.push({
                code: fsa,
                name: `Canadian FSA ${fsa}`,
                type: 'fsa',
                parentRegionId: province,
                patterns: [fsa],
                metadata: { 
                    province,
                    country: 'CA',
                    region_type: 'forward_sortation_area'
                }
            });
        });
    });
    
    return fsas;
};

// US ZIP3 codes (000-999)
const generateUSZIP3s = () => {
    const zip3s = [];
    
    // ZIP3 to state mapping (representative sample)
    const zip3StateMapping = {
        // Northeast
        '010': 'MA', '011': 'MA', '012': 'MA', '013': 'MA', '014': 'MA', '015': 'MA', '016': 'MA', '017': 'MA', '018': 'MA', '019': 'MA',
        '020': 'MA', '021': 'MA', '022': 'MA', '023': 'MA', '024': 'MA', '025': 'MA', '026': 'MA', '027': 'MA',
        '030': 'NH', '031': 'NH', '032': 'NH', '033': 'NH', '034': 'NH', '035': 'NH', '036': 'NH', '037': 'NH', '038': 'NH',
        '040': 'ME', '041': 'ME', '042': 'ME', '043': 'ME', '044': 'ME', '045': 'ME', '046': 'ME', '047': 'ME', '048': 'ME', '049': 'ME',
        '050': 'VT', '051': 'VT', '052': 'VT', '053': 'VT', '054': 'VT', '056': 'VT', '057': 'VT', '058': 'VT', '059': 'VT',
        '060': 'CT', '061': 'CT', '062': 'CT', '063': 'CT', '064': 'CT', '065': 'CT', '066': 'CT', '067': 'CT', '068': 'CT', '069': 'CT',
        '070': 'NJ', '071': 'NJ', '072': 'NJ', '073': 'NJ', '074': 'NJ', '075': 'NJ', '076': 'NJ', '077': 'NJ', '078': 'NJ', '079': 'NJ',
        '080': 'NJ', '081': 'NJ', '082': 'NJ', '083': 'NJ', '084': 'NJ', '085': 'NJ', '086': 'NJ', '087': 'NJ', '088': 'NJ', '089': 'NJ',
        '100': 'NY', '101': 'NY', '102': 'NY', '103': 'NY', '104': 'NY', '105': 'NY', '106': 'NY', '107': 'NY', '108': 'NY', '109': 'NY',
        '110': 'NY', '111': 'NY', '112': 'NY', '113': 'NY', '114': 'NY', '115': 'NY', '116': 'NY', '117': 'NY', '118': 'NY', '119': 'NY',
        '120': 'NY', '121': 'NY', '122': 'NY', '123': 'NY', '124': 'NY', '125': 'NY', '126': 'NY', '127': 'NY', '128': 'NY', '129': 'NY',
        '130': 'NY', '131': 'NY', '132': 'NY', '133': 'NY', '134': 'NY', '135': 'NY', '136': 'NY', '137': 'NY', '138': 'NY', '139': 'NY',
        '140': 'NY', '141': 'NY', '142': 'NY', '143': 'NY', '144': 'NY', '145': 'NY', '146': 'NY', '147': 'NY', '148': 'NY', '149': 'NY',
        
        // Mid-Atlantic
        '150': 'PA', '151': 'PA', '152': 'PA', '153': 'PA', '154': 'PA', '155': 'PA', '156': 'PA', '157': 'PA', '158': 'PA', '159': 'PA',
        '160': 'PA', '161': 'PA', '162': 'PA', '163': 'PA', '164': 'PA', '165': 'PA', '166': 'PA', '167': 'PA', '168': 'PA', '169': 'PA',
        '170': 'PA', '171': 'PA', '172': 'PA', '173': 'PA', '174': 'PA', '175': 'PA', '176': 'PA', '177': 'PA', '178': 'PA', '179': 'PA',
        '180': 'PA', '181': 'PA', '182': 'PA', '183': 'PA', '184': 'PA', '185': 'PA', '186': 'PA', '187': 'PA', '188': 'PA', '189': 'PA',
        '190': 'PA', '191': 'PA', '192': 'PA', '193': 'PA', '194': 'PA', '195': 'PA', '196': 'PA',
        
        // DC, MD, DE
        '200': 'DC', '201': 'VA', '202': 'DC', '203': 'DC', '204': 'DC', '205': 'MD',
        '206': 'MD', '207': 'MD', '208': 'MD', '209': 'MD', '210': 'MD', '211': 'MD', '212': 'MD',
        '214': 'MD', '215': 'MD', '216': 'MD', '217': 'MD', '218': 'MD', '219': 'MD',
        '220': 'MD', '221': 'MD', '222': 'MD', '223': 'MD', '224': 'MD', '225': 'MD', '226': 'MD', '227': 'MD', '228': 'MD',
        '230': 'MD', '231': 'MD', '232': 'MD', '233': 'MD', '234': 'MD', '235': 'MD', '236': 'MD', '237': 'MD', '238': 'MD',
        '240': 'MD', '241': 'MD', '242': 'MD', '243': 'MD', '244': 'MD', '245': 'MD', '246': 'MD', '247': 'MD', '248': 'MD',
        '250': 'VA', '251': 'VA', '252': 'VA', '253': 'VA', '254': 'VA', '255': 'VA', '256': 'VA', '257': 'VA', '258': 'VA', '259': 'VA',
        '260': 'VA', '261': 'VA', '262': 'VA', '263': 'VA', '264': 'VA', '265': 'VA', '266': 'VA', '267': 'VA', '268': 'VA',
        '270': 'WV', '271': 'WV', '272': 'WV', '273': 'WV', '274': 'WV', '275': 'WV', '276': 'WV', '277': 'WV', '278': 'WV', '279': 'WV',
        '280': 'NC', '281': 'NC', '282': 'NC', '283': 'NC', '284': 'NC', '285': 'NC', '286': 'NC', '287': 'NC', '288': 'NC', '289': 'NC',
        
        // Southeast
        '290': 'SC', '291': 'SC', '292': 'SC', '293': 'SC', '294': 'SC', '295': 'SC', '296': 'SC', '297': 'SC', '298': 'SC', '299': 'SC',
        '300': 'GA', '301': 'GA', '302': 'GA', '303': 'GA', '304': 'GA', '305': 'GA', '306': 'GA', '307': 'GA', '308': 'GA', '309': 'GA',
        '310': 'GA', '311': 'GA', '312': 'GA', '313': 'GA', '314': 'GA', '315': 'GA', '316': 'GA', '317': 'GA', '318': 'GA', '319': 'GA',
        '320': 'FL', '321': 'FL', '322': 'FL', '323': 'FL', '324': 'FL', '325': 'FL', '326': 'FL', '327': 'FL', '328': 'FL', '329': 'FL',
        '330': 'FL', '331': 'FL', '332': 'FL', '333': 'FL', '334': 'FL', '335': 'FL', '336': 'FL', '337': 'FL', '338': 'FL', '339': 'FL',
        '340': 'FL', '341': 'FL', '342': 'FL', '343': 'FL', '344': 'FL', '345': 'FL', '346': 'FL', '347': 'FL',
        '350': 'AL', '351': 'AL', '352': 'AL', '353': 'AL', '354': 'AL', '355': 'AL', '356': 'AL', '357': 'AL', '358': 'AL', '359': 'AL',
        '360': 'AL', '361': 'AL', '362': 'AL', '363': 'AL', '364': 'AL', '365': 'AL', '366': 'AL', '367': 'AL', '368': 'AL', '369': 'AL',
        '370': 'TN', '371': 'TN', '372': 'TN', '373': 'TN', '374': 'TN', '375': 'TN', '376': 'TN', '377': 'TN', '378': 'TN', '379': 'TN',
        '380': 'TN', '381': 'TN', '382': 'TN', '383': 'TN', '384': 'TN', '385': 'TN',
        '390': 'MS', '391': 'MS', '392': 'MS', '393': 'MS', '394': 'MS', '395': 'MS', '396': 'MS', '397': 'MS',
        
        // Kentucky
        '400': 'KY', '401': 'KY', '402': 'KY', '403': 'KY', '404': 'KY', '405': 'KY', '406': 'KY', '407': 'KY', '408': 'KY', '409': 'KY',
        '410': 'KY', '411': 'KY', '412': 'KY', '413': 'KY', '414': 'KY', '415': 'KY', '416': 'KY', '417': 'KY', '418': 'KY', '419': 'KY',
        '420': 'KY', '421': 'KY', '422': 'KY', '423': 'KY', '424': 'KY', '425': 'KY', '426': 'KY', '427': 'KY',
        
        // Ohio
        '430': 'OH', '431': 'OH', '432': 'OH', '433': 'OH', '434': 'OH', '435': 'OH', '436': 'OH', '437': 'OH', '438': 'OH', '439': 'OH',
        '440': 'OH', '441': 'OH', '442': 'OH', '443': 'OH', '444': 'OH', '445': 'OH', '446': 'OH', '447': 'OH', '448': 'OH', '449': 'OH',
        '450': 'OH', '451': 'OH', '452': 'OH', '453': 'OH', '454': 'OH', '455': 'OH', '456': 'OH', '457': 'OH', '458': 'OH', '459': 'OH',
        
        // Indiana
        '460': 'IN', '461': 'IN', '462': 'IN', '463': 'IN', '464': 'IN', '465': 'IN', '466': 'IN', '467': 'IN', '468': 'IN', '469': 'IN',
        '470': 'IN', '471': 'IN', '472': 'IN', '473': 'IN', '474': 'IN', '475': 'IN', '476': 'IN', '477': 'IN', '478': 'IN', '479': 'IN',
        
        // Michigan
        '480': 'MI', '481': 'MI', '482': 'MI', '483': 'MI', '484': 'MI', '485': 'MI', '486': 'MI', '487': 'MI', '488': 'MI', '489': 'MI',
        '490': 'MI', '491': 'MI', '492': 'MI', '493': 'MI', '494': 'MI', '495': 'MI', '496': 'MI', '497': 'MI', '498': 'MI', '499': 'MI',
        
        // Iowa
        '500': 'IA', '501': 'IA', '502': 'IA', '503': 'IA', '504': 'IA', '505': 'IA', '506': 'IA', '507': 'IA', '508': 'IA', '509': 'IA',
        '510': 'IA', '511': 'IA', '512': 'IA', '513': 'IA', '514': 'IA', '515': 'IA', '516': 'IA', '520': 'IA', '521': 'IA', '522': 'IA',
        '523': 'IA', '524': 'IA', '525': 'IA', '526': 'IA', '527': 'IA', '528': 'IA',
        
        // Wisconsin
        '530': 'WI', '531': 'WI', '532': 'WI', '534': 'WI', '535': 'WI', '537': 'WI', '538': 'WI', '539': 'WI',
        '540': 'WI', '541': 'WI', '542': 'WI', '543': 'WI', '544': 'WI', '545': 'WI', '546': 'WI', '547': 'WI', '548': 'WI', '549': 'WI',
        
        // Minnesota  
        '550': 'MN', '551': 'MN', '553': 'MN', '554': 'MN', '555': 'MN', '556': 'MN', '557': 'MN', '558': 'MN', '559': 'MN',
        '560': 'MN', '561': 'MN', '562': 'MN', '563': 'MN', '564': 'MN', '565': 'MN', '566': 'MN', '567': 'MN',
        
        // South Dakota
        '570': 'SD', '571': 'SD', '572': 'SD', '573': 'SD', '574': 'SD', '575': 'SD', '576': 'SD', '577': 'SD',
        
        // North Dakota
        '580': 'ND', '581': 'ND', '582': 'ND', '583': 'ND', '584': 'ND', '585': 'ND', '586': 'ND', '588': 'ND',
        
        // Montana
        '590': 'MT', '591': 'MT', '592': 'MT', '593': 'MT', '594': 'MT', '595': 'MT', '596': 'MT', '597': 'MT', '598': 'MT', '599': 'MT',
        
        // Illinois
        '600': 'IL', '601': 'IL', '602': 'IL', '603': 'IL', '604': 'IL', '605': 'IL', '606': 'IL', '607': 'IL', '608': 'IL', '609': 'IL',
        '610': 'IL', '611': 'IL', '612': 'IL', '613': 'IL', '614': 'IL', '615': 'IL', '616': 'IL', '617': 'IL', '618': 'IL', '619': 'IL',
        '620': 'IL', '621': 'IL', '622': 'IL', '623': 'IL', '624': 'IL', '625': 'IL', '626': 'IL', '627': 'IL', '628': 'IL', '629': 'IL',
        
        // Missouri
        '630': 'MO', '631': 'MO', '633': 'MO', '634': 'MO', '635': 'MO', '636': 'MO', '637': 'MO', '638': 'MO', '639': 'MO',
        '640': 'MO', '641': 'MO', '644': 'MO', '645': 'MO', '646': 'MO', '647': 'MO', '648': 'MO', '649': 'MO',
        '650': 'MO', '651': 'MO', '652': 'MO', '653': 'MO', '654': 'MO', '655': 'MO', '656': 'MO', '657': 'MO', '658': 'MO',
        
        // Kansas
        '660': 'KS', '661': 'KS', '662': 'KS', '664': 'KS', '665': 'KS', '666': 'KS', '667': 'KS', '668': 'KS', '669': 'KS',
        '670': 'KS', '671': 'KS', '672': 'KS', '673': 'KS', '674': 'KS', '675': 'KS', '676': 'KS', '677': 'KS', '678': 'KS', '679': 'KS',
        
        // Nebraska
        '680': 'NE', '681': 'NE', '683': 'NE', '684': 'NE', '685': 'NE', '686': 'NE', '687': 'NE', '688': 'NE', '689': 'NE',
        '690': 'NE', '691': 'NE', '692': 'NE', '693': 'NE',
        
        // Louisiana
        '700': 'LA', '701': 'LA', '703': 'LA', '704': 'LA', '705': 'LA', '706': 'LA', '707': 'LA', '708': 'LA', '710': 'LA',
        '711': 'LA', '712': 'LA', '713': 'LA', '714': 'LA',
        
        // Arkansas
        '716': 'AR', '717': 'AR', '718': 'AR', '719': 'AR', '720': 'AR', '721': 'AR', '722': 'AR', '723': 'AR', '724': 'AR',
        '725': 'AR', '726': 'AR', '727': 'AR', '728': 'AR', '729': 'AR',
        
        // Oklahoma
        '730': 'OK', '731': 'OK', '733': 'OK', '734': 'OK', '735': 'OK', '736': 'OK', '737': 'OK', '738': 'OK', '739': 'OK',
        '740': 'OK', '741': 'OK', '743': 'OK', '744': 'OK', '745': 'OK', '746': 'OK', '747': 'OK', '748': 'OK', '749': 'OK',
        
        // Texas
        '750': 'TX', '751': 'TX', '752': 'TX', '753': 'TX', '754': 'TX', '755': 'TX', '756': 'TX', '757': 'TX', '758': 'TX', '759': 'TX',
        '760': 'TX', '761': 'TX', '762': 'TX', '763': 'TX', '764': 'TX', '765': 'TX', '766': 'TX', '767': 'TX', '768': 'TX', '769': 'TX',
        '770': 'TX', '771': 'TX', '772': 'TX', '773': 'TX', '774': 'TX', '775': 'TX', '776': 'TX', '777': 'TX', '778': 'TX', '779': 'TX',
        '780': 'TX', '781': 'TX', '782': 'TX', '783': 'TX', '784': 'TX', '785': 'TX', '786': 'TX', '787': 'TX', '788': 'TX', '789': 'TX',
        '790': 'TX', '791': 'TX', '792': 'TX', '793': 'TX', '794': 'TX', '795': 'TX', '796': 'TX', '797': 'TX', '798': 'TX', '799': 'TX',
        
        // Colorado
        '800': 'CO', '801': 'CO', '802': 'CO', '803': 'CO', '804': 'CO', '805': 'CO', '806': 'CO', '807': 'CO', '808': 'CO', '809': 'CO',
        '810': 'CO', '811': 'CO', '812': 'CO', '813': 'CO', '814': 'CO', '815': 'CO', '816': 'CO',
        
        // Wyoming
        '820': 'WY', '821': 'WY', '822': 'WY', '823': 'WY', '824': 'WY', '825': 'WY', '826': 'WY', '827': 'WY', '828': 'WY', '829': 'WY',
        '830': 'WY', '831': 'WY',
        
        // Idaho
        '832': 'ID', '833': 'ID', '834': 'ID', '835': 'ID', '836': 'ID', '837': 'ID', '838': 'ID',
        
        // Utah
        '840': 'UT', '841': 'UT', '842': 'UT', '843': 'UT', '844': 'UT', '845': 'UT', '846': 'UT', '847': 'UT',
        
        // Nevada
        '889': 'NV', '890': 'NV', '891': 'NV', '893': 'NV', '894': 'NV', '895': 'NV', '897': 'NV', '898': 'NV',
        
        // California
        '900': 'CA', '901': 'CA', '902': 'CA', '903': 'CA', '904': 'CA', '905': 'CA', '906': 'CA', '907': 'CA', '908': 'CA', '909': 'CA',
        '910': 'CA', '911': 'CA', '912': 'CA', '913': 'CA', '914': 'CA', '915': 'CA', '916': 'CA', '917': 'CA', '918': 'CA', '919': 'CA',
        '920': 'CA', '921': 'CA', '922': 'CA', '923': 'CA', '924': 'CA', '925': 'CA', '926': 'CA', '927': 'CA', '928': 'CA', '929': 'CA',
        '930': 'CA', '931': 'CA', '932': 'CA', '933': 'CA', '934': 'CA', '935': 'CA', '936': 'CA', '937': 'CA', '938': 'CA', '939': 'CA',
        '940': 'CA', '941': 'CA', '942': 'CA', '943': 'CA', '944': 'CA', '945': 'CA', '946': 'CA', '947': 'CA', '948': 'CA', '949': 'CA',
        '950': 'CA', '951': 'CA', '952': 'CA', '953': 'CA', '954': 'CA', '955': 'CA', '956': 'CA', '957': 'CA', '958': 'CA', '959': 'CA',
        '960': 'CA', '961': 'CA',
        
        // Hawaii
        '967': 'HI', '968': 'HI',
        
        // Oregon
        '970': 'OR', '971': 'OR', '972': 'OR', '973': 'OR', '974': 'OR', '975': 'OR', '976': 'OR', '977': 'OR', '978': 'OR', '979': 'OR',
        
        // Washington
        '980': 'WA', '981': 'WA', '982': 'WA', '983': 'WA', '984': 'WA', '985': 'WA', '986': 'WA', '987': 'WA', '988': 'WA', '989': 'WA',
        '990': 'WA', '991': 'WA', '992': 'WA', '993': 'WA', '994': 'WA',
        
        // Alaska
        '995': 'AK', '996': 'AK', '997': 'AK', '998': 'AK', '999': 'AK'
    };
    
    // Generate all ZIP3 codes (000-999)
    for (let i = 0; i <= 999; i++) {
        const zip3 = i.toString().padStart(3, '0');
        const state = zip3StateMapping[zip3] || 'XX'; // Default to XX for unmapped
        
        zip3s.push({
            code: zip3,
            name: `US ZIP3 ${zip3}`,
            type: 'zip3',
            parentRegionId: state,
            patterns: [zip3],
            metadata: {
                state,
                country: 'US',
                region_type: 'zip3'
            }
        });
    }
    
    return zip3s;
};

// Utility functions
const generateRegionId = (type, code) => {
    return `${type}_${code}`.toLowerCase();
};

const createRegionDocument = (regionData, parentId = null) => {
    return {
        ...regionData,
        parentRegionId: parentId,
        enabled: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system'
    };
};

// Population functions
async function populateCountries() {
    console.log('\n📍 Populating Countries...');
    const batch = db.batch();
    let count = 0;
    
    for (const country of countries) {
        const docId = generateRegionId('country', country.code);
        const countryDoc = createRegionDocument(country);
        
        batch.set(db.collection('regions').doc(docId), countryDoc);
        count++;
    }
    
    await batch.commit();
    console.log(`✅ Created ${count} countries`);
    return count;
}

async function populateStatesProvinces() {
    console.log('\n🗺️ Populating States and Provinces...');
    let batch = db.batch();
    let count = 0;
    let batchCount = 0;
    
    // Canadian Provinces
    for (const province of canadianProvinces) {
        const docId = generateRegionId('state_province', `CA_${province.code}`);
        const parentId = generateRegionId('country', 'CA');
        
        const provinceDoc = createRegionDocument({
            code: province.code,
            name: province.name,
            type: 'state_province',
            patterns: [province.code],
            metadata: { 
                country: 'CA',
                country_name: 'Canada',
                region_type: 'province'
            }
        }, parentId);
        
        batch.set(db.collection('regions').doc(docId), provinceDoc);
        count++;
        batchCount++;
        
        // Commit batch every 500 documents
        if (batchCount >= 500) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }
    
    // US States
    for (const state of usStates) {
        const docId = generateRegionId('state_province', `US_${state.code}`);
        const parentId = generateRegionId('country', 'US');
        
        const stateDoc = createRegionDocument({
            code: state.code,
            name: state.name,
            type: 'state_province',
            patterns: [state.code],
            metadata: { 
                country: 'US',
                country_name: 'United States',
                region_type: 'state'
            }
        }, parentId);
        
        batch.set(db.collection('regions').doc(docId), stateDoc);
        count++;
        batchCount++;
        
        if (batchCount >= 500) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }
    
    // Mexican States
    for (const state of mexicanStates) {
        const docId = generateRegionId('state_province', `MX_${state.code}`);
        const parentId = generateRegionId('country', 'MX');
        
        const stateDoc = createRegionDocument({
            code: state.code,
            name: state.name,
            type: 'state_province',
            patterns: [state.code],
            metadata: { 
                country: 'MX',
                country_name: 'Mexico',
                region_type: 'state'
            }
        }, parentId);
        
        batch.set(db.collection('regions').doc(docId), stateDoc);
        count++;
        batchCount++;
        
        if (batchCount >= 500) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }
    
    // Commit remaining documents
    if (batchCount > 0) {
        await batch.commit();
    }
    
    console.log(`✅ Created ${count} states/provinces (${canadianProvinces.length} provinces, ${usStates.length} US states, ${mexicanStates.length} Mexican states)`);
    return count;
}

async function populateCanadianFSAs() {
    console.log('\n🇨🇦 Populating Canadian FSAs...');
    const fsas = generateCanadianFSAs();
    let batch = db.batch();
    let count = 0;
    let batchCount = 0;
    
    for (const fsa of fsas) {
        const docId = generateRegionId('fsa', fsa.code);
        const parentId = generateRegionId('state_province', `CA_${fsa.metadata.province}`);
        
        const fsaDoc = createRegionDocument(fsa, parentId);
        
        batch.set(db.collection('regions').doc(docId), fsaDoc);
        count++;
        batchCount++;
        
        // Commit batch every 500 documents
        if (batchCount >= 500) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }
    
    // Commit remaining documents
    if (batchCount > 0) {
        await batch.commit();
    }
    
    console.log(`✅ Created ${count} Canadian FSAs`);
    return count;
}

async function populateUSZIP3s() {
    console.log('\n🇺🇸 Populating US ZIP3 codes...');
    const zip3s = generateUSZIP3s();
    let batch = db.batch();
    let count = 0;
    let batchCount = 0;
    
    for (const zip3 of zip3s) {
        const docId = generateRegionId('zip3', zip3.code);
        const parentId = generateRegionId('state_province', `US_${zip3.metadata.state}`);
        
        const zip3Doc = createRegionDocument(zip3, parentId);
        
        batch.set(db.collection('regions').doc(docId), zip3Doc);
        count++;
        batchCount++;
        
        // Commit batch every 500 documents
        if (batchCount >= 500) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }
    
    // Commit remaining documents
    if (batchCount > 0) {
        await batch.commit();
    }
    
    console.log(`✅ Created ${count} US ZIP3 codes`);
    return count;
}

async function createDefaultZoneSets() {
    console.log('\n🗂️ Creating Default Zone Sets...');
    
    const defaultZoneSets = [
        {
            name: 'North America Courier Zones',
            geography: 'NA_COURIER',
            version: 1,
            description: 'Standard courier zones covering US, Canada, and Mexico',
            zoneCount: 10,
            coverage: 'cross_border',
            serviceTypes: ['courier', 'express'],
            enabled: true,
            metadata: {
                type: 'courier',
                regions: ['US', 'CA', 'MX'],
                zone_structure: 'distance_based'
            }
        },
        {
            name: 'Canadian FSA Standard Zones',
            geography: 'CA_FSA',
            version: 1,
            description: 'Canadian Forward Sortation Area based zones',
            zoneCount: 8,
            coverage: 'national',
            serviceTypes: ['courier', 'ltl'],
            enabled: true,
            metadata: {
                type: 'fsa_based',
                regions: ['CA'],
                zone_structure: 'fsa_based'
            }
        },
        {
            name: 'US ZIP3 Standard Zones',
            geography: 'US_ZIP3',
            version: 1,
            description: 'US 3-digit ZIP code based zones',
            zoneCount: 12,
            coverage: 'national',
            serviceTypes: ['courier', 'ltl'],
            enabled: true,
            metadata: {
                type: 'zip3_based',
                regions: ['US'],
                zone_structure: 'zip3_based'
            }
        },
        {
            name: 'Cross Border Express Zones',
            geography: 'CA_US_EXPRESS',
            version: 1,
            description: 'Express delivery zones for Canada-US cross border',
            zoneCount: 6,
            coverage: 'cross_border',
            serviceTypes: ['express', 'priority'],
            enabled: true,
            metadata: {
                type: 'cross_border',
                regions: ['CA', 'US'],
                zone_structure: 'express_zones'
            }
        },
        {
            name: 'LTL Freight Zones',
            geography: 'NA_LTL',
            version: 1,
            description: 'Less-than-truckload freight zones',
            zoneCount: 15,
            coverage: 'cross_border',
            serviceTypes: ['ltl', 'freight'],
            enabled: true,
            metadata: {
                type: 'ltl_freight',
                regions: ['US', 'CA', 'MX'],
                zone_structure: 'freight_lanes'
            }
        }
    ];
    
    let count = 0;
    for (const zoneSet of defaultZoneSets) {
        const zoneSetDoc = {
            ...zoneSet,
            effectiveFrom: admin.firestore.FieldValue.serverTimestamp(),
            effectiveTo: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'system'
        };
        
        await db.collection('zoneSets').add(zoneSetDoc);
        count++;
    }
    
    console.log(`✅ Created ${count} default zone sets`);
    return count;
}

// Main population function
async function populateAllRegions() {
    console.log('🚀 Starting North American Zone Population...');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    let totalRegions = 0;
    
    try {
        // Clear existing data (optional - comment out for incremental updates)
        console.log('🗑️ Clearing existing regions...');
        const existingRegions = await db.collection('regions').get();
        const batches = [];
        let batch = db.batch();
        let batchCount = 0;
        
        existingRegions.forEach(doc => {
            batch.delete(doc.ref);
            batchCount++;
            
            if (batchCount >= 500) {
                batches.push(batch);
                batch = db.batch();
                batchCount = 0;
            }
        });
        
        if (batchCount > 0) {
            batches.push(batch);
        }
        
        for (const batch of batches) {
            await batch.commit();
        }
        
        console.log(`🗑️ Cleared ${existingRegions.size} existing regions`);
        
        // Populate regions
        totalRegions += await populateCountries();
        totalRegions += await populateStatesProvinces();
        totalRegions += await populateCanadianFSAs();
        totalRegions += await populateUSZIP3s();
        
        // Create default zone sets
        const zoneSets = await createDefaultZoneSets();
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 POPULATION COMPLETE!');
        console.log(`📊 Total Regions Created: ${totalRegions.toLocaleString()}`);
        console.log(`🗂️ Zone Sets Created: ${zoneSets}`);
        console.log(`⏱️ Duration: ${duration} seconds`);
        console.log('='.repeat(60));
        
        // Summary breakdown
        console.log('\n📋 BREAKDOWN:');
        console.log(`  🌍 Countries: ${countries.length}`);
        console.log(`  🗺️ States/Provinces: ${canadianProvinces.length + usStates.length + mexicanStates.length}`);
        console.log(`  🇨🇦 Canadian FSAs: ~634`);
        console.log(`  🇺🇸 US ZIP3 codes: 1,000`);
        console.log(`  🗂️ Zone Sets: ${zoneSets}`);
        
        return {
            success: true,
            totalRegions,
            zoneSets,
            duration
        };
        
    } catch (error) {
        console.error('❌ Population failed:', error);
        throw error;
    }
}

// Run the population script
if (require.main === module) {
    populateAllRegions()
        .then(() => {
            console.log('\n✅ Script completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Script failed:', error);
            process.exit(1);
        });
}

module.exports = {
    populateAllRegions,
    populateCountries,
    populateStatesProvinces,
    populateCanadianFSAs,
    populateUSZIP3s,
    createDefaultZoneSets
};
