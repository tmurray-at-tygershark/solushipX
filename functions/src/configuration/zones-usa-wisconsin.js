/**
 * COMPLETE WISCONSIN SHIPPING ZONES
 * All zones covering every shipping destination in Wisconsin
 */

const WISCONSIN_ZONES = [
    {
        zoneId: "WI_MILWAUKEE_SOUTHEAST",
        zoneName: "Wisconsin - Milwaukee Southeast",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wisconsin",
        stateProvinceCode: "WI",
        city: "Milwaukee",
        cityVariations: ["Milwaukee", "Waukesha", "Racine", "Kenosha"],
        primaryPostal: "53202",
        postalCodes: ["532", "531", "534"],
        latitude: 43.0389,
        longitude: -87.9065,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Brew City, Harley-Davidson, Great Lakes port, MKE airport, brewing heritage"
    },
    {
        zoneId: "WI_MADISON",
        zoneName: "Wisconsin - Madison",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wisconsin",
        stateProvinceCode: "WI",
        city: "Madison",
        cityVariations: ["Madison", "Sun Prairie", "Madison WI"],
        primaryPostal: "53703",
        postalCodes: ["537"],
        latitude: 43.0731,
        longitude: -89.4012,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "State capital, University of Wisconsin, MSN airport, isthmus city, tech corridor"
    },
    {
        zoneId: "WI_GREEN_BAY_FOX_VALLEY",
        zoneName: "Wisconsin - Green Bay Fox Valley",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wisconsin",
        stateProvinceCode: "WI",
        city: "Green Bay",
        cityVariations: ["Green Bay", "Appleton", "Oshkosh", "Fox Valley"],
        primaryPostal: "54301",
        postalCodes: ["543", "549"],
        latitude: 44.5133,
        longitude: -88.0133,
        searchRadius: 25000,
        zoneType: "regional",
        notes: "Titletown, Packers, Lambeau Field, paper industry, GRB airport, ATW airport"
    },
    {
        zoneId: "WI_LA_CROSSE",
        zoneName: "Wisconsin - La Crosse",
        country: "United States",
        countryCode: "US",
        stateProvince: "Wisconsin",
        stateProvinceCode: "WI",
        city: "La Crosse",
        cityVariations: ["La Crosse", "La Crosse WI"],
        primaryPostal: "54601",
        postalCodes: ["546"],
        latitude: 43.8014,
        longitude: -91.2396,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Mississippi River, LSE airport, UW-La Crosse, Minnesota border, river port"
    }
];

module.exports = { WISCONSIN_ZONES };

