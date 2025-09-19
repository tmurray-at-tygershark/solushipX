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
                // Properly capitalize each word for title case matching (e.g., "king city" -> "King City")
                const capitalizedSearch = searchTerm
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
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
            const code = postalCode.toUpperCase().replace(/\s+/g, '');
            // Exact 5-digit ZIP
            if (/^\d{5}$/.test(code)) {
                const locationsQuery = query(
                    collection(db, 'geoLocations'),
                    where('postalZipCode', '==', code),
                    limit(1)
                );
                const snap = await getDocs(locationsQuery);
                if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
                return null;
            }

            // Canadian FSA (first 3 chars) → range query on postalZipCode starting with FSA
            if (/^[A-Z]\d[A-Z]$/.test(code.slice(0,3))) {
                const fsa = code.slice(0,3);
                const start = fsa;
                const end = fsa + '\uf8ff';
                const fsaQuery = query(
                    collection(db, 'geoLocations'),
                    where('postalZipCode', '>=', start),
                    where('postalZipCode', '<=', end),
                    orderBy('postalZipCode'),
                    limit(200)
                );
                const snap = await getDocs(fsaQuery);
                if (!snap.empty) {
                    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    // Use the most common city/province among results
                    const byKey = new Map();
                    docs.forEach(r => {
                        const k = `${r.city}|${r.provinceState}|${r.country}`;
                        byKey.set(k, (byKey.get(k) || 0) + 1);
                    });
                    const topKey = Array.from(byKey.entries()).sort((a,b) => b[1]-a[1])[0][0];
                    const [city, provinceState, country] = topKey.split('|');
                    const codes = Array.from(new Set(docs.map(r => (r.postalZipCode || '').toUpperCase()).filter(Boolean)));
                    return { city, provinceState, country, fsa, postalCodes: codes };
                }
                return null;
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
        getLocationsByCity
    };
};

export default useGeographicData;
