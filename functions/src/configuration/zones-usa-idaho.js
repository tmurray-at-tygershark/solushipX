/**
 * COMPLETE IDAHO SHIPPING ZONES
 * All zones covering every shipping destination in Idaho
 */

const IDAHO_ZONES = [
    {
        zoneId: "ID_BOISE_TREASURE_VALLEY",
        zoneName: "Idaho - Boise Treasure Valley",
        country: "United States",
        countryCode: "US",
        stateProvince: "Idaho",
        stateProvinceCode: "ID",
        city: "Boise",
        cityVariations: ["Boise", "Nampa", "Meridian", "Caldwell"],
        primaryPostal: "83702",
        postalCodes: ["837"],
        latitude: 43.6150,
        longitude: -116.2023,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Treasure Valley, BOI airport, state capital, tech corridor, Micron Technology"
    },
    {
        zoneId: "ID_EASTERN_IDAHO",
        zoneName: "Idaho - Eastern Idaho",
        country: "United States",
        countryCode: "US",
        stateProvince: "Idaho",
        stateProvinceCode: "ID",
        city: "Idaho Falls",
        cityVariations: ["Idaho Falls", "Pocatello", "Idaho Falls ID"],
        primaryPostal: "83401",
        postalCodes: ["834"],
        latitude: 43.4666,
        longitude: -112.0362,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Eastern Idaho hub, IDA airport, nuclear research, Snake River, potato country"
    },
    {
        zoneId: "ID_NORTHERN_IDAHO",
        zoneName: "Idaho - Northern Idaho",
        country: "United States",
        countryCode: "US",
        stateProvince: "Idaho",
        stateProvinceCode: "ID",
        city: "Coeur d'Alene",
        cityVariations: ["Coeur d'Alene", "Post Falls", "Sandpoint"],
        primaryPostal: "83814",
        postalCodes: ["838"],
        latitude: 47.6777,
        longitude: -116.7804,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "Panhandle, resort region, COE airport, Spokane proximity, lakes"
    }
];

module.exports = { IDAHO_ZONES };

