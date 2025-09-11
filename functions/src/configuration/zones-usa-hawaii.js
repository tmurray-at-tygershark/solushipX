/**
 * COMPLETE HAWAII SHIPPING ZONES
 * All zones covering every shipping destination in Hawaii
 */

const HAWAII_ZONES = [
    {
        zoneId: "HI_OAHU_HONOLULU",
        zoneName: "Hawaii - Oahu Honolulu",
        country: "United States",
        countryCode: "US",
        stateProvince: "Hawaii",
        stateProvinceCode: "HI",
        city: "Honolulu",
        cityVariations: ["Honolulu", "Pearl City", "Kaneohe", "Honolulu HI"],
        primaryPostal: "96801",
        postalCodes: ["968"],
        latitude: 21.3099,
        longitude: -157.8581,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "State capital, HNL airport, Pearl Harbor, Waikiki, tourism hub, Pacific gateway"
    },
    {
        zoneId: "HI_BIG_ISLAND_HILO_KONA",
        zoneName: "Hawaii - Big Island Hilo Kona",
        country: "United States",
        countryCode: "US",
        stateProvince: "Hawaii",
        stateProvinceCode: "HI",
        city: "Hilo",
        cityVariations: ["Hilo", "Kona", "Kailua-Kona", "Big Island"],
        primaryPostal: "96720",
        postalCodes: ["967"],
        latitude: 19.7297,
        longitude: -155.0900,
        searchRadius: 30000,
        zoneType: "regional",
        notes: "Big Island, volcanoes, coffee, ITO/KOA airports, astronomy, agriculture"
    },
    {
        zoneId: "HI_MAUI_MOLOKAI_LANAI",
        zoneName: "Hawaii - Maui Molokai Lanai",
        country: "United States",
        countryCode: "US",
        stateProvince: "Hawaii",
        stateProvinceCode: "HI",
        city: "Kahului",
        cityVariations: ["Kahului", "Lahaina", "Kihei", "Maui"],
        primaryPostal: "96732",
        postalCodes: ["967"],
        latitude: 20.8947,
        longitude: -156.4700,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Valley Isle, OGG airport, tourism, pineapple heritage, inter-island access"
    },
    {
        zoneId: "HI_KAUAI",
        zoneName: "Hawaii - Kauai",
        country: "United States",
        countryCode: "US",
        stateProvince: "Hawaii",
        stateProvinceCode: "HI",
        city: "Lihue",
        cityVariations: ["Lihue", "Kapaa", "Poipu", "Kauai"],
        primaryPostal: "96766",
        postalCodes: ["967"],
        latitude: 21.9788,
        longitude: -159.3710,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Garden Isle, LIH airport, Na Pali Coast, tourism, remote island access"
    }
];

module.exports = { HAWAII_ZONES };

