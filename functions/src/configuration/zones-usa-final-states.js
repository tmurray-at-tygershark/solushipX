/**
 * FINAL US STATES SHIPPING ZONES
 * ALL remaining states to complete 50 states + DC coverage
 */

const FINAL_US_STATES_ZONES = [

    // ========================================
    // TENNESSEE - 4 zones (complete)
    // ========================================
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
        notes: "FedEx SuperHub, river/rail hub, MEM airport, Elvis heritage, Beale Street"
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
        notes: "Music City, state capital, BNA airport, country music, healthcare hub"
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
        notes: "Marble City, University of Tennessee, TYS airport, Great Smoky Mountains"
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
        notes: "Scenic City, CHA airport, Tennessee River, Lookout Mountain"
    },

    // ========================================
    // SOUTH CAROLINA - 4 zones (complete)
    // ========================================
    {
        zoneId: "SC_CHARLESTON_PORT",
        zoneName: "South Carolina - Charleston Port",
        country: "United States",
        countryCode: "US",
        stateProvince: "South Carolina",
        stateProvinceCode: "SC",
        city: "Charleston",
        cityVariations: ["Charleston", "North Charleston", "Summerville"],
        primaryPostal: "29401",
        postalCodes: ["294"],
        latitude: 32.7765,
        longitude: -79.9311,
        searchRadius: 20000,
        zoneType: "specialized",
        notes: "Holy City, major SE container port, CHS airport, Boeing Dreamliner factory"
    },
    {
        zoneId: "SC_GREENVILLE_SPARTANBURG_UPSTATE",
        zoneName: "South Carolina - Greenville Spartanburg Upstate",
        country: "United States",
        countryCode: "US",
        stateProvince: "South Carolina",
        stateProvinceCode: "SC",
        city: "Greenville",
        cityVariations: ["Greenville", "Spartanburg", "Greer", "Upstate SC"],
        primaryPostal: "29601",
        postalCodes: ["296", "293"],
        latitude: 34.8526,
        longitude: -82.3940,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "BMW manufacturing, GSP airport, textile heritage, I-85 corridor"
    },
    {
        zoneId: "SC_COLUMBIA",
        zoneName: "South Carolina - Columbia",
        country: "United States",
        countryCode: "US",
        stateProvince: "South Carolina",
        stateProvinceCode: "SC",
        city: "Columbia",
        cityVariations: ["Columbia", "Lexington", "Columbia SC"],
        primaryPostal: "29201",
        postalCodes: ["292", "290"],
        latitude: 34.0007,
        longitude: -81.0348,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "State capital, USC, CAE airport, I-20/I-26/I-77 junction"
    },
    {
        zoneId: "SC_MYRTLE_BEACH",
        zoneName: "South Carolina - Myrtle Beach",
        country: "United States",
        countryCode: "US",
        stateProvince: "South Carolina",
        stateProvinceCode: "SC",
        city: "Myrtle Beach",
        cityVariations: ["Myrtle Beach", "Myrtle Beach SC"],
        primaryPostal: "29577",
        postalCodes: ["295"],
        latitude: 33.6891,
        longitude: -78.8867,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Grand Strand, MYR airport, tourism hub, golf capital"
    },

    // ========================================
    // UTAH - 2 zones (complete)
    // ========================================
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
        notes: "Crossroads of the West, SLC airport, Utah Inland Port, I-15/I-80 hub"
    },
    {
        zoneId: "UT_SOUTHERN",
        zoneName: "Utah - Southern",
        country: "United States",
        countryCode: "US",
        stateProvince: "Utah",
        stateProvinceCode: "UT",
        city: "St. George",
        cityVariations: ["St. George", "Cedar City"],
        primaryPostal: "84770",
        postalCodes: ["847"],
        latitude: 37.0965,
        longitude: -113.5684,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Dixie, SGU airport, national parks gateway"
    },

    // ========================================
    // VERMONT - 1 zone (complete)
    // ========================================
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

    // ========================================
    // WEST VIRGINIA - 2 zones (complete)
    // ========================================
    {
        zoneId: "WV_CHARLESTON_HUNTINGTON",
        zoneName: "West Virginia - Charleston Huntington",
        country: "United States",
        countryCode: "US",
        stateProvince: "West Virginia",
        stateProvinceCode: "WV",
        city: "Charleston",
        cityVariations: ["Charleston", "Huntington", "Charleston WV"],
        primaryPostal: "25301",
        postalCodes: ["253", "257"],
        latitude: 38.3498,
        longitude: -81.6326,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "State capital, CRW airport, chemical valley, coal heritage, Ohio River"
    },
    {
        zoneId: "WV_MORGANTOWN",
        zoneName: "West Virginia - Morgantown",
        country: "United States",
        countryCode: "US",
        stateProvince: "West Virginia",
        stateProvinceCode: "WV",
        city: "Morgantown",
        cityVariations: ["Morgantown", "Morgantown WV"],
        primaryPostal: "26501",
        postalCodes: ["265"],
        latitude: 39.6295,
        longitude: -79.9553,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "WVU campus, MGW airport, coal research, Pennsylvania border"
    }

];

module.exports = { FINAL_US_STATES_ZONES };

