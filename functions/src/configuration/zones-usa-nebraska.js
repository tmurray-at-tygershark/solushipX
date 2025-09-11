/**
 * COMPLETE NEBRASKA SHIPPING ZONES
 * All zones covering every shipping destination in Nebraska
 */

const NEBRASKA_ZONES = [
    {
        zoneId: "NE_OMAHA_COUNCIL_BLUFFS",
        zoneName: "Nebraska - Omaha Council Bluffs",
        country: "United States",
        countryCode: "US",
        stateProvince: "Nebraska",
        stateProvinceCode: "NE",
        city: "Omaha",
        cityVariations: ["Omaha", "Bellevue", "Council Bluffs IA"],
        primaryPostal: "68102",
        postalCodes: ["681"],
        latitude: 41.2565,
        longitude: -95.9345,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Gateway to the West, OMA airport, Union Pacific headquarters, agriculture"
    },
    {
        zoneId: "NE_LINCOLN",
        zoneName: "Nebraska - Lincoln",
        country: "United States",
        countryCode: "US",
        stateProvince: "Nebraska",
        stateProvinceCode: "NE",
        city: "Lincoln",
        cityVariations: ["Lincoln", "Lincoln NE"],
        primaryPostal: "68508",
        postalCodes: ["685"],
        latitude: 40.8136,
        longitude: -96.7026,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "State capital, University of Nebraska, LNK airport, government center, agriculture"
    },
    {
        zoneId: "NE_GRAND_ISLAND",
        zoneName: "Nebraska - Grand Island",
        country: "United States",
        countryCode: "US",
        stateProvince: "Nebraska",
        stateProvinceCode: "NE",
        city: "Grand Island",
        cityVariations: ["Grand Island", "Grand Island NE"],
        primaryPostal: "68801",
        postalCodes: ["688"],
        latitude: 40.9264,
        longitude: -98.3420,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Railroad town, GRI airport, agricultural center, Platte River"
    }
];

module.exports = { NEBRASKA_ZONES };

