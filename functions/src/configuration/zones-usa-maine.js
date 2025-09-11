/**
 * COMPLETE MAINE SHIPPING ZONES
 * All zones covering every shipping destination in Maine
 */

const MAINE_ZONES = [
    {
        zoneId: "ME_PORTLAND_SOUTH",
        zoneName: "Maine - Portland South",
        country: "United States",
        countryCode: "US",
        stateProvince: "Maine",
        stateProvinceCode: "ME",
        city: "Portland",
        cityVariations: ["Portland", "South Portland", "Biddeford", "Portland ME"],
        primaryPostal: "04101",
        postalCodes: ["041"],
        latitude: 43.6591,
        longitude: -70.2568,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Forest City, PWM airport, Old Port, lobster industry, Atlantic Ocean port"
    },
    {
        zoneId: "ME_BANGOR_CENTRAL",
        zoneName: "Maine - Bangor Central",
        country: "United States",
        countryCode: "US",
        stateProvince: "Maine",
        stateProvinceCode: "ME",
        city: "Bangor",
        cityVariations: ["Bangor", "Bangor ME"],
        primaryPostal: "04401",
        postalCodes: ["044"],
        latitude: 44.8016,
        longitude: -68.7712,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "Queen City, BGR airport, lumber heritage, Penobscot River, Stephen King"
    },
    {
        zoneId: "ME_LEWISTON_AUBURN",
        zoneName: "Maine - Lewiston Auburn",
        country: "United States",
        countryCode: "US",
        stateProvince: "Maine",
        stateProvinceCode: "ME",
        city: "Lewiston",
        cityVariations: ["Lewiston", "Auburn", "Lewiston ME"],
        primaryPostal: "04240",
        postalCodes: ["042"],
        latitude: 44.1004,
        longitude: -70.2148,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Twin cities, textile heritage, Bates College, LEW airport, Franco-American culture"
    }
];

module.exports = { MAINE_ZONES };

