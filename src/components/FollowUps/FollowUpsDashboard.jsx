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
    ListItemSecondaryAction,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Skeleton,
    CircularProgress,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    FormControlLabel,
    Switch,
    InputAdornment,
    Collapse
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
    DateRange as DateRangeIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    LocalShipping as TrackingIcon,
    ExpandMore as ExpandMoreIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    CalendarToday as CalendarIcon,
    AccessTime as TimeIcon,
    Group as GroupIcon,
    Notifications as NotificationsIcon,
    AccountCircle as AccountIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    Stop as StopIcon,
    ViewList as ViewListIcon,
    Avatar as AvatarIcon
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import ModalHeader from '../common/ModalHeader';
import EnhancedStatusChip from '../StatusChip/EnhancedStatusChip';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';

// ===================================================================
// MAIN DASHBOARD COMPONENT
// ===================================================================

const FollowUpsDashboard = ({ isModal = false, onClose }) => {
    const { currentUser: user, userRole, loading: authLoading } = useAuth();
    const { companyIdForAddress, companyData } = useCompany();

    // State Management
    const [selectedTab, setSelectedTab] = useState('overview');
    const [tasks, setTasks] = useState([]);
    const [rules, setRules] = useState([]);
    const [staff, setStaff] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // Company & Customer Management
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('all');
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Shipment data for task context
    const [shipmentData, setShipmentData] = useState({});

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
    const [editTaskDialog, setEditTaskDialog] = useState(false);
    const [deleteTaskDialog, setDeleteTaskDialog] = useState(false);
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

    // Load companies for super admin and admin users
    useEffect(() => {
        const loadCompanies = async () => {
            if (!user || userRole === 'user') return;

            setLoadingCompanies(true);
            try {
                let companiesQuery;

                if (userRole === 'superadmin') {
                    // Super admins can see all companies
                    companiesQuery = query(collection(db, 'companies'));
                } else if (userRole === 'admin') {
                    // Admins can see their connected companies
                    const userDoc = await getDocs(
                        query(collection(db, 'users'), where('uid', '==', user.uid))
                    );

                    if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data();
                        const connectedCompanyIds = userData.connectedCompanies?.companies || [];

                        if (connectedCompanyIds.length > 0) {
                            companiesQuery = query(
                                collection(db, 'companies'),
                                where('companyID', 'in', connectedCompanyIds)
                            );
                        }
                    }
                }

                if (companiesQuery) {
                    const companiesSnapshot = await getDocs(companiesQuery);
                    const companies = companiesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    companies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    setAvailableCompanies(companies);
                }
            } catch (error) {
                console.error('Error loading companies:', error);
                setAvailableCompanies([]);
            } finally {
                setLoadingCompanies(false);
            }
        };

        loadCompanies();
    }, [user, userRole]);

    // Load customers based on selected company
    useEffect(() => {
        const loadCustomers = async () => {
            if (!companyIdForAddress && selectedCompanyId === 'all') return;

            setLoadingCustomers(true);
            try {
                const targetCompanyId = selectedCompanyId === 'all' ? companyIdForAddress : selectedCompanyId;

                if (targetCompanyId) {
                    const customersQuery = query(
                        collection(db, 'customers'),
                        where('companyId', '==', targetCompanyId),
                        orderBy('name')
                    );

                    const customersSnapshot = await getDocs(customersQuery);
                    const customers = customersSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    setAvailableCustomers(customers);
                }
            } catch (error) {
                console.error('Error loading customers:', error);
                setAvailableCustomers([]);
            } finally {
                setLoadingCustomers(false);
            }
        };

        loadCustomers();
    }, [companyIdForAddress, selectedCompanyId]);

    // Load shipment data for tasks
    const loadShipmentDataForTasks = async (tasks) => {
        try {
            console.log('🔄 Loading shipment data for tasks...');
            const shipmentIds = [...new Set(tasks.map(task => task.shipmentId).filter(Boolean))];

            if (shipmentIds.length === 0) {
                setShipmentData({});
                return;
            }

            const shipmentQueries = shipmentIds.map(async (shipmentId) => {
                try {
                    // Try to get shipment by document ID first
                    const shipmentDoc = await getDocs(query(
                        collection(db, 'shipments'),
                        where('shipmentID', '==', shipmentId),
                        limit(1)
                    ));

                    if (!shipmentDoc.empty) {
                        return {
                            id: shipmentId,
                            data: { id: shipmentDoc.docs[0].id, ...shipmentDoc.docs[0].data() }
                        };
                    }
                    return { id: shipmentId, data: null };
                } catch (error) {
                    console.error(`Error loading shipment ${shipmentId}:`, error);
                    return { id: shipmentId, data: null };
                }
            });

            const shipmentResults = await Promise.all(shipmentQueries);
            const shipmentDataMap = {};
            shipmentResults.forEach(result => {
                if (result.data) {
                    shipmentDataMap[result.id] = result.data;
                }
            });

            console.log('📋 Loaded shipment data for', Object.keys(shipmentDataMap).length, 'shipments');
            setShipmentData(shipmentDataMap);
        } catch (error) {
            console.error('Error loading shipment data for tasks:', error);
            setShipmentData({});
        }
    };

    // Load tasks with enhanced filtering
    const loadTasks = async () => {
        try {
            console.log('🔄 loadTasks called!');
            setLoading(true);

            // For super admins, "all" means ALL companies. For regular users, "all" means their company.
            let targetCompanyId = null;
            if (selectedCompanyId === 'all') {
                if (userRole === 'superadmin') {
                    targetCompanyId = null; // No company filter - show all
                } else {
                    targetCompanyId = companyIdForAddress; // Regular users see only their company
                }
            } else {
                targetCompanyId = selectedCompanyId; // Specific company selected
            }

            console.log('🔄 Loading tasks with params:', {
                userRole: userRole,
                selectedCompanyId: selectedCompanyId,
                companyId: targetCompanyId,
                customerId: selectedCustomerId === 'all' ? null : selectedCustomerId,
                filters: filters,
                searchTerm: searchTerm,
                sortBy: sortBy,
                sortOrder: sortOrder
            });

            const getFollowUpTasks = httpsCallable(functions, 'getFollowUpTasks');
            const result = await getFollowUpTasks({
                companyId: targetCompanyId,
                customerId: selectedCustomerId === 'all' ? null : selectedCustomerId,
                status: filters.status === 'all' ? null : filters.status,
                priority: filters.priority === 'all' ? null : filters.priority,
                assignedTo: filters.assignedTo === 'all' ? null : filters.assignedTo,
                category: filters.category === 'all' ? null : filters.category,
                limit: 100
            });

            console.log('📋 Tasks result:', result);
            console.log('📋 Tasks data:', result.data);
            console.log('📋 Tasks array:', result.data?.tasks);

            const loadedTasks = result.data?.tasks || [];
            setTasks(loadedTasks);

            // Load shipment data for the tasks
            if (loadedTasks.length > 0) {
                await loadShipmentDataForTasks(loadedTasks);
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
            setError('Failed to load follow-up tasks');
            setTasks([]); // Ensure tasks is always an array
        } finally {
            setLoading(false);
        }
    };

    // Load rules
    const loadRules = async () => {
        try {
            console.log('🔄 loadRules called!');

            const targetCompanyId = selectedCompanyId === 'all' ? companyIdForAddress : selectedCompanyId;

            const getFollowUpRules = httpsCallable(functions, 'getFollowUpRules');
            const result = await getFollowUpRules({
                companyId: targetCompanyId
            });

            console.log('📋 Rules result:', result);
            console.log('📋 Rules data:', result.data);

            setRules(result.data || []);
        } catch (error) {
            console.error('Error loading rules:', error);
            setRules([]); // Ensure rules is always an array
        }
    };

    // Load staff members
    const loadStaff = async () => {
        try {
            console.log('🔄 loadStaff called!');

            // Load all users for assignment filtering
            const staffQuery = query(
                collection(db, 'users'),
                orderBy('firstName')
            );

            const staffSnapshot = await getDocs(staffQuery);
            const staffMembers = staffSnapshot.docs.map(doc => ({
                id: doc.id,
                uid: doc.data().uid,
                ...doc.data()
            }));

            console.log('📋 Loaded staff members:', staffMembers.length);
            setStaff(staffMembers);
        } catch (error) {
            console.error('Error loading staff:', error);
            setStaff([]);
        }
    };

    // Load shipments requiring follow-up
    const loadShipments = async () => {
        try {
            console.log('🔄 loadShipments called!');

            const targetCompanyId = selectedCompanyId === 'all' ? companyIdForAddress : selectedCompanyId;

            if (!targetCompanyId) {
                setShipments([]);
                return;
            }

            // Query shipments that might need follow-up
            const shipmentsQuery = query(
                collection(db, 'shipments'),
                where('companyID', '==', targetCompanyId),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const shipmentsSnapshot = await getDocs(shipmentsQuery);
            const shipmentsData = shipmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter shipments that might need follow-up (in transit, delayed, etc.)
            const followUpShipments = shipmentsData.filter(shipment => {
                const status = shipment.status?.toLowerCase();
                return status && ['in_transit', 'delayed', 'exception', 'on_hold'].includes(status);
            });

            setShipments(followUpShipments);
        } catch (error) {
            console.error('Error loading shipments:', error);
            setShipments([]);
        }
    };

    // Calculate statistics
    const calculateStats = useCallback(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Ensure tasks and rules are arrays
        const taskArray = Array.isArray(tasks) ? tasks : [];
        const rulesArray = Array.isArray(rules) ? rules : [];

        const totalTasks = taskArray.length;
        const pendingTasks = taskArray.filter(task => task.status === 'pending').length;
        const overdueTasks = taskArray.filter(task => {
            const dueDate = task.dueDate?.toDate?.() || new Date(task.dueDate);
            return task.status !== 'completed' && dueDate < now;
        }).length;
        const completedToday = taskArray.filter(task => {
            const completedDate = task.completedAt?.toDate?.() || new Date(task.completedAt);
            return task.status === 'completed' && completedDate >= today;
        }).length;
        const activeRules = rulesArray.filter(rule => rule.active).length;

        // Calculate average completion time (in hours)
        const completedTasks = taskArray.filter(task => task.status === 'completed' && task.completedAt && task.createdAt);
        const averageCompletionTime = completedTasks.length > 0
            ? completedTasks.reduce((sum, task) => {
                const created = task.createdAt?.toDate?.() || new Date(task.createdAt);
                const completed = task.completedAt?.toDate?.() || new Date(task.completedAt);
                return sum + (completed - created);
            }, 0) / completedTasks.length / (1000 * 60 * 60) // Convert to hours
            : 0;

        setStats({
            totalTasks,
            pendingTasks,
            overdueTasks,
            completedToday,
            activeRules,
            averageCompletionTime: Math.round(averageCompletionTime * 10) / 10
        });
    }, [tasks, rules]);

    // Load data on component mount and when dependencies change
    useEffect(() => {
        console.log('🔄 useEffect triggered with user:', user);
        if (user) { // Only load data when user is available
            console.log('🔄 User available, loading data...');
            loadTasks();
            loadRules();
            loadStaff();
            loadShipments();
        } else {
            console.log('❌ User not available, skipping data load');
        }
    }, [user, companyIdForAddress, selectedCompanyId, selectedCustomerId, filters, searchTerm, sortBy, sortOrder]);

    // Update selectedCompanyId when companyIdForAddress changes (for non-super admins only)
    useEffect(() => {
        if (companyIdForAddress && selectedCompanyId === 'all' && userRole !== 'superadmin') {
            console.log('🔄 Setting selectedCompanyId to user company for non-super admin:', companyIdForAddress);
            setSelectedCompanyId(companyIdForAddress);
        }
    }, [companyIdForAddress, selectedCompanyId, userRole]);

    // Recalculate stats when tasks or rules change
    useEffect(() => {
        calculateStats();
    }, [tasks, rules, calculateStats]);

    // Event handlers
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

    const handleEditTask = (task) => {
        setSelectedTask(task);
        setEditTaskDialog(true);
    };

    const handleDeleteTask = (task) => {
        setSelectedTask(task);
        setDeleteTaskDialog(true);
    };

    const handleConfirmDeleteTask = async () => {
        if (!selectedTask) return;

        try {
            const deleteFollowUpTask = httpsCallable(functions, 'deleteFollowUpTask');
            await deleteFollowUpTask({ taskId: selectedTask.id });

            setDeleteTaskDialog(false);
            setSelectedTask(null);
            refreshData();
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const handleUpdateTask = async (updatedTaskData) => {
        if (!selectedTask) return;

        try {
            const updateFollowUpTask = httpsCallable(functions, 'updateFollowUpTask');
            await updateFollowUpTask({
                taskId: selectedTask.id,
                ...updatedTaskData
            });

            setEditTaskDialog(false);
            setSelectedTask(null);
            refreshData();
        } catch (error) {
            console.error('Error updating task:', error);
        }
    };

    const handleCreateNewTask = async (taskData) => {
        try {
            const createFollowUpTask = httpsCallable(functions, 'createFollowUpTask');
            await createFollowUpTask({
                ...taskData,
                companyId: selectedCompanyId === 'all' ? companyIdForAddress : selectedCompanyId,
                customerId: selectedCustomerId === 'all' ? null : selectedCustomerId
            });

            setCreateTaskDialog(false);
            refreshData();
        } catch (error) {
            console.error('Error creating task:', error);
        }
    };

    const handleCreateNewRule = async (ruleData) => {
        try {
            const createFollowUpRule = httpsCallable(functions, 'createFollowUpRule');
            await createFollowUpRule({
                ...ruleData,
                companyId: selectedCompanyId === 'all' ? companyIdForAddress : selectedCompanyId
            });

            setCreateRuleDialog(false);
            refreshData();
        } catch (error) {
            console.error('Error creating rule:', error);
        }
    };

    const handleFilterChange = (filterType, value) => {
        setFilters(prev => ({
            ...prev,
            [filterType]: value
        }));
    };

    const handleCompanyChange = (event) => {
        setSelectedCompanyId(event.target.value);
        setSelectedCustomerId('all'); // Reset customer selection when company changes
    };

    const handleCustomerChange = (event) => {
        setSelectedCustomerId(event.target.value);
    };

    const refreshData = () => {
        loadTasks();
        loadRules();
        loadStaff();
        loadShipments();
    };

    // Professional header with SolushipX styling
    const renderHeader = () => (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 3,
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#ffffff'
        }}>
            <Box>
                <Typography variant="h5" sx={{
                    fontWeight: 600,
                    color: '#111827',
                    fontSize: '22px',
                    mb: 0.5
                }}>
                    Follow-Up Management
                </Typography>
                <Typography sx={{
                    color: '#6b7280',
                    fontSize: '13px'
                }}>
                    Automated shipment follow-up tasks and rules
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<SettingsIcon />}
                    onClick={handleCreateRule}
                    sx={{
                        fontSize: '12px',
                        textTransform: 'none',
                        borderColor: '#d1d5db',
                        color: '#374151',
                        '&:hover': {
                            borderColor: '#6b7280',
                            backgroundColor: '#f9fafb'
                        }
                    }}
                >
                    Rules
                </Button>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleCreateTask}
                    sx={{
                        fontSize: '12px',
                        textTransform: 'none',
                        backgroundColor: '#3b82f6',
                        '&:hover': {
                            backgroundColor: '#2563eb'
                        }
                    }}
                >
                    New Task
                </Button>
            </Box>
        </Box>
    );

    // Enhanced stats cards with professional styling
    const renderStatsCards = () => (
        <Grid container spacing={3} sx={{ p: 3 }}>
            <Grid item xs={12} sm={6} md={2}>
                <Card sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    borderRadius: '8px'
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <TaskIcon sx={{ color: '#3b82f6', mr: 1, fontSize: '20px' }} />
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Total Tasks
                            </Typography>
                        </Box>
                        <Typography sx={{
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#111827'
                        }}>
                            {stats.totalTasks}
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    borderRadius: '8px'
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <ScheduleIcon sx={{ color: '#f59e0b', mr: 1, fontSize: '20px' }} />
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Pending
                            </Typography>
                        </Box>
                        <Typography sx={{
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#111827'
                        }}>
                            {stats.pendingTasks}
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    borderRadius: '8px'
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <WarningIcon sx={{ color: '#ef4444', mr: 1, fontSize: '20px' }} />
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Overdue
                            </Typography>
                        </Box>
                        <Typography sx={{
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#111827'
                        }}>
                            {stats.overdueTasks}
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    borderRadius: '8px'
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <CompletedIcon sx={{ color: '#10b981', mr: 1, fontSize: '20px' }} />
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Completed Today
                            </Typography>
                        </Box>
                        <Typography sx={{
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#111827'
                        }}>
                            {stats.completedToday}
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    borderRadius: '8px'
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <SettingsIcon sx={{ color: '#8b5cf6', mr: 1, fontSize: '20px' }} />
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Active Rules
                            </Typography>
                        </Box>
                        <Typography sx={{
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#111827'
                        }}>
                            {stats.activeRules}
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
                <Card sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    borderRadius: '8px'
                }}>
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <TimeIcon sx={{ color: '#06b6d4', mr: 1, fontSize: '20px' }} />
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Avg. Completion
                            </Typography>
                        </Box>
                        <Typography sx={{
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#111827'
                        }}>
                            {stats.averageCompletionTime}h
                        </Typography>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );

    // Professional tabs with SolushipX styling
    const renderTabs = () => (
        <Box sx={{
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#ffffff'
        }}>
            <Tabs
                value={selectedTab}
                onChange={handleTabChange}
                sx={{
                    px: 3,
                    '& .MuiTab-root': {
                        fontSize: '12px',
                        textTransform: 'none',
                        fontWeight: 500,
                        color: '#6b7280',
                        minHeight: '48px',
                        '&.Mui-selected': {
                            color: '#3b82f6',
                            fontWeight: 600
                        }
                    },
                    '& .MuiTabs-indicator': {
                        backgroundColor: '#3b82f6'
                    }
                }}
            >
                <Tab
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DashboardIcon sx={{ fontSize: '16px' }} />
                            Overview
                        </Box>
                    }
                    value="overview"
                />
                <Tab
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <TaskIcon sx={{ fontSize: '16px' }} />
                            Tasks
                            <Chip
                                label={stats.pendingTasks}
                                size="small"
                                sx={{
                                    height: '16px',
                                    fontSize: '10px',
                                    backgroundColor: '#f59e0b',
                                    color: '#ffffff',
                                    '& .MuiChip-label': {
                                        px: 1
                                    }
                                }}
                            />
                        </Box>
                    }
                    value="tasks"
                />
                <Tab
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <SettingsIcon sx={{ fontSize: '16px' }} />
                            Rules
                            <Chip
                                label={stats.activeRules}
                                size="small"
                                sx={{
                                    height: '16px',
                                    fontSize: '10px',
                                    backgroundColor: '#10b981',
                                    color: '#ffffff',
                                    '& .MuiChip-label': {
                                        px: 1
                                    }
                                }}
                            />
                        </Box>
                    }
                    value="rules"
                />
                <Tab
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ShipmentIcon sx={{ fontSize: '16px' }} />
                            Shipments
                        </Box>
                    }
                    value="shipments"
                />
            </Tabs>
        </Box>
    );

    // Helper function to get user display name from user ID
    const getUserDisplayName = (userId) => {
        if (!userId) return 'Unassigned';

        const user = staff.find(u => u.uid === userId || u.id === userId);
        if (user) {
            if (user.firstName && user.lastName) {
                return `${user.firstName} ${user.lastName}`;
            }
            return user.displayName || user.email || 'Unknown User';
        }
        return userId; // Fallback to showing the ID if user not found
    };

    // Helper function to get user avatar
    const getUserAvatar = (userId) => {
        if (!userId) return null;

        const user = staff.find(u => u.uid === userId || u.id === userId);
        if (user) {
            return user.photoURL || user.avatar;
        }
        return null;
    };

    // Helper function to get user initials
    const getUserInitials = (userId) => {
        if (!userId) return 'U';

        const user = staff.find(u => u.uid === userId || u.id === userId);
        if (user) {
            if (user.firstName && user.lastName) {
                return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
            }
            return user.displayName?.charAt(0) || user.email?.charAt(0) || 'U';
        }
        return userId.charAt(0).toUpperCase();
    };

    // Enhanced task card with professional styling and comprehensive information
    const renderTaskCard = (task) => {
        const shipment = shipmentData[task.shipmentId];

        return (
            <Card
                key={task.id}
                sx={{
                    mb: 2,
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        borderColor: '#3b82f6',
                        backgroundColor: '#f8fafc'
                    }
                }}
                onClick={() => handleTaskClick(task)}
            >
                <CardContent sx={{ p: 2 }}>
                    {/* Task Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography sx={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: '#111827'
                        }}>
                            {task.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                                label={task.priority}
                                size="small"
                                sx={{
                                    height: '20px',
                                    fontSize: '10px',
                                    backgroundColor:
                                        task.priority === 'high' ? '#fee2e2' :
                                            task.priority === 'medium' ? '#fef3c7' : '#f0fdf4',
                                    color:
                                        task.priority === 'high' ? '#dc2626' :
                                            task.priority === 'medium' ? '#d97706' : '#16a34a',
                                    '& .MuiChip-label': {
                                        fontWeight: 500,
                                        textTransform: 'capitalize'
                                    }
                                }}
                            />
                            <EnhancedStatusChip
                                status={task.status}
                                size="small"
                                sx={{
                                    height: '20px',
                                    fontSize: '10px',
                                    '& .MuiChip-label': {
                                        fontSize: '10px'
                                    }
                                }}
                            />
                        </Box>
                    </Box>

                    {/* Task Description */}
                    <Typography sx={{
                        fontSize: '12px',
                        color: '#6b7280',
                        mb: 2,
                        lineHeight: 1.4
                    }}>
                        {task.description}
                    </Typography>

                    {/* Shipment Information Section */}
                    {shipment && (
                        <Box sx={{
                            mb: 2,
                            p: 1.5,
                            backgroundColor: '#f8fafc',
                            borderRadius: '6px',
                            border: '1px solid #e5e7eb'
                        }}>
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#374151',
                                mb: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5
                            }}>
                                <ShipmentIcon sx={{ fontSize: '12px' }} />
                                Shipment Details
                            </Typography>

                            {/* Company and Customer Info */}
                            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                {shipment.shipFrom?.companyName && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <CompanyIcon sx={{ fontSize: '10px', color: '#6b7280' }} />
                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                            From: {shipment.shipFrom.companyName}
                                        </Typography>
                                    </Box>
                                )}
                                {shipment.shipTo?.companyName && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <PersonIcon sx={{ fontSize: '10px', color: '#6b7280' }} />
                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                            To: {shipment.shipTo.companyName}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>

                            {/* Route Information */}
                            {(shipment.shipFrom?.city || shipment.shipTo?.city) && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                    <TrackingIcon sx={{ fontSize: '10px', color: '#6b7280' }} />
                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        Route: {shipment.shipFrom?.city || 'Unknown'} → {shipment.shipTo?.city || 'Unknown'}
                                    </Typography>
                                </Box>
                            )}

                            {/* Shipment Status and Tracking */}
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                {shipment.status && (
                                    <EnhancedStatusChip
                                        status={shipment.status}
                                        size="small"
                                        sx={{
                                            height: '16px',
                                            fontSize: '8px',
                                            '& .MuiChip-label': {
                                                fontSize: '8px',
                                                px: 1
                                            }
                                        }}
                                    />
                                )}
                                {(shipment.trackingNumber || shipment.carrierBookingConfirmation?.proNumber) && (
                                    <Typography sx={{ fontSize: '9px', color: '#6b7280', fontFamily: 'monospace' }}>
                                        #{shipment.trackingNumber || shipment.carrierBookingConfirmation?.proNumber}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    )}

                    {/* Task Footer */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {task.shipmentId && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ShipmentIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                        {task.shipmentId}
                                    </Typography>
                                </Box>
                            )}
                            {task.assignedTo && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Avatar
                                        src={getUserAvatar(task.assignedTo)}
                                        sx={{
                                            width: 16,
                                            height: 16,
                                            fontSize: '8px',
                                            bgcolor: '#8b5cf6'
                                        }}
                                    >
                                        {getUserInitials(task.assignedTo)}
                                    </Avatar>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        {getUserDisplayName(task.assignedTo)}
                                    </Typography>
                                </Box>
                            )}
                            {task.category && (
                                <Chip
                                    label={task.category}
                                    size="small"
                                    sx={{
                                        height: '16px',
                                        fontSize: '8px',
                                        backgroundColor: '#f3f4f6',
                                        color: '#6b7280',
                                        '& .MuiChip-label': {
                                            fontSize: '8px',
                                            px: 1,
                                            textTransform: 'capitalize'
                                        }
                                    }}
                                />
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {task.dueDate && (
                                <Typography sx={{
                                    fontSize: '11px',
                                    color: new Date(task.dueDate.toDate?.() || task.dueDate) < new Date() ? '#dc2626' : '#6b7280'
                                }}>
                                    Due: {new Date(task.dueDate.toDate?.() || task.dueDate).toLocaleDateString()}
                                </Typography>
                            )}
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditTask(task);
                                }}
                                sx={{
                                    color: '#6b7280',
                                    '&:hover': {
                                        backgroundColor: '#f3f4f6'
                                    }
                                }}
                            >
                                <EditIcon sx={{ fontSize: '14px' }} />
                            </IconButton>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task);
                                }}
                                sx={{
                                    color: '#6b7280',
                                    '&:hover': {
                                        backgroundColor: '#f3f4f6',
                                        color: '#dc2626'
                                    }
                                }}
                            >
                                <DeleteIcon sx={{ fontSize: '14px' }} />
                            </IconButton>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    // Enhanced tasks list with professional styling
    const renderTasksList = () => (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#111827'
                }}>
                    Follow-Up Tasks
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        size="small"
                        placeholder="Search tasks..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                </InputAdornment>
                            ),
                            endAdornment: searchTerm && (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        onClick={() => setSearchTerm('')}
                                        sx={{ color: '#6b7280' }}
                                    >
                                        <ClearIcon sx={{ fontSize: '16px' }} />
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                        sx={{
                            width: 250,
                            '& .MuiOutlinedInput-root': {
                                fontSize: '12px',
                                backgroundColor: '#f9fafb',
                                '&:hover': {
                                    backgroundColor: '#f3f4f6'
                                },
                                '&.Mui-focused': {
                                    backgroundColor: '#ffffff'
                                }
                            }
                        }}
                    />
                </Box>
            </Box>

            {/* Task Filters */}
            <Box sx={{
                display: 'flex',
                gap: 2,
                mb: 3,
                p: 2,
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e5e7eb'
            }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                    <Select
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        label="Status"
                        sx={{ fontSize: '12px' }}
                    >
                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Status</MenuItem>
                        <MenuItem value="pending" sx={{ fontSize: '12px' }}>Pending</MenuItem>
                        <MenuItem value="in_progress" sx={{ fontSize: '12px' }}>In Progress</MenuItem>
                        <MenuItem value="completed" sx={{ fontSize: '12px' }}>Completed</MenuItem>
                        <MenuItem value="cancelled" sx={{ fontSize: '12px' }}>Cancelled</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontSize: '12px' }}>Priority</InputLabel>
                    <Select
                        value={filters.priority}
                        onChange={(e) => handleFilterChange('priority', e.target.value)}
                        label="Priority"
                        sx={{ fontSize: '12px' }}
                    >
                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Priority</MenuItem>
                        <MenuItem value="low" sx={{ fontSize: '12px' }}>Low</MenuItem>
                        <MenuItem value="medium" sx={{ fontSize: '12px' }}>Medium</MenuItem>
                        <MenuItem value="high" sx={{ fontSize: '12px' }}>High</MenuItem>
                        <MenuItem value="urgent" sx={{ fontSize: '12px' }}>Urgent</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel sx={{ fontSize: '12px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <PersonIcon sx={{ fontSize: 14 }} />
                            Assigned To
                        </Box>
                    </InputLabel>
                    <Select
                        value={filters.assignedTo}
                        onChange={(e) => handleFilterChange('assignedTo', e.target.value)}
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PersonIcon sx={{ fontSize: 14 }} />
                                Assigned To
                            </Box>
                        }
                        sx={{ fontSize: '12px' }}
                    >
                        <MenuItem value="all" sx={{ fontSize: '12px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ViewListIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                All Users
                            </Box>
                        </MenuItem>
                        {staff.map(user => (
                            <MenuItem
                                key={user.id}
                                value={user.uid || user.id}
                                sx={{ fontSize: '12px' }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Avatar
                                        src={user.photoURL || user.avatar}
                                        sx={{
                                            width: 16,
                                            height: 16,
                                            fontSize: '8px',
                                            bgcolor: '#8b5cf6'
                                        }}
                                    >
                                        {(user.firstName?.charAt(0) || user.displayName?.charAt(0) || user.email?.charAt(0) || 'U')}
                                    </Avatar>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {user.firstName && user.lastName
                                            ? `${user.firstName} ${user.lastName}`
                                            : user.displayName || user.email || 'Unknown User'
                                        }
                                    </Typography>
                                </Box>
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                    <Select
                        value={filters.category}
                        onChange={(e) => handleFilterChange('category', e.target.value)}
                        label="Category"
                        sx={{ fontSize: '12px' }}
                    >
                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Categories</MenuItem>
                        <MenuItem value="manual" sx={{ fontSize: '12px' }}>Manual</MenuItem>
                        <MenuItem value="automated" sx={{ fontSize: '12px' }}>Automated</MenuItem>
                        <MenuItem value="scheduled" sx={{ fontSize: '12px' }}>Scheduled</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontSize: '12px' }}>Due Date</InputLabel>
                    <Select
                        value={filters.dueDate}
                        onChange={(e) => handleFilterChange('dueDate', e.target.value)}
                        label="Due Date"
                        sx={{ fontSize: '12px' }}
                    >
                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Dates</MenuItem>
                        <MenuItem value="overdue" sx={{ fontSize: '12px' }}>Overdue</MenuItem>
                        <MenuItem value="today" sx={{ fontSize: '12px' }}>Due Today</MenuItem>
                        <MenuItem value="tomorrow" sx={{ fontSize: '12px' }}>Due Tomorrow</MenuItem>
                        <MenuItem value="this_week" sx={{ fontSize: '12px' }}>This Week</MenuItem>
                        <MenuItem value="next_week" sx={{ fontSize: '12px' }}>Next Week</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : tasks.length === 0 ? (
                <Paper sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    backgroundColor: '#f9fafb'
                }}>
                    <TaskIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                    <Typography sx={{
                        fontSize: '14px',
                        color: '#6b7280',
                        mb: 1
                    }}>
                        No follow-up tasks found
                    </Typography>
                    <Typography sx={{
                        fontSize: '12px',
                        color: '#9ca3af'
                    }}>
                        Create your first task to get started
                    </Typography>
                </Paper>
            ) : (
                <Box>
                    {tasks.map(task => renderTaskCard(task))}
                </Box>
            )}
        </Box>
    );

    // Enhanced shipments table with professional styling
    const renderShipmentsTable = () => (
        <Box sx={{ p: 3 }}>
            <Typography sx={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#111827',
                mb: 3
            }}>
                Shipments Requiring Follow-Up
            </Typography>

            <TableContainer
                component={Paper}
                sx={{
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    borderRadius: '8px'
                }}
            >
                <Table>
                    <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Shipment ID</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Customer</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Status</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Route</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Ship Date</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>ETA</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Follow-Up</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {shipments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        No shipments requiring follow-up
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            shipments.map((shipment) => (
                                <TableRow
                                    key={shipment.id}
                                    sx={{
                                        '&:hover': {
                                            backgroundColor: '#f8fafc'
                                        }
                                    }}
                                >
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <ShipmentIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {shipment.shipmentID || shipment.id}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {shipment.shipTo?.companyName || shipment.shipTo?.company || 'Unknown'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <EnhancedStatusChip
                                            status={shipment.status || 'pending'}
                                            size="small"
                                            sx={{
                                                height: '20px',
                                                fontSize: '10px'
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {`${shipment.shipFrom?.city || 'Unknown'} → ${shipment.shipTo?.city || 'Unknown'}`}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {shipment.shipmentInfo?.shipmentDate ?
                                            new Date(shipment.shipmentInfo.shipmentDate.toDate?.() || shipment.shipmentInfo.shipmentDate).toLocaleDateString() :
                                            shipment.createdAt ?
                                                new Date(shipment.createdAt.toDate?.() || shipment.createdAt).toLocaleDateString() :
                                                'N/A'
                                        }
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {shipment.eta1 ?
                                            new Date(shipment.eta1.toDate?.() || shipment.eta1).toLocaleDateString() :
                                            'N/A'
                                        }
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label="Pending"
                                            size="small"
                                            sx={{
                                                height: '20px',
                                                fontSize: '10px',
                                                backgroundColor: '#fef3c7',
                                                color: '#d97706'
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <IconButton
                                            size="small"
                                            sx={{ color: '#6b7280' }}
                                            onClick={() => handleCreateTask()}
                                        >
                                            <AddIcon sx={{ fontSize: '14px' }} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );

    // Enhanced company/customer filters with professional styling
    const renderCompanyCustomerFilters = () => (
        <Box sx={{
            p: 3,
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb'
        }}>
            <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                    <FormControl
                        fullWidth
                        size="small"
                        sx={{
                            '& .MuiInputLabel-root': {
                                fontSize: '12px',
                                color: '#6b7280'
                            },
                            '& .MuiSelect-select': {
                                fontSize: '12px'
                            }
                        }}
                    >
                        <InputLabel id="company-select-label">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <CompanyIcon sx={{ fontSize: 16 }} />
                                Company
                            </Box>
                        </InputLabel>
                        <Select
                            labelId="company-select-label"
                            value={selectedCompanyId}
                            onChange={handleCompanyChange}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <CompanyIcon sx={{ fontSize: 16 }} />
                                    Company
                                </Box>
                            }
                            disabled={loadingCompanies}
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
                                    key={company.id}
                                    value={company.companyID}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        {/* Company Logo/Avatar */}
                                        <Avatar
                                            src={company.logo || company.logoUrl || company.companyLogo}
                                            sx={{
                                                width: 20,
                                                height: 20,
                                                fontSize: '10px',
                                                bgcolor: '#3b82f6'
                                            }}
                                        >
                                            {company.name?.charAt(0) || 'C'}
                                        </Avatar>

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {company.name}
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                ({company.companyID})
                                            </Typography>
                                        </Box>

                                        {/* Status Chip */}
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
                </Grid>
                <Grid item xs={12} md={6}>
                    <FormControl
                        fullWidth
                        size="small"
                        sx={{
                            '& .MuiInputLabel-root': {
                                fontSize: '12px',
                                color: '#6b7280'
                            },
                            '& .MuiSelect-select': {
                                fontSize: '12px'
                            }
                        }}
                    >
                        <InputLabel id="customer-select-label">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PersonIcon sx={{ fontSize: 16 }} />
                                Customer
                            </Box>
                        </InputLabel>
                        <Select
                            labelId="customer-select-label"
                            value={selectedCustomerId}
                            onChange={handleCustomerChange}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <PersonIcon sx={{ fontSize: 16 }} />
                                    Customer
                                </Box>
                            }
                            disabled={loadingCustomers}
                        >
                            {/* All Customers Option */}
                            <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                    <ViewListIcon sx={{ fontSize: 18, color: '#10b981' }} />
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        All Customers
                                    </Typography>
                                    <Chip
                                        label={`${availableCustomers.length} Available`}
                                        size="small"
                                        color="success"
                                        sx={{
                                            height: 20,
                                            fontSize: '10px',
                                            ml: 'auto'
                                        }}
                                    />
                                </Box>
                            </MenuItem>

                            {/* Individual Customers */}
                            {availableCustomers.map(customer => (
                                <MenuItem
                                    key={customer.id}
                                    value={customer.id}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        {/* Customer Logo/Avatar */}
                                        <Avatar
                                            src={customer.logo || customer.logoUrl || customer.customerLogo}
                                            sx={{
                                                width: 20,
                                                height: 20,
                                                fontSize: '10px',
                                                bgcolor: '#10b981'
                                            }}
                                        >
                                            {customer.name?.charAt(0) || 'C'}
                                        </Avatar>

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {customer.name}
                                            </Typography>
                                            {customer.customerID && (
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                    ({customer.customerID})
                                                </Typography>
                                            )}
                                        </Box>

                                        {/* Customer Type/Status */}
                                        {customer.status === 'active' ? (
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
                </Grid>
            </Grid>
        </Box>
    );

    // Main tab content renderer
    const renderTabContent = () => {
        switch (selectedTab) {
            case 'overview':
                return (
                    <Box>
                        {renderStatsCards()}
                        {renderCompanyCustomerFilters()}
                        <Box sx={{ p: 3 }}>
                            <Typography sx={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#111827',
                                mb: 2
                            }}>
                                Recent Activity
                            </Typography>
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : tasks.length === 0 ? (
                                <Alert
                                    severity="info"
                                    sx={{
                                        fontSize: '12px',
                                        backgroundColor: '#f0f9ff',
                                        border: '1px solid #e0f2fe',
                                        color: '#0369a1'
                                    }}
                                >
                                    No follow-up tasks found. Tasks will appear here when created.
                                </Alert>
                            ) : (
                                <Box sx={{ maxHeight: '600px', overflowY: 'auto' }}>
                                    {tasks.slice(0, 10).map(task => renderTaskCard(task))}
                                    {tasks.length > 10 && (
                                        <Box sx={{ textAlign: 'center', mt: 2 }}>
                                            <Button
                                                onClick={() => setSelectedTab('tasks')}
                                                size="small"
                                                sx={{
                                                    fontSize: '12px',
                                                    textTransform: 'none',
                                                    color: '#6366f1'
                                                }}
                                            >
                                                View all {tasks.length} tasks →
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Box>
                );
            case 'tasks':
                return (
                    <Box>
                        {renderCompanyCustomerFilters()}
                        {renderTasksList()}
                    </Box>
                );
            case 'rules':
                return (
                    <Box>
                        {renderCompanyCustomerFilters()}
                        <Box sx={{ p: 3 }}>
                            <Typography sx={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#111827',
                                mb: 2
                            }}>
                                Automation Rules
                            </Typography>
                            <Alert
                                severity="info"
                                sx={{
                                    fontSize: '12px',
                                    backgroundColor: '#f0f9ff',
                                    border: '1px solid #e0f2fe',
                                    color: '#0369a1'
                                }}
                            >
                                Rules management interface will be displayed here...
                            </Alert>
                        </Box>
                    </Box>
                );
            case 'shipments':
                return (
                    <Box>
                        {renderCompanyCustomerFilters()}
                        {renderShipmentsTable()}
                    </Box>
                );
            default:
                return null;
        }
    };

    // Auth loading state
    if (authLoading) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px',
                backgroundColor: '#f9fafb'
            }}>
                <CircularProgress size={32} />
            </Box>
        );
    }

    // Data loading state
    if (loading && tasks.length === 0) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px',
                backgroundColor: '#f9fafb'
            }}>
                <CircularProgress size={32} />
            </Box>
        );
    }

    // Error state
    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert
                    severity="error"
                    sx={{
                        fontSize: '12px',
                        backgroundColor: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626'
                    }}
                >
                    {error}
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f9fafb'
        }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title="Follow-Up Management"
                    onClose={onClose}
                    showCloseButton={true}
                />
            )}

            {/* Main Header */}
            {renderHeader()}

            {/* Navigation Tabs */}
            {renderTabs()}

            {/* Scrollable Content */}
            <Box sx={{
                flex: 1,
                overflow: 'auto',
                backgroundColor: '#ffffff'
            }}>
                {renderTabContent()}
            </Box>

            {/* Delete Task Dialog */}
            <Dialog
                open={deleteTaskDialog}
                onClose={() => setDeleteTaskDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#111827'
                }}>
                    Delete Follow-Up Task
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Are you sure you want to delete this follow-up task?
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        This action cannot be undone.
                    </Typography>
                    {selectedTask && (
                        <Alert severity="warning" sx={{ mt: 2, fontSize: '12px' }}>
                            <strong>Task:</strong> {selectedTask.title}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button
                        onClick={() => setDeleteTaskDialog(false)}
                        sx={{ fontSize: '12px', textTransform: 'none' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDeleteTask}
                        variant="contained"
                        color="error"
                        sx={{ fontSize: '12px', textTransform: 'none' }}
                    >
                        Delete Task
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create Task Dialog */}
            <Dialog
                open={createTaskDialog}
                onClose={() => setCreateTaskDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                    Create New Follow-Up Task
                </DialogTitle>
                <DialogContent>
                    <CreateTaskForm
                        onSave={handleCreateNewTask}
                        onCancel={() => setCreateTaskDialog(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Create Rule Dialog */}
            <Dialog
                open={createRuleDialog}
                onClose={() => setCreateRuleDialog(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                    Create Automation Rule
                </DialogTitle>
                <DialogContent>
                    <CreateRuleForm
                        onSave={handleCreateNewRule}
                        onCancel={() => setCreateRuleDialog(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Edit Task Dialog */}
            <Dialog
                open={editTaskDialog}
                onClose={() => setEditTaskDialog(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                    Edit Follow-Up Task
                </DialogTitle>
                <DialogContent>
                    <EditTaskForm
                        task={selectedTask}
                        onSave={handleUpdateTask}
                        onCancel={() => setEditTaskDialog(false)}
                    />
                </DialogContent>
            </Dialog>
        </Box>
    );
};

// ===================================================================
// EDIT TASK FORM COMPONENT
// ===================================================================

const EditTaskForm = ({ task, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        title: task?.title || '',
        description: task?.description || '',
        priority: task?.priority || 'medium',
        status: task?.status || 'pending',
        assignedTo: task?.assignedTo || '',
        dueDate: task?.dueDate ? new Date(task.dueDate.toDate?.() || task.dueDate).toISOString().split('T')[0] : '',
        category: task?.category || 'manual'
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...formData,
            dueDate: formData.dueDate ? new Date(formData.dueDate) : null
        });
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={2}>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Task Title"
                        value={formData.title}
                        onChange={(e) => handleChange('title', e.target.value)}
                        required
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Description"
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        multiline
                        rows={3}
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Priority</InputLabel>
                        <Select
                            value={formData.priority}
                            onChange={(e) => handleChange('priority', e.target.value)}
                            label="Priority"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="low" sx={{ fontSize: '12px' }}>Low</MenuItem>
                            <MenuItem value="medium" sx={{ fontSize: '12px' }}>Medium</MenuItem>
                            <MenuItem value="high" sx={{ fontSize: '12px' }}>High</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                        <Select
                            value={formData.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            label="Status"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="pending" sx={{ fontSize: '12px' }}>Pending</MenuItem>
                            <MenuItem value="in_progress" sx={{ fontSize: '12px' }}>In Progress</MenuItem>
                            <MenuItem value="completed" sx={{ fontSize: '12px' }}>Completed</MenuItem>
                            <MenuItem value="cancelled" sx={{ fontSize: '12px' }}>Cancelled</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Assigned To"
                        value={formData.assignedTo}
                        onChange={(e) => handleChange('assignedTo', e.target.value)}
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Due Date"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => handleChange('dueDate', e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>
            </Grid>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
                <Button
                    onClick={onCancel}
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                >
                    Save Changes
                </Button>
            </Box>
        </Box>
    );
};

// ===================================================================
// CREATE TASK FORM COMPONENT
// ===================================================================

const CreateTaskForm = ({ onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        assignedTo: '',
        dueDate: '',
        category: 'manual',
        shipmentId: '',
        selectedShipment: null
    });

    const [shipmentSearchTerm, setShipmentSearchTerm] = useState('');
    const [shipmentOptions, setShipmentOptions] = useState([]);
    const [loadingShipments, setLoadingShipments] = useState(false);

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleShipmentSearch = async (searchTerm) => {
        if (!searchTerm || searchTerm.length < 2) {
            setShipmentOptions([]);
            return;
        }

        setLoadingShipments(true);
        try {
            // Search shipments by ID, reference number, or customer name
            const shipmentsQuery = query(
                collection(db, 'shipments'),
                orderBy('createdAt', 'desc'),
                limit(10)
            );

            const shipmentsSnapshot = await getDocs(shipmentsQuery);
            const shipments = shipmentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(shipment =>
                    shipment.shipmentID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    shipment.referenceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    shipment.shipTo?.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
                );

            setShipmentOptions(shipments);
        } catch (error) {
            console.error('Error searching shipments:', error);
            setShipmentOptions([]);
        } finally {
            setLoadingShipments(false);
        }
    };

    const handleShipmentSelect = (shipment) => {
        setFormData(prev => ({
            ...prev,
            shipmentId: shipment.shipmentID,
            selectedShipment: shipment
        }));
        setShipmentSearchTerm(shipment.shipmentID);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.shipmentId) {
            alert('Please select a shipment for this follow-up task');
            return;
        }
        onSave({
            ...formData,
            dueDate: formData.dueDate ? new Date(formData.dueDate) : null
        });
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={2}>
                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Task Title"
                        value={formData.title}
                        onChange={(e) => handleChange('title', e.target.value)}
                        required
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>

                <Grid item xs={12}>
                    <Typography sx={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#374151',
                        mb: 1
                    }}>
                        Shipment Selection *
                    </Typography>
                </Grid>

                {!formData.selectedShipment ? (
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Search Shipments"
                            value={shipmentSearchTerm}
                            onChange={(e) => {
                                setShipmentSearchTerm(e.target.value);
                                handleShipmentSearch(e.target.value);
                            }}
                            placeholder="Enter shipment ID, Reference, or Customer..."
                            size="small"
                            sx={{
                                '& .MuiInputBase-root': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: loadingShipments && (
                                    <InputAdornment position="end">
                                        <CircularProgress size={16} />
                                    </InputAdornment>
                                )
                            }}
                        />

                        {shipmentOptions.length > 0 && (
                            <Paper sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                                <List dense>
                                    {shipmentOptions.map((shipment) => (
                                        <ListItem
                                            key={shipment.id}
                                            button
                                            onClick={() => handleShipmentSelect(shipment)}
                                            sx={{
                                                '&:hover': { backgroundColor: '#f5f5f5' },
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                            {shipment.shipmentID || shipment.id}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {shipment.shipTo?.companyName || 'Unknown'} • {shipment.referenceNumber || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        Status: {shipment.status || 'Unknown'}
                                                    </Typography>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Paper>
                        )}
                    </Grid>
                ) : (
                    <Grid item xs={12}>
                        <Paper sx={{ p: 2, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                        Selected Shipment: {formData.selectedShipment.shipmentID || formData.selectedShipment.id}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 1 }}>
                                        From: {formData.selectedShipment.shipFrom?.companyName || 'Unknown'}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 1 }}>
                                        To: {formData.selectedShipment.shipTo?.companyName || 'Unknown'}
                                    </Typography>
                                    <Chip
                                        label={formData.selectedShipment.status || 'pending'}
                                        size="small"
                                        sx={{ fontSize: '10px' }}
                                    />
                                </Box>
                                <Button
                                    size="small"
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            shipmentId: '',
                                            selectedShipment: null
                                        }));
                                        setShipmentSearchTerm('');
                                    }}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Change
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>
                )}

                {/* Task Details */}
                <Grid item xs={12}>
                    <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mt: 2 }}>
                        Task Details
                    </Typography>
                </Grid>

                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Task Title"
                        value={formData.title}
                        onChange={(e) => handleChange('title', e.target.value)}
                        required
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                        placeholder="e.g., Contact customer about delivery delay"
                    />
                </Grid>

                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Description"
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        multiline
                        rows={3}
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                        placeholder="Detailed instructions for this follow-up task"
                    />
                </Grid>

                <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                        <Select
                            value={formData.category}
                            onChange={(e) => handleChange('category', e.target.value)}
                            label="Category"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="manual" sx={{ fontSize: '12px' }}>Manual</MenuItem>
                            <MenuItem value="automated" sx={{ fontSize: '12px' }}>Automated</MenuItem>
                            <MenuItem value="scheduled" sx={{ fontSize: '12px' }}>Scheduled</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Priority</InputLabel>
                        <Select
                            value={formData.priority}
                            onChange={(e) => handleChange('priority', e.target.value)}
                            label="Priority"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="low" sx={{ fontSize: '12px' }}>Low</MenuItem>
                            <MenuItem value="medium" sx={{ fontSize: '12px' }}>Medium</MenuItem>
                            <MenuItem value="high" sx={{ fontSize: '12px' }}>High</MenuItem>
                            <MenuItem value="urgent" sx={{ fontSize: '12px' }}>Urgent</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Assigned To"
                        value={formData.assignedTo}
                        onChange={(e) => handleChange('assignedTo', e.target.value)}
                        required
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>

                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Due Date"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => handleChange('dueDate', e.target.value)}
                        required
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 1, mt: 4, justifyContent: 'flex-end' }}>
                <Button
                    onClick={onCancel}
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={!formData.title || !formData.selectedShipment}
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                >
                    Create Task
                </Button>
            </Box>
        </Box>
    );
};

// ===================================================================
// CREATE RULE FORM COMPONENT
// ===================================================================

const CreateRuleForm = ({ onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        active: true,
        scope: {
            type: 'all_shipments', // all_shipments, specific_company, shipment_type, service_level, carrier, conditions
            companyId: '',
            shipmentType: '',
            serviceLevel: '',
            carrier: '',
            conditions: []
        },
        timing: {
            trigger: 'status_change', // status_change, time_before_eta, time_after_eta, fixed_time, manual
            statusChange: {
                fromStatus: '',
                toStatus: ''
            },
            timeOffset: {
                value: 1,
                unit: 'hours' // minutes, hours, days
            },
            fixedTime: ''
        },
        checkpoints: {
            statusChecks: [],
            timeChecks: [],
            conditionChecks: []
        },
        taskTemplate: {
            title: '',
            description: '',
            priority: 'medium',
            category: 'automated',
            assignmentRules: {
                type: 'specific_user', // specific_user, role_based, round_robin, load_balanced
                assignTo: '',
                role: '',
                department: ''
            }
        }
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleScopeChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            scope: {
                ...prev.scope,
                [field]: value
            }
        }));
    };

    const handleTimingChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            timing: {
                ...prev.timing,
                [field]: value
            }
        }));
    };

    const handleCheckpointChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            checkpoints: {
                ...prev.checkpoints,
                [field]: value
            }
        }));
    };

    const handleAssignmentChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            taskTemplate: {
                ...prev.taskTemplate,
                assignmentRules: {
                    ...prev.taskTemplate.assignmentRules,
                    [field]: value
                }
            }
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <Grid container spacing={3}>
                {/* Basic Information */}
                <Grid item xs={12}>
                    <Accordion defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                Basic Information
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label="Rule Name"
                                        value={formData.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        required
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={formData.active}
                                                onChange={(e) => handleChange('active', e.target.checked)}
                                                size="small"
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Active</Typography>}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Description"
                                        value={formData.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        multiline
                                        rows={2}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Rule Scope */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                Rule Scope
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Apply To</InputLabel>
                                        <Select
                                            value={formData.scope.type}
                                            onChange={(e) => handleScopeChange('type', e.target.value)}
                                            label="Apply To"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="all_shipments" sx={{ fontSize: '12px' }}>All Shipments</MenuItem>
                                            <MenuItem value="specific_company" sx={{ fontSize: '12px' }}>Specific Company</MenuItem>
                                            <MenuItem value="shipment_type" sx={{ fontSize: '12px' }}>Shipment Type</MenuItem>
                                            <MenuItem value="service_level" sx={{ fontSize: '12px' }}>Service Level</MenuItem>
                                            <MenuItem value="carrier" sx={{ fontSize: '12px' }}>Specific Carrier</MenuItem>
                                            <MenuItem value="conditions" sx={{ fontSize: '12px' }}>Custom Conditions</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {formData.scope.type === 'shipment_type' && (
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>Shipment Type</InputLabel>
                                            <Select
                                                value={formData.scope.shipmentType}
                                                onChange={(e) => handleScopeChange('shipmentType', e.target.value)}
                                                label="Shipment Type"
                                                sx={{ fontSize: '12px' }}
                                            >
                                                <MenuItem value="courier" sx={{ fontSize: '12px' }}>Courier</MenuItem>
                                                <MenuItem value="freight" sx={{ fontSize: '12px' }}>Freight</MenuItem>
                                                <MenuItem value="ltl" sx={{ fontSize: '12px' }}>LTL</MenuItem>
                                                <MenuItem value="ftl" sx={{ fontSize: '12px' }}>FTL</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                )}

                                {formData.scope.type === 'carrier' && (
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            label="Carrier Name"
                                            value={formData.scope.carrier}
                                            onChange={(e) => handleScopeChange('carrier', e.target.value)}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-root': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                        />
                                    </Grid>
                                )}
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Timing & Triggers */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                Timing & Triggers
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Trigger Type</InputLabel>
                                        <Select
                                            value={formData.timing.trigger}
                                            onChange={(e) => handleTimingChange('trigger', e.target.value)}
                                            label="Trigger Type"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="status_change" sx={{ fontSize: '12px' }}>Status Change</MenuItem>
                                            <MenuItem value="time_before_eta" sx={{ fontSize: '12px' }}>Time Before ETA</MenuItem>
                                            <MenuItem value="time_after_eta" sx={{ fontSize: '12px' }}>Time After ETA</MenuItem>
                                            <MenuItem value="fixed_time" sx={{ fontSize: '12px' }}>Fixed Time</MenuItem>
                                            <MenuItem value="manual" sx={{ fontSize: '12px' }}>Manual Trigger</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {(formData.timing.trigger === 'time_before_eta' || formData.timing.trigger === 'time_after_eta') && (
                                    <>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Time Value"
                                                type="number"
                                                value={formData.timing.timeOffset.value}
                                                onChange={(e) => handleTimingChange('timeOffset', {
                                                    ...formData.timing.timeOffset,
                                                    value: parseInt(e.target.value) || 1
                                                })}
                                                size="small"
                                                sx={{
                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                }}
                                                inputProps={{ min: 1 }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>Unit</InputLabel>
                                                <Select
                                                    value={formData.timing.timeOffset.unit}
                                                    onChange={(e) => handleTimingChange('timeOffset', {
                                                        ...formData.timing.timeOffset,
                                                        unit: e.target.value
                                                    })}
                                                    label="Unit"
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    <MenuItem value="minutes" sx={{ fontSize: '12px' }}>Minutes</MenuItem>
                                                    <MenuItem value="hours" sx={{ fontSize: '12px' }}>Hours</MenuItem>
                                                    <MenuItem value="days" sx={{ fontSize: '12px' }}>Days</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </>
                                )}

                                {formData.timing.trigger === 'fixed_time' && (
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            label="Time"
                                            type="time"
                                            value={formData.timing.fixedTime}
                                            onChange={(e) => handleTimingChange('fixedTime', e.target.value)}
                                            size="small"
                                            InputLabelProps={{ shrink: true }}
                                            sx={{
                                                '& .MuiInputBase-root': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                        />
                                    </Grid>
                                )}
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Checkpoint Configuration */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                Task to Create
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Task Title"
                                        value={formData.checkpoint.name}
                                        onChange={(e) => handleCheckpointChange('name', e.target.value)}
                                        required
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                        placeholder="e.g., Contact customer about delayed delivery"
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Task Description"
                                        value={formData.checkpoint.description}
                                        onChange={(e) => handleCheckpointChange('description', e.target.value)}
                                        multiline
                                        rows={2}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                        placeholder="Detailed instructions for the task"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Category</InputLabel>
                                        <Select
                                            value={formData.checkpoint.category}
                                            onChange={(e) => handleCheckpointChange('category', e.target.value)}
                                            label="Category"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="delivery" sx={{ fontSize: '12px' }}>Delivery</MenuItem>
                                            <MenuItem value="pickup" sx={{ fontSize: '12px' }}>Pickup</MenuItem>
                                            <MenuItem value="documentation" sx={{ fontSize: '12px' }}>Documentation</MenuItem>
                                            <MenuItem value="customer_service" sx={{ fontSize: '12px' }}>Customer Service</MenuItem>
                                            <MenuItem value="billing" sx={{ fontSize: '12px' }}>Billing</MenuItem>
                                            <MenuItem value="exception" sx={{ fontSize: '12px' }}>Exception Handling</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Priority</InputLabel>
                                        <Select
                                            value={formData.checkpoint.priority}
                                            onChange={(e) => handleCheckpointChange('priority', e.target.value)}
                                            label="Priority"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="low" sx={{ fontSize: '12px' }}>Low</MenuItem>
                                            <MenuItem value="medium" sx={{ fontSize: '12px' }}>Medium</MenuItem>
                                            <MenuItem value="high" sx={{ fontSize: '12px' }}>High</MenuItem>
                                            <MenuItem value="urgent" sx={{ fontSize: '12px' }}>Urgent</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Assignment */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                Task Assignment
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Assignment Type</InputLabel>
                                        <Select
                                            value={formData.assignment.type}
                                            onChange={(e) => handleAssignmentChange('type', e.target.value)}
                                            label="Assignment Type"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="specific_user" sx={{ fontSize: '12px' }}>Specific User</MenuItem>
                                            <MenuItem value="role_based" sx={{ fontSize: '12px' }}>Role Based</MenuItem>
                                            <MenuItem value="round_robin" sx={{ fontSize: '12px' }}>Round Robin</MenuItem>
                                            <MenuItem value="load_balanced" sx={{ fontSize: '12px' }}>Load Balanced</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        label={formData.assignment.type === 'specific_user' ? 'User Email' :
                                            formData.assignment.type === 'role_based' ? 'Role' : 'Team'}
                                        value={formData.assignment.value}
                                        onChange={(e) => handleAssignmentChange('value', e.target.value)}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                        placeholder={
                                            formData.assignment.type === 'specific_user' ? 'user@company.com' :
                                                formData.assignment.type === 'role_based' ? 'customer_service' : 'team_name'
                                        }
                                    />
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 1, mt: 4, justifyContent: 'flex-end' }}>
                <Button
                    onClick={onCancel}
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    sx={{ fontSize: '12px', textTransform: 'none' }}
                >
                    Create Rule
                </Button>
            </Box>
        </Box>
    );
};

export default FollowUpsDashboard; 