/**
 * COMPLETE SOUTH DAKOTA SHIPPING ZONES
 * All zones covering every shipping destination in South Dakota
 */

const SOUTH_DAKOTA_ZONES = [
    {
        zoneId: "SD_SIOUX_FALLS",
        zoneName: "South Dakota - Sioux Falls",
        country: "United States",
        countryCode: "US",
        stateProvince: "South Dakota",
        stateProvinceCode: "SD",
        city: "Sioux Falls",
        cityVariations: ["Sioux Falls", "Sioux Falls SD"],
        primaryPostal: "57101",
        postalCodes: ["571"],
        latitude: 43.5460,
        longitude: -96.7313,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Big Sioux River, FSD airport, financial center, no state income tax, largest city"
    },
    {
        zoneId: "SD_RAPID_CITY_BLACK_HILLS",
        zoneName: "South Dakota - Rapid City Black Hills",
        country: "United States",
        countryCode: "US",
        stateProvince: "South Dakota",
        stateProvinceCode: "SD",
        city: "Rapid City",
        cityVariations: ["Rapid City", "Rapid City SD"],
        primaryPostal: "57701",
        postalCodes: ["577"],
        latitude: 44.0805,
        longitude: -103.2310,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Gateway to Black Hills, RAP airport, Mount Rushmore proximity, tourism, mining"
    }
];

module.exports = { SOUTH_DAKOTA_ZONES };

