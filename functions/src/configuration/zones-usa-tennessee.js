/**
 * COMPLETE TENNESSEE SHIPPING ZONES
 * All zones covering every shipping destination in Tennessee
 */

const TENNESSEE_ZONES = [
    {
        zoneId: "TN_MEMPHIS_SHELBY",
        zoneName: "Tennessee - Memphis Shelby",
        country: "United States",
        countryCode: "US",
        stateProvince: "Tennessee",
        stateProvinceCode: "TN",
        city: "Memphis",
        cityVariations: ["Memphis", "Memphis TN"],
        primaryPostal: "38103",
        postalCodes: ["381"],
        latitude: 35.1495,
        longitude: -90.0490,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "FedEx SuperHub, river/rail hub, MEM airport, Elvis heritage, Beale Street, Mississippi River"
    },
    {
        zoneId: "TN_NASHVILLE_DAVIDSON",
        zoneName: "Tennessee - Nashville Davidson",
        country: "United States",
        countryCode: "US",
        stateProvince: "Tennessee",
        stateProvinceCode: "TN",
        city: "Nashville",
        cityVariations: ["Nashville", "Smyrna", "Nashville TN"],
        primaryPostal: "37201",
        postalCodes: ["372"],
        latitude: 36.1627,
        longitude: -86.7816,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Music City, state capital, BNA airport, country music, healthcare hub, Grand Ole Opry"
    },
    {
        zoneId: "TN_KNOXVILLE_EAST",
        zoneName: "Tennessee - Knoxville East",
        country: "United States",
        countryCode: "US",
        stateProvince: "Tennessee",
        stateProvinceCode: "TN",
        city: "Knoxville",
        cityVariations: ["Knoxville", "Oak Ridge", "Knoxville TN"],
        primaryPostal: "37901",
        postalCodes: ["379"],
        latitude: 35.9606,
        longitude: -83.9207,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "Marble City, University of Tennessee, TYS airport, Great Smoky Mountains, nuclear research"
    },
    {
        zoneId: "TN_CHATTANOOGA",
        zoneName: "Tennessee - Chattanooga",
        country: "United States",
        countryCode: "US",
        stateProvince: "Tennessee",
        stateProvinceCode: "TN",
        city: "Chattanooga",
        cityVariations: ["Chattanooga", "Cleveland TN", "Chattanooga TN"],
        primaryPostal: "37402",
        postalCodes: ["374"],
        latitude: 35.0456,
        longitude: -85.3097,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "Scenic City, CHA airport, Tennessee River, Lookout Mountain, railroad heritage"
    }
];

module.exports = { TENNESSEE_ZONES };

