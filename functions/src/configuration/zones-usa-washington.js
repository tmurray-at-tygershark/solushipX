/**
 * COMPLETE WASHINGTON SHIPPING ZONES
 * All zones covering every shipping destination in Washington
 */

const WASHINGTON_ZONES = [
    {
        zoneId: "WA_SEATTLE_TACOMA",
        zoneName: "Washington - Seattle Tacoma",
        country: "United States",
        countryCode: "US",
        stateProvince: "Washington",
        stateProvinceCode: "WA",
        city: "Seattle",
        cityVariations: ["Seattle", "Tacoma", "Kent", "Auburn"],
        primaryPostal: "98101",
        postalCodes: ["981", "984", "980"],
        latitude: 47.6062,
        longitude: -122.3321,
        searchRadius: 30000,
        zoneType: "metropolitan",
        notes: "Emerald City, major container port, SEA airport, Amazon/Microsoft, Kent Valley DCs"
    },
    {
        zoneId: "WA_SPOKANE_INLAND_NW",
        zoneName: "Washington - Spokane Inland NW",
        country: "United States",
        countryCode: "US",
        stateProvince: "Washington",
        stateProvinceCode: "WA",
        city: "Spokane",
        cityVariations: ["Spokane", "Spokane WA"],
        primaryPostal: "99201",
        postalCodes: ["992"],
        latitude: 47.6587,
        longitude: -117.4260,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Inland Northwest hub, GEG airport, eastern Washington gateway, Expo '74 legacy"
    },
    {
        zoneId: "WA_TRI_CITIES",
        zoneName: "Washington - Tri-Cities",
        country: "United States",
        countryCode: "US",
        stateProvince: "Washington",
        stateProvinceCode: "WA",
        city: "Kennewick",
        cityVariations: ["Kennewick", "Pasco", "Richland", "Tri-Cities"],
        primaryPostal: "99336",
        postalCodes: ["993"],
        latitude: 46.2112,
        longitude: -119.1372,
        searchRadius: 20000,
        zoneType: "regional",
        notes: "Nuclear reservation, wine country, Columbia River, PSC airport, agriculture"
    },
    {
        zoneId: "WA_OLYMPIA_SOUTHWEST",
        zoneName: "Washington - Olympia Southwest",
        country: "United States",
        countryCode: "US",
        stateProvince: "Washington",
        stateProvinceCode: "WA",
        city: "Olympia",
        cityVariations: ["Olympia", "Centralia", "Chehalis"],
        primaryPostal: "98501",
        postalCodes: ["985"],
        latitude: 47.0379,
        longitude: -122.9015,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "State capital, Evergreen State College, Puget Sound, government center, timber"
    }
];

module.exports = { WASHINGTON_ZONES };

