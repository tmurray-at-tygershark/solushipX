/**
 * COMPLETE ARKANSAS SHIPPING ZONES
 * All zones covering every shipping destination in Arkansas
 */

const ARKANSAS_ZONES = [
    {
        zoneId: "AR_LITTLE_ROCK_NORTH_LITTLE_ROCK",
        zoneName: "Arkansas - Little Rock North Little Rock",
        country: "United States",
        countryCode: "US",
        stateProvince: "Arkansas",
        stateProvinceCode: "AR",
        city: "Little Rock",
        cityVariations: ["Little Rock", "North Little Rock", "Conway", "Little Rock AR"],
        primaryPostal: "72201",
        postalCodes: ["722"],
        latitude: 34.7465,
        longitude: -92.2896,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "State capital, LIT airport, Arkansas River, government center, UALR"
    },
    {
        zoneId: "AR_NORTHWEST_WALMART_REGION",
        zoneName: "Arkansas - Northwest Walmart Region",
        country: "United States",
        countryCode: "US",
        stateProvince: "Arkansas",
        stateProvinceCode: "AR",
        city: "Fayetteville",
        cityVariations: ["Fayetteville", "Springdale", "Rogers", "Bentonville"],
        primaryPostal: "72701",
        postalCodes: ["727"],
        latitude: 36.0625,
        longitude: -94.1574,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Walmart headquarters cluster, XNA airport, University of Arkansas, Tyson Foods, CPG hub"
    },
    {
        zoneId: "AR_FORT_SMITH",
        zoneName: "Arkansas - Fort Smith",
        country: "United States",
        countryCode: "US",
        stateProvince: "Arkansas",
        stateProvinceCode: "AR",
        city: "Fort Smith",
        cityVariations: ["Fort Smith", "Van Buren", "Fort Smith AR"],
        primaryPostal: "72901",
        postalCodes: ["729"],
        latitude: 35.3859,
        longitude: -94.3985,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Oklahoma border, FSM airport, manufacturing, Arkansas River port"
    }
];

module.exports = { ARKANSAS_ZONES };

