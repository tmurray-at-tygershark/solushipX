import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    TableRow,
    TableCell,
    Checkbox,
    Box,
    Typography,
    IconButton,
    CircularProgress,
    Chip,
    Tooltip,
    Collapse,
    Grid,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    Button,
    Skeleton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Alert
} from '@mui/material';
import {
    MoreVert as MoreVertIcon,
    ContentCopy as ContentCopyIcon,
    QrCode as QrCodeIcon,
    KeyboardArrowDown as ArrowDownIcon,
    KeyboardArrowUp as ArrowUpIcon,
    Add as AddIcon,
    PictureAsPdf as PictureAsPdfIcon,
    FileDownload as FileDownloadIcon,
    Close as CloseIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    LocalShipping as TrackingIcon,
    Visibility as ViewIcon,
    Assignment as FollowUpIcon,
    Warning as WarningIcon,
    PriorityHigh as UrgentIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/firebase';
import EnhancedStatusChip from '../../StatusChip/EnhancedStatusChip';
import { formatDateTime, formatRoute, capitalizeShipmentType } from '../utils/shipmentHelpers';
import { fixShipmentEncoding } from '../../../utils/textUtils';

const ShipmentTableRow = ({
    shipment: rawShipment,
    selected,
    onSelect,
    onActionMenuOpen,
    customers,
    companyData,
    carrierData,
    searchFields,
    highlightSearchTerm,
    showSnackbar,
    onOpenTrackingDrawer,
    onViewShipmentDetail,
    onEditDraftShipment,
    visibleColumns = {},
    columnConfig = {},
    adminViewMode
}) => {
    const [expanded, setExpanded] = useState(false);
    const [documentsExpanded, setDocumentsExpanded] = useState(false);

    // Follow-up state
    const [followUpSummary, setFollowUpSummary] = useState(null);
    const [followUpLoading, setFollowUpLoading] = useState(false);

    // Memoize shipment to prevent unnecessary re-renders
    const shipment = useMemo(() => {
        if (!rawShipment) return null;

        // If shipment is already processed, return as-is
        if (rawShipment.processed) return rawShipment;

        // Process and fix encoding issues
        const processedShipment = fixShipmentEncoding(rawShipment);
        processedShipment.processed = true;
        return processedShipment;
    }, [rawShipment]);

    // Load follow-up summary when component mounts or shipment changes
    useEffect(() => {
        const loadFollowUpSummary = async () => {
            if (!shipment?.id) return;

            setFollowUpLoading(true);
            try {
                const getShipmentFollowUpSummary = httpsCallable(functions, 'getShipmentFollowUpSummary');
                const result = await getShipmentFollowUpSummary({ shipmentId: shipment.id });

                if (result.data?.summary) {
                    setFollowUpSummary(result.data.summary);
                }
            } catch (error) {
                console.error('Error loading follow-up summary:', error);
                // Don't show error to user for this non-critical feature
            } finally {
                setFollowUpLoading(false);
            }
        };

        loadFollowUpSummary();
    }, [shipment?.id]);

    const isSelected = selected.indexOf(shipment?.id) !== -1;

    // Check if we're in admin view mode
    const isAdminView = adminViewMode === 'all' || adminViewMode === 'single';

    // Calculate charges for admin view
    const getCharges = () => {
        // FIXED: Handle cancelled shipments - they should show $0.00
        if (shipment?.status === 'cancelled' || shipment?.status === 'canceled') {
            return {
                cost: 0,
                companyCharge: 0,
                currency: shipment?.currency || 'USD'
            };
        }

        // Use the new dual rate storage system if available
        if (shipment?.actualRates && shipment?.markupRates) {
            return {
                cost: parseFloat(shipment?.actualRates.totalCharges) || 0,
                companyCharge: parseFloat(shipment?.markupRates.totalCharges) || 0,
                currency: shipment?.actualRates.currency || shipment?.markupRates.currency || 'USD'
            };
        }

        // Fallback to legacy approach for older shipments
        let cost = 0;
        let companyCharge = 0;

        // For QuickShip shipments, extract cost and charge from manual rates
        if (shipment?.creationMethod === 'quickship' && shipment?.manualRates) {
            const totalCost = shipment?.manualRates.reduce((sum, rate) =>
                sum + (parseFloat(rate.cost) || 0), 0);
            const totalCharge = shipment?.manualRates.reduce((sum, rate) =>
                sum + (parseFloat(rate.charge) || 0), 0);

            if (totalCost > 0 || totalCharge > 0) {
                cost = totalCost;
                companyCharge = totalCharge;
            }
        }

        // If not QuickShip or no manual rates, check for dual rate fields
        if (cost === 0 && companyCharge === 0) {
            // Try to find separate cost and charge values
            cost = shipment?.actualCost ||
                shipment?.carrierCost ||
                shipment?.originalAmount ||
                shipment?.totalCost ||
                shipment?.cost || 0;

            companyCharge = shipment?.customerCharge ||
                shipment?.finalAmount ||
                shipment?.totalCharges ||
                shipment?.selectedRate?.totalCharges ||
                shipment?.selectedRate?.price ||
                shipment?.selectedRateRef?.totalCharges ||
                shipment?.selectedRateRef?.price || 0;
        }

        // Final fallback - if we still don't have values, use any available amount
        if (cost === 0 && companyCharge === 0) {
            const fallbackAmount = shipment?.totalCharges ||
                shipment?.selectedRate?.totalCharges ||
                shipment?.selectedRate?.price ||
                shipment?.selectedRateRef?.totalCharges ||
                shipment?.selectedRateRef?.price || 0;

            // For true legacy shipments without cost/charge separation, 
            // estimate cost as 85% of charge (common markup scenario)
            if (fallbackAmount > 0) {
                companyCharge = fallbackAmount;
                cost = fallbackAmount * 0.85; // Estimate 15% markup
            }
        }

        // Enhanced currency detection - check multiple possible locations
        let currency = 'USD'; // Default fallback

        // Priority order for currency detection:
        // 1. Direct currency field
        // 2. Selected rate currency (multiple paths)
        // 3. Selected rate ref currency  
        // 4. Rate detail currency
        // 5. Shipment info currency
        // 6. Manual rates currency (for QuickShip)
        // 7. Booking confirmation currency
        // 8. Carrier data currency
        if (shipment?.currency) {
            currency = shipment?.currency;
        } else if (shipment?.selectedRate?.currency) {
            currency = shipment?.selectedRate.currency;
        } else if (shipment?.selectedRate?.pricing?.currency) {
            // For advanced shipments, check pricing.currency
            currency = shipment?.selectedRate.pricing.currency;
        } else if (shipment?.selectedRateRef?.currency) {
            currency = shipment?.selectedRateRef.currency;
        } else if (shipment?.selectedRateRef?.pricing?.currency) {
            currency = shipment?.selectedRateRef.pricing.currency;
        } else if (shipment?.rateDetails?.currency) {
            currency = shipment?.rateDetails.currency;
        } else if (shipment?.shipmentInfo?.currency) {
            currency = shipment?.shipmentInfo.currency;
        } else if (shipment?.manualRates && shipment?.manualRates.length > 0) {
            // For QuickShip shipments, check manual rates for currency
            const rateWithCurrency = shipment?.manualRates.find(rate => rate.currency);
            if (rateWithCurrency) {
                currency = rateWithCurrency.currency;
            }
        } else if (shipment?.carrierBookingConfirmation?.currency) {
            currency = shipment?.carrierBookingConfirmation.currency;
        } else if (carrierData[shipment?.id]?.currency) {
            currency = carrierData[shipment?.id].currency;
        }

        return {
            cost: parseFloat(cost) || 0,
            companyCharge: parseFloat(companyCharge) || 0,
            currency: currency
        };
    };

    // Get tracking number
    const getTrackingNumber = () => {
        // For draft shipments, there won't be tracking numbers yet
        if (shipment?.status === 'draft') {
            return '';
        }

        const trackingNumber = shipment?.trackingNumber ||
            shipment?.carrierTrackingNumber || // Check top-level carrierTrackingNumber for QuickShip
            shipment?.shipmentInfo?.carrierTrackingNumber || // Check inside shipmentInfo for QuickShip
            shipment?.selectedRate?.trackingNumber ||
            shipment?.selectedRate?.TrackingNumber ||
            shipment?.selectedRateRef?.trackingNumber ||
            shipment?.selectedRateRef?.TrackingNumber ||
            shipment?.carrierTrackingData?.trackingNumber ||
            shipment?.carrierBookingConfirmation?.trackingNumber ||
            shipment?.carrierBookingConfirmation?.proNumber ||
            shipment?.carrierBookingConfirmation?.confirmationNumber ||
            shipment?.bookingReferenceNumber ||
            shipment?.selectedRate?.BookingReferenceNumber ||
            shipment?.selectedRate?.bookingReferenceNumber ||
            shipment?.selectedRateRef?.BookingReferenceNumber ||
            shipment?.selectedRateRef?.bookingReferenceNumber ||
            shipment?.carrierTrackingData?.bookingReferenceNumber ||
            shipment?.carrierBookingConfirmation?.bookingReference ||
            '';

        return trackingNumber;
    };

    // Get carrier name with eShipPlus detection
    const getCarrierDisplay = () => {
        // For draft shipments, especially advanced drafts, carrier data may not exist yet
        if (shipment?.status === 'draft') {
            // Check if there's a selected rate with carrier info
            const selectedRateCarrier = shipment?.selectedRate?.carrier ||
                shipment?.selectedRateRef?.carrier;

            if (selectedRateCarrier) {
                // Handle both string carrier names and carrier objects
                const carrierName = typeof selectedRateCarrier === 'object' && selectedRateCarrier?.name
                    ? selectedRateCarrier.name
                    : selectedRateCarrier;

                return {
                    name: carrierName,
                    isEShipPlus: shipment?.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                        shipment?.selectedRateRef?.displayCarrierId === 'ESHIPPLUS'
                };
            }

            // For drafts without rate selection, return pending status
            return {
                name: 'Pending Rate Selection',
                isEShipPlus: false
            };
        }

        // Extract carrier name with proper object handling
        let carrierName = carrierData[shipment?.id]?.carrier ||
            shipment?.selectedRateRef?.carrier ||
            shipment?.selectedRate?.carrier ||
            shipment?.carrier || 'N/A';

        // Handle carrier objects (extract the name property)
        if (typeof carrierName === 'object' && carrierName?.name) {
            carrierName = carrierName.name;
        }

        // For QuickShip drafts, respect the manually selected carrier
        // and don't apply eShip Plus logic unless explicitly detected
        if (shipment?.creationMethod === 'quickship') {
            // Only check for explicit eShip Plus indicators for QuickShip drafts
            const isExplicitEShipPlus =
                shipment?.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                shipment?.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                shipment?.selectedRate?.sourceCarrierName === 'eShipPlus' ||
                shipment?.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                carrierData[shipment?.id]?.displayCarrierId === 'ESHIPPLUS' ||
                carrierData[shipment?.id]?.sourceCarrierName === 'eShipPlus';

            return {
                name: isExplicitEShipPlus && carrierName !== 'N/A' ?
                    `${carrierName} via Eship Plus` :
                    carrierName,
                isEShipPlus: isExplicitEShipPlus
            };
        }

        // For non-QuickShip shipments, use the enhanced eShipPlus detection
        const isEShipPlus =
            shipment?.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
            shipment?.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
            shipment?.selectedRate?.sourceCarrierName === 'eShipPlus' ||
            shipment?.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
            carrierData[shipment?.id]?.displayCarrierId === 'ESHIPPLUS' ||
            carrierData[shipment?.id]?.sourceCarrierName === 'eShipPlus' ||
            (carrierName && carrierName !== 'N/A' && typeof carrierName === 'string' && (
                carrierName.toLowerCase().includes('ward trucking') ||
                carrierName.toLowerCase().includes('fedex freight') ||
                carrierName.toLowerCase().includes('road runner') ||
                carrierName.toLowerCase().includes('estes') ||
                carrierName.toLowerCase().includes('yrc') ||
                carrierName.toLowerCase().includes('xpo') ||
                carrierName.toLowerCase().includes('old dominion') ||
                carrierName.toLowerCase().includes('saia') ||
                carrierName.toLowerCase().includes('averitt') ||
                carrierName.toLowerCase().includes('southeastern freight')
            ));

        return {
            name: isEShipPlus && carrierName !== 'N/A' ?
                `${carrierName} via Eship Plus` :
                carrierName,
            isEShipPlus
        };
    };

    const trackingNumber = getTrackingNumber();
    const carrierDisplay = getCarrierDisplay();

    // Helper function to get column width from config
    const getColumnWidth = (columnKey) => {
        const config = columnConfig[columnKey];
        return config ? {
            width: config.width,
            minWidth: config.width,
            maxWidth: config.width
        } : {};
    };

    // Helper function to copy text to clipboard
    const copyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar(`${label} copied!`, 'success');
        } catch (error) {
            console.error(`Failed to copy ${label}:`, error);
            showSnackbar(`Failed to copy ${label}`, 'error');
        }
    };

    // Removed handleRowClick - navigation only through shipment ID link

    return (
        <>
            <TableRow
                hover
                role="checkbox"
                aria-checked={isSelected}
                tabIndex={-1}
                selected={isSelected}
                sx={{
                    '&:hover': {
                        backgroundColor: '#f8fafc'
                    }
                }}
            >
                {/* Checkbox */}
                {visibleColumns.checkbox !== false && (
                    <TableCell padding="checkbox" sx={{
                        verticalAlign: 'top',
                        textAlign: 'left',
                        ...getColumnWidth('checkbox'),
                        p: '8px 4px'
                    }}>
                        <Checkbox
                            checked={isSelected}
                            onChange={() => onSelect(shipment?.id)}
                            size="small"
                            sx={{ p: 0.5 }}
                        />
                    </TableCell>
                )}

                {/* Admin View: Company first, then ID */}
                {isAdminView ? (
                    <>
                        {/* Company Column - Admin View Only */}
                        <TableCell sx={{
                            verticalAlign: 'top',
                            textAlign: 'left',
                            ...getColumnWidth('company'),
                            padding: '8px 12px',
                            wordBreak: 'break-word',
                            lineHeight: 1.3
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {/* Company Logo/Avatar */}
                                <Box sx={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '4px',
                                    backgroundColor: '#f3f4f6',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {(() => {
                                        // Enhanced logo detection - check multiple possible sources
                                        const company = companyData[shipment?.companyID];

                                        // Check multiple possible logo field names
                                        const logoUrl = company?.logoUrl ||
                                            company?.logo ||
                                            company?.companyLogo ||
                                            company?.logoURL ||
                                            company?.companyLogoUrl;

                                        const companyName = company?.name || company?.companyName || shipment?.companyID || 'CO';

                                        if (logoUrl) {
                                            return (
                                                <img
                                                    src={logoUrl}
                                                    alt="Company"
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'contain',
                                                        borderRadius: '3px'
                                                    }}
                                                    onError={(e) => {
                                                        // Replace with fallback avatar on error
                                                        const parent = e.target.parentNode;
                                                        e.target.remove();
                                                        parent.innerHTML = `<div style="font-size: 8px; font-weight: 600; color: #6b7280; line-height: 1; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">${companyName[0].toUpperCase()}</div>`;
                                                    }}
                                                />
                                            );
                                        } else {
                                            return (
                                                <Typography sx={{
                                                    fontSize: '8px',
                                                    fontWeight: 600,
                                                    color: '#6b7280',
                                                    lineHeight: 1,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {companyName[0].toUpperCase()}
                                                </Typography>
                                            );
                                        }
                                    })()}
                                </Box>

                                {/* Company Name */}
                                <Typography variant="body2" sx={{
                                    fontSize: '12px',
                                    fontWeight: 500,
                                    color: '#000000',
                                    lineHeight: 1.2
                                }}>
                                    {companyData[shipment?.companyID]?.name || shipment?.companyID || 'Unknown Company'}
                                </Typography>
                            </Box>
                        </TableCell>

                        {/* Shipment ID - Admin View */}
                        <TableCell sx={{
                            verticalAlign: 'top',
                            textAlign: 'left',
                            fontSize: '11px',
                            ...getColumnWidth('id'),
                            padding: '8px 12px',
                            wordBreak: 'break-word',
                            lineHeight: 1.3
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {/* Follow-up indicator */}
                                {followUpSummary?.requiresAttention && (
                                    <Tooltip title={`${followUpSummary.overdueTasks > 0 ? 'Overdue tasks' : followUpSummary.urgentTasks > 0 ? 'Urgent tasks' : 'Follow-up required'}`}>
                                        <WarningIcon
                                            sx={{
                                                fontSize: '14px',
                                                color: followUpSummary.overdueTasks > 0 ? '#ef4444' : '#f59e0b',
                                                animation: followUpSummary.urgentTasks > 0 ? 'pulse 2s infinite' : 'none'
                                            }}
                                        />
                                    </Tooltip>
                                )}

                                {shipment?.status === 'draft' ? (
                                    onEditDraftShipment ? (
                                        <span
                                            onClick={() => onEditDraftShipment(shipment?.id)}
                                            className="shipment-link"
                                            style={{ cursor: 'pointer', fontSize: '11px' }}
                                        >
                                            <span>{highlightSearchTerm(
                                                shipment?.shipmentID || shipment?.id,
                                                searchFields.shipmentId
                                            )}</span>
                                        </span>
                                    ) : (
                                        <span className="shipment-link" style={{ fontSize: '11px', color: '#64748b' }}>
                                            <span>{highlightSearchTerm(
                                                shipment?.shipmentID || shipment?.id,
                                                searchFields.shipmentId
                                            )}</span>
                                        </span>
                                    )
                                ) : (
                                    <span
                                        onClick={() => onViewShipmentDetail && onViewShipmentDetail(shipment?.shipmentID || shipment?.id)}
                                        className="shipment-link"
                                        style={{ cursor: 'pointer', fontSize: '11px' }}
                                    >
                                        <span>{highlightSearchTerm(
                                            shipment?.shipmentID || shipment?.id,
                                            searchFields.shipmentId
                                        )}</span>
                                    </span>
                                )}
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        navigator.clipboard.writeText(shipment?.shipmentID || shipment?.id);
                                        showSnackbar('Shipment ID copied!', 'success');
                                    }}
                                    sx={{ padding: '2px' }}
                                    title="Copy shipment ID"
                                >
                                    <ContentCopyIcon sx={{ fontSize: '0.75rem', color: '#64748b' }} />
                                </IconButton>
                            </Box>
                        </TableCell>
                    </>
                ) : (
                    /* Regular View: ID first, then Created */
                    <>
                        {/* Shipment ID - Regular View */}
                        {visibleColumns.id !== false && (
                            <TableCell sx={{
                                verticalAlign: 'top',
                                textAlign: 'left',
                                fontSize: '11px',
                                ...getColumnWidth('id'),
                                padding: '8px 12px',
                                wordBreak: 'break-word',
                                lineHeight: 1.3
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {/* Follow-up indicator */}
                                    {followUpSummary?.requiresAttention && (
                                        <Tooltip title={`${followUpSummary.overdueTasks > 0 ? 'Overdue tasks' : followUpSummary.urgentTasks > 0 ? 'Urgent tasks' : 'Follow-up required'}`}>
                                            <WarningIcon
                                                sx={{
                                                    fontSize: '14px',
                                                    color: followUpSummary.overdueTasks > 0 ? '#ef4444' : '#f59e0b',
                                                    animation: followUpSummary.urgentTasks > 0 ? 'pulse 2s infinite' : 'none'
                                                }}
                                            />
                                        </Tooltip>
                                    )}

                                    {shipment?.status === 'draft' ? (
                                        onEditDraftShipment ? (
                                            <span
                                                onClick={() => onEditDraftShipment(shipment?.id)}
                                                className="shipment-link"
                                                style={{ cursor: 'pointer', fontSize: '11px' }}
                                            >
                                                <span>{highlightSearchTerm(
                                                    shipment?.shipmentID || shipment?.id,
                                                    searchFields.shipmentId
                                                )}</span>
                                            </span>
                                        ) : (
                                            <span className="shipment-link" style={{ fontSize: '11px', color: '#64748b' }}>
                                                <span>{highlightSearchTerm(
                                                    shipment?.shipmentID || shipment?.id,
                                                    searchFields.shipmentId
                                                )}</span>
                                            </span>
                                        )
                                    ) : (
                                        <span
                                            onClick={() => onViewShipmentDetail && onViewShipmentDetail(shipment?.shipmentID || shipment?.id)}
                                            className="shipment-link"
                                            style={{ cursor: 'pointer', fontSize: '11px' }}
                                        >
                                            <span>{highlightSearchTerm(
                                                shipment?.shipmentID || shipment?.id,
                                                searchFields.shipmentId
                                            )}</span>
                                        </span>
                                    )}
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            navigator.clipboard.writeText(shipment?.shipmentID || shipment?.id);
                                            showSnackbar('Shipment ID copied!', 'success');
                                        }}
                                        sx={{ padding: '2px' }}
                                        title="Copy shipment ID"
                                    >
                                        <ContentCopyIcon sx={{ fontSize: '0.75rem', color: '#64748b' }} />
                                    </IconButton>
                                </Box>
                            </TableCell>
                        )}



                        {/* Ship Date */}
                        {visibleColumns.date !== false && (
                            <TableCell sx={{
                                verticalAlign: 'top',
                                textAlign: 'left',
                                ...getColumnWidth('date'),
                                padding: '8px 12px'
                            }}>
                                {(() => {
                                    let dateTime = null;
                                    let dateToFormat = null;

                                    // Priority order for date fields: shipment date (preferred) > bookedAt (QuickShip) > createdAt (fallback)
                                    if (shipment?.shipmentInfo?.shipmentDate) {
                                        // Preferred ship date from shipment info
                                        dateToFormat = shipment?.shipmentInfo.shipmentDate;
                                    } else if (shipment?.shipmentDate) {
                                        // Direct shipment date field
                                        dateToFormat = shipment?.shipmentDate;
                                    } else if (shipment?.scheduledDate) {
                                        // Scheduled date field
                                        dateToFormat = shipment?.scheduledDate;
                                    } else if (shipment?.creationMethod === 'quickship' && shipment?.bookedAt) {
                                        // For QuickShip records, use bookedAt when shipmentDate is not available
                                        dateToFormat = shipment?.bookedAt;
                                    } else if (shipment?.createdAt) {
                                        // Final fallback to creation date
                                        dateToFormat = shipment?.createdAt;
                                    }

                                    if (dateToFormat) {
                                        dateTime = formatDateTime(dateToFormat);
                                    }

                                    // If formatDateTime returns null (invalid timestamp) or no dateTime, show N/A
                                    if (!dateTime || !dateTime.date) {
                                        return (
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b' }}>
                                                N/A
                                            </Typography>
                                        );
                                    }

                                    return (
                                        <Box>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {dateTime.date}
                                            </Typography>
                                        </Box>
                                    );
                                })()}
                            </TableCell>
                        )}

                        {/* ETA Column - Moved after Ship Date */}
                        {visibleColumns.eta !== false && (
                            <TableCell sx={{
                                verticalAlign: 'top',
                                textAlign: 'left',
                                ...getColumnWidth('eta'),
                                padding: '8px 12px'
                            }}>
                                {(() => {
                                    const eta1 = shipment?.shipmentInfo?.eta1 || shipment?.eta1;
                                    const eta2 = shipment?.shipmentInfo?.eta2 || shipment?.eta2;

                                    const formatEtaDate = (date) => {
                                        if (!date) return null;
                                        try {
                                            let dateObj;

                                            // Handle Firestore Timestamp
                                            if (date?.toDate) {
                                                dateObj = date.toDate();
                                            }
                                            // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
                                            else if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                                const parts = date.split('-');
                                                dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                            }
                                            // Handle other date formats
                                            else {
                                                dateObj = new Date(date);
                                            }

                                            return dateObj.toLocaleDateString('en-US', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                year: '2-digit',
                                                timeZone: 'America/Toronto' // Force Eastern Time
                                            });
                                        } catch (error) {
                                            return null;
                                        }
                                    };

                                    const eta1Formatted = formatEtaDate(eta1);
                                    const eta2Formatted = formatEtaDate(eta2);

                                    // If we have ETA1 or ETA2, show them
                                    if (eta1Formatted || eta2Formatted) {
                                        return (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                {eta1Formatted && (
                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#000000' }}>
                                                        ETA1: {eta1Formatted}
                                                    </Typography>
                                                )}
                                                {eta2Formatted && (
                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#000000' }}>
                                                        ETA2: {eta2Formatted}
                                                    </Typography>
                                                )}
                                            </Box>
                                        );
                                    }

                                    // Fallback to carrier estimated delivery date
                                    const carrierEstimatedDelivery =
                                        shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                                        shipment?.selectedRate?.transit?.estimatedDelivery ||
                                        shipment?.selectedRate?.estimatedDeliveryDate;

                                    if (carrierEstimatedDelivery) {
                                        const formattedCarrierDate = formatEtaDate(carrierEstimatedDelivery);
                                        if (formattedCarrierDate) {
                                            return (
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#000000' }}>
                                                    {formattedCarrierDate}
                                                </Typography>
                                            );
                                        }
                                    }

                                    // No ETA available
                                    return (
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                            N/A
                                        </Typography>
                                    );
                                })()}
                            </TableCell>
                        )}

                        {/* Reference */}
                        {visibleColumns.reference !== false && (
                            <TableCell sx={{
                                verticalAlign: 'top',
                                textAlign: 'left',
                                ...getColumnWidth('reference'),
                                padding: '8px 12px',
                                wordBreak: 'break-word',
                                lineHeight: 1.3
                            }}>
                                {(() => {
                                    // Collect all reference numbers from multiple sources
                                    const references = [];

                                    // Primary reference number sources
                                    const primarySources = [
                                        shipment?.shipmentInfo?.shipperReferenceNumber,
                                        shipment?.referenceNumber,
                                        shipment?.shipperReferenceNumber,
                                        shipment?.selectedRate?.referenceNumber,
                                        shipment?.selectedRateRef?.referenceNumber,
                                        shipment?.shipmentInfo?.bookingReferenceNumber,
                                        shipment?.bookingReferenceNumber
                                    ];

                                    // Add all non-empty primary references
                                    primarySources.forEach(ref => {
                                        if (ref && typeof ref === 'string' && ref.trim() && !references.includes(ref.trim())) {
                                            references.push(ref.trim());
                                        }
                                    });

                                    // Additional reference numbers from shipmentInfo.referenceNumbers array
                                    if (shipment?.shipmentInfo?.referenceNumbers && Array.isArray(shipment?.shipmentInfo.referenceNumbers)) {
                                        shipment?.shipmentInfo.referenceNumbers.forEach(ref => {
                                            let refValue = null;
                                            if (typeof ref === 'string') {
                                                refValue = ref.trim();
                                            } else if (ref && typeof ref === 'object') {
                                                refValue = (ref.number || ref.referenceNumber || ref.value)?.trim();
                                            }
                                            if (refValue && !references.includes(refValue)) {
                                                references.push(refValue);
                                            }
                                        });
                                    }

                                    // Legacy reference numbers array
                                    if (shipment?.referenceNumbers && Array.isArray(shipment?.referenceNumbers)) {
                                        shipment?.referenceNumbers.forEach(ref => {
                                            let refValue = null;
                                            if (typeof ref === 'string') {
                                                refValue = ref.trim();
                                            } else if (ref && typeof ref === 'object') {
                                                refValue = (ref.number || ref.referenceNumber || ref.value)?.trim();
                                            }
                                            if (refValue && !references.includes(refValue)) {
                                                references.push(refValue);
                                            }
                                        });
                                    }

                                    // Additional fields that might contain reference numbers
                                    const additionalSources = [
                                        shipment?.customerReferenceNumber,
                                        shipment?.poNumber,
                                        shipment?.invoiceNumber,
                                        shipment?.orderNumber
                                    ];

                                    additionalSources.forEach(ref => {
                                        if (ref && typeof ref === 'string' && ref.trim() && !references.includes(ref.trim())) {
                                            references.push(ref.trim());
                                        }
                                    });

                                    if (references.length === 0) {
                                        return (
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#000000' }}>
                                                N/A
                                            </Typography>
                                        );
                                    }

                                    return (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                            {references.map((ref, index) => (
                                                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#000000', flex: 1 }}>
                                                        {highlightSearchTerm(ref, searchFields.referenceNumber)}
                                                    </Typography>
                                                    <Tooltip title="Copy Reference Number">
                                                        <IconButton
                                                            onClick={async () => {
                                                                try {
                                                                    await navigator.clipboard.writeText(ref);
                                                                    showSnackbar('Reference number copied!', 'success');
                                                                } catch (error) {
                                                                    console.error('Failed to copy reference number:', error);
                                                                    showSnackbar('Failed to copy reference number', 'error');
                                                                }
                                                            }}
                                                            size="small"
                                                            sx={{
                                                                padding: '2px',
                                                                color: '#6b7280',
                                                                '&:hover': {
                                                                    color: '#1976d2',
                                                                    backgroundColor: 'rgba(25, 118, 210, 0.1)'
                                                                }
                                                            }}
                                                        >
                                                            <ContentCopyIcon sx={{ fontSize: '0.75rem' }} />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            ))}
                                        </Box>
                                    );
                                })()}
                            </TableCell>
                        )}

                        {/* Customer - Regular View Only */}
                        {visibleColumns.customer !== false && (
                            <TableCell sx={{
                                verticalAlign: 'top',
                                textAlign: 'left',
                                ...getColumnWidth('customer'),
                                padding: '8px 12px',
                                wordBreak: 'break-word',
                                lineHeight: 1.3
                            }}>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {highlightSearchTerm(
                                        shipment?.shipTo?.companyName ||
                                        shipment?.shipTo?.company ||
                                        customers[shipment?.shipTo?.customerID] ||
                                        'N/A',
                                        searchFields.customerName
                                    )}
                                </Typography>
                            </TableCell>
                        )}

                        {/* Route - Vertical Layout */}
                        {visibleColumns.route !== false && (
                            <TableCell sx={{
                                verticalAlign: 'top',
                                textAlign: 'left',
                                ...getColumnWidth('route'),
                                padding: '8px 12px'
                            }}>
                                {(() => {
                                    const route = formatRoute(
                                        shipment?.shipFrom || shipment?.shipfrom,
                                        shipment?.shipTo || shipment?.shipto,
                                        searchFields.origin,
                                        searchFields.destination
                                    );

                                    return (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '12px' }}>
                                            {/* Origin */}
                                            <Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <span>{route.origin.flag}</span>
                                                    <Box sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
                                                        {highlightSearchTerm(route.origin.text, searchFields.origin)}
                                                    </Box>
                                                </Box>
                                                {route.origin.postalCode && (
                                                    <Box sx={{ pl: 3, fontSize: '11px', color: '#64748b' }}>
                                                        {highlightSearchTerm(route.origin.postalCode, searchFields.origin)}
                                                    </Box>
                                                )}
                                            </Box>

                                            {/* Down Arrow */}
                                            <Box sx={{
                                                display: 'flex',
                                                justifyContent: 'center',
                                                color: '#64748b',
                                                fontSize: '14px'
                                            }}>
                                                ↓
                                            </Box>

                                            {/* Destination */}
                                            <Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <span>{route.destination.flag}</span>
                                                    <Box sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
                                                        {highlightSearchTerm(route.destination.text, searchFields.destination)}
                                                    </Box>
                                                </Box>
                                                {route.destination.postalCode && (
                                                    <Box sx={{ pl: 3, fontSize: '11px', color: '#64748b' }}>
                                                        {highlightSearchTerm(route.destination.postalCode, searchFields.destination)}
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    );
                                })()}
                            </TableCell>
                        )}

                        {/* Carrier */}
                        {visibleColumns.carrier !== false && (
                            <TableCell sx={{
                                verticalAlign: 'top',
                                textAlign: 'left',
                                ...getColumnWidth('carrier'),
                                padding: '8px 12px'
                            }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {/* Carrier Name */}
                                    <Typography variant="body2" sx={{
                                        fontSize: '12px',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.3
                                    }}>
                                        {carrierDisplay.name}
                                    </Typography>

                                    {/* Service Type */}
                                    {(() => {
                                        const serviceType = carrierData[shipment?.id]?.service ||
                                            shipment?.selectedRate?.service?.name ||
                                            shipment?.selectedRate?.service ||
                                            shipment?.selectedRateRef?.service?.name ||
                                            shipment?.selectedRateRef?.service ||
                                            shipment?.serviceType;

                                        if (serviceType && typeof serviceType === 'string') {
                                            return (
                                                <Typography variant="body2" sx={{
                                                    fontSize: '11px',
                                                    color: '#6b7280',
                                                    fontStyle: 'italic',
                                                    wordBreak: 'break-word',
                                                    lineHeight: 1.2
                                                }}>
                                                    {serviceType}
                                                </Typography>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Tracking Number */}
                                    {trackingNumber && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <QrCodeIcon sx={{ fontSize: '12px', color: '#64748b' }} />
                                            <Typography
                                                onClick={() => onOpenTrackingDrawer(trackingNumber)}
                                                sx={{
                                                    color: '#2563eb',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    wordBreak: 'break-all',
                                                    lineHeight: 1.2,
                                                    '&:hover': {
                                                        textDecoration: 'underline'
                                                    }
                                                }}
                                                title="Click to track this shipment"
                                            >
                                                {trackingNumber}
                                            </Typography>
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(trackingNumber);
                                                    showSnackbar('Tracking/PRO/Confirmation number copied!', 'success');
                                                }}
                                                sx={{ padding: '2px' }}
                                                title="Copy tracking/confirmation number"
                                            >
                                                <ContentCopyIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
                                            </IconButton>
                                        </Box>
                                    )}

                                    {/* Service Level */}
                                    {carrierData[shipment?.id]?.service && (
                                        <Typography variant="body2" sx={{
                                            fontSize: '12px',
                                            color: '#64748b',
                                            wordBreak: 'break-word',
                                            lineHeight: 1.2
                                        }}>
                                            {carrierData[shipment?.id]?.service}
                                        </Typography>
                                    )}
                                </Box>
                            </TableCell>
                        )}



                    </>
                )}

                {/* Admin View: Ship Date, ETA, Reference, Route, Carrier, Charges */}
                {isAdminView && (
                    <>
                        {/* Ship Date - Admin View */}
                        <TableCell sx={{
                            verticalAlign: 'top',
                            textAlign: 'left',
                            ...getColumnWidth('date'),
                            padding: '8px 12px'
                        }}>
                            {(() => {
                                let dateTime = null;
                                let dateToFormat = null;

                                // Priority order for date fields: shipment date (preferred) > bookedAt (QuickShip) > createdAt (fallback)
                                if (shipment?.shipmentInfo?.shipmentDate) {
                                    dateToFormat = shipment?.shipmentInfo.shipmentDate;
                                } else if (shipment?.shipmentDate) {
                                    dateToFormat = shipment?.shipmentDate;
                                } else if (shipment?.scheduledDate) {
                                    dateToFormat = shipment?.scheduledDate;
                                } else if (shipment?.creationMethod === 'quickship' && shipment?.bookedAt) {
                                    dateToFormat = shipment?.bookedAt;
                                } else if (shipment?.createdAt) {
                                    dateToFormat = shipment?.createdAt;
                                }

                                if (dateToFormat) {
                                    dateTime = formatDateTime(dateToFormat);
                                }

                                if (!dateTime || !dateTime.date) {
                                    return (
                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b' }}>
                                            N/A
                                        </Typography>
                                    );
                                }

                                return (
                                    <Box>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {dateTime.date}
                                        </Typography>
                                    </Box>
                                );
                            })()}
                        </TableCell>

                        {/* ETA - Admin View */}
                        <TableCell sx={{
                            verticalAlign: 'top',
                            textAlign: 'left',
                            ...getColumnWidth('eta'),
                            padding: '8px 12px'
                        }}>
                            {(() => {
                                const eta1 = shipment?.shipmentInfo?.eta1 || shipment?.eta1;
                                const eta2 = shipment?.shipmentInfo?.eta2 || shipment?.eta2;

                                const formatEtaDate = (date) => {
                                    if (!date) return null;
                                    try {
                                        let dateObj;

                                        // Handle Firestore Timestamp
                                        if (date?.toDate) {
                                            dateObj = date.toDate();
                                        }
                                        // Handle date-only strings (YYYY-MM-DD) to avoid timezone issues
                                        else if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                            const parts = date.split('-');
                                            dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                                        }
                                        // Handle other date formats
                                        else {
                                            dateObj = new Date(date);
                                        }

                                        return dateObj.toLocaleDateString('en-US', {
                                            month: '2-digit',
                                            day: '2-digit',
                                            year: '2-digit',
                                            timeZone: 'America/Toronto' // Force Eastern Time
                                        });
                                    } catch (error) {
                                        return null;
                                    }
                                };

                                const eta1Formatted = formatEtaDate(eta1);
                                const eta2Formatted = formatEtaDate(eta2);

                                // If we have ETA1 or ETA2, show them
                                if (eta1Formatted || eta2Formatted) {
                                    return (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            {eta1Formatted && (
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#000000' }}>
                                                    ETA1: {eta1Formatted}
                                                </Typography>
                                            )}
                                            {eta2Formatted && (
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#000000' }}>
                                                    ETA2: {eta2Formatted}
                                                </Typography>
                                            )}
                                        </Box>
                                    );
                                }

                                // Fallback to carrier estimated delivery date
                                const carrierEstimatedDelivery =
                                    shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                                    shipment?.selectedRate?.transit?.estimatedDelivery ||
                                    shipment?.selectedRate?.estimatedDeliveryDate;

                                if (carrierEstimatedDelivery) {
                                    const formattedCarrierDate = formatEtaDate(carrierEstimatedDelivery);
                                    if (formattedCarrierDate) {
                                        return (
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#000000' }}>
                                                {formattedCarrierDate}
                                            </Typography>
                                        );
                                    }
                                }

                                // No ETA available
                                return (
                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                        N/A
                                    </Typography>
                                );
                            })()}
                        </TableCell>

                        {/* Reference - Admin View */}
                        <TableCell sx={{
                            verticalAlign: 'top',
                            textAlign: 'left',
                            ...getColumnWidth('reference'),
                            padding: '8px 12px',
                            wordBreak: 'break-word',
                            lineHeight: 1.3
                        }}>
                            {(() => {
                                // Collect all reference numbers from multiple sources
                                const references = [];

                                // Primary reference number sources
                                const primarySources = [
                                    shipment?.shipmentInfo?.shipperReferenceNumber,
                                    shipment?.referenceNumber,
                                    shipment?.shipperReferenceNumber,
                                    shipment?.selectedRate?.referenceNumber,
                                    shipment?.selectedRateRef?.referenceNumber,
                                    shipment?.shipmentInfo?.bookingReferenceNumber,
                                    shipment?.bookingReferenceNumber
                                ];

                                // Add all non-empty primary references
                                primarySources.forEach(ref => {
                                    if (ref && typeof ref === 'string' && ref.trim() && !references.includes(ref.trim())) {
                                        references.push(ref.trim());
                                    }
                                });

                                // Additional reference numbers from shipmentInfo.referenceNumbers array
                                if (shipment?.shipmentInfo?.referenceNumbers && Array.isArray(shipment?.shipmentInfo.referenceNumbers)) {
                                    shipment?.shipmentInfo.referenceNumbers.forEach(ref => {
                                        let refValue = null;
                                        if (typeof ref === 'string') {
                                            refValue = ref.trim();
                                        } else if (ref && typeof ref === 'object') {
                                            refValue = (ref.number || ref.referenceNumber || ref.value)?.trim();
                                        }
                                        if (refValue && !references.includes(refValue)) {
                                            references.push(refValue);
                                        }
                                    });
                                }

                                // Legacy reference numbers array
                                if (shipment?.referenceNumbers && Array.isArray(shipment?.referenceNumbers)) {
                                    shipment?.referenceNumbers.forEach(ref => {
                                        let refValue = null;
                                        if (typeof ref === 'string') {
                                            refValue = ref.trim();
                                        } else if (ref && typeof ref === 'object') {
                                            refValue = (ref.number || ref.referenceNumber || ref.value)?.trim();
                                        }
                                        if (refValue && !references.includes(refValue)) {
                                            references.push(refValue);
                                        }
                                    });
                                }

                                // Additional fields that might contain reference numbers
                                const additionalSources = [
                                    shipment?.customerReferenceNumber,
                                    shipment?.poNumber,
                                    shipment?.invoiceNumber,
                                    shipment?.orderNumber
                                ];

                                additionalSources.forEach(ref => {
                                    if (ref && typeof ref === 'string' && ref.trim() && !references.includes(ref.trim())) {
                                        references.push(ref.trim());
                                    }
                                });

                                if (references.length === 0) {
                                    return (
                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#000000' }}>
                                            N/A
                                        </Typography>
                                    );
                                }

                                return (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                                        {references.map((ref, index) => (
                                            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#000000', flex: 1 }}>
                                                    {highlightSearchTerm(ref, searchFields.referenceNumber)}
                                                </Typography>
                                                <Tooltip title="Copy Reference Number">
                                                    <IconButton
                                                        onClick={async () => {
                                                            try {
                                                                await navigator.clipboard.writeText(ref);
                                                                showSnackbar('Reference number copied!', 'success');
                                                            } catch (error) {
                                                                console.error('Failed to copy reference number:', error);
                                                                showSnackbar('Failed to copy reference number', 'error');
                                                            }
                                                        }}
                                                        size="small"
                                                        sx={{
                                                            padding: '2px',
                                                            color: '#6b7280',
                                                            '&:hover': {
                                                                color: '#1976d2',
                                                                backgroundColor: 'rgba(25, 118, 210, 0.1)'
                                                            }
                                                        }}
                                                    >
                                                        <ContentCopyIcon sx={{ fontSize: '0.75rem' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        ))}
                                    </Box>
                                );
                            })()}
                        </TableCell>

                        {/* Route - Admin View */}
                        <TableCell sx={{
                            verticalAlign: 'top',
                            textAlign: 'left',
                            ...getColumnWidth('route'),
                            padding: '8px 12px'
                        }}>
                            {(() => {
                                const route = formatRoute(
                                    shipment?.shipFrom || shipment?.shipfrom,
                                    shipment?.shipTo || shipment?.shipto,
                                    searchFields.origin,
                                    searchFields.destination
                                );

                                return (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '12px' }}>
                                        {/* Origin */}
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <span>{route.origin.flag}</span>
                                                <Box sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
                                                    {highlightSearchTerm(route.origin.text, searchFields.origin)}
                                                </Box>
                                            </Box>
                                            {route.origin.postalCode && (
                                                <Box sx={{ pl: 3, fontSize: '11px', color: '#64748b' }}>
                                                    {highlightSearchTerm(route.origin.postalCode, searchFields.origin)}
                                                </Box>
                                            )}
                                        </Box>

                                        {/* Down Arrow */}
                                        <Box sx={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            color: '#64748b',
                                            fontSize: '14px'
                                        }}>
                                            ↓
                                        </Box>

                                        {/* Destination */}
                                        <Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <span>{route.destination.flag}</span>
                                                <Box sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
                                                    {highlightSearchTerm(route.destination.text, searchFields.destination)}
                                                </Box>
                                            </Box>
                                            {route.destination.postalCode && (
                                                <Box sx={{ pl: 3, fontSize: '11px', color: '#64748b' }}>
                                                    {highlightSearchTerm(route.destination.postalCode, searchFields.destination)}
                                                </Box>
                                            )}
                                        </Box>
                                    </Box>
                                );
                            })()}
                        </TableCell>

                        {/* Carrier - Admin View */}
                        <TableCell sx={{
                            verticalAlign: 'top',
                            textAlign: 'left',
                            ...getColumnWidth('carrier'),
                            padding: '8px 12px'
                        }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                {/* Carrier Name */}
                                <Typography variant="body2" sx={{
                                    fontSize: '12px',
                                    wordBreak: 'break-word',
                                    lineHeight: 1.3
                                }}>
                                    {carrierDisplay.name}
                                </Typography>

                                {/* Service Type */}
                                {(() => {
                                    const serviceType = carrierData[shipment?.id]?.service ||
                                        shipment?.selectedRate?.service?.name ||
                                        shipment?.selectedRate?.service ||
                                        shipment?.selectedRateRef?.service?.name ||
                                        shipment?.selectedRateRef?.service ||
                                        shipment?.serviceType;

                                    if (serviceType && typeof serviceType === 'string') {
                                        return (
                                            <Typography variant="body2" sx={{
                                                fontSize: '11px',
                                                color: '#6b7280',
                                                fontStyle: 'italic',
                                                wordBreak: 'break-word',
                                                lineHeight: 1.2
                                            }}>
                                                {serviceType}
                                            </Typography>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Tracking Number */}
                                {trackingNumber && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <QrCodeIcon sx={{ fontSize: '12px', color: '#64748b' }} />
                                        <Typography
                                            onClick={() => onOpenTrackingDrawer(trackingNumber)}
                                            sx={{
                                                color: '#2563eb',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                wordBreak: 'break-all',
                                                lineHeight: 1.2,
                                                '&:hover': {
                                                    textDecoration: 'underline'
                                                }
                                            }}
                                            title="Click to track this shipment"
                                        >
                                            {trackingNumber}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                navigator.clipboard.writeText(trackingNumber);
                                                showSnackbar('Tracking/PRO/Confirmation number copied!', 'success');
                                            }}
                                            sx={{ padding: '2px' }}
                                            title="Copy tracking/confirmation number"
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
                                        </IconButton>
                                    </Box>
                                )}

                                {/* Service Level */}
                                {carrierData[shipment?.id]?.service && (
                                    <Typography variant="body2" sx={{
                                        fontSize: '12px',
                                        color: '#64748b',
                                        wordBreak: 'break-word',
                                        lineHeight: 1.2
                                    }}>
                                        {carrierData[shipment?.id]?.service}
                                    </Typography>
                                )}
                            </Box>
                        </TableCell>

                        {/* Charges - Admin View Only */}
                        <TableCell sx={{
                            verticalAlign: 'top',
                            textAlign: 'left',
                            ...getColumnWidth('charges'),
                            padding: '8px 12px'
                        }}>
                            {(() => {
                                const charges = getCharges();

                                const formatCurrency = (amount, currency) => {
                                    // Ensure currency is valid, fallback to USD if invalid
                                    const validCurrency = currency && currency.length === 3 ? currency : 'USD';

                                    // Format the amount
                                    const numAmount = parseFloat(amount) || 0;

                                    return `$${numAmount.toFixed(2)} ${validCurrency}`;
                                };

                                return (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#374151' }}>
                                            {formatCurrency(charges.cost, charges.currency)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#059669' }}>
                                            {formatCurrency(charges.companyCharge, charges.currency)}
                                        </Typography>
                                    </Box>
                                );
                            })()}
                        </TableCell>
                    </>
                )}

                {/* Status - Shared between both views */}
                {visibleColumns.status !== false && (
                    <TableCell sx={{
                        verticalAlign: 'top',
                        textAlign: 'left',
                        ...getColumnWidth('status'),
                        padding: '8px 12px'
                    }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {/* Top row: Manual Override Indicator + Master Status */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                {/* Manual Override Indicator - Small Bold M */}
                                {shipment?.statusOverride?.isManual && (
                                    <Tooltip title="Status manually overridden">
                                        <Box sx={{
                                            width: '16px',
                                            height: '16px',
                                            backgroundColor: '#e5e7eb',
                                            color: '#374151',
                                            borderRadius: '3px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            flexShrink: 0
                                        }}>
                                            M
                                        </Box>
                                    </Tooltip>
                                )}
                                <EnhancedStatusChip
                                    status={shipment?.statusOverride?.enhancedStatus || shipment?.status}
                                    size="small"
                                    compact={true}
                                    displayMode="master"
                                    showTooltip={true}
                                />
                            </Box>

                            {/* Bottom row: Sub-status if available */}
                            {shipment?.statusOverride?.enhancedStatus?.subStatus && (
                                <Box sx={{ pl: shipment?.statusOverride?.isManual ? 2.5 : 0 }}>
                                    <EnhancedStatusChip
                                        status={shipment?.statusOverride.enhancedStatus}
                                        size="small"
                                        compact={false}
                                        displayMode="sub-only"
                                        showTooltip={false}
                                    />
                                </Box>
                            )}
                        </Box>
                    </TableCell>
                )}

                {/* Expand Button */}
                <TableCell
                    align="center"
                    sx={{
                        verticalAlign: 'top',
                        padding: '8px 4px',
                        width: 40,
                        minWidth: 40,
                        maxWidth: 40
                    }}
                >
                    <IconButton
                        size="small"
                        onClick={() => setExpanded(!expanded)}
                        sx={{
                            color: '#6b7280',
                            '&:hover': {
                                backgroundColor: 'rgba(107, 114, 128, 0.1)'
                            }
                        }}
                    >
                        {expanded ? <ArrowUpIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                    </IconButton>
                </TableCell>

                {/* Actions */}
                {visibleColumns.actions !== false && (
                    <TableCell sx={{
                        verticalAlign: 'top',
                        textAlign: 'right',
                        ...getColumnWidth('actions'),
                        padding: '8px 12px'
                    }} align="right">
                        <IconButton
                            onClick={(e) => onActionMenuOpen(e, shipment)}
                            size="small"
                        >
                            <MoreVertIcon />
                        </IconButton>
                    </TableCell>
                )}
            </TableRow>

            {/* Expanded Row Content */}
            <TableRow>
                <TableCell
                    colSpan={adminViewMode ? 12 : 11}
                    sx={{
                        paddingBottom: 0,
                        paddingTop: 0,
                        borderBottom: expanded ? '1px solid #e2e8f0' : 'none'
                    }}
                >
                    <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 2 }}>

                            <Grid container spacing={3}>
                                {/* Route Information */}
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                            ROUTE INFORMATION
                                        </Typography>

                                        {/* Ship From */}
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>
                                                FROM:
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {shipment?.shipFrom?.companyName || shipment?.shipfrom?.companyName || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {[
                                                    shipment?.shipFrom?.street || shipment?.shipfrom?.street,
                                                    shipment?.shipFrom?.city || shipment?.shipfrom?.city,
                                                    shipment?.shipFrom?.state || shipment?.shipfrom?.state,
                                                    (shipment?.shipFrom?.postalCode || shipment?.shipfrom?.postalCode)?.toUpperCase?.() || (shipment?.shipFrom?.postalCode || shipment?.shipfrom?.postalCode)
                                                ].filter(Boolean).join(', ')}
                                            </Typography>
                                        </Box>

                                        {/* Ship To */}
                                        <Box>
                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280', display: 'block' }}>
                                                TO:
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {shipment?.shipTo?.companyName || shipment?.shipto?.companyName || 'N/A'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {[
                                                    shipment?.shipTo?.street || shipment?.shipto?.street,
                                                    shipment?.shipTo?.city || shipment?.shipto?.city,
                                                    shipment?.shipTo?.state || shipment?.shipto?.state,
                                                    (shipment?.shipTo?.postalCode || shipment?.shipto?.postalCode)?.toUpperCase?.() || (shipment?.shipTo?.postalCode || shipment?.shipto?.postalCode)
                                                ].filter(Boolean).join(', ')}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Grid>

                                {/* Package Information */}
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                            PACKAGE INFORMATION
                                        </Typography>

                                        {/* Weight and Dimensions */}
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {(() => {
                                                const packages = shipment?.packages || [];
                                                const totalWeight = packages.reduce((sum, pkg) =>
                                                    sum + (parseFloat(pkg.weight || 0) * parseInt(pkg.packagingQuantity || 1)), 0
                                                );
                                                const totalPieces = packages.reduce((sum, pkg) =>
                                                    sum + parseInt(pkg.packagingQuantity || 1), 0
                                                );

                                                return (
                                                    <>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                Total Weight:
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                                {totalWeight > 0 ? `${totalWeight} lbs` : 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                Total Pieces:
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                                {totalPieces > 0 ? totalPieces : 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                        {packages.length > 0 && (
                                                            <Box sx={{ mt: 1 }}>
                                                                <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280', display: 'block', mb: 0.5 }}>
                                                                    ALL PACKAGES:
                                                                </Typography>
                                                                {packages.map((pkg, index) => (
                                                                    <Box key={index} sx={{ mb: 0.5 }}>
                                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                                            Package {index + 1}: {pkg.length || 0}" × {pkg.width || 0}" × {pkg.height || 0}"
                                                                            {pkg.weight && ` (${pkg.weight} lbs)`}
                                                                            {pkg.packagingQuantity && parseInt(pkg.packagingQuantity) > 1 && ` × ${pkg.packagingQuantity} pieces`}
                                                                        </Typography>
                                                                        {pkg.description && (
                                                                            <Typography variant="body2" sx={{ fontSize: '10px', color: '#6b7280', ml: 1 }}>
                                                                                {pkg.description}
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                ))}
                                                            </Box>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </Box>
                                    </Box>
                                </Grid>

                                {/* Charges Information */}
                                {adminViewMode && (
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                DETAILED CHARGES
                                            </Typography>

                                            {(() => {
                                                // Get detailed charges breakdown from multiple possible sources
                                                const selectedRate = shipment?.selectedRate || shipment?.selectedRateRef || {};
                                                const pricing = selectedRate.pricing || selectedRate || {};
                                                const manualRates = shipment?.manualRates || [];
                                                const actualRates = shipment?.actualRates || {};
                                                const markupRates = shipment?.markupRates || {};

                                                // Get currency from multiple sources
                                                const currency = pricing.currency ||
                                                    selectedRate.currency ||
                                                    actualRates.currency ||
                                                    markupRates.currency ||
                                                    shipment?.currency || 'USD';

                                                // Check if user is admin/super admin (adminViewMode indicates admin access)
                                                const showCosts = adminViewMode;

                                                // Get all available charge components from multiple data sources
                                                const chargeComponents = [];

                                                // Method 1: Check for actualRates.billingDetails (Enhanced CreateShipmentX)
                                                if (actualRates.billingDetails && actualRates.billingDetails.length > 0) {
                                                    actualRates.billingDetails.forEach(detail => {
                                                        if (detail.amount >= 0) { // Include $0.00 amounts
                                                            chargeComponents.push({
                                                                name: detail.name,
                                                                cost: parseFloat(detail.amount),
                                                                charge: parseFloat(detail.amount) // For actualRates, cost = charge
                                                            });
                                                        }
                                                    });
                                                }

                                                // Method 2: Check for markupRates.billingDetails (Enhanced CreateShipmentX)
                                                if (chargeComponents.length === 0 && markupRates.billingDetails && markupRates.billingDetails.length > 0) {
                                                    markupRates.billingDetails.forEach(detail => {
                                                        if (detail.amount >= 0) { // Include $0.00 amounts
                                                            // For markup rates, find corresponding actual rate
                                                            const actualDetail = actualRates.billingDetails?.find(ad => ad.name === detail.name);
                                                            chargeComponents.push({
                                                                name: detail.name,
                                                                cost: actualDetail ? parseFloat(actualDetail.amount) : parseFloat(detail.amount) * 0.85,
                                                                charge: parseFloat(detail.amount)
                                                            });
                                                        }
                                                    });
                                                }

                                                // Method 3: Check for manual rates (QuickShip style)
                                                if (chargeComponents.length === 0 && manualRates && manualRates.length > 0) {
                                                    manualRates.forEach(rate => {
                                                        if (rate.charge >= 0 || rate.cost >= 0) { // Include $0.00 amounts
                                                            chargeComponents.push({
                                                                name: rate.chargeName || rate.description || rate.name || 'Manual Rate',
                                                                cost: parseFloat(rate.cost) || 0,
                                                                charge: parseFloat(rate.charge) || 0
                                                            });
                                                        }
                                                    });
                                                }

                                                // Method 4: Check pricing breakdown (standard structure)
                                                if (chargeComponents.length === 0) {
                                                    // Base freight charges
                                                    if (pricing.freight >= 0) { // Include $0.00 amounts
                                                        chargeComponents.push({
                                                            name: 'Freight',
                                                            cost: pricing.freightCost || pricing.freight * 0.8,
                                                            charge: pricing.freight
                                                        });
                                                    }

                                                    // Fuel surcharge
                                                    if (pricing.fuel >= 0) { // Include $0.00 amounts
                                                        chargeComponents.push({
                                                            name: 'Fuel Surcharge',
                                                            cost: pricing.fuelCost || pricing.fuel * 0.85,
                                                            charge: pricing.fuel
                                                        });
                                                    }

                                                    // Service charges
                                                    if (pricing.service >= 0) { // Include $0.00 amounts
                                                        chargeComponents.push({
                                                            name: 'Service Fees',
                                                            cost: pricing.serviceCost || pricing.service * 0.9,
                                                            charge: pricing.service
                                                        });
                                                    }

                                                    // Additional charges
                                                    if (pricing.accessorial >= 0) { // Include $0.00 amounts
                                                        chargeComponents.push({
                                                            name: 'Accessorial',
                                                            cost: pricing.accessorialCost || pricing.accessorial * 0.85,
                                                            charge: pricing.accessorial
                                                        });
                                                    }

                                                    if (pricing.insurance >= 0) { // Include $0.00 amounts
                                                        chargeComponents.push({
                                                            name: 'Insurance',
                                                            cost: pricing.insuranceCost || pricing.insurance * 0.7,
                                                            charge: pricing.insurance
                                                        });
                                                    }
                                                }

                                                // Method 5: Check alternative field names
                                                if (chargeComponents.length === 0) {
                                                    // Check for common alternative field names
                                                    const altFields = [
                                                        { name: 'Base Rate', cost: selectedRate.baseRate || selectedRate.baseCost, charge: selectedRate.baseCharge || selectedRate.baseRate },
                                                        { name: 'Freight', cost: selectedRate.freightCost, charge: selectedRate.freightCharge || selectedRate.freight },
                                                        { name: 'Fuel', cost: selectedRate.fuelCost, charge: selectedRate.fuelCharge || selectedRate.fuel },
                                                        { name: 'Accessorial', cost: selectedRate.accessorialCost, charge: selectedRate.accessorialCharge || selectedRate.accessorial }
                                                    ];

                                                    altFields.forEach(field => {
                                                        if (field.charge >= 0 || field.cost >= 0) { // Include $0.00 amounts
                                                            chargeComponents.push({
                                                                name: field.name,
                                                                cost: parseFloat(field.cost) || 0,
                                                                charge: parseFloat(field.charge) || 0
                                                            });
                                                        }
                                                    });
                                                }

                                                // Calculate totals
                                                const totalCost = chargeComponents.reduce((sum, item) => sum + item.cost, 0);
                                                const totalCharge = chargeComponents.reduce((sum, item) => sum + item.charge, 0);
                                                const finalTotal = pricing.total ||
                                                    totalCharge ||
                                                    markupRates.totalCharges ||
                                                    selectedRate.totalCharges ||
                                                    selectedRate.price ||
                                                    shipment?.totalCharges || 0;

                                                return (
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                        {chargeComponents.length > 0 ? (
                                                            <>
                                                                {chargeComponents.map((component, index) => (
                                                                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                            {component.name}:
                                                                        </Typography>
                                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                            {showCosts ? (
                                                                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                                                    <span style={{ color: '#059669' }}>${(component.cost || 0).toFixed(2)} {currency}</span>
                                                                                    <span style={{ color: '#6b7280', margin: '0 8px' }}>|</span>
                                                                                    <span style={{ color: '#374151' }}>${(component.charge || 0).toFixed(2)} {currency}</span>
                                                                                </Typography>
                                                                            ) : (
                                                                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500, color: '#374151' }}>
                                                                                    ${(component.charge || 0).toFixed(2)} {currency}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    </Box>
                                                                ))}
                                                                <Divider sx={{ my: 0.5 }} />
                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                                        Total:
                                                                    </Typography>
                                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                        {showCosts ? (
                                                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                                                <span style={{ color: '#059669' }}>${(totalCost || 0).toFixed(2)} {currency}</span>
                                                                                <span style={{ color: '#6b7280', margin: '0 8px' }}>|</span>
                                                                                <span style={{ color: '#374151' }}>${(finalTotal || 0).toFixed(2)} {currency}</span>
                                                                            </Typography>
                                                                        ) : (
                                                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                                                ${(finalTotal || 0).toFixed(2)} {currency}
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                </Box>
                                                            </>
                                                        ) : (
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                    Total Charges:
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                                                    ${finalTotal.toFixed(2)} {currency}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                );
                                            })()}
                                        </Box>
                                    </Grid>
                                )}

                                {/* Follow-Up Tasks */}
                                {followUpSummary?.hasFollowUps && (
                                    <Grid item xs={12} md={adminViewMode ? 6 : 12}>
                                        <Box sx={{ p: 2, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #f59e0b' }}>
                                            <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#92400e', mb: 1 }}>
                                                FOLLOW-UP TASKS
                                            </Typography>

                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#92400e' }}>
                                                        Total Tasks: {followUpSummary.totalTasks}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        {followUpSummary.overdueTasks > 0 && (
                                                            <Chip
                                                                label={`${followUpSummary.overdueTasks} Overdue`}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: '#fee2e2',
                                                                    color: '#dc2626',
                                                                    fontSize: '10px',
                                                                    height: 20
                                                                }}
                                                            />
                                                        )}
                                                        {followUpSummary.urgentTasks > 0 && (
                                                            <Chip
                                                                label={`${followUpSummary.urgentTasks} Urgent`}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: '#fef3c7',
                                                                    color: '#d97706',
                                                                    fontSize: '10px',
                                                                    height: 20
                                                                }}
                                                            />
                                                        )}
                                                        {followUpSummary.pendingTasks > 0 && (
                                                            <Chip
                                                                label={`${followUpSummary.pendingTasks} Pending`}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: '#e0e7ff',
                                                                    color: '#3730a3',
                                                                    fontSize: '10px',
                                                                    height: 20
                                                                }}
                                                            />
                                                        )}
                                                    </Box>
                                                </Box>

                                                {followUpSummary.nextTask && (
                                                    <Box sx={{ pt: 1, borderTop: '1px solid #f59e0b' }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500, color: '#92400e', mb: 0.5 }}>
                                                            Next Task:
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '10px', color: '#92400e' }}>
                                                            {followUpSummary.nextTask.title}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '10px', color: '#b45309' }}>
                                                            Due: {new Date(followUpSummary.nextTask.dueDate).toLocaleDateString()}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Box>
                                        </Box>
                                    </Grid>
                                )}

                                {/* Documents */}
                                <Grid item xs={12} md={adminViewMode ? 6 : 12}>
                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                            DOCUMENTS
                                        </Typography>

                                        <DocumentsSection shipment={shipment} showSnackbar={showSnackbar} expanded={expanded} />
                                    </Box>
                                </Grid>
                            </Grid>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </>
    );
};

// Documents Section Component
const DocumentsSection = ({ shipment, showSnackbar, expanded }) => {
    const [documentData, setDocumentData] = useState(null);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState('');
    const [downloadingDoc, setDownloadingDoc] = useState(null); // Track which document is being downloaded

    // Enhanced PDF viewer function with loading state
    const viewPdfInModal = async (documentId, filename, title) => {
        try {
            // Set loading state for this specific document
            setDownloadingDoc(documentId);

            // Fetch the document URL from Firebase
            const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
            const result = await getDocumentDownloadUrlFunction({
                documentId: documentId,
                shipmentId: shipment?.id
            });

            if (result.data && result.data.success) {
                const pdfUrl = result.data.downloadUrl;
                console.log('PDF viewer opened for document:', {
                    documentId,
                    title,
                    foundInUnified: result.data.metadata?.foundInUnified,
                    storagePath: result.data.metadata?.storagePath
                });

                setCurrentPdfUrl(pdfUrl);
                setCurrentPdfTitle(title || filename || 'Document');
                setPdfViewerOpen(true);
            } else {
                throw new Error(result.data?.error || 'Failed to get document URL');
            }
        } catch (error) {
            console.error('Error viewing document:', error);
            showSnackbar('Failed to load document: ' + error.message, 'error');
        } finally {
            // Clear loading state
            setDownloadingDoc(null);
        }
    };

    // Load documents when expanded
    useEffect(() => {
        if (expanded && !documentData && !loadingDocs && shipment?.status !== 'draft') {
            setLoadingDocs(true);

            const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');

            getShipmentDocumentsFunction({
                shipmentId: shipment?.id,
                organized: true
            }).then(result => {
                if (result.data && result.data.success) {
                    setDocumentData(result.data.data);
                } else {
                    setDocumentData({});
                }
                setLoadingDocs(false);
            }).catch(error => {
                console.error('Error loading documents:', error);
                setDocumentData({});
                setLoadingDocs(false);
            });
        }
    }, [expanded, documentData, loadingDocs, shipment?.id, shipment?.status]);

    // Reset document data when shipment changes
    useEffect(() => {
        setDocumentData(null);
    }, [shipment?.id]);

    // Check if this is a draft shipment
    if (shipment?.status === 'draft') {
        return (
            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                No documents created
            </Typography>
        );
    }

    if (loadingDocs) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Skeleton variant="rectangular" height={20} />
                <Skeleton variant="rectangular" height={20} />
                <Skeleton variant="rectangular" height={20} />
            </Box>
        );
    }

    if (!documentData) {
        return (
            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                Click to load documents
            </Typography>
        );
    }

    // Check for available documents
    const availableDocuments = [];

    // Check BOL documents
    if (documentData.bol && documentData.bol.length > 0) {
        availableDocuments.push({
            type: 'BOL',
            name: 'Bill of Lading',
            documents: documentData.bol,
            count: documentData.bol.length
        });
    }

    // Check Labels documents
    if (documentData.labels && documentData.labels.length > 0) {
        availableDocuments.push({
            type: 'LABELS',
            name: 'Shipping Labels',
            documents: documentData.labels,
            count: documentData.labels.length
        });
    }

    // Enhanced Carrier Confirmation detection - check multiple sources
    let carrierConfirmationDocs = [];

    // First check the dedicated carrierConfirmations array
    if (documentData.carrierConfirmations && documentData.carrierConfirmations.length > 0) {
        carrierConfirmationDocs = [...documentData.carrierConfirmations];
    }

    // Also check all other document collections for carrier confirmations
    const allOtherDocs = [
        ...(documentData.documents || []),
        ...(documentData.other || []),
        ...(documentData.bol || []), // Sometimes confirmations are misclassified
        ...(documentData.labels || []) // Sometimes confirmations are misclassified
    ];

    // Look for carrier confirmation documents in other collections
    const additionalConfirmations = allOtherDocs.filter(doc => {
        const filename = (doc.filename || '').toLowerCase();
        const documentType = (doc.documentType || '').toLowerCase();

        return doc.docType === 7 || // Carrier confirmation type
            documentType === 'carrier_confirmation' ||
            filename.includes('carrier_confirmation') ||
            filename.includes('carrier-confirmation') ||
            (filename.includes('carrier') && filename.includes('confirmation')) ||
            filename.includes('pickup_confirmation') ||
            filename.includes('pickup-confirmation');
    });

    // Combine all carrier confirmation documents
    if (additionalConfirmations.length > 0) {
        carrierConfirmationDocs = [...carrierConfirmationDocs, ...additionalConfirmations];
    }

    // Remove duplicates based on document ID
    carrierConfirmationDocs = carrierConfirmationDocs.filter((doc, index, self) =>
        index === self.findIndex(d => d.id === doc.id)
    );

    if (carrierConfirmationDocs.length > 0) {
        availableDocuments.push({
            type: 'CONFIRMATION',
            name: 'Carrier Confirmation',
            documents: carrierConfirmationDocs,
            count: carrierConfirmationDocs.length
        });
    }

    if (availableDocuments.length === 0) {
        return (
            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                No documents available
            </Typography>
        );
    }

    // Display documents table
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {availableDocuments.map((docGroup, index) => (
                <Box key={index} sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1.5,
                    border: '1px solid #e2e8f0',
                    borderRadius: 1,
                    backgroundColor: '#f8fafc'
                }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                            {docGroup.name}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                            {docGroup.count} document{docGroup.count > 1 ? 's' : ''} available
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={(() => {
                                // Enhanced document selection logic for latest documents
                                let selectedDoc = null;

                                if (docGroup.type === 'BOL') {
                                    // Use same algorithm as useShipmentActions.js for BOL selection
                                    const sortedBOLs = [...docGroup.documents].sort((a, b) => {
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
                                    selectedDoc = sortedBOLs[0];
                                } else if (docGroup.type === 'CONFIRMATION') {
                                    // Use same algorithm as useShipmentActions.js for Carrier Confirmation selection
                                    const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
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

                                        // Priority 4: Carrier confirmation specific document types
                                        if (a.docType === 7 && b.docType !== 7) return -1;
                                        if (a.docType !== 7 && b.docType === 7) return 1;

                                        // Priority 5: Newest creation date
                                        const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                        const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                        return bCreatedTime - aCreatedTime;
                                    });
                                    selectedDoc = sortedConfirmations[0];
                                } else {
                                    // For other document types, use first document (existing behavior)
                                    selectedDoc = docGroup.documents[0];
                                }

                                const isLoading = downloadingDoc === selectedDoc?.id;
                                return isLoading ? <CircularProgress size={12} /> : <FileDownloadIcon />;
                            })()}
                            onClick={() => {
                                // Enhanced document selection logic for download
                                let selectedDoc = null;

                                if (docGroup.type === 'BOL') {
                                    // Use same algorithm as useShipmentActions.js for BOL selection
                                    const sortedBOLs = [...docGroup.documents].sort((a, b) => {
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
                                    selectedDoc = sortedBOLs[0];

                                    console.log('✅ ShipmentTableRow - Selected LATEST BOL document:', {
                                        id: selectedDoc.id,
                                        filename: selectedDoc.filename,
                                        isLatest: selectedDoc.isLatest,
                                        version: selectedDoc.version,
                                        regeneratedAt: selectedDoc.regeneratedAt,
                                        selectionReason: selectedDoc.isLatest ? 'marked as latest' :
                                            selectedDoc.version > 0 ? `version ${selectedDoc.version}` :
                                                selectedDoc.regeneratedAt ? 'recently regenerated' :
                                                    (selectedDoc.filename || '').toUpperCase().startsWith('SOLUSHIP-') ? 'SOLUSHIP format' : 'fallback'
                                    });
                                } else if (docGroup.type === 'CONFIRMATION') {
                                    // Use same algorithm as useShipmentActions.js for Carrier Confirmation selection
                                    const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
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

                                        // Priority 4: Carrier confirmation specific document types
                                        if (a.docType === 7 && b.docType !== 7) return -1;
                                        if (a.docType !== 7 && b.docType === 7) return 1;

                                        // Priority 5: Newest creation date
                                        const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                        const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                        return bCreatedTime - aCreatedTime;
                                    });
                                    selectedDoc = sortedConfirmations[0];

                                    console.log('✅ ShipmentTableRow - Selected LATEST Carrier Confirmation document:', {
                                        id: selectedDoc.id,
                                        filename: selectedDoc.filename,
                                        isLatest: selectedDoc.isLatest,
                                        version: selectedDoc.version,
                                        regeneratedAt: selectedDoc.regeneratedAt,
                                        selectionReason: selectedDoc.isLatest ? 'marked as latest' :
                                            selectedDoc.version > 0 ? `version ${selectedDoc.version}` :
                                                selectedDoc.regeneratedAt ? 'recently regenerated' :
                                                    selectedDoc.docType === 7 ? 'carrier confirmation type' : 'fallback'
                                    });
                                } else {
                                    // For other document types, use first document (existing behavior)
                                    selectedDoc = docGroup.documents[0];
                                }

                                if (selectedDoc && selectedDoc.id) {
                                    viewPdfInModal(selectedDoc.id, selectedDoc.filename, docGroup.name);
                                } else {
                                    showSnackbar('Document not available', 'warning');
                                }
                            }}
                            disabled={(() => {
                                // Enhanced document selection logic for loading state
                                let selectedDoc = null;

                                if (docGroup.type === 'BOL') {
                                    const sortedBOLs = [...docGroup.documents].sort((a, b) => {
                                        if (a.isLatest && !b.isLatest) return -1;
                                        if (!a.isLatest && b.isLatest) return 1;
                                        const aVersion = a.version || 0;
                                        const bVersion = b.version || 0;
                                        if (aVersion !== bVersion) return bVersion - aVersion;
                                        const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                        const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                        if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                        if (aRegenTime && !bRegenTime) return -1;
                                        if (!aRegenTime && bRegenTime) return 1;
                                        const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                        const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                        if (aIsSoluship && !bIsSoluship) return -1;
                                        if (!aIsSoluship && bIsSoluship) return 1;
                                        const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                                        const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                                        if (aIsGenerated && !bIsGenerated) return -1;
                                        if (!aIsGenerated && bIsGenerated) return 1;
                                        const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                        const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                        return bCreatedTime - aCreatedTime;
                                    });
                                    selectedDoc = sortedBOLs[0];
                                } else if (docGroup.type === 'CONFIRMATION') {
                                    const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
                                        if (a.isLatest && !b.isLatest) return -1;
                                        if (!a.isLatest && b.isLatest) return 1;
                                        const aVersion = a.version || 0;
                                        const bVersion = b.version || 0;
                                        if (aVersion !== bVersion) return bVersion - aVersion;
                                        const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                        const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                        if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                        if (aRegenTime && !bRegenTime) return -1;
                                        if (!aRegenTime && bRegenTime) return 1;
                                        if (a.docType === 7 && b.docType !== 7) return -1;
                                        if (a.docType !== 7 && b.docType === 7) return 1;
                                        const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                        const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                        return bCreatedTime - aCreatedTime;
                                    });
                                    selectedDoc = sortedConfirmations[0];
                                } else {
                                    selectedDoc = docGroup.documents[0];
                                }

                                return downloadingDoc === selectedDoc?.id;
                            })()}
                            sx={{
                                fontSize: '11px',
                                minWidth: 'auto',
                                px: 1.5,
                                py: 0.5,
                                borderColor: (() => {
                                    let selectedDoc = null;
                                    if (docGroup.type === 'BOL') {
                                        const sortedBOLs = [...docGroup.documents].sort((a, b) => {
                                            if (a.isLatest && !b.isLatest) return -1;
                                            if (!a.isLatest && b.isLatest) return 1;
                                            const aVersion = a.version || 0;
                                            const bVersion = b.version || 0;
                                            if (aVersion !== bVersion) return bVersion - aVersion;
                                            const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                            const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                            if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                            if (aRegenTime && !bRegenTime) return -1;
                                            if (!aRegenTime && bRegenTime) return 1;
                                            const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                            const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                            if (aIsSoluship && !bIsSoluship) return -1;
                                            if (!aIsSoluship && bIsSoluship) return 1;
                                            const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                                            const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                                            if (aIsGenerated && !bIsGenerated) return -1;
                                            if (!aIsGenerated && bIsGenerated) return 1;
                                            const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                            const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                            return bCreatedTime - aCreatedTime;
                                        });
                                        selectedDoc = sortedBOLs[0];
                                    } else if (docGroup.type === 'CONFIRMATION') {
                                        const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
                                            if (a.isLatest && !b.isLatest) return -1;
                                            if (!a.isLatest && b.isLatest) return 1;
                                            const aVersion = a.version || 0;
                                            const bVersion = b.version || 0;
                                            if (aVersion !== bVersion) return bVersion - aVersion;
                                            const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                            const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                            if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                            if (aRegenTime && !bRegenTime) return -1;
                                            if (!aRegenTime && bRegenTime) return 1;
                                            if (a.docType === 7 && b.docType !== 7) return -1;
                                            if (a.docType !== 7 && b.docType === 7) return 1;
                                            const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                            const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                            return bCreatedTime - aCreatedTime;
                                        });
                                        selectedDoc = sortedConfirmations[0];
                                    } else {
                                        selectedDoc = docGroup.documents[0];
                                    }
                                    const isLoading = downloadingDoc === selectedDoc?.id;
                                    return isLoading ? '#d1d5db' : '#e5e7eb';
                                })(),
                                color: (() => {
                                    let selectedDoc = null;
                                    if (docGroup.type === 'BOL') {
                                        const sortedBOLs = [...docGroup.documents].sort((a, b) => {
                                            if (a.isLatest && !b.isLatest) return -1;
                                            if (!a.isLatest && b.isLatest) return 1;
                                            const aVersion = a.version || 0;
                                            const bVersion = b.version || 0;
                                            if (aVersion !== bVersion) return bVersion - aVersion;
                                            const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                            const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                            if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                            if (aRegenTime && !bRegenTime) return -1;
                                            if (!aRegenTime && bRegenTime) return 1;
                                            const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                            const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                            if (aIsSoluship && !bIsSoluship) return -1;
                                            if (!aIsSoluship && bIsSoluship) return 1;
                                            const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                                            const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                                            if (aIsGenerated && !bIsGenerated) return -1;
                                            if (!aIsGenerated && bIsGenerated) return 1;
                                            const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                            const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                            return bCreatedTime - aCreatedTime;
                                        });
                                        selectedDoc = sortedBOLs[0];
                                    } else if (docGroup.type === 'CONFIRMATION') {
                                        const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
                                            if (a.isLatest && !b.isLatest) return -1;
                                            if (!a.isLatest && b.isLatest) return 1;
                                            const aVersion = a.version || 0;
                                            const bVersion = b.version || 0;
                                            if (aVersion !== bVersion) return bVersion - aVersion;
                                            const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                            const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                            if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                            if (aRegenTime && !bRegenTime) return -1;
                                            if (!aRegenTime && bRegenTime) return 1;
                                            if (a.docType === 7 && b.docType !== 7) return -1;
                                            if (a.docType !== 7 && b.docType === 7) return 1;
                                            const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                            const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                            return bCreatedTime - aCreatedTime;
                                        });
                                        selectedDoc = sortedConfirmations[0];
                                    } else {
                                        selectedDoc = docGroup.documents[0];
                                    }
                                    const isLoading = downloadingDoc === selectedDoc?.id;
                                    return isLoading ? '#9ca3af' : '#374151';
                                })(),
                                '&:hover': {
                                    borderColor: (() => {
                                        let selectedDoc = null;
                                        if (docGroup.type === 'BOL') {
                                            const sortedBOLs = [...docGroup.documents].sort((a, b) => {
                                                if (a.isLatest && !b.isLatest) return -1;
                                                if (!a.isLatest && b.isLatest) return 1;
                                                const aVersion = a.version || 0;
                                                const bVersion = b.version || 0;
                                                if (aVersion !== bVersion) return bVersion - aVersion;
                                                const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                                const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                                if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                                if (aRegenTime && !bRegenTime) return -1;
                                                if (!aRegenTime && bRegenTime) return 1;
                                                const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                                const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                                if (aIsSoluship && !bIsSoluship) return -1;
                                                if (!aIsSoluship && bIsSoluship) return 1;
                                                const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                                                const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                                                if (aIsGenerated && !bIsGenerated) return -1;
                                                if (!aIsGenerated && bIsGenerated) return 1;
                                                const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                                const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                                return bCreatedTime - aCreatedTime;
                                            });
                                            selectedDoc = sortedBOLs[0];
                                        } else if (docGroup.type === 'CONFIRMATION') {
                                            const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
                                                if (a.isLatest && !b.isLatest) return -1;
                                                if (!a.isLatest && b.isLatest) return 1;
                                                const aVersion = a.version || 0;
                                                const bVersion = b.version || 0;
                                                if (aVersion !== bVersion) return bVersion - aVersion;
                                                const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                                const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                                if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                                if (aRegenTime && !bRegenTime) return -1;
                                                if (!aRegenTime && bRegenTime) return 1;
                                                if (a.docType === 7 && b.docType !== 7) return -1;
                                                if (a.docType !== 7 && b.docType === 7) return 1;
                                                const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                                const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                                return bCreatedTime - aCreatedTime;
                                            });
                                            selectedDoc = sortedConfirmations[0];
                                        } else {
                                            selectedDoc = docGroup.documents[0];
                                        }
                                        const isLoading = downloadingDoc === selectedDoc?.id;
                                        return isLoading ? '#d1d5db' : '#1d4ed8';
                                    })(),
                                    color: (() => {
                                        let selectedDoc = null;
                                        if (docGroup.type === 'BOL') {
                                            const sortedBOLs = [...docGroup.documents].sort((a, b) => {
                                                if (a.isLatest && !b.isLatest) return -1;
                                                if (!a.isLatest && b.isLatest) return 1;
                                                const aVersion = a.version || 0;
                                                const bVersion = b.version || 0;
                                                if (aVersion !== bVersion) return bVersion - aVersion;
                                                const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                                const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                                if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                                if (aRegenTime && !bRegenTime) return -1;
                                                if (!aRegenTime && bRegenTime) return 1;
                                                const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                                const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                                if (aIsSoluship && !bIsSoluship) return -1;
                                                if (!aIsSoluship && bIsSoluship) return 1;
                                                const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                                                const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                                                if (aIsGenerated && !bIsGenerated) return -1;
                                                if (!aIsGenerated && bIsGenerated) return 1;
                                                const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                                const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                                return bCreatedTime - aCreatedTime;
                                            });
                                            selectedDoc = sortedBOLs[0];
                                        } else if (docGroup.type === 'CONFIRMATION') {
                                            const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
                                                if (a.isLatest && !b.isLatest) return -1;
                                                if (!a.isLatest && b.isLatest) return 1;
                                                const aVersion = a.version || 0;
                                                const bVersion = b.version || 0;
                                                if (aVersion !== bVersion) return bVersion - aVersion;
                                                const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                                const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                                if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                                if (aRegenTime && !bRegenTime) return -1;
                                                if (!aRegenTime && bRegenTime) return 1;
                                                if (a.docType === 7 && b.docType !== 7) return -1;
                                                if (a.docType !== 7 && b.docType === 7) return 1;
                                                const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                                const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                                return bCreatedTime - aCreatedTime;
                                            });
                                            selectedDoc = sortedConfirmations[0];
                                        } else {
                                            selectedDoc = docGroup.documents[0];
                                        }
                                        const isLoading = downloadingDoc === selectedDoc?.id;
                                        return isLoading ? '#9ca3af' : '#1d4ed8';
                                    })(),
                                    backgroundColor: (() => {
                                        let selectedDoc = null;
                                        if (docGroup.type === 'BOL') {
                                            const sortedBOLs = [...docGroup.documents].sort((a, b) => {
                                                if (a.isLatest && !b.isLatest) return -1;
                                                if (!a.isLatest && b.isLatest) return 1;
                                                const aVersion = a.version || 0;
                                                const bVersion = b.version || 0;
                                                if (aVersion !== bVersion) return bVersion - aVersion;
                                                const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                                const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                                if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                                if (aRegenTime && !bRegenTime) return -1;
                                                if (!aRegenTime && bRegenTime) return 1;
                                                const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                                const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                                if (aIsSoluship && !bIsSoluship) return -1;
                                                if (!aIsSoluship && bIsSoluship) return 1;
                                                const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                                                const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                                                if (aIsGenerated && !bIsGenerated) return -1;
                                                if (!aIsGenerated && bIsGenerated) return 1;
                                                const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                                const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                                return bCreatedTime - aCreatedTime;
                                            });
                                            selectedDoc = sortedBOLs[0];
                                        } else if (docGroup.type === 'CONFIRMATION') {
                                            const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
                                                if (a.isLatest && !b.isLatest) return -1;
                                                if (!a.isLatest && b.isLatest) return 1;
                                                const aVersion = a.version || 0;
                                                const bVersion = b.version || 0;
                                                if (aVersion !== bVersion) return bVersion - aVersion;
                                                const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                                const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                                if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                                if (aRegenTime && !bRegenTime) return -1;
                                                if (!aRegenTime && bRegenTime) return 1;
                                                if (a.docType === 7 && b.docType !== 7) return -1;
                                                if (a.docType !== 7 && b.docType === 7) return 1;
                                                const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                                const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                                return bCreatedTime - aCreatedTime;
                                            });
                                            selectedDoc = sortedConfirmations[0];
                                        } else {
                                            selectedDoc = docGroup.documents[0];
                                        }
                                        const isLoading = downloadingDoc === selectedDoc?.id;
                                        return isLoading ? 'transparent' : '#eff6ff';
                                    })()
                                }
                            }}
                        >
                            {(() => {
                                let selectedDoc = null;
                                if (docGroup.type === 'BOL') {
                                    const sortedBOLs = [...docGroup.documents].sort((a, b) => {
                                        if (a.isLatest && !b.isLatest) return -1;
                                        if (!a.isLatest && b.isLatest) return 1;
                                        const aVersion = a.version || 0;
                                        const bVersion = b.version || 0;
                                        if (aVersion !== bVersion) return bVersion - aVersion;
                                        const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                        const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                        if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                        if (aRegenTime && !bRegenTime) return -1;
                                        if (!aRegenTime && bRegenTime) return 1;
                                        const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                        const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                                        if (aIsSoluship && !bIsSoluship) return -1;
                                        if (!aIsSoluship && bIsSoluship) return 1;
                                        const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                                        const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                                        if (aIsGenerated && !bIsGenerated) return -1;
                                        if (!aIsGenerated && bIsGenerated) return 1;
                                        const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                        const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                        return bCreatedTime - aCreatedTime;
                                    });
                                    selectedDoc = sortedBOLs[0];
                                } else if (docGroup.type === 'CONFIRMATION') {
                                    const sortedConfirmations = [...docGroup.documents].sort((a, b) => {
                                        if (a.isLatest && !b.isLatest) return -1;
                                        if (!a.isLatest && b.isLatest) return 1;
                                        const aVersion = a.version || 0;
                                        const bVersion = b.version || 0;
                                        if (aVersion !== bVersion) return bVersion - aVersion;
                                        const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                                        const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                                        if (aRegenTime && bRegenTime) return bRegenTime - aRegenTime;
                                        if (aRegenTime && !bRegenTime) return -1;
                                        if (!aRegenTime && bRegenTime) return 1;
                                        if (a.docType === 7 && b.docType !== 7) return -1;
                                        if (a.docType !== 7 && b.docType === 7) return 1;
                                        const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                                        const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                                        return bCreatedTime - aCreatedTime;
                                    });
                                    selectedDoc = sortedConfirmations[0];
                                } else {
                                    selectedDoc = docGroup.documents[0];
                                }
                                const isLoading = downloadingDoc === selectedDoc?.id;
                                return isLoading ? 'Loading...' : 'Download';
                            })()}
                        </Button>
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

export default ShipmentTableRow; 