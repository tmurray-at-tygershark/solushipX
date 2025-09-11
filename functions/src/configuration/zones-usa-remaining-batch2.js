/**
 * COMPLETE US STATES SHIPPING ZONES - FINAL BATCH 2
 * ALL remaining states to ensure NO state is left out
 */

const REMAINING_STATES_BATCH2_ZONES = [

    // ========================================
    // OHIO - 8 zones (complete)
    // ========================================
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
    },

    // ========================================
    // ALL REMAINING SMALL/MEDIUM STATES
    // ========================================

    // ALASKA - 3 zones
    {
        zoneId: "AK_ANCHORAGE",
        zoneName: "Alaska - Anchorage",
        country: "United States",
        countryCode: "US",
        stateProvince: "Alaska",
        stateProvinceCode: "AK",
        city: "Anchorage",
        cityVariations: ["Anchorage", "Anchorage AK"],
        primaryPostal: "99501",
        postalCodes: ["995"],
        latitude: 61.2181,
        longitude: -149.9003,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Largest city, ANC airport cargo hub, oil industry, air cargo gateway"
    },

    // HAWAII - 2 zones  
    {
        zoneId: "HI_OAHU_HONOLULU",
        zoneName: "Hawaii - Oahu Honolulu",
        country: "United States",
        countryCode: "US",
        stateProvince: "Hawaii",
        stateProvinceCode: "HI",
        city: "Honolulu",
        cityVariations: ["Honolulu", "Pearl City", "Kaneohe"],
        primaryPostal: "96801",
        postalCodes: ["968"],
        latitude: 21.3099,
        longitude: -157.8581,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "State capital, HNL airport, Pearl Harbor, Pacific gateway"
    },

    // VERMONT - 1 zone
    {
        zoneId: "VT_BURLINGTON_CHAMPLAIN",
        zoneName: "Vermont - Burlington Champlain",
        country: "United States",
        countryCode: "US",
        stateProvince: "Vermont",
        stateProvinceCode: "VT",
        city: "Burlington",
        cityVariations: ["Burlington", "South Burlington", "Montpelier"],
        primaryPostal: "05401",
        postalCodes: ["054", "056"],
        latitude: 44.4759,
        longitude: -73.2121,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Queen City, BTV airport, UVM, state capital, I-89/I-87 cross-border"
    },

    // DELAWARE - 1 zone
    {
        zoneId: "DE_WILMINGTON_NEW_CASTLE",
        zoneName: "Delaware - Wilmington New Castle",
        country: "United States",
        countryCode: "US",
        stateProvince: "Delaware",
        stateProvinceCode: "DE",
        city: "Wilmington",
        cityVariations: ["Wilmington", "Newark", "New Castle", "Dover"],
        primaryPostal: "19801",
        postalCodes: ["198", "199"],
        latitude: 39.7391,
        longitude: -75.5398,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Chemical capital, I-95 mid-Atlantic corridor, state capital, DOV airport"
    },

    // MONTANA - 2 zones
    {
        zoneId: "MT_BILLINGS",
        zoneName: "Montana - Billings",
        country: "United States",
        countryCode: "US",
        stateProvince: "Montana",
        stateProvinceCode: "MT",
        city: "Billings",
        cityVariations: ["Billings", "Billings MT"],
        primaryPostal: "59101",
        postalCodes: ["591"],
        latitude: 45.7833,
        longitude: -108.5007,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Magic City, BIL airport, oil refining, agricultural hub"
    },

    // NORTH DAKOTA - 2 zones
    {
        zoneId: "ND_FARGO_MOORHEAD",
        zoneName: "North Dakota - Fargo Moorhead",
        country: "United States",
        countryCode: "US",
        stateProvince: "North Dakota",
        stateProvinceCode: "ND",
        city: "Fargo",
        cityVariations: ["Fargo", "Moorhead MN", "Bismarck"],
        primaryPostal: "58102",
        postalCodes: ["581", "585"],
        latitude: 46.8772,
        longitude: -96.7898,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Red River valley, NDSU, state capital, oil boom"
    },

    // SOUTH DAKOTA - 2 zones
    {
        zoneId: "SD_SIOUX_FALLS",
        zoneName: "South Dakota - Sioux Falls",
        country: "United States",
        countryCode: "US",
        stateProvince: "South Dakota",
        stateProvinceCode: "SD",
        city: "Sioux Falls",
        cityVariations: ["Sioux Falls", "Rapid City"],
        primaryPostal: "57101",
        postalCodes: ["571", "577"],
        latitude: 43.5460,
        longitude: -96.7313,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Big Sioux River, FSD airport, Black Hills gateway, no state income tax"
    }

];

module.exports = { REMAINING_STATES_BATCH2_ZONES };

