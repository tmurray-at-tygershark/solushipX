import React, { useState, useEffect, useRef } from 'react';
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
    ListItemAvatar
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
    Download as DownloadIcon
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit, addDoc, serverTimestamp, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import useModalNavigation from '../../hooks/useModalNavigation';
import './CustomerDetail.css';

// Emoji picker data
const EMOJI_CATEGORIES = {
    'Reactions': ['👍', '👎', '❤️', '😊', '😂', '😮', '😢', '😡', '🎉', '🔥'],
    'People': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃'],
    'Objects': ['📝', '📄', '📊', '📈', '📉', '💼', '📞', '📧', '🔗', '📎'],
    'Symbols': ['✅', '❌', '⚠️', '❗', '❓', '💡', '🔔', '⭐', '🏆', '🎯']
};

// Styled components
const StyledNoteCard = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(2),
    border: '1px solid #e0e7ff',
    borderRadius: '12px',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
        borderColor: '#c7d2fe',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)',
    },
}));

const StyledReplyCard = styled(Card)(({ theme }) => ({
    marginLeft: theme.spacing(4),
    marginTop: theme.spacing(1),
    border: '1px solid #f1f5f9',
    borderRadius: '8px',
    backgroundColor: '#fafbff',
}));

const EmojiButton = styled(IconButton)(({ theme }) => ({
    fontSize: '16px',
    minWidth: '32px',
    height: '32px',
    margin: '2px',
    borderRadius: '6px',
    '&:hover': {
        backgroundColor: theme.palette.action.hover,
    },
}));

const AttachmentPreview = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    border: '1px dashed #d1d5db',
    borderRadius: '6px',
    backgroundColor: '#f9fafb',
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

const CustomerDetail = ({ customerId = null, onBackToTable = null, onNavigateToShipments = null }) => {
    const { id: urlId } = useParams();
    const navigate = useNavigate();
    const { companyIdForAddress } = useCompany();
    const { user } = useAuth();
    const { openModal } = useModalNavigation();

    // Use prop customerId if provided, otherwise fall back to URL parameter
    const id = customerId || urlId;

    // Get note ID from URL query parameters for deep linking
    const urlParams = new URLSearchParams(window.location.search);
    const highlightNoteId = urlParams.get('note');

    const [customer, setCustomer] = useState(null);
    const [mainContactDetails, setMainContactDetails] = useState(null);
    const [destinationAddresses, setDestinationAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [addingNote, setAddingNote] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Enhanced notes system state
    const [editingNote, setEditingNote] = useState(null);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [linkUrl, setLinkUrl] = useState('');
    const [linkTitle, setLinkTitle] = useState('');
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState(new Set());
    const [userProfiles, setUserProfiles] = useState({});

    // Refs
    const fileInputRef = useRef(null);
    const noteInputRef = useRef(null);

    useEffect(() => {
        let notesUnsubscribe = null;

        if (id) {
            fetchCustomerData();
            fetchNotes().then(unsubscribe => {
                notesUnsubscribe = unsubscribe;
            });
        }

        // Cleanup function
        return () => {
            if (notesUnsubscribe) {
                notesUnsubscribe();
            }
        };
    }, [id]);

    // Deep linking effect for scrolling to specific notes
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const highlightNoteId = urlParams.get('note');

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
    }, [notes]);

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

            // Fetch customer notes
            const notesRef = collection(db, 'notes');
            const qNotes = query(
                notesRef,
                where('customerID', '==', id),
                orderBy('createdAt', 'desc'),
                limit(10)
            );
            const notesSnapshot = await getDocs(qNotes);
            const notesData = notesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setNotes(notesData);
        } catch (error) {
            console.error('Error fetching customer data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchNotes = async () => {
        if (!id) return;

        try {
            const notesRef = collection(db, 'customerNotes');
            const qNotes = query(
                notesRef,
                where('customerID', '==', id),
                orderBy('createdAt', 'desc'),
                limit(20)
            );

            // Set up real-time listener
            const unsubscribe = onSnapshot(qNotes, async (snapshot) => {
                const notesData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                setNotes(notesData);

                // Fetch user profiles for notes authors and repliers
                const userUIDs = new Set();
                notesData.forEach(note => {
                    if (note.createdByUID) userUIDs.add(note.createdByUID);
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

            // Store unsubscribe function
            return unsubscribe;
        } catch (error) {
            console.error('Error fetching notes:', error);
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

    // Handle file upload
    const handleFileUpload = async (file) => {
        if (!file) return null;

        setUploadingFile(true);
        try {
            const fileRef = ref(storage, `customer-notes/${id}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            return {
                type: file.type.startsWith('image/') ? 'image' : 'file',
                name: file.name,
                url: downloadURL,
                size: file.size,
                uploadedAt: new Date()
            };
        } catch (error) {
            console.error('Error uploading file:', error);
            setErrorMessage('Failed to upload file');
            setShowError(true);
            return null;
        } finally {
            setUploadingFile(false);
        }
    };

    // Add note with attachments
    const handleAddNote = async () => {
        if (!newNote.trim() || !user) {
            setErrorMessage('Please enter a note');
            setShowError(true);
            return;
        }

        if (!companyIdForAddress) {
            setErrorMessage('Company information not available');
            setShowError(true);
            return;
        }

        setAddingNote(true);
        try {
            const noteData = {
                customerID: id,
                companyID: companyIdForAddress,
                content: newNote.trim(),
                createdBy: user.email || user.displayName || 'Unknown User',
                createdByUID: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                attachments: attachments,
                reactions: {},
                replies: [],
                isEdited: false,
                type: 'note'
            };

            const notesRef = collection(db, 'customerNotes');
            const docRef = await addDoc(notesRef, noteData);

            // Prepare data for email notification
            const emailNotificationData = {
                noteId: docRef.id,
                customerID: id,
                customerName: customer?.name || 'Unknown Customer',
                companyID: companyIdForAddress,
                content: newNote.trim(),
                createdBy: user.email || user.displayName || 'Unknown User',
                createdByName: user.displayName || user.email || 'Unknown User',
                createdAt: new Date(),
                attachments: attachments,
                noteUrl: `https://solushipx.web.app/customers/${id}?note=${docRef.id}`
            };

            // Import and call the cloud function to send email notifications
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
            const sendCustomerNoteNotification = httpsCallable(functions, 'sendCustomerNoteNotification');

            try {
                await sendCustomerNoteNotification(emailNotificationData);
                console.log('Email notification sent successfully');
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
                // Don't fail the note creation if email fails
            }

            // Clear form
            setNewNote('');
            setAttachments([]);
            setShowSuccess(true);
        } catch (error) {
            console.error('Error adding note:', error);
            setErrorMessage('Failed to add note: ' + error.message);
            setShowError(true);
        } finally {
            setAddingNote(false);
        }
    };

    // Add reply to note
    const handleAddReply = async (noteId) => {
        if (!replyText.trim() || !user) {
            setErrorMessage('Please enter a reply');
            setShowError(true);
            return;
        }

        try {
            const noteRef = doc(db, 'customerNotes', noteId);
            const noteDoc = await getDoc(noteRef);

            if (noteDoc.exists()) {
                const currentReplies = noteDoc.data().replies || [];
                const newReply = {
                    id: Date.now().toString(),
                    content: replyText.trim(),
                    createdBy: user.email || user.displayName || 'Unknown User',
                    createdByUID: user.uid,
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
        if (!user) return;

        try {
            const noteRef = doc(db, 'customerNotes', noteId);
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

                        if (userReactions.includes(user.uid)) {
                            reactions[emoji] = userReactions.filter(uid => uid !== user.uid);
                        } else {
                            reactions[emoji] = [...userReactions, user.uid];
                        }

                        replies[replyIndex].reactions = reactions;
                        await updateDoc(noteRef, { replies });
                    }
                } else {
                    // Handle note reaction
                    const reactions = noteData.reactions || {};
                    const userReactions = reactions[emoji] || [];

                    if (userReactions.includes(user.uid)) {
                        reactions[emoji] = userReactions.filter(uid => uid !== user.uid);
                    } else {
                        reactions[emoji] = [...userReactions, user.uid];
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
            const noteRef = doc(db, 'customerNotes', noteId);
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
            await deleteDoc(doc(db, 'customerNotes', noteId));
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

    // Add link attachment
    const handleAddLink = () => {
        if (linkUrl.trim()) {
            const linkAttachment = {
                type: 'link',
                url: linkUrl.trim(),
                title: linkTitle.trim() || linkUrl.trim(),
                addedAt: new Date()
            };

            setAttachments(prev => [...prev, linkAttachment]);
            setLinkUrl('');
            setLinkTitle('');
            setShowLinkDialog(false);
        }
    };

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

    // Get user avatar
    const getUserAvatar = (userUID) => {
        const profile = userProfiles[userUID];
        if (!profile) return null;

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
                        <ImageIcon color="primary" />
                        <Typography variant="body2" sx={{ flex: 1 }}>{name}</Typography>
                        {size && <Typography variant="caption" color="text.secondary">
                            {(size / 1024 / 1024).toFixed(1)}MB
                        </Typography>}
                    </>
                ) : type === 'link' ? (
                    <>
                        <LinkIcon color="primary" />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="body2">{title}</Typography>
                            <Typography variant="caption" color="text.secondary">{url}</Typography>
                        </Box>
                    </>
                ) : (
                    <>
                        <AttachmentIcon color="primary" />
                        <Typography variant="body2" sx={{ flex: 1 }}>{name}</Typography>
                        {size && <Typography variant="caption" color="text.secondary">
                            {(size / 1024 / 1024).toFixed(1)}MB
                        </Typography>}
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
        <Box className="customer-detail-container" sx={{ p: 3, width: '100% !important', maxWidth: 'none !important', minWidth: '100%' }}>
            {/* Back Button - show when in slide-over mode */}
            {onBackToTable && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Button
                        onClick={handleBackClick}
                        sx={{
                            minWidth: 0,
                            p: 0.5,
                            mr: 1,
                            color: '#6e6e73',
                            background: 'none',
                            borderRadius: '50%',
                            '&:hover': {
                                background: '#f2f2f7',
                                color: '#111',
                            },
                            boxShadow: 'none',
                        }}
                        aria-label="Back to Customers"
                    >
                        <ArrowBackIcon sx={{ fontSize: 20 }} />
                    </Button>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        Customer Details
                    </Typography>
                </Box>
            )}

            {/* Breadcrumb - only show when not in slide-over mode */}
            {!onBackToTable && (
                <div className="breadcrumb-container">
                    <Link to="/" className="breadcrumb-link">
                        <HomeIcon />
                        <Typography variant="body2">Home</Typography>
                    </Link>
                    <div className="breadcrumb-separator">
                        <NavigateNextIcon />
                    </div>
                    <Link to="/customers" className="breadcrumb-link">
                        <Typography variant="body2">Customers</Typography>
                    </Link>
                    <div className="breadcrumb-separator">
                        <NavigateNextIcon />
                    </div>
                    <Typography variant="body2" className="breadcrumb-current">
                        {customer.name || 'Customer Details'}
                    </Typography>
                </div>
            )}

            <Paper className="customer-detail-paper" sx={{ width: '100% !important', maxWidth: 'none !important', minWidth: '100%' }}>
                <Box className="customer-header">
                    <Box>
                        <Typography variant="h4" gutterBottom>
                            {customer.name}
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                            Customer ID: {customer.customerID}
                        </Typography>
                    </Box>
                    <Box className="customer-actions">
                        <Chip
                            label={customer.status || 'Unknown'}
                            color={customer.status === 'active' ? 'success' : 'default'}
                            size="medium"
                            sx={{ mr: 2 }}
                        />
                        <Button
                            variant="outlined"
                            color="secondary"
                            startIcon={<ShippingIcon />}
                            onClick={() => {
                                if (onNavigateToShipments) {
                                    // Modal-to-modal navigation with deep linking
                                    onNavigateToShipments({ customerId: customer.customerID });
                                } else {
                                    // Direct navigation fallback
                                    navigate(`/shipments?customerId=${customer.customerID}`);
                                }
                            }}
                            sx={{ mr: 2 }}
                        >
                            View Shipments
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/customers/${id}/edit`)}
                        >
                            Edit Customer
                        </Button>
                    </Box>
                </Box>

                <Box className="customer-info">
                    <Typography variant="h6" gutterBottom>Contact Information</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Stack spacing={1}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <BusinessIcon color="action" />
                                    <Typography><strong>Company Name:</strong> {customer.name || 'N/A'}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <PersonIcon color="action" />
                                    <Typography><strong>Contact Name:</strong> {mainContactDetails ? `${mainContactDetails.firstName || ''} ${mainContactDetails.lastName || ''}`.trim() : 'N/A'}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <EmailIcon color="action" />
                                    <Typography><strong>Email:</strong> {mainContactDetails ? mainContactDetails.email : (customer.email || 'N/A')}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <PhoneIcon color="action" />
                                    <Typography><strong>Phone:</strong> {mainContactDetails ? mainContactDetails.phone : (customer.phone || 'N/A')}</Typography>
                                </Box>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Stack spacing={1}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <LocationIcon color="action" />
                                    <Typography><strong>Main Address:</strong>
                                        {mainContactDetails ?
                                            `${mainContactDetails.address1}${mainContactDetails.address2 ? ', ' + mainContactDetails.address2 : ''}, ${mainContactDetails.city}, ${mainContactDetails.stateProv} ${mainContactDetails.zipPostal}, ${mainContactDetails.country}`
                                            : 'N/A'}
                                    </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Chip label={customer.status || 'Unknown'} color={customer.status === 'active' ? 'success' : 'default'} size="small" />
                                    <Typography><strong>Status:</strong> {customer.status || 'N/A'}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <BusinessIcon color="action" />
                                    <Typography><strong>Type:</strong> {customer.type || 'N/A'}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <CalendarIcon color="action" />
                                    <Typography><strong>Created At:</strong> {customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString() : 'N/A'}</Typography>
                                </Box>
                            </Stack>
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box className="customer-shipment-destinations" sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>Shipment Destinations</Typography>
                    {destinationAddresses.length > 0 ? (
                        <TableContainer component={Paper} elevation={2}>
                            <Table stickyHeader>
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
                                            <TableCell>
                                                {addr.address1}
                                                {addr.address2 && <br />}{addr.address2}
                                                <br />
                                                {`${addr.city}, ${addr.stateProv} ${addr.zipPostal}`}
                                                <br />
                                                {addr.country}
                                            </TableCell>
                                            <TableCell>{addr.email || 'N/A'}</TableCell>
                                            <TableCell>{addr.phone || 'N/A'}</TableCell>
                                            <TableCell>
                                                {addr.isDefault ? <Chip label="Yes" color="primary" size="small" /> : <Chip label="No" size="small" />}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography>No shipment destinations found for this customer.</Typography>
                    )}
                </Box>
            </Paper>

            <Divider sx={{ my: 3 }} />

            {/* Enhanced Notes System */}
            <Box sx={{ width: '100% !important', mt: 4, maxWidth: 'none !important', minWidth: '100%' }}>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 600, color: '#1e293b' }}>
                    Customer Notes & Collaboration
                </Typography>

                {/* Add Note Section */}
                <StyledNoteCard sx={{ mb: 3, width: '100% !important', maxWidth: 'none !important', minWidth: '100%', bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <CardContent sx={{ p: 3, width: '100% !important', maxWidth: 'none !important', minWidth: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, width: '100%' }}>
                            {getUserAvatar(user?.uid)}
                            <Typography variant="h6" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                Add New Note
                            </Typography>
                        </Box>

                        <TextField
                            ref={noteInputRef}
                            fullWidth
                            multiline
                            rows={4}
                            placeholder="Share your thoughts, observations, or important details about this customer..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            variant="outlined"
                            disabled={addingNote}
                            sx={{
                                mb: 2,
                                width: '100% !important',
                                maxWidth: 'none !important',
                                minWidth: '100%',
                                flex: 1,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: 3,
                                    bgcolor: 'white',
                                    fontSize: '14px',
                                    width: '100% !important',
                                    maxWidth: 'none !important',
                                    minWidth: '100%',
                                    '&:hover': {
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: '#6366f1',
                                        }
                                    }
                                },
                                '& .MuiInputBase-input': {
                                    width: '100% !important',
                                    maxWidth: 'none !important',
                                    minWidth: '100%'
                                },
                                '& .MuiInputBase-root': {
                                    width: '100% !important',
                                    maxWidth: 'none !important',
                                    minWidth: '100%'
                                },
                                '& .MuiFormControl-root': {
                                    width: '100% !important',
                                    maxWidth: 'none !important',
                                    minWidth: '100%'
                                }
                            }}
                        />

                        {/* Attachments Preview */}
                        {attachments.length > 0 && (
                            <Box sx={{ mb: 2, width: '100%' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                    Attachments ({attachments.length})
                                </Typography>
                                <Stack spacing={1} sx={{ width: '100%' }}>
                                    {attachments.map((attachment, index) =>
                                        renderAttachment(attachment, index, true)
                                    )}
                                </Stack>
                            </Box>
                        )}

                        {/* Action Bar */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {/* File Upload */}
                                <Tooltip title="Attach Image or File">
                                    <IconButton
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingFile}
                                        sx={{ color: '#6366f1' }}
                                    >
                                        {uploadingFile ? <CircularProgress size={20} /> : <AttachFileIcon />}
                                    </IconButton>
                                </Tooltip>

                                {/* Add Link */}
                                <Tooltip title="Add Link">
                                    <IconButton
                                        onClick={() => setShowLinkDialog(true)}
                                        sx={{ color: '#6366f1' }}
                                    >
                                        <InsertLinkIcon />
                                    </IconButton>
                                </Tooltip>

                                {/* Emoji */}
                                <Tooltip title="Add Emoji">
                                    <IconButton
                                        onClick={() => {
                                            const emoji = EMOJI_CATEGORIES.Reactions[Math.floor(Math.random() * EMOJI_CATEGORIES.Reactions.length)];
                                            setNewNote(prev => prev + emoji);
                                        }}
                                        sx={{ color: '#6366f1' }}
                                    >
                                        <EmojiIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>

                            <Button
                                variant="contained"
                                startIcon={addingNote ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                                onClick={handleAddNote}
                                disabled={!newNote.trim() || addingNote}
                                sx={{
                                    bgcolor: '#6366f1',
                                    '&:hover': { bgcolor: '#4f46e5' },
                                    borderRadius: 2,
                                    px: 3,
                                    py: 1
                                }}
                            >
                                {addingNote ? 'Posting...' : 'Post Note'}
                            </Button>
                        </Box>

                        {/* Hidden File Input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </CardContent>
                </StyledNoteCard>

                {/* Notes List */}
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : notes.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                        <NoteIcon sx={{ fontSize: 64, color: '#d1d5db', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                            No notes yet
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Start the conversation by adding the first note about this customer
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={2} sx={{ width: '100%' }}>
                        {notes.map((note) => (
                            <StyledNoteCard key={note.id} id={`note-${note.id}`} sx={{ width: '100%' }}>
                                {/* Note Header */}
                                <CardHeader
                                    avatar={getUserAvatar(note.createdByUID)}
                                    action={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatRelativeTime(note.createdAt)}
                                                {note.isEdited && ' (edited)'}
                                            </Typography>
                                            {note.createdByUID === user?.uid && (
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setEditingNote(editingNote === note.id ? null : note.id)}
                                                >
                                                    <MoreVertIcon />
                                                </IconButton>
                                            )}
                                        </Box>
                                    }
                                    title={
                                        <Typography variant="subtitle1" fontWeight={600}>
                                            {userProfiles[note.createdByUID]?.displayName || note.createdBy}
                                        </Typography>
                                    }
                                    subheader={
                                        <Typography variant="caption" color="text.secondary">
                                            {userProfiles[note.createdByUID]?.email || ''}
                                        </Typography>
                                    }
                                    sx={{ pb: 1 }}
                                />

                                {/* Note Content */}
                                <CardContent sx={{ pt: 0 }}>
                                    {editingNote === note.id ? (
                                        <Box>
                                            <TextField
                                                fullWidth
                                                multiline
                                                rows={3}
                                                defaultValue={note.content}
                                                variant="outlined"
                                                sx={{ mb: 2 }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.ctrlKey) {
                                                        handleEditNote(note.id, e.target.value);
                                                    }
                                                }}
                                            />
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={(e) => {
                                                        const textarea = e.target.closest('.MuiCardContent-root').querySelector('textarea');
                                                        handleEditNote(note.id, textarea.value);
                                                    }}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    size="small"
                                                    onClick={() => setEditingNote(null)}
                                                >
                                                    Cancel
                                                </Button>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6 }}>
                                            {note.content}
                                        </Typography>
                                    )}

                                    {/* Attachments */}
                                    {note.attachments && note.attachments.length > 0 && (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                                Attachments
                                            </Typography>
                                            <Stack spacing={1}>
                                                {note.attachments.map((attachment, index) =>
                                                    renderAttachment(attachment, index, false)
                                                )}
                                            </Stack>
                                        </Box>
                                    )}

                                    {/* Reactions */}
                                    {note.reactions && Object.keys(note.reactions).length > 0 && (
                                        <Box sx={{ mb: 2 }}>
                                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                                {Object.entries(note.reactions).map(([emoji, users]) =>
                                                    users.length > 0 && (
                                                        <Chip
                                                            key={emoji}
                                                            label={`${emoji} ${users.length}`}
                                                            size="small"
                                                            variant={users.includes(user?.uid) ? "filled" : "outlined"}
                                                            onClick={() => handleToggleReaction(note.id, emoji)}
                                                            sx={{
                                                                cursor: 'pointer',
                                                                bgcolor: users.includes(user?.uid) ? '#e0e7ff' : 'transparent',
                                                                '&:hover': { bgcolor: '#e0e7ff' }
                                                            }}
                                                        />
                                                    )
                                                )}
                                            </Stack>
                                        </Box>
                                    )}
                                </CardContent>

                                {/* Note Actions */}
                                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <Tooltip title="Add Reaction">
                                            <IconButton
                                                size="small"
                                                onClick={() => setEmojiPickerOpen(note.id)}
                                            >
                                                <EmojiIcon />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip title="Reply">
                                            <IconButton
                                                size="small"
                                                onClick={() => setReplyingTo(replyingTo === note.id ? null : note.id)}
                                            >
                                                <ReplyIcon />
                                            </IconButton>
                                        </Tooltip>

                                        {note.replies && note.replies.length > 0 && (
                                            <Button
                                                size="small"
                                                startIcon={expandedNotes.has(note.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                onClick={() => toggleNoteExpansion(note.id)}
                                                sx={{ ml: 1 }}
                                            >
                                                {note.replies.length} {note.replies.length === 1 ? 'reply' : 'replies'}
                                            </Button>
                                        )}
                                    </Box>

                                    {note.createdByUID === user?.uid && (
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Tooltip title="Edit">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setEditingNote(note.id)}
                                                >
                                                    <EditIcon />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    sx={{ color: '#ef4444' }}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    )}
                                </CardActions>

                                {/* Reply Input */}
                                <Collapse in={replyingTo === note.id}>
                                    <Box sx={{ px: 2, pb: 2 }}>
                                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                                            {getUserAvatar(user?.uid)}
                                            <TextField
                                                fullWidth
                                                placeholder="Write a reply..."
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                multiline
                                                rows={2}
                                                variant="outlined"
                                                size="small"
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 2,
                                                        bgcolor: '#fafbff'
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.ctrlKey) {
                                                        handleAddReply(note.id);
                                                    }
                                                }}
                                            />
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={() => handleAddReply(note.id)}
                                                disabled={!replyText.trim()}
                                                sx={{ mt: 0.5 }}
                                            >
                                                Reply
                                            </Button>
                                        </Box>
                                    </Box>
                                </Collapse>

                                {/* Replies */}
                                <Collapse in={expandedNotes.has(note.id)}>
                                    <Box sx={{ px: 2, pb: 2 }}>
                                        {note.replies && note.replies.map((reply) => (
                                            <StyledReplyCard key={reply.id}>
                                                <CardHeader
                                                    avatar={getUserAvatar(reply.createdByUID)}
                                                    title={
                                                        <Typography variant="subtitle2">
                                                            {userProfiles[reply.createdByUID]?.displayName || reply.createdBy}
                                                        </Typography>
                                                    }
                                                    subheader={formatRelativeTime(reply.createdAt)}
                                                    action={
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setEmojiPickerOpen(`${note.id}-${reply.id}`)}
                                                        >
                                                            <EmojiIcon />
                                                        </IconButton>
                                                    }
                                                    sx={{ py: 1 }}
                                                />
                                                <CardContent sx={{ pt: 0, pb: 1 }}>
                                                    <Typography variant="body2" sx={{ mb: 1 }}>
                                                        {reply.content}
                                                    </Typography>

                                                    {/* Reply Reactions */}
                                                    {reply.reactions && Object.keys(reply.reactions).length > 0 && (
                                                        <Stack direction="row" spacing={1} flexWrap="wrap">
                                                            {Object.entries(reply.reactions).map(([emoji, users]) =>
                                                                users.length > 0 && (
                                                                    <Chip
                                                                        key={emoji}
                                                                        label={`${emoji} ${users.length}`}
                                                                        size="small"
                                                                        variant={users.includes(user?.uid) ? "filled" : "outlined"}
                                                                        onClick={() => handleToggleReaction(note.id, emoji, true, reply.id)}
                                                                        sx={{
                                                                            cursor: 'pointer',
                                                                            fontSize: '12px',
                                                                            height: '24px'
                                                                        }}
                                                                    />
                                                                )
                                                            )}
                                                        </Stack>
                                                    )}
                                                </CardContent>
                                            </StyledReplyCard>
                                        ))}
                                    </Box>
                                </Collapse>

                                {/* Emoji Picker for this note */}
                                {renderEmojiPicker(note.id)}

                                {/* Emoji Pickers for replies */}
                                {note.replies && note.replies.map(reply =>
                                    renderEmojiPicker(note.id, true, reply.id)
                                )}
                            </StyledNoteCard>
                        ))}
                    </Stack>
                )}

                {/* Link Dialog */}
                <Dialog open={showLinkDialog} onClose={() => setShowLinkDialog(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Add Link</DialogTitle>
                    <DialogContent>
                        <TextField
                            fullWidth
                            label="URL"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            placeholder="https://example.com"
                            sx={{ mb: 2, mt: 1 }}
                        />
                        <TextField
                            fullWidth
                            label="Title (optional)"
                            value={linkTitle}
                            onChange={(e) => setLinkTitle(e.target.value)}
                            placeholder="Description of the link"
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setShowLinkDialog(false)}>Cancel</Button>
                        <Button onClick={handleAddLink} variant="contained" disabled={!linkUrl.trim()}>
                            Add Link
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>

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
        </Box>
    );
};

export default CustomerDetail; 