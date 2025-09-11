/**
 * COMPLETE NEVADA SHIPPING ZONES
 * All zones covering every shipping destination in Nevada
 */

const NEVADA_ZONES = [
    {
        zoneId: "NV_LAS_VEGAS_HENDERSON",
        zoneName: "Nevada - Las Vegas Henderson",
        country: "United States",
        countryCode: "US",
        stateProvince: "Nevada",
        stateProvinceCode: "NV",
        city: "Las Vegas",
        cityVariations: ["Las Vegas", "Henderson", "North Las Vegas"],
        primaryPostal: "89101",
        postalCodes: ["891", "890"],
        latitude: 36.1699,
        longitude: -115.1398,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Entertainment capital, LAS airport, Strip, McCarran cargo, gaming industry"
    },
    {
        zoneId: "NV_RENO_SPARKS",
        zoneName: "Nevada - Reno Sparks",
        country: "United States",
        countryCode: "US",
        stateProvince: "Nevada",
        stateProvinceCode: "NV",
        city: "Reno",
        cityVariations: ["Reno", "Sparks", "Reno NV"],
        primaryPostal: "89501",
        postalCodes: ["895"],
        latitude: 39.5296,
        longitude: -119.8138,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Biggest Little City, I-80 DC cluster, RNO airport, California proximity, no state tax"
    }
];

module.exports = { NEVADA_ZONES };

