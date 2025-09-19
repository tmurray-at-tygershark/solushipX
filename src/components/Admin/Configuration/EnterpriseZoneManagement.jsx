/**
 * Enterprise Zone Management Component
 * Implements the battle-tested zone architecture:
 * Regions → ZoneSets → Zone Maps → Carrier Bindings → Overrides
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    ListItem,
    Checkbox,
    Autocomplete
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Public as RegionIcon,
    Map as ZoneSetIcon,
    Override as OverrideIcon,
    Info as InfoIcon,
    LocationCity as CityIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    Label as ZoneIcon,
    ImportExport as ImportExportIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, orderBy, query, where, limit, startAfter, getCountFromServer, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { functions, db } from '../../../firebase';
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
        description: '',
        selectedZones: [], // Array of zone IDs
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
    const zoneCoverageSearchTimeout = useRef(null);

    // Zones state (individual zones within zone sets)
    const [zones, setZones] = useState([]);
    const [filteredZones, setFilteredZones] = useState([]);
    const [zoneSearchTerm, setZoneSearchTerm] = useState(''); // Actual search term for database
    const [zoneSearchDisplay, setZoneSearchDisplay] = useState(''); // Display value for input
    const [zoneCountryFilter, setZoneCountryFilter] = useState('');
    const [zoneProvinceFilter, setZoneProvinceFilter] = useState('');
    const [zoneSuggestions, setZoneSuggestions] = useState([]);
    const [showZoneSuggestions, setShowZoneSuggestions] = useState(false);
    const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
    const [editingZone, setEditingZone] = useState(null);

    // Zone pagination state
    const [zonePage, setZonePage] = useState(0);
    const [zoneRowsPerPage, setZoneRowsPerPage] = useState(100);
    const [totalZones, setTotalZones] = useState(0);
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

    // Zone deletion state
    const [deleteZoneDialogOpen, setDeleteZoneDialogOpen] = useState(false);
    const [deletingZone, setDeletingZone] = useState(null);

    // Zone set deletion state
    const [deleteZoneSetDialogOpen, setDeleteZoneSetDialogOpen] = useState(false);
    const [deletingZoneSet, setDeletingZoneSet] = useState(null);

    // Region deletion state
    const [deleteRegionDialogOpen, setDeleteRegionDialogOpen] = useState(false);
    const [deletingRegion, setDeletingRegion] = useState(null);

    // Filter options state (loaded from database)
    const [availableCountries, setAvailableCountries] = useState([]);
    const [availableProvinces, setAvailableProvinces] = useState([]);

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

    // Load filter options from all zones in database
    const loadFilterOptions = useCallback(async () => {
        try {
            // Get all zones to build filter options
            const allZonesQuery = query(collection(db, 'zones'), orderBy('country'), orderBy('stateProvince'));
            const allZonesSnapshot = await getDocs(allZonesQuery);

            const countries = new Set();
            const provincesByCountry = new Map();

            allZonesSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.country) {
                    countries.add(data.country);

                    if (data.stateProvince) {
                        if (!provincesByCountry.has(data.country)) {
                            provincesByCountry.set(data.country, new Set());
                        }
                        provincesByCountry.get(data.country).add(data.stateProvince);
                    }
                }
            });

            setAvailableCountries(Array.from(countries).sort());

            // Convert to object with sorted arrays
            const provincesObj = {};
            provincesByCountry.forEach((provinces, country) => {
                provincesObj[country] = Array.from(provinces).sort();
            });
            setAvailableProvinces(provincesObj);

            console.log('🌍 Loaded filter options:', {
                countries: Array.from(countries),
                provinces: provincesObj
            });

        } catch (error) {
            console.error('Error loading filter options:', error);
        }
    }, []);

    // Load data based on active tab
    useEffect(() => {
        if (activeTab === 0) {
            loadRegions();
        } else if (activeTab === 1) {
            loadCities(cityPage, cityRowsPerPage, citySearchTerm, cityCountryFilter, cityProvinceFilter, citySortBy, citySortDirection);
        } else if (activeTab === 2) {
            loadZones(zonePage, zoneRowsPerPage, zoneSearchTerm, zoneCountryFilter, zoneProvinceFilter);
            // Load filter options when zones tab is first accessed
            if (availableCountries.length === 0) {
                loadFilterOptions();
            }
        } else if (activeTab === 3) {
            loadZoneSets();
            // Also load all zones for zone name resolution in zone sets table
            if (zones.length < 500) { // Only if we don't already have a comprehensive zone list
                loadZones(0, 1000, '', '', ''); // Load all zones for name lookup
            }
        }
    }, [activeTab, cityPage, cityRowsPerPage, citySearchTerm, cityCountryFilter, cityProvinceFilter, citySortBy, citySortDirection, zonePage, zoneRowsPerPage, zoneSearchTerm, zoneCountryFilter, zoneProvinceFilter, availableCountries.length, loadFilterOptions, zones.length]);

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

    // Load zones
    const loadZones = useCallback(async (page = 0, pageSize = 100, searchTerm = '', countryFilter = '', provinceFilter = '') => {
        setLoading(true);
        try {
            // Build the base query
            let baseQuery = query(collection(db, 'zones'), orderBy('zoneName'));

            // Apply filters if provided
            if (countryFilter) {
                baseQuery = query(baseQuery, where('country', '==', countryFilter));
            }
            if (provinceFilter) {
                baseQuery = query(baseQuery, where('stateProvince', '==', provinceFilter));
            }

            // Get total count for pagination
            const countSnapshot = await getCountFromServer(baseQuery);
            const totalCount = countSnapshot.data().count;
            setTotalZones(totalCount);

            // Apply pagination
            const paginatedQuery = query(baseQuery, limit(pageSize));

            // If not the first page, we need to get the starting point
            if (page > 0) {
                const offsetQuery = query(baseQuery, limit(page * pageSize));
                const offsetSnapshot = await getDocs(offsetQuery);
                const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
                if (lastDoc) {
                    const finalQuery = query(baseQuery, startAfter(lastDoc), limit(pageSize));
                    const zonesSnapshot = await getDocs(finalQuery);
                    processZonesData(zonesSnapshot, searchTerm);
                } else {
                    setZones([]);
                    setFilteredZones([]);
                }
            } else {
                const zonesSnapshot = await getDocs(paginatedQuery);
                processZonesData(zonesSnapshot, searchTerm);
            }

            console.log(`🌍 Loaded zones: page ${page + 1}, ${pageSize} per page, total: ${totalCount}`);

        } catch (error) {
            console.error('Error loading zones:', error);
            enqueueSnackbar('Error loading zones', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    // Helper function to process zones data
    const processZonesData = (zonesSnapshot, searchTerm) => {
        const zonesData = [];
        zonesSnapshot.forEach(doc => {
            zonesData.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Apply client-side search filtering if search term is provided
        let filteredData = zonesData;
        if (searchTerm && searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            filteredData = zonesData.filter(zone => {
                const nameMatch = zone.zoneName?.toLowerCase().includes(searchLower);
                const codeMatch = zone.zoneId?.toLowerCase().includes(searchLower) ||
                    zone.zoneCode?.toLowerCase().includes(searchLower);
                const provinceMatch = zone.stateProvince?.toLowerCase().includes(searchLower);
                return nameMatch || codeMatch || provinceMatch;
            });
        }

        setZones(zonesData);
        setFilteredZones(filteredData);
    };

    // Load zone cities for editing
    const loadZoneCities = useCallback(async (zoneId) => {
        if (!zoneId) return;

        try {
            const zoneCitiesQuery = query(
                collection(db, 'zoneCities'),
                where('zoneId', '==', zoneId)
            );
            const zoneCitiesSnapshot = await getDocs(zoneCitiesQuery);

            const cities = [];
            const postalCodes = [];

            zoneCitiesSnapshot.forEach(doc => {
                const cityData = doc.data();

                // Add to cities array
                cities.push({
                    id: doc.id,
                    name: cityData.city,
                    province: cityData.province,
                    country: cityData.country,
                    postalCode: cityData.primaryPostal,
                    latitude: cityData.latitude,
                    longitude: cityData.longitude,
                    matchType: cityData.matchType
                });

                // Add unique postal codes
                if (cityData.primaryPostal && !postalCodes.some(p => p.code === cityData.primaryPostal)) {
                    postalCodes.push({
                        code: cityData.primaryPostal,
                        city: cityData.city,
                        province: cityData.province,
                        country: cityData.country
                    });
                }
            });

            // Update zone form with loaded cities
            setZoneForm(prev => ({
                ...prev,
                cities: cities,
                postalCodes: postalCodes
            }));

            console.log(`🌍 Loaded ${cities.length} cities for zone ${zoneId}`);

        } catch (error) {
            console.error('Error loading zone cities:', error);
            enqueueSnackbar('Error loading zone cities', { variant: 'error' });
        }
    }, [enqueueSnackbar]);

    // Zone search and filtering - now triggers server-side reload
    const filterZones = useCallback(() => {
        // Reset to first page when filters change
        setZonePage(0);
        // Reload zones with current filters
        loadZones(0, zoneRowsPerPage, zoneSearchTerm, zoneCountryFilter, zoneProvinceFilter);
    }, [zoneSearchTerm, zoneCountryFilter, zoneProvinceFilter, zoneRowsPerPage, loadZones]);

    // Generate zone search suggestions
    const generateZoneSuggestions = useCallback((searchTerm) => {
        if (!searchTerm || searchTerm.length < 2) {
            setZoneSuggestions([]);
            return;
        }

        const searchLower = searchTerm.toLowerCase();
        const suggestions = zones
            .filter(zone =>
                zone.zoneCode?.toLowerCase().includes(searchLower) ||
                zone.zoneName?.toLowerCase().includes(searchLower) ||
                zone.primaryCity?.toLowerCase().includes(searchLower) ||
                zone.stateProvince?.toLowerCase().includes(searchLower)
            )
            .slice(0, 10)
            .map(zone => ({
                id: zone.id,
                zoneCode: zone.zoneCode,
                zoneName: zone.zoneName,
                location: `${zone.primaryCity}, ${zone.stateProvince}, ${zone.country}`,
                displayText: `${zone.zoneCode} - ${zone.zoneName} (${zone.primaryCity}, ${zone.stateProvince})`
            }));

        setZoneSuggestions(suggestions);
    }, [zones]);

    // Debounced search effect - updates search term after user stops typing
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setZoneSearchTerm(zoneSearchDisplay);
        }, 800); // Longer delay for better UX

        return () => clearTimeout(timeoutId);
    }, [zoneSearchDisplay]);

    // Zone search effects - triggers database query only when search term changes
    useEffect(() => {
        // Reset to first page when search changes
        setZonePage(0);
        // Trigger database search
        filterZones();
    }, [zoneSearchTerm, filterZones]);

    // Immediate filtering for dropdown filters
    useEffect(() => {
        filterZones();
    }, [zoneCountryFilter, zoneProvinceFilter, filterZones]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            generateZoneSuggestions(zoneSearchDisplay);
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [zoneSearchDisplay, generateZoneSuggestions]);

    // Refresh zones when Zone Set dialog opens to get latest metadata
    useEffect(() => {
        if (zoneSetDialogOpen) {
            console.log('🔄 Zone Set dialog opened - refreshing zones to get latest metadata');
            loadZones(0, 1000, '', '', ''); // Load more zones for selection
        }
    }, [zoneSetDialogOpen, loadZones]);

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
            description: '',
            selectedZones: [],
            enabled: true
        });
        setZoneSetDialogOpen(true);
    };

    // Handle save zone set
    const handleSaveZoneSet = async () => {
        if (!zoneSetForm.name) {
            enqueueSnackbar('Name is required', { variant: 'error' });
            return;
        }

        if (zoneSetForm.selectedZones.length === 0) {
            enqueueSnackbar('At least one zone must be selected', { variant: 'error' });
            return;
        }

        try {
            const createZoneSet = httpsCallable(functions, 'createZoneSet');
            await createZoneSet({
                ...zoneSetForm,
                zoneCount: zoneSetForm.selectedZones.length
            });
            enqueueSnackbar('Zone set created successfully', { variant: 'success' });
            setZoneSetDialogOpen(false);
            loadZoneSets();
        } catch (error) {
            console.error('Error saving zone set:', error);
            enqueueSnackbar(error.message || 'Failed to save zone set', { variant: 'error' });
        }
    };

    // Handle delete zone set
    const handleDeleteZoneSet = async () => {
        if (!deletingZoneSet) return;

        try {
            const deleteZoneSet = httpsCallable(functions, 'deleteZoneSet');
            await deleteZoneSet({ zoneSetId: deletingZoneSet.id });

            enqueueSnackbar('Zone set deleted successfully', { variant: 'success' });
            setDeleteZoneSetDialogOpen(false);
            setDeletingZoneSet(null);
            loadZoneSets();
        } catch (error) {
            console.error('Error deleting zone set:', error);
            enqueueSnackbar(error.message || 'Failed to delete zone set', { variant: 'error' });
        }
    };

    // Handle delete region
    const handleDeleteRegion = async () => {
        if (!deletingRegion) return;

        try {
            // For now, use direct Firestore deletion since there might not be a cloud function
            const regionRef = doc(db, 'regions', deletingRegion.id);
            await deleteDoc(regionRef);

            enqueueSnackbar('Region deleted successfully', { variant: 'success' });
            setDeleteRegionDialogOpen(false);
            setDeletingRegion(null);
            loadRegions();
        } catch (error) {
            console.error('Error deleting region:', error);
            enqueueSnackbar(error.message || 'Failed to delete region', { variant: 'error' });
        }
    };

    // Handle save zone
    const handleSaveZone = async () => {
        if (!zoneForm.zoneCode || !zoneForm.zoneName) {
            enqueueSnackbar('Zone Code and Zone Name are required', { variant: 'error' });
            return;
        }

        try {
            let zoneId;

            if (editingZone) {
                // Update existing zone
                zoneId = editingZone.id;
                const zoneRef = doc(db, 'zones', zoneId);
                // Calculate unique cities count
                const uniqueCities = new Set();
                zoneForm.cities.forEach(city => {
                    uniqueCities.add(`${city.name}-${city.province}-${city.country}`);
                });

                await updateDoc(zoneRef, {
                    zoneCode: zoneForm.zoneCode,
                    zoneName: zoneForm.zoneName,
                    description: zoneForm.description,
                    enabled: zoneForm.enabled,
                    updatedAt: new Date(),
                    metadata: {
                        ...editingZone.metadata,
                        totalCities: uniqueCities.size,
                        totalPostalCodes: zoneForm.postalCodes.length
                    }
                });

                // Clear existing zone cities
                const existingCitiesQuery = query(
                    collection(db, 'zoneCities'),
                    where('zoneId', '==', zoneId)
                );
                const existingCitiesSnapshot = await getDocs(existingCitiesQuery);

                // Delete existing zone cities in batches
                const deleteBatch = [];
                existingCitiesSnapshot.forEach(doc => {
                    deleteBatch.push(deleteDoc(doc.ref));
                });
                if (deleteBatch.length > 0) {
                    await Promise.all(deleteBatch);
                }

            } else {
                // Create new zone
                // Calculate unique cities count
                const uniqueCities = new Set();
                zoneForm.cities.forEach(city => {
                    uniqueCities.add(`${city.name}-${city.province}-${city.country}`);
                });

                const newZoneRef = await addDoc(collection(db, 'zones'), {
                    zoneCode: zoneForm.zoneCode,
                    zoneName: zoneForm.zoneName,
                    description: zoneForm.description,
                    enabled: zoneForm.enabled,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    metadata: {
                        totalCities: uniqueCities.size,
                        totalPostalCodes: zoneForm.postalCodes.length,
                        importSource: 'manual_entry'
                    }
                });
                zoneId = newZoneRef.id;
            }

            // Save zone cities to zoneCities collection
            if (zoneForm.postalCodes.length > 0) {
                const zoneCitiesBatch = [];

                zoneForm.postalCodes.forEach(postal => {
                    // Create base document
                    const zoneCityDoc = {
                        zoneId: zoneId,
                        zoneCode: zoneForm.zoneCode,
                        city: postal.city,
                        province: postal.province,
                        country: postal.country,
                        primaryPostal: postal.code,
                        matchType: 'coordinate',
                        createdAt: new Date()
                    };

                    // Only add coordinates if they exist
                    if (postal.latitude !== undefined && postal.longitude !== undefined &&
                        postal.latitude !== null && postal.longitude !== null) {
                        zoneCityDoc.latitude = postal.latitude;
                        zoneCityDoc.longitude = postal.longitude;
                    }

                    zoneCitiesBatch.push(addDoc(collection(db, 'zoneCities'), zoneCityDoc));
                });

                // Execute all zone city saves
                await Promise.all(zoneCitiesBatch);
                console.log(`💾 Saved ${zoneCitiesBatch.length} zone cities for ${zoneForm.zoneName}`);
            }

            enqueueSnackbar(
                editingZone ? 'Zone updated successfully' : 'Zone created successfully',
                { variant: 'success' }
            );

            setZoneDialogOpen(false);

            // Reload zones with current pagination to show updated metadata
            loadZones(zonePage, zoneRowsPerPage, zoneSearchTerm, zoneCountryFilter, zoneProvinceFilter);

        } catch (error) {
            console.error('Error saving zone:', error);
            enqueueSnackbar(error.message || 'Failed to save zone', { variant: 'error' });
        }
    };

    // Handle zone deletion
    const handleDeleteZone = async () => {
        if (!deletingZone) return;

        try {
            const zoneRef = doc(db, 'zones', deletingZone.id);
            await deleteDoc(zoneRef);

            enqueueSnackbar('Zone deleted successfully', { variant: 'success' });
            setDeleteZoneDialogOpen(false);
            setDeletingZone(null);

            // Reload zones with current pagination
            loadZones(zonePage, zoneRowsPerPage, zoneSearchTerm, zoneCountryFilter, zoneProvinceFilter);
        } catch (error) {
            console.error('Error deleting zone:', error);
            enqueueSnackbar(error.message || 'Failed to delete zone', { variant: 'error' });
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
            } else if (activeTab === 2) { // Zones is now the 3rd tab (index 2)
                // Edit Zone
                setEditingZone(selectedItem);
                loadZoneCities(selectedItem.id);
                setZoneForm({
                    zoneCode: selectedItem.zoneCode || '',
                    zoneName: selectedItem.zoneName || '',
                    description: selectedItem.description || '',
                    cities: [],
                    postalCodes: [],
                    provinces: [],
                    enabled: selectedItem.enabled !== false
                });
                setZoneDialogOpen(true);
            } else if (activeTab === 3) { // Zone Sets is now the 4th tab (index 3)
                // Edit Zone Set
                setEditingZoneSet(selectedItem);
                setZoneSetForm({
                    name: selectedItem.name,
                    description: selectedItem.description || '',
                    selectedZones: selectedItem.selectedZones || [],
                    enabled: selectedItem.enabled !== false
                });
                setZoneSetDialogOpen(true);
            }
        }
        handleCloseActionMenu();
    };

    const handleDeleteItem = () => {
        if (selectedItem) {
            if (activeTab === 0) { // Regions tab
                // Delete Region - use proper dialog
                setDeletingRegion(selectedItem);
                setDeleteRegionDialogOpen(true);
            } else if (activeTab === 1) { // Cities is now the 2nd tab (index 1)
                // Delete City
                if (window.confirm(`Are you sure you want to delete ${selectedItem.data?.city}?`)) {
                    handleDeleteCity(selectedItem.data);
                }
            } else if (activeTab === 2) { // Zones tab
                // Delete Zone - use proper dialog
                setDeletingZone(selectedItem);
                setDeleteZoneDialogOpen(true);
            } else if (activeTab === 3) { // Zone Sets tab
                // Delete Zone Set - use proper dialog
                setDeletingZoneSet(selectedItem);
                setDeleteZoneSetDialogOpen(true);
            } else {
                // TODO: Implement delete functionality for other tabs
                enqueueSnackbar('Delete functionality coming soon', { variant: 'info' });
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

    // City dialog – Google Places autocomplete (predictions)
    const [cityNameSuggestions, setCityNameSuggestions] = useState([]);
    const [showCityNameSuggestions, setShowCityNameSuggestions] = useState(false);
    const cityAutocompleteSvcRef = useRef(null);
    const [savingCity, setSavingCity] = useState(false);

    const ensureCityAutocompleteService = useCallback(async () => {
        if (!window.google?.maps?.places) {
            try {
                const { loadGoogleMaps } = await import('../../../utils/googleMapsLoader');
                await loadGoogleMaps();
            } catch (e) {
                console.warn('⚠️ Failed to load Google Maps before Autocomplete init', e);
            }
        }
        if (!cityAutocompleteSvcRef.current && window.google?.maps?.places) {
            cityAutocompleteSvcRef.current = new window.google.maps.places.AutocompleteService();
        }
    }, []);

    useEffect(() => {
        let timer;
        const fetchPredictions = async () => {
            if (!cityDialogOpen) return;
            const input = (cityForm.city || '').trim();
            if (input.length < 2) {
                setCityNameSuggestions([]);
                setShowCityNameSuggestions(false);
                return;
            }
            await ensureCityAutocompleteService();
            const svc = cityAutocompleteSvcRef.current;
            if (!svc) return;
            const request = {
                input,
                types: ['(cities)'],
            };
            if (cityForm.country) {
                request.componentRestrictions = { country: cityForm.country };
            }
            try {
                svc.getPlacePredictions(request, (predictions, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK && Array.isArray(predictions)) {
                        setCityNameSuggestions(predictions);
                        setShowCityNameSuggestions(predictions.length > 0);
                    } else {
                        setCityNameSuggestions([]);
                        setShowCityNameSuggestions(false);
                    }
                });
            } catch (e) {
                console.warn('⚠️ Autocomplete predictions error', e);
            }
        };
        timer = setTimeout(fetchPredictions, 200);
        return () => clearTimeout(timer);
    }, [cityForm.city, cityForm.country, cityDialogOpen, ensureCityAutocompleteService]);

    useEffect(() => {
        const handler = (e) => {
            if (showCityNameSuggestions && !e.target.closest('[data-city-autocomplete]')) {
                setShowCityNameSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showCityNameSuggestions]);

    const handleCityPredictionSelect = useCallback(async (prediction) => {
        try {
            await ensureCityAutocompleteService();
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const result = results[0];
                    const loc = result.geometry?.location;
                    let provinceState = '';
                    let provinceStateName = '';
                    let country = '';
                    let countryName = '';
                    result.address_components.forEach((c) => {
                        if (c.types.includes('administrative_area_level_1')) {
                            provinceState = c.short_name;
                            provinceStateName = c.long_name;
                        }
                        if (c.types.includes('country')) {
                            country = c.short_name;
                            countryName = c.long_name;
                        }
                    });

                    setCityForm(prev => ({
                        ...prev,
                        city: prediction.structured_formatting?.main_text || prev.city,
                        provinceState,
                        provinceStateName,
                        country: country || prev.country,
                        countryName: countryName || prev.countryName,
                        isCanada: (country || prev.country) === 'CA',
                        isUS: (country || prev.country) === 'US',
                        latitude: loc ? loc.lat().toString() : prev.latitude,
                        longitude: loc ? loc.lng().toString() : prev.longitude
                    }));

                    // Populate postal/zip codes from our geoLocations database
                    (async () => {
                        try {
                            const { collection, getDocs, query, where, limit: firestoreLimit } = await import('firebase/firestore');
                            const { db } = await import('../../../firebase');
                            const cityName = prediction.structured_formatting?.main_text || '';
                            const q = query(
                                collection(db, 'geoLocations'),
                                where('city', '==', cityName),
                                where('provinceState', '==', provinceState),
                                where('country', '==', country),
                                firestoreLimit(200)
                            );
                            const snap = await getDocs(q);
                            const codesSet = new Set();
                            snap.forEach(doc => {
                                const d = doc.data();
                                if (d.postalZipCode) codesSet.add(String(d.postalZipCode).toUpperCase());
                            });
                            const codes = Array.from(codesSet).slice(0, 50);
                            setCityForm(prev => ({ ...prev, postalZipCodes: codes }));
                        } catch (e) {
                            console.warn('⚠️ Failed to fetch postal codes for selection', e);
                        }
                    })();
                    setShowCityNameSuggestions(false);
                }
            });
        } catch (e) {
            console.warn('⚠️ Failed to resolve prediction', e);
        }
    }, [ensureCityAutocompleteService, setCityForm]);

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

    // Bulk zone import handler
    const handleBulkZoneImport = async () => {
        try {
            setLoading(true);

            // Call cloud function to import all comprehensive zones
            const importAllComprehensiveZones = httpsCallable(functions, 'importAllComprehensiveZones');

            enqueueSnackbar('Starting import of 600+ comprehensive zones...', { variant: 'info' });

            const result = await importAllComprehensiveZones({
                clearExisting: true // Clear existing zones before import
            });

            if (result.data.success) {
                enqueueSnackbar(
                    `Successfully imported ${result.data.successfulZones} zones covering every shipping destination in North America!`,
                    { variant: 'success', persist: true }
                );

                console.log('🎉 Zone import complete:', result.data);
            } else {
                enqueueSnackbar('Zone import failed', { variant: 'error' });
            }

        } catch (error) {
            console.error('❌ Bulk zone import error:', error);
            enqueueSnackbar(`Import failed: ${error.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Zone coverage search handlers
    const handleZoneCoverageSearch = async (searchTerm = null) => {
        const searchValue = searchTerm || zoneCoverageSearch;
        if (!searchValue.trim() || searchValue.trim().length < 2) return;

        try {
            const { collection, getDocs, query, where, limit: firestoreLimit } = await import('firebase/firestore');
            const { db } = await import('../../../firebase');

            const trimmedSearch = searchValue.trim();

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
                suggestions = postalSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        type: 'postal',
                        displayText: `${data.postalZipCode} - ${data.city}, ${data.provinceStateName}`,
                        coordinates: data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : null
                    };
                });
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

                // Group by city to avoid duplicates and count postal codes
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
                            postalCodes: [data.postalZipCode],
                            latitude: data.latitude,
                            longitude: data.longitude,
                            type: 'city'
                        });
                    } else {
                        // Add postal code to existing city
                        const existing = citiesMap.get(cityKey);
                        if (data.postalZipCode && !existing.postalCodes.includes(data.postalZipCode)) {
                            existing.postalCodes.push(data.postalZipCode);
                        }
                        // Update coordinates if not set
                        if (!existing.latitude && data.latitude) {
                            existing.latitude = data.latitude;
                            existing.longitude = data.longitude;
                        }
                    }
                });

                suggestions = Array.from(citiesMap.values()).map(city => ({
                    ...city,
                    postalCodeCount: city.postalCodes.length,
                    displayText: `${city.city}, ${city.provinceStateName}`,
                    coordinates: city.latitude && city.longitude ? `${city.latitude}, ${city.longitude}` : null
                }));
            }

            setZoneCoverageSuggestions(suggestions);

        } catch (error) {
            console.error('❌ Zone coverage search error:', error);
            enqueueSnackbar('Search failed', { variant: 'error' });
        }
    };

    const handleAddZoneCoverage = async (item) => {
        if (item.type === 'city') {
            // Add city with ALL its postal codes
            try {
                // Check for duplicates first
                const exists = zoneForm.cities.some(city =>
                    city.name === item.city && city.province === item.provinceStateName
                );

                if (exists) {
                    enqueueSnackbar(`${item.city}, ${item.provinceStateName} already in zone`, { variant: 'info' });
                    setZoneCoverageSearch('');
                    setZoneCoverageSuggestions([]);
                    return;
                }

                // Fetch all postal codes for this city
                const { collection, getDocs, query, where } = await import('firebase/firestore');
                const { db } = await import('../../../firebase');

                const cityQuery = query(
                    collection(db, 'geoLocations'),
                    where('city', '==', item.city),
                    where('provinceStateName', '==', item.provinceStateName),
                    where('countryName', '==', item.countryName)
                );

                const citySnapshot = await getDocs(cityQuery);
                const allPostalCodes = [];

                citySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.postalZipCode) {
                        allPostalCodes.push({
                            code: data.postalZipCode,
                            city: data.city,
                            province: data.provinceStateName,
                            country: data.countryName,
                            latitude: data.latitude,
                            longitude: data.longitude
                        });
                    }
                });

                // Remove duplicates based on postal code
                const uniquePostalCodes = allPostalCodes.filter((postal, index, self) =>
                    index === self.findIndex(p => p.code === postal.code)
                );

                // Create individual city entries for each postal code (matching expected data structure)
                const existingPostalCodes = zoneForm.postalCodes.map(p => p.code);
                const newPostalCodes = uniquePostalCodes.filter(postal =>
                    !existingPostalCodes.includes(postal.code)
                );

                // Create city entries - one per postal code
                const newCityEntries = uniquePostalCodes.map(postal => ({
                    name: postal.city,
                    province: postal.province,
                    country: postal.country,
                    postalCode: postal.code,
                    latitude: postal.latitude,
                    longitude: postal.longitude,
                    matchType: 'coordinate'
                }));

                // Filter out existing entries
                const existingCityKeys = zoneForm.cities.map(c => `${c.name}-${c.province}-${c.postalCode}`);
                const newCityEntriesFiltered = newCityEntries.filter(city =>
                    !existingCityKeys.includes(`${city.name}-${city.province}-${city.postalCode}`)
                );

                setZoneForm(prev => ({
                    ...prev,
                    cities: [...prev.cities, ...newCityEntriesFiltered],
                    postalCodes: [...prev.postalCodes, ...newPostalCodes]
                }));

                enqueueSnackbar(
                    `Added ${item.city}, ${item.provinceStateName} with ${uniquePostalCodes.length} postal codes to zone`,
                    { variant: 'success' }
                );

            } catch (error) {
                console.error('Error adding city to zone:', error);
                enqueueSnackbar('Failed to add city to zone', { variant: 'error' });
            }
        } else if (item.type === 'postal') {
            // Add single postal code to zone
            const newPostal = {
                code: item.postalZipCode,
                city: item.city,
                province: item.provinceStateName,
                country: item.countryName,
                latitude: item.latitude,
                longitude: item.longitude
            };

            // Check for duplicates
            const exists = zoneForm.postalCodes.some(postal => postal.code === newPostal.code);

            if (!exists) {
                // Add to postal codes list
                const newCityEntry = {
                    name: item.city,
                    province: item.provinceStateName,
                    country: item.countryName,
                    postalCode: item.postalZipCode,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    matchType: 'postal'
                };

                setZoneForm(prev => ({
                    ...prev,
                    cities: [...prev.cities, newCityEntry],
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
        setZoneForm(prev => {
            const updated = {
                ...prev,
                [type]: prev[type].filter((_, i) => i !== index)
            };

            // If removing a city, update postal codes list
            if (type === 'cities') {
                const remainingCities = updated.cities;
                const uniquePostalCodes = [];

                remainingCities.forEach(city => {
                    if (city.postalCode && !uniquePostalCodes.some(p => p.code === city.postalCode)) {
                        uniquePostalCodes.push({
                            code: city.postalCode,
                            city: city.name,
                            province: city.province,
                            country: city.country
                        });
                    }
                });

                updated.postalCodes = uniquePostalCodes;
            }

            return updated;
        });
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
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Selected Zones</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Count</TableCell>
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
                        ) : zoneSets.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
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
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zoneSet.description || 'No description'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {(zoneSet.selectedZones || []).slice(0, 3).map((zoneId) => {
                                                const zone = zones.find(z => z.id === zoneId);
                                                const zoneName = zone?.zoneName || zone?.zoneCode || `Zone ${zoneId.slice(0, 6)}`;
                                                return (
                                                    <Chip
                                                        key={zoneId}
                                                        label={zoneName}
                                                        size="small"
                                                        sx={{ fontSize: '9px' }}
                                                        title={zone ? `${zone.zoneName} (${zone.stateProvince}, ${zone.country})` : zoneName}
                                                    />
                                                );
                                            })}
                                            {(zoneSet.selectedZones || []).length > 3 && (
                                                <Chip
                                                    label={`+${(zoneSet.selectedZones || []).length - 3} more`}
                                                    size="small"
                                                    sx={{ fontSize: '9px' }}
                                                    color="default"
                                                    variant="outlined"
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {(zoneSet.selectedZones || []).length} zones
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
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<ImportExportIcon />}
                        onClick={handleBulkZoneImport}
                        size="small"
                        sx={{ fontSize: '12px' }}
                        disabled={loading}
                    >
                        Import 600+ Zones
                    </Button>
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
            </Box>


            {/* Zone Search and Filters */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                    <Box sx={{ position: 'relative' }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search zones by code, name, city, or province..."
                            value={zoneSearchDisplay}
                            onChange={(e) => setZoneSearchDisplay(e.target.value)}
                            onFocus={() => {
                                if (zoneSuggestions.length > 0) {
                                    setShowZoneSuggestions(true);
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    // Immediate search on Enter
                                    setZoneSearchTerm(zoneSearchDisplay);
                                    setShowZoneSuggestions(false);
                                } else if (e.key === 'Escape') {
                                    setZoneSearchDisplay('');
                                    setZoneSearchTerm('');
                                    setShowZoneSuggestions(false);
                                }
                            }}
                            onBlur={(e) => {
                                // Delay hiding suggestions to allow clicking on them
                                setTimeout(() => {
                                    if (!e.relatedTarget || !e.relatedTarget.closest('[data-zone-suggestion]')) {
                                        setShowZoneSuggestions(false);
                                    }
                                }, 150);
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                                endAdornment: zoneSearchDisplay && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                setZoneSearchDisplay('');
                                                setZoneSearchTerm('');
                                                setShowZoneSuggestions(false);
                                            }}
                                        >
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ),
                                sx: { fontSize: '12px' }
                            }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                        />

                        {/* Zone Search Suggestions */}
                        {showZoneSuggestions && zoneSuggestions.length > 0 && (
                            <Paper
                                sx={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 1000,
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    border: '1px solid #e0e0e0'
                                }}
                            >
                                {/* Close button for zone suggestions */}
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    px: 1,
                                    py: 0.5,
                                    borderBottom: '1px solid #e0e0e0',
                                    bgcolor: '#f8fafc'
                                }}>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        {zoneSuggestions.length} zone matches
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={() => setShowZoneSuggestions(false)}
                                        sx={{ p: 0.25 }}
                                    >
                                        <ClearIcon sx={{ fontSize: '14px' }} />
                                    </IconButton>
                                </Box>
                                <List dense>
                                    {zoneSuggestions.map((suggestion) => (
                                        <ListItem
                                            key={suggestion.id}
                                            button
                                            onClick={() => {
                                                setZoneSearchTerm(suggestion.displayText);
                                                setShowZoneSuggestions(false);
                                            }}
                                            sx={{ py: 0.5 }}
                                            data-zone-suggestion="true"
                                        >
                                            <ListItemText
                                                primary={suggestion.displayText}
                                                secondary={suggestion.location}
                                                primaryTypographyProps={{ fontSize: '12px' }}
                                                secondaryTypographyProps={{ fontSize: '11px' }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Paper>
                        )}
                    </Box>
                </Grid>
                <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                        <Select
                            value={zoneCountryFilter}
                            onChange={(e) => {
                                setZoneCountryFilter(e.target.value);
                                // Clear province filter when country changes
                                setZoneProvinceFilter('');
                            }}
                            label="Country"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                            {availableCountries.map(country => (
                                <MenuItem key={country} value={country} sx={{ fontSize: '12px' }}>
                                    {country === 'Canada' ? '🇨🇦 ' : country === 'United States' ? '🇺🇸 ' : ''}{country}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Province/State</InputLabel>
                        <Select
                            value={zoneProvinceFilter}
                            onChange={(e) => setZoneProvinceFilter(e.target.value)}
                            label="Province/State"
                            sx={{ fontSize: '12px' }}
                            disabled={!zoneCountryFilter}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Provinces/States</MenuItem>
                            {zoneCountryFilter && availableProvinces[zoneCountryFilter] &&
                                availableProvinces[zoneCountryFilter].map(province => (
                                    <MenuItem key={province} value={province} sx={{ fontSize: '12px' }}>
                                        {province}
                                    </MenuItem>
                                ))
                            }
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            {/* Results Summary */}
            {zoneSearchTerm || zoneCountryFilter || zoneProvinceFilter ? (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Showing {filteredZones.length} zones on this page of {totalZones} total
                        {zoneSearchTerm && ` matching "${zoneSearchTerm}"`}
                        {zoneCountryFilter && ` in ${zoneCountryFilter}`}
                        {zoneProvinceFilter && ` - ${zoneProvinceFilter}`}
                    </Typography>
                </Box>
            ) : (
                totalZones > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Showing {filteredZones.length} zones on this page of {totalZones} total
                        </Typography>
                    </Box>
                )
            )}

            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Code</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zone Name</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Cities</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Zip/Postal Codes</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>State/Provinces</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Country</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', textAlign: 'center' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                                    <CircularProgress size={24} />
                                    <Typography sx={{ mt: 1, fontSize: '12px', color: '#6b7280' }}>
                                        Loading zones...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : filteredZones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ textAlign: 'center', fontSize: '12px', py: 4, color: '#6b7280' }}>
                                    No zones configured yet. Click "Import 600+ Zones" to load comprehensive North American zones.
                                    <br />
                                    <Typography variant="caption" sx={{ fontSize: '11px', mt: 1, display: 'block' }}>
                                        Examples: "GTA Zone" (Toronto, Mississauga), "Southern Ontario Zone" (London, Windsor), "Quebec Zone" (Montreal, Quebec City)
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredZones.map((zone) => (
                                <TableRow key={zone.id} hover>
                                    <TableCell
                                        sx={{
                                            fontSize: '12px',
                                            fontFamily: 'monospace',
                                            cursor: 'pointer',
                                            color: '#1976d2',
                                            '&:hover': {
                                                backgroundColor: '#f5f5f5',
                                                textDecoration: 'underline'
                                            }
                                        }}
                                        onClick={() => {
                                            setEditingZone(zone);
                                            loadZoneCities(zone.id);
                                            setZoneForm({
                                                zoneCode: zone.zoneCode || zone.zoneId || '',
                                                zoneName: zone.zoneName || '',
                                                description: zone.description || '',
                                                cities: [],
                                                postalCodes: [],
                                                provinces: [],
                                                enabled: zone.enabled !== false
                                            });
                                            setZoneDialogOpen(true);
                                        }}
                                    >
                                        {zone.zoneId || zone.zoneCode || zone.id}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {zone.zoneName}
                                            </Typography>
                                            {zone.stateProvince && (
                                                <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    {zone.stateProvince}, {zone.country}
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zone.metadata?.totalCities || zone.cityCount || zone.cities?.length || 0}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zone.metadata?.totalPostalCodes || zone.postalCodeCount || zone.postalCodes?.length || 0}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zone.stateProvince || 'N/A'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {zone.country || 'N/A'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={zone.enabled !== false ? 'Active' : 'Inactive'}
                                            size="small"
                                            color={zone.enabled !== false ? 'success' : 'default'}
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ textAlign: 'center' }}>
                                        <IconButton
                                            size="small"
                                            onClick={(event) => {
                                                setActionMenuAnchor(event.currentTarget);
                                                setSelectedItem(zone);
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
            </TableContainer>

            {/* Zone Pagination */}
            <TablePagination
                component="div"
                count={totalZones}
                page={zonePage}
                onPageChange={(event, newPage) => {
                    setZonePage(newPage);
                    loadZones(newPage, zoneRowsPerPage, zoneSearchTerm, zoneCountryFilter, zoneProvinceFilter);
                }}
                rowsPerPage={zoneRowsPerPage}
                onRowsPerPageChange={(event) => {
                    const newRowsPerPage = parseInt(event.target.value, 10);
                    setZoneRowsPerPage(newRowsPerPage);
                    setZonePage(0);
                    loadZones(0, newRowsPerPage, zoneSearchTerm, zoneCountryFilter, zoneProvinceFilter);
                }}
                rowsPerPageOptions={[25, 50, 100, 250]}
                sx={{
                    '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                        fontSize: '12px'
                    }
                }}
            />
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
                </Tabs>
            </Box>

            {/* Tab Content */}
            {activeTab === 0 && renderRegionsTab()}
            {activeTab === 1 && renderCitiesTab()}
            {activeTab === 2 && renderZonesTab()}
            {activeTab === 3 && renderZoneSetsTab()}

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
                    <Alert severity="info" sx={{ fontSize: '12px', mb: 2 }}>
                        Zone Sets are collections of existing zones. Select multiple zones from the database to group them together.
                    </Alert>

                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Zone Set Name"
                                value={zoneSetForm.name}
                                onChange={(e) => setZoneSetForm(prev => ({ ...prev, name: e.target.value }))}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                placeholder="e.g., Canadian Standard Zones, US Express Zones"
                            />
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
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                Select Zones to Include
                            </Typography>

                            <Autocomplete
                                multiple
                                options={zones}
                                getOptionLabel={(zone) => zone.zoneName || zone.zoneCode || zone.id}
                                value={zones.filter(zone => zoneSetForm.selectedZones.includes(zone.id))}
                                onChange={(event, newValue) => {
                                    setZoneSetForm(prev => ({
                                        ...prev,
                                        selectedZones: newValue.map(zone => zone.id)
                                    }));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Search and Select Zones"
                                        placeholder="Type to search zones by name, code, location..."
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                )}
                                renderTags={(value, getTagProps) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {value.map((zone, index) => {
                                            const tagProps = getTagProps({ index });
                                            return (
                                                <Chip
                                                    {...tagProps}
                                                    key={zone.id}
                                                    label={zone.zoneName || zone.zoneCode}
                                                    size="small"
                                                    onDelete={() => {
                                                        // Remove this zone from selection
                                                        setZoneSetForm(prev => ({
                                                            ...prev,
                                                            selectedZones: prev.selectedZones.filter(id => id !== zone.id)
                                                        }));
                                                    }}
                                                    color={zone.enabled !== false ? 'primary' : 'default'}
                                                    sx={{
                                                        fontSize: '10px',
                                                        '& .MuiChip-deleteIcon': {
                                                            fontSize: '14px',
                                                            '&:hover': {
                                                                color: '#d32f2f'
                                                            }
                                                        }
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                )}
                                renderOption={(props, zone, { selected }) => (
                                    <li {...props} style={{ fontSize: '12px', padding: '8px 16px' }}>
                                        <Checkbox
                                            checked={selected}
                                            size="small"
                                            sx={{ mr: 1 }}
                                        />
                                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                                                    {zone.zoneName}
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    Code: {zone.zoneCode || zone.zoneId} • {zone.stateProvince}, {zone.country}
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    📍 {zone.metadata?.totalCities || 0} cities, 📮 {zone.metadata?.totalPostalCodes || 0} postal codes
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                                                <Chip
                                                    label={zone.enabled !== false ? 'Active' : 'Inactive'}
                                                    size="small"
                                                    color={zone.enabled !== false ? 'success' : 'default'}
                                                    sx={{ fontSize: '9px' }}
                                                />
                                                {zone.country === 'Canada' && (
                                                    <Chip label="🇨🇦" size="small" sx={{ fontSize: '8px', minWidth: '24px' }} />
                                                )}
                                                {zone.country === 'United States' && (
                                                    <Chip label="🇺🇸" size="small" sx={{ fontSize: '8px', minWidth: '24px' }} />
                                                )}
                                            </Box>
                                        </Box>
                                    </li>
                                )}
                                filterOptions={(options, { inputValue }) => {
                                    if (!inputValue) return options;
                                    const searchTerm = inputValue.toLowerCase();
                                    return options.filter(zone => {
                                        const searchableText = [
                                            zone.zoneName,
                                            zone.zoneCode,
                                            zone.zoneId,
                                            zone.stateProvince,
                                            zone.country,
                                            zone.description
                                        ].filter(Boolean).join(' ').toLowerCase();
                                        return searchableText.includes(searchTerm);
                                    });
                                }}
                                size="small"
                                sx={{
                                    '& .MuiAutocomplete-inputRoot': {
                                        fontSize: '12px'
                                    },
                                    '& .MuiAutocomplete-listbox': {
                                        maxHeight: '300px'
                                    }
                                }}
                            />

                            {zoneSetForm.selectedZones.length > 0 && (
                                <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 1 }}>
                                    ✅ {zoneSetForm.selectedZones.length} zone(s) selected - Click ✕ on chips to remove individual zones
                                </Typography>
                            )}
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

                            {/* City/Postal Code Lookup */}
                            <Box sx={{ mb: 2, position: 'relative' }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Type city name, postal/zip code, or province/state..."
                                    value={zoneCoverageSearch}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setZoneCoverageSearch(value);

                                        // Trigger autocomplete search on typing (debounced)
                                        if (value.length >= 2) {
                                            clearTimeout(zoneCoverageSearchTimeout.current);
                                            zoneCoverageSearchTimeout.current = setTimeout(() => {
                                                handleZoneCoverageSearch(value);
                                            }, 300);
                                        } else {
                                            setZoneCoverageSuggestions([]);
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (zoneCoverageSuggestions.length > 0) {
                                                handleAddZoneCoverage(zoneCoverageSuggestions[0]);
                                            }
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            setZoneCoverageSuggestions([]);
                                        }
                                    }}
                                    onFocus={() => {
                                        if (zoneCoverageSearch.length >= 2 && zoneCoverageSuggestions.length === 0) {
                                            handleZoneCoverageSearch(zoneCoverageSearch);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        // Delay hiding suggestions to allow clicking on them
                                        setTimeout(() => {
                                            // Only hide if not clicking on a suggestion
                                            if (!e.relatedTarget || !e.relatedTarget.closest('[data-suggestion-item]')) {
                                                setZoneCoverageSuggestions([]);
                                            }
                                        }, 150);
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
                                                    onClick={() => {
                                                        if (zoneCoverageSuggestions.length > 0) {
                                                            handleAddZoneCoverage(zoneCoverageSuggestions[0]);
                                                        } else if (zoneCoverageSearch.trim().length >= 2) {
                                                            handleZoneCoverageSearch();
                                                        }
                                                    }}
                                                    disabled={!zoneCoverageSearch.trim() || zoneCoverageSearch.trim().length < 2}
                                                    sx={{
                                                        ml: 1,
                                                        fontSize: '11px',
                                                        minWidth: 'auto',
                                                        px: 2
                                                    }}
                                                >
                                                    {zoneCoverageSuggestions.length > 0 ? 'Add' : 'Search'}
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
                                        {/* Close button for suggestions */}
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            px: 1,
                                            py: 0.5,
                                            borderBottom: '1px solid #e0e0e0',
                                            bgcolor: '#f8fafc'
                                        }}>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {zoneCoverageSuggestions.length} suggestions
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => setZoneCoverageSuggestions([])}
                                                sx={{ p: 0.25 }}
                                            >
                                                <ClearIcon sx={{ fontSize: '14px' }} />
                                            </IconButton>
                                        </Box>
                                        <List dense>
                                            {zoneCoverageSuggestions.map((suggestion, index) => (
                                                <ListItem
                                                    key={index}
                                                    button
                                                    onClick={() => handleAddZoneCoverage(suggestion)}
                                                    sx={{ py: 0.5 }}
                                                    data-suggestion-item="true"
                                                >
                                                    <ListItemText
                                                        primary={
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    {suggestion.city}
                                                                </Typography>
                                                                {suggestion.type === 'city' && suggestion.postalCodeCount && (
                                                                    <Chip
                                                                        label={`${suggestion.postalCodeCount} postal codes`}
                                                                        size="small"
                                                                        sx={{
                                                                            height: '18px',
                                                                            fontSize: '10px',
                                                                            backgroundColor: '#e8f5e8',
                                                                            color: '#2e7d32'
                                                                        }}
                                                                    />
                                                                )}
                                                                {suggestion.type === 'postal' && (suggestion.postalCode || suggestion.postalZipCode) && (
                                                                    <Chip
                                                                        label={suggestion.postalCode || suggestion.postalZipCode}
                                                                        size="small"
                                                                        sx={{
                                                                            height: '18px',
                                                                            fontSize: '10px',
                                                                            backgroundColor: '#e3f2fd',
                                                                            color: '#1976d2'
                                                                        }}
                                                                    />
                                                                )}
                                                                {suggestion.coordinates && (
                                                                    <Chip
                                                                        label={suggestion.coordinates}
                                                                        size="small"
                                                                        sx={{
                                                                            height: '18px',
                                                                            fontSize: '10px',
                                                                            backgroundColor: '#f3e5f5',
                                                                            color: '#7b1fa2'
                                                                        }}
                                                                    />
                                                                )}
                                                            </Box>
                                                        }
                                                        secondary={
                                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                                                {suggestion.provinceStateName}, {suggestion.countryName}
                                                                {suggestion.type === 'postal' && suggestion.postalZipType && (
                                                                    <span style={{ marginLeft: 8, fontWeight: 500 }}>
                                                                        ({suggestion.postalZipType.toUpperCase()})
                                                                    </span>
                                                                )}
                                                            </Typography>
                                                        }
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Paper>
                                )}
                            </Box>

                            {/* Zone Cities Management */}
                            {zoneForm.cities.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 2 }}>
                                        Zone Cities ({zoneForm.cities.length} cities)
                                    </Typography>

                                    <TableContainer component={Paper} sx={{ maxHeight: 300, border: '1px solid #e5e7eb' }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '11px' }}>City</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '11px' }}>Province/State</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '11px' }}>Country</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '11px' }}>Postal/Zip</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '11px' }}>Match Type</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '11px', textAlign: 'center' }}>Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {zoneForm.cities.map((city, index) => (
                                                    <TableRow key={city.id || index} hover>
                                                        <TableCell sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                            {city.name}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '11px' }}>
                                                            {city.province}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '11px' }}>
                                                            {city.country}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                                            {city.postalCode || 'N/A'}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '11px' }}>
                                                            <Chip
                                                                label={city.matchType || 'manual'}
                                                                size="small"
                                                                color={city.matchType === 'coordinate' ? 'success' :
                                                                    city.matchType === 'postal' ? 'info' :
                                                                        city.matchType === 'name' ? 'warning' : 'default'}
                                                                sx={{ fontSize: '10px', height: '18px' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ textAlign: 'center' }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleRemoveZoneCoverage('cities', index)}
                                                                sx={{ color: '#ef4444' }}
                                                            >
                                                                <ClearIcon sx={{ fontSize: '14px' }} />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}

                            {/* Postal Codes Summary (derived from cities) */}
                            {zoneForm.postalCodes.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                        Postal/Zip Codes Coverage ({zoneForm.postalCodes.length} unique codes)
                                    </Typography>
                                    <Alert severity="info" sx={{ fontSize: '11px', mb: 1 }}>
                                        These postal codes are automatically derived from the cities above. Remove cities to update this list.
                                    </Alert>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: '100px', overflow: 'auto' }}>
                                        {zoneForm.postalCodes.map((postal, index) => (
                                            <Chip
                                                key={`postal-${index}`}
                                                label={postal.code}
                                                size="small"
                                                sx={{ fontSize: '11px', backgroundColor: '#e3f2fd', cursor: 'default' }}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            )}

                            {/* Provinces Display */}
                            {zoneForm.provinces.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                        Provinces/States ({zoneForm.provinces.length})
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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
                    <Button
                        onClick={handleSaveZone}
                        variant="contained"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
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
                            <Box sx={{ position: 'relative', width: '100%' }} data-city-autocomplete>
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
                                {showCityNameSuggestions && cityNameSuggestions.length > 0 && (
                                    <Paper
                                        sx={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            zIndex: 1300,
                                            maxHeight: 280,
                                            overflowY: 'auto',
                                            border: '1px solid #e5e7eb',
                                            borderTop: 'none',
                                        }}
                                    >
                                        <List dense>
                                            {cityNameSuggestions.map((p) => (
                                                <ListItem key={p.place_id} button onClick={() => handleCityPredictionSelect(p)} sx={{ py: 0.5 }}>
                                                    <ListItemText
                                                        primary={<Typography sx={{ fontSize: '12px' }}>{p.structured_formatting?.main_text}</Typography>}
                                                        secondary={<Typography sx={{ fontSize: '11px', color: '#6b7280' }}>{p.structured_formatting?.secondary_text}</Typography>}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Paper>
                                )}
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
                    <Button
                        variant="contained"
                        size="small"
                        onClick={async () => {
                            if (!cityForm.city || !cityForm.provinceState || !cityForm.country) {
                                enqueueSnackbar('City, Province/State, and Country are required.', { variant: 'warning' });
                                return;
                            }
                            try {
                                setSavingCity(true);
                                const payload = {
                                    city: cityForm.city.trim(),
                                    provinceState: cityForm.provinceState,
                                    provinceStateName: cityForm.provinceStateName || '',
                                    country: cityForm.country,
                                    countryName: cityForm.countryName || (cityForm.country === 'CA' ? 'Canada' : cityForm.country === 'US' ? 'United States' : ''),
                                    postalZipCodes: Array.isArray(cityForm.postalZipCodes) ? cityForm.postalZipCodes : [],
                                    latitude: cityForm.latitude ? Number(cityForm.latitude) : null,
                                    longitude: cityForm.longitude ? Number(cityForm.longitude) : null,
                                    enabled: !!cityForm.enabled,
                                    createdAt: new Date(),
                                    updatedAt: new Date()
                                };
                                const { collection, addDoc } = await import('firebase/firestore');
                                const { db } = await import('../../../firebase');
                                // Save master city record
                                await addDoc(collection(db, 'geoCities'), payload);
                                // Also save one-or-more location records so the Cities grid (which reads geoLocations) can show it immediately
                                const locColl = collection(db, 'geoLocations');
                                const codes = payload.postalZipCodes && payload.postalZipCodes.length > 0
                                    ? payload.postalZipCodes
                                    : [''];
                                await Promise.all(
                                    codes.map(code => addDoc(locColl, {
                                        city: payload.city,
                                        provinceState: payload.provinceState,
                                        provinceStateName: payload.provinceStateName,
                                        country: payload.country,
                                        countryName: payload.countryName,
                                        postalZipCode: code,
                                        latitude: payload.latitude,
                                        longitude: payload.longitude,
                                        regionKey: `${payload.country}-${payload.provinceState}`,
                                        cityRegionKey: `${payload.city}-${payload.provinceState}-${payload.country}`,
                                        createdAt: new Date(),
                                        updatedAt: new Date()
                                    }))
                                );
                                enqueueSnackbar('City created successfully', { variant: 'success' });
                                setCityDialogOpen(false);
                                loadCities(0, cityRowsPerPage, citySearchTerm, cityCountryFilter, cityProvinceFilter, citySortBy, citySortDirection);
                            } catch (e) {
                                console.error('❌ Error creating city:', e);
                                enqueueSnackbar('Failed to create city', { variant: 'error' });
                            } finally {
                                setSavingCity(false);
                            }
                        }}
                        disabled={savingCity}
                        startIcon={savingCity ? <CircularProgress size={16} /> : null}
                        sx={{ fontSize: '12px' }}
                    >
                        {savingCity ? 'Saving…' : (editingCity ? 'Update' : 'Create')} City
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Zone Deletion Confirmation Dialog */}
            <Dialog
                open={deleteZoneDialogOpen}
                onClose={() => setDeleteZoneDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Confirm Zone Deletion
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                            This action cannot be undone!
                        </Typography>
                    </Alert>
                    <Typography sx={{ fontSize: '12px', mb: 2 }}>
                        Are you sure you want to delete the following zone?
                    </Typography>
                    {deletingZone && (
                        <Box sx={{
                            p: 2,
                            bgcolor: '#f8fafc',
                            borderRadius: 1,
                            border: '1px solid #e5e7eb'
                        }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                {deletingZone.zoneName}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 0.5 }}>
                                Code: {deletingZone.zoneCode || deletingZone.zoneId}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Location: {deletingZone.stateProvince}, {deletingZone.country}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Cities: {deletingZone.metadata?.totalCities || 0} |
                                Postal Codes: {deletingZone.metadata?.totalPostalCodes || 0}
                            </Typography>
                        </Box>
                    )}
                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 2 }}>
                        This will remove the zone and all its associated city and postal code mappings.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteZoneDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteZone}
                        variant="contained"
                        color="error"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete Zone
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Zone Set Deletion Confirmation Dialog */}
            <Dialog
                open={deleteZoneSetDialogOpen}
                onClose={() => setDeleteZoneSetDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Confirm Zone Set Deletion
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                            This action cannot be undone!
                        </Typography>
                    </Alert>
                    <Typography sx={{ fontSize: '12px', mb: 2 }}>
                        Are you sure you want to delete the following zone set?
                    </Typography>
                    {deletingZoneSet && (
                        <Box sx={{
                            p: 2,
                            bgcolor: '#f8fafc',
                            borderRadius: 1,
                            border: '1px solid #e5e7eb'
                        }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                {deletingZoneSet.name}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 0.5 }}>
                                Description: {deletingZoneSet.description || 'No description'}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Selected Zones: {(deletingZoneSet.selectedZones || []).length} zones
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Status: {deletingZoneSet.enabled ? 'Active' : 'Inactive'}
                            </Typography>
                        </Box>
                    )}
                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 2 }}>
                        This will remove the zone set but will NOT delete the individual zones it contains.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setDeleteZoneSetDialogOpen(false);
                            setDeletingZoneSet(null);
                        }}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteZoneSet}
                        variant="contained"
                        color="error"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete Zone Set
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Region Deletion Confirmation Dialog */}
            <Dialog
                open={deleteRegionDialogOpen}
                onClose={() => setDeleteRegionDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Confirm Region Deletion
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                            This action cannot be undone!
                        </Typography>
                    </Alert>
                    <Typography sx={{ fontSize: '12px', mb: 2 }}>
                        Are you sure you want to delete the following region?
                    </Typography>
                    {deletingRegion && (
                        <Box sx={{
                            p: 2,
                            bgcolor: '#f8fafc',
                            borderRadius: 1,
                            border: '1px solid #e5e7eb'
                        }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                {deletingRegion.name}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 0.5 }}>
                                Type: {deletingRegion.type?.toUpperCase() || 'Unknown'}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Code: {deletingRegion.code}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Status: {deletingRegion.enabled ? 'Active' : 'Inactive'}
                            </Typography>
                        </Box>
                    )}
                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 2 }}>
                        This will permanently remove this region from the system.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setDeleteRegionDialogOpen(false);
                            setDeletingRegion(null);
                        }}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteRegion}
                        variant="contained"
                        color="error"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete Region
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EnterpriseZoneManagement;
