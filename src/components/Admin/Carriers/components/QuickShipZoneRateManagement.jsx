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
    Menu, MenuItem,
    Autocomplete, TextField, List, ListItem, ListItemText,
    ListItemSecondaryAction, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow
} from '@mui/material';
import {
    Map as MapIcon,
    Public as RegionIcon,
    Route as RouteIcon,
    MonetizationOn as ChargeIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    Layers as ZonesIcon,
    Edit as EditIcon,
    Visibility as ViewIcon,
    MoreVert as MoreVertIcon,
    Remove as RemoveIcon
} from '@mui/icons-material';
import { collection, doc, setDoc, getDoc, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';
import useGeographicData from '../../../../hooks/useGeographicData';
import SmartCitySelector from './SmartCitySelector';
import SystemZoneSelector from './SystemZoneSelector';
import SystemZoneSetSelector from './SystemZoneSetSelector';
import CarrierZoneDialog from './CarrierZoneDialog';
import CarrierZoneSetDialog from './CarrierZoneSetDialog';

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

    // Zone management tab states
    const [zoneManagementTab, setZoneManagementTab] = useState(0); // 0 = System Zones, 1 = Custom Zones
    const [systemZoneSubTab, setSystemZoneSubTab] = useState(0); // 0 = Individual, 1 = Zone Sets
    const [customZoneSubTab, setCustomZoneSubTab] = useState(0); // 0 = Individual, 1 = Zone Sets

    // Zone management dialog states
    const [systemZoneSelectorOpen, setSystemZoneSelectorOpen] = useState(false);
    const [systemZoneSetSelectorOpen, setSystemZoneSetSelectorOpen] = useState(false);
    const [customZoneDialogOpen, setCustomZoneDialogOpen] = useState(false);
    const [customZoneSetDialogOpen, setCustomZoneSetDialogOpen] = useState(false);
    const [zoneViewDialogOpen, setZoneViewDialogOpen] = useState(false);
    const [selectedZoneForView, setSelectedZoneForView] = useState(null);
    const [editingZone, setEditingZone] = useState(null);

    // Context menu and confirmation states
    const [contextMenuAnchor, setContextMenuAnchor] = useState(null);
    const [selectedZoneForAction, setSelectedZoneForAction] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [zoneToDelete, setZoneToDelete] = useState(null);

    // Zone codes state
    const [zoneCodesLoaded, setZoneCodesLoaded] = useState(false);
    const [zoneCodesMap, setZoneCodesMap] = useState(new Map());

    // Selected zone sets for confirmation
    const [selectedZoneSetsForConfirmation, setSelectedZoneSetsForConfirmation] = useState([]);

    // Loading state for context menu actions
    const [contextMenuLoading, setContextMenuLoading] = useState(false);

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

    // Helper function to get total zones count for the zones tab
    const getTotalZonesCount = useCallback(() => {
        // Count enabled zones from zoneReferences (not from cities)
        const systemZones = zoneConfig.zoneReferences?.system_zones || [];
        const systemZoneSets = zoneConfig.zoneReferences?.system_zone_sets || [];
        const customZones = zoneConfig.zoneReferences?.custom_zones || [];
        const customZoneSets = zoneConfig.zoneReferences?.custom_zone_sets || [];

        return systemZones.length + systemZoneSets.length + customZones.length + customZoneSets.length;
    }, [zoneConfig.zoneReferences]);

    // Helper function to get city count for a specific zone
    const getCityCountForZone = useCallback((zone) => {
        // Count cities in pickup and delivery zones that belong to this zone
        const pickupCities = zoneConfig.pickupZones?.selectedCities || [];
        const deliveryCities = zoneConfig.deliveryZones?.selectedCities || [];

        const zoneCities = [...pickupCities, ...deliveryCities].filter(city =>
            city.zoneId === zone.id || city.zoneName === zone.zoneName
        );

        // Remove duplicates by city ID
        const uniqueCities = new Set(zoneCities.map(city => city.searchKey || city.id));

        return uniqueCities.size || zone.cityCount || zone.totalPostalCodes || 'N/A';
    }, [zoneConfig.pickupZones, zoneConfig.deliveryZones]);

    // Handle embedded city selection (update state and auto-save)
    const handleEmbeddedCitySelection = useCallback(async (selectedCities, zoneCategory) => {
        console.log(`🏙️ CITY SELECTION - ${zoneCategory} received ${selectedCities.length} cities from map`);
        console.log(`🔍 CITY SELECTION - Sample city data:`, selectedCities[0]);

        // Ensure all zone metadata is preserved in cities
        const citiesWithZoneData = selectedCities.map(city => ({
            ...city,
            // Preserve zone metadata if it exists
            zoneId: city.zoneId || null,
            zoneName: city.zoneName || null,
            zoneCode: city.zoneCode || null,
            zoneSetId: city.zoneSetId || null,
            zoneSetName: city.zoneSetName || null,
            matchType: city.matchType || 'manual'
        }));

        const updatedConfig = {
            ...zoneConfig,
            [zoneCategory]: {
                ...zoneConfig[zoneCategory],
                selectedCities: citiesWithZoneData
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

            // Force re-render of zones tab by updating state
            setZoneConfig(prev => ({ ...prev }));

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

    // Load zone codes from database when cities change
    useEffect(() => {
        const loadZoneCodes = async () => {
            const pickupCities = zoneConfig.pickupZones?.selectedCities || [];
            const deliveryCities = zoneConfig.deliveryZones?.selectedCities || [];
            const allCities = [...pickupCities, ...deliveryCities];

            const uniqueZoneIds = new Set();
            allCities.forEach(city => {
                if (city.zoneId) {
                    uniqueZoneIds.add(city.zoneId);
                }
            });

            if (uniqueZoneIds.size > 0) {
                const newZoneCodesMap = new Map();
                try {
                    // Fetch zone codes from zones collection
                    for (const zoneId of uniqueZoneIds) {
                        const zoneDoc = await getDoc(doc(db, 'zones', zoneId));
                        if (zoneDoc.exists()) {
                            const zoneData = zoneDoc.data();
                            newZoneCodesMap.set(zoneId, zoneData.zoneCode || 'N/A');
                            console.log(`✅ Zone code loaded: ${zoneId} = ${zoneData.zoneCode}`);
                        }
                    }
                    setZoneCodesMap(newZoneCodesMap);
                    setZoneCodesLoaded(true);
                } catch (error) {
                    console.error('Error loading zone codes:', error);
                    setZoneCodesLoaded(true);
                }
            } else {
                setZoneCodesMap(new Map());
                setZoneCodesLoaded(true);
            }
        };

        const allCitiesLength = (zoneConfig.pickupZones?.selectedCities || []).length +
            (zoneConfig.deliveryZones?.selectedCities || []).length;

        if (allCitiesLength > 0) {
            loadZoneCodes();
        }
    }, [zoneConfig.pickupZones?.selectedCities, zoneConfig.deliveryZones?.selectedCities]);

    // Note: Removed auto-opening behavior to allow users to see the tab structure first
    // Users can manually navigate to configure pickup/delivery locations when needed

    const loadZoneConfiguration = async () => {
        console.log('📥 LOADING - Starting load for carrier:', carrierId);
        setLoading(true);
        try {
            const docRef = doc(db, 'carrierZoneConfigs', carrierId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('📥 LOADING - Raw data from database:', data);
                console.log('📥 LOADING - Zone config structure:', data.zoneConfig);
                console.log('📥 LOADING - Zone references:', data.zoneConfig?.zoneReferences);
                console.log('📥 LOADING - Pickup cities found:', data.zoneConfig?.pickupZones?.selectedCities?.length || 0);
                console.log('📥 LOADING - Delivery cities found:', data.zoneConfig?.deliveryZones?.selectedCities?.length || 0);

                const loadedConfig = data.zoneConfig || zoneConfig;
                console.log('📥 LOADING - Final loaded config:', loadedConfig);
                setZoneConfig(loadedConfig);
                console.log('📥 LOADING - State updated with loaded data');
            } else {
                console.log('📥 LOADING - No existing configuration found');
            }
        } catch (error) {
            console.error('❌ Error loading zone configuration:', error);
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

    // Handle zone removal
    const handleRemoveZone = useCallback(async (zoneType, zoneId) => {
        try {
            console.log(`🗑️ Removing ${zoneType} zone:`, zoneId);

            // Remove cities that belong to this zone from both pickup and delivery
            const pickupCities = zoneConfig.pickupZones?.selectedCities || [];
            const deliveryCities = zoneConfig.deliveryZones?.selectedCities || [];

            const updatedPickupCities = pickupCities.filter(city =>
                city.zoneId !== zoneId && city.zoneSetId !== zoneId
            );
            const updatedDeliveryCities = deliveryCities.filter(city =>
                city.zoneId !== zoneId && city.zoneSetId !== zoneId
            );

            const removedPickupCount = pickupCities.length - updatedPickupCities.length;
            const removedDeliveryCount = deliveryCities.length - updatedDeliveryCities.length;
            const totalRemovedCities = removedPickupCount + removedDeliveryCount;

            // Update zone config
            const updatedConfig = {
                ...zoneConfig,
                pickupZones: {
                    ...zoneConfig.pickupZones,
                    selectedCities: updatedPickupCities
                },
                deliveryZones: {
                    ...zoneConfig.deliveryZones,
                    selectedCities: updatedDeliveryCities
                }
            };

            // Save to database
            const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
            await setDoc(carrierConfigRef, {
                carrierId,
                carrierName,
                zoneConfig: updatedConfig,
                lastUpdated: new Date(),
                version: '2.0'
            }, { merge: true });

            setZoneConfig(updatedConfig);

            enqueueSnackbar(`Zone removed successfully (${totalRemovedCities} cities removed)`, { variant: 'success' });
        } catch (error) {
            console.error('Error removing zone:', error);
            enqueueSnackbar('Failed to remove zone', { variant: 'error' });
        }
    }, [zoneConfig, carrierId, carrierName, enqueueSnackbar]);

    // Handle zone editing
    const handleEditZone = useCallback((zoneType, zone) => {
        console.log(`✏️ Editing ${zoneType} zone:`, zone);
        enqueueSnackbar('Zone editing feature coming soon', { variant: 'info' });
    }, [enqueueSnackbar]);

    // Handle zone viewing
    const handleViewZone = useCallback((zoneType, zone) => {
        console.log(`👁️ Viewing ${zoneType} zone:`, zone);
        setSelectedZoneForView({ type: zoneType, data: zone });
        setZoneViewDialogOpen(true);
    }, []);

    // Handle adding system zone
    const handleAddSystemZone = useCallback(() => {
        console.log('➕ Opening system zone selector');
        setSystemZoneSelectorOpen(true);
    }, []);

    // Handle adding system zone set
    const handleAddSystemZoneSet = useCallback(() => {
        console.log('➕ Opening system zone set selector');
        setSystemZoneSetSelectorOpen(true);
    }, []);

    // Handle adding custom zone
    const handleAddCustomZone = useCallback(() => {
        console.log('➕ Opening custom zone creator');
        setEditingZone(null); // Clear editing state for new zone
        setCustomZoneDialogOpen(true);
    }, []);

    // Handle adding custom zone set
    const handleAddCustomZoneSet = useCallback(() => {
        console.log('➕ Opening custom zone set creator');
        setEditingZone(null); // Clear editing state for new zone set
        setCustomZoneSetDialogOpen(true);
    }, []);

    // Handle editing zones
    const handleEditZoneAction = useCallback((zoneType, zone) => {
        console.log(`✏️ Editing ${zoneType} zone:`, zone);
        setEditingZone({ type: zoneType, data: zone });

        if (zoneType === 'custom_zones') {
            setCustomZoneDialogOpen(true);
        } else if (zoneType === 'custom_zone_sets') {
            setCustomZoneSetDialogOpen(true);
        }

        // Close context menu
        setContextMenuAnchor(null);
        setSelectedZoneForAction(null);
    }, []);

    // Handle context menu open
    const handleContextMenuOpen = useCallback((event, zoneType, zone) => {
        event.stopPropagation();
        setContextMenuAnchor(event.currentTarget);
        setSelectedZoneForAction({ type: zoneType, data: zone });
    }, []);

    // Handle context menu close
    const handleContextMenuClose = useCallback(() => {
        setContextMenuAnchor(null);
        setSelectedZoneForAction(null);
        setContextMenuLoading(false);
    }, []);

    // Handle view zone from context menu
    const handleViewZoneFromMenu = useCallback(() => {
        if (selectedZoneForAction) {
            handleViewZone(selectedZoneForAction.type, selectedZoneForAction.data);
        }
        handleContextMenuClose();
    }, [selectedZoneForAction, handleViewZone, handleContextMenuClose]);

    // Handle delete zone from context menu
    const handleDeleteZoneFromMenu = useCallback(() => {
        if (selectedZoneForAction) {
            setZoneToDelete(selectedZoneForAction);
            setDeleteConfirmOpen(true);
        }
        handleContextMenuClose();
    }, [selectedZoneForAction, handleContextMenuClose]);

    // Handle confirmed zone deletion
    const handleConfirmedZoneDeletion = useCallback(async () => {
        if (zoneToDelete) {
            await handleRemoveZone(zoneToDelete.type, zoneToDelete.data.id);
            setDeleteConfirmOpen(false);
            setZoneToDelete(null);
        }
    }, [zoneToDelete, handleRemoveZone]);

    // Handle adding zone to pickup or delivery locations
    const handleAddZoneToLocation = useCallback(async (locationType) => {
        if (!selectedZoneForAction) return;

        setContextMenuLoading(true);
        try {
            const zone = selectedZoneForAction.data;
            const zoneType = selectedZoneForAction.type;

            console.log(`🚀 Adding ${zoneType} to ${locationType} locations:`, zone);

            let citiesToAdd = [];

            // Expand zone to cities using the same logic as the zone selection
            if (zoneType === 'system_zones') {
                // Individual system zone
                const expandZone = httpsCallable(functions, 'expandSystemZoneToCities');
                const result = await expandZone({ zoneId: zone.id });

                if (result.data.success && result.data.cities) {
                    citiesToAdd = result.data.cities.map(city => ({
                        ...city,
                        zoneId: zone.id,
                        zoneName: zone.zoneName || zone.name,
                        zoneCode: zone.zoneCode || 'N/A'
                    }));
                }
            } else if (zoneType === 'system_zone_sets') {
                // System zone set
                const expandZoneSet = httpsCallable(functions, 'expandZoneSetToCities');
                const result = await expandZoneSet({ zoneSetId: zone.id });

                if (result.data.success && result.data.cities) {
                    citiesToAdd = result.data.cities.map(city => ({
                        ...city,
                        zoneSetId: zone.id,
                        zoneSetName: zone.name,
                        zoneCode: city.zoneCode || 'N/A'
                    }));
                }
            }

            if (citiesToAdd.length === 0) {
                enqueueSnackbar('No cities found in this zone', { variant: 'warning' });
                setContextMenuAnchor(null);
                return;
            }

            // Filter out cities that already exist
            const existingCities = locationType === 'pickup'
                ? zoneConfig.pickupZones?.selectedCities || []
                : zoneConfig.deliveryZones?.selectedCities || [];

            const existingCityIds = new Set(existingCities.map(city => city.searchKey || city.id));
            const newCities = citiesToAdd.filter(city => !existingCityIds.has(city.searchKey || city.id));

            if (newCities.length === 0) {
                enqueueSnackbar(`All cities from this zone are already in ${locationType} locations`, { variant: 'info' });
                setContextMenuAnchor(null);
                return;
            }

            // Add cities to the specified location
            const updatedConfig = {
                ...zoneConfig,
                [`${locationType}Zones`]: {
                    ...zoneConfig[`${locationType}Zones`],
                    selectedCities: [...existingCities, ...newCities]
                }
            };

            // Save to database
            const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
            await setDoc(carrierConfigRef, {
                carrierId,
                carrierName,
                zoneConfig: updatedConfig,
                lastUpdated: new Date(),
                version: '2.0'
            }, { merge: true });

            setZoneConfig(updatedConfig);
            setContextMenuAnchor(null);

            enqueueSnackbar(`Added ${newCities.length} cities to ${locationType} locations`, { variant: 'success' });

        } catch (error) {
            console.error(`Error adding zone to ${locationType}:`, error);
            enqueueSnackbar(`Failed to add zone to ${locationType} locations`, { variant: 'error' });
        } finally {
            setContextMenuLoading(false);
        }
    }, [selectedZoneForAction, zoneConfig, carrierId, carrierName, enqueueSnackbar]);

    // Handle removing zone from pickup or delivery locations
    const handleRemoveZoneFromLocation = useCallback(async (locationType) => {
        if (!selectedZoneForAction) return;

        setContextMenuLoading(true);
        try {
            const zone = selectedZoneForAction.data;
            const zoneType = selectedZoneForAction.type;

            console.log(`🗑️ Removing ${zoneType} from ${locationType} locations:`, zone);

            const existingCities = locationType === 'pickup'
                ? zoneConfig.pickupZones?.selectedCities || []
                : zoneConfig.deliveryZones?.selectedCities || [];

            console.log('🔍 DELETION DEBUG:', {
                locationType,
                zoneType,
                zoneId: zone.id,
                existingCitiesCount: existingCities.length,
                pickupCitiesCount: zoneConfig.pickupZones?.selectedCities?.length || 0,
                deliveryCitiesCount: zoneConfig.deliveryZones?.selectedCities?.length || 0
            });

            // Filter out cities that belong to this zone/zone set
            let filteredCities;
            if (zoneType === 'system_zones') {
                filteredCities = existingCities.filter(city => city.zoneId !== zone.id);
            } else if (zoneType === 'system_zone_sets') {
                filteredCities = existingCities.filter(city => city.zoneSetId !== zone.id);
            } else {
                filteredCities = existingCities;
            }

            const removedCount = existingCities.length - filteredCities.length;

            if (removedCount === 0) {
                enqueueSnackbar(`No cities from this zone found in ${locationType} locations`, { variant: 'info' });
                setContextMenuAnchor(null);
                return;
            }

            // Update configuration
            const updatedConfig = {
                ...zoneConfig,
                [`${locationType}Zones`]: {
                    ...zoneConfig[`${locationType}Zones`],
                    selectedCities: filteredCities
                }
            };

            console.log('🔍 UPDATE DEBUG:', {
                locationType,
                updateKey: `${locationType}Zones`,
                originalCitiesCount: existingCities.length,
                filteredCitiesCount: filteredCities.length,
                removedCount: existingCities.length - filteredCities.length,
                updatedConfigStructure: {
                    pickupCitiesAfter: updatedConfig.pickupZones?.selectedCities?.length || 0,
                    deliveryCitiesAfter: updatedConfig.deliveryZones?.selectedCities?.length || 0
                }
            });

            // Save to database
            const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
            await setDoc(carrierConfigRef, {
                carrierId,
                carrierName,
                zoneConfig: updatedConfig,
                lastUpdated: new Date(),
                version: '2.0'
            }, { merge: true });

            setZoneConfig(updatedConfig);
            setContextMenuAnchor(null);

            enqueueSnackbar(`Removed ${removedCount} cities from ${locationType} locations`, { variant: 'success' });

        } catch (error) {
            console.error(`Error removing zone from ${locationType}:`, error);
            enqueueSnackbar(`Failed to remove zone from ${locationType} locations`, { variant: 'error' });
        } finally {
            setContextMenuLoading(false);
        }
    }, [selectedZoneForAction, zoneConfig, carrierId, carrierName, enqueueSnackbar]);

    // Helper function to check if zone cities are assigned to a location
    const isZoneAssignedToLocation = useCallback((zone, zoneType, locationType) => {
        const cities = locationType === 'pickup'
            ? zoneConfig.pickupZones?.selectedCities || []
            : zoneConfig.deliveryZones?.selectedCities || [];

        if (zoneType === 'system_zones') {
            return cities.some(city => city.zoneId === zone.id);
        } else if (zoneType === 'system_zone_sets') {
            return cities.some(city => city.zoneSetId === zone.id);
        }
        return false;
    }, [zoneConfig]);

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
                        carrierName={carrierName}
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
                        carrierId={carrierId}
                        carrierName={carrierName}
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
                        carrierName={carrierName}
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

    // Render zones management tab
    const renderZonesManagement = () => {
        return (
            <Box sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
                {/* Header Section */}
                <Box sx={{ mb: 3, p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 0.5 }}>
                        Configure Zone Management
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Manage system zones, zone sets, and custom zones for this carrier
                    </Typography>
                </Box>

                {/* Main Zone Type Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, px: 3 }}>
                    <Tabs
                        value={zoneManagementTab}
                        onChange={(e, newValue) => setZoneManagementTab(newValue)}
                        sx={{
                            '& .MuiTab-root': {
                                fontSize: '12px',
                                textTransform: 'none',
                                minHeight: 40
                            }
                        }}
                    >
                        <Tab
                            icon={<RegionIcon />}
                            label="System Zones"
                            iconPosition="start"
                        />
                        <Tab
                            icon={<MapIcon />}
                            label="Custom Zones"
                            iconPosition="start"
                        />
                    </Tabs>
                </Box>

                {/* System Zones Tab */}
                {zoneManagementTab === 0 && (
                    <Box sx={{ flex: 1, overflow: 'auto', px: 3 }}>
                        {/* Sub-tabs for Individual Zones vs Zone Sets */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs
                                value={systemZoneSubTab}
                                onChange={(e, newValue) => setSystemZoneSubTab(newValue)}
                                sx={{
                                    '& .MuiTab-root': {
                                        fontSize: '11px',
                                        textTransform: 'none',
                                        minHeight: 36
                                    }
                                }}
                            >
                                <Tab label="Individual Zones" />
                                <Tab label="Zone Sets" />
                            </Tabs>
                        </Box>

                        {/* Individual System Zones */}
                        {systemZoneSubTab === 0 && renderSystemZonesList()}

                        {/* System Zone Sets */}
                        {systemZoneSubTab === 1 && renderSystemZoneSetsList()}
                    </Box>
                )}

                {/* Custom Zones Tab */}
                {zoneManagementTab === 1 && (
                    <Box sx={{ flex: 1, overflow: 'auto', px: 3 }}>
                        {/* Sub-tabs for Individual Zones vs Zone Sets */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tabs
                                value={customZoneSubTab}
                                onChange={(e, newValue) => setCustomZoneSubTab(newValue)}
                                sx={{
                                    '& .MuiTab-root': {
                                        fontSize: '11px',
                                        textTransform: 'none',
                                        minHeight: 36
                                    }
                                }}
                            >
                                <Tab label="Individual Zones" />
                                <Tab label="Zone Sets" />
                            </Tabs>
                        </Box>

                        {/* Individual Custom Zones */}
                        {customZoneSubTab === 0 && renderCustomZonesList()}

                        {/* Custom Zone Sets */}
                        {customZoneSubTab === 1 && renderCustomZoneSetsList()}
                    </Box>
                )}
            </Box>
        );
    };

    // Render individual system zones list
    const renderSystemZonesList = () => {
        // Get enabled zones from zoneReferences (not from cities)
        const enabledZones = zoneConfig.zoneReferences?.system_zones || [];

        // Count cities for each zone from pickup and delivery locations
        const pickupCities = zoneConfig.pickupZones?.selectedCities || [];
        const deliveryCities = zoneConfig.deliveryZones?.selectedCities || [];
        const allCities = [...pickupCities, ...deliveryCities];

        // Build zone display data from enabled zones, not from cities
        const systemZones = enabledZones.map(zoneRef => {
            // Count cities that belong to this zone
            const cityCount = allCities.filter(city => city.zoneId === zoneRef.id).length;

            return {
                id: zoneRef.id,
                zoneName: zoneRef.zoneName || zoneRef.name,
                zoneCode: zoneCodesMap.get(zoneRef.id) || zoneRef.zoneCode || 'N/A',
                country: zoneRef.country || 'N/A',
                cityCount: cityCount
            };
        });

        return (
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                        System Zones ({systemZones.length})
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddSystemZone}
                        sx={{ fontSize: '12px' }}
                    >
                        Add System Zone
                    </Button>
                </Box>

                {systemZones.length > 0 ? (
                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Zone Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Zone Code</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Country</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Cities</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {systemZones.map((zone, index) => (
                                    <TableRow key={zone.id || index}>
                                        <TableCell sx={{ fontSize: '12px' }}>{zone.zoneName || zone.name}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>{zone.zoneCode || zone.code}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>{zone.country || 'N/A'}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zone.cityCount || 'N/A'}
                                                size="small"
                                                variant="outlined"
                                                color="primary"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={(event) => handleContextMenuOpen(event, 'system_zones', zone)}
                                                sx={{ color: '#6b7280' }}
                                            >
                                                <MoreVertIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                            No system zones added to this carrier
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleAddSystemZone}
                            sx={{ fontSize: '12px' }}
                        >
                            Add Your First System Zone
                        </Button>
                    </Paper>
                )}
            </Box>
        );
    };

    // Render system zone sets list
    const renderSystemZoneSetsList = () => {
        // Get enabled zone sets from zoneReferences (not from cities)
        const enabledZoneSets = zoneConfig.zoneReferences?.system_zone_sets || [];

        // Count cities for each zone set from pickup and delivery locations
        const pickupCities = zoneConfig.pickupZones?.selectedCities || [];
        const deliveryCities = zoneConfig.deliveryZones?.selectedCities || [];
        const allCities = [...pickupCities, ...deliveryCities];

        console.log('🔍 ZONE SET DEBUGGING:', {
            enabledZoneSetsCount: enabledZoneSets.length,
            totalCities: allCities.length,
            pickupCitiesCount: pickupCities.length,
            deliveryCitiesCount: deliveryCities.length,
            citiesWithZoneSetId: allCities.filter(c => c.zoneSetId).length
        });

        // Build zone set display data from enabled zone sets, not from cities
        const systemZoneSets = enabledZoneSets.map(zoneSetRef => {
            // Count cities that belong to this zone set
            const cityCount = allCities.filter(city => city.zoneSetId === zoneSetRef.id).length;

            return {
                id: zoneSetRef.id,
                name: zoneSetRef.name,
                zones: { length: zoneSetRef.zoneCount || zoneSetRef.selectedZones?.length || 0 },
                cityCount: cityCount,
                coverage: 'Regional'
            };
        });

        console.log('🔍 ZONE SET RESULTS:', {
            enabledZoneSetsCount: enabledZoneSets.length,
            systemZoneSetsLength: systemZoneSets.length,
            systemZoneSets: systemZoneSets
        });

        return (
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                        System Zone Sets ({systemZoneSets.length})
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddSystemZoneSet}
                        sx={{ fontSize: '12px' }}
                    >
                        Add Zone Set
                    </Button>
                </Box>

                {systemZoneSets.length > 0 ? (
                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Zone Set Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Zones Count</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Coverage</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {systemZoneSets.map((zoneSet, index) => (
                                    <TableRow key={zoneSet.id || index}>
                                        <TableCell sx={{ fontSize: '12px' }}>{zoneSet.name}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zoneSet.zones?.length || zoneSet.zones?.size || zoneSet.cityCount || 0}
                                                size="small"
                                                variant="outlined"
                                                color="secondary"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>{zoneSet.coverage || 'Regional'}</TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={(event) => handleContextMenuOpen(event, 'system_zone_sets', zoneSet)}
                                                sx={{ color: '#6b7280' }}
                                            >
                                                <MoreVertIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                            No system zone sets added to this carrier
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleAddSystemZoneSet}
                            sx={{ fontSize: '12px' }}
                        >
                            Add Your First Zone Set
                        </Button>
                    </Paper>
                )}
            </Box>
        );
    };

    // Render custom zones list  
    const renderCustomZonesList = () => {
        // For now, show empty since custom zones aren't implemented yet
        const customZones = [];

        return (
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                        Custom Zones ({customZones.length})
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleAddCustomZone()}
                        sx={{ fontSize: '12px' }}
                    >
                        Create Custom Zone
                    </Button>
                </Box>

                {customZones.length > 0 ? (
                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Zone Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Cities</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Created</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {customZones.map((zone, index) => (
                                    <TableRow key={zone.id || index}>
                                        <TableCell sx={{ fontSize: '12px' }}>{zone.name}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zone.cities?.length || 0}
                                                size="small"
                                                variant="outlined"
                                                color="success"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {zone.createdAt ? new Date(zone.createdAt).toLocaleDateString() : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleViewZone('custom_zones', zone)}
                                                sx={{ color: '#6b7280', mr: 1 }}
                                            >
                                                <ViewIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleEditZoneAction('custom_zones', zone)}
                                                sx={{ color: '#3b82f6', mr: 1 }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleRemoveZone('custom_zones', zone.id)}
                                                sx={{ color: '#ef4444' }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                            No custom zones created for this carrier
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => handleAddCustomZone()}
                            sx={{ fontSize: '12px' }}
                        >
                            Create Your First Custom Zone
                        </Button>
                    </Paper>
                )}
            </Box>
        );
    };

    // Render custom zone sets list
    const renderCustomZoneSetsList = () => {
        // For now, show empty since custom zone sets aren't implemented yet
        const customZoneSets = [];

        return (
            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '14px', color: '#374151' }}>
                        Custom Zone Sets ({customZoneSets.length})
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleAddCustomZoneSet()}
                        sx={{ fontSize: '12px' }}
                    >
                        Create Zone Set
                    </Button>
                </Box>

                {customZoneSets.length > 0 ? (
                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Zone Set Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Zones</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Total Cities</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Created</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {customZoneSets.map((zoneSet, index) => (
                                    <TableRow key={zoneSet.id || index}>
                                        <TableCell sx={{ fontSize: '12px' }}>{zoneSet.name}</TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={zoneSet.zones?.length || 0}
                                                size="small"
                                                variant="outlined"
                                                color="warning"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {zoneSet.totalCities || 'N/A'}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            {zoneSet.createdAt ? new Date(zoneSet.createdAt).toLocaleDateString() : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleViewZone('custom_zone_sets', zoneSet)}
                                                sx={{ color: '#6b7280', mr: 1 }}
                                            >
                                                <ViewIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleEditZoneAction('custom_zone_sets', zoneSet)}
                                                sx={{ color: '#3b82f6', mr: 1 }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleRemoveZone('custom_zone_sets', zoneSet.id)}
                                                sx={{ color: '#ef4444' }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ) : (
                    <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                            No custom zone sets created for this carrier
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => handleAddCustomZoneSet()}
                            sx={{ fontSize: '12px' }}
                        >
                            Create Your First Zone Set
                        </Button>
                    </Paper>
                )}
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
            label: 'Zones',
            icon: <ZonesIcon />,
            count: getTotalZonesCount()
        },
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
                            {activeTab === 0 && renderZonesManagement()}
                            {activeTab === 1 && renderPickupLocations()}
                            {activeTab === 2 && renderDeliveryLocations()}
                            {activeTab === 3 && renderRouteMappings()}
                            {activeTab === 4 && renderChargeMapping()}
                        </>
                    )}
                </Box>
            </DialogContent>

            {/* Zone Management Dialogs */}

            {/* System Zone Selector Dialog */}
            <Dialog
                open={systemZoneSelectorOpen}
                onClose={() => setSystemZoneSelectorOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Add System Zones to {carrierName}
                </DialogTitle>
                <DialogContent>
                    <SystemZoneSelector
                        embedded={true}
                        onZoneSelection={async (zones) => {
                            try {
                                console.log('🔄 System zones selected:', zones);

                                if (zones.length === 0) {
                                    setSystemZoneSelectorOpen(false);
                                    return;
                                }

                                // COPY EXACT LOGIC from EnhancedAddCityDialog - Expand zones to cities first
                                const allCities = [];

                                for (const zone of zones) {
                                    console.log('🔍 Processing zone:', zone);
                                    console.log('🏙️ Zone cities:', zone.cities);

                                    if (zone.cities && Array.isArray(zone.cities) && zone.cities.length > 0) {
                                        // Zone has cities directly
                                        zone.cities.forEach(city => {
                                            allCities.push({
                                                ...city,
                                                zoneId: zone.id,
                                                zoneName: zone.zoneName || zone.name,
                                                zoneCode: zone.zoneCode || zone.code
                                            });
                                        });
                                    } else {
                                        // Need to expand zone via cloud function
                                        console.log('🚀 Calling cloud function for zone:', zone.id, zone.zoneName);
                                        try {
                                            const expandZone = httpsCallable(functions, 'expandSystemZoneToCities');
                                            const result = await expandZone({ zoneId: zone.id });
                                            console.log('🔥 Cloud function response:', result.data);

                                            if (result.data.success && result.data.cities) {
                                                console.log('🌍 Cloud function returned cities:', result.data.cities.map(c => ({
                                                    city: c.city,
                                                    latitude: c.latitude,
                                                    longitude: c.longitude,
                                                    hasCoords: !!(c.latitude && c.longitude)
                                                })));

                                                result.data.cities.forEach(city => {
                                                    allCities.push({
                                                        ...city,
                                                        zoneId: zone.id,
                                                        zoneName: zone.zoneName || zone.name,
                                                        zoneCode: zone.zoneCode || zone.code
                                                    });
                                                });
                                            } else {
                                                console.warn('🚨 Cloud function failed or returned no cities:', result.data);
                                            }
                                        } catch (error) {
                                            console.error('Error expanding zone:', error);
                                            enqueueSnackbar(`Error expanding zone ${zone.zoneName || zone.name}`, { variant: 'error' });
                                        }
                                    }
                                }

                                // Filter out existing cities (prevent duplicates)
                                const existingCities = zoneConfig.pickupZones?.selectedCities || [];
                                const existingCityIds = new Set(existingCities.map(city => city.searchKey || city.id));

                                const newCities = allCities.filter(city => {
                                    const cityId = city.searchKey || city.id;
                                    return !existingCityIds.has(cityId);
                                });

                                console.log(`🏷️ Enabling ${zones.length} zones for carrier (metadata only, no cities added)`);

                                // Only add zones to zoneReferences (enable them for carrier), don't add cities automatically
                                const updatedConfig = {
                                    ...zoneConfig,
                                    zoneReferences: {
                                        ...zoneConfig.zoneReferences,
                                        system_zones: [
                                            ...(zoneConfig.zoneReferences?.system_zones || []),
                                            ...zones.filter(z => !(zoneConfig.zoneReferences?.system_zones || []).some(existing => existing.id === z.id))
                                        ]
                                    }
                                };

                                console.log('💾 Saving zone configuration:', updatedConfig);
                                console.log('💾 Zone references to save:', updatedConfig.zoneReferences);

                                // Save to database with complete structure
                                const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
                                const dataToSave = {
                                    carrierId,
                                    carrierName,
                                    zoneConfig: updatedConfig,
                                    lastUpdated: new Date(),
                                    version: '2.0'
                                };

                                console.log('💾 Complete data structure being saved:', dataToSave);
                                await setDoc(carrierConfigRef, dataToSave, { merge: true });

                                setZoneConfig(updatedConfig);
                                setSystemZoneSelectorOpen(false);

                                enqueueSnackbar(`Enabled ${zones.length} system zones for carrier (use context menu to assign cities)`, { variant: 'success' });
                            } catch (error) {
                                console.error('Error adding system zones:', error);
                                enqueueSnackbar('Failed to add system zones', { variant: 'error' });
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSystemZoneSelectorOpen(false)} size="small">
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>

            {/* System Zone Set Selector Dialog */}
            <Dialog
                open={systemZoneSetSelectorOpen}
                onClose={() => setSystemZoneSetSelectorOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Add System Zone Sets to {carrierName}
                </DialogTitle>
                <DialogContent>
                    <SystemZoneSetSelector
                        embedded={true}
                        multiSelect={true}
                        confirmButton={true}
                        onZoneSetSelection={(zoneSets) => {
                            // Just update the selection state, don't process yet
                            setSelectedZoneSetsForConfirmation(zoneSets);
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setSystemZoneSetSelectorOpen(false);
                        setSelectedZoneSetsForConfirmation([]);
                    }} size="small">
                        Cancel
                    </Button>
                    <Button
                        onClick={async () => {
                            const zoneSets = selectedZoneSetsForConfirmation;
                            try {
                                console.log('🔄 System zone sets selected:', zoneSets);

                                if (zoneSets.length === 0) {
                                    setSystemZoneSetSelectorOpen(false);
                                    return;
                                }

                                // COPY EXACT LOGIC from EnhancedAddCityDialog - Expand zone sets to cities
                                const allCities = [];

                                for (const zoneSet of zoneSets) {
                                    try {
                                        console.log('🚀 Calling cloud function for zone set:', zoneSet.id, zoneSet.name);
                                        const expandZoneSet = httpsCallable(functions, 'expandZoneSetToCities');
                                        const result = await expandZoneSet({ zoneSetId: zoneSet.id });
                                        console.log('🔥 Zone set expansion response:', result.data);

                                        if (result.data.success && result.data.cities) {
                                            result.data.cities.forEach(city => {
                                                allCities.push({
                                                    ...city,
                                                    zoneSetId: zoneSet.id,
                                                    zoneSetName: zoneSet.name,
                                                    zoneCode: city.zoneCode || 'N/A' // Preserve zone code from expanded cities
                                                });
                                            });
                                        }
                                    } catch (error) {
                                        console.error(`Error expanding zone set ${zoneSet.name}:`, error);
                                        enqueueSnackbar(`Error expanding zone set ${zoneSet.name}`, { variant: 'error' });
                                    }
                                }

                                // Filter out existing cities (prevent duplicates)
                                const existingCities = zoneConfig.pickupZones?.selectedCities || [];
                                const existingCityIds = new Set(existingCities.map(city => city.searchKey || city.id));

                                const newCities = allCities.filter(city => {
                                    const cityId = city.searchKey || city.id;
                                    return !existingCityIds.has(cityId);
                                });

                                console.log(`🏷️ Enabling ${zoneSets.length} zone sets for carrier (metadata only, no cities added)`);

                                // Only add zone sets to zoneReferences (enable them for carrier), don't add cities automatically
                                const updatedConfig = {
                                    ...zoneConfig,
                                    zoneReferences: {
                                        ...zoneConfig.zoneReferences,
                                        system_zone_sets: [
                                            ...(zoneConfig.zoneReferences?.system_zone_sets || []),
                                            ...zoneSets.filter(zs => !(zoneConfig.zoneReferences?.system_zone_sets || []).some(existing => existing.id === zs.id))
                                        ]
                                    }
                                };

                                console.log('💾 Saving zone set configuration:', updatedConfig);
                                console.log('💾 Zone set references to save:', updatedConfig.zoneReferences);

                                // Save to database with complete structure
                                const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
                                const dataToSave = {
                                    carrierId,
                                    carrierName,
                                    zoneConfig: updatedConfig,
                                    lastUpdated: new Date(),
                                    version: '2.0'
                                };

                                console.log('💾 Complete zone set data structure being saved:', dataToSave);
                                await setDoc(carrierConfigRef, dataToSave, { merge: true });

                                setZoneConfig(updatedConfig);
                                setSystemZoneSetSelectorOpen(false);
                                setSelectedZoneSetsForConfirmation([]);

                                enqueueSnackbar(`Enabled ${zoneSets.length} system zone sets for carrier (use context menu to assign cities)`, { variant: 'success' });
                            } catch (error) {
                                console.error('Error adding system zone sets:', error);
                                enqueueSnackbar('Failed to add system zone sets', { variant: 'error' });
                            }
                        }}
                        variant="contained"
                        size="small"
                        disabled={selectedZoneSetsForConfirmation.length === 0}
                    >
                        Add Selected Zone Sets ({selectedZoneSetsForConfirmation.length})
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Custom Zone Dialog */}
            <CarrierZoneDialog
                open={customZoneDialogOpen}
                onClose={() => {
                    setCustomZoneDialogOpen(false);
                    setEditingZone(null);
                }}
                carrierId={carrierId}
                carrierName={carrierName}
                editingZone={editingZone?.type === 'custom_zones' ? editingZone.data : null}
                onZoneCreated={async (newZone) => {
                    try {
                        // Add new custom zone to references
                        const updatedReferences = { ...zoneConfig.zoneReferences };
                        if (!updatedReferences.custom_zones) {
                            updatedReferences.custom_zones = [];
                        }
                        updatedReferences.custom_zones.push(newZone);

                        const updatedConfig = {
                            ...zoneConfig,
                            zoneReferences: updatedReferences
                        };

                        // Save to database
                        const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
                        await setDoc(carrierConfigRef, updatedConfig, { merge: true });

                        setZoneConfig(updatedConfig);
                        setCustomZoneDialogOpen(false);
                        setEditingZone(null);

                        enqueueSnackbar('Custom zone created successfully', { variant: 'success' });
                    } catch (error) {
                        console.error('Error saving custom zone:', error);
                        enqueueSnackbar('Failed to save custom zone', { variant: 'error' });
                    }
                }}
            />

            {/* Custom Zone Set Dialog */}
            <CarrierZoneSetDialog
                open={customZoneSetDialogOpen}
                onClose={() => {
                    setCustomZoneSetDialogOpen(false);
                    setEditingZone(null);
                }}
                carrierId={carrierId}
                carrierName={carrierName}
                editingZoneSet={editingZone?.type === 'custom_zone_sets' ? editingZone.data : null}
                onZoneSetCreated={async (newZoneSet) => {
                    try {
                        // Add new custom zone set to references
                        const updatedReferences = { ...zoneConfig.zoneReferences };
                        if (!updatedReferences.custom_zone_sets) {
                            updatedReferences.custom_zone_sets = [];
                        }
                        updatedReferences.custom_zone_sets.push(newZoneSet);

                        const updatedConfig = {
                            ...zoneConfig,
                            zoneReferences: updatedReferences
                        };

                        // Save to database
                        const carrierConfigRef = doc(db, 'carrierZoneConfigs', carrierId);
                        await setDoc(carrierConfigRef, updatedConfig, { merge: true });

                        setZoneConfig(updatedConfig);
                        setCustomZoneSetDialogOpen(false);
                        setEditingZone(null);

                        enqueueSnackbar('Custom zone set created successfully', { variant: 'success' });
                    } catch (error) {
                        console.error('Error saving custom zone set:', error);
                        enqueueSnackbar('Failed to save custom zone set', { variant: 'error' });
                    }
                }}
            />

            {/* Zone View Dialog */}
            <Dialog
                open={zoneViewDialogOpen}
                onClose={() => {
                    setZoneViewDialogOpen(false);
                    setSelectedZoneForView(null);
                }}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Zone Details - {selectedZoneForView?.data?.name || selectedZoneForView?.data?.zoneName}
                </DialogTitle>
                <DialogContent>
                    {selectedZoneForView && (
                        <Box>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                Zone Type: {selectedZoneForView.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Typography>

                            <Paper sx={{ p: 2, border: '1px solid #e5e7eb' }}>
                                <pre style={{ fontSize: '11px', margin: 0, whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(selectedZoneForView.data, null, 2)}
                                </pre>
                            </Paper>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setZoneViewDialogOpen(false);
                            setSelectedZoneForView(null);
                        }}
                        size="small"
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Zone Context Menu */}
            <Menu
                anchorEl={contextMenuAnchor}
                open={Boolean(contextMenuAnchor)}
                onClose={contextMenuLoading ? undefined : handleContextMenuClose} // Prevent closing during loading
                PaperProps={{
                    sx: {
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        '& .MuiMenuItem-root': {
                            fontSize: '12px',
                            py: 1,
                            px: 2,
                            minHeight: 'auto'
                        },
                        opacity: contextMenuLoading ? 0.8 : 1
                    }
                }}
            >
                {contextMenuLoading && (
                    <Box sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: 2,
                        borderBottom: '1px solid #e5e7eb',
                        backgroundColor: '#f8fafc'
                    }}>
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                            Processing zone cities...
                        </Typography>
                    </Box>
                )}
                <MenuItem onClick={handleViewZoneFromMenu}>
                    <ViewIcon sx={{ fontSize: '16px', mr: 1, color: '#6b7280' }} />
                    View Details
                </MenuItem>
                {selectedZoneForAction?.type?.includes('custom') && (
                    <MenuItem onClick={() => handleEditZoneAction(selectedZoneForAction.type, selectedZoneForAction.data)}>
                        <EditIcon sx={{ fontSize: '16px', mr: 1, color: '#3b82f6' }} />
                        Edit Zone
                    </MenuItem>
                )}
                <Divider />
                {/* Pickup Actions - Smart Conditional Display */}
                {!isZoneAssignedToLocation(selectedZoneForAction?.data, selectedZoneForAction?.type, 'pickup') && (
                    <MenuItem
                        onClick={() => handleAddZoneToLocation('pickup')}
                        disabled={contextMenuLoading}
                    >
                        {contextMenuLoading ? (
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                        ) : (
                            <AddIcon sx={{ fontSize: '16px', mr: 1, color: '#059669' }} />
                        )}
                        Add to Pickup Cities
                    </MenuItem>
                )}
                {isZoneAssignedToLocation(selectedZoneForAction?.data, selectedZoneForAction?.type, 'pickup') && (
                    <MenuItem
                        onClick={() => handleRemoveZoneFromLocation('pickup')}
                        disabled={contextMenuLoading}
                    >
                        {contextMenuLoading ? (
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                        ) : (
                            <RemoveIcon sx={{ fontSize: '16px', mr: 1, color: '#dc2626' }} />
                        )}
                        Delete from Pickup Cities
                    </MenuItem>
                )}

                {/* Delivery Actions - Smart Conditional Display */}
                {!isZoneAssignedToLocation(selectedZoneForAction?.data, selectedZoneForAction?.type, 'delivery') && (
                    <MenuItem
                        onClick={() => handleAddZoneToLocation('delivery')}
                        disabled={contextMenuLoading}
                    >
                        {contextMenuLoading ? (
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                        ) : (
                            <AddIcon sx={{ fontSize: '16px', mr: 1, color: '#059669' }} />
                        )}
                        Add to Delivery Cities
                    </MenuItem>
                )}
                {isZoneAssignedToLocation(selectedZoneForAction?.data, selectedZoneForAction?.type, 'delivery') && (
                    <MenuItem
                        onClick={() => handleRemoveZoneFromLocation('delivery')}
                        disabled={contextMenuLoading}
                    >
                        {contextMenuLoading ? (
                            <CircularProgress size={16} sx={{ mr: 1 }} />
                        ) : (
                            <RemoveIcon sx={{ fontSize: '16px', mr: 1, color: '#dc2626' }} />
                        )}
                        Delete from Delivery Cities
                    </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={handleDeleteZoneFromMenu}>
                    <DeleteIcon sx={{ fontSize: '16px', mr: 1, color: '#ef4444' }} />
                    Remove Zone
                </MenuItem>
            </Menu>

            {/* Zone Deletion Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setZoneToDelete(null);
                }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Confirm Zone Removal
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                            This action will remove the zone and all its associated cities from both pickup and delivery locations.
                        </Typography>
                    </Alert>

                    {zoneToDelete && (
                        <Box>
                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 1 }}>
                                <strong>Zone:</strong> {zoneToDelete.data.zoneName || zoneToDelete.data.name}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 1 }}>
                                <strong>Type:</strong> {zoneToDelete.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#ef4444' }}>
                                <strong>Cities to be removed:</strong> {zoneToDelete.data.cityCount || 'Unknown count'}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setDeleteConfirmOpen(false);
                            setZoneToDelete(null);
                        }}
                        size="small"
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmedZoneDeletion}
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<DeleteIcon />}
                    >
                        Remove Zone
                    </Button>
                </DialogActions>
            </Dialog>

        </Dialog>
    );
};

export default QuickShipZoneRateManagement;
