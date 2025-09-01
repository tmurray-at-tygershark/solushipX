import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Dialog,
    DialogContent,
    TextField,
    InputAdornment,
    IconButton
} from '@mui/material';
import {
    Business as BusinessIcon,
    ViewList as ViewListIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    FlashOn as FlashOnIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { ShipmentFormProvider } from '../../../contexts/ShipmentFormContext';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import AdminBreadcrumb from '../AdminBreadcrumb';
import { semanticSearch } from '../../../utils/semanticSearch';
import EnhancedStatusChip from '../../StatusChip/EnhancedStatusChip';

// Import the reusable components
import ShipmentsX from '../../Shipments/ShipmentsX';
import CreateShipmentX from '../../CreateShipment/CreateShipmentX';
import QuickShip from '../../CreateShipment/QuickShip';

const GlobalShipmentList = () => {
    const { currentUser: user, userRole, loading: authLoading } = useAuth();
    const { companyIdForAddress, setCompanyContext, loading: companyLoading } = useCompany();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Debug logging
    console.log('[GlobalShipmentList] Debug info:', {
        user: user?.uid,
        userRole,
        authLoading,
        companyLoading
    });

    // Reset key that forces complete re-mount of ShipmentsX when navigation occurs
    const [resetKey, setResetKey] = useState(0);

    // State for company selection
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('all'); // Default to 'all' for super admins and admins
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [selectedCompanyData, setSelectedCompanyData] = useState(null);
    const [viewMode, setViewMode] = useState('all'); // 'all' or 'single'

    // State for search
    const [searchValue, setSearchValue] = useState('');
    const [searchTimer, setSearchTimer] = useState(null);

    // NEW: Live search results and autocomplete
    const [liveResults, setLiveResults] = useState([]);
    const [showLiveResults, setShowLiveResults] = useState(false);
    const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
    const [allShipments, setAllShipments] = useState([]); // Cache all shipments for search

    // 🧠 SEMANTIC SEARCH STATE
    const [semanticSearchResults, setSemanticSearchResults] = useState(null);
    const [isSemanticMode, setIsSemanticMode] = useState(false);
    const [searchConfidence, setSearchConfidence] = useState(0);

    // State for create shipment modals
    const [createShipmentOpen, setCreateShipmentOpen] = useState(false);
    const [quickShipOpen, setQuickShipOpen] = useState(false);
    const [draftIdToEdit, setDraftIdToEdit] = useState(null);
    const [quickShipDraftId, setQuickShipDraftId] = useState(null);
    const [prePopulatedData, setPrePopulatedData] = useState(null);

    // State for deep link params to pass to ShipmentsX
    const [shipmentsDeepLinkParams, setShipmentsDeepLinkParams] = useState(null);
    const [isNavigating, setIsNavigating] = useState(false);

    // State for refresh trigger
    const [refreshKey, setRefreshKey] = useState(0);

    // State for navigation tracking
    const [currentShipmentDetail, setCurrentShipmentDetail] = useState(null);

    // Function to handle breadcrumb navigation back to shipments list
    const handleBreadcrumbBack = useCallback(() => {
        // This will close the shipment detail modal and return to the shipments list
        setCurrentShipmentDetail(null);
        // Force a reset of the ShipmentsX navigation stack
        setResetKey(prev => prev + 1);
    }, []);

    // State for view mode restoration
    const [originalViewMode, setOriginalViewMode] = useState(null);
    const [originalCompanyData, setOriginalCompanyData] = useState(null);

    // Helper to reload shipments
    const reloadShipments = useCallback(() => {
        setRefreshKey(prev => prev + 1);
    }, []);

    // Helper function to get shipment date
    const getShipmentDate = (shipment) => {
        const dateFields = [
            shipment.createdAt,
            shipment.bookedAt,
            shipment.shipmentDate,
            shipment.scheduledDate,
            shipment.shipmentInfo?.deliveredAt,
            shipment.deliveredAt
        ];

        for (const field of dateFields) {
            if (field) {
                try {
                    let date;
                    if (field && typeof field.toDate === 'function') {
                        date = field.toDate();
                    } else if (field && field.seconds) {
                        date = new Date(field.seconds * 1000);
                    } else if (field) {
                        date = new Date(field);
                    }

                    if (date && !isNaN(date.getTime())) {
                        return date;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        return null;
    };

    // NEW: GENERATE LIVE SHIPMENT RESULTS for admin autocomplete
    const generateLiveShipmentResults = useCallback((searchTerm, shipments) => {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        const normalizedTerm = searchTerm.toLowerCase();
        const results = [];

        // Helper function to check if shipment matches search
        const shipmentMatches = (shipment) => {
            const searchableFields = [
                // 🆔 Core Identifiers
                shipment.shipmentID,
                shipment.id,
                shipment.referenceNumber,
                shipment.shipperReferenceNumber,
                shipment.shipmentInfo?.shipperReferenceNumber,
                shipment.shipmentInfo?.referenceNumber,
                shipment.trackingNumber,
                shipment.carrierTrackingNumber,
                shipment.shipmentInfo?.carrierTrackingNumber,
                shipment.carrierBookingConfirmation?.proNumber,
                shipment.proNumber,
                shipment.bolNumber,
                shipment.shipmentInfo?.bolNumber,
                shipment.companyID,
                shipment.shipTo?.customerID,

                // 🏢 Company & Customer Information
                shipment.companyName,
                shipment.customerName,
                shipment.shipFrom?.companyName,
                shipment.shipFrom?.company,
                shipment.shipTo?.companyName,
                shipment.shipTo?.company,
                shipment.shipTo?.firstName,
                shipment.shipTo?.lastName,
                shipment.shipFrom?.firstName,
                shipment.shipFrom?.lastName,
                shipment.shipTo?.contactPerson,
                shipment.shipFrom?.contactPerson,

                // 📍 COMPREHENSIVE ADDRESS SEARCH
                // Ship From Address
                shipment.shipFrom?.street,
                shipment.shipFrom?.addressLine1,
                shipment.shipFrom?.addressLine2,
                shipment.shipFrom?.city,
                shipment.shipFrom?.state,
                shipment.shipFrom?.province,
                shipment.shipFrom?.postalCode,
                shipment.shipFrom?.zipCode,
                shipment.shipFrom?.country,
                shipment.shipFrom?.phone,
                shipment.shipFrom?.email,

                // Ship To Address
                shipment.shipTo?.street,
                shipment.shipTo?.addressLine1,
                shipment.shipTo?.addressLine2,
                shipment.shipTo?.city,
                shipment.shipTo?.state,
                shipment.shipTo?.province,
                shipment.shipTo?.postalCode,
                shipment.shipTo?.zipCode,
                shipment.shipTo?.country,
                shipment.shipTo?.phone,
                shipment.shipTo?.email,

                // 📅 ETA & DELIVERY DATES
                shipment.eta1,
                shipment.eta2,
                shipment.estimatedDelivery,
                shipment.scheduledDelivery,
                shipment.deliveryDate,
                shipment.carrierBookingConfirmation?.estimatedDeliveryDate,
                shipment.selectedRate?.transit?.estimatedDelivery,
                shipment.selectedRate?.estimatedDeliveryDate,
                shipment.pickupDate,
                shipment.scheduledPickup,

                // 🚛 COMPREHENSIVE CARRIER INFO
                shipment.carrier,
                shipment.selectedCarrier,
                shipment.carrierName,
                shipment.selectedRate?.carrier,
                shipment.selectedRate?.carrierName,
                shipment.selectedRate?.service?.name,
                shipment.selectedRate?.serviceName,
                shipment.selectedRate?.serviceType,
                shipment.carrierService,
                shipment.serviceLevel,

                // 📦 Package & Commodity Details
                shipment.packages?.map(pkg => pkg.description).join(' '),
                shipment.packages?.map(pkg => pkg.commodity).join(' '),
                shipment.commodityDescription,
                shipment.goodsDescription,
                shipment.packages?.map(pkg => `${pkg.weight} ${pkg.weightUnit || 'lbs'}`).join(' '),

                // 📝 Notes & Special Instructions
                shipment.specialInstructions,
                shipment.deliveryInstructions,
                shipment.notes,
                shipment.customerNotes,
                shipment.internalNotes,
                shipment.pickupInstructions,

                // 💰 Billing Information
                shipment.billTo?.companyName,
                shipment.billTo?.company,
                shipment.paymentTerms,
                shipment.billType,
                shipment.billTo?.contactPerson,

                // 🔢 Additional Reference Numbers
                shipment.customerReferenceNumber,
                shipment.purchaseOrderNumber,
                shipment.invoiceNumber,
                shipment.jobNumber,
                shipment.projectNumber,

                // 📊 Weight & Dimensions
                shipment.totalWeight,
                shipment.totalPieces,

                // 📞 Contact Information
                shipment.billTo?.phone,
                shipment.billTo?.email,

                // 📈 Status Information
                shipment.status,
                shipment.shipmentStatus,
                shipment.currentStatus
            ];

            return searchableFields.some(field =>
                field && String(field).toLowerCase().includes(normalizedTerm)
            );
        };

        // Extract live shipment results (limit to first 200 for performance)
        shipments.slice(0, 200).forEach(shipment => {
            if (shipmentMatches(shipment)) {
                // Get shipment date
                const getShipmentDate = (s) => {
                    const dateFields = [s.createdAt, s.bookedAt, s.shipmentDate, s.scheduledDate];
                    for (const field of dateFields) {
                        if (field) {
                            try {
                                let date;
                                if (field.toDate) date = field.toDate();
                                else if (field.seconds) date = new Date(field.seconds * 1000);
                                else date = new Date(field);
                                if (!isNaN(date.getTime())) return date.toLocaleDateString();
                            } catch (e) { continue; }
                        }
                    }
                    return 'N/A';
                };

                // Build route info
                const routeInfo = `${shipment.shipFrom?.city || 'N/A'} → ${shipment.shipTo?.city || 'N/A'}`;

                // Get status with proper formatting
                const getStatusDisplay = (status) => {
                    if (!status) return 'Unknown';
                    return status.replace('_', ' ').split(' ').map(word =>
                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                    ).join(' ');
                };

                const result = {
                    type: 'live_shipment',
                    shipmentId: shipment.shipmentID || shipment.id,
                    documentId: shipment.id, // For navigation
                    shipment: shipment, // Full shipment data
                    route: routeInfo,
                    status: getStatusDisplay(shipment.status),
                    date: (() => {
                        const date = getShipmentDate(shipment);
                        if (date && typeof date.toLocaleDateString === 'function') {
                            return date.toLocaleDateString();
                        }
                        return 'N/A';
                    })(),
                    referenceNumber: shipment.referenceNumber || shipment.shipperReferenceNumber || 'N/A',
                    trackingNumber: shipment.trackingNumber || shipment.carrierBookingConfirmation?.proNumber || 'N/A',
                    carrier: shipment.carrier || 'N/A',
                    companyName: shipment.shipFrom?.companyName || shipment.shipTo?.companyName || 'N/A',
                    score: String(shipment.shipmentID || shipment.id).toLowerCase().startsWith(normalizedTerm) ? 10 : 5
                };
                results.push(result);
            }
        });

        // Add quick action suggestions if no live results
        if (results.length === 0) {
            const quickSuggestions = [];

            // Status suggestions
            const statusSuggestions = [
                'pending', 'in_transit', 'delivered', 'delayed', 'cancelled', 'out_for_delivery'
            ];

            statusSuggestions.forEach(status => {
                if (status.includes(normalizedTerm)) {
                    quickSuggestions.push({
                        type: 'status_filter',
                        value: status,
                        label: `Show all ${status.replace('_', ' ')} shipments`,
                        score: 5
                    });
                }
            });

            // Date suggestions
            const dateSuggestions = [
                { key: 'today', label: 'Show today\'s shipments' },
                { key: 'yesterday', label: 'Show yesterday\'s shipments' },
                { key: 'last week', label: 'Show last week\'s shipments' },
                { key: 'this month', label: 'Show this month\'s shipments' }
            ];

            dateSuggestions.forEach(({ key, label }) => {
                if (key.includes(normalizedTerm)) {
                    quickSuggestions.push({
                        type: 'date_filter',
                        value: key,
                        label: label,
                        score: 3
                    });
                }
            });

            return quickSuggestions.slice(0, 5);
        }

        // Sort results by relevance and limit to 6 live shipments
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);
    }, []);

    // Reset component state when navigating to /admin/shipments (e.g., clicking nav link)
    // Note: Removed problematic useEffect that was clearing deep link params on every navigation

    // Load available companies based on user role
    useEffect(() => {
        const loadCompanies = async () => {
            if (authLoading || !user) return;

            setLoadingCompanies(true);
            try {
                let companiesQuery;
                let connectedCompanyIds = [];

                if (userRole === 'superadmin') {
                    // Super admins can see all companies
                    companiesQuery = query(
                        collection(db, 'companies')
                    );
                } else if (userRole === 'admin') {
                    // Admins can see companies they're connected to
                    // Use the user object directly instead of querying again
                    connectedCompanyIds = user.connectedCompanies || [];

                    if (connectedCompanyIds.length > 0) {
                        // Firestore 'in' query supports max 10 items, so batch if needed
                        if (connectedCompanyIds.length <= 10) {
                            companiesQuery = query(
                                collection(db, 'companies'),
                                where('companyID', 'in', connectedCompanyIds)
                            );
                        } else {
                            // For more than 10 companies, load all and filter client-side
                            companiesQuery = query(collection(db, 'companies'));
                        }
                    } else {
                        // Admin has no connected companies
                        setAvailableCompanies([]);
                        return;
                    }
                } else {
                    // Regular users shouldn't access this page
                    setAvailableCompanies([]);
                    return;
                }

                const companiesSnapshot = await getDocs(companiesQuery);
                let companies = companiesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // If admin with >10 connected companies, filter client-side
                if (userRole === 'admin' && connectedCompanyIds.length > 10) {
                    companies = companies.filter(company =>
                        connectedCompanyIds.includes(company.companyID)
                    );
                }

                // Sort companies by name after fetching
                companies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                console.log('Loaded companies for', userRole, ':', companies.length, 'companies');

                setAvailableCompanies(companies);

                // For super admins and admins, default to "All Companies" view
                if (userRole === 'superadmin' || userRole === 'admin') {
                    setSelectedCompanyId('all');
                    setViewMode('all');

                    // Create a special "all companies" context - but DON'T set it as company context
                    const allCompaniesContext = {
                        companyID: 'all',
                        name: 'All Companies',
                        isAdminView: true,
                        companyIds: userRole === 'superadmin' ? 'all' : connectedCompanyIds
                    };
                    setSelectedCompanyData(allCompaniesContext);
                    // CRITICAL: Never set company context to "ALL" - it's not a real company!
                    // The "all" view should not have a company context at all
                }
            } catch (error) {
                console.error('Error loading companies - Full error:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                setAvailableCompanies([]);
            } finally {
                setLoadingCompanies(false);
            }
        };

        loadCompanies();
    }, [user, userRole, authLoading]);

    // Load all shipments for autocomplete search
    useEffect(() => {
        const loadShipmentsForSearch = async () => {
            if (!user || authLoading || loadingCompanies) return;

            try {
                let shipmentsQuery;

                if (userRole === 'superadmin') {
                    // Super admin can see all shipments
                    shipmentsQuery = query(
                        collection(db, 'shipments'),
                        orderBy('createdAt', 'desc'),
                        limit(500) // Limit for performance
                    );
                } else if (userRole === 'admin') {
                    // Admin can see their connected companies
                    const connectedCompanyIds = availableCompanies.map(c => c.companyID);
                    if (connectedCompanyIds.length > 0) {
                        shipmentsQuery = query(
                            collection(db, 'shipments'),
                            where('companyID', 'in', connectedCompanyIds.slice(0, 10)),
                            orderBy('createdAt', 'desc'),
                            limit(500)
                        );
                    } else {
                        setAllShipments([]);
                        return;
                    }
                } else {
                    setAllShipments([]);
                    return;
                }

                const snapshot = await getDocs(shipmentsQuery);
                const shipments = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('📦 Loaded shipments for autocomplete:', shipments.length);
                setAllShipments(shipments);

            } catch (error) {
                console.error('Error loading shipments for search:', error);
                setAllShipments([]);
            }
        };

        loadShipmentsForSearch();
    }, [user, userRole, authLoading, loadingCompanies, availableCompanies]);

    // Handle company selection change
    const handleCompanyChange = useCallback((event) => {
        const companyId = event.target.value;
        console.log('[GlobalShipmentList] Company changed to:', companyId);
        setSelectedCompanyId(companyId);

        if (companyId === 'all') {
            // Set to "All Companies" mode
            setViewMode('all');

            // Get connected company IDs for admins
            const connectedIds = userRole === 'admin'
                ? availableCompanies.map(c => c.companyID)
                : 'all';

            const allCompaniesContext = {
                companyID: 'all',
                name: 'All Companies',
                isAdminView: true,
                companyIds: connectedIds
            };
            setSelectedCompanyData(allCompaniesContext);
            // CRITICAL BUG FIX: Never set company context to "ALL" - it's not a real company!
            // The "all" view should clear the company context instead
            setCompanyContext(null);
        } else {
            // Set to single company mode
            setViewMode('single');

            // Find the selected company data
            const company = availableCompanies.find(c => c.companyID === companyId);
            console.log('[GlobalShipmentList] Found company data:', company);
            setSelectedCompanyData(company);

            // Update the company context for ShipmentsX
            if (company) {
                console.log('[GlobalShipmentList] Setting company context:', company.companyID);
                setCompanyContext(company);
            }
        }

        // Trigger refresh of ShipmentsX
        setRefreshKey(prev => prev + 1);
    }, [availableCompanies, setCompanyContext, userRole]);

    // 🧠 SEMANTIC SEARCH FUNCTION - AI-Powered Natural Language Understanding
    const performSemanticSearch = useCallback(async (query, allShipmentsData) => {
        try {
            console.log('🧠 Performing semantic search for:', query);
            setIsSemanticMode(true);

            // Use the semantic search engine
            const searchResults = await semanticSearch.search(query, allShipmentsData, {
                userRole,
                companyId: selectedCompanyId,
                context: 'admin_shipments'
            });

            console.log('🎯 Semantic search results:', {
                intent: searchResults.intent,
                entities: searchResults.entities,
                resultCount: searchResults.results.length,
                confidence: searchResults.metadata.confidence
            });

            // Update search results
            setSemanticSearchResults(searchResults);
            setSearchConfidence(searchResults.metadata.confidence);

            return searchResults.results;

        } catch (error) {
            console.error('❌ Semantic search error:', error);
            setIsSemanticMode(false);
            return allShipmentsData; // Fallback to showing all data
        }
    }, [userRole, selectedCompanyId]);

    // Handle search input change with live results
    const handleSearchChange = useCallback((event) => {
        const value = event.target.value; // Keep spaces during typing
        setSearchValue(value);

        const trimmedValue = value.trim(); // Only trim for search logic

        // 🧠 SEMANTIC SEARCH ENHANCEMENT - Layer AI on top of existing search
        const isNaturalLanguage = (query) => {
            const naturalPatterns = [
                /show me.*shipment/i,
                /find.*from/i,
                /all.*delivered/i,
                /delivered.*today/i,
                /delivered.*yesterday/i,
                /delayed.*shipment/i,
                /shipment.*to/i,
                /tracking.*number/i,
                /(today|yesterday|last week|this month)/i,
                /carrier.*fedex|ups|dhl|canpar/i,
                /(heavy|large|small).*package/i,
                /status.*(pending|delivered|delayed)/i,
                /reference.*number/i,
                /(ontario|quebec|california|texas)/i,
                /(toronto|montreal|vancouver|new york)/i,
                /\b(lbs|kg|pounds|kilograms)\b/i,
                /\b(urgent|priority|express|ground)\b/i
            ];
            return naturalPatterns.some(pattern => pattern.test(query));
        };

        // ALWAYS generate live shipment results (existing powerful search)
        if (trimmedValue.length >= 2) {
            const results = generateLiveShipmentResults(trimmedValue, allShipments);
            setLiveResults(results);
            setShowLiveResults(results.length > 0);

            // 🧠 ENHANCED SEMANTIC LAYER - Add AI intelligence for natural language
            if (trimmedValue.length >= 5 && isNaturalLanguage(trimmedValue)) {
                console.log('🧠 Natural language detected, triggering semantic search');
                // Trigger semantic search which will be used in the main filtering
                performSemanticSearch(trimmedValue, allShipments).then(semanticResults => {
                    if (semanticResults && semanticResults.length > 0) {
                        // Create live results from semantic search results
                        const semanticLiveResults = semanticResults.slice(0, 6).map(shipment => ({
                            type: 'live_shipment',
                            shipmentId: shipment.shipmentID || shipment.id,
                            documentId: shipment.id,
                            shipment: shipment,
                            route: `${shipment.shipFrom?.city || 'N/A'} → ${shipment.shipTo?.city || 'N/A'}`,
                            status: shipment.status ? shipment.status.replace('_', ' ').split(' ').map(word =>
                                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                            ).join(' ') : 'Unknown',
                            date: (() => {
                                const date = getShipmentDate(shipment);
                                if (date && typeof date.toLocaleDateString === 'function') {
                                    return date.toLocaleDateString();
                                }
                                return 'N/A';
                            })(),
                            trackingNumber: shipment.trackingNumber || shipment.carrierBookingConfirmation?.proNumber || 'N/A',
                            carrier: shipment.carrier || 'N/A',
                            companyName: shipment.shipFrom?.companyName || shipment.shipTo?.companyName || 'N/A',
                            score: 10 // High priority for semantic results
                        }));

                        // Use semantic results directly
                        setLiveResults(semanticLiveResults);
                        setShowLiveResults(semanticLiveResults.length > 0);
                        console.log('✨ Enhanced live results with semantic shipments:', semanticLiveResults.length);
                    } else {
                        // No semantic results, show basic results
                        setLiveResults(results);
                        setShowLiveResults(results.length > 0);
                    }
                });
            } else {
                // Reset semantic mode for non-natural queries
                setIsSemanticMode(false);
                setSemanticSearchResults(null);
            }
        } else {
            // Clear all search results
            setLiveResults([]);
            setShowLiveResults(false);
            setIsSemanticMode(false);
            setSemanticSearchResults(null);
        }
        setSelectedResultIndex(-1);

        // Clear search params if value is empty
        if (!trimmedValue) {
            setShipmentsDeepLinkParams(null);
        }
    }, [generateLiveShipmentResults, allShipments, performSemanticSearch, reloadShipments]);

    // Handle search key events (Enter, Arrow keys, Escape)
    const handleSearchKeyPress = useCallback(async (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelectedResultIndex(prev =>
                prev < liveResults.length - 1 ? prev + 1 : prev
            );
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1);
        } else if (event.key === 'Escape') {
            setShowLiveResults(false);
            setSelectedResultIndex(-1);
        } else if (event.key === 'Enter') {
            event.preventDefault();

            // Handle autocomplete selection
            if (selectedResultIndex >= 0 && liveResults[selectedResultIndex]) {
                const selectedResult = liveResults[selectedResultIndex];

                if (selectedResult.type === 'live_shipment') {
                    // Navigate directly to shipment detail
                    console.log('🎯 Admin: Navigating to shipment:', selectedResult.shipmentId);

                    // 🚀 APPLY SAME COMPANY CONTEXT SWITCHING LOGIC AS SHIPMENT TABLE ROW
                    const shipmentCompany = availableCompanies.find(c => c.companyID === selectedResult.shipment.companyID);
                    if (shipmentCompany && selectedResult.shipment.companyID !== selectedCompanyId) {
                        try {
                            // 💾 STORE ORIGINAL VIEW MODE before switching
                            if (!originalViewMode) {
                                console.log('💾 Storing original view mode for restoration:', viewMode);
                                setOriginalViewMode(viewMode);
                                setOriginalCompanyData(selectedCompanyData);
                            }

                            setSelectedCompanyId(selectedResult.shipment.companyID);
                            setSelectedCompanyData(shipmentCompany);

                            // Only set company context if it's a real company (not "ALL")
                            if (shipmentCompany.companyID !== 'all') {
                                console.log('🔄 Setting company context and waiting for update...');
                                await setCompanyContext(shipmentCompany);

                                // Small delay to ensure context is fully updated before proceeding
                                await new Promise(resolve => setTimeout(resolve, 200));
                                console.log('✅ Company context switched successfully');
                            }
                            setViewMode('single');
                        } catch (error) {
                            console.error('❌ Error switching company context:', error);
                            console.warn('Proceeding with current context due to error');
                        }
                    }

                    // FORCE CLEAR EXISTING DEEP LINK PARAMS FIRST
                    console.log('🔄 Enter autocomplete: Clearing existing deep link params before new navigation');
                    setShipmentsDeepLinkParams(null);

                    // Small delay to ensure clearing is processed, then set new params
                    setTimeout(() => {
                        // Navigate directly to shipment detail
                        setShipmentsDeepLinkParams({
                            directToDetail: true,
                            selectedShipmentId: selectedResult.documentId,
                            // Add timestamp to ensure uniqueness
                            timestamp: Date.now()
                        });
                    }, 50); // Small delay to ensure null is processed first

                    setShowLiveResults(false);
                    setSelectedResultIndex(-1);
                    setSearchValue('');
                    return;
                } else if (selectedResult.type === 'status_filter' || selectedResult.type === 'date_filter') {
                    // Apply filter
                    setSearchValue(selectedResult.value);
                    setShipmentsDeepLinkParams({
                        unifiedSearch: selectedResult.value,  // Use unifiedSearch for comprehensive filtering
                        forceTableView: true
                    });
                    setShowLiveResults(false);
                    setSelectedResultIndex(-1);
                    return;
                }
            }

            // Default Enter behavior - existing search logic
            // Always hide autocomplete when Enter is pressed
            setShowLiveResults(false);
            setSelectedResultIndex(-1);

            const value = searchValue.trim();
            if (!value) {
                setShipmentsDeepLinkParams(null);
                return;
            }

            console.log('🔍 GlobalShipmentList: Enter pressed with search value:', value);

            // Check if this looks like a shipment ID and try to find exact match
            const isShipmentIdPattern = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/i.test(value) || // Pattern like IC-CUSTOMER-123
                /^[A-Z0-9]{8,}$/i.test(value); // Pattern like alphanumeric IDs

            if (isShipmentIdPattern) {
                try {
                    // Try to find exact shipment ID match across all companies
                    let shipmentsQuery;

                    if (userRole === 'superadmin') {
                        // Super admin can search all shipments
                        shipmentsQuery = query(
                            collection(db, 'shipments'),
                            where('shipmentID', '==', value),
                            limit(1)
                        );
                    } else {
                        // Admin can only search their connected companies
                        const connectedCompanyIds = selectedCompanyData?.companyIds || availableCompanies.map(c => c.companyID);
                        if (connectedCompanyIds.length > 0 && connectedCompanyIds !== 'all') {
                            shipmentsQuery = query(
                                collection(db, 'shipments'),
                                where('shipmentID', '==', value),
                                where('companyID', 'in', connectedCompanyIds.slice(0, 10)), // Firestore limit
                                limit(1)
                            );
                        } else {
                            shipmentsQuery = query(
                                collection(db, 'shipments'),
                                where('shipmentID', '==', value),
                                limit(1)
                            );
                        }
                    }

                    const snapshot = await getDocs(shipmentsQuery);

                    if (!snapshot.empty) {
                        // Found exact match - navigate directly to shipment detail
                        const shipmentDoc = snapshot.docs[0];
                        const shipmentData = shipmentDoc.data();

                        // Skip archived shipments
                        if (shipmentData.status?.toLowerCase()?.trim() === 'archived') {
                            console.log('🚫 Found shipment is archived, skipping');
                            return;
                        }

                        console.log('🎯 Found exact shipment ID match, navigating directly to detail:', value);

                        // 🚀 APPLY SAME COMPANY CONTEXT SWITCHING LOGIC AS SHIPMENT TABLE ROW
                        if (shipmentData.companyID && shipmentData.companyID !== selectedCompanyId) {
                            const shipmentCompany = availableCompanies.find(c => c.companyID === shipmentData.companyID);
                            if (shipmentCompany) {
                                try {
                                    // 💾 STORE ORIGINAL VIEW MODE before switching
                                    if (!originalViewMode) {
                                        console.log('💾 Storing original view mode for restoration:', viewMode);
                                        setOriginalViewMode(viewMode);
                                        setOriginalCompanyData(selectedCompanyData);
                                    }

                                    setSelectedCompanyId(shipmentData.companyID);
                                    setSelectedCompanyData(shipmentCompany);

                                    // Only set company context if it's a real company (not "ALL")
                                    if (shipmentCompany.companyID !== 'all') {
                                        console.log('🔄 Setting company context and waiting for update...');
                                        await setCompanyContext(shipmentCompany);

                                        // Small delay to ensure context is fully updated before proceeding
                                        await new Promise(resolve => setTimeout(resolve, 200));
                                        console.log('✅ Company context switched successfully');
                                    }
                                    setViewMode('single');
                                } catch (error) {
                                    console.error('❌ Error switching company context:', error);
                                    console.warn('Proceeding with current context due to error');
                                }
                            }
                        }

                        // FORCE CLEAR EXISTING DEEP LINK PARAMS FIRST
                        console.log('🔄 Enter key: Clearing existing deep link params before new navigation');
                        setShipmentsDeepLinkParams(null);

                        // Small delay to ensure clearing is processed, then set new params
                        setTimeout(() => {
                            // Navigate directly to shipment detail
                            setShipmentsDeepLinkParams({
                                directToDetail: true,
                                selectedShipmentId: shipmentDoc.id,
                                // Add timestamp to ensure uniqueness
                                timestamp: Date.now()
                            });

                            // Clear search value after navigation
                            setSearchValue('');
                        }, 50); // Small delay to ensure null is processed first
                        return;
                    }
                } catch (error) {
                    console.error('Error searching for exact shipment ID:', error);
                }
            }

            // No exact match found or not a shipment ID pattern - do regular search
            console.log('🔍 GlobalShipmentList: Setting unified search for comprehensive filtering');
            setShipmentsDeepLinkParams({
                unifiedSearch: value,  // This is the key parameter that triggers comprehensive search filtering in ShipmentsX
                forceTableView: true
            });
        }
    }, [searchValue, userRole, selectedCompanyData, availableCompanies, selectedCompanyId, setCompanyContext, selectedResultIndex, liveResults]);

    // Handle search clear
    const handleSearchClear = useCallback(() => {
        setSearchValue('');
        setShipmentsDeepLinkParams(null);
        setLiveResults([]);
        setShowLiveResults(false);
        setSelectedResultIndex(-1);
        if (searchTimer) {
            clearTimeout(searchTimer);
        }
    }, [searchTimer]);

    // Handle opening create shipment modal
    const handleOpenCreateShipment = useCallback((prePopData = null, draftId = null, quickshipDraftId = null, mode = 'advanced') => {
        if (mode === 'quickship' || quickshipDraftId) {
            setQuickShipDraftId(quickshipDraftId);
            setQuickShipOpen(true);
            setCreateShipmentOpen(false);
        } else {
            setPrePopulatedData(prePopData);
            setDraftIdToEdit(draftId);
            setCreateShipmentOpen(true);
            setQuickShipOpen(false);
        }
    }, []);

    // Handle viewing shipment from create shipment flow
    const handleViewShipment = useCallback((shipmentId) => {
        console.log('🎯 GlobalShipmentList: handleViewShipment called with shipmentId:', shipmentId);

        // Close any open modals
        setCreateShipmentOpen(false);
        setQuickShipOpen(false);

        // REFRESH SHIPMENTS LIST FIRST to ensure newly created shipment is loaded
        console.log('🔄 Refreshing shipments list to include newly created shipment');
        setRefreshKey(prev => prev + 1);

        // Set deep link params to open the shipment detail (with a small delay to allow refresh)
        setTimeout(() => {
            console.log('🎯 Setting deep link params for direct to detail');
            setShipmentsDeepLinkParams({
                directToDetail: true,
                selectedShipmentId: shipmentId
            });
            console.log('🎯 Deep link params set, letting ShipmentsX handle the clearing');
        }, 100); // Small delay to ensure refresh is processed first

    }, []);

    // Handle return to shipments from create shipment
    const handleReturnToShipments = useCallback(() => {
        setCreateShipmentOpen(false);
        setQuickShipOpen(false);
        setPrePopulatedData(null);
        setDraftIdToEdit(null);
        setQuickShipDraftId(null);

        // Trigger refresh
        setRefreshKey(prev => prev + 1);
    }, []);

    // Handle URL action parameters (quickship, rates)
    useEffect(() => {
        const action = searchParams.get('action');

        if (action && !authLoading && !companyLoading) {
            console.log('🎯 GlobalShipmentList: Action parameter detected:', action);

            // Clear the action parameter from URL to prevent re-triggering
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('action');
            setSearchParams(newSearchParams, { replace: true });

            // Open the appropriate modal
            if (action === 'quickship') {
                console.log('🚀 Opening QuickShip modal from URL parameter');
                setQuickShipOpen(true);
            } else if (action === 'rates') {
                console.log('📊 Opening Real Time Rates (CreateShipmentX) modal from URL parameter');
                setCreateShipmentOpen(true);
            }
        }
    }, [searchParams, setSearchParams, authLoading, companyLoading]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (searchTimer) {
                clearTimeout(searchTimer);
            }
        };
    }, [searchTimer]);

    // Loading state
    if (authLoading || companyLoading || loadingCompanies) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // No companies available
    if (availableCompanies.length === 0 && userRole === 'admin') {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning" sx={{ fontSize: '12px' }}>
                    No companies available. You need to be connected to at least one company.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            // Override the max-width constraint from AdminLayout.css for full width
            maxWidth: '100% !important',
            width: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title Row */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                        Shipments Management
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                        {viewMode === 'all'
                            ? `Viewing shipments from ${userRole === 'superadmin' ? 'all companies' : 'all connected companies'}`
                            : 'View and manage shipments across companies'}
                    </Typography>
                </Box>

                {/* Breadcrumb and Filter Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                    {/* Breadcrumb */}
                    <AdminBreadcrumb
                        currentPage="Shipments"
                        detailContext={currentShipmentDetail ? "Shipment Detail" : null}
                        onNavigateBack={currentShipmentDetail ? handleBreadcrumbBack : null}
                    />

                    {/* Right side controls */}
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1 }}>
                        {/* Enterprise Search Box with Live Results */}
                        <Box sx={{ position: 'relative', flex: 1 }}>
                            <TextField
                                size="small"
                                placeholder="Search"
                                value={searchValue}
                                onChange={handleSearchChange}
                                onKeyDown={handleSearchKeyPress}
                                onBlur={() => {
                                    // Hide results after a delay to allow clicking on them
                                    setTimeout(() => setShowLiveResults(false), 200);
                                }}
                                onFocus={() => {
                                    if (searchValue.length >= 2 && liveResults.length > 0) {
                                        setShowLiveResults(true);
                                    }
                                }}
                                sx={{
                                    width: '100%',
                                    '& .MuiInputBase-root': {
                                        fontSize: '14px',
                                        borderRadius: '8px',
                                        backgroundColor: '#f8fafc',
                                        '&:hover': {
                                            backgroundColor: '#f1f5f9'
                                        },
                                        '&.Mui-focused': {
                                            backgroundColor: '#ffffff',
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#3b82f6',
                                                borderWidth: '2px'
                                            }
                                        }
                                    },
                                    '& .MuiInputBase-input': {
                                        fontSize: '14px',
                                        py: '10px'
                                    },
                                    '& .MuiOutlinedInput-notchedOutline': {
                                        borderColor: '#d1d5db'
                                    }
                                }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ fontSize: '20px', color: '#6b7280' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: searchValue && (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={handleSearchClear}
                                                edge="end"
                                                sx={{
                                                    p: 0.5,
                                                    color: '#6b7280',
                                                    '&:hover': {
                                                        color: '#374151',
                                                        backgroundColor: '#f3f4f6'
                                                    }
                                                }}
                                            >
                                                <ClearIcon sx={{ fontSize: '18px' }} />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />







                            {/* NEW: Live Shipment Results Dropdown */}
                            {showLiveResults && liveResults.length > 0 && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    zIndex: 1300,
                                    bgcolor: 'white',
                                    border: '1px solid #e0e0e0',
                                    borderTop: 'none',
                                    borderRadius: '0 0 8px 8px',
                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                                    maxHeight: '280px',
                                    overflow: 'auto',
                                    mt: searchValue && isSemanticMode ? 3 : 0.5 // Leave space for chip
                                }}>
                                    {/* Compact Header */}
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        px: 2,
                                        py: 1,
                                        borderBottom: '1px solid #f0f0f0',
                                        bgcolor: '#fafafa'
                                    }}>
                                        <Typography sx={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: '#6b7280'
                                        }}>
                                            {liveResults.length} result{liveResults.length !== 1 ? 's' : ''}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                setShowLiveResults(false);
                                                setSelectedResultIndex(-1);
                                            }}
                                            sx={{
                                                p: 0.25,
                                                color: '#9ca3af',
                                                '&:hover': {
                                                    color: '#374151',
                                                    bgcolor: '#f3f4f6'
                                                }
                                            }}
                                        >
                                            <CloseIcon sx={{ fontSize: '14px' }} />
                                        </IconButton>
                                    </Box>
                                    {/* Compact Results Grid */}
                                    <Box sx={{ p: 1 }}>
                                        {liveResults.map((result, index) => (
                                            <Box
                                                key={result.type === 'live_shipment' ? result.documentId : `${result.type}-${result.value}`}
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: '1fr',
                                                    gap: '8px',
                                                    alignItems: 'flex-start',
                                                    padding: '6px 8px',
                                                    marginBottom: index < liveResults.length - 1 ? '2px' : '0',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    backgroundColor: index === selectedResultIndex ? '#f0f4ff' : 'transparent',
                                                    border: index === selectedResultIndex ? '1px solid #d1d5db' : '1px solid transparent',
                                                    '&:hover': {
                                                        backgroundColor: '#f8faff',
                                                        border: '1px solid #e5e7eb'
                                                    },
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onClick={async () => {
                                                    console.log('🎯 Admin search result clicked:', result);

                                                    if (result.type === 'live_shipment') {
                                                        console.log('🎯 Admin: Navigating to shipment:', result.shipmentId);

                                                        // 🚀 APPLY SAME COMPANY CONTEXT SWITCHING LOGIC AS SHIPMENT TABLE ROW
                                                        const shipmentCompany = availableCompanies.find(c => c.companyID === result.shipment.companyID);
                                                        if (shipmentCompany && result.shipment.companyID !== selectedCompanyId) {
                                                            console.log('🎯 Admin: Switching company context to:', shipmentCompany.name);

                                                            try {
                                                                // 💾 STORE ORIGINAL VIEW MODE before switching
                                                                if (!originalViewMode) {
                                                                    console.log('💾 Storing original view mode for restoration:', viewMode);
                                                                    setOriginalViewMode(viewMode);
                                                                    setOriginalCompanyData(selectedCompanyData);
                                                                }

                                                                setSelectedCompanyId(result.shipment.companyID);
                                                                setSelectedCompanyData(shipmentCompany);

                                                                // Only set company context if it's a real company (not "ALL")
                                                                if (shipmentCompany.companyID !== 'all') {
                                                                    console.log('🔄 Setting company context and waiting for update...');
                                                                    await setCompanyContext(shipmentCompany);

                                                                    // Small delay to ensure context is fully updated before proceeding
                                                                    await new Promise(resolve => setTimeout(resolve, 200));
                                                                    console.log('✅ Company context switched successfully');
                                                                }
                                                                setViewMode('single');
                                                            } catch (error) {
                                                                console.error('❌ Error switching company context:', error);
                                                                // Don't show snackbar here since we don't have access to it
                                                                console.warn('Proceeding with current context due to error');
                                                            }
                                                        }

                                                        // 📝 CRITICAL FIX: Check if this is a draft shipment and handle appropriately
                                                        if (result.shipment?.status === 'draft') {
                                                            console.log('📝 Draft shipment detected, opening for editing:', result.documentId);

                                                            // FORCE CLEAR EXISTING DEEP LINK PARAMS FIRST
                                                            console.log('🔄 Clearing existing deep link params before draft edit');
                                                            setShipmentsDeepLinkParams(null);

                                                            // Small delay to ensure clearing is processed, then trigger edit
                                                            setTimeout(() => {
                                                                setShipmentsDeepLinkParams({
                                                                    editDraftShipment: true,
                                                                    selectedShipmentId: result.documentId,
                                                                    timestamp: Date.now()
                                                                });
                                                            }, 50);
                                                        } else {
                                                            console.log('🎯 Admin: Direct navigation - bypassing table, going straight to detail');

                                                            // FORCE CLEAR EXISTING DEEP LINK PARAMS FIRST
                                                            console.log('🔄 Clearing existing deep link params before new navigation');
                                                            setShipmentsDeepLinkParams(null);

                                                            // SET NAVIGATION STATE TO PREVENT PREMATURE CLEARING
                                                            setIsNavigating(true);

                                                            // Small delay to ensure clearing is processed, then set new params
                                                            setTimeout(() => {
                                                                // DIRECT NAVIGATION - Skip the table entirely and go straight to detail
                                                                setShipmentsDeepLinkParams({
                                                                    bypassTable: true,
                                                                    directToDetail: true,
                                                                    selectedShipmentId: result.documentId,
                                                                    // Add timestamp to ensure uniqueness
                                                                    timestamp: Date.now()
                                                                });

                                                                console.log('🎯 Admin: Set bypass table navigation for shipment:', result.documentId);
                                                                console.log('🔄 Navigation state set to prevent premature clearing');

                                                                // Clear navigation state after successful navigation
                                                                setTimeout(() => {
                                                                    setIsNavigating(false);
                                                                    console.log('✅ Navigation completed, state cleared');
                                                                }, 2000); // 2 second delay to allow navigation to complete
                                                            }, 50); // Small delay to ensure null is processed first
                                                        }
                                                    } else if (result.type === 'status_filter' || result.type === 'date_filter') {
                                                        console.log('🎯 Admin: Applying filter:', result.type, result.value);
                                                        setSearchValue(result.value);
                                                        setShipmentsDeepLinkParams({
                                                            unifiedSearch: result.value,  // Use unifiedSearch for comprehensive filtering
                                                            forceTableView: true
                                                        });
                                                    }
                                                    setShowLiveResults(false);
                                                    setSelectedResultIndex(-1);
                                                    if (result.type === 'live_shipment') {
                                                        setSearchValue('');
                                                    }
                                                }}
                                            >
                                                {result.type === 'live_shipment' ? (
                                                    <>
                                                        {/* Enhanced shipment info with FROM/TO addresses */}
                                                        <Box sx={{
                                                            gridColumn: 'span 4',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '2px',
                                                            minWidth: 0
                                                        }}>
                                                            {/* Header Row: Icon, Shipment ID, Status, Date */}
                                                            <Box sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                justifyContent: 'space-between'
                                                            }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                                                    {/* Icon */}
                                                                    <Box sx={{
                                                                        width: '20px',
                                                                        height: '20px',
                                                                        backgroundColor: '#f3f4f6',
                                                                        borderRadius: '3px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: '10px',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        📦
                                                                    </Box>

                                                                    {/* Shipment ID */}
                                                                    <Typography variant="body2" sx={{
                                                                        fontWeight: 600,
                                                                        fontSize: '12px',
                                                                        lineHeight: 1.2,
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                        flex: 1,
                                                                        minWidth: 0
                                                                    }}>
                                                                        {result.shipmentId}
                                                                    </Typography>
                                                                </Box>

                                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                                    {/* Top row: Date and Carrier Info */}
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        {/* Date - only show if not N/A */}
                                                                        {result.date && result.date !== 'N/A' && (
                                                                            <Typography variant="body2" sx={{
                                                                                fontSize: '10px',
                                                                                color: '#9ca3af',
                                                                                fontWeight: 500,
                                                                                whiteSpace: 'nowrap'
                                                                            }}>
                                                                                {result.date}
                                                                            </Typography>
                                                                        )}

                                                                        {/* Carrier Name */}
                                                                        {result.shipment?.carrier && result.shipment.carrier !== 'N/A' && (
                                                                            <Typography variant="body2" sx={{
                                                                                fontSize: '9px',
                                                                                fontWeight: 600,
                                                                                color: '#374151',
                                                                                lineHeight: 1.2,
                                                                                whiteSpace: 'nowrap',
                                                                                overflow: 'hidden',
                                                                                textOverflow: 'ellipsis',
                                                                                maxWidth: '100px'
                                                                            }}>
                                                                                {(() => {
                                                                                    const carrier = result.shipment.carrier;
                                                                                    if (typeof carrier === 'object' && carrier.name) {
                                                                                        return carrier.name;
                                                                                    }
                                                                                    return carrier;
                                                                                })()}
                                                                            </Typography>
                                                                        )}

                                                                        {/* Status - moved to last position */}
                                                                        <EnhancedStatusChip
                                                                            status={result.shipment.status}
                                                                            size="small"
                                                                            compact={true}
                                                                            displayMode="auto"
                                                                            showTooltip={false}
                                                                            sx={{
                                                                                fontSize: '9px',
                                                                                height: '18px',
                                                                                '& .MuiChip-label': {
                                                                                    fontSize: '9px',
                                                                                    fontWeight: 500,
                                                                                    textTransform: 'uppercase',
                                                                                    letterSpacing: '0.5px',
                                                                                    px: 1
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Box>

                                                                    {/* Bottom row: Tracking Number */}
                                                                    <Box sx={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'flex-end',
                                                                        minWidth: 0
                                                                    }}>
                                                                        {/* Tracking Number */}
                                                                        {(() => {
                                                                            const trackingNumber = result.shipment?.trackingNumber ||
                                                                                result.shipment?.carrierTrackingNumber ||
                                                                                result.shipment?.carrierBookingConfirmation?.proNumber ||
                                                                                result.shipment?.proNumber;

                                                                            if (trackingNumber && trackingNumber !== 'N/A') {
                                                                                return (
                                                                                    <Typography variant="body2" sx={{
                                                                                        fontSize: '8px',
                                                                                        color: '#6b7280',
                                                                                        lineHeight: 1.2,
                                                                                        whiteSpace: 'nowrap',
                                                                                        overflow: 'hidden',
                                                                                        textOverflow: 'ellipsis',
                                                                                        maxWidth: '120px',
                                                                                        fontFamily: 'monospace'
                                                                                    }}>
                                                                                        {trackingNumber}
                                                                                    </Typography>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                    </Box>
                                                                </Box>
                                                            </Box>

                                                            {/* FROM/TO Address Row - Single Line */}
                                                            <Box sx={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                pl: '28px', // Align with shipment ID
                                                                minWidth: 0
                                                            }}>
                                                                {/* FROM Company and Address */}
                                                                <Typography variant="body2" sx={{
                                                                    fontSize: '10px',
                                                                    color: '#374151',
                                                                    lineHeight: 1.2,
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    flex: '0 1 auto',
                                                                    minWidth: 0
                                                                }}>
                                                                    <Box component="span" sx={{ fontWeight: 600 }}>
                                                                        {result.shipment?.shipFrom?.companyName || result.shipment?.shipFrom?.company || 'Unknown Shipper'}
                                                                    </Box>
                                                                    <Box component="span" sx={{ color: '#6b7280', fontWeight: 400, ml: 0.5 }}>
                                                                        {(() => {
                                                                            const from = result.shipment?.shipFrom;
                                                                            if (!from) return '';
                                                                            const parts = [
                                                                                from.street || from.addressLine1,
                                                                                from.city,
                                                                                from.state || from.province,
                                                                                (from.postalCode || from.zipCode)?.toUpperCase?.() || (from.postalCode || from.zipCode)
                                                                            ].filter(Boolean);
                                                                            return parts.length > 0 ? ` - ${parts.join(', ')}` : '';
                                                                        })()}
                                                                    </Box>
                                                                </Typography>

                                                                {/* Arrow */}
                                                                <Box sx={{
                                                                    color: '#9ca3af',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    flexShrink: 0,
                                                                    mx: 0.5
                                                                }}>
                                                                    →
                                                                </Box>

                                                                {/* TO Company and Address */}
                                                                <Typography variant="body2" sx={{
                                                                    fontSize: '10px',
                                                                    color: '#374151',
                                                                    lineHeight: 1.2,
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    flex: '0 1 auto',
                                                                    minWidth: 0
                                                                }}>
                                                                    <Box component="span" sx={{ fontWeight: 600 }}>
                                                                        {result.shipment?.shipTo?.companyName || result.shipment?.shipTo?.company || 'Unknown Consignee'}
                                                                    </Box>
                                                                    <Box component="span" sx={{ color: '#6b7280', fontWeight: 400, ml: 0.5 }}>
                                                                        {(() => {
                                                                            const to = result.shipment?.shipTo;
                                                                            if (!to) return '';
                                                                            const parts = [
                                                                                to.street || to.addressLine1,
                                                                                to.city,
                                                                                to.state || to.province,
                                                                                (to.postalCode || to.zipCode)?.toUpperCase?.() || (to.postalCode || to.zipCode)
                                                                            ].filter(Boolean);
                                                                            return parts.length > 0 ? ` - ${parts.join(', ')}` : '';
                                                                        })()}
                                                                    </Box>
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </>
                                                ) : (
                                                    /* Quick Action Suggestions */
                                                    <>
                                                        {/* Quick Action Row */}
                                                        <Box sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            width: '100%'
                                                        }}>
                                                            {/* Quick Action Icon */}
                                                            <Box sx={{
                                                                width: '20px',
                                                                height: '20px',
                                                                backgroundColor: result.type === 'status_filter' ? '#e3f2fd' : '#fff3e0',
                                                                borderRadius: '3px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '10px',
                                                                flexShrink: 0
                                                            }}>
                                                                {result.type === 'status_filter' ? '📊' : '📅'}
                                                            </Box>

                                                            {/* Quick Action Label */}
                                                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                                                <Typography variant="body2" sx={{
                                                                    fontSize: '11px',
                                                                    color: '#374151',
                                                                    fontWeight: 500,
                                                                    lineHeight: 1.2
                                                                }}>
                                                                    {result.label}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </>
                                                )}
                                            </Box>
                                        ))}
                                    </Box>

                                    {/* Footer with tips */}
                                    <Box sx={{
                                        p: 1.5,
                                        bgcolor: '#f9fafb',
                                        borderTop: '1px solid #f3f4f6',
                                        borderBottomLeftRadius: '8px',
                                        borderBottomRightRadius: '8px'
                                    }}>
                                        <Typography sx={{
                                            fontSize: '11px',
                                            color: '#6b7280',
                                            fontStyle: 'italic'
                                        }}>
                                            💡 Use ↑↓ to navigate, Enter to open shipment, Esc to close
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Box>

                        {/* Company Selector - Hide when viewing shipment details */}
                        {!currentShipmentDetail && (
                            <FormControl
                                size="small"
                                sx={{
                                    minWidth: 300,
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiSelect-select': { fontSize: '12px' }
                                }}
                            >
                                <InputLabel id="company-select-label">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <BusinessIcon sx={{ fontSize: 16 }} />
                                        Filter by Company
                                    </Box>
                                </InputLabel>
                                <Select
                                    labelId="company-select-label"
                                    value={selectedCompanyId}
                                    onChange={handleCompanyChange}
                                    label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <BusinessIcon sx={{ fontSize: 16 }} />
                                            Filter by Company
                                        </Box>
                                    }
                                >
                                    {/* All Companies Option */}
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                            <ViewListIcon sx={{ fontSize: 18, color: '#1976d2' }} />
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                All Companies
                                            </Typography>
                                            <Chip
                                                label={userRole === 'superadmin' ? 'All' : `${availableCompanies.length} Connected`}
                                                size="small"
                                                color="primary"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '10px',
                                                    ml: 'auto'
                                                }}
                                            />
                                        </Box>
                                    </MenuItem>

                                    {/* Individual Companies */}
                                    {availableCompanies.map(company => (
                                        <MenuItem
                                            key={company.companyID}
                                            value={company.companyID}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        {company.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                        ({company.companyID})
                                                    </Typography>
                                                </Box>
                                                {company.status === 'active' ? (
                                                    <Chip
                                                        label="Active"
                                                        size="small"
                                                        color="success"
                                                        sx={{
                                                            height: 20,
                                                            fontSize: '10px',
                                                            ml: 'auto'
                                                        }}
                                                    />
                                                ) : (
                                                    <Chip
                                                        label="Inactive"
                                                        size="small"
                                                        sx={{
                                                            height: 20,
                                                            fontSize: '10px',
                                                            ml: 'auto'
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Box>
                </Box>

                {/* Company Details - Hide when viewing shipment details */}
                {selectedCompanyData && viewMode === 'single' && !currentShipmentDetail && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px' }}>
                            Company ID: {selectedCompanyData.companyID} |
                            Owner: {selectedCompanyData.ownerName || 'N/A'} |
                            Created: {selectedCompanyData.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Main Content Area */}
            <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {console.log('[GlobalShipmentList] Rendering main content - selectedCompanyId:', selectedCompanyId, 'viewMode:', viewMode, 'shipmentsDeepLinkParams:', shipmentsDeepLinkParams)}
                {console.log('[GlobalShipmentList] About to pass deepLinkParams to ShipmentsX:', shipmentsDeepLinkParams)}

                {/* Search Results Table Overlay - Positioned relative to main content */}
                {showLiveResults && liveResults.length > 0 && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            zIndex: 1299,
                            backdropFilter: 'blur(2px)'
                        }}
                        onClick={() => {
                            setShowLiveResults(false);
                            setSelectedResultIndex(-1);
                        }}
                    />
                )}

                {/* Navigation Loading Overlay */}
                {isNavigating && (
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        borderRadius: '8px'
                    }}>
                        <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2
                        }}>
                            <CircularProgress size={40} sx={{ color: '#8b5cf6' }} />
                            <Typography sx={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: '#6b7280'
                            }}>
                                Opening shipment detail...
                            </Typography>
                        </Box>
                    </Box>
                )}

                <Paper sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: 'none'
                }}>
                    <ShipmentsX
                        key={`shipments-${refreshKey}-${resetKey}`}
                        isModal={false}
                        onClose={null}
                        showCloseButton={false}
                        onModalBack={null}
                        deepLinkParams={shipmentsDeepLinkParams}
                        onOpenCreateShipment={handleOpenCreateShipment}
                        onNavigationChange={(navigationStack) => {
                            // Track when shipment detail is open for breadcrumb display
                            const shipmentDetailView = navigationStack.find(view => view.component === 'shipment-detail');
                            if (shipmentDetailView) {
                                setCurrentShipmentDetail(shipmentDetailView.props?.shipmentId);
                            } else {
                                setCurrentShipmentDetail(null);
                            }
                        }}
                        onClearDeepLinkParams={() => {
                            // PREVENT CLEARING DURING NAVIGATION
                            if (isNavigating) {
                                console.log('🔄 Navigation in progress - preventing deep link clearing');
                                return;
                            }

                            console.log('💀 GlobalShipmentList: KILLING deep link params and refreshing shipments');
                            console.log('💀 Current deep link params before kill:', shipmentsDeepLinkParams);

                            // Add a small delay to ensure navigation completes first
                            setTimeout(() => {
                                // KILL THE DEEP LINK - SIMPLE AND EFFECTIVE
                                setShipmentsDeepLinkParams(null);

                                // Clear search value if it exists (to prevent re-setting params)
                                if (searchValue) {
                                    console.log('🧹 Also clearing search value to prevent re-setting params');
                                    setSearchValue('');
                                }

                                // Additional cleanup for admin view
                                if (searchTimer) {
                                    clearTimeout(searchTimer);
                                    setSearchTimer(null);
                                }

                                // 🔄 RESTORE ORIGINAL ADMIN VIEW MODE when returning from shipment detail
                                if (originalViewMode && originalCompanyData) {
                                    console.log('🔄 Restoring original admin view mode:', originalViewMode);
                                    setViewMode(originalViewMode);
                                    setSelectedCompanyId(originalViewMode === 'all' ? 'all' : originalCompanyData.companyID);
                                    setSelectedCompanyData(originalCompanyData);

                                    // Restore the company context only if it's a real company (not "ALL")
                                    if (originalCompanyData && originalCompanyData.companyID !== 'all') {
                                        setCompanyContext(originalCompanyData);
                                    } else {
                                        // If original was "all" view, clear company context
                                        setCompanyContext(null);
                                    }

                                    // Clear the stored original state
                                    setOriginalViewMode(null);
                                    setOriginalCompanyData(null);

                                    console.log('✅ Original admin view mode restored');
                                }

                                // REFRESH SHIPMENTS LIST when returning from shipment detail
                                // This ensures newly created shipments appear in the list
                                console.log('🔄 Triggering shipments refresh after returning from detail view');
                                setRefreshKey(prev => prev + 1);

                                console.log('💀 Deep link KILLED and refresh triggered');
                            }, 100); // 100ms delay to let navigation complete
                        }}
                        adminViewMode={viewMode}
                        adminCompanyIds={viewMode === 'all' ? (userRole === 'superadmin' ? 'all' : availableCompanies.map(c => c.companyID)) : null}
                        hideSearch={true}
                    />
                </Paper>
            </Box>

            {/* Create Shipment Modal (Advanced) */}
            <Dialog
                open={createShipmentOpen}
                onClose={() => setCreateShipmentOpen(false)}
                fullScreen
                TransitionProps={{
                    onExited: () => {
                        setPrePopulatedData(null);
                        setDraftIdToEdit(null);
                    }
                }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <CreateShipmentX
                        isModal={true}
                        showCloseButton={true}
                        onClose={() => setCreateShipmentOpen(false)}
                        onReturnToShipments={handleReturnToShipments}
                        onViewShipment={handleViewShipment}
                        draftId={draftIdToEdit}
                        prePopulatedData={prePopulatedData}
                        // Handle conversion to QuickShip
                        onConvertToQuickShip={(convertedData) => {
                            console.log('🔄 Admin: Converting CreateShipmentX to QuickShip with data:', convertedData);

                            // Close CreateShipmentX modal
                            setCreateShipmentOpen(false);

                            // CRITICAL: Pass the draft ID to QuickShip to load the converted draft
                            if (convertedData.activeDraftId) {
                                console.log('🔄 Admin: Setting QuickShip draft ID to load converted draft:', convertedData.activeDraftId);
                                setQuickShipDraftId(convertedData.activeDraftId);
                                // Clear any prepopulated data since we're loading from draft
                                setPrePopulatedData(null);
                            } else {
                                // Legacy approach with full data
                                setPrePopulatedData(convertedData);
                                setQuickShipDraftId(null);
                            }

                            // Open QuickShip modal
                            setTimeout(() => {
                                setQuickShipOpen(true);
                                console.log('🔄 Admin: QuickShip modal opened with draft ID:', convertedData.activeDraftId);
                            }, 300);
                        }}
                    />
                </DialogContent>
            </Dialog>

            {/* Quick Ship Modal */}
            <Dialog
                open={quickShipOpen}
                onClose={() => setQuickShipOpen(false)}
                fullScreen
                TransitionProps={{
                    onExited: () => {
                        setQuickShipDraftId(null);
                        setPrePopulatedData(null); // Clear converted data on modal close
                    }
                }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <ShipmentFormProvider>
                        <QuickShip
                            isModal={true}
                            showCloseButton={true}
                            onClose={() => setQuickShipOpen(false)}
                            onReturnToShipments={handleReturnToShipments}
                            onViewShipment={handleViewShipment}
                            draftId={quickShipDraftId}
                            prePopulatedData={prePopulatedData} // CRITICAL: Pass converted data from CreateShipmentX
                            // Handle conversion to CreateShipmentX
                            onConvertToAdvanced={(convertedData) => {
                                console.log('🔄 Admin: Converting QuickShip to CreateShipmentX with data:', convertedData);
                                // Close QuickShip modal
                                setQuickShipOpen(false);

                                // CRITICAL: Pass the draft ID to CreateShipmentX to load the converted draft
                                if (convertedData.activeDraftId) {
                                    console.log('🔄 Admin: Setting CreateShipmentX draft ID to load converted draft:', convertedData.activeDraftId);
                                    setDraftIdToEdit(convertedData.activeDraftId);
                                    // Pass minimal prepopulated data with isConversion flag
                                    setPrePopulatedData({ isConversion: true });
                                } else {
                                    // Legacy approach with full data
                                    setPrePopulatedData(convertedData);
                                    setDraftIdToEdit(null);
                                }

                                // Open CreateShipmentX modal
                                setTimeout(() => {
                                    setCreateShipmentOpen(true);
                                    console.log('🔄 Admin: CreateShipmentX modal opened with draft ID:', convertedData.activeDraftId);
                                }, 300);
                            }}
                        />
                    </ShipmentFormProvider>
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default GlobalShipmentList;
