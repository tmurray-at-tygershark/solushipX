/**
 * COMPLETE CONNECTICUT SHIPPING ZONES
 * All zones covering every shipping destination in Connecticut
 */

const CONNECTICUT_ZONES = [
    {
        zoneId: "CT_HARTFORD_SPRINGFIELD_CORRIDOR",
        zoneName: "Connecticut - Hartford Springfield Corridor",
        country: "United States",
        countryCode: "US",
        stateProvince: "Connecticut",
        stateProvinceCode: "CT",
        city: "Hartford",
        cityVariations: ["Hartford", "New Britain", "Manchester", "Hartford CT"],
        primaryPostal: "06101",
        postalCodes: ["061"],
        latitude: 41.7658,
        longitude: -72.6734,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Insurance capital, state capital, BDL airport, I-84/I-91 junction"
    },
    {
        zoneId: "CT_FAIRFIELD_NEW_HAVEN",
        zoneName: "Connecticut - Fairfield New Haven",
        country: "United States",
        countryCode: "US",
        stateProvince: "Connecticut",
        stateProvinceCode: "CT",
        city: "Stamford",
        cityVariations: ["Stamford", "Norwalk", "Bridgeport", "New Haven"],
        primaryPostal: "06901",
        postalCodes: ["069", "068", "066", "065"],
        latitude: 41.0534,
        longitude: -73.5387,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Corporate headquarters, hedge funds, Yale University, NYC metro spillover"
    },
    {
        zoneId: "CT_EASTERN_CT",
        zoneName: "Connecticut - Eastern CT",
        country: "United States",
        countryCode: "US",
        stateProvince: "Connecticut",
        stateProvinceCode: "CT",
        city: "New London",
        cityVariations: ["New London", "Norwich", "Eastern CT"],
        primaryPostal: "06320",
        postalCodes: ["063"],
        latitude: 41.3556,
        longitude: -72.0995,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Submarine base, casinos, Thames River, Coast Guard Academy"
    }
];

module.exports = { CONNECTICUT_ZONES };

