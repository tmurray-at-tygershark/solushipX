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
    List as ListIcon,
    ViewList as ViewListIcon,
    Avatar as AvatarIcon
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import ModalHeader from '../common/ModalHeader';
import EnhancedStatusChip from '../StatusChip/EnhancedStatusChip';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { collection, getDocs, getDoc, doc, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCircleLogo } from '../../utils/logoUtils';
import LoadingSkeleton from '../ShipmentDetail/components/LoadingSkeleton';

// ===================================================================
// MAIN DASHBOARD COMPONENT
// ===================================================================

// embedded: when true, this panel is rendered inside another modal (e.g., ShipmentDetailX)
// In embedded mode we suppress the internal ModalHeader to avoid double headers
const FollowUpsDashboard = ({ isModal = false, onClose, scopeShipmentId = null, scopeCompanyId = null, scopeShipmentData = null, autoOpenCreate = false, embedded = false }) => {
    const { currentUser: user, userRole, loading: authLoading } = useAuth();
    const { companyIdForAddress, companyData } = useCompany();
    // Admin view is strictly based on being inside an /admin route, regardless of user role
    const isAdminView = (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'));

    // State Management
    const [selectedTab, setSelectedTab] = useState('tasks');
    const [tasks, setTasks] = useState([]);
    const [rules, setRules] = useState([]);
    const [staff, setStaff] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [expandedDescriptions, setExpandedDescriptions] = useState({});
    const toggleDescription = (taskId) => {
        setExpandedDescriptions(prev => ({ ...prev, [taskId]: !prev[taskId] }));
    };

    // Company & Customer Management
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState('all');
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Shipment data for task context
    const [shipmentData, setShipmentData] = useState({});

    // Predefined Task Templates
    const [taskTemplates, setTaskTemplates] = useState({});
    const [taskTemplatesLoading, setTaskTemplatesLoading] = useState(false);

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
    const [editRuleDialog, setEditRuleDialog] = useState(false);
    const [ruleBeingEdited, setRuleBeingEdited] = useState(null);
    const [taskDetailDialog, setTaskDetailDialog] = useState(false);
    const [editTaskDialog, setEditTaskDialog] = useState(false);
    const [deleteTaskDialog, setDeleteTaskDialog] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    // Status menu state for inline edits (table and header)
    const [statusMenu, setStatusMenu] = useState({ anchorEl: null, task: null });



    // Map of customers by Firestore document id for quick lookup
    const customersMap = useMemo(() => {
        const map = {};
        for (const c of availableCustomers) {
            map[c.id] = c;
        }
        return map;
    }, [availableCustomers]);

    // Date parsing helper for tasks (must be declared BEFORE any usage)
    const toSafeDate = (value) => {
        try {
            if (!value) return null;
            if (value instanceof Date) {
                return isNaN(value.getTime()) ? null : value;
            }
            if (value.toDate && typeof value.toDate === 'function') return value.toDate();
            // Support both Firestore Timestamp shape and callable-serialized shape
            if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
            if (typeof value._seconds === 'number') return new Date(value._seconds * 1000);
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        } catch {
            return null;
        }
    };

    // Stable task comparator to avoid TDZ issues in inline sort callbacks
    const compareTasksForSort = useCallback((taskA, taskB, sortKey, order) => {
        const direction = order === 'asc' ? 1 : -1;

        const safeDate = (v) => {
            const d = toSafeDate(v);
            return d && !isNaN(d.getTime()) ? d : null;
        };

        if (sortKey === 'dueDate') {
            const aDate = safeDate(taskA.dueDate);
            const bDate = safeDate(taskB.dueDate);
            if (!aDate && !bDate) return 0;
            if (!aDate) return 1; // nulls last
            if (!bDate) return -1;
            if (aDate.getTime() < bDate.getTime()) return -1 * direction;
            if (aDate.getTime() > bDate.getTime()) return 1 * direction;
            return 0;
        }

        if (sortKey === 'priority') {
            const rank = { urgent: 4, high: 3, medium: 2, low: 1 };
            const aRank = rank[String(taskA.priority || 'low').toLowerCase()] || 1;
            const bRank = rank[String(taskB.priority || 'low').toLowerCase()] || 1;
            if (aRank < bRank) return -1 * direction;
            if (aRank > bRank) return 1 * direction;
            return 0;
        }

        if (sortKey === 'status') {
            const aStr = String(taskA.status || '').toLowerCase();
            const bStr = String(taskB.status || '').toLowerCase();
            if (aStr < bStr) return -1 * direction;
            if (aStr > bStr) return 1 * direction;
            return 0;
        }

        if (sortKey === 'title') {
            const aStr = String(taskA.title || '').toLowerCase();
            const bStr = String(taskB.title || '').toLowerCase();
            if (aStr < bStr) return -1 * direction;
            if (aStr > bStr) return 1 * direction;
            return 0;
        }

        // Default to createdAt (fallback to dueDate)
        const aCreated = safeDate(taskA.createdAt) || safeDate(taskA.dueDate);
        const bCreated = safeDate(taskB.createdAt) || safeDate(taskB.dueDate);
        if (!aCreated && !bCreated) return 0;
        if (!aCreated) return 1;
        if (!bCreated) return -1;
        if (aCreated.getTime() < bCreated.getTime()) return -1 * direction;
        if (aCreated.getTime() > bCreated.getTime()) return 1 * direction;
        return 0;
    }, []);

    // Apply filters to tasks
    const filteredTasks = useMemo(() => {
        let filtered = [...tasks];

        // If scoped to a specific shipment, enforce shipment-level filtering
        if (scopeShipmentId) {
            filtered = filtered.filter(t => t.shipmentId === scopeShipmentId);
        }

        // Lock company context for non-admin routes: ensure only tasks from the locked company are shown
        if (!isAdminView) {
            const lockedCompanyId = selectedCompanyId === 'all' ? companyIdForAddress : selectedCompanyId;
            if (lockedCompanyId) {
                filtered = filtered.filter(t => (t.companyId === lockedCompanyId));
            }
        }

        // Apply search term filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(task => {
                const shipment = shipmentData[task.shipmentId];
                return (
                    task.title?.toLowerCase().includes(searchLower) ||
                    task.description?.toLowerCase().includes(searchLower) ||
                    task.shipmentId?.toLowerCase().includes(searchLower) ||
                    shipment?.shipmentID?.toLowerCase().includes(searchLower)
                );
            });
        }

        // Apply status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter(task => task.status === filters.status);
        }

        // Apply priority filter
        if (filters.priority !== 'all') {
            filtered = filtered.filter(task => task.priority === filters.priority);
        }

        // Apply assigned to filter
        if (filters.assignedTo !== 'all') {
            if (filters.assignedTo === 'unassigned') {
                filtered = filtered.filter(task => !task.assignedTo);
            } else {
                filtered = filtered.filter(task => task.assignedTo === filters.assignedTo);
            }
        }

        // Apply category filter
        if (filters.category !== 'all') {
            filtered = filtered.filter(task => task.category === filters.category);
        }

        // Apply due date filter
        if (filters.dueDate !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            // Get start and end of current week (Sunday to Saturday)
            const currentDay = now.getDay();
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - currentDay);
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 7);

            // Get start and end of next week
            const startOfNextWeek = new Date(endOfWeek);
            const endOfNextWeek = new Date(startOfNextWeek);
            endOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

            filtered = filtered.filter(task => {
                const dueDate = toSafeDate(task.dueDate);
                if (!dueDate || isNaN(dueDate.getTime())) return false;

                switch (filters.dueDate) {
                    case 'today':
                        return dueDate >= today && dueDate < tomorrow;
                    case 'tomorrow':
                        return dueDate >= tomorrow && dueDate < dayAfterTomorrow;
                    case 'overdue':
                        return task.status !== 'completed' && dueDate < now;
                    case 'this_week':
                        return dueDate >= startOfWeek && dueDate < endOfWeek;
                    case 'next_week':
                        return dueDate >= startOfNextWeek && dueDate < endOfNextWeek;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting using stable comparator
        filtered.sort((a, b) => compareTasksForSort(a, b, sortBy, sortOrder));

        return filtered;
    }, [tasks, filters, searchTerm, sortBy, sortOrder, shipmentData, scopeShipmentId, isAdminView, selectedCompanyId, companyIdForAddress]);

    // Reset page when filters change to avoid showing empty pages
    useEffect(() => {
        setPage(0);
    }, [filters, searchTerm, scopeShipmentId]);

    // Cross-company customer cache for correct owner resolution
    const [customerCache, setCustomerCache] = useState({}); // key: resolvedCustomerId -> customer doc

    // Resolve primary customer ID similar to ShipmentTableRow main table logic (NEVER use shipTo address)
    const getResolvedCustomerId = (shipment, task) => {
        return (
            task?.customerId ||
            shipment?.customerId ||
            shipment?.customerID ||
            shipment?.customer?.id ||
            shipment?.shipFrom?.customerID ||
            shipment?.shipFrom?.customerId ||
            shipment?.shipFrom?.addressClassID ||
            null
        );
    };

    // Fetch and cache customer by ID (tries customerID field, then document ID)
    const resolveAndCacheCustomer = useCallback(async (customerId) => {
        if (!customerId || customerCache[customerId] === null || customerCache[customerId]) return;
        try {
            // Try by business customerID
            const q = query(collection(db, 'customers'), where('customerID', '==', customerId), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const d = snap.docs[0];
                setCustomerCache(prev => ({ ...prev, [customerId]: { id: d.id, ...d.data() } }));
                return;
            }
            // Fallback to direct doc ID
            try {
                const ref = doc(db, 'customers', customerId);
                const docSnap = await getDoc(ref);
                if (docSnap.exists()) {
                    setCustomerCache(prev => ({ ...prev, [customerId]: { id: docSnap.id, ...docSnap.data() } }));
                    return;
                }
            } catch { }
            // Mark as not found to avoid refetch loops
            setCustomerCache(prev => ({ ...prev, [customerId]: null }));
        } catch {
            setCustomerCache(prev => ({ ...prev, [customerId]: null }));
        }
    }, [customerCache]);

    // Helper to provide display info for customer column
    const getTaskCustomerInfo = (task, shipment) => {
        // 1) Prefer explicit task.customerId if available
        if (task?.customerId && customersMap[task.customerId]) {
            const c = customersMap[task.customerId];
            return { name: c.name || '—', logo: c.logo || c.logoUrl || c.customerLogo || null };
        }
        // 2) Resolve proper owner customer ID from shipment/customer fields (NOT shipTo)
        const resolvedId = getResolvedCustomerId(shipment, task);
        if (resolvedId) {
            const cached = customerCache[resolvedId];
            if (cached) {
                return { name: cached.name || cached.companyName || '—', logo: cached.logo || cached.logoUrl || cached.customerLogo || null };
            }
            // Kick off async resolve; return placeholder for now
            resolveAndCacheCustomer(resolvedId);
            // Try availableCustomers by business ID
            const fallback = availableCustomers.find(c => c.customerID === resolvedId || c.id === resolvedId);
            if (fallback) {
                return { name: fallback.name || '—', logo: fallback.logo || fallback.logoUrl || fallback.customerLogo || null };
            }
        }
        // 3) Last resort placeholder
        return { name: '—', logo: null };
    };

    // Statistics
    const [stats, setStats] = useState({
        totalTasks: 0,
        dueToday: 0,
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
            // Only populate customers when a specific company is selected
            if (selectedCompanyId === 'all') {
                setAvailableCustomers([]);
                return;
            }

            setLoadingCustomers(true);
            try {
                const targetCompanyId = selectedCompanyId;

                if (targetCompanyId) {
                    // Try primary field companyId first
                    const byCompanyIdQuery = query(
                        collection(db, 'customers'),
                        where('companyId', '==', targetCompanyId),
                        orderBy('name')
                    );
                    const byCompanyIdSnap = await getDocs(byCompanyIdQuery);
                    let customers = byCompanyIdSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Fallback to legacy field companyID
                    if (customers.length === 0) {
                        const byCompanyIDQuery = query(
                            collection(db, 'customers'),
                            where('companyID', '==', targetCompanyId),
                            orderBy('name')
                        );
                        const byCompanyIDSnap = await getDocs(byCompanyIDQuery);
                        customers = byCompanyIDSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    }

                    setAvailableCustomers(customers || []);
                }
            } catch (error) {
                console.error('Error loading customers:', error);
                setAvailableCustomers([]);
            } finally {
                setLoadingCustomers(false);
            }
        };

        loadCustomers();
    }, [selectedCompanyId]);

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
                    // Dual lookup: try as Firestore document ID, then as business shipmentID field
                    const byDocRef = doc(db, 'shipments', shipmentId);
                    const byDocSnap = await getDoc(byDocRef);
                    if (byDocSnap.exists()) {
                        return { id: shipmentId, data: { id: byDocSnap.id, ...byDocSnap.data() } };
                    }

                    const byFieldSnapshot = await getDocs(query(
                        collection(db, 'shipments'),
                        where('shipmentID', '==', shipmentId),
                        limit(1)
                    ));

                    if (!byFieldSnapshot.empty) {
                        return {
                            id: shipmentId,
                            data: { id: byFieldSnapshot.docs[0].id, ...byFieldSnapshot.docs[0].data() }
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

            // Determine company filter based on route context
            // On non-admin routes (regular dashboard), ALWAYS lock to dashboard company context
            let targetCompanyId = null;
            if (!isAdminView) {
                targetCompanyId = companyIdForAddress || (selectedCompanyId !== 'all' ? selectedCompanyId : null);
            } else {
                // Admin routes preserve existing behavior
                if (selectedCompanyId === 'all') {
                    targetCompanyId = (userRole === 'superadmin') ? null : null; // backend enforces admin scope
                } else {
                    targetCompanyId = selectedCompanyId; // Specific admin-selected company
                }
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
                shipmentId: scopeShipmentId || null,
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
            try {
                console.log('[FollowUps] Loaded tasks count:', loadedTasks.length);
                loadedTasks.slice(0, 50).forEach(t => {
                    const kind = t?.dueDate?.toDate ? 'Timestamp' : typeof t?.dueDate;
                    console.log('[FollowUps] Task', t.id, 'dueDate raw:', t?.dueDate, 'kind:', kind);
                });
            } catch { }
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

    // Load predefined task templates
    const loadTaskTemplates = async () => {
        try {
            setTaskTemplatesLoading(true);
            const getEnabledFollowUpTasks = httpsCallable(functions, 'getEnabledFollowUpTasks');
            const result = await getEnabledFollowUpTasks();

            if (result.data && result.data.tasksByCategory) {
                setTaskTemplates(result.data.tasksByCategory);
            } else {
                setTaskTemplates({});
            }
        } catch (error) {
            console.error('Error loading task templates:', error);
            setTaskTemplates({});
        } finally {
            setTaskTemplatesLoading(false);
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
        const dueToday = taskArray.filter(task => {
            const d = task.dueDate?.toDate?.() || new Date(task.dueDate);
            if (!d || isNaN(d.getTime())) return false;
            const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return dd.getTime() === today.getTime() && task.status !== 'completed';
        }).length;
        const overdueTasks = taskArray.filter(task => {
            const dueDate = task.dueDate?.toDate?.() || new Date(task.dueDate);
            return task.status !== 'completed' && dueDate < now;
        }).length;
        const completedToday = taskArray.filter(task => {
            const completedDate = task.completedAt?.toDate?.() || new Date(task.completedAt);
            return task.status === 'completed' && completedDate >= today;
        }).length;
        const activeRules = rulesArray.filter(rule => (rule.isActive === true) || (rule.active === true)).length;

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
            dueToday,
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
            loadTaskTemplates();
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

    // Auto-open create dialog when requested (e.g., from ShipmentDetailX New Task)
    useEffect(() => {
        if (autoOpenCreate) {
            setCreateTaskDialog(true);
        }
    }, [autoOpenCreate]);

    const handleCreateRule = () => {
        setCreateRuleDialog(true);
    };

    const handleTaskClick = (task) => {
        setSelectedTask(task);
        setTaskDetailDialog(true);
    };

    const handleEditTask = (task) => {
        // Attach shipment context if available for quick actions
        const enriched = { ...task };
        if (task?.shipmentId && shipmentData[task.shipmentId]) {
            enriched.shipment = shipmentData[task.shipmentId];
        }
        setSelectedTask(enriched);
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
            // Build safe payload
            const payload = {
                taskId: selectedTask.id,
                shipmentId: (updatedTaskData.shipmentId ?? selectedTask.shipmentId ?? selectedTask?.shipment?.id) || null,
                title: updatedTaskData.title ?? selectedTask.title,
                description: updatedTaskData.description ?? selectedTask.description,
                priority: updatedTaskData.priority ?? selectedTask.priority,
                status: updatedTaskData.status ?? selectedTask.status,
                assignedTo: updatedTaskData.assignedTo ?? selectedTask.assignedTo,
                category: updatedTaskData.category ?? selectedTask.category,
                // Persist company/customer ownership
                companyId: updatedTaskData.companyId ?? selectedTask.companyId ?? null,
                customerId: updatedTaskData.customerId ?? selectedTask.customerId ?? null,
                // Backend expects actionTypes, not 'actions'
                actionTypes: Array.isArray(updatedTaskData.actions) ? updatedTaskData.actions : (selectedTask.actionTypes || []),
                // Pass through reminders array if present (backend may use it for future scheduling)
                reminders: Array.isArray(updatedTaskData.reminders) ? updatedTaskData.reminders : (selectedTask.reminders || []),
            };

            // Combine due date + time if provided from Edit form (handle date-only, time-only, both, or none)
            const existingDue = toSafeDate(selectedTask?.dueDate);
            if (updatedTaskData.dueDate instanceof Date) {
                payload.dueDate = updatedTaskData.dueDate;
            } else if (typeof updatedTaskData.dueDate === 'string' && updatedTaskData.dueDate) {
                const [hh = existingDue ? String(existingDue.getHours()).padStart(2, '0') : '09', mm = existingDue ? String(existingDue.getMinutes()).padStart(2, '0') : '00'] = (updatedTaskData.dueTime || '').split(':');
                const base = new Date(updatedTaskData.dueDate + 'T00:00:00');
                if (!isNaN(base.getTime())) { base.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0); payload.dueDate = base; }
            } else if (typeof updatedTaskData.dueTime === 'string' && updatedTaskData.dueTime && existingDue) {
                const base = new Date(existingDue);
                const [hh = '09', mm = '00'] = updatedTaskData.dueTime.split(':');
                base.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
                if (!isNaN(base.getTime())) payload.dueDate = base;
            }

            console.log('[FollowUps] Update payload:', payload);
            if (payload.dueDate) {
                try { console.log('[FollowUps] dueDate toISOString:', new Date(payload.dueDate).toISOString()); } catch { }
            } else {
                console.log('[FollowUps] dueDate missing in payload; strings:', payload.dueDateString, payload.dueTimeString);
            }

            // Keep backend schedulers aligned
            if (payload.dueDate) {
                payload.scheduledFor = payload.dueDate;
            }
            const updateFollowUpTask = httpsCallable(functions, 'updateFollowUpTask');
            const result = await updateFollowUpTask(payload);
            console.log('[FollowUps] updateFollowUpTask result:', result?.data || result);
            try {
                const postRef = doc(db, 'followUpTasks', selectedTask.id);
                const postSnap = await getDoc(postRef);
                const postData = postSnap.exists() ? postSnap.data() : null;
                const postDue = postData?.dueDate?.toDate?.() || new Date(postData?.dueDate);
                console.log('[FollowUps] Post-save Firestore doc:', { id: selectedTask.id, dueRaw: postData?.dueDate, dueParsed: postDue && !isNaN(postDue) ? postDue.toISOString() : null });
            } catch (e) {
                console.warn('[FollowUps] Post-save doc fetch failed:', e);
            }

            // Optimistically update list to reflect changes immediately
            setTasks(prev => prev.map(t => (t.id === selectedTask.id ? { ...t, ...payload } : t)));

            setEditTaskDialog(false);
            setSelectedTask(null);
            refreshData();
        } catch (error) {
            console.error('Error updating task:', error);
            alert('Failed to update task. Please try again.');
        }
    };

    // Inline updater that does not depend on selectedTask (e.g., header status dropdown)
    const handleInlineUpdateTask = async (task, partialUpdate) => {
        if (!task?.id) return;
        try {
            const payload = {
                taskId: task.id,
                ...partialUpdate,
            };
            if (task.shipmentId) payload.shipmentId = task.shipmentId;
            const updateFollowUpTask = httpsCallable(functions, 'updateFollowUpTask');
            await updateFollowUpTask(payload);
            setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, ...partialUpdate } : t)));
        } catch (error) {
            console.error('Inline update failed:', error);
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

    // Lock company context for non-admin front-end dashboard usage
    useEffect(() => {
        // Lock to dashboard company context whenever not inside /admin routes
        if (!isAdminView && companyIdForAddress) {
            setSelectedCompanyId(companyIdForAddress);
        }
    }, [isAdminView, companyIdForAddress]);

    const refreshData = () => {
        loadTasks();
        loadRules();
        loadStaff();
        loadShipments();
        loadTaskTemplates();
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
                }} onClick={() => {
                    // Filter to due today
                    setFilters(prev => ({ ...prev, dueDate: 'today' }));
                    setSelectedTab('tasks');
                }} sx-prop-ignored>
                    <CardContent sx={{ p: 2, cursor: 'pointer' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <ScheduleIcon sx={{ color: '#f59e0b', mr: 1, fontSize: '20px' }} />
                            <Typography sx={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#6b7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                Due Today
                            </Typography>
                        </Box>
                        <Typography sx={{
                            fontSize: '24px',
                            fontWeight: 600,
                            color: '#111827'
                        }}>
                            {stats.dueToday}
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
                }} onClick={() => { setFilters(prev => ({ ...prev, dueDate: 'overdue' })); setSelectedTab('tasks'); }}>
                    <CardContent sx={{ p: 2, cursor: 'pointer' }}>
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
                }} onClick={() => { setFilters(prev => ({ ...prev, status: 'completed' })); setSelectedTab('tasks'); }}>
                    <CardContent sx={{ p: 2, cursor: 'pointer' }}>
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



    // Task status chip styling (TASK status, not shipment status)
    const getTaskStatusChipStyle = (status) => {
        const s = (status || 'pending').toLowerCase();
        switch (s) {
            case 'in_progress':
                return { label: 'In Progress', bg: '#dbeafe', fg: '#1d4ed8' };
            case 'completed':
                return { label: 'Completed', bg: '#dcfce7', fg: '#16a34a' };
            case 'cancelled':
                return { label: 'Cancelled', bg: '#e5e7eb', fg: '#374151' };
            case 'pending':
            default:
                return { label: 'Pending', bg: '#fff6d6', fg: '#c9895e' };
        }
    };

    // Enhanced task card with professional styling and comprehensive information
    const renderTaskCard = (task) => {
        const shipment = shipmentData[task.shipmentId];
        const dueDateObj = toSafeDate(task.dueDate);

        return (
            <Card
                key={task.id}
                sx={{
                    mb: 2,
                    border: '1px solid #e5e7eb',
                    borderTop: `2px solid ${task.status === 'completed' ? '#16a34a' : task.status === 'in_progress' ? '#3b82f6' : task.status === 'cancelled' ? '#6b7280' : '#d97706'}`,
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
                <CardContent sx={{ p: 2 }} onClick={() => handleTaskClick(task)}>
                    {/* Task Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography sx={{
                            fontWeight: 600,
                            fontSize: '14px',
                            color: '#111827',
                            fontFamily: 'monospace'
                        }}>
                            {shipment?.shipmentID || task.shipmentId || '—'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                            {/* Inline status dropdown */}
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                                <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                <Select
                                    value={task.status || 'pending'}
                                    onChange={(e) => handleInlineUpdateTask(task, { status: e.target.value })}
                                    label="Status"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="pending" sx={{ fontSize: '12px' }}>Pending</MenuItem>
                                    <MenuItem value="in_progress" sx={{ fontSize: '12px' }}>In Progress</MenuItem>
                                    <MenuItem value="completed" sx={{ fontSize: '12px' }}>Completed</MenuItem>
                                    <MenuItem value="cancelled" sx={{ fontSize: '12px' }}>Cancelled</MenuItem>
                                </Select>
                            </FormControl>
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
                            {/* Status chip removed in favor of dropdown */}
                        </Box>
                    </Box>

                    {/* Shipment Information Section - moved above description */}
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

                            {/* Shipment Status / Tracking / Key Refs */}
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
                                {/* Compact refs display */}
                                {(() => {
                                    try {
                                        const refs = [];
                                        const pushVal = (v) => { if (!v) return; if (Array.isArray(v)) { v.forEach(pushVal); return; } if (typeof v === 'object') { if (v.referenceNumber) pushVal(v.referenceNumber); if (v.value) pushVal(v.value); return; } refs.push(String(v)); };
                                        pushVal(shipment.referenceNumber);
                                        pushVal(shipment.referenceNumbers);
                                        pushVal(shipment.shipmentInfo?.shipperReferenceNumber);
                                        pushVal(shipment.shipmentInfo?.bookingReferenceNumber);
                                        pushVal(shipment.selectedRate?.referenceNumber);
                                        pushVal(shipment.customerReferenceNumber);
                                        pushVal(shipment.poNumber);
                                        pushVal(shipment.orderNumber);
                                        const unique = Array.from(new Set(refs)).filter(Boolean).slice(0, 4);
                                        return unique.length ? (
                                            <Typography sx={{ fontSize: '9px', color: '#6b7280' }}>
                                                Ref: {unique.join(', ')}
                                            </Typography>
                                        ) : null;
                                    } catch { return null; }
                                })()}
                            </Box>
                        </Box>
                    )}

                    {/* Task Description (collapsible) */}
                    <Typography sx={{
                        fontSize: '12px',
                        color: '#6b7280',
                        mb: 2,
                        lineHeight: 1.4
                    }}>
                        {(expandedDescriptions[task.id] || !task?.description || task.description.length <= 180)
                            ? (task.description || '')
                            : `${task.description.substring(0, 180)}…`}
                    </Typography>
                    {(task?.description?.length || 0) > 180 && (
                        <Box sx={{ mb: 2 }}>
                            <Button size="small" onClick={(e) => { e.stopPropagation(); toggleDescription(task.id); }} sx={{ textTransform: 'none', fontSize: '11px', px: 0 }}>
                                {expandedDescriptions[task.id] ? 'Show less' : 'Show more'}
                            </Button>
                        </Box>
                    )}

                    {/* Task Footer */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {task.shipmentId && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <ShipmentIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                        {shipment?.shipmentID || task.shipmentId}
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
                            {task.dueDate && dueDateObj && (
                                <Typography sx={{
                                    fontSize: '11px',
                                    color: dueDateObj < new Date() ? '#dc2626' : '#6b7280'
                                }}>
                                    Due: {dueDateObj.toLocaleDateString()}
                                </Typography>
                            )}
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                startIcon={<ViewIcon sx={{ fontSize: '16px' }} />}
                                sx={{ textTransform: 'none', fontSize: '11px' }}
                            >
                                View
                            </Button>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        );
    };

    // Enhanced tasks list with professional styling
    const renderTasksList = () => (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
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

            {/* Company/Customer row placed above filters */}
            {!scopeShipmentId && renderCompanyCustomerFilters()}

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
                    <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                    <Select
                        value={filters.category}
                        onChange={(e) => handleFilterChange('category', e.target.value)}
                        label="Type"
                        sx={{ fontSize: '12px' }}
                    >
                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Types</MenuItem>
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

                {/* Clear Filters Button */}
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ClearIcon />}
                    onClick={() => {
                        setFilters({
                            status: 'all',
                            priority: 'all',
                            assignedTo: 'all',
                            category: 'all',
                            dueDate: 'all'
                        });
                        setSearchTerm('');
                        setPage(0);
                    }}
                    sx={{
                        fontSize: '12px',
                        color: '#6b7280',
                        borderColor: '#d1d5db',
                        '&:hover': {
                            borderColor: '#9ca3af',
                            backgroundColor: '#f9fafb'
                        }
                    }}
                >
                    Clear Filters
                </Button>
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
            ) : filteredTasks.length === 0 ? (
                <Paper sx={{
                    p: 4,
                    textAlign: 'center',
                    border: '1px solid #e5e7eb',
                    boxShadow: 'none',
                    backgroundColor: '#f9fafb'
                }}>
                    <FilterIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                    <Typography sx={{
                        fontSize: '14px',
                        color: '#6b7280',
                        mb: 1
                    }}>
                        No tasks match your current filters
                    </Typography>
                    <Typography sx={{
                        fontSize: '12px',
                        color: '#9ca3af'
                    }}>
                        Try adjusting your filter settings or clearing all filters
                    </Typography>
                </Paper>
            ) : (
                <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'auto' }}>
                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', boxShadow: 'none', borderRadius: '8px', width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'auto' }}>
                        <Table sx={{ tableLayout: 'fixed', width: '100%', minWidth: 0 }}>
                            <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: embedded ? '10%' : { xs: '14%', sm: '14%' } }}>Shipment</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: embedded ? '22%' : { xs: '20%', sm: '18%' } }}>Title</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: embedded ? '14%' : { xs: '16%', sm: '16%' } }}>Customer</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: embedded ? '8%' : { xs: '10%', sm: '10%' } }}>Priority</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: embedded ? '12%' : { xs: '14%', sm: '14%' } }}>Assigned</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: embedded ? '12%' : { xs: '12%', sm: '12%' } }}>Due Date</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: 90 }}>Time</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: embedded ? '10%' : { xs: '10%', sm: '10%' } }}>Status</TableCell>
                                    <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', width: embedded ? '8%' : { xs: '10%', sm: '10%' } }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredTasks
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((task) => {
                                        const shipment = shipmentData[task.shipmentId];
                                        const dueDateObj = toSafeDate(task.dueDate);
                                        try {
                                            const parsed = dueDateObj && !isNaN(dueDateObj.getTime()) ? dueDateObj.toISOString() : null;
                                            if (!parsed && (task?.dueDate?._seconds || task?.dueDate?.seconds)) {
                                                const secs = task?.dueDate?._seconds ?? task?.dueDate?.seconds;
                                                console.log('[TasksTable] Row', task.id, 'fallback parse check seconds:', secs, 'date:', new Date(secs * 1000).toISOString());
                                            }
                                            console.log('[TasksTable] Row', task.id, 'dueDate raw:', task.dueDate, 'parsed:', parsed);
                                        } catch { }
                                        const { name: customerName, logo: customerLogo } = getTaskCustomerInfo(task, shipment);
                                        return (
                                            <TableRow
                                                key={task.id}
                                                hover
                                                sx={{ cursor: 'pointer' }}
                                                onClick={() => handleTaskClick(task)}
                                            >
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Button
                                                            variant="text"
                                                            onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                                            sx={{ p: 0, minWidth: 0, fontSize: '12px', textTransform: 'none', fontFamily: 'monospace', color: '#1f2937' }}
                                                        >
                                                            {shipment?.shipmentID || task.shipmentId || '—'}
                                                        </Button>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', maxWidth: 420 }}>
                                                    <Typography sx={{ fontSize: '12px', color: '#374151' }} noWrap>{task.title || '—'}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar src={customerLogo} sx={{ width: 16, height: 16, fontSize: '8px' }}>
                                                            {customerName?.charAt(0) || 'C'}
                                                        </Avatar>
                                                        <Typography sx={{ fontSize: '12px' }}>{customerName}</Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Chip
                                                        label={task.priority || 'low'}
                                                        size="small"
                                                        sx={{
                                                            height: '20px',
                                                            fontSize: '10px',
                                                            textTransform: 'capitalize',
                                                            backgroundColor:
                                                                task.priority === 'high' ? '#fee2e2' :
                                                                    task.priority === 'medium' ? '#fef3c7' : '#f0fdf4',
                                                            color:
                                                                task.priority === 'high' ? '#dc2626' :
                                                                    task.priority === 'medium' ? '#d97706' : '#16a34a'
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {task.assignedTo ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            <Avatar src={getUserAvatar(task.assignedTo)} sx={{ width: 16, height: 16, fontSize: '8px', bgcolor: '#8b5cf6' }}>
                                                                {getUserInitials(task.assignedTo)}
                                                            </Avatar>
                                                            <Typography sx={{ fontSize: '12px' }}>{getUserDisplayName(task.assignedTo)}</Typography>
                                                        </Box>
                                                    ) : 'Unassigned'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', color: (dueDateObj && !isNaN(dueDateObj.getTime()) && dueDateObj < new Date() && (task.status !== 'completed')) ? '#dc2626' : '#374151' }}>
                                                    {dueDateObj && !isNaN(dueDateObj.getTime()) ? dueDateObj.toLocaleDateString() : '—'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', color: (dueDateObj && !isNaN(dueDateObj.getTime()) && dueDateObj < new Date() && (task.status !== 'completed')) ? '#dc2626' : '#374151' }}>
                                                    {(() => {
                                                        if (!dueDateObj || isNaN(dueDateObj.getTime())) return '—';
                                                        // Show "-" if time is midnight (00:00), indicating no specific time was set
                                                        const hours = dueDateObj.getHours();
                                                        const minutes = dueDateObj.getMinutes();
                                                        if (hours === 0 && minutes === 0) return '—';
                                                        return dueDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                                    })()}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }} onClick={(e) => e.stopPropagation()}>
                                                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                                        {(() => {
                                                            const { label, bg, fg } = getTaskStatusChipStyle(task.status);
                                                            return (
                                                                <Chip
                                                                    label={label}
                                                                    size="small"
                                                                    sx={{ height: '20px', fontSize: '10px', backgroundColor: bg, color: fg, border: 'none' }}
                                                                />
                                                            );
                                                        })()}
                                                        <IconButton
                                                            size="small"
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onClick={(e) => { e.stopPropagation(); setStatusMenu({ anchorEl: e.currentTarget, task }); }}
                                                        >
                                                            <EditIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                                        </IconButton>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }} onClick={(e) => e.stopPropagation()}>
                                                    <Button size="small" variant="outlined" onClick={() => handleEditTask(task)} sx={{ textTransform: 'none', fontSize: '11px' }}>
                                                        View
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredTasks.length}
                        page={page}
                        onPageChange={(e, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        rowsPerPageOptions={[25, 50, 100]}
                        sx={{ mt: 2 }}
                    />
                </Box>
            )}
        </Box>
    );

    // Shipments tab removed per requirements
    /* const renderShipmentsTable = () => (
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
    ); */

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
                            disabled={loadingCompanies || !isAdminView /* lock on non-admin routes, even for admin users */}
                        >
                            {/* All Companies Option (admins only) */}
                            {isAdminView && (
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
                                </MenuItem>)}

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
                                            src={getCircleLogo(company)}
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
            // overview removed; default handled by tasks
            case 'tasks':
                return (
                    <Box>
                        {renderTasksList()}
                    </Box>
                );
            case 'rules':
                return (
                    <Box>
                        {renderCompanyCustomerFilters()}
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                                    Automation Rules
                                </Typography>
                                <Button size="small" variant="contained" onClick={handleCreateRule} sx={{ textTransform: 'none', fontSize: '12px' }}>
                                    New Rule
                                </Button>
                            </Box>
                            <Paper sx={{ p: 0, border: '1px solid #e5e7eb' }}>
                                <Table size="small" sx={{ '& th, & td': { fontSize: '12px' } }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Rule</TableCell>
                                            <TableCell>Scope</TableCell>
                                            <TableCell>Trigger</TableCell>
                                            <TableCell>Task</TableCell>
                                            <TableCell>Priority</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(Array.isArray(rules) ? rules : []).map((rule) => {
                                            const scopeLabel = (() => {
                                                const t = rule?.scope?.type;
                                                const v = rule?.scope?.value || rule?.scope?.companyId || rule?.companyId;
                                                if (t === 'all_shipments') return 'All shipments';
                                                if (t === 'specific_company') return `Company: ${v || '—'}`;
                                                if (t === 'shipment_type') return `Type: ${rule?.scope?.shipmentType || v || '—'}`;
                                                if (t === 'service_level') return `Service: ${rule?.scope?.serviceLevel || v || '—'}`;
                                                if (t === 'carrier') return `Carrier: ${rule?.scope?.carrier || v || '—'}`;
                                                if (t === 'conditions') return 'Custom conditions';
                                                return t || '—';
                                            })();
                                            const trig = rule?.timing?.trigger || '—';
                                            const taskTitle = rule?.taskTemplate?.title || rule?.checkpoint?.name || '—';
                                            const priority = rule?.taskTemplate?.priority || rule?.checkpoint?.priority || '—';
                                            const statusChip = rule?.isActive ? (
                                                <Chip label="Active" size="small" sx={{ color: '#16a34a', backgroundColor: '#dcfce7' }} />
                                            ) : (
                                                <Chip label="Inactive" size="small" sx={{ color: '#6b7280', backgroundColor: '#e5e7eb' }} />
                                            );
                                            return (
                                                <TableRow key={rule.id} hover>
                                                    <TableCell>{rule.name || 'Untitled Rule'}</TableCell>
                                                    <TableCell>{scopeLabel}</TableCell>
                                                    <TableCell sx={{ textTransform: 'capitalize' }}>{String(trig).replaceAll('_', ' ')}</TableCell>
                                                    <TableCell>{taskTitle}</TableCell>
                                                    <TableCell sx={{ textTransform: 'capitalize' }}>{priority}</TableCell>
                                                    <TableCell>{statusChip}</TableCell>
                                                    <TableCell align="right">
                                                        <Button size="small" sx={{ textTransform: 'none', mr: 1 }} onClick={() => { setRuleBeingEdited(rule); setEditRuleDialog(true); }}>Edit</Button>
                                                        <Button size="small" color={rule.isActive ? 'warning' : 'success'} sx={{ textTransform: 'none' }} onClick={async () => {
                                                            try {
                                                                const updateFollowUpRule = httpsCallable(functions, 'updateFollowUpRule');
                                                                await updateFollowUpRule({ ruleId: rule.id, isActive: !rule.isActive });
                                                                loadRules();
                                                            } catch (e) { console.error('Toggle rule failed', e); }
                                                        }}>{rule.isActive ? 'Disable' : 'Enable'}</Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </Paper>
                        </Box>
                    </Box>
                );

            default:
                return null;
        }
    };

    // Auth loading state
    if (authLoading) {
        return <LoadingSkeleton />;
    }

    // Data loading state
    if (loading && tasks.length === 0) {
        return <LoadingSkeleton />;
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
            height: embedded ? '100%' : '100vh',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f9fafb'
        }}>
            {/* Modal Header (suppressed when embedded inside another modal) */}
            {isModal && !embedded && (
                <ModalHeader
                    title={scopeShipmentId ? 'Shipment Follow-Ups' : 'Follow-Up Management'}
                    onClose={() => {
                        // In a modal context, ensure parent can restore previous view
                        if (typeof onClose === 'function') onClose();
                        // Soft navigation guard for browser back in an embedded modal context
                        try {
                            if (window && window.history && window.history.state && window.history.length > 0) {
                                // No-op: let parent control. Keeping hook in case of future deep linking
                            }
                        } catch { }
                    }}
                    showCloseButton={true}
                />
            )}

            {/* Main Header & Tabs hidden when focused on a single shipment */}
            {!scopeShipmentId && renderHeader()}
            {!scopeShipmentId && renderTabs()}

            {/* Scrollable Content */}
            <Box sx={{
                flex: 1,
                minWidth: 0,
                overflow: 'auto',
                backgroundColor: '#ffffff'
            }}>
                {/* Scoped header with New Task action when viewing a single shipment */}
                {scopeShipmentId && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e5e7eb' }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                            Shipment Follow-Ups
                        </Typography>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleCreateTask}
                            sx={{ fontSize: '12px' }}
                        >
                            New Task
                        </Button>
                    </Box>
                )}

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
                maxWidth="lg"
                fullWidth
                scroll="paper"
                PaperProps={{ sx: { maxHeight: 'calc(80vh + 20px)', display: 'flex', flexDirection: 'column' } }}
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} component="div">
                    Create New Follow-Up Task
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button onClick={() => setCreateTaskDialog(false)} sx={{ fontSize: '12px', textTransform: 'none' }}>Cancel</Button>
                        <Button
                            onClick={() => { const evt = new Event('submit-create-task-form'); window.dispatchEvent(evt); }}
                            variant="contained"
                            sx={{ fontSize: '12px', textTransform: 'none' }}
                        >Create Task</Button>
                    </Box>
                </DialogTitle>
                {/* Status menu moved to root below to ensure it overlays current dialog */}
                <DialogContent sx={{ flex: '1 1 auto', overflowY: 'auto', pr: 1, pb: 2.5, mb: 0 }}>
                    <CreateTaskForm
                        onSave={handleCreateNewTask}
                        onCancel={() => setCreateTaskDialog(false)}
                        staff={staff}
                        availableCompanies={availableCompanies}
                        defaultCompanyId={scopeShipmentId ? (scopeCompanyId || companyIdForAddress) : (selectedCompanyId === 'all' ? companyIdForAddress : selectedCompanyId)}
                        defaultShipmentId={scopeShipmentId || ''}
                        defaultShipmentData={scopeShipmentData || null}
                        lockContext={Boolean(scopeShipmentId)}
                        taskTemplates={taskTemplates}
                        taskTemplatesLoading={taskTemplatesLoading}
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
                        availableCompanies={availableCompanies}
                        taskTemplates={taskTemplates}
                        taskTemplatesLoading={taskTemplatesLoading}
                    />
                </DialogContent>
            </Dialog>

            {/* Edit Task Dialog */}
            <Dialog
                open={editTaskDialog}
                onClose={() => setEditTaskDialog(false)}
                maxWidth="lg"
                fullWidth
                scroll="paper"
                PaperProps={{ sx: { maxHeight: '80vh', display: 'flex', flexDirection: 'column' } }}
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    Edit Follow-Up Task
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                            {(() => {
                                const { label, bg, fg } = getTaskStatusChipStyle(selectedTask?.status);
                                return (
                                    <Chip label={label} size="small" sx={{ height: '22px', fontSize: '11px', backgroundColor: bg, color: fg, border: 'none' }} />
                                );
                            })()}
                            <IconButton
                                size="small"
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setStatusMenu({ anchorEl: e.currentTarget, task: selectedTask });
                                }}
                            >
                                <EditIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                            </IconButton>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button onClick={() => setEditTaskDialog(false)} sx={{ fontSize: '12px', textTransform: 'none' }}>
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    const form = document.getElementById('edit-task-form');
                                    if (form) form.requestSubmit();
                                }}
                                variant="contained"
                                sx={{ fontSize: '12px', textTransform: 'none' }}
                            >
                                Save Changes
                            </Button>
                        </Box>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ flex: '1 1 auto', overflowY: 'auto', pr: 1, pb: 2.5, mb: 0 }}>
                    <EditTaskForm
                        task={selectedTask}
                        staff={staff}
                        availableCompanies={availableCompanies}
                        defaultCompanyId={selectedCompanyId === 'all' ? companyIdForAddress : selectedCompanyId}
                        taskTemplates={taskTemplates}
                        taskTemplatesLoading={taskTemplatesLoading}
                        onSave={handleUpdateTask}
                        onCancel={() => setEditTaskDialog(false)}
                    />
                </DialogContent>
            </Dialog>
            {/* Global status menu (portal) */}
            <Menu
                anchorEl={statusMenu.anchorEl}
                open={Boolean(statusMenu.anchorEl)}
                onClose={() => setStatusMenu({ anchorEl: null, task: null })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                disablePortal={false}
                container={document.body}
                slotProps={{
                    paper: {
                        sx: {
                            zIndex: 9999,
                            position: 'absolute',
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                        }
                    }
                }}

            >
                {['pending', 'in_progress', 'completed', 'cancelled'].map(s => (
                    <MenuItem
                        key={s}
                        onClick={async () => {
                            const target = statusMenu.task;
                            setStatusMenu({ anchorEl: null, task: null });
                            if (!target) return;
                            await handleInlineUpdateTask(target, { status: s });
                            setSelectedTask(prev => prev && prev.id === target.id ? { ...prev, status: s } : prev);
                        }}
                        sx={{ fontSize: '12px', textTransform: 'capitalize' }}
                    >
                        {s.replace('_', ' ')}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
};

// ===================================================================
// EDIT TASK FORM COMPONENT
// ===================================================================

const EditTaskForm = ({ task, onSave, onCancel, staff = [], availableCompanies = [], defaultCompanyId, taskTemplates = {}, taskTemplatesLoading = false }) => {
    const [formData, setFormData] = useState({
        title: task?.title || '',
        description: task?.description || '',
        priority: task?.priority || 'medium',
        status: task?.status || 'pending',
        assignedTo: task?.assignedTo || '',
        companyId: task?.companyId || defaultCompanyId || '',
        customerId: task?.customerId || '',
        // Initialize blank; sync effect below will safely populate from Timestamp/Date
        dueDate: '',
        dueTime: '',
        category: task?.category || 'manual',
        shipmentId: task?.shipmentId || task?.shipment?.id || '',
        selectedShipment: task?.shipment || null,
        actions: Array.isArray(task?.actions) ? task.actions : [],
        reminders: Array.isArray(task?.reminders) ? task.reminders : [],
        selectedTemplate: ''
    });

    const [companyCustomers, setCompanyCustomers] = useState([]);
    const [validation, setValidation] = useState({ dueDateTime: '' });

    // Shipment search state (match Create form UX)
    const [shipmentSearchTerm, setShipmentSearchTerm] = useState('');
    const [shipmentOptions, setShipmentOptions] = useState([]);
    const [loadingShipments, setLoadingShipments] = useState(false);

    // Action and reminder options (match Create form)
    const actionOptions = [
        { value: 'call_shipper', label: 'Call Shipper' },
        { value: 'email_shipper', label: 'Email Shipper' },
        { value: 'call_receiver', label: 'Call Receiver' },
        { value: 'email_receiver', label: 'Email Receiver' },
        { value: 'call_carrier_contact', label: 'Call Carrier Contact' },
        { value: 'email_carrier_contact', label: 'Email Carrier Contact' },
    ];
    const actionLabelMap = Object.fromEntries(actionOptions.map(o => [o.value, o.label]));

    const reminderOptions = [
        { value: 'in_2h', label: 'In 2 hours' },
        { value: 'at_4pm', label: 'At 4:00 PM' },
        { value: 'tomorrow_9am', label: 'Tomorrow 9:00 AM' },
        { value: 'in_24h', label: 'In 24 hours' },
        { value: 'one_hour_before', label: '1 hour before Due' },
        { value: 'on_due', label: 'On Due' },
    ];
    const reminderLabelMap = Object.fromEntries(reminderOptions.map(o => [o.value, o.label]));

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                if (!formData.companyId) { setCompanyCustomers([]); return; }
                const byCompanyIdQuery = query(
                    collection(db, 'customers'),
                    where('companyId', '==', formData.companyId),
                    orderBy('name')
                );
                const snap = await getDocs(byCompanyIdQuery);
                let custs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (custs.length === 0) {
                    const legacyQuery = query(
                        collection(db, 'customers'),
                        where('companyID', '==', formData.companyId),
                        orderBy('name')
                    );
                    const legacySnap = await getDocs(legacyQuery);
                    custs = legacySnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }
                setCompanyCustomers(custs);
            } catch (e) {
                console.warn('EditTaskForm loadCustomers error', e);
                setCompanyCustomers([]);
            }
        };
        loadCustomers();
    }, [formData.companyId]);

    const handleChange = (field, value) => {
        console.log('🔧 EditTaskForm handleChange called:', { field, value });
        setFormData(prev => {
            const newData = {
                ...prev,
                [field]: value
            };
            console.log('📊 EditTaskForm formData updated:', { field, oldValue: prev[field], newValue: value, selectedTemplate: newData.selectedTemplate });
            return newData;
        });
    };

    const findTemplateById = useCallback((id) => {
        let tpl = null;
        Object.values(taskTemplates || {}).forEach(list => {
            const found = (list || []).find(t => t.id === id);
            if (found) tpl = found;
        });
        return tpl;
    }, [taskTemplates]);

    const commitTemplateSelection = useCallback((id) => {
        const tpl = findTemplateById(id);
        setFormData(prev => ({
            ...prev,
            selectedTemplate: id || '',
            title: tpl?.taskName || (id ? prev.title : ''),
            description: tpl?.description || prev.description,
            __templateMenuOpen: false
        }));
    }, [findTemplateById]);

    const handleTemplateSelect = (templateValue) => {
        if (templateValue === 'other') {
            setFormData(prev => ({
                ...prev,
                selectedTemplate: 'other',
                title: ''
            }));
        } else if (templateValue) {
            commitTemplateSelection(templateValue);
        } else {
            setFormData(prev => ({
                ...prev,
                selectedTemplate: '',
                title: ''
            }));
        }
    };

    // Auto-detect selected template when editing an existing task
    useEffect(() => {
        // Don't override if already set by user or detection completed
        if (formData.selectedTemplate) return;

        // 1) Use saved selectedTemplate if present and valid
        const saved = task?.selectedTemplate;
        if (saved) {
            if (saved === 'other') {
                setFormData(prev => ({ ...prev, selectedTemplate: 'other' }));
                return;
            }
            const exists = findTemplateById(saved);
            if (exists) {
                setFormData(prev => ({ ...prev, selectedTemplate: saved }));
                return;
            }
        }

        // 2) Match by title against template names (unique match)
        const title = task?.title?.trim?.();
        if (!title) return;
        const all = Object.values(taskTemplates || {}).flatMap(list => list || []);
        const matches = all.filter(t => (t?.taskName || '').trim() === title);
        if (matches.length === 1) {
            setFormData(prev => ({ ...prev, selectedTemplate: matches[0].id }));
        }
    }, [task, taskTemplates, formData.selectedTemplate, findTemplateById]);

    // Keep form in sync when a different task is loaded (now task may carry Timestamp in task.dueDate)
    useEffect(() => {
        if (!task) return;
        const toDateOnly = (v) => {
            try {
                if (!v) return '';
                const d = v?.toDate?.()
                    || (typeof v?.seconds === 'number' ? new Date(v.seconds * 1000)
                        : (typeof v?._seconds === 'number' ? new Date(v._seconds * 1000) : new Date(v)));
                if (isNaN(d.getTime())) return '';
                // Format as yyyy-mm-dd (local)
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch { return ''; }
        };
        const toTimeOnly = (v) => {
            try {
                if (!v) return '';
                const d = v?.toDate?.()
                    || (typeof v?.seconds === 'number' ? new Date(v.seconds * 1000)
                        : (typeof v?._seconds === 'number' ? new Date(v._seconds * 1000) : new Date(v)));
                if (isNaN(d.getTime())) return '';
                return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            } catch { return ''; }
        };
        console.log('[EditTaskForm] syncing from selectedTask:', { rawDue: task?.dueDate, date: toDateOnly(task?.dueDate), time: toTimeOnly(task?.dueDate) });
        setFormData(prev => ({
            ...prev,
            title: task.title || '',
            description: task.description || '',
            priority: task.priority || 'medium',
            status: task.status || 'pending',
            assignedTo: task.assignedTo || '',
            companyId: task.companyId || prev.companyId || defaultCompanyId || '',
            customerId: task.customerId || '',
            dueDate: toDateOnly(task.dueDate),
            dueTime: toTimeOnly(task.dueDate),
            category: task.category || 'manual',
            shipmentId: task.shipmentId || task?.shipment?.id || '',
            selectedShipment: task.shipment || null,
            actions: Array.isArray(task.actions) ? task.actions : (Array.isArray(task.actionTypes) ? task.actionTypes : []),
            reminders: Array.isArray(task.reminders) ? task.reminders : []
        }));
    }, [task, defaultCompanyId]);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Combine date + time to one Date at local timezone using setHours to avoid TZ drift
        let dueDateObj = null;
        if (formData.dueDate) {
            const [hh = '09', mm = '00'] = (formData.dueTime || '09:00').split(':');
            const base = new Date(formData.dueDate + 'T00:00:00');
            if (!isNaN(base.getTime())) {
                base.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
                dueDateObj = base;
            }
        }
        console.log('[EditTaskForm] due inputs:', { dueDateString: formData.dueDate, dueTimeString: formData.dueTime });
        console.log('[EditTaskForm] computed dueDateObj:', dueDateObj ? dueDateObj.toISOString() : null, dueDateObj);
        // Validation: warn if due date in past
        if (dueDateObj && dueDateObj.getTime() < Date.now()) {
            setValidation({ dueDateTime: 'Selected time is in the past' });
        } else {
            setValidation({ dueDateTime: '' });
        }
        const payload = {
            ...formData,
            dueDate: dueDateObj,
            // Also send raw strings so parent can recompute if needed
            dueDateString: formData.dueDate || '',
            dueTimeString: formData.dueTime || ''
        };
        console.log('[EditTaskForm] Submitting payload:', payload);
        onSave(payload);
    };

    // Allow parent header Save button to submit this form
    useEffect(() => {
        const handler = (e) => {
            e.preventDefault?.();
            handleSubmit(new Event('submit'));
        };
        window.addEventListener('submit-edit-task-form', handler);
        return () => window.removeEventListener('submit-edit-task-form', handler);
    }, [formData]);

    // Shipment search (match Create form)
    const handleShipmentSearch = async (searchTerm) => {
        if (!searchTerm || searchTerm.length < 2) {
            setShipmentOptions([]);
            return;
        }
        if (!formData.companyId) {
            setShipmentOptions([]);
            return;
        }
        setLoadingShipments(true);
        try {
            const shipmentsQuery = query(
                collection(db, 'shipments'),
                where('companyID', '==', formData.companyId),
                orderBy('createdAt', 'desc'),
                limit(50)
            );
            const shipmentsSnapshot = await getDocs(shipmentsQuery);
            const shipments = shipmentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(shipment => [
                    shipment.shipmentID,
                    shipment.id,
                    shipment.referenceNumber,
                    shipment.shipperReferenceNumber,
                    shipment.shipmentInfo?.referenceNumber,
                    shipment.shipTo?.companyName,
                    shipment.shipFrom?.companyName,
                    shipment.carrierBookingConfirmation?.proNumber,
                    shipment.trackingNumber
                ].filter(Boolean).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase())));
            setShipmentOptions(shipments);
        } catch (error) {
            console.error('Error searching shipments (edit):', error);
            setShipmentOptions([]);
        } finally {
            setLoadingShipments(false);
        }
    };

    const handleShipmentSelect = (shipment) => {
        setFormData(prev => ({
            ...prev,
            shipmentId: shipment.id,
            selectedShipment: shipment
        }));
        setShipmentSearchTerm(shipment.shipmentID);
    };

    return (
        <Box component="form" id="edit-task-form" onSubmit={handleSubmit} sx={{ mt: 2, pt: '15px', maxHeight: 'calc(80vh - 140px)', overflowY: 'auto', pr: 1, pb: 0, mb: 0 }}>
            <Grid container spacing={2}>
                {/* Company / Customer / Assignee */}
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Company</InputLabel>
                        <Select
                            value={formData.companyId}
                            onChange={(e) => handleChange('companyId', e.target.value)}
                            label="Company"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>None</MenuItem>
                            {availableCompanies.map(c => (
                                <MenuItem key={c.id} value={c.companyID} sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar src={getCircleLogo(c)} sx={{ width: 18, height: 18, fontSize: '10px' }}>
                                            {c.name?.[0] || 'C'}
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px' }}>{c.name}</Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>({c.companyID})</Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Customer</InputLabel>
                        <Select
                            value={formData.customerId}
                            onChange={(e) => handleChange('customerId', e.target.value)}
                            label="Customer"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>None</MenuItem>
                            {companyCustomers.map(cu => (
                                <MenuItem key={cu.id} value={cu.id} sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar src={cu.logo || cu.logoUrl || cu.customerLogo} sx={{ width: 18, height: 18, fontSize: '10px' }}>
                                            {cu.name?.[0] || 'C'}
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px' }}>{cu.name}</Typography>
                                        {cu.customerID && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>({cu.customerID})</Typography>
                                        )}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Assigned To</InputLabel>
                        <Select
                            value={formData.assignedTo}
                            onChange={(e) => handleChange('assignedTo', e.target.value)}
                            label="Assigned To"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>Unassigned</MenuItem>
                            {staff
                                .filter(u => !formData.companyId || (u.companyId === formData.companyId || u.connectedCompanies?.companies?.includes?.(formData.companyId)))
                                .map(u => (
                                    <MenuItem key={u.id} value={u.uid || u.id} sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar src={u.photoURL || u.avatar} sx={{ width: 18, height: 18 }}>
                                                {(u.firstName?.[0] || u.displayName?.[0] || u.email?.[0] || 'U')}
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.displayName || 'Unknown')}
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>{u.email}</Typography>
                                            </Box>
                                        </Box>
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>
                </Grid>
                {/* Task Settings & Shipment selection */}
                <Grid item xs={12}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                        Task Settings
                    </Typography>
                </Grid>

                {!formData.selectedShipment ? (
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Select Shipment"
                            value={shipmentSearchTerm}
                            onChange={(e) => { const v = e.target.value; setShipmentSearchTerm(v); handleShipmentSearch(v); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleShipmentSearch(shipmentSearchTerm); } }}
                            placeholder="Enter shipment ID, reference, tracking, or company..."
                            size="small"
                            sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {loadingShipments ? <CircularProgress size={16} /> : null}
                                    </InputAdornment>
                                )
                            }}
                        />
                        {shipmentOptions.length > 0 && (
                            <Paper sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                                <List dense>
                                    {shipmentOptions.map((s) => (
                                        <ListItem key={s.id} button onClick={() => handleShipmentSelect(s)} sx={{ '&:hover': { backgroundColor: '#f5f5f5' }, cursor: 'pointer' }}>
                                            <ListItemText
                                                primary={
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{s.shipmentID || s.id}</Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {(s.shipFrom?.city || 'N/A')} → {(s.shipTo?.city || 'N/A')} • {(s.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A')}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={<Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Status: {s.status || 'Unknown'} • Ref: {s.referenceNumber || s.shipperReferenceNumber || 'N/A'} • Tracking: {s.trackingNumber || s.carrierBookingConfirmation?.proNumber || 'N/A'}</Typography>}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Paper>
                        )}
                    </Grid>
                ) : (
                    <Grid item xs={12}>
                        <Paper sx={{ p: 1.25, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Grid container alignItems="center" spacing={1} wrap="wrap">
                                <Grid item xs="auto">
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Shipment: {formData.selectedShipment.shipmentID || formData.selectedShipment.id}
                                    </Typography>
                                </Grid>
                                <Grid item xs="auto">
                                    <Typography sx={{ fontSize: '11px', color: '#374151' }}>
                                        From: <Box component="span" sx={{ fontWeight: 600, color: '#111827' }}>{formData.selectedShipment.shipFrom?.companyName || 'Unknown'}</Box>
                                    </Typography>
                                </Grid>
                                <Grid item xs="auto">
                                    <Typography sx={{ fontSize: '11px', color: '#374151' }}>
                                        To: <Box component="span" sx={{ fontWeight: 600, color: '#111827' }}>{formData.selectedShipment.shipTo?.companyName || 'Unknown'}</Box>
                                    </Typography>
                                </Grid>
                                <Grid item xs="auto">
                                    <Chip label={formData.selectedShipment.status || 'pending'} size="small" sx={{ fontSize: '10px' }} />
                                </Grid>
                                <Grid item sx={{ flexGrow: 1 }} />
                                <Grid item xs="auto">
                                    <Button size="small" sx={{ fontSize: '12px' }} onClick={() => { setFormData(prev => ({ ...prev, shipmentId: '', selectedShipment: null })); setShipmentSearchTerm(''); }}>Change</Button>
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>
                )}

                {/* Type / Priority / Actions */}
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                        <Select value={formData.category} onChange={(e) => handleChange('category', e.target.value)} label="Type" sx={{ fontSize: '12px' }}>
                            <MenuItem value="manual" sx={{ fontSize: '12px' }}>Manual</MenuItem>
                            <MenuItem value="automated" sx={{ fontSize: '12px' }}>Automated</MenuItem>
                            <MenuItem value="scheduled" sx={{ fontSize: '12px' }}>Scheduled</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Priority</InputLabel>
                        <Select value={formData.priority} onChange={(e) => handleChange('priority', e.target.value)} label="Priority" sx={{ fontSize: '12px' }}>
                            <MenuItem value="low" sx={{ fontSize: '12px' }}>Low</MenuItem>
                            <MenuItem value="medium" sx={{ fontSize: '12px' }}>Medium</MenuItem>
                            <MenuItem value="high" sx={{ fontSize: '12px' }}>High</MenuItem>
                            <MenuItem value="urgent" sx={{ fontSize: '12px' }}>Urgent</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Actions</InputLabel>
                        <Select
                            multiple
                            value={formData.actions}
                            onChange={(e) => handleChange('actions', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                            label="Actions"
                            sx={{ fontSize: '12px' }}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected || []).map((value) => (
                                        <Chip key={value} size="small" label={actionLabelMap[value] || value} onMouseDown={(e) => e.stopPropagation()} onDelete={() => setFormData(prev => ({ ...prev, actions: (prev.actions || []).filter(v => v !== value) }))} />
                                    ))}
                                </Box>
                            )}
                        >
                            {actionOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '12px' }}>{opt.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                {/* Due Date / Due Time / Reminders */}
                <Grid item xs={12} md={4}>
                    <TextField fullWidth label="Due Date" type="date" value={formData.dueDate} onChange={(e) => { console.log('[EditTaskForm] dueDate changed ->', e.target.value); handleChange('dueDate', e.target.value); }} InputLabelProps={{ shrink: true }} onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()} size="small" sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }} />
                </Grid>
                <Grid item xs={12} md={4}>
                    <TextField fullWidth label="Due Time" type="time" value={formData.dueTime} onChange={(e) => { console.log('[EditTaskForm] dueTime changed ->', e.target.value); handleChange('dueTime', e.target.value); }} InputLabelProps={{ shrink: true }} onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()} size="small" helperText={validation.dueDateTime} error={Boolean(validation.dueDateTime)} sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }} />
                </Grid>
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Reminders</InputLabel>
                        <Select
                            multiple
                            value={formData.reminders}
                            onChange={(e) => handleChange('reminders', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                            label="Reminders"
                            sx={{ fontSize: '12px' }}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected || []).map((value) => (
                                        <Chip key={value} size="small" label={reminderLabelMap[value] || value} onMouseDown={(e) => e.stopPropagation()} onDelete={() => setFormData(prev => ({ ...prev, reminders: (prev.reminders || []).filter(v => v !== value) }))} />
                                    ))}
                                </Box>
                            )}
                        >
                            {reminderOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '12px' }}>{opt.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                {/* Task Details with template selector */}
                <Grid item xs={12}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mt: 2 }}>Task Details</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Task Title (Template)</InputLabel>
                        {/* Controlled open to avoid focus/blur issues in embedded panels */}
                        <Select
                            open={Boolean(formData.__templateMenuOpen)}
                            onOpen={() => {
                                setFormData(prev => ({ ...prev, __templateMenuOpen: true }));
                                console.log('📂 Template Dropdown opened:', {
                                    currentValue: formData.selectedTemplate,
                                    taskTemplates: taskTemplates,
                                    taskTemplatesLoading: taskTemplatesLoading,
                                    formDataKeys: Object.keys(formData),
                                    allTemplateIds: Object.values(taskTemplates || {}).flatMap(arr => (arr || []).map(t => t.id))
                                });
                            }}
                            onClose={() => {
                                console.log('📪 Template Dropdown closed');
                                setFormData(prev => ({ ...prev, __templateMenuOpen: false }));
                            }}
                            value={formData.selectedTemplate || ''}
                            renderValue={(val) => {
                                if (!val) return 'None';
                                if (val === 'other') return 'Other…';
                                let t = null;
                                Object.values(taskTemplates || {}).forEach(list => {
                                    const f = (list || []).find(x => x.id === val);
                                    if (f) t = f;
                                });
                                return t?.taskName || val;
                            }}
                            onChange={(e) => {
                                const templateValue = e.target.value;
                                console.log('🎯 Template Dropdown onChange triggered:', {
                                    templateValue,
                                    eventTargetValue: e.target.value,
                                    currentSelectedTemplate: formData.selectedTemplate,
                                    taskTemplatesKeys: Object.keys(taskTemplates || {}),
                                    totalTemplates: Object.values(taskTemplates || {}).reduce((sum, arr) => sum + (arr || []).length, 0)
                                });

                                handleChange('selectedTemplate', templateValue);
                                console.log('✅ Called handleChange for selectedTemplate:', templateValue);

                                if (templateValue === 'other') {
                                    console.log('🔄 Template is "other", clearing title');
                                    handleChange('title', '');
                                } else if (templateValue) {
                                    console.log('🔍 Looking for template with ID:', templateValue);
                                    // Find template and populate
                                    let selectedTemplate = null;
                                    Object.values(taskTemplates || {}).forEach(categoryTasks => {
                                        const found = (categoryTasks || []).find(t => t.id === templateValue);
                                        if (found) {
                                            selectedTemplate = found;
                                            console.log('✅ Found template:', { id: found.id, taskName: found.taskName });
                                        }
                                    });

                                    if (selectedTemplate) {
                                        console.log('📝 Populating fields with template data:', {
                                            title: selectedTemplate.taskName,
                                            description: selectedTemplate.description
                                        });
                                        handleChange('title', selectedTemplate.taskName || '');
                                        handleChange('description', selectedTemplate.description || formData.description);
                                    } else {
                                        console.warn('❌ Template not found for ID:', templateValue);
                                    }
                                } else {
                                    console.log('🧹 Template value is empty, clearing title');
                                    handleChange('title', '');
                                }

                                console.log('🏁 Template onChange handler completed');
                            }}
                            label="Task Title (Template)"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }} onMouseEnter={() => console.log('🖱️ Hovering over "None" item')} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({ ...prev, selectedTemplate: '', title: '', __templateMenuOpen: false })); }}>None</MenuItem>
                            {(taskTemplatesLoading ? [] : Object.entries(taskTemplates || {})).map(([category, items]) => (
                                <React.Fragment key={category}>
                                    <MenuItem disabled sx={{ fontSize: '11px', color: '#6b7280' }}>— {category} —</MenuItem>
                                    {(items || []).map(tpl => {
                                        console.log('🏗️ Rendering MenuItem:', { id: tpl.id, taskName: tpl.taskName, value: tpl.id });
                                        return (
                                            <MenuItem
                                                key={tpl.id}
                                                value={tpl.id}
                                                sx={{ fontSize: '12px' }}
                                                onMouseEnter={() => console.log('🖱️ Hovering over template:', { id: tpl.id, taskName: tpl.taskName })}
                                                onMouseDown={(e) => {
                                                    // Commit selection before blur/close
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const v = tpl.id;
                                                    console.log('✅ onMouseDown committing template select:', v);
                                                    // Manually mirror onChange flow
                                                    setFormData(prev => ({ ...prev, selectedTemplate: v }));
                                                    let found = null;
                                                    Object.values(taskTemplates || {}).forEach(list => {
                                                        const f = (list || []).find(t => t.id === v);
                                                        if (f) found = f;
                                                    });
                                                    if (found) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            selectedTemplate: v,
                                                            title: found.taskName || prev.title,
                                                            description: found.description || prev.description
                                                        }));
                                                    }
                                                    // Close menu explicitly
                                                    setFormData(prev => ({ ...prev, __templateMenuOpen: false }));
                                                }}
                                            >
                                                {tpl.taskName}
                                            </MenuItem>
                                        );
                                    })}
                                </React.Fragment>
                            ))}
                            <MenuItem value="other" sx={{ fontSize: '12px' }} onMouseEnter={() => console.log('🖱️ Hovering over "Other" item')} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({ ...prev, selectedTemplate: 'other', title: '', __templateMenuOpen: false })); }}>Other…</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                {formData.selectedTemplate === 'other' && (
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Task Title"
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            required
                            size="small"
                            sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                            placeholder="e.g., Contact customer about delivery delay"
                        />
                    </Grid>
                )}
                <Grid item xs={12}>
                    <TextField fullWidth label="Description" value={formData.description} onChange={(e) => handleChange('description', e.target.value)} multiline rows={5} size="small" sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }} />
                </Grid>

                {/* Quick actions removed in Edit form for a cleaner UI */}

                {/* Recent Activity and Add Note removed in Edit form */}

                {/* Audit snippet */}
                <Grid item xs={12}>
                    <Typography sx={{ fontSize: '11px', color: '#9ca3af' }}>
                        Created by: {task?.createdBy || '—'} • Created: {task?.createdAt?.toDate?.()?.toLocaleString?.() || '—'} • Updated: {task?.updatedAt?.toDate?.()?.toLocaleString?.() || '—'}
                    </Typography>
                </Grid>
            </Grid>
            {/* Bottom buttons removed; header buttons handle submit/cancel */}
        </Box>
    );
};

// ===================================================================
// CREATE TASK FORM COMPONENT
// ===================================================================

const CreateTaskForm = ({ onSave, onCancel, staff = [], availableCompanies = [], defaultCompanyId, taskTemplates = {}, taskTemplatesLoading = false, defaultShipmentId = '', defaultShipmentData = null, lockContext = false }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        assignedTo: '',
        companyId: defaultCompanyId || '',
        customerId: '',
        dueDate: '',
        dueTime: '',
        category: 'manual',
        shipmentId: defaultShipmentId || '',
        selectedShipment: defaultShipmentData || null,
        actions: [],
        reminders: [],
        selectedTemplate: ''
    });
    const [companyCustomers, setCompanyCustomers] = useState([]);

    const [shipmentSearchTerm, setShipmentSearchTerm] = useState('');
    const [shipmentOptions, setShipmentOptions] = useState([]);
    const [loadingShipments, setLoadingShipments] = useState(false);

    // Action options for tasks
    const actionOptions = [
        { value: 'call_shipper', label: 'Call Shipper' },
        { value: 'email_shipper', label: 'Email Shipper' },
        { value: 'call_receiver', label: 'Call Receiver' },
        { value: 'email_receiver', label: 'Email Receiver' },
        { value: 'call_carrier_contact', label: 'Call Carrier Contact' },
        { value: 'email_carrier_contact', label: 'Email Carrier Contact' },
    ];
    const actionLabelMap = Object.fromEntries(actionOptions.map(o => [o.value, o.label]));

    // Reminder options for tasks
    const reminderOptions = [
        { value: 'in_2h', label: 'In 2 hours' },
        { value: 'at_4pm', label: 'At 4:00 PM' },
        { value: 'tomorrow_9am', label: 'Tomorrow 9:00 AM' },
        { value: 'in_24h', label: 'In 24 hours' },
        { value: 'one_hour_before', label: '1 hour before Due' },
        { value: 'on_due', label: 'On Due' },
    ];
    const reminderLabelMap = Object.fromEntries(reminderOptions.map(o => [o.value, o.label]));

    const handleChange = (field, value) => {
        console.log('🔧 CreateTaskForm handleChange called:', { field, value });
        setFormData(prev => {
            const newData = {
                ...prev,
                [field]: value
            };
            console.log('📊 CreateTaskForm formData updated:', { field, oldValue: prev[field], newValue: value, selectedTemplate: newData.selectedTemplate });
            return newData;
        });
    };

    const handleTemplateSelect = (templateValue) => {
        if (templateValue === 'other') {
            setFormData(prev => ({
                ...prev,
                selectedTemplate: 'other',
                title: ''
            }));
        } else if (templateValue) {
            // Find template and populate
            let selectedTemplate = null;
            Object.values(taskTemplates || {}).forEach(categoryTasks => {
                const found = (categoryTasks || []).find(t => t.id === templateValue);
                if (found) selectedTemplate = found;
            });

            if (selectedTemplate) {
                setFormData(prev => ({
                    ...prev,
                    selectedTemplate: templateValue,
                    title: selectedTemplate.taskName || '',
                    description: selectedTemplate.description || prev.description
                }));
            }
        } else {
            setFormData(prev => ({
                ...prev,
                selectedTemplate: '',
                title: ''
            }));
        }
    };

    useEffect(() => {
        const loadCustomers = async () => {
            try {
                if (!formData.companyId) { setCompanyCustomers([]); return; }
                const byCompanyIdQuery = query(
                    collection(db, 'customers'),
                    where('companyId', '==', formData.companyId),
                    orderBy('name')
                );
                const snap = await getDocs(byCompanyIdQuery);
                let custs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (custs.length === 0) {
                    const legacyQuery = query(
                        collection(db, 'customers'),
                        where('companyID', '==', formData.companyId),
                        orderBy('name')
                    );
                    const legacySnap = await getDocs(legacyQuery);
                    custs = legacySnap.docs.map(d => ({ id: d.id, ...d.data() }));
                }
                setCompanyCustomers(custs);
            } catch (e) {
                setCompanyCustomers([]);
            }
        };
        loadCustomers();
    }, [formData.companyId]);

    const handleShipmentSearch = async (searchTerm) => {
        if (!searchTerm || searchTerm.length < 2) {
            setShipmentOptions([]);
            return;
        }
        if (!formData.companyId) {
            // Require a company selection to scope shipment search
            setShipmentOptions([]);
            return;
        }
        setLoadingShipments(true);
        try {
            // Scoped to selected company; search latest shipments
            const shipmentsQuery = query(
                collection(db, 'shipments'),
                where('companyID', '==', formData.companyId),
                orderBy('createdAt', 'desc'),
                limit(50)
            );

            const shipmentsSnapshot = await getDocs(shipmentsQuery);
            const shipments = shipmentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(shipment =>
                    [
                        shipment.shipmentID,
                        shipment.id,
                        shipment.referenceNumber,
                        shipment.shipperReferenceNumber,
                        shipment.shipmentInfo?.referenceNumber,
                        shipment.shipTo?.companyName,
                        shipment.shipFrom?.companyName,
                        shipment.carrierBookingConfirmation?.proNumber,
                        shipment.trackingNumber
                    ]
                        .filter(Boolean)
                        .some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
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
            // Store Firestore document ID for reliable joins; keep selectedShipment for UI
            shipmentId: shipment.id,
            selectedShipment: shipment
        }));
        setShipmentSearchTerm(shipment.shipmentID);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        let dueDateObj = null;
        if (formData.dueDate) {
            const time = formData.dueTime || '09:00';
            const combined = new Date(`${formData.dueDate}T${time}:00`);
            if (!isNaN(combined.getTime())) dueDateObj = combined;
        }
        onSave({
            ...formData,
            dueDate: dueDateObj
        });
    };

    // Allow parent header Create button to submit
    useEffect(() => {
        const handler = (e) => { e.preventDefault?.(); handleSubmit(new Event('submit')); };
        window.addEventListener('submit-create-task-form', handler);
        return () => window.removeEventListener('submit-create-task-form', handler);
    }, [formData]);

    return (
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, pt: '15px', maxHeight: 'calc(80vh - 140px)', overflowY: 'auto', pr: 1, pb: 0, mb: 0 }}>
            <Grid container spacing={2}>
                {/* Company / Customer / Assignee */}
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Company</InputLabel>
                        <Select
                            value={formData.companyId}
                            onChange={(e) => handleChange('companyId', e.target.value)}
                            label="Company"
                            sx={{ fontSize: '12px' }}
                            disabled={lockContext}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>None</MenuItem>
                            {availableCompanies.map(c => (
                                <MenuItem key={c.id} value={c.companyID} sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar src={getCircleLogo(c)} sx={{ width: 18, height: 18, fontSize: '10px' }}>
                                            {c.name?.[0] || 'C'}
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px' }}>{c.name}</Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>({c.companyID})</Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Customer</InputLabel>
                        <Select
                            value={formData.customerId}
                            onChange={(e) => handleChange('customerId', e.target.value)}
                            label="Customer"
                            sx={{ fontSize: '12px' }}
                            disabled={lockContext}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>None</MenuItem>
                            {companyCustomers.map(cu => (
                                <MenuItem key={cu.id} value={cu.id} sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar src={cu.logo || cu.logoUrl || cu.customerLogo} sx={{ width: 18, height: 18, fontSize: '10px' }}>
                                            {cu.name?.[0] || 'C'}
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px' }}>{cu.name}</Typography>
                                        {cu.customerID && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>({cu.customerID})</Typography>
                                        )}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Assigned To</InputLabel>
                        <Select
                            value={formData.assignedTo}
                            onChange={(e) => handleChange('assignedTo', e.target.value)}
                            label="Assigned To"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>Unassigned</MenuItem>
                            {staff
                                .filter(u => !formData.companyId || (u.companyId === formData.companyId || u.connectedCompanies?.companies?.includes?.(formData.companyId)))
                                .map(u => (
                                    <MenuItem key={u.id} value={u.uid || u.id} sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar src={u.photoURL || u.avatar} sx={{ width: 18, height: 18 }}>
                                                {(u.firstName?.[0] || u.displayName?.[0] || u.email?.[0] || 'U')}
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.displayName || 'Unknown')}
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>{u.email}</Typography>
                                            </Box>
                                        </Box>
                                    </MenuItem>
                                ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12}>
                    <Typography sx={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#374151',
                        mb: 1
                    }}>
                        Task Settings
                    </Typography>
                </Grid>

                {!formData.selectedShipment && !lockContext ? (
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Select Shipment"
                            value={shipmentSearchTerm}
                            onChange={(e) => {
                                const val = e.target.value;
                                setShipmentSearchTerm(val);
                                handleShipmentSearch(val);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleShipmentSearch(shipmentSearchTerm);
                                }
                            }}
                            placeholder="Enter shipment ID, reference, tracking, or company..."
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
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {loadingShipments ? <CircularProgress size={16} /> : null}
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
                                                            {(shipment.shipFrom?.city || 'N/A')} → {(shipment.shipTo?.city || 'N/A')} • {(shipment.createdAt?.toDate?.()?.toLocaleDateString?.() || 'N/A')}
                                                        </Typography>
                                                    </Box>
                                                }
                                                secondary={
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        Status: {shipment.status || 'Unknown'} • Ref: {shipment.referenceNumber || shipment.shipperReferenceNumber || 'N/A'} • Tracking: {shipment.trackingNumber || shipment.carrierBookingConfirmation?.proNumber || 'N/A'}
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
                        <Paper sx={{ p: 1.25, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Grid container alignItems="center" spacing={1} wrap="wrap">
                                <Grid item xs="auto">
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        Shipment: {formData.selectedShipment.shipmentID || formData.selectedShipment.id}
                                    </Typography>
                                </Grid>
                                <Grid item xs="auto">
                                    <Typography sx={{ fontSize: '11px', color: '#374151' }}>
                                        From: <Box component="span" sx={{ fontWeight: 600, color: '#111827' }}>{formData.selectedShipment.shipFrom?.companyName || 'Unknown'}</Box>
                                    </Typography>
                                </Grid>
                                <Grid item xs="auto">
                                    <Typography sx={{ fontSize: '11px', color: '#374151' }}>
                                        To: <Box component="span" sx={{ fontWeight: 600, color: '#111827' }}>{formData.selectedShipment.shipTo?.companyName || 'Unknown'}</Box>
                                    </Typography>
                                </Grid>
                                <Grid item xs="auto">
                                    <Chip label={formData.selectedShipment.status || 'pending'} size="small" sx={{ fontSize: '10px' }} />
                                </Grid>
                                <Grid item sx={{ flexGrow: 1 }} />
                                {!lockContext && (
                                    <Grid item xs="auto">
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
                                    </Grid>
                                )}
                            </Grid>
                        </Paper>
                    </Grid>
                )}

                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                        <Select
                            value={formData.category}
                            onChange={(e) => handleChange('category', e.target.value)}
                            label="Type"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="manual" sx={{ fontSize: '12px' }}>Manual</MenuItem>
                            <MenuItem value="automated" sx={{ fontSize: '12px' }}>Automated</MenuItem>
                            <MenuItem value="scheduled" sx={{ fontSize: '12px' }}>Scheduled</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
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

                {/* Actions (multi-select) moved to same row as Type and Priority */}
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Actions</InputLabel>
                        <Select
                            multiple
                            value={formData.actions}
                            onChange={(e) => handleChange('actions', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                            label="Actions"
                            sx={{ fontSize: '12px' }}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected || []).map((value) => (
                                        <Chip
                                            key={value}
                                            size="small"
                                            label={actionLabelMap[value] || value}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onDelete={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    actions: (prev.actions || []).filter(v => v !== value)
                                                }));
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}
                        >
                            {actionOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '12px' }}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        label="Due Date"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => handleChange('dueDate', e.target.value)}
                        required
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        label="Due Time"
                        type="time"
                        value={formData.dueTime}
                        onChange={(e) => handleChange('dueTime', e.target.value)}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                </Grid>
                {/* Reminders (multi-select) */}
                <Grid item xs={12} md={4}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Reminders</InputLabel>
                        <Select
                            multiple
                            value={formData.reminders}
                            onChange={(e) => handleChange('reminders', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                            label="Reminders"
                            sx={{ fontSize: '12px' }}
                            renderValue={(selected) => (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {(selected || []).map((value) => (
                                        <Chip
                                            key={value}
                                            size="small"
                                            label={reminderLabelMap[value] || value}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onDelete={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    reminders: (prev.reminders || []).filter(v => v !== value)
                                                }));
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}
                        >
                            {reminderOptions.map(opt => (
                                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '12px' }}>
                                    {opt.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>

                {/* Task Details */}
                <Grid item xs={12}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mt: 2 }}>
                        Task Details
                    </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Task Title (Template)</InputLabel>
                        <Select
                            open={Boolean(formData.__templateMenuOpen)}
                            onOpen={() => setFormData(prev => ({ ...prev, __templateMenuOpen: true }))}
                            onClose={() => setFormData(prev => ({ ...prev, __templateMenuOpen: false }))}
                            value={formData.selectedTemplate || ''}
                            renderValue={(val) => {
                                if (!val) return 'None';
                                if (val === 'other') return 'Other…';
                                let t = null;
                                Object.values(taskTemplates || {}).forEach(list => {
                                    const f = (list || []).find(x => x.id === val);
                                    if (f) t = f;
                                });
                                return t?.taskName || val;
                            }}
                            /* extra debug on manual open */
                            onCloseCapture={() => console.log('📪 Template Dropdown close (capture)')}
                            onOpenCapture={() => console.log('📂 Template Dropdown open (capture)')}
                            onChange={(e) => {
                                const templateValue = e.target.value;
                                console.log('🎯 Template Dropdown onChange triggered:', {
                                    templateValue,
                                    eventTargetValue: e.target.value,
                                    currentSelectedTemplate: formData.selectedTemplate,
                                    taskTemplatesKeys: Object.keys(taskTemplates || {}),
                                    totalTemplates: Object.values(taskTemplates || {}).reduce((sum, arr) => sum + (arr || []).length, 0)
                                });

                                handleChange('selectedTemplate', templateValue);
                                console.log('✅ Called handleChange for selectedTemplate:', templateValue);

                                if (templateValue === 'other') {
                                    console.log('🔄 Template is "other", clearing title');
                                    handleChange('title', '');
                                } else if (templateValue) {
                                    console.log('🔍 Looking for template with ID:', templateValue);
                                    // Find template and populate
                                    let selectedTemplate = null;
                                    Object.values(taskTemplates || {}).forEach(categoryTasks => {
                                        const found = (categoryTasks || []).find(t => t.id === templateValue);
                                        if (found) {
                                            selectedTemplate = found;
                                            console.log('✅ Found template:', { id: found.id, taskName: found.taskName });
                                        }
                                    });

                                    if (selectedTemplate) {
                                        console.log('📝 Populating fields with template data:', {
                                            title: selectedTemplate.taskName,
                                            description: selectedTemplate.description
                                        });
                                        handleChange('title', selectedTemplate.taskName || '');
                                        handleChange('description', selectedTemplate.description || formData.description);
                                    } else {
                                        console.warn('❌ Template not found for ID:', templateValue);
                                    }
                                } else {
                                    console.log('🧹 Template value is empty, clearing title');
                                    handleChange('title', '');
                                }

                                console.log('🏁 Template onChange handler completed');
                            }}
                            label="Task Title (Template)"
                            sx={{ fontSize: '12px' }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({ ...prev, selectedTemplate: '', title: '', __templateMenuOpen: false })); }}>None</MenuItem>
                            {Object.entries(taskTemplates || {}).map(([category, items]) => (
                                <React.Fragment key={category}>
                                    <MenuItem disabled sx={{ fontSize: '11px', color: '#6b7280' }}>{category.toUpperCase()}</MenuItem>
                                    {(items || []).map(item => (
                                        <MenuItem key={item.id} value={item.id} sx={{ fontSize: '12px' }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({ ...prev, selectedTemplate: item.id, title: item.taskName || prev.title, description: item.description || prev.description, __templateMenuOpen: false })); }}>
                                            {item.taskName}
                                        </MenuItem>
                                    ))}
                                </React.Fragment>
                            ))}
                            <MenuItem value="other" sx={{ fontSize: '12px' }} onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFormData(prev => ({ ...prev, selectedTemplate: 'other', title: '', __templateMenuOpen: false })); }}>Other…</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                {formData.selectedTemplate === 'other' && (
                    <Grid item xs={12} md={6}>
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
                )}


                <Grid item xs={12}>
                    <TextField
                        fullWidth
                        label="Description"
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        multiline
                        rows={5}
                        size="small"
                        sx={{
                            '& .MuiInputBase-root': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                        placeholder="Detailed instructions for this follow-up task"
                    />
                </Grid>



            </Grid>

            {/* Bottom buttons removed; top-right controls handle submit/cancel */}
        </Box>
    );
};

// ===================================================================
// CREATE RULE FORM COMPONENT
// ===================================================================

const CreateRuleForm = ({ onSave, onCancel, availableCompanies = [], taskTemplates = {}, taskTemplatesLoading = false }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        active: true,
        scope: {
            type: 'all_shipments', // all_shipments, specific_company, shipment_type, service_level, carrier
            companies: [],
            shipmentTypes: [],
            serviceLevels: [],
            carriers: []
        },
        timing: {
            trigger: 'status_change', // status_change, time_before_eta, time_after_eta, fixed_time, fixed_date, manual
            statusChange: {
                fromStatus: '',
                toStatus: ''
            },
            timeOffset: {
                value: 1,
                unit: 'hours' // minutes, hours, days
            },
            fixedTime: '',
            fixedDate: ''
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

    const handleTaskTemplateChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            taskTemplate: {
                ...prev.taskTemplate,
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
                                <Grid item xs={12} md={6}>
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
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {formData.scope.type === 'specific_company' && (
                                    <Grid item xs={12} md={6}>
                                        <Autocomplete
                                            size="small"
                                            options={availableCompanies}
                                            getOptionLabel={(opt) => `${opt.name || opt.companyName || 'Company'} (${opt.companyID || opt.companyId || opt.id || '—'})`}
                                            value={availableCompanies.find(c => c.companyID === formData.scope.companies?.[0]) || null}
                                            onChange={(e, val) => handleScopeChange('companies', val ? [val.companyID || val.companyId || val.id] : [])}
                                            renderInput={(params) => <TextField {...params} label="Company" sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }} />}
                                            renderOption={(props, option) => (
                                                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar src={getCircleLogo(option)} sx={{ width: 20, height: 20 }} />
                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                        <Typography sx={{ fontSize: '12px' }}>{option.name || option.companyName}</Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Company ID: {option.companyID || option.companyId || option.id}</Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                        />
                                    </Grid>
                                )}

                                {formData.scope.type === 'shipment_type' && (
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>Shipment Types</InputLabel>
                                            <Select
                                                multiple
                                                value={formData.scope.shipmentTypes}
                                                onChange={(e) => handleScopeChange('shipmentTypes', typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                                                label="Shipment Types"
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

                                {formData.scope.type === 'service_level' && (
                                    <Grid item xs={12} md={6}>
                                        <ServiceLevelsSelect value={formData.scope.serviceLevels} onChange={(vals) => handleScopeChange('serviceLevels', vals)} />
                                    </Grid>
                                )}

                                {formData.scope.type === 'carrier' && (
                                    <Grid item xs={12} md={6}>
                                        <ConnectedCarriersSelect value={formData.scope.carriers} onChange={(vals) => handleScopeChange('carriers', vals)} />
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

                                {formData.timing.trigger === 'fixed_date' && (
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            label="Date"
                                            type="date"
                                            value={formData.timing.fixedDate}
                                            onChange={(e) => handleTimingChange('fixedDate', e.target.value)}
                                            size="small"
                                            InputLabelProps={{ shrink: true }}
                                            sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
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
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>Task to Create</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TaskTemplateSelect
                                        taskTemplates={taskTemplates}
                                        loading={taskTemplatesLoading}
                                        value={formData.taskTemplate}
                                        onChange={(tpl) => setFormData(prev => ({ ...prev, taskTemplate: { ...prev.taskTemplate, title: tpl?.taskName || '', description: tpl?.taskDescription || '', category: tpl?.category || prev.taskTemplate.category } }))}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        label="Task Description"
                                        value={formData.taskTemplate.description}
                                        onChange={(e) => handleTaskTemplateChange('description', e.target.value)}
                                        multiline
                                        rows={2}
                                        size="small"
                                        sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }}
                                        placeholder="Detailed instructions for the task"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                                        <Select
                                            value={formData.taskTemplate.category}
                                            onChange={(e) => handleTaskTemplateChange('category', e.target.value)}
                                            label="Type"
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
                                            value={formData.taskTemplate.priority}
                                            onChange={(e) => handleTaskTemplateChange('priority', e.target.value)}
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
                                            value={formData.taskTemplate.assignmentRules.type}
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
                                        label={formData.taskTemplate.assignmentRules.type === 'specific_user' ? 'User Email' :
                                            formData.taskTemplate.assignmentRules.type === 'role_based' ? 'Role' : 'Team'}
                                        value={formData.taskTemplate.assignmentRules.value || ''}
                                        onChange={(e) => handleAssignmentChange('value', e.target.value)}
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                        placeholder={
                                            formData.taskTemplate.assignmentRules.type === 'specific_user' ? 'user@company.com' :
                                                formData.taskTemplate.assignmentRules.type === 'role_based' ? 'customer_service' : 'team_name'
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

// Lightweight selects used by CreateRuleForm
function ServiceLevelsSelect({ value = [], onChange }) {
    const [options, setOptions] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const qref = query(collection(db, 'serviceLevels'), where('enabled', '==', true));
                const snap = await getDocs(qref);
                const list = snap.docs.map(d => ({ code: d.data().code, label: d.data().label }));
                setOptions(list);
            } catch (e) {
                setOptions([]);
            } finally { setLoading(false); }
        };
        load();
    }, []);
    return (
        <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '12px' }}>Service Levels</InputLabel>
            <Select multiple value={value} label="Service Levels" onChange={(e) => onChange(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)} sx={{ fontSize: '12px' }}>
                {options.map(opt => (
                    <MenuItem key={opt.code} value={opt.code} sx={{ fontSize: '12px' }}>{opt.label}</MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

function ConnectedCarriersSelect({ value = [], onChange }) {
    const [options, setOptions] = React.useState([]);
    useEffect(() => {
        const load = async () => {
            try {
                const carriers = [];
                const snap1 = await getDocs(collection(db, 'carriers'));
                snap1.forEach(d => carriers.push({ id: d.id, name: d.data().name }));
                const snap2 = await getDocs(collection(db, 'quickshipCarriers'));
                snap2.forEach(d => carriers.push({ id: d.id, name: d.data().name }));
                carriers.sort((a, b) => a.name.localeCompare(b.name));
                setOptions(carriers);
            } catch (e) { setOptions([]); }
        };
        load();
    }, []);
    return (
        <Autocomplete
            multiple
            size="small"
            options={options}
            value={options.filter(o => value.includes(o.name) || value.includes(o.id))}
            getOptionLabel={(o) => o.name}
            onChange={(e, vals) => onChange(vals.map(v => v.name))}
            renderInput={(params) => <TextField {...params} label="Carriers" sx={{ '& .MuiInputBase-root': { fontSize: '12px' }, '& .MuiInputLabel-root': { fontSize: '12px' } }} />}
        />
    );
}

function TaskTemplateSelect({ taskTemplates = {}, loading, value, onChange }) {
    const all = Object.values(taskTemplates || {}).flatMap(l => l || []);
    return (
        <FormControl fullWidth size="small">
            <InputLabel sx={{ fontSize: '12px' }}>Task Title (Template)</InputLabel>
            <Select
                value={value?.selectedTemplate || ''}
                label="Task Title (Template)"
                onChange={(e) => {
                    const tpl = all.find(t => t.id === e.target.value) || null;
                    onChange(tpl);
                }}
                sx={{ fontSize: '12px' }}
            >
                <MenuItem value="" sx={{ fontSize: '12px' }}>None</MenuItem>
                {all.map(t => (
                    <MenuItem key={t.id} value={t.id} sx={{ fontSize: '12px' }}>{t.taskName}</MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}