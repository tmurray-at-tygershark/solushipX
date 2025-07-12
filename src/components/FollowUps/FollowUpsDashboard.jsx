// ===================================================================
// SHIPMENT FOLLOW-UPS DASHBOARD
// ===================================================================
// Main interface for managing all follow-up activities
// Replaces manual spreadsheet tracking with automated workflows

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    CardActions,
    Button,
    Chip,
    Avatar,
    IconButton,
    Tabs,
    Tab,
    Badge,
    LinearProgress,
    Alert,
    Tooltip,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    Autocomplete,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    ListItemSecondaryAction
} from '@mui/material';

import {
    Dashboard as DashboardIcon,
    Assignment as TaskIcon,
    Schedule as ScheduleIcon,
    Warning as WarningIcon,
    CheckCircle as CompletedIcon,
    Person as PersonIcon,
    Add as AddIcon,
    FilterList as FilterIcon,
    Sort as SortIcon,
    MoreVert as MoreIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Upload as UploadIcon,
    Comment as CommentIcon,
    Escalate as EscalateIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Timeline as TimelineIcon,
    PriorityHigh as UrgentIcon,
    LocalShipping as ShipmentIcon,
    Business as CompanyIcon,
    Today as TodayIcon,
    DateRange as DateRangeIcon
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import ModalHeader from '../common/ModalHeader';
import EnhancedStatusChip from '../StatusChip/EnhancedStatusChip';

// ===================================================================
// MAIN DASHBOARD COMPONENT
// ===================================================================

const FollowUpsDashboard = ({ isModal = false, onClose }) => {
    const { user } = useAuth();
    const { companyIdForAddress } = useCompany();

    // State Management
    const [selectedTab, setSelectedTab] = useState('overview');
    const [tasks, setTasks] = useState([]);
    const [rules, setRules] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters & Search
    const [filters, setFilters] = useState({
        status: 'all',
        priority: 'all',
        assignedTo: 'all',
        category: 'all',
        dueDate: 'all'
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('dueDate');
    const [sortOrder, setSortOrder] = useState('asc');

    // Dialog States
    const [createTaskDialog, setCreateTaskDialog] = useState(false);
    const [createRuleDialog, setCreateRuleDialog] = useState(false);
    const [taskDetailDialog, setTaskDetailDialog] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);

    // Statistics
    const [stats, setStats] = useState({
        totalTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        completedToday: 0,
        activeRules: 0,
        averageCompletionTime: 0
    });

    // Load Data
    useEffect(() => {
        loadFollowUpData();
    }, [companyIdForAddress]);

    const loadFollowUpData = useCallback(async () => {
        try {
            setLoading(true);

            // Load tasks, rules, and staff data
            const [tasksData, rulesData, staffData] = await Promise.all([
                loadTasks(),
                loadRules(),
                loadStaff()
            ]);

            setTasks(tasksData);
            setRules(rulesData);
            setStaff(staffData);

            // Calculate statistics
            calculateStats(tasksData);

        } catch (error) {
            console.error('Error loading follow-up data:', error);
            setError('Failed to load follow-up data');
        } finally {
            setLoading(false);
        }
    }, [companyIdForAddress]);

    const loadTasks = async () => {
        // TODO: Implement API call to load tasks
        return [];
    };

    const loadRules = async () => {
        // TODO: Implement API call to load rules
        return [];
    };

    const loadStaff = async () => {
        // TODO: Implement API call to load staff
        return [];
    };

    const calculateStats = (tasksData) => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const stats = {
            totalTasks: tasksData.length,
            pendingTasks: tasksData.filter(t => t.status === 'pending').length,
            overdueTasks: tasksData.filter(t => t.status === 'overdue').length,
            completedToday: tasksData.filter(t =>
                t.status === 'completed' &&
                new Date(t.completedAt) >= todayStart
            ).length,
            activeRules: rules.filter(r => r.isActive).length,
            averageCompletionTime: 0 // TODO: Calculate from completed tasks
        };

        setStats(stats);
    };

    // Filtered and Sorted Tasks
    const filteredTasks = useMemo(() => {
        let filtered = tasks;

        // Apply filters
        if (filters.status !== 'all') {
            filtered = filtered.filter(task => task.status === filters.status);
        }

        if (filters.priority !== 'all') {
            filtered = filtered.filter(task => task.priority === filters.priority);
        }

        if (filters.assignedTo !== 'all') {
            filtered = filtered.filter(task => task.assignedTo === filters.assignedTo);
        }

        if (filters.category !== 'all') {
            filtered = filtered.filter(task => task.category === filters.category);
        }

        // Apply search
        if (searchTerm) {
            filtered = filtered.filter(task =>
                task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                task.shipmentId.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'dueDate') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        return filtered;
    }, [tasks, filters, searchTerm, sortBy, sortOrder]);

    // Event Handlers
    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const handleCreateTask = () => {
        setCreateTaskDialog(true);
    };

    const handleCreateRule = () => {
        setCreateRuleDialog(true);
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setTaskDetailDialog(true);
    };

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
    };

    // Render Functions
    const renderHeader = () => (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3
        }}>
            <Box>
                <Typography variant="h4" sx={{
                    fontWeight: 600,
                    fontSize: '1.5rem',
                    color: '#111827'
                }}>
                    Shipment Follow-Ups
                </Typography>
                <Typography variant="body2" sx={{
                    color: '#6b7280',
                    fontSize: '12px',
                    mt: 0.5
                }}>
                    Automated task management and shipment tracking
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SettingsIcon />}
                    sx={{ fontSize: '12px' }}
                >
                    Rules
                </Button>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleCreateTask}
                    sx={{ fontSize: '12px' }}
                >
                    New Task
                </Button>
                {isModal && (
                    <IconButton size="small" onClick={onClose}>
                        <MoreIcon />
                    </IconButton>
                )}
            </Box>
        </Box>
    );

    const renderStatsCards = () => (
        <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2}>
                <Card elevation={0} sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 2
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{
                                width: 32,
                                height: 32,
                                bgcolor: '#3b82f6'
                            }}>
                                <TaskIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                                <Typography variant="h6" sx={{
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: '#111827'
                                }}>
                                    {stats.totalTasks}
                                </Typography>
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280'
                                }}>
                                    Total Tasks
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card elevation={0} sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 2
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{
                                width: 32,
                                height: 32,
                                bgcolor: '#f59e0b'
                            }}>
                                <ScheduleIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                                <Typography variant="h6" sx={{
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: '#111827'
                                }}>
                                    {stats.pendingTasks}
                                </Typography>
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280'
                                }}>
                                    Pending
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card elevation={0} sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 2
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{
                                width: 32,
                                height: 32,
                                bgcolor: '#ef4444'
                            }}>
                                <WarningIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                                <Typography variant="h6" sx={{
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: '#111827'
                                }}>
                                    {stats.overdueTasks}
                                </Typography>
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280'
                                }}>
                                    Overdue
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card elevation={0} sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 2
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{
                                width: 32,
                                height: 32,
                                bgcolor: '#10b981'
                            }}>
                                <CompletedIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                                <Typography variant="h6" sx={{
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: '#111827'
                                }}>
                                    {stats.completedToday}
                                </Typography>
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280'
                                }}>
                                    Completed Today
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card elevation={0} sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 2
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{
                                width: 32,
                                height: 32,
                                bgcolor: '#8b5cf6'
                            }}>
                                <SettingsIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                                <Typography variant="h6" sx={{
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: '#111827'
                                }}>
                                    {stats.activeRules}
                                </Typography>
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280'
                                }}>
                                    Active Rules
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card elevation={0} sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 2
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Avatar sx={{
                                width: 32,
                                height: 32,
                                bgcolor: '#06b6d4'
                            }}>
                                <TimelineIcon sx={{ fontSize: 18 }} />
                            </Avatar>
                            <Box>
                                <Typography variant="h6" sx={{
                                    fontSize: '18px',
                                    fontWeight: 600,
                                    color: '#111827'
                                }}>
                                    {stats.averageCompletionTime}m
                                </Typography>
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280'
                                }}>
                                    Avg. Time
                                </Typography>
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );

    const renderTabs = () => (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs
                value={selectedTab}
                onChange={handleTabChange}
                sx={{
                    '& .MuiTab-root': {
                        fontSize: '12px',
                        textTransform: 'none',
                        fontWeight: 500
                    }
                }}
            >
                <Tab
                    label="Overview"
                    value="overview"
                    icon={<DashboardIcon />}
                    iconPosition="start"
                />
                <Tab
                    label={
                        <Badge badgeContent={stats.pendingTasks} color="primary">
                            My Tasks
                        </Badge>
                    }
                    value="my-tasks"
                    icon={<PersonIcon />}
                    iconPosition="start"
                />
                <Tab
                    label={
                        <Badge badgeContent={stats.totalTasks} color="secondary">
                            All Tasks
                        </Badge>
                    }
                    value="all-tasks"
                    icon={<TaskIcon />}
                    iconPosition="start"
                />
                <Tab
                    label="Rules"
                    value="rules"
                    icon={<SettingsIcon />}
                    iconPosition="start"
                />
                <Tab
                    label="Analytics"
                    value="analytics"
                    icon={<TimelineIcon />}
                    iconPosition="start"
                />
            </Tabs>
        </Box>
    );

    const renderTaskCard = (task) => (
        <Card
            key={task.id}
            elevation={0}
            sx={{
                border: '1px solid #e5e7eb',
                borderRadius: 2,
                mb: 2,
                cursor: 'pointer',
                '&:hover': {
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    transform: 'translateY(-1px)',
                    transition: 'all 0.2s ease-in-out'
                }
            }}
            onClick={() => handleTaskClick(task)}
        >
            <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#111827',
                            mb: 0.5
                        }}>
                            {task.title}
                        </Typography>
                        <Typography variant="body2" sx={{
                            fontSize: '12px',
                            color: '#6b7280',
                            mb: 1
                        }}>
                            {task.description}
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Chip
                                label={task.shipmentId}
                                size="small"
                                icon={<ShipmentIcon />}
                                sx={{
                                    fontSize: '10px',
                                    height: 24,
                                    bgcolor: '#f3f4f6',
                                    color: '#374151'
                                }}
                            />
                            <Chip
                                label={task.category}
                                size="small"
                                sx={{
                                    fontSize: '10px',
                                    height: 24,
                                    bgcolor: '#fef3c7',
                                    color: '#92400e'
                                }}
                            />
                            <Chip
                                label={task.priority}
                                size="small"
                                color={task.priority === 'urgent' ? 'error' : task.priority === 'high' ? 'warning' : 'default'}
                                sx={{
                                    fontSize: '10px',
                                    height: 24
                                }}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PersonIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280'
                                }}>
                                    {task.assignedTo}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <ScheduleIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                <Typography variant="caption" sx={{
                                    fontSize: '10px',
                                    color: '#6b7280'
                                }}>
                                    Due: {new Date(task.dueDate).toLocaleDateString()}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                        <EnhancedStatusChip
                            status={task.status}
                            size="small"
                            sx={{ fontSize: '10px' }}
                        />
                        {task.progress > 0 && (
                            <Box sx={{ width: 60 }}>
                                <LinearProgress
                                    variant="determinate"
                                    value={task.progress}
                                    sx={{ height: 4, borderRadius: 2 }}
                                />
                            </Box>
                        )}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );

    const renderTasksList = () => (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#111827'
                }}>
                    Tasks ({filteredTasks.length})
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<FilterIcon />}
                        sx={{ fontSize: '12px' }}
                    >
                        Filter
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<SortIcon />}
                        sx={{ fontSize: '12px' }}
                    >
                        Sort
                    </Button>
                </Box>
            </Box>

            {filteredTasks.length === 0 ? (
                <Paper sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '1px solid #e5e7eb',
                    borderRadius: 2
                }}>
                    <TaskIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                    <Typography variant="h6" sx={{
                        fontSize: '16px',
                        color: '#6b7280',
                        mb: 1
                    }}>
                        No tasks found
                    </Typography>
                    <Typography variant="body2" sx={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        mb: 2
                    }}>
                        Create a new task or adjust your filters
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleCreateTask}
                        sx={{ fontSize: '12px' }}
                    >
                        Create Task
                    </Button>
                </Paper>
            ) : (
                <Box>
                    {filteredTasks.map(task => renderTaskCard(task))}
                </Box>
            )}
        </Box>
    );

    // Main Render
    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <LinearProgress sx={{ width: '100%' }} />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {error}
            </Alert>
        );
    }

    const content = (
        <Box sx={{ p: isModal ? 0 : 3 }}>
            {!isModal && renderHeader()}
            {renderStatsCards()}
            {renderTabs()}

            {selectedTab === 'overview' && renderTasksList()}
            {selectedTab === 'my-tasks' && renderTasksList()}
            {selectedTab === 'all-tasks' && renderTasksList()}
            {selectedTab === 'rules' && <Typography>Rules Management Coming Soon</Typography>}
            {selectedTab === 'analytics' && <Typography>Analytics Coming Soon</Typography>}
        </Box>
    );

    if (isModal) {
        return (
            <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                <ModalHeader
                    title="Shipment Follow-Ups"
                    onClose={onClose}
                    showCloseButton={true}
                />
                <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {content}
                </Box>
            </Box>
        );
    }

    return (
        <Container maxWidth="xl">
            {content}
        </Container>
    );
};

export default FollowUpsDashboard; 