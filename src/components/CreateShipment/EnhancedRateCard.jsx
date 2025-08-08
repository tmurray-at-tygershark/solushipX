import React, { useState, useCallback } from 'react';
import {
    Card,
    CardContent,
    Box,
    Typography,
    Grid,
    Chip,
    Button,
    Collapse,
    Divider,
    Tooltip,
    IconButton
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import SecurityIcon from '@mui/icons-material/Security';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
// Add missing imports for database functionality
import { useState as useStateImport, useEffect, useRef } from 'react';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { hasPermission, PERMISSIONS } from '../../utils/rolePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { getDisplayCarrierName } from '../../utils/carrierDisplayService';
import { getLightBackgroundLogo } from '../../utils/logoUtils';

const EnhancedRateCard = ({
    rate,
    isSelected,
    onSelect,
    showDetails = false,
    onGuaranteeChange,
    userRole = 'user'
}) => {
    const [expanded, setExpanded] = useState(showDetails);
    const [carrierLogoUrl, setCarrierLogoUrl] = useState(null);
    const [companyData, setCompanyData] = useState(null);
    const [displayCarrierName, setDisplayCarrierName] = useState('');
    const [isOverridden, setIsOverridden] = useState(false);
    const isOverriddenRef = useRef(false);

    // Get auth and company context
    const { currentUser } = useAuth();
    const { companyIdForAddress } = useCompany();

    // Check if user is admin or super admin
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // Check permission-based visibility
    const canViewPricing = hasPermission(userRole, PERMISSIONS.VIEW_RATE_PRICING);
    const canViewBreakdown = hasPermission(userRole, PERMISSIONS.VIEW_RATE_BREAKDOWN);

    // Get cost vs charge information for admins
    const getCostChargeInfo = () => {
        if (!isAdmin) return null;

        const hasMarkupMetadata = rate.markupMetadata && rate.markupMetadata.appliedMarkups && rate.markupMetadata.appliedMarkups.length > 0;

        if (hasMarkupMetadata) {
            // Original cost (what carrier quoted)
            const originalCost = rate.markupMetadata.originalTotal || 0;
            // Final charge (after markup)
            const finalCharge = rate.pricing?.total || rate.totalCharges || rate.price || 0;

            return {
                cost: originalCost,
                charge: finalCharge,
                hasMarkup: true,
                markupAmount: rate.markupMetadata.totalMarkupAmount || 0,
                markupPercentage: rate.markupMetadata.totalMarkupAmount && rate.markupMetadata.originalTotal
                    ? ((rate.markupMetadata.totalMarkupAmount / rate.markupMetadata.originalTotal) * 100).toFixed(1)
                    : 0,
                appliedMarkups: rate.markupMetadata.appliedMarkups || []
            };
        } else {
            // No markup applied - cost equals charge
            const amount = rate.pricing?.total || rate.totalCharges || rate.price || 0;
            return {
                cost: amount,
                charge: amount,
                hasMarkup: false,
                markupAmount: 0,
                markupPercentage: 0,
                appliedMarkups: []
            };
        }
    };

    const costChargeInfo = getCostChargeInfo();

    // Load company data for carrier overrides
    useEffect(() => {
        const loadCompanyData = async () => {
            console.log('📊 EnhancedRateCard - Loading company data:', { companyIdForAddress, isAdmin, userRole });

            if (!companyIdForAddress || isAdmin) {
                console.log('❌ Skipping company data load - Missing ID or admin user');
                setCompanyData(null);
                return;
            }

            try {
                // First try to find company by Firestore document ID
                const companyRef = doc(db, 'companies', companyIdForAddress);
                const companyDoc = await getDoc(companyRef);

                if (companyDoc.exists()) {
                    const data = companyDoc.data();
                    console.log('✅ Company data loaded by doc ID:', {
                        companyId: companyIdForAddress,
                        hasConnectedCarriers: !!data.connectedCarriers,
                        carrierCount: data.connectedCarriers?.length || 0,
                        connectedCarriers: data.connectedCarriers || []
                    });
                    setCompanyData(data);
                    return;
                }

                // If not found by doc ID, try querying by companyID field
                console.log('🔍 Company not found by doc ID, trying companyID field query...', companyIdForAddress);
                const companiesQuery = query(
                    collection(db, 'companies'),
                    where('companyID', '==', companyIdForAddress),
                    limit(1)
                );

                const companiesSnapshot = await getDocs(companiesQuery);

                if (!companiesSnapshot.empty) {
                    const foundCompanyDoc = companiesSnapshot.docs[0];
                    const data = foundCompanyDoc.data();
                    console.log('✅ Company found by companyID field:', {
                        searchedCompanyId: companyIdForAddress,
                        foundDocId: foundCompanyDoc.id,
                        hasConnectedCarriers: !!data.connectedCarriers,
                        carrierCount: data.connectedCarriers?.length || 0,
                        connectedCarriers: data.connectedCarriers || []
                    });
                    setCompanyData(data);
                } else {
                    console.log('❌ Company not found by either method:', companyIdForAddress);

                    // Let's also list available companies for debugging
                    const allCompaniesQuery = query(collection(db, 'companies'), limit(5));
                    const allCompaniesSnapshot = await getDocs(allCompaniesQuery);
                    const availableCompanies = allCompaniesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        companyID: doc.data().companyID,
                        name: doc.data().name
                    }));
                    console.log('🏢 Available companies (first 5):', availableCompanies);

                    setCompanyData(null);
                }
            } catch (error) {
                console.error('Error loading company data for carrier overrides:', error);
                setCompanyData(null);
            }
        };

        loadCompanyData();
    }, [companyIdForAddress, isAdmin, userRole]);

    // Apply carrier name override and set display name
    useEffect(() => {
        const rawCarrierName = rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName || 'Unknown Carrier';

        console.log('🚀 EnhancedRateCard - Carrier Override Debug:', {
            rawCarrierName,
            isAdmin,
            companyIdForAddress,
            hasCompanyData: !!companyData,
            companyDataKeys: companyData ? Object.keys(companyData) : null,
            connectedCarriers: companyData?.connectedCarriers || [],
            userRole
        });

        if (!isAdmin && companyData && companyIdForAddress) {
            const overriddenName = getDisplayCarrierName(
                { name: rawCarrierName, carrierID: rawCarrierName },
                companyIdForAddress,
                companyData,
                isAdmin
            );

            console.log('🔄 Override Result:', { rawCarrierName, overriddenName, isOverridden: overriddenName !== rawCarrierName });

            setDisplayCarrierName(overriddenName);
            setIsOverridden(overriddenName !== rawCarrierName);
        } else {
            console.log('❌ No override - Admin or missing data:', { isAdmin, hasCompanyData: !!companyData, companyIdForAddress });
            setDisplayCarrierName(rawCarrierName);
            setIsOverridden(false);
        }
    }, [rate, companyData, companyIdForAddress, isAdmin, userRole]);

    // Keep a live ref of override state to avoid stale async updates overriding company logo
    useEffect(() => {
        isOverriddenRef.current = isOverridden;
    }, [isOverridden]);

    // Fetch carrier logo from database - DYNAMIC VERSION LIKE REVIEW.JSX
    const fetchCarrierLogo = useCallback(async (carrierName) => {
        if (!carrierName) return '/images/carrier-badges/solushipx.png';

        try {
            // Map carrier display names to database carrierID values (same as Review.jsx)
            const carrierNameToIdMap = {
                'canpar express': 'CANPAR',
                'canpar': 'CANPAR',
                'eship plus': 'ESHIPPLUS',
                'eshipplus': 'ESHIPPLUS',
                'polaris transportation': 'POLARISTRANSPORTATION',
                'polaris': 'POLARISTRANSPORTATION',
                'fedex': 'FEDEX',
                'ups': 'UPS',
                'purolator': 'PUROLATOR',
                'dhl': 'DHL',
                'canada post': 'CANADAPOST',
                'usps': 'USPS',
                'ward trucking': 'ESHIPPLUS', // Ward Trucking is via eShip Plus
                'ward': 'ESHIPPLUS',
                'saia': 'ESHIPPLUS',
                'estes': 'ESHIPPLUS',
                'old dominion': 'ESHIPPLUS',
                'odfl': 'ESHIPPLUS',
                'yrc': 'ESHIPPLUS',
                'xpo': 'ESHIPPLUS',
                'fedex freight': 'ESHIPPLUS',
                'road runner': 'ESHIPPLUS',
                'roadrunner': 'ESHIPPLUS'
            };

            // Normalize carrier name and map to carrierID
            const normalizedCarrierName = carrierName.toLowerCase().trim();
            const carrierID = carrierNameToIdMap[normalizedCarrierName] || carrierName.toUpperCase().replace(/\s+/g, '');

            console.log('EnhancedRateCard - Mapping carrier name to ID:', { carrierName, normalizedCarrierName, carrierID });

            // Query carriers collection by carrierID field
            const carriersQuery = query(
                collection(db, 'carriers'),
                where('carrierID', '==', carrierID),
                limit(1)
            );

            const carriersSnapshot = await getDocs(carriersQuery);

            if (!carriersSnapshot.empty) {
                const carrierDoc = carriersSnapshot.docs[0];
                const carrierData = carrierDoc.data();
                const logoURL = carrierData.logoURL;

                console.log('EnhancedRateCard - Fetched carrier logo from database:', { carrierName, carrierID, logoURL });
                return logoURL || '/images/carrier-badges/solushipx.png';
            } else {
                console.log('EnhancedRateCard - Carrier not found in database:', { carrierName, carrierID });
                return '/images/carrier-badges/solushipx.png';
            }
        } catch (error) {
            console.error('EnhancedRateCard - Error fetching carrier logo:', error);
            return '/images/carrier-badges/solushipx.png';
        }
    }, []);

    // Load carrier logo when component mounts or rate changes
    useEffect(() => {
        let cancelled = false;

        const loadCarrierLogo = async () => {
            // If carrier name is overridden, use company logo instead
            console.log('🖼️ EnhancedRateCard - Logo Override Check:', {
                isOverridden,
                hasCompanyData: !!companyData,
                companyLogos: companyData?.logos,
                lightLogo: companyData?.logos?.light,
                darkLogo: companyData?.logos?.dark,
                circleLogo: companyData?.logos?.circle,
                legacyLogoUrl: companyData?.logoUrl,
                companyName: companyData?.name
            });

            if (isOverridden && companyData) {
                const companyLogo = getLightBackgroundLogo(companyData);
                console.log('🏢 Using company logo override:', {
                    companyLogo,
                    originalCarrierName: rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName,
                    overriddenName: displayCarrierName
                });
                if (companyLogo) {
                    setCarrierLogoUrl(companyLogo);
                    return;
                }
            }

            // Determine the appropriate carrier name to fetch logo for
            const carrierName = rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName || 'Unknown Carrier';

            // Check for eShip Plus master carrier identification
            const sourceCarrier = rate.sourceCarrier?.key || rate.sourceCarrier?.name;
            const sourceCarrierName = rate.sourceCarrier?.name;
            const sourceCarrierSystem = rate.sourceCarrier?.system;

            // Enhanced eShip Plus detection - check multiple fields for master carrier identification
            const isEshipPlus =
                sourceCarrier === 'ESHIPPLUS' ||
                sourceCarrierName === 'eShip Plus' ||
                sourceCarrierSystem === 'eshipplus' ||
                rate.displayCarrierId === 'ESHIPPLUS' ||
                rate.sourceCarrierName === 'eShipPlus' ||
                // Check for freight carrier patterns that indicate eShip Plus sub-carriers
                carrierName.toLowerCase().includes('freight') ||
                carrierName.toLowerCase().includes('ltl') ||
                carrierName.toLowerCase().includes('fedex freight') ||
                carrierName.toLowerCase().includes('road runner') ||
                carrierName.toLowerCase().includes('roadrunner') ||
                carrierName.toLowerCase().includes('estes') ||
                carrierName.toLowerCase().includes('yrc') ||
                carrierName.toLowerCase().includes('xpo') ||
                carrierName.toLowerCase().includes('old dominion') ||
                carrierName.toLowerCase().includes('odfl') ||
                carrierName.toLowerCase().includes('saia') ||
                carrierName.toLowerCase().includes('ward');

            // For eShip Plus sub-carriers, fetch eShip Plus logo
            const logoCarrierName = isEshipPlus ? 'eShip Plus' : carrierName;
            const logoUrl = await fetchCarrierLogo(logoCarrierName);
            // Avoid overwriting company override or running after unmount
            if (cancelled || isOverriddenRef.current) {
                return;
            }
            setCarrierLogoUrl(logoUrl);
        };

        loadCarrierLogo();
        return () => {
            cancelled = true;
        };
    }, [rate, fetchCarrierLogo, isOverridden, companyData]);

    const formatPrice = (price) => {
        const currency = rate.pricing?.currency || 'USD';
        const formattedPrice = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(price || 0);

        // Add currency prefix for better clarity
        const currencyPrefixes = {
            'USD': 'US$',
            'CAD': 'CA$',
            'EUR': 'EUR€',
            'GBP': '£',
            'AUD': 'AU$',
            'NZD': 'NZ$',
            'JPY': '¥',
            'CHF': 'CHF',
            'SEK': 'SEK',
            'NOK': 'NOK',
            'DKK': 'DKK'
        };

        const prefix = currencyPrefixes[currency];
        if (prefix) {
            // Remove the default currency symbol and replace with our prefix
            const numericPart = formattedPrice.replace(/[^\d.,]/g, '');
            return `${prefix}${numericPart}`;
        }

        return formattedPrice;
    };

    const getServiceTypeColor = (serviceName) => {
        const service = serviceName?.toLowerCase() || '';
        if (service.includes('express') || service.includes('priority')) return 'error';
        if (service.includes('economy') || service.includes('standard')) return 'info';
        if (service.includes('overnight') || service.includes('next day')) return 'warning';
        return 'default';
    };

    // Use displayCarrierName which includes override logic, fallback to original if not set
    const carrierName = displayCarrierName || rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName || 'Unknown Carrier';
    const serviceName = rate.service?.name || (typeof rate.service === 'string' ? rate.service : 'Standard');
    const totalPrice = rate.pricing?.total || rate.totalCharges || rate.price || 0;
    const transitDays = rate.transit?.days !== undefined ? rate.transit.days : 'N/A';
    const estimatedDelivery = rate.transit?.estimatedDelivery || 'N/A';
    const isGuaranteed = rate.transit?.guaranteed || rate.guaranteed;
    const guaranteeCharge = rate.pricing?.guarantee || rate.guaranteeCharge || 0;

    // Create markup tooltip content for admins
    const renderMarkupTooltip = () => {
        if (!isAdmin || !costChargeInfo?.hasMarkup) return null;

        // Analyze which specific charges were affected by markups
        const getAffectedCharges = () => {
            const affectedCharges = [];

            // Check billingDetails for charges with markup applied
            const billingDetails = rate.billingDetails || rate.pricing?.billingDetails || [];
            billingDetails.forEach(detail => {
                if (detail.hasMarkup && detail.markupAmount > 0) {
                    affectedCharges.push({
                        name: detail.name,
                        originalAmount: Number(detail.actualAmount) || 0,
                        markedUpAmount: Number(detail.amount) || 0,
                        markupAmount: Number(detail.markupAmount) || 0,
                        markupPercentage: Number(detail.markupPercentage) || 0
                    });
                }
            });

            // If no specific charges found, check if markup was applied to total
            if (affectedCharges.length === 0 && costChargeInfo.hasMarkup) {
                affectedCharges.push({
                    name: 'Total Rate',
                    originalAmount: Number(costChargeInfo.cost) || 0,
                    markedUpAmount: Number(rate.pricing?.total || rate.totalCharges) || 0,
                    markupAmount: Number(costChargeInfo.markupAmount) || 0,
                    markupPercentage: Number(costChargeInfo.markupPercentage) || 0
                });
            }

            return affectedCharges;
        };

        const affectedCharges = getAffectedCharges();

        return (
            <Box sx={{ p: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                    Applied Markups:
                </Typography>

                {/* Markup Rules Applied */}
                {costChargeInfo.appliedMarkups.map((markup, index) => {
                    // Enhanced markup data extraction with proper type handling
                    const markupType = markup.type || markup.markupType || 'Markup';
                    const markupValue = markup.value || markup.amount || markup.markupAmount || 0;
                    const markupRule = markup.rule || markup.description || markup.conditions;

                    // Format value based on markup type
                    let formattedValue;
                    if (markupType === 'PERCENTAGE') {
                        formattedValue = `${markupValue}%`;
                    } else if (markupType === 'FIXED_AMOUNT') {
                        formattedValue = `$${markupValue.toFixed(2)}`;
                    } else if (markupType === 'PER_POUND') {
                        formattedValue = `$${markupValue.toFixed(2)}/lb`;
                    } else if (markupType === 'PER_PACKAGE') {
                        formattedValue = `$${markupValue.toFixed(2)}/pkg`;
                    } else {
                        formattedValue = markupValue ? `$${markupValue.toFixed(2)}` : 'N/A';
                    }

                    // Convert type to display label
                    const displayType = markupType === 'PERCENTAGE' ? 'Percentage Markup' :
                        markupType === 'FIXED_AMOUNT' ? 'Fixed Amount' :
                            markupType === 'PER_POUND' ? 'Per Pound' :
                                markupType === 'PER_PACKAGE' ? 'Per Package' :
                                    'Carrier Markup';

                    return (
                        <Box key={index} sx={{ mb: 0.5 }}>
                            <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
                                • {displayType}: {formattedValue}
                            </Typography>
                            {markupRule && (
                                <Typography variant="caption" sx={{ fontSize: '9px', color: 'text.secondary', pl: 1, display: 'block' }}>
                                    Rule: {markupRule}
                                </Typography>
                            )}
                        </Box>
                    );
                })}

                {/* Show which specific charges were affected */}
                {affectedCharges.length > 0 && (
                    <>
                        <Divider sx={{ my: 0.5 }} />
                        <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 600, display: 'block', mb: 0.5 }}>
                            Applied To:
                        </Typography>
                        {affectedCharges.map((charge, index) => (
                            <Box key={index} sx={{ mb: 0.5, pl: 1 }}>
                                <Typography variant="caption" sx={{ fontSize: '9px', display: 'block' }}>
                                    • {charge.name}: ${charge.originalAmount.toFixed(2)} → ${charge.markedUpAmount.toFixed(2)}
                                </Typography>
                                <Typography variant="caption" sx={{ fontSize: '8px', color: 'text.secondary', pl: 1, display: 'block' }}>
                                    +${(charge.markupAmount || 0).toFixed(2)} ({(Number(charge.markupPercentage) || 0).toFixed(1)}% markup)
                                </Typography>
                            </Box>
                        ))}
                    </>
                )}

                <Divider sx={{ my: 0.5 }} />
                <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 600 }}>
                    Total Markup: +{formatPrice(costChargeInfo.markupAmount || 0)}
                </Typography>
            </Box>
        );
    };

    return (
        <Card
            elevation={isSelected ? 8 : 2}
            sx={{
                borderRadius: 3,
                border: isSelected ? '3px solid #10B981' : '1px solid #e2e8f0',
                transition: 'all 0.3s ease',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                background: isSelected
                    ? 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                position: 'relative',
                overflow: 'visible'
            }}
        >
            {/* Selected Badge */}
            {isSelected && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: -8,
                        right: 16,
                        bgcolor: '#10B981',
                        color: 'white',
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        zIndex: 1
                    }}
                >
                    <CheckCircleIcon sx={{ fontSize: '14px' }} />
                    SELECTED
                </Box>
            )}



            <CardContent sx={{ p: 3 }}>
                {/* Header Section */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                        component="img"
                        key={carrierLogoUrl || 'default-logo'}
                        src={carrierLogoUrl || '/images/carrier-badges/solushipx.png'}
                        alt={carrierName}
                        sx={{
                            width: 80,
                            height: 40,
                            objectFit: 'contain',
                            mr: 2,
                            borderRadius: 1,
                            bgcolor: 'white',
                            p: 0.5
                        }}
                    />
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
                            {carrierName}
                        </Typography>
                        <Chip
                            label={serviceName}
                            color={getServiceTypeColor(serviceName)}
                            size="small"
                            sx={{ fontSize: '10px', fontWeight: 600 }}
                        />
                    </Box>
                </Box>

                {/* Main Info Grid */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {/* Transit Time */}
                    <Grid item xs={canViewPricing ? 6 : 12}>
                        <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                <AccessTimeIcon sx={{ color: 'primary.main', mr: 0.5, fontSize: '1.2rem' }} />
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '1.6rem', color: 'primary.main' }}>
                                    {transitDays}
                                </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '10px', color: 'primary.dark' }}>
                                BUSINESS DAYS
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Price (hidden entirely when pricing is not allowed) */}
                    {canViewPricing && (
                        <Grid item xs={6}>
                            <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'rgba(16, 185, 129, 0.1)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1, flexDirection: 'column' }}>
                                    <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '1.5rem', color: '#1f2937' }}>
                                        {formatPrice(totalPrice)}
                                    </Typography>
                                    {/* Admin Cost Display */}
                                    {isAdmin && costChargeInfo && (
                                        <Typography variant="caption" sx={{ fontSize: '10px', color: '#059669', fontWeight: 600, mt: 0.5 }}>
                                            {formatPrice(costChargeInfo.cost)}
                                        </Typography>
                                    )}
                                </Box>
                                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '10px', color: 'success.dark' }}>
                                    TOTAL COST
                                </Typography>
                            </Box>
                        </Grid>
                    )}
                </Grid>

                {/* Delivery Date */}
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px' }}>
                        <LocalShippingIcon sx={{ fontSize: '14px', mr: 0.5, verticalAlign: 'middle' }} />
                        Estimated delivery: <strong>{estimatedDelivery}</strong>
                    </Typography>
                </Box>

                {/* Guarantee Option */}
                {isGuaranteed && guaranteeCharge > 0 && (
                    <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <SecurityIcon sx={{ color: 'warning.main', mr: 1, fontSize: '1.1rem' }} />
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px' }}>
                                    Delivery Guarantee
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark', fontSize: '12px' }}>
                                +{formatPrice(guaranteeCharge)}
                            </Typography>
                        </Box>
                        {onGuaranteeChange && (
                            <Box sx={{ mt: 1 }}>
                                <Button
                                    size="small"
                                    variant={isSelected && rate.guaranteed ? 'contained' : 'outlined'}
                                    color="warning"
                                    onClick={() => onGuaranteeChange(rate, !rate.guaranteed)}
                                    sx={{ fontSize: '10px', py: 0.5 }}
                                >
                                    {rate.guaranteed ? 'Remove Guarantee' : 'Add Guarantee'}
                                </Button>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Rate Details Collapse - only show if user has breakdown permission */}
                {canViewBreakdown && (
                    <Box>
                        <Button
                            onClick={() => setExpanded(!expanded)}
                            endIcon={
                                <ExpandMoreIcon
                                    sx={{
                                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.3s'
                                    }}
                                />
                            }
                            variant="text"
                            size="small"
                            sx={{ mb: 1, fontSize: '11px', fontWeight: 600 }}
                        >
                            {expanded ? 'Hide Details' : 'Show Details'}
                        </Button>
                    </Box>
                )}

                {canViewBreakdown && (
                    <Collapse in={expanded} timeout={300}>
                        {expanded && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e5e7eb' }}>
                                <Divider sx={{ mb: 2 }} />

                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" sx={{ fontSize: '10px', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 500 }}>
                                            Source System
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                            {(() => {
                                                // Smart source system detection
                                                if (rate.sourceSystem) {
                                                    return rate.sourceSystem;
                                                }

                                                // Check if this is a direct carrier (not through eShip Plus)
                                                const carrierName = rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName;
                                                const sourceCarrierKey = rate.sourceCarrier?.key || rate.sourceCarrier?.name;
                                                const sourceCarrierSystem = rate.sourceCarrier?.system;

                                                // If it's explicitly from eShip Plus
                                                if (sourceCarrierKey === 'ESHIPPLUS' ||
                                                    sourceCarrierSystem === 'eshipplus' ||
                                                    rate.sourceCarrierName === 'eShip Plus') {
                                                    return 'EShip Plus';
                                                }

                                                // For direct carriers, show the carrier name
                                                if (carrierName && carrierName !== 'Unknown Carrier') {
                                                    return carrierName;
                                                }

                                                // Fallback
                                                return 'Direct Carrier';
                                            })()}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" sx={{ fontSize: '10px', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 500 }}>
                                            Service Mode
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                            {rate.service?.name || rate.displayCarrier?.name || 'Standard'}
                                        </Typography>
                                    </Grid>
                                </Grid>

                                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Cost Breakdown
                                    </Typography>
                                    {isAdmin && (
                                        <Tooltip
                                            title={costChargeInfo?.hasMarkup ? renderMarkupTooltip() : (
                                                <Box sx={{ p: 1 }}>
                                                    <Typography variant="caption" sx={{ fontSize: '10px', fontWeight: 600 }}>
                                                        No markups applied to these quotes
                                                    </Typography>
                                                </Box>
                                            )}
                                            arrow
                                            placement="top"
                                        >
                                            <IconButton
                                                size="small"
                                                sx={{
                                                    ml: 1,
                                                    width: 16,
                                                    height: 16,
                                                    bgcolor: costChargeInfo?.hasMarkup ? 'rgba(99, 102, 241, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                                                    color: costChargeInfo?.hasMarkup ? '#6366f1' : '#9ca3af',
                                                    '&:hover': {
                                                        bgcolor: costChargeInfo?.hasMarkup ? 'rgba(99, 102, 241, 0.2)' : 'rgba(156, 163, 175, 0.2)',
                                                    }
                                                }}
                                            >
                                                <InfoIcon sx={{ fontSize: '12px' }} />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Box>

                                {(() => {
                                    // Check for billingDetails in both locations (top-level and pricing)
                                    const billingDetails = rate.billingDetails || rate.pricing?.billingDetails;

                                    if (billingDetails && billingDetails.length > 0) {
                                        // Detailed billing breakdown (includes markup if applied)
                                        return billingDetails.map((detail, index) => (
                                            <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                    {detail.name || 'Charge'}
                                                </Typography>
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                        {formatPrice(detail.amount)}
                                                    </Typography>
                                                    {isAdmin && (
                                                        <Typography variant="caption" sx={{ fontSize: '9px', color: '#059669', fontWeight: 500, display: 'block' }}>
                                                            {formatPrice(detail.actualAmount !== undefined ? detail.actualAmount : detail.amount)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        ));
                                    } else {
                                        // Standard breakdown - use marked-up amounts if available
                                        // Helper function to get charge amount (marked-up if available)
                                        const getChargeAmount = (chargeName, fallbackAmount) => {
                                            // Check if we have billing details with markup applied
                                            const billingDetailsToCheck = rate.billingDetails || rate.pricing?.billingDetails;
                                            if (billingDetailsToCheck && Array.isArray(billingDetailsToCheck)) {
                                                const detail = billingDetailsToCheck.find(detail => {
                                                    const detailName = (detail.name || '').toLowerCase();
                                                    return detailName.includes(chargeName.toLowerCase());
                                                });
                                                if (detail && detail.amount !== undefined) {
                                                    return {
                                                        amount: detail.amount,
                                                        hasMarkup: detail.hasMarkup,
                                                        markupPercentage: detail.markupPercentage
                                                    };
                                                }
                                            }
                                            // Fallback to raw pricing
                                            return {
                                                amount: fallbackAmount,
                                                hasMarkup: false,
                                                markupPercentage: null
                                            };
                                        };

                                        // Enhanced fallback logic for different carriers and rate structures
                                        const getStandardCharges = () => {
                                            const pricing = rate.pricing || {};

                                            // Enhanced freight charge detection
                                            const freightAmount = pricing.baseRate || pricing.freight || pricing.freightCharges ||
                                                rate.freightCharges || pricing.base || pricing.linehaul || 0;

                                            // Enhanced fuel charge detection
                                            const fuelAmount = pricing.fuelSurcharge || pricing.fuel || pricing.fuelCharges ||
                                                rate.fuelCharges || pricing.surcharge || 0;

                                            // Enhanced service charge detection
                                            const serviceAmount = pricing.serviceCharges || pricing.service || pricing.accessorial ||
                                                rate.serviceCharges || pricing.handling || 0;

                                            // Enhanced tax detection
                                            const taxAmount = pricing.taxes?.total || pricing.tax || pricing.taxCharges ||
                                                rate.taxCharges || pricing.gst || pricing.hst || 0;

                                            return { freightAmount, fuelAmount, serviceAmount, taxAmount };
                                        };

                                        const { freightAmount, fuelAmount, serviceAmount, taxAmount } = getStandardCharges();

                                        const freightCharge = getChargeAmount('freight', freightAmount);
                                        const fuelCharge = getChargeAmount('fuel', fuelAmount);
                                        const serviceCharge = getChargeAmount('service', serviceAmount);
                                        const taxCharge = getChargeAmount('tax', taxAmount);

                                        // Helper to render cost vs charge for individual line items
                                        const renderChargeWithCost = (charge, chargeName) => {
                                            // Calculate cost based on markup metadata if available
                                            let costAmount = charge.amount;

                                            if (costChargeInfo?.hasMarkup && costChargeInfo.appliedMarkups?.length > 0) {
                                                // Find markup that applies to this charge type
                                                const applicableMarkup = costChargeInfo.appliedMarkups.find(markup =>
                                                    markup.type?.toLowerCase().includes(chargeName?.toLowerCase()) ||
                                                    markup.rule?.toLowerCase().includes(chargeName?.toLowerCase())
                                                );

                                                if (applicableMarkup) {
                                                    if (applicableMarkup.percentage) {
                                                        costAmount = charge.amount / (1 + (applicableMarkup.percentage / 100));
                                                    } else if (applicableMarkup.amount) {
                                                        costAmount = charge.amount - applicableMarkup.amount;
                                                    }
                                                } else if (costChargeInfo.markupPercentage > 0) {
                                                    // Apply overall markup percentage if no specific markup found
                                                    costAmount = charge.amount / (1 + (costChargeInfo.markupPercentage / 100));
                                                }
                                            }

                                            return (
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                        {formatPrice(charge.amount)}
                                                    </Typography>
                                                    {isAdmin && (
                                                        <Typography variant="caption" sx={{ fontSize: '9px', color: '#059669', fontWeight: 500, display: 'block' }}>
                                                            {formatPrice(costAmount)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            );
                                        };

                                        return (
                                            <>
                                                {freightCharge.amount > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Freight Charges
                                                        </Typography>
                                                        {renderChargeWithCost(freightCharge, 'freight')}
                                                    </Box>
                                                )}
                                                {fuelCharge.amount > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Fuel Surcharge
                                                        </Typography>
                                                        {renderChargeWithCost(fuelCharge, 'fuel')}
                                                    </Box>
                                                )}
                                                {serviceCharge.amount > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Service Charges
                                                        </Typography>
                                                        {renderChargeWithCost(serviceCharge, 'service')}
                                                    </Box>
                                                )}
                                                {taxCharge.amount > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Taxes
                                                        </Typography>
                                                        {renderChargeWithCost(taxCharge, 'tax')}
                                                    </Box>
                                                )}
                                                {/* Fallback: If no individual charges found, show at least the total */}
                                                {freightCharge.amount === 0 && fuelCharge.amount === 0 && serviceCharge.amount === 0 && taxCharge.amount === 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Total Rate
                                                        </Typography>
                                                        <Box sx={{ textAlign: 'right' }}>
                                                            <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                {formatPrice(totalPrice)}
                                                            </Typography>
                                                            {isAdmin && costChargeInfo && (
                                                                <Typography variant="caption" sx={{ fontSize: '9px', color: '#059669', fontWeight: 500, display: 'block' }}>
                                                                    {formatPrice(costChargeInfo.cost)}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                )}
                                            </>
                                        );
                                    }
                                })()}

                                <Divider sx={{ my: 1 }} />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 700 }}>
                                        Total
                                    </Typography>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 700, color: '#1f2937' }}>
                                            {formatPrice(totalPrice)}
                                        </Typography>
                                        {isAdmin && costChargeInfo && (
                                            <Typography variant="caption" sx={{ fontSize: '10px', color: '#059669', fontWeight: 600, display: 'block' }}>
                                                {formatPrice(costChargeInfo.cost)}
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        )}
                    </Collapse>
                )}

                {/* Select Button */}
                <Button
                    variant={isSelected ? 'contained' : 'outlined'}
                    color={isSelected ? 'success' : 'primary'}
                    onClick={() => onSelect(rate)}
                    fullWidth
                    sx={{
                        mt: 2,
                        py: 1.5,
                        borderRadius: 2,
                        fontWeight: 700,
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}
                    startIcon={isSelected ? <CheckCircleIcon /> : null}
                >
                    {isSelected ? 'Selected' : 'SELECT'}
                </Button>
            </CardContent>
        </Card>
    );
};

export default EnhancedRateCard; 