/**
 * COMPLETE NORTH DAKOTA SHIPPING ZONES
 * All zones covering every shipping destination in North Dakota
 */

const NORTH_DAKOTA_ZONES = [
    {
        zoneId: "ND_FARGO_MOORHEAD",
        zoneName: "North Dakota - Fargo Moorhead",
        country: "United States",
        countryCode: "US",
        stateProvince: "North Dakota",
        stateProvinceCode: "ND",
        city: "Fargo",
        cityVariations: ["Fargo", "Moorhead MN", "Fargo ND"],
        primaryPostal: "58102",
        postalCodes: ["581"],
        latitude: 46.8772,
        longitude: -96.7898,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Red River valley, NDSU, FAR airport, agricultural hub, technology center"
    },
    {
        zoneId: "ND_BISMARCK_MANDAN",
        zoneName: "North Dakota - Bismarck Mandan",
        country: "United States",
        countryCode: "US",
        stateProvince: "North Dakota",
        stateProvinceCode: "ND",
        city: "Bismarck",
        cityVariations: ["Bismarck", "Mandan", "Bismarck ND"],
        primaryPostal: "58501",
        postalCodes: ["585"],
        latitude: 46.8083,
        longitude: -100.7837,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "State capital, BIS airport, government center, Missouri River, energy hub"
    },
    {
        zoneId: "ND_MINOT",
        zoneName: "North Dakota - Minot",
        country: "United States",
        countryCode: "US",
        stateProvince: "North Dakota",
        stateProvinceCode: "ND",
        city: "Minot",
        cityVariations: ["Minot", "Minot ND"],
        primaryPostal: "58701",
        postalCodes: ["587"],
        latitude: 48.2330,
        longitude: -101.2968,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Magic City, Minot Air Force Base, MOT airport, oil boom, agriculture"
    }
];

module.exports = { NORTH_DAKOTA_ZONES };

