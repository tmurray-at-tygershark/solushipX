/**
 * COMPLETE VIRGINIA SHIPPING ZONES
 * All zones covering every shipping destination in Virginia
 */

const VIRGINIA_ZONES = [
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
        notes: "Pentagon, Reagan National Airport, DC Metro, government contractors, tech corridor"
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
        notes: "State capital, RIC airport, I-95/I-64 junction, tobacco heritage, VCU"
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
        zoneType: "specialized",
        notes: "Major Atlantic port, naval base, ORF airport, military hub, shipbuilding"
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
        notes: "Hill City, Liberty University, ROA airport, Blue Ridge Mountains, Shenandoah Valley"
    }
];

module.exports = { VIRGINIA_ZONES };

