/**
 * COMPLETE NORTH CAROLINA SHIPPING ZONES
 * All zones covering every shipping destination in North Carolina
 */

const NORTH_CAROLINA_ZONES = [
    {
        zoneId: "NC_CHARLOTTE_METRO",
        zoneName: "North Carolina - Charlotte Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "North Carolina",
        stateProvinceCode: "NC",
        city: "Charlotte",
        cityVariations: ["Charlotte", "Concord", "Gastonia", "Charlotte NC"],
        primaryPostal: "28201",
        postalCodes: ["282", "280"],
        latitude: 35.2271,
        longitude: -80.8431,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Queen City, banking capital, CLT airport hub, NASCAR Hall of Fame, finance center"
    },
    {
        zoneId: "NC_RALEIGH_DURHAM_TRIANGLE",
        zoneName: "North Carolina - Raleigh Durham Triangle",
        country: "United States",
        countryCode: "US",
        stateProvince: "North Carolina",
        stateProvinceCode: "NC",
        city: "Raleigh",
        cityVariations: ["Raleigh", "Durham", "Cary", "Research Triangle"],
        primaryPostal: "27601",
        postalCodes: ["276", "277", "275"],
        latitude: 35.7796,
        longitude: -78.6382,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "State capital, Research Triangle Park, RDU airport, tech corridor, universities"
    },
    {
        zoneId: "NC_GREENSBORO_WINSTON_HIGH_POINT",
        zoneName: "North Carolina - Greensboro Winston High Point",
        country: "United States",
        countryCode: "US",
        stateProvince: "North Carolina",
        stateProvinceCode: "NC",
        city: "Greensboro",
        cityVariations: ["Greensboro", "Winston-Salem", "High Point", "Triad"],
        primaryPostal: "27401",
        postalCodes: ["274", "271", "272"],
        latitude: 36.0726,
        longitude: -79.7920,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Piedmont Triad, GSO airport, furniture capital, tobacco heritage, PTI airport"
    },
    {
        zoneId: "NC_WILMINGTON_PORT",
        zoneName: "North Carolina - Wilmington Port",
        country: "United States",
        countryCode: "US",
        stateProvince: "North Carolina",
        stateProvinceCode: "NC",
        city: "Wilmington",
        cityVariations: ["Wilmington", "Wilmington NC"],
        primaryPostal: "28401",
        postalCodes: ["284"],
        latitude: 34.2257,
        longitude: -77.9447,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Port City, Cape Fear River, UNCW, film industry, ILM airport"
    }
];

module.exports = { NORTH_CAROLINA_ZONES };

