import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Divider,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel
} from '@mui/material';
import EnhancedStatusChip from './EnhancedStatusChip';
import dynamicStatusService from '../../services/DynamicStatusService';

/**
 * Demo component to showcase the new dynamic status system
 * Shows different display modes and styling options
 */
const StatusDisplayDemo = () => {
    const [masterStatuses, setMasterStatuses] = useState([]);
    const [shipmentStatuses, setShipmentStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSize, setSelectedSize] = useState('small');
    const [selectedVariant, setSelectedVariant] = useState('filled');
    const [showTooltips, setShowTooltips] = useState(true);
    const [compactMode, setCompactMode] = useState(false);

    useEffect(() => {
        const loadStatuses = async () => {
            try {
                await dynamicStatusService.initialize();
                setMasterStatuses(dynamicStatusService.getMasterStatuses());
                setShipmentStatuses(dynamicStatusService.getShipmentStatuses());
            } catch (error) {
                console.error('Error loading statuses:', error);
            } finally {
                setLoading(false);
            }
        };

        loadStatuses();
    }, []);

    if (loading) {
        return <Typography>Loading status demo...</Typography>;
    }

    // Example status scenarios
    const statusExamples = [
        {
            title: 'Master Status Only',
            description: 'Shows only the master status when shipment status is generic',
            examples: [
                { status: 'delivered', label: 'Delivered (Master Only)' },
                { status: 'pending', label: 'Pending (Master Only)' },
                { status: 'cancelled', label: 'Cancelled (Master Only)' }
            ]
        },
        {
            title: 'Master + Sub-Status',
            description: 'Shows both master and detailed sub-status',
            examples: [
                { status: 'in customs', label: 'In Transit → In Customs' },
                { status: 'out for delivery', label: 'In Transit → Out for Delivery' },
                { status: 'attempted delivery', label: 'Exception → Attempted Delivery' },
                { status: 'weather delay', label: 'Exception → Weather Delay' }
            ]
        }
    ];

    // Get status examples by finding actual shipment statuses
    const getStatusExamples = () => {
        const examples = [];

        // Add some master-only examples (legacy statuses)
        examples.push({ status: 'delivered', label: 'Delivered (Legacy)', type: 'master' });
        examples.push({ status: 'pending', label: 'Pending (Legacy)', type: 'master' });

        // Add some master+sub examples from database
        const sampleStatuses = [
            'In customs',
            'Out for delivery',
            'Attempted delivery',
            'Weather delay',
            'Picked up',
            'At terminal',
            'Booking confirmed',
            'Ready for shipping'
        ];

        sampleStatuses.forEach(statusLabel => {
            const status = shipmentStatuses.find(s =>
                s.statusLabel.toLowerCase().includes(statusLabel.toLowerCase())
            );
            if (status) {
                examples.push({
                    status: status.statusLabel,
                    label: statusLabel,
                    type: 'both'
                });
            }
        });

        return examples;
    };

    const statusExamplesList = getStatusExamples();

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Dynamic Status System Demo
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                This demo shows how the new status system displays with database-stored colors and styling.
            </Typography>

            {/* Controls */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Display Controls</Typography>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Size</InputLabel>
                            <Select
                                value={selectedSize}
                                onChange={(e) => setSelectedSize(e.target.value)}
                                label="Size"
                            >
                                <MenuItem value="small">Small</MenuItem>
                                <MenuItem value="medium">Medium</MenuItem>
                                <MenuItem value="large">Large</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Variant</InputLabel>
                            <Select
                                value={selectedVariant}
                                onChange={(e) => setSelectedVariant(e.target.value)}
                                label="Variant"
                            >
                                <MenuItem value="filled">Filled</MenuItem>
                                <MenuItem value="outlined">Outlined</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={showTooltips}
                                    onChange={(e) => setShowTooltips(e.target.checked)}
                                />
                            }
                            label="Show Tooltips"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={compactMode}
                                    onChange={(e) => setCompactMode(e.target.checked)}
                                />
                            }
                            label="Compact Mode"
                        />
                    </Grid>
                </Grid>
            </Paper>

            {/* Master Statuses Overview */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Master Statuses</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    These are the main status categories with database-stored colors:
                </Typography>
                <Grid container spacing={2}>
                    {masterStatuses.map((masterStatus) => (
                        <Grid item xs={12} sm={6} md={4} key={masterStatus.id}>
                            <Box sx={{
                                p: 2,
                                border: '1px solid #e0e0e0',
                                borderRadius: 1,
                                backgroundColor: masterStatus.color + '10'
                            }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <Box sx={{
                                        width: 16,
                                        height: 16,
                                        borderRadius: '50%',
                                        backgroundColor: masterStatus.color
                                    }} />
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                        {masterStatus.displayLabel}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    {masterStatus.description}
                                </Typography>
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280',
                                    fontFamily: 'monospace'
                                }}>
                                    Color: {masterStatus.color} | Font: {masterStatus.fontColor}
                                </Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Paper>

            {/* Status Display Examples */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Status Display Examples</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Examples showing different display modes:
                </Typography>

                <Grid container spacing={3}>
                    {/* Master Only Examples */}
                    <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                Master Status Only
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Used for primary statuses or legacy compatibility
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box>
                                    <EnhancedStatusChip
                                        status="delivered"
                                        size={selectedSize}
                                        variant={selectedVariant}
                                        showTooltip={showTooltips}
                                        compact={compactMode}
                                        displayMode="master"
                                    />
                                    <Typography variant="caption" sx={{ ml: 1, color: '#6b7280' }}>
                                        Delivered (Legacy)
                                    </Typography>
                                </Box>
                                <Box>
                                    <EnhancedStatusChip
                                        status="pending"
                                        size={selectedSize}
                                        variant={selectedVariant}
                                        showTooltip={showTooltips}
                                        compact={compactMode}
                                        displayMode="master"
                                    />
                                    <Typography variant="caption" sx={{ ml: 1, color: '#6b7280' }}>
                                        Pending (Legacy)
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Master + Sub Examples */}
                    <Grid item xs={12} md={6}>
                        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                            <Typography variant="subtitle1" gutterBottom>
                                Master + Sub-Status
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Used for detailed tracking with specific sub-statuses
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {statusExamplesList.filter(ex => ex.type === 'both').slice(0, 4).map((example, index) => (
                                    <Box key={index}>
                                        <EnhancedStatusChip
                                            status={example.status}
                                            size={selectedSize}
                                            variant={selectedVariant}
                                            showTooltip={showTooltips}
                                            compact={compactMode}
                                            displayMode="both"
                                        />
                                        <Typography variant="caption" sx={{ ml: 1, color: '#6b7280' }}>
                                            {example.label}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            {/* Table View Example */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Table View Example</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    How statuses appear in shipment tables:
                </Typography>
                <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: 2,
                    p: 2,
                    backgroundColor: '#f8fafc',
                    borderRadius: 1
                }}>
                    {statusExamplesList.slice(0, 6).map((example, index) => (
                        <Box key={index} sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1,
                            backgroundColor: 'white',
                            borderRadius: 1,
                            border: '1px solid #e0e0e0'
                        }}>
                            <EnhancedStatusChip
                                status={example.status}
                                size="small"
                                variant="filled"
                                showTooltip={true}
                                compact={true}
                                displayMode="auto"
                            />
                        </Box>
                    ))}
                </Box>
            </Paper>

            {/* Implementation Notes */}
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Implementation Notes</Typography>
                <Box component="ul" sx={{ pl: 2, '& li': { mb: 1 } }}>
                    <li>
                        <Typography variant="body2">
                            <strong>Database-Driven:</strong> All colors and styling come from the masterStatuses collection
                        </Typography>
                    </li>
                    <li>
                        <Typography variant="body2">
                            <strong>Automatic Display Mode:</strong> System determines whether to show master only or master+sub
                        </Typography>
                    </li>
                    <li>
                        <Typography variant="body2">
                            <strong>Backward Compatible:</strong> Legacy statuses still work with fallback styling
                        </Typography>
                    </li>
                    <li>
                        <Typography variant="body2">
                            <strong>Responsive:</strong> Compact mode for tables, full mode for detail views
                        </Typography>
                    </li>
                    <li>
                        <Typography variant="body2">
                            <strong>Accessible:</strong> Tooltips provide additional context and descriptions
                        </Typography>
                    </li>
                </Box>
            </Paper>
        </Box>
    );
};

export default StatusDisplayDemo; 