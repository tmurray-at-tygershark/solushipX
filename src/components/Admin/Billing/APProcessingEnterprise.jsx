import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    TextField,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Alert,
    Autocomplete,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Checkbox,
    Grid,
    Stack,
    Tabs,
    Tab,
    FormControl,
    InputLabel,
    Select,
    Skeleton
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import APProcessingResults from './APProcessingResults';
import {
    CloudUpload as CloudUploadIcon,
    Description as DocumentIcon,
    Close as CloseIcon,
    Visibility as ViewIcon,
    PictureAsPdf as PdfIcon,
    TableChart as TableIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Pending as PendingIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCompleteIcon,
    Schedule as ScheduleIcon,
    Refresh as RefreshIcon,
    GetApp as GetAppIcon,
    Speed as SpeedIcon,
    Security as SecurityIcon,
    SmartToy as AiIcon,
    Settings as SettingsIcon,
    LocalShipping as LocalShippingIcon,
    Assignment as AssignmentIcon,
    Upload as UploadIcon,
    CheckCircle as CheckIcon,
    Add as AddIcon,
    ExpandMore as ExpandMoreIcon,
    Search as SearchIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon,
    Receipt as ReceiptIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    getDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const APProcessingEnterprise = () => {
    const { currentUser } = useAuth();
    const { companyIdForAddress } = useCompany();
    const { enqueueSnackbar } = useSnackbar();
    const functions = getFunctions();

    // Core state
    const [selectedCarrier, setSelectedCarrier] = useState('');
    const [carriers, setCarriers] = useState([]);
    const [loadingCarriers, setLoadingCarriers] = useState(false);
    const [uploads, setUploads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState(0);

    // Enterprise table state
    const [selectedRows, setSelectedRows] = useState([]);
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedUploadForAction, setSelectedUploadForAction] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const [tableData, setTableData] = useState([]);

    // Processing state
    const [processingFiles, setProcessingFiles] = useState([]);
    const [pdfResults, setPdfResults] = useState([]);
    const [showPdfResults, setShowPdfResults] = useState(false);
    const [selectedUpload, setSelectedUpload] = useState(null);
    const [approving, setApproving] = useState(false);

    // Upload modal state
    const [uploadModalOpen, setUploadModalOpen] = useState(false);

    // Search and filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [invoiceDate, setInvoiceDate] = useState(null);
    const [uploadDate, setUploadDate] = useState(null);
    const [filteredTableData, setFilteredTableData] = useState([]);
    const [showDeleteActions, setShowDeleteActions] = useState(false);

    // Load carriers for dropdown
    const loadCarriers = useCallback(async () => {
        try {
            setLoadingCarriers(true);
            const getCarriersFunc = httpsCallable(functions, 'getTrainingCarriers');
            const result = await getCarriersFunc({ status: 'active' });

            if (result.data?.success) {
                const carriers = result.data.data?.carriers || [];
                setCarriers(carriers);
                console.log(`Loaded ${carriers.length} trained carriers for AP Processing`);

                if (carriers.length === 0) {
                    enqueueSnackbar('No training carriers available. Use Invoice Training to add carriers first.', {
                        variant: 'info',
                        autoHideDuration: 5000
                    });
                }
            } else {
                throw new Error(result.data?.error || 'Failed to load carriers');
            }
        } catch (error) {
            console.error('Error loading carriers:', error);
            enqueueSnackbar('Failed to load carriers', { variant: 'error' });
        } finally {
            setLoadingCarriers(false);
        }
    }, [functions, enqueueSnackbar]);

    // Load uploads globally - carrier invoices are not company-specific
    const loadUploads = useCallback(async () => {
        try {
            setLoading(true);
            console.log('🔍 Loading global AP uploads (all companies)');

            const uploadsQuery = query(
                collection(db, 'apUploads'),
                orderBy('uploadDate', 'desc'),
                limit(100)
            );

            const snapshot = await getDocs(uploadsQuery);
            const uploadsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort in memory by upload date
            uploadsData.sort((a, b) => {
                const aDate = a.uploadDate?.toDate ? a.uploadDate.toDate() : new Date(a.uploadDate || 0);
                const bDate = b.uploadDate?.toDate ? b.uploadDate.toDate() : new Date(b.uploadDate || 0);
                return bDate - aDate;
            });

            console.log('✅ Loaded uploads from Firestore:', uploadsData.length, 'documents');
            setUploads(uploadsData);

            // Transform uploads to table data for enterprise view
            const transformedTableData = uploadsData.map(upload => transformUploadToTableRow(upload));
            setTableData(transformedTableData);


        } catch (error) {
            console.error('❌ Error loading uploads:', error);
            enqueueSnackbar(`Failed to load uploads: ${error.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    // Transform upload to enterprise table row format
    const transformUploadToTableRow = useCallback((upload) => {
        console.log('🔍 Transforming upload to table row:', upload);

        // Try multiple paths for extracted data
        const extractedData = upload.extractedData ||
            upload.aiResults?.enhancedResults?.extractedData ||
            upload.aiResults?.extractedData ||
            {};

        console.log('📋 Found extracted data:', extractedData);

        // Check if there's nested extractedData (which seems to be the case)
        const nestedExtractedData = extractedData.extractedData || extractedData.aiResults?.extractedData || {};
        console.log('🔍 NESTED extracted data:', nestedExtractedData);

        // Use the nested data if it has more complete information
        const actualExtractedData = (nestedExtractedData && Object.keys(nestedExtractedData).length > 0)
            ? nestedExtractedData
            : extractedData;

        // Use the selected carrier name (since it's required for upload)
        console.log('🔍 Looking up carrier for upload:', {
            uploadCarrier: upload.carrier,
            uploadCarrierId: upload.carrierId,
            carriersLoaded: carriers.length,
            availableCarrierIds: carriers.map(c => c.id)
        });

        // Ensure carrier name is always a string
        const carrierName = upload.carrier ||
            (upload.carrierId && carriers.find(c => c.id === upload.carrierId)?.name) ||
            (typeof actualExtractedData.carrier === 'string' ? actualExtractedData.carrier : actualExtractedData.carrier?.name) ||
            actualExtractedData.carrierInformation?.company ||
            'Unknown';

        console.log('✅ Resolved carrier name:', carrierName);

        // Get invoice number from multiple sources  
        const invoiceNumber = actualExtractedData.invoice_number ||
            actualExtractedData.invoiceNumber ||
            actualExtractedData.invoiceDetails?.invoiceNumber ||
            'N/A';

        // Count shipments from extracted data
        const shipmentCount = actualExtractedData.shipments?.length ||
            (actualExtractedData.shipment_ids?.length > 0 ? actualExtractedData.shipment_ids.length : 1) ||
            1;

        // Get invoice date from extracted data with extensive fallback paths
        const invoiceDate = extractedData.invoice_date ||
            extractedData.invoiceDate ||
            extractedData.invoiceDetails?.invoiceDate ||
            extractedData.metadata?.documentDate ||
            extractedData.metadata?.issueDate ||
            extractedData.invoiceHeader?.invoiceDate?.value ||
            extractedData.issueDate ||
            extractedData.date ||
            extractedData.documentDate ||
            null;

        // Invoice date extraction completed

        // Get total amount with proper fallback logic
        // Total amount calculation

        const totalAmount = actualExtractedData.invoiceSummary?.totalAmount ||
            actualExtractedData.total ||
            actualExtractedData.totalAmount?.amount ||
            actualExtractedData.totalAmount ||
            // For multi-shipment structure, sum all shipment totals
            (actualExtractedData.shipments && Array.isArray(actualExtractedData.shipments)
                ? actualExtractedData.shipments.reduce((sum, shipment) => sum + (parseFloat(shipment.totalAmount) || 0), 0)
                : 0) ||
            0;

        console.log('✅ FINAL TOTAL for', upload.fileName, ':', totalAmount);

        const result = {
            id: upload.id,
            fileName: upload.fileName,
            carrier: carrierName,
            uploadDate: upload.uploadDate,
            processingStatus: upload.automationStatus || upload.processingStatus || 'pending',
            shipmentCount: shipmentCount,
            invoiceDate: invoiceDate,
            invoiceNumber: invoiceNumber,
            totalAmount: totalAmount,
            currency: extractedData.totalAmount?.currency || 'CAD',
            charges: extractedData.charges || [],
            extractedData,
            rawUpload: upload,
            automationStatus: upload.automationStatus,
            automationProgress: upload.automationProgress,
            matchStatus: upload.matchStatus || 'pending',
            approvalStatus: upload.approvalStatus || 'pending',
            aiResults: upload.aiResults,
            // Include charge applications data for applied charge tracking
            chargeApplications: upload.chargeApplications || [],
            hasAppliedCharges: upload.hasAppliedCharges || false
        };

        console.log('✅ Transformed table row:', result);
        return result;
    }, [carriers]);


    // File upload handling
    const onDrop = useCallback(async (acceptedFiles) => {
        if (!selectedCarrier) {
            enqueueSnackbar('Please select a carrier first', { variant: 'warning' });
            return;
        }

        // Close upload modal when files are dropped
        setUploadModalOpen(false);

        acceptedFiles.forEach(async (file) => {
            console.log('Processing file:', file.name);

            // Create temporary upload record
            // Get carrier name from ID - ensure it's always a string
            const carrierObj = carriers.find(c => c.id === selectedCarrier);
            const carrierName = carrierObj?.name || 'Unknown Carrier';

            // Debug log to ensure we're not passing objects
            console.log('🏷️ Carrier resolution:', {
                selectedCarrier,
                carrierObj: carrierObj ? `{id: ${carrierObj.id}, name: ${carrierObj.name}}` : 'null',
                finalCarrierName: carrierName,
                carrierNameType: typeof carrierName
            });

            const tempUpload = {
                id: `temp-${Date.now()}-${Math.random()}`,
                fileName: file.name,
                type: file.type,
                processingStatus: 'uploading',
                uploadDate: new Date(),
                carrier: carrierName,
                carrierId: selectedCarrier,
                _isTemporary: true
            };

            setUploads(prev => [tempUpload, ...prev]);

            // Update table data immediately to show the upload
            setTableData(prev => [transformUploadToTableRow(tempUpload), ...prev]);


            // Upload file to Firebase Storage first
            let downloadURL = null;
            try {
                console.log('⬆️ Uploading file to Firebase Storage...');

                // Use the same storage configuration as other components
                const { getApp } = await import('firebase/app');
                const { getStorage } = await import('firebase/storage');
                const firebaseApp = getApp();
                const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");

                const fileId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const storageRef = ref(customStorage, `ap-uploads/${fileId}`);

                // Upload the file
                const uploadResult = await uploadBytes(storageRef, file);
                downloadURL = await getDownloadURL(uploadResult.ref);
                console.log('✅ File uploaded to Storage with URL:', downloadURL);
            } catch (storageError) {
                console.error('❌ Error uploading to Storage:', storageError);
                enqueueSnackbar('Warning: File upload to storage failed', { variant: 'warning' });
            }

            // Save to Firestore immediately so it persists even if processing fails
            try {
                // Use the same carrier name we resolved above
                // (don't look it up again to avoid inconsistency)

                const uploadDoc = {
                    fileName: file.name,
                    uploadedByCompany: companyIdForAddress,
                    carrierId: selectedCarrier,
                    carrier: carrierName, // Store the actual carrier name
                    uploadDate: serverTimestamp(),
                    processingStatus: 'uploading',
                    type: 'pdf',
                    downloadURL: downloadURL, // Store the Firebase Storage URL
                    fileUrl: downloadURL, // Also store as fileUrl for compatibility
                    metadata: {
                        uploadMethod: 'direct_base64',
                        uploadedBy: currentUser.email,
                        uploadedByCompany: companyIdForAddress,
                        processingTime: new Date().toISOString(),
                        source: 'ap-processing'
                    },
                    status: 'processing',
                    approvalStatus: 'pending',
                    uploadedAt: serverTimestamp(),
                    lastUpdatedAt: serverTimestamp()
                };

                console.log('💾 Saving global upload to Firestore (uploaded by company:', companyIdForAddress, ')');
                const docRef = await addDoc(collection(db, 'apUploads'), uploadDoc);
                console.log('✅ Upload saved to Firestore immediately with ID:', docRef.id);

                // Update temp record with real Firestore ID and download URL
                setUploads(prev => prev.map(upload =>
                    upload.id === tempUpload.id
                        ? { ...upload, id: docRef.id, _isTemporary: false, downloadURL, fileUrl: downloadURL }
                        : upload
                ));

                // Update table data with real ID and download URL
                setTableData(prev => prev.map(row =>
                    row.id === tempUpload.id
                        ? { ...row, id: docRef.id, _isTemporary: false, downloadURL, fileUrl: downloadURL }
                        : row
                ));

                // Start upload process with real ID
                uploadAndProcessFile(file, docRef.id);

            } catch (error) {
                console.error('❌ Failed to save upload to Firestore:', error);
                enqueueSnackbar('Warning: Upload may not persist if processing fails', { variant: 'warning' });
                uploadAndProcessFile(file, tempUpload.id);
            }
        });
    }, [selectedCarrier, companyIdForAddress, currentUser.email, enqueueSnackbar]);

    // Process file with AI extraction
    const uploadAndProcessFile = async (file, tempId) => {
        try {
            console.log('🚀 Processing file directly (bypass storage):', file.name);
            console.log('🎯 Selected carrier:', selectedCarrier);

            if (!selectedCarrier) {
                throw new Error('No carrier selected. Please select a carrier before uploading.');
            }

            // Immediately update status to processing
            console.log('📊 Updating status to extracting for:', tempId);
            setUploads(prev => prev.map(upload =>
                upload.id === tempId
                    ? { ...upload, processingStatus: 'processing' }
                    : upload
            ));

            setTableData(prev => prev.map(row =>
                row.id === tempId
                    ? { ...row, processingStatus: 'processing' }
                    : row
            ));

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target.result.split(',')[1];
                    console.log('📄 File converted to base64, starting AI extraction...');

                    const fileObj = {
                        name: file.name,
                        uploadId: tempId,
                        base64Data: base64Data,
                        processingMethod: 'direct_base64'
                    };

                    console.log('🤖 Starting AI extraction for:', fileObj.name, 'with ID:', tempId);
                    await runAIExtraction(fileObj);
                    console.log('✅ AI extraction completed for:', fileObj.name);

                } catch (processingError) {
                    console.error('📄 Processing failed:', processingError);
                    setUploads(prev => prev.map(upload =>
                        upload.id === tempId
                            ? { ...upload, processingStatus: 'error', error: processingError.message }
                            : upload
                    ));

                    // Update table data to show error status
                    setTableData(prev => prev.map(row =>
                        row.id === tempId
                            ? { ...row, processingStatus: 'error' }
                            : row
                    ));

                    enqueueSnackbar(`Processing failed: ${processingError.message}`, { variant: 'error' });
                }
            };

            reader.onerror = () => {
                console.error('📄 File reading failed');
                setUploads(prev => prev.map(upload =>
                    upload.id === tempId
                        ? { ...upload, processingStatus: 'error', error: 'Failed to read file' }
                        : upload
                ));

                // Update table data to show error status
                setTableData(prev => prev.map(row =>
                    row.id === tempId
                        ? { ...row, processingStatus: 'error' }
                        : row
                ));


                enqueueSnackbar('Failed to read file', { variant: 'error' });
            };

            console.log('📖 Starting file read for:', file.name);
            reader.readAsDataURL(file);

        } catch (error) {
            console.error('💥 File processing error:', error);
            setUploads(prev => prev.map(upload =>
                upload.id === tempId
                    ? { ...upload, processingStatus: 'error', error: error.message }
                    : upload
            ));

            // Update table data to show error status
            setTableData(prev => prev.map(row =>
                row.id === tempId
                    ? { ...row, processingStatus: 'error' }
                    : row
            ));

            enqueueSnackbar(`Failed to process ${file.name}: ${error.message}`, { variant: 'error' });
        }
    };

    // Run AI extraction
    const runAIExtraction = useCallback(async (file) => {
        try {
            const testCarrierModel = httpsCallable(functions, 'testCarrierModel');

            let base64Data;
            let fileName;

            if (file.base64Data) {
                base64Data = file.base64Data;
                fileName = file.name;
            } else if (file instanceof File) {
                console.log('📄 Converting File object to base64...');
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                base64Data = btoa(String.fromCharCode.apply(null, uint8Array));
                fileName = file.name;
            }

            if (!selectedCarrier || !fileName || !base64Data) {
                throw new Error(`Missing required parameters: carrierId=${!!selectedCarrier}, fileName=${!!fileName}, base64Data=${!!base64Data}`);
            }

            console.log('📤 Calling testCarrierModel with:', {
                carrierId: selectedCarrier,
                fileName: fileName,
                hasBase64Data: !!base64Data,
                base64Length: base64Data?.length || 0
            });

            const result = await testCarrierModel({
                carrierId: selectedCarrier,
                fileName: fileName,
                base64Data: base64Data,
                fileUrl: file.url || file.downloadURL || null,
                testType: 'ap_processing',
                expectedResults: null,
                metadata: {
                    source: 'ap-processing',
                    ui: 'v2',
                    enhancedExtraction: true,
                    includeAllFields: true,
                    processingMethod: file.processingMethod || 'unknown'
                }
            });

            if (result.data?.success) {
                console.log('✅ AI extraction completed:', result.data.testResults);

                const usedCarrierPrompt = result.data.testResults?.metadata?.usedCarrierSpecificPrompt;
                if (usedCarrierPrompt) {
                    console.log('🎯 AP Processing used carrier-specific AI prompt for enhanced extraction');
                    enqueueSnackbar('AI extraction completed with carrier-specific prompt!', { variant: 'success' });
                } else {
                    console.log('📋 AP Processing used generic AI prompt (no carrier-specific prompt available)');
                    enqueueSnackbar('AI extraction completed', { variant: 'success' });
                }

                const extractedData = result.data.testResults?.aiResults?.enhancedResults?.extractedData;
                if (extractedData) {
                    const normalizedData = normalizeAIDataForTable(extractedData, file, result.data.testResults);

                    // Update existing Firestore record
                    const uploadId = file.uploadId || file.id;
                    console.log('🆔 Upload ID for Firestore save:', uploadId, 'Length:', uploadId?.length);
                    if (uploadId && uploadId.length >= 15) {
                        try {
                            const updateData = {
                                processingStatus: 'completed',
                                extractedData: normalizedData,
                                aiResults: result.data.testResults,
                                processedAt: serverTimestamp(),
                                lastUpdatedAt: serverTimestamp()
                            };
                            console.log('💾 Saving extracted data to Firestore:', { uploadId, updateData });
                            console.log('📊 Normalized data being saved:', normalizedData);
                            console.log('🔍 Raw extracted data:', extractedData);
                            await updateDoc(doc(db, 'apUploads', uploadId), updateData);
                            console.log('✅ Updated existing Firestore record successfully:', uploadId);

                            // Verify the data was saved by reading it back
                            const verifyDoc = await getDoc(doc(db, 'apUploads', uploadId));
                            if (verifyDoc.exists()) {
                                const savedData = verifyDoc.data();
                                console.log('🔎 Verification - Data saved to Firestore:', {
                                    processingStatus: savedData.processingStatus,
                                    hasExtractedData: !!savedData.extractedData,
                                    extractedDataKeys: savedData.extractedData ? Object.keys(savedData.extractedData) : [],
                                    hasAiResults: !!savedData.aiResults
                                });
                            }
                        } catch (updateError) {
                            console.error('❌ Failed to update Firestore record:', updateError);
                        }
                    } else {
                        console.warn('⚠️ Skipping Firestore save - invalid uploadId:', uploadId);
                    }

                    // Update uploads state
                    setUploads(prev => {
                        const updated = prev.map(upload =>
                            upload.id === file.uploadId || upload.fileName === file.name
                                ? {
                                    ...upload,
                                    processingStatus: 'completed',
                                    extractedData: normalizedData,
                                    aiResults: result.data.testResults
                                }
                                : upload
                        );

                        // Update table data immediately with the new uploads
                        const newTableData = updated.map(upload => transformUploadToTableRow(upload));
                        setTableData(newTableData);


                        return updated;
                    });

                    // REMOVED: Unreliable setTimeout trigger - now using Firestore trigger
                    // Automation will be triggered automatically by onAPUploadCompleted Firestore trigger
                    // when processingStatus changes to 'completed'

                    if (uploadId && uploadId.length >= 15) {
                        // Set up real-time listener for automation status updates
                        setupAutomationStatusListener(uploadId);

                        // Show immediate visual feedback that automation will start automatically
                        enqueueSnackbar('🤖 Extraction complete - automation will start automatically!', {
                            variant: 'info',
                            autoHideDuration: 3000
                        });
                    }

                    // Don't automatically refresh from database to avoid losing data
                    // setTimeout(() => loadUploads(), 1000);
                }

                return result.data.testResults;
            } else {
                throw new Error(result.data?.error || 'AI extraction failed');
            }
        } catch (error) {
            console.error('❌ AI extraction error:', error);
            enqueueSnackbar(`AI extraction failed: ${error.message}`, { variant: 'error' });

            setUploads(prev => prev.map(upload =>
                upload.id === file.uploadId || upload.fileName === file.name
                    ? { ...upload, processingStatus: 'error', error: error.message }
                    : upload
            ));

            // Update table data to show error status
            setTableData(prev => prev.map(row =>
                row.id === file.uploadId || row.fileName === file.name
                    ? { ...row, processingStatus: 'error' }
                    : row
            ));

        }
    }, [functions, selectedCarrier, enqueueSnackbar, loadUploads]);

    // Normalize AI data for table display
    const normalizeAIDataForTable = useCallback((extractedData, uploadFile, fullAiResults) => {
        console.log('🔄 Normalizing AI data for table:', { extractedData, uploadFile, fullAiResults });

        // Use the selected carrier name (since it's required for upload) - ensure string
        const carrierName = uploadFile.carrier ||
            (selectedCarrier && carriers.find(c => c.id === selectedCarrier)?.name) ||
            (typeof extractedData.carrier === 'string' ? extractedData.carrier : extractedData.carrier?.name) ||
            extractedData.carrierInformation?.company ||
            'Unknown';

        const invoiceNumber = extractedData.invoice_number ||
            extractedData.invoiceNumber ||
            extractedData.invoiceDetails?.invoiceNumber ||
            'N/A';

        // Count shipments from extracted data
        const shipmentCount = extractedData.shipments?.length ||
            (extractedData.shipment_ids?.length > 0 ? extractedData.shipment_ids.length : 1) ||
            1;

        // Get invoice date from extracted data with extensive fallback paths
        const invoiceDate = extractedData.invoice_date ||
            extractedData.invoiceDate ||
            extractedData.invoiceDetails?.invoiceDate ||
            extractedData.metadata?.documentDate ||
            extractedData.metadata?.issueDate ||
            extractedData.invoiceHeader?.invoiceDate?.value ||
            extractedData.issueDate ||
            extractedData.date ||
            extractedData.documentDate ||
            null;

        // Debug logging for normalizeAIDataForTable
        console.log('📄 normalizeAIDataForTable invoice date debug:', {
            fileName: uploadFile.name,
            available_fields: extractedData ? Object.keys(extractedData) : 'no extracted data',
            invoice_date_value: invoiceDate,
            shipmentCount: shipmentCount
        });

        const totalAmount = extractedData.total ||
            extractedData.totalAmount?.amount ||
            extractedData.totalAmount ||
            0;

        const normalized = {
            fileName: uploadFile.name,
            uploadDate: new Date(),
            carrier: carrierName,
            invoiceNumber: invoiceNumber,
            shipmentCount: shipmentCount,
            invoiceDate: invoiceDate,
            totalAmount: totalAmount,
            currency: extractedData.totalAmount?.currency || 'CAD',
            charges: extractedData.charges || [],
            extractedData,
            aiResults: fullAiResults
        };

        console.log('✅ Normalized AI data:', normalized);
        return normalized;
    }, [carriers, selectedCarrier]);

    // Table row selection
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            setSelectedRows(filteredTableData.map(row => row.id));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedRows(prev => {
            const newSelection = prev.includes(id)
                ? prev.filter(rowId => rowId !== id)
                : [...prev, id];

            setShowDeleteActions(newSelection.length > 0);
            return newSelection;
        });
    };

    // Action menu handlers
    const handleActionMenuOpen = (event, upload) => {
        setActionMenuAnchor(event.currentTarget);
        setSelectedUploadForAction(upload);
    };

    const handleActionMenuClose = () => {
        setActionMenuAnchor(null);
        setSelectedUploadForAction(null);
    };

    const handleMenuViewResults = async () => {
        if (selectedUploadForAction) {
            await handleFileNameClick(selectedUploadForAction);
        }
        handleActionMenuClose();
    };

    const handleMenuDeleteUpload = async () => {
        if (selectedUploadForAction) {
            try {
                await deleteDoc(doc(db, 'apUploads', selectedUploadForAction.id));

                // Update local state immediately
                setUploads(prev => prev.filter(upload => upload.id !== selectedUploadForAction.id));
                setTableData(prev => prev.filter(row => row.id !== selectedUploadForAction.id));

                enqueueSnackbar('Upload deleted successfully', { variant: 'success' });
            } catch (error) {
                console.error('Error deleting upload:', error);
                enqueueSnackbar('Failed to delete upload', { variant: 'error' });
            }
        }
        handleActionMenuClose();
    };

    // Handle file name click to view results
    // Handle file name click to view results with enhanced data fetching
    const handleFileNameClick = async (upload) => {
        // Allow viewing results for any completion status
        const completionStatuses = ['completed', 'processed', 'partially_processed'];
        if (completionStatuses.includes(upload.processingStatus)) {
            try {
                console.log('🔍 Loading detailed results for upload:', upload.id);

                // Try to fetch detailed results from pdfResults collection
                let enhancedUpload = { ...upload };

                try {
                    const pdfResultDoc = await getDoc(doc(db, 'pdfResults', upload.id));
                    if (pdfResultDoc.exists()) {
                        const pdfResultData = pdfResultDoc.data();
                        console.log('📋 Found detailed PDF results:', pdfResultData);

                        // Enhance upload with detailed results
                        enhancedUpload = {
                            ...upload,
                            extractedData: pdfResultData.extractedData || pdfResultData.structuredData || pdfResultData,
                            matchingResults: pdfResultData.matchingResults,
                            shipments: pdfResultData.shipments || pdfResultData.extractedData?.shipments || [],
                            aiResults: {
                                ...upload.aiResults,
                                enhancedResults: pdfResultData
                            }
                        };
                    }
                } catch (pdfError) {
                    console.log('ℹ️ No detailed PDF results found, using upload data:', pdfError.message);
                }

                // Also try to get any AP processing results
                try {
                    const apResultQuery = query(
                        collection(db, 'apProcessingResults'),
                        where('uploadId', '==', upload.id),
                        limit(1)
                    );
                    const apResultSnapshot = await getDocs(apResultQuery);

                    if (!apResultSnapshot.empty) {
                        const apResultData = apResultSnapshot.docs[0].data();
                        console.log('📋 Found AP processing results:', apResultData);

                        enhancedUpload = {
                            ...enhancedUpload,
                            apResults: apResultData,
                            matchingResults: apResultData.matchingResults || enhancedUpload.matchingResults
                        };
                    }
                } catch (apError) {
                    console.log('ℹ️ No AP processing results found:', apError.message);
                }

                // Ensure charge applications data is preserved from the original upload
                enhancedUpload = {
                    ...enhancedUpload,
                    chargeApplications: upload.chargeApplications || upload.rawUpload?.chargeApplications || [],
                    hasAppliedCharges: upload.hasAppliedCharges || upload.rawUpload?.hasAppliedCharges || false
                };

                console.log('✅ Final enhanced upload data:', enhancedUpload);
                console.log('🔍 Charge applications in enhanced data:', enhancedUpload.chargeApplications);
                setSelectedUpload(enhancedUpload);
                setShowPdfResults(true);

            } catch (error) {
                console.error('❌ Error loading detailed results:', error);
                enqueueSnackbar('Error loading detailed results', { variant: 'error' });
            }
        } else {
            enqueueSnackbar('No results available for this upload', { variant: 'info' });
        }
    };

    // Search and filter functionality
    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };


    const clearSearch = () => {
        setSearchTerm('');
    };

    const clearDateFilters = () => {
        setInvoiceDate(null);
        setUploadDate(null);
    };

    const clearAllFilters = () => {
        setSearchTerm('');
        clearDateFilters();
    };

    // Filter table data based on search term and date filters
    const filterTableData = useCallback(() => {
        let filtered = tableData;

        // Apply keyword search (searches across all relevant fields)
        if (searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(row => {
                return (
                    row.fileName?.toLowerCase().includes(searchLower) ||
                    row.invoiceNumber?.toLowerCase().includes(searchLower) ||
                    row.carrier?.toLowerCase().includes(searchLower) ||
                    formatDate(row.uploadDate)?.toLowerCase().includes(searchLower) ||
                    formatDate(row.invoiceDate)?.toLowerCase().includes(searchLower)
                );
            });
        }

        // Apply invoice date filter (exact date match)
        if (invoiceDate) {
            filtered = filtered.filter(row => {
                if (!row.invoiceDate) return false;

                const rowInvoiceDate = dayjs(row.invoiceDate);
                if (!rowInvoiceDate.isValid()) return false;

                return rowInvoiceDate.isSame(dayjs(invoiceDate), 'day');
            });
        }

        // Apply upload date filter (exact date match)
        if (uploadDate) {
            filtered = filtered.filter(row => {
                if (!row.uploadDate) return false;

                const rowUploadDate = dayjs(row.uploadDate);
                if (!rowUploadDate.isValid()) return false;

                return rowUploadDate.isSame(dayjs(uploadDate), 'day');
            });
        }

        setFilteredTableData(filtered);
    }, [tableData, searchTerm, invoiceDate, uploadDate]);

    // Bulk delete functionality
    const handleBulkDelete = async () => {
        if (selectedRows.length === 0) return;

        try {
            setIsExporting(true);

            // Delete from Firestore
            const deletePromises = selectedRows.map(async (id) => {
                try {
                    await deleteDoc(doc(db, 'apUploads', id));
                    console.log(`Deleted upload: ${id}`);
                } catch (error) {
                    console.error(`Failed to delete upload ${id}:`, error);
                    throw error;
                }
            });

            await Promise.all(deletePromises);

            // Update local state
            setUploads(prev => prev.filter(upload => !selectedRows.includes(upload.id)));
            setTableData(prev => prev.filter(row => !selectedRows.includes(row.id)));
            setSelectedRows([]);
            setShowDeleteActions(false);

            enqueueSnackbar(`Successfully deleted ${selectedRows.length} upload(s)`, { variant: 'success' });
        } catch (error) {
            console.error('Bulk delete error:', error);
            enqueueSnackbar(`Failed to delete uploads: ${error.message}`, { variant: 'error' });
        } finally {
            setIsExporting(false);
        }
    };

    // Enhanced status chip renderer with comprehensive AP Processing status flow
    const getStatusChip = (status, upload) => {
        // Check for real-time automation progress
        const automationStatus = upload?.automationStatus;
        const automationProgress = upload?.automationProgress;

        // CRITICAL: Always prioritize automation status when it exists and is not 'pending'
        const actualStatus = (automationStatus && automationStatus !== 'pending')
            ? automationStatus
            : determineUploadStatus(upload || { processingStatus: status });

        const statusConfig = {
            uploading: {
                color: 'info',
                label: 'Uploading',
                icon: <CloudUploadIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#e3f2fd',
                textColor: '#1976d2'
            },
            extracting: {
                color: 'warning',
                label: 'Extracting',
                icon: <PendingIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#fff3e0',
                textColor: '#f57c00'
            },
            extracting_charges: {
                color: 'info',
                label: 'Analyzing Charges',
                icon: <AiIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#f3e8ff',
                textColor: '#8b5cf6'
            },
            matching_shipments: {
                color: 'info',
                label: 'Matching Shipments',
                icon: <LocalShippingIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#ecfeff',
                textColor: '#06b6d4'
            },
            matching_charges: {
                color: 'warning',
                label: 'Matching Charges',
                icon: <AssignmentIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#f7fee7',
                textColor: '#84cc16'
            },
            approving_charges: {
                color: 'success',
                label: 'Applying Charges',
                icon: <CheckIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#f0fdf4',
                textColor: '#22c55e'
            },
            automation_pending: {
                color: 'info',
                label: 'Starting Automation...',
                icon: <PendingIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#e3f2fd',
                textColor: '#1976d2'
            },
            ready_to_process: {
                color: 'primary',
                label: 'Ready to Process',
                icon: <CheckCompleteIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#e8f5e8',
                textColor: '#2e7d32'
            },
            extraction_failed: {
                color: 'error',
                label: 'Extraction Failed',
                icon: <ErrorIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#ffebee',
                textColor: '#d32f2f'
            },
            invalid_document: {
                color: 'warning',
                label: 'Invalid Document',
                icon: <WarningIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#fff3e0',
                textColor: '#f57c00'
            },
            partially_processed: {
                color: 'warning',
                label: 'Partially Processed',
                icon: <ScheduleIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#fff8e1',
                textColor: '#f9a825'
            },
            processed: {
                color: 'success',
                label: 'Processed',
                icon: <CheckCompleteIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#e8f5e8',
                textColor: '#2e7d32'
            },
            // Legacy fallbacks
            completed: {
                color: 'primary',
                label: 'Ready to Process',
                icon: <CheckCompleteIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#e8f5e8',
                textColor: '#2e7d32'
            },
            processing: {
                color: 'warning',
                label: 'Extracting',
                icon: <PendingIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#fff3e0',
                textColor: '#f57c00'
            },
            error: {
                color: 'error',
                label: 'Extraction Failed',
                icon: <ErrorIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#ffebee',
                textColor: '#d32f2f'
            },
            pending: {
                color: 'default',
                label: 'Pending',
                icon: <ScheduleIcon sx={{ fontSize: '12px' }} />,
                backgroundColor: '#f5f5f5',
                textColor: '#757575'
            }
        };

        const config = statusConfig[actualStatus] || statusConfig.pending;


        return (
            <Chip
                icon={config.icon}
                label={config.label}
                size="small"
                sx={{
                    fontSize: '11px',
                    height: '24px',
                    backgroundColor: config.backgroundColor,
                    color: config.textColor,
                    '& .MuiChip-icon': {
                        fontSize: '12px',
                        color: config.textColor
                    },
                    border: 'none'
                }}
            />
        );
    };

    // Function to determine if results can be viewed (automation must be complete)
    const canViewResults = (upload) => {
        // Debug log to understand why filename is disabled
        const completionStatuses = ['completed', 'processed', 'partially_processed'];
        const processingComplete = completionStatuses.includes(upload.processingStatus);
        const hasExtractedData = !!(upload.extractedData && upload.aiResults);
        const automationStatus = upload.automationStatus;
        const blockingStatuses = ['extracting_charges', 'matching_shipments', 'matching_charges', 'approving_charges', 'automation_pending'];
        const allowedStatuses = ['ready_to_process', 'processed', 'processed_with_exception', 'partially_processed'];

        const result = (() => {
            // Check if basic processing is complete (allow completion statuses)
            const completionStatuses = ['completed', 'processed', 'partially_processed'];
            if (!processingComplete && !completionStatuses.includes(upload.processingStatus)) {
                return false;
            }

            // Check if extraction was successful
            if (!hasExtractedData) {
                return false;
            }

            // If automation is in progress, block access
            if (automationStatus) {
                if (blockingStatuses.includes(automationStatus)) {
                    return false;
                }

                // Allow access when automation is complete
                return allowedStatuses.includes(automationStatus);
            }

            // If no automation status but extraction completed, allow access (legacy uploads)
            return true;
        })();


        return result;
    };

    // Function to determine the actual status based on upload data and processing state
    const determineUploadStatus = (upload) => {
        // Check processing status first
        if (upload.processingStatus === 'uploading') {
            return 'uploading';
        }

        if (upload.processingStatus === 'processing') {
            return 'extracting';
        }

        if (upload.processingStatus === 'error') {
            return 'extraction_failed';
        }

        // If processing is completed, check extraction and application status
        const completionStatuses = ['completed', 'processed', 'partially_processed'];
        if (completionStatuses.includes(upload.processingStatus)) {
            // Check if extraction was successful
            if (!upload.extractedData || !upload.aiResults) {
                return 'extraction_failed';
            }

            // Check if document appears to be invalid (non-invoice document)
            if (upload.extractedData && Array.isArray(upload.extractedData.shipments) && upload.extractedData.shipments.length === 0) {
                // If no shipments extracted and no invoice number, likely not an invoice
                const hasInvoiceNumber = upload.extractedData.invoiceNumber && upload.extractedData.invoiceNumber !== 'N/A';
                const hasAmount = upload.extractedData.totalAmount > 0;
                const hasCharges = upload.extractedData.charges && upload.extractedData.charges.length > 0;

                if (!hasInvoiceNumber && !hasAmount && !hasCharges) {
                    console.log('⚠️ Document appears to be invalid - no invoice data extracted:', upload.fileName);
                    return 'invalid_document';
                }
            }

            // Check for automation status first (set by intelligent processing)
            if (upload.automationStatus) {
                // Automation status found

                // Handle specific automation statuses - BLOCK access during automation
                switch (upload.automationStatus) {
                    case 'extracting_charges':
                    case 'matching_shipments':
                    case 'matching_charges':
                    case 'approving_charges':
                        return upload.automationStatus; // These statuses BLOCK the view button

                    // Only these statuses allow viewing results
                    case 'ready_to_process':
                    case 'processed':
                    case 'processed_with_exception':
                    case 'partially_processed':
                        return upload.automationStatus; // These allow results viewing

                    default:
                        return upload.automationStatus;
                }
            }

            // If extraction completed but no automation status, automation hasn't started yet
            // Show a waiting status to prevent premature access
            // Note: This should only happen briefly before automation triggers
            // return 'automation_pending';

            // Check processing status based on charge applications data stored in the upload
            if (upload.chargeApplications && upload.chargeApplications.length > 0) {
                const totalCharges = upload.chargeApplications.length;
                const appliedCharges = upload.chargeApplications.filter(app => app.status === 'applied').length;

                console.log('📊 Status check for upload:', upload.id, {
                    totalCharges,
                    appliedCharges,
                    chargeApplications: upload.chargeApplications
                });

                if (appliedCharges === totalCharges) {
                    return 'processed';
                } else if (appliedCharges > 0) {
                    return 'partially_processed';
                } else {
                    return 'ready_to_process';
                }
            }

            // Check the hasAppliedCharges flag as a quick indicator
            if (upload.hasAppliedCharges === true) {
                // If flag indicates charges were applied, need to determine if all or partial
                console.log('📊 Found hasAppliedCharges flag for upload:', upload.id);
                return 'processed'; // Assume fully processed if flag is set
            }

            // If no charge applications data, try to determine from processed shipments
            let totalProcessedCharges = 0;
            let totalCharges = 0;

            // Check each extracted shipment for applied charges
            if (upload.extractedData) {
                const shipments = Array.isArray(upload.extractedData.shipments)
                    ? upload.extractedData.shipments
                    : upload.extractedData.charges ? [upload.extractedData] : [];

                shipments.forEach(shipment => {
                    if (shipment.charges && Array.isArray(shipment.charges)) {
                        shipment.charges.forEach(charge => {
                            totalCharges++;
                            if (charge.appliedToShipment || charge.invoiceApplied || charge.status === 'applied') {
                                totalProcessedCharges++;
                            }
                        });
                    }
                });

                // Also check extracted charges at the root level
                if (upload.extractedData.charges && Array.isArray(upload.extractedData.charges)) {
                    upload.extractedData.charges.forEach(charge => {
                        totalCharges++;
                        if (charge.appliedToShipment || charge.invoiceApplied || charge.status === 'applied') {
                            totalProcessedCharges++;
                        }
                    });
                }

                console.log('📊 Charge processing status:', {
                    uploadId: upload.id,
                    totalCharges,
                    totalProcessedCharges,
                    extractedData: upload.extractedData
                });

                if (totalCharges > 0) {
                    if (totalProcessedCharges === totalCharges) {
                        return 'processed';
                    } else if (totalProcessedCharges > 0) {
                        return 'partially_processed';
                    }
                }
            }

            // Check shipment-level processing status (legacy check)
            if (upload.extractedData && upload.extractedData.shipments) {
                const shipments = Array.isArray(upload.extractedData.shipments)
                    ? upload.extractedData.shipments
                    : [upload.extractedData];

                let totalShipments = shipments.length;
                let processedShipments = 0;
                let partiallyProcessedShipments = 0;

                shipments.forEach(shipment => {
                    if (shipment.chargesApplied === true || shipment.processingStatus === 'processed') {
                        processedShipments++;
                    } else if (shipment.chargesApplied === 'partial' || shipment.processingStatus === 'partial') {
                        partiallyProcessedShipments++;
                    }
                });

                if (processedShipments === totalShipments) {
                    return 'processed';
                } else if (processedShipments > 0 || partiallyProcessedShipments > 0) {
                    return 'partially_processed';
                }
            }

            // Default to ready to process if extraction completed successfully
            return 'ready_to_process';
        }

        // Default fallback
        return upload.processingStatus || 'pending';
    };

    // Function to update upload status when charges are applied/unapplied
    const handleUploadStatusUpdate = useCallback(async (uploadId, statusUpdate) => {
        console.log('🔄 Updating upload status:', { uploadId, statusUpdate });

        // Handle both string status updates and object updates
        const updateObj = typeof statusUpdate === 'string'
            ? { status: statusUpdate }
            : statusUpdate || {};

        // Update local state
        setUploads(prev => prev.map(upload =>
            upload.id === uploadId
                ? {
                    ...upload,
                    chargeApplications: updateObj.chargeApplications || upload.chargeApplications,
                    extractedData: updateObj.extractedData || upload.extractedData,
                    processingStatus: updateObj.status || upload.processingStatus,
                    lastUpdated: new Date()
                }
                : upload
        ));

        setTableData(prev => prev.map(row =>
            row.id === uploadId
                ? {
                    ...row,
                    chargeApplications: updateObj.chargeApplications || row.chargeApplications,
                    extractedData: updateObj.extractedData || row.extractedData,
                    processingStatus: updateObj.status || row.processingStatus,
                    lastUpdated: new Date()
                }
                : row
        ));

        // Persist charge application status to Firestore for status tracking
        try {
            const firestoreUpdate = {
                lastUpdated: serverTimestamp()
            };

            // Add charge applications if provided
            if (updateObj.chargeApplications) {
                firestoreUpdate.chargeApplications = updateObj.chargeApplications;
                firestoreUpdate.hasAppliedCharges = updateObj.chargeApplications.some(app => app.status === 'applied');
            }

            // Add status if provided as string
            if (updateObj.status) {
                firestoreUpdate.automationStatus = updateObj.status;
            }

            await updateDoc(doc(db, 'apUploads', uploadId), firestoreUpdate);
            console.log('✅ Updated upload status in Firestore:', uploadId, firestoreUpdate);
        } catch (error) {
            console.error('❌ Failed to update upload status in Firestore:', error);
        }
    }, []);

    // Trigger intelligent auto-processing for completed extractions
    const triggerIntelligentAutoProcessing = useCallback(async (uploadId) => {
        try {
            console.log('🤖 Triggering intelligent auto-processing for upload:', uploadId);

            const processIntelligentAutoApproval = httpsCallable(functions, 'processIntelligentAutoApproval');
            const result = await processIntelligentAutoApproval({ uploadId });

            if (result.data.success) {
                console.log('✅ Intelligent auto-processing completed:', result.data);

                // NOTE: Don't update state here - let the real-time listener handle all status updates
                // This prevents race conditions between the callback and the listener

                // Show success notification
                const { totalShipments, processedShipments } = result.data;
                const message = processedShipments > 0
                    ? `🤖 Auto-processed ${processedShipments}/${totalShipments} shipments`
                    : `✅ Analysis complete - ${totalShipments} shipments ready for manual review`;

                enqueueSnackbar(message, {
                    variant: processedShipments > 0 ? 'success' : 'info',
                    autoHideDuration: 6000
                });
            } else {
                console.log('ℹ️ Intelligent auto-processing skipped:', result.data.reason);
            }
        } catch (error) {
            console.error('❌ Error in intelligent auto-processing:', error);
            // Don't show error to user as this is background automation
        }
    }, [enqueueSnackbar]);

    // Set up real-time listener for automation status updates
    const setupAutomationStatusListener = useCallback((uploadId) => {
        const uploadRef = doc(db, 'apUploads', uploadId);

        const unsubscribe = onSnapshot(uploadRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const updatedData = docSnapshot.data();
                console.log('🔄 Real-time automation status update:', {
                    uploadId,
                    automationStatus: updatedData.automationStatus,
                    automationProgress: updatedData.automationProgress
                });

                // Update uploads state with new automation status
                setUploads(prev => prev.map(upload =>
                    upload.id === uploadId
                        ? {
                            ...upload,
                            automationStatus: updatedData.automationStatus,
                            automationProgress: updatedData.automationProgress,
                            automationResults: updatedData.automationResults,
                            lastUpdated: new Date()
                        }
                        : upload
                ));

                // Update table data
                setTableData(prev => prev.map(row =>
                    row.id === uploadId
                        ? {
                            ...row,
                            automationStatus: updatedData.automationStatus,
                            automationProgress: updatedData.automationProgress,
                            automationResults: updatedData.automationResults,
                            lastUpdated: new Date()
                        }
                        : row
                ));

                // Show progress messages if available
                if (updatedData.automationProgress?.message) {
                    console.log('📢 Automation progress:', updatedData.automationProgress.message);
                }

                // Show completion notification for various automation statuses
                const completionStatuses = ['processed', 'ready_to_process', 'partially_processed', 'processed_with_exception'];
                if (updatedData.automationResults && completionStatuses.includes(updatedData.automationStatus)) {
                    const { totalShipments, processedShipments } = updatedData.automationResults;

                    let message, variant;
                    switch (updatedData.automationStatus) {
                        case 'processed':
                            message = `🤖 Auto-processed ${processedShipments}/${totalShipments} shipments successfully`;
                            variant = 'success';
                            break;
                        case 'partially_processed':
                            message = `🤖 Auto-processed ${processedShipments}/${totalShipments} shipments - ${totalShipments - processedShipments} need manual review`;
                            variant = 'warning';
                            break;
                        case 'processed_with_exception':
                            message = `⚠️ Auto-processed ${processedShipments}/${totalShipments} shipments with exceptions`;
                            variant = 'warning';
                            break;
                        default:
                            message = processedShipments > 0
                                ? `🤖 Auto-processed ${processedShipments}/${totalShipments} shipments`
                                : `✅ Analysis complete - ${totalShipments} shipments ready for manual review`;
                            variant = processedShipments > 0 ? 'success' : 'info';
                    }

                    enqueueSnackbar(message, {
                        variant,
                        autoHideDuration: 6000
                    });

                    // Stop listening once processing is complete
                    unsubscribe();
                }
            }
        }, (error) => {
            console.error('❌ Error in automation status listener:', error);
        });

        return unsubscribe;
    }, [enqueueSnackbar]);

    // Format currency
    const formatCurrency = (amount, currency = 'CAD') => {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency === 'USD' ? 'USD' : 'CAD'
        }).format(numAmount);
    };

    // Format date
    const formatDate = (date) => {
        if (!date) return 'N/A';
        const dateObj = date.toDate ? date.toDate() : new Date(date);
        return dateObj.toLocaleDateString();
    };

    // Dropzone configuration
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        },
        multiple: true
    });

    // Load carriers first, then uploads
    useEffect(() => {
        loadCarriers();
    }, [loadCarriers]);

    // Load uploads after carriers are loaded (only once)
    useEffect(() => {
        if (carriers.length > 0 && uploads.length === 0) {
            loadUploads();
        } else if (carriers.length > 0) {
            // If carriers are loaded but we're not loading uploads (they're already loaded), stop loading
            setLoading(false);
        }
    }, [carriers.length, uploads.length, loadUploads]); // Added uploads.length dependency

    // Re-transform table data when carriers are loaded (to fix carrier names)
    useEffect(() => {
        if (carriers.length > 0 && uploads.length > 0) {
            console.log('🔄 Re-transforming table data with loaded carriers');
            const transformedTableData = uploads.map(upload => transformUploadToTableRow(upload));
            setTableData(transformedTableData);
        }
    }, [carriers, uploads, transformUploadToTableRow]);

    // Filter table data when search term or filters change
    useEffect(() => {
        filterTableData();
    }, [filterTableData]);

    // Initialize filtered data when tableData changes
    useEffect(() => {
        filterTableData();
    }, [tableData, searchTerm, invoiceDate, uploadDate, filterTableData]);

    // Real-time listener for automation status updates
    useEffect(() => {
        if (carriers.length === 0) return; // Wait for carriers to load first

        console.log('🔄 Setting up real-time listener for automation status updates...');

        const uploadsQuery = query(
            collection(db, 'apUploads'),
            orderBy('uploadDate', 'desc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(uploadsQuery, (snapshot) => {
            const uploadsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort in memory by upload date
            uploadsData.sort((a, b) => {
                const aDate = a.uploadDate?.toDate ? a.uploadDate.toDate() : new Date(a.uploadDate || 0);
                const bDate = b.uploadDate?.toDate ? b.uploadDate.toDate() : new Date(b.uploadDate || 0);
                return bDate - aDate;
            });

            console.log('🔄 Real-time update received:', uploadsData.length, 'uploads');
            setUploads(uploadsData);

            // Transform uploads to table data for enterprise view
            const transformedTableData = uploadsData.map(upload => transformUploadToTableRow(upload));
            setTableData(transformedTableData);

            setLoading(false);
        }, (error) => {
            console.error('❌ Real-time listener error:', error);
        });

        // Cleanup listener on unmount
        return () => {
            console.log('🛑 Cleaning up real-time listener');
            unsubscribe();
        };
    }, [carriers.length, transformUploadToTableRow]);

    // Tab panels
    const TabPanel = ({ children, value, index, ...other }) => (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                <Box sx={{ p: 3 }}>
                    {/* Header with Process New Invoice Button */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box>
                            <Typography variant="h5" sx={{ fontSize: '20px', fontWeight: 600, color: '#111827' }}>
                                Invoice Processing
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 1 }}>
                                View and manage uploaded invoices for AI extraction and processing
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setSelectedCarrier(''); // Reset carrier selection
                                setUploadModalOpen(true);
                            }}
                            sx={{
                                fontSize: '12px',
                                textTransform: 'none',
                                fontWeight: 500,
                                px: 3,
                                py: 1.5,
                                backgroundColor: '#6366f1',
                                '&:hover': {
                                    backgroundColor: '#5856eb'
                                }
                            }}
                        >
                            Process New Invoice
                        </Button>
                    </Box>


                    {/* Search and Filters */}
                    {loading || loadingCarriers ? (
                        <Box sx={{ mb: 3 }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} md={4}>
                                    <Skeleton width="100%" height={40} sx={{ borderRadius: 1 }} />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Skeleton width="100%" height={40} sx={{ borderRadius: 1 }} />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Skeleton width="100%" height={40} sx={{ borderRadius: 1 }} />
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <Skeleton width="100%" height={40} sx={{ borderRadius: 1 }} />
                                </Grid>
                            </Grid>
                        </Box>
                    ) : (
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <Box sx={{ mb: 3 }}>
                                {/* First row - Search and dates */}
                                <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            size="small"
                                            label="Search"
                                            placeholder="Search by file name, invoice #, carrier..."
                                            value={searchTerm}
                                            onChange={handleSearchChange}
                                            InputProps={{
                                                startAdornment: <SearchIcon sx={{ mr: 1, color: '#9ca3af' }} />,
                                                endAdornment: searchTerm && (
                                                    <IconButton size="small" onClick={clearSearch}>
                                                        <ClearIcon fontSize="small" />
                                                    </IconButton>
                                                ),
                                                sx: { fontSize: '12px' }
                                            }}
                                            sx={{ width: '100%' }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <DatePicker
                                            label="Invoice Date"
                                            value={invoiceDate}
                                            onChange={setInvoiceDate}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    sx: { fontSize: '12px' }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <DatePicker
                                            label="Upload Date"
                                            value={uploadDate}
                                            onChange={setUploadDate}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    sx: { fontSize: '12px' }
                                                }
                                            }}
                                        />
                                    </Grid>
                                </Grid>

                                {/* Second row - Action buttons */}
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={12} md={6}>
                                        <Stack direction="row" spacing={1}>
                                            {(searchTerm || invoiceDate || uploadDate) && (
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    onClick={clearAllFilters}
                                                    sx={{
                                                        fontSize: '12px',
                                                        textTransform: 'none',
                                                        color: '#6b7280',
                                                        borderColor: '#d1d5db'
                                                    }}
                                                >
                                                    Clear All Filters
                                                </Button>
                                            )}
                                        </Stack>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            {showDeleteActions && (
                                                <Button
                                                    variant="outlined"
                                                    color="error"
                                                    size="small"
                                                    startIcon={<DeleteIcon />}
                                                    onClick={handleBulkDelete}
                                                    disabled={isExporting}
                                                    sx={{ fontSize: '12px', textTransform: 'none' }}
                                                >
                                                    {isExporting ? 'Deleting...' : `Delete (${selectedRows.length})`}
                                                </Button>
                                            )}
                                        </Stack>
                                    </Grid>
                                </Grid>
                            </Box>
                        </LocalizationProvider>
                    )}

                    {/* Results Table */}
                    <Paper sx={{ border: '1px solid #e5e7eb' }}>
                        <Box sx={{ borderBottom: '1px solid #e5e7eb', p: 2 }}>
                            {loading || loadingCarriers ? (
                                <Skeleton width={200} height={24} />
                            ) : (
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                    Recent Uploads ({filteredTableData.length}{searchTerm ? ` of ${tableData.length}` : ''})
                                </Typography>
                            )}
                        </Box>

                        {loading || loadingCarriers ? (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                            <TableCell padding="checkbox">
                                                <Checkbox size="small" disabled />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>File Name</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Carrier</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Invoice #</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Shipments</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Total</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Upload Date</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Invoice Date</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {Array.from({ length: 5 }).map((_, index) => (
                                            <TableRow key={index}>
                                                <TableCell padding="checkbox">
                                                    <Skeleton variant="rectangular" width={18} height={18} />
                                                </TableCell>
                                                <TableCell><Skeleton width={120} height={20} /></TableCell>
                                                <TableCell><Skeleton width={100} height={20} /></TableCell>
                                                <TableCell><Skeleton width={80} height={20} /></TableCell>
                                                <TableCell><Skeleton width={60} height={20} /></TableCell>
                                                <TableCell><Skeleton width={60} height={20} /></TableCell>
                                                <TableCell><Skeleton width={80} height={20} /></TableCell>
                                                <TableCell><Skeleton width={90} height={20} /></TableCell>
                                                <TableCell><Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 1 }} /></TableCell>
                                                <TableCell><Skeleton variant="circular" width={24} height={24} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : tableData.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <AssignmentIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                                <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                                    No uploads yet
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Select a carrier and upload an invoice to get started.
                                </Typography>
                            </Box>
                        ) : (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    indeterminate={selectedRows.length > 0 && selectedRows.length < tableData.length}
                                                    checked={tableData.length > 0 && selectedRows.length === tableData.length}
                                                    onChange={handleSelectAll}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>File Name</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Carrier</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Invoice #</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Shipments</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Total</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Upload Date</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Invoice Date</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredTableData.map((row) => (
                                            <TableRow key={row.id} hover sx={{ '&:hover': { backgroundColor: '#f9fafb' } }}>
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={selectedRows.includes(row.id)}
                                                        onChange={() => handleSelectRow(row.id)}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>
                                                    <Button
                                                        variant="text"
                                                        size="small"
                                                        onClick={() => handleFileNameClick(row)}
                                                        sx={{
                                                            fontSize: '11px',
                                                            textTransform: 'none',
                                                            color: canViewResults(row) ? '#3b82f6' : '#374151',
                                                            fontWeight: canViewResults(row) ? 500 : 400,
                                                            cursor: canViewResults(row) ? 'pointer' : 'default',
                                                            textDecoration: canViewResults(row) ? 'underline' : 'none',
                                                            padding: 0,
                                                            minWidth: 'auto',
                                                            justifyContent: 'flex-start',
                                                            '&:hover': {
                                                                backgroundColor: 'transparent',
                                                                textDecoration: canViewResults(row) ? 'underline' : 'none'
                                                            }
                                                        }}
                                                        disabled={!canViewResults(row)}
                                                    >
                                                        {row.fileName}
                                                    </Button>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{typeof row.carrier === 'string' ? row.carrier : row.carrier?.name || 'Unknown'}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{row.invoiceNumber}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>
                                                    <Chip
                                                        label={row.shipmentCount}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '10px',
                                                            height: '20px',
                                                            backgroundColor: '#f3f4f6',
                                                            color: '#374151'
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{formatCurrency(row.totalAmount, row.currency)}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{formatDate(row.uploadDate)}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{formatDate(row.invoiceDate)}</TableCell>
                                                <TableCell>{getStatusChip(row.processingStatus, row)}</TableCell>
                                                <TableCell>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(event) => handleActionMenuOpen(event, row)}
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
                    </Paper>
                </Box>
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleActionMenuClose}
                PaperProps={{ sx: { width: 200 } }}
            >
                <MenuItem onClick={handleMenuViewResults}>
                    <ListItemIcon>
                        <ViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="View Results" primaryTypographyProps={{ fontSize: '11px' }} />
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleMenuDeleteUpload} sx={{ color: '#ef4444' }}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" sx={{ color: '#ef4444' }} />
                    </ListItemIcon>
                    <ListItemText primary="Delete Upload" primaryTypographyProps={{ fontSize: '11px', color: '#ef4444' }} />
                </MenuItem>
            </Menu>

            {/* Results Dialog */}
            <Dialog
                open={showPdfResults}
                onClose={() => setShowPdfResults(false)}
                maxWidth="xl"
                fullWidth
                PaperProps={{ sx: { height: '90vh' } }}
            >
                <DialogContent sx={{ p: 0 }}>
                    {selectedUpload && (
                        <APProcessingResults
                            extractedData={selectedUpload.extractedData || selectedUpload.aiResults?.extractedData}
                            matchingResults={selectedUpload.matchingResults}
                            fileName={selectedUpload.fileName}
                            uploadData={selectedUpload}
                            uploadId={selectedUpload.id}
                            onStatusUpdate={(status) => handleUploadStatusUpdate(selectedUpload.id, status)}
                            onApprove={() => {
                                console.log('Approve AP Results for:', selectedUpload.fileName);
                                enqueueSnackbar('Invoice approved for processing', { variant: 'success' });
                                setShowPdfResults(false);
                            }}
                            onReject={() => {
                                console.log('Reject AP Results for:', selectedUpload.fileName);
                                enqueueSnackbar('Invoice rejected', { variant: 'warning' });
                                setShowPdfResults(false);
                            }}
                            onClose={() => {
                                setShowPdfResults(false);
                                // Refresh table data when dialog closes to reflect any status changes
                                loadUploads();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Upload Modal */}
            <Dialog
                open={uploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: '12px' }
                }}
            >
                <DialogTitle sx={{
                    borderBottom: '1px solid #e5e7eb',
                    fontSize: '18px',
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    Process New Invoice
                    <IconButton onClick={() => setUploadModalOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ p: 3 }}>
                        <Grid container spacing={3}>
                            {/* Carrier Selection */}
                            <Grid item xs={12} md={4}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    1. Select Carrier
                                </Typography>
                                <Autocomplete
                                    size="small"
                                    options={carriers}
                                    getOptionLabel={(option) => option.name}
                                    value={carriers.find(c => c.id === selectedCarrier) || null}
                                    onChange={(event, newValue) => setSelectedCarrier(newValue?.id || '')}
                                    loading={loadingCarriers}
                                    slotProps={{
                                        popper: {
                                            sx: {
                                                '& .MuiAutocomplete-listbox': {
                                                    '& .MuiAutocomplete-option': {
                                                        fontSize: '12px !important',
                                                        minHeight: '32px',
                                                        padding: '6px 12px'
                                                    }
                                                }
                                            }
                                        }
                                    }}
                                    sx={{
                                        '& .MuiAutocomplete-option': {
                                            fontSize: '12px !important'
                                        }
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Select Trained Carrier"
                                            variant="outlined"
                                            size="small"
                                            InputLabelProps={{
                                                sx: { fontSize: '12px' }
                                            }}
                                            InputProps={{
                                                ...params.InputProps,
                                                sx: { fontSize: '12px' }
                                            }}
                                            sx={{
                                                '& .MuiInputBase-input': {
                                                    fontSize: '12px'
                                                },
                                                '& .MuiInputLabel-root': {
                                                    fontSize: '12px'
                                                }
                                            }}
                                        />
                                    )}
                                />
                            </Grid>

                            {/* Upload Section */}
                            <Grid item xs={12} md={8}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    2. Upload Invoice
                                </Typography>
                                <Paper
                                    {...getRootProps()}
                                    sx={{
                                        p: 3,
                                        border: isDragActive ? '2px dashed #3b82f6' : '2px dashed #d1d5db',
                                        backgroundColor: isDragActive ? '#eff6ff' : '#f9fafb',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <input {...getInputProps()} />
                                    <CloudUploadIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 1 }}>
                                        Upload Invoice PDF
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        Drag & drop PDF files here, or click to select
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                        Select a carrier and drag & drop files to upload
                    </Typography>
                    <Button
                        size="small"
                        onClick={() => setUploadModalOpen(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default APProcessingEnterprise;
