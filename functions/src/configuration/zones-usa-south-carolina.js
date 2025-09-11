/**
 * COMPLETE SOUTH CAROLINA SHIPPING ZONES
 * All zones covering every shipping destination in South Carolina
 */

const SOUTH_CAROLINA_ZONES = [
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
        notes: "Holy City, major SE container port, CHS airport, Boeing Dreamliner factory, historic district"
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
    }
];

module.exports = { SOUTH_CAROLINA_ZONES };

