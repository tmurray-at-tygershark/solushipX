/**
 * COMPLETE VERMONT SHIPPING ZONES
 * All zones covering every shipping destination in Vermont
 */

const VERMONT_ZONES = [
    {
        zoneId: "VT_BURLINGTON_CHAMPLAIN",
        zoneName: "Vermont - Burlington Champlain",
        country: "United States",
        countryCode: "US",
        stateProvince: "Vermont",
        stateProvinceCode: "VT",
        city: "Burlington",
        cityVariations: ["Burlington", "South Burlington", "Burlington VT"],
        primaryPostal: "05401",
        postalCodes: ["054"],
        latitude: 44.4759,
        longitude: -73.2121,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Queen City, BTV airport, UVM, Lake Champlain, I-89/I-87 cross-border lanes"
    },
    {
        zoneId: "VT_MONTPELIER_CENTRAL",
        zoneName: "Vermont - Montpelier Central",
        country: "United States",
        countryCode: "US",
        stateProvince: "Vermont",
        stateProvinceCode: "VT",
        city: "Montpelier",
        cityVariations: ["Montpelier", "Barre", "Montpelier VT"],
        primaryPostal: "05601",
        postalCodes: ["056"],
        latitude: 44.2601,
        longitude: -72.5806,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "State capital, smallest state capital, government center, granite heritage, Green Mountains"
    }
];

module.exports = { VERMONT_ZONES };

