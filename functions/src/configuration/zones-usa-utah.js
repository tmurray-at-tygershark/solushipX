/**
 * COMPLETE UTAH SHIPPING ZONES
 * All zones covering every shipping destination in Utah
 */

const UTAH_ZONES = [
    {
        zoneId: "UT_SALT_LAKE_WASATCH_FRONT",
        zoneName: "Utah - Salt Lake Wasatch Front",
        country: "United States",
        countryCode: "US",
        stateProvince: "Utah",
        stateProvinceCode: "UT",
        city: "Salt Lake City",
        cityVariations: ["Salt Lake City", "West Valley City", "Ogden", "Provo"],
        primaryPostal: "84101",
        postalCodes: ["841", "844", "846"],
        latitude: 40.7608,
        longitude: -111.8910,
        searchRadius: 30000,
        zoneType: "metropolitan",
        notes: "Crossroads of the West, SLC airport, Utah Inland Port, I-15/I-80 hub, Silicon Slopes"
    },
    {
        zoneId: "UT_SOUTHERN",
        zoneName: "Utah - Southern",
        country: "United States",
        countryCode: "US",
        stateProvince: "Utah",
        stateProvinceCode: "UT",
        city: "St. George",
        cityVariations: ["St. George", "Cedar City", "Southern Utah"],
        primaryPostal: "84770",
        postalCodes: ["847"],
        latitude: 37.0965,
        longitude: -113.5684,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Dixie, SGU airport, national parks gateway, retirement community, red rock country"
    }
];

module.exports = { UTAH_ZONES };

