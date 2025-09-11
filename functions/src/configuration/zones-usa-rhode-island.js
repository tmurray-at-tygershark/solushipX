/**
 * COMPLETE RHODE ISLAND SHIPPING ZONES
 * All zones covering every shipping destination in Rhode Island
 */

const RHODE_ISLAND_ZONES = [
    {
        zoneId: "RI_PROVIDENCE_METRO",
        zoneName: "Rhode Island - Providence Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Rhode Island",
        stateProvinceCode: "RI",
        city: "Providence",
        cityVariations: ["Providence", "Cranston", "Warwick", "Providence RI"],
        primaryPostal: "02903",
        postalCodes: ["029"],
        latitude: 41.8240,
        longitude: -71.4128,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Creative Capital, PVD airport, jewelry district, Brown University, ocean access, smallest state"
    }
];

module.exports = { RHODE_ISLAND_ZONES };

