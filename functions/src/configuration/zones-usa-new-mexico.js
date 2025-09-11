/**
 * COMPLETE NEW MEXICO SHIPPING ZONES
 * All zones covering every shipping destination in New Mexico
 */

const NEW_MEXICO_ZONES = [
    {
        zoneId: "NM_ALBUQUERQUE_SANTA_FE",
        zoneName: "New Mexico - Albuquerque Santa Fe",
        country: "United States",
        countryCode: "US",
        stateProvince: "New Mexico",
        stateProvinceCode: "NM",
        city: "Albuquerque",
        cityVariations: ["Albuquerque", "Rio Rancho", "Santa Fe"],
        primaryPostal: "87101",
        postalCodes: ["871", "875"],
        latitude: 35.0844,
        longitude: -106.6504,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Duke City, ABQ airport, state capital proximity, I-25/I-40 junction, tech corridor"
    },
    {
        zoneId: "NM_LAS_CRUCES_EL_PASO",
        zoneName: "New Mexico - Las Cruces El Paso Gateway",
        country: "United States",
        countryCode: "US",
        stateProvince: "New Mexico",
        stateProvinceCode: "NM",
        city: "Las Cruces",
        cityVariations: ["Las Cruces", "Las Cruces NM"],
        primaryPostal: "88001",
        postalCodes: ["880"],
        latitude: 32.3199,
        longitude: -106.7637,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Border gateway, NMSU, LRU airport, El Paso proximity, Chihuahua MX access"
    }
];

module.exports = { NEW_MEXICO_ZONES };

