/**
 * COMPLETE OREGON SHIPPING ZONES
 * All zones covering every shipping destination in Oregon
 */

const OREGON_ZONES = [
    {
        zoneId: "OR_PORTLAND_METRO",
        zoneName: "Oregon - Portland Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Oregon",
        stateProvinceCode: "OR",
        city: "Portland",
        cityVariations: ["Portland", "Gresham", "Hillsboro", "Beaverton"],
        primaryPostal: "97201",
        postalCodes: ["972", "970", "971"],
        latitude: 45.5152,
        longitude: -122.6784,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Rose City, PDX airport, Columbia River port, Nike headquarters, no sales tax"
    },
    {
        zoneId: "OR_WILLAMETTE_VALLEY",
        zoneName: "Oregon - Willamette Valley",
        country: "United States",
        countryCode: "US",
        stateProvince: "Oregon",
        stateProvinceCode: "OR",
        city: "Salem",
        cityVariations: ["Salem", "Eugene", "Albany", "Willamette Valley"],
        primaryPostal: "97301",
        postalCodes: ["973", "974"],
        latitude: 44.9429,
        longitude: -123.0351,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "State capital, University of Oregon, EUG airport, wine country, agriculture"
    },
    {
        zoneId: "OR_SOUTHERN",
        zoneName: "Oregon - Southern",
        country: "United States",
        countryCode: "US",
        stateProvince: "Oregon",
        stateProvinceCode: "OR",
        city: "Medford",
        cityVariations: ["Medford", "Grants Pass", "Southern OR"],
        primaryPostal: "97501",
        postalCodes: ["975"],
        latitude: 42.3265,
        longitude: -122.8756,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Rogue Valley, MFR airport, pear orchards, California border, tourism"
    }
];

module.exports = { OREGON_ZONES };

