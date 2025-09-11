/**
 * COMPLETE GEORGIA SHIPPING ZONES
 * All zones covering every shipping destination in Georgia
 */

const GEORGIA_ZONES = [
    {
        zoneId: "GA_ATLANTA_METRO",
        zoneName: "Georgia - Atlanta Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Georgia",
        stateProvinceCode: "GA",
        city: "Atlanta",
        cityVariations: ["Atlanta", "Marietta", "Alpharetta", "Atlanta GA"],
        primaryPostal: "30303",
        postalCodes: ["303", "304", "305", "306", "307", "308", "309", "310", "311", "312", "313", "314", "315", "316", "317", "318", "319", "320", "321", "322", "300"],
        latitude: 33.7490,
        longitude: -84.3880,
        searchRadius: 35000,
        zoneType: "metropolitan",
        notes: "Capital of the South, ATL airport cargo hub, I-75/I-85 junction, CNN Center, Coca-Cola"
    },
    {
        zoneId: "GA_SAVANNAH_GARDEN_CITY",
        zoneName: "Georgia - Savannah Garden City",
        country: "United States",
        countryCode: "US",
        stateProvince: "Georgia",
        stateProvinceCode: "GA",
        city: "Savannah",
        cityVariations: ["Savannah", "Garden City", "Pooler", "Savannah GA"],
        primaryPostal: "31401",
        postalCodes: ["314", "313"],
        latitude: 32.0835,
        longitude: -81.0998,
        searchRadius: 20000,
        zoneType: "specialized",
        notes: "Major East Coast container port, historic district, SAV airport, SCAD"
    },
    {
        zoneId: "GA_AUGUSTA",
        zoneName: "Georgia - Augusta",
        country: "United States",
        countryCode: "US",
        stateProvince: "Georgia",
        stateProvinceCode: "GA",
        city: "Augusta",
        cityVariations: ["Augusta", "Evans", "Augusta GA"],
        primaryPostal: "30901",
        postalCodes: ["309"],
        latitude: 33.4735,
        longitude: -82.0105,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Garden City, Masters Tournament, Savannah River, AGS airport, cyber command"
    },
    {
        zoneId: "GA_MACON_WARNER_ROBINS",
        zoneName: "Georgia - Macon Warner Robins",
        country: "United States",
        countryCode: "US",
        stateProvince: "Georgia",
        stateProvinceCode: "GA",
        city: "Macon",
        cityVariations: ["Macon", "Warner Robins", "Macon GA"],
        primaryPostal: "31201",
        postalCodes: ["312", "310"],
        latitude: 32.8407,
        longitude: -83.6324,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "Heart of Georgia, Robins Air Force Base, MCN airport, I-75/I-16 junction"
    }
];

module.exports = { GEORGIA_ZONES };

