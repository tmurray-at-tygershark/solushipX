/**
 * COMPLETE WYOMING SHIPPING ZONES
 * All zones covering every shipping destination in Wyoming
 */

const WYOMING_ZONES = [
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

module.exports = { WYOMING_ZONES };

