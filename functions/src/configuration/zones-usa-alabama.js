/**
 * COMPLETE ALABAMA SHIPPING ZONES
 * All zones covering every shipping destination in Alabama
 */

const ALABAMA_ZONES = [
    {
        zoneId: "AL_BIRMINGHAM_TUSCALOOSA",
        zoneName: "Alabama - Birmingham Tuscaloosa",
        country: "United States",
        countryCode: "US",
        stateProvince: "Alabama",
        stateProvinceCode: "AL",
        city: "Birmingham",
        cityVariations: ["Birmingham", "Tuscaloosa", "Hoover", "Birmingham AL"],
        primaryPostal: "35203",
        postalCodes: ["352", "354"],
        latitude: 33.5207,
        longitude: -86.8025,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Magic City, steel heritage, BHM airport, UAB medical center, University of Alabama"
    },
    {
        zoneId: "AL_HUNTSVILLE_DECATUR",
        zoneName: "Alabama - Huntsville Decatur",
        country: "United States",
        countryCode: "US",
        stateProvince: "Alabama",
        stateProvinceCode: "AL",
        city: "Huntsville",
        cityVariations: ["Huntsville", "Decatur", "Madison", "Huntsville AL"],
        primaryPostal: "35801",
        postalCodes: ["358", "356"],
        latitude: 34.7304,
        longitude: -86.5861,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Rocket City, Marshall Space Flight Center, HSV airport, aerospace, defense contractors"
    },
    {
        zoneId: "AL_MOBILE_PORT",
        zoneName: "Alabama - Mobile Port",
        country: "United States",
        countryCode: "US",
        stateProvince: "Alabama",
        stateProvinceCode: "AL",
        city: "Mobile",
        cityVariations: ["Mobile", "Daphne", "Fairhope", "Mobile AL"],
        primaryPostal: "36601",
        postalCodes: ["366"],
        latitude: 30.6954,
        longitude: -88.0399,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "Port City, Gulf port access, MOB airport, Mardi Gras, shipbuilding, chemical plants"
    },
    {
        zoneId: "AL_MONTGOMERY",
        zoneName: "Alabama - Montgomery",
        country: "United States",
        countryCode: "US",
        stateProvince: "Alabama",
        stateProvinceCode: "AL",
        city: "Montgomery",
        cityVariations: ["Montgomery", "Prattville", "Montgomery AL"],
        primaryPostal: "36101",
        postalCodes: ["361"],
        latitude: 32.3668,
        longitude: -86.3000,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "State capital, civil rights heritage, MGM airport, Alabama State University"
    }
];

module.exports = { ALABAMA_ZONES };

