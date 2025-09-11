/**
 * COMPLETE OHIO SHIPPING ZONES
 * All zones covering every shipping destination in Ohio
 */

const OHIO_ZONES = [
    {
        zoneId: "OH_COLUMBUS_RICKENBACKER",
        zoneName: "Ohio - Columbus Rickenbacker",
        country: "United States",
        countryCode: "US",
        stateProvince: "Ohio",
        stateProvinceCode: "OH",
        city: "Columbus",
        cityVariations: ["Columbus", "Groveport", "Columbus OH"],
        primaryPostal: "43215",
        postalCodes: ["432", "431"],
        latitude: 39.9612,
        longitude: -82.9988,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "National DC hub, CMH/Rickenbacker air cargo, Ohio State, I-70/I-71 junction"
    },
    {
        zoneId: "OH_CINCINNATI_DAYTON",
        zoneName: "Ohio - Cincinnati Dayton",
        country: "United States",
        countryCode: "US",
        stateProvince: "Ohio",
        stateProvinceCode: "OH",
        city: "Cincinnati",
        cityVariations: ["Cincinnati", "Dayton", "Cincinnati OH"],
        primaryPostal: "45202",
        postalCodes: ["452", "454"],
        latitude: 39.1031,
        longitude: -84.5120,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Queen City, CVG air cargo, Wright-Patterson AFB, P&G headquarters"
    },
    {
        zoneId: "OH_CLEVELAND_AKRON_CANTON",
        zoneName: "Ohio - Cleveland Akron Canton",
        country: "United States",
        countryCode: "US",
        stateProvince: "Ohio",
        stateProvinceCode: "OH",
        city: "Cleveland",
        cityVariations: ["Cleveland", "Akron", "Canton", "Cleveland OH"],
        primaryPostal: "44101",
        postalCodes: ["441", "443", "447"],
        latitude: 41.4993,
        longitude: -81.6944,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Great Lakes manufacturing/port, CLE airport, steel heritage, Pro Football Hall of Fame"
    },
    {
        zoneId: "OH_TOLEDO",
        zoneName: "Ohio - Toledo",
        country: "United States",
        countryCode: "US",
        stateProvince: "Ohio",
        stateProvinceCode: "OH",
        city: "Toledo",
        cityVariations: ["Toledo", "Toledo OH"],
        primaryPostal: "43604",
        postalCodes: ["436"],
        latitude: 41.6528,
        longitude: -83.5379,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Glass City, Great Lakes port, TOL airport, automotive, Maumee River"
    }
];

module.exports = { OHIO_ZONES };

