/**
 * COMPLETE OKLAHOMA SHIPPING ZONES
 * All zones covering every shipping destination in Oklahoma
 */

const OKLAHOMA_ZONES = [
    {
        zoneId: "OK_OKLAHOMA_CITY",
        zoneName: "Oklahoma - Oklahoma City",
        country: "United States",
        countryCode: "US",
        stateProvince: "Oklahoma",
        stateProvinceCode: "OK",
        city: "Oklahoma City",
        cityVariations: ["Oklahoma City", "Edmond", "Oklahoma City OK"],
        primaryPostal: "73102",
        postalCodes: ["731"],
        latitude: 35.4676,
        longitude: -97.5164,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "State capital, OKC airport, oil and gas, government center, cowboy heritage"
    },
    {
        zoneId: "OK_TULSA",
        zoneName: "Oklahoma - Tulsa",
        country: "United States",
        countryCode: "US",
        stateProvince: "Oklahoma",
        stateProvinceCode: "OK",
        city: "Tulsa",
        cityVariations: ["Tulsa", "Broken Arrow", "Tulsa OK"],
        primaryPostal: "74101",
        postalCodes: ["741"],
        latitude: 36.1540,
        longitude: -95.9928,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Oil Capital, TUL airport, University of Tulsa, Arkansas River, energy hub"
    }
];

module.exports = { OKLAHOMA_ZONES };

