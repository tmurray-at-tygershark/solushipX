/**
 * COMPLETE MICHIGAN SHIPPING ZONES
 * All zones covering every shipping destination in Michigan
 */

const MICHIGAN_ZONES = [
    {
        zoneId: "MI_DETROIT_WINDSOR_GATEWAY",
        zoneName: "Michigan - Detroit Windsor Gateway",
        country: "United States",
        countryCode: "US",
        stateProvince: "Michigan",
        stateProvinceCode: "MI",
        city: "Detroit",
        cityVariations: ["Detroit", "Dearborn", "Livonia", "Detroit MI"],
        primaryPostal: "48201",
        postalCodes: ["482", "481"],
        latitude: 42.3314,
        longitude: -83.0458,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Motor City, Big Three automakers, DTW airport, Ambassador Bridge to Canada"
    },
    {
        zoneId: "MI_GRAND_RAPIDS_HOLLAND_MUSKEGON",
        zoneName: "Michigan - Grand Rapids Holland Muskegon",
        country: "United States",
        countryCode: "US",
        stateProvince: "Michigan",
        stateProvinceCode: "MI",
        city: "Grand Rapids",
        cityVariations: ["Grand Rapids", "Holland", "Muskegon", "Grand Rapids MI"],
        primaryPostal: "49503",
        postalCodes: ["495", "494"],
        latitude: 42.9634,
        longitude: -85.6681,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Furniture City, medical device capital, GRR airport, Lake Michigan access"
    },
    {
        zoneId: "MI_LANSING_JACKSON",
        zoneName: "Michigan - Lansing Jackson",
        country: "United States",
        countryCode: "US",
        stateProvince: "Michigan",
        stateProvinceCode: "MI",
        city: "Lansing",
        cityVariations: ["Lansing", "Jackson", "Lansing MI"],
        primaryPostal: "48933",
        postalCodes: ["489", "492"],
        latitude: 42.3314,
        longitude: -84.5467,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "State capital, MSU proximity, GM Lansing, LAN airport, government center"
    },
    {
        zoneId: "MI_FLINT_SAGINAW_BAY_CITY",
        zoneName: "Michigan - Flint Saginaw Bay City",
        country: "United States",
        countryCode: "US",
        stateProvince: "Michigan",
        stateProvinceCode: "MI",
        city: "Flint",
        cityVariations: ["Flint", "Saginaw", "Bay City", "Flint MI"],
        primaryPostal: "48502",
        postalCodes: ["485", "486", "487"],
        latitude: 43.0125,
        longitude: -83.6875,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Vehicle City, GM heritage, FNT airport, Great Lakes access, automotive suppliers"
    }
];

module.exports = { MICHIGAN_ZONES };

