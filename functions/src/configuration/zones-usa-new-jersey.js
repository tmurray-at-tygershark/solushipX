/**
 * COMPLETE NEW JERSEY SHIPPING ZONES
 * All zones covering every shipping destination in New Jersey
 */

const NEW_JERSEY_ZONES = [
    {
        zoneId: "NJ_NORTH_NEWARK_ELIZABETH",
        zoneName: "New Jersey - North Newark Elizabeth",
        country: "United States",
        countryCode: "US",
        stateProvince: "New Jersey",
        stateProvinceCode: "NJ",
        city: "Newark",
        cityVariations: ["Newark", "Jersey City", "Elizabeth", "Secaucus"],
        primaryPostal: "07101",
        postalCodes: ["071", "072", "073", "070"],
        latitude: 40.7357,
        longitude: -74.1724,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Port Newark/Elizabeth, EWR airport, PATH trains, dense DC cluster"
    },
    {
        zoneId: "NJ_CENTRAL_I287_I95",
        zoneName: "New Jersey - Central I-287 I-95",
        country: "United States",
        countryCode: "US",
        stateProvince: "New Jersey",
        stateProvinceCode: "NJ",
        city: "Edison",
        cityVariations: ["Edison", "Woodbridge", "Piscataway", "Cranbury", "Monroe"],
        primaryPostal: "08817",
        postalCodes: ["088", "070"],
        latitude: 40.5187,
        longitude: -74.4121,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Mega DC footprint, Turnpike exits 8A-12, I-287 corridor, logistics capital"
    },
    {
        zoneId: "NJ_SOUTH_PHILLY_SUBURBS",
        zoneName: "New Jersey - South Philly Suburbs",
        country: "United States",
        countryCode: "US",
        stateProvince: "New Jersey",
        stateProvinceCode: "NJ",
        city: "Cherry Hill",
        cityVariations: ["Cherry Hill", "Camden", "Mt. Laurel", "South Jersey"],
        primaryPostal: "08002",
        postalCodes: ["080", "081"],
        latitude: 39.9349,
        longitude: -75.0307,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Philadelphia distribution spillover, corporate headquarters, ACY airport"
    }
];

module.exports = { NEW_JERSEY_ZONES };

