/**
 * COMPLETE DELAWARE SHIPPING ZONES
 * All zones covering every shipping destination in Delaware
 */

const DELAWARE_ZONES = [
    {
        zoneId: "DE_WILMINGTON_NEW_CASTLE",
        zoneName: "Delaware - Wilmington New Castle",
        country: "United States",
        countryCode: "US",
        stateProvince: "Delaware",
        stateProvinceCode: "DE",
        city: "Wilmington",
        cityVariations: ["Wilmington", "Newark", "New Castle", "Wilmington DE"],
        primaryPostal: "19801",
        postalCodes: ["198"],
        latitude: 39.7391,
        longitude: -75.5398,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Chemical capital, DuPont heritage, I-95 mid-Atlantic corridor, corporate headquarters"
    },
    {
        zoneId: "DE_DOVER",
        zoneName: "Delaware - Dover",
        country: "United States",
        countryCode: "US",
        stateProvince: "Delaware",
        stateProvinceCode: "DE",
        city: "Dover",
        cityVariations: ["Dover", "Dover DE"],
        primaryPostal: "19901",
        postalCodes: ["199"],
        latitude: 39.1612,
        longitude: -75.5264,
        searchRadius: 12000,
        zoneType: "regional",
        notes: "State capital, Dover Air Force Base, government center, DOV airport"
    }
];

module.exports = { DELAWARE_ZONES };

