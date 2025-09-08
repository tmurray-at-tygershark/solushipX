/**
 * QuickShip Zone-Based Rate Management Component
 * 
 * Phase 1: Zone Definition & Route Mapping (THIS COMPONENT)
 * - Pickup Zones: Define where carrier can pickup from
 * - Delivery Zones: Define where carrier can deliver to  
 * - Route Mapping: Create zone-to-zone route combinations
 * 
 * Phase 2: Rate Assignment (SEPARATE COMPONENT)
 * - Rate cards will be created for each route combination
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Paper, Typography, Button, Grid, Tabs, Tab,
    FormControlLabel, Checkbox, Chip, Dialog, DialogTitle,
    DialogContent, DialogActions, Alert, CircularProgress,
    Card, CardContent, CardHeader, Divider, IconButton,
    Autocomplete, TextField, List, ListItem, ListItemText,
    ListItemSecondaryAction
} from '@mui/material';
import {
    Map as MapIcon,
    Public as RegionIcon,
    Route as RouteIcon,
    MonetizationOn as ChargeIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon
} from '@mui/icons-material';
import { collection, doc, setDoc, getDoc, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebase';
import { useSnackbar } from 'notistack';
import useGeographicData from '../../../../hooks/useGeographicData';
import SmartCitySelector from './SmartCitySelector';

// Geographic data from our imported database
const canadianProvinces = [
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

const usStates = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

const QuickShipZoneRateManagement = ({ carrierId, carrierName, isOpen, onClose }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [activeTab, setActiveTab] = useState(0); // Start with Pickup Locations tab
    const [loading, setLoading] = useState(false);
    const [savingCities, setSavingCities] = useState(false);
    const [smartSelectorOpen, setSmartSelectorOpen] = useState(false);
    const [savedAreas, setSavedAreas] = useState([]);
    const [smartSelectorZoneForDialog, setSmartSelectorZoneForDialog] = useState('pickupZones');

    // Geographic data hook
    const {
        loading: geoLoading,
        searchCities,
        cities: searchResults
    } = useGeographicData();

    // City search state
    const [citySearchPickup, setCitySearchPickup] = useState('');
    const [citySearchDelivery, setCitySearchDelivery] = useState('');
    const [cityOptionsPickup, setCityOptionsPickup] = useState([]);
    const [cityOptionsDelivery, setCityOptionsDelivery] = useState([]);

    // Smart city selector state (embedded mode)
    const [smartCitySelectorZone, setSmartCitySelectorZone] = useState('pickupZones');

    // Zone configuration state - simplified for pickup/delivery only
    const [zoneConfig, setZoneConfig] = useState({
        // Pickup Zones (Ship From)
        pickupZones: {
            domesticCanada: false,
            domesticUS: false,
            provinceToProvince: false,
            stateToState: false,
            provinceToState: false,
            countryToCountry: false,
            cityToCity: false,
            // Selected provinces/states/cities for each zone type
            selectedProvinces: [], // For province-based zones
            selectedStates: [], // For state-based zones
            selectedCities: [], // For city-based zones
            crossBorderRoutes: [] // For cross-border combinations
        },
        // Delivery Zones (Ship To)
        deliveryZones: {
            domesticCanada: false,
            domesticUS: false,
            provinceToProvince: false,
            stateToState: false,
            provinceToState: false,
            countryToCountry: false,
            cityToCity: false,
            // Selected provinces/states/cities for each zone type
            selectedProvinces: [], // For province-based zones
            selectedStates: [], // For state-based zones
            selectedCities: [], // For city-based zones
            crossBorderRoutes: [] // For cross-border combinations
        },
        // Route mappings (calculated combinations)
        routeMappings: []
    });

    // Handle smart city selector - defined early to avoid TDZ issues
    const handleOpenSmartCitySelector = useCallback((zoneCategory) => {
        setSmartCitySelectorZone(zoneCategory);
    }, []);

    // Handle embedded city selection (update state and auto-save)
    const handleEmbeddedCitySelection = useCallback(async (selectedCities, zoneCategory) => {
        console.log(`🏙️ CITY SELECTION - ${zoneCategory} received ${selectedCities.length} cities from map`);

        const updatedConfig = {
            ...zoneConfig,
            [zoneCategory]: {
                ...zoneConfig[zoneCategory],
                selectedCities: selectedCities
            }
        };

        // Update local state
        setZoneConfig(updatedConfig);

        // Auto-save to database with enhanced feedback
        setSavingCities(true);
        try {
            const docRef = doc(db, 'carrierZoneConfigs', carrierId);
            await setDoc(docRef, {
                carrierId,
                carrierName,
                zoneConfig: updatedConfig,
                lastUpdated: new Date(),
                version: '2.0'
            }, { merge: true });

            console.log(`✅ CITY SELECTION - Auto-saved ${selectedCities.length} cities for ${zoneCategory}`);

            // Enhanced success message with count
            enqueueSnackbar(`💾 Saved ${selectedCities.length} ${zoneCategory === 'pickupZones' ? 'pickup' : 'delivery'} cities`, {
                variant: 'success',
                autoHideDuration: 3000
            });

            // If this was a large update (likely from map), show special notification
            const previousCount = zoneConfig[zoneCategory]?.selectedCities?.length || 0;
            const newCount = selectedCities.length;
            if (newCount > previousCount + 5) {
                setTimeout(() => {
                    enqueueSnackbar(`🗺️ Map selection complete! ${newCount - previousCount} cities added. View them in the "Pickup Cities" tab.`, {
                        variant: 'info',
                        autoHideDuration: 6000
                    });
                }, 2000);
            }
        } catch (error) {
            console.error('❌ Error auto-saving zone configuration:', error);
            enqueueSnackbar('Failed to save cities', { variant: 'error' });
        } finally {
            setSavingCities(false);
        }
    }, [carrierId, carrierName, zoneConfig, enqueueSnackbar]);

    const handleMapAreaSave = useCallback(async (area) => {
        try {
            const colRef = collection(db, 'carrierZoneAreas');
            await addDoc(colRef, {
                carrierId,
                zoneCategory: area.zoneCategory,
                type: area.type,
                path: area.path || null,
                bounds: area.bounds || null,
                center: area.center || null,
                radius: area.radius || null,
                cityCount: area.cityCount || 0,
                createdAt: serverTimestamp(),
                createdBy: 'system'
            });
            enqueueSnackbar('🗺️ Saved map area to database', { variant: 'success', autoHideDuration: 2500 });
            // Optimistically add to local saved areas for persistence on next open
            setSavedAreas(prev => [...prev, { carrierId, ...area }]);
        } catch (e) {
            console.error('Failed to save map area:', e);
            enqueueSnackbar('Failed to save map area', { variant: 'error' });
        }
    }, [carrierId, enqueueSnackbar]);

    // Load saved map areas for this carrier when dialog opens
    useEffect(() => {
        const loadSavedAreas = async () => {
            try {
                const colRef = collection(db, 'carrierZoneAreas');
                const q = query(colRef, where('carrierId', '==', carrierId));
                const snap = await getDocs(q);
                const areas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                // De-duplicate by geometric signature to avoid stacked duplicates
                const signature = (a) => {
                    if (a.type === 'rectangle' && a.bounds) {
                        const { north, south, east, west } = a.bounds;
                        return `rect:${north?.toFixed(5)}:${south?.toFixed(5)}:${east?.toFixed(5)}:${west?.toFixed(5)}`;
                    }
                    if (a.type === 'circle' && a.center && a.radius) {
                        return `circle:${a.center.lat?.toFixed(5)}:${a.center.lng?.toFixed(5)}:${Math.round(a.radius)}`;
                    }
                    if (a.type === 'polygon' && Array.isArray(a.path)) {
                        return `poly:${a.path.length}:${a.path.map(p => `${p.lat?.toFixed(5)}_${p.lng?.toFixed(5)}`).join('|')}`;
                    }
                    return JSON.stringify(a);
                };
                const seen = new Set();
                const unique = [];
                areas.forEach(a => { const sig = signature(a); if (!seen.has(sig)) { seen.add(sig); unique.push(a); } });
                setSavedAreas(unique);
            } catch (e) {
                console.warn('Failed to load saved map areas:', e);
            }
        };
        if (carrierId && isOpen) loadSavedAreas();
    }, [carrierId, isOpen]);

    // Load existing zone configuration
    useEffect(() => {
        if (carrierId && isOpen) {
            loadZoneConfiguration();
        }
    }, [carrierId, isOpen]);

    // Reset state when dialog closes to ensure fresh state on reopen
    useEffect(() => {
        if (!isOpen) {
            // Reset to default state when dialog closes
            setZoneConfig({
                pickupZones: {
                    domesticCanada: false,
                    domesticUS: false,
                    provinceToProvince: false,
                    stateToState: false,
                    provinceToState: false,
                    countryToCountry: false,
                    cityToCity: false,
                    selectedProvinces: [],
                    selectedStates: [],
                    selectedCities: [],
                    crossBorderRoutes: []
                },
                deliveryZones: {
                    domesticCanada: false,
                    domesticUS: false,
                    provinceToProvince: false,
                    stateToState: false,
                    provinceToState: false,
                    countryToCountry: false,
                    cityToCity: false,
                    selectedProvinces: [],
                    selectedStates: [],
                    selectedCities: [],
                    crossBorderRoutes: []
                },
                routeMappings: []
            });
            setActiveTab(0);
        }
    }, [isOpen]);

    // Note: Removed auto-opening behavior to allow users to see the tab structure first
    // Users can manually navigate to configure pickup/delivery locations when needed

    const loadZoneConfiguration = async () => {
        // console.log('📥 LOADING - Starting load for carrier:', carrierId);
        setLoading(true);
        try {
            const docRef = doc(db, 'carrierZoneConfigs', carrierId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                // console.log('📥 LOADING - Data from database:', data);
                // console.log('📥 LOADING - Pickup cities found:', data.zoneConfig?.pickupZones?.selectedCities?.length || 0);
                // console.log('📥 LOADING - Delivery cities found:', data.zoneConfig?.deliveryZones?.selectedCities?.length || 0);
                setZoneConfig(data.zoneConfig || zoneConfig);
                // console.log('📥 LOADING - State updated with loaded data');
            } else {
                // console.log('📥 LOADING - No existing configuration found');
            }
        } catch (error) {
            // console.error('❌ Error loading zone configuration:', error);
            enqueueSnackbar('Failed to load zone configuration', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const saveZoneConfiguration = async () => {
        setLoading(true);
        try {
            // console.log('💾 SAVING - Current zoneConfig:', zoneConfig);
            // console.log('💾 SAVING - Pickup cities:', zoneConfig.pickupZones?.selectedCities?.length || 0);
            // console.log('💾 SAVING - Delivery cities:', zoneConfig.deliveryZones?.selectedCities?.length || 0);

            // Use current state to ensure latest data is saved
            const docRef = doc(db, 'carrierZoneConfigs', carrierId);
            const configToSave = {
                carrierId,
                carrierName,
                zoneConfig: {
                    pickupZones: {
                        ...zoneConfig.pickupZones,
                        selectedCities: zoneConfig.pickupZones?.selectedCities || []
                    },
                    deliveryZones: {
                        ...zoneConfig.deliveryZones,
                        selectedCities: zoneConfig.deliveryZones?.selectedCities || []
                    },
                    routeMappings: zoneConfig.routeMappings || []
                },
                lastUpdated: new Date(),
                version: '2.0'
            };

            // console.log('💾 SAVING - Data being saved:', configToSave);
            await setDoc(docRef, configToSave, { merge: true });
            // console.log('💾 SAVING - Save completed successfully');

            enqueueSnackbar('Zone configuration saved successfully!', { variant: 'success' });

            // Close the dialog after successful save
            setTimeout(() => {
                onClose();
            }, 1000); // Give user time to see the success message
        } catch (error) {
            // console.error('❌ Error saving zone configuration:', error);
            enqueueSnackbar('Failed to save zone configuration', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Handle zone type selection
    const handleZoneTypeChange = (zoneCategory, zoneType, checked) => {
        setZoneConfig(prev => ({
            ...prev,
            [zoneCategory]: {
                ...prev[zoneCategory],
                [zoneType]: checked,
                // Clear selected items when unchecking
                ...(checked ? {} : {
                    selectedProvinces: zoneType.includes('province') ? [] : prev[zoneCategory].selectedProvinces,
                    selectedStates: zoneType.includes('state') ? [] : prev[zoneCategory].selectedStates,
                    selectedCities: zoneType.includes('city') ? [] : prev[zoneCategory].selectedCities
                })
            }
        }));
    };

    // Handle province/state selection
    const handleLocationSelection = (zoneCategory, locationType, selectedItems) => {
        setZoneConfig(prev => ({
            ...prev,
            [zoneCategory]: {
                ...prev[zoneCategory],
                [locationType]: selectedItems
            }
        }));
    };

    // Handle city search and selection
    const handleCitySearch = async (searchTerm, zoneCategory) => {
        if (zoneCategory === 'pickupZones') {
            setCitySearchPickup(searchTerm);
        } else {
            setCitySearchDelivery(searchTerm);
        }

        if (searchTerm && searchTerm.length >= 2) {
            try {
                const results = await searchCities(searchTerm);
                const formattedResults = results.map(city => ({
                    id: city.id,
                    city: city.city,
                    provinceState: city.provinceState,
                    provinceStateName: city.provinceStateName,
                    country: city.country,
                    countryName: city.countryName,
                    label: `${city.city}, ${city.provinceStateName || city.provinceState} (${city.country})`,
                    searchKey: `${city.city.toLowerCase()}-${city.provinceState}-${city.country}`
                }));

                if (zoneCategory === 'pickupZones') {
                    setCityOptionsPickup(formattedResults);
                } else {
                    setCityOptionsDelivery(formattedResults);
                }
            } catch (error) {
                // console.error('Error searching cities:', error);
                enqueueSnackbar('Failed to search cities', { variant: 'error' });
            }
        } else {
            if (zoneCategory === 'pickupZones') {
                setCityOptionsPickup([]);
            } else {
                setCityOptionsDelivery([]);
            }
        }
    };


    const handleSmartCitySelectionComplete = (selectedCities) => {
        const currentCities = zoneConfig[smartCitySelectorZone].selectedCities || [];
        const existingKeys = new Set(currentCities.map(city => city.searchKey));

        // Add new cities that aren't already selected
        const newCities = selectedCities.filter(city => !existingKeys.has(city.searchKey));
        const updatedCities = [...currentCities, ...newCities];

        handleLocationSelection(smartCitySelectorZone, 'selectedCities', updatedCities);

        enqueueSnackbar(`Added ${newCities.length} cities to ${smartCitySelectorZone === 'pickupZones' ? 'pickup' : 'delivery'} zones`, {
            variant: 'success'
        });
    };

    // Generate route mappings from pickup and delivery zones
    const generateRouteMappings = () => {
        const mappings = [];

        // Helper function to create route combinations
        const createRouteMapping = (pickupType, pickupData, deliveryType, deliveryData, description) => {
            return {
                id: `${pickupType}_to_${deliveryType}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                pickup: { type: pickupType, data: pickupData },
                delivery: { type: deliveryType, data: deliveryData },
                description,
                createdAt: new Date()
            };
        };

        // 1. Domestic Canada Pickup Combinations
        if (zoneConfig.pickupZones.domesticCanada) {
            if (zoneConfig.deliveryZones.domesticCanada) {
                mappings.push(createRouteMapping(
                    'domesticCanada', 'All CA',
                    'domesticCanada', 'All CA',
                    'Canada Domestic - Any Province to Any Province'
                ));
            }
            if (zoneConfig.deliveryZones.domesticUS) {
                mappings.push(createRouteMapping(
                    'domesticCanada', 'All CA',
                    'domesticUS', 'All US',
                    'Canada to US - Any Province to Any State'
                ));
            }
            if (zoneConfig.deliveryZones.provinceToProvince && zoneConfig.deliveryZones.selectedProvinces?.length > 0) {
                mappings.push(createRouteMapping(
                    'domesticCanada', 'All CA',
                    'specificProvinces', zoneConfig.deliveryZones.selectedProvinces,
                    `Canada Domestic - Any Province to ${zoneConfig.deliveryZones.selectedProvinces.map(p => p.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.stateToState && zoneConfig.deliveryZones.selectedStates?.length > 0) {
                mappings.push(createRouteMapping(
                    'domesticCanada', 'All CA',
                    'specificStates', zoneConfig.deliveryZones.selectedStates,
                    `Canada to US - Any Province to ${zoneConfig.deliveryZones.selectedStates.map(s => s.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.cityToCity && zoneConfig.deliveryZones.selectedCities?.length > 0) {
                mappings.push(createRouteMapping(
                    'domesticCanada', 'All CA',
                    'specificCities', zoneConfig.deliveryZones.selectedCities,
                    `Canada - Any Province to ${zoneConfig.deliveryZones.selectedCities.map(c => c.city).join(', ')}`
                ));
            }
        }

        // 2. Domestic US Pickup Combinations
        if (zoneConfig.pickupZones.domesticUS) {
            if (zoneConfig.deliveryZones.domesticCanada) {
                mappings.push(createRouteMapping(
                    'domesticUS', 'All US',
                    'domesticCanada', 'All CA',
                    'US to Canada - Any State to Any Province'
                ));
            }
            if (zoneConfig.deliveryZones.domesticUS) {
                mappings.push(createRouteMapping(
                    'domesticUS', 'All US',
                    'domesticUS', 'All US',
                    'US Domestic - Any State to Any State'
                ));
            }
            if (zoneConfig.deliveryZones.provinceToProvince && zoneConfig.deliveryZones.selectedProvinces?.length > 0) {
                mappings.push(createRouteMapping(
                    'domesticUS', 'All US',
                    'specificProvinces', zoneConfig.deliveryZones.selectedProvinces,
                    `US to Canada - Any State to ${zoneConfig.deliveryZones.selectedProvinces.map(p => p.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.stateToState && zoneConfig.deliveryZones.selectedStates?.length > 0) {
                mappings.push(createRouteMapping(
                    'domesticUS', 'All US',
                    'specificStates', zoneConfig.deliveryZones.selectedStates,
                    `US Domestic - Any State to ${zoneConfig.deliveryZones.selectedStates.map(s => s.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.cityToCity && zoneConfig.deliveryZones.selectedCities?.length > 0) {
                mappings.push(createRouteMapping(
                    'domesticUS', 'All US',
                    'specificCities', zoneConfig.deliveryZones.selectedCities,
                    `US - Any State to ${zoneConfig.deliveryZones.selectedCities.map(c => c.city).join(', ')}`
                ));
            }
        }

        // 3. Specific Province Pickup Combinations
        if (zoneConfig.pickupZones.provinceToProvince && zoneConfig.pickupZones.selectedProvinces?.length > 0) {
            const pickupProvinces = zoneConfig.pickupZones.selectedProvinces;

            if (zoneConfig.deliveryZones.domesticCanada) {
                mappings.push(createRouteMapping(
                    'specificProvinces', pickupProvinces,
                    'domesticCanada', 'All CA',
                    `${pickupProvinces.map(p => p.code).join(', ')} to Any Canadian Province`
                ));
            }
            if (zoneConfig.deliveryZones.domesticUS) {
                mappings.push(createRouteMapping(
                    'specificProvinces', pickupProvinces,
                    'domesticUS', 'All US',
                    `${pickupProvinces.map(p => p.code).join(', ')} to Any US State`
                ));
            }
            if (zoneConfig.deliveryZones.provinceToProvince && zoneConfig.deliveryZones.selectedProvinces?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificProvinces', pickupProvinces,
                    'specificProvinces', zoneConfig.deliveryZones.selectedProvinces,
                    `${pickupProvinces.map(p => p.code).join(', ')} to ${zoneConfig.deliveryZones.selectedProvinces.map(p => p.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.stateToState && zoneConfig.deliveryZones.selectedStates?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificProvinces', pickupProvinces,
                    'specificStates', zoneConfig.deliveryZones.selectedStates,
                    `${pickupProvinces.map(p => p.code).join(', ')} to ${zoneConfig.deliveryZones.selectedStates.map(s => s.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.cityToCity && zoneConfig.deliveryZones.selectedCities?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificProvinces', pickupProvinces,
                    'specificCities', zoneConfig.deliveryZones.selectedCities,
                    `${pickupProvinces.map(p => p.code).join(', ')} to ${zoneConfig.deliveryZones.selectedCities.map(c => c.city).join(', ')}`
                ));
            }
        }

        // 4. Specific State Pickup Combinations
        if (zoneConfig.pickupZones.stateToState && zoneConfig.pickupZones.selectedStates?.length > 0) {
            const pickupStates = zoneConfig.pickupZones.selectedStates;

            if (zoneConfig.deliveryZones.domesticCanada) {
                mappings.push(createRouteMapping(
                    'specificStates', pickupStates,
                    'domesticCanada', 'All CA',
                    `${pickupStates.map(s => s.code).join(', ')} to Any Canadian Province`
                ));
            }
            if (zoneConfig.deliveryZones.domesticUS) {
                mappings.push(createRouteMapping(
                    'specificStates', pickupStates,
                    'domesticUS', 'All US',
                    `${pickupStates.map(s => s.code).join(', ')} to Any US State`
                ));
            }
            if (zoneConfig.deliveryZones.provinceToProvince && zoneConfig.deliveryZones.selectedProvinces?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificStates', pickupStates,
                    'specificProvinces', zoneConfig.deliveryZones.selectedProvinces,
                    `${pickupStates.map(s => s.code).join(', ')} to ${zoneConfig.deliveryZones.selectedProvinces.map(p => p.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.stateToState && zoneConfig.deliveryZones.selectedStates?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificStates', pickupStates,
                    'specificStates', zoneConfig.deliveryZones.selectedStates,
                    `${pickupStates.map(s => s.code).join(', ')} to ${zoneConfig.deliveryZones.selectedStates.map(s => s.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.cityToCity && zoneConfig.deliveryZones.selectedCities?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificStates', pickupStates,
                    'specificCities', zoneConfig.deliveryZones.selectedCities,
                    `${pickupStates.map(s => s.code).join(', ')} to ${zoneConfig.deliveryZones.selectedCities.map(c => c.city).join(', ')}`
                ));
            }
        }

        // 5. Specific City Pickup Combinations
        if (zoneConfig.pickupZones.cityToCity && zoneConfig.pickupZones.selectedCities?.length > 0) {
            const pickupCities = zoneConfig.pickupZones.selectedCities;

            if (zoneConfig.deliveryZones.domesticCanada) {
                mappings.push(createRouteMapping(
                    'specificCities', pickupCities,
                    'domesticCanada', 'All CA',
                    `${pickupCities.map(c => c.city).join(', ')} to Any Canadian Province`
                ));
            }
            if (zoneConfig.deliveryZones.domesticUS) {
                mappings.push(createRouteMapping(
                    'specificCities', pickupCities,
                    'domesticUS', 'All US',
                    `${pickupCities.map(c => c.city).join(', ')} to Any US State`
                ));
            }
            if (zoneConfig.deliveryZones.provinceToProvince && zoneConfig.deliveryZones.selectedProvinces?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificCities', pickupCities,
                    'specificProvinces', zoneConfig.deliveryZones.selectedProvinces,
                    `${pickupCities.map(c => c.city).join(', ')} to ${zoneConfig.deliveryZones.selectedProvinces.map(p => p.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.stateToState && zoneConfig.deliveryZones.selectedStates?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificCities', pickupCities,
                    'specificStates', zoneConfig.deliveryZones.selectedStates,
                    `${pickupCities.map(c => c.city).join(', ')} to ${zoneConfig.deliveryZones.selectedStates.map(s => s.code).join(', ')}`
                ));
            }
            if (zoneConfig.deliveryZones.cityToCity && zoneConfig.deliveryZones.selectedCities?.length > 0) {
                mappings.push(createRouteMapping(
                    'specificCities', pickupCities,
                    'specificCities', zoneConfig.deliveryZones.selectedCities,
                    `${pickupCities.map(c => c.city).join(', ')} to ${zoneConfig.deliveryZones.selectedCities.map(c => c.city).join(', ')}`
                ));
            }
        }

        // Update the zone configuration with new mappings
        setZoneConfig(prev => ({
            ...prev,
            routeMappings: mappings
        }));

        enqueueSnackbar(`Generated ${mappings.length} route mapping${mappings.length !== 1 ? 's' : ''}`, {
            variant: mappings.length > 0 ? 'success' : 'warning'
        });

        if (mappings.length === 0) {
            enqueueSnackbar('No route combinations found. Please configure pickup and delivery zones first.', {
                variant: 'info'
            });
        }
    };

    const openSelectorDialog = (zone) => {
        setSmartSelectorZoneForDialog(zone);
        setSmartSelectorOpen(true);
    };
    const closeSelectorDialog = () => setSmartSelectorOpen(false);

    // Render pickup locations tab
    const renderPickupLocations = () => {
        return (
            <Box sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Chip
                        color="primary"
                        size="small"
                        label={`${(zoneConfig.pickupZones?.selectedCities?.length || 0)} cities selected`}
                        onClick={() => openSelectorDialog('pickupZones')}
                        sx={{ cursor: 'pointer' }}
                    />
                </Box>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2, fontSize: '14px', color: '#6b7280' }}>
                            Loading saved locations...
                        </Typography>
                    </Box>
                ) : (
                    <SmartCitySelector
                        isOpen={true}
                        onClose={() => { }}
                        selectedCities={zoneConfig.pickupZones?.selectedCities || []}
                        onSelectionComplete={(selectedCities) => handleEmbeddedCitySelection(selectedCities, 'pickupZones')}
                        title="Configure Pickup Locations"
                        zoneCategory="pickupZones"
                        embedded={true}
                        onMapAreaSave={handleMapAreaSave}
                        savedAreas={savedAreas}
                        carrierId={carrierId}
                    />
                )}

                {smartSelectorOpen && (
                    <SmartCitySelector
                        isOpen={smartSelectorOpen}
                        onClose={closeSelectorDialog}
                        selectedCities={(zoneConfig[smartSelectorZoneForDialog]?.selectedCities) || []}
                        onSelectionComplete={(selectedCities) => handleEmbeddedCitySelection(selectedCities, smartSelectorZoneForDialog)}
                        title={smartSelectorZoneForDialog === 'pickupZones' ? 'Pickup Cities' : 'Delivery Cities'}
                        zoneCategory={smartSelectorZoneForDialog}
                        embedded={false}
                        onMapAreaSave={handleMapAreaSave}
                    />
                )}
            </Box>
        );
    };

    // Render delivery locations tab
    const renderDeliveryLocations = () => {
        return (
            <Box sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
                {/* Show loading until zone config is loaded */}
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <CircularProgress />
                        <Typography sx={{ ml: 2, fontSize: '14px', color: '#6b7280' }}>
                            Loading saved locations...
                        </Typography>
                    </Box>
                ) : (
                    /* Embedded Smart City Selector for Delivery */
                    <SmartCitySelector
                        isOpen={true}
                        onClose={() => { }} // No close needed since it's embedded
                        selectedCities={zoneConfig.deliveryZones?.selectedCities || []}
                        onSelectionComplete={(selectedCities) => handleEmbeddedCitySelection(selectedCities, 'deliveryZones')}
                        title="Configure Delivery Locations"
                        zoneCategory="deliveryZones"
                        embedded={true} // Enable embedded mode
                        onMapAreaSave={handleMapAreaSave}
                        savedAreas={savedAreas}
                        carrierId={carrierId}
                    />
                )}
            </Box>
        );
    };

    // Render zone configuration for pickup or delivery (legacy function, keeping for other tabs)
    const renderZoneConfiguration = (zoneCategory, title) => {
        const zones = zoneConfig[zoneCategory];
        const selectedCitiesCount = zones.selectedCities?.length || 0;

        return (
            <Box>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                    {title}
                </Typography>

                {/* Legacy content for other tabs */}

                <Grid container spacing={3} sx={{ display: 'none' }}>
                    {/* Domestic Canada */}
                    <Grid item xs={12}>
                        <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                            <CardContent sx={{ p: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={zones.domesticCanada}
                                            onChange={(e) => handleZoneTypeChange(zoneCategory, 'domesticCanada', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                            Domestic Canada (All CA)
                                        </Typography>
                                    }
                                />
                                {zones.domesticCanada && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f9ff', borderRadius: 1 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#0369a1' }}>
                                            ✅ All Canadian provinces and territories are covered
                                        </Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Domestic US */}
                    <Grid item xs={12}>
                        <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                            <CardContent sx={{ p: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={zones.domesticUS}
                                            onChange={(e) => handleZoneTypeChange(zoneCategory, 'domesticUS', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                            Domestic US (All US)
                                        </Typography>
                                    }
                                />
                                {zones.domesticUS && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f9ff', borderRadius: 1 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#0369a1' }}>
                                            ✅ All US states and territories are covered
                                        </Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Province-to-Province (CA) */}
                    <Grid item xs={12}>
                        <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                            <CardContent sx={{ p: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={zones.provinceToProvince}
                                            onChange={(e) => handleZoneTypeChange(zoneCategory, 'provinceToProvince', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                            Specific Provinces (CA)
                                        </Typography>
                                    }
                                />
                                {zones.provinceToProvince && (
                                    <Box sx={{ mt: 2 }}>
                                        <Autocomplete
                                            multiple
                                            options={canadianProvinces}
                                            getOptionLabel={(option) => `${option.name} - ${option.code}`}
                                            value={zones.selectedProvinces || []}
                                            onChange={(event, newValue) =>
                                                handleLocationSelection(zoneCategory, 'selectedProvinces', newValue)
                                            }
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={option.code}
                                                        label={`${option.name} - ${option.code}`}
                                                        size="small"
                                                        color="primary"
                                                        variant="outlined"
                                                    />
                                                ))
                                            }
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Select Provinces"
                                                    placeholder="Choose provinces..."
                                                    size="small"
                                                    sx={{ fontSize: '12px' }}
                                                />
                                            )}
                                        />
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* State-to-State (US) */}
                    <Grid item xs={12}>
                        <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                            <CardContent sx={{ p: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={zones.stateToState}
                                            onChange={(e) => handleZoneTypeChange(zoneCategory, 'stateToState', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                            Specific States (US)
                                        </Typography>
                                    }
                                />
                                {zones.stateToState && (
                                    <Box sx={{ mt: 2 }}>
                                        <Autocomplete
                                            multiple
                                            options={usStates}
                                            getOptionLabel={(option) => `${option.name} - ${option.code}`}
                                            value={zones.selectedStates || []}
                                            onChange={(event, newValue) =>
                                                handleLocationSelection(zoneCategory, 'selectedStates', newValue)
                                            }
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={option.code}
                                                        label={`${option.name} - ${option.code}`}
                                                        size="small"
                                                        color="secondary"
                                                        variant="outlined"
                                                    />
                                                ))
                                            }
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Select States"
                                                    placeholder="Choose states..."
                                                    size="small"
                                                    sx={{ fontSize: '12px' }}
                                                />
                                            )}
                                        />
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Cross-border */}
                    <Grid item xs={12}>
                        <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                            <CardContent sx={{ p: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={zones.provinceToState}
                                            onChange={(e) => handleZoneTypeChange(zoneCategory, 'provinceToState', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                            Cross-Border (CA ↔ US)
                                        </Typography>
                                    }
                                />
                                {zones.provinceToState && (
                                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fef3c7', borderRadius: 1 }}>
                                        <Typography sx={{ fontSize: '12px', color: '#92400e' }}>
                                            🚧 Cross-border zone configuration coming soon
                                        </Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* City-to-City */}
                    <Grid item xs={12}>
                        <Card sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                            <CardContent sx={{ p: 2 }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={zones.cityToCity}
                                            onChange={(e) => handleZoneTypeChange(zoneCategory, 'cityToCity', e.target.checked)}
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                            Specific Cities
                                        </Typography>
                                    }
                                />
                                {zones.cityToCity && (
                                    <Box sx={{ mt: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={() => openSelectorDialog(zoneCategory)}
                                                sx={{
                                                    fontSize: '11px',
                                                    bgcolor: '#7c3aed',
                                                    '&:hover': { bgcolor: '#6d28d9' }
                                                }}
                                                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                                            >
                                                Smart Selection
                                            </Button>
                                        </Box>
                                        <Autocomplete
                                            multiple
                                            options={zoneCategory === 'pickupZones' ? cityOptionsPickup : cityOptionsDelivery}
                                            getOptionLabel={(option) => option.label || ''}
                                            value={zones.selectedCities || []}
                                            onChange={(event, newValue) =>
                                                handleLocationSelection(zoneCategory, 'selectedCities', newValue)
                                            }
                                            onInputChange={(event, newInputValue) => {
                                                handleCitySearch(newInputValue, zoneCategory);
                                            }}
                                            loading={geoLoading}
                                            filterOptions={(x) => x} // Disable built-in filtering since we're doing server-side search
                                            isOptionEqualToValue={(option, value) => option.searchKey === value.searchKey}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={option.searchKey}
                                                        label={option.label}
                                                        size="small"
                                                        color="info"
                                                        variant="outlined"
                                                        sx={{
                                                            fontSize: '11px',
                                                            '& .MuiChip-label': {
                                                                fontSize: '11px'
                                                            }
                                                        }}
                                                    />
                                                ))
                                            }
                                            renderOption={(props, option) => (
                                                <Box component="li" {...props} key={option.searchKey}>
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            {option.city}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {option.provinceStateName || option.provinceState}, {option.countryName}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Search cities..."
                                                    placeholder="Type city name (e.g., Toronto, Calgary, New York)"
                                                    size="small"
                                                    sx={{ fontSize: '12px' }}
                                                    helperText={`Type at least 2 characters to search ${zoneCategory === 'pickupZones' ? 'pickup' : 'delivery'} cities`}
                                                    InputProps={{
                                                        ...params.InputProps,
                                                        endAdornment: (
                                                            <>
                                                                {geoLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                                                {params.InputProps.endAdornment}
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            )}
                                            noOptionsText={
                                                (zoneCategory === 'pickupZones' ? citySearchPickup : citySearchDelivery).length < 2
                                                    ? "Type at least 2 characters to search"
                                                    : "No cities found"
                                            }
                                        />

                                        {/* Selected Cities Summary */}
                                        {zones.selectedCities && zones.selectedCities.length > 0 && (
                                            <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bae6fd' }}>
                                                <Typography sx={{ fontSize: '12px', color: '#0369a1', fontWeight: 500, mb: 1 }}>
                                                    📍 Selected {zoneCategory === 'pickupZones' ? 'Pickup' : 'Delivery'} Cities ({zones.selectedCities.length})
                                                </Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                    {zones.selectedCities.slice(0, 10).map((city, index) => (
                                                        <Typography
                                                            key={city.searchKey}
                                                            sx={{
                                                                fontSize: '10px',
                                                                color: '#0369a1',
                                                                bgcolor: '#dbeafe',
                                                                px: 1,
                                                                py: 0.5,
                                                                borderRadius: 0.5
                                                            }}
                                                        >
                                                            {city.city}, {city.provinceState}
                                                        </Typography>
                                                    ))}
                                                    {zones.selectedCities.length > 10 && (
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280', px: 1 }}>
                                                            +{zones.selectedCities.length - 10} more
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Box>
        );
    };

    // Render route mappings tab
    const renderRouteMappings = () => {
        return (
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                        Zone-to-Zone Route Mappings
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<RouteIcon />}
                        onClick={generateRouteMappings}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Generate Routes
                    </Button>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '12px' }}>
                        Route mappings combine your pickup and delivery zones to create specific route combinations.
                        These routes will be used to assign rates in the next phase.
                    </Typography>
                </Alert>

                {zoneConfig.routeMappings && zoneConfig.routeMappings.length > 0 ? (
                    <Grid container spacing={2}>
                        {zoneConfig.routeMappings.map((route, index) => (
                            <Grid item xs={12} sm={6} md={6} key={route.id}>
                                <Card sx={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 2,
                                    '&:hover': { borderColor: '#3b82f6', boxShadow: 2 }
                                }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <RouteIcon sx={{ fontSize: 18, color: '#3b82f6', mr: 1 }} />
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                                    Route {index + 1}
                                                </Typography>
                                            </Box>
                                            <IconButton
                                                size="small"
                                                sx={{ color: '#6b7280' }}
                                                onClick={() => {
                                                    // Remove route mapping
                                                    setZoneConfig(prev => ({
                                                        ...prev,
                                                        routeMappings: prev.routeMappings.filter(r => r.id !== route.id)
                                                    }));
                                                }}
                                            >
                                                <DeleteIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </Box>

                                        {/* Route Description */}
                                        <Typography sx={{
                                            fontSize: '12px',
                                            color: '#374151',
                                            fontWeight: 500,
                                            mb: 2,
                                            lineHeight: 1.4
                                        }}>
                                            {route.description}
                                        </Typography>

                                        {/* Route Details */}
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            p: 1.5,
                                            bgcolor: '#f8fafc',
                                            borderRadius: 1,
                                            border: '1px solid #f1f5f9'
                                        }}>
                                            <Box sx={{ textAlign: 'center', flex: 1 }}>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280', mb: 0.5 }}>
                                                    PICKUP FROM
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#374151' }}>
                                                    {Array.isArray(route.pickup.data) ?
                                                        route.pickup.data.map(p => p.code || p).join(', ') :
                                                        route.pickup.data}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ mx: 2, color: '#6b7280' }}>
                                                <Typography sx={{ fontSize: '16px', fontWeight: 600 }}>→</Typography>
                                            </Box>

                                            <Box sx={{ textAlign: 'center', flex: 1 }}>
                                                <Typography sx={{ fontSize: '10px', color: '#6b7280', mb: 0.5 }}>
                                                    DELIVER TO
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#374151' }}>
                                                    {Array.isArray(route.delivery.data) ?
                                                        route.delivery.data.map(d => d.code || d).join(', ') :
                                                        route.delivery.data}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* Status Indicator */}
                                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Chip
                                                label="Ready for Rate Assignment"
                                                size="small"
                                                color="success"
                                                variant="outlined"
                                                sx={{ fontSize: '10px' }}
                                            />
                                            <Typography sx={{ fontSize: '9px', color: '#9ca3af' }}>
                                                {route.createdAt && new Date(route.createdAt.seconds ? route.createdAt.seconds * 1000 : route.createdAt).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <RouteIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                        <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                            No route mappings generated yet
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                            Configure pickup and delivery zones, then click "Generate Routes"
                        </Typography>
                    </Box>
                )}
            </Box>
        );
    };

    // Render charge mapping tab
    const renderChargeMapping = () => {
        const routeMappings = zoneConfig.routeMappings || [];

        if (routeMappings.length === 0) {
            return (
                <Box sx={{ py: 4 }}>
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <ChargeIcon sx={{ fontSize: 64, color: '#d1d5db', mb: 2 }} />
                        <Typography sx={{ fontSize: '18px', color: '#374151', mb: 1, fontWeight: 600 }}>
                            Rate Card Setup Required
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            To manage rate cards, you need to complete the setup process first
                        </Typography>
                    </Box>

                    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
                        <Typography sx={{ fontSize: '14px', color: '#374151', mb: 2, fontWeight: 500 }}>
                            📋 Setup Steps:
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', p: 2, border: '1px solid #e5e7eb', borderRadius: 1, backgroundColor: '#f8fafc' }}>
                                <Box sx={{
                                    minWidth: 24, height: 24, borderRadius: '50%',
                                    backgroundColor: '#3b82f6', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 600, mr: 2
                                }}>
                                    1
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                                        Configure Pickup Locations
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Define where this carrier can pick up shipments from
                                    </Typography>
                                </Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => setActiveTab(0)}
                                    sx={{ fontSize: '11px' }}
                                >
                                    Configure
                                </Button>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', p: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                                <Box sx={{
                                    minWidth: 24, height: 24, borderRadius: '50%',
                                    backgroundColor: '#6b7280', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 600, mr: 2
                                }}>
                                    2
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                                        Configure Delivery Locations
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Define where this carrier can deliver shipments to
                                    </Typography>
                                </Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    disabled
                                    sx={{ fontSize: '11px' }}
                                >
                                    Next
                                </Button>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', p: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                                <Box sx={{
                                    minWidth: 24, height: 24, borderRadius: '50%',
                                    backgroundColor: '#6b7280', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 600, mr: 2
                                }}>
                                    3
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                                        Generate Route Mappings
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Create pickup → delivery route combinations
                                    </Typography>
                                </Box>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    disabled
                                    sx={{ fontSize: '11px' }}
                                >
                                    Generate
                                </Button>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', p: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                                <Box sx={{
                                    minWidth: 24, height: 24, borderRadius: '50%',
                                    backgroundColor: '#6b7280', color: 'white',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 600, mr: 2
                                }}>
                                    4
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                                        Set Rate Cards
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Configure pricing for each route (skid-based, weight-based, flat rates)
                                    </Typography>
                                </Box>
                                <Chip
                                    label="You are here"
                                    size="small"
                                    color="primary"
                                    sx={{ fontSize: '10px' }}
                                />
                            </Box>
                        </Box>
                    </Box>
                </Box>
            );
        }

        return (
            <Box>
                <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 1 }}>
                        Charge Configuration
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Set rates for each route combination. Charges can be skid-based, weight-based, or flat rates.
                    </Typography>
                </Box>

                <Grid container spacing={2}>
                    {routeMappings.map((route, index) => (
                        <Grid item xs={12} key={route.id}>
                            <Card sx={{ border: '1px solid #e5e7eb' }}>
                                <CardContent sx={{ p: 2 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                                        <Box>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Route #{index + 1}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {route.description}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label="No Rates Set"
                                            size="small"
                                            color="warning"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Configure Skid Rates
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Configure Weight Rates
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        >
                                            Set Flat Rate
                                        </Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                <Box sx={{ mt: 3, p: 2, backgroundColor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                        💡 <strong>Coming Soon:</strong> Advanced charge mapping with:
                    </Typography>
                    <Box component="ul" sx={{ fontSize: '11px', color: '#6b7280', pl: 2, m: 0 }}>
                        <li>Skid-based pricing matrices (1-26+ skids)</li>
                        <li>Weight break configurations</li>
                        <li>Special charges and surcharges</li>
                        <li>Direction-specific pricing</li>
                        <li>CSV import/export for bulk rate management</li>
                    </Box>
                </Box>
            </Box>
        );
    };

    const tabs = [
        {
            label: 'Pickup Locations',
            icon: <MapIcon />,
            count: zoneConfig.pickupZones?.selectedCities?.length || 0
        },
        {
            label: 'Delivery Locations',
            icon: <RegionIcon />,
            count: zoneConfig.deliveryZones?.selectedCities?.length || 0
        },
        {
            label: 'Route Mapping',
            icon: <RouteIcon />,
            count: zoneConfig.routeMappings?.length || 0
        },
        {
            label: 'Charge Mapping',
            icon: <ChargeIcon />
        }
    ];

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { height: '90vh' }
            }}
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px' }}>
                            Zone Configuration - {carrierName}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                            Define pickup zones, delivery zones, and route mappings
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            onClick={onClose}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            onClick={saveZoneConfiguration}
                            disabled={loading}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            {loading ? <CircularProgress size={16} /> : 'Save Configuration'}
                        </Button>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={activeTab}
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        sx={{
                            px: 3,
                            '& .MuiTab-root': {
                                fontSize: '12px',
                                textTransform: 'none',
                                minHeight: 48
                            }
                        }}
                    >
                        {tabs.map((tab, index) => (
                            <Tab
                                key={index}
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {tab.label}
                                        {tab.count !== undefined && tab.count > 0 && (
                                            <Chip
                                                label={tab.count}
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '11px',
                                                    backgroundColor: '#e0f2fe',
                                                    color: '#0369a1',
                                                    ml: 0.5
                                                }}
                                            />
                                        )}
                                    </Box>
                                }
                                icon={tab.icon}
                                iconPosition="start"
                            />
                        ))}
                    </Tabs>
                </Box>

                <Box sx={{ p: 3, height: 'calc(90vh - 140px)', overflow: 'auto' }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            {activeTab === 0 && renderPickupLocations()}
                            {activeTab === 1 && renderDeliveryLocations()}
                            {activeTab === 2 && renderRouteMappings()}
                            {activeTab === 3 && renderChargeMapping()}
                        </>
                    )}
                </Box>
            </DialogContent>

        </Dialog>
    );
};

export default QuickShipZoneRateManagement;
