import React, { useState, useEffect, Suspense, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Toolbar,
    Tabs,
    Tab,
    Stack,
    CircularProgress,
    InputAdornment,
    Collapse,
    Grid,
    Checkbox,
    Menu,
    MenuItem,
    Tooltip,
    Alert,
    FormControl,
    InputLabel,
    Select
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon,
    GetApp as ExportIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    SearchOff as SearchOffIcon,
    Add as AddIcon,
    Close as CloseIcon,
    ContentCopy as ContentCopyIcon,
    LocationOn as LocationIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Email as EmailIcon,
    DeleteSweep as DeleteSweepIcon,
    Archive as ArchiveIcon,
    Restore as RestoreIcon,
    FilterAlt as FilterAltIcon,
    CloudUpload as UploadIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import html2pdf from 'html2pdf.js';

// Import common components
import ModalHeader from '../common/ModalHeader';
import PdfViewerDialog from '../Shipments/components/PdfViewerDialog';
import ShipmentsPagination from '../Shipments/components/ShipmentsPagination';

// Import modal navigation hook
import useModalNavigation from '../../hooks/useModalNavigation';

// Lazy load components
const AddressForm = React.lazy(() => import('./AddressForm'));
const AddressDetail = React.lazy(() => import('./AddressDetail'));
const AddressImport = React.lazy(() => import('./AddressImport'));

const AddressBook = ({ isModal = false, onClose = null, showCloseButton = false, onModalBack = null }) => {
    const { companyIdForAddress } = useCompany();
    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Modal navigation system
    const modalNavigation = useModalNavigation({
        title: 'Address Book',
        shortTitle: 'Address Book',
        component: 'address-book'
    });

    // State management
    const [addresses, setAddresses] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState('all');



    // Enhanced search fields matching ShipmentsX pattern
    const [searchFields, setSearchFields] = useState({
        companyName: '',
        contactName: '',
        email: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: ''
    });

    // Filter states
    const [filters, setFilters] = useState({
        country: 'all'
    });

    // Selection state for export
    const [selectedAddresses, setSelectedAddresses] = useState(new Set());

    // Export dialog state
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
    const [isExporting, setIsExporting] = useState(false);

    // PDF viewer state
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState('');

    // Modal view state
    const [currentView, setCurrentView] = useState('table'); // 'table', 'detail', 'add', 'edit'
    const [selectedAddressId, setSelectedAddressId] = useState(null);
    const [isSliding, setIsSliding] = useState(false);

    // Action menu state
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedAddress, setSelectedAddress] = useState(null);

    // Delete confirmation state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [addressToDelete, setAddressToDelete] = useState(null);

    // Bulk actions state
    const [bulkActionMenuAnchor, setBulkActionMenuAnchor] = useState(null);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    // Import state
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

    const fetchAddresses = async () => {
        if (!companyIdForAddress) return;

        try {
            setLoading(true);
            console.log('Fetching addresses for company:', companyIdForAddress);

            const addressesRef = collection(db, 'addressBook');
            const q = query(
                addressesRef,
                where('companyID', '==', companyIdForAddress),
                where('addressClass', '==', 'customer'),
                where('addressType', '==', 'destination'),
                where('status', '!=', 'deleted'),
                orderBy('status'),
                orderBy('companyName', 'asc')
            );

            const querySnapshot = await getDocs(q);
            console.log(`Found ${querySnapshot.size} addresses`);

            const addressesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Remove duplicates based on a combination of address fields
            const uniqueAddresses = addressesData.filter((address, index, array) => {
                const addressKey = `${address.companyName}-${address.street}-${address.city}-${address.state}-${address.postalCode}`;
                return array.findIndex(a =>
                    `${a.companyName}-${a.street}-${a.city}-${a.state}-${a.postalCode}` === addressKey
                ) === index;
            });

            console.log(`After deduplication: ${uniqueAddresses.length} unique addresses`);
            setAddresses(uniqueAddresses);
            setTotalCount(uniqueAddresses.length);
        } catch (error) {
            console.error('Error fetching addresses:', error);
            enqueueSnackbar('Failed to fetch addresses', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };



    // useEffect hooks
    useEffect(() => {
        fetchAddresses();
    }, [companyIdForAddress, page, rowsPerPage]);



    // Enhanced comprehensive search function
    const searchAddress = (address, searchTerm) => {
        if (!searchTerm) return true;

        const term = searchTerm.toLowerCase();
        const searchableFields = [
            address.companyName,
            address.firstName,
            address.lastName,
            address.email,
            address.phone,
            address.street,
            address.street2,
            address.city,
            address.state,
            address.postalCode,
            address.country,
            address.specialInstructions,
            address.status,
            // Concatenated fields
            `${address.firstName || ''} ${address.lastName || ''}`.trim(),
            `${address.street || ''} ${address.street2 ? `, ${address.street2}` : ''}`.trim(),
            `${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`.trim(),
            // Time fields
            address.openHours,
            address.closeHours
        ];

        return searchableFields.some(field =>
            field && String(field).toLowerCase().includes(term)
        );
    };

    // Enhanced filter function with comprehensive logic
    const filteredAddresses = React.useMemo(() => {
        console.log('🔍 Filtering addresses:', {
            totalAddresses: addresses.length,
            globalSearchQuery,
            searchFields,
            filters,
            selectedTab
        });

        let filtered = addresses;

        // Apply tab filter
        if (selectedTab !== 'all') {
            filtered = filtered.filter(address => {
                switch (selectedTab) {
                    case 'active':
                        return address.status === 'active';
                    case 'inactive':
                        return address.status === 'inactive';
                    default:
                        return true;
                }
            });
        }

        console.log('After tab filter:', filtered.length);

        // Apply global search
        if (globalSearchQuery) {
            filtered = filtered.filter(address => searchAddress(address, globalSearchQuery));
            console.log(`After global search "${globalSearchQuery}":`, filtered.length);
        }

        // Apply specific field searches
        if (searchFields.companyName) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(address =>
                address.companyName?.toLowerCase().includes(searchFields.companyName.toLowerCase())
            );
            console.log(`After company name search "${searchFields.companyName}": ${beforeCount} → ${filtered.length}`);
        }

        if (searchFields.contactName) {
            const beforeCount = filtered.length;
            const contactSearch = searchFields.contactName.toLowerCase();
            filtered = filtered.filter(address => {
                const fullName = `${address.firstName || ''} ${address.lastName || ''}`.trim().toLowerCase();
                const firstName = (address.firstName || '').toLowerCase();
                const lastName = (address.lastName || '').toLowerCase();
                return fullName.includes(contactSearch) ||
                    firstName.includes(contactSearch) ||
                    lastName.includes(contactSearch);
            });
            console.log(`After contact name search "${searchFields.contactName}": ${beforeCount} → ${filtered.length}`);
        }

        if (searchFields.email) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(address =>
                address.email?.toLowerCase().includes(searchFields.email.toLowerCase())
            );
            console.log(`After email search "${searchFields.email}": ${beforeCount} → ${filtered.length}`);
        }



        if (searchFields.street) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(address => {
                const streetSearch = searchFields.street.toLowerCase();
                const street1 = (address.street || '').toLowerCase();
                const street2 = (address.street2 || '').toLowerCase();
                return street1.includes(streetSearch) || street2.includes(streetSearch);
            });
            console.log(`After street search "${searchFields.street}": ${beforeCount} → ${filtered.length}`);
        }

        if (searchFields.city) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(address =>
                address.city?.toLowerCase().includes(searchFields.city.toLowerCase())
            );
            console.log(`After city search "${searchFields.city}": ${beforeCount} → ${filtered.length}`);
        }

        if (searchFields.state) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(address =>
                address.state?.toLowerCase().includes(searchFields.state.toLowerCase())
            );
            console.log(`After state search "${searchFields.state}": ${beforeCount} → ${filtered.length}`);
        }

        if (searchFields.postalCode) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(address =>
                address.postalCode?.toLowerCase().includes(searchFields.postalCode.toLowerCase())
            );
            console.log(`After postal code search "${searchFields.postalCode}": ${beforeCount} → ${filtered.length}`);
        }

        if (searchFields.country) {
            const beforeCount = filtered.length;
            filtered = filtered.filter(address =>
                address.country?.toLowerCase().includes(searchFields.country.toLowerCase())
            );
            console.log(`After country search "${searchFields.country}": ${beforeCount} → ${filtered.length}`);
        }

        // Apply filters
        if (filters.country !== 'all') {
            const beforeCount = filtered.length;
            filtered = filtered.filter(address => address.country === filters.country);
            console.log(`After country filter "${filters.country}": ${beforeCount} → ${filtered.length}`);
        }

        console.log('✅ Final filtered results:', filtered.length);
        return filtered;
    }, [addresses, selectedTab, globalSearchQuery, searchFields, filters]);

    // Pagination
    const paginatedAddresses = React.useMemo(() => {
        const start = page * rowsPerPage;
        const result = filteredAddresses.slice(start, start + rowsPerPage);
        console.log('📄 Pagination:', {
            page,
            rowsPerPage,
            start,
            filteredTotal: filteredAddresses.length,
            paginatedCount: result.length
        });
        return result;
    }, [filteredAddresses, page, rowsPerPage]);

    // Get unique countries for filter dropdown
    const availableCountries = React.useMemo(() => {
        const countries = [...new Set(addresses.map(addr => addr.country).filter(Boolean))];
        return countries.sort();
    }, [addresses]);

    // Search handlers
    const handleGlobalSearchChange = (event) => {
        setGlobalSearchQuery(event.target.value);
        setPage(0);
    };

    const handleSearchFieldChange = (field, value) => {
        setSearchFields(prev => ({
            ...prev,
            [field]: value
        }));
        setPage(0);
    };

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
        setPage(0);
    };

    const clearAllFilters = () => {
        setGlobalSearchQuery('');
        setSearchFields({
            companyName: '',
            contactName: '',
            email: '',
            street: '',
            city: '',
            state: '',
            postalCode: '',
            country: ''
        });
        setFilters({
            country: 'all'
        });
        setPage(0);
    };

    // Check if any filters are active
    const hasActiveFilters = React.useMemo(() => {
        return globalSearchQuery ||
            Object.values(searchFields).some(value => value.trim()) ||
            Object.values(filters).some(value => value !== 'all');
    }, [globalSearchQuery, searchFields, filters]);

    // Navigation handlers
    const handleViewAddress = (addressId) => {
        // Find the address to get its details for the title
        const address = addresses.find(a => a.id === addressId) || { companyName: 'Address Details' };

        setSelectedAddressId(addressId);
        setCurrentView('detail');
        setIsSliding(true);
        setTimeout(() => setIsSliding(false), 300);

        // Update modal navigation for proper back button handling
        if (isModal) {
            modalNavigation.navigateTo({
                title: `${address.companyName || 'Address Details'}`,
                shortTitle: address.companyName || 'Address Details',
                component: 'address-detail',
                data: { addressId }
            });
        }
    };

    const handleAddAddress = () => {
        setSelectedAddressId(null);
        setCurrentView('add');
        setIsSliding(true);
        setTimeout(() => setIsSliding(false), 300);

        // Update modal navigation for proper back button handling
        if (isModal) {
            modalNavigation.navigateTo({
                title: 'Add New Address',
                shortTitle: 'Add Address',
                component: 'address-add',
                data: {}
            });
        }
    };

    const handleEditAddress = (addressId) => {
        // Find the address to get its details for the title
        const address = addresses.find(a => a.id === addressId) || { companyName: 'Edit Address' };

        setSelectedAddressId(addressId);
        setCurrentView('edit');
        setIsSliding(true);
        setTimeout(() => setIsSliding(false), 300);

        // Update modal navigation for proper back button handling
        if (isModal) {
            modalNavigation.navigateTo({
                title: `Edit ${address.companyName || 'Address'}`,
                shortTitle: 'Edit Address',
                component: 'address-edit',
                data: { addressId }
            });
        }
    };

    const handleBackToTable = () => {
        setCurrentView('table');
        setSelectedAddressId(null);
        setIsSliding(true);
        setTimeout(() => setIsSliding(false), 300);
        fetchAddresses(); // Refresh data

        // Reset modal navigation to address book main view
        if (isModal) {
            modalNavigation.navigateBack();
        }
    };

    const handleAddressCreated = (newAddressId) => {
        fetchAddresses();
        setSelectedAddressId(newAddressId);
        setCurrentView('detail');
    };

    const handleAddressUpdated = () => {
        fetchAddresses();
        setCurrentView('detail');
    };

    // Import handlers
    const handleImportOpen = () => {
        setIsImportDialogOpen(true);
    };

    const handleImportClose = () => {
        setIsImportDialogOpen(false);
    };

    const handleImportComplete = () => {
        fetchAddresses(); // Refresh the address list
        setIsImportDialogOpen(false);
    };

    // Action menu handlers
    const handleActionMenuOpen = (event, address) => {
        event.stopPropagation();
        setActionMenuAnchor(event.currentTarget);
        setSelectedAddress(address);
    };

    const handleActionMenuClose = () => {
        setActionMenuAnchor(null);
        setSelectedAddress(null);
    };

    const handleDeleteClick = () => {
        setAddressToDelete(selectedAddress);
        setDeleteConfirmOpen(true);
        handleActionMenuClose();
    };

    const handleDeleteConfirm = async () => {
        if (!addressToDelete) return;

        try {
            await deleteDoc(doc(db, 'addressBook', addressToDelete.id));
            setDeleteConfirmOpen(false);
            setAddressToDelete(null);
            fetchAddresses();
            enqueueSnackbar('Address deleted successfully', { variant: 'success' });
        } catch (error) {
            console.error('Error deleting address:', error);
            enqueueSnackbar('Failed to delete address', { variant: 'error' });
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmOpen(false);
        setAddressToDelete(null);
    };

    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = new Set(filteredAddresses.map(address => address.id));
            setSelectedAddresses(newSelected);
        } else {
            setSelectedAddresses(new Set());
        }
    };

    const handleSelectAddress = (addressId, event) => {
        event.stopPropagation();
        const newSelected = new Set(selectedAddresses);
        if (newSelected.has(addressId)) {
            newSelected.delete(addressId);
        } else {
            newSelected.add(addressId);
        }
        setSelectedAddresses(newSelected);
    };

    const isSelected = (addressId) => selectedAddresses.has(addressId);

    // Bulk action handlers
    const handleBulkActionMenuOpen = (event) => {
        setBulkActionMenuAnchor(event.currentTarget);
    };

    const handleBulkActionMenuClose = () => {
        setBulkActionMenuAnchor(null);
    };

    const handleBulkDelete = async () => {
        if (selectedAddresses.size === 0) return;

        try {
            setIsBulkDeleting(true);
            const batch = writeBatch(db);

            selectedAddresses.forEach(addressId => {
                const addressRef = doc(db, 'addressBook', addressId);
                batch.delete(addressRef);
            });

            await batch.commit();
            setSelectedAddresses(new Set());
            handleBulkActionMenuClose();
            fetchAddresses();
            enqueueSnackbar(`Successfully deleted ${selectedAddresses.size} addresses`, { variant: 'success' });
        } catch (error) {
            console.error('Error performing bulk delete:', error);
            enqueueSnackbar('Failed to delete addresses', { variant: 'error' });
        } finally {
            setIsBulkDeleting(false);
        }
    };

    // Export handlers
    const handleExport = () => {
        setIsExportDialogOpen(true);
    };

    const handleExportClose = () => {
        setIsExportDialogOpen(false);
        setIsExporting(false);
    };

    const handleExportConfirm = async () => {
        setIsExporting(true);
        try {
            const selectedAddressesData = addresses.filter(addr => selectedAddresses.has(addr.id));
            const dataToExport = selectedAddressesData.length > 0 ? selectedAddressesData : filteredAddresses;

            // Fetch notes for all addresses being exported
            const addressesWithNotes = await Promise.all(
                dataToExport.map(async (address) => {
                    try {
                        const addressRef = doc(db, 'addressBook', address.id);
                        const notesRef = collection(addressRef, 'notes');
                        const notesQuery = query(notesRef, orderBy('createdAt', 'desc'));
                        const notesSnapshot = await getDocs(notesQuery);

                        const notes = notesSnapshot.docs.map(noteDoc => ({
                            id: noteDoc.id,
                            ...noteDoc.data()
                        }));

                        return {
                            ...address,
                            notes: notes
                        };
                    } catch (error) {
                        console.error(`Error fetching notes for address ${address.id}:`, error);
                        return {
                            ...address,
                            notes: []
                        };
                    }
                })
            );

            const content = convertToCSVWithNotes(addressesWithNotes);
            const filename = 'address_book_export.csv';
            const mimeType = 'text/csv';

            const blob = new Blob([content], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            enqueueSnackbar('Export completed successfully', { variant: 'success' });
        } catch (error) {
            console.error('Error exporting addresses:', error);
            enqueueSnackbar('Failed to export addresses', { variant: 'error' });
        } finally {
            setIsExporting(false);
            handleExportClose();
        }
    };

    // Enhanced CSV export with customer records and notes in separate sections
    const convertToCSVWithNotes = (addressesWithNotes) => {
        let csvContent = '';

        // Customer Records Tab (Section 1)
        csvContent += 'CUSTOMER RECORDS\n';
        csvContent += '================\n\n';

        const customerHeaders = [
            'Address ID',
            'Company Name',
            'Contact First Name',
            'Contact Last Name',
            'Email',
            'Phone',
            'Street Address',
            'Street Address 2',
            'City',
            'State/Province',
            'Postal Code',
            'Country',
            'Status',
            'Open Hours',
            'Close Hours',
            'Special Instructions',
            'Created Date',
            'Last Updated',
            'Notes Count'
        ];

        csvContent += customerHeaders.map(header => `"${header}"`).join(',') + '\n';

        addressesWithNotes.forEach(address => {
            const formatDate = (timestamp) => {
                if (!timestamp) return '';
                try {
                    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                } catch {
                    return '';
                }
            };

            const formatTime = (timeString) => {
                if (!timeString) return '';
                try {
                    const [hours, minutes] = timeString.split(':');
                    const date = new Date();
                    date.setHours(parseInt(hours), parseInt(minutes));
                    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                } catch {
                    return timeString;
                }
            };

            const customerRow = [
                address.id || '',
                address.companyName || '',
                address.firstName || '',
                address.lastName || '',
                address.email || '',
                address.phone || '',
                address.street || '',
                address.street2 || '',
                address.city || '',
                address.state || '',
                address.postalCode || '',
                address.country === 'US' ? 'United States' : address.country === 'CA' ? 'Canada' : (address.country || ''),
                address.status || 'active',
                formatTime(address.openHours),
                formatTime(address.closeHours),
                address.specialInstructions || '',
                formatDate(address.createdAt),
                formatDate(address.updatedAt),
                address.notes ? address.notes.length : 0
            ];

            csvContent += customerRow.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
        });

        // Add separator between sections
        csvContent += '\n\n';

        // Customer Notes Tab (Section 2)
        csvContent += 'CUSTOMER NOTES\n';
        csvContent += '==============\n\n';

        const notesHeaders = [
            'Address ID',
            'Company Name',
            'Note ID',
            'Note Content',
            'Note Type',
            'Priority',
            'Status',
            'Is Pinned',
            'Created By',
            'Created By UID',
            'Created Date',
            'Last Updated',
            'Is Edited',
            'Attachments Count',
            'Reactions Count',
            'Replies Count'
        ];

        csvContent += notesHeaders.map(header => `"${header}"`).join(',') + '\n';

        addressesWithNotes.forEach(address => {
            if (address.notes && address.notes.length > 0) {
                address.notes.forEach(note => {
                    const formatNoteDate = (timestamp) => {
                        if (!timestamp) return '';
                        try {
                            if (timestamp.toDate) {
                                return timestamp.toDate().toLocaleDateString() + ' ' + timestamp.toDate().toLocaleTimeString();
                            } else if (timestamp instanceof Date) {
                                return timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString();
                            } else {
                                return new Date(timestamp).toLocaleDateString() + ' ' + new Date(timestamp).toLocaleTimeString();
                            }
                        } catch {
                            return '';
                        }
                    };

                    const noteRow = [
                        address.id || '',
                        address.companyName || '',
                        note.id || '',
                        note.content || '',
                        note.type || 'general',
                        note.priority || 'medium',
                        note.status || 'open',
                        note.isPinned ? 'Yes' : 'No',
                        note.createdBy || '',
                        note.createdByUID || '',
                        formatNoteDate(note.createdAt),
                        formatNoteDate(note.updatedAt),
                        note.isEdited ? 'Yes' : 'No',
                        note.attachments ? note.attachments.length : 0,
                        note.reactions ? Object.keys(note.reactions).length : 0,
                        note.replies ? note.replies.length : 0
                    ];

                    csvContent += noteRow.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
                });
            } else {
                // Add empty row for addresses with no notes
                const emptyNoteRow = [
                    address.id || '',
                    address.companyName || '',
                    '',
                    'No notes available',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    '0',
                    '0',
                    '0'
                ];
                csvContent += emptyNoteRow.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
            }
        });

        return csvContent;
    };

    // Export format conversion functions (keeping only CSV)
    const convertToCSV = (data) => {
        const headers = ['Company Name', 'Contact Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Postal Code', 'Country', 'Status'];
        const rows = data.map(addr => [
            addr.companyName || '',
            `${addr.firstName || ''} ${addr.lastName || ''}`.trim(),
            addr.email || '',
            addr.phone || '',
            `${addr.street || ''}${addr.street2 ? `, ${addr.street2}` : ''}`,
            addr.city || '',
            addr.state || '',
            addr.postalCode || '',
            addr.country || '',
            addr.status || ''
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    };

    // Create dynamic navigation object based on current state
    const getNavigationObject = () => {
        const currentModalPage = modalNavigation.getCurrentPage();

        return {
            title: currentView === 'table' ? 'Address Book' :
                currentView === 'add' ? 'Add New Address' :
                    currentView === 'edit' ? `Edit ${addresses.find(a => a.id === selectedAddressId)?.companyName || 'Address'}` :
                        currentView === 'detail' ? (currentModalPage?.title || 'Address Details') :
                            'Address Book',
            canGoBack: currentView !== 'table',
            onBack: currentView !== 'table' ? handleBackToTable : (onModalBack || onClose),
            backText: currentView !== 'table' ? 'Address Book' : 'Back'
        };
    };

    // Handle back button click from modal header
    const handleBackClick = () => {
        if (currentView !== 'table') {
            handleBackToTable();
        } else if (onModalBack) {
            onModalBack();
        } else if (onClose) {
            onClose();
        }
    };

    // Handle close button click specifically
    const handleCloseClick = () => {
        if (onClose) {
            onClose();
        }
    };

    // Render loading state
    if (loading && addresses.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    // Render modal view
    if (isModal) {
        return (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <ModalHeader
                    navigation={getNavigationObject()}
                    onBack={handleBackClick}
                    showBackButton={true}
                    onClose={showCloseButton ? handleCloseClick : null}
                    showCloseButton={showCloseButton}
                />
                <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                    <Box sx={{
                        width: '100%',
                        height: '100%',
                        position: 'absolute',
                        transform: `translateX(${isSliding ? (currentView === 'table' ? '100%' : '-100%') : '0'})`,
                        transition: 'transform 0.3s ease-in-out',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {currentView === 'table' && (
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                                {/* Toolbar */}
                                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f8fafc' }}>
                                    <Grid container spacing={2} alignItems="center">
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                placeholder="Search addresses..."
                                                value={globalSearchQuery}
                                                onChange={handleGlobalSearchChange}
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <SearchIcon sx={{ color: '#6b7280' }} />
                                                        </InputAdornment>
                                                    ),
                                                    endAdornment: globalSearchQuery && (
                                                        <InputAdornment position="end">
                                                            <IconButton
                                                                size="small"
                                                                onClick={clearAllFilters}
                                                                edge="end"
                                                            >
                                                                <ClearIcon />
                                                            </IconButton>
                                                        </InputAdornment>
                                                    )
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<FilterIcon />}
                                                    onClick={() => setFiltersOpen(!filtersOpen)}
                                                    size="small"
                                                >
                                                    Filters
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<ExportIcon />}
                                                    onClick={handleExport}
                                                    disabled={filteredAddresses.length === 0}
                                                    size="small"
                                                >
                                                    Export
                                                </Button>
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<UploadIcon />}
                                                    onClick={handleImportOpen}
                                                    size="small"
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    Import
                                                </Button>
                                                <Button
                                                    variant="contained"
                                                    startIcon={<AddIcon />}
                                                    onClick={handleAddAddress}
                                                    size="small"
                                                >
                                                    New
                                                </Button>
                                            </Stack>
                                        </Grid>
                                    </Grid>



                                    {/* Enhanced Advanced Filters - ShipmentsX Style */}
                                    <Collapse in={filtersOpen}>
                                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            <Grid container spacing={2} alignItems="center">
                                                {/* Company Name Search */}
                                                <Grid item xs={12} sm={6} md={4} lg={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Company Name"
                                                        placeholder="Search by company"
                                                        value={searchFields.companyName}
                                                        onChange={(e) => handleSearchFieldChange('companyName', e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <BusinessIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: searchFields.companyName && (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleSearchFieldChange('companyName', '')}
                                                                    >
                                                                        <ClearIcon sx={{ fontSize: '14px' }} />
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                    />
                                                </Grid>

                                                {/* Contact Name Search */}
                                                <Grid item xs={12} sm={6} md={4} lg={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Contact Name"
                                                        placeholder="Search by contact"
                                                        value={searchFields.contactName}
                                                        onChange={(e) => handleSearchFieldChange('contactName', e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <PersonIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: searchFields.contactName && (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleSearchFieldChange('contactName', '')}
                                                                    >
                                                                        <ClearIcon sx={{ fontSize: '14px' }} />
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                    />
                                                </Grid>

                                                {/* Email Search */}
                                                <Grid item xs={12} sm={6} md={4} lg={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="Email"
                                                        placeholder="Search by email"
                                                        value={searchFields.email}
                                                        onChange={(e) => handleSearchFieldChange('email', e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <EmailIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: searchFields.email && (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleSearchFieldChange('email', '')}
                                                                    >
                                                                        <ClearIcon sx={{ fontSize: '14px' }} />
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                    />
                                                </Grid>

                                            </Grid>

                                            {/* Second Row - Address Fields and Filters */}
                                            <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                                                {/* Street Address Search */}
                                                <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                                    <TextField
                                                        fullWidth
                                                        label="Street Address"
                                                        placeholder="Search by street"
                                                        value={searchFields.street}
                                                        onChange={(e) => handleSearchFieldChange('street', e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <LocationIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: searchFields.street && (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleSearchFieldChange('street', '')}
                                                                    >
                                                                        <ClearIcon sx={{ fontSize: '14px' }} />
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                    />
                                                </Grid>

                                                {/* City Search */}
                                                <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                                    <TextField
                                                        fullWidth
                                                        label="City"
                                                        placeholder="Search by city"
                                                        value={searchFields.city}
                                                        onChange={(e) => handleSearchFieldChange('city', e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: searchFields.city && (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleSearchFieldChange('city', '')}
                                                                    >
                                                                        <ClearIcon sx={{ fontSize: '14px' }} />
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                    />
                                                </Grid>

                                                {/* State Search */}
                                                <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                                    <TextField
                                                        fullWidth
                                                        label="State/Province"
                                                        placeholder="Search by state"
                                                        value={searchFields.state}
                                                        onChange={(e) => handleSearchFieldChange('state', e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: searchFields.state && (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleSearchFieldChange('state', '')}
                                                                    >
                                                                        <ClearIcon sx={{ fontSize: '14px' }} />
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                    />
                                                </Grid>

                                                {/* Postal Code Search */}
                                                <Grid item xs={12} sm={6} md={1.5} lg={2.4}>
                                                    <TextField
                                                        fullWidth
                                                        label="Postal Code"
                                                        placeholder="Search by postal code"
                                                        value={searchFields.postalCode}
                                                        onChange={(e) => handleSearchFieldChange('postalCode', e.target.value)}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: searchFields.postalCode && (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleSearchFieldChange('postalCode', '')}
                                                                    >
                                                                        <ClearIcon sx={{ fontSize: '14px' }} />
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            )
                                                        }}
                                                    />
                                                </Grid>

                                                {/* Country Filter */}
                                                <Grid item xs={12} sm={6} md={1.5} lg={2.4}>
                                                    <FormControl fullWidth size="small">
                                                        <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                                        <Select
                                                            value={filters.country}
                                                            onChange={(e) => handleFilterChange('country', e.target.value)}
                                                            label="Country"
                                                            sx={{
                                                                '& .MuiSelect-select': { fontSize: '12px' },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                                            }}
                                                        >
                                                            <MenuItem value="all" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                                                            {availableCountries.map((country) => (
                                                                <MenuItem key={country} value={country} sx={{ fontSize: '12px' }}>
                                                                    {country === 'US' ? 'United States' :
                                                                        country === 'CA' ? 'Canada' : country}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                </Grid>

                                                {/* Clear Filters Button */}
                                                {hasActiveFilters && (
                                                    <Grid item xs={12} sm={12} md={12} lg={12} sx={{ mt: 1 }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                            <Button
                                                                variant="outlined"
                                                                onClick={clearAllFilters}
                                                                startIcon={<ClearIcon />}
                                                                sx={{
                                                                    borderColor: '#e2e8f0',
                                                                    color: '#64748b',
                                                                    fontSize: '12px',
                                                                    '&:hover': {
                                                                        borderColor: '#cbd5e1',
                                                                        bgcolor: '#f8fafc'
                                                                    }
                                                                }}
                                                            >
                                                                Clear All
                                                            </Button>
                                                        </Box>
                                                    </Grid>
                                                )}
                                            </Grid>

                                            {/* Active Filters Display */}
                                            {hasActiveFilters && (
                                                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: '#64748b', mr: 1, display: 'flex', alignItems: 'center' }}>
                                                        <FilterAltIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                                        Active Filters:
                                                    </Typography>
                                                    {globalSearchQuery && (
                                                        <Chip
                                                            label={`Global search: ${globalSearchQuery}`}
                                                            onDelete={() => setGlobalSearchQuery('')}
                                                            size="small"
                                                            sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                                        />
                                                    )}
                                                    {Object.entries(searchFields).map(([key, value]) => value && (
                                                        <Chip
                                                            key={key}
                                                            label={`${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}`}
                                                            onDelete={() => handleSearchFieldChange(key, '')}
                                                            size="small"
                                                            sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                                        />
                                                    ))}
                                                    {Object.entries(filters).map(([key, value]) => value !== 'all' && (
                                                        <Chip
                                                            key={key}
                                                            label={`${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${key === 'country' && value === 'US' ? 'United States' :
                                                                key === 'country' && value === 'CA' ? 'Canada' :
                                                                    value
                                                                }`}
                                                            onDelete={() => handleFilterChange(key, 'all')}
                                                            size="small"
                                                            sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                                        />
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>
                                    </Collapse>
                                </Box>

                                {/* Table */}
                                <Box sx={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}>
                                    <Box sx={{ width: '100%', px: 2 }}>
                                        <Table stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell padding="checkbox" sx={{ width: 48, maxWidth: 48, minWidth: 48 }}>
                                                        <Checkbox
                                                            checked={selectedAddresses.size === filteredAddresses.length && filteredAddresses.length > 0}
                                                            indeterminate={selectedAddresses.size > 0 && selectedAddresses.size < filteredAddresses.length}
                                                            onChange={handleSelectAll}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Company</TableCell>
                                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Contact</TableCell>
                                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Email</TableCell>
                                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Phone</TableCell>
                                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Address</TableCell>
                                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Type</TableCell>
                                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                                    <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {paginatedAddresses.length === 0 && filteredAddresses.length === 0 && hasActiveFilters ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                                                <SearchOffIcon sx={{ fontSize: 48, color: '#9ca3af' }} />
                                                                <Typography variant="h6" sx={{ color: '#6b7280' }}>
                                                                    No addresses found
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                                                    Try adjusting your search criteria
                                                                </Typography>
                                                                <Button
                                                                    variant="outlined"
                                                                    onClick={clearAllFilters}
                                                                    size="small"
                                                                    sx={{ mt: 1 }}
                                                                >
                                                                    Clear Filters
                                                                </Button>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : paginatedAddresses.length === 0 && filteredAddresses.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                                                <BusinessIcon sx={{ fontSize: 48, color: '#9ca3af' }} />
                                                                <Typography variant="h6" sx={{ color: '#6b7280' }}>
                                                                    No addresses yet
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                                                    Add your first address to get started
                                                                </Typography>
                                                                <Button
                                                                    variant="contained"
                                                                    onClick={handleAddAddress}
                                                                    size="small"
                                                                    sx={{ mt: 1 }}
                                                                >
                                                                    Add Address
                                                                </Button>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    paginatedAddresses.map((address) => (
                                                        <TableRow
                                                            key={address.id}
                                                            hover
                                                            selected={isSelected(address.id)}
                                                        >
                                                            <TableCell padding="checkbox" sx={{ width: 48, maxWidth: 48, minWidth: 48 }}>
                                                                <Checkbox
                                                                    checked={isSelected(address.id)}
                                                                    onChange={(e) => handleSelectAddress(address.id, e)}
                                                                    size="small"
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        fontSize: '12px',
                                                                        fontWeight: 500,
                                                                        color: '#1976d2',
                                                                        cursor: 'pointer',
                                                                        textDecoration: 'underline',
                                                                        '&:hover': {
                                                                            color: '#1565c0'
                                                                        }
                                                                    }}
                                                                    onClick={() => handleViewAddress(address.id)}
                                                                >
                                                                    {address.companyName || 'N/A'}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                    {`${address.firstName || ''} ${address.lastName || ''}`.trim() || 'N/A'}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px', maxWidth: '200px' }}>
                                                                {(() => {
                                                                    if (!address.email || address.email === 'N/A') {
                                                                        return (
                                                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                                                N/A
                                                                            </Typography>
                                                                        );
                                                                    }

                                                                    // Check if there are multiple emails (semicolon separated)
                                                                    if (address.email.includes(';')) {
                                                                        const emails = address.email.split(';').map(email => email.trim()).filter(email => email);
                                                                        return (
                                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: '200px' }}>
                                                                                {emails.map((email, index) => (
                                                                                    <Chip
                                                                                        key={index}
                                                                                        label={email}
                                                                                        size="small"
                                                                                        sx={{
                                                                                            fontSize: '10px',
                                                                                            height: '20px',
                                                                                            bgcolor: '#f0f9ff',
                                                                                            color: '#0369a1',
                                                                                            '& .MuiChip-label': { px: 1 }
                                                                                        }}
                                                                                    />
                                                                                ))}
                                                                            </Box>
                                                                        );
                                                                    }

                                                                    // Single email - handle long emails with word breaking
                                                                    return (
                                                                        <Typography
                                                                            variant="body2"
                                                                            sx={{
                                                                                fontSize: '12px',
                                                                                wordBreak: 'break-all',
                                                                                maxWidth: '200px'
                                                                            }}
                                                                        >
                                                                            {address.email}
                                                                        </Typography>
                                                                    );
                                                                })()}
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                    {address.phone || 'N/A'}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                    {`${address.street || ''}${address.street2 ? `, ${address.street2}` : ''}`}
                                                                    <br />
                                                                    {`${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Chip
                                                                    label={address.isResidential ? 'Residential' : 'Commercial'}
                                                                    size="small"
                                                                    color={address.isResidential ? 'warning' : 'primary'}
                                                                    variant="outlined"
                                                                    sx={{ fontSize: '11px' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontSize: '12px' }}>
                                                                <Chip
                                                                    label={address.status || 'active'}
                                                                    size="small"
                                                                    color={address.status === 'active' ? 'success' : 'default'}
                                                                    sx={{ fontSize: '11px' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => handleActionMenuOpen(e, address)}
                                                                >
                                                                    <MoreVertIcon sx={{ fontSize: '16px' }} />
                                                                </IconButton>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </Box>
                                </Box>

                                {/* Pagination */}
                                <Box sx={{ flexShrink: 0, borderTop: '1px solid #e0e0e0', bgcolor: '#fafafa', mt: 2, mx: 2 }}>
                                    <ShipmentsPagination
                                        totalItems={filteredAddresses.length}
                                        itemsPerPage={rowsPerPage}
                                        currentPage={page}
                                        onPageChange={(newPage) => setPage(newPage)}
                                        onItemsPerPageChange={(newRowsPerPage) => {
                                            setRowsPerPage(newRowsPerPage);
                                            setPage(0);
                                        }}
                                        itemName="addresses"
                                    />
                                </Box>
                            </Box>
                        )}
                        {currentView === 'add' && (
                            <AddressForm
                                onCancel={handleBackToTable}
                                onSuccess={handleAddressCreated}
                                isModal={isModal}
                            />
                        )}
                        {currentView === 'edit' && selectedAddressId && (
                            <AddressForm
                                addressId={selectedAddressId}
                                onCancel={handleBackToTable}
                                onSuccess={handleAddressUpdated}
                                isModal={isModal}
                            />
                        )}
                        {currentView === 'detail' && selectedAddressId && (
                            <AddressDetail
                                addressId={selectedAddressId}
                                onEdit={() => handleEditAddress(selectedAddressId)}
                                onBack={handleBackToTable}
                                onDelete={() => {
                                    const address = addresses.find(a => a.id === selectedAddressId);
                                    if (address) {
                                        setAddressToDelete(address);
                                        setDeleteConfirmOpen(true);
                                    }
                                }}
                                isModal={isModal}
                            />
                        )}
                    </Box>

                    {/* Action Menu */}
                    <Menu
                        anchorEl={actionMenuAnchor}
                        open={Boolean(actionMenuAnchor)}
                        onClose={handleActionMenuClose}
                    >
                        <MenuItem onClick={() => {
                            if (selectedAddress) {
                                handleViewAddress(selectedAddress.id);
                                handleActionMenuClose();
                            }
                        }}>
                            <VisibilityIcon sx={{ mr: 1, fontSize: '16px' }} />
                            View Details
                        </MenuItem>
                        <MenuItem onClick={() => {
                            if (selectedAddress) {
                                handleEditAddress(selectedAddress.id);
                                handleActionMenuClose();
                            }
                        }}>
                            <EditIcon sx={{ mr: 1, fontSize: '16px' }} />
                            Edit
                        </MenuItem>
                        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
                            <DeleteIcon sx={{ mr: 1, fontSize: '16px' }} />
                            Delete
                        </MenuItem>
                    </Menu>

                    {/* Delete Confirmation Dialog */}
                    <Dialog
                        open={deleteConfirmOpen}
                        onClose={handleDeleteCancel}
                        maxWidth="sm"
                        fullWidth
                    >
                        <DialogTitle>Delete Address</DialogTitle>
                        <DialogContent>
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                This action cannot be undone. The address will be permanently deleted.
                            </Alert>
                            <Typography sx={{ mt: 2 }}>
                                Are you sure you want to delete this address?
                            </Typography>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleDeleteCancel}>Cancel</Button>
                            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                                Delete
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Export Dialog */}
                    <Dialog
                        open={isExportDialogOpen}
                        onClose={handleExportClose}
                        maxWidth="sm"
                        fullWidth
                    >
                        <DialogTitle>Export Addresses</DialogTitle>
                        <DialogContent>
                            <Typography sx={{ mb: 2 }}>
                                Export {selectedAddresses.size > 0 ? `${selectedAddresses.size} selected` : 'all'} addresses with their notes to CSV format.
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2, color: '#6b7280' }}>
                                The export will include two sections:
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1, color: '#374151' }}>
                                • <strong>Customer Records:</strong> Complete address information, contact details, and settings
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 2, color: '#374151' }}>
                                • <strong>Customer Notes:</strong> All notes, comments, and collaboration data
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        onClick={() => setSelectedExportFormat('csv')}
                                        sx={{ justifyContent: 'flex-start', mb: 1 }}
                                    >
                                        CSV Format with Notes
                                    </Button>
                                </Grid>
                            </Grid>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleExportClose}>Cancel</Button>
                            <Button
                                onClick={handleExportConfirm}
                                variant="contained"
                                disabled={isExporting}
                            >
                                {isExporting ? 'Exporting...' : 'Export'}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Import Dialog */}
                    {isImportDialogOpen && (
                        <Suspense fallback={<CircularProgress />}>
                            <AddressImport
                                onClose={handleImportClose}
                                onImportComplete={handleImportComplete}
                            />
                        </Suspense>
                    )}
                </Box>
            </Box>
        );
    }

    // Render non-modal view
    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: '#f8fafc' }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="Search addresses..."
                            value={globalSearchQuery}
                            onChange={handleGlobalSearchChange}
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ color: '#6b7280' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: globalSearchQuery && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={clearAllFilters}
                                            edge="end"
                                        >
                                            <ClearIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Button
                                variant="outlined"
                                startIcon={<FilterIcon />}
                                onClick={() => setFiltersOpen(!filtersOpen)}
                                size="small"
                            >
                                Filters
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<ExportIcon />}
                                onClick={handleExport}
                                disabled={filteredAddresses.length === 0}
                                size="small"
                            >
                                Export
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<UploadIcon />}
                                onClick={handleImportOpen}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Import
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleAddAddress}
                                size="small"
                            >
                                New
                            </Button>
                        </Stack>
                    </Grid>
                </Grid>

                {/* Enhanced Advanced Filters - ShipmentsX Style */}
                <Collapse in={filtersOpen}>
                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <Grid container spacing={2} alignItems="center">
                            {/* Company Name Search */}
                            <Grid item xs={12} sm={6} md={4} lg={3}>
                                <TextField
                                    fullWidth
                                    label="Company Name"
                                    placeholder="Search by company"
                                    value={searchFields.companyName}
                                    onChange={(e) => handleSearchFieldChange('companyName', e.target.value)}
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <BusinessIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: searchFields.companyName && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleSearchFieldChange('companyName', '')}
                                                >
                                                    <ClearIcon sx={{ fontSize: '14px' }} />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* Contact Name Search */}
                            <Grid item xs={12} sm={6} md={4} lg={3}>
                                <TextField
                                    fullWidth
                                    label="Contact Name"
                                    placeholder="Search by contact"
                                    value={searchFields.contactName}
                                    onChange={(e) => handleSearchFieldChange('contactName', e.target.value)}
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <PersonIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: searchFields.contactName && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleSearchFieldChange('contactName', '')}
                                                >
                                                    <ClearIcon sx={{ fontSize: '14px' }} />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* Email Search */}
                            <Grid item xs={12} sm={6} md={4} lg={3}>
                                <TextField
                                    fullWidth
                                    label="Email"
                                    placeholder="Search by email"
                                    value={searchFields.email}
                                    onChange={(e) => handleSearchFieldChange('email', e.target.value)}
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: searchFields.email && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleSearchFieldChange('email', '')}
                                                >
                                                    <ClearIcon sx={{ fontSize: '14px' }} />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                        </Grid>

                        {/* Second Row - Address Fields and Filters */}
                        <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                            {/* Street Address Search */}
                            <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                <TextField
                                    fullWidth
                                    label="Street Address"
                                    placeholder="Search by street"
                                    value={searchFields.street}
                                    onChange={(e) => handleSearchFieldChange('street', e.target.value)}
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LocationIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: searchFields.street && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleSearchFieldChange('street', '')}
                                                >
                                                    <ClearIcon sx={{ fontSize: '14px' }} />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* City Search */}
                            <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                <TextField
                                    fullWidth
                                    label="City"
                                    placeholder="Search by city"
                                    value={searchFields.city}
                                    onChange={(e) => handleSearchFieldChange('city', e.target.value)}
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: searchFields.city && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleSearchFieldChange('city', '')}
                                                >
                                                    <ClearIcon sx={{ fontSize: '14px' }} />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* State Search */}
                            <Grid item xs={12} sm={6} md={3} lg={2.4}>
                                <TextField
                                    fullWidth
                                    label="State/Province"
                                    placeholder="Search by state"
                                    value={searchFields.state}
                                    onChange={(e) => handleSearchFieldChange('state', e.target.value)}
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: searchFields.state && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleSearchFieldChange('state', '')}
                                                >
                                                    <ClearIcon sx={{ fontSize: '14px' }} />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* Postal Code Search */}
                            <Grid item xs={12} sm={6} md={1.5} lg={2.4}>
                                <TextField
                                    fullWidth
                                    label="Postal Code"
                                    placeholder="Search by postal code"
                                    value={searchFields.postalCode}
                                    onChange={(e) => handleSearchFieldChange('postalCode', e.target.value)}
                                    size="small"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: searchFields.postalCode && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleSearchFieldChange('postalCode', '')}
                                                >
                                                    <ClearIcon sx={{ fontSize: '14px' }} />
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Grid>

                            {/* Country Filter */}
                            <Grid item xs={12} sm={6} md={1.5} lg={2.4}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                    <Select
                                        value={filters.country}
                                        onChange={(e) => handleFilterChange('country', e.target.value)}
                                        label="Country"
                                        sx={{
                                            '& .MuiSelect-select': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    >
                                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Countries</MenuItem>
                                        {availableCountries.map((country) => (
                                            <MenuItem key={country} value={country} sx={{ fontSize: '12px' }}>
                                                {country === 'US' ? 'United States' :
                                                    country === 'CA' ? 'Canada' : country}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Clear Filters Button */}
                            {hasActiveFilters && (
                                <Grid item xs={12} sm={12} md={12} lg={12} sx={{ mt: 1 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            variant="outlined"
                                            onClick={clearAllFilters}
                                            startIcon={<ClearIcon />}
                                            sx={{
                                                borderColor: '#e2e8f0',
                                                color: '#64748b',
                                                fontSize: '12px',
                                                '&:hover': {
                                                    borderColor: '#cbd5e1',
                                                    bgcolor: '#f8fafc'
                                                }
                                            }}
                                        >
                                            Clear All
                                        </Button>
                                    </Box>
                                </Grid>
                            )}
                        </Grid>

                        {/* Active Filters Display */}
                        {hasActiveFilters && (
                            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="body2" sx={{ color: '#64748b', mr: 1, display: 'flex', alignItems: 'center' }}>
                                    <FilterAltIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                    Active Filters:
                                </Typography>
                                {globalSearchQuery && (
                                    <Chip
                                        label={`Global search: ${globalSearchQuery}`}
                                        onDelete={() => setGlobalSearchQuery('')}
                                        size="small"
                                        sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                    />
                                )}
                                {Object.entries(searchFields).map(([key, value]) => value && (
                                    <Chip
                                        key={key}
                                        label={`${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}`}
                                        onDelete={() => handleSearchFieldChange(key, '')}
                                        size="small"
                                        sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                    />
                                ))}
                                {Object.entries(filters).map(([key, value]) => value !== 'all' && (
                                    <Chip
                                        key={key}
                                        label={`${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${key === 'country' && value === 'US' ? 'United States' :
                                            key === 'country' && value === 'CA' ? 'Canada' :
                                                value
                                            }`}
                                        onDelete={() => handleFilterChange(key, 'all')}
                                        size="small"
                                        sx={{ bgcolor: '#f1f5f9', fontSize: '11px' }}
                                    />
                                ))}
                            </Box>
                        )}
                    </Box>
                </Collapse>
            </Box>

            {/* Table */}
            <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                <Box sx={{ width: '100%', px: 2 }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox" sx={{ width: 48, maxWidth: 48, minWidth: 48 }}>
                                    <Checkbox
                                        checked={selectedAddresses.size === filteredAddresses.length && filteredAddresses.length > 0}
                                        indeterminate={selectedAddresses.size > 0 && selectedAddresses.size < filteredAddresses.length}
                                        onChange={handleSelectAll}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Company</TableCell>
                                <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Contact</TableCell>
                                <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Email</TableCell>
                                <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Phone</TableCell>
                                <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Address</TableCell>
                                <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Type</TableCell>
                                <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                <TableCell sx={{ bgcolor: '#f8fafc', fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedAddresses.length === 0 && filteredAddresses.length === 0 && hasActiveFilters ? (
                                <TableRow>
                                    <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                            <SearchOffIcon sx={{ fontSize: 48, color: '#9ca3af' }} />
                                            <Typography variant="h6" sx={{ color: '#6b7280' }}>
                                                No addresses found
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                                Try adjusting your search criteria
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                onClick={clearAllFilters}
                                                size="small"
                                                sx={{ mt: 1 }}
                                            >
                                                Clear Filters
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedAddresses.length === 0 && filteredAddresses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4 }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                            <BusinessIcon sx={{ fontSize: 48, color: '#9ca3af' }} />
                                            <Typography variant="h6" sx={{ color: '#6b7280' }}>
                                                No addresses yet
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                                Add your first address to get started
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                onClick={handleAddAddress}
                                                size="small"
                                                sx={{ mt: 1 }}
                                            >
                                                Add Address
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedAddresses.map((address) => (
                                    <TableRow
                                        key={address.id}
                                        hover
                                        selected={isSelected(address.id)}
                                    >
                                        <TableCell padding="checkbox" sx={{ width: 48, maxWidth: 48, minWidth: 48 }}>
                                            <Checkbox
                                                checked={isSelected(address.id)}
                                                onChange={(e) => handleSelectAddress(address.id, e)}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    color: '#1976d2',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                    '&:hover': {
                                                        color: '#1565c0'
                                                    }
                                                }}
                                                onClick={() => handleViewAddress(address.id)}
                                            >
                                                {address.companyName || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {`${address.firstName || ''} ${address.lastName || ''}`.trim() || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', maxWidth: '200px' }}>
                                            {(() => {
                                                if (!address.email || address.email === 'N/A') {
                                                    return (
                                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                            N/A
                                                        </Typography>
                                                    );
                                                }

                                                // Check if there are multiple emails (semicolon separated)
                                                if (address.email.includes(';')) {
                                                    const emails = address.email.split(';').map(email => email.trim()).filter(email => email);
                                                    return (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: '200px' }}>
                                                            {emails.map((email, index) => (
                                                                <Chip
                                                                    key={index}
                                                                    label={email}
                                                                    size="small"
                                                                    sx={{
                                                                        fontSize: '10px',
                                                                        height: '20px',
                                                                        bgcolor: '#f0f9ff',
                                                                        color: '#0369a1',
                                                                        '& .MuiChip-label': { px: 1 }
                                                                    }}
                                                                />
                                                            ))}
                                                        </Box>
                                                    );
                                                }

                                                // Single email - handle long emails with word breaking
                                                return (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontSize: '12px',
                                                            wordBreak: 'break-all',
                                                            maxWidth: '200px'
                                                        }}
                                                    >
                                                        {address.email}
                                                    </Typography>
                                                );
                                            })()}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {address.phone || 'N/A'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {`${address.street || ''}${address.street2 ? `, ${address.street2}` : ''}`}
                                                <br />
                                                {`${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}`}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={address.isResidential ? 'Residential' : 'Commercial'}
                                                size="small"
                                                color={address.isResidential ? 'warning' : 'primary'}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Chip
                                                label={address.status || 'active'}
                                                size="small"
                                                color={address.status === 'active' ? 'success' : 'default'}
                                                sx={{ fontSize: '11px' }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleActionMenuOpen(e, address)}
                                            >
                                                <MoreVertIcon sx={{ fontSize: '16px' }} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Box>
            </Box>

            {/* Pagination */}
            <Box sx={{ flexShrink: 0, borderTop: '1px solid #e0e0e0', bgcolor: '#fafafa', mt: 2, mx: 2 }}>
                <ShipmentsPagination
                    totalItems={filteredAddresses.length}
                    itemsPerPage={rowsPerPage}
                    currentPage={page}
                    onPageChange={(newPage) => setPage(newPage)}
                    onItemsPerPageChange={(newRowsPerPage) => {
                        setRowsPerPage(newRowsPerPage);
                        setPage(0);
                    }}
                    itemName="addresses"
                />
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleActionMenuClose}
            >
                <MenuItem onClick={() => {
                    if (selectedAddress) {
                        handleViewAddress(selectedAddress.id);
                        handleActionMenuClose();
                    }
                }}>
                    <VisibilityIcon sx={{ mr: 1, fontSize: '16px' }} />
                    View Details
                </MenuItem>
                <MenuItem onClick={() => {
                    if (selectedAddress) {
                        handleEditAddress(selectedAddress.id);
                        handleActionMenuClose();
                    }
                }}>
                    <EditIcon sx={{ mr: 1, fontSize: '16px' }} />
                    Edit
                </MenuItem>
                <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
                    <DeleteIcon sx={{ mr: 1, fontSize: '16px' }} />
                    Delete
                </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={handleDeleteCancel}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Delete Address</DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        This action cannot be undone. The address will be permanently deleted.
                    </Alert>
                    <Typography sx={{ mt: 2 }}>
                        Are you sure you want to delete this address?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleDeleteCancel}>Cancel</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Import Dialog */}
            {isImportDialogOpen && (
                <Suspense fallback={<CircularProgress />}>
                    <AddressImport
                        onClose={handleImportClose}
                        onImportComplete={handleImportComplete}
                    />
                </Suspense>
            )}

            {/* Export Dialog */}
            <Dialog
                open={isExportDialogOpen}
                onClose={handleExportClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Export Addresses</DialogTitle>
                <DialogContent>
                    <Typography sx={{ mb: 2 }}>
                        Export {selectedAddresses.size > 0 ? `${selectedAddresses.size} selected` : 'all'} addresses with their notes to CSV format.
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#6b7280' }}>
                        The export will include two sections:
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1, color: '#374151' }}>
                        • <strong>Customer Records:</strong> Complete address information, contact details, and settings
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, color: '#374151' }}>
                        • <strong>Customer Notes:</strong> All notes, comments, and collaboration data
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={() => setSelectedExportFormat('csv')}
                                sx={{ justifyContent: 'flex-start', mb: 1 }}
                            >
                                CSV Format with Notes
                            </Button>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleExportClose}>Cancel</Button>
                    <Button
                        onClick={handleExportConfirm}
                        variant="contained"
                        disabled={isExporting}
                    >
                        {isExporting ? 'Exporting...' : 'Export'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AddressBook; 