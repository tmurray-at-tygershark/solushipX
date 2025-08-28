import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Alert,
    Chip
} from '@mui/material';
import {
    MoreVert as MoreVertIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';
import CarrierWeightForm from './CarrierWeightForm';

const CarrierWeightDialog = ({ open, onClose, carrier }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [rules, setRules] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedRule, setSelectedRule] = useState(null);

    // Cloud functions
    const getCarrierWeightRules = httpsCallable(functions, 'getCarrierWeightRules');
    const deleteCarrierWeightRule = httpsCallable(functions, 'deleteCarrierWeightRule');

    // Load weight rules when dialog opens
    useEffect(() => {
        if (open && carrier?.id) {
            loadWeightRules();
        }
    }, [open, carrier?.id]);

    const loadWeightRules = async () => {
        try {
            setLoading(true);
            const response = await getCarrierWeightRules({ carrierId: carrier.id });
            if (response.data.success) {
                setRules(response.data.rules || []);
            } else {
                throw new Error(response.data.error || 'Failed to load weight rules');
            }
        } catch (error) {
            console.error('Error loading weight rules:', error);
            enqueueSnackbar('Failed to load weight rules', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRule = () => {
        setEditingRule(null);
        setShowForm(true);
    };

    const handleEditRule = (rule) => {
        setEditingRule(rule);
        setShowForm(true);
        setActionMenuAnchor(null);
    };

    const handleDeleteRule = async (rule) => {
        try {
            const response = await deleteCarrierWeightRule({
                carrierId: carrier.id,
                ruleId: rule.id
            });
            if (response.data.success) {
                await loadWeightRules();
                enqueueSnackbar('Weight rule deleted successfully', 'success');
            } else {
                throw new Error(response.data.error || 'Failed to delete weight rule');
            }
        } catch (error) {
            console.error('Error deleting weight rule:', error);
            enqueueSnackbar('Failed to delete weight rule', 'error');
        }
        setActionMenuAnchor(null);
    };

    const handleFormSuccess = async () => {
        setShowForm(false);
        setEditingRule(null);
        await loadWeightRules();
        enqueueSnackbar(
            editingRule ? 'Weight rule updated successfully' : 'Weight rule created successfully',
            'success'
        );
    };

    const handleActionMenuOpen = (event, rule) => {
        setSelectedRule(rule);
        setActionMenuAnchor(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setActionMenuAnchor(null);
        setSelectedRule(null);
    };

    const formatWeightRange = (rule) => {
        const unit = rule.weightUnit || 'lbs';
        if (rule.minWeight && rule.maxWeight) {
            return `${rule.minWeight} - ${rule.maxWeight} ${unit}`;
        } else if (rule.minWeight) {
            return `${rule.minWeight}+ ${unit}`;
        } else if (rule.maxWeight) {
            return `Up to ${rule.maxWeight} ${unit}`;
        }
        return 'Any weight';
    };

    const getRestrictionTypeLabel = (type) => {
        const types = {
            total_weight: 'Total Weight',
            cubic_weight: 'Cubic Weight',
            weight_per_skid: 'Weight Per Skid'
        };
        return types[type] || type;
    };

    const getRestrictionTypeColor = (type) => {
        const colors = {
            total_weight: 'default',
            cubic_weight: 'secondary',
            weight_per_skid: 'warning'
        };
        return colors[type] || 'default';
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                <DialogTitle
                    sx={{
                        borderBottom: '1px solid #e5e7eb',
                        pb: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <Box>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Weight Eligibility Rules - {carrier?.name}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                            Configure weight-based restrictions for when this carrier should be offered
                        </Typography>
                    </Box>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ flex: 1, overflow: 'auto', pt: 2 }}>
                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" py={4}>
                            <CircularProgress size={24} />
                            <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading weight rules...</Typography>
                        </Box>
                    ) : rules.length === 0 ? (
                        <Box textAlign="center" py={4}>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                No weight eligibility rules configured for this carrier
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={handleAddRule}
                                sx={{ fontSize: '12px' }}
                            >
                                Add First Weight Rule
                            </Button>
                        </Box>
                    ) : (
                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                            Restriction Type
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                            Weight Range
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                            Description
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                            Status
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: 60 }}>
                                            Actions
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rules.map((rule) => (
                                        <TableRow key={rule.id}>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Chip
                                                    label={getRestrictionTypeLabel(rule.restrictionType)}
                                                    size="small"
                                                    color={getRestrictionTypeColor(rule.restrictionType)}
                                                    sx={{ fontSize: '11px' }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {formatWeightRange(rule)}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {rule.description || '-'}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                <Chip
                                                    label={rule.enabled ? 'Active' : 'Inactive'}
                                                    size="small"
                                                    color={rule.enabled ? 'success' : 'default'}
                                                    sx={{ fontSize: '11px' }}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleActionMenuOpen(e, rule)}
                                                >
                                                    <MoreVertIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </DialogContent>

                <DialogActions sx={{ borderTop: '1px solid #e5e7eb', p: 2, gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddRule}
                        sx={{ fontSize: '12px' }}
                    >
                        Add Weight Rule
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        onClick={onClose}
                        sx={{ fontSize: '12px' }}
                    >
                        Done
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleActionMenuClose}
            >
                <MenuItem onClick={() => handleEditRule(selectedRule)}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Edit Rule</Typography>
                    </ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleDeleteRule(selectedRule)}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Delete Rule</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>

            {/* Weight Rule Form Dialog */}
            <CarrierWeightForm
                open={showForm}
                onClose={() => setShowForm(false)}
                onSuccess={handleFormSuccess}
                carrier={carrier}
                editingRule={editingRule}
            />
        </>
    );
};

export default CarrierWeightDialog;