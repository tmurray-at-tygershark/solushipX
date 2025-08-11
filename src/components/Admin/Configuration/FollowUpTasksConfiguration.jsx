import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Paper,
    Alert
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSnackbar } from 'notistack';

const FollowUpTasksConfiguration = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [loading, setLoading] = useState(true);
    const [tasks, setTasks] = useState([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [formData, setFormData] = useState({
        category: '',
        taskName: '',
        description: '',
        enabled: true,
        sortOrder: 0
    });
    const [saving, setSaving] = useState(false);

    const functions = getFunctions();

    // Predefined task categories
    const taskCategories = [
        { value: 'shipper', label: 'With the Shipper' },
        { value: 'carrier', label: 'With the Carrier' },
        { value: 'internal', label: 'With the Internal Team' }
    ];

    // Predefined follow-up tasks by category
    const predefinedTasks = {
        shipper: [
            'Confirm pickup date/time window and dock hours',
            'Verify packaging/palletization, shrink-wrap, banding, corner boards',
            'Confirm piece count, dims, weight, NMFC/class, density',
            'Validate accessorials required (liftgate, residential, inside, limited access)',
            'Ensure BOL accuracy (PO, reference #s, special instructions)',
            'Provide/collect NMFC, hazmat docs (MSDS, emergency contact) if applicable',
            'Share carrier pickup number/PRO once assigned',
            'Verify labeling/barcodes on all handling units',
            'Confirm appointment needed at origin (if required)',
            'Request photos of packed freight (proof of condition)',
            'Get approval for reweigh/reclass or added accessorials',
            'Confirm readiness for pickup and driver instructions (entrance, dock, security)'
        ],
        carrier: [
            'Schedule pickup and obtain confirmation/pickup number',
            'Share complete/clean BOL and shipping instructions',
            'Request PRO/tracking immediately after pickup',
            'Monitor pickup status; escalate missed/late pickups',
            'Validate in-transit scans; follow up at terminals on delays',
            'Set/confirm delivery appointment (consignee hours, contact)',
            'Pre-authorize/accessorials (liftgate, notify, limited access, COD)',
            'Address exceptions (OS&D, reweigh, reclass, address corrections)',
            'Obtain POD (signed BOL, timestamp) and delivery photos if available',
            'Arrange redelivery/hold at terminal/reconsignment as needed',
            'Dispute incorrect charges (reweigh/reclass evidence, photos, weight certs)',
            'Submit and track claims (damage/shortage/concealed), salvage/inspection'
        ],
        internal: [
            'Enter/verify shipment data in TMS (customer refs, GL codes, markup)',
            'Attach docs (BOL, labels, photos, weight ticket, customs if cross-border)',
            'Track milestones; update statuses and ETA changes',
            'Flag exceptions for action; assign follow-ups and set reminders',
            'Communicate customer updates (pickup booked, PRO, delays, delivery appt)',
            'Validate invoices vs quotes; reconcile accessorials; approve or dispute',
            'Post costs/charges; calculate margin; finalize billing',
            'File and manage claims; maintain evidence package and timelines',
            'Coordinate special services (inside delivery, white glove, time-critical)',
            'Manage customs paperwork (CI, packing list, PARS/PAPS) when applicable',
            'Close out shipment (POD received, billing complete, notes logged)',
            'Report KPIs (on-time pickup/delivery, exception rate, claim ratio)'
        ]
    };

    // Load follow-up tasks
    const loadFollowUpTasks = async () => {
        try {
            setLoading(true);
            const getFollowUpTaskTemplates = httpsCallable(functions, 'getFollowUpTaskTemplates');
            const result = await getFollowUpTaskTemplates();

            if (result.data && result.data.tasks) {
                setTasks(result.data.tasks);
            } else {
                setTasks([]);
            }
        } catch (error) {
            console.error('Error loading follow-up tasks:', error);
            enqueueSnackbar('Failed to load follow-up tasks', { variant: 'error' });
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    // Initialize predefined tasks if none exist
    const initializePredefinedTasks = async () => {
        try {
            setSaving(true);
            const tasks = [];
            let sortOrder = 0;

            // Create tasks for each category
            Object.entries(predefinedTasks).forEach(([category, taskList]) => {
                taskList.forEach((taskName) => {
                    tasks.push({
                        category,
                        taskName,
                        description: '',
                        enabled: true,
                        sortOrder: sortOrder++
                    });
                });
            });

            const createFollowUpTaskTemplate = httpsCallable(functions, 'createFollowUpTaskTemplate');

            // Create all tasks in parallel
            await Promise.all(tasks.map(task => createFollowUpTaskTemplate(task)));

            enqueueSnackbar(`Successfully initialized ${tasks.length} predefined follow-up tasks`, { variant: 'success' });
            await loadFollowUpTasks();
        } catch (error) {
            console.error('Error initializing predefined tasks:', error);
            enqueueSnackbar('Failed to initialize predefined tasks', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Handle dialog open/close
    const handleAddTask = () => {
        setEditingTask(null);
        setFormData({
            category: '',
            taskName: '',
            description: '',
            enabled: true,
            sortOrder: tasks.length
        });
        setDialogOpen(true);
    };

    const handleEditTask = (task) => {
        setEditingTask(task);
        setFormData({
            category: task.category || '',
            taskName: task.taskName || '',
            description: task.description || '',
            enabled: task.enabled !== false,
            sortOrder: task.sortOrder || 0
        });
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingTask(null);
        setFormData({
            category: '',
            taskName: '',
            description: '',
            enabled: true,
            sortOrder: 0
        });
    };

    // Handle form changes
    const handleFormChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Save task
    const handleSaveTask = async () => {
        if (!formData.taskName.trim() || !formData.category) {
            enqueueSnackbar('Please fill in all required fields', { variant: 'error' });
            return;
        }

        try {
            setSaving(true);

            if (editingTask) {
                // Update existing task
                const updateFollowUpTaskTemplate = httpsCallable(functions, 'updateFollowUpTaskTemplate');
                await updateFollowUpTaskTemplate({
                    taskId: editingTask.id,
                    ...formData
                });
                enqueueSnackbar('Follow-up task updated successfully', { variant: 'success' });
            } else {
                // Create new task
                const createFollowUpTaskTemplate = httpsCallable(functions, 'createFollowUpTaskTemplate');
                await createFollowUpTaskTemplate(formData);
                enqueueSnackbar('Follow-up task created successfully', { variant: 'success' });
            }

            handleCloseDialog();
            await loadFollowUpTasks();
        } catch (error) {
            console.error('Error saving follow-up task:', error);
            enqueueSnackbar('Failed to save follow-up task', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Delete task
    const handleDeleteTask = async (task) => {
        if (!window.confirm(`Are you sure you want to delete the task "${task.taskName}"?`)) {
            return;
        }

        try {
            setSaving(true);
            const deleteFollowUpTaskTemplate = httpsCallable(functions, 'deleteFollowUpTaskTemplate');
            await deleteFollowUpTaskTemplate({ taskId: task.id });
            enqueueSnackbar('Follow-up task deleted successfully', { variant: 'success' });
            await loadFollowUpTasks();
        } catch (error) {
            console.error('Error deleting follow-up task:', error);
            enqueueSnackbar('Failed to delete follow-up task', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Get category label
    const getCategoryLabel = (category) => {
        const cat = taskCategories.find(c => c.value === category);
        return cat ? cat.label : category;
    };

    // Group tasks by category
    const groupedTasks = tasks.reduce((groups, task) => {
        const category = task.category || 'uncategorized';
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(task);
        return groups;
    }, {});

    useEffect(() => {
        loadFollowUpTasks();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <CircularProgress size={24} />
                <Typography sx={{ ml: 2, fontSize: '12px', color: '#6b7280' }}>
                    Loading follow-up tasks...
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Manage predefined follow-up tasks that can be assigned when creating shipment follow-ups
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {tasks.length === 0 && (
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={initializePredefinedTasks}
                            size="small"
                            disabled={saving}
                            sx={{ fontSize: '12px' }}
                        >
                            Initialize Default Tasks
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddTask}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Add Task
                    </Button>
                </Box>
            </Box>

            {tasks.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 2 }}>
                        No follow-up tasks configured yet
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#9ca3af', mb: 3 }}>
                        Click "Initialize Default Tasks" to load predefined tasks for shipper, carrier, and internal team follow-ups,
                        or "Add Task" to create custom tasks.
                    </Typography>
                </Paper>
            ) : (
                <Box>
                    {Object.entries(groupedTasks).map(([category, categoryTasks]) => (
                        <Paper key={category} sx={{ mb: 2, border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                            <Box sx={{ p: 2, backgroundColor: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                    {getCategoryLabel(category)}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    {categoryTasks.length} task{categoryTasks.length !== 1 ? 's' : ''}
                                </Typography>
                            </Box>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Task Name
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Description
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Status
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                                Actions
                                            </TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {categoryTasks
                                            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                                            .map((task) => (
                                                <TableRow key={task.id}>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {task.taskName}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px', maxWidth: '300px' }}>
                                                        {task.description || '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={task.enabled ? 'Enabled' : 'Disabled'}
                                                            size="small"
                                                            color={task.enabled ? 'success' : 'default'}
                                                            sx={{ fontSize: '10px' }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleEditTask(task)}
                                                                sx={{ color: '#6b7280' }}
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleDeleteTask(task)}
                                                                sx={{ color: '#dc2626' }}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    ))}
                </Box>
            )}

            {/* Add/Edit Task Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            {editingTask ? 'Edit Follow-up Task' : 'Add Follow-up Task'}
                        </Typography>
                        <IconButton size="small" onClick={handleCloseDialog}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Category *</InputLabel>
                            <Select
                                value={formData.category}
                                onChange={(e) => handleFormChange('category', e.target.value)}
                                label="Category *"
                                sx={{ fontSize: '12px' }}
                            >
                                {taskCategories.map((category) => (
                                    <MenuItem key={category.value} value={category.value} sx={{ fontSize: '12px' }}>
                                        {category.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            label="Task Name *"
                            value={formData.taskName}
                            onChange={(e) => handleFormChange('taskName', e.target.value)}
                            fullWidth
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                        />

                        <TextField
                            label="Description (Optional)"
                            value={formData.description}
                            onChange={(e) => handleFormChange('description', e.target.value)}
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                        />

                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                            <Select
                                value={formData.enabled}
                                onChange={(e) => handleFormChange('enabled', e.target.value)}
                                label="Status"
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value={true} sx={{ fontSize: '12px' }}>Enabled</MenuItem>
                                <MenuItem value={false} sx={{ fontSize: '12px' }}>Disabled</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            label="Sort Order"
                            value={formData.sortOrder}
                            onChange={(e) => handleFormChange('sortOrder', parseInt(e.target.value) || 0)}
                            type="number"
                            fullWidth
                            size="small"
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            InputProps={{ sx: { fontSize: '12px' } }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleCloseDialog}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveTask}
                        variant="contained"
                        startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                        disabled={saving}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingTask ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default FollowUpTasksConfiguration;
