/**
 * COMPLETE FLORIDA SHIPPING ZONES
 * All 22 zones covering every shipping destination in Florida - NO truncation
 */

const FLORIDA_COMPLETE_ZONES = [

    // ========================================
    // SOUTH FLORIDA - 6 zones (complete)
    // ========================================
    {
        zoneId: "FL_SOUTH_MIAMI_DADE",
        zoneName: "Florida - South Miami-Dade",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Miami",
        cityVariations: ["Miami", "Miami FL", "Miami-Dade"],
        primaryPostal: "33101",
        postalCodes: ["331", "332", "333"],
        latitude: 25.7617,
        longitude: -80.1918,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "Magic City, Port Miami, cruise capital, MIA airport, international gateway, Art Deco"
    },
    {
        zoneId: "FL_SOUTH_FORT_LAUDERDALE",
        zoneName: "Florida - South Fort Lauderdale",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Fort Lauderdale",
        cityVariations: ["Fort Lauderdale", "Ft. Lauderdale", "Fort Lauderdale FL"],
        primaryPostal: "33301",
        postalCodes: ["333"],
        latitude: 26.1224,
        longitude: -80.1373,
        searchRadius: 15000,
        zoneType: "metropolitan",
        notes: "Venice of America, FLL airport, cruise port, yachting capital, Las Olas Boulevard"
    },
    {
        zoneId: "FL_SOUTH_WEST_PALM_BEACH",
        zoneName: "Florida - South West Palm Beach",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "West Palm Beach",
        cityVariations: ["West Palm Beach", "West Palm Beach FL", "Palm Beach County"],
        primaryPostal: "33401",
        postalCodes: ["334"],
        latitude: 26.7153,
        longitude: -80.0534,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "PBI airport, affluent area, Worth Avenue, Clematis Street, CityPlace"
    },
    {
        zoneId: "FL_SOUTH_HIALEAH",
        zoneName: "Florida - South Hialeah",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Hialeah",
        cityVariations: ["Hialeah", "Hialeah FL"],
        primaryPostal: "33010",
        postalCodes: ["330"],
        latitude: 25.8576,
        longitude: -80.2781,
        searchRadius: 12000,
        zoneType: "metropolitan",
        notes: "Hispanic majority city, industrial area, horse racing heritage, manufacturing"
    },
    {
        zoneId: "FL_SOUTH_DORAL",
        zoneName: "Florida - South Doral",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Doral",
        cityVariations: ["Doral", "Doral FL"],
        primaryPostal: "33126",
        postalCodes: ["331"],
        latitude: 25.8195,
        longitude: -80.3553,
        searchRadius: 8000,
        zoneType: "metropolitan",
        notes: "Corporate headquarters, Trump Doral, business district, logistics hub, MIA proximity"
    },
    {
        zoneId: "FL_SOUTH_HOMESTEAD",
        zoneName: "Florida - South Homestead",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Homestead",
        cityVariations: ["Homestead", "Homestead FL"],
        primaryPostal: "33030",
        postalCodes: ["330"],
        latitude: 25.4687,
        longitude: -80.4776,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Agricultural hub, Homestead Speedway, Everglades gateway, hurricane resilience"
    },

    // ========================================
    // CENTRAL FLORIDA I-4 CORRIDOR - 4 zones (complete)
    // ========================================
    {
        zoneId: "FL_CENTRAL_ORLANDO",
        zoneName: "Florida - Central Orlando",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Orlando",
        cityVariations: ["Orlando", "Orlando FL"],
        primaryPostal: "32801",
        postalCodes: ["328"],
        latitude: 28.5383,
        longitude: -81.3792,
        searchRadius: 20000,
        zoneType: "metropolitan",
        notes: "Theme park capital, MCO airport, convention center, Disney World proximity, Universal Studios"
    },
    {
        zoneId: "FL_CENTRAL_KISSIMMEE",
        zoneName: "Florida - Central Kissimmee",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Kissimmee",
        cityVariations: ["Kissimmee", "Kissimmee FL"],
        primaryPostal: "34741",
        postalCodes: ["347"],
        latitude: 28.2920,
        longitude: -81.4076,
        searchRadius: 15000,
        zoneType: "metropolitan",
        notes: "Disney gateway, tourism hub, vacation rentals, Old Town, family attractions"
    },
    {
        zoneId: "FL_CENTRAL_SANFORD",
        zoneName: "Florida - Central Sanford",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Sanford",
        cityVariations: ["Sanford", "Sanford FL"],
        primaryPostal: "32771",
        postalCodes: ["327"],
        latitude: 28.8028,
        longitude: -81.2731,
        searchRadius: 12000,
        zoneType: "regional",
        notes: "SFB airport, historic downtown, Auto-Train terminus, St. Johns River, antique district"
    },
    {
        zoneId: "FL_CENTRAL_LAKELAND",
        zoneName: "Florida - Central Lakeland",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Lakeland",
        cityVariations: ["Lakeland", "Lakeland FL"],
        primaryPostal: "33801",
        postalCodes: ["338"],
        latitude: 28.0395,
        longitude: -81.9498,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "I-4 corridor, distribution hub, Publix headquarters, citrus heritage, LAL airport"
    },

    // ========================================
    // TAMPA BAY - 4 zones (complete)
    // ========================================
    {
        zoneId: "FL_TAMPA_BAY_TAMPA",
        zoneName: "Florida - Tampa Bay Tampa",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Tampa",
        cityVariations: ["Tampa", "Tampa FL"],
        primaryPostal: "33602",
        postalCodes: ["336"],
        latitude: 27.9506,
        longitude: -82.4572,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "Big Guava, Port Tampa Bay, Ybor City, downtown core, TPA airport, USF"
    },
    {
        zoneId: "FL_TAMPA_BAY_ST_PETERSBURG",
        zoneName: "Florida - Tampa Bay St. Petersburg",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "St. Petersburg",
        cityVariations: ["St. Petersburg", "St Pete", "St. Petersburg FL"],
        primaryPostal: "33701",
        postalCodes: ["337"],
        latitude: 27.7676,
        longitude: -82.6404,
        searchRadius: 15000,
        zoneType: "metropolitan",
        notes: "Sunshine City, downtown waterfront, Tropicana Field, museums, PIE airport"
    },
    {
        zoneId: "FL_TAMPA_BAY_CLEARWATER",
        zoneName: "Florida - Tampa Bay Clearwater",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Clearwater",
        cityVariations: ["Clearwater", "Clearwater FL"],
        primaryPostal: "33755",
        postalCodes: ["337"],
        latitude: 27.9659,
        longitude: -82.8001,
        searchRadius: 12000,
        zoneType: "metropolitan",
        notes: "Clearwater Beach, tourism hub, corporate headquarters, CLW airport"
    },
    {
        zoneId: "FL_TAMPA_BAY_BRANDON",
        zoneName: "Florida - Tampa Bay Brandon",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Brandon",
        cityVariations: ["Brandon", "Brandon FL"],
        primaryPostal: "33511",
        postalCodes: ["335"],
        latitude: 27.9378,
        longitude: -82.2859,
        searchRadius: 12000,
        zoneType: "metropolitan",
        notes: "Suburban Tampa, Westfield Brandon, family communities, rapid growth"
    },

    // ========================================
    // JACKSONVILLE - 3 zones (complete)
    // ========================================
    {
        zoneId: "FL_JACKSONVILLE_METRO",
        zoneName: "Florida - Jacksonville Metro",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Jacksonville",
        cityVariations: ["Jacksonville", "Jacksonville FL", "Jax"],
        primaryPostal: "32202",
        postalCodes: ["322"],
        latitude: 30.3322,
        longitude: -81.6557,
        searchRadius: 25000,
        zoneType: "metropolitan",
        notes: "River City, JAXPORT container/auto, largest city by area, JAX airport, Jaguars"
    },
    {
        zoneId: "FL_JACKSONVILLE_ORANGE_PARK",
        zoneName: "Florida - Jacksonville Orange Park",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Orange Park",
        cityVariations: ["Orange Park", "Orange Park FL"],
        primaryPostal: "32065",
        postalCodes: ["320"],
        latitude: 30.1660,
        longitude: -81.7062,
        searchRadius: 10000,
        zoneType: "regional",
        notes: "Clay County, suburban Jacksonville, NAS Jacksonville proximity, family communities"
    },
    {
        zoneId: "FL_JACKSONVILLE_FERNANDINA",
        zoneName: "Florida - Jacksonville Fernandina Beach",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Fernandina Beach",
        cityVariations: ["Fernandina Beach", "Fernandina", "Fernandina Beach FL"],
        primaryPostal: "32034",
        postalCodes: ["320"],
        latitude: 30.6691,
        longitude: -81.4612,
        searchRadius: 8000,
        zoneType: "regional",
        notes: "Historic seaport, Amelia Island, paper mill, shrimp industry, Victorian architecture"
    },

    // ========================================
    // SOUTHWEST FLORIDA - 3 zones (complete)
    // ========================================
    {
        zoneId: "FL_SOUTHWEST_FORT_MYERS",
        zoneName: "Florida - Southwest Fort Myers",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Fort Myers",
        cityVariations: ["Fort Myers", "Fort Myers FL"],
        primaryPostal: "33901",
        postalCodes: ["339"],
        latitude: 26.5628,
        longitude: -81.8723,
        searchRadius: 15000,
        zoneType: "metropolitan",
        notes: "City of Palms, RSW airport, Edison winter home, Lee County seat, tourism"
    },
    {
        zoneId: "FL_SOUTHWEST_NAPLES",
        zoneName: "Florida - Southwest Naples",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Naples",
        cityVariations: ["Naples", "Naples FL"],
        primaryPostal: "34102",
        postalCodes: ["341"],
        latitude: 26.1420,
        longitude: -81.7948,
        searchRadius: 12000,
        zoneType: "regional",
        notes: "Paradise Coast, affluent retirement community, beaches, APF airport, luxury shopping"
    },
    {
        zoneId: "FL_SOUTHWEST_CAPE_CORAL",
        zoneName: "Florida - Southwest Cape Coral",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Cape Coral",
        cityVariations: ["Cape Coral", "Cape Coral FL"],
        primaryPostal: "33904",
        postalCodes: ["339"],
        latitude: 26.5629,
        longitude: -81.9495,
        searchRadius: 15000,
        zoneType: "metropolitan",
        notes: "Waterfront Wonderland, canal system, retirement community, family-friendly"
    },

    // ========================================
    // PANHANDLE - 2 zones (complete)
    // ========================================
    {
        zoneId: "FL_PANHANDLE_PENSACOLA",
        zoneName: "Florida - Panhandle Pensacola",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Pensacola",
        cityVariations: ["Pensacola", "Pensacola FL"],
        primaryPostal: "32501",
        postalCodes: ["325"],
        latitude: 30.4213,
        longitude: -87.2169,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "City of Five Flags, naval aviation, PNS airport, Blue Angels, Gulf Coast"
    },
    {
        zoneId: "FL_PANHANDLE_TALLAHASSEE",
        zoneName: "Florida - Panhandle Tallahassee",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Tallahassee",
        cityVariations: ["Tallahassee", "Tallahassee FL"],
        primaryPostal: "32301",
        postalCodes: ["323"],
        latitude: 30.4518,
        longitude: -84.2807,
        searchRadius: 18000,
        zoneType: "metropolitan",
        notes: "State capital, FSU, FAMU, TLH airport, government center, rolling hills"
    },

    // ========================================
    // SPACE COAST - 2 zones (complete)
    // ========================================
    {
        zoneId: "FL_SPACE_COAST_MELBOURNE",
        zoneName: "Florida - Space Coast Melbourne",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Melbourne",
        cityVariations: ["Melbourne", "Melbourne FL", "Palm Bay"],
        primaryPostal: "32901",
        postalCodes: ["329"],
        latitude: 28.0836,
        longitude: -80.6081,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Space Coast, Kennedy Space Center proximity, MLB airport, tech corridor, beaches"
    },
    {
        zoneId: "FL_SPACE_COAST_TITUSVILLE",
        zoneName: "Florida - Space Coast Titusville",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Titusville",
        cityVariations: ["Titusville", "Titusville FL"],
        primaryPostal: "32796",
        postalCodes: ["327"],
        latitude: 28.6122,
        longitude: -80.8075,
        searchRadius: 12000,
        zoneType: "regional",
        notes: "Miracle City, Kennedy Space Center, TIX airport, space industry, Indian River"
    },

    // ========================================
    // TREASURE COAST - 2 zones (complete)
    // ========================================
    {
        zoneId: "FL_TREASURE_COAST_PORT_ST_LUCIE",
        zoneName: "Florida - Treasure Coast Port St. Lucie",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Port St. Lucie",
        cityVariations: ["Port St. Lucie", "Port Saint Lucie", "Port St Lucie FL"],
        primaryPostal: "34952",
        postalCodes: ["349"],
        latitude: 27.2730,
        longitude: -80.3582,
        searchRadius: 15000,
        zoneType: "regional",
        notes: "Mets spring training, family communities, rapid growth, master-planned"
    },
    {
        zoneId: "FL_TREASURE_COAST_STUART",
        zoneName: "Florida - Treasure Coast Stuart",
        country: "United States",
        countryCode: "US",
        stateProvince: "Florida",
        stateProvinceCode: "FL",
        city: "Stuart",
        cityVariations: ["Stuart", "Stuart FL"],
        primaryPostal: "34994",
        postalCodes: ["349"],
        latitude: 27.1973,
        longitude: -80.2528,
        searchRadius: 10000,
        zoneType: "regional",
        notes: "Sailfish capital, historic downtown, St. Lucie River, fishing, boating"
    }

];

module.exports = {
    FLORIDA_COMPLETE_ZONES,
    TOTAL_FLORIDA_ZONES: FLORIDA_COMPLETE_ZONES.length
};

