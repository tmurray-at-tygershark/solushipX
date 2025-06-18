import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Grid,
    Chip,
    IconButton,
    Card,
    CardContent,
    CardHeader,
    Divider,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Stack,
    Avatar,
    Snackbar,
    CardActions,
    Collapse,
    Tooltip,
    MenuItem,
    Menu,
    styled
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    LocationOn as LocationIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    AccessTime as AccessTimeIcon,
    Info as InfoIcon,
    Map as MapIcon,
    ContentCopy as ContentCopyIcon,
    Launch as LaunchIcon,
    Warning as WarningIcon,
    Note as NoteIcon,
    AttachFile as AttachFileIcon,
    EmojiEmotions as EmojiIcon,
    Reply as ReplyIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Close as CloseIcon,
    Attachment as AttachmentIcon,
    Download as DownloadIcon,
    Image as ImageIcon,
    Link as LinkInsertIcon,
    Mic as MicIcon,
    Send as SendIcon
} from '@mui/icons-material';
import { doc, getDoc, deleteDoc, collection, query, orderBy, limit, addDoc, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useSnackbar } from 'notistack';

// Enhanced emoji picker data for 2025 enterprise warehouse system
const EMOJI_CATEGORIES = {
    'Quick Actions': ['✅', '❌', '⚠️', '🔥', '⭐', '📌', '🚀', '💡'],
    'Status & Priority': ['🟢', '🟡', '🔴', '🔵', '🟣', '⚫', '⚪', '🟤', '🟠'],
    'Warehouse Operations': ['📦', '🚚', '🏭', '🏗️', '⚙️', '🔧', '🔨', '📋', '📊', '📈', '📉', '💼', '📞', '📧', '🔗', '📎', '📝', '📄', '🗂️', '📁', '📅', '⏰', '⏱️', '⏲️'],
    'Communication': ['💬', '💭', '🗯️', '💡', '📢', '📣', '📯', '🔔', '🔕', '📞', '📟', '📠', '📧', '📨', '📩', '📤', '📥', '📮', '🗳️', '✏️', '✒️', '🖋️', '🖊️', '🖌️', '🖍️', '📝'],
    'Emotions & Reactions': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
    'Symbols & Arrows': ['➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️', '🔄', '🔃', '🔂', '🔁', '🔀', '🔼', '🔽']
};

// Note types for enterprise address management
const NOTE_TYPES = {
    general: { label: 'General Note', icon: '📝', color: '#6366f1', bgColor: '#eef2ff' },
    delivery: { label: 'Delivery Instructions', icon: '🚚', color: '#0ea5e9', bgColor: '#eff6ff' },
    access: { label: 'Access Information', icon: '🔑', color: '#f59e0b', bgColor: '#fef3c7' },
    contact: { label: 'Contact Details', icon: '📞', color: '#10b981', bgColor: '#ecfdf5' },
    issue: { label: 'Issue/Problem', icon: '⚠️', color: '#ef4444', bgColor: '#fef2f2' },
    resolution: { label: 'Resolution', icon: '✅', color: '#10b981', bgColor: '#ecfdf5' },
    restriction: { label: 'Restrictions', icon: '🚫', color: '#dc2626', bgColor: '#fee2e2' },
    priority: { label: 'Priority/Urgent', icon: '🔥', color: '#dc2626', bgColor: '#fee2e2' },
    schedule: { label: 'Schedule/Timing', icon: '⏰', color: '#7c3aed', bgColor: '#f5f3ff' },
    special: { label: 'Special Instructions', icon: '📋', color: '#4338ca', bgColor: '#eef2ff' }
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

const AddressDetail = ({ addressId, onEdit, onBack, onDelete, isModal = false, highlightNoteId = null }) => {
    const { enqueueSnackbar } = useSnackbar();
    const { user, loading: authLoading } = useAuth();
    const { companyIdForAddress } = useCompany();

    // State management
    const [address, setAddress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Enhanced notes system state
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [addingNote, setAddingNote] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Note features
    const [selectedNoteType, setSelectedNoteType] = useState('general');
    const [selectedPriority, setSelectedPriority] = useState('medium');
    const [selectedStatus, setSelectedStatus] = useState('open');
    const [isPinned, setIsPinned] = useState(false);

    // UI state
    const [editingNote, setEditingNote] = useState(null);
    const [editNoteContent, setEditNoteContent] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(null);
    const [attachments, setAttachments] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState(new Set());
    const [userProfiles, setUserProfiles] = useState({});

    // Refs
    const fileInputRef = useRef(null);
    const noteInputRef = useRef(null);

    useEffect(() => {
        let notesUnsubscribe = null;

        if (addressId) {
            fetchAddressData();
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
    }, [addressId]);

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

    const fetchAddressData = async () => {
        try {
            setLoading(true);
            const addressDoc = await getDoc(doc(db, 'addressBook', addressId));

            if (addressDoc.exists()) {
                setAddress({
                    id: addressDoc.id,
                    ...addressDoc.data()
                });
            } else {
                enqueueSnackbar('Address not found', { variant: 'error' });
                onBack();
            }
        } catch (error) {
            console.error('Error fetching address:', error);
            enqueueSnackbar('Failed to load address data', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCopyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text).then(() => {
            enqueueSnackbar(`${label} copied to clipboard`, { variant: 'success' });
        }).catch(() => {
            enqueueSnackbar('Failed to copy to clipboard', { variant: 'error' });
        });
    };

    const handleOpenInMaps = () => {
        if (!address) return;

        const fullAddress = `${address.street}${address.street2 ? `, ${address.street2}` : ''}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;
        const encodedAddress = encodeURIComponent(fullAddress);
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        window.open(mapsUrl, '_blank');
    };

    const handleDeleteClick = () => {
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            setDeleting(true);
            await deleteDoc(doc(db, 'addressBook', addressId));
            setDeleteConfirmOpen(false);
            enqueueSnackbar('Address deleted successfully', { variant: 'success' });
            onBack();
        } catch (error) {
            console.error('Error deleting address:', error);
            enqueueSnackbar('Failed to delete address', { variant: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmOpen(false);
    };

    const formatTime = (timeString) => {
        if (!timeString) return 'Not specified';
        try {
            const time = new Date(`2000-01-01T${timeString}`);
            return time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        } catch {
            return timeString;
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return 'N/A';
        }
    };

    // Fetch notes with enhanced enterprise features
    const fetchNotes = async () => {
        if (!addressId) return;

        try {
            // Fetch notes from the address's subcollection
            const addressRef = doc(db, 'addressBook', addressId);
            const notesRef = collection(addressRef, 'notes');
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

                console.log('Fetched notes from address subcollection:', notesData);
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

            return unsubscribe;
        } catch (error) {
            console.error('Error fetching notes:', error);
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

    // Enhanced file upload with metadata
    const handleFileUpload = async (file) => {
        if (!file) return null;

        setUploadingFile(true);
        try {
            // Get current user with fallback
            const currentUser = getCurrentUser();

            // Use the same storage configuration as other components
            const { getApp } = await import('firebase/app');
            const { getStorage } = await import('firebase/storage');
            const firebaseApp = getApp();
            const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");

            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const fileRef = ref(customStorage, `address-notes/${addressId}/${fileName}`);
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
                size: file.size,
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

    // Get current user UID with fallback
    const getCurrentUserUID = () => {
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
            return firebaseUser.uid;
        }
        return user?.uid || localStorage.getItem('userUID') || 'anonymous_' + Date.now();
    };

    // Reset note form
    const resetNoteForm = () => {
        setNewNote('');
        setAttachments([]);
        setSelectedNoteType('general');
        setSelectedPriority('medium');
        setSelectedStatus('open');
        setIsPinned(false);
    };

    // Enhanced note creation with all enterprise features
    const handleAddNote = async () => {
        console.log('🚀 handleAddNote called with:', {
            newNote,
            user,
            authLoading,
            companyIdForAddress,
            addressId,
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

        if (!companyIdForAddress) {
            console.log('❌ Validation failed: No company ID');
            setErrorMessage('Company information not available');
            setShowError(true);
            return;
        }

        if (!addressId) {
            console.log('❌ Validation failed: No address ID');
            setErrorMessage('Address ID not available');
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
                addressID: addressId,
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
                isPinned: isPinned,

                // Attachments and media (combine file attachments with auto-detected URLs)
                attachments: [...(attachments || []), ...extractUrls(newNote)],

                // Collaboration features
                reactions: {},
                replies: [],

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
                    source: 'address_detail',
                    version: '2.0'
                }
            };

            console.log('📝 Creating note with data:', noteData);

            // Save note as a subcollection within the address document
            console.log('🔗 Creating address reference for ID:', addressId);
            const addressRef = doc(db, 'addressBook', addressId);
            const notesRef = collection(addressRef, 'notes');

            console.log('💾 Attempting to save note to Firestore...');
            const docRef = await addDoc(notesRef, noteData);
            console.log('✅ Note created successfully with ID:', docRef.id);

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

            const addressRef = doc(db, 'addressBook', addressId);
            const noteRef = doc(addressRef, 'notes', noteId);
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

            const addressRef = doc(db, 'addressBook', addressId);
            const noteRef = doc(addressRef, 'notes', noteId);
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
            const addressRef = doc(db, 'addressBook', addressId);
            const noteRef = doc(addressRef, 'notes', noteId);
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
            const addressRef = doc(db, 'addressBook', addressId);
            const noteRef = doc(addressRef, 'notes', noteId);
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
                        <LinkInsertIcon color="primary" />
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
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ ml: 2, fontSize: '12px' }}>
                    Loading address details...
                </Typography>
            </Box>
        );
    }

    if (!address) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">
                    Address not found or failed to load.
                </Alert>
            </Box>
        );
    }

    const fullAddress = `${address.street}${address.street2 ? `, ${address.street2}` : ''}, ${address.city}, ${address.state} ${address.postalCode}`;

    return (
        <Box sx={isModal ? {
            height: '100%',
            width: '100%',
            overflow: 'auto',
            p: 3
        } : {
            maxWidth: 900,
            mx: 'auto',
            p: 3
        }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                        {address.companyName}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={onEdit}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Edit
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleDeleteClick}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Delete
                    </Button>
                </Box>
            </Box>

            <Grid container spacing={3}>
                {/* Customer Information */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ border: '1px solid #e2e8f0', height: '100%' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Customer Information
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Company Name
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                        {address.companyName || 'N/A'}
                                    </Typography>
                                </Box>
                                <Divider />
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Contact Person
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px', mt: 0.5 }}>
                                        {`${address.firstName || ''} ${address.lastName || ''}`.trim() || 'N/A'}
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Contact Information */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ border: '1px solid #e2e8f0', height: '100%' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Contact Information
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Email Address
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontSize: '12px', flex: 1 }}>
                                            {address.email || 'N/A'}
                                        </Typography>
                                        {address.email && (
                                            <IconButton
                                                size="small"
                                                onClick={() => handleCopyToClipboard(address.email, 'Email')}
                                                sx={{ p: 0.5 }}
                                            >
                                                <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                </Box>
                                <Divider />
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Phone Number
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontSize: '12px', flex: 1 }}>
                                            {address.phone || 'N/A'}
                                        </Typography>
                                        {address.phone && (
                                            <IconButton
                                                size="small"
                                                onClick={() => handleCopyToClipboard(address.phone, 'Phone')}
                                                sx={{ p: 0.5 }}
                                            >
                                                <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                            </IconButton>
                                        )}
                                    </Box>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Address Information */}
                <Grid item xs={12}>
                    <Card sx={{ border: '1px solid #e2e8f0' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Address Information
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={4}>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                            Street Address
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            {address.street || 'N/A'}
                                        </Typography>
                                        {address.street2 && (
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {address.street2}
                                            </Typography>
                                        )}
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                            City, State/Prov, Postal Code
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {`${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`}
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <Box>
                                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                            Country
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                            {address.country === 'US' ? 'United States' : address.country === 'CA' ? 'Canada' : address.country || 'N/A'}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Operating Hours */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ border: '1px solid #e2e8f0', height: '100%' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Operating Hours
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Opening Time
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {formatTime(address.openHours)}
                                    </Typography>
                                </Box>
                                <Divider />
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Closing Time
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {formatTime(address.closeHours)}
                                    </Typography>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Additional Information */}
                <Grid item xs={12} md={6}>
                    <Card sx={{ border: '1px solid #e2e8f0', height: '100%' }}>
                        <CardHeader
                            title={
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                    Additional Information
                                </Typography>
                            }
                            sx={{ pb: 1 }}
                        />
                        <CardContent sx={{ pt: 1 }}>
                            <Box>
                                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                    Special Instructions
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px', mt: 0.5 }}>
                                    {address.specialInstructions || 'No special instructions provided'}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Record Information */}
                <Grid item xs={12}>
                    <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                        <CardContent>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                Record Information
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Created Date
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {formatDate(address.createdAt)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Last Updated
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                        {formatDate(address.updatedAt)}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Status
                                    </Typography>
                                    <Chip
                                        label={address.status === 'active' ? 'Active' : 'Inactive'}
                                        color={address.status === 'active' ? 'success' : 'default'}
                                        size="small"
                                        sx={{ fontSize: '11px', mt: 0.5 }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                        Address ID
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                            {address.id}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleCopyToClipboard(address.id, 'Address ID')}
                                            sx={{ p: 0.5 }}
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                        </IconButton>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Enhanced Notes System */}
                <Grid item xs={12} sx={{ mt: 4 }}>
                    <Paper
                        elevation={1}
                        sx={{
                            p: 3,
                            borderRadius: 2,
                            border: '1px solid #e2e8f0'
                        }}
                    >
                        {/* Header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                            <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px', color: '#000' }}>
                                Address Notes & Communication
                            </Typography>
                            <Chip
                                label={`${notes.length} ${notes.length === 1 ? 'Note' : 'Notes'}`}
                                size="small"
                                sx={{
                                    bgcolor: '#f3f4f6',
                                    color: '#374151',
                                    fontSize: '11px'
                                }}
                            />
                        </Box>

                        {/* Add New Note Section */}
                        <Box
                            sx={{
                                bgcolor: '#f8fafc',
                                borderRadius: 2,
                                p: 3,
                                mb: 3,
                                border: '1px solid #e2e8f0'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                    Add New Note
                                </Typography>
                            </Box>

                            {/* Note Input */}
                            <TextField
                                ref={noteInputRef}
                                fullWidth
                                multiline
                                rows={4}
                                placeholder="Enter your note here... URLs will be automatically detected and added as attachments."
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                sx={{
                                    mb: 2,
                                    '& .MuiInputBase-root': {
                                        fontSize: '12px'
                                    }
                                }}
                            />

                            {/* Attachments Display */}
                            {attachments.length > 0 && (
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '12px' }}>
                                        Attachments ({attachments.length})
                                    </Typography>
                                    <Stack spacing={1}>
                                        {attachments.map((attachment, index) =>
                                            renderAttachment(attachment, index, true)
                                        )}
                                    </Stack>
                                </Box>
                            )}

                            {/* Actions Row */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Button
                                    variant="contained"
                                    startIcon={addingNote ? <CircularProgress size={16} /> : <SendIcon />}
                                    onClick={handleAddNote}
                                    disabled={addingNote || !newNote.trim()}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {addingNote ? 'Adding...' : 'Add Note'}
                                </Button>

                                <input
                                    type="file"
                                    multiple
                                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                    ref={fileInputRef}
                                />

                                <Button
                                    variant="outlined"
                                    startIcon={uploadingFile ? <CircularProgress size={16} /> : <AttachFileIcon />}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingFile}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {uploadingFile ? 'Uploading...' : 'Attach Files'}
                                </Button>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip
                                        icon={<span style={{ fontSize: '14px' }}>📌</span>}
                                        label="Pin Note"
                                        clickable
                                        size="small"
                                        variant={isPinned ? "filled" : "outlined"}
                                        onClick={() => setIsPinned(!isPinned)}
                                        sx={{
                                            fontSize: '11px',
                                            ...(isPinned ? {
                                                bgcolor: '#fef3c7',
                                                color: '#f59e0b',
                                                borderColor: '#f59e0b'
                                            } : {})
                                        }}
                                    />
                                </Box>
                            </Box>
                        </Box>

                        {/* Notes List */}
                        <Box
                            sx={{
                                bgcolor: 'white',
                                borderRadius: 2,
                                p: 3,
                                border: '1px solid #e2e8f0',
                                maxHeight: '600px',
                                overflowY: 'auto'
                            }}
                        >
                            {notes.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <NoteIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary" sx={{ fontSize: '14px' }}>
                                        No notes yet
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                        Add the first note to start tracking important information about this address.
                                    </Typography>
                                </Box>
                            ) : (
                                <Stack spacing={2}>
                                    {notes.map((note) => (
                                        <StyledNoteCard
                                            key={note.id}
                                            id={`note-${note.id}`}
                                            noteType={note.type || 'general'}
                                            priority={note.priority || 'medium'}
                                            isPinned={note.isPinned}
                                        >
                                            <CardHeader
                                                avatar={getUserAvatar(note.createdByUID)}
                                                title={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                            {note.createdBy}
                                                        </Typography>
                                                        <Chip
                                                            icon={<span>{NOTE_TYPES[note.type]?.icon || '📝'}</span>}
                                                            label={NOTE_TYPES[note.type]?.label || 'General'}
                                                            size="small"
                                                            sx={{
                                                                fontSize: '10px',
                                                                height: '20px',
                                                                bgcolor: NOTE_TYPES[note.type]?.bgColor,
                                                                color: NOTE_TYPES[note.type]?.color
                                                            }}
                                                        />
                                                        <Chip
                                                            icon={<span>{PRIORITY_LEVELS[note.priority]?.icon || '➡️'}</span>}
                                                            label={PRIORITY_LEVELS[note.priority]?.label || 'Medium'}
                                                            size="small"
                                                            sx={{
                                                                fontSize: '10px',
                                                                height: '20px',
                                                                bgcolor: PRIORITY_LEVELS[note.priority]?.bgColor,
                                                                color: PRIORITY_LEVELS[note.priority]?.color
                                                            }}
                                                        />
                                                        <Chip
                                                            icon={<span>{NOTE_STATUS[note.status]?.icon || '🔵'}</span>}
                                                            label={NOTE_STATUS[note.status]?.label || 'Open'}
                                                            size="small"
                                                            sx={{
                                                                fontSize: '10px',
                                                                height: '20px',
                                                                bgcolor: NOTE_STATUS[note.status]?.bgColor,
                                                                color: NOTE_STATUS[note.status]?.color
                                                            }}
                                                        />
                                                    </Box>
                                                }
                                                subheader={
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                                                        {formatRelativeTime(note.createdAt)} • {formatDate(note.createdAt)}
                                                        {note.isEdited && ' • Edited'}
                                                    </Typography>
                                                }
                                                action={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Tooltip title="Add Reaction">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setEmojiPickerOpen(`${note.id}`)}
                                                            >
                                                                <EmojiIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Reply">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setReplyingTo(note.id)}
                                                            >
                                                                <ReplyIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Edit">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    setEditingNote(note.id);
                                                                    setEditNoteContent(note.content);
                                                                }}
                                                            >
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Delete">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleDeleteNote(note.id)}
                                                                color="error"
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
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
                                                            sx={{ mb: 2, '& .MuiInputBase-root': { fontSize: '12px' } }}
                                                        />
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                onClick={() => handleEditNote(note.id, editNoteContent)}
                                                                sx={{ fontSize: '11px' }}
                                                            >
                                                                Save
                                                            </Button>
                                                            <Button
                                                                size="small"
                                                                onClick={() => setEditingNote(null)}
                                                                sx={{ fontSize: '11px' }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <Typography variant="body2" sx={{ mb: 2, fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                                                        {note.content}
                                                    </Typography>
                                                )}

                                                {/* Attachments */}
                                                {note.attachments && note.attachments.length > 0 && (
                                                    <Box sx={{ mt: 2 }}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontSize: '11px' }}>
                                                            Attachments ({note.attachments.length})
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
                                                    <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                                                        {Object.entries(note.reactions).map(([emoji, users]) =>
                                                            users.length > 0 ? (
                                                                <Chip
                                                                    key={emoji}
                                                                    label={`${emoji} ${users.length}`}
                                                                    size="small"
                                                                    clickable
                                                                    onClick={() => handleToggleReaction(note.id, emoji)}
                                                                    sx={{
                                                                        fontSize: '11px',
                                                                        height: '24px',
                                                                        bgcolor: users.includes(getCurrentUserUID()) ? '#e3f2fd' : '#f5f5f5'
                                                                    }}
                                                                />
                                                            ) : null
                                                        )}
                                                    </Box>
                                                )}

                                                {/* Replies */}
                                                {note.replies && note.replies.length > 0 && (
                                                    <Box sx={{ mt: 2 }}>
                                                        <Button
                                                            size="small"
                                                            onClick={() => toggleNoteExpansion(note.id)}
                                                            startIcon={expandedNotes.has(note.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                            sx={{ fontSize: '11px', mb: 1 }}
                                                        >
                                                            {note.replies.length} {note.replies.length === 1 ? 'Reply' : 'Replies'}
                                                        </Button>

                                                        <Collapse in={expandedNotes.has(note.id)}>
                                                            <Stack spacing={1} sx={{ pl: 2, borderLeft: '2px solid #e0e0e0' }}>
                                                                {note.replies.map((reply) => (
                                                                    <Box key={reply.id} sx={{ p: 2, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                                            {getUserAvatar(reply.createdByUID)}
                                                                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '11px' }}>
                                                                                {reply.createdBy}
                                                                            </Typography>
                                                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>
                                                                                {formatRelativeTime(reply.createdAt)}
                                                                            </Typography>
                                                                        </Box>
                                                                        <Typography variant="body2" sx={{ fontSize: '11px', mb: 1 }}>
                                                                            {reply.content}
                                                                        </Typography>

                                                                        {/* Reply reactions */}
                                                                        {reply.reactions && Object.keys(reply.reactions).length > 0 && (
                                                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                                                {Object.entries(reply.reactions).map(([emoji, users]) =>
                                                                                    users.length > 0 ? (
                                                                                        <Chip
                                                                                            key={emoji}
                                                                                            label={`${emoji} ${users.length}`}
                                                                                            size="small"
                                                                                            clickable
                                                                                            onClick={() => handleToggleReaction(note.id, emoji, true, reply.id)}
                                                                                            sx={{
                                                                                                fontSize: '10px',
                                                                                                height: '20px',
                                                                                                bgcolor: users.includes(getCurrentUserUID()) ? '#e3f2fd' : '#f5f5f5'
                                                                                            }}
                                                                                        />
                                                                                    ) : null
                                                                                )}
                                                                            </Box>
                                                                        )}
                                                                    </Box>
                                                                ))}
                                                            </Stack>
                                                        </Collapse>
                                                    </Box>
                                                )}

                                                {/* Reply Input */}
                                                {replyingTo === note.id && (
                                                    <Box sx={{ mt: 2, pl: 2, borderLeft: '2px solid #e0e0e0' }}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            placeholder="Type your reply..."
                                                            value={replyText}
                                                            onChange={(e) => setReplyText(e.target.value)}
                                                            multiline
                                                            rows={2}
                                                            sx={{ mb: 1, '& .MuiInputBase-root': { fontSize: '12px' } }}
                                                        />
                                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                                            <Button
                                                                size="small"
                                                                variant="contained"
                                                                onClick={() => handleAddReply(note.id)}
                                                                disabled={!replyText.trim()}
                                                                sx={{ fontSize: '11px' }}
                                                            >
                                                                Reply
                                                            </Button>
                                                            <Button
                                                                size="small"
                                                                onClick={() => {
                                                                    setReplyingTo(null);
                                                                    setReplyText('');
                                                                }}
                                                                sx={{ fontSize: '11px' }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </Box>
                                                    </Box>
                                                )}
                                            </CardContent>
                                        </StyledNoteCard>
                                    ))}
                                </Stack>
                            )}
                        </Box>

                        {/* Emoji Pickers */}
                        {notes.map(note => (
                            <div key={`emoji-picker-${note.id}`}>
                                {renderEmojiPicker(note.id)}
                                {note.replies?.map(reply => renderEmojiPicker(note.id, true, reply.id))}
                            </div>
                        ))}
                    </Paper>
                </Grid>
            </Grid>

            {/* Success/Error Snackbars */}
            <Snackbar
                open={showSuccess}
                autoHideDuration={4000}
                onClose={() => setShowSuccess(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity="success" onClose={() => setShowSuccess(false)} sx={{ fontSize: '12px' }}>
                    Operation completed successfully!
                </Alert>
            </Snackbar>

            <Snackbar
                open={showError}
                autoHideDuration={6000}
                onClose={() => setShowError(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity="error" onClose={() => setShowError(false)} sx={{ fontSize: '12px' }}>
                    {errorMessage}
                </Alert>
            </Snackbar>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={handleDeleteCancel}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon sx={{ color: 'error.main' }} />
                        Delete Address
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        This action cannot be undone. The address will be permanently deleted.
                    </Alert>
                    <Typography sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete the address for <strong>{address.companyName}</strong>?
                    </Typography>
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1 }}>
                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                            Address to be deleted:
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', mt: 0.5 }}>
                            {fullAddress}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteConfirm}
                        color="error"
                        variant="contained"
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
                        sx={{ fontSize: '12px' }}
                    >
                        {deleting ? 'Deleting...' : 'Delete Address'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AddressDetail; 