import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Chip,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton
} from '@mui/material';
import {
    Close as CloseIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import dynamicChargeTypeService from '../../../services/dynamicChargeTypeService';

/**
 * ChargeTypeDetailDialog Component
 * Shows detailed breakdown of charge types for a specific shipment
 */
const ChargeTypeDetailDialog = ({
    open,
    onClose,
    shipment,
    charges = []
}) => {
    const [classifiedCharges, setClassifiedCharges] = React.useState([]);
    const [categoryStats, setCategoryStats] = React.useState({});
    const [loading, setLoading] = React.useState(false);

    // Load charge types when dialog opens or charges change
    React.useEffect(() => {
        const loadChargeTypes = async () => {
            if (!shipment || !open) return;

            const chargeBreakdown = charges.length > 0 ? charges :
                (shipment.chargesBreakdown || shipment.actualCharges || []);

            if (!chargeBreakdown || chargeBreakdown.length === 0) {
                setClassifiedCharges([]);
                setCategoryStats({});
                return;
            }

            setLoading(true);
            try {
                const chargeCodes = chargeBreakdown.map(c => c.code || c.chargeCode).filter(Boolean);
                const classification = await dynamicChargeTypeService.classifyCharges(chargeCodes);

                setClassifiedCharges(classification.chargeTypes || []);

                // Calculate category stats
                const stats = {};
                classification.chargeTypes.forEach(ct => {
                    if (!stats[ct.category]) {
                        stats[ct.category] = { count: 0, charges: [] };
                    }
                    stats[ct.category].count++;
                    stats[ct.category].charges.push(ct);
                });
                setCategoryStats(stats);

            } catch (error) {
                console.error('Error loading charge types:', error);
                setClassifiedCharges([]);
                setCategoryStats({});
            } finally {
                setLoading(false);
            }
        };

        loadChargeTypes();
    }, [shipment, charges, open]);

    if (!shipment || !open) return null;

    const formatCurrency = (amount, currency = 'CAD') => {
        const num = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-CA', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb'
                }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pb: 1,
                borderBottom: '1px solid #e5e7eb'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon sx={{ color: '#6366f1', fontSize: '20px' }} />
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                        Charge Type Breakdown
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    size="small"
                    sx={{ color: '#6b7280' }}
                >
                    <CloseIcon sx={{ fontSize: '18px' }} />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Loading charge type information...
                        </Typography>
                    </Box>
                ) : (
                    <>
                        {/* Shipment Info Header */}
                        <Box sx={{ mb: 3, p: 2, backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                Shipment: {shipment.shipmentID}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Carrier: {shipment.carrierName || 'N/A'}
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Total Charges: {classifiedCharges.length}
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Categories: {Object.keys(categoryStats).length}
                                </Typography>
                            </Box>
                        </Box>

                        {classifiedCharges.length === 0 ? (
                            <Box sx={{
                                textAlign: 'center',
                                py: 4,
                                color: '#6b7280'
                            }}>
                                <Typography sx={{ fontSize: '14px', fontStyle: 'italic' }}>
                                    No charge breakdown available for this shipment
                                </Typography>
                            </Box>
                        ) : (
                            <>
                                {/* Category Summary */}
                                <Box sx={{ mb: 3 }}>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                        Categories Summary
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                        {Object.entries(categoryStats).map(([categoryLabel, stats]) => {
                                            // Get category info using dynamic service with fallback
                                            const categoryInfo = dynamicChargeTypeService.getCategoryInfo(categoryLabel) || {
                                                label: categoryLabel,
                                                color: '#6b7280',
                                                icon: '📦'
                                            };

                                            return (
                                                <Chip
                                                    key={categoryLabel}
                                                    size="small"
                                                    label={`${categoryInfo.icon} ${categoryLabel} (${stats.count})`}
                                                    sx={{
                                                        fontSize: '11px',
                                                        backgroundColor: categoryInfo.color + '20',
                                                        color: categoryInfo.color,
                                                        border: `1px solid ${categoryInfo.color}40`,
                                                        '& .MuiChip-label': {
                                                            px: 1
                                                        }
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                </Box>

                                <Divider sx={{ my: 2 }} />

                                {/* Detailed Charge Breakdown */}
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                    Detailed Breakdown
                                </Typography>

                                <TableContainer
                                    component={Paper}
                                    elevation={0}
                                    sx={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px',
                                        maxHeight: '400px',
                                        overflow: 'auto'
                                    }}
                                >
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    backgroundColor: '#f8fafc',
                                                    color: '#374151'
                                                }}>
                                                    Code
                                                </TableCell>
                                                <TableCell sx={{
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    backgroundColor: '#f8fafc',
                                                    color: '#374151'
                                                }}>
                                                    Type
                                                </TableCell>
                                                <TableCell sx={{
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    backgroundColor: '#f8fafc',
                                                    color: '#374151'
                                                }}>
                                                    Category
                                                </TableCell>
                                                <TableCell sx={{
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    backgroundColor: '#f8fafc',
                                                    color: '#374151',
                                                    textAlign: 'right'
                                                }}>
                                                    Amount
                                                </TableCell>
                                                <TableCell sx={{
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    backgroundColor: '#f8fafc',
                                                    color: '#374151'
                                                }}>
                                                    Description
                                                </TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {classifiedCharges
                                                .sort((a, b) => a.chargeType.displayOrder - b.chargeType.displayOrder)
                                                .map((charge, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            <Typography sx={{
                                                                fontSize: '11px',
                                                                fontFamily: 'monospace',
                                                                backgroundColor: '#f3f4f6',
                                                                px: 0.5,
                                                                py: 0.25,
                                                                borderRadius: '4px',
                                                                display: 'inline-block'
                                                            }}>
                                                                {charge.chargeType.code}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            {charge.chargeType.label}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px' }}>
                                                            <Chip
                                                                size="small"
                                                                label={`${charge.categoryInfo.icon} ${charge.categoryInfo.label}`}
                                                                sx={{
                                                                    fontSize: '10px',
                                                                    height: '20px',
                                                                    backgroundColor: charge.categoryInfo.color + '15',
                                                                    color: charge.categoryInfo.color,
                                                                    border: `1px solid ${charge.categoryInfo.color}30`
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '12px', textAlign: 'right' }}>
                                                            {charge.amount ? formatCurrency(charge.amount, charge.currency) : 'N/A'}
                                                        </TableCell>
                                                        <TableCell sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {charge.chargeType.description}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </>
                        )}
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e5e7eb' }}>
                <Button
                    onClick={onClose}
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ChargeTypeDetailDialog; 