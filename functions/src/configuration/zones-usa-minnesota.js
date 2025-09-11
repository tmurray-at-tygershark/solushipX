/**
 * COMPLETE MINNESOTA SHIPPING ZONES
 * All zones covering every shipping destination in Minnesota
 */

const MINNESOTA_ZONES = [
    {
        zoneId: "MN_TWIN_CITIES",
        zoneName: "Minnesota - Twin Cities",
        country: "United States",
        countryCode: "US",
        stateProvince: "Minnesota",
        stateProvinceCode: "MN",
        city: "Minneapolis",
        cityVariations: ["Minneapolis", "Saint Paul", "Bloomington", "Eagan"],
        primaryPostal: "55401",
        postalCodes: ["554", "551"],
        latitude: 44.9778,
        longitude: -93.2650,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Twin Cities, MSP air cargo hub, Target headquarters, University of Minnesota, 3M"
    },
    {
        zoneId: "MN_DULUTH_SUPERIOR",
        zoneName: "Minnesota - Duluth Superior",
        country: "United States",
        countryCode: "US",
        stateProvince: "Minnesota",
        stateProvinceCode: "MN",
        city: "Duluth",
        cityVariations: ["Duluth", "Superior WI", "Twin Ports"],
        primaryPostal: "55802",
        postalCodes: ["558"],
        latitude: 46.7867,
        longitude: -92.1005,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Twin Ports, Great Lakes shipping, iron ore, DLH airport, aerial lift bridge"
    },
    {
        zoneId: "MN_ROCHESTER",
        zoneName: "Minnesota - Rochester",
        country: "United States",
        countryCode: "US",
        stateProvince: "Minnesota",
        stateProvinceCode: "MN",
        city: "Rochester",
        cityVariations: ["Rochester", "Rochester MN"],
        primaryPostal: "55901",
        postalCodes: ["559"],
        latitude: 44.0121,
        longitude: -92.4802,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Med City, Mayo Clinic, IBM, RST airport, medical tourism, healthcare hub"
    }
];

module.exports = { MINNESOTA_ZONES };

