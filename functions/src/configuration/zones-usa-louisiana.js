/**
 * COMPLETE LOUISIANA SHIPPING ZONES
 * All zones covering every shipping destination in Louisiana
 */

const LOUISIANA_ZONES = [
    {
        zoneId: "LA_NEW_ORLEANS_PORT",
        zoneName: "Louisiana - New Orleans Port",
        country: "United States",
        countryCode: "US",
        stateProvince: "Louisiana",
        stateProvinceCode: "LA",
        city: "New Orleans",
        cityVariations: ["New Orleans", "Jefferson Parish", "Kenner", "New Orleans LA"],
        primaryPostal: "70112",
        postalCodes: ["701"],
        latitude: 29.9511,
        longitude: -90.0715,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Crescent City, Port NOLA, MSY airport, French Quarter, petrochemical corridor"
    },
    {
        zoneId: "LA_BATON_ROUGE_INDUSTRIAL",
        zoneName: "Louisiana - Baton Rouge Industrial",
        country: "United States",
        countryCode: "US",
        stateProvince: "Louisiana",
        stateProvinceCode: "LA",
        city: "Baton Rouge",
        cityVariations: ["Baton Rouge", "Gonzales", "Baton Rouge LA"],
        primaryPostal: "70801",
        postalCodes: ["708"],
        latitude: 30.4515,
        longitude: -91.1871,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "State capital, LSU, BTR airport, petrochemical corridor on Mississippi"
    },
    {
        zoneId: "LA_SHREVEPORT_BOSSIER",
        zoneName: "Louisiana - Shreveport Bossier",
        country: "United States",
        countryCode: "US",
        stateProvince: "Louisiana",
        stateProvinceCode: "LA",
        city: "Shreveport",
        cityVariations: ["Shreveport", "Bossier City", "Shreveport LA"],
        primaryPostal: "71101",
        postalCodes: ["711"],
        latitude: 32.5252,
        longitude: -93.7502,
        searchRadius: 18000,
        zoneType: "regional",
        notes: "ArkLaTex hub, SHV airport, casinos, oil and gas, Red River"
    },
    {
        zoneId: "LA_LAFAYETTE",
        zoneName: "Louisiana - Lafayette",
        country: "United States",
        countryCode: "US",
        stateProvince: "Louisiana",
        stateProvinceCode: "LA",
        city: "Lafayette",
        cityVariations: ["Lafayette", "Lafayette LA"],
        primaryPostal: "70501",
        postalCodes: ["705"],
        latitude: 30.2241,
        longitude: -92.0198,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Hub City, oil and gas, University of Louisiana, LFT airport, Cajun culture"
    }
];

module.exports = { LOUISIANA_ZONES };

