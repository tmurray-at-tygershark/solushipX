import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Button,
    Chip,
    Divider,
    Breadcrumbs,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    InputAdornment,
    Stack,
    Tooltip,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    Checkbox,
    Card,
    CardContent,
    Avatar,
    Alert,
    Snackbar,
    CardHeader,
    CardActions,
    Collapse,
    InputBase,
    styled,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    Fade,
    Zoom,
    Badge,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Autocomplete,
    Switch,
    FormControlLabel,
    Tabs,
    Tab,
    LinearProgress,
    Rating,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    TimelineOppositeContent,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    SpeedDial,
    SpeedDialAction,
    SpeedDialIcon,
    Drawer,
    AppBar,
    Toolbar
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    LocationOn as LocationIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Business as BusinessIcon,
    CalendarToday as CalendarIcon,
    NavigateNext as NavigateNextIcon,
    Home as HomeIcon,
    Map as MapIcon,
    Search as SearchIcon,
    LocalShipping as ShippingIcon,
    Visibility as VisibilityIcon,
    Person as PersonIcon,
    Print as PrintIcon,
    MoreVert as MoreVertIcon,
    Add as AddIcon,
    Note as NoteIcon,
    Send as SendIcon,
    AttachFile as AttachFileIcon,
    Image as ImageIcon,
    Link as LinkIcon,
    EmojiEmotions as EmojiIcon,
    Reply as ReplyIcon,
    Favorite as FavoriteIcon,
    FavoriteBorder as FavoriteBorderIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Close as CloseIcon,
    PhotoCamera as PhotoCameraIcon,
    InsertLink as InsertLinkIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Schedule as ScheduleIcon,
    ThumbUp as ThumbUpIcon,
    ThumbUpOutlined as ThumbUpOutlinedIcon,
    Comment as CommentIcon,
    Attachment as AttachmentIcon,
    Download as DownloadIcon,
    ContentCopy as ContentCopyIcon,
    PriorityHigh as PriorityHighIcon,
    Flag as FlagIcon,
    Assignment as AssignmentIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
    BugReport as BugReportIcon,
    Build as BuildIcon,
    Notifications as NotificationsIcon,
    NotificationsOff as NotificationsOffIcon,
    Share as ShareIcon,
    History as HistoryIcon,
    FilterList as FilterListIcon,
    Sort as SortIcon,
    Mic as MicIcon,
    MicOff as MicOffIcon,
    VideoCall as VideoCallIcon,
    Phone as PhoneCallIcon,
    Tag as TagIcon,
    Label as LabelIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    Archive as ArchiveIcon,
    Unarchive as UnarchiveIcon,
    Pin as PinIcon,
    PushPin as PushPinIcon,
    Translate as TranslateIcon,
    VolumeUp as VolumeUpIcon,
    PlayArrow as PlayArrowIcon,
    Pause as PauseIcon,
    Stop as StopIcon,
    Refresh as RefreshIcon,
    Sync as SyncIcon,
    Cloud as CloudIcon,
    CloudDone as CloudDoneIcon,
    Folder as FolderIcon,
    Description as DescriptionIcon,
    PictureAsPdf as PdfIcon,
    TableChart as ExcelIcon,
    Code as CodeIcon,
    Movie as VideoIcon,
    MusicNote as AudioIcon,
    InsertDriveFile as FileIcon,
    FormatBold as BoldIcon,
    FormatItalic as ItalicIcon,
    FormatUnderlined as UnderlineIcon,
    FormatListBulleted as BulletListIcon,
    FormatListNumbered as NumberListIcon,
    FormatQuote as QuoteIcon,
    FormatSize as FontSizeIcon,
    FormatColorText as TextColorIcon,
    FormatColorFill as HighlightIcon,
    Link as LinkInsertIcon,
    Image as ImageInsertIcon,
    Table as TableIcon,
    Code as CodeBlockIcon,
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, updateDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import useModalNavigation from '../../hooks/useModalNavigation';
import { GoogleMap, Marker } from '@react-google-maps/api';
import './CustomerDetail.css';

// Import common components
import ModalHeader from '../common/ModalHeader';

// Enhanced emoji picker data for 2025 enterprise warehouse system
const EMOJI_CATEGORIES = {
    'Quick Actions': ['✅', '❌', '⚠️', '🔥', '⭐', '📌', '🚀', '💡'],
    'Status & Priority': ['🟢', '🟡', '🔴', '🔵', '🟣', '⚫', '⚪', '🟤', '🟠'],
    'Warehouse Operations': ['📦', '🚚', '🏭', '🏗️', '⚙️', '🔧', '🔨', '📋', '📊', '📈', '📉', '💼', '📞', '📧', '🔗', '📎', '📝', '📄', '🗂️', '📁', '📅', '⏰', '⏱️', '⏲️'],
    'Quality & Issues': ['🛡️', '🔒', '🔓', '🔐', '🔑', '🗝️', '🚫', '⛔', '🚷', '🚯', '🚱', '🚳', '🚭', '📵', '🔞', '☢️', '☣️', '⚠️', '🚸', '⚡', '🔥', '💥', '💢'],
    'Communication': ['💬', '💭', '🗯️', '💡', '📢', '📣', '📯', '🔔', '🔕', '📞', '📟', '📠', '📧', '📨', '📩', '📤', '📥', '📮', '🗳️', '✏️', '✒️', '🖋️', '🖊️', '🖌️', '🖍️', '📝'],
    'Emotions & Reactions': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
    'Numbers & Time': ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛', '⏰', '⏱️', '⏲️', '⏳', '⌛', '📅', '📆', '🗓️'],
    'Symbols & Arrows': ['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️', '🔄', '🔃', '🔂', '🔁', '🔀', '🔼', '🔽', '⏭️', '⏮️', '⏯️', '⏹️', '⏺️', '⏸️', '▶️', '⏩', '⏪', '🔊', '🔉', '🔈', '🔇', '📶', '📳', '📴']
};

// Note types for enterprise warehouse management
const NOTE_TYPES = {
    general: { label: 'General Note', icon: '📝', color: '#6366f1', bgColor: '#eef2ff' },
    issue: { label: 'Issue/Problem', icon: '⚠️', color: '#ef4444', bgColor: '#fef2f2' },
    resolution: { label: 'Resolution', icon: '✅', color: '#10b981', bgColor: '#ecfdf5' },
    followup: { label: 'Follow-up Required', icon: '🔄', color: '#f59e0b', bgColor: '#fef3c7' },
    priority: { label: 'Priority/Urgent', icon: '🔥', color: '#dc2626', bgColor: '#fee2e2' },
    quality: { label: 'Quality Control', icon: '🛡️', color: '#7c3aed', bgColor: '#f5f3ff' },
    shipping: { label: 'Shipping Related', icon: '🚚', color: '#0ea5e9', bgColor: '#eff6ff' },
    billing: { label: 'Billing/Payment', icon: '💰', color: '#059669', bgColor: '#ecfdf5' },
    compliance: { label: 'Compliance/Legal', icon: '⚖️', color: '#4338ca', bgColor: '#eef2ff' },
    training: { label: 'Training/Documentation', icon: '📚', color: '#7c2d12', bgColor: '#fef7ed' }
};

// Priority levels
const PRIORITY_LEVELS = {
    low: { label: 'Low', color: '#6b7280', bgColor: '#f3f4f6', icon: '⬇️' },
    medium: { label: 'Medium', color: '#f59e0b', bgColor: '#fef3c7', icon: '➡️' },
    high: { label: 'High', color: '#ef4444', bgColor: '#fef2f2', icon: '⬆️' },
    urgent: { label: 'Urgent', color: '#dc2626', bgColor: '#fee2e2', icon: '🔥' },
    critical: { label: 'Critical', color: '#991b1b', bgColor: '#fecaca', icon: '🚨' }
};

// Note status options
const NOTE_STATUS = {
    open: { label: 'Open', color: '#3b82f6', bgColor: '#eff6ff', icon: '🔵' },
    inProgress: { label: 'In Progress', color: '#f59e0b', bgColor: '#fef3c7', icon: '🟡' },
    resolved: { label: 'Resolved', color: '#10b981', bgColor: '#ecfdf5', icon: '🟢' },
    closed: { label: 'Closed', color: '#6b7280', bgColor: '#f3f4f6', icon: '⚫' },
    archived: { label: 'Archived', color: '#9ca3af', bgColor: '#f9fafb', icon: '📦' }
};

// Styled components for enterprise UI
const StyledNoteCard = styled(Card)(({ theme, noteType, priority, isPinned }) => ({
    marginBottom: theme.spacing(2),
    border: `2px solid ${NOTE_TYPES[noteType]?.color || '#e2e8f0'}`,
    borderRadius: '16px',
    transition: 'all 0.3s ease-in-out',
    position: 'relative',
    backgroundColor: isPinned ? '#fffbeb' : 'white',
    '&:hover': {
        borderColor: NOTE_TYPES[noteType]?.color || '#c7d2fe',
        boxShadow: `0 8px 25px ${NOTE_TYPES[noteType]?.color}20`,
        transform: 'translateY(-2px)',
    },
    '&::before': isPinned ? {
        content: '"📌"',
        position: 'absolute',
        top: '8px',
        right: '8px',
        fontSize: '16px',
        zIndex: 1
    } : {},
    ...(priority === 'urgent' || priority === 'critical' ? {
        animation: 'pulse 2s infinite',
        '@keyframes pulse': {
            '0%': { boxShadow: `0 0 0 0 ${PRIORITY_LEVELS[priority].color}40` },
            '70%': { boxShadow: `0 0 0 10px ${PRIORITY_LEVELS[priority].color}00` },
            '100%': { boxShadow: `0 0 0 0 ${PRIORITY_LEVELS[priority].color}00` }
        }
    } : {})
}));

const StyledReplyCard = styled(Card)(({ theme }) => ({
    marginLeft: theme.spacing(4),
    marginTop: theme.spacing(1),
    border: '1px solid #f1f5f9',
    borderRadius: '12px',
    backgroundColor: '#fafbff',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
        backgroundColor: '#f8fafc',
        borderColor: '#e2e8f0'
    }
}));

const EmojiButton = styled(IconButton)(({ theme }) => ({
    fontSize: '18px',
    minWidth: '36px',
    height: '36px',
    margin: '2px',
    borderRadius: '8px',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
        backgroundColor: theme.palette.action.hover,
        transform: 'scale(1.1)',
    },
}));

const AttachmentPreview = styled(Box)(({ theme, attachmentType }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    border: '2px dashed #d1d5db',
    borderRadius: '12px',
    backgroundColor: '#f9fafb',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
        borderColor: '#6366f1',
        backgroundColor: '#f8fafc'
    },
    ...(attachmentType === 'image' ? {
        borderColor: '#10b981',
        backgroundColor: '#ecfdf5'
    } : {}),
    ...(attachmentType === 'document' ? {
        borderColor: '#3b82f6',
        backgroundColor: '#eff6ff'
    } : {}),
    ...(attachmentType === 'audio' ? {
        borderColor: '#f59e0b',
        backgroundColor: '#fef3c7'
    } : {})
}));

const RichTextEditor = styled(Box)(({ theme }) => ({
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    overflow: 'hidden',
    transition: 'all 0.2s ease-in-out',
    '&:focus-within': {
        borderColor: '#6366f1',
        boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.1)'
    }
}));

const ToolbarButton = styled(IconButton)(({ theme, active }) => ({
    margin: '2px',
    padding: '6px',
    borderRadius: '6px',
    backgroundColor: active ? '#6366f1' : 'transparent',
    color: active ? 'white' : '#6b7280',
    '&:hover': {
        backgroundColor: active ? '#5b21b6' : '#f3f4f6'
    }
}));

// Add formatAddress function (copied from Shipments.jsx)
const formatAddress = (address, label = '') => {
    if (!address || typeof address !== 'object') {
        if (label) {
            console.warn(`No valid address object for ${label}:`, address);
        }
        return <div>N/A</div>;
    }
    return (
        <>
            {address.company && <div>{address.company}</div>}
            {address.attentionName && <div>{address.attentionName}</div>}
            {address.street && <div>{address.street}</div>}
            {address.street2 && address.street2 !== '' && <div>{address.street2}</div>}
            <div>
                {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
            </div>
            {address.country && <div>{address.country}</div>}
        </>
    );
};

// Extract StatusChip component for reusability (from Shipments.jsx)
const StatusChip = React.memo(({ status }) => {
    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
            case 'created':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Pending'
                };
            case 'booked':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Booked'
                };
            case 'awaiting pickup':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Awaiting Pickup'
                };
            case 'awaiting shipment':
                return {
                    color: '#3B82F6',
                    bgcolor: '#EFF6FF',
                    label: 'Awaiting Shipment'
                };
            case 'in transit':
                return {
                    color: '#6366F1',
                    bgcolor: '#EEF2FF',
                    label: 'In Transit'
                };
            case 'on hold':
                return {
                    color: '#7C3AED',
                    bgcolor: '#F5F3FF',
                    label: 'On Hold'
                };
            case 'delivered':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Delivered'
                };
            case 'cancelled':
                return {
                    color: '#EF4444',
                    bgcolor: '#FEE2E2',
                    label: 'Cancelled'
                };
            default:
                return {
                    color: '#6B7280',
                    bgcolor: '#F3F4F6',
                    label: status || 'Unknown'
                };
        }
    };

    const { color, bgcolor, label } = getStatusConfig(status);

    return (
        <Chip
            label={label}
            sx={{
                color: color,
                bgcolor: bgcolor,
                borderRadius: '16px',
                fontWeight: 500,
                fontSize: '0.75rem',
                height: '24px',
                '& .MuiChip-label': {
                    px: 2
                }
            }}
            size="small"
        />
    );
});

const CustomerDetail = ({ customerId = null, onBackToTable = null, onNavigateToShipments = null, isModal = false, highlightNoteId = null }) => {
    const { id: urlId } = useParams();
    const navigate = useNavigate();
    const { companyIdForAddress } = useCompany();
    const { user, loading: authLoading } = useAuth();

    // Debug logging
    useEffect(() => {
        console.log('CustomerDetail - Auth state:', { user, authLoading, companyIdForAddress });
    }, [user, authLoading, companyIdForAddress]);

    // Modal navigation system
    const modalNavigation = useModalNavigation({
        title: 'Customer Details',
        shortTitle: 'Customer',
        component: 'customer-detail'
    });

    // Use prop customerId if provided, otherwise fall back to URL parameter
    const id = customerId || urlId;

    // Use highlightNoteId prop for deep linking (passed from email notifications)

    // Basic state
    const [customer, setCustomer] = useState(null);
    const [mainContactDetails, setMainContactDetails] = useState(null);
    const [destinationAddresses, setDestinationAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Enhanced notes system state
    const [notes, setNotes] = useState([]);
    const [filteredNotes, setFilteredNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [addingNote, setAddingNote] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Advanced note features
    const [selectedNoteType, setSelectedNoteType] = useState('general');
    const [selectedPriority, setSelectedPriority] = useState('medium');
    const [selectedStatus, setSelectedStatus] = useState('open');
    const [noteTags, setNoteTags] = useState([]);
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [dueDate, setDueDate] = useState(null);
    const [isPrivate, setIsPrivate] = useState(false);
    const [isPinned, setIsPinned] = useState(false);

    // Rich text editor state
    const [editorContent, setEditorContent] = useState('');
    const [editorFormatting, setEditorFormatting] = useState({
        bold: false,
        italic: false,
        underline: false,
        fontSize: 14,
        textColor: '#000000',
        backgroundColor: '#ffffff'
    });

    // Filter and search state
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterAssignee, setFilterAssignee] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [showArchived, setShowArchived] = useState(false);

    // UI state
    const [activeTab, setActiveTab] = useState(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showAdvancedEditor, setShowAdvancedEditor] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);

    // Existing state
    const [editingNote, setEditingNote] = useState(null);
    const [editNoteContent, setEditNoteContent] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState(new Set());
    const [userProfiles, setUserProfiles] = useState({});
    const [availableUsers, setAvailableUsers] = useState([]);
    const [availableTags, setAvailableTags] = useState([]);

    // Map modal state
    const [showMapModal, setShowMapModal] = useState(false);
    const [mapCenter, setMapCenter] = useState(null);
    const [mapLoading, setMapLoading] = useState(false);
    const [mapError, setMapError] = useState(null);

    // Refs
    const fileInputRef = useRef(null);
    const noteInputRef = useRef(null);
    const editorRef = useRef(null);
    const recordingIntervalRef = useRef(null);

    // Initialize component with enterprise features
    useEffect(() => {
        let notesUnsubscribe = null;

        if (id) {
            fetchCustomerData();
            fetchNotes().then(unsubscribe => {
                notesUnsubscribe = unsubscribe;
            });
            fetchAvailableUsers();
            fetchAvailableTags();
        }

        // Cleanup function
        return () => {
            if (notesUnsubscribe) {
                notesUnsubscribe();
            }
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        };
    }, [id]);

    // Filter notes based on search and filters
    useEffect(() => {
        let filtered = [...notes];

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(note =>
                note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                note.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
                note.createdBy.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Type filter
        if (filterType !== 'all') {
            filtered = filtered.filter(note => note.type === filterType);
        }

        // Priority filter
        if (filterPriority !== 'all') {
            filtered = filtered.filter(note => note.priority === filterPriority);
        }

        // Status filter
        if (filterStatus !== 'all') {
            filtered = filtered.filter(note => note.status === filterStatus);
        }

        // Assignee filter
        if (filterAssignee !== 'all') {
            filtered = filtered.filter(note =>
                note.assignedUsers?.includes(filterAssignee)
            );
        }

        // Archive filter
        if (!showArchived) {
            filtered = filtered.filter(note => note.status !== 'archived');
        }

        // Sort
        switch (sortBy) {
            case 'newest':
                filtered.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt));
                break;
            case 'oldest':
                filtered.sort((a, b) => new Date(a.createdAt?.toDate?.() || a.createdAt) - new Date(b.createdAt?.toDate?.() || b.createdAt));
                break;
            case 'priority':
                const priorityOrder = { critical: 5, urgent: 4, high: 3, medium: 2, low: 1 };
                filtered.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
                break;
            case 'status':
                filtered.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
                break;
            case 'type':
                filtered.sort((a, b) => (a.type || '').localeCompare(b.type || ''));
                break;
        }

        // Pin priority - pinned notes always at top
        filtered.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return 0;
        });

        setFilteredNotes(filtered);
    }, [notes, searchTerm, filterType, filterPriority, filterStatus, filterAssignee, sortBy, showArchived]);

    // Deep linking effect for scrolling to specific notes
    useEffect(() => {
        if (highlightNoteId && notes.length > 0) {
            // Wait for components to render, then scroll to the note
            setTimeout(() => {
                const noteElement = document.getElementById(`note-${highlightNoteId}`);
                if (noteElement) {
                    noteElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });

                    // Add temporary highlight effect
                    noteElement.style.boxShadow = '0 0 20px rgba(28, 39, 125, 0.3)';
                    noteElement.style.border = '2px solid #1c277d';
                    noteElement.style.transition = 'all 0.3s ease';

                    // Remove highlight after 3 seconds
                    setTimeout(() => {
                        noteElement.style.boxShadow = '';
                        noteElement.style.border = '';
                    }, 3000);
                }
            }, 500);
        }
    }, [notes, highlightNoteId]);

    const fetchCustomerData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch customer data
            const customerDocRef = doc(db, 'customers', id);
            const customerDoc = await getDoc(customerDocRef);
            if (!customerDoc.exists()) {
                throw new Error('Customer not found');
            }
            const customerData = { id: customerDoc.id, ...customerDoc.data() };
            setCustomer(customerData);
            console.log('Fetched customer data:', customerData);

            // Fetch main contact and destination addresses from addressBook if customerID exists
            if (customerData.customerID) {
                console.log('Fetching addresses for customerID:', customerData.customerID);
                const addressBookQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'customer'),
                    where('addressClassID', '==', customerData.customerID)
                );
                const addressBookSnapshot = await getDocs(addressBookQuery);

                const addresses = addressBookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('Fetched addresses from addressBook:', addresses);

                const mainContact = addresses.find(addr => addr.addressType === 'contact');
                const destinations = addresses.filter(addr => addr.addressType === 'destination');

                if (mainContact) {
                    console.log('Main contact found:', mainContact);
                    setMainContactDetails(mainContact);
                } else {
                    console.log('No main contact found for customerID:', customerData.customerID);
                    setMainContactDetails(null); // Explicitly set to null if not found
                }

                console.log('Destination addresses found:', destinations);
                setDestinationAddresses(destinations);
            } else {
                console.warn('Customer document is missing customerID field. Cannot fetch addresses.');
                setMainContactDetails(null);
                setDestinationAddresses([]);
            }

            // Note: Notes are fetched separately by fetchNotes() with real-time listener
        } catch (error) {
            console.error('Error fetching customer data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // Fetch notes with enhanced enterprise features
    const fetchNotes = async () => {
        if (!id) return;

        try {
            // Fetch notes from the customer's subcollection
            const customerRef = doc(db, 'customers', id);
            const notesRef = collection(customerRef, 'notes');
            const qNotes = query(
                notesRef,
                orderBy('createdAt', 'desc'),
                limit(50) // Increased limit for enterprise use
            );

            // Set up real-time listener
            const unsubscribe = onSnapshot(qNotes, async (snapshot) => {
                const notesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('Fetched notes from customer subcollection:', notesData);
                setNotes(notesData);

                // Fetch user profiles for notes authors, assignees, and repliers
                const userUIDs = new Set();
                notesData.forEach(note => {
                    if (note.createdByUID) userUIDs.add(note.createdByUID);
                    if (note.assignedUsers) {
                        note.assignedUsers.forEach(uid => userUIDs.add(uid));
                    }
                    if (note.replies) {
                        note.replies.forEach(reply => {
                            if (reply.createdByUID) userUIDs.add(reply.createdByUID);
                        });
                    }
                });

                if (userUIDs.size > 0) {
                    await fetchUserProfiles(Array.from(userUIDs));
                }
            });

            return unsubscribe;
        } catch (error) {
            console.error('Error fetching notes:', error);
        }
    };

    // Fetch available users for assignment
    const fetchAvailableUsers = async () => {
        try {
            if (!companyIdForAddress) return;

            const usersQuery = query(
                collection(db, 'users'),
                where('companyId', '==', companyIdForAddress)
            );
            const usersSnapshot = await getDocs(usersQuery);
            const users = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAvailableUsers(users);
        } catch (error) {
            console.error('Error fetching available users:', error);
        }
    };

    // Fetch available tags
    const fetchAvailableTags = async () => {
        try {
            if (!companyIdForAddress) return;

            // Get tags from existing notes
            const customerRef = doc(db, 'customers', id);
            const notesRef = collection(customerRef, 'notes');
            const notesSnapshot = await getDocs(notesRef);

            const allTags = new Set();
            notesSnapshot.docs.forEach(doc => {
                const noteData = doc.data();
                if (noteData.tags) {
                    noteData.tags.forEach(tag => allTags.add(tag));
                }
            });

            setAvailableTags(Array.from(allTags));
        } catch (error) {
            console.error('Error fetching available tags:', error);
        }
    };

    // Handle back button click
    const handleBackClick = () => {
        if (onBackToTable) {
            // Use sliding functionality when available (inside Customers slide-over)
            onBackToTable();
        } else {
            // Fall back to navigation when not in sliding view
            navigate('/customers');
        }
    };

    // Fetch user profiles for avatar display
    const fetchUserProfiles = async (userUIDs) => {
        try {
            const profiles = {};
            for (const uid of userUIDs) {
                if (!userProfiles[uid]) {
                    const userDoc = await getDoc(doc(db, 'users', uid));
                    if (userDoc.exists()) {
                        profiles[uid] = userDoc.data();
                    } else {
                        // Fallback profile
                        profiles[uid] = {
                            displayName: 'Unknown User',
                            email: 'unknown@example.com',
                            photoURL: null
                        };
                    }
                }
            }
            setUserProfiles(prev => ({ ...prev, ...profiles }));
        } catch (error) {
            console.error('Error fetching user profiles:', error);
        }
    };

    // Voice recording functions
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];

            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = async () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const audioFile = new File([blob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
                const attachment = await handleFileUpload(audioFile);
                if (attachment) {
                    setAttachments(prev => [...prev, { ...attachment, type: 'audio', duration: recordingTime }]);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);
            recorder.start();

            // Start timer
            recordingIntervalRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error starting recording:', error);
            setErrorMessage('Failed to start recording. Please check microphone permissions.');
            setShowError(true);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            setIsRecording(false);
            clearInterval(recordingIntervalRef.current);
        }
    };

    // Enhanced file upload with metadata
    const handleFileUpload = async (file) => {
        if (!file) return null;

        setUploadingFile(true);
        try {
            // Get current user with fallback
            const currentUser = getCurrentUser();

            // Use the same storage configuration as AdminCarriers and Profile
            const { getApp } = await import('firebase/app');
            const { getStorage } = await import('firebase/storage');
            const firebaseApp = getApp();
            const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");

            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const fileRef = ref(customStorage, `customer-notes/${id}/${fileName}`);
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Determine file type and extract metadata
            let fileType = 'file';
            let metadata = {};

            if (file.type.startsWith('image/')) {
                fileType = 'image';
            } else if (file.type.startsWith('audio/')) {
                fileType = 'audio';
            } else if (file.type.startsWith('video/')) {
                fileType = 'video';
            } else if (file.type.includes('pdf')) {
                fileType = 'document';
                metadata.documentType = 'pdf';
            } else if (file.type.includes('sheet') || file.type.includes('excel')) {
                fileType = 'document';
                metadata.documentType = 'spreadsheet';
            } else if (file.type.includes('document') || file.type.includes('word')) {
                fileType = 'document';
                metadata.documentType = 'word';
            }

            console.log('📎 File uploaded successfully:', {
                name: file.name,
                type: fileType,
                size: file.size,
                uploadedBy: currentUser.uid
            });

            return {
                type: fileType,
                name: file.name,
                url: downloadURL,
                size: file.size, // Store as number of bytes
                mimeType: file.type,
                uploadedAt: new Date(),
                uploadedBy: currentUser.uid,
                metadata
            };
        } catch (error) {
            console.error('💥 Error uploading file:', error);
            setErrorMessage('Failed to upload file: ' + error.message);
            setShowError(true);
            return null;
        } finally {
            setUploadingFile(false);
        }
    };

    // Extract @mentions from text
    const extractMentions = (text) => {
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }
        return mentions;
    };

    // Extract #hashtags from text
    const extractHashtags = (text) => {
        const hashtagRegex = /#(\w+)/g;
        const hashtags = [];
        let match;
        while ((match = hashtagRegex.exec(text)) !== null) {
            hashtags.push(match[1]);
        }
        return hashtags;
    };

    // Extract URLs from text
    const extractUrls = (text) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = [];
        let match;
        while ((match = urlRegex.exec(text)) !== null) {
            urls.push({
                type: 'link',
                url: match[1],
                title: match[1],
                addedAt: new Date(),
                source: 'auto-detected'
            });
        }
        return urls;
    };

    // Send comprehensive notifications
    const sendNoteNotifications = async (noteId, noteData) => {
        try {
            // Get user info with improved fallback
            const currentUser = getCurrentUser();

            const emailNotificationData = {
                noteId: noteId,
                customerID: customer?.customerID || id, // Use the actual customerID from customer record, fallback to document ID
                customerName: customer?.name || 'Unknown Customer',
                companyID: companyIdForAddress,
                content: noteData.content,
                type: noteData.type,
                priority: noteData.priority,
                status: noteData.status,
                tags: noteData.tags,
                assignedUsers: noteData.assignedUsers,
                mentions: noteData.mentions,
                createdBy: currentUser.email || currentUser.displayName || 'Unknown User',
                createdByName: currentUser.displayName || currentUser.email || 'Unknown User',
                createdAt: new Date(),
                attachments: noteData.attachments || [],
                noteUrl: `https://solushipx.web.app/dashboard?modal=customers&customerId=${id}&note=${noteId}`
            };

            // Use the functions import from firebase.js instead of dynamic import
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const sendCustomerNoteNotification = httpsCallable(functions, 'sendCustomerNoteNotification', {
                timeout: 30000, // 30 second timeout
            });

            console.log('📧 Sending notification with data:', emailNotificationData);
            const result = await sendCustomerNoteNotification(emailNotificationData);
            console.log('✅ Email notification sent successfully:', result);
        } catch (emailError) {
            console.error('💥 Failed to send email notification:', emailError);
            // Don't throw the error - just log it so note creation still succeeds
        }
    };

    // Reset note form
    const resetNoteForm = () => {
        setNewNote('');
        setAttachments([]);
        setSelectedNoteType('general');
        setSelectedPriority('medium');
        setSelectedStatus('open');
        setNoteTags([]);
        setAssignedUsers([]);
        setDueDate(null);
        setIsPrivate(false);
        setIsPinned(false);
        setEditorContent('');
        setEditorFormatting({
            bold: false,
            italic: false,
            underline: false,
            fontSize: 14,
            textColor: '#000000',
            backgroundColor: '#ffffff'
        });
    };

    // Enhanced note creation with all enterprise features
    const handleAddNote = async () => {
        console.log('🚀 handleAddNote called with:', {
            newNote,
            user,
            authLoading,
            companyIdForAddress,
            id,
            userType: typeof user,
            userKeys: user ? Object.keys(user) : 'no user object',
            hasUID: user?.uid ? 'YES' : 'NO',
            hasEmail: user?.email ? 'YES' : 'NO'
        });

        if (!newNote.trim()) {
            console.log('❌ Validation failed: Empty note');
            setErrorMessage('Please enter a note');
            setShowError(true);
            return;
        }

        if (authLoading) {
            console.log('❌ Validation failed: Auth still loading');
            setErrorMessage('Please wait for authentication to load...');
            setShowError(true);
            return;
        }

        // Since user can access this page, they must be authenticated
        // Let's be more flexible with user validation
        if (!user && !authLoading) {
            console.log('⚠️ User object is undefined but auth is not loading - proceeding with fallback');
            console.log('🔍 Checking localStorage for user info...');

            // Try to get user info from localStorage or other sources
            const fallbackUser = {
                uid: localStorage.getItem('userUID') || 'anonymous_' + Date.now(),
                email: localStorage.getItem('userEmail') || 'unknown@example.com',
                displayName: localStorage.getItem('userDisplayName') || 'Unknown User'
            };
            console.log('🔄 Using fallback user:', fallbackUser);
        }

        if (!companyIdForAddress) {
            console.log('❌ Validation failed: No company ID');
            setErrorMessage('Company information not available');
            setShowError(true);
            return;
        }

        if (!id) {
            console.log('❌ Validation failed: No customer ID');
            setErrorMessage('Customer ID not available');
            setShowError(true);
            return;
        }

        console.log('✅ All validations passed, proceeding with note creation...');

        setAddingNote(true);
        try {
            // Get user info with improved fallback
            const currentUser = getCurrentUser();
            console.log('👤 Using user for note creation:', currentUser);

            // Ensure we have a valid user object
            if (!currentUser || !currentUser.uid) {
                console.log('❌ Invalid user object:', currentUser);
                setErrorMessage('Authentication error. Please refresh the page and try again.');
                setShowError(true);
                return;
            }

            const noteData = {
                // Basic fields
                customerID: id,
                companyID: companyIdForAddress,
                content: newNote.trim(),
                createdBy: currentUser.email || currentUser.displayName || 'Unknown User',
                createdByUID: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),

                // Enterprise features
                type: selectedNoteType,
                priority: selectedPriority,
                status: selectedStatus,
                tags: noteTags,
                assignedUsers: assignedUsers,
                dueDate: dueDate ? new Date(dueDate) : null,
                isPrivate: isPrivate,
                isPinned: isPinned,

                // Attachments and media (combine file attachments with auto-detected URLs)
                attachments: [...(attachments || []), ...extractUrls(newNote)],

                // Collaboration features
                reactions: {},
                replies: [],
                mentions: extractMentions(newNote),
                hashtags: extractHashtags(newNote),

                // Metadata
                isEdited: false,
                editHistory: [],
                viewCount: 0,
                lastViewed: {},

                // Enhanced metadata for enterprise tracking
                metadata: {
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    sessionId: currentUser.uid + '_' + Date.now(),
                    source: 'customer_detail',
                    version: '2.0',
                    formatting: editorFormatting
                }
            };

            console.log('📝 Creating note with data:', noteData);

            // Save note as a subcollection within the customer document
            console.log('🔗 Creating customer reference for ID:', id);
            const customerRef = doc(db, 'customers', id);
            const notesRef = collection(customerRef, 'notes');

            console.log('💾 Attempting to save note to Firestore...');
            const docRef = await addDoc(notesRef, noteData);
            console.log('✅ Note created successfully with ID:', docRef.id);

            // Also save to the global customerNotes collection for cross-customer queries
            try {
                console.log('🌐 Saving to global customerNotes collection...');
                const globalNotesRef = collection(db, 'customerNotes');
                await addDoc(globalNotesRef, {
                    ...noteData,
                    noteId: docRef.id,
                    customerDocumentId: id
                });
                console.log('✅ Note also saved to global collection');
            } catch (globalError) {
                console.warn('⚠️ Failed to save to global collection, but note was saved:', globalError);
            }

            // Send notifications (non-blocking)
            console.log('📧 Attempting to send notifications...');
            sendNoteNotifications(docRef.id, noteData).catch(notificationError => {
                console.warn('⚠️ Failed to send notifications, but note was saved:', notificationError);
            });

            // Clear form and show success
            console.log('🧹 Clearing form and showing success message...');
            resetNoteForm();
            setShowSuccess(true);
            console.log('🎉 Note creation completed successfully!');

            // Focus back to input for better UX
            if (noteInputRef.current) {
                setTimeout(() => noteInputRef.current.focus(), 100);
            }
        } catch (error) {
            console.error('💥 Error adding note:', error);
            console.error('💥 Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack,
                name: error.name
            });
            setErrorMessage('Failed to add note: ' + error.message);
            setShowError(true);
        } finally {
            console.log('🏁 Note creation process finished, setting addingNote to false');
            setAddingNote(false);
        }
    };

    // Add reply to note
    const handleAddReply = async (noteId) => {
        if (!replyText.trim()) {
            setErrorMessage('Please enter a reply');
            setShowError(true);
            return;
        }

        try {
            // Get user info with improved fallback
            const currentUser = getCurrentUser();

            const customerRef = doc(db, 'customers', id);
            const noteRef = doc(customerRef, 'notes', noteId);
            const noteDoc = await getDoc(noteRef);

            if (noteDoc.exists()) {
                const currentReplies = noteDoc.data().replies || [];
                const newReply = {
                    id: Date.now().toString(),
                    content: replyText.trim(),
                    createdBy: currentUser.email || currentUser.displayName || 'Unknown User',
                    createdByUID: currentUser.uid,
                    createdAt: new Date(),
                    reactions: {}
                };

                await updateDoc(noteRef, {
                    replies: [...currentReplies, newReply],
                    updatedAt: serverTimestamp()
                });

                setReplyText('');
                setReplyingTo(null);
                setShowSuccess(true);
            }
        } catch (error) {
            console.error('Error adding reply:', error);
            setErrorMessage('Failed to add reply');
            setShowError(true);
        }
    };

    // Toggle reaction
    const handleToggleReaction = async (noteId, emoji, isReply = false, replyId = null) => {
        try {
            // Get user info with improved fallback
            const currentUser = getCurrentUser();

            const customerRef = doc(db, 'customers', id);
            const noteRef = doc(customerRef, 'notes', noteId);
            const noteDoc = await getDoc(noteRef);

            if (noteDoc.exists()) {
                const noteData = noteDoc.data();

                if (isReply && replyId) {
                    // Handle reply reaction
                    const replies = [...(noteData.replies || [])];
                    const replyIndex = replies.findIndex(r => r.id === replyId);

                    if (replyIndex !== -1) {
                        const reactions = replies[replyIndex].reactions || {};
                        const userReactions = reactions[emoji] || [];

                        if (userReactions.includes(currentUser.uid)) {
                            reactions[emoji] = userReactions.filter(uid => uid !== currentUser.uid);
                        } else {
                            reactions[emoji] = [...userReactions, currentUser.uid];
                        }

                        replies[replyIndex].reactions = reactions;
                        await updateDoc(noteRef, { replies });
                    }
                } else {
                    // Handle note reaction
                    const reactions = noteData.reactions || {};
                    const userReactions = reactions[emoji] || [];

                    if (userReactions.includes(currentUser.uid)) {
                        reactions[emoji] = userReactions.filter(uid => uid !== currentUser.uid);
                    } else {
                        reactions[emoji] = [...userReactions, currentUser.uid];
                    }

                    await updateDoc(noteRef, { reactions });
                }
            }
        } catch (error) {
            console.error('Error toggling reaction:', error);
        }
    };

    // Edit note
    const handleEditNote = async (noteId, newContent) => {
        try {
            const customerRef = doc(db, 'customers', id);
            const noteRef = doc(customerRef, 'notes', noteId);
            await updateDoc(noteRef, {
                content: newContent,
                updatedAt: serverTimestamp(),
                isEdited: true
            });

            setEditingNote(null);
            setShowSuccess(true);
        } catch (error) {
            console.error('Error editing note:', error);
            setErrorMessage('Failed to edit note');
            setShowError(true);
        }
    };

    // Delete note
    const handleDeleteNote = async (noteId) => {
        if (!window.confirm('Are you sure you want to delete this note?')) return;

        try {
            const customerRef = doc(db, 'customers', id);
            const noteRef = doc(customerRef, 'notes', noteId);
            await deleteDoc(noteRef);
            setShowSuccess(true);
        } catch (error) {
            console.error('Error deleting note:', error);
            setErrorMessage('Failed to delete note');
            setShowError(true);
        }
    };

    // Handle file input
    const handleFileSelect = async (event) => {
        const files = Array.from(event.target.files);

        for (const file of files) {
            const attachment = await handleFileUpload(file);
            if (attachment) {
                setAttachments(prev => [...prev, attachment]);
            }
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Removed link dialog - URLs are now auto-detected from text

    // Remove attachment
    const handleRemoveAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Toggle note expansion
    const toggleNoteExpansion = (noteId) => {
        setExpandedNotes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(noteId)) {
                newSet.delete(noteId);
            } else {
                newSet.add(noteId);
            }
            return newSet;
        });
    };

    // Format relative time
    const formatRelativeTime = (timestamp) => {
        if (!timestamp) return '';

        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

        return date.toLocaleDateString();
    };

    // Get current user UID with fallback
    const getCurrentUserUID = () => {
        // Try Firebase Auth current user first
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
            return firebaseUser.uid;
        }
        return user?.uid || localStorage.getItem('userUID') || 'anonymous_' + Date.now();
    };

    // Get current user object with fallback
    const getCurrentUser = () => {
        // Try Firebase Auth current user first
        const firebaseUser = auth.currentUser;
        if (firebaseUser && firebaseUser.uid) {
            return {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                photoURL: firebaseUser.photoURL
            };
        }

        // Fallback to context user
        if (user && user.uid) {
            return user;
        }

        // Check localStorage for valid user data
        const storedUID = localStorage.getItem('userUID');
        const storedEmail = localStorage.getItem('userEmail');

        if (storedUID && storedEmail) {
            return {
                uid: storedUID,
                email: storedEmail,
                displayName: localStorage.getItem('userDisplayName') || storedEmail.split('@')[0] || 'User'
            };
        }

        // If we reach here, there's no valid authentication
        console.error('No valid user authentication found');
        return null;
    };

    // Handle view location
    const handleViewLocation = async () => {
        if (!mainContactDetails) {
            setErrorMessage('No address available to display on map');
            setShowError(true);
            return;
        }

        setMapLoading(true);
        setMapError(null);
        setShowMapModal(true);

        try {
            // Check if Google Maps is loaded
            if (!window.google || !window.google.maps) {
                throw new Error('Google Maps not loaded');
            }

            // Format address for geocoding
            const addressParts = [
                mainContactDetails.address1,
                mainContactDetails.address2,
                mainContactDetails.city,
                mainContactDetails.stateProv,
                mainContactDetails.zipPostal,
                mainContactDetails.country
            ].filter(Boolean);

            const addressString = addressParts.join(', ');

            // Geocode the address
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ address: addressString }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const location = results[0].geometry.location;
                    setMapCenter({
                        lat: location.lat(),
                        lng: location.lng()
                    });
                    setMapError(null);
                } else {
                    setMapError('Could not find location on map');
                }
                setMapLoading(false);
            });
        } catch (error) {
            console.error('Error loading map:', error);
            setMapError('Failed to load map: ' + error.message);
            setMapLoading(false);
        }
    };

    // Helper function to handle email clicks
    const handleEmailClick = (email, event) => {
        event.stopPropagation();
        if (email && email !== 'N/A') {
            window.open(`mailto:${email}`, '_blank');
        }
    };

    // Get user avatar
    const getUserAvatar = (userUID) => {
        const profile = userProfiles[userUID];

        // If no profile found, create a fallback avatar
        if (!profile) {
            // For current user, try to get info from improved user system
            const currentUserUID = getCurrentUserUID();
            if (userUID === currentUserUID || userUID === user?.uid) {
                const currentUser = getCurrentUser();

                return (
                    <Avatar
                        src={currentUser.photoURL}
                        sx={{ width: 32, height: 32, bgcolor: '#6366f1' }}
                    >
                        {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() :
                            currentUser.email ? currentUser.email.charAt(0).toUpperCase() : 'U'}
                    </Avatar>
                );
            }
            return (
                <Avatar
                    sx={{ width: 32, height: 32, bgcolor: '#6366f1' }}
                >
                    ?
                </Avatar>
            );
        }

        return (
            <Avatar
                src={profile.photoURL}
                sx={{ width: 32, height: 32, bgcolor: '#6366f1' }}
            >
                {profile.displayName ? profile.displayName.charAt(0).toUpperCase() : '?'}
            </Avatar>
        );
    };

    // Render emoji picker
    const renderEmojiPicker = (noteId, isReply = false, replyId = null) => (
        <Dialog
            open={emojiPickerOpen === `${noteId}${isReply ? `-${replyId}` : ''}`}
            onClose={() => setEmojiPickerOpen(null)}
            PaperProps={{
                sx: { borderRadius: 2, p: 2, maxWidth: 300 }
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>Choose Reaction</DialogTitle>
            <DialogContent sx={{ pt: 0 }}>
                {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                    <Box key={category} sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            {category}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {emojis.map((emoji) => (
                                <EmojiButton
                                    key={emoji}
                                    onClick={() => {
                                        handleToggleReaction(noteId, emoji, isReply, replyId);
                                        setEmojiPickerOpen(null);
                                    }}
                                >
                                    {emoji}
                                </EmojiButton>
                            ))}
                        </Box>
                    </Box>
                ))}
            </DialogContent>
        </Dialog>
    );

    // Render attachment
    const renderAttachment = (attachment, index, showRemove = false) => {
        const { type, name, url, title, size } = attachment;

        // Helper function to format file size
        const formatFileSize = (bytes) => {
            if (!bytes || bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        };

        return (
            <AttachmentPreview key={index} sx={{ position: 'relative' }}>
                {showRemove && (
                    <IconButton
                        size="small"
                        onClick={() => handleRemoveAttachment(index)}
                        sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'white', '&:hover': { bgcolor: '#f5f5f5' } }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                )}

                {type === 'image' ? (
                    <>
                        {/* Image preview */}
                        <Box sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: '1px solid #e0e0e0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5'
                        }}>
                            {url ? (
                                <img
                                    src={url}
                                    alt={name}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover'
                                    }}
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'block';
                                    }}
                                />
                            ) : null}
                            <ImageIcon
                                color="primary"
                                sx={{
                                    display: url ? 'none' : 'block',
                                    fontSize: '20px'
                                }}
                            />
                        </Box>
                        <Box sx={{ flex: 1, ml: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                {name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>
                                {formatFileSize(size)}
                            </Typography>
                        </Box>
                    </>
                ) : type === 'link' ? (
                    <>
                        <LinkIcon color="primary" />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                {title.length > 50 ? title.substring(0, 50) + '...' : title}
                            </Typography>
                            {attachment.source === 'auto-detected' && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>
                                    Auto-detected URL
                                </Typography>
                            )}
                        </Box>
                    </>
                ) : (
                    <>
                        <AttachmentIcon color="primary" />
                        <Box sx={{ flex: 1, ml: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                {name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>
                                {formatFileSize(size)}
                            </Typography>
                        </Box>
                    </>
                )}

                {!showRemove && url && (
                    <IconButton size="small" onClick={() => window.open(url, '_blank')}>
                        <DownloadIcon fontSize="small" />
                    </IconButton>
                )}
            </AttachmentPreview>
        );
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Typography variant="h6" color="error">{error}</Typography>
            </Box>
        );
    }

    if (!customer) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Typography variant="h6" color="error">Customer not found</Typography>
            </Box>
        );
    }

    return (
        <Box
            className="customer-detail-container"
            sx={{
                width: '100%',
                flex: 1,
                p: 3,
                overflow: 'auto'
            }}>
            {/* Breadcrumb - only show when not in modal mode */}
            {!isModal && (
                <Box sx={{ mb: 2 }}>
                    <div className="breadcrumb-container">
                        <Link to="/dashboard" className="breadcrumb-link">
                            <HomeIcon />
                            <Typography variant="body2" sx={{ fontSize: '12px' }}>Dashboard</Typography>
                        </Link>
                        <div className="breadcrumb-separator">
                            <NavigateNextIcon />
                        </div>
                        <Link to="/customers" className="breadcrumb-link">
                            <Typography variant="body2" sx={{ fontSize: '12px' }}>Customers</Typography>
                        </Link>
                        <div className="breadcrumb-separator">
                            <NavigateNextIcon />
                        </div>
                        <Typography variant="body2" className="breadcrumb-current" sx={{ fontSize: '12px' }}>
                            {customer?.name || 'Customer Details'}
                        </Typography>
                    </div>
                </Box>
            )}

            {/* Customer Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                mb: 3
            }}>
                <Box>
                    <Typography variant="h5" sx={{ fontSize: '20px', fontWeight: 600, mb: 1 }}>
                        {customer.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                            Customer ID: {customer.customerID}
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => {
                                navigator.clipboard.writeText(customer.customerID);
                                // You could add a toast notification here if desired
                            }}
                            sx={{
                                padding: '2px',
                                '&:hover': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                }
                            }}
                            title="Copy Customer ID to clipboard"
                        >
                            <ContentCopyIcon sx={{ fontSize: '12px' }} />
                        </IconButton>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip
                        label={customer.status || 'Unknown'}
                        color={customer.status === 'active' ? 'success' : 'default'}
                        size="small"
                    />
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ShippingIcon />}
                        onClick={() => {
                            if (onNavigateToShipments) {
                                onNavigateToShipments({ customerId: customer.customerID });
                            } else {
                                navigate(`/shipments?customerId=${customer.customerID}`);
                            }
                        }}
                        sx={{ fontSize: '12px', textTransform: 'none' }}
                    >
                        View Shipments
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/customers/${id}/edit`)}
                        sx={{ fontSize: '12px', textTransform: 'none' }}
                    >
                        Edit Customer
                    </Button>
                </Box>
            </Box>

            {/* Main Content Grid */}
            <Grid container spacing={2}>
                {/* Contact Information */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                            Contact Information
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                    Contact Person
                                </Typography>
                                <Typography sx={{ fontSize: '12px' }}>
                                    {mainContactDetails ? `${mainContactDetails.firstName || ''} ${mainContactDetails.lastName || ''}`.trim() : 'N/A'}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                    Email Address
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {mainContactDetails ? mainContactDetails.email : (customer.email || 'N/A')}
                                    </Typography>
                                    {(mainContactDetails?.email || customer.email) && (
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                navigator.clipboard.writeText(mainContactDetails?.email || customer.email);
                                            }}
                                            sx={{
                                                padding: '2px',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                                }
                                            }}
                                            title="Copy email to clipboard"
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '12px' }} />
                                        </IconButton>
                                    )}
                                </Box>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                    Phone Number
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {mainContactDetails ? mainContactDetails.phone : (customer.phone || 'N/A')}
                                    </Typography>
                                    {(mainContactDetails?.phone || customer.phone) && (
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                navigator.clipboard.writeText(mainContactDetails?.phone || customer.phone);
                                            }}
                                            sx={{
                                                padding: '2px',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                                }
                                            }}
                                            title="Copy phone number to clipboard"
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '12px' }} />
                                        </IconButton>
                                    )}
                                </Box>
                            </Box>

                        </Stack>
                    </Paper>
                </Grid>

                {/* Address Information */}
                <Grid item xs={12} md={6}>
                    <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                            Address Information
                        </Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography sx={{ fontSize: '12px', color: '#64748b', fontWeight: 500, mb: 0.5 }}>
                                    Address
                                </Typography>
                                {mainContactDetails ? (
                                    <Box sx={{ fontSize: '12px', lineHeight: '1.4' }}>
                                        {mainContactDetails.address1 && <div>{mainContactDetails.address1}</div>}
                                        {mainContactDetails.address2 && <div>{mainContactDetails.address2}</div>}
                                        {(mainContactDetails.city || mainContactDetails.stateProv || mainContactDetails.zipPostal) && (
                                            <div>
                                                {[mainContactDetails.city, mainContactDetails.stateProv, mainContactDetails.zipPostal].filter(Boolean).join(', ')}
                                            </div>
                                        )}
                                        {mainContactDetails.country && <div>{mainContactDetails.country}</div>}
                                    </Box>
                                ) : (
                                    <Typography sx={{ fontSize: '12px' }}>N/A</Typography>
                                )}
                            </Box>
                            {mainContactDetails && (
                                <Box sx={{ mt: 2 }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<MapIcon />}
                                        onClick={handleViewLocation}
                                        disabled={mapLoading}
                                        sx={{ fontSize: '12px', textTransform: 'none' }}
                                    >
                                        {mapLoading ? 'Loading...' : 'View Location'}
                                    </Button>
                                </Box>
                            )}
                        </Stack>
                    </Paper>
                </Grid>

                {/* Shipment Destinations */}
                {destinationAddresses.length > 0 && (
                    <Grid item xs={12}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                            Delivery Addresses
                        </Typography>
                        <TableContainer>
                            <Table sx={{
                                '& .MuiTableCell-root': {
                                    fontSize: '12px',
                                    padding: '12px 16px'
                                },
                                '& .MuiTableHead-root .MuiTableCell-root': {
                                    fontWeight: 600,
                                    backgroundColor: '#f8fafc',
                                    color: '#374151'
                                }
                            }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Nickname</TableCell>
                                        <TableCell>Company Name</TableCell>
                                        <TableCell>Contact</TableCell>
                                        <TableCell>Address</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Phone</TableCell>
                                        <TableCell>Default</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {destinationAddresses.map((addr) => (
                                        <TableRow key={addr.id} hover>
                                            <TableCell>{addr.nickname || 'N/A'}</TableCell>
                                            <TableCell>{addr.companyName || 'N/A'}</TableCell>
                                            <TableCell>{`${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'N/A'}</TableCell>
                                            <TableCell sx={{ fontSize: '12px', lineHeight: '1.4' }}>
                                                {addr.address1}
                                                {addr.address2 && <><br />{addr.address2}</>}
                                                <br />
                                                {`${addr.city}, ${addr.stateProv} ${addr.zipPostal}`}
                                                <br />
                                                {addr.country}
                                            </TableCell>
                                            <TableCell>{addr.email || 'N/A'}</TableCell>
                                            <TableCell>{addr.phone || 'N/A'}</TableCell>
                                            <TableCell>
                                                {addr.isDefault ?
                                                    <Chip label="Yes" color="primary" size="small" /> :
                                                    <Chip label="No" variant="outlined" size="small" />
                                                }
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>
                )}

                {/* Customer Notes */}
                <Grid item xs={12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                            Customer Notes
                            {notes.length > 0 && (
                                <Chip
                                    label={notes.length}
                                    size="small"
                                    sx={{ ml: 1, fontSize: '11px', height: '20px' }}
                                />
                            )}
                        </Typography>
                        {notes.length > 0 && (
                            <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                                Last updated {formatRelativeTime(notes[0]?.createdAt)}
                            </Typography>
                        )}
                    </Box>

                    {/* Add Note Section */}
                    <Box sx={{ mb: 3, p: 3, bgcolor: '#f8fafc', borderRadius: 2, width: '100%', maxWidth: 'none' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            {getUserAvatar(getCurrentUserUID())}
                        </Box>
                        <TextField
                            ref={noteInputRef}
                            fullWidth
                            multiline
                            rows={4}
                            placeholder="Add a note about this customer..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.ctrlKey && e.key === 'Enter' && !addingNote && newNote.trim()) {
                                    e.preventDefault();
                                    handleAddNote();
                                }
                            }}
                            variant="outlined"
                            disabled={addingNote}
                            sx={{
                                mb: 2,
                                width: '100% !important',
                                maxWidth: 'none !important',
                                minWidth: '100%',
                                '& .MuiFormControl-root': {
                                    width: '100% !important',
                                    maxWidth: 'none !important'
                                },
                                '& .MuiOutlinedInput-root': {
                                    fontSize: '14px',
                                    backgroundColor: 'white',
                                    width: '100% !important',
                                    maxWidth: 'none !important',
                                    minWidth: '100%',
                                    '&:hover': {
                                        borderColor: '#3b82f6'
                                    },
                                    '&.Mui-focused': {
                                        borderColor: '#3b82f6',
                                        boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
                                    }
                                },
                                '& .MuiInputBase-root': {
                                    width: '100% !important',
                                    maxWidth: 'none !important',
                                    minWidth: '100%'
                                },
                                '& .MuiInputBase-input': {
                                    width: '100% !important',
                                    maxWidth: 'none !important',
                                    minWidth: '100%'
                                },
                                '& textarea': {
                                    width: '100% !important',
                                    maxWidth: 'none !important',
                                    minWidth: '100%'
                                }
                            }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleFileSelect}
                                    multiple
                                    accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.csv"
                                />
                                <Tooltip title="Attach file">
                                    <IconButton
                                        size="small"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={addingNote || uploadingFile}
                                        sx={{
                                            bgcolor: uploadingFile ? '#f3f4f6' : 'transparent',
                                            '&:hover': { bgcolor: '#e5e7eb' }
                                        }}
                                    >
                                        {uploadingFile ? <CircularProgress size={16} /> : <AttachFileIcon />}
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Add emoji">
                                    <IconButton
                                        size="small"
                                        onClick={() => setEmojiPickerOpen('new-note')}
                                        disabled={addingNote}
                                        sx={{ fontSize: '16px', '&:hover': { bgcolor: '#e5e7eb' } }}
                                    >
                                        😊
                                    </IconButton>
                                </Tooltip>
                                {uploadingFile && (
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        Uploading...
                                    </Typography>
                                )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                    {newNote.length}/2000
                                </Typography>
                                <Button
                                    variant="contained"
                                    onClick={handleAddNote}
                                    disabled={!newNote.trim() || addingNote || newNote.length > 2000 || authLoading}
                                    size="small"
                                    sx={{
                                        fontSize: '12px',
                                        textTransform: 'none',
                                        minWidth: '80px'
                                    }}
                                >
                                    {addingNote ? <CircularProgress size={16} /> : authLoading ? 'Loading...' : 'Add Note'}
                                </Button>
                            </Box>
                        </Box>

                        {/* Attachments Preview */}
                        {attachments.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1 }}>
                                    Attachments ({attachments.length})
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                    {attachments.map((attachment, index) =>
                                        renderAttachment(attachment, index, true)
                                    )}
                                </Stack>
                            </Box>
                        )}
                    </Box>

                    {/* Notes List */}
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : notes.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4, color: '#64748b' }}>
                            <Typography sx={{ fontSize: '14px' }}>
                                No notes yet. Add the first note above.
                            </Typography>
                        </Box>
                    ) : (
                        <Stack spacing={2}>
                            {notes.map((note) => (
                                <Card key={note.id} sx={{ border: '1px solid #e2e8f0' }}>
                                    <CardHeader
                                        avatar={getUserAvatar(note.createdByUID)}
                                        title={
                                            <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                                {userProfiles[note.createdByUID]?.displayName || note.createdBy}
                                            </Typography>
                                        }
                                        subheader={
                                            <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                                                {formatRelativeTime(note.createdAt)}
                                            </Typography>
                                        }
                                        sx={{ pb: 1 }}
                                    />
                                    <CardContent sx={{ pt: 0 }}>
                                        {editingNote === note.id ? (
                                            <Box>
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={3}
                                                    value={editNoteContent}
                                                    onChange={(e) => setEditNoteContent(e.target.value)}
                                                    sx={{
                                                        mb: 2,
                                                        width: '100% !important',
                                                        maxWidth: 'none !important',
                                                        '& .MuiOutlinedInput-root': {
                                                            width: '100% !important',
                                                            maxWidth: 'none !important'
                                                        },
                                                        '& .MuiInputBase-input': {
                                                            width: '100% !important',
                                                            maxWidth: 'none !important'
                                                        }
                                                    }}
                                                />
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        onClick={() => handleEditNote(note.id, editNoteContent)}
                                                        sx={{ fontSize: '12px', textTransform: 'none' }}
                                                    >
                                                        Save
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        onClick={() => setEditingNote(null)}
                                                        sx={{ fontSize: '12px', textTransform: 'none' }}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Typography sx={{ fontSize: '14px', mb: 1 }}>
                                                {note.content}
                                            </Typography>
                                        )}

                                        {/* Note Attachments */}
                                        {note.attachments && note.attachments.length > 0 && (
                                            <Box sx={{ mt: 2 }}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1 }}>
                                                    Attachments
                                                </Typography>
                                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                                    {note.attachments.map((attachment, index) =>
                                                        renderAttachment(attachment, index, false)
                                                    )}
                                                </Stack>
                                            </Box>
                                        )}
                                    </CardContent>
                                    {/* Note Reactions */}
                                    {note.reactions && Object.keys(note.reactions).length > 0 && (
                                        <Box sx={{ px: 2, pb: 1 }}>
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {Object.entries(note.reactions).map(([emoji, userIds]) =>
                                                    userIds.length > 0 && (
                                                        <Chip
                                                            key={emoji}
                                                            label={`${emoji} ${userIds.length}`}
                                                            size="small"
                                                            variant={userIds.includes(getCurrentUserUID()) ? "filled" : "outlined"}
                                                            onClick={() => handleToggleReaction(note.id, emoji)}
                                                            sx={{
                                                                fontSize: '11px',
                                                                height: '24px',
                                                                cursor: 'pointer',
                                                                '&:hover': { backgroundColor: '#f1f5f9' }
                                                            }}
                                                        />
                                                    )
                                                )}
                                            </Box>
                                        </Box>
                                    )}

                                    <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                            <IconButton
                                                size="small"
                                                onClick={() => setEmojiPickerOpen(note.id)}
                                                title="Add reaction"
                                                sx={{ fontSize: '16px' }}
                                            >
                                                😊
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => setReplyingTo(replyingTo === note.id ? null : note.id)}
                                                title="Reply"
                                            >
                                                <ReplyIcon />
                                            </IconButton>
                                            {note.replies && note.replies.length > 0 && (
                                                <Button
                                                    size="small"
                                                    startIcon={expandedNotes.has(note.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                    onClick={() => toggleNoteExpansion(note.id)}
                                                    sx={{ fontSize: '12px', textTransform: 'none' }}
                                                >
                                                    {note.replies.length} {note.replies.length === 1 ? 'reply' : 'replies'}
                                                </Button>
                                            )}
                                            {note.isEdited && (
                                                <Typography sx={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                                                    (edited)
                                                </Typography>
                                            )}
                                        </Box>
                                        {note.createdByUID === getCurrentUserUID() && (
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        setEditingNote(note.id);
                                                        setEditNoteContent(note.content);
                                                    }}
                                                    title="Edit"
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    sx={{ color: '#ef4444' }}
                                                    title="Delete"
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Box>
                                        )}
                                    </CardActions>

                                    {/* Emoji Picker Dialog */}
                                    {renderEmojiPicker(note.id)}

                                    {/* Reply Input */}
                                    <Collapse in={replyingTo === note.id}>
                                        <Box sx={{ px: 2, pb: 2, bgcolor: '#f8fafc', borderRadius: 1, mx: 2, mb: 1 }}>
                                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', pt: 2 }}>
                                                {getUserAvatar(getCurrentUserUID())}
                                                <Box sx={{ flex: 1 }}>
                                                    <TextField
                                                        fullWidth
                                                        placeholder="Write a reply..."
                                                        value={replyText}
                                                        onChange={(e) => setReplyText(e.target.value)}
                                                        multiline
                                                        rows={3}
                                                        variant="outlined"
                                                        size="small"
                                                        sx={{
                                                            mb: 1,
                                                            width: '100% !important',
                                                            maxWidth: 'none !important',
                                                            '& .MuiOutlinedInput-root': {
                                                                fontSize: '14px',
                                                                backgroundColor: 'white',
                                                                width: '100% !important',
                                                                maxWidth: 'none !important'
                                                            },
                                                            '& .MuiInputBase-input': {
                                                                width: '100% !important',
                                                                maxWidth: 'none !important'
                                                            }
                                                        }}
                                                    />
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setEmojiPickerOpen(`${note.id}-reply`)}
                                                                title="Add emoji"
                                                                sx={{ fontSize: '16px' }}
                                                            >
                                                                😊
                                                            </IconButton>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <Button
                                                                size="small"
                                                                onClick={() => {
                                                                    setReplyingTo(null);
                                                                    setReplyText('');
                                                                }}
                                                                sx={{ fontSize: '12px', textTransform: 'none' }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                            <Button
                                                                variant="contained"
                                                                size="small"
                                                                onClick={() => handleAddReply(note.id)}
                                                                disabled={!replyText.trim()}
                                                                sx={{ fontSize: '12px', textTransform: 'none' }}
                                                            >
                                                                Reply
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Collapse>

                                    {/* Replies */}
                                    <Collapse in={expandedNotes.has(note.id)}>
                                        <Box sx={{ px: 2, pb: 2 }}>
                                            {note.replies && note.replies.map((reply) => (
                                                <Card key={reply.id} sx={{ ml: 4, mb: 1, border: '1px solid #e2e8f0' }}>
                                                    <CardHeader
                                                        avatar={getUserAvatar(reply.createdByUID)}
                                                        title={
                                                            <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
                                                                {userProfiles[reply.createdByUID]?.displayName || reply.createdBy}
                                                            </Typography>
                                                        }
                                                        subheader={
                                                            <Typography sx={{ fontSize: '11px', color: '#64748b' }}>
                                                                {formatRelativeTime(reply.createdAt)}
                                                            </Typography>
                                                        }
                                                        sx={{ py: 1 }}
                                                    />
                                                    <CardContent sx={{ pt: 0, pb: 1 }}>
                                                        <Typography sx={{ fontSize: '13px' }}>
                                                            {reply.content}
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </Box>
                                    </Collapse>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </Grid>
            </Grid>

            {/* Emoji Picker for New Note */}
            <Dialog
                open={emojiPickerOpen === 'new-note'}
                onClose={() => setEmojiPickerOpen(null)}
                PaperProps={{
                    sx: { borderRadius: 2, p: 2, maxWidth: 400, maxHeight: 500 }
                }}
            >
                <DialogTitle sx={{ pb: 1 }}>Choose Emoji</DialogTitle>
                <DialogContent sx={{ pt: 0, maxHeight: 400, overflow: 'auto' }}>
                    {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                        <Box key={category} sx={{ mb: 2 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                                {category}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {emojis.map((emoji) => (
                                    <EmojiButton
                                        key={emoji}
                                        onClick={() => {
                                            setNewNote(prev => prev + emoji);
                                            setEmojiPickerOpen(null);
                                            if (noteInputRef.current) {
                                                noteInputRef.current.focus();
                                            }
                                        }}
                                        title={emoji}
                                    >
                                        {emoji}
                                    </EmojiButton>
                                ))}
                            </Box>
                        </Box>
                    ))}
                </DialogContent>
            </Dialog>

            {/* Emoji Picker for Reply */}
            {
                emojiPickerOpen && emojiPickerOpen.includes('-reply') && (
                    <Dialog
                        open={true}
                        onClose={() => setEmojiPickerOpen(null)}
                        PaperProps={{
                            sx: { borderRadius: 2, p: 2, maxWidth: 400, maxHeight: 500 }
                        }}
                    >
                        <DialogTitle sx={{ pb: 1 }}>Choose Emoji</DialogTitle>
                        <DialogContent sx={{ pt: 0, maxHeight: 400, overflow: 'auto' }}>
                            {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                                <Box key={category} sx={{ mb: 2 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 600 }}>
                                        {category}
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {emojis.map((emoji) => (
                                            <EmojiButton
                                                key={emoji}
                                                onClick={() => {
                                                    setReplyText(prev => prev + emoji);
                                                    setEmojiPickerOpen(null);
                                                }}
                                                title={emoji}
                                            >
                                                {emoji}
                                            </EmojiButton>
                                        ))}
                                    </Box>
                                </Box>
                            ))}
                        </DialogContent>
                    </Dialog>
                )
            }

            {/* Link Dialog removed - URLs are now auto-detected from text */}

            {/* Success Snackbar */}
            <Snackbar
                open={showSuccess}
                autoHideDuration={6000}
                onClose={() => setShowSuccess(false)}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    Note added successfully!
                </Alert>
            </Snackbar>

            {/* Error Snackbar */}
            <Snackbar
                open={showError}
                autoHideDuration={6000}
                onClose={() => setShowError(false)}
            >
                <Alert severity="error" sx={{ width: '100%' }}>
                    {errorMessage}
                </Alert>
            </Snackbar>

            {/* Map Modal */}
            <Dialog
                open={showMapModal}
                onClose={() => setShowMapModal(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        height: '90vh',
                        borderRadius: 2
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationIcon color="primary" />
                        <Typography variant="h6">
                            Customer Location: {customer?.name || 'Unknown'}
                        </Typography>
                    </Box>
                    <IconButton onClick={() => setShowMapModal(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%' }}>
                    {mapLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    ) : mapError ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <Typography color="error">{mapError}</Typography>
                        </Box>
                    ) : mapCenter ? (
                        <GoogleMap
                            mapContainerStyle={{ width: '100%', height: '100%' }}
                            center={mapCenter}
                            zoom={15}
                            options={{
                                styles: [
                                    {
                                        "elementType": "geometry",
                                        "stylers": [{ "color": "#242f3e" }]
                                    },
                                    {
                                        "elementType": "labels.text.stroke",
                                        "stylers": [{ "color": "#242f3e" }]
                                    },
                                    {
                                        "elementType": "labels.text.fill",
                                        "stylers": [{ "color": "#ffffff" }]
                                    },
                                    {
                                        "featureType": "road",
                                        "elementType": "geometry",
                                        "stylers": [{ "color": "#38414e" }]
                                    },
                                    {
                                        "featureType": "road",
                                        "elementType": "labels.text.fill",
                                        "stylers": [{ "color": "#ffffff" }]
                                    },
                                    {
                                        "featureType": "water",
                                        "elementType": "geometry",
                                        "stylers": [{ "color": "#17263c" }]
                                    }
                                ],
                                disableDefaultUI: false,
                                zoomControl: true,
                                streetViewControl: true,
                                mapTypeControl: false,
                                fullscreenControl: true
                            }}
                        >
                            <Marker
                                position={mapCenter}
                                icon={{
                                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                                    scale: 10,
                                    fillColor: '#4caf50',
                                    fillOpacity: 1,
                                    strokeColor: '#ffffff',
                                    strokeWeight: 2
                                }}
                            />
                        </GoogleMap>
                    ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <Typography>No location data available</Typography>
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </Box >
    );
};

export default CustomerDetail; 