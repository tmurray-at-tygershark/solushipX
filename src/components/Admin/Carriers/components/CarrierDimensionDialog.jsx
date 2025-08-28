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
import CarrierDimensionForm from './CarrierDimensionForm';

const CarrierDimensionDialog = ({ open, onClose, carrier }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(false);
    const [rules, setRules] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedRule, setSelectedRule] = useState(null);

    // Cloud functions
    const getCarrierDimensionRules = httpsCallable(functions, 'getCarrierDimensionRules');
    const deleteCarrierDimensionRule = httpsCallable(functions, 'deleteCarrierDimensionRule');

    // Load dimension rules when dialog opens
    useEffect(() => {
        if (open && carrier?.id) {
            loadDimensionRules();
        }
    }, [open, carrier?.id]);

    const loadDimensionRules = async () => {
        try {
            setLoading(true);
            const response = await getCarrierDimensionRules({ carrierId: carrier.id });
            if (response.data.success) {
                setRules(response.data.rules || []);
            } else {
                throw new Error(response.data.error || 'Failed to load dimension rules');
            }
        } catch (error) {
            console.error('Error loading dimension rules:', error);
            enqueueSnackbar('Failed to load dimension rules', 'error');
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
            const response = await deleteCarrierDimensionRule({
                carrierId: carrier.id,
                ruleId: rule.id
            });
            if (response.data.success) {
                await loadDimensionRules();
                enqueueSnackbar('Dimension rule deleted successfully', 'success');
            } else {
                throw new Error(response.data.error || 'Failed to delete dimension rule');
            }
        } catch (error) {
            console.error('Error deleting dimension rule:', error);
            enqueueSnackbar('Failed to delete dimension rule', 'error');
        }
        setActionMenuAnchor(null);
    };

    const handleFormSuccess = async () => {
        setShowForm(false);
        setEditingRule(null);
        await loadDimensionRules();
        enqueueSnackbar(
            editingRule ? 'Dimension rule updated successfully' : 'Dimension rule created successfully',
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

    const formatDimensions = (rule) => {
        const unit = rule.dimensionUnit || 'in';
        const parts = [];

        if (rule.maxLength) parts.push(`L: ${rule.maxLength}${unit}`);
        if (rule.maxWidth) parts.push(`W: ${rule.maxWidth}${unit}`);
        if (rule.maxHeight) parts.push(`H: ${rule.maxHeight}${unit}`);

        return parts.length > 0 ? parts.join(', ') : 'No limits';
    };

    const getRestrictionTypeLabel = (type) => {
        const types = {
            max_individual: 'Max Individual Package',
            max_total: 'Max Total Shipment',
            truck_space: 'Truck Space Limitation'
        };
        return types[type] || type;
    };

    const getRestrictionTypeColor = (type) => {
        const colors = {
            max_individual: 'primary',
            max_total: 'secondary',
            truck_space: 'warning'
        };
        return colors[type] || 'default';
    };

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="lg"
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
                            Dimension Eligibility Rules - {carrier?.name}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                            Configure maximum dimension restrictions due to vehicle constraints
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
                            <Typography sx={{ ml: 2, fontSize: '12px' }}>Loading dimension rules...</Typography>
                        </Box>
                    ) : rules.length === 0 ? (
                        <Box textAlign="center" py={4}>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                No dimension eligibility rules configured for this carrier
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={handleAddRule}
                                sx={{ fontSize: '12px' }}
                            >
                                Add First Dimension Rule
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
                                            Maximum Dimensions
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
                                                {formatDimensions(rule)}
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
                        Add Dimension Rule
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

            {/* Dimension Rule Form Dialog */}
            <CarrierDimensionForm
                open={showForm}
                onClose={() => setShowForm(false)}
                onSuccess={handleFormSuccess}
                carrier={carrier}
                editingRule={editingRule}
            />
        </>
    );
};

export default CarrierDimensionDialog;