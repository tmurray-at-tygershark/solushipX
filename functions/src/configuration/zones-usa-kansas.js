/**
 * COMPLETE KANSAS SHIPPING ZONES
 * All zones covering every shipping destination in Kansas
 */

const KANSAS_ZONES = [
    {
        zoneId: "KS_KANSAS_CITY_METRO",
        zoneName: "Kansas - Kansas City Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Kansas",
        stateProvinceCode: "KS",
        city: "Kansas City",
        cityVariations: ["Kansas City KS", "Overland Park", "Olathe", "Kansas City"],
        primaryPostal: "66101",
        postalCodes: ["661", "662"],
        latitude: 39.1142,
        longitude: -94.6275,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Bi-state metro, intermodal hub, MCI airport proximity, logistics center"
    },
    {
        zoneId: "KS_WICHITA",
        zoneName: "Kansas - Wichita",
        country: "United States",
        countryCode: "US",
        stateProvince: "Kansas",
        stateProvinceCode: "KS",
        city: "Wichita",
        cityVariations: ["Wichita", "Derby", "Wichita KS"],
        primaryPostal: "67202",
        postalCodes: ["672"],
        latitude: 37.6872,
        longitude: -97.3301,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Air Capital of the World, aircraft manufacturing, ICT airport, oil and gas, Cessna"
    },
    {
        zoneId: "KS_TOPEKA",
        zoneName: "Kansas - Topeka",
        country: "United States",
        countryCode: "US",
        stateProvince: "Kansas",
        stateProvinceCode: "KS",
        city: "Topeka",
        cityVariations: ["Topeka", "Topeka KS"],
        primaryPostal: "66601",
        postalCodes: ["666"],
        latitude: 39.0473,
        longitude: -95.6890,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "State capital, government center, TOP airport, Kansas River"
    }
];

module.exports = { KANSAS_ZONES };

