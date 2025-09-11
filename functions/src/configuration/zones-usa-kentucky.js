/**
 * COMPLETE KENTUCKY SHIPPING ZONES
 * All zones covering every shipping destination in Kentucky
 */

const KENTUCKY_ZONES = [
    {
        zoneId: "KY_LOUISVILLE_JEFFERSON",
        zoneName: "Kentucky - Louisville Jefferson",
        country: "United States",
        countryCode: "US",
        stateProvince: "Kentucky",
        stateProvinceCode: "KY",
        city: "Louisville",
        cityVariations: ["Louisville", "Jeffersontown", "Louisville KY"],
        primaryPostal: "40202",
        postalCodes: ["402"],
        latitude: 38.2527,
        longitude: -85.7585,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Derby City, UPS Worldport hub, SDF airport, bourbon heritage, Kentucky Derby"
    },
    {
        zoneId: "KY_LEXINGTON_FAYETTE",
        zoneName: "Kentucky - Lexington Fayette",
        country: "United States",
        countryCode: "US",
        stateProvince: "Kentucky",
        stateProvinceCode: "KY",
        city: "Lexington",
        cityVariations: ["Lexington", "Georgetown", "Lexington KY"],
        primaryPostal: "40502",
        postalCodes: ["405"],
        latitude: 38.0406,
        longitude: -84.5037,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "Horse Capital, University of Kentucky, LEX airport, bourbon country, Bluegrass"
    },
    {
        zoneId: "KY_NORTHERN_CINCINNATI_METRO",
        zoneName: "Kentucky - Northern Cincinnati Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Kentucky",
        stateProvinceCode: "KY",
        city: "Covington",
        cityVariations: ["Covington", "Florence", "Northern Kentucky"],
        primaryPostal: "41011",
        postalCodes: ["410"],
        latitude: 39.0837,
        longitude: -84.5086,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "CVG air cargo, DHL hub, Cincinnati metro south, Ohio River, Newport"
    }
];

module.exports = { KENTUCKY_ZONES };

