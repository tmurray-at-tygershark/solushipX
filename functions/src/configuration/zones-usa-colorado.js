/**
 * COMPLETE COLORADO SHIPPING ZONES
 * All zones covering every shipping destination in Colorado
 */

const COLORADO_ZONES = [
    {
        zoneId: "CO_DENVER_FRONT_RANGE",
        zoneName: "Colorado - Denver Front Range",
        country: "United States",
        countryCode: "US",
        stateProvince: "Colorado",
        stateProvinceCode: "CO",
        city: "Denver",
        cityVariations: ["Denver", "Aurora", "Lakewood", "Commerce City"],
        primaryPostal: "80202",
        postalCodes: ["802", "800"],
        latitude: 39.7392,
        longitude: -104.9903,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Mile High City, DEN airport cargo, I-70/I-25 junction, state capital, craft brewing"
    },
    {
        zoneId: "CO_COLORADO_SPRINGS_PUEBLO",
        zoneName: "Colorado - Colorado Springs Pueblo",
        country: "United States",
        countryCode: "US",
        stateProvince: "Colorado",
        stateProvinceCode: "CO",
        city: "Colorado Springs",
        cityVariations: ["Colorado Springs", "Pueblo", "Colorado Springs CO"],
        primaryPostal: "80903",
        postalCodes: ["809", "810"],
        latitude: 38.8339,
        longitude: -104.8214,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Olympic City, Pikes Peak, Air Force Academy, COS airport, military hub"
    },
    {
        zoneId: "CO_NORTHERN_COLORADO",
        zoneName: "Colorado - Northern Colorado",
        country: "United States",
        countryCode: "US",
        stateProvince: "Colorado",
        stateProvinceCode: "CO",
        city: "Fort Collins",
        cityVariations: ["Fort Collins", "Greeley", "Loveland", "Fort Collins CO"],
        primaryPostal: "80521",
        postalCodes: ["805", "806"],
        latitude: 40.5853,
        longitude: -105.0844,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Choice City, Colorado State University, craft brewing, tech corridor, agriculture"
    }
];

module.exports = { COLORADO_ZONES };

