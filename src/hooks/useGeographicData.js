/**
 * Geographic Data Hook
 * 
 * Provides access to the imported geographic database with
 * 427,316 postal/zip codes and 32,878 unique cities
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

export const useGeographicData = () => {
    const [loading, setLoading] = useState(false);
    const [cities, setCities] = useState([]);
    const [provinces, setProvinces] = useState([]);
    const [states, setStates] = useState([]);
    const [error, setError] = useState(null);

    // Load unique cities from the geographic database
    const loadCities = useCallback(async (countryFilter = null, searchTerm = '') => {
        setLoading(true);
        setError(null);
        
        try {
            // console.log('🔍 Searching for cities:', { searchTerm, countryFilter });
            
            // Search directly in geoLocations collection since geoCities might not exist
            let citiesQuery;
            
            if (searchTerm && searchTerm.length >= 2) {
                // Capitalize first letter for proper case matching
                const capitalizedSearch = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1).toLowerCase();
                const searchEnd = capitalizedSearch.replace(/.$/, c => String.fromCharCode(c.charCodeAt(0) + 1));
                
                // console.log('🔍 Search range:', capitalizedSearch, 'to', searchEnd);
                
                if (countryFilter) {
                    citiesQuery = query(
                        collection(db, 'geoLocations'),
                        where('country', '==', countryFilter),
                        where('city', '>=', capitalizedSearch),
                        where('city', '<', searchEnd),
                        orderBy('city'),
                        limit(100)
                    );
                } else {
                    citiesQuery = query(
                        collection(db, 'geoLocations'),
                        where('city', '>=', capitalizedSearch),
                        where('city', '<', searchEnd),
                        orderBy('city'),
                        limit(100)
                    );
                }
            } else if (!searchTerm) {
                // If no search term, get a sample of cities
                if (countryFilter) {
                    citiesQuery = query(
                        collection(db, 'geoLocations'),
                        where('country', '==', countryFilter),
                        orderBy('city'),
                        limit(50)
                    );
                } else {
                    citiesQuery = query(
                        collection(db, 'geoLocations'),
                        orderBy('city'),
                        limit(50)
                    );
                }
            } else {
                // Search term too short, return empty
                setCities([]);
                return [];
            }

            const querySnapshot = await getDocs(citiesQuery);
            // console.log('📊 Query results:', querySnapshot.size);
            
            // Remove duplicates and format data (prioritize records with coordinates)
            const cityMap = new Map();
            querySnapshot.docs.forEach(doc => {
                const data = doc.data();
                const cityKey = `${data.city}-${data.provinceState}-${data.country}`;
                
                // If city doesn't exist, add it
                // If city exists but current record has coordinates and existing doesn't, replace it
                if (!cityMap.has(cityKey) || 
                    (data.latitude && data.longitude && !cityMap.get(cityKey).latitude)) {
                    cityMap.set(cityKey, {
                        id: doc.id,
                        city: data.city,
                        provinceState: data.provinceState,
                        provinceStateName: data.provinceStateName,
                        country: data.country,
                        countryName: data.countryName,
                        postalCode: data.postalZipCode,
                        latitude: data.latitude,
                        longitude: data.longitude,
                        searchKey: cityKey.toLowerCase()
                    });
                }
            });
            
            const citiesData = Array.from(cityMap.values()).sort((a, b) => a.city.localeCompare(b.city));
            // console.log('✅ Unique cities found:', citiesData.length);

            setCities(citiesData);
            return citiesData;
        } catch (err) {
            // console.error('❌ Error loading cities:', err);
            setError('Failed to load cities');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    // Load provinces/states summary
    const loadRegions = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const regionsQuery = query(
                collection(db, 'geoProvincesStates'),
                orderBy('regionName')
            );

            const querySnapshot = await getDocs(regionsQuery);
            const regionsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Separate provinces and states
            const provincesData = regionsData.filter(region => region.country === 'CA');
            const statesData = regionsData.filter(region => region.country === 'US');

            setProvinces(provincesData);
            setStates(statesData);
            
            return { provinces: provincesData, states: statesData };
        } catch (err) {
            // console.error('Error loading regions:', err);
            setError('Failed to load regions');
            return { provinces: [], states: [] };
        } finally {
            setLoading(false);
        }
    }, []);

    // Search cities with debouncing
    const searchCities = useCallback(async (searchTerm, countryFilter = null) => {
        // Allow empty search term for country-based queries
        if (searchTerm && searchTerm.length < 2 && !countryFilter) {
            return [];
        }
        
        return await loadCities(countryFilter, searchTerm);
    }, [loadCities]);

    // Load cities by country (for geographic zone selections)
    const loadCitiesByCountry = useCallback(async (countryFilter) => {
        if (!countryFilter) return [];
        
        return await loadCities(countryFilter, '');
    }, [loadCities]);

    // Get city details by postal/zip code
    const getCityByPostalCode = useCallback(async (postalCode) => {
        if (!postalCode) return null;
        
        try {
            const locationsQuery = query(
                collection(db, 'geoLocations'),
                where('postalZipCode', '==', postalCode.toUpperCase()),
                limit(1)
            );

            const querySnapshot = await getDocs(locationsQuery);
            if (!querySnapshot.empty) {
                return {
                    id: querySnapshot.docs[0].id,
                    ...querySnapshot.docs[0].data()
                };
            }
            return null;
        } catch (err) {
            // console.error('Error getting city by postal code:', err);
            return null;
        }
    }, []);

    // Get all locations for a specific city
    const getLocationsByCity = useCallback(async (cityName, provinceState = null, country = null) => {
        if (!cityName) return [];
        
        try {
            let locationsQuery = query(
                collection(db, 'geoLocations'),
                where('city', '==', cityName)
            );

            if (provinceState) {
                locationsQuery = query(
                    locationsQuery,
                    where('provinceState', '==', provinceState)
                );
            }

            if (country) {
                locationsQuery = query(
                    locationsQuery,
                    where('country', '==', country)
                );
            }

            const querySnapshot = await getDocs(locationsQuery);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (err) {
            // console.error('Error getting locations by city:', err);
            return [];
        }
    }, []);

    // Advanced smart filtering functions
    const getMajorCitiesByRegion = useCallback(async (country, region = null, populationTier = 'major') => {
        setLoading(true);
        setError(null);
        
        try {
            // console.log('🔍 getMajorCitiesByRegion called with:', { country, region, populationTier });
            
            // Major cities for different countries
            const majorCities = {
                'CA': ['Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Ottawa', 'Edmonton', 
                       'Quebec City', 'Winnipeg', 'Hamilton', 'Kitchener', 'London', 'Victoria',
                       'Halifax', 'Oshawa', 'Windsor', 'Saskatoon', 'Regina', 'St. Catharines',
                       'Kelowna', 'Barrie', 'Sherbrooke', 'Guelph', 'Kanata', 'Abbotsford'],
                'US': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
                       'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
                       'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis',
                       'Seattle', 'Denver', 'Washington', 'Boston', 'El Paso', 'Nashville',
                       'Detroit', 'Oklahoma City', 'Portland', 'Las Vegas', 'Memphis', 'Louisville',
                       'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Mesa',
                       'Sacramento', 'Atlanta', 'Kansas City', 'Colorado Springs', 'Omaha',
                       'Raleigh', 'Miami', 'Long Beach', 'Virginia Beach', 'Oakland', 'Minneapolis',
                       'Tulsa', 'Tampa', 'Arlington', 'New Orleans']
            };

            // console.log('🏙️ Major cities list for', country, ':', majorCities[country]);

            let citiesQuery = query(
                collection(db, 'geoLocations'),
                where('country', '==', country)
                // Removed orderBy and limit to get all cities before filtering for major ones
            );
            
            // console.log('🔍 Executing Firestore query for country:', country);

            if (region) {
                citiesQuery = query(
                    collection(db, 'geoLocations'),
                    where('country', '==', country),
                    where('provinceState', '==', region)
                    // Removed orderBy and limit to get all cities before filtering
                );
            }

            const querySnapshot = await getDocs(citiesQuery);
            let cities = querySnapshot.docs.map(doc => doc.data());
            

            // FIRST: Remove duplicates by city name (ignore different postal codes)
            const cityMap = new Map();
            cities.forEach(city => {
                const cityKey = `${city.city}-${city.country}`.toLowerCase(); // Only city + country for deduplication
                if (!cityMap.has(cityKey)) {
                    cityMap.set(cityKey, {
                        id: city.id || cityKey,
                        city: city.city,
                        provinceState: city.provinceState,
                        provinceStateName: city.provinceStateName,
                        country: city.country,
                        countryName: city.countryName,
                        searchKey: cityKey,
                        postalCode: city.postalZipCode
                    });
                }
            });

            let uniqueCities = Array.from(cityMap.values());

            // THEN: Filter by major cities if specified
            if (populationTier === 'major') {
                const majorCityNames = majorCities[country] || [];
                // console.log('🎯 Filtering for major cities. Target list:', majorCityNames.slice(0, 10));
                
                uniqueCities = uniqueCities.filter(city => majorCityNames.includes(city.city));
                // console.log('✅ Filtered to major cities:', uniqueCities.length);
                // console.log('📋 Major cities found:', uniqueCities.map(c => c.city));
                
                // Limit to exactly 40 cities for "Top 40" selections
                if (uniqueCities.length > 40) {
                    uniqueCities = uniqueCities.slice(0, 40);
                    // console.log('🔢 Limited to top 40 cities');
                }
            }

            const result = uniqueCities;
            setCities(result);
            return result;
        } catch (err) {
            // console.error('Error loading major cities:', err);
            setError('Failed to load major cities');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getBorderCities = useCallback(async (borderType = 'US-CA') => {
        setLoading(true);
        setError(null);
        
        try {
            // Border cities along US-Canada border
            const borderCityPairs = [
                // Major border crossings
                { city: 'Detroit', provinceState: 'MI', country: 'US' },
                { city: 'Windsor', provinceState: 'ON', country: 'CA' },
                { city: 'Buffalo', provinceState: 'NY', country: 'US' },
                { city: 'Niagara Falls', provinceState: 'ON', country: 'CA' },
                { city: 'Seattle', provinceState: 'WA', country: 'US' },
                { city: 'Vancouver', provinceState: 'BC', country: 'CA' },
                { city: 'Blaine', provinceState: 'WA', country: 'US' },
                { city: 'Surrey', provinceState: 'BC', country: 'CA' },
                { city: 'Sault Ste. Marie', provinceState: 'MI', country: 'US' },
                { city: 'Sault Ste. Marie', provinceState: 'ON', country: 'CA' },
                { city: 'International Falls', provinceState: 'MN', country: 'US' },
                { city: 'Fort Frances', provinceState: 'ON', country: 'CA' },
                { city: 'Calais', provinceState: 'ME', country: 'US' },
                { city: 'St. Stephen', provinceState: 'NB', country: 'CA' },
                { city: 'Portal', provinceState: 'ND', country: 'US' },
                { city: 'North Portal', provinceState: 'SK', country: 'CA' }
            ];

            const result = borderCityPairs.map((city, index) => ({
                id: `border-${index}`,
                city: city.city,
                provinceState: city.provinceState,
                provinceStateName: city.provinceState, // Simplified for border cities
                country: city.country,
                countryName: city.country === 'CA' ? 'Canada' : 'United States',
                searchKey: `${city.city.toLowerCase()}-${city.provinceState}-${city.country}`
            }));

            setCities(result);
            return result;
        } catch (err) {
            // console.error('Error loading border cities:', err);
            setError('Failed to load border cities');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getFreightHubs = useCallback(async (country, hubType = 'all') => {
        setLoading(true);
        setError(null);
        
        try {
            // Major freight and logistics hubs
            const freightHubs = {
                'CA': {
                    airports: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Winnipeg', 'Halifax'],
                    ports: ['Vancouver', 'Montreal', 'Halifax', 'Saint John', 'Toronto', 'Hamilton'],
                    rail: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Winnipeg', 'Edmonton'],
                    all: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Winnipeg', 'Halifax', 
                          'Edmonton', 'Hamilton', 'Saint John', 'Saskatoon', 'Regina']
                },
                'US': {
                    airports: ['Los Angeles', 'Chicago', 'Atlanta', 'Dallas', 'New York', 'Miami',
                              'Seattle', 'Houston', 'Phoenix', 'Denver', 'Memphis', 'Cincinnati'],
                    ports: ['Los Angeles', 'New York', 'Seattle', 'Houston', 'Oakland', 'Savannah',
                           'Norfolk', 'Charleston', 'Miami', 'Tampa', 'Baltimore', 'Boston'],
                    rail: ['Chicago', 'Los Angeles', 'Houston', 'Atlanta', 'Dallas', 'Kansas City',
                          'Memphis', 'New Orleans', 'Seattle', 'Denver', 'Minneapolis', 'Detroit'],
                    all: ['Los Angeles', 'Chicago', 'Atlanta', 'Houston', 'New York', 'Dallas',
                          'Seattle', 'Miami', 'Phoenix', 'Denver', 'Memphis', 'Oakland', 'Kansas City',
                          'Norfolk', 'Charleston', 'Tampa', 'Baltimore', 'Cincinnati', 'Savannah']
                }
            };

            const hubCities = freightHubs[country]?.[hubType] || freightHubs[country]?.all || [];
            
            let citiesQuery = query(
                collection(db, 'geoLocations'),
                where('country', '==', country),
                orderBy('city'),
                limit(100)
            );

            const querySnapshot = await getDocs(citiesQuery);
            let cities = querySnapshot.docs.map(doc => doc.data());

            // Filter by freight hub cities
            cities = cities.filter(city => hubCities.includes(city.city));

            // Remove duplicates
            const cityMap = new Map();
            cities.forEach(city => {
                const cityKey = `${city.city}-${city.provinceState}-${city.country}`;
                if (!cityMap.has(cityKey)) {
                    cityMap.set(cityKey, {
                        id: city.id || cityKey,
                        city: city.city,
                        provinceState: city.provinceState,
                        provinceStateName: city.provinceStateName,
                        country: city.country,
                        countryName: city.countryName,
                        searchKey: cityKey.toLowerCase()
                    });
                }
            });

            const result = Array.from(cityMap.values());
            setCities(result);
            return result;
        } catch (err) {
            // console.error('Error loading freight hubs:', err);
            setError('Failed to load freight hubs');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getCapitalCities = useCallback(async (country, capitalType = 'all') => {
        setLoading(true);
        setError(null);
        
        try {
            const capitals = {
                'CA': {
                    provincial: ['Toronto', 'Quebec City', 'Halifax', 'Fredericton', 'Charlottetown',
                               'St. John\'s', 'Winnipeg', 'Regina', 'Edmonton', 'Victoria'],
                    territorial: ['Yellowknife', 'Whitehorse', 'Iqaluit'],
                    all: ['Toronto', 'Quebec City', 'Halifax', 'Fredericton', 'Charlottetown',
                         'St. John\'s', 'Winnipeg', 'Regina', 'Edmonton', 'Victoria',
                         'Yellowknife', 'Whitehorse', 'Iqaluit']
                },
                'US': {
                    state: ['Albany', 'Annapolis', 'Atlanta', 'Augusta', 'Austin', 'Baton Rouge',
                           'Bismarck', 'Boise', 'Boston', 'Carson City', 'Charleston', 'Cheyenne',
                           'Columbia', 'Columbus', 'Concord', 'Denver', 'Des Moines', 'Dover',
                           'Frankfort', 'Harrisburg', 'Hartford', 'Helena', 'Honolulu', 'Indianapolis',
                           'Jackson', 'Jefferson City', 'Juneau', 'Lansing', 'Lincoln', 'Little Rock',
                           'Madison', 'Montgomery', 'Montpelier', 'Nashville', 'Oklahoma City',
                           'Olympia', 'Phoenix', 'Pierre', 'Providence', 'Raleigh', 'Richmond',
                           'Sacramento', 'Saint Paul', 'Salem', 'Salt Lake City', 'Santa Fe',
                           'Springfield', 'Tallahassee', 'Topeka', 'Trenton'],
                    all: ['Albany', 'Annapolis', 'Atlanta', 'Augusta', 'Austin', 'Baton Rouge',
                         'Bismarck', 'Boise', 'Boston', 'Carson City', 'Charleston', 'Cheyenne',
                         'Columbia', 'Columbus', 'Concord', 'Denver', 'Des Moines', 'Dover',
                         'Frankfort', 'Harrisburg', 'Hartford', 'Helena', 'Honolulu', 'Indianapolis',
                         'Jackson', 'Jefferson City', 'Juneau', 'Lansing', 'Lincoln', 'Little Rock',
                         'Madison', 'Montgomery', 'Montpelier', 'Nashville', 'Oklahoma City',
                         'Olympia', 'Phoenix', 'Pierre', 'Providence', 'Raleigh', 'Richmond',
                         'Sacramento', 'Saint Paul', 'Salem', 'Salt Lake City', 'Santa Fe',
                         'Springfield', 'Tallahassee', 'Topeka', 'Trenton']
                }
            };

            const capitalCities = capitals[country]?.[capitalType] || capitals[country]?.all || [];
            
            let citiesQuery = query(
                collection(db, 'geoLocations'),
                where('country', '==', country),
                orderBy('city'),
                limit(100)
            );

            const querySnapshot = await getDocs(citiesQuery);
            let cities = querySnapshot.docs.map(doc => doc.data());

            // Filter by capital cities
            cities = cities.filter(city => capitalCities.includes(city.city));

            // Remove duplicates
            const cityMap = new Map();
            cities.forEach(city => {
                const cityKey = `${city.city}-${city.provinceState}-${city.country}`;
                if (!cityMap.has(cityKey)) {
                    cityMap.set(cityKey, {
                        id: city.id || cityKey,
                        city: city.city,
                        provinceState: city.provinceState,
                        provinceStateName: city.provinceStateName,
                        country: city.country,
                        countryName: city.countryName,
                        searchKey: cityKey.toLowerCase()
                    });
                }
            });

            const result = Array.from(cityMap.values());
            setCities(result);
            return result;
        } catch (err) {
            // console.error('Error loading capital cities:', err);
            setError('Failed to load capital cities');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getCitiesByProximity = useCallback(async (centerCity, radiusMiles = 100, country = null) => {
        setLoading(true);
        setError(null);
        
        try {
            // This is a simplified proximity search
            // In a real implementation, you'd use geospatial queries with coordinates
            
            // For demo purposes, we'll return cities in the same province/state as the center city
            // First, find the center city
            let centerQuery = query(
                collection(db, 'geoLocations'),
                where('city', '==', centerCity),
                limit(5)
            );

            if (country) {
                centerQuery = query(
                    collection(db, 'geoLocations'),
                    where('city', '==', centerCity),
                    where('country', '==', country),
                    limit(5)
                );
            }

            const centerSnapshot = await getDocs(centerQuery);
            if (centerSnapshot.empty) {
                setError(`Center city "${centerCity}" not found`);
                return [];
            }

            const centerCityData = centerSnapshot.docs[0].data();
            
            // Find cities in the same province/state (simplified proximity)
            const proximityQuery = query(
                collection(db, 'geoLocations'),
                where('provinceState', '==', centerCityData.provinceState),
                where('country', '==', centerCityData.country),
                orderBy('city'),
                limit(50)
            );

            const proximitySnapshot = await getDocs(proximityQuery);
            let cities = proximitySnapshot.docs.map(doc => doc.data());

            // Remove duplicates
            const cityMap = new Map();
            cities.forEach(city => {
                const cityKey = `${city.city}-${city.provinceState}-${city.country}`;
                if (!cityMap.has(cityKey)) {
                    cityMap.set(cityKey, {
                        id: city.id || cityKey,
                        city: city.city,
                        provinceState: city.provinceState,
                        provinceStateName: city.provinceStateName,
                        country: city.country,
                        countryName: city.countryName,
                        searchKey: cityKey.toLowerCase()
                    });
                }
            });

            const result = Array.from(cityMap.values());
            setCities(result);
            return result;
        } catch (err) {
            // console.error('Error loading cities by proximity:', err);
            setError('Failed to load cities by proximity');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getCorridorCities = useCallback(async (corridor) => {
        setLoading(true);
        setError(null);
        
        try {
            const corridors = {
                'greatLakes': {
                    description: 'Great Lakes Shipping Corridor',
                    cities: ['Toronto', 'Hamilton', 'Windsor', 'Detroit', 'Chicago', 'Milwaukee',
                            'Cleveland', 'Buffalo', 'Rochester', 'Syracuse', 'Kingston', 'Thunder Bay']
                },
                'easternSeaboard': {
                    description: 'Eastern Seaboard Corridor',
                    cities: ['Boston', 'New York', 'Philadelphia', 'Baltimore', 'Washington',
                            'Richmond', 'Norfolk', 'Raleigh', 'Charleston', 'Savannah', 'Jacksonville',
                            'Miami', 'Tampa', 'Atlanta']
                },
                'highway401': {
                    description: 'Highway 401 Corridor (Ontario)',
                    cities: ['Windsor', 'London', 'Kitchener', 'Cambridge', 'Mississauga', 'Toronto',
                            'Oshawa', 'Belleville', 'Kingston', 'Brockville', 'Cornwall']
                },
                'i5': {
                    description: 'Interstate 5 Corridor (West Coast)',
                    cities: ['San Diego', 'Los Angeles', 'Bakersfield', 'Fresno', 'San Jose',
                            'San Francisco', 'Sacramento', 'Redding', 'Portland', 'Seattle', 'Bellingham']
                },
                'i95': {
                    description: 'Interstate 95 Corridor (East Coast)',
                    cities: ['Miami', 'Fort Lauderdale', 'West Palm Beach', 'Orlando', 'Jacksonville',
                            'Savannah', 'Charleston', 'Fayetteville', 'Raleigh', 'Richmond', 'Washington',
                            'Baltimore', 'Philadelphia', 'New York', 'New Haven', 'Boston']
                }
            };

            const corridorData = corridors[corridor];
            if (!corridorData) {
                setError(`Corridor "${corridor}" not found`);
                return [];
            }

            // Get all cities from the corridor
            let allCities = [];
            
            for (const cityName of corridorData.cities) {
                const cityQuery = query(
                    collection(db, 'geoLocations'),
                    where('city', '==', cityName),
                    limit(5)
                );

                const citySnapshot = await getDocs(cityQuery);
                const citiesData = citySnapshot.docs.map(doc => doc.data());
                allCities.push(...citiesData);
            }

            // Remove duplicates
            const cityMap = new Map();
            allCities.forEach(city => {
                const cityKey = `${city.city}-${city.provinceState}-${city.country}`;
                if (!cityMap.has(cityKey)) {
                    cityMap.set(cityKey, {
                        id: city.id || cityKey,
                        city: city.city,
                        provinceState: city.provinceState,
                        provinceStateName: city.provinceStateName,
                        country: city.country,
                        countryName: city.countryName,
                        searchKey: cityKey.toLowerCase()
                    });
                }
            });

            const result = Array.from(cityMap.values());
            setCities(result);
            return result;
        } catch (err) {
            // console.error('Error loading corridor cities:', err);
            setError('Failed to load corridor cities');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        cities,
        provinces,
        states,
        loadCities,
        loadRegions,
        searchCities,
        loadCitiesByCountry,
        getCityByPostalCode,
        getLocationsByCity,
        // Advanced smart filtering functions
        getMajorCitiesByRegion,
        getBorderCities,
        getFreightHubs,
        getCapitalCities,
        getCitiesByProximity,
        getCorridorCities
    };
};

export default useGeographicData;
