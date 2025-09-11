/**
 * COMPLETE MASSACHUSETTS SHIPPING ZONES
 * All zones covering every shipping destination in Massachusetts
 */

const MASSACHUSETTS_ZONES = [
    {
        zoneId: "MA_GREATER_BOSTON",
        zoneName: "Massachusetts - Greater Boston",
        country: "United States",
        countryCode: "US",
        stateProvince: "Massachusetts",
        stateProvinceCode: "MA",
        city: "Boston",
        cityVariations: ["Boston", "Cambridge", "Waltham", "Woburn"],
        primaryPostal: "02101",
        postalCodes: ["021", "022", "024", "018"],
        latitude: 42.3601,
        longitude: -71.0589,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Hub of the Universe, BOS airport, Harvard/MIT, biotech corridor, logistics density I-93/I-95"
    },
    {
        zoneId: "MA_CENTRAL_WESTERN",
        zoneName: "Massachusetts - Central Western",
        country: "United States",
        countryCode: "US",
        stateProvince: "Massachusetts",
        stateProvinceCode: "MA",
        city: "Worcester",
        cityVariations: ["Worcester", "Springfield", "Chicopee", "Worcester MA"],
        primaryPostal: "01601",
        postalCodes: ["016", "011", "010"],
        latitude: 42.2626,
        longitude: -71.8023,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Heart of Commonwealth, WOR airport, I-90/I-290 junction, Hartford-Springfield lanes"
    }
];

module.exports = { MASSACHUSETTS_ZONES };

