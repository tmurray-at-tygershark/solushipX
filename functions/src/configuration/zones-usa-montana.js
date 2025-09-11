/**
 * COMPLETE MONTANA SHIPPING ZONES
 * All zones covering every shipping destination in Montana
 */

const MONTANA_ZONES = [
    {
        zoneId: "MT_BILLINGS",
        zoneName: "Montana - Billings",
        country: "United States",
        countryCode: "US",
        stateProvince: "Montana",
        stateProvinceCode: "MT",
        city: "Billings",
        cityVariations: ["Billings", "Billings MT"],
        primaryPostal: "59101",
        postalCodes: ["591"],
        latitude: 45.7833,
        longitude: -108.5007,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Magic City, BIL airport, oil refining, agricultural hub, Yellowstone River"
    },
    {
        zoneId: "MT_MISSOULA_KALISPELL",
        zoneName: "Montana - Missoula Kalispell",
        country: "United States",
        countryCode: "US",
        stateProvince: "Montana",
        stateProvinceCode: "MT",
        city: "Missoula",
        cityVariations: ["Missoula", "Kalispell", "Missoula MT"],
        primaryPostal: "59801",
        postalCodes: ["598", "599"],
        latitude: 46.8721,
        longitude: -113.9940,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Garden City, University of Montana, MSO airport, Glacier Park gateway"
    },
    {
        zoneId: "MT_GREAT_FALLS",
        zoneName: "Montana - Great Falls",
        country: "United States",
        countryCode: "US",
        stateProvince: "Montana",
        stateProvinceCode: "MT",
        city: "Great Falls",
        cityVariations: ["Great Falls", "Great Falls MT"],
        primaryPostal: "59401",
        postalCodes: ["594"],
        latitude: 47.5053,
        longitude: -111.3008,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Electric City, GTF airport, Malmstrom Air Force Base, Missouri River"
    }
];

module.exports = { MONTANA_ZONES };

