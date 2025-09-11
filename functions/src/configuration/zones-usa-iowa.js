/**
 * COMPLETE IOWA SHIPPING ZONES
 * All zones covering every shipping destination in Iowa
 */

const IOWA_ZONES = [
    {
        zoneId: "IA_DES_MOINES",
        zoneName: "Iowa - Des Moines",
        country: "United States",
        countryCode: "US",
        stateProvince: "Iowa",
        stateProvinceCode: "IA",
        city: "Des Moines",
        cityVariations: ["Des Moines", "West Des Moines", "Ankeny", "Des Moines IA"],
        primaryPostal: "50309",
        postalCodes: ["503"],
        latitude: 41.5868,
        longitude: -93.6250,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "State capital, insurance center, DSM airport, agricultural hub, Iowa State Fair"
    },
    {
        zoneId: "IA_CEDAR_RAPIDS_IOWA_CITY",
        zoneName: "Iowa - Cedar Rapids Iowa City",
        country: "United States",
        countryCode: "US",
        stateProvince: "Iowa",
        stateProvinceCode: "IA",
        city: "Cedar Rapids",
        cityVariations: ["Cedar Rapids", "Iowa City", "Coralville", "Cedar Rapids IA"],
        primaryPostal: "52401",
        postalCodes: ["524", "522"],
        latitude: 41.9779,
        longitude: -91.6656,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "City of Five Seasons, CID airport, University of Iowa, Czech heritage, Corridor"
    },
    {
        zoneId: "IA_DAVENPORT_QUAD_CITIES",
        zoneName: "Iowa - Davenport Quad Cities",
        country: "United States",
        countryCode: "US",
        stateProvince: "Iowa",
        stateProvinceCode: "IA",
        city: "Davenport",
        cityVariations: ["Davenport", "Bettendorf", "Quad Cities"],
        primaryPostal: "52801",
        postalCodes: ["528"],
        latitude: 41.5236,
        longitude: -90.5776,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Quad Cities, Mississippi River, DVN airport, Illinois border"
    }
];

module.exports = { IOWA_ZONES };

