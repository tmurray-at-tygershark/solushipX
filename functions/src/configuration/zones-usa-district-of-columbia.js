/**
 * COMPLETE DISTRICT OF COLUMBIA SHIPPING ZONES
 * All zones covering every shipping destination in DC
 */

const DC_ZONES = [
    {
        zoneId: "DC_WASHINGTON",
        zoneName: "District of Columbia - Washington",
        country: "United States",
        countryCode: "US",
        stateProvince: "District of Columbia",
        stateProvinceCode: "DC",
        city: "Washington",
        cityVariations: ["Washington", "Washington DC", "DC"],
        primaryPostal: "20001",
        postalCodes: ["200", "201", "202", "203", "204", "205"],
        latitude: 38.9072,
        longitude: -77.0369,
        searchRadius: 15000,
        zoneType: "metropolitan",
        notes: "Nation's capital, federal government, DCA airport, monuments, White House, Capitol"
    }
];

module.exports = { DC_ZONES };

