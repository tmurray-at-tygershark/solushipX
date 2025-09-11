/**
 * COMPLETE WEST VIRGINIA SHIPPING ZONES
 * All zones covering every shipping destination in West Virginia
 */

const WEST_VIRGINIA_ZONES = [
    {
        zoneId: "WV_CHARLESTON_HUNTINGTON",
        zoneName: "West Virginia - Charleston Huntington",
        country: "United States",
        countryCode: "US",
        stateProvince: "West Virginia",
        stateProvinceCode: "WV",
        city: "Charleston",
        cityVariations: ["Charleston", "Huntington", "Charleston WV"],
        primaryPostal: "25301",
        postalCodes: ["253", "257"],
        latitude: 38.3498,
        longitude: -81.6326,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "State capital, CRW airport, chemical valley, coal heritage, Ohio River, Kanawha River"
    },
    {
        zoneId: "WV_MORGANTOWN",
        zoneName: "West Virginia - Morgantown",
        country: "United States",
        countryCode: "US",
        stateProvince: "West Virginia",
        stateProvinceCode: "WV",
        city: "Morgantown",
        cityVariations: ["Morgantown", "Morgantown WV"],
        primaryPostal: "26501",
        postalCodes: ["265"],
        latitude: 39.6295,
        longitude: -79.9553,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "WVU campus, MGW airport, coal research, Pennsylvania border, Monongahela River"
    }
];

module.exports = { WEST_VIRGINIA_ZONES };

