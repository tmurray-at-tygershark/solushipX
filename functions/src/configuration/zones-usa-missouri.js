/**
 * COMPLETE MISSOURI SHIPPING ZONES
 * All zones covering every shipping destination in Missouri
 */

const MISSOURI_ZONES = [
    {
        zoneId: "MO_ST_LOUIS_BI_STATE",
        zoneName: "Missouri - St. Louis Bi-State",
        country: "United States",
        countryCode: "US",
        stateProvince: "Missouri",
        stateProvinceCode: "MO",
        city: "St. Louis",
        cityVariations: ["St. Louis", "Saint Louis", "St. Charles", "St. Louis MO"],
        primaryPostal: "63101",
        postalCodes: ["631"],
        latitude: 38.6270,
        longitude: -90.1994,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Gateway City, Mississippi/Missouri confluence, STL airport, intermodal hub, Arch"
    },
    {
        zoneId: "MO_KANSAS_CITY_METRO",
        zoneName: "Missouri - Kansas City Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Missouri",
        stateProvinceCode: "MO",
        city: "Kansas City",
        cityVariations: ["Kansas City MO", "Independence", "Kansas City"],
        primaryPostal: "64108",
        postalCodes: ["641"],
        latitude: 39.0997,
        longitude: -94.5786,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Heart of America, MCI airport, intermodal hub, barbecue capital, jazz heritage"
    },
    {
        zoneId: "MO_SPRINGFIELD_SOUTHWEST",
        zoneName: "Missouri - Springfield Southwest",
        country: "United States",
        countryCode: "US",
        stateProvince: "Missouri",
        stateProvinceCode: "MO",
        city: "Springfield",
        cityVariations: ["Springfield", "Joplin", "Springfield MO"],
        primaryPostal: "65801",
        postalCodes: ["658", "648"],
        latitude: 37.2153,
        longitude: -93.2982,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Queen City of the Ozarks, SGF airport, Missouri State University, Route 66"
    }
];

module.exports = { MISSOURI_ZONES };

