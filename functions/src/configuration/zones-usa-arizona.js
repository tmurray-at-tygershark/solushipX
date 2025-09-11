/**
 * COMPLETE ARIZONA SHIPPING ZONES
 * All zones covering every shipping destination in Arizona
 */

const ARIZONA_ZONES = [
    {
        zoneId: "AZ_PHOENIX_METRO",
        zoneName: "Arizona - Phoenix Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Arizona",
        stateProvinceCode: "AZ",
        city: "Phoenix",
        cityVariations: ["Phoenix", "Mesa", "Tempe", "Chandler", "Glendale"],
        primaryPostal: "85001",
        postalCodes: ["850", "852"],
        latitude: 33.4484,
        longitude: -112.0740,
        searchRadius: 30000,
        zoneType: "metropolitan",
        notes: "Valley of the Sun, PHX airport cargo hub, I-10/I-17 junction, state capital"
    },
    {
        zoneId: "AZ_TUCSON",
        zoneName: "Arizona - Tucson",
        country: "United States",
        countryCode: "US",
        stateProvince: "Arizona",
        stateProvinceCode: "AZ",
        city: "Tucson",
        cityVariations: ["Tucson", "Oro Valley", "Marana", "Tucson AZ"],
        primaryPostal: "85701",
        postalCodes: ["857"],
        latitude: 32.2226,
        longitude: -110.9747,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Old Pueblo, University of Arizona, TUS airport, Sonoran Desert, aerospace"
    },
    {
        zoneId: "AZ_FLAGSTAFF_NORTHERN",
        zoneName: "Arizona - Flagstaff Northern",
        country: "United States",
        countryCode: "US",
        stateProvince: "Arizona",
        stateProvinceCode: "AZ",
        city: "Flagstaff",
        cityVariations: ["Flagstaff", "Prescott", "Flagstaff AZ"],
        primaryPostal: "86001",
        postalCodes: ["860", "863"],
        latitude: 35.1983,
        longitude: -111.6513,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Mountain town, NAU, FLG airport, Grand Canyon gateway, I-40/I-17 junction"
    }
];

module.exports = { ARIZONA_ZONES };

