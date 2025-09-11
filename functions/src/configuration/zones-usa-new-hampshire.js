/**
 * COMPLETE NEW HAMPSHIRE SHIPPING ZONES
 * All zones covering every shipping destination in New Hampshire
 */

const NEW_HAMPSHIRE_ZONES = [
    {
        zoneId: "NH_SOUTHERN",
        zoneName: "New Hampshire - Southern",
        country: "United States",
        countryCode: "US",
        stateProvince: "New Hampshire",
        stateProvinceCode: "NH",
        city: "Nashua",
        cityVariations: ["Nashua", "Manchester", "Salem", "Southern NH"],
        primaryPostal: "03060",
        postalCodes: ["030"],
        latitude: 42.7654,
        longitude: -71.4676,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Boston spillover, tax advantages, MHT airport, tech corridor, no sales tax"
    },
    {
        zoneId: "NH_SEACOAST",
        zoneName: "New Hampshire - Seacoast",
        country: "United States",
        countryCode: "US",
        stateProvince: "New Hampshire",
        stateProvinceCode: "NH",
        city: "Portsmouth",
        cityVariations: ["Portsmouth", "Dover", "Seacoast NH"],
        primaryPostal: "03801",
        postalCodes: ["038"],
        latitude: 43.0718,
        longitude: -70.7626,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Seacoast region, PSM airport, Portsmouth Naval Shipyard, historic port"
    }
];

module.exports = { NEW_HAMPSHIRE_ZONES };

