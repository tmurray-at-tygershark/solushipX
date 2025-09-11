/**
 * COMPLETE ALASKA SHIPPING ZONES
 * All zones covering every shipping destination in Alaska
 */

const ALASKA_ZONES = [
    {
        zoneId: "AK_ANCHORAGE",
        zoneName: "Alaska - Anchorage",
        country: "United States",
        countryCode: "US",
        stateProvince: "Alaska",
        stateProvinceCode: "AK",
        city: "Anchorage",
        cityVariations: ["Anchorage", "Anchorage AK"],
        primaryPostal: "99501",
        postalCodes: ["995"],
        latitude: 61.2181,
        longitude: -149.9003,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Largest city, ANC airport cargo hub, oil industry, military bases, air cargo gateway"
    },
    {
        zoneId: "AK_FAIRBANKS",
        zoneName: "Alaska - Fairbanks",
        country: "United States",
        countryCode: "US",
        stateProvince: "Alaska",
        stateProvinceCode: "AK",
        city: "Fairbanks",
        cityVariations: ["Fairbanks", "Fairbanks AK"],
        primaryPostal: "99701",
        postalCodes: ["997"],
        latitude: 64.8378,
        longitude: -147.7164,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Golden Heart City, University of Alaska, FAI airport, interior hub, midnight sun"
    },
    {
        zoneId: "AK_JUNEAU",
        zoneName: "Alaska - Juneau",
        country: "United States",
        countryCode: "US",
        stateProvince: "Alaska",
        stateProvinceCode: "AK",
        city: "Juneau",
        cityVariations: ["Juneau", "Juneau AK"],
        primaryPostal: "99801",
        postalCodes: ["998"],
        latitude: 58.3019,
        longitude: -134.4197,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "State capital, JNU airport, cruise ships, government center, glaciers"
    }
];

module.exports = { ALASKA_ZONES };

