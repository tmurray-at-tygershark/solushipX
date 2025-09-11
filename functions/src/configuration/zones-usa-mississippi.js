/**
 * COMPLETE MISSISSIPPI SHIPPING ZONES
 * All zones covering every shipping destination in Mississippi
 */

const MISSISSIPPI_ZONES = [
    {
        zoneId: "MS_JACKSON",
        zoneName: "Mississippi - Jackson",
        country: "United States",
        countryCode: "US",
        stateProvince: "Mississippi",
        stateProvinceCode: "MS",
        city: "Jackson",
        cityVariations: ["Jackson", "Pearl", "Jackson MS"],
        primaryPostal: "39201",
        postalCodes: ["392"],
        latitude: 32.2988,
        longitude: -90.1848,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "State capital, JAN airport, government center, medical center, Mississippi River proximity"
    },
    {
        zoneId: "MS_GULF_COAST",
        zoneName: "Mississippi - Gulf Coast",
        country: "United States",
        countryCode: "US",
        stateProvince: "Mississippi",
        stateProvinceCode: "MS",
        city: "Gulfport",
        cityVariations: ["Gulfport", "Biloxi", "Pascagoula", "Gulf Coast MS"],
        primaryPostal: "39501",
        postalCodes: ["395"],
        latitude: 30.3674,
        longitude: -89.0928,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Gulf port access, GPT airport, casinos, shipbuilding, Hurricane Katrina recovery"
    },
    {
        zoneId: "MS_HATTIESBURG",
        zoneName: "Mississippi - Hattiesburg",
        country: "United States",
        countryCode: "US",
        stateProvince: "Mississippi",
        stateProvinceCode: "MS",
        city: "Hattiesburg",
        cityVariations: ["Hattiesburg", "Hattiesburg MS"],
        primaryPostal: "39401",
        postalCodes: ["394"],
        latitude: 31.3271,
        longitude: -89.2903,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Hub City, University of Southern Mississippi, PIB airport, lumber heritage"
    }
];

module.exports = { MISSISSIPPI_ZONES };

