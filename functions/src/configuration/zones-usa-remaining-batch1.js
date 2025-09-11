/**
 * COMPLETE US STATES SHIPPING ZONES - BATCH 1
 * Rhode Island, South Carolina, South Dakota, Tennessee, Utah, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming
 */

const REMAINING_STATES_BATCH1_ZONES = [

    // ========================================
    // RHODE ISLAND - 1 zone (complete)
    // ========================================
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
        searchRadius: 15000,
        zoneType: "metropolitan",
        notes: "Creative Capital, PVD airport, jewelry district, Brown University, ocean access"
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
        zoneType: "metropolitan",
        notes: "Holy City, major SE container port, CHS airport, Boeing Dreamliner factory"
    },
    {
        zoneId: "SC_GREENVILLE_SPARTANBURG",
        zoneName: "South Carolina - Greenville Spartanburg",
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
        notes: "BMW manufacturing, GSP airport, textile heritage, I-85 corridor, auto cluster"
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
        notes: "State capital, USC, CAE airport, I-20/I-26/I-77 junction, government center"
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
        notes: "Grand Strand, MYR airport, tourism hub, golf capital, Atlantic Ocean"
    },

    // ========================================
    // SOUTH DAKOTA - 2 zones (complete)
    // ========================================
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
        notes: "Big Sioux River, FSD airport, financial center, no state income tax"
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
        notes: "Gateway to Black Hills, RAP airport, Mount Rushmore proximity, tourism"
    },

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
        notes: "Scenic City, CHA airport, Tennessee River, Lookout Mountain, railroad heritage"
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
        cityVariations: ["St. George", "Cedar City", "Southern Utah"],
        primaryPostal: "84770",
        postalCodes: ["847"],
        latitude: 37.0965,
        longitude: -113.5684,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Dixie, SGU airport, national parks gateway, retirement community"
    },

    // ========================================
    // VERMONT - 2 zones (complete)
    // ========================================
    {
        zoneId: "VT_BURLINGTON_CHAMPLAIN",
        zoneName: "Vermont - Burlington Champlain",
        country: "United States",
        countryCode: "US",
        stateProvince: "Vermont",
        stateProvinceCode: "VT",
        city: "Burlington",
        cityVariations: ["Burlington", "South Burlington", "Burlington VT"],
        primaryPostal: "05401",
        postalCodes: ["054"],
        latitude: 44.4759,
        longitude: -73.2121,
        searchRadius: 15000,
        zoneType: "metropolitan",
        notes: "Queen City, BTV airport, UVM, Lake Champlain, I-89/I-87 cross-border lanes"
    },
    {
        zoneId: "VT_MONTPELIER_CENTRAL",
        zoneName: "Vermont - Montpelier Central",
        country: "United States",
        countryCode: "US",
        stateProvince: "Vermont",
        stateProvinceCode: "VT",
        city: "Montpelier",
        cityVariations: ["Montpelier", "Barre", "Montpelier VT"],
        primaryPostal: "05601",
        postalCodes: ["056"],
        latitude: 44.2601,
        longitude: -72.5806,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "State capital, smallest state capital, government center, granite heritage"
    },

    // ========================================
    // VIRGINIA - 4 zones (complete)
    // ========================================
    {
        zoneId: "VA_NORTHERN_DC_SUBURBS",
        zoneName: "Virginia - Northern DC Suburbs",
        country: "United States",
        countryCode: "US",
        stateProvince: "Virginia",
        stateProvinceCode: "VA",
        city: "Arlington",
        cityVariations: ["Arlington", "Alexandria", "Fairfax", "Northern Virginia"],
        primaryPostal: "22201",
        postalCodes: ["222", "223", "220"],
        latitude: 38.8816,
        longitude: -77.0910,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Pentagon, Reagan National Airport, DC Metro, government contractors"
    },
    {
        zoneId: "VA_RICHMOND_PETERSBURG",
        zoneName: "Virginia - Richmond Petersburg",
        country: "United States",
        countryCode: "US",
        stateProvince: "Virginia",
        stateProvinceCode: "VA",
        city: "Richmond",
        cityVariations: ["Richmond", "Petersburg", "Richmond VA"],
        primaryPostal: "23220",
        postalCodes: ["232", "238"],
        latitude: 37.5407,
        longitude: -77.4360,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "State capital, RIC airport, I-95/I-64 junction, tobacco heritage, government"
    },
    {
        zoneId: "VA_HAMPTON_ROADS_PORT",
        zoneName: "Virginia - Hampton Roads Port",
        country: "United States",
        countryCode: "US",
        stateProvince: "Virginia",
        stateProvinceCode: "VA",
        city: "Norfolk",
        cityVariations: ["Norfolk", "Virginia Beach", "Chesapeake", "Newport News"],
        primaryPostal: "23501",
        postalCodes: ["235", "234", "233", "236"],
        latitude: 36.8468,
        longitude: -76.2852,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Major Atlantic port, naval base, ORF airport, military hub, tourism"
    },
    {
        zoneId: "VA_LYNCHBURG_ROANOKE",
        zoneName: "Virginia - Lynchburg Roanoke",
        country: "United States",
        countryCode: "US",
        stateProvince: "Virginia",
        stateProvinceCode: "VA",
        city: "Lynchburg",
        cityVariations: ["Lynchburg", "Roanoke", "Lynchburg VA"],
        primaryPostal: "24501",
        postalCodes: ["245", "240"],
        latitude: 37.4138,
        longitude: -79.1422,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Hill City, Liberty University, ROA airport, Blue Ridge Mountains"
    },

    // ========================================
    // WASHINGTON - 4 zones (complete)
    // ========================================
    {
        zoneId: "WA_SEATTLE_TACOMA",
        zoneName: "Washington - Seattle Tacoma",
        country: "United States",
        countryCode: "US",
        stateProvince: "Washington",
        stateProvinceCode: "WA",
        city: "Seattle",
        cityVariations: ["Seattle", "Tacoma", "Kent", "Auburn"],
        primaryPostal: "98101",
        postalCodes: ["981", "984", "980"],
        latitude: 47.6062,
        longitude: -122.3321,
        searchRadius: 30000,
        zoneType: "metropolitan",
        notes: "Emerald City, major container port, SEA airport, Amazon/Microsoft, Kent Valley DCs"
    },
    {
        zoneId: "WA_SPOKANE_INLAND_NW",
        zoneName: "Washington - Spokane Inland NW",
        country: "United States",
        countryCode: "US",
        stateProvince: "Washington",
        stateProvinceCode: "WA",
        city: "Spokane",
        cityVariations: ["Spokane", "Spokane WA"],
        primaryPostal: "99201",
        postalCodes: ["992"],
        latitude: 47.6587,
        longitude: -117.4260,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Inland Northwest hub, GEG airport, eastern Washington gateway"
    },
    {
        zoneId: "WA_TRI_CITIES",
        zoneName: "Washington - Tri-Cities",
        country: "United States",
        countryCode: "US",
        stateProvince: "Washington",
        stateProvinceCode: "WA",
        city: "Kennewick",
        cityVariations: ["Kennewick", "Pasco", "Richland", "Tri-Cities"],
        primaryPostal: "99336",
        postalCodes: ["993"],
        latitude: 46.2112,
        longitude: -119.1372,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Nuclear reservation, wine country, Columbia River, PSC airport"
    },
    {
        zoneId: "WA_OLYMPIA_SOUTHWEST",
        zoneName: "Washington - Olympia Southwest",
        country: "United States",
        countryCode: "US",
        stateProvince: "Washington",
        stateProvinceCode: "WA",
        city: "Olympia",
        cityVariations: ["Olympia", "Centralia", "Chehalis"],
        primaryPostal: "98501",
        postalCodes: ["985"],
        latitude: 47.0379,
        longitude: -122.9015,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "State capital, Evergreen State College, Puget Sound, government center"
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
        zoneType: "metropolitan",
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
    },

    // ========================================
    // WISCONSIN - 4 zones (complete)
    // ========================================
    {
        zoneId: "WI_MILWAUKEE_SOUTHEAST",
        zoneName: "Wisconsin - Milwaukee Southeast",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wisconsin",
        stateProvinceCode: "WI",
        city: "Milwaukee",
        cityVariations: ["Milwaukee", "Waukesha", "Racine", "Kenosha"],
        primaryPostal: "53202",
        postalCodes: ["532", "531", "534"],
        latitude: 43.0389,
        longitude: -87.9065,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Brew City, Harley-Davidson, Great Lakes port, MKE airport, brewing heritage"
    },
    {
        zoneId: "WI_MADISON",
        zoneName: "Wisconsin - Madison",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wisconsin",
        stateProvinceCode: "WI",
        city: "Madison",
        cityVariations: ["Madison", "Sun Prairie", "Madison WI"],
        primaryPostal: "53703",
        postalCodes: ["537"],
        latitude: 43.0731,
        longitude: -89.4012,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "State capital, University of Wisconsin, MSN airport, isthmus city"
    },
    {
        zoneId: "WI_GREEN_BAY_FOX_VALLEY",
        zoneName: "Wisconsin - Green Bay Fox Valley",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wisconsin",
        stateProvinceCode: "WI",
        city: "Green Bay",
        cityVariations: ["Green Bay", "Appleton", "Oshkosh", "Fox Valley"],
        primaryPostal: "54301",
        postalCodes: ["543", "549"],
        latitude: 44.5133,
        longitude: -88.0133,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Titletown, Packers, Lambeau Field, paper industry, GRB airport"
    },
    {
        zoneId: "WI_LA_CROSSE",
        zoneName: "Wisconsin - La Crosse",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wisconsin",
        stateProvinceCode: "WI",
        city: "La Crosse",
        cityVariations: ["La Crosse", "La Crosse WI"],
        primaryPostal: "54601",
        postalCodes: ["546"],
        latitude: 43.8014,
        longitude: -91.2396,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Mississippi River, LSE airport, UW-La Crosse, Minnesota border"
    },

    // ========================================
    // WYOMING - 2 zones (complete)
    // ========================================
    {
        zoneId: "WY_CHEYENNE_I25_I80",
        zoneName: "Wyoming - Cheyenne I-25 I-80",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wyoming",
        stateProvinceCode: "WY",
        city: "Cheyenne",
        cityVariations: ["Cheyenne", "Cheyenne WY"],
        primaryPostal: "82001",
        postalCodes: ["820"],
        latitude: 41.1400,
        longitude: -104.8197,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "State capital, CYS airport, I-25/I-80 junction, railroad heritage, Frontier Days"
    },
    {
        zoneId: "WY_CASPER",
        zoneName: "Wyoming - Casper",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wyoming",
        stateProvinceCode: "WY",
        city: "Casper",
        cityVariations: ["Casper", "Casper WY"],
        primaryPostal: "82601",
        postalCodes: ["826"],
        latitude: 42.8666,
        longitude: -106.3131,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Oil City, CPR airport, North Platte River, energy hub, Casper Mountain"
    }

];

module.exports = { REMAINING_STATES_BATCH1_ZONES };

