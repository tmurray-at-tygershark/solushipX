/**
 * COMPLETE INDIANA SHIPPING ZONES
 * All zones covering every shipping destination in Indiana
 */

const INDIANA_ZONES = [
    {
        zoneId: "IN_INDIANAPOLIS_METRO",
        zoneName: "Indiana - Indianapolis Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Indiana",
        stateProvinceCode: "IN",
        city: "Indianapolis",
        cityVariations: ["Indianapolis", "Plainfield", "Greenwood", "Indianapolis IN"],
        primaryPostal: "46201",
        postalCodes: ["462", "461"],
        latitude: 39.7684,
        longitude: -86.1581,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Crossroads of America, IND airport, I-70/I-65 DC cluster, FedEx hub, Indy 500"
    },
    {
        zoneId: "IN_NORTHERN_INDIANA",
        zoneName: "Indiana - Northern Indiana",
        country: "United States",
        countryCode: "US",
        stateProvince: "Indiana",
        stateProvinceCode: "IN",
        city: "South Bend",
        cityVariations: ["South Bend", "Elkhart", "Gary", "Northern Indiana"],
        primaryPostal: "46601",
        postalCodes: ["466", "465", "464"],
        latitude: 41.6764,
        longitude: -86.2520,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Notre Dame, RV manufacturing belt, steel heritage, SBN airport"
    },
    {
        zoneId: "IN_EVANSVILLE_SOUTHWEST",
        zoneName: "Indiana - Evansville Southwest",
        country: "United States",
        countryCode: "US",
        stateProvince: "Indiana",
        stateProvinceCode: "IN",
        city: "Evansville",
        cityVariations: ["Evansville", "Evansville IN"],
        primaryPostal: "47708",
        postalCodes: ["477"],
        latitude: 37.9716,
        longitude: -87.5710,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "River City, Ohio River port, University of Evansville, EVV airport"
    }
];

module.exports = { INDIANA_ZONES };

