/**
 * COMPLETE PENNSYLVANIA SHIPPING ZONES
 * All zones covering every shipping destination in Pennsylvania
 */

const PENNSYLVANIA_ZONES = [
    {
        zoneId: "PA_PHILADELPHIA_METRO",
        zoneName: "Pennsylvania - Philadelphia Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Pennsylvania",
        stateProvinceCode: "PA",
        city: "Philadelphia",
        cityVariations: ["Philadelphia", "King of Prussia", "Bensalem"],
        primaryPostal: "19101",
        postalCodes: ["191", "192", "193", "194", "190"],
        latitude: 39.9526,
        longitude: -75.1652,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "City of Brotherly Love, PHL airport, I-95/DC-NY corridor, Liberty Bell"
    },
    {
        zoneId: "PA_LEHIGH_VALLEY_I78_I81",
        zoneName: "Pennsylvania - Lehigh Valley I-78 I-81",
        country: "United States",
        countryCode: "US",
        stateProvince: "Pennsylvania",
        stateProvinceCode: "PA",
        city: "Allentown",
        cityVariations: ["Allentown", "Bethlehem", "Easton", "Lehigh Valley"],
        primaryPostal: "18101",
        postalCodes: ["181", "180"],
        latitude: 40.6084,
        longitude: -75.4902,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Massive DC cluster for Northeast, ABE airport, steel heritage, I-78/I-81 junction"
    },
    {
        zoneId: "PA_CENTRAL_HARRISBURG_YORK_LANCASTER",
        zoneName: "Pennsylvania - Central Harrisburg York Lancaster",
        country: "United States",
        countryCode: "US",
        stateProvince: "Pennsylvania",
        stateProvinceCode: "PA",
        city: "Harrisburg",
        cityVariations: ["Harrisburg", "York", "Lancaster", "Central PA"],
        primaryPostal: "17101",
        postalCodes: ["171", "174", "176"],
        latitude: 40.2732,
        longitude: -76.8839,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "State capital, I-81 spine, food & CPG distribution, CXY airport"
    },
    {
        zoneId: "PA_PITTSBURGH",
        zoneName: "Pennsylvania - Pittsburgh",
        country: "United States",
        countryCode: "US",
        stateProvince: "Pennsylvania",
        stateProvinceCode: "PA",
        city: "Pittsburgh",
        cityVariations: ["Pittsburgh", "Cranberry Township", "Pittsburgh PA"],
        primaryPostal: "15201",
        postalCodes: ["152", "160"],
        latitude: 40.4406,
        longitude: -79.9959,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Steel City, Three Rivers, University of Pittsburgh, PIT airport, tech corridor"
    }
];

module.exports = { PENNSYLVANIA_ZONES };

