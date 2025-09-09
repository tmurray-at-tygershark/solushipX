/**
 * Enterprise Zone Management Component
 * Implements the battle-tested zone architecture:
 * Regions → ZoneSets → Zone Maps → Carrier Bindings → Overrides
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    CircularProgress,
    Menu,
    MenuList,
    ListItemIcon,
    ListItemText,
    Alert,
    Tabs,
    Tab,
    Grid,
    Card,
    CardContent,
    Divider,
    TablePagination,
    TableSortLabel,
    InputAdornment,
    List,
    ListItem
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Public as RegionIcon,
    Map as ZoneSetIcon,
    Route as ZoneMapIcon,
    Override as OverrideIcon,
    Info as InfoIcon,
    LocationCity as CityIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    Label as ZoneIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { useSnackbar } from 'notistack';

const EnterpriseZoneManagement = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);

    // Regions state
    const [regions, setRegions] = useState([]);
    const [regionDialogOpen, setRegionDialogOpen] = useState(false);
    const [editingRegion, setEditingRegion] = useState(null);
    const [regionForm, setRegionForm] = useState({
        type: 'country',
        code: '',
        name: '',
        parentRegionId: '',
        patterns: [],
        enabled: true,
        metadata: {}
    });

    // Zone Sets state
    const [zoneSets, setZoneSets] = useState([]);
    const [zoneSetDialogOpen, setZoneSetDialogOpen] = useState(false);
    const [editingZoneSet, setEditingZoneSet] = useState(null);
    const [zoneSetForm, setZoneSetForm] = useState({
        name: '',
        geography: '',
        version: 1,
        description: '',
        zoneCount: 0,
        coverage: 'regional',
        serviceTypes: [],
        enabled: true
    });

    // Zone Maps state
    const [zoneMaps, setZoneMaps] = useState([]);
    const [zoneMapDialogOpen, setZoneMapDialogOpen] = useState(false);
    const [editingZoneMap, setEditingZoneMap] = useState(null);
    const [zoneMapForm, setZoneMapForm] = useState({
        zoneSetId: '',
        originRegionId: '',
        destinationRegionId: '',
        zoneCode: '',
        serviceType: '',
        enabled: true
    });


    // Cities state
    const [cities, setCities] = useState([]);
    const [cityDialogOpen, setCityDialogOpen] = useState(false);
    const [editingCity, setEditingCity] = useState(null);
    const [cityForm, setCityForm] = useState({
        city: '',
        provinceState: '',
        provinceStateName: '',
        country: '',
        countryName: '',
        postalZipCodes: [],
        latitude: '',
        longitude: '',
        isCanada: false,
        isUS: false,
        locationCount: 0,
        enabled: true
    });

    // Province/State options based on country
    const getProvinceStateOptions = (countryCode) => {
        if (countryCode === 'CA') {
            return [
                { code: 'AB', name: 'Alberta' },
                { code: 'BC', name: 'British Columbia' },
                { code: 'MB', name: 'Manitoba' },
                { code: 'NB', name: 'New Brunswick' },
                { code: 'NL', name: 'Newfoundland and Labrador' },
                { code: 'NS', name: 'Nova Scotia' },
                { code: 'NT', name: 'Northwest Territories' },
                { code: 'NU', name: 'Nunavut' },
                { code: 'ON', name: 'Ontario' },
                { code: 'PE', name: 'Prince Edward Island' },
                { code: 'QC', name: 'Quebec' },
                { code: 'SK', name: 'Saskatchewan' },
                { code: 'YT', name: 'Yukon' }
            ];
        } else if (countryCode === 'US') {
            return [
                { code: 'AL', name: 'Alabama' },
                { code: 'AK', name: 'Alaska' },
                { code: 'AZ', name: 'Arizona' },
                { code: 'AR', name: 'Arkansas' },
                { code: 'CA', name: 'California' },
                { code: 'CO', name: 'Colorado' },
                { code: 'CT', name: 'Connecticut' },
                { code: 'DE', name: 'Delaware' },
                { code: 'FL', name: 'Florida' },
                { code: 'GA', name: 'Georgia' },
                { code: 'HI', name: 'Hawaii' },
                { code: 'ID', name: 'Idaho' },
                { code: 'IL', name: 'Illinois' },
                { code: 'IN', name: 'Indiana' },
                { code: 'IA', name: 'Iowa' },
                { code: 'KS', name: 'Kansas' },
                { code: 'KY', name: 'Kentucky' },
                { code: 'LA', name: 'Louisiana' },
                { code: 'ME', name: 'Maine' },
                { code: 'MD', name: 'Maryland' },
                { code: 'MA', name: 'Massachusetts' },
                { code: 'MI', name: 'Michigan' },
                { code: 'MN', name: 'Minnesota' },
                { code: 'MS', name: 'Mississippi' },
                { code: 'MO', name: 'Missouri' },
                { code: 'MT', name: 'Montana' },
                { code: 'NE', name: 'Nebraska' },
                { code: 'NV', name: 'Nevada' },
                { code: 'NH', name: 'New Hampshire' },
                { code: 'NJ', name: 'New Jersey' },
                { code: 'NM', name: 'New Mexico' },
                { code: 'NY', name: 'New York' },
                { code: 'NC', name: 'North Carolina' },
                { code: 'ND', name: 'North Dakota' },
                { code: 'OH', name: 'Ohio' },
                { code: 'OK', name: 'Oklahoma' },
                { code: 'OR', name: 'Oregon' },
                { code: 'PA', name: 'Pennsylvania' },
                { code: 'RI', name: 'Rhode Island' },
                { code: 'SC', name: 'South Carolina' },
                { code: 'SD', name: 'South Dakota' },
                { code: 'TN', name: 'Tennessee' },
                { code: 'TX', name: 'Texas' },
                { code: 'UT', name: 'Utah' },
                { code: 'VT', name: 'Vermont' },
                { code: 'VA', name: 'Virginia' },
                { code: 'WA', name: 'Washington' },
                { code: 'WV', name: 'West Virginia' },
                { code: 'WI', name: 'Wisconsin' },
                { code: 'WY', name: 'Wyoming' },
                { code: 'DC', name: 'District of Columbia' }
            ];
        }
        return [];
    };
    const [citySearchTerm, setCitySearchTerm] = useState('');
    const [cityCountryFilter, setCityCountryFilter] = useState('');
    const [cityProvinceFilter, setCityProvinceFilter] = useState('');
    const [cityPage, setCityPage] = useState(0);
    const [cityRowsPerPage, setCityRowsPerPage] = useState(250);
    const [citySortBy, setCitySortBy] = useState('city');
    const [citySortDirection, setCitySortDirection] = useState('asc');
    const [totalCities, setTotalCities] = useState(0);

    // Zone coverage search state
    const [zoneCoverageSearch, setZoneCoverageSearch] = useState('');
    const [zoneCoverageSuggestions, setZoneCoverageSuggestions] = useState([]);

    // Zones state (individual zones within zone sets)
    const [zones, setZones] = useState([]);
    const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
    const [editingZone, setEditingZone] = useState(null);
    const [zoneForm, setZoneForm] = useState({
        zoneCode: '',
        zoneName: '',
        description: '',
        cities: [],
        postalCodes: [],
        provinces: [],
        enabled: true
    });

    // Action menu state
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);

    // Region types
    const regionTypes = [
        { value: 'country', label: 'Country', description: 'National level (CA, US, MX)' },
        { value: 'state_province', label: 'State/Province', description: 'State or province level (ON, BC, NY, CA)' },
        { value: 'fsa', label: 'FSA', description: 'Canadian Forward Sortation Area (M5V, K1A)' },
        { value: 'zip3', label: 'ZIP3', description: 'US 3-digit ZIP code (902, 100)' },
        { value: 'city', label: 'City', description: 'Municipal level' }
    ];

    const coverageTypes = [
        { value: 'regional', label: 'Regional' },
        { value: 'national', label: 'National' },
        { value: 'cross_border', label: 'Cross Border' },
        { value: 'international', label: 'International' }
    ];

    const serviceTypes = [
        { value: 'courier', label: 'Courier' },
        { value: 'ltl', label: 'LTL' },
        { value: 'ftl', label: 'FTL' },
        { value: 'air', label: 'Air' },
        { value: 'ocean', label: 'Ocean' }
    ];

    // Load data based on active tab
    useEffect(() => {
        if (activeTab === 0) {
            loadRegions();
        } else if (activeTab === 1) {
            loadZoneSets();
        }
    }, [activeTab]);

    // Load regions
    const loadRegions = useCallback(async () => {
        setLoading(true);
        try {
            const getRegions = httpsCallable(functions, 'getRegions');
            const result = await getRegions();

            if (result.data.success) {
                setRegions(result.data.regions || []);
            } else {
                enqueueSnackbar('Failed to load regions', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error loading regions:', error);
            enqueueSnackbar('Error loading regions', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    // Load zone sets
    const loadZoneSets = useCallback(async () => {
        setLoading(true);
        try {
            const getZoneSets = httpsCallable(functions, 'getZoneSets');
            const result = await getZoneSets();

            if (result.data.success) {
                setZoneSets(result.data.zoneSets || []);
            } else {
                enqueueSnackbar('Failed to load zone sets', { variant: 'error' });
            }
        } catch (error) {
            console.error('Error loading zone sets:', error);
            enqueueSnackbar('Error loading zone sets', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    // Handle add region
    const handleAddRegion = () => {
        setEditingRegion(null);
        setRegionForm({
            type: 'country',
            code: '',
            name: '',
            parentRegionId: '',
            patterns: [],
            enabled: true,
            metadata: {}
        });
        setRegionDialogOpen(true);
    };



    // Handle save region
    const handleSaveRegion = async () => {
        if (!regionForm.type || !regionForm.code || !regionForm.name) {
            enqueueSnackbar('Type, code, and name are required', { variant: 'error' });
            return;
        }

        try {
            const createRegion = httpsCallable(functions, 'createRegion');
            await createRegion(regionForm);
            enqueueSnackbar('Region created successfully', { variant: 'success' });
            setRegionDialogOpen(false);
            loadRegions();
        } catch (error) {
            console.error('Error saving region:', error);
            enqueueSnackbar(error.message || 'Failed to save region', { variant: 'error' });
        }
    };

    // Handle add zone set
    const handleAddZoneSet = () => {
        setEditingZoneSet(null);
        setZoneSetForm({
            name: '',
            geography: '',
            version: 1,
            description: '',
            zoneCount: 0,
            coverage: 'regional',
            serviceTypes: [],
            enabled: true
        });
        setZoneSetDialogOpen(true);
    };

    // Handle save zone set
    const handleSaveZoneSet = async () => {
        if (!zoneSetForm.name || !zoneSetForm.geography) {
            enqueueSnackbar('Name and geography are required', { variant: 'error' });
            return;
        }

        try {
            const createZoneSet = httpsCallable(functions, 'createZoneSet');
            await createZoneSet(zoneSetForm);
            enqueueSnackbar('Zone set created successfully', { variant: 'success' });
            setZoneSetDialogOpen(false);
            loadZoneSets();
        } catch (error) {
            console.error('Error saving zone set:', error);
            enqueueSnackbar(error.message || 'Failed to save zone set', { variant: 'error' });
        }
    };

    // Action menu handlers
    const handleOpenActionMenu = (event, item) => {
        setActionMenuAnchor(event.currentTarget);
        setSelectedItem(item);
    };

    const handleCloseActionMenu = () => {
        setActionMenuAnchor(null);
        setSelectedItem(null);
    };

    const handleEditItem = () => {
        if (selectedItem) {
            if (activeTab === 0) {
                // Edit Region
                setEditingRegion(selectedItem);
                setRegionForm({
                    type: selectedItem.type,
                    code: selectedItem.code,
                    name: selectedItem.name,
                    parentRegionId: selectedItem.parentRegionId || '',
                    patterns: selectedItem.patterns || [],
                    enabled: selectedItem.enabled !== false,
                    metadata: selectedItem.metadata || {}
                });
                setRegionDialogOpen(true);
            } else if (activeTab === 1) { // Cities is now the 2nd tab (index 1)
                // Edit City
                const cityData = selectedItem.data;
                setEditingCity(cityData);
                setCityForm({
                    city: cityData.city || '',
                    provinceState: cityData.provinceState || '',
                    provinceStateName: cityData.provinceStateName || '',
                    country: cityData.country || '',
                    countryName: cityData.countryName || '',
                    postalZipCodes: cityData.postalZipCodes || [],
                    latitude: cityData.latitude || '',
                    longitude: cityData.longitude || '',
                    isCanada: cityData.isCanada || false,
                    isUS: cityData.isUS || false,
                    locationCount: cityData.locationCount || 0,
                    enabled: cityData.enabled !== false
                });
                setCityDialogOpen(true);
            } else if (activeTab === 2) { // Zone Sets is now the 3rd tab (index 2)
                // Edit Zone Set
                setEditingZoneSet(selectedItem);
                setZoneSetForm({
                    name: selectedItem.name,
                    geography: selectedItem.geography,
                    version: selectedItem.version || 1,
                    description: selectedItem.description || '',
                    zoneCount: selectedItem.zoneCount || 0,
                    coverage: selectedItem.coverage || 'regional',
                    serviceTypes: selectedItem.serviceTypes || [],
                    enabled: selectedItem.enabled !== false
                });
                setZoneSetDialogOpen(true);
            }
        }
        handleCloseActionMenu();
    };

    const handleDeleteItem = () => {
        if (selectedItem) {
            if (window.confirm(`Are you sure you want to delete ${selectedItem.name || selectedItem.code || selectedItem.data?.city}?`)) {
                if (activeTab === 1) { // Cities is now the 2nd tab (index 1)
                    // Delete City
                    handleDeleteCity(selectedItem.data);
                } else {
                    // TODO: Implement delete functionality for other tabs
                    enqueueSnackbar('Delete functionality coming soon', { variant: 'info' });
                }
            }
        }
        handleCloseActionMenu();
    };

    // Enhanced Cities CRUD functions with pagination and filtering
    const loadCities = useCallback(async (page = 0, pageSize = 1000, searchTerm = '', countryFilter = '', provinceFilter = '', sortBy = 'city', sortDirection = 'asc') => {
        setLoading(true);
        try {
            const { collection, getDocs, query, where, orderBy, limit: firestoreLimit } = await import('firebase/firestore');
            const { db } = await import('../../../firebase');

            console.log(`🔍 [ZoneManagement] SEARCHING LOCATIONS - Term: "${searchTerm}", Country: ${countryFilter}, Province: ${provinceFilter}`);

            // USE CORRECT COLLECTION: geoLocations has coordinates, geoCities doesn't!
            let locationsQuery = collection(db, 'geoLocations');
            const queryConstraints = [];

            // ENHANCED SMART SEARCH - Handle city names and postal/zip code variations
            if (searchTerm && searchTerm.trim().length >= 2) {
                const trimmedSearch = searchTerm.trim();
                const normalizedSearch = trimmedSearch.replace(/\s+/g, '').toUpperCase(); // Remove spaces

                // Enhanced postal/zip code detection with variations
                const isCanadianPostal = /^[A-Za-z]\d[A-Za-z]/.test(normalizedSearch); // K0M, K0M1B0
                const isUSZip = /^\d{3,5}/.test(normalizedSearch); // 100, 10001, 90210
                const isPostalPrefix = /^[A-Za-z]\d[A-Za-z]?$/.test(normalizedSearch); // K0M (partial)

                if (isCanadianPostal || isUSZip || isPostalPrefix) {
                    console.log(`🔍 [ZoneManagement] Postal/Zip search with variations: "${normalizedSearch}"`);

                    if (normalizedSearch.length >= 3) {
                        // Range query for partial matches (K0M matches K0M1B0, K0M2C1, etc.)
                        const searchEnd = normalizedSearch.slice(0, -1) + String.fromCharCode(normalizedSearch.charCodeAt(normalizedSearch.length - 1) + 1);

                        queryConstraints.push(where('postalZipCode', '>=', normalizedSearch));
                        queryConstraints.push(where('postalZipCode', '<', searchEnd));

                        console.log(`🔍 [ZoneManagement] Postal range search: "${normalizedSearch}" to "${searchEnd}"`);
                    } else {
                        // Very short postal searches (K0, K1, etc.)
                        queryConstraints.push(where('postalZipCode', '>=', normalizedSearch));
                        queryConstraints.push(where('postalZipCode', '<', normalizedSearch + 'Z'));

                        console.log(`🔍 [ZoneManagement] Short postal search: "${normalizedSearch}"`);
                    }
                } else {
                    // Search by city name (existing logic)
                    const searchTerm3 = trimmedSearch.charAt(0).toUpperCase() + trimmedSearch.slice(1).toLowerCase(); // Title case
                    const searchEnd = searchTerm3.slice(0, -1) + String.fromCharCode(searchTerm3.charCodeAt(searchTerm3.length - 1) + 1);

                    queryConstraints.push(where('city', '>=', searchTerm3));
                    queryConstraints.push(where('city', '<', searchEnd));

                    console.log(`🔍 [ZoneManagement] City name search: "${searchTerm3}" to "${searchEnd}"`);
                }
            } else if (!searchTerm) {
                // Only apply filters when not searching
                if (countryFilter) {
                    queryConstraints.push(where('country', '==', countryFilter));
                }
                if (provinceFilter) {
                    queryConstraints.push(where('provinceState', '==', provinceFilter));
                }

                // Add sorting only when not doing search (Firestore limitation)
                queryConstraints.push(orderBy(sortBy, sortDirection));
            }

            // Load more results since we're searching the full location database
            queryConstraints.push(firestoreLimit(Math.min(pageSize * 2, 2000)));

            const finalQuery = query(locationsQuery, ...queryConstraints);
            const querySnapshot = await getDocs(finalQuery);

            let locationsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`🔍 [ZoneManagement] Database query returned ${locationsData.length} locations`);

            // Group by city to create unique cities with coordinates
            const citiesMap = new Map();
            locationsData.forEach(location => {
                const cityKey = `${location.city}-${location.provinceState}-${location.country}`;

                if (!citiesMap.has(cityKey)) {
                    citiesMap.set(cityKey, {
                        id: cityKey,
                        city: location.city,
                        provinceState: location.provinceState,
                        provinceStateName: location.provinceStateName,
                        country: location.country,
                        countryName: location.countryName,
                        // COORDINATES FROM LOCATIONS!
                        latitude: location.latitude,
                        longitude: location.longitude,
                        postalZipCodes: [location.postalZipCode],
                        regionKey: location.regionKey,
                        cityRegionKey: location.cityRegionKey,
                        enabled: true // Default to enabled
                    });
                } else {
                    const existing = citiesMap.get(cityKey);
                    existing.postalZipCodes.push(location.postalZipCode);
                }
            });

            let citiesData = Array.from(citiesMap.values());
            console.log(`🔍 [ZoneManagement] Grouped into ${citiesData.length} unique cities`);

            // Additional client-side filtering for partial matches
            if (searchTerm && searchTerm.trim()) {
                const searchLower = searchTerm.toLowerCase();
                citiesData = citiesData.filter(city => {
                    const cityMatch = city.city?.toLowerCase().includes(searchLower);
                    const postalMatch = city.postalZipCodes?.some(code =>
                        code.toLowerCase().includes(searchLower)
                    );
                    const regionMatch = city.cityRegionKey?.toLowerCase().includes(searchLower);
                    return cityMatch || postalMatch || regionMatch;
                });

                console.log(`🔍 [ZoneManagement] After client filtering: ${citiesData.length} cities match "${searchTerm}"`);
            }

            // Sort results
            if (citiesData.length > 0) {
                citiesData.sort((a, b) => {
                    const aVal = a[sortBy] || '';
                    const bVal = b[sortBy] || '';
                    return sortDirection === 'asc'
                        ? aVal.localeCompare(bVal)
                        : bVal.localeCompare(aVal);
                });
            }

            // Apply pagination
            const startIndex = page * pageSize;
            const paginatedCities = citiesData.slice(startIndex, startIndex + pageSize);

            setCities(paginatedCities);
            setTotalCities(searchTerm ? citiesData.length : 70899); // Use actual location count

            // Debug coordinate fields
            if (paginatedCities.length > 0) {
                const firstCity = paginatedCities[0];
                console.log(`🔍 [ZoneManagement] Sample city with coordinates:`, {
                    cityName: firstCity.city,
                    coordinates: {
                        latitude: firstCity.latitude,
                        longitude: firstCity.longitude,
                    },
                    hasCoords: !!(firstCity.latitude && firstCity.longitude),
                    postalCodes: firstCity.postalZipCodes?.length
                });
            }

            console.log(`✅ [ZoneManagement] FIXED LOAD complete: ${paginatedCities.length} cities with coordinates displayed`);

        } catch (error) {
            console.error('❌ Error loading cities:', error);
            enqueueSnackbar('Failed to load cities', { variant: 'error' });
            setCities([]);
            setTotalCities(0);
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    // Enhanced search with autocomplete suggestions
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Get search suggestions (fast, minimal data)
    const getSearchSuggestions = useCallback(async (searchTerm) => {
        if (!searchTerm || searchTerm.length < 2) {
            setSearchSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        try {
            const { collection, getDocs, query, where, limit: firestoreLimit } = await import('firebase/firestore');
            const { db } = await import('../../../firebase');

            // Smart suggestions - handle both city names and postal codes with variations
            const trimmedSearch = searchTerm.trim();
            const normalizedSearch = trimmedSearch.replace(/\s+/g, '').toUpperCase(); // Remove spaces for postal code matching

            // Enhanced postal/zip code detection
            const isCanadianPostal = /^[A-Za-z]\d[A-Za-z]/.test(normalizedSearch); // K0M, K0M1B0
            const isUSZip = /^\d{3,5}/.test(normalizedSearch); // 100, 10001, 90210
            const isPostalPrefix = /^[A-Za-z]\d[A-Za-z]?$/.test(normalizedSearch); // K0M (partial)

            let suggestionsQuery;

            if (isCanadianPostal || isUSZip || isPostalPrefix) {
                console.log(`🔍 [Suggestions] Postal/Zip search: "${normalizedSearch}"`);

                if (normalizedSearch.length >= 3) {
                    // Use range query for partial postal code matches
                    const searchEnd = normalizedSearch.slice(0, -1) + String.fromCharCode(normalizedSearch.charCodeAt(normalizedSearch.length - 1) + 1);

                    suggestionsQuery = query(
                        collection(db, 'geoLocations'),
                        where('postalZipCode', '>=', normalizedSearch),
                        where('postalZipCode', '<', searchEnd),
                        firestoreLimit(15) // More results for postal code matches
                    );
                } else {
                    // For very short searches, try exact match
                    suggestionsQuery = query(
                        collection(db, 'geoLocations'),
                        where('postalZipCode', '>=', normalizedSearch),
                        where('postalZipCode', '<', normalizedSearch + 'Z'),
                        firestoreLimit(15)
                    );
                }
            } else {
                // Search by city name
                const searchTitle = trimmedSearch.charAt(0).toUpperCase() + trimmedSearch.slice(1).toLowerCase();
                const searchEnd = searchTitle.slice(0, -1) + String.fromCharCode(searchTitle.charCodeAt(searchTitle.length - 1) + 1);

                suggestionsQuery = query(
                    collection(db, 'geoLocations'),
                    where('city', '>=', searchTitle),
                    where('city', '<', searchEnd),
                    firestoreLimit(10)
                );
            }

            const snapshot = await getDocs(suggestionsQuery);
            const citiesMap = new Map();

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const cityKey = `${data.city}-${data.provinceState}-${data.country}`;
                if (!citiesMap.has(cityKey)) {
                    citiesMap.set(cityKey, {
                        city: data.city,
                        provinceStateName: data.provinceStateName,
                        countryName: data.countryName,
                        country: data.country,
                        postalCode: data.postalZipCode // Include first postal code found
                    });
                }
            });

            const suggestions = Array.from(citiesMap.values()).slice(0, 8);
            setSearchSuggestions(suggestions);
            setShowSuggestions(suggestions.length > 0);

        } catch (error) {
            console.error('❌ Error getting search suggestions:', error);
            setSearchSuggestions([]);
            setShowSuggestions(false);
        }
    }, []);

    // Debounced suggestions (fast)
    useEffect(() => {
        const suggestionsTimer = setTimeout(() => {
            if (citySearchTerm && citySearchTerm.length >= 2) {
                getSearchSuggestions(citySearchTerm);
            } else {
                setSearchSuggestions([]);
                setShowSuggestions(false);
            }
        }, 200); // Fast suggestions

        return () => clearTimeout(suggestionsTimer);
    }, [citySearchTerm, getSearchSuggestions]);

    // Full search only on Enter or when search term is selected
    const performFullSearch = useCallback(() => {
        console.log(`🔍 [ZoneManagement] Full search triggered for: "${citySearchTerm}"`);
        setIsSearching(true);
        setShowSuggestions(false);
        loadCities(cityPage, cityRowsPerPage, citySearchTerm, cityCountryFilter, cityProvinceFilter, citySortBy, citySortDirection)
            .finally(() => setIsSearching(false));
    }, [cityPage, cityRowsPerPage, citySearchTerm, cityCountryFilter, cityProvinceFilter, citySortBy, citySortDirection, loadCities]);

    // Load cities when filters change (but not search term)
    useEffect(() => {
        if (activeTab === 1) { // Cities is now the 2nd tab (index 1)
            // Only auto-load when no search term or when filters change
            if (!citySearchTerm) {
                loadCities(cityPage, cityRowsPerPage, '', cityCountryFilter, cityProvinceFilter, citySortBy, citySortDirection);
            }
        }
    }, [activeTab, cityPage, cityRowsPerPage, cityCountryFilter, cityProvinceFilter, citySortBy, citySortDirection, loadCities]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSuggestions && !event.target.closest('[data-search-container]')) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSuggestions]);

    const handleDeleteCity = async (cityData) => {
        try {
            // TODO: Implement delete city cloud function
            enqueueSnackbar('Delete city functionality coming soon', { variant: 'info' });
        } catch (error) {
            console.error('❌ Error deleting city:', error);
            enqueueSnackbar('Failed to delete city', { variant: 'error' });
        }
    };

    // Google Places lookup for auto-filling coordinates and postal codes
    const handleGooglePlacesLookup = async () => {
        if (!cityForm.city || !cityForm.country) {
            enqueueSnackbar('Please enter city name and select country first', { variant: 'warning' });
            return;
        }

        try {
            setLoading(true);

            // Load Google Maps API if not already loaded
            if (!window.google?.maps?.places) {
                const { googleMapsLoader } = await import('../../../utils/googleMapsLoader');
                await googleMapsLoader.loadGoogleMapsAPI();
            }

            const service = new window.google.maps.places.PlacesService(document.createElement('div'));
            const geocoder = new window.google.maps.Geocoder();

            // Build search query with country constraint
            const countryName = cityForm.country === 'CA' ? 'Canada' : 'United States';
            const searchQuery = `${cityForm.city}, ${countryName}`;

            console.log(`🔍 [GooglePlaces] Searching for: "${searchQuery}"`);

            // Use Geocoder for more accurate results
            geocoder.geocode(
                {
                    address: searchQuery,
                    componentRestrictions: { country: cityForm.country }
                },
                (results, status) => {
                    if (status === 'OK' && results && results.length > 0) {
                        const result = results[0];
                        const location = result.geometry.location;

                        console.log('✅ [GooglePlaces] Found location:', result);

                        // Extract address components
                        const addressComponents = result.address_components;
                        let provinceState = '';
                        let provinceStateName = '';
                        let postalCode = '';

                        addressComponents.forEach(component => {
                            const types = component.types;
                            if (types.includes('administrative_area_level_1')) {
                                provinceState = component.short_name;
                                provinceStateName = component.long_name;
                            }
                            if (types.includes('postal_code')) {
                                postalCode = component.long_name;
                            }
                        });

                        // Update form with Google Places data
                        setCityForm(prev => ({
                            ...prev,
                            latitude: location.lat().toString(),
                            longitude: location.lng().toString(),
                            provinceState: provinceState || prev.provinceState,
                            provinceStateName: provinceStateName || prev.provinceStateName,
                            postalZipCodes: postalCode ? [postalCode] : prev.postalZipCodes
                        }));

                        enqueueSnackbar(`✅ Auto-filled coordinates and postal code for ${cityForm.city}`, { variant: 'success' });
                    } else {
                        console.warn('❌ [GooglePlaces] No results found:', status);
                        enqueueSnackbar(`No location data found for "${cityForm.city}" in ${countryName}`, { variant: 'warning' });
                    }
                }
            );

        } catch (error) {
            console.error('❌ Google Places lookup error:', error);
            enqueueSnackbar('Failed to lookup location data', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Zone handlers
    const handleAddZone = () => {
        setEditingZone(null);
        setZoneForm({
            zoneCode: '',
            zoneName: '',
            description: '',
            cities: [],
            postalCodes: [],
            provinces: [],
            enabled: true
        });
        setZoneCoverageSearch('');
        setZoneCoverageSuggestions([]);
        setZoneDialogOpen(true);
    };

    // Zone coverage search handlers
    const handleZoneCoverageSearch = async () => {
        if (!zoneCoverageSearch.trim() || zoneCoverageSearch.trim().length < 2) return;

        try {
            const { collection, getDocs, query, where, limit: firestoreLimit } = await import('firebase/firestore');
            const { db } = await import('../../../firebase');

            const trimmedSearch = zoneCoverageSearch.trim();

            // Detect search type
            const isPostalCode = /^[A-Za-z]\d[A-Za-z]/.test(trimmedSearch); // Canadian postal pattern
            const isZipCode = /^\\d{5}/.test(trimmedSearch); // US zip pattern

            let suggestions = [];

            if (isPostalCode || isZipCode) {
                // Search by postal/zip code with variations
                const normalizedSearch = trimmedSearch.toUpperCase().replace(/\\s/g, '');

                // Range search for partial postal codes
                const searchEnd = normalizedSearch.slice(0, -1) + String.fromCharCode(normalizedSearch.charCodeAt(normalizedSearch.length - 1) + 1);

                const postalQuery = query(
                    collection(db, 'geoLocations'),
                    where('postalZipCode', '>=', normalizedSearch),
                    where('postalZipCode', '<', searchEnd),
                    firestoreLimit(10)
                );

                const postalSnapshot = await getDocs(postalQuery);
                suggestions = postalSnapshot.docs.map(doc => ({
                    ...doc.data(),
                    type: 'postal'
                }));
            } else {
                // Search by city name
                const searchTitle = trimmedSearch.charAt(0).toUpperCase() + trimmedSearch.slice(1).toLowerCase();
                const searchEnd = searchTitle.slice(0, -1) + String.fromCharCode(searchTitle.charCodeAt(searchTitle.length - 1) + 1);

                const cityQuery = query(
                    collection(db, 'geoLocations'),
                    where('city', '>=', searchTitle),
                    where('city', '<', searchEnd),
                    firestoreLimit(10)
                );

                const citySnapshot = await getDocs(cityQuery);

                // Group by city to avoid duplicates
                const citiesMap = new Map();
                citySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const cityKey = `${data.city}-${data.provinceStateName}-${data.countryName}`;

                    if (!citiesMap.has(cityKey)) {
                        citiesMap.set(cityKey, {
                            city: data.city,
                            provinceStateName: data.provinceStateName,
                            countryName: data.countryName,
                            country: data.country,
                            postalCode: data.postalZipCode,
                            type: 'city'
                        });
                    }
                });

                suggestions = Array.from(citiesMap.values());
            }

            setZoneCoverageSuggestions(suggestions);

        } catch (error) {
            console.error('❌ Zone coverage search error:', error);
            enqueueSnackbar('Search failed', { variant: 'error' });
        }
    };

    const handleAddZoneCoverage = (item) => {
        if (item.type === 'city') {
            // Add city to zone
            const newCity = {
                name: item.city,
                province: item.provinceStateName,
                country: item.countryName,
                postalCode: item.postalCode
            };

            // Check for duplicates
            const exists = zoneForm.cities.some(city =>
                city.name === newCity.name && city.province === newCity.province
            );

            if (!exists) {
                setZoneForm(prev => ({
                    ...prev,
                    cities: [...prev.cities, newCity]
                }));
                enqueueSnackbar(`Added ${newCity.name}, ${newCity.province} to zone`, { variant: 'success' });
            } else {
                enqueueSnackbar(`${newCity.name}, ${newCity.province} already in zone`, { variant: 'info' });
            }
        } else if (item.type === 'postal') {
            // Add postal code to zone
            const newPostal = {
                code: item.postalZipCode,
                city: item.city,
                province: item.provinceStateName,
                country: item.countryName
            };

            // Check for duplicates
            const exists = zoneForm.postalCodes.some(postal => postal.code === newPostal.code);

            if (!exists) {
                setZoneForm(prev => ({
                    ...prev,
                    postalCodes: [...prev.postalCodes, newPostal]
                }));
                enqueueSnackbar(`Added postal code ${newPostal.code} to zone`, { variant: 'success' });
            } else {
                enqueueSnackbar(`Postal code ${newPostal.code} already in zone`, { variant: 'info' });
            }
        }

        // Clear search
        setZoneCoverageSearch('');
        setZoneCoverageSuggestions([]);
    };

    const handleRemoveZoneCoverage = (type, index) => {
        setZoneForm(prev => ({
            ...prev,
            [type]: prev[type].filter((_, i) => i !== index)
        }));
    };

    // Zone Map handlers
    const handleAddZoneMap = () => {
        setEditingZoneMap(null);
        setZoneMapForm({
            zoneSetId: '',
            originRegionId: '',
            destinationRegionId: '',
            zoneCode: '',
            serviceType: '',
            enabled: true
        });
        setZoneMapDialogOpen(true);
    };


    // Render regions tab
    const renderRegionsTab = () => (
        <Box>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Atomic geographic keys (FSA, ZIP3, state/province, country) for zone mapping
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddRegion}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Region
                </Button>
            </Box>

            {/* Info Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {regionTypes.slice(0, 4).map((type) => (
                    <Grid item xs={12} md={3} key={type.value}>
                        <Card sx={{ border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <RegionIcon sx={{ fontSize: '16px', color: '#3b82f6' }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        {type.label}
                                    </Typography>
                                </Box>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    {type.description}
                                </Typography>
                                <Chip
                                    label={`${regions.filter(r => r.type === type.value).length} regions`}
                                    size="small"
                                    sx={{ fontSize: '10px', mt: 1 }}
                                />
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Regions Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Code</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Parent</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '80px' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                    <CircularProgress size={20} />
                                </TableCell>
                            </TableRow>
                        ) : regions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                        No regions configured. Add regions to get started.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            regions.map((region) => (
                                <TableRow key={region.id}>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={region.type.replace('_', ' ').toUpperCase()}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                        {region.code}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>{region.name}</TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {region.parentRegionId ? (
                                            <Chip label="Has Parent" size="small" sx={{ fontSize: '10px' }} />
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={region.enabled ? 'Active' : 'Inactive'}
                                            color={region.enabled ? 'success' : 'default'}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleOpenActionMenu(e, region)}
                                        >
                                            <MoreVertIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    // Render zone sets tab
    const renderZoneSetsTab = () => (
        <Box>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Collections of zones (e.g., "Canadian Standard" contains GTA Zone, Ontario Zone, Quebec Zone, etc.)
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddZoneSet}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Zone Set
                </Button>
            </Box>

            {/* Zone Sets Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Geography</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Version</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Coverage</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Services</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zones</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '80px' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                                    <CircularProgress size={20} />
                                </TableCell>
                            </TableRow>
                        ) : zoneSets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                        No zone sets configured. Add zone sets to get started.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            zoneSets.map((zoneSet) => (
                                <TableRow key={zoneSet.id}>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                        {zoneSet.name}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                        {zoneSet.geography}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={`v${zoneSet.version}`}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={zoneSet.coverage}
                                            size="small"
                                            sx={{ fontSize: '10px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zoneSet.serviceTypes.slice(0, 2).map(service => (
                                            <Chip
                                                key={service}
                                                label={service.toUpperCase()}
                                                size="small"
                                                sx={{ fontSize: '9px', mr: 0.5, mb: 0.5 }}
                                            />
                                        ))}
                                        {zoneSet.serviceTypes.length > 2 && (
                                            <Chip
                                                label={`+${zoneSet.serviceTypes.length - 2}`}
                                                size="small"
                                                sx={{ fontSize: '9px' }}
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zoneSet.zoneCount || 0} zones
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={zoneSet.enabled ? 'Active' : 'Inactive'}
                                            color={zoneSet.enabled ? 'success' : 'default'}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleOpenActionMenu(e, zoneSet)}
                                        >
                                            <MoreVertIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    const renderZoneMapsTab = () => (
        <Box>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Origin/destination zone mappings for rate calculation
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddZoneMap}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Zone Map
                </Button>
            </Box>

            <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                Zone Maps allow you to define how origin and destination regions map to specific zone codes for rate calculation.
                For example: "Ontario, Canada → Zone A" or "New York → Zone 1".
            </Alert>

            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Set</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Origin</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Destination</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Code</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Service Type</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', textAlign: 'center' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                No zone maps configured. Zone maps will be available once zone sets are created.
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    // Zones Tab - Individual zones within zone sets
    const renderZonesTab = () => (
        <Box>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Independent zones with city/region assignments. Zone Sets will collect these zones together.
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddZone}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Zone
                </Button>
            </Box>

            <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                Create independent zones first (e.g., "GTA Zone", "Southern Ontario Zone"), then group them into Zone Sets.
                Each zone defines specific cities, postal codes, or provinces it covers.
            </Alert>

            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Code</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Cities</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Postal Codes</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Provinces</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', textAlign: 'center' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                No zones configured yet. Create independent zones first, then group them into Zone Sets.
                                <br />
                                <Typography variant="caption" sx={{ fontSize: '11px', mt: 1, display: 'block' }}>
                                    Examples: "GTA Zone" (Toronto, Mississauga), "Southern Ontario Zone" (London, Windsor), "Quebec Zone" (Montreal, Quebec City)
                                </Typography>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    // Cities Tab - Full CRUD for geoCities collection
    const renderCitiesTab = () => (
        <Box>
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2
            }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Manage geographic cities database with full CRUD operations
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                        setEditingCity(null);
                        setCityForm({
                            city: '',
                            provinceState: '',
                            provinceStateName: '',
                            country: '',
                            countryName: '',
                            postalZipCodes: [],
                            latitude: '',
                            longitude: '',
                            isCanada: false,
                            isUS: false,
                            locationCount: 0,
                            enabled: true
                        });
                        setCityDialogOpen(true);
                    }}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    City
                </Button>
            </Box>

            <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                Cities management for the geographic database. Each city includes coordinates, postal codes, and regional mapping.
            </Alert>

            {/* Search and Filters */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={4}>
                    <Box sx={{ position: 'relative', width: '100%' }} data-search-container>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Type city name or postal/zip code and press Enter to search..."
                            value={citySearchTerm}
                            onChange={(e) => setCitySearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    performFullSearch();
                                } else if (e.key === 'Escape') {
                                    setShowSuggestions(false);
                                }
                            }}
                            onFocus={() => {
                                if (searchSuggestions.length > 0) {
                                    setShowSuggestions(true);
                                }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {isSearching && <CircularProgress size={16} />}
                                        {citySearchTerm && !isSearching && (
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setCitySearchTerm('');
                                                    setShowSuggestions(false);
                                                    loadCities(cityPage, cityRowsPerPage, '', cityCountryFilter, cityProvinceFilter, citySortBy, citySortDirection);
                                                }}
                                            >
                                                <ClearIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </InputAdornment>
                                ),
                                sx: { fontSize: '12px' }
                            }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                        />

                        {/* Search Suggestions Dropdown */}
                        {showSuggestions && searchSuggestions.length > 0 && (
                            <Paper
                                sx={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 1000,
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    border: '1px solid #e0e0e0',
                                    borderTop: 'none',
                                    borderRadius: '0 0 4px 4px'
                                }}
                            >
                                <List dense>
                                    {searchSuggestions.map((suggestion, index) => (
                                        <ListItem
                                            key={index}
                                            button
                                            onClick={() => {
                                                setCitySearchTerm(suggestion.city);
                                                setShowSuggestions(false);
                                                // Auto-search when suggestion is selected
                                                setTimeout(() => performFullSearch(), 100);
                                            }}
                                            sx={{
                                                py: 0.5,
                                                '&:hover': { backgroundColor: '#f5f5f5' }
                                            }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        {suggestion.city}
                                                        {suggestion.postalCode && (
                                                            <span style={{
                                                                marginLeft: '8px',
                                                                fontSize: '11px',
                                                                fontFamily: 'monospace',
                                                                color: '#666',
                                                                backgroundColor: '#f5f5f5',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px'
                                                            }}>
                                                                {suggestion.postalCode}
                                                            </span>
                                                        )}
                                                    </Typography>
                                                }
                                                secondary={
                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                                        {suggestion.provinceStateName}, {suggestion.countryName}
                                                    </Typography>
                                                }
                                            />
                                            <Box sx={{ ml: 1 }}>
                                                <img
                                                    src={`https://flagcdn.com/16x12/${suggestion.country.toLowerCase()}.png`}
                                                    alt={suggestion.countryName}
                                                    style={{ width: 16, height: 12 }}
                                                />
                                            </Box>
                                        </ListItem>
                                    ))}
                                    <ListItem sx={{ py: 0.5, backgroundColor: '#f9f9f9' }}>
                                        <ListItemText
                                            primary={
                                                <Typography variant="caption" sx={{ fontSize: '10px', color: '#888', fontStyle: 'italic' }}>
                                                    Press Enter to search all results
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                </List>
                            </Paper>
                        )}
                    </Box>
                </Grid>
                <Grid item xs={6} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                        <Select
                            value={cityCountryFilter}
                            onChange={(e) => setCityCountryFilter(e.target.value)}
                            label="Country"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                            <MenuItem value="CA" sx={{ fontSize: '12px' }}>🇨🇦 Canada</MenuItem>
                            <MenuItem value="US" sx={{ fontSize: '12px' }}>🇺🇸 United States</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={6} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Province/State</InputLabel>
                        <Select
                            value={cityProvinceFilter}
                            onChange={(e) => setCityProvinceFilter(e.target.value)}
                            label="Province/State"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Provinces/States</MenuItem>
                            <MenuItem value="ON" sx={{ fontSize: '12px' }}>Ontario</MenuItem>
                            <MenuItem value="QC" sx={{ fontSize: '12px' }}>Quebec</MenuItem>
                            <MenuItem value="BC" sx={{ fontSize: '12px' }}>British Columbia</MenuItem>
                            <MenuItem value="AB" sx={{ fontSize: '12px' }}>Alberta</MenuItem>
                            <MenuItem value="CA" sx={{ fontSize: '12px' }}>California</MenuItem>
                            <MenuItem value="NY" sx={{ fontSize: '12px' }}>New York</MenuItem>
                            <MenuItem value="TX" sx={{ fontSize: '12px' }}>Texas</MenuItem>
                            <MenuItem value="FL" sx={{ fontSize: '12px' }}>Florida</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                    <Button
                        variant="outlined"
                        fullWidth
                        size="small"
                        onClick={() => {
                            setCitySearchTerm('');
                            setCityCountryFilter('');
                            setCityProvinceFilter('');
                        }}
                        sx={{ fontSize: '12px' }}
                    >
                        Clear
                    </Button>
                </Grid>
            </Grid>

            {/* Cities Summary */}
            <Box sx={{ mb: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '12px', color: '#374151' }}>
                    Showing {cities.length} of {totalCities} cities
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                    Total database: {totalCities.toLocaleString()} cities
                </Typography>
            </Box>

            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>
                                <TableSortLabel
                                    active={citySortBy === 'city'}
                                    direction={citySortBy === 'city' ? citySortDirection : 'asc'}
                                    onClick={() => {
                                        const newDirection = citySortBy === 'city' && citySortDirection === 'asc' ? 'desc' : 'asc';
                                        setCitySortBy('city');
                                        setCitySortDirection(newDirection);
                                        setCityPage(0);
                                    }}
                                    sx={{ fontSize: '12px' }}
                                >
                                    City
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>
                                <TableSortLabel
                                    active={citySortBy === 'provinceState'}
                                    direction={citySortBy === 'provinceState' ? citySortDirection : 'asc'}
                                    onClick={() => {
                                        const newDirection = citySortBy === 'provinceState' && citySortDirection === 'asc' ? 'desc' : 'asc';
                                        setCitySortBy('provinceState');
                                        setCitySortDirection(newDirection);
                                        setCityPage(0);
                                    }}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Province/State
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>
                                <TableSortLabel
                                    active={citySortBy === 'country'}
                                    direction={citySortBy === 'country' ? citySortDirection : 'asc'}
                                    onClick={() => {
                                        const newDirection = citySortBy === 'country' && citySortDirection === 'asc' ? 'desc' : 'asc';
                                        setCitySortBy('country');
                                        setCitySortDirection(newDirection);
                                        setCityPage(0);
                                    }}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Country
                                </TableSortLabel>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Postal Codes</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Coordinates</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                                    <CircularProgress size={20} />
                                    <Typography sx={{ ml: 2, fontSize: '12px', color: '#6b7280' }}>
                                        Loading cities...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : cities.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        No cities found. Try adjusting your search filters.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            cities.map((city) => (
                                <TableRow key={city.id || city.cityRegionKey} hover>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                        {city.city}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {city.provinceStateName} ({city.provinceState})
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {city.country === 'CA' ? '🇨🇦 Canada' : city.country === 'US' ? '🇺🇸 United States' : city.countryName}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                        {city.postalZipCodes?.slice(0, 3).join(', ')}
                                        {city.postalZipCodes?.length > 3 && ` +${city.postalZipCodes.length - 3} more`}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                        {(() => {
                                            // Coordinates should now be available from geoLocations
                                            const lat = city.latitude;
                                            const lng = city.longitude;

                                            if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
                                                return `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`;
                                            }

                                            return 'N/A';
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={city.enabled !== false ? 'Enabled' : 'Disabled'}
                                            size="small"
                                            color={city.enabled !== false ? 'success' : 'default'}
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                setActionMenuAnchor(e.currentTarget);
                                                setSelectedItem({ type: 'city', data: city });
                                            }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <TablePagination
                    component="div"
                    count={totalCities}
                    page={cityPage}
                    onPageChange={(event, newPage) => setCityPage(newPage)}
                    rowsPerPage={cityRowsPerPage}
                    onRowsPerPageChange={(event) => {
                        setCityRowsPerPage(parseInt(event.target.value, 10));
                        setCityPage(0);
                    }}
                    rowsPerPageOptions={[25, 100, 250, 500, 1000]}
                    sx={{
                        '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                            fontSize: '12px'
                        }
                    }}
                />
            </TableContainer>
        </Box>
    );

    return (
        <Box>
            {/* Tab Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    sx={{
                        '& .MuiTab-root': {
                            fontSize: '12px',
                            textTransform: 'none',
                            minHeight: 40
                        }
                    }}
                >
                    <Tab
                        icon={<RegionIcon sx={{ fontSize: '16px' }} />}
                        label="Regions"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<CityIcon sx={{ fontSize: '16px' }} />}
                        label="Cities"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<ZoneIcon sx={{ fontSize: '16px' }} />}
                        label="Zones"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<ZoneSetIcon sx={{ fontSize: '16px' }} />}
                        label="Zone Sets"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<ZoneMapIcon sx={{ fontSize: '16px' }} />}
                        label="Zone Maps"
                        iconPosition="start"
                    />
                </Tabs>
            </Box>

            {/* Tab Content */}
            {activeTab === 0 && renderRegionsTab()}
            {activeTab === 1 && renderCitiesTab()}
            {activeTab === 2 && renderZonesTab()}
            {activeTab === 3 && renderZoneSetsTab()}
            {activeTab === 4 && renderZoneMapsTab()}

            {/* Region Dialog */}
            <Dialog
                open={regionDialogOpen}
                onClose={() => setRegionDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingRegion ? 'Edit Region' : 'Add Region'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small" required>
                                <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                                <Select
                                    value={regionForm.type}
                                    onChange={(e) => setRegionForm(prev => ({ ...prev, type: e.target.value }))}
                                    label="Type"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {regionTypes.map((type) => (
                                        <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                            {type.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Code"
                                value={regionForm.code}
                                onChange={(e) => setRegionForm(prev => ({ ...prev, code: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., CA, ON, M5V, 902"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Name"
                                value={regionForm.name}
                                onChange={(e) => setRegionForm(prev => ({ ...prev, name: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., Canada, Ontario, Downtown Toronto"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={regionForm.enabled}
                                        onChange={(e) => setRegionForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                        size="small"
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setRegionDialogOpen(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveRegion}
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingRegion ? 'Update' : 'Create'} Region
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Zone Set Dialog */}
            <Dialog
                open={zoneSetDialogOpen}
                onClose={() => setZoneSetDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingZoneSet ? 'Edit Zone Set' : 'Add Zone Set'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={8}>
                            <TextField
                                fullWidth
                                label="Name"
                                value={zoneSetForm.name}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, name: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., CA-Courier-FSA v1"
                            />
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="Version"
                                type="number"
                                value={zoneSetForm.version}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, version: parseInt(e.target.value) || 1 }))}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                inputProps={{ min: 1 }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Geography"
                                value={zoneSetForm.geography}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, geography: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., CA_FSA, US_ZIP3, CA_US_CROSS_BORDER"
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Coverage</InputLabel>
                                <Select
                                    value={zoneSetForm.coverage}
                                    onChange={(e) => setZoneSetForm(prev => ({ ...prev, coverage: e.target.value }))}
                                    label="Coverage"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    {coverageTypes.map((type) => (
                                        <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                            {type.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={zoneSetForm.description}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, description: e.target.value }))}
                                multiline
                                rows={2}
                                size="small"
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Optional description for this zone set"
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={zoneSetForm.enabled}
                                        onChange={(e) => setZoneSetForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                        size="small"
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setZoneSetDialogOpen(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveZoneSet}
                        variant="contained"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingZoneSet ? 'Update' : 'Create'} Zone Set
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleCloseActionMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuList dense>
                    <MenuItem onClick={handleEditItem}>
                        <ListItemIcon>
                            <EditIcon sx={{ fontSize: '16px' }} />
                        </ListItemIcon>
                        <ListItemText>
                            <Typography sx={{ fontSize: '12px' }}>Edit</Typography>
                        </ListItemText>
                    </MenuItem>
                    <MenuItem onClick={handleDeleteItem}>
                        <ListItemIcon>
                            <DeleteIcon sx={{ fontSize: '16px' }} />
                        </ListItemIcon>
                        <ListItemText>
                            <Typography sx={{ fontSize: '12px' }}>Delete</Typography>
                        </ListItemText>
                    </MenuItem>
                </MenuList>
            </Menu>

            {/* Zone Map Dialog */}
            <Dialog
                open={zoneMapDialogOpen}
                onClose={() => setZoneMapDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingZoneMap ? 'Edit Zone Map' : 'Add Zone Map'}
                </DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                        Zone Maps define how origin and destination regions map to specific zone codes for rate calculation.
                    </Alert>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                                <InputLabel sx={{ fontSize: '12px' }}>Zone Set</InputLabel>
                                <Select
                                    value={zoneMapForm.zoneSetId}
                                    label="Zone Set"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {zoneSets.map((zoneSet) => (
                                        <MenuItem key={zoneSet.id} value={zoneSet.id} sx={{ fontSize: '12px' }}>
                                            {zoneSet.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Zone Code"
                                value={zoneMapForm.zoneCode}
                                placeholder="e.g., Zone A, Zone 1"
                                sx={{ mt: 1, '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                Geographic Mapping
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Origin Region</InputLabel>
                                <Select
                                    value={zoneMapForm.originRegionId}
                                    label="Origin Region"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {regions.map((region) => (
                                        <MenuItem key={region.id} value={region.id} sx={{ fontSize: '12px' }}>
                                            {region.name} ({region.code})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Destination Region</InputLabel>
                                <Select
                                    value={zoneMapForm.destinationRegionId}
                                    label="Destination Region"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {regions.map((region) => (
                                        <MenuItem key={region.id} value={region.id} sx={{ fontSize: '12px' }}>
                                            {region.name} ({region.code})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setZoneMapDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" size="small" sx={{ fontSize: '12px' }}>
                        {editingZoneMap ? 'Update' : 'Create'} Zone Map
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Zone Dialog */}
            <Dialog
                open={zoneDialogOpen}
                onClose={() => setZoneDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingZone ? 'Edit Zone' : 'Add Zone'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={6} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Zone Code"
                                value={zoneForm.zoneCode}
                                onChange={(e) => setZoneForm(prev => ({ ...prev, zoneCode: e.target.value.toUpperCase() }))}
                                InputProps={{ sx: { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="GTA, ZONE1, A"
                                helperText="Unique zone identifier"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                required
                            />
                        </Grid>
                        <Grid item xs={6} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Zone Name"
                                value={zoneForm.zoneName}
                                onChange={(e) => setZoneForm(prev => ({ ...prev, zoneName: e.target.value }))}
                                InputProps={{ sx: { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="GTA Cities"
                                helperText="Descriptive name"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                required
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Description"
                                value={zoneForm.description}
                                onChange={(e) => setZoneForm(prev => ({ ...prev, description: e.target.value }))}
                                InputProps={{ sx: { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="Greater Toronto Area cities including Toronto, Mississauga, Brampton..."
                                helperText="Detailed description of what this zone covers"
                                FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                multiline
                                rows={2}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                Zone Coverage (Select cities, postal codes, or provinces for this zone)
                            </Typography>
                            <Alert severity="info" sx={{ fontSize: '11px', mb: 2 }}>
                                Define what geographic areas belong to this zone. You can assign specific cities, postal code ranges, or entire provinces.
                            </Alert>

                            {/* City/Postal Code Lookup */}
                            <Box sx={{ mb: 2, position: 'relative' }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Type city name, postal/zip code, or province/state..."
                                    value={zoneCoverageSearch}
                                    onChange={(e) => setZoneCoverageSearch(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleZoneCoverageSearch();
                                        }
                                    }}
                                    InputProps={{
                                        sx: { fontSize: '12px' },
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '18px', color: '#666' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                {zoneCoverageSearch && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            setZoneCoverageSearch('');
                                                            setZoneCoverageSuggestions([]);
                                                        }}
                                                        sx={{ p: 0.5 }}
                                                    >
                                                        <ClearIcon sx={{ fontSize: '16px' }} />
                                                    </IconButton>
                                                )}
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={handleZoneCoverageSearch}
                                                    sx={{
                                                        ml: 1,
                                                        fontSize: '11px',
                                                        minWidth: 'auto',
                                                        px: 2
                                                    }}
                                                >
                                                    Add
                                                </Button>
                                            </InputAdornment>
                                        )
                                    }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />

                                {/* Suggestions Dropdown */}
                                {zoneCoverageSuggestions.length > 0 && (
                                    <Paper
                                        sx={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            zIndex: 1000,
                                            maxHeight: 200,
                                            overflow: 'auto',
                                            mt: 0.5,
                                            border: '1px solid #e0e0e0'
                                        }}
                                    >
                                        <List dense>
                                            {zoneCoverageSuggestions.map((suggestion, index) => (
                                                <ListItem
                                                    key={index}
                                                    button
                                                    onClick={() => handleAddZoneCoverage(suggestion)}
                                                    sx={{ py: 0.5 }}
                                                >
                                                    <ListItemText
                                                        primary={
                                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                {suggestion.city}
                                                                {suggestion.postalCode && (
                                                                    <Chip
                                                                        label={suggestion.postalCode}
                                                                        size="small"
                                                                        sx={{
                                                                            ml: 1,
                                                                            height: '18px',
                                                                            fontSize: '10px',
                                                                            backgroundColor: '#e3f2fd',
                                                                            color: '#1976d2'
                                                                        }}
                                                                    />
                                                                )}
                                                            </Typography>
                                                        }
                                                        secondary={
                                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                                                {suggestion.provinceStateName}, {suggestion.countryName}
                                                            </Typography>
                                                        }
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Paper>
                                )}
                            </Box>

                            {/* Selected Coverage Display */}
                            {(zoneForm.cities.length > 0 || zoneForm.postalCodes.length > 0 || zoneForm.provinces.length > 0) && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                        Selected Coverage ({zoneForm.cities.length + zoneForm.postalCodes.length + zoneForm.provinces.length} items)
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {/* Cities */}
                                        {zoneForm.cities.map((city, index) => (
                                            <Chip
                                                key={`city-${index}`}
                                                label={`🏙️ ${city.name}, ${city.province}`}
                                                size="small"
                                                onDelete={() => handleRemoveZoneCoverage('cities', index)}
                                                sx={{ fontSize: '11px' }}
                                            />
                                        ))}
                                        {/* Postal Codes */}
                                        {zoneForm.postalCodes.map((postal, index) => (
                                            <Chip
                                                key={`postal-${index}`}
                                                label={`📮 ${postal.code}`}
                                                size="small"
                                                onDelete={() => handleRemoveZoneCoverage('postalCodes', index)}
                                                sx={{ fontSize: '11px', backgroundColor: '#e3f2fd' }}
                                            />
                                        ))}
                                        {/* Provinces */}
                                        {zoneForm.provinces.map((province, index) => (
                                            <Chip
                                                key={`province-${index}`}
                                                label={`🏛️ ${province.name}`}
                                                size="small"
                                                onDelete={() => handleRemoveZoneCoverage('provinces', index)}
                                                sx={{ fontSize: '11px', backgroundColor: '#f3e5f5' }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={zoneForm.enabled}
                                        onChange={(e) => setZoneForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                        size="small"
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setZoneDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" size="small" sx={{ fontSize: '12px' }}>
                        {editingZone ? 'Update' : 'Create'} Zone
                    </Button>
                </DialogActions>
            </Dialog>

            {/* City Dialog */}
            <Dialog
                open={cityDialogOpen}
                onClose={() => setCityDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {editingCity ? 'Edit City' : 'Add City'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12} md={6}>
                            <Box sx={{ position: 'relative', width: '100%' }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="City Name"
                                    value={cityForm.city}
                                    onChange={(e) => setCityForm(prev => ({ ...prev, city: e.target.value }))}
                                    InputProps={{
                                        sx: { fontSize: '12px' },
                                        endAdornment: (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={handleGooglePlacesLookup}
                                                disabled={!cityForm.city || !cityForm.country}
                                                sx={{
                                                    fontSize: '10px',
                                                    minWidth: 'auto',
                                                    px: 1,
                                                    py: 0.5
                                                }}
                                            >
                                                📍 Auto-Fill
                                            </Button>
                                        )
                                    }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    helperText="Enter city name, then click Auto-Fill to populate coordinates and postal codes"
                                    FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                    required
                                />
                            </Box>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <FormControl fullWidth size="small" required>
                                <InputLabel sx={{ fontSize: '12px' }}>Province/State</InputLabel>
                                <Select
                                    value={cityForm.provinceState}
                                    onChange={(e) => {
                                        const selectedOption = getProvinceStateOptions(cityForm.country).find(opt => opt.code === e.target.value);
                                        setCityForm(prev => ({
                                            ...prev,
                                            provinceState: e.target.value,
                                            provinceStateName: selectedOption?.name || ''
                                        }));
                                    }}
                                    label="Province/State"
                                    sx={{ fontSize: '12px' }}
                                    disabled={!cityForm.country}
                                >
                                    {getProvinceStateOptions(cityForm.country).map((option) => (
                                        <MenuItem key={option.code} value={option.code} sx={{ fontSize: '12px' }}>
                                            {option.name} - {option.code}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <FormControl fullWidth size="small" required>
                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                <Select
                                    value={cityForm.country}
                                    onChange={(e) => {
                                        const country = e.target.value;
                                        setCityForm(prev => ({
                                            ...prev,
                                            country,
                                            countryName: country === 'CA' ? 'Canada' : country === 'US' ? 'United States' : '',
                                            isCanada: country === 'CA',
                                            isUS: country === 'US',
                                            // Reset province/state when country changes
                                            provinceState: '',
                                            provinceStateName: ''
                                        }));
                                    }}
                                    label="Country"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>🇨🇦 Canada</MenuItem>
                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>🇺🇸 United States</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Latitude"
                                value={cityForm.latitude}
                                onChange={(e) => setCityForm(prev => ({ ...prev, latitude: e.target.value }))}
                                InputProps={{
                                    sx: { fontSize: '12px' },
                                    startAdornment: cityForm.latitude && (
                                        <Typography sx={{ fontSize: '10px', color: 'green', mr: 0.5 }}>
                                            📍
                                        </Typography>
                                    )
                                }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                type="number"
                                inputProps={{ step: "any" }}
                                helperText="Auto-filled by Google Places"
                                FormHelperTextProps={{ sx: { fontSize: '10px', color: cityForm.latitude ? 'green' : 'inherit' } }}
                            />
                        </Grid>
                        <Grid item xs={6} md={3}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Longitude"
                                value={cityForm.longitude}
                                onChange={(e) => setCityForm(prev => ({ ...prev, longitude: e.target.value }))}
                                InputProps={{
                                    sx: { fontSize: '12px' },
                                    startAdornment: cityForm.longitude && (
                                        <Typography sx={{ fontSize: '10px', color: 'green', mr: 0.5 }}>
                                            📍
                                        </Typography>
                                    )
                                }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                type="number"
                                inputProps={{ step: "any" }}
                                helperText="Auto-filled by Google Places"
                                FormHelperTextProps={{ sx: { fontSize: '10px', color: cityForm.longitude ? 'green' : 'inherit' } }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Postal/Zip Codes (comma separated)"
                                value={cityForm.postalZipCodes.join(', ')}
                                onChange={(e) => {
                                    const codes = e.target.value.split(',').map(code => code.trim().toUpperCase()).filter(code => code);
                                    setCityForm(prev => ({ ...prev, postalZipCodes: codes }));
                                }}
                                InputProps={{
                                    sx: { fontSize: '12px' },
                                    placeholder: "K1A 0A6, K1A 0A7, 10001, 10002",
                                    startAdornment: cityForm.postalZipCodes.length > 0 && (
                                        <Typography sx={{ fontSize: '10px', color: 'green', mr: 0.5 }}>
                                            📮
                                        </Typography>
                                    )
                                }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                helperText={cityForm.postalZipCodes.length > 0 ?
                                    "Auto-filled by Google Places (you can add more)" :
                                    "Enter postal codes separated by commas or use Auto-Fill"
                                }
                                FormHelperTextProps={{
                                    sx: {
                                        fontSize: '11px',
                                        color: cityForm.postalZipCodes.length > 0 ? 'green' : 'inherit'
                                    }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={cityForm.enabled}
                                        onChange={(e) => setCityForm(prev => ({ ...prev, enabled: e.target.checked }))}
                                        size="small"
                                    />
                                }
                                label={<Typography sx={{ fontSize: '12px' }}>Enabled</Typography>}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCityDialogOpen(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button variant="contained" size="small" sx={{ fontSize: '12px' }}>
                        {editingCity ? 'Update' : 'Create'} City
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EnterpriseZoneManagement;
