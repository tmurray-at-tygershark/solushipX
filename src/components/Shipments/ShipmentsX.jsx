import React, { useState, useEffect, useMemo, useCallback, useContext, useRef, Suspense, lazy } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tabs,
    Tab,
    Toolbar,
    TablePagination,
    IconButton,
    Slide,
    Grid,
    TextField,
    InputAdornment,
    Collapse,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Snackbar,
    Drawer,
    ListSubheader,
    Autocomplete,
    Divider,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Avatar,
    Stack,
    FormControlLabel,
    Switch
} from '@mui/material';
import {
    Add as AddIcon,
    FilterList as FilterIcon,
    GetApp as ExportIcon,
    Refresh as RefreshIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    Description as DescriptionIcon,
    QrCode as QrCodeIcon,
    FilterAlt as FilterAltIcon,
    CalendarToday as CalendarIcon,
    FirstPage,
    KeyboardArrowLeft,
    KeyboardArrowRight,
    LastPage,
    FlashOn as FlashOnIcon,
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { hasPermission, PERMISSIONS } from '../../utils/rolePermissions';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, getDoc, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import './Shipments.css';

// Import common components
import ModalHeader from '../common/ModalHeader';
import EnhancedStatusFilter from '../StatusChip/EnhancedStatusFilter';
import EnhancedStatusChip from '../StatusChip/EnhancedStatusChip';

// Import modular components
import ShipmentFilters from './components/ShipmentFilters';
import ShipmentsTable from './components/ShipmentsTable';
import ShipmentsTableSkeleton from './components/ShipmentsTableSkeleton';
import ShipmentsPagination from './components/ShipmentsPagination';
import ExportDialog from './components/ExportDialog';
import PrintDialog from './components/PrintDialog';
import PdfViewerDialog from './components/PdfViewerDialog';
import DeleteConfirmDialog from './components/DeleteConfirmDialog';
import ShipmentActionMenu from './components/ShipmentActionMenu';
import StatusUpdateDialog from './components/StatusUpdateDialog';
import TrackingDrawerContent from '../Tracking/Tracking';

// Import utilities
import {
    hasEnabledCarriers,
    getShipmentStatusGroup,
    checkDocumentAvailability
} from './utils/shipmentHelpers';
import { semanticSearch } from '../../utils/semanticSearch';
// Dynamic carrier loading - removed hardcoded import

// Import hooks
import { useCarrierAgnosticStatusUpdate } from '../../hooks/useCarrierAgnosticStatusUpdate';
import useModalNavigation from '../../hooks/useModalNavigation';

// Import services
import invoiceStatusService from '../../services/invoiceStatusService';
import shipmentStatusService from '../../services/shipmentStatusService';

// Import ShipmentDetailX for the sliding view
const ShipmentDetailX = React.lazy(() =>
    import('../ShipmentDetail/ShipmentDetailX').catch(error => {
        console.error('Failed to load ShipmentDetailX chunk:', error);
        // Return a fallback component
        return {
            default: () => (
                <Box p={3}>
                    <Alert severity="error">
                        Failed to load shipment details. Please refresh the page.
                    </Alert>
                </Box>
            )
        };
    })
);

// Custom ModalHeader with Enterprise Search
const EnterpriseModalHeader = ({
    navigation,
    onBack,
    showBackButton,
    onClose,
    showCloseButton,
    unifiedSearch,
    setUnifiedSearch,
    liveResults,
    setLiveResults,
    showLiveResults,
    setShowLiveResults,
    selectedResultIndex,
    setSelectedResultIndex,
    handleViewShipmentDetail,
    allShipments,
    customers,
    generateLiveShipmentResults,
    loadShipments,
    handleEditDraftShipment,
    reloadShipments,
    performSemanticSearch,
    isSemanticMode,
    setIsSemanticMode,
    semanticSearchResults,
    setSemanticSearchResults,
    searchConfidence,
    setSearchConfidence,
    setSearchFields,
    setSelectedCustomer,
    showSnackbar,
    adminViewMode,
    isShipmentDetailView
}) => {
    // Hide search bar when viewing shipment detail in admin mode
    const shouldHideSearch = adminViewMode !== null && isShipmentDetailView;

    return (
        <Box
            sx={{
                position: 'sticky',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                backgroundColor: 'white',
                borderBottom: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                px: 3,
                py: 2
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                }}
            >
                {/* Left Side - Back Button + Title */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto', minWidth: 'fit-content' }}>
                    {/* Back Button */}
                    {showBackButton && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ArrowBackIosNewIcon sx={{ fontSize: 16 }} />}
                            onClick={onBack}
                            sx={{
                                color: '#64748b',
                                borderColor: '#e2e8f0',
                                fontSize: '0.875rem',
                                py: 0.5,
                                px: 1.5,
                                minWidth: 'auto',
                                '&:hover': {
                                    borderColor: '#cbd5e1',
                                    backgroundColor: '#f8fafc'
                                }
                            }}
                        >
                            {navigation?.backText || 'Back'}
                        </Button>
                    )}

                    {/* Page Title - Make clickable when navigation back is possible */}
                    {(navigation?.canGoBack) ? (
                        <Button
                            variant="text"
                            onClick={onBack}
                            sx={{
                                fontWeight: 600,
                                color: '#1e293b',
                                fontSize: '1.125rem',
                                lineHeight: 1.2,
                                textTransform: 'none',
                                padding: 0,
                                minWidth: 'auto',
                                '&:hover': {
                                    backgroundColor: 'transparent',
                                    color: '#2563eb',
                                    textDecoration: 'underline'
                                }
                            }}
                        >
                            {navigation?.title?.includes('Detail') ? 'Shipments' : navigation?.title || 'Shipments'}
                        </Button>
                    ) : (
                        <Typography
                            variant="h6"
                            component="h1"
                            sx={{
                                fontWeight: 600,
                                color: '#1e293b',
                                fontSize: '1.125rem',
                                lineHeight: 1.2
                            }}
                        >
                            {navigation?.title || 'Shipments'}
                        </Typography>
                    )}
                </Box>

                {/* Center - Search (EXACT COPY FROM MAIN SEARCH) - Hide when viewing shipment detail in admin mode */}
                {!shouldHideSearch && (
                    <Box sx={{ position: 'relative', flex: 3, px: '30px', maxWidth: 'none' }}>
                        <TextField
                            fullWidth
                            placeholder="Search"
                            value={unifiedSearch}
                            onChange={(e) => {
                                const value = e.target.value; // Keep spaces during typing
                                console.log('🔍 Search input changed:', value);
                                setUnifiedSearch(value);

                                // 🧠 SEMANTIC SEARCH ENHANCEMENT - Layer AI on top of existing search
                                const isNaturalLanguage = (query) => {
                                    const naturalPatterns = [
                                        /show me.*shipment/i,
                                        /find.*from/i,
                                        /all.*delivered/i,
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

                                // 🔍 CRITICAL FIX: Reset search state for completely new searches
                                const trimmedValue = value.trim(); // Only trim for search logic, not for the input value
                                if (trimmedValue.length < 2) {
                                    // Clear everything when search is too short
                                    setLiveResults([]);
                                    setShowLiveResults(false);
                                    setSelectedResultIndex(-1);
                                    setIsSemanticMode(false);
                                    setSemanticSearchResults(null);
                                    setSearchConfidence(0);
                                }

                                // ALWAYS generate live shipment results from ALL shipments including drafts (existing powerful search)
                                if (trimmedValue.length >= 2) {
                                    // 🔍 Reset selection index for new search
                                    setSelectedResultIndex(-1);

                                    const results = generateLiveShipmentResults(trimmedValue, allShipments, customers);
                                    setLiveResults(results);
                                    setShowLiveResults(results.length > 0);

                                    // 🧠 ENHANCED SEMANTIC LAYER - Add AI intelligence for natural language including drafts
                                    if (trimmedValue.length >= 5 && isNaturalLanguage(trimmedValue)) {
                                        console.log('🧠 Natural language detected, triggering semantic search on ALL shipments including drafts');
                                        // Trigger semantic search which will be used in the main filtering
                                        performSemanticSearch(trimmedValue, allShipments).then(semanticResults => {
                                            if (semanticResults && semanticResults.results && semanticResults.results.length > 0) {
                                                // Create live results from semantic search results
                                                const semanticLiveResults = semanticResults.results.slice(0, 6).map(shipment => ({
                                                    type: 'live_shipment',
                                                    shipmentId: shipment.shipmentID || shipment.id,
                                                    documentId: shipment.id,
                                                    shipment: shipment,
                                                    route: `${shipment.shipFrom?.city || 'N/A'} → ${shipment.shipTo?.city || 'N/A'}`,
                                                    status: shipment.status ? shipment.status.replace('_', ' ').split(' ').map(word =>
                                                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                                    ).join(' ') : 'Unknown',
                                                    date: (() => {
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
                                                                    if (field.toDate) date = field.toDate();
                                                                    else if (field.seconds) date = new Date(field.seconds * 1000);
                                                                    else date = new Date(field);
                                                                    if (!isNaN(date.getTime()) && typeof date.toLocaleDateString === 'function') {
                                                                        return date.toLocaleDateString();
                                                                    }
                                                                } catch (e) {
                                                                    continue;
                                                                }
                                                            }
                                                        }
                                                        return 'N/A';
                                                    })(),
                                                    referenceNumber: shipment.referenceNumber || shipment.shipperReferenceNumber || 'N/A',
                                                    trackingNumber: shipment.trackingNumber || shipment.carrierBookingConfirmation?.proNumber || 'N/A',
                                                    carrier: shipment.carrier || 'N/A',
                                                    companyName: shipment.shipFrom?.companyName || shipment.shipTo?.companyName || 'N/A',
                                                    score: 10 // High priority for semantic results
                                                }));

                                                // Use semantic results directly
                                                setLiveResults(semanticLiveResults);
                                                setShowLiveResults(semanticLiveResults.length > 0);
                                                console.log('✨ Enhanced live results with semantic shipments:', semanticLiveResults.length);

                                                // CRITICAL: Trigger main table reload to apply semantic filtering
                                                setTimeout(() => reloadShipments(), 100);
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

                                // Clear legacy search fields when using unified search
                                if (trimmedValue) {
                                    setSearchFields({
                                        shipmentId: '',
                                        referenceNumber: '',
                                        trackingNumber: '',
                                        customerName: '',
                                        origin: '',
                                        destination: ''
                                    });
                                    setSelectedCustomer('');
                                }

                                // NOTE: Removed automatic search trigger to prevent infinite loops
                                // Search is now only triggered by explicit user actions (Enter key, etc.)
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setSelectedResultIndex(prev =>
                                        prev < liveResults.length - 1 ? prev + 1 : prev
                                    );
                                } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1);
                                } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (selectedResultIndex >= 0 && liveResults[selectedResultIndex]) {
                                        const selectedResult = liveResults[selectedResultIndex];

                                        if (selectedResult.type === 'live_shipment') {
                                            console.log('🎯 ENTER - Navigating to shipment:', selectedResult.shipmentId);
                                            console.log('🎯 ENTER - Current navigation state:', navigation);

                                            // Check if this is a draft shipment and handle appropriately
                                            if (selectedResult.shipment?.status === 'draft') {
                                                console.log('📝 ENTER - Direct navigation to edit draft:', selectedResult.shipmentId);
                                                handleEditDraftShipment(selectedResult.documentId);
                                            } else {
                                                console.log('📋 Non-draft shipment detected, opening detail view:', selectedResult.documentId);

                                                // Direct navigation - replace current shipment with new one
                                                console.log('🎯 ENTER - Direct navigation to new shipment:', selectedResult.shipmentId);
                                                handleViewShipmentDetail(selectedResult.documentId);
                                            }
                                        } else if (selectedResult.type === 'status_filter') {
                                            // Apply status filter
                                            setUnifiedSearch(selectedResult.value);
                                        } else if (selectedResult.type === 'date_filter') {
                                            // Apply date filter
                                            setUnifiedSearch(selectedResult.value);
                                        }

                                        setShowLiveResults(false);
                                        setSelectedResultIndex(-1);
                                    } else {
                                        console.log('🔍 ENTER pressed - triggering search');

                                        // Check if we're in a shipment detail view (navigation.canGoBack indicates we're in detail view)
                                        // If so, go back to table view first, then search
                                        if (navigation && navigation.canGoBack) {
                                            console.log('🔙 In detail view - going back to table view first');
                                            onBack(); // Go back to table view
                                            // Search will be applied automatically when we return to table view
                                        } else {
                                            // We're in table view, just reload with search
                                            reloadShipments();
                                        }
                                    }

                                    // Always hide all dropdowns when Enter is pressed
                                    setShowLiveResults(false);
                                    setSelectedResultIndex(-1);
                                } else if (e.key === 'Escape') {
                                    setShowLiveResults(false);
                                    setSelectedResultIndex(-1);
                                    console.log('👍 Escape pressed - clearing all dropdowns');
                                }
                            }}
                            onBlur={(e) => {
                                // Only hide if not clicking on dropdown results
                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                    setTimeout(() => setShowLiveResults(false), 150);
                                }
                            }}
                            onFocus={() => {
                                if (unifiedSearch.length >= 2 && liveResults.length > 0) {
                                    setShowLiveResults(true);
                                }
                            }}
                            size="small"
                            variant="outlined"
                            sx={{
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
                                endAdornment: unifiedSearch && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                setUnifiedSearch('');
                                                loadShipments(null, '');
                                            }}
                                            sx={{
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

                        {/* Live Results Dropdown (EXACT COPY FROM MAIN SEARCH) */}
                        {showLiveResults && liveResults.length > 0 && (
                            <Box
                                sx={{
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
                                    overflow: 'auto'
                                }}
                                onMouseDown={(e) => {
                                    // Prevent blur from firing when clicking on dropdown
                                    e.preventDefault();
                                }}
                            >
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
                                            onClick={() => {
                                                if (result.type === 'live_shipment') {
                                                    console.log('🎯 MODAL HEADER: Autocomplete click - Navigating to shipment:', result.shipmentId);
                                                    console.log('🎯 MODAL HEADER: Current navigation state:', navigation);

                                                    // Clear search state first
                                                    setShowLiveResults(false);
                                                    setSelectedResultIndex(-1);

                                                    // Navigate to shipment with direct navigation
                                                    if (result.shipment?.status === 'draft') {
                                                        console.log('📝 CLICK - Direct navigation to edit draft:', result.shipmentId);
                                                        handleEditDraftShipment(result.documentId);
                                                    } else {
                                                        console.log('📋 Non-draft shipment detected, opening detail view:', result.documentId);

                                                        // Direct navigation - replace current shipment with new one
                                                        console.log('🎯 CLICK - Direct navigation to new shipment:', result.shipmentId);
                                                        handleViewShipmentDetail(result.documentId);
                                                    }
                                                } else if (result.type === 'status_filter' || result.type === 'date_filter') {
                                                    setUnifiedSearch(result.value);

                                                    // Check if we're in a shipment detail view - if so, go back to table first
                                                    if (navigation && navigation.canGoBack) {
                                                        onBack(); // Go back to table view
                                                    } else {
                                                        reloadShipments();
                                                    }

                                                    setShowLiveResults(false);
                                                    setSelectedResultIndex(-1);
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
                                                        gap: '0px',
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
                                                                                maxWidth: '100px',
                                                                                fontFamily: 'monospace'
                                                                            }}>
                                                                                {trackingNumber}
                                                                            </Typography>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}

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

                                {/* Compact Footer */}
                                <Box sx={{
                                    px: 2,
                                    py: 1,
                                    bgcolor: isSemanticMode ? '#faf7ff' : '#f9fafb',
                                    borderTop: '1px solid #f0f0f0',
                                    borderBottomLeftRadius: '8px',
                                    borderBottomRightRadius: '8px'
                                }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography sx={{
                                            fontSize: '10px',
                                            color: '#9ca3af',
                                            fontStyle: 'italic'
                                        }}>
                                            ↑↓ Navigate • Enter Select • Esc Close
                                        </Typography>
                                        {isSemanticMode && searchConfidence > 0 && (
                                            <Typography sx={{
                                                fontSize: '9px',
                                                color: '#8b5cf6',
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.5
                                            }}>
                                                �� {Math.round(searchConfidence * 100)}%
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Right Side - Close Button */}
                <Box sx={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}>
                    {showCloseButton && onClose && (
                        <IconButton
                            onClick={onClose}
                            sx={{
                                color: 'white',
                                backgroundColor: '#1c277d',
                                '&:hover': {
                                    backgroundColor: '#1a237e',
                                },
                                p: 1
                            }}
                            aria-label="Close"
                        >
                            <CloseIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

const ShipmentsX = ({ isModal = false, onClose = null, showCloseButton = false, onModalBack = null, deepLinkParams = null, onOpenCreateShipment = null, onClearDeepLinkParams = null, adminViewMode = null, adminCompanyIds = null, hideSearch = false, onNavigationChange = null }) => {
    console.log('🚢 ShipmentsX component loaded with props:', { isModal, showCloseButton, deepLinkParams, onOpenCreateShipment, adminViewMode, adminCompanyIds });

    // Auth and company context
    const { user, userRole, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyCtxLoading, companyData, setCompanyContext } = useCompany();

    const navigate = useNavigate();

    // Modal navigation system
    const modalNavigation = useModalNavigation({
        title: 'Shipments',
        shortTitle: 'Shipments',
        component: 'shipments'
    });

    // Main data states (moved before useEffects that reference them)
    const [shipments, setShipments] = useState([]);
    const [allShipments, setAllShipments] = useState([]);
    const [filteredShipments, setFilteredShipments] = useState([]); // Store ALL filtered results for export
    const [customers, setCustomers] = useState({});
    const [carrierData, setCarrierData] = useState({});
    const [companiesData, setCompaniesData] = useState([]); // Enhanced to load multiple companies for admin view
    const [availableCarriers, setAvailableCarriers] = useState([]); // Dynamic carrier options from database

    // NEW: Live search results and autocomplete
    const [liveResults, setLiveResults] = useState([]);
    const [showLiveResults, setShowLiveResults] = useState(false);
    const [selectedResultIndex, setSelectedResultIndex] = useState(-1);

    // 🧠 SEMANTIC SEARCH STATE
    const [semanticSearchResults, setSemanticSearchResults] = useState(null);
    const [isSemanticMode, setIsSemanticMode] = useState(false);
    const [searchConfidence, setSearchConfidence] = useState(0);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Sorting state - default to ship date (most recent first)
    const [sortBy, setSortBy] = useState('shipDate');
    const [sortDirection, setSortDirection] = useState('desc'); // desc = newest first

    // Sort handling - only allow sorting on specific columns
    const SORTABLE_COLUMNS = ['customer', 'shipmentID', 'eta', 'carrier', 'status', 'shipDate'];

    const handleSort = (column) => {
        // Only allow sorting on specified columns
        if (!SORTABLE_COLUMNS.includes(column)) {
            return;
        }

        if (sortBy === column) {
            // Toggle direction if same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, default to descending for dates/IDs, ascending for text
            setSortBy(column);
            setSortDirection(['shipDate', 'shipmentID', 'eta'].includes(column) ? 'desc' : 'asc');
        }
    };

    // Sort function - only handles specified columns
    const sortShipments = useCallback((shipments) => {
        if (!sortBy || !SORTABLE_COLUMNS.includes(sortBy)) {
            return shipments;
        }

        return [...shipments].sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'shipmentID':
                    aValue = a.shipmentID || '';
                    bValue = b.shipmentID || '';
                    break;

                case 'customer':
                    // Match the exact customer display logic from ShipmentTableRow.jsx
                    const getCustomerName = (shipment) => {
                        // First try to get from customers lookup (like the table does)
                        const customerId = shipment?.customerId || shipment?.customerID;
                        if (customerId && customers[customerId]) {
                            const customerData = customers[customerId];
                            return customerData.name || customerData.companyName || customerId;
                        }

                        // Fallback to shipment data
                        return shipment.customerName || shipment.shipTo?.companyName ||
                            shipment.shipTo?.company || shipment.shipTo?.name ||
                            customerId || 'Unknown Customer';
                    };

                    aValue = getCustomerName(a);
                    bValue = getCustomerName(b);
                    break;

                case 'createdAt':
                case 'shipDate':
                    const getShipmentDate = (shipment) => {
                        if (sortBy === 'shipDate') {
                            // For ship date: prefer bookedAt, then bookingTimestamp, then createdAt
                            if (shipment.bookedAt) {
                                return shipment.bookedAt?.toDate ?
                                    shipment.bookedAt.toDate() :
                                    new Date(shipment.bookedAt);
                            }
                            if (shipment.bookingTimestamp) {
                                return shipment.bookingTimestamp?.toDate ?
                                    shipment.bookingTimestamp.toDate() :
                                    new Date(shipment.bookingTimestamp);
                            }
                            if (shipment.createdAt) {
                                return shipment.createdAt?.toDate ?
                                    shipment.createdAt.toDate() :
                                    new Date(shipment.createdAt);
                            }
                        } else {
                            // For created date: prefer createdAt, then bookingTimestamp
                            if (shipment.createdAt) {
                                return shipment.createdAt?.toDate ?
                                    shipment.createdAt.toDate() :
                                    new Date(shipment.createdAt);
                            }
                            if (shipment.bookingTimestamp) {
                                return shipment.bookingTimestamp?.toDate ?
                                    shipment.bookingTimestamp.toDate() :
                                    new Date(shipment.bookingTimestamp);
                            }
                        }
                        return new Date(0);
                    };
                    aValue = getShipmentDate(a);
                    bValue = getShipmentDate(b);
                    break;

                case 'eta':
                    // Match the exact ETA display logic from ShipmentTableRow.jsx
                    const getETA = (shipment) => {
                        // Priority 1: ETA1 (check both locations like the table does)
                        const eta1 = shipment?.shipmentInfo?.eta1 || shipment?.eta1;
                        if (eta1) {
                            try {
                                // Handle Firestore Timestamp
                                if (eta1?.toDate) {
                                    return eta1.toDate();
                                }
                                // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
                                else if (typeof eta1 === 'string' && eta1.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    const parts = eta1.split('-');
                                    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                }
                                // Handle other date formats
                                else {
                                    return new Date(eta1);
                                }
                            } catch (e) { /* continue to next option */ }
                        }

                        // Priority 2: ETA2 (check both locations like the table does)
                        const eta2 = shipment?.shipmentInfo?.eta2 || shipment?.eta2;
                        if (eta2) {
                            try {
                                // Handle Firestore Timestamp
                                if (eta2?.toDate) {
                                    return eta2.toDate();
                                }
                                // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
                                else if (typeof eta2 === 'string' && eta2.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                    const parts = eta2.split('-');
                                    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                }
                                // Handle other date formats
                                else {
                                    return new Date(eta2);
                                }
                            } catch (e) { /* continue to next option */ }
                        }

                        // Priority 3: Carrier estimated delivery dates (fallback)
                        const carrierEstimatedDelivery =
                            shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                            shipment?.selectedRate?.transit?.estimatedDelivery ||
                            shipment?.selectedRate?.estimatedDeliveryDate;

                        if (carrierEstimatedDelivery) {
                            try {
                                return carrierEstimatedDelivery?.toDate ? carrierEstimatedDelivery.toDate() : new Date(carrierEstimatedDelivery);
                            } catch (e) { /* continue to fallback */ }
                        }

                        // Return very old date for sorting items without ETA to the bottom
                        return new Date(0);
                    };
                    aValue = getETA(a);
                    bValue = getETA(b);
                    break;

                case 'reference':
                    aValue = a.referenceNumber || a.shipperReferenceNumber || '';
                    bValue = b.referenceNumber || b.shipperReferenceNumber || '';
                    break;

                case 'route':
                    const getRoute = (shipment) => {
                        const from = shipment.shipFrom?.city || '';
                        const to = shipment.shipTo?.city || '';
                        return `${from} → ${to}`;
                    };
                    aValue = getRoute(a);
                    bValue = getRoute(b);
                    break;

                case 'carrier':
                    aValue = a.carrier?.name || a.carrier || '';
                    bValue = b.carrier?.name || b.carrier || '';
                    break;

                case 'charges':
                    aValue = parseFloat(a.totalCharges || a.selectedRate?.totalCharge || 0);
                    bValue = parseFloat(b.totalCharges || b.selectedRate?.totalCharge || 0);
                    break;

                case 'status':
                    aValue = a.status || '';
                    bValue = b.status || '';
                    break;

                default:
                    return 0;
            }

            // Handle sorting
            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [sortBy, sortDirection, customers]);

    // Tab and filter states
    const [selectedTab, setSelectedTab] = useState('all');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [selected, setSelected] = useState([]);

    // Filter states - ENHANCED FOR ENTERPRISE
    const [filters, setFilters] = useState({
        status: 'all',
        carrier: 'all',
        dateRange: [null, null],
        shipmentType: 'all',
        enhancedStatus: ''
    });

    // ENTERPRISE SEARCH STATE - Single unified search field
    const [unifiedSearch, setUnifiedSearch] = useState('');

    // Auto-apply filters state
    const [isAutoApply, setIsAutoApply] = useState(true);
    const [isApplyingFilters, setIsApplyingFilters] = useState(false);
    const autoApplyTimeoutRef = useRef(null);

    // Legacy search fields for backward compatibility and specific filters
    const [searchFields, setSearchFields] = useState({
        shipmentId: '',
        referenceNumber: '',
        trackingNumber: '',
        customerName: '',
        origin: '',
        destination: ''
    });
    const [dateRange, setDateRange] = useState([null, null]);
    const [selectedCustomer, setSelectedCustomer] = useState('');

    // Comprehensive Advanced Filter State
    const [advancedFilters, setAdvancedFilters] = useState({
        // Basic Information
        companyId: '',
        customerId: '',
        shipmentIds: [], // Changed to array for multiple shipment IDs
        shipmentType: '',

        // Billing & Invoice
        billType: '',
        invoiceStatus: '',
        ediNumbers: [], // Changed to array for multiple EDI numbers
        invoiceNumbers: [], // Changed to array for multiple invoice numbers

        // Timing Information
        createdAt: [null, null],
        shipmentDate: [null, null],
        eta1: [null, null],
        eta2: [null, null],
        lastUpdated: [null, null],

        // Tracking & Status
        currentStatuses: [], // Changed to array for multiple statuses
        carrier: '',
        trackingNumbers: [], // Changed to array for multiple tracking numbers
        referenceNumbers: [], // Changed to array for multiple reference numbers

        // Origin and Destination
        originCustomerName: '',
        originCity: '',
        originProvince: '',
        originCountry: '',
        originPostalCode: '',
        destinationCustomerName: '',
        destinationCity: '',
        destinationProvince: '',
        destinationCountry: '',
        destinationPostalCode: '',

        // Financial
        totalCost: [null, null],
        totalCharge: [null, null],
        currency: '',

        // Package Information
        totalWeight: [null, null],
        totalPieces: [null, null],
        packageType: '',

        // Contact Information
        shipFromEmail: '',
        shipFromPhone: '',
        shipToEmail: '',
        shipToPhone: ''
    });

    // Accordion expansion state for filter categories
    const [accordionExpanded, setAccordionExpanded] = useState({
        basicInfo: true, // Auto-expand Basic Information by default
        timing: false,
        tracking: false,
        originDestination: false,
        billing: false, // Moved billing to end
        financial: false, // Hidden for now
        packages: false, // Hidden for now
        contacts: false // Hidden for now
    });



    // Function to count active filters
    const countActiveFilters = useCallback(() => {
        if (!advancedFilters) return 0;

        let count = 0;

        // Basic Information filters
        if (advancedFilters.shipmentIds && advancedFilters.shipmentIds.length > 0) count++;
        if (advancedFilters.companyId) count++;
        if (advancedFilters.customerId) count++;
        if (advancedFilters.shipmentType) count++;

        // Timing Information filters
        if (advancedFilters.createdAt && (advancedFilters.createdAt[0] || advancedFilters.createdAt[1])) count++;
        if (advancedFilters.shipmentDate && (advancedFilters.shipmentDate[0] || advancedFilters.shipmentDate[1])) count++;
        if (advancedFilters.eta && (advancedFilters.eta[0] || advancedFilters.eta[1])) count++;

        // Tracking & Status filters
        if (advancedFilters.currentStatus && advancedFilters.currentStatus.length > 0) count++;
        if (advancedFilters.carrier) count++;
        if (advancedFilters.trackingNumbers && advancedFilters.trackingNumbers.length > 0) count++;
        if (advancedFilters.referenceNumbers && advancedFilters.referenceNumbers.length > 0) count++;

        // Origin & Destination filters
        if (advancedFilters.originCustomerName) count++;
        if (advancedFilters.originCity) count++;
        if (advancedFilters.originProvState) count++;
        if (advancedFilters.originCountry) count++;
        if (advancedFilters.originPostalCode) count++;
        if (advancedFilters.destCustomerName) count++;
        if (advancedFilters.destCity) count++;
        if (advancedFilters.destProvState) count++;
        if (advancedFilters.destCountry) count++;
        if (advancedFilters.destPostalCode) count++;

        // Billing & Invoice filters
        if (advancedFilters.invoiceStatus) count++;
        if (advancedFilters.ediNumbers && advancedFilters.ediNumbers.length > 0) count++;
        if (advancedFilters.invoiceNumbers && advancedFilters.invoiceNumbers.length > 0) count++;
        if (advancedFilters.billType) count++;

        return count;
    }, [advancedFilters]);

    // Function to get active filters for a specific section
    const getSectionActiveFilters = useCallback((section) => {
        if (!advancedFilters) return [];

        const activeFilters = [];

        switch (section) {
            case 'basicInfo':
                if (advancedFilters.shipmentIds && advancedFilters.shipmentIds.length > 0)
                    activeFilters.push(`Shipment IDs (${advancedFilters.shipmentIds.length})`);
                if (advancedFilters.companyId) activeFilters.push('Company');
                if (advancedFilters.customerId) activeFilters.push('Customer');
                if (advancedFilters.shipmentType) activeFilters.push('Shipment Type');
                break;

            case 'timing':
                if (advancedFilters.createdAt && advancedFilters.createdAt[0]) {
                    const hasRange = advancedFilters.createdAt[1] &&
                        !advancedFilters.createdAt[0].isSame(advancedFilters.createdAt[1], 'day');
                    activeFilters.push(hasRange ? 'Created Date Range' : 'Created Date');
                }
                if (advancedFilters.shipmentDate && advancedFilters.shipmentDate[0]) {
                    const hasRange = advancedFilters.shipmentDate[1] &&
                        !advancedFilters.shipmentDate[0].isSame(advancedFilters.shipmentDate[1], 'day');
                    activeFilters.push(hasRange ? 'Shipment Date Range' : 'Shipment Date');
                }
                if (advancedFilters.eta1 && advancedFilters.eta1[0]) {
                    const hasRange = advancedFilters.eta1[1] &&
                        !advancedFilters.eta1[0].isSame(advancedFilters.eta1[1], 'day');
                    activeFilters.push(hasRange ? 'ETA Date Range' : 'ETA Date');
                }
                break;

            case 'tracking':
                if (advancedFilters.currentStatus && advancedFilters.currentStatus.length > 0)
                    activeFilters.push(`Status (${advancedFilters.currentStatus.length})`);
                if (advancedFilters.carrier) activeFilters.push('Carrier');
                if (advancedFilters.trackingNumbers && advancedFilters.trackingNumbers.length > 0)
                    activeFilters.push(`Tracking (${advancedFilters.trackingNumbers.length})`);
                if (advancedFilters.referenceNumbers && advancedFilters.referenceNumbers.length > 0)
                    activeFilters.push(`References (${advancedFilters.referenceNumbers.length})`);
                break;

            case 'originDestination':
                const originFilters = [
                    advancedFilters.originCustomerName && 'Origin Customer',
                    advancedFilters.originCity && 'Origin City',
                    advancedFilters.originProvState && 'Origin Province/State',
                    advancedFilters.originCountry && 'Origin Country',
                    advancedFilters.originPostalCode && 'Origin Postal'
                ].filter(Boolean);

                const destFilters = [
                    advancedFilters.destCustomerName && 'Dest Customer',
                    advancedFilters.destCity && 'Dest City',
                    advancedFilters.destProvState && 'Dest Province/State',
                    advancedFilters.destCountry && 'Dest Country',
                    advancedFilters.destPostalCode && 'Dest Postal'
                ].filter(Boolean);

                activeFilters.push(...originFilters, ...destFilters);
                break;

            case 'billing':
                if (advancedFilters.invoiceStatus) activeFilters.push('Invoice Status');
                if (advancedFilters.ediNumbers && advancedFilters.ediNumbers.length > 0)
                    activeFilters.push(`EDI (${advancedFilters.ediNumbers.length})`);
                if (advancedFilters.invoiceNumbers && advancedFilters.invoiceNumbers.length > 0)
                    activeFilters.push(`Invoice (${advancedFilters.invoiceNumbers.length})`);
                if (advancedFilters.billType) activeFilters.push('Bill Type');
                break;
        }

        return activeFilters;
    }, [advancedFilters]);

    // Invoice status state
    const [invoiceStatuses, setInvoiceStatuses] = useState([]);
    const [selectedInvoiceStatus, setSelectedInvoiceStatus] = useState('');

    // Shipment status state for advanced filters
    const [shipmentStatuses, setShipmentStatuses] = useState([]);

    // Address book data for Origin & Destination filters
    const [addressBookData, setAddressBookData] = useState([]);
    const [loadingAddresses, setLoadingAddresses] = useState(false);

    // Companies data for dropdown - using existing state

    // Province/State data
    const [provinceStateData, setProvinceStateData] = useState({
        CA: [
            { code: 'AB', name: 'Alberta' },
            { code: 'BC', name: 'British Columbia' },
            { code: 'MB', name: 'Manitoba' },
            { code: 'NB', name: 'New Brunswick' },
            { code: 'NL', name: 'Newfoundland and Labrador' },
            { code: 'NT', name: 'Northwest Territories' },
            { code: 'NS', name: 'Nova Scotia' },
            { code: 'NU', name: 'Nunavut' },
            { code: 'ON', name: 'Ontario' },
            { code: 'PE', name: 'Prince Edward Island' },
            { code: 'QC', name: 'Quebec' },
            { code: 'SK', name: 'Saskatchewan' },
            { code: 'YT', name: 'Yukon' }
        ],
        US: [
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
            { code: 'WY', name: 'Wyoming' }
        ]
    });

    // UI states
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Dialog states
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
    const [refreshingStatus, setRefreshingStatus] = useState(new Set());
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [pdfTitle, setPdfTitle] = useState('');

    // Draft deletion states
    const [isDeleteDraftsDialogOpen, setIsDeleteDraftsDialogOpen] = useState(false);
    const [isDeletingDrafts, setIsDeletingDrafts] = useState(false);

    // Add new state for document availability
    const [documentAvailability, setDocumentAvailability] = useState({});
    const [checkingDocuments, setCheckingDocuments] = useState(false);

    // Add tracking drawer state
    const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
    const [currentTrackingNumber, setCurrentTrackingNumber] = useState('');

    // Add status update states
    const [isUpdating, setIsUpdating] = useState(false);
    const [statusUpdateProgress, setStatusUpdateProgress] = useState({});
    const [statusUpdateResults, setStatusUpdateResults] = useState([]);

    // Add new states for modular sliding navigation
    const [navigationStack, setNavigationStack] = useState([
        { key: 'table', component: 'table', props: {} }
    ]);
    const [sliding, setSliding] = useState(false);
    const [slideDirection, setSlideDirection] = useState('forward'); // 'forward' or 'backward'
    const [mountedViews, setMountedViews] = useState(['table']);

    // Track if we've already processed the initial search to prevent re-triggering
    const [hasProcessedInitialSearch, setHasProcessedInitialSearch] = useState(false);

    // Notify parent component about navigation changes for breadcrumb updates
    useEffect(() => {
        if (onNavigationChange && typeof onNavigationChange === 'function') {
            onNavigationChange(navigationStack);
        }
    }, [navigationStack, onNavigationChange]);

    // Initialize state from deep link parameters only
    useEffect(() => {
        // CRITICAL: Handle when deep link params are cleared (set to null)
        if (deepLinkParams === null) {
            console.log('🔗 Deep link params cleared - resetting search state');
            // Clear the search state and reload shipments without search
            setUnifiedSearch('');
            setFiltersOpen(false);
            setHasProcessedInitialSearch(false);

            // Reload shipments without search term
            setTimeout(() => {
                console.log('🔄 Reloading shipments without search after deep link clear');
                loadShipments(null, '');
            }, 100);
            return;
        }

        // Handle deep link parameters from modal navigation
        if (deepLinkParams) {
            console.log('🔗 ShipmentsX: Received deep link parameters:', deepLinkParams);
            console.log('🔗 ShipmentsX: Current navigation stack length:', navigationStack.length);
            console.log('🔗 ShipmentsX: hideSearch prop:', hideSearch);

            // When search parameters are provided and we're not at table view, reset to table
            // This only happens when first opening with search, not during navigation
            if (deepLinkParams.unifiedSearch && navigationStack.length > 1 && !hasProcessedInitialSearch) {
                console.log('🔍 Initial search detected with navigation stack > 1 - resetting to table view');
                setNavigationStack([{ key: 'table', component: 'table', props: {} }]);
                setMountedViews(['table']);
                setSliding(false);
                console.log('✅ Reset to table view for initial search');
            }

            // Handle deep link search parameters - use unified search for better results
            const deepLinkSearchTerms = [];

            // PRIORITY: Check if unifiedSearch is directly provided (from GlobalShipmentList)
            if (deepLinkParams.unifiedSearch) {
                console.log('🔗 Direct unified search from deep link:', deepLinkParams.unifiedSearch);
                setUnifiedSearch(deepLinkParams.unifiedSearch);
                setFiltersOpen(true);
                setHasProcessedInitialSearch(true); // Mark that we've processed the search

                // CRITICAL FIX: Immediately trigger search with the search term
                // Don't wait for state update - pass the search term directly
                setTimeout(() => {
                    console.log('🔍 Triggering immediate search with deep link term:', deepLinkParams.unifiedSearch);
                    loadShipments(null, deepLinkParams.unifiedSearch);
                }, 100); // Small delay to ensure component is ready
            } else {
                // Legacy approach - build from individual fields
                if (deepLinkParams.customerId) {
                    deepLinkSearchTerms.push(deepLinkParams.customerId);
                }
                if (deepLinkParams.shipmentId) {
                    deepLinkSearchTerms.push(deepLinkParams.shipmentId);
                }
                if (deepLinkParams.referenceNumber) {
                    deepLinkSearchTerms.push(deepLinkParams.referenceNumber);
                }
                if (deepLinkParams.trackingNumber) {
                    deepLinkSearchTerms.push(deepLinkParams.trackingNumber);
                }

                // If we have search terms, use unified search for better results
                if (deepLinkSearchTerms.length > 0) {
                    const searchTerm = deepLinkSearchTerms[0]; // Use the first term for unified search
                    console.log('🔗 Deep link search term:', searchTerm);
                    setUnifiedSearch(searchTerm);
                    setFiltersOpen(true);

                    // CRITICAL FIX: Immediately trigger search with the search term
                    // Don't wait for state update - pass the search term directly
                    setTimeout(() => {
                        console.log('🔍 Triggering immediate search with legacy deep link term:', searchTerm);
                        loadShipments(null, searchTerm);
                    }, 100); // Small delay to ensure component is ready
                }
            }
            if (deepLinkParams.status && deepLinkParams.status !== 'all') {
                setFilters(prev => ({ ...prev, status: deepLinkParams.status }));
                setFiltersOpen(true);
            }
            if (deepLinkParams.carrier && deepLinkParams.carrier !== 'all') {
                setFilters(prev => ({ ...prev, carrier: deepLinkParams.carrier }));
                setFiltersOpen(true);
            }
            if (deepLinkParams.tab) {
                setSelectedTab(deepLinkParams.tab);
            }
        }

        // CRITICAL SESSION CLEANUP: Clear auto-open state when deep link params change
        return () => {
            console.log('🧹 Deep link params changed - clearing auto-open state');
            setHasAutoOpenedShipment(false);
            setHasProcessedInitialSearch(false); // Reset for new searches
        };
    }, [deepLinkParams, navigationStack.length]);

    // 🧠 SEMANTIC SEARCH FUNCTION - AI-Powered Natural Language Understanding
    const performSemanticSearch = useCallback(async (query, allShipmentsData) => {
        try {
            console.log('🧠 Performing semantic search for:', query);
            setIsSemanticMode(true);

            // Use the semantic search engine
            const searchResults = await semanticSearch.search(query, allShipmentsData, {
                userRole,
                companyId: companyIdForAddress,
                context: 'shipments'
            });

            console.log('🎯 Semantic search results:', {
                intent: searchResults.intent,
                entities: searchResults.entities,
                resultCount: searchResults.results.length,
                confidence: searchResults.metadata.confidence,
                filters: searchResults.filters
            });

            // Update search results
            setSemanticSearchResults(searchResults);
            setSearchConfidence(searchResults.metadata.confidence);

            // Show confidence indicator to user
            if (searchResults.metadata.confidence > 0.8) {
                showSnackbar(`🎯 High confidence search (${Math.round(searchResults.metadata.confidence * 100)}%) - Found ${searchResults.results.length} results`, 'success');
            } else if (searchResults.metadata.confidence > 0.5) {
                showSnackbar(`🔍 Moderate confidence search (${Math.round(searchResults.metadata.confidence * 100)}%) - Found ${searchResults.results.length} results`, 'info');
            } else {
                showSnackbar(`⚠️ Low confidence search (${Math.round(searchResults.metadata.confidence * 100)}%) - Try being more specific`, 'warning');
            }

            return searchResults.results;

        } catch (error) {
            console.error('❌ Semantic search error:', error);
            setIsSemanticMode(false);
            showSnackbar('Semantic search failed, falling back to basic search', 'error');
            return allShipmentsData; // Fallback to showing all data
        }
    }, [userRole, companyIdForAddress]);

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({
            open: true,
            message,
            severity
        });
    }, []);

    // DYNAMIC CARRIER LOADING - Load carriers from database
    const loadAvailableCarriers = useCallback(async () => {
        try {
            console.log('🚛 Loading available carriers from database');
            const carrierOptions = [];

            // 1. Load main carriers from carriers collection (simplified query to avoid index issues)
            try {
                console.log('📡 Querying carriers collection...');
                const carriersSnapshot = await getDocs(collection(db, 'carriers'));
                const mainCarriers = [];

                console.log(`📊 Found ${carriersSnapshot.docs.length} carriers in database`);

                carriersSnapshot.forEach(doc => {
                    const carrierData = doc.data();
                    console.log('🔍 Carrier data:', {
                        id: doc.id,
                        name: carrierData.name,
                        enabled: carrierData.enabled,
                        carrierID: carrierData.carrierID
                    });

                    // Only include enabled carriers, but be flexible about the enabled field
                    const isEnabled = carrierData.enabled === true || carrierData.enabled === 'true' ||
                        carrierData.status === 'active' || carrierData.status === 'enabled';

                    if (isEnabled && carrierData.name) {
                        mainCarriers.push({
                            id: carrierData.carrierID || doc.id,
                            name: carrierData.name,
                            type: carrierData.type || 'main',
                            normalized: carrierData.name?.toLowerCase()?.replace(/[^a-z0-9]/g, '') || ''
                        });
                    }
                });

                // Sort carriers by name manually
                mainCarriers.sort((a, b) => a.name.localeCompare(b.name));

                console.log(`✅ Processed ${mainCarriers.length} enabled carriers:`, mainCarriers.map(c => c.name));

                if (mainCarriers.length > 0) {
                    carrierOptions.push({
                        group: 'Main Carriers',
                        carriers: mainCarriers
                    });
                }
            } catch (carriersError) {
                console.error('❌ Error loading main carriers:', carriersError);
            }

            // 2. Load QuickShip carriers from quickshipCarriers collection
            try {
                console.log('📡 Querying quickshipCarriers collection...');
                const quickshipSnapshot = await getDocs(collection(db, 'quickshipCarriers'));
                const quickshipCarriers = [];

                console.log(`📊 Found ${quickshipSnapshot.docs.length} QuickShip carriers in database`);

                quickshipSnapshot.forEach(doc => {
                    const carrierData = doc.data();
                    console.log('🚀 QuickShip carrier data:', {
                        id: doc.id,
                        name: carrierData.name,
                        companyID: carrierData.companyID
                    });

                    if (carrierData.name) {
                        quickshipCarriers.push({
                            id: `quickship_${doc.id}`,
                            name: carrierData.name,
                            type: 'quickship',
                            normalized: carrierData.name?.toLowerCase()?.replace(/[^a-z0-9]/g, '') || ''
                        });
                    }
                });

                // Sort carriers by name manually
                quickshipCarriers.sort((a, b) => a.name.localeCompare(b.name));

                console.log(`✅ Processed ${quickshipCarriers.length} QuickShip carriers:`, quickshipCarriers.map(c => c.name));

                if (quickshipCarriers.length > 0) {
                    carrierOptions.push({
                        group: 'QuickShip Carriers',
                        carriers: quickshipCarriers
                    });
                }
            } catch (quickshipError) {
                console.error('❌ Error loading QuickShip carriers:', quickshipError);
            }

            // 3. Add eShipPlus freight carriers as a separate group (always available)
            const eshipPlusCarriers = [
                { id: 'eShipPlus_fedexfreight', name: 'FedEx Freight via eShipPlus', type: 'eshipplus', normalized: 'fedexfreight' },
                { id: 'eShipPlus_roadrunner', name: 'Road Runner via eShipPlus', type: 'eshipplus', normalized: 'roadrunner' },
                { id: 'eShipPlus_estes', name: 'ESTES via eShipPlus', type: 'eshipplus', normalized: 'estes' },
                { id: 'eShipPlus_yrc', name: 'YRC Freight via eShipPlus', type: 'eshipplus', normalized: 'yrc' },
                { id: 'eShipPlus_xpo', name: 'XPO Logistics via eShipPlus', type: 'eshipplus', normalized: 'xpo' },
                { id: 'eShipPlus_odfl', name: 'Old Dominion via eShipPlus', type: 'eshipplus', normalized: 'odfl' },
                { id: 'eShipPlus_saia', name: 'SAIA via eShipPlus', type: 'eshipplus', normalized: 'saia' }
            ];

            carrierOptions.push({
                group: 'Freight Services (eShipPlus)',
                carriers: eshipPlusCarriers
            });

            console.log('✅ Final carrier options loaded:', carrierOptions);
            console.log('📈 Total groups:', carrierOptions.length);
            console.log('📈 Total carriers:', carrierOptions.reduce((sum, group) => sum + group.carriers.length, 0));

            setAvailableCarriers(carrierOptions);

        } catch (error) {
            console.error('❌ Critical error loading carriers:', error);

            // Fallback to just eShipPlus carriers if everything fails
            const fallbackCarriers = [{
                group: 'Freight Services (eShipPlus)',
                carriers: [
                    { id: 'eShipPlus_fedexfreight', name: 'FedEx Freight via eShipPlus', type: 'eshipplus', normalized: 'fedexfreight' },
                    { id: 'eShipPlus_roadrunner', name: 'Road Runner via eShipPlus', type: 'eshipplus', normalized: 'roadrunner' },
                    { id: 'eShipPlus_estes', name: 'ESTES via eShipPlus', type: 'eshipplus', normalized: 'estes' },
                    { id: 'eShipPlus_yrc', name: 'YRC Freight via eShipPlus', type: 'eshipplus', normalized: 'yrc' },
                    { id: 'eShipPlus_xpo', name: 'XPO Logistics via eShipPlus', type: 'eshipplus', normalized: 'xpo' },
                    { id: 'eShipPlus_odfl', name: 'Old Dominion via eShipPlus', type: 'eshipplus', normalized: 'odfl' },
                    { id: 'eShipPlus_saia', name: 'SAIA via eShipPlus', type: 'eshipplus', normalized: 'saia' }
                ]
            }];

            console.log('🔄 Using fallback carriers:', fallbackCarriers);
            setAvailableCarriers(fallbackCarriers);
        }
    }, []);

    // ENTERPRISE SEARCH ENGINE - Comprehensive wildcard search (stable function)
    // Helper function to match status terms
    const matchesStatus = (shipmentStatus, searchTerm) => {
        if (!shipmentStatus) return false;

        const status = shipmentStatus.toLowerCase();
        const term = searchTerm.toLowerCase();

        // Direct status matches
        if (status.includes(term)) return true;

        // Status aliases from semantic search
        const statusAliases = {
            'delivered': ['delivered', 'completed', 'done', 'finished', 'received'],
            'in_transit': ['in transit', 'intransit', 'on the way', 'en route', 'moving', 'traveling', 'shipping'],
            'pending': ['pending', 'waiting', 'scheduled', 'booked', 'ready', 'prepared'],
            'delayed': ['delayed', 'late', 'behind', 'overdue', 'slow'],
            'cancelled': ['cancelled', 'canceled', 'void', 'voided', 'stopped', 'terminated'],
            'out_for_delivery': ['out for delivery', 'delivering', 'final mile', 'last leg'],
            'picked_up': ['picked up', 'collected', 'retrieved', 'gathered']
        };

        for (const [statusKey, aliases] of Object.entries(statusAliases)) {
            // Check if shipment status matches this category
            if (status === statusKey || status.includes(statusKey)) {
                // Check if search term includes any alias for this status
                return aliases.some(alias => term.includes(alias));
            }
            // Also check reverse - if search term is an alias, match the shipment status
            if (aliases.some(alias => term.includes(alias))) {
                return status === statusKey || status.includes(statusKey);
            }
        }

        return false;
    };

    // Helper function to match date queries
    const matchesDateQuery = (shipment, searchTerm) => {
        if (!searchTerm.includes('today') && !searchTerm.includes('yesterday') &&
            !searchTerm.includes('week') && !searchTerm.includes('month')) {
            return false;
        }

        const shipmentDate = getShipmentDate(shipment);
        if (!shipmentDate) return false;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (searchTerm.includes('today')) {
            const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
            return shipmentDate >= today && shipmentDate < tomorrow;
        }

        if (searchTerm.includes('yesterday')) {
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            return shipmentDate >= yesterday && shipmentDate < today;
        }

        if (searchTerm.includes('last week') || searchTerm.includes('past week')) {
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return shipmentDate >= weekAgo && shipmentDate <= today;
        }

        if (searchTerm.includes('last month') || searchTerm.includes('past month')) {
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return shipmentDate >= monthAgo && shipmentDate <= today;
        }

        return false;
    };

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
                    if (field.toDate) date = field.toDate();
                    else if (field.seconds) date = new Date(field.seconds * 1000);
                    else date = new Date(field);

                    if (!isNaN(date.getTime())) return date;
                } catch (e) {
                    continue;
                }
            }
        }
        return null;
    };

    const performUnifiedSearch = useCallback((shipments, searchTerm, customersMap, carrierDataMap) => {
        console.log('🔍 performUnifiedSearch called with:', {
            searchTerm,
            shipmentsCount: shipments.length,
            customersMapCount: Object.keys(customersMap || {}).length,
            carrierDataMapCount: Object.keys(carrierDataMap || {}).length
        });

        if (!searchTerm || !searchTerm.trim()) {
            console.log('🔍 Empty search term, returning all shipments');
            return shipments;
        }

        const normalizedSearchTerm = searchTerm.toLowerCase().trim();
        console.log('🔍 Enterprise search for:', normalizedSearchTerm);

        // NEW: SMART DATE PARSING - Natural language date understanding
        const parseDateQuery = (term) => {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Handle relative dates
            if (term.includes('today')) {
                return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
            }
            if (term.includes('yesterday')) {
                const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
                return { start: yesterday, end: today };
            }
            if (term.includes('last week') || term.includes('past week')) {
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                return { start: weekAgo, end: today };
            }
            if (term.includes('last month') || term.includes('past month')) {
                const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                return { start: monthAgo, end: today };
            }

            // Handle specific date formats
            const datePatterns = [
                /(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/,  // MM/DD/YYYY or MM-DD-YYYY
                /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/,  // YYYY/MM/DD or YYYY-MM-DD
                /(\d{1,2})[-\/](\d{1,2})/,              // MM/DD (current year)
            ];

            for (const pattern of datePatterns) {
                const match = term.match(pattern);
                if (match) {
                    try {
                        let date;
                        if (match[3]) { // Full year provided
                            date = new Date(match[3], match[1] - 1, match[2]);
                        } else { // Current year assumed
                            date = new Date(now.getFullYear(), match[1] - 1, match[2]);
                        }

                        if (!isNaN(date.getTime())) {
                            return {
                                start: date,
                                end: new Date(date.getTime() + 24 * 60 * 60 * 1000)
                            };
                        }
                    } catch (e) {
                        // Invalid date, continue searching
                    }
                }
            }

            // Handle month names
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'];
            const monthAbbrev = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

            for (let i = 0; i < monthNames.length; i++) {
                if (term.includes(monthNames[i]) || term.includes(monthAbbrev[i])) {
                    const year = term.match(/\d{4}/) ? parseInt(term.match(/\d{4}/)[0]) : now.getFullYear();
                    const monthStart = new Date(year, i, 1);
                    const monthEnd = new Date(year, i + 1, 0, 23, 59, 59);
                    return { start: monthStart, end: monthEnd };
                }
            }

            return null;
        };

        // NEW: FUZZY MATCHING - Handle typos and variations
        const fuzzyMatch = (text, searchTerm, threshold = 0.7) => {
            if (!text || !searchTerm) return false;

            const textLower = text.toLowerCase();
            const searchLower = searchTerm.toLowerCase();

            // Exact match (highest priority)
            if (textLower.includes(searchLower)) return true;

            // Levenshtein distance for fuzzy matching
            const calculateDistance = (a, b) => {
                const matrix = Array(a.length + 1).fill().map(() => Array(b.length + 1).fill(0));

                for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
                for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

                for (let i = 1; i <= a.length; i++) {
                    for (let j = 1; j <= b.length; j++) {
                        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j] + 1,      // deletion
                            matrix[i][j - 1] + 1,      // insertion
                            matrix[i - 1][j - 1] + cost // substitution
                        );
                    }
                }

                return matrix[a.length][b.length];
            };

            // Only use fuzzy matching for longer terms to avoid false positives
            if (searchLower.length >= 4) {
                const distance = calculateDistance(textLower, searchLower);
                const similarity = 1 - (distance / Math.max(textLower.length, searchLower.length));
                return similarity >= threshold;
            }

            return false;
        };

        // NEW: ENHANCED STATUS MATCHING
        const statusMappings = {
            'pending': ['pending', 'scheduled', 'booked', 'awaiting_shipment', 'ready_to_ship', 'label_created'],
            'transit': ['in_transit', 'in transit', 'intransit', 'picked_up', 'on_route', 'on_the_way'],
            'delivered': ['delivered', 'completed', 'signed'],
            'delayed': ['delayed', 'on_hold', 'exception', 'returned', 'damaged', 'late'],
            'cancelled': ['cancelled', 'canceled', 'void', 'voided'],
            'out for delivery': ['out_for_delivery', 'out for delivery', 'delivery'],
            'ready': ['ready_to_ship', 'ready to ship', 'ready for pickup']
        };

        const matchesStatus = (shipmentStatus, searchTerm) => {
            if (!shipmentStatus) return false;

            const status = shipmentStatus.toLowerCase().trim();
            const search = searchTerm.toLowerCase().trim();

            // Direct match
            if (status === search || status.includes(search)) return true;

            // Check status mappings
            for (const [key, variations] of Object.entries(statusMappings)) {
                if (key.includes(search) || search.includes(key)) {
                    return variations.includes(status);
                }
                if (variations.some(v => v.includes(search) || search.includes(v))) {
                    return variations.includes(status);
                }
            }

            return false;
        };

        // Check for date query first
        const dateRange = parseDateQuery(normalizedSearchTerm);
        if (dateRange) {
            console.log('📅 Date query detected:', dateRange);
            return shipments.filter(shipment => {
                const getShipmentDate = (s) => {
                    const dateFields = [
                        s.createdAt, s.bookedAt, s.shipmentDate, s.scheduledDate,
                        s.shipmentInfo?.shipmentDate, s.updatedAt
                    ];

                    for (const field of dateFields) {
                        if (field) {
                            try {
                                let date;
                                if (field.toDate) date = field.toDate();
                                else if (field.seconds) date = new Date(field.seconds * 1000);
                                else date = new Date(field);

                                if (!isNaN(date.getTime())) return date;
                            } catch (e) {
                                continue;
                            }
                        }
                    }
                    return null;
                };

                const shipmentDate = getShipmentDate(shipment);
                return shipmentDate && shipmentDate >= dateRange.start && shipmentDate < dateRange.end;
            });
        }

        const filteredResults = shipments.filter(shipment => {
            // Create searchable content array with all possible fields
            const searchableContent = [];

            // 1. SHIPMENT IDENTIFIERS
            searchableContent.push(
                shipment.shipmentID,
                shipment.id,
                shipment.shipmentId
            );

            // 2. COMPANY IDs (Critical for enterprise search)
            searchableContent.push(
                shipment.companyID,
                shipment.shipFrom?.companyID,
                shipment.shipTo?.companyID
            );

            // 3. CUSTOMER IDs (Critical for enterprise search)
            searchableContent.push(
                shipment.shipTo?.customerID,
                shipment.shipFrom?.customerID,
                shipment.customerID
            );

            // 4. REFERENCE NUMBERS (All variations)
            searchableContent.push(
                shipment.referenceNumber,
                shipment.shipperReferenceNumber,
                shipment.shipmentInfo?.shipperReferenceNumber,
                shipment.shipmentInfo?.customerReference,
                shipment.selectedRate?.referenceNumber,
                shipment.selectedRateRef?.referenceNumber
            );

            // Additional reference numbers array
            if (shipment.shipmentInfo?.referenceNumbers) {
                searchableContent.push(...shipment.shipmentInfo.referenceNumbers);
            }

            // 5. TRACKING NUMBERS (All variations)
            searchableContent.push(
                shipment.trackingNumber,
                shipment.selectedRate?.trackingNumber,
                shipment.selectedRate?.TrackingNumber,
                shipment.selectedRateRef?.trackingNumber,
                shipment.selectedRateRef?.TrackingNumber,
                shipment.carrierTrackingData?.trackingNumber,
                shipment.carrierBookingConfirmation?.trackingNumber,
                shipment.carrierBookingConfirmation?.proNumber,
                shipment.bookingReferenceNumber
            );

            // 6. COMPANY NAMES
            searchableContent.push(
                shipment.shipFrom?.company,
                shipment.shipTo?.company,
                shipment.companyName,
                shipment.shipFrom?.companyName,
                shipment.shipTo?.companyName
            );

            // 7. CUSTOMER NAMES (from customers map)
            if (shipment.shipTo?.customerID && customersMap[shipment.shipTo.customerID]) {
                searchableContent.push(customersMap[shipment.shipTo.customerID]);
            }

            // 8. CARRIER INFORMATION
            searchableContent.push(
                shipment.carrier,
                shipment.selectedRate?.carrier,
                shipment.selectedRateRef?.carrier,
                carrierDataMap[shipment.id]?.carrier,
                carrierDataMap[shipment.id]?.displayCarrierId,
                carrierDataMap[shipment.id]?.sourceCarrierName
            );

            // 9. ADDRESSES (for origin/destination search)
            const shipFromFields = shipment.shipFrom || shipment.shipfrom || {};
            const shipToFields = shipment.shipTo || shipment.shipto || {};

            searchableContent.push(
                shipFromFields.street,
                shipFromFields.city,
                shipFromFields.state,
                shipFromFields.postalCode,
                shipFromFields.country,
                shipToFields.street,
                shipToFields.city,
                shipToFields.state,
                shipToFields.postalCode,
                shipToFields.country
            );

            // 10. CONTACT INFORMATION
            searchableContent.push(
                shipFromFields.contactName,
                shipFromFields.contactEmail,
                shipFromFields.contactPhone,
                shipFromFields.firstName,
                shipFromFields.lastName,
                shipToFields.contactName,
                shipToFields.contactEmail,
                shipToFields.contactPhone,
                shipToFields.firstName,
                shipToFields.lastName
            );

            // 11. SPECIAL INSTRUCTIONS AND NOTES
            searchableContent.push(
                shipment.shipmentInfo?.specialInstructions,
                shipment.notes,
                shipment.instructions
            );

            // Filter out null/undefined values and convert to lowercase
            const cleanedContent = searchableContent
                .filter(item => item !== null && item !== undefined && item !== '')
                .map(item => String(item).toLowerCase());

            // NEW: ENHANCED STATUS SEARCH
            if (matchesStatus(shipment.status, normalizedSearchTerm)) {
                return true;
            }

            // NEW: ENHANCED DATE SEARCH
            if (matchesDateQuery(shipment, normalizedSearchTerm)) {
                return true;
            }

            // ULTRA-SMART SEARCH LOGIC - Company-focused with strict short term matching
            const searchLength = normalizedSearchTerm.length;

            // Separate high-priority company fields from general content
            const companyFields = [
                shipment.companyID,
                shipment.shipFrom?.companyID,
                shipment.shipTo?.companyID
            ].filter(item => item !== null && item !== undefined && item !== '')
                .map(item => String(item).toLowerCase());

            const shipmentIdFields = [
                shipment.shipmentID,
                shipment.id,
                shipment.shipmentId
            ].filter(item => item !== null && item !== undefined && item !== '')
                .map(item => String(item).toLowerCase());

            // For short terms (1-3 chars), be VERY restrictive - company/shipment IDs only
            if (searchLength <= 3) {
                console.log('🔍 Short term search - checking company/shipment IDs only');

                // Check for EXACT matches in company fields first (highest priority)
                const exactCompanyMatch = companyFields.some(field => field === normalizedSearchTerm);
                if (exactCompanyMatch) {
                    console.log('✅ Exact company ID match found');
                    return true;
                }

                // Check for EXACT matches in shipment ID fields
                const exactShipmentMatch = shipmentIdFields.some(field => field === normalizedSearchTerm);
                if (exactShipmentMatch) {
                    console.log('✅ Exact shipment ID match found');
                    return true;
                }

                // For shipment IDs, allow prefix matching (e.g., "IC" matches "IC-ABC-123")
                const shipmentPrefixMatch = shipmentIdFields.some(field => {
                    return field.startsWith(normalizedSearchTerm + '-') ||
                        field.startsWith(normalizedSearchTerm + '_') ||
                        (field.length > normalizedSearchTerm.length && field.startsWith(normalizedSearchTerm));
                });

                if (shipmentPrefixMatch) {
                    console.log('✅ Shipment ID prefix match found');
                    return true;
                }

                // CRITICAL FIX: Also allow contains matching for shipment IDs to match autocomplete behavior
                const shipmentContainsMatch = shipmentIdFields.some(field => field.includes(normalizedSearchTerm));
                if (shipmentContainsMatch) {
                    console.log('✅ Shipment ID contains match found');
                    return true;
                }

                console.log('❌ No company/shipment ID match for short term');
                return false; // No other matches for short terms
            }

            // For medium terms (4-6 chars), expand to include customer IDs, reference numbers, and ADDRESS FIELDS
            if (searchLength <= 6) {
                // Check all high-priority fields INCLUDING ADDRESSES
                const priorityFields = [
                    ...companyFields,
                    ...shipmentIdFields,
                    shipment.shipTo?.customerID,
                    shipment.shipFrom?.customerID,
                    shipment.customerID,
                    shipment.referenceNumber,
                    shipment.shipperReferenceNumber,
                    shipment.shipmentInfo?.shipperReferenceNumber,
                    shipment.trackingNumber,
                    // 📍 CRITICAL FIX: Add address fields for city searches like "Barrie"
                    shipFromFields.city,
                    shipFromFields.state,
                    shipFromFields.province,
                    shipToFields.city,
                    shipToFields.state,
                    shipToFields.province,
                    // Also include company names from addresses
                    shipFromFields.company,
                    shipFromFields.companyName,
                    shipToFields.company,
                    shipToFields.companyName
                ].filter(item => item !== null && item !== undefined && item !== '')
                    .map(item => String(item).toLowerCase());

                // DEBUG: Log address fields for debugging city searches
                if (normalizedSearchTerm === 'barrie') {
                    console.log('🔍 BARRIE SEARCH DEBUG - Address fields found:', {
                        shipFromCity: shipFromFields.city,
                        shipToCity: shipToFields.city,
                        shipmentId: shipment.shipmentID || shipment.id,
                        priorityFieldsCount: priorityFields.length,
                        allPriorityFields: priorityFields
                    });
                }

                // Exact match first
                const exactMatch = priorityFields.some(field => field === normalizedSearchTerm);
                if (exactMatch) {
                    if (normalizedSearchTerm === 'barrie') {
                        console.log('✅ BARRIE EXACT MATCH FOUND in shipment:', shipment.shipmentID || shipment.id);
                    }
                    return true;
                }

                // Prefix match for IDs
                const prefixMatch = priorityFields.some(field => {
                    return field.startsWith(normalizedSearchTerm + '-') ||
                        field.startsWith(normalizedSearchTerm + '_') ||
                        field.startsWith(normalizedSearchTerm);
                });

                if (prefixMatch) return true;

                // Contains match only for longer priority fields
                const containsMatch = priorityFields.some(field =>
                    field.length >= 6 && field.includes(normalizedSearchTerm)
                );

                if (containsMatch) return true;

                // NEW: Fuzzy matching for medium-length terms
                const fuzzyMatchFound = priorityFields.some(field =>
                    fuzzyMatch(field, normalizedSearchTerm, 0.8)
                );

                return fuzzyMatchFound;
            }

            // For longer terms (7+ chars), use full search across all fields
            const allFields = cleanedContent;

            // Exact match gets highest priority
            if (allFields.some(content => content === normalizedSearchTerm)) return true;

            // Word boundary match gets second priority
            const wordBoundaryMatch = allFields.some(content => {
                const wordBoundaryRegex = new RegExp(`\\b${normalizedSearchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
                return wordBoundaryRegex.test(content);
            });
            if (wordBoundaryMatch) return true;

            // Contains matching for longer terms
            const containsMatch = allFields.some(content => content.includes(normalizedSearchTerm));
            if (containsMatch) return true;

            // NEW: Fuzzy matching for longer terms (more lenient threshold)
            return allFields.some(content => fuzzyMatch(content, normalizedSearchTerm, 0.7));
        });

        // CRITICAL: Sort results by relevance to put best matches first
        const scoredResults = filteredResults.map(shipment => {
            let score = 0;
            const searchLower = normalizedSearchTerm.toLowerCase();

            // Highest priority: Exact matches in key fields
            if (shipment.shipmentID?.toLowerCase() === searchLower) score += 100;
            if (shipment.shipTo?.city?.toLowerCase() === searchLower) score += 90;
            if (shipment.shipFrom?.city?.toLowerCase() === searchLower) score += 90;
            if (shipment.shipTo?.companyName?.toLowerCase() === searchLower) score += 80;
            if (shipment.shipFrom?.companyName?.toLowerCase() === searchLower) score += 80;

            // High priority: Contains matches in important fields
            if (shipment.shipTo?.city?.toLowerCase().includes(searchLower)) score += 50;
            if (shipment.shipFrom?.city?.toLowerCase().includes(searchLower)) score += 50;
            if (shipment.shipTo?.companyName?.toLowerCase().includes(searchLower)) score += 40;
            if (shipment.shipFrom?.companyName?.toLowerCase().includes(searchLower)) score += 40;
            if (shipment.shipTo?.street?.toLowerCase().includes(searchLower)) score += 30;
            if (shipment.shipFrom?.street?.toLowerCase().includes(searchLower)) score += 30;

            // Medium priority: Other identifying fields
            if (shipment.referenceNumber?.toLowerCase().includes(searchLower)) score += 20;
            if (shipment.trackingNumber?.toLowerCase().includes(searchLower)) score += 20;
            if (shipment.carrier?.toLowerCase().includes(searchLower)) score += 15;

            // Lower priority: General fields
            if (shipment.notes?.toLowerCase().includes(searchLower)) score += 5;
            if (shipment.specialInstructions?.toLowerCase().includes(searchLower)) score += 5;

            return { shipment, score };
        });

        // Sort by score (highest first) and extract shipments
        const sortedResults = scoredResults
            .sort((a, b) => b.score - a.score)
            .map(item => item.shipment);

        console.log(`🔍 performUnifiedSearch returning ${sortedResults.length} results out of ${shipments.length} input shipments`);

        // DEBUG: Special logging for search results
        if (normalizedSearchTerm === 'smiths' || normalizedSearchTerm === 'barrie') {
            console.log(`🔍 ${normalizedSearchTerm.toUpperCase()} SEARCH RESULTS:`, {
                totalInput: shipments.length,
                totalResults: sortedResults.length,
                topResults: sortedResults.slice(0, 5).map(s => ({
                    id: s.shipmentID || s.id,
                    fromCity: s.shipFrom?.city,
                    toCity: s.shipTo?.city,
                    toCompany: s.shipTo?.companyName || s.shipTo?.company,
                    score: scoredResults.find(sr => sr.shipment === s)?.score || 0
                }))
            });
        }

        return sortedResults;
    }, []); // No dependencies to prevent recreation

    // NEW: GENERATE LIVE SHIPMENT RESULTS for autocomplete
    const generateLiveShipmentResults = useCallback((searchTerm, shipments, customersMap) => {
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

        // Extract live shipment results from ALL shipments, including drafts (limit to first 200 for performance)
        allShipments.slice(0, 200).forEach(shipment => {
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

            // Status suggestions (including draft)
            const statusSuggestions = [
                'draft', 'pending', 'in_transit', 'delivered', 'delayed', 'cancelled', 'out_for_delivery'
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
    }, [allShipments]);

    // ENHANCED CARRIER FILTER FUNCTION (stable)
    const applyCarrierFilter = useCallback((shipments, carrierFilter, carrierDataMap) => {
        if (!carrierFilter || carrierFilter === 'all') {
            return shipments;
        }

        return shipments.filter(shipment => {
            // Check multiple carrier sources
            const carrierSources = [
                shipment.carrier,
                shipment.selectedRate?.carrier,
                shipment.selectedRateRef?.carrier,
                carrierDataMap[shipment.id]?.carrier,
                carrierDataMap[shipment.id]?.displayCarrierId,
                carrierDataMap[shipment.id]?.sourceCarrierName
            ];

            return carrierSources.some(carrier =>
                carrier && carrier.toLowerCase().includes(carrierFilter.toLowerCase())
            );
        });
    }, []); // No dependencies to prevent recreation

    // ENHANCED STATUS FILTER FUNCTION (stable)
    // DEBUG flag for verbose filter logging
    const DEBUG_FILTERS = true;

    const applyStatusFilter = useCallback((shipments, statusFilter) => {
        if (!statusFilter || statusFilter === 'all') {
            return shipments;
        }

        // Ensure statusFilter is a string
        const filterStatusStr = typeof statusFilter === 'string' ? statusFilter : String(statusFilter);
        const filterStatus = filterStatusStr.toLowerCase().trim();

        // Helper to normalize shipment status from multiple possible fields
        const getNormalizedStatus = (s) => {
            const candidates = [
                s.status,
                s.currentStatus,
                s.shipmentStatus,
                s?.shipmentStatus?.statusCode,
                s?.shipmentStatus?.code,
                s?.shipmentStatus?.name
            ];

            for (const cand of candidates) {
                if (!cand) continue;
                if (typeof cand === 'string') return cand.toLowerCase().trim();
                if (typeof cand === 'object') {
                    const possible = cand.statusCode || cand.code || cand.name;
                    if (possible && typeof possible === 'string') return possible.toLowerCase().trim();
                }
            }
            return '';
        };

        // Build before snapshot for diagnostics
        const beforeCount = shipments.length;
        const distinctValues = new Map();

        const statusMappings = {
            'pending': ['pending', 'scheduled', 'booked', 'awaiting_shipment', 'ready_to_ship', 'label_created'],
            'in_transit': ['in_transit', 'in transit', 'intransit', 'picked_up', 'on_route', 'on_the_way'],
            'delivered': ['delivered', 'completed', 'signed', 'delivered_to_customer', 'delivery_completed', 'delivered_successfully', 'delivered_success'],
            'delayed': ['delayed', 'on_hold', 'exception', 'returned', 'damaged', 'late'],
            'cancelled': ['cancelled', 'canceled', 'void', 'voided'],
            'out_for_delivery': ['out_for_delivery', 'out for delivery', 'delivery'],
            'ready_for_pickup': ['ready_to_ship', 'ready to ship', 'ready for pickup']
        };

        const matched = [];
        const nonMatchedSamples = [];

        shipments.forEach(s => {
            const norm = getNormalizedStatus(s);
            if (!distinctValues.has(norm)) distinctValues.set(norm, 0);
            distinctValues.set(norm, distinctValues.get(norm) + 1);

            let ok = false;
            if (norm === filterStatus) ok = true;
            else if (statusMappings[filterStatus]) ok = statusMappings[filterStatus].includes(norm);
            else {
                // Try to find the filter status in any of the mapping arrays (reverse lookup)
                for (const [key, aliases] of Object.entries(statusMappings)) {
                    if (aliases.includes(filterStatus) && aliases.includes(norm)) {
                        ok = true;
                        break;
                    }
                }
            }

            if (ok) matched.push(s);
            else if (nonMatchedSamples.length < 10) {
                nonMatchedSamples.push({
                    id: s.shipmentID || s.id,
                    status: s.status,
                    currentStatus: s.currentStatus,
                    shipmentStatus: s.shipmentStatus,
                    normalized: norm
                });
            }
        });

        if (DEBUG_FILTERS) {
            try {
                const distinctObj = Array.from(distinctValues.entries()).reduce((acc, [k, v]) => { acc[k || '(empty)'] = v; return acc; }, {});
                console.groupCollapsed(`🔎 [FILTER][Status] '${filterStatus}' — before=${beforeCount} matched=${matched.length}`);
                console.log('Distinct normalized status values (count):', distinctObj);
                if (nonMatchedSamples.length) {
                    console.table(nonMatchedSamples);
                }
                console.groupEnd();
            } catch (e) {
                // no-op
            }
        }

        return matched;
    }, []); // No dependencies to prevent recreation

    // Generic navigation push
    const pushView = useCallback((view) => {
        console.log('➡️ pushView called with:', view.key);

        setSlideDirection('forward');
        setSliding(true);

        // Add the new view to mounted views immediately
        setMountedViews((prev) => {
            const newMounted = Array.from(new Set([...prev, view.key]));
            console.log('🏠 Updated mounted views:', newMounted);
            return newMounted;
        });

        console.log('🎬 Starting forward slide animation');

        // Update navigation stack after a brief delay to allow state to settle
        setTimeout(() => {
            setNavigationStack((prev) => {
                const newStack = [...prev, view];
                console.log('📚 Updated navigation stack:', newStack.map(v => v.key));
                return newStack;
            });

            // End sliding animation
            setTimeout(() => {
                setSliding(false);
                console.log('✅ pushView complete');
            }, 300); // Match CSS transition duration
        }, 10);
    }, []);

    // Generic navigation pop - COMPLETELY RESET TO TABLE VIEW
    const popView = useCallback(() => {
        console.log('🔙 popView called, current stack:', navigationStack.length);
        console.log('📚 Current stack contents:', navigationStack.map(v => v.key));

        if (navigationStack.length <= 1) {
            console.log('⚠️ Cannot pop - only one view in stack');
            return;
        }

        // 🧨 NUCLEAR OPTION: DESTROY ALL PERSISTENT SESSION DATA IMMEDIATELY
        console.log('🧨🧹 NUCLEAR CLEANUP: Destroying ALL persistent session data');

        // Clear deep link parameters IMMEDIATELY - multiple ways to be sure
        if (onClearDeepLinkParams) {
            console.log('🧹 Calling onClearDeepLinkParams IMMEDIATELY');
            onClearDeepLinkParams();
        }

        // DESTROY all auto-navigation flags and session state
        console.log('🧹 Destroying all auto-navigation flags and session state');
        setHasAutoOpenedShipment(false);
        setIsReturningFromDetail(true);

        // 🔍 CRITICAL FIX: Clear search state when returning from detail view
        console.log('🔍 Clearing search state when returning from detail view');
        setUnifiedSearch('');
        setLiveResults([]);
        setShowLiveResults(false);
        setSelectedResultIndex(-1);
        setIsSemanticMode(false);
        setSemanticSearchResults(null);
        setSearchConfidence(0);

        // BRUTAL CLEANUP: Clear window storage that might persist across navigation
        if (typeof window !== 'undefined') {
            try {
                // Clear any sessionStorage that might store navigation state
                Object.keys(sessionStorage).forEach(key => {
                    if (key.includes('shipment') || key.includes('navigation') || key.includes('deepLink')) {
                        sessionStorage.removeItem(key);
                        console.log('🧹 Cleared sessionStorage key:', key);
                    }
                });

                // Clear any custom window properties that might store state
                if (window.shipmentNavigationState) {
                    delete window.shipmentNavigationState;
                    console.log('🧹 Cleared window.shipmentNavigationState');
                }
                if (window.lastShipmentId) {
                    delete window.lastShipmentId;
                    console.log('🧹 Cleared window.lastShipmentId');
                }
            } catch (e) {
                console.log('Note: Some cleanup operations not available in this environment');
            }
        }

        // Set sliding state and direction
        setSlideDirection('backward');
        setSliding(true);

        console.log('🎬 Starting backward slide animation');

        // After animation completes, COMPLETELY RESET TO JUST TABLE VIEW
        setTimeout(() => {
            console.log('🔄 Animation complete, FORCING RESET TO TABLE ONLY');

            // 💀 NUCLEAR RESET: Force navigation stack to ONLY contain table view
            const tableOnlyStack = [{ key: 'table', component: 'table', props: {} }];

            setNavigationStack(tableOnlyStack);
            setMountedViews(['table']);

            console.log('💀 FORCED navigation stack to table only:', tableOnlyStack.map(v => v.key));
            console.log('💀 FORCED mounted views to table only: ["table"]');

            setSliding(false);

            // FINAL CLEANUP after transition
            console.log('🧹 Final post-transition cleanup');
            setTimeout(() => {
                setIsReturningFromDetail(false);
                console.log('✅ popView complete - COMPLETELY RESET TO TABLE VIEW');
            }, 100);
        }, 300); // Match CSS transition duration
    }, [navigationStack.length, onClearDeepLinkParams]);

    // Add handler for viewing shipment detail - moved before useEffect that uses it
    const handleViewShipmentDetail = useCallback(async (shipmentId) => {
        // Find the shipment to get its details for the title
        const shipment = shipments.find(s => s.id === shipmentId) || { shipmentID: shipmentId };

        // 🚀 ADMIN/SUPER ADMIN AUTO-COMPANY-SWITCHING LOGIC
        // If admin or super admin clicks on a shipment from a different company, automatically switch context
        if ((userRole === 'admin' || userRole === 'superadmin') && shipment.companyID && shipment.companyID !== companyIdForAddress) {
            console.log('🚀 Admin/Super admin viewing shipment from different company - auto-switching context');
            console.log('🏢 Shipment company ID:', shipment.companyID);
            console.log('🏢 Current company context:', companyIdForAddress);

            try {
                // Query for the shipment's company data
                const companiesQuery = query(
                    collection(db, 'companies'),
                    where('companyID', '==', shipment.companyID),
                    limit(1)
                );

                const companiesSnapshot = await getDocs(companiesQuery);

                if (!companiesSnapshot.empty) {
                    const companyDoc = companiesSnapshot.docs[0];
                    const companyDocData = companyDoc.data();

                    const targetCompanyData = {
                        ...companyDocData,
                        id: companyDoc.id
                    };

                    console.log('🔄 Switching to company context:', targetCompanyData.name, '(', shipment.companyID, ')');

                    // Switch company context - this will update companyIdForAddress and companyData
                    await setCompanyContext(targetCompanyData);

                    // Show success message
                    showSnackbar(`Switched to ${targetCompanyData.name || shipment.companyID} to view shipment`, 'success');

                    // Small delay to ensure context is fully updated before proceeding
                    await new Promise(resolve => setTimeout(resolve, 200));

                    console.log('✅ Company context switched successfully');
                } else {
                    console.warn('⚠️ Company not found for shipment:', shipment.companyID);
                    showSnackbar(`Warning: Company ${shipment.companyID} not found, proceeding with current context`, 'warning');
                }
            } catch (companyError) {
                console.error('❌ Error switching company context:', companyError);
                showSnackbar('Error switching company context, proceeding with current context', 'warning');
            }
        }

        // 🔄 CRITICAL FIX: Check if we're already in a detail view and replace it instead of pushing
        if (navigationStack.length > 1) {
            const currentShipmentView = navigationStack.find(view => view.component === 'shipment-detail');
            const currentShipmentId = currentShipmentView?.props?.shipmentId;

            if (currentShipmentId && currentShipmentId !== shipmentId) {
                console.log('🔄 REPLACING: Switching from shipment', currentShipmentId, 'to', shipmentId);

                // Create the new detail view
                const newDetailView = {
                    key: `shipment-detail-${shipmentId}`,
                    component: 'shipment-detail',
                    props: {
                        shipmentId,
                        isAdmin: adminViewMode !== null
                    }
                };

                // Replace the current detail view directly in the navigation stack
                setNavigationStack(prev => {
                    const tableView = prev[0]; // Keep the table view
                    return [tableView, newDetailView]; // Replace detail view
                });

                // Update mounted views to include the new detail view
                setMountedViews(prev => {
                    const withoutOldDetail = prev.filter(view => !view.startsWith('shipment-detail-'));
                    return [...withoutOldDetail, newDetailView.key];
                });

                console.log('🚀 REPLACED: Directly replaced detail view without animation');

                // Update modal navigation for proper back button handling
                modalNavigation.navigateTo({
                    title: `${shipment.shipmentID || shipmentId}`,
                    shortTitle: shipment.shipmentID || shipmentId,
                    component: 'shipment-detail',
                    data: { shipmentId }
                });

                return; // Exit early, don't push a new view
            } else if (currentShipmentId === shipmentId) {
                console.log('🚫 Already viewing shipment:', shipmentId);
                return; // Exit early, no need to navigate
            }
        }

        // Standard behavior: Create the shipment detail view and push it to navigation stack
        console.log('📋 PUSHING: New shipment detail view for:', shipmentId);
        pushView({
            key: `shipment-detail-${shipmentId}`,
            component: 'shipment-detail',
            props: {
                shipmentId,
                isAdmin: adminViewMode !== null // Pass isAdmin flag when in admin view
            }
        });

        // Update modal navigation for proper back button handling
        modalNavigation.navigateTo({
            title: `${shipment.shipmentID || shipmentId}`,
            shortTitle: shipment.shipmentID || shipmentId,
            component: 'shipment-detail',
            data: { shipmentId }
        });
    }, [shipments, pushView, modalNavigation, adminViewMode, userRole, companyIdForAddress, setCompanyContext, showSnackbar, navigationStack, setNavigationStack, setMountedViews]);

    // Auto-open shipment detail if specified in deep link params
    const [hasAutoOpenedShipment, setHasAutoOpenedShipment] = useState(false);
    const [isReturningFromDetail, setIsReturningFromDetail] = useState(false);

    useEffect(() => {
        // 🚨 AGGRESSIVE SAFETY CHECKS: Multiple layers of protection against auto-navigation loops

        // SAFETY CHECK: Only run if we're in table view OR if we need to switch to a different shipment
        if (navigationStack.length > 1) {
            // Check if we're trying to navigate to a different shipment
            const currentShipmentView = navigationStack.find(view => view.component === 'shipment-detail');
            const currentShipmentDocumentId = currentShipmentView?.props?.shipmentId; // This is actually the document ID
            const requestedShipmentDocumentId = deepLinkParams?.selectedShipmentId || deepLinkParams?.shipmentId;

            console.log('🔍 Shipment navigation comparison:', {
                currentShipmentDocumentId,
                requestedShipmentDocumentId,
                isCurrentView: navigationStack.length > 1,
                areTheSame: currentShipmentDocumentId === requestedShipmentDocumentId
            });

            if (currentShipmentDocumentId && requestedShipmentDocumentId && currentShipmentDocumentId !== requestedShipmentDocumentId) {
                console.log('🔄 Switching from shipment document', currentShipmentDocumentId, 'to', requestedShipmentDocumentId);
                // Pop the current detail view and allow navigation to proceed to the new shipment
                setNavigationStack(prev => prev.slice(0, 1)); // Keep only the table view
                console.log('🔄 Cleared navigation stack to allow new shipment navigation');
                // Clear the returning flag since we're switching to a new shipment
                setIsReturningFromDetail(false);
                // Continue with navigation logic below
            } else if (currentShipmentDocumentId === requestedShipmentDocumentId) {
                console.log('🚫 Skipping auto-open - already viewing requested shipment document:', currentShipmentDocumentId);
                return;
            }
        }

        // CRITICAL CHECK: Don't auto-navigate if we're returning from detail view
        if (isReturningFromDetail) {
            console.log('🚫 Skipping auto-open - returning from detail view, clearing flags');
            // Clear all navigation state when returning from detail
            setHasAutoOpenedShipment(false);
            if (onClearDeepLinkParams) {
                onClearDeepLinkParams();
            }
            return;
        }

        // PARANOID CHECK: Don't auto-navigate if we've already auto-opened something
        if (hasAutoOpenedShipment) {
            console.log('🚫 Skipping auto-open - already auto-opened a shipment in this session');
            return;
        }

        // DEEP LINK PARAMS CHECK: Only proceed if we have valid, fresh deep link params
        if (!deepLinkParams) {
            console.log('🚫 No deep link params - no auto-navigation needed');
            return;
        }

        // RATE LIMITING: Prevent rapid successive auto-navigation attempts
        const now = Date.now();
        const lastAutoNav = window.lastAutoNavigation || 0;
        if (now - lastAutoNav < 1000) { // 1 second cooldown
            console.log('🚫 Rate limiting auto-navigation - too soon after last attempt');
            return;
        }

        // Handle BYPASS TABLE navigation - go directly to detail without waiting for table data
        if (deepLinkParams.bypassTable && deepLinkParams.directToDetail && deepLinkParams.selectedShipmentId) {
            console.log('🚀 BYPASS TABLE: Direct navigation to shipment detail:', deepLinkParams.selectedShipmentId);

            // Check if we need to switch shipments while already in detail view
            if (navigationStack.length > 1) {
                const currentShipmentView = navigationStack.find(view => view.component === 'shipment-detail');
                const currentShipmentDocumentId = currentShipmentView?.props?.shipmentId; // This is actually the document ID

                console.log('🔍 BYPASS navigation comparison:', {
                    currentShipmentDocumentId,
                    requestedShipmentDocumentId: deepLinkParams.selectedShipmentId,
                    areTheSame: currentShipmentDocumentId === deepLinkParams.selectedShipmentId
                });

                if (currentShipmentDocumentId && currentShipmentDocumentId !== deepLinkParams.selectedShipmentId) {
                    console.log('🔄 BYPASS: Switching from shipment document', currentShipmentDocumentId, 'to', deepLinkParams.selectedShipmentId);
                    // For bypass navigation, directly replace the current detail view instead of using popView
                    // This avoids the aggressive cleanup animations that cause bouncing
                    const newDetailView = {
                        key: `shipment-detail-${deepLinkParams.selectedShipmentId}`,
                        component: 'shipment-detail',
                        props: {
                            shipmentId: deepLinkParams.selectedShipmentId,
                            isAdmin: adminViewMode !== null
                        }
                    };

                    // Replace the current detail view directly in the navigation stack
                    setNavigationStack(prev => {
                        const tableView = prev[0]; // Keep the table view
                        return [tableView, newDetailView]; // Replace detail view
                    });

                    // Update mounted views to include the new detail view
                    setMountedViews(prev => {
                        const withoutOldDetail = prev.filter(view => !view.startsWith('shipment-detail-'));
                        return [...withoutOldDetail, newDetailView.key];
                    });

                    console.log('🚀 BYPASS: Directly replaced detail view without animation');

                    // Update modal navigation for proper back button handling
                    const shipment = allShipments.find(s => s.id === deepLinkParams.selectedShipmentId) || { shipmentID: deepLinkParams.selectedShipmentId };
                    modalNavigation.navigateTo({
                        title: `${shipment.shipmentID || deepLinkParams.selectedShipmentId}`,
                        shortTitle: shipment.shipmentID || deepLinkParams.selectedShipmentId,
                        component: 'shipment-detail',
                        data: { shipmentId: deepLinkParams.selectedShipmentId }
                    });
                } else {
                    // Same shipment, no need to navigate
                    console.log('🚫 BYPASS: Already viewing requested shipment document:', currentShipmentDocumentId);
                }
            } else {
                // Not in detail view, navigate normally
                handleViewShipmentDetail(deepLinkParams.selectedShipmentId);
            }

            // KILL THE DEEP LINK IMMEDIATELY since we're bypassing the table
            if (onClearDeepLinkParams) {
                onClearDeepLinkParams();
                console.log('💀 KILLED deep link params for bypass navigation');
            }

            // Set rate limiting
            window.lastAutoNavigation = now;
            setHasAutoOpenedShipment(true); // Prevent running again
            console.log('✅ Bypass table navigation completed');
            return;
        }

        // 📝 Handle EDIT DRAFT SHIPMENT navigation - trigger draft editing
        if (deepLinkParams.editDraftShipment && deepLinkParams.selectedShipmentId) {
            console.log('📝 EDIT DRAFT: Triggering draft edit for shipment:', deepLinkParams.selectedShipmentId);

            // KILL THE DEEP LINK IMMEDIATELY
            if (onClearDeepLinkParams) {
                onClearDeepLinkParams();
                console.log('💀 KILLED deep link params for draft edit');
            }

            // Set rate limiting
            window.lastAutoNavigation = now;

            // Trigger draft editing
            handleEditDraftShipment(deepLinkParams.selectedShipmentId);
            setHasAutoOpenedShipment(true); // Prevent running again
            console.log('✅ Draft edit navigation completed');
            return;
        }

        // SHIPMENTS DATA CHECK: Only proceed if shipments are loaded (for non-bypass navigation)
        if (!shipments || shipments.length === 0) {
            console.log('🚫 No shipments loaded yet - deferring auto-navigation');
            return;
        }

        // Handle regular direct-to-detail navigation (legacy)
        if (deepLinkParams.directToDetail && deepLinkParams.selectedShipmentId) {
            console.log('🎯 Direct-to-detail navigation triggered for shipment:', deepLinkParams.selectedShipmentId);

            // Search in ALL shipments, not just filtered ones, to avoid tab/filter issues
            const shipment = allShipments.find(s =>
                s.shipmentID === deepLinkParams.selectedShipmentId ||
                s.id === deepLinkParams.selectedShipmentId
            );

            // DEBUG: Log shipment search details
            console.log('🔍 Searching for shipment in allShipments:', {
                targetId: deepLinkParams.selectedShipmentId,
                totalShipments: allShipments.length,
                shipmentIds: allShipments.map(s => ({ id: s.id, shipmentID: s.shipmentID })).slice(0, 10),
                found: !!shipment
            });

            if (shipment) {
                // KILL THE DEEP LINK ONLY AFTER FINDING THE SHIPMENT!
                if (onClearDeepLinkParams) {
                    onClearDeepLinkParams();
                    console.log('💀 KILLED deep link params AFTER finding shipment');
                }

                // Set rate limiting
                window.lastAutoNavigation = now;

                // Use the document ID to open the detail view directly
                handleViewShipmentDetail(shipment.id);
                setHasAutoOpenedShipment(true); // Prevent running again
                console.log('✅ Auto-opened shipment detail successfully');
            } else {
                console.log('⏳ Shipment not found yet, keeping deep link params for retry:', deepLinkParams.selectedShipmentId);
                // Don't kill the deep link params - let it retry when shipments load
            }
        }
        // Handle legacy auto-open shipment detail if specified in deep link params (for backwards compatibility)
        else if (deepLinkParams.shipmentId) {
            console.log('🎯 Legacy auto-navigation triggered for shipment:', deepLinkParams.shipmentId);

            // Search in ALL shipments, not just filtered ones, to avoid tab/filter issues
            const shipment = allShipments.find(s =>
                s.shipmentID === deepLinkParams.shipmentId ||
                s.id === deepLinkParams.shipmentId
            );

            if (shipment) {
                // KILL THE DEEP LINK ONLY AFTER FINDING THE SHIPMENT!
                if (onClearDeepLinkParams) {
                    onClearDeepLinkParams();
                    console.log('💀 KILLED legacy deep link params AFTER finding shipment');
                }

                // Set rate limiting
                window.lastAutoNavigation = now;

                // Use the document ID to open the detail view
                handleViewShipmentDetail(shipment.id);
                setHasAutoOpenedShipment(true); // Prevent running again
                console.log('✅ Auto-opened shipment detail (legacy) successfully');
            } else {
                console.log('⏳ Legacy shipment not found yet, keeping deep link params for retry:', deepLinkParams.shipmentId);
                // Don't kill the deep link params - let it retry when shipments load
            }
        }
    }, [deepLinkParams, allShipments, handleViewShipmentDetail, hasAutoOpenedShipment, navigationStack, isReturningFromDetail, onClearDeepLinkParams, adminViewMode, modalNavigation]); // Include all dependencies for proper effect management

    // Resolve customer name from customer ID after customers are loaded
    useEffect(() => {
        // Handle deep link parameters
        if (deepLinkParams && deepLinkParams.customerId && Object.keys(customers).length > 0) {
            const customerName = customers[deepLinkParams.customerId];
            if (customerName) {
                setSearchFields(prev => ({ ...prev, customerName: customerName }));
                console.log('Resolved deep link customer ID to name:', { customerId: deepLinkParams.customerId, customerName });
            } else {
                console.log('Could not resolve deep link customer ID:', { customerId: deepLinkParams.customerId, availableCustomers: Object.keys(customers) });
            }
        }
    }, [customers, deepLinkParams]);

    // Calculate stats using consistent direct status matching
    const stats = useMemo(() => {
        if (!allShipments.length) {
            return {
                total: 0,
                awaitingShipment: 0,
                inTransit: 0,
                delivered: 0,
                delayed: 0,
                cancelled: 0,
                drafts: 0
            };
        }

        let awaitingShipment = 0;
        let inTransit = 0;
        let delivered = 0;
        let delayed = 0;
        let cancelled = 0;
        let drafts = 0;
        let pendingReview = 0;

        // Single pass through the array with direct status matching (same as filtering logic)
        allShipments.forEach(s => {
            const status = s.status?.toLowerCase()?.trim();

            if (status === 'draft') {
                // Check if this is a pending review draft
                if (s.pending_review === true) {
                    pendingReview++;
                } else {
                    drafts++;
                }
            } else if (status === 'pending' || status === 'scheduled' || status === 'booked' ||
                status === 'awaiting_shipment' || status === 'ready_to_ship' || status === 'label_created') {
                awaitingShipment++;
            } else if (status === 'in_transit' || status === 'in transit' || status === 'picked_up' ||
                status === 'on_route' || status === 'out_for_delivery') {
                inTransit++;
            } else if (status === 'delivered' || status === 'completed') {
                delivered++;
            } else if (status === 'delayed' || status === 'on_hold' || status === 'exception' ||
                status === 'returned' || status === 'damaged') {
                delayed++;
            } else if (status === 'cancelled' || status === 'canceled' || status === 'void' || status === 'voided') {
                cancelled++;
            } else {
                // Default: treat unknown statuses as awaiting shipment (non-terminal states)
                console.warn(`Unknown shipment status: ${status}, treating as awaiting shipment`, s);
                awaitingShipment++;
            }
        });

        const nonDraftTotal = allShipments.length - drafts - pendingReview;

        console.log(`📊 Stats calculated:`, {
            total: allShipments.length,
            nonDraftTotal,
            awaitingShipment,
            inTransit,
            delivered,
            delayed,
            cancelled,
            drafts,
            pendingReview
        });

        return {
            total: nonDraftTotal, // Total excludes drafts and pending review for the "All" tab
            awaitingShipment,
            inTransit,
            delivered,
            delayed,
            cancelled,
            drafts,
            pendingReview
        };
    }, [allShipments]);

    // Selection handlers - memoized for performance
    const handleSelectAll = useCallback((event) => {
        if (event.target.checked) {
            const newSelected = shipments.map(shipment => shipment.id);
            setSelected(newSelected);
            return;
        }
        setSelected([]);
    }, [shipments]);

    const handleSelect = useCallback((id) => {
        const selectedIndex = selected.indexOf(id);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1));
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selected.slice(0, selectedIndex),
                selected.slice(selectedIndex + 1),
            );
        }

        setSelected(newSelected);
    }, [selected]);

    // Highlight search term helper
    const highlightSearchTerm = useCallback((text, searchTerm) => {
        if (!searchTerm || !text) return text;

        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, index) => {
            if (part.toLowerCase() === searchTerm.toLowerCase()) {
                return <mark key={index} style={{ backgroundColor: '#fef08a', padding: '0 2px' }}>{part}</mark>;
            }
            return part;
        });
    }, []);

    // Add function to check document availability
    const checkDocumentAvailability = useCallback(async (shipment) => {
        if (shipment.status === 'draft') {
            return { hasLabels: false, hasBOLs: false };
        }

        try {
            const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
            const documentsResult = await getShipmentDocumentsFunction({
                shipmentId: shipment.id,
                organized: true
            });

            if (!documentsResult.data || !documentsResult.data.success) {
                return { hasLabels: false, hasBOLs: false };
            }

            const documents = documentsResult.data.data;

            // Check for labels
            let hasLabels = false;
            if (documents.labels && documents.labels.length > 0) {
                hasLabels = true;
            } else {
                // Check in other documents for potential labels (excluding BOL array)
                const nonBolDocs = Object.entries(documents)
                    .filter(([key]) => key !== 'bol') // Explicitly exclude BOL array
                    .map(([, docs]) => docs)
                    .flat();

                const potentialLabels = nonBolDocs.filter(doc => {
                    const filename = (doc.filename || '').toLowerCase();
                    const documentType = (doc.documentType || '').toLowerCase();
                    const isGeneratedBOL = doc.isGeneratedBOL === true || doc.metadata?.eshipplus?.generated === true;

                    // Exclude any BOL documents more strictly
                    if (filename.includes('bol') ||
                        filename.includes('billoflading') ||
                        filename.includes('bill-of-lading') ||
                        filename.includes('bill_of_lading') ||
                        documentType.includes('bol') ||
                        isGeneratedBOL) {
                        return false;
                    }

                    // More specific label detection
                    return filename.includes('label') ||
                        filename.includes('prolabel') ||
                        filename.includes('pro-label') ||
                        filename.includes('shipping_label') ||
                        filename.includes('shippinglabel') ||
                        documentType.includes('label');
                });
                hasLabels = potentialLabels.length > 0;
            }

            // Check for BOLs
            const hasBOLs = documents.bol && documents.bol.length > 0;

            return { hasLabels, hasBOLs };
        } catch (error) {
            console.error('Error checking document availability:', error);
            return { hasLabels: false, hasBOLs: false };
        }
    }, []);

    // Action menu handlers
    const handleActionMenuOpen = async (event, shipment) => {
        setSelectedShipment(shipment);
        setActionMenuAnchorEl(event.currentTarget);

        // Check document availability for non-draft shipments
        if (shipment.status !== 'draft') {
            setCheckingDocuments(true);
            try {
                const availability = await checkDocumentAvailability(shipment);
                setDocumentAvailability(prev => ({
                    ...prev,
                    [shipment.id]: availability
                }));
            } catch (error) {
                console.error('Error checking documents:', error);
                setDocumentAvailability(prev => ({
                    ...prev,
                    [shipment.id]: { hasLabels: false, hasBOLs: false }
                }));
            } finally {
                setCheckingDocuments(false);
            }
        }
    };

    const handleActionMenuClose = () => {
        setSelectedShipment(null);
        setActionMenuAnchorEl(null);
    };

    // Placeholder refresh status handler (will implement later with status update hook)
    const handleRefreshShipmentStatus = async (shipment) => {
        setRefreshingStatus(prev => new Set([...prev, shipment.id]));
        showSnackbar('Status refresh functionality will be implemented with status update hook', 'info');
        setTimeout(() => {
            setRefreshingStatus(prev => {
                const newSet = new Set(prev);
                newSet.delete(shipment.id);
                return newSet;
            });
        }, 1000);
    };

    // Fetch customers for name lookup - optimized
    const fetchCustomers = useCallback(async () => {
        // Check if we're in admin "all companies" mode
        const isAdminAllView = adminViewMode === 'all';

        if (!companyIdForAddress && !isAdminAllView) return;

        try {
            const customersRef = collection(db, 'customers');
            let q;

            if (isAdminAllView) {
                // Admin viewing all companies - load customers from all companies
                if (adminCompanyIds === 'all') {
                    // Super admin - load all customers
                    console.log('📊 Loading ALL customers (super admin view)');
                    q = query(customersRef);
                } else if (Array.isArray(adminCompanyIds) && adminCompanyIds.length > 0) {
                    // Admin - load customers from connected companies
                    console.log(`📊 Loading customers from ${adminCompanyIds.length} connected companies`);
                    q = query(customersRef, where('companyID', 'in', adminCompanyIds));
                } else {
                    console.warn('No company IDs available for admin customer loading');
                    return;
                }
            } else {
                // Single company view
                q = query(customersRef, where('companyID', '==', companyIdForAddress));
            }

            const querySnapshot = await getDocs(q);
            const customersMap = {};
            querySnapshot.forEach(doc => {
                const customer = doc.data();
                const customerName = customer.name || customer.companyName;
                const customerData = {
                    id: doc.id,
                    customerID: customer.customerID,
                    name: customerName,
                    companyId: customer.companyID,
                    logo: customer.logo || customer.logoUrl || customer.logoURL || customer.companyLogo,
                    logoUrl: customer.logo || customer.logoUrl || customer.logoURL || customer.companyLogo
                };

                if (customerName) {
                    // Primary mapping: by customerID field (business ID like "EMENPR")
                    if (customer.customerID) {
                        customersMap[customer.customerID] = customerData;
                    }

                    // Secondary mapping: by document ID (for shipments that reference document IDs)
                    // This handles cases where shipments store document IDs like "EHFJtVsUe5XRaBuejQBC"
                    customersMap[doc.id] = customerData;
                }
            });
            setCustomers(customersMap);
            console.log(`📊 Loaded ${Object.keys(customersMap).length} customers for display`);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    }, [companyIdForAddress, adminViewMode, adminCompanyIds]);

    // Fetch companies data for advanced filters - SIMPLIFIED FUNCTION
    const fetchCompaniesData = useCallback(async () => {
        console.log('🔍 fetchCompaniesData called with:', { user: !!user, userRole, adminViewMode, companyIdForAddress });

        // Always try to load companies for the advanced filters
        try {
            const companiesRef = collection(db, 'companies');
            let q;

            // Load companies based on user role and view mode
            if (adminViewMode) {
                // Admin view - load companies based on user role and connected companies
                if (userRole === 'superadmin') {
                    // Super admin can see all companies
                    console.log('📊 Loading ALL companies data (super admin)');
                    q = query(companiesRef, orderBy('name', 'asc'));
                } else if (userRole === 'admin') {
                    // Admin users can see only connected companies
                    const connectedCompanyIds = user?.connectedCompanies || [];
                    console.log('📊 Loading connected companies data (admin):', connectedCompanyIds);

                    if (connectedCompanyIds.length > 0) {
                        if (connectedCompanyIds.length <= 10) {
                            q = query(companiesRef, where('companyID', 'in', connectedCompanyIds), orderBy('name', 'asc'));
                        } else {
                            // Load all and filter client-side for >10 companies
                            q = query(companiesRef, orderBy('name', 'asc'));
                        }
                    } else {
                        // Admin has no connected companies
                        console.log('📊 Admin has no connected companies');
                        setCompaniesData([]);
                        return;
                    }
                } else {
                    // Regular users shouldn't have admin view
                    console.log('📊 Regular user in admin view - no company access');
                    setCompaniesData([]);
                    return;
                }
            } else {
                // Frontend user view - only load current company context (no dropdown options)
                if (user && companyIdForAddress && companyIdForAddress !== 'all') {
                    console.log('📊 Loading single company data for frontend user:', companyIdForAddress);
                    q = query(companiesRef, where('companyID', '==', companyIdForAddress));
                } else {
                    // No company context for frontend user
                    console.log('📊 No company context for frontend user');
                    setCompaniesData([]);
                    return;
                }
            }

            if (q) {
                const querySnapshot = await getDocs(q);
                const companiesMap = {};
                let companiesArray = [];

                querySnapshot.forEach(doc => {
                    const company = doc.data();
                    if (company.companyID) {
                        const companyData = {
                            companyID: company.companyID,
                            companyName: company.name || company.companyName || company.companyID,
                            name: company.name || company.companyName || company.companyID,
                            // Keep legacy logo field for backward compatibility
                            logo: company.logoUrl || company.logo || company.logoURL || null,
                            logoUrl: company.logoUrl || company.logo || company.logoURL || null,
                            // Include the new multi-logo system
                            logos: company.logos || null,
                            status: company.status || 'active',
                            // CRITICAL: include connectedCarriers for carrier display overrides in table
                            connectedCarriers: Array.isArray(company.connectedCarriers) ? company.connectedCarriers : []
                        };

                        // For legacy compatibility (object format)
                        companiesMap[company.companyID] = companyData;
                        // For new Autocomplete (array format)
                        companiesArray.push(companyData);
                    }
                });

                // Apply client-side filtering for admins with >10 connected companies
                if (adminViewMode && userRole === 'admin') {
                    const connectedCompanyIds = user?.connectedCompanies || [];
                    if (connectedCompanyIds.length > 10) {
                        companiesArray = companiesArray.filter(company =>
                            connectedCompanyIds.includes(company.companyID)
                        );
                        console.log(`📊 Filtered to ${companiesArray.length} connected companies for admin`);
                    }
                }

                // Set both formats for different uses
                setCompaniesData(companiesArray);
                console.log(`📊 Loaded ${companiesArray.length} companies data`);
                console.log('📊 Company data loaded:', companiesMap);
            }
        } catch (error) {
            console.error('Error fetching companies data:', error);
            setCompaniesData([]);
        }
    }, [user, userRole, adminViewMode, adminCompanyIds, companyIdForAddress]);

    // Load invoice statuses for filtering
    const loadInvoiceStatuses = useCallback(async () => {
        try {
            // Clear the service cache to force fresh load of all statuses
            invoiceStatusService.clearCache();

            const statuses = await invoiceStatusService.loadInvoiceStatuses();
            setInvoiceStatuses(statuses);

        } catch (error) {
            console.error('❌ Error loading invoice statuses:', error);
            setInvoiceStatuses([]);
        }
    }, []);

    // Load shipment statuses for filtering
    const loadShipmentStatuses = useCallback(async () => {
        try {
            const statuses = await shipmentStatusService.loadMasterStatuses();
            setShipmentStatuses(statuses);
            console.log('🎨 ADVANCED FILTER STATUS COLORS DEBUG:', statuses.slice(0, 3).map(s => ({
                statusCode: s.statusCode,
                displayLabel: s.displayLabel,
                color: s.color,
                fontColor: s.fontColor
            })));
        } catch (error) {
            console.error('❌ Error loading shipment statuses:', error);
            setShipmentStatuses([]);
        }
    }, []);

    // Load address book data for Origin & Destination filters with hierarchical filtering
    const loadAddressBookData = useCallback(async (filterCompanyId = null, filterCustomerId = null) => {
        setLoadingAddresses(true);
        try {
            const addressBookRef = collection(db, 'addressBook');
            let q;

            console.log('🏠 Loading address book data with filters:', {
                filterCompanyId,
                filterCustomerId,
                adminViewMode,
                adminCompanyIds
            });

            // ✅ FIXED: Simplified base filters to avoid conflicts
            const baseFilters = [
                where('status', '!=', 'deleted')
            ];

            // ✅ Note: Using composite index for optimal database-level filtering

            // ✅ DYNAMIC COMPANY/CUSTOMER FILTERING AT DATABASE LEVEL
            if (filterCustomerId) {
                // Customer filter takes priority - load addresses for specific customer
                console.log('🏠 Filtering by customer at database level:', filterCustomerId);

                // ✅ DATABASE-LEVEL FILTERING: Use addressClassID for customer filtering
                q = query(
                    addressBookRef,
                    where('addressClassID', '==', filterCustomerId),
                    ...baseFilters
                );

                console.log('🏠 Database query filtering by addressClassID:', filterCustomerId);
                console.log('🔍 Executing query with baseFilters:', baseFilters);
            } else if (filterCompanyId) {
                // Company filter - load addresses for specific company
                console.log('🏠 Filtering by company at database level:', filterCompanyId);

                // ✅ DATABASE-LEVEL FILTERING: Use companyID for company filtering
                q = query(
                    addressBookRef,
                    where('companyID', '==', filterCompanyId),
                    ...baseFilters
                );

                console.log('🏠 Database query filtering by companyID:', filterCompanyId);
            } else if (adminViewMode === 'all') {
                // Super admin: load all addresses when no specific filters
                console.log('🏠 Super admin - loading all addresses');
                q = query(addressBookRef, ...baseFilters);
            } else if (adminViewMode && adminCompanyIds && Array.isArray(adminCompanyIds)) {
                // Admin: load addresses from connected companies
                if (adminCompanyIds.length <= 10) {
                    console.log('🏠 Admin - loading addresses from connected companies:', adminCompanyIds);
                    q = query(
                        addressBookRef,
                        where('companyID', 'in', adminCompanyIds),
                        ...baseFilters
                    );
                } else {
                    // Load all and filter client-side for >10 companies
                    console.log('🏠 Admin - loading all addresses (>10 companies, will filter client-side)');
                    q = query(addressBookRef, ...baseFilters);
                }
            } else if (companyIdForAddress) {
                // Regular user: load only their company's addresses
                console.log('🏠 Regular user - loading company addresses:', companyIdForAddress);
                q = query(
                    addressBookRef,
                    where('companyID', '==', companyIdForAddress),
                    ...baseFilters
                );
            } else {
                // No company context - load all addresses for super admins
                console.log('🏠 No context - loading all addresses');
                q = query(addressBookRef, ...baseFilters);
            }

            console.log('🔍 About to execute Firestore query...');
            const snapshot = await getDocs(q);
            console.log(`📊 Raw Firestore query returned ${snapshot.docs.length} addresses`);

            let addresses = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Debug: Show first few raw addresses from database
            console.log('🔍 First 3 raw addresses from database:', addresses.slice(0, 3));

            // ✅ CLIENT-SIDE FILTERING FOR ADMIN WITH >10 COMPANIES
            if (!filterCustomerId && !filterCompanyId && adminViewMode && adminCompanyIds && Array.isArray(adminCompanyIds) && adminCompanyIds.length > 10) {
                addresses = addresses.filter(addr => adminCompanyIds.includes(addr.companyID));
                console.log(`🏠 Client-side filtered from ${snapshot.docs.length} to ${addresses.length} addresses for ${adminCompanyIds.length} companies`);
            }

            // ✅ ENHANCED: Apply client-side filtering for customer/company selections
            if (filterCustomerId) {
                // Filter addresses that match the customer in either field
                const originalCount = addresses.length;

                // ✅ DEBUG: Show sample addresses before filtering
                console.log(`🔍 DEBUG: Customer filter "${filterCustomerId}" - Sample addresses:`);
                addresses.slice(0, 5).forEach((addr, index) => {
                    console.log(`  Address ${index + 1}:`, {
                        nickname: addr.nickname,
                        addressClassID: addr.addressClassID,
                        customerID: addr.customerID,
                        companyID: addr.companyID,
                        companyName: addr.companyName,
                        addressClass: addr.addressClass,
                        addressType: addr.addressType
                    });
                });

                addresses = addresses.filter(addr => {
                    const matches = addr.addressClassID === filterCustomerId ||
                        addr.customerID === filterCustomerId;

                    // Debug each address that should match
                    if (addr.addressClassID === filterCustomerId || addr.customerID === filterCustomerId) {
                        console.log(`✅ FOUND MATCH for "${filterCustomerId}": ${addr.nickname}`, {
                            addressClassID: addr.addressClassID,
                            customerID: addr.customerID
                        });
                    }

                    return matches;
                });
                console.log(`🏠 Customer filter: ${originalCount} → ${addresses.length} addresses (${filterCustomerId})`);

                // ✅ ENHANCED: If no customer addresses found but company is also selected, try company filter
                if (addresses.length === 0 && filterCompanyId) {
                    console.log(`🔄 No customer addresses found, falling back to company filter: ${filterCompanyId}`);
                    addresses = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })).filter(addr =>
                        addr.companyID === filterCompanyId ||
                        addr.ownerCompanyID === filterCompanyId ||
                        addr.addressClassID === filterCompanyId
                    );
                    console.log(`🏠 Company fallback filter: ${originalCount} → ${addresses.length} addresses (${filterCompanyId})`);
                }
            } else if (filterCompanyId) {
                // Filter addresses that match the company in multiple fields
                const originalCount = addresses.length;

                // ✅ ENHANCED DEBUG: Show what we're filtering for and what we found
                console.log(`🔍 DETAILED COMPANY FILTER DEBUG for "${filterCompanyId}":`);
                console.log('🔍 Original addresses count:', originalCount);

                if (originalCount > 0) {
                    console.log('🔍 Sample address data:', addresses.slice(0, 3).map(addr => ({
                        nickname: addr.nickname,
                        companyID: addr.companyID,
                        ownerCompanyID: addr.ownerCompanyID,
                        addressClassID: addr.addressClassID,
                        customerID: addr.customerID
                    })));
                }

                addresses = addresses.filter(addr => {
                    const matches = addr.companyID === filterCompanyId ||
                        addr.ownerCompanyID === filterCompanyId ||
                        addr.addressClassID === filterCompanyId;

                    // Debug each address that doesn't match
                    if (!matches && addr.nickname) {
                        console.log(`❌ "${addr.nickname}" doesn't match "${filterCompanyId}":`, {
                            companyID: addr.companyID,
                            ownerCompanyID: addr.ownerCompanyID,
                            addressClassID: addr.addressClassID
                        });
                    }

                    return matches;
                });

                console.log(`🏠 Company filter: ${originalCount} → ${addresses.length} addresses (${filterCompanyId})`);

                // ✅ DEBUG: Show what company IDs are found in the addresses BEFORE filtering
                if (addresses.length === 0 && originalCount > 0) {
                    console.log(`🔍 DEBUG: No addresses found after filtering for company "${filterCompanyId}"`);
                    console.log('🔍 DEBUG: Loading fresh sample to see available company IDs...');

                    // Get sample of original addresses to see what company IDs exist
                    const sampleQuery = query(addressBookRef, ...baseFilters, limit(10));
                    getDocs(sampleQuery).then(sampleSnapshot => {
                        const sampleAddresses = sampleSnapshot.docs.map(doc => doc.data());
                        console.log('🔍 DEBUG: Complete address field analysis:',
                            sampleAddresses.map(addr => ({
                                nickname: addr.nickname,
                                companyID: addr.companyID,
                                ownerCompanyID: addr.ownerCompanyID,
                                addressClassID: addr.addressClassID,
                                customerID: addr.customerID,
                                companyName: addr.companyName,
                                ownerCompanyName: addr.ownerCompanyName,
                                // Show ALL company-related fields to find the right one
                                allCompanyFields: Object.keys(addr).filter(key =>
                                    key.toLowerCase().includes('company') ||
                                    key.toLowerCase().includes('owner')
                                ).reduce((obj, key) => ({ ...obj, [key]: addr[key] }), {})
                            }))
                        );

                        // Look specifically for any addresses that might be Tyger Shark
                        const tygerSharkAddresses = sampleAddresses.filter(addr =>
                            JSON.stringify(addr).toLowerCase().includes('tyger') ||
                            JSON.stringify(addr).toLowerCase().includes('shark') ||
                            JSON.stringify(addr).toLowerCase().includes('ts') ||
                            JSON.stringify(addr).toLowerCase().includes('fantom')
                        );

                        if (tygerSharkAddresses.length > 0) {
                            console.log('🎯 DEBUG: Found potential Tyger Shark addresses:', tygerSharkAddresses);
                        } else {
                            console.log('❌ DEBUG: No Tyger Shark related addresses found in sample');
                        }
                    });
                }
            }

            setAddressBookData(addresses);
            console.log(`📍 Loaded ${addresses.length} addresses for origin/destination filters`);

            // ✅ DEBUG: Show sample addresses for troubleshooting
            if (addresses.length > 0) {
                console.log('🏠 Sample addresses loaded:', addresses.slice(0, 3).map(addr => ({
                    nickname: addr.nickname,
                    companyID: addr.companyID,
                    addressClassID: addr.addressClassID,
                    addressType: addr.addressType,
                    city: addr.city
                })));
            } else {
                console.log('❌ No addresses loaded - check filters and data');
            }
        } catch (error) {
            console.error('Error loading address book data:', error);
            setAddressBookData([]);
        } finally {
            setLoadingAddresses(false);
        }
    }, [companyIdForAddress, adminViewMode, adminCompanyIds]);

    // Reload addresses when company or customer filter changes
    useEffect(() => {
        console.log('🔄 Address book reload triggered by filter changes:', {
            companyId: advancedFilters.companyId,
            customerId: advancedFilters.customerId
        });

        // ✅ ALWAYS reload addresses when filters change (even if both are set)
        loadAddressBookData(advancedFilters.companyId, advancedFilters.customerId);
    }, [loadAddressBookData, advancedFilters.companyId, advancedFilters.customerId]);

    // ✅ ENHANCED: Get destination addresses with proper type filtering  
    const getDestinationAddresses = useMemo(() => {
        // Destination addresses: destination, delivery, both, or null/empty (assume both)
        const destinationAddresses = addressBookData.filter(addr => {
            const addressType = addr.addressType?.toLowerCase();
            return !addressType || addressType === 'destination' || addressType === 'delivery' || addressType === 'both';
        });

        console.log(`🎯 Destination addresses available: ${destinationAddresses.length} out of ${addressBookData.length} total`);
        console.log(`🎯 Filtering based on selections:`, {
            companyId: advancedFilters.companyId,
            customerId: advancedFilters.customerId
        });

        if (destinationAddresses.length === 0 && addressBookData.length > 0) {
            console.log('🎯 Sample address types for troubleshooting:', addressBookData.slice(0, 3).map(addr => ({
                nickname: addr.nickname,
                addressType: addr.addressType
            })));
        }

        // ✅ SIMPLIFIED: Since we're now filtering at database level, 
        // the addressBookData already contains the right addresses
        console.log(`🏠 Using database-filtered addresses: ${destinationAddresses.length} total`);
        return destinationAddresses;
    }, [addressBookData, advancedFilters.companyId, advancedFilters.customerId]);

    // ✅ SIMPLIFIED: All addresses are 'destination' type - just places that can be used for origin too
    const getOriginAddresses = useMemo(() => {
        console.log(`🚀 Origin addresses (all destination addresses): ${addressBookData.length} total`);
        return addressBookData;  // ✅ All addresses can be used for origin
    }, [addressBookData]);

    // Build company data map for rows: admin → multi-company map, user → current company context
    const companyDataForRows = useMemo(() => {
        if (adminViewMode) return companiesData || {};
        if (companyIdForAddress && companyData) {
            return { [companyIdForAddress]: companyData };
        }
        return {};
    }, [adminViewMode, companiesData, companyIdForAddress, companyData]);

    // Fetch carrier information from shipmentRates collection - optimized
    const fetchCarrierData = useCallback(async (shipmentIds) => {
        if (!shipmentIds || shipmentIds.length === 0) return;

        try {
            const carrierMap = {};

            // Batch process carrier data instead of individual queries
            const shipmentRatesRef = collection(db, 'shipmentRates');
            const promises = shipmentIds.map(async (shipmentId) => {
                const q = query(shipmentRatesRef, where('shipmentId', '==', shipmentId));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const rates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const selectedRate = rates.find(rate => rate.status === 'selected_in_ui' || rate.status === 'pending') || rates[0];

                    if (selectedRate) {
                        return {
                            shipmentId,
                            data: {
                                // Only essential fields for table display
                                carrier: selectedRate.carrier,
                                service: selectedRate.service,
                                displayCarrierId: selectedRate.displayCarrierId,
                                sourceCarrierName: selectedRate.sourceCarrierName,
                                totalCharges: selectedRate.totalCharges,
                                transitDays: selectedRate.transitDays
                            }
                        };
                    }
                }
                return null;
            });

            const results = await Promise.all(promises);
            results.forEach(result => {
                if (result) {
                    carrierMap[result.shipmentId] = result.data;
                }
            });

            setCarrierData(prev => ({ ...prev, ...carrierMap }));
        } catch (error) {
            console.error('Error fetching carrier data:', error);
        }
    }, []);

    // Load shipments - optimized for performance
    const loadShipments = useCallback(async (currentTab = null, searchTerm = null, forceInvoiceStatus = null, forceShipmentStatus = null, advancedFiltersParam = null) => {
        // Check if we're in admin "all companies" mode
        const isAdminAllView = adminViewMode === 'all';

        if (!companyIdForAddress && !isAdminAllView) {
            setShipments([]);
            setAllShipments([]);
            setTotalCount(0);
            return;
        }

        // Use provided tab or current selectedTab
        const activeTab = currentTab || selectedTab;
        // CRITICAL FIX: Use provided search term or current unifiedSearch state
        const currentSearchTerm = searchTerm !== null ? searchTerm : unifiedSearch;
        console.log(`🏷️ Loading shipments for tab: ${activeTab}, adminViewMode: ${adminViewMode}, searchTerm: ${currentSearchTerm}`);

        setLoading(true);
        try {
            const shipmentsRef = collection(db, 'shipments');
            let q;

            // 🔥 CRITICAL FIX: Check if a specific company is selected in advanced filters
            const selectedCompanyFromFilter = advancedFiltersParam?.companyId;
            let targetCompanyIds;

            if (selectedCompanyFromFilter) {
                // Advanced filter company selection overrides everything
                console.log(`🎯 ADVANCED FILTER: Loading shipments for specific company: ${selectedCompanyFromFilter}`);
                targetCompanyIds = [selectedCompanyFromFilter];
            } else if (isAdminAllView) {
                // Admin viewing all companies (no specific filter)
                if (adminCompanyIds === 'all') {
                    console.log('📊 Loading ALL shipments (super admin view) with limit');
                    targetCompanyIds = 'all';
                } else {
                    console.log(`📊 Loading shipments from ${adminCompanyIds.length} connected companies`);
                    targetCompanyIds = adminCompanyIds;
                }
            } else {
                // Single company view (frontend user)
                console.log(`📊 Loading shipments for single company: ${companyIdForAddress}`);
                targetCompanyIds = [companyIdForAddress];
            }

            // Build query based on target companies
            if (targetCompanyIds === 'all') {
                // Super admin - load all shipments (with limit for performance)
                q = query(shipmentsRef, orderBy('createdAt', 'desc'), limit(1000));
            } else if (Array.isArray(targetCompanyIds) && targetCompanyIds.length > 0) {
                // Load shipments from specific companies
                if (targetCompanyIds.length === 1) {
                    // Single company query (most efficient)
                    console.log(`📊 Loading shipments for single company: ${targetCompanyIds[0]}`);
                    q = query(
                        shipmentsRef,
                        where('companyID', '==', targetCompanyIds[0]),
                        orderBy('createdAt', 'desc'),
                        limit(1000)
                    );
                } else if (targetCompanyIds.length <= 10) {
                    // Multiple companies within Firestore 'in' limit
                    console.log(`📊 Loading shipments from ${targetCompanyIds.length} companies (in query)`);
                    q = query(
                        shipmentsRef,
                        where('companyID', 'in', targetCompanyIds),
                        orderBy('createdAt', 'desc'),
                        limit(1000)
                    );
                } else {
                    // For >10 companies, load all shipments and filter client-side
                    console.log(`📊 Loading ALL shipments and filtering client-side (${targetCompanyIds.length} companies > 10 limit)`);
                    q = query(shipmentsRef, orderBy('createdAt', 'desc'), limit(1000));
                }
            } else {
                // Fallback - no companies to load from
                console.warn('No company IDs available for shipment loading');
                setShipments([]);
                setAllShipments([]);
                setFilteredShipments([]);
                setTotalCount(0);
                return;
            }

            const querySnapshot = await getDocs(q);
            let shipmentsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`📊 Loaded ${shipmentsData.length} total shipments from database (sorted by createdAt)`);

            // 🔍 DEBUG: Check if our target shipment ICAL-227B8E is in the initial results
            const targetShipment = shipmentsData.find(s => s.shipmentID === 'ICAL-227B8E');
            if (targetShipment) {
                console.log('🎯 DEBUG: Found target shipment ICAL-227B8E in initial results:', {
                    shipmentID: targetShipment.shipmentID,
                    companyID: targetShipment.companyID,
                    status: targetShipment.status,
                    createdAt: targetShipment.createdAt
                });
            } else {
                console.log('❌ DEBUG: Target shipment ICAL-227B8E NOT found in initial database results');
                console.log('🔍 DEBUG: Sample shipment IDs from database:', shipmentsData.slice(0, 5).map(s => s.shipmentID || s.id));
            }

            // Apply client-side company filtering if we loaded all shipments due to >10 companies
            if (Array.isArray(targetCompanyIds) && targetCompanyIds.length > 10) {
                const originalCount = shipmentsData.length;
                shipmentsData = shipmentsData.filter(shipment =>
                    targetCompanyIds.includes(shipment.companyID)
                );
                console.log(`📊 Client-side filtered from ${originalCount} to ${shipmentsData.length} shipments for ${targetCompanyIds.length} companies`);
            }

            // CRITICAL: Exclude archived shipments from ALL views
            const beforeArchiveFilter = shipmentsData.length;
            shipmentsData = shipmentsData.filter(s => {
                const status = s.status?.toLowerCase()?.trim();
                const isArchived = status === 'archived';

                // 🔍 DEBUG: Check if target shipment is being filtered out here
                if (s.shipmentID === 'ICAL-227B8E') {
                    console.log('🎯 DEBUG: Target shipment archive filter check:', {
                        shipmentID: s.shipmentID,
                        status: s.status,
                        normalizedStatus: status,
                        isArchived: isArchived,
                        willBeFiltered: isArchived
                    });
                }

                return !isArchived;
            });

            console.log(`📊 After excluding archived: ${shipmentsData.length} shipments remaining (filtered out ${beforeArchiveFilter - shipmentsData.length} archived)`);

            // 🔍 DEBUG: Check if target is still present after archive filtering
            const targetAfterArchive = shipmentsData.find(s => s.shipmentID === 'ICAL-227B8E');
            if (targetAfterArchive) {
                console.log('✅ DEBUG: Target shipment ICAL-227B8E survived archive filtering');
            } else {
                console.log('❌ DEBUG: Target shipment ICAL-227B8E was filtered out during archive filtering');
            }

            // Store all shipments for stats
            setAllShipments(shipmentsData);

            // Apply tab filter with simple, direct status matching
            console.log(`🏷️ Filtering for tab: ${activeTab}`);

            if (activeTab === 'all') {
                // "All" tab excludes drafts and pending review
                const beforeTabFilter = shipmentsData.length;
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    const isDraft = status === 'draft';

                    // 🔍 DEBUG: Check if target shipment passes "all" tab filter
                    if (s.shipmentID === 'ICAL-227B8E') {
                        console.log('🎯 DEBUG: Target shipment "all" tab filter check:', {
                            shipmentID: s.shipmentID,
                            status: s.status,
                            normalizedStatus: status,
                            isDraft: isDraft,
                            willPassFilter: !isDraft
                        });
                    }

                    return !isDraft;
                });
                console.log(`📊 "All" tab filter: ${beforeTabFilter} → ${shipmentsData.length} shipments`);
            } else if (activeTab === 'draft') {
                // Draft tab includes only drafts WITHOUT pending_review flag
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'draft' && s.pending_review !== true;
                });
            } else if (activeTab === 'pending_review') {
                // Pending review tab includes only drafts WITH pending_review flag
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'draft' && s.pending_review === true;
                });
            } else if (activeTab === 'Awaiting Shipment') {
                // Pre-shipment statuses: pending, scheduled, booked, awaiting_shipment
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'pending' ||
                        status === 'scheduled' ||
                        status === 'booked' ||
                        status === 'awaiting_shipment' ||
                        status === 'ready_to_ship' ||
                        status === 'label_created';
                });
            } else if (activeTab === 'In Transit') {
                // Transit statuses: in_transit, picked_up, on_route
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'in_transit' ||
                        status === 'in transit' ||
                        status === 'picked_up' ||
                        status === 'on_route' ||
                        status === 'out_for_delivery';
                });
            } else if (activeTab === 'Delivered') {
                // Delivered statuses
                const beforeDeliveredFilter = shipmentsData.length;
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    const isDelivered = status === 'delivered' || status === 'completed';

                    // 🔍 DEBUG: Check if target shipment passes "Delivered" tab filter
                    if (s.shipmentID === 'ICAL-227B8E') {
                        console.log('🎯 DEBUG: Target shipment "Delivered" tab filter check:', {
                            shipmentID: s.shipmentID,
                            status: s.status,
                            normalizedStatus: status,
                            isDelivered: isDelivered,
                            willPassFilter: isDelivered
                        });
                    }

                    return isDelivered;
                });
                console.log(`📊 "Delivered" tab filter: ${beforeDeliveredFilter} → ${shipmentsData.length} shipments`);
            } else if (activeTab === 'Cancelled') {
                // Cancelled statuses
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'cancelled' ||
                        status === 'canceled' ||
                        status === 'void' ||
                        status === 'voided';
                });
            } else if (activeTab === 'Delayed') {
                // Delayed/exception statuses
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'delayed' ||
                        status === 'on_hold' ||
                        status === 'exception' ||
                        status === 'returned' ||
                        status === 'damaged';
                });
            }

            console.log(`🔍 After tab filter: ${shipmentsData.length} shipments remaining`);

            // ENTERPRISE SEARCH AND FILTER SYSTEM
            let filteredData = [...shipmentsData];

            // 1. APPLY UNIFIED SEARCH (Primary search - wildcard across ALL fields including DRAFTS)
            console.log('🔍 DEBUG - Checking unified search:', {
                unifiedSearch: currentSearchTerm,
                trimmed: currentSearchTerm?.trim(),
                hasValue: !!(currentSearchTerm && currentSearchTerm.trim()),
                filteredDataCount: filteredData.length
            });

            if (currentSearchTerm && currentSearchTerm.trim()) {
                console.log('🚀 ENTERPRISE UNIFIED SEARCH INCLUDING DRAFTS:', currentSearchTerm);
                console.log('🔍 Input data before search:', filteredData.length, 'shipments (tab-filtered)');
                console.log('🔍 All shipments available for search:', allShipments.length, 'shipments (including drafts)');

                // 🧠 USE SEMANTIC SEARCH RESULTS IF AVAILABLE (search across ALL shipments)
                if (isSemanticMode && semanticSearchResults && semanticSearchResults.results) {
                    console.log('🧠 Using semantic search results for filtering', semanticSearchResults.results.length, 'results');
                    // The semantic search results ARE the filtered shipments, not just IDs
                    // Apply tab filter to semantic results since they include drafts
                    let semanticFilteredResults = semanticSearchResults.results;

                    // Apply the same tab filtering to semantic results
                    if (activeTab === 'all') {
                        // 🐛 BUG FIX: Include drafts in "All" tab when searching by shipment ID
                        const isShipmentIdSearch = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/i.test(currentSearchTerm.trim()) ||
                            /^[A-Z0-9]{8,}$/i.test(currentSearchTerm.trim());

                        if (isShipmentIdSearch) {
                            // When searching by shipment ID, include drafts in "All" tab results
                            console.log('🔍 Semantic: Shipment ID search detected - including drafts in "All" tab results');
                            // Keep all semantic results including drafts
                        } else {
                            // Regular filtering - exclude drafts from "All" tab
                            semanticFilteredResults = semanticFilteredResults.filter(s => {
                                const status = s.status?.toLowerCase()?.trim();
                                return status !== 'draft';
                            });
                        }
                    } else if (activeTab === 'draft') {
                        semanticFilteredResults = semanticFilteredResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'draft';
                        });
                    } else if (activeTab === 'Awaiting Shipment') {
                        semanticFilteredResults = semanticFilteredResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'pending' || status === 'scheduled' || status === 'booked' ||
                                status === 'awaiting_shipment' || status === 'ready_to_ship' || status === 'label_created';
                        });
                    } else if (activeTab === 'In Transit') {
                        semanticFilteredResults = semanticFilteredResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'in_transit' || status === 'in transit' || status === 'picked_up' ||
                                status === 'on_route' || status === 'out_for_delivery';
                        });
                    } else if (activeTab === 'Delivered') {
                        semanticFilteredResults = semanticFilteredResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'delivered' || status === 'completed';
                        });
                    } else if (activeTab === 'Cancelled') {
                        semanticFilteredResults = semanticFilteredResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'cancelled' || status === 'canceled' || status === 'void' || status === 'voided';
                        });
                    } else if (activeTab === 'Delayed') {
                        semanticFilteredResults = semanticFilteredResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'delayed' || status === 'on_hold' || status === 'exception' ||
                                status === 'returned' || status === 'damaged';
                        });
                    }

                    filteredData = semanticFilteredResults;
                    console.log(`🧠 After semantic search + tab filter: ${filteredData.length} shipments remaining`);
                } else {
                    // Fallback to regular unified search - search ALL shipments then apply tab filter
                    console.log('🔍 Calling performUnifiedSearch on ALL shipments (including drafts)');

                    // DEBUG: Log what data we're searching
                    console.log('🔍 DEBUG - Search input data:', {
                        searchTerm: currentSearchTerm,
                        totalDocsFromQuery: querySnapshot.docs.length,
                        isAdminAllView,
                        adminCompanyIds,
                        companyIdForAddress,
                        customerCount: Object.keys(customers).length,
                        carrierDataCount: Object.keys(carrierData).length
                    });

                    // CRITICAL FIX: Use the unfiltered allShipments to search across ALL data
                    // This ensures we search everything BEFORE applying tab filters
                    const allUnfilteredShipments = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    })).filter(s => {
                        // Only exclude archived shipments from search
                        const status = s.status?.toLowerCase()?.trim();
                        return status !== 'archived';
                    });

                    // DEBUG: Sample some shipments to see what we're searching
                    console.log('🔍 DEBUG - Sample shipments being searched:',
                        allUnfilteredShipments.slice(0, 3).map(s => ({
                            id: s.shipmentID || s.id,
                            fromCity: s.shipFrom?.city,
                            toCity: s.shipTo?.city,
                            toCompany: s.shipTo?.company || s.shipTo?.companyName,
                            status: s.status
                        }))
                    );

                    const searchResults = performUnifiedSearch(allUnfilteredShipments, currentSearchTerm, customers, carrierData);
                    console.log(`🔍 Search found ${searchResults.length} results across ${allUnfilteredShipments.length} shipments`);

                    // 🔍 DEBUG: Check if target shipment is in search results
                    const targetInSearch = searchResults.find(s => s.shipmentID === 'ICAL-227B8E');
                    if (targetInSearch) {
                        console.log('✅ DEBUG: Target shipment ICAL-227B8E found in search results');
                    } else {
                        console.log('❌ DEBUG: Target shipment ICAL-227B8E NOT found in search results');
                        console.log('🔍 DEBUG: Search term used:', currentSearchTerm);
                    }

                    // Now apply tab filter to search results
                    if (activeTab === 'all') {
                        // 🐛 BUG FIX: Include drafts in "All" tab when searching by shipment ID
                        const isShipmentIdSearch = /^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$/i.test(currentSearchTerm.trim()) ||
                            /^[A-Z0-9]{8,}$/i.test(currentSearchTerm.trim());

                        if (isShipmentIdSearch) {
                            // When searching by shipment ID, include drafts in "All" tab results
                            console.log('🔍 Shipment ID search detected - including drafts in "All" tab results');
                            filteredData = searchResults; // Include all search results including drafts
                        } else {
                            // Regular filtering - exclude drafts from "All" tab
                            filteredData = searchResults.filter(s => {
                                const status = s.status?.toLowerCase()?.trim();
                                return status !== 'draft';
                            });
                        }
                    } else if (activeTab === 'draft') {
                        filteredData = searchResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'draft';
                        });
                    } else if (activeTab === 'Awaiting Shipment') {
                        filteredData = searchResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'pending' || status === 'scheduled' || status === 'booked' ||
                                status === 'awaiting_shipment' || status === 'ready_to_ship' || status === 'label_created';
                        });
                    } else if (activeTab === 'In Transit') {
                        filteredData = searchResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'in_transit' || status === 'in transit' || status === 'picked_up' ||
                                status === 'on_route' || status === 'out_for_delivery';
                        });
                    } else if (activeTab === 'Delivered') {
                        filteredData = searchResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'delivered' || status === 'completed';
                        });
                    } else if (activeTab === 'Cancelled') {
                        filteredData = searchResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'cancelled' || status === 'canceled' || status === 'void' || status === 'voided';
                        });
                    } else if (activeTab === 'Delayed') {
                        filteredData = searchResults.filter(s => {
                            const status = s.status?.toLowerCase()?.trim();
                            return status === 'delayed' || status === 'on_hold' || status === 'exception' ||
                                status === 'returned' || status === 'damaged';
                        });
                    }

                    console.log(`🔍 After unified search + tab filter: ${filteredData.length} shipments remaining`);
                }
            }

            // 1.5. APPLY ADVANCED FILTERS (comprehensive filtering system)
            // ✅ FIXED: companyId is now properly handled at database level above
            // Exclude companyId from client-side filter detection since it's handled in the database query
            const advancedFiltersWithoutCompany = { ...advancedFiltersParam };
            delete advancedFiltersWithoutCompany.companyId;

            if (advancedFiltersParam && Object.values(advancedFiltersWithoutCompany).some(val =>
                val !== '' && val !== null && (!Array.isArray(val) || val.some(v => v !== null))
            )) {
                console.log('🎯 Applying advanced filters (excluding companyId):', advancedFiltersWithoutCompany);
                console.log('🎯 Full advanced filters object:', advancedFiltersParam);

                const beforeAdvancedFilter = filteredData.length;
                // 🔍 DEBUG: Check if target is in the data before advanced filtering
                const targetBeforeAdvanced = filteredData.find(s => s.shipmentID === 'ICAL-227B8E');
                if (targetBeforeAdvanced) {
                    console.log('✅ DEBUG: Target shipment ICAL-227B8E found BEFORE advanced filtering');
                } else {
                    console.log('❌ DEBUG: Target shipment ICAL-227B8E NOT found before advanced filtering');
                }

                filteredData = filteredData.filter(shipment => {
                    // 🔍 DEBUG: Track filtering for target shipment
                    if (shipment.shipmentID === 'ICAL-227B8E') {
                        console.log('🎯 DEBUG: Processing target shipment through advanced filters:', {
                            shipmentID: shipment.shipmentID,
                            advancedFilters: advancedFiltersParam
                        });
                    }
                    // ========== BASIC INFORMATION FILTERS ==========
                    // ✅ FIXED: Company filtering is now handled at the database query level above
                    // When a company is selected in advanced filters, we query only that company's shipments
                    // No client-side company filtering needed here

                    if (advancedFiltersParam.customerId) {
                        console.log(`🔍 DEBUG: Advanced customer filter active for: "${advancedFiltersParam.customerId}"`);

                        // ✅ COMPREHENSIVE: Handle both customer ID and customer name selections
                        const shipmentCustomerId = shipment?.customerId ||
                            shipment?.customerID ||
                            shipment?.customer?.id ||
                            shipment?.shipFrom?.customerID ||
                            shipment?.shipFrom?.customerId ||
                            shipment?.shipFrom?.addressClassID;

                        const customerNameFromMap = customers[shipmentCustomerId];

                        // ✅ SPECIAL HANDLING: For TEMSPEC, match both customer IDs that belong to the same customer
                        const isTemspecFilter = advancedFiltersParam.customerId === 'TEMSPE';
                        const temspecCustomerIds = ['TEMSPE', '65MQ6skvMVZ6Z9Zj2Sk5']; // Both IDs belong to Temspec Inc.

                        // Match by ID, name mapping, or company name
                        const match1 = shipmentCustomerId === advancedFiltersParam.customerId;
                        const match2 = customerNameFromMap === advancedFiltersParam.customerId;
                        const match3 = shipment.shipTo?.company === advancedFiltersParam.customerId;
                        const match4 = Object.entries(customers).some(([id, customerData]) =>
                            id === shipmentCustomerId &&
                            (customerData.name === advancedFiltersParam.customerId ||
                                customerData.companyName === advancedFiltersParam.customerId)
                        );
                        // ✅ NEW: Special case for TEMSPEC - match both customer IDs
                        const match5 = isTemspecFilter && temspecCustomerIds.includes(shipmentCustomerId);

                        const matches = [match1, match2, match3, match4, match5].some(Boolean);

                        if (!matches) {
                            console.log(`❌ FILTERED OUT: ${shipment.shipmentID || shipment.id} - shipmentCustomerId: "${shipmentCustomerId}", shipTo.company: "${shipment.shipTo?.company || 'none'}"`);
                            return false;
                        } else {
                            console.log(`✅ MATCHED: ${shipment.shipmentID || shipment.id} - matches: [${match1}, ${match2}, ${match3}, ${match4}, ${match5}]`);
                        }
                    }

                    if (advancedFiltersParam.shipmentType && shipment.shipmentType !== advancedFiltersParam.shipmentType) {
                        return false;
                    }

                    // Shipment IDs array filter
                    if (advancedFiltersParam.shipmentIds && Array.isArray(advancedFiltersParam.shipmentIds) && advancedFiltersParam.shipmentIds.length > 0) {
                        const shipmentIdMatch = advancedFiltersParam.shipmentIds.some(id =>
                            shipment.shipmentID?.toLowerCase().includes(id.toLowerCase()) ||
                            shipment.id?.toLowerCase().includes(id.toLowerCase())
                        );
                        if (!shipmentIdMatch) return false;
                    }

                    // ========== BILLING & INVOICE FILTERS ==========
                    if (advancedFiltersParam.billType && shipment.billingDetails?.billType !== advancedFiltersParam.billType) {
                        return false;
                    }

                    if (advancedFiltersParam.invoiceStatus) {
                        const shipmentInvoiceStatus = shipment.invoiceStatus || 'uninvoiced';
                        if (shipmentInvoiceStatus !== advancedFiltersParam.invoiceStatus) {
                            return false;
                        }
                    }

                    // ========== TIMING INFORMATION FILTERS ==========

                    // Created At date range
                    if (advancedFiltersParam.createdAt && advancedFiltersParam.createdAt[0]) {
                        const shipmentCreatedDate = shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt);
                        const startDate = advancedFiltersParam.createdAt[0].startOf('day').toDate();
                        const endDate = advancedFiltersParam.createdAt[1] ?
                            advancedFiltersParam.createdAt[1].endOf('day').toDate() :
                            advancedFiltersParam.createdAt[0].endOf('day').toDate(); // Use same date if no end date
                        if (shipmentCreatedDate < startDate || shipmentCreatedDate > endDate) {
                            return false;
                        }
                    }

                    // Shipment Date range
                    if (advancedFiltersParam.shipmentDate && advancedFiltersParam.shipmentDate[0]) {
                        const shipmentDate = shipment.shipmentDate || shipment.shipmentInfo?.shipmentDate;
                        if (shipmentDate) {
                            const shipDate = new Date(shipmentDate);
                            const startDate = advancedFiltersParam.shipmentDate[0].startOf('day').toDate();
                            const endDate = advancedFiltersParam.shipmentDate[1] ?
                                advancedFiltersParam.shipmentDate[1].endOf('day').toDate() :
                                advancedFiltersParam.shipmentDate[0].endOf('day').toDate(); // Use same date if no end date
                            if (shipDate < startDate || shipDate > endDate) {
                                return false;
                            }
                        }
                    }

                    // ETA date range (searches both eta1 and eta2)
                    if (advancedFiltersParam.eta1 && advancedFiltersParam.eta1[0]) {
                        const startDate = advancedFiltersParam.eta1[0].startOf('day').toDate();
                        const endDate = advancedFiltersParam.eta1[1] ?
                            advancedFiltersParam.eta1[1].endOf('day').toDate() :
                            advancedFiltersParam.eta1[0].endOf('day').toDate(); // Use same date if no end date

                        // Check both eta1 and eta2 dates
                        const eta1Date = shipment.eta1;
                        const eta2Date = shipment.eta2;
                        const estimatedDeliveryDate = shipment.carrierBookingConfirmation?.estimatedDeliveryDate ||
                            shipment.selectedRate?.transit?.estimatedDelivery ||
                            shipment.selectedRate?.estimatedDeliveryDate;

                        let hasMatchingETA = false;

                        if (eta1Date) {
                            const etaDate = new Date(eta1Date);
                            if (etaDate >= startDate && etaDate <= endDate) {
                                hasMatchingETA = true;
                            }
                        }

                        if (!hasMatchingETA && eta2Date) {
                            const etaDate = new Date(eta2Date);
                            if (etaDate >= startDate && etaDate <= endDate) {
                                hasMatchingETA = true;
                            }
                        }

                        if (!hasMatchingETA && estimatedDeliveryDate) {
                            const etaDate = new Date(estimatedDeliveryDate);
                            if (etaDate >= startDate && etaDate <= endDate) {
                                hasMatchingETA = true;
                            }
                        }

                        if (!hasMatchingETA) {
                            return false;
                        }
                    }



                    // Last Updated date range
                    if (advancedFiltersParam.lastUpdated && advancedFiltersParam.lastUpdated[0] && advancedFiltersParam.lastUpdated[1]) {
                        const lastUpdatedDate = shipment.updatedAt?.toDate ? shipment.updatedAt.toDate() : new Date(shipment.updatedAt);
                        const startDate = advancedFiltersParam.lastUpdated[0].startOf('day').toDate();
                        const endDate = advancedFiltersParam.lastUpdated[1].endOf('day').toDate();
                        if (lastUpdatedDate < startDate || lastUpdatedDate > endDate) {
                            return false;
                        }
                    }

                    // ========== TRACKING & STATUS FILTERS ==========

                    // Current Statuses array filter
                    if (advancedFiltersParam.currentStatuses && Array.isArray(advancedFiltersParam.currentStatuses) && advancedFiltersParam.currentStatuses.length > 0) {
                        const statusMatch = advancedFiltersParam.currentStatuses.includes(shipment.status);
                        if (!statusMatch) return false;
                    }

                    if (advancedFiltersParam.carrier) {
                        const shipmentCarrier = shipment.selectedCarrier || shipment.carrier || shipment.selectedRate?.carrier?.id || shipment.carrierID;
                        if (shipmentCarrier !== advancedFiltersParam.carrier) {
                            return false;
                        }
                    }

                    // Tracking Numbers array filter
                    if (advancedFiltersParam.trackingNumbers && Array.isArray(advancedFiltersParam.trackingNumbers) && advancedFiltersParam.trackingNumbers.length > 0) {
                        const trackingMatch = advancedFiltersParam.trackingNumbers.some(trackingNum =>
                            shipment.trackingNumber?.toLowerCase().includes(trackingNum.toLowerCase()) ||
                            shipment.shipmentID?.toLowerCase().includes(trackingNum.toLowerCase()) ||
                            shipment.shipmentInfo?.carrierTrackingNumber?.toLowerCase().includes(trackingNum.toLowerCase())
                        );
                        if (!trackingMatch) return false;
                    }

                    // Reference Numbers array filter
                    if (advancedFiltersParam.referenceNumbers && Array.isArray(advancedFiltersParam.referenceNumbers) && advancedFiltersParam.referenceNumbers.length > 0) {
                        const refMatch = advancedFiltersParam.referenceNumbers.some(refNum =>
                            shipment.referenceNumbers?.some(ref => ref?.toLowerCase().includes(refNum.toLowerCase())) ||
                            shipment.shipmentInfo?.referenceNumbers?.some(ref => ref?.toLowerCase().includes(refNum.toLowerCase())) ||
                            shipment.shipmentInfo?.shipperReferenceNumber?.toLowerCase().includes(refNum.toLowerCase()) ||
                            shipment.shipmentInfo?.bookingReferenceNumber?.toLowerCase().includes(refNum.toLowerCase())
                        );
                        if (!refMatch) return false;
                    }

                    // ========== ORIGIN AND DESTINATION FILTERS ==========

                    // Origin filters
                    if (advancedFiltersParam.originCustomerName &&
                        !shipment.shipFrom?.companyName?.toLowerCase().includes(advancedFiltersParam.originCustomerName.toLowerCase()) &&
                        !shipment.shipFrom?.company?.toLowerCase().includes(advancedFiltersParam.originCustomerName.toLowerCase())) {
                        return false;
                    }

                    if (advancedFiltersParam.originCity &&
                        !shipment.shipFrom?.city?.toLowerCase().includes(advancedFiltersParam.originCity.toLowerCase())) {
                        return false;
                    }

                    if (advancedFiltersParam.originProvince &&
                        !shipment.shipFrom?.province?.toLowerCase().includes(advancedFiltersParam.originProvince.toLowerCase()) &&
                        !shipment.shipFrom?.state?.toLowerCase().includes(advancedFiltersParam.originProvince.toLowerCase())) {
                        return false;
                    }

                    if (advancedFiltersParam.originCountry &&
                        shipment.shipFrom?.country !== advancedFiltersParam.originCountry) {
                        return false;
                    }

                    if (advancedFiltersParam.originPostalCode &&
                        !shipment.shipFrom?.postalCode?.toLowerCase().includes(advancedFiltersParam.originPostalCode.toLowerCase()) &&
                        !shipment.shipFrom?.zipCode?.toLowerCase().includes(advancedFiltersParam.originPostalCode.toLowerCase())) {
                        return false;
                    }

                    // Destination filters
                    if (advancedFiltersParam.destinationCustomerName &&
                        !shipment.shipTo?.companyName?.toLowerCase().includes(advancedFiltersParam.destinationCustomerName.toLowerCase()) &&
                        !shipment.shipTo?.company?.toLowerCase().includes(advancedFiltersParam.destinationCustomerName.toLowerCase())) {
                        return false;
                    }

                    if (advancedFiltersParam.destinationCity &&
                        !shipment.shipTo?.city?.toLowerCase().includes(advancedFiltersParam.destinationCity.toLowerCase())) {
                        return false;
                    }

                    if (advancedFiltersParam.destinationProvince &&
                        !shipment.shipTo?.province?.toLowerCase().includes(advancedFiltersParam.destinationProvince.toLowerCase()) &&
                        !shipment.shipTo?.state?.toLowerCase().includes(advancedFiltersParam.destinationProvince.toLowerCase())) {
                        return false;
                    }

                    if (advancedFiltersParam.destinationCountry &&
                        shipment.shipTo?.country !== advancedFiltersParam.destinationCountry) {
                        return false;
                    }

                    if (advancedFiltersParam.destinationPostalCode &&
                        !shipment.shipTo?.postalCode?.toLowerCase().includes(advancedFiltersParam.destinationPostalCode.toLowerCase()) &&
                        !shipment.shipTo?.zipCode?.toLowerCase().includes(advancedFiltersParam.destinationPostalCode.toLowerCase())) {
                        return false;
                    }

                    // ========== FINANCIAL FILTERS ==========

                    // Total Cost range
                    if (advancedFiltersParam.totalCost && advancedFiltersParam.totalCost[0] !== null && advancedFiltersParam.totalCost[1] !== null) {
                        const shipmentCost = parseFloat(shipment.totalCost) || parseFloat(shipment.billingDetails?.totalCost) || 0;
                        if (shipmentCost < advancedFiltersParam.totalCost[0] || shipmentCost > advancedFiltersParam.totalCost[1]) {
                            return false;
                        }
                    }

                    // Total Charge range
                    if (advancedFiltersParam.totalCharge && advancedFiltersParam.totalCharge[0] !== null && advancedFiltersParam.totalCharge[1] !== null) {
                        const shipmentCharge = parseFloat(shipment.totalCharge) || parseFloat(shipment.billingDetails?.totalCharge) || 0;
                        if (shipmentCharge < advancedFiltersParam.totalCharge[0] || shipmentCharge > advancedFiltersParam.totalCharge[1]) {
                            return false;
                        }
                    }

                    // Currency filter
                    if (advancedFiltersParam.currency && shipment.currency !== advancedFiltersParam.currency) {
                        return false;
                    }

                    // ========== PACKAGE INFORMATION FILTERS ==========

                    // Total Weight range
                    if (advancedFiltersParam.totalWeight && advancedFiltersParam.totalWeight[0] !== null && advancedFiltersParam.totalWeight[1] !== null) {
                        const shipmentWeight = parseFloat(shipment.totalWeight) || parseFloat(shipment.shipmentInfo?.totalWeight) || 0;
                        if (shipmentWeight < advancedFiltersParam.totalWeight[0] || shipmentWeight > advancedFiltersParam.totalWeight[1]) {
                            return false;
                        }
                    }

                    // Total Pieces range
                    if (advancedFiltersParam.totalPieces && advancedFiltersParam.totalPieces[0] !== null && advancedFiltersParam.totalPieces[1] !== null) {
                        const shipmentPieces = parseInt(shipment.totalPieces) || parseInt(shipment.shipmentInfo?.totalPieces) || 0;
                        if (shipmentPieces < advancedFiltersParam.totalPieces[0] || shipmentPieces > advancedFiltersParam.totalPieces[1]) {
                            return false;
                        }
                    }

                    // Package Type filter
                    if (advancedFiltersParam.packageType && shipment.packageType !== advancedFiltersParam.packageType) {
                        return false;
                    }

                    // ========== CONTACT INFORMATION FILTERS ==========

                    if (advancedFiltersParam.shipFromEmail &&
                        !shipment.shipFrom?.email?.toLowerCase().includes(advancedFiltersParam.shipFromEmail.toLowerCase())) {
                        return false;
                    }

                    if (advancedFiltersParam.shipFromPhone &&
                        !shipment.shipFrom?.phone?.includes(advancedFiltersParam.shipFromPhone)) {
                        return false;
                    }

                    if (advancedFiltersParam.shipToEmail &&
                        !shipment.shipTo?.email?.toLowerCase().includes(advancedFiltersParam.shipToEmail.toLowerCase())) {
                        return false;
                    }

                    if (advancedFiltersParam.shipToPhone &&
                        !shipment.shipTo?.phone?.includes(advancedFiltersParam.shipToPhone)) {
                        return false;
                    }

                    // 🔍 DEBUG: Target shipment passed all advanced filters
                    if (shipment.shipmentID === 'ICAL-227B8E') {
                        console.log('✅ DEBUG: Target shipment ICAL-227B8E PASSED all advanced filters');
                    }

                    return true;
                });

                console.log(`🎯 After comprehensive advanced filters: ${filteredData.length} shipments remaining`);

                // 🔍 DEBUG: Check if target is still present after advanced filtering
                const targetAfterAdvanced = filteredData.find(s => s.shipmentID === 'ICAL-227B8E');
                if (targetAfterAdvanced) {
                    console.log('✅ DEBUG: Target shipment ICAL-227B8E survived advanced filtering');
                } else {
                    console.log('❌ DEBUG: Target shipment ICAL-227B8E was filtered out by advanced filters');
                }
            }

            // 2. APPLY LEGACY SEARCH FIELDS (for backward compatibility and specific filters)
            // Only apply these if unified search is not being used
            if (!currentSearchTerm || !currentSearchTerm.trim()) {
                // Individual field searches with AND logic
                if (searchFields.shipmentId) {
                    const searchTerm = searchFields.shipmentId.toLowerCase();
                    filteredData = filteredData.filter(shipment => {
                        const shipmentId = (shipment.shipmentID || shipment.id || '').toLowerCase();
                        return shipmentId.includes(searchTerm);
                    });
                }

                if (searchFields.referenceNumber) {
                    const searchTerm = searchFields.referenceNumber.toLowerCase();
                    filteredData = filteredData.filter(shipment => {
                        const refNumber = (
                            shipment.shipmentInfo?.shipperReferenceNumber ||
                            shipment.referenceNumber ||
                            shipment.shipperReferenceNumber ||
                            shipment.selectedRate?.referenceNumber ||
                            shipment.selectedRateRef?.referenceNumber ||
                            ''
                        ).toLowerCase();

                        if (refNumber.includes(searchTerm)) return true;

                        const referenceNumbers = shipment.shipmentInfo?.referenceNumbers || [];
                        return referenceNumbers.some(ref =>
                            ref && ref.toLowerCase().includes(searchTerm)
                        );
                    });
                }

                if (searchFields.trackingNumber) {
                    const searchTerm = searchFields.trackingNumber.toLowerCase();
                    filteredData = filteredData.filter(shipment => {
                        const trackingNumber = (
                            shipment.trackingNumber ||
                            shipment.selectedRate?.trackingNumber ||
                            shipment.selectedRate?.TrackingNumber ||
                            shipment.selectedRateRef?.trackingNumber ||
                            shipment.selectedRateRef?.TrackingNumber ||
                            shipment.carrierTrackingData?.trackingNumber ||
                            shipment.carrierBookingConfirmation?.trackingNumber ||
                            shipment.carrierBookingConfirmation?.proNumber ||
                            shipment.bookingReferenceNumber ||
                            ''
                        ).toLowerCase();
                        return trackingNumber.includes(searchTerm);
                    });
                }

                // Customer name search (field-based search only)
                if (searchFields.customerName) {
                    const searchTerm = searchFields.customerName.toLowerCase();
                    filteredData = filteredData.filter(shipment => {
                        const shipToCustomerId = shipment.shipTo?.customerID;
                        const shipToCompany = shipment.shipTo?.company;
                        const customerNameFromMap = customers[shipToCustomerId];

                        return [
                            shipToCustomerId && shipToCustomerId.toLowerCase().includes(searchTerm),
                            customerNameFromMap && customerNameFromMap.toLowerCase().includes(searchTerm),
                            shipToCompany && shipToCompany.toLowerCase().includes(searchTerm)
                        ].some(Boolean);
                    });
                }

                // Origin/Destination search
                if (searchFields.origin) {
                    filteredData = filteredData.filter(shipment => {
                        const shipFrom = shipment.shipFrom || shipment.shipfrom || {};
                        return Object.values(shipFrom)
                            .join(' ')
                            .toLowerCase()
                            .includes(searchFields.origin.toLowerCase());
                    });
                }

                if (searchFields.destination) {
                    filteredData = filteredData.filter(shipment => {
                        const shipTo = shipment.shipTo || shipment.shipto || {};
                        return Object.values(shipTo)
                            .join(' ')
                            .toLowerCase()
                            .includes(searchFields.destination.toLowerCase());
                    });
                }
            }

            // 3. APPLY CARRIER FILTER (Enhanced)
            filteredData = applyCarrierFilter(filteredData, filters.carrier, carrierData);

            // 4. APPLY STATUS FILTER (Enhanced)
            const statusFilter = forceShipmentStatus || filters.enhancedStatus || filters.status;

            if (statusFilter && statusFilter !== 'all') {
                filteredData = applyStatusFilter(filteredData, statusFilter);
            }

            // 5. APPLY INVOICE STATUS FILTER
            const currentInvoiceStatus = forceInvoiceStatus || selectedInvoiceStatus;
            if (currentInvoiceStatus && currentInvoiceStatus !== 'all') {
                console.log(`🏷️ Applying invoice status filter: ${currentInvoiceStatus}`);
                const beforeCount = filteredData.length;

                filteredData = filteredData.filter(shipment => {
                    const shipmentInvoiceStatus = shipment.invoiceStatus || 'uninvoiced';
                    const matches = shipmentInvoiceStatus === currentInvoiceStatus;
                    return matches;
                });

                console.log(`🏷️ Invoice status filter: ${beforeCount} → ${filteredData.length} shipments`);
            }

            // 6. APPLY CUSTOMER FILTER - DISABLED (Advanced filters handle this)
            // ✅ REMOVED: This was conflicting with advanced filters and limiting results
            // Advanced filters at line 4377 handle customer filtering properly
            if (selectedCustomer && !advancedFiltersParam.customerId) {
                console.log(`🏷️ Simple customer filter disabled when advanced filters are active`);
                console.log(`🏷️ Selected customer: "${selectedCustomer}" - handled by advanced filters`);
            }

            // 7. APPLY SHIPMENT TYPE FILTER
            if (filters.shipmentType !== 'all') {
                filteredData = filteredData.filter(shipment => {
                    const shipmentType = (shipment.shipmentInfo?.shipmentType ||
                        shipment.shipmentType || '').toLowerCase();

                    const filterType = filters.shipmentType.toLowerCase();

                    // Direct match
                    if (shipmentType.includes(filterType)) return true;

                    // Handle type variations
                    if (filterType === 'courier') {
                        return shipmentType.includes('courier') ||
                            shipmentType.includes('express') ||
                            shipmentType.includes('parcel');
                    }

                    if (filterType === 'freight') {
                        return shipmentType.includes('freight') ||
                            shipmentType.includes('ltl') ||
                            shipmentType.includes('ftl');
                    }

                    return false;
                });
            }

            // 8. APPLY DATE RANGE FILTER
            if (dateRange[0] && dateRange[1]) {
                const startDate = dateRange[0].startOf('day').toDate();
                const endDate = dateRange[1].endOf('day').toDate();

                filteredData = filteredData.filter(shipment => {
                    let shipmentDate;

                    if (shipment.createdAt?.toDate) {
                        // Standard Firestore timestamp
                        shipmentDate = shipment.createdAt.toDate();
                    } else if (shipment.createdAt) {
                        // Fallback for createdAt as plain value
                        shipmentDate = new Date(shipment.createdAt);
                    } else if (shipment.date) {
                        // Final fallback to date field
                        shipmentDate = new Date(shipment.date);
                    } else {
                        // No date available, exclude from filter
                        return false;
                    }

                    return shipmentDate >= startDate && shipmentDate <= endDate;
                });
            }

            setTotalCount(filteredData.length);

            // Apply current sorting
            filteredData = sortShipments(filteredData);
            console.log(`📅 Applied ${sortBy} sorting (${sortDirection}) - matches table display column`);

            // Apply pagination to filtered and sorted data
            const paginatedData = rowsPerPage === -1
                ? filteredData // Show all if rowsPerPage is -1
                : filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

            console.log(`📊 FINAL RESULTS SUMMARY:`, {
                totalFromDatabase: querySnapshot.docs.length,
                afterAllFiltering: filteredData.length,
                page: page,
                rowsPerPage: rowsPerPage,
                paginatedShowing: paginatedData.length,
                totalCount: filteredData.length,
                adminViewMode: adminViewMode,
                adminCompanyIds: adminCompanyIds,
                activeTab: activeTab
            });

            setShipments(paginatedData);
            setFilteredShipments(filteredData); // Store ALL filtered results for export

            // Fetch carrier data for visible shipments
            const visibleShipmentIds = paginatedData.map(s => s.id);
            await fetchCarrierData(visibleShipmentIds);

        } catch (error) {
            console.error('Error loading shipments:', error);
            setShipments([]);
            setAllShipments([]);
            setFilteredShipments([]); // Reset filtered data on error
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [companyIdForAddress, selectedTab, fetchCarrierData, adminViewMode, adminCompanyIds, customers, carrierData, allShipments.length, isSemanticMode, semanticSearchResults, searchFields, selectedCustomer, filters, dateRange, page, rowsPerPage, applyCarrierFilter, applyStatusFilter, performUnifiedSearch]); // Removed sorting dependencies - sorting only affects display order, not data fetching

    // Effect to re-sort existing data when sorting state changes (without reloading from database)
    useEffect(() => {
        if (shipments.length > 0) {
            console.log(`🔄 Applying new sort to existing ${shipments.length} shipments: ${sortBy} ${sortDirection}`);
            const sortedShipments = sortShipments(shipments);
            console.log(`✅ Re-sorted shipments, first shipment after sort:`, sortedShipments[0]?.shipmentID);
            setShipments(sortedShipments);
        }

        if (filteredShipments.length > 0) {
            console.log(`🔄 Applying new sort to existing ${filteredShipments.length} filtered shipments: ${sortBy} ${sortDirection}`);
            const sortedFiltered = sortShipments(filteredShipments);
            console.log(`✅ Re-sorted filtered shipments, first shipment after sort:`, sortedFiltered[0]?.shipmentID);
            setFilteredShipments(sortedFiltered);
        }
    }, [sortBy, sortDirection, sortShipments, customers]);

    // Auto-apply filters function with debouncing
    const autoApplyFilters = useCallback((filters = null, delay = 0) => {
        if (!isAutoApply) return;

        // Clear existing timeout
        if (autoApplyTimeoutRef.current) {
            clearTimeout(autoApplyTimeoutRef.current);
        }

        const applyFunction = () => {
            setIsApplyingFilters(true);
            const filtersToApply = filters || advancedFilters;
            console.log('🤖 Auto-applying filters:', filtersToApply);
            loadShipments(null, unifiedSearch, null, null, filtersToApply).finally(() => {
                setIsApplyingFilters(false);
            });
        };

        if (delay > 0) {
            autoApplyTimeoutRef.current = setTimeout(applyFunction, delay);
        } else {
            applyFunction();
        }
    }, [isAutoApply, advancedFilters, unifiedSearch, loadShipments]);

    // Immediate auto-apply for simple filters (no debouncing)
    const autoApplyImmediate = useCallback((newFilters) => {
        if (!isAutoApply) return;
        setIsApplyingFilters(true);
        console.log('⚡ Auto-applying filters immediately:', newFilters);
        loadShipments(null, unifiedSearch, null, null, newFilters).finally(() => {
            setIsApplyingFilters(false);
        });
    }, [isAutoApply, unifiedSearch, loadShipments]);

    // Debounced auto-apply for complex filters (500ms delay)
    const autoApplyDebounced = useCallback((newFilters) => {
        autoApplyFilters(newFilters, 500);
    }, [autoApplyFilters]);

    // Create a stable reload function that can be called when needed
    const reloadShipments = useCallback(() => {
        // Don't reload shipments when in detail view to prevent race conditions
        if (navigationStack.length > 1 && navigationStack[navigationStack.length - 1].component === 'shipment-detail') {
            console.log('🚫 Skipping reload - in detail view');
            return;
        }

        // Check if we're in admin "all companies" mode
        const isAdminAllView = adminViewMode === 'all';

        // Skip if not ready
        if (authLoading || companyCtxLoading || (!companyIdForAddress && !isAdminAllView)) {
            console.log('🚫 Skipping reload - not ready', { authLoading, companyCtxLoading, companyIdForAddress, isAdminAllView });
            return;
        }

        console.log('🔄 Manual reload triggered');
        // Use current unifiedSearch value and advancedFilters at the time of execution
        loadShipments(null, unifiedSearch, null, null, advancedFilters);
    }, [loadShipments, authLoading, companyCtxLoading, companyIdForAddress, adminViewMode, navigationStack, advancedFilters]); // Added advancedFilters to dependencies

    // Add a shipment updated callback that refreshes the table data
    const handleShipmentUpdated = useCallback((updatedShipmentId, message = 'Shipment updated successfully') => {
        console.log('🔄 Shipment updated, refreshing table data:', updatedShipmentId);

        // Always reload shipments when one is updated
        loadShipments(null, unifiedSearch, null, null, advancedFilters);

        // Show success message
        showSnackbar(message, 'success');

        // If we're in detail view, we might want to refresh that shipment's data too
        if (navigationStack.length > 1) {
            const currentView = navigationStack[navigationStack.length - 1];
            if (currentView.component === 'shipment-detail' && currentView.props?.shipmentId === updatedShipmentId) {
                console.log('🔄 Also refreshing detail view for updated shipment');
                // The detail view should handle its own refresh through its refreshShipment function
            }
        }
    }, [loadShipments, showSnackbar, navigationStack]); // Removed unifiedSearch from dependencies

    // Add a draft saved callback that refreshes the table data  
    const handleDraftSaved = useCallback((draftId, message = 'Draft saved successfully') => {
        console.log('🔄 Draft saved, refreshing table data:', draftId);

        // Always reload shipments when a draft is saved
        loadShipments(null, unifiedSearch, null, null, advancedFilters);

        // Show success message
        showSnackbar(message, 'success');
    }, [loadShipments, showSnackbar]); // Removed unifiedSearch from dependencies

    // Debounced version for search inputs
    const debounceTimeoutRef = useRef(null);
    const debouncedReload = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            // Check if we're still in the table view
            if (navigationStack.length === 1) {
                // Use current unifiedSearch value and advancedFilters at the time of execution
                loadShipments(null, unifiedSearch, null, null, advancedFilters);
            }
        }, 500);
    }, [loadShipments, navigationStack, advancedFilters]); // Added advancedFilters to dependencies

    // Tab change handler - memoized for performance
    const handleTabChange = useCallback((event, newValue) => {
        console.log(`🏷️ Tab changed to: ${newValue}`);
        setSelectedTab(newValue);
        setPage(0); // Reset to first page when tab changes

        // 🐛 BUG FIX: Clear search when switching tabs to reset filtering
        console.log('🧹 Tab changed - clearing search filters to reset results');
        setUnifiedSearch('');
        setLiveResults([]);
        setShowLiveResults(false);
        setSelectedResultIndex(-1);
        setIsSemanticMode(false);
        setSemanticSearchResults(null);
        setSearchConfidence(0);

        // Trigger reload for new tab with no search term (cleared)
        setTimeout(() => loadShipments(newValue, ''), 50);
    }, [loadShipments]);

    // Initialize
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // CRITICAL CLEANUP: Clear all session state when component unmounts
    useEffect(() => {
        return () => {
            console.log('🧹 ShipmentsX unmounting - clearing all session state');
            setHasAutoOpenedShipment(false);
            // Clear any stored window references
            if (window.shipmentsXReset) {
                delete window.shipmentsXReset;
            }
        };
    }, []);

    // Add a direct reset function for external calls
    const resetToDefaults = useCallback(() => {
        console.log('🔄 Resetting ShipmentsX to default state');
        setSelectedTab('all');
        setPage(0);
        setSelected([]);

        // Clear unified search
        setUnifiedSearch('');

        // 🔍 CRITICAL FIX: Clear all search-related state
        setLiveResults([]);
        setShowLiveResults(false);
        setSelectedResultIndex(-1);
        setIsSemanticMode(false);
        setSemanticSearchResults(null);
        setSearchConfidence(0);

        // Clear filters
        setFilters({
            status: 'all',
            carrier: 'all',
            dateRange: [null, null],
            shipmentType: 'all',
            enhancedStatus: ''
        });

        // Clear legacy search fields
        setSearchFields({
            shipmentId: '',
            referenceNumber: '',
            trackingNumber: '',
            customerName: '',
            origin: '',
            destination: ''
        });

        setDateRange([null, null]);
        setSelectedCustomer('');
        setSelectedInvoiceStatus('');
        setFiltersOpen(false);
        setNavigationStack([{ key: 'table', component: 'table', props: {} }]);
        setMountedViews(['table']);

        // ENHANCED FIX: Reset auto-open state to prevent sticky navigation
        setHasAutoOpenedShipment(false);
        setIsReturningFromDetail(false); // Reset the returning flag
        console.log('🧹 Reset complete - all session state cleared');
    }, []);

    // Expose reset function via useEffect for external calls
    useEffect(() => {
        if (isModal) {
            // Store reset function for external access
            if (window.shipmentsXReset) {
                window.shipmentsXReset = resetToDefaults;
            }
        }
    }, [isModal, resetToDefaults]);



    // NOTE: Removed the problematic useEffect that was causing rerendering loops
    // Search is now triggered directly by user actions (Enter key, filter changes, etc.)
    // This prevents the infinite loop where unifiedSearch change -> useEffect -> loadShipments -> unifiedSearch change

    // Removed admin view useEffect - now handled directly in deep link params processing

    // Load data when auth and company are ready
    useEffect(() => {
        // Check if we're in admin "all companies" mode
        const isAdminAllView = adminViewMode === 'all';

        if (!authLoading && !companyCtxLoading && (companyIdForAddress || isAdminAllView)) {
            console.log('🔄 Initial data load triggered', { adminViewMode, isAdminAllView });

            // Load data in parallel for faster initial load - call functions directly to avoid dependency issues
            const loadInitialData = async () => {
                try {
                    const promises = [];

                    // Load customers
                    promises.push(fetchCustomers());

                    // Load shipments (no search term for initial load)
                    promises.push(loadShipments(null, null));

                    // Load dynamic carriers from database
                    promises.push(loadAvailableCarriers());

                    // Add company data loading for all users (needed for advanced filters)
                    promises.push(fetchCompaniesData());

                    // Load invoice statuses for filtering
                    promises.push(loadInvoiceStatuses());

                    // Load shipment statuses for filtering
                    promises.push(loadShipmentStatuses());

                    // Load address book data for Origin & Destination filters
                    promises.push(loadAddressBookData());

                    await Promise.all(promises);
                } catch (error) {
                    console.error('Error loading initial data:', error);
                    setLoading(false);
                }
            };

            loadInitialData();
        }
    }, [authLoading, companyCtxLoading, companyIdForAddress, adminViewMode]); // Removed function dependencies to prevent loops

    // Auto-populate company filter when company context is set
    useEffect(() => {
        if (companyIdForAddress && companyIdForAddress !== 'all') {
            if (adminViewMode) {
                // Admin view: populate dropdown if company is available (but NOT for super admins)
                if (userRole !== 'superadmin' && companiesData.length > 0) {
                    const currentCompany = companiesData.find(company => company.companyID === companyIdForAddress);
                    if (currentCompany && !advancedFilters.companyId) {
                        console.log('🏢 Auto-populating admin company filter with current context:', currentCompany.companyName);
                        setAdvancedFilters(prev => ({
                            ...prev,
                            companyId: companyIdForAddress
                        }));
                    }
                } else if (userRole === 'superadmin') {
                    console.log('🔑 Super admin detected - NOT auto-populating company filter to show ALL companies');
                }
            } else {
                // Frontend user: always filter by company context (no dropdown shown)
                if (!advancedFilters.companyId) {
                    console.log('🏢 Auto-setting frontend user company filter:', companyIdForAddress);
                    setAdvancedFilters(prev => ({
                        ...prev,
                        companyId: companyIdForAddress
                    }));
                }
            }
        }
    }, [companyIdForAddress, companiesData, advancedFilters.companyId, adminViewMode, userRole]);

    // Add tracking drawer handler
    const handleOpenTrackingDrawer = (trackingNumber) => {
        setCurrentTrackingNumber(trackingNumber);
        setIsTrackingDrawerOpen(true);
    };

    // Helper to get the current and previous views
    const getCurrentAndPrevViews = () => {
        const len = navigationStack.length;
        return {
            current: navigationStack[len - 1],
            prev: navigationStack[len - 2] || null
        };
    };

    // Render view based on component type
    const renderView = (view) => {
        console.log('🎨 renderView called with:', view);

        // Safety check for undefined view
        if (!view || !view.component) {
            console.error('❌ renderView called with invalid view:', view);
            return <div>Error: Invalid view</div>;
        }

        switch (view.component) {
            case 'table':
                console.log('📊 Rendering table view - v3.0 - All React Error #31 fixes applied');
                return (
                    <Box sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        {/* Scrollable Content Area */}
                        <Box sx={{
                            flex: 1,
                            overflow: 'auto',
                            minHeight: 0,
                            maxHeight: '80vh', // Ensure the table area is scrollable and not the whole modal
                            position: 'relative'
                        }}>
                            {/* Main Content */}
                            <Paper sx={{ bgcolor: 'transparent', boxShadow: 'none', mx: 2 }}>
                                <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Tabs
                                        value={selectedTab}
                                        onChange={handleTabChange}
                                        sx={{
                                            '& .MuiTab-root': {
                                                fontSize: '11px',
                                                minHeight: '36px',
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                padding: '6px 12px'
                                            }
                                        }}
                                    >
                                        <Tab label={`All (${stats.total})`} value="all" />
                                        <Tab label={`Ready To Ship (${stats.awaitingShipment})`} value="Awaiting Shipment" />
                                        <Tab label={`In Transit (${stats.inTransit})`} value="In Transit" />
                                        <Tab label={`Delivered (${stats.delivered})`} value="Delivered" />
                                        <Tab label={`Delayed (${stats.delayed})`} value="Delayed" />
                                        <Tab label={`Cancelled (${stats.cancelled})`} value="Cancelled" />
                                        <Tab label={`Ship Later (${stats.drafts})`} value="draft" />
                                        <Tab label={`For Review (${stats.pendingReview})`} value="pending_review" />
                                    </Tabs>

                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        {/* Always show filter and export buttons */}
                                        <Button
                                            variant="outlined"
                                            startIcon={<FilterIcon />}
                                            onClick={() => setFiltersOpen(!filtersOpen)}
                                            size="small"
                                            sx={{
                                                fontSize: '11px',
                                                textTransform: 'none',
                                                position: 'relative'
                                            }}
                                        >
                                            {filtersOpen ? 'Hide' : 'Filter'}
                                            {countActiveFilters() > 0 && (
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        top: -8,
                                                        right: -8,
                                                        backgroundColor: '#ef4444',
                                                        color: 'white',
                                                        borderRadius: '50%',
                                                        width: 20,
                                                        height: 20,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '10px',
                                                        fontWeight: 'bold',
                                                        minWidth: 'unset'
                                                    }}
                                                >
                                                    {countActiveFilters()}
                                                </Box>
                                            )}
                                        </Button>
                                        <IconButton variant="outlined" onClick={() => setIsExportDialogOpen(true)} size="small" sx={{ border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: '4px' }}>
                                            <ExportIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>
                                        <IconButton
                                            onClick={handleRefreshTable}
                                            size="small"
                                            sx={{
                                                border: '1px solid rgba(0, 0, 0, 0.23)',
                                                borderRadius: '4px',
                                                color: '#64748b',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(100, 116, 139, 0.1)'
                                                }
                                            }}
                                            title="Refresh shipments data"
                                        >
                                            <RefreshIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>

                                        {/* Draft-specific actions */}
                                        {selectedTab === 'draft' && stats.drafts > 0 && (
                                            <>
                                                {selected.length > 0 && selected.some(id => shipments.find(s => s.id === id)?.status === 'draft') && (
                                                    <Button
                                                        variant="outlined"
                                                        color="error"
                                                        size="small"
                                                        onClick={() => {
                                                            setIsDeleteDraftsDialogOpen(true);
                                                        }}
                                                        disabled={isDeletingDrafts}
                                                        sx={{ fontSize: '11px', textTransform: 'none' }}
                                                    >
                                                        Delete Selected ({selected.filter(id => shipments.find(s => s.id === id)?.status === 'draft').length})
                                                    </Button>
                                                )}
                                            </>
                                        )}

                                        {/* QuickShip and New buttons - enabled for super admins with company selector */}
                                        {/* Quick Ship button - only show if user has USE_QUICKSHIP permission */}
                                        {hasPermission(userRole, PERMISSIONS.USE_QUICKSHIP) && (
                                            <Button
                                                onClick={() => {
                                                    if (onOpenCreateShipment) {
                                                        // Open QuickShip modal with mode parameter and refresh callbacks
                                                        onOpenCreateShipment(null, null, null, 'quickship', {
                                                            onShipmentUpdated: handleShipmentUpdated,
                                                            onDraftSaved: handleDraftSaved,
                                                            onReturnToShipments: () => {
                                                                // Refresh the table when returning from QuickShip
                                                                setTimeout(() => loadShipments(null, unifiedSearch), 100);
                                                            }
                                                        });
                                                    } else {
                                                        showSnackbar('Quick Ship functionality requires parent modal integration', 'warning');
                                                    }
                                                }}
                                                variant="contained"
                                                startIcon={<FlashOnIcon />}
                                                size="small"
                                                disabled={
                                                    // Enable for super admins (they have company selector), disable for others without company
                                                    userRole !== 'superadmin' && (
                                                        !companyIdForAddress ||
                                                        companyIdForAddress === 'all' ||
                                                        (adminViewMode && adminViewMode === 'all')
                                                    )
                                                }
                                                sx={{ fontSize: '11px', textTransform: 'none' }}
                                            >
                                                Quick Ship
                                            </Button>
                                        )}
                                        {/* New shipment button - only show if user has USE_LIVE_RATES permission */}
                                        {hasPermission(userRole, PERMISSIONS.USE_LIVE_RATES) && (
                                            <Button
                                                onClick={() => {
                                                    if (onOpenCreateShipment) {
                                                        // Open advanced CreateShipment with refresh callbacks
                                                        onOpenCreateShipment(null, null, null, null, {
                                                            onShipmentUpdated: handleShipmentUpdated,
                                                            onDraftSaved: handleDraftSaved,
                                                            onReturnToShipments: () => {
                                                                // Refresh the table when returning from shipment creation
                                                                setTimeout(() => loadShipments(null, unifiedSearch), 100);
                                                            }
                                                        });
                                                    } else {
                                                        showSnackbar('Create Shipment functionality requires parent modal integration', 'warning');
                                                    }
                                                }}
                                                variant="contained"
                                                startIcon={<AddIcon />}
                                                size="small"
                                                disabled={
                                                    // Enable for super admins (they have company selector), disable for others without company
                                                    userRole !== 'superadmin' && (
                                                        !companyIdForAddress ||
                                                        companyIdForAddress === 'all' ||
                                                        (adminViewMode && adminViewMode === 'all')
                                                    )
                                                }
                                                sx={{ fontSize: '11px', textTransform: 'none' }}
                                            >
                                                New
                                            </Button>
                                        )}
                                    </Box>
                                </Toolbar>

                                {/* Search and Filter Section */}
                                <Collapse in={filtersOpen}>
                                    <Box sx={{ p: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        {/* Advanced Filters Section - Only show if unified search is not being used */}
                                        {(!unifiedSearch || !unifiedSearch.trim()) && (
                                            <>


                                                {/* Comprehensive Accordion-Based Filters */}
                                                <Box sx={{ maxWidth: '100%', mb: 3 }}>
                                                    {/* Basic Information Section */}
                                                    <Accordion
                                                        expanded={accordionExpanded.basicInfo}
                                                        sx={{ mb: 1, '& .MuiAccordionSummary-root': { minHeight: 'auto' } }}
                                                    >
                                                        <AccordionSummary
                                                            expandIcon={
                                                                <ExpandMoreIcon
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, basicInfo: !prev.basicInfo }));
                                                                    }}
                                                                    sx={{ cursor: 'pointer' }}
                                                                />
                                                            }
                                                            sx={{ py: 1, cursor: 'default', '& .MuiAccordionSummary-content': { margin: 0 } }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                                <Typography
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, basicInfo: !prev.basicInfo }));
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                >
                                                                    Shipment Info
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                    {getSectionActiveFilters('basicInfo').map((filter, index) => (
                                                                        <Chip
                                                                            key={index}
                                                                            label={filter}
                                                                            size="small"
                                                                            color="primary"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                fontSize: '10px',
                                                                                height: '20px',
                                                                                borderRadius: '10px',
                                                                                '& .MuiChip-label': {
                                                                                    px: 1
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        </AccordionSummary>
                                                        <AccordionDetails sx={{ pt: 0 }}>
                                                            <Grid container spacing={2}>
                                                                {/* 1. Shipment IDs - First field */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Autocomplete
                                                                        multiple
                                                                        freeSolo
                                                                        fullWidth
                                                                        options={[]}
                                                                        value={advancedFilters.shipmentIds}
                                                                        onChange={(event, newValue) => setAdvancedFilters(prev => ({ ...prev, shipmentIds: newValue }))}
                                                                        renderTags={(value, getTagProps) =>
                                                                            value.map((option, index) => (
                                                                                <Chip
                                                                                    variant="outlined"
                                                                                    label={option}
                                                                                    size="small"
                                                                                    sx={{ fontSize: '11px', height: '22px' }}
                                                                                    {...getTagProps({ index })}
                                                                                />
                                                                            ))
                                                                        }
                                                                        renderInput={(params) => (
                                                                            <TextField
                                                                                {...params}
                                                                                label="Shipment IDs"
                                                                                placeholder="Press Enter to add"
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        )}
                                                                    />
                                                                </Grid>
                                                                {/* 2. Company dropdown with enhanced features - ADMIN ONLY */}
                                                                {adminViewMode && (
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <Autocomplete
                                                                            fullWidth
                                                                            options={companiesData || []}
                                                                            getOptionLabel={(option) => {
                                                                                if (!option.companyName) return '';
                                                                                return option.companyID ? `${option.companyName} - ${option.companyID}` : option.companyName;
                                                                            }}
                                                                            value={companiesData.find(company => company.companyID === advancedFilters.companyId) || null}
                                                                            onChange={(event, newValue) => {
                                                                                const newFilters = {
                                                                                    ...advancedFilters,
                                                                                    companyId: newValue?.companyID || '',
                                                                                    customerId: '' // Reset customer when company changes
                                                                                };
                                                                                setAdvancedFilters(newFilters);

                                                                                // Auto-apply immediately for company selection
                                                                                autoApplyImmediate(newFilters);
                                                                            }}
                                                                            renderOption={(props, option) => (
                                                                                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                                                                                    <Avatar
                                                                                        src={option.logo || option.logoUrl}
                                                                                        sx={{ width: 24, height: 24, fontSize: '10px' }}
                                                                                    >
                                                                                        {option.companyName?.charAt(0)}
                                                                                    </Avatar>
                                                                                    <Box sx={{ flexGrow: 1 }}>
                                                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                            {option.companyName}
                                                                                        </Typography>
                                                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                                            Company ID: {option.companyID}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                </Box>
                                                                            )}
                                                                            renderInput={(params) => {
                                                                                const selectedCompany = companiesData.find(company => company.companyID === advancedFilters.companyId);
                                                                                return (
                                                                                    <TextField
                                                                                        {...params}
                                                                                        label="Company"
                                                                                        size="small"
                                                                                        InputProps={{
                                                                                            ...params.InputProps,
                                                                                            startAdornment: selectedCompany ? (
                                                                                                <InputAdornment position="start">
                                                                                                    <Avatar
                                                                                                        src={selectedCompany.logo || selectedCompany.logoUrl}
                                                                                                        sx={{ width: 20, height: 20, fontSize: '10px', mr: 1 }}
                                                                                                    >
                                                                                                        {selectedCompany.companyName?.charAt(0)}
                                                                                                    </Avatar>
                                                                                                </InputAdornment>
                                                                                            ) : params.InputProps.startAdornment,
                                                                                        }}
                                                                                        sx={{
                                                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                                                                            '& .MuiAutocomplete-input': { fontSize: '12px' }
                                                                                        }}
                                                                                    />
                                                                                );
                                                                            }}
                                                                            sx={{ '& .MuiAutocomplete-listbox': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                )}
                                                                {/* 3. Customer dropdown with enhanced features */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Autocomplete
                                                                        fullWidth
                                                                        options={(() => {
                                                                            // Get filtered customer entries
                                                                            const filteredEntries = Object.entries(customers)
                                                                                .filter(([id, customerData]) => {
                                                                                    if (!advancedFilters.companyId) return true;
                                                                                    return customerData.companyId === advancedFilters.companyId;
                                                                                });

                                                                            // Deduplicate by customer name
                                                                            const uniqueCustomers = new Map();
                                                                            filteredEntries.forEach(([id, customerData]) => {
                                                                                const name = customerData.name;
                                                                                if (name && !uniqueCustomers.has(name)) {
                                                                                    uniqueCustomers.set(name, {
                                                                                        id: String(id),
                                                                                        name: String(name),
                                                                                        logo: String(customerData.logo || customerData.logoUrl || '')
                                                                                    });
                                                                                }
                                                                            });

                                                                            return Array.from(uniqueCustomers.values()).sort((a, b) => a.name.localeCompare(b.name));
                                                                        })()}
                                                                        getOptionLabel={(option) => {
                                                                            if (typeof option === 'string') return option;
                                                                            return String(option?.name || '');
                                                                        }}
                                                                        value={advancedFilters.customerId ?
                                                                            (() => {
                                                                                const customerEntry = Object.entries(customers)
                                                                                    .find(([id]) => id === advancedFilters.customerId);
                                                                                if (customerEntry) {
                                                                                    const [id, customerData] = customerEntry;
                                                                                    return {
                                                                                        id: id,
                                                                                        name: customerData.name || '',
                                                                                        logo: customerData.logo || customerData.logoUrl || ''
                                                                                    };
                                                                                }
                                                                                return null;
                                                                            })()
                                                                            : null}
                                                                        onChange={(event, newValue) => {
                                                                            // ✅ FIXED: Use customerID (business ID) instead of document ID
                                                                            // This matches addressBook.addressClassID field
                                                                            const newFilters = { ...advancedFilters, customerId: newValue?.customerID || newValue?.id || '' };
                                                                            setAdvancedFilters(newFilters);

                                                                            // Auto-apply immediately for customer selection
                                                                            autoApplyImmediate(newFilters);
                                                                        }}
                                                                        renderOption={(props, option) => {
                                                                            if (typeof option === 'string') {
                                                                                return (
                                                                                    <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                                                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                            {option}
                                                                                        </Typography>
                                                                                    </Box>
                                                                                );
                                                                            }
                                                                            const safeName = String(option?.name || '');
                                                                            const safeLogo = String(option?.logo || '');
                                                                            return (
                                                                                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                                                                                    <Avatar
                                                                                        src={safeLogo}
                                                                                        sx={{
                                                                                            width: 20,
                                                                                            height: 20,
                                                                                            fontSize: '9px',
                                                                                            bgcolor: safeLogo ? 'transparent' : '#059669'
                                                                                        }}
                                                                                    >
                                                                                        {!safeLogo && safeName?.charAt(0)?.toUpperCase()}
                                                                                    </Avatar>
                                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                        {safeName}
                                                                                    </Typography>
                                                                                </Box>
                                                                            );
                                                                        }}
                                                                        renderInput={(params) => {
                                                                            const selectedCustomer = advancedFilters.customerId ?
                                                                                (() => {
                                                                                    const customerEntry = Object.entries(customers)
                                                                                        .find(([id]) => id === advancedFilters.customerId);
                                                                                    if (customerEntry) {
                                                                                        const [id, customerData] = customerEntry;
                                                                                        return {
                                                                                            id: id,
                                                                                            name: customerData.name || '',
                                                                                            logo: customerData.logo || customerData.logoUrl || ''
                                                                                        };
                                                                                    }
                                                                                    return null;
                                                                                })()
                                                                                : null;

                                                                            return (
                                                                                <TextField
                                                                                    {...params}
                                                                                    label="Customer"
                                                                                    size="small"
                                                                                    InputProps={{
                                                                                        ...params.InputProps,
                                                                                        startAdornment: selectedCustomer ? (
                                                                                            <InputAdornment position="start">
                                                                                                <Avatar
                                                                                                    src={selectedCustomer.logo}
                                                                                                    sx={{
                                                                                                        width: 20,
                                                                                                        height: 20,
                                                                                                        fontSize: '10px',
                                                                                                        mr: 1,
                                                                                                        bgcolor: selectedCustomer.logo ? 'transparent' : '#059669'
                                                                                                    }}
                                                                                                >
                                                                                                    {!selectedCustomer.logo && selectedCustomer.name?.charAt(0)?.toUpperCase()}
                                                                                                </Avatar>
                                                                                            </InputAdornment>
                                                                                        ) : params.InputProps.startAdornment,
                                                                                    }}
                                                                                    sx={{
                                                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                                                                        '& .MuiAutocomplete-input': { fontSize: '12px' }
                                                                                    }}
                                                                                />
                                                                            );
                                                                        }}
                                                                        sx={{ '& .MuiAutocomplete-listbox': { fontSize: '12px' } }}
                                                                    />
                                                                </Grid>
                                                                {/* 4. Shipment Type */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <FormControl fullWidth size="small">
                                                                        <InputLabel sx={{ fontSize: '12px' }}>Shipment Type</InputLabel>
                                                                        <Select
                                                                            value={advancedFilters.shipmentType}
                                                                            onChange={(e) => {
                                                                                const newFilters = { ...advancedFilters, shipmentType: e.target.value };
                                                                                setAdvancedFilters(newFilters);

                                                                                // Auto-apply immediately for shipment type selection
                                                                                autoApplyImmediate(newFilters);
                                                                            }}
                                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                        >
                                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Types</MenuItem>
                                                                            <MenuItem value="courier" sx={{ fontSize: '12px' }}>Courier</MenuItem>
                                                                            <MenuItem value="freight" sx={{ fontSize: '12px' }}>Freight</MenuItem>
                                                                        </Select>
                                                                    </FormControl>
                                                                </Grid>
                                                            </Grid>
                                                        </AccordionDetails>
                                                    </Accordion>



                                                    {/* Timing Information Section */}
                                                    <Accordion
                                                        expanded={accordionExpanded.timing}
                                                        sx={{ mb: 1, '& .MuiAccordionSummary-root': { minHeight: 'auto' } }}
                                                    >
                                                        <AccordionSummary
                                                            expandIcon={
                                                                <ExpandMoreIcon
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, timing: !prev.timing }));
                                                                    }}
                                                                    sx={{ cursor: 'pointer' }}
                                                                />
                                                            }
                                                            sx={{ py: 1, cursor: 'default', '& .MuiAccordionSummary-content': { margin: 0 } }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                                <Typography
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, timing: !prev.timing }));
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                >
                                                                    Timing Information
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                    {getSectionActiveFilters('timing').map((filter, index) => (
                                                                        <Chip
                                                                            key={index}
                                                                            label={filter}
                                                                            size="small"
                                                                            color="secondary"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                fontSize: '10px',
                                                                                height: '20px',
                                                                                borderRadius: '10px',
                                                                                '& .MuiChip-label': {
                                                                                    px: 1
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        </AccordionSummary>
                                                        <AccordionDetails sx={{ pt: 0 }}>
                                                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                                                <Grid container spacing={2}>
                                                                    <Grid item xs={12} sm={6} md={4}>
                                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                                            Created Date
                                                                        </Typography>
                                                                        <DateRangePicker
                                                                            value={advancedFilters.createdAt}
                                                                            onChange={(newValue) => {
                                                                                // Handle single date logic
                                                                                let processedValue = newValue;
                                                                                if (newValue && newValue[0] && !newValue[1]) {
                                                                                    // If only start date is set, use same date for end
                                                                                    processedValue = [newValue[0], newValue[0]];
                                                                                }
                                                                                const newFilters = {
                                                                                    ...advancedFilters,
                                                                                    createdAt: processedValue || [null, null]
                                                                                };
                                                                                setAdvancedFilters(newFilters);

                                                                                // Auto-apply with debouncing for date selection
                                                                                autoApplyDebounced(newFilters);
                                                                            }}
                                                                            calendars={1}
                                                                            slotProps={{
                                                                                textField: {
                                                                                    size: "small",
                                                                                    fullWidth: true,
                                                                                    variant: "outlined",
                                                                                    placeholder: "Select date or range",
                                                                                    sx: {
                                                                                        '& .MuiInputBase-input': {
                                                                                            fontSize: '12px',
                                                                                            textAlign: 'center'
                                                                                        },
                                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                                    }
                                                                                },
                                                                                actionBar: {
                                                                                    actions: ['clear', 'today']
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={4}>
                                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                                            Shipment Date
                                                                        </Typography>
                                                                        <DateRangePicker
                                                                            value={advancedFilters.shipmentDate}
                                                                            onChange={(newValue) => {
                                                                                // Handle single date logic
                                                                                let processedValue = newValue;
                                                                                if (newValue && newValue[0] && !newValue[1]) {
                                                                                    // If only start date is set, use same date for end
                                                                                    processedValue = [newValue[0], newValue[0]];
                                                                                }
                                                                                const newFilters = {
                                                                                    ...advancedFilters,
                                                                                    shipmentDate: processedValue || [null, null]
                                                                                };
                                                                                setAdvancedFilters(newFilters);

                                                                                // Auto-apply with debouncing for date selection
                                                                                autoApplyDebounced(newFilters);
                                                                            }}
                                                                            calendars={1}
                                                                            slotProps={{
                                                                                textField: {
                                                                                    size: "small",
                                                                                    fullWidth: true,
                                                                                    variant: "outlined",
                                                                                    placeholder: "Select date or range",
                                                                                    sx: {
                                                                                        '& .MuiInputBase-input': {
                                                                                            fontSize: '12px',
                                                                                            textAlign: 'center'
                                                                                        },
                                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                                    }
                                                                                },
                                                                                actionBar: {
                                                                                    actions: ['clear', 'today']
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={4}>
                                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                                            ETA Date
                                                                        </Typography>
                                                                        <DateRangePicker
                                                                            value={advancedFilters.eta1}
                                                                            onChange={(newValue) => {
                                                                                // Handle single date logic
                                                                                let processedValue = newValue;
                                                                                if (newValue && newValue[0] && !newValue[1]) {
                                                                                    // If only start date is set, use same date for end
                                                                                    processedValue = [newValue[0], newValue[0]];
                                                                                }
                                                                                const newFilters = {
                                                                                    ...advancedFilters,
                                                                                    eta1: processedValue || [null, null],
                                                                                    eta2: processedValue || [null, null] // Set both ETA1 and ETA2 to same value
                                                                                };
                                                                                setAdvancedFilters(newFilters);

                                                                                // Auto-apply with debouncing for date selection
                                                                                autoApplyDebounced(newFilters);
                                                                            }}
                                                                            calendars={1}
                                                                            slotProps={{
                                                                                textField: {
                                                                                    size: "small",
                                                                                    fullWidth: true,
                                                                                    variant: "outlined",
                                                                                    placeholder: "Select date or range",
                                                                                    sx: {
                                                                                        '& .MuiInputBase-input': {
                                                                                            fontSize: '12px',
                                                                                            textAlign: 'center'
                                                                                        },
                                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                                    }
                                                                                },
                                                                                actionBar: {
                                                                                    actions: ['clear', 'today']
                                                                                }
                                                                            }}
                                                                        />
                                                                    </Grid>
                                                                </Grid>
                                                            </LocalizationProvider>
                                                        </AccordionDetails>
                                                    </Accordion>

                                                    {/* Tracking & Status Section */}
                                                    <Accordion
                                                        expanded={accordionExpanded.tracking}
                                                        sx={{ mb: 1, '& .MuiAccordionSummary-root': { minHeight: 'auto' } }}
                                                    >
                                                        <AccordionSummary
                                                            expandIcon={
                                                                <ExpandMoreIcon
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, tracking: !prev.tracking }));
                                                                    }}
                                                                    sx={{ cursor: 'pointer' }}
                                                                />
                                                            }
                                                            sx={{ py: 1, cursor: 'default', '& .MuiAccordionSummary-content': { margin: 0 } }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                                <Typography
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, tracking: !prev.tracking }));
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                >
                                                                    Tracking & Status
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                    {getSectionActiveFilters('tracking').map((filter, index) => (
                                                                        <Chip
                                                                            key={index}
                                                                            label={filter}
                                                                            size="small"
                                                                            color="success"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                fontSize: '10px',
                                                                                height: '20px',
                                                                                borderRadius: '10px',
                                                                                '& .MuiChip-label': {
                                                                                    px: 1
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        </AccordionSummary>
                                                        <AccordionDetails sx={{ pt: 0 }}>
                                                            <Grid container spacing={2}>
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Autocomplete
                                                                        multiple
                                                                        fullWidth
                                                                        options={shipmentStatuses}
                                                                        getOptionLabel={(option) => option.displayLabel || option.statusCode || ''}
                                                                        value={shipmentStatuses.filter(status =>
                                                                            advancedFilters.currentStatuses.includes(status.statusCode || status.displayLabel)
                                                                        )}
                                                                        onChange={(event, newValue) => {
                                                                            const newFilters = {
                                                                                ...advancedFilters,
                                                                                currentStatuses: newValue.map(status => status.statusCode || status.displayLabel)
                                                                            };
                                                                            setAdvancedFilters(newFilters);

                                                                            // Auto-apply immediately for status selection
                                                                            autoApplyImmediate(newFilters);
                                                                        }}
                                                                        renderOption={(props, option) => {

                                                                            return (
                                                                                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                                                                                    <Chip
                                                                                        label={option.displayLabel || option.statusCode}
                                                                                        size="small"
                                                                                        sx={{
                                                                                            backgroundColor: `${option.color || '#6b7280'} !important`,
                                                                                            color: `${option.fontColor || '#ffffff'} !important`,
                                                                                            fontSize: '11px',
                                                                                            fontWeight: 500,
                                                                                            '& .MuiChip-label': {
                                                                                                color: `${option.fontColor || '#ffffff'} !important`
                                                                                            }
                                                                                        }}
                                                                                    />
                                                                                </Box>
                                                                            );
                                                                        }}
                                                                        renderTags={(value, getTagProps) =>
                                                                            value.map((option, index) => (
                                                                                <Chip
                                                                                    label={option.displayLabel || option.statusCode}
                                                                                    size="small"
                                                                                    sx={{
                                                                                        fontSize: '11px',
                                                                                        height: '22px',
                                                                                        backgroundColor: `${option.color || '#6b7280'} !important`,
                                                                                        color: `${option.fontColor || '#ffffff'} !important`,
                                                                                        '& .MuiChip-label': {
                                                                                            color: `${option.fontColor || '#ffffff'} !important`
                                                                                        }
                                                                                    }}
                                                                                    {...getTagProps({ index })}
                                                                                />
                                                                            ))
                                                                        }
                                                                        renderInput={(params) => (
                                                                            <TextField {...params} label="Current Status" size="small" sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }} />
                                                                        )}
                                                                    />
                                                                </Grid>
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <FormControl fullWidth size="small">
                                                                        <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                                                                        <Select
                                                                            value={advancedFilters.carrier}
                                                                            onChange={(e) => {
                                                                                const newFilters = { ...advancedFilters, carrier: e.target.value };
                                                                                setAdvancedFilters(newFilters);

                                                                                // Auto-apply immediately for carrier selection
                                                                                autoApplyImmediate(newFilters);
                                                                            }}
                                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                        >
                                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Carriers</MenuItem>
                                                                            {availableCarriers.flatMap(group =>
                                                                                group.carriers.map(carrier => (
                                                                                    <MenuItem key={carrier.id} value={carrier.id} sx={{ fontSize: '12px' }}>
                                                                                        {carrier.name}
                                                                                    </MenuItem>
                                                                                ))
                                                                            )}
                                                                        </Select>
                                                                    </FormControl>
                                                                </Grid>
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Autocomplete
                                                                        multiple
                                                                        freeSolo
                                                                        fullWidth
                                                                        options={[]}
                                                                        value={advancedFilters.trackingNumbers}
                                                                        onChange={(event, newValue) => setAdvancedFilters(prev => ({ ...prev, trackingNumbers: newValue }))}
                                                                        renderTags={(value, getTagProps) =>
                                                                            value.map((option, index) => (
                                                                                <Chip
                                                                                    variant="outlined"
                                                                                    label={option}
                                                                                    size="small"
                                                                                    sx={{ fontSize: '11px', height: '22px' }}
                                                                                    {...getTagProps({ index })}
                                                                                />
                                                                            ))
                                                                        }
                                                                        renderInput={(params) => (
                                                                            <TextField
                                                                                {...params}
                                                                                label="Tracking Numbers"
                                                                                placeholder="Press Enter to add"
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        )}
                                                                    />
                                                                </Grid>
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Autocomplete
                                                                        multiple
                                                                        freeSolo
                                                                        fullWidth
                                                                        options={[]}
                                                                        value={advancedFilters.referenceNumbers}
                                                                        onChange={(event, newValue) => setAdvancedFilters(prev => ({ ...prev, referenceNumbers: newValue }))}
                                                                        renderTags={(value, getTagProps) =>
                                                                            value.map((option, index) => (
                                                                                <Chip
                                                                                    variant="outlined"
                                                                                    label={option}
                                                                                    size="small"
                                                                                    sx={{ fontSize: '11px', height: '22px' }}
                                                                                    {...getTagProps({ index })}
                                                                                />
                                                                            ))
                                                                        }
                                                                        renderInput={(params) => (
                                                                            <TextField
                                                                                {...params}
                                                                                label="Reference Numbers"
                                                                                placeholder="Press Enter to add"
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        )}
                                                                    />
                                                                </Grid>
                                                            </Grid>
                                                        </AccordionDetails>
                                                    </Accordion>

                                                    {/* Origin and Destination Section */}
                                                    <Accordion
                                                        expanded={accordionExpanded.originDestination}
                                                        sx={{ mb: 1, '& .MuiAccordionSummary-root': { minHeight: 'auto' } }}
                                                    >
                                                        <AccordionSummary
                                                            expandIcon={
                                                                <ExpandMoreIcon
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, originDestination: !prev.originDestination }));
                                                                    }}
                                                                    sx={{ cursor: 'pointer' }}
                                                                />
                                                            }
                                                            sx={{ py: 1, cursor: 'default', '& .MuiAccordionSummary-content': { margin: 0 } }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                                <Typography
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, originDestination: !prev.originDestination }));
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                >
                                                                    Origin & Destination
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                    {getSectionActiveFilters('originDestination').map((filter, index) => (
                                                                        <Chip
                                                                            key={index}
                                                                            label={filter}
                                                                            size="small"
                                                                            color="warning"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                fontSize: '10px',
                                                                                height: '20px',
                                                                                borderRadius: '10px',
                                                                                '& .MuiChip-label': {
                                                                                    px: 1
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        </AccordionSummary>
                                                        <AccordionDetails sx={{ pt: 0 }}>
                                                            <Grid container spacing={2}>
                                                                <Grid item xs={12} md={6}>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', mb: 1 }}>Origin</Typography>
                                                                    <Grid container spacing={1}>
                                                                        <Grid item xs={6}>
                                                                            <Autocomplete
                                                                                fullWidth
                                                                                options={getOriginAddresses}
                                                                                getOptionLabel={(option) => {
                                                                                    return `${option.nickname || option.companyName || 'Unknown'} - ${option.city || 'N/A'}`;
                                                                                }}
                                                                                value={(() => {
                                                                                    if (!advancedFilters.originCustomerName) return null;
                                                                                    const matchingAddress = getOriginAddresses.find(addr =>
                                                                                        `${addr.nickname || addr.companyName || 'Unknown'} - ${addr.city || 'N/A'}` === advancedFilters.originCustomerName
                                                                                    );
                                                                                    return matchingAddress || null;
                                                                                })()}
                                                                                onChange={(event, newValue) => {
                                                                                    if (newValue) {
                                                                                        const displayValue = `${newValue.nickname || newValue.companyName || 'Unknown'} - ${newValue.city || 'N/A'}`;
                                                                                        const newFilters = {
                                                                                            ...advancedFilters,
                                                                                            originCustomerName: displayValue,
                                                                                            originCity: newValue.city || '',
                                                                                            originProvince: newValue.province || newValue.state || '',
                                                                                            originCountry: newValue.country || '',
                                                                                            originPostalCode: newValue.postalCode || newValue.zipCode || ''
                                                                                        };
                                                                                        setAdvancedFilters(newFilters);

                                                                                        // Auto-apply immediately for address selection
                                                                                        autoApplyImmediate(newFilters);
                                                                                    } else {
                                                                                        const newFilters = {
                                                                                            ...advancedFilters,
                                                                                            originCustomerName: '',
                                                                                            originCity: '',
                                                                                            originProvince: '',
                                                                                            originCountry: '',
                                                                                            originPostalCode: ''
                                                                                        };
                                                                                        setAdvancedFilters(newFilters);
                                                                                        autoApplyImmediate(newFilters);
                                                                                    }
                                                                                }}
                                                                                renderOption={(props, option) => (
                                                                                    <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                                                                                        <Box>
                                                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                                {option.nickname || option.companyName || 'Unknown Location'}
                                                                                            </Typography>
                                                                                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                                                {option.street && `${option.street}, `}{option.city}, {option.province || option.state} {option.postalCode || option.zipCode}
                                                                                            </Typography>
                                                                                        </Box>
                                                                                    </Box>
                                                                                )}
                                                                                renderInput={(params) => (
                                                                                    <TextField
                                                                                        {...params}
                                                                                        label="Origin"
                                                                                        placeholder="Select origin location"
                                                                                        size="small"
                                                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                                        InputProps={{
                                                                                            ...params.InputProps,
                                                                                            endAdornment: (
                                                                                                <>
                                                                                                    {loadingAddresses && <CircularProgress color="inherit" size={20} />}
                                                                                                    {params.InputProps.endAdornment}
                                                                                                </>
                                                                                            ),
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                                sx={{ '& .MuiAutocomplete-listbox': { fontSize: '12px' } }}
                                                                            />
                                                                        </Grid>
                                                                        <Grid item xs={6}>
                                                                            <TextField
                                                                                fullWidth
                                                                                label="City"
                                                                                placeholder="e.g., Puslinch"
                                                                                value={advancedFilters.originCity}
                                                                                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, originCity: e.target.value }))}
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        </Grid>
                                                                        <Grid item xs={4}>
                                                                            <FormControl fullWidth size="small">
                                                                                <InputLabel sx={{ fontSize: '12px' }}>Province/State</InputLabel>
                                                                                <Select
                                                                                    value={advancedFilters.originProvince}
                                                                                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, originProvince: e.target.value }))}
                                                                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                                >
                                                                                    <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
                                                                                    {!advancedFilters.originCountry && (
                                                                                        <>
                                                                                            <ListSubheader sx={{ fontSize: '11px', fontWeight: 600 }}>Canadian Provinces</ListSubheader>
                                                                                            {provinceStateData.CA.map(prov => (
                                                                                                <MenuItem key={prov.code} value={prov.code} sx={{ fontSize: '12px' }}>
                                                                                                    {prov.name}
                                                                                                </MenuItem>
                                                                                            ))}
                                                                                            <ListSubheader sx={{ fontSize: '11px', fontWeight: 600 }}>US States</ListSubheader>
                                                                                            {provinceStateData.US.map(state => (
                                                                                                <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                                                    {state.name}
                                                                                                </MenuItem>
                                                                                            ))}
                                                                                        </>
                                                                                    )}
                                                                                    {advancedFilters.originCountry && provinceStateData[advancedFilters.originCountry]?.map(item => (
                                                                                        <MenuItem key={item.code} value={item.code} sx={{ fontSize: '12px' }}>
                                                                                            {item.name}
                                                                                        </MenuItem>
                                                                                    ))}
                                                                                </Select>
                                                                            </FormControl>
                                                                        </Grid>
                                                                        <Grid item xs={4}>
                                                                            <FormControl fullWidth size="small">
                                                                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                                                                <Select
                                                                                    value={advancedFilters.originCountry}
                                                                                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, originCountry: e.target.value, originProvince: '' }))}
                                                                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                                >
                                                                                    <MenuItem value="" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                                                                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                                                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                                                                </Select>
                                                                            </FormControl>
                                                                        </Grid>
                                                                        <Grid item xs={4}>
                                                                            <TextField
                                                                                fullWidth
                                                                                label={advancedFilters.originCountry === 'US' ? 'Zip Code' : 'Postal Code'}
                                                                                placeholder={advancedFilters.originCountry === 'US' ? 'e.g., 12345' : 'e.g., N0B2J0'}
                                                                                value={advancedFilters.originPostalCode}
                                                                                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, originPostalCode: e.target.value }))}
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        </Grid>
                                                                    </Grid>
                                                                </Grid>
                                                                <Grid item xs={12} md={6}>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', mb: 1 }}>Destination</Typography>
                                                                    <Grid container spacing={1}>
                                                                        <Grid item xs={6}>
                                                                            <Autocomplete
                                                                                fullWidth
                                                                                options={getDestinationAddresses}
                                                                                getOptionLabel={(option) => {
                                                                                    return `${option.nickname || option.companyName || 'Unknown'} - ${option.city || 'N/A'}`;
                                                                                }}
                                                                                value={(() => {
                                                                                    if (!advancedFilters.destinationCustomerName) return null;
                                                                                    const matchingAddress = getDestinationAddresses.find(addr =>
                                                                                        `${addr.nickname || addr.companyName || 'Unknown'} - ${addr.city || 'N/A'}` === advancedFilters.destinationCustomerName
                                                                                    );
                                                                                    return matchingAddress || null;
                                                                                })()}
                                                                                onChange={(event, newValue) => {
                                                                                    if (newValue) {
                                                                                        const displayValue = `${newValue.nickname || newValue.companyName || 'Unknown'} - ${newValue.city || 'N/A'}`;
                                                                                        const newFilters = {
                                                                                            ...advancedFilters,
                                                                                            destinationCustomerName: displayValue,
                                                                                            destinationCity: newValue.city || '',
                                                                                            destinationProvince: newValue.province || newValue.state || '',
                                                                                            destinationCountry: newValue.country || '',
                                                                                            destinationPostalCode: newValue.postalCode || newValue.zipCode || ''
                                                                                        };
                                                                                        setAdvancedFilters(newFilters);

                                                                                        // Auto-apply immediately for address selection
                                                                                        autoApplyImmediate(newFilters);
                                                                                    } else {
                                                                                        const newFilters = {
                                                                                            ...advancedFilters,
                                                                                            destinationCustomerName: '',
                                                                                            destinationCity: '',
                                                                                            destinationProvince: '',
                                                                                            destinationCountry: '',
                                                                                            destinationPostalCode: ''
                                                                                        };
                                                                                        setAdvancedFilters(newFilters);
                                                                                        autoApplyImmediate(newFilters);
                                                                                    }
                                                                                }}
                                                                                renderOption={(props, option) => (
                                                                                    <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                                                                                        <Box>
                                                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                                {option.nickname || option.companyName || 'Unknown Location'}
                                                                                            </Typography>
                                                                                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                                                {option.street && `${option.street}, `}{option.city}, {option.province || option.state} {option.postalCode || option.zipCode}
                                                                                            </Typography>
                                                                                        </Box>
                                                                                    </Box>
                                                                                )}
                                                                                renderInput={(params) => (
                                                                                    <TextField
                                                                                        {...params}
                                                                                        label="Destination"
                                                                                        placeholder="Select destination location"
                                                                                        size="small"
                                                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                                        InputProps={{
                                                                                            ...params.InputProps,
                                                                                            endAdornment: (
                                                                                                <>
                                                                                                    {loadingAddresses && <CircularProgress color="inherit" size={20} />}
                                                                                                    {params.InputProps.endAdornment}
                                                                                                </>
                                                                                            ),
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                                sx={{ '& .MuiAutocomplete-listbox': { fontSize: '12px' } }}
                                                                            />
                                                                        </Grid>
                                                                        <Grid item xs={6}>
                                                                            <TextField
                                                                                fullWidth
                                                                                label="City"
                                                                                placeholder="e.g., Tring-Jonction"
                                                                                value={advancedFilters.destinationCity}
                                                                                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, destinationCity: e.target.value }))}
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        </Grid>
                                                                        <Grid item xs={4}>
                                                                            <FormControl fullWidth size="small">
                                                                                <InputLabel sx={{ fontSize: '12px' }}>Province/State</InputLabel>
                                                                                <Select
                                                                                    value={advancedFilters.destinationProvince}
                                                                                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, destinationProvince: e.target.value }))}
                                                                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                                >
                                                                                    <MenuItem value="" sx={{ fontSize: '12px' }}>All</MenuItem>
                                                                                    {!advancedFilters.destinationCountry && (
                                                                                        <>
                                                                                            <ListSubheader sx={{ fontSize: '11px', fontWeight: 600 }}>Canadian Provinces</ListSubheader>
                                                                                            {provinceStateData.CA.map(prov => (
                                                                                                <MenuItem key={prov.code} value={prov.code} sx={{ fontSize: '12px' }}>
                                                                                                    {prov.name}
                                                                                                </MenuItem>
                                                                                            ))}
                                                                                            <ListSubheader sx={{ fontSize: '11px', fontWeight: 600 }}>US States</ListSubheader>
                                                                                            {provinceStateData.US.map(state => (
                                                                                                <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                                                    {state.name}
                                                                                                </MenuItem>
                                                                                            ))}
                                                                                        </>
                                                                                    )}
                                                                                    {advancedFilters.destinationCountry && provinceStateData[advancedFilters.destinationCountry]?.map(item => (
                                                                                        <MenuItem key={item.code} value={item.code} sx={{ fontSize: '12px' }}>
                                                                                            {item.name}
                                                                                        </MenuItem>
                                                                                    ))}
                                                                                </Select>
                                                                            </FormControl>
                                                                        </Grid>
                                                                        <Grid item xs={4}>
                                                                            <FormControl fullWidth size="small">
                                                                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                                                                <Select
                                                                                    value={advancedFilters.destinationCountry}
                                                                                    onChange={(e) => setAdvancedFilters(prev => ({ ...prev, destinationCountry: e.target.value, destinationProvince: '' }))}
                                                                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                                >
                                                                                    <MenuItem value="" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                                                                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                                                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                                                                </Select>
                                                                            </FormControl>
                                                                        </Grid>
                                                                        <Grid item xs={4}>
                                                                            <TextField
                                                                                fullWidth
                                                                                label={advancedFilters.destinationCountry === 'US' ? 'Zip Code' : 'Postal Code'}
                                                                                placeholder={advancedFilters.destinationCountry === 'US' ? 'e.g., 12345' : 'e.g., G0N1X0'}
                                                                                value={advancedFilters.destinationPostalCode}
                                                                                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, destinationPostalCode: e.target.value }))}
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        </Grid>
                                                                    </Grid>
                                                                </Grid>
                                                            </Grid>
                                                        </AccordionDetails>
                                                    </Accordion>

                                                    {/* Billing & Invoice Section - Moved to end */}
                                                    <Accordion
                                                        expanded={accordionExpanded.billing}
                                                        sx={{ mb: 1, '& .MuiAccordionSummary-root': { minHeight: 'auto' } }}
                                                    >
                                                        <AccordionSummary
                                                            expandIcon={
                                                                <ExpandMoreIcon
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, billing: !prev.billing }));
                                                                    }}
                                                                    sx={{ cursor: 'pointer' }}
                                                                />
                                                            }
                                                            sx={{ py: 1, cursor: 'default', '& .MuiAccordionSummary-content': { margin: 0 } }}
                                                        >
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                                                <Typography
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, billing: !prev.billing }));
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                >
                                                                    Billing & Invoice
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                    {getSectionActiveFilters('billing').map((filter, index) => (
                                                                        <Chip
                                                                            key={index}
                                                                            label={filter}
                                                                            size="small"
                                                                            color="info"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                fontSize: '10px',
                                                                                height: '20px',
                                                                                borderRadius: '10px',
                                                                                '& .MuiChip-label': {
                                                                                    px: 1
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            </Box>
                                                        </AccordionSummary>
                                                        <AccordionDetails sx={{ pt: 0 }}>
                                                            <Grid container spacing={2}>
                                                                {/* Invoice Status - First field */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Autocomplete
                                                                        fullWidth
                                                                        options={invoiceStatuses}
                                                                        getOptionLabel={(option) => option.statusLabel || ''}
                                                                        value={invoiceStatuses.find(status => status.statusCode === advancedFilters.invoiceStatus) || null}
                                                                        onChange={(event, newValue) => setAdvancedFilters(prev => ({ ...prev, invoiceStatus: newValue?.statusCode || '' }))}
                                                                        renderOption={(props, option) => (
                                                                            <Box component="li" {...props}>
                                                                                <Chip
                                                                                    label={option.statusLabel}
                                                                                    size="small"
                                                                                    sx={{
                                                                                        backgroundColor: option.color,
                                                                                        color: option.fontColor,
                                                                                        fontSize: '11px',
                                                                                        fontWeight: 500
                                                                                    }}
                                                                                />
                                                                            </Box>
                                                                        )}
                                                                        renderInput={(params) => (
                                                                            <TextField {...params} label="Invoice Status" size="small" sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }} />
                                                                        )}
                                                                    />
                                                                </Grid>
                                                                {/* EDI Numbers - Multiple with chips */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Autocomplete
                                                                        multiple
                                                                        freeSolo
                                                                        fullWidth
                                                                        options={[]}
                                                                        value={advancedFilters.ediNumbers}
                                                                        onChange={(event, newValue) => setAdvancedFilters(prev => ({ ...prev, ediNumbers: newValue }))}
                                                                        renderTags={(value, getTagProps) =>
                                                                            value.map((option, index) => (
                                                                                <Chip
                                                                                    variant="outlined"
                                                                                    label={option}
                                                                                    size="small"
                                                                                    sx={{ fontSize: '11px', height: '22px' }}
                                                                                    {...getTagProps({ index })}
                                                                                />
                                                                            ))
                                                                        }
                                                                        renderInput={(params) => (
                                                                            <TextField
                                                                                {...params}
                                                                                label="EDI Numbers"
                                                                                placeholder="Press Enter to add"
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        )}
                                                                    />
                                                                </Grid>
                                                                {/* Invoice Numbers - Multiple with chips */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <Autocomplete
                                                                        multiple
                                                                        freeSolo
                                                                        fullWidth
                                                                        options={[]}
                                                                        value={advancedFilters.invoiceNumbers}
                                                                        onChange={(event, newValue) => setAdvancedFilters(prev => ({ ...prev, invoiceNumbers: newValue }))}
                                                                        renderTags={(value, getTagProps) =>
                                                                            value.map((option, index) => (
                                                                                <Chip
                                                                                    variant="outlined"
                                                                                    label={option}
                                                                                    size="small"
                                                                                    sx={{ fontSize: '11px', height: '22px' }}
                                                                                    {...getTagProps({ index })}
                                                                                />
                                                                            ))
                                                                        }
                                                                        renderInput={(params) => (
                                                                            <TextField
                                                                                {...params}
                                                                                label="Invoice Numbers"
                                                                                placeholder="Press Enter to add"
                                                                                size="small"
                                                                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                            />
                                                                        )}
                                                                    />
                                                                </Grid>
                                                                {/* Bill Type - Moved to end */}
                                                                <Grid item xs={12} sm={6} md={3}>
                                                                    <FormControl fullWidth size="small">
                                                                        <InputLabel sx={{ fontSize: '12px' }}>Bill Type</InputLabel>
                                                                        <Select
                                                                            value={advancedFilters.billType}
                                                                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, billType: e.target.value }))}
                                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                        >
                                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>All Bill Types</MenuItem>
                                                                            <MenuItem value="prepaid" sx={{ fontSize: '12px' }}>Prepaid</MenuItem>
                                                                            <MenuItem value="collect" sx={{ fontSize: '12px' }}>Collect</MenuItem>
                                                                            <MenuItem value="third_party" sx={{ fontSize: '12px' }}>Third Party</MenuItem>
                                                                        </Select>
                                                                    </FormControl>
                                                                </Grid>
                                                            </Grid>
                                                        </AccordionDetails>
                                                    </Accordion>

                                                    {/* Financial Information Section - Hidden for now */}
                                                    {false && (
                                                        <Accordion
                                                            expanded={accordionExpanded.financial}
                                                            sx={{ mb: 1, '& .MuiAccordionSummary-root': { minHeight: 'auto' } }}
                                                        >
                                                            <AccordionSummary
                                                                expandIcon={
                                                                    <ExpandMoreIcon
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setAccordionExpanded(prev => ({ ...prev, financial: !prev.financial }));
                                                                        }}
                                                                        sx={{ cursor: 'pointer' }}
                                                                    />
                                                                }
                                                                sx={{ py: 1, cursor: 'default', '& .MuiAccordionSummary-content': { margin: 0 } }}
                                                            >
                                                                <Typography
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, financial: !prev.financial }));
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                >
                                                                    Financial Information
                                                                </Typography>
                                                            </AccordionSummary>
                                                            <AccordionDetails sx={{ pt: 0 }}>
                                                                <Grid container spacing={2}>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            label="Total Cost Range"
                                                                            placeholder="Min - Max"
                                                                            size="small"
                                                                            value={`${advancedFilters.totalCost[0] || ''} - ${advancedFilters.totalCost[1] || ''}`}
                                                                            onChange={(e) => {
                                                                                // TODO: Implement range picker
                                                                                console.log('Range picker not implemented yet');
                                                                            }}
                                                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            label="Total Charge Range"
                                                                            placeholder="Min - Max"
                                                                            size="small"
                                                                            value={`${advancedFilters.totalCharge[0] || ''} - ${advancedFilters.totalCharge[1] || ''}`}
                                                                            onChange={(e) => {
                                                                                // TODO: Implement range picker
                                                                                console.log('Range picker not implemented yet');
                                                                            }}
                                                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <FormControl fullWidth size="small">
                                                                            <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                                                                            <Select
                                                                                value={advancedFilters.currency}
                                                                                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, currency: e.target.value }))}
                                                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                            >
                                                                                <MenuItem value="" sx={{ fontSize: '12px' }}>All Currencies</MenuItem>
                                                                                <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD</MenuItem>
                                                                                <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD</MenuItem>
                                                                                <MenuItem value="EUR" sx={{ fontSize: '12px' }}>EUR</MenuItem>
                                                                            </Select>
                                                                        </FormControl>
                                                                    </Grid>
                                                                </Grid>
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    )}

                                                    {/* Package Information Section - Hidden for now */}
                                                    {false && (
                                                        <Accordion
                                                            expanded={accordionExpanded.packages}
                                                            sx={{ mb: 1, '& .MuiAccordionSummary-root': { minHeight: 'auto' } }}
                                                        >
                                                            <AccordionSummary
                                                                expandIcon={
                                                                    <ExpandMoreIcon
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setAccordionExpanded(prev => ({ ...prev, packages: !prev.packages }));
                                                                        }}
                                                                        sx={{ cursor: 'pointer' }}
                                                                    />
                                                                }
                                                                sx={{ py: 1, cursor: 'default', '& .MuiAccordionSummary-content': { margin: 0 } }}
                                                            >
                                                                <Typography
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, packages: !prev.packages }));
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                >
                                                                    Package Information
                                                                </Typography>
                                                            </AccordionSummary>
                                                            <AccordionDetails sx={{ pt: 0 }}>
                                                                <Grid container spacing={2}>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            label="Total Weight Range (lbs)"
                                                                            placeholder="Min - Max"
                                                                            size="small"
                                                                            value={`${advancedFilters.totalWeight[0] || ''} - ${advancedFilters.totalWeight[1] || ''}`}
                                                                            onChange={(e) => {
                                                                                // TODO: Implement range picker
                                                                                console.log('Range picker not implemented yet');
                                                                            }}
                                                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            label="Total Pieces Range"
                                                                            placeholder="Min - Max"
                                                                            size="small"
                                                                            value={`${advancedFilters.totalPieces[0] || ''} - ${advancedFilters.totalPieces[1] || ''}`}
                                                                            onChange={(e) => {
                                                                                // TODO: Implement range picker
                                                                                console.log('Range picker not implemented yet');
                                                                            }}
                                                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <FormControl fullWidth size="small">
                                                                            <InputLabel sx={{ fontSize: '12px' }}>Package Type</InputLabel>
                                                                            <Select
                                                                                value={advancedFilters.packageType}
                                                                                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, packageType: e.target.value }))}
                                                                                sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                            >
                                                                                <MenuItem value="" sx={{ fontSize: '12px' }}>All Types</MenuItem>
                                                                                <MenuItem value="BOX" sx={{ fontSize: '12px' }}>Box</MenuItem>
                                                                                <MenuItem value="PALLET" sx={{ fontSize: '12px' }}>Pallet</MenuItem>
                                                                                <MenuItem value="ENVELOPE" sx={{ fontSize: '12px' }}>Envelope</MenuItem>
                                                                                <MenuItem value="SKID" sx={{ fontSize: '12px' }}>Skid</MenuItem>
                                                                            </Select>
                                                                        </FormControl>
                                                                    </Grid>
                                                                </Grid>
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    )}

                                                    {/* Contact Information Section - Hidden for now */}
                                                    {false && (
                                                        <Accordion
                                                            expanded={accordionExpanded.contacts}
                                                            sx={{ mb: 1, '& .MuiAccordionSummary-root': { minHeight: 'auto' } }}
                                                        >
                                                            <AccordionSummary
                                                                expandIcon={
                                                                    <ExpandMoreIcon
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setAccordionExpanded(prev => ({ ...prev, contacts: !prev.contacts }));
                                                                        }}
                                                                        sx={{ cursor: 'pointer' }}
                                                                    />
                                                                }
                                                                sx={{ py: 1, cursor: 'default', '& .MuiAccordionSummary-content': { margin: 0 } }}
                                                            >
                                                                <Typography
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setAccordionExpanded(prev => ({ ...prev, contacts: !prev.contacts }));
                                                                    }}
                                                                    sx={{
                                                                        fontSize: '14px',
                                                                        fontWeight: 600,
                                                                        color: '#374151',
                                                                        cursor: 'pointer',
                                                                        userSelect: 'none'
                                                                    }}
                                                                >
                                                                    Contact Information
                                                                </Typography>
                                                            </AccordionSummary>
                                                            <AccordionDetails sx={{ pt: 0 }}>
                                                                <Grid container spacing={2}>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            label="Ship From Email"
                                                                            placeholder="e.g., contact@company.com"
                                                                            value={advancedFilters.shipFromEmail}
                                                                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, shipFromEmail: e.target.value }))}
                                                                            size="small"
                                                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            label="Ship From Phone"
                                                                            placeholder="e.g., (555) 123-4567"
                                                                            value={advancedFilters.shipFromPhone}
                                                                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, shipFromPhone: e.target.value }))}
                                                                            size="small"
                                                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            label="Ship To Email"
                                                                            placeholder="e.g., contact@company.com"
                                                                            value={advancedFilters.shipToEmail}
                                                                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, shipToEmail: e.target.value }))}
                                                                            size="small"
                                                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                    <Grid item xs={12} sm={6} md={3}>
                                                                        <TextField
                                                                            fullWidth
                                                                            label="Ship To Phone"
                                                                            placeholder="e.g., (555) 123-4567"
                                                                            value={advancedFilters.shipToPhone}
                                                                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, shipToPhone: e.target.value }))}
                                                                            size="small"
                                                                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                                                        />
                                                                    </Grid>
                                                                </Grid>
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    )}

                                                    {/* Apply and Clear Filters */}
                                                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <FormControlLabel
                                                                control={
                                                                    <Switch
                                                                        checked={isAutoApply}
                                                                        onChange={(e) => setIsAutoApply(e.target.checked)}
                                                                        size="small"
                                                                        sx={{ '& .MuiSwitch-track': { fontSize: '11px' } }}
                                                                    />
                                                                }
                                                                label={
                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        Auto-apply filters
                                                                    </Typography>
                                                                }
                                                                sx={{ mr: 0 }}
                                                            />
                                                            {isApplyingFilters && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <CircularProgress size={12} />
                                                                    <Typography sx={{ fontSize: '11px', color: '#6366f1' }}>
                                                                        Filtering...
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                        </Box>
                                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                                            <Button
                                                                variant="outlined"
                                                                startIcon={<ClearIcon />}
                                                                onClick={() => {
                                                                    setAdvancedFilters({
                                                                        // Basic Information
                                                                        companyId: '', customerId: '', shipmentIds: [], shipmentType: '',
                                                                        // Billing & Invoice
                                                                        billType: '', invoiceStatus: '', ediNumbers: [], invoiceNumbers: [],
                                                                        // Timing Information
                                                                        createdAt: [null, null], shipmentDate: [null, null], eta1: [null, null], eta2: [null, null], lastUpdated: [null, null],
                                                                        // Tracking & Status
                                                                        currentStatuses: [], carrier: '', trackingNumbers: [], referenceNumbers: [],
                                                                        // Origin and Destination
                                                                        originCustomerName: '', originCity: '', originProvince: '', originCountry: '', originPostalCode: '',
                                                                        destinationCustomerName: '', destinationCity: '', destinationProvince: '', destinationCountry: '', destinationPostalCode: '',
                                                                        // Financial
                                                                        totalCost: [null, null], totalCharge: [null, null], currency: '',
                                                                        // Package Information
                                                                        totalWeight: [null, null], totalPieces: [null, null], packageType: '',
                                                                        // Contact Information
                                                                        shipFromEmail: '', shipFromPhone: '', shipToEmail: '', shipToPhone: ''
                                                                    });
                                                                }}
                                                                size="small"
                                                                sx={{ fontSize: '12px' }}
                                                            >
                                                                Clear All Filters
                                                            </Button>
                                                            <Button
                                                                variant={isAutoApply ? "outlined" : "contained"}
                                                                color="primary"
                                                                startIcon={isApplyingFilters ? <CircularProgress size={14} /> : <SearchIcon />}
                                                                onClick={() => {
                                                                    // Manual override - always apply filters regardless of auto-apply setting
                                                                    console.log('Manually applying advanced filters:', advancedFilters);
                                                                    setIsApplyingFilters(true);
                                                                    loadShipments(null, unifiedSearch, null, null, advancedFilters).finally(() => {
                                                                        setIsApplyingFilters(false);
                                                                    });
                                                                    // Collapse the filters panel after applying
                                                                    setFiltersOpen(false);
                                                                }}
                                                                disabled={isApplyingFilters}
                                                                size="small"
                                                                sx={{ fontSize: '12px' }}
                                                            >
                                                                {isApplyingFilters ? 'Applying...' : (isAutoApply ? 'Manual Apply' : 'Apply Filters')}
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                </Box>












                                            </>
                                        )}
                                    </Box>
                                </Collapse>
                            </Paper >

                            {/* Top Pagination - Show if more than 1 page and filters are closed */}
                            {(() => {
                                const totalPages = rowsPerPage > 0 ? Math.ceil(totalCount / rowsPerPage) : 1;
                                return totalPages > 1 && !filtersOpen && (
                                    <Box sx={{
                                        borderTop: '1px solid #e2e8f0',
                                        borderBottom: '1px solid #e2e8f0',
                                        bgcolor: '#f8fafc',
                                        py: 0.5,
                                        px: 1
                                    }}>
                                        <ShipmentsPagination
                                            totalCount={totalCount}
                                            page={page}
                                            rowsPerPage={rowsPerPage}
                                            onPageChange={(event, newPage) => {
                                                setPage(newPage);
                                                setTimeout(() => loadShipments(null, unifiedSearch, null, null, advancedFilters), 50);
                                            }}
                                            onRowsPerPageChange={(event) => {
                                                setRowsPerPage(parseInt(event.target.value, 10));
                                                setPage(0);
                                                setTimeout(() => loadShipments(null, unifiedSearch, null, null, advancedFilters), 50);
                                            }}
                                        />
                                    </Box>
                                );
                            })()}

                            {/* Shipments Table */}
                            {
                                loading ? (
                                    <ShipmentsTableSkeleton rows={rowsPerPage === -1 ? 10 : Math.min(rowsPerPage, 10)} />
                                ) : (
                                    <ShipmentsTable
                                        shipments={shipments}
                                        loading={false}
                                        selected={selected}
                                        onSelectAll={handleSelectAll}
                                        onSelect={handleSelect}
                                        onViewShipmentDetail={handleViewShipmentDetail}
                                        onActionMenuOpen={handleActionMenuOpen}
                                        onEditDraftShipment={handleEditDraftShipment}
                                        onEditShipment={handleEditShipment}
                                        customers={customers}
                                        companyData={companyDataForRows}
                                        carrierData={carrierData}
                                        searchFields={searchFields}
                                        highlightSearchTerm={highlightSearchTerm}
                                        showSnackbar={showSnackbar}
                                        onOpenTrackingDrawer={handleOpenTrackingDrawer}
                                        adminViewMode={adminViewMode}
                                        // Sorting props
                                        sortBy={sortBy}
                                        sortDirection={sortDirection}
                                        onSort={handleSort}
                                    />
                                )
                            }
                        </Box >
                    </Box >
                );
            case 'shipment-detail':

                return (
                    <Suspense fallback={<CircularProgress />}>
                        <ShipmentDetailX
                            {...view.props}
                            onBackToTable={popView}
                            // Pass through adminViewMode to ShipmentDetailX
                            isAdmin={adminViewMode !== null}
                            // Pass the shipment updated callback to refresh table data
                            onShipmentUpdated={handleShipmentUpdated}
                        />
                    </Suspense>
                );
            default:
                console.log('❌ Unknown view component:', view.component);
                return <div>Unknown view: {view.component}</div>;
        }
    };

    // Handle back button click from modal header
    const handleBackClick = () => {
        console.log('🔙 handleBackClick called');
        console.log('📚 Current navigation stack:', navigationStack.map(v => v.key));
        console.log('🎯 Navigation stack length:', navigationStack.length);

        // 🧨 NUCLEAR CLEANUP: Destroy ALL persistent session data FIRST
        console.log('🧨🧹 NUCLEAR CLEANUP in handleBackClick: Destroying ALL persistent session data');

        // Clear deep link parameters FIRST to prevent any auto-navigation
        if (onClearDeepLinkParams) {
            console.log('🧹 Clearing deep link params in handleBackClick');
            onClearDeepLinkParams();
        }

        // DESTROY all auto-navigation flags and session state
        console.log('🧹 Destroying all auto-navigation flags during back navigation');
        setHasAutoOpenedShipment(false);
        setIsReturningFromDetail(true); // Mark that we're returning from detail

        // 🔍 CRITICAL FIX: Clear search state when going back
        console.log('🔍 Clearing search state during back navigation');
        setUnifiedSearch('');
        setLiveResults([]);
        setShowLiveResults(false);
        setSelectedResultIndex(-1);
        setIsSemanticMode(false);
        setSemanticSearchResults(null);
        setSearchConfidence(0);

        // Clear window-level session storage
        if (typeof window !== 'undefined') {
            try {
                // Clear rate limiting
                delete window.lastAutoNavigation;

                // Clear any other navigation-related window properties
                Object.keys(window).forEach(key => {
                    if (key.includes('shipment') || key.includes('navigation') || key.includes('deepLink')) {
                        delete window[key];
                        console.log('🧹 Cleared window property:', key);
                    }
                });
            } catch (e) {
                console.log('Note: Some window cleanup operations not available');
            }
        }

        if (navigationStack.length > 1) {
            console.log('✅ Calling popView()');
            popView();
        } else if (hasAutoOpenedShipment && isModal) {
            // SPECIAL CASE: If we auto-opened a shipment from deep link and user wants to go back,
            // navigate to the shipments table instead of closing the modal entirely
            console.log('🔄 Auto-opened shipment detected - navigating back to table instead of closing modal');
            setNavigationStack([{ key: 'table', component: 'table', props: {} }]);
            setMountedViews(['table']);
            setIsReturningFromDetail(false); // Reset since we're staying in the modal
        } else if (onModalBack) {
            console.log('✅ Calling onModalBack()');
            onModalBack();
        } else if (onClose && isModal) {
            console.log('✅ Calling onClose()');
            onClose();
        } else if (adminViewMode && !isModal) {
            // Special case for admin view when not in modal
            console.log('✅ Admin view - staying on shipments page, resetting to clean table state');

            // COMPLETE RESET: Reset to completely clean table state
            setNavigationStack([{ key: 'table', component: 'table', props: {} }]);
            setMountedViews(['table']);

            // ADDITIONAL CLEANUP for admin view
            setTimeout(() => {
                setIsReturningFromDetail(false);
                console.log('🧹 Admin view cleanup complete');
            }, 100);
        } else {
            console.log('✅ Navigating to dashboard');
            navigate('/dashboard');
        }
    };

    // Handle close button click specifically
    const handleCloseClick = () => {
        console.log('❌ Close button clicked - checking navigation state');

        // SPECIAL CASE: If we auto-opened a shipment from deep link and user clicks X button,
        // check if we should navigate back to table instead of closing modal entirely
        if (hasAutoOpenedShipment && navigationStack.length <= 1) {
            console.log('🔄 Auto-opened shipment detected with X button - navigating back to table instead of closing modal');

            // Clear deep link parameters since we're handling the navigation
            if (onClearDeepLinkParams) {
                console.log('🧹 Clearing deep link params in handleCloseClick');
                onClearDeepLinkParams();
            }

            // Navigate to table view
            setNavigationStack([{ key: 'table', component: 'table', props: {} }]);
            setMountedViews(['table']);
            setIsReturningFromDetail(false); // Reset since we're staying in the modal
            setHasAutoOpenedShipment(false); // Clear the flag since we've handled it
            return; // Don't close the modal
        }

        // STANDARD BEHAVIOR: Normal close button behavior
        console.log('❌ Standard close button behavior - resetting state and closing modal');

        // CRITICAL FIX: Clear deep link parameters FIRST
        if (onClearDeepLinkParams) {
            console.log('🧹 Clearing deep link params in handleCloseClick');
            onClearDeepLinkParams();
        }

        // CRITICAL FIX: Clear auto-open state when closing modal
        console.log('🧹 Clearing auto-open state during modal close');
        setHasAutoOpenedShipment(false);
        setIsReturningFromDetail(false); // Reset the returning flag

        // Reset to defaults
        resetToDefaults();

        // Then call the onClose handler
        if (onClose) {
            onClose();
        }
    };

    // Add missing handler functions
    const handleClearFilters = useCallback(() => {
        console.log('🧹 Clearing all filters and search');

        // Clear unified search
        setUnifiedSearch('');

        // Clear legacy search fields
        setSearchFields({
            shipmentId: '',
            referenceNumber: '',
            trackingNumber: '',
            customerName: '',
            origin: '',
            destination: ''
        });

        // Clear filters
        setFilters({
            status: 'all',
            carrier: 'all',
            dateRange: [null, null],
            shipmentType: 'all',
            enhancedStatus: ''
        });

        // Clear date range and customer selection
        setDateRange([null, null]);
        setSelectedCustomer('');
        setSelectedInvoiceStatus('');

        // Reload with cleared filters
        setTimeout(() => loadShipments(null, ''), 100);
    }, [loadShipments]);

    const handleBatchRefreshStatus = useCallback(async () => {
        if (selected.length === 0) return;

        setIsUpdating(true);
        try {
            // Implement batch status update logic here
            console.log('Batch updating status for shipments:', selected);
            // This would call the actual status update function
        } catch (error) {
            console.error('Error updating batch status:', error);
        } finally {
            setIsUpdating(false);
        }
    }, [selected]);

    // Handle deleting selected drafts
    const handleDeleteSelectedDrafts = useCallback(async () => {
        if (selected.length === 0) return;

        setIsDeletingDrafts(true);
        try {
            const draftShipments = shipments.filter(s =>
                selected.includes(s.id) && s.status === 'draft'
            );

            if (draftShipments.length === 0) {
                showSnackbar('No draft shipments selected', 'warning');
                return;
            }

            // Delete each selected draft
            const deletePromises = draftShipments.map(shipment =>
                deleteDoc(doc(db, 'shipments', shipment.id))
            );

            await Promise.all(deletePromises);

            showSnackbar(`Successfully deleted ${draftShipments.length} draft shipment${draftShipments.length > 1 ? 's' : ''}`, 'success');
            setSelected([]); // Clear selection
            loadShipments(null, unifiedSearch, null, null, advancedFilters); // Reload the shipments list
        } catch (error) {
            console.error('Error deleting selected drafts:', error);
            showSnackbar('Error deleting draft shipments', 'error');
        } finally {
            setIsDeletingDrafts(false);
            setIsDeleteDraftsDialogOpen(false);
        }
    }, [selected, shipments, showSnackbar, loadShipments]); // Removed unifiedSearch from dependencies

    // Handle editing a draft shipment
    const handleEditDraftShipment = useCallback(async (draftId) => {
        console.log('📝 handleEditDraftShipment called with draftId:', draftId);

        try {
            // First, check what type of draft this is by examining the creationMethod
            const draftDoc = await getDoc(doc(db, 'shipments', draftId));
            if (!draftDoc.exists()) {
                showSnackbar('Draft shipment not found', 'error');
                return;
            }

            const draftData = draftDoc.data();
            const creationMethod = draftData.creationMethod;
            const draftCompanyId = draftData.companyID;

            console.log('🔍 Draft creation method:', creationMethod);
            console.log('🏢 Draft company ID:', draftCompanyId);
            console.log('👤 Current user role:', userRole);
            console.log('🏢 Current company context:', companyIdForAddress);

            // 🚀 ADMIN/SUPER ADMIN AUTO-COMPANY-SWITCHING LOGIC
            // If admin or super admin clicks on a draft from a different company, automatically switch context
            if ((userRole === 'admin' || userRole === 'superadmin') && draftCompanyId && draftCompanyId !== companyIdForAddress) {
                console.log('🚀 Admin/Super admin accessing draft from different company - auto-switching context');
                console.log('🔍 Draft company:', draftCompanyId, 'Current context:', companyIdForAddress);

                // Always switch context when there's a mismatch to ensure proper data loading
                console.log('🔄 Company context mismatch detected, switching to draft company context');

                try {
                    // Query for the draft's company data
                    const companiesQuery = query(
                        collection(db, 'companies'),
                        where('companyID', '==', draftCompanyId),
                        limit(1)
                    );

                    const companiesSnapshot = await getDocs(companiesQuery);

                    if (!companiesSnapshot.empty) {
                        const companyDoc = companiesSnapshot.docs[0];
                        const companyDocData = companyDoc.data();

                        const targetCompanyData = {
                            ...companyDocData,
                            id: companyDoc.id
                        };

                        console.log('🔄 Switching to company context:', targetCompanyData.name, '(', draftCompanyId, ')');

                        // Switch company context - this will update companyIdForAddress and companyData
                        await setCompanyContext(targetCompanyData);

                        // Show success message
                        showSnackbar(`Switched to ${targetCompanyData.name || draftCompanyId} to edit draft`, 'success');

                        // Small delay to ensure context is fully updated before proceeding
                        await new Promise(resolve => setTimeout(resolve, 200));

                        console.log('✅ Company context switched successfully');
                    } else {
                        console.warn('⚠️ Company not found for draft:', draftCompanyId);
                        showSnackbar(`Warning: Company ${draftCompanyId} not found, proceeding with current context`, 'warning');
                    }
                } catch (companyError) {
                    console.error('❌ Error switching company context:', companyError);
                    showSnackbar('Error switching company context, proceeding with current context', 'warning');
                }
            }

            // Proceed with opening the draft for editing
            if (creationMethod === 'quickship') {
                console.log('🚀 Opening QuickShip for quickship draft');
                // For QuickShip drafts, open in QuickShip mode
                if (onOpenCreateShipment) {
                    // Pass refresh callbacks to QuickShip
                    onOpenCreateShipment(null, null, draftId, 'quickship', {
                        onShipmentUpdated: handleShipmentUpdated,
                        onDraftSaved: handleDraftSaved,
                        onReturnToShipments: () => {
                            // Refresh the table when returning from draft editing
                            setTimeout(() => loadShipments(null, unifiedSearch), 100);
                        }
                    });
                } else {
                    console.error('❌ No onOpenCreateShipment callback available for QuickShip draft editing');
                    showSnackbar('Cannot edit QuickShip draft - feature not available in this context', 'error');
                    return;
                }
            } else {
                console.log('🔧 Opening advanced CreateShipment for advanced/legacy draft');
                // For advanced drafts or legacy drafts without creationMethod, use the advanced flow
                if (onOpenCreateShipment) {
                    // Pass refresh callbacks to CreateShipmentX
                    onOpenCreateShipment(null, draftId, null, null, {
                        onShipmentUpdated: handleShipmentUpdated,
                        onDraftSaved: handleDraftSaved,
                        onReturnToShipments: () => {
                            // Refresh the table when returning from draft editing
                            setTimeout(() => loadShipments(null, unifiedSearch), 100);
                        }
                    });
                } else {
                    console.error('❌ No onOpenCreateShipment callback available for advanced draft editing');
                    showSnackbar('Cannot edit draft - feature not available in this context', 'error');
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking draft type:', error);
            showSnackbar('Error loading draft shipment', 'error');
        }
    }, [onOpenCreateShipment, showSnackbar, userRole, companyIdForAddress, setCompanyContext, handleShipmentUpdated, handleDraftSaved, loadShipments]); // Removed unifiedSearch from dependencies

    // Handle repeating a shipment (creating a new draft with pre-populated data)
    const handleRepeatShipment = useCallback(async (shipment) => {
        try {
            // Prepare the pre-populated data from the existing shipment
            const prePopulatedData = {
                shipmentInfo: {
                    shipmentType: shipment.shipmentInfo?.shipmentType || shipment.shipmentType || '',
                    shipmentDate: new Date().toISOString().split('T')[0], // Set to today's date
                    serviceType: shipment.shipmentInfo?.serviceType || shipment.serviceType || '',
                    specialInstructions: shipment.shipmentInfo?.specialInstructions || '',
                    referenceNumber: '', // Clear reference number for new shipment
                    customerReference: shipment.shipmentInfo?.customerReference || ''
                },
                shipFrom: {
                    company: shipment.shipFrom?.company || '',
                    street: shipment.shipFrom?.street || '',
                    street2: shipment.shipFrom?.street2 || '',
                    city: shipment.shipFrom?.city || '',
                    state: shipment.shipFrom?.state || '',
                    postalCode: shipment.shipFrom?.postalCode || '',
                    country: shipment.shipFrom?.country || 'US',
                    contactName: shipment.shipFrom?.contactName || '',
                    contactPhone: shipment.shipFrom?.contactPhone || '',
                    contactEmail: shipment.shipFrom?.contactEmail || ''
                },
                shipTo: {
                    customerID: shipment.shipTo?.customerID || '',
                    company: shipment.shipTo?.company || '',
                    street: shipment.shipTo?.street || '',
                    street2: shipment.shipTo?.street2 || '',
                    city: shipment.shipTo?.city || '',
                    state: shipment.shipTo?.state || '',
                    postalCode: shipment.shipTo?.postalCode || '',
                    country: shipment.shipTo?.country || 'US',
                    contactName: shipment.shipTo?.contactName || '',
                    contactPhone: shipment.shipTo?.contactPhone || '',
                    contactEmail: shipment.shipTo?.contactEmail || ''
                },
                packages: shipment.packages ? shipment.packages.map(pkg => ({
                    itemDescription: pkg.itemDescription || '',
                    packagingType: pkg.packagingType || '',
                    packagingQuantity: pkg.packagingQuantity || 1,
                    weight: pkg.weight || '',
                    height: pkg.height || '',
                    width: pkg.width || '',
                    length: pkg.length || '',
                    declaredValue: pkg.declaredValue || '',
                    hazmat: pkg.hazmat || false
                })) : []
            };

            console.log('🔄 Repeating shipment with pre-populated data:', prePopulatedData);

            // Call the onOpenCreateShipment callback with pre-populated data and refresh callbacks
            if (onOpenCreateShipment) {
                onOpenCreateShipment(prePopulatedData, null, null, null, {
                    onShipmentUpdated: handleShipmentUpdated,
                    onDraftSaved: handleDraftSaved,
                    onReturnToShipments: () => {
                        // Refresh the table when returning from shipment creation
                        setTimeout(() => loadShipments(null, unifiedSearch), 100);
                    }
                });
            } else {
                showSnackbar('Cannot open create shipment - feature not available in this context', 'error');
            }
        } catch (error) {
            console.error('Error repeating shipment:', error);
            showSnackbar('Error creating repeat shipment', 'error');
        }
    }, [onOpenCreateShipment, showSnackbar, handleShipmentUpdated, handleDraftSaved, loadShipments, unifiedSearch]);

    // Handle editing a booked shipment
    const handleEditShipment = useCallback((shipment) => {
        console.log('📝 handleEditShipment called for booked shipment:', shipment.shipmentID || shipment.id);

        // Navigate to the shipment detail view and trigger edit mode
        // This will open the shipment detail and automatically open the edit modal
        pushView({
            key: `shipment-detail-${shipment.id}-edit`,
            component: 'shipment-detail',
            props: {
                shipmentId: shipment.id,
                editMode: true // Flag to automatically open edit modal
            }
        });
    }, [pushView]);

    // Handle refresh table data
    const handleRefreshTable = useCallback(() => {
        loadShipments(null, unifiedSearch, null, null, advancedFilters);
        showSnackbar('Refreshing shipments data...', 'info');
    }, [loadShipments, showSnackbar, advancedFilters]); // Added advancedFilters to dependencies

    // Handle archive shipment
    const handleArchiveShipment = useCallback(async (shipment) => {
        try {
            console.log('📦 Archiving shipment:', shipment.shipmentID || shipment.id);

            // Call the archive cloud function
            const archiveShipmentFunction = httpsCallable(functions, 'archiveShipment');
            const result = await archiveShipmentFunction({
                shipmentId: shipment.shipmentID || shipment.id,
                firebaseDocId: shipment.id,
                reason: 'User requested archive from shipments table'
            });

            if (result.data.success) {
                showSnackbar('Shipment archived successfully', 'success');
                // Reload shipments to reflect the change
                loadShipments(null, unifiedSearch, null, null, advancedFilters);
            } else {
                showSnackbar('Failed to archive shipment', 'error');
            }
        } catch (error) {
            console.error('Error archiving shipment:', error);
            showSnackbar(error.message || 'Error archiving shipment', 'error');
        }
    }, [showSnackbar, loadShipments]); // Removed unifiedSearch from dependencies

    // Create dynamic navigation object based on current state
    const getNavigationObject = () => {
        const currentView = navigationStack[navigationStack.length - 1];
        const currentModalPage = modalNavigation.getCurrentPage();

        // Special handling for admin view
        const isAdminView = adminViewMode !== null;

        return {
            title: currentView?.component === 'shipment-detail'
                ? currentModalPage?.title || 'Shipment Detail' // Use shipment ID from modal navigation
                : isAdminView ? 'Admin Shipments' : 'Shipments',
            canGoBack: navigationStack.length > 1 || (isAdminView && !isModal),
            onBack: navigationStack.length > 1 ? popView : (onModalBack || onClose),
            backText: navigationStack.length > 1 ? (isAdminView ? '' : 'Shipments') : 'Back'
        };
    };

    // Helper function to map enhanced status to legacy status for backward compatibility
    const enhancedToLegacy = (enhancedStatus) => {
        // This would map enhanced status IDs to legacy status names
        // For now, return 'all' to maintain compatibility
        return 'all';
    };

    // Show loading state
    if (authLoading || companyCtxLoading) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh'
            }}>
                <CircularProgress />
            </Box>
        );
    }

    // Check if we're in admin "all companies" mode
    const isAdminAllView = adminViewMode === 'all';

    // No company ID - but allow admin view mode
    if (!companyIdForAddress && !isAdminAllView) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                p: 3
            }}>
                <Alert severity="warning">
                    Please select a company to view shipments.
                </Alert>
            </Box>
        );
    }

    return (
        <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                {/* Modal Header - Show for modal mode, but hide for admin users viewing shipment details */}
                {(isModal && !(adminViewMode && navigationStack.length > 1)) && (
                    <EnterpriseModalHeader
                        navigation={getNavigationObject()}
                        onBack={handleBackClick}
                        showBackButton={true}
                        onClose={showCloseButton && isModal ? handleCloseClick : null}
                        showCloseButton={showCloseButton && isModal}
                        unifiedSearch={unifiedSearch}
                        setUnifiedSearch={setUnifiedSearch}
                        liveResults={liveResults}
                        setLiveResults={setLiveResults}
                        showLiveResults={showLiveResults}
                        setShowLiveResults={setShowLiveResults}
                        selectedResultIndex={selectedResultIndex}
                        setSelectedResultIndex={setSelectedResultIndex}
                        handleViewShipmentDetail={handleViewShipmentDetail}
                        allShipments={allShipments}
                        customers={customers}
                        generateLiveShipmentResults={generateLiveShipmentResults}
                        loadShipments={loadShipments}
                        handleEditDraftShipment={handleEditDraftShipment}
                        reloadShipments={reloadShipments}
                        performSemanticSearch={performSemanticSearch}
                        isSemanticMode={isSemanticMode}
                        setIsSemanticMode={setIsSemanticMode}
                        semanticSearchResults={semanticSearchResults}
                        setSemanticSearchResults={setSemanticSearchResults}
                        searchConfidence={searchConfidence}
                        setSearchConfidence={setSearchConfidence}
                        setSearchFields={setSearchFields}
                        setSelectedCustomer={setSelectedCustomer}
                        showSnackbar={showSnackbar}
                        adminViewMode={adminViewMode}
                        isShipmentDetailView={navigationStack[navigationStack.length - 1]?.component === 'shipment-detail'}
                    />
                )}

                {/* Sliding Container */}
                <Box
                    sx={{
                        display: 'flex',
                        width: '200%',
                        height: '100%',
                        position: 'relative',
                        transform:
                            sliding && slideDirection === 'forward'
                                ? 'translateX(-50%)'
                                : sliding && slideDirection === 'backward'
                                    ? 'translateX(0%)'
                                    : navigationStack.length > 1
                                        ? 'translateX(-50%)'
                                        : 'translateX(0%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: 'transform',
                    }}
                >
                    {/* Render previous and current views if sliding, else just current */}
                    {mountedViews.map((key, idx) => {
                        const view = navigationStack.find((v) => v.key === key);
                        if (!view) {
                            console.warn('⚠️ View not found in navigation stack:', key);
                            return null;
                        }
                        return (
                            <div key={key} style={{ width: '50%', flexShrink: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                {/* Main Content Area (scrollable) */}
                                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                                    {renderView(view)}
                                </Box>
                                {/* Pagination Footer */}
                                <Box sx={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', bgcolor: '#fafafa', p: 1 }}>
                                    <ShipmentsPagination
                                        totalCount={totalCount}
                                        page={page}
                                        rowsPerPage={rowsPerPage}
                                        onPageChange={(event, newPage) => {
                                            setPage(newPage);
                                            setTimeout(() => loadShipments(null, unifiedSearch, null, null, advancedFilters), 50);
                                        }}
                                        onRowsPerPageChange={(event) => {
                                            setRowsPerPage(parseInt(event.target.value, 10));
                                            setPage(0);
                                            setTimeout(() => loadShipments(null, unifiedSearch, null, null, advancedFilters), 50);
                                        }}
                                    />
                                </Box>
                            </div>
                        );
                    })}
                </Box>
            </Box>

            {/* Export Dialog */}
            <ExportDialog
                open={isExportDialogOpen}
                onClose={() => setIsExportDialogOpen(false)}
                selectedExportFormat={selectedExportFormat}
                setSelectedExportFormat={setSelectedExportFormat}
                shipments={filteredShipments}
                carrierData={carrierData}
                customers={customers}
            />

            {/* Action Menu */}
            <ShipmentActionMenu
                anchorEl={actionMenuAnchorEl}
                open={Boolean(actionMenuAnchorEl)}
                onClose={handleActionMenuClose}
                selectedShipment={selectedShipment}
                onViewShipmentDetail={handleViewShipmentDetail}
                onRepeatShipment={handleRepeatShipment}
                onEditDraftShipment={handleEditDraftShipment}
                onEditShipment={handleEditShipment}
                onArchiveShipment={handleArchiveShipment}
                onPrintLabel={async (shipment) => {
                    try {
                        // Get document availability using the same logic as the menu
                        const availability = await checkDocumentAvailability(shipment);

                        if (!availability.hasLabels) {
                            showSnackbar('No label available for this shipment', 'warning');
                            return;
                        }

                        // Get the documents
                        const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
                        const documentsResult = await getShipmentDocumentsFunction({
                            shipmentId: shipment.id,
                            organized: true
                        });

                        if (!documentsResult.data || !documentsResult.data.success) {
                            showSnackbar('Error loading label', 'error');
                            return;
                        }

                        const documents = documentsResult.data.data;
                        let labelUrl = null;

                        // First check dedicated labels array
                        if (documents.labels && documents.labels.length > 0) {
                            labelUrl = documents.labels[0].downloadUrl;
                        } else {
                            // Check in other documents for potential labels (excluding BOL array)
                            const nonBolDocs = Object.entries(documents)
                                .filter(([key]) => key !== 'bol') // Explicitly exclude BOL array
                                .map(([, docs]) => docs)
                                .flat();

                            const potentialLabel = nonBolDocs.find(doc => {
                                const filename = (doc.filename || '').toLowerCase();
                                const documentType = (doc.documentType || '').toLowerCase();
                                const isGeneratedBOL = doc.isGeneratedBOL === true || doc.metadata?.eshipplus?.generated === true;

                                // Exclude any BOL documents more strictly
                                if (filename.includes('bol') ||
                                    filename.includes('billoflading') ||
                                    filename.includes('bill-of-lading') ||
                                    filename.includes('bill_of_lading') ||
                                    documentType.includes('bol') ||
                                    isGeneratedBOL) {
                                    return false;
                                }

                                // More specific label detection
                                return filename.includes('label') ||
                                    filename.includes('prolabel') ||
                                    filename.includes('pro-label') ||
                                    filename.includes('shipping_label') ||
                                    filename.includes('shippinglabel') ||
                                    documentType.includes('label');
                            });

                            if (potentialLabel) {
                                labelUrl = potentialLabel.downloadUrl;
                            }
                        }

                        if (!labelUrl) {
                            showSnackbar('No label available for this shipment', 'warning');
                            return;
                        }

                        // Open PDF viewer dialog with label
                        setPdfViewerOpen(true);
                        setPdfUrl(labelUrl);
                        setPdfTitle(`Label - ${shipment.shipmentID || shipment.id}`);
                    } catch (error) {
                        console.error('Error handling print label:', error);
                        showSnackbar('Error loading label', 'error');
                    }
                }}
                onPrintBOL={async (shipment) => {
                    try {
                        // Check if it's a freight shipment
                        const isFreight = shipment.shipmentInfo?.shipmentType?.toLowerCase().includes('freight') ||
                            shipment.shipmentType?.toLowerCase().includes('freight');

                        if (!isFreight) {
                            showSnackbar('BOL is only available for freight shipments', 'warning');
                            return;
                        }

                        // Get document availability using the same logic as the menu
                        const availability = await checkDocumentAvailability(shipment);

                        if (!availability.hasBOLs) {
                            showSnackbar('No BOL available for this shipment', 'warning');
                            return;
                        }

                        // Get the documents
                        const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
                        const documentsResult = await getShipmentDocumentsFunction({
                            shipmentId: shipment.id,
                            organized: true
                        });

                        if (!documentsResult.data || !documentsResult.data.success) {
                            showSnackbar('Error loading BOL', 'error');
                            return;
                        }

                        const documents = documentsResult.data.data;
                        const bolDocuments = documents.bol || [];

                        if (bolDocuments.length === 0) {
                            showSnackbar('No BOL available for this shipment', 'warning');
                            return;
                        }

                        // Enhanced BOL selection with priority for latest regenerated documents
                        // (Same algorithm as useShipmentActions.js)
                        const sortedBOLs = [...bolDocuments].sort((a, b) => {
                            // Priority 1: Documents marked as latest
                            if (a.isLatest && !b.isLatest) return -1;
                            if (!a.isLatest && b.isLatest) return 1;

                            // Priority 2: Higher version numbers (more recent regenerations)
                            const aVersion = a.version || 0;
                            const bVersion = b.version || 0;
                            if (aVersion !== bVersion) return bVersion - aVersion;

                            // Priority 3: Most recently regenerated documents
                            const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                            const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                            if (aRegenTime && bRegenTime) {
                                return bRegenTime - aRegenTime;
                            }
                            if (aRegenTime && !bRegenTime) return -1;
                            if (!aRegenTime && bRegenTime) return 1;

                            // Priority 4: SOLUSHIP naming convention (our standard format)
                            const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                            const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                            if (aIsSoluship && !bIsSoluship) return -1;
                            if (!aIsSoluship && bIsSoluship) return 1;

                            // Priority 5: Generated BOL flags
                            const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                            const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                            if (aIsGenerated && !bIsGenerated) return -1;
                            if (!aIsGenerated && bIsGenerated) return 1;

                            // Priority 6: Newest creation date
                            const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                            const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                            return bCreatedTime - aCreatedTime;
                        });

                        const selectedBOL = sortedBOLs[0];

                        console.log('✅ ShipmentsX - Selected LATEST BOL document:', {
                            id: selectedBOL.id,
                            filename: selectedBOL.filename,
                            isLatest: selectedBOL.isLatest,
                            version: selectedBOL.version,
                            regeneratedAt: selectedBOL.regeneratedAt,
                            isGeneratedBOL: selectedBOL.isGeneratedBOL,
                            selectionReason: selectedBOL.isLatest ? 'marked as latest' :
                                selectedBOL.version > 0 ? `version ${selectedBOL.version}` :
                                    selectedBOL.regeneratedAt ? 'recently regenerated' :
                                        (selectedBOL.filename || '').toUpperCase().startsWith('SOLUSHIP-') ? 'SOLUSHIP format' : 'fallback'
                        });

                        if (!selectedBOL.downloadUrl) {
                            showSnackbar('BOL document is not accessible', 'error');
                            return;
                        }

                        // Open PDF viewer dialog with the latest BOL
                        setPdfViewerOpen(true);
                        setPdfUrl(selectedBOL.downloadUrl);
                        setPdfTitle(`BOL - ${shipment.shipmentID || shipment.id}`);
                    } catch (error) {
                        console.error('Error handling print BOL:', error);
                        showSnackbar('Error loading BOL', 'error');
                    }
                }}
                onDeleteDraft={async (shipment) => {
                    try {
                        if (shipment.status !== 'draft') {
                            showSnackbar('Only draft shipments can be deleted', 'warning');
                            return;
                        }

                        // Delete the shipment
                        await deleteDoc(doc(db, 'shipments', shipment.id));
                        showSnackbar('Draft shipment deleted successfully', 'success');
                        loadShipments(null, unifiedSearch, null, null, advancedFilters); // Reload the shipments list
                    } catch (error) {
                        console.error('Error deleting draft:', error);
                        showSnackbar('Error deleting draft shipment', 'error');
                    }
                }}
                checkingDocuments={checkingDocuments}
                documentAvailability={documentAvailability}
            />

            {/* PDF Viewer Dialog */}
            <PdfViewerDialog
                open={pdfViewerOpen}
                onClose={() => setPdfViewerOpen(false)}
                pdfUrl={pdfUrl}
                title={pdfTitle}
            />

            {/* Delete Drafts Confirmation Dialog */}
            <Dialog
                open={isDeleteDraftsDialogOpen}
                onClose={() => setIsDeleteDraftsDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Delete Selected Drafts
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete {selected.filter(id => shipments.find(s => s.id === id)?.status === 'draft').length} selected draft shipment{selected.filter(id => shipments.find(s => s.id === id)?.status === 'draft').length > 1 ? 's' : ''}?
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>
                        This action cannot be undone. Draft shipments will be permanently removed.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setIsDeleteDraftsDialogOpen(false)}
                        disabled={isDeletingDrafts}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteSelectedDrafts}
                        color="error"
                        variant="contained"
                        disabled={isDeletingDrafts}
                        startIcon={isDeletingDrafts ? <CircularProgress size={16} /> : null}
                    >
                        {isDeletingDrafts ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for User Feedback */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={snackbar.severity === 'error' ? 8000 : 4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{
                        width: '100%',
                        borderRadius: 2,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Tracking Drawer */}
            {isTrackingDrawerOpen && (
                <Box
                    onClick={() => setIsTrackingDrawerOpen(false)}
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        bgcolor: 'rgba(0,0,0,0.7)',
                        zIndex: 1499,
                        transition: 'opacity 0.3s',
                    }}
                />
            )}
            <Drawer
                anchor="right"
                open={isTrackingDrawerOpen}
                onClose={() => {
                    setIsTrackingDrawerOpen(false);
                    setCurrentTrackingNumber('');
                }}
                PaperProps={{
                    sx: {
                        width: { xs: '90vw', sm: 400, md: 450 },
                        height: '100%',
                        bgcolor: '#0a0a0a',
                        zIndex: 1500,
                        position: 'fixed',
                        right: 0,
                        top: 0,
                    }
                }}
                ModalProps={{
                    keepMounted: true,
                    sx: { zIndex: 1500 }
                }}
            >
                <Box sx={{ width: { xs: '90vw', sm: 400, md: 450 }, height: '100%', bgcolor: '#0a0a0a' }} role="presentation">
                    <Suspense fallback={<CircularProgress sx={{ m: 4 }} />}>
                        <TrackingDrawerContent
                            trackingIdentifier={currentTrackingNumber}
                            isDrawer={true}
                            onClose={() => {
                                setIsTrackingDrawerOpen(false);
                                setCurrentTrackingNumber('');
                            }}
                        />
                    </Suspense>
                </Box>
            </Drawer>
        </div>
    );
};

export default ShipmentsX;