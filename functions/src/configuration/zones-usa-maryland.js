/**
 * COMPLETE MARYLAND SHIPPING ZONES
 * All zones covering every shipping destination in Maryland
 */

const MARYLAND_ZONES = [
    {
        zoneId: "MD_BALTIMORE_PORT",
        zoneName: "Maryland - Baltimore Port",
        country: "United States",
        countryCode: "US",
        stateProvince: "Maryland",
        stateProvinceCode: "MD",
        city: "Baltimore",
        cityVariations: ["Baltimore", "Dundalk", "Baltimore MD"],
        primaryPostal: "21201",
        postalCodes: ["212"],
        latitude: 39.2904,
        longitude: -76.6122,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Charm City, Port of Baltimore, BWI airport, RORO/auto imports, Inner Harbor"
    },
    {
        zoneId: "MD_DC_SUBURBAN",
        zoneName: "Maryland - DC Suburban",
        country: "United States",
        countryCode: "US",
        stateProvince: "Maryland",
        stateProvinceCode: "MD",
        city: "Silver Spring",
        cityVariations: ["Silver Spring", "Rockville", "Gaithersburg", "Bethesda"],
        primaryPostal: "20901",
        postalCodes: ["209", "208"],
        latitude: 38.9907,
        longitude: -77.0261,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "DC Metro area, government contractors, biotech corridor, affluent suburbs"
    },
    {
        zoneId: "MD_ANNAPOLIS",
        zoneName: "Maryland - Annapolis",
        country: "United States",
        countryCode: "US",
        stateProvince: "Maryland",
        stateProvinceCode: "MD",
        city: "Annapolis",
        cityVariations: ["Annapolis", "Annapolis MD"],
        primaryPostal: "21401",
        postalCodes: ["214"],
        latitude: 38.9784,
        longitude: -76.4951,
        searchRadius: 12000,
        zoneType: "regional",
        notes: "State capital, Naval Academy, historic downtown, Chesapeake Bay"
    }
];

module.exports = { MARYLAND_ZONES };

