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
    ExpandMore as ExpandMoreIcon
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
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    getDoc,
    serverTimestamp,
    onSnapshot
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getStorage, ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import TestResultsComparison from './TestResultsComparison';

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
    const [loading, setLoading] = useState(false);
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
                               (typeof extractedData.carrier === 'string' ? extractedData.carrier : extractedData.carrier?.name) ||
                               extractedData.carrierInformation?.company ||
                               'Unknown';
                               
            console.log('✅ Resolved carrier name:', carrierName);
        
        // Get invoice number from multiple sources  
        const invoiceNumber = extractedData.invoice_number ||
                             extractedData.invoiceNumber ||
                             extractedData.invoiceDetails?.invoiceNumber ||
                             'N/A';
        
        // Get shipment ID from multiple sources
        const shipmentId = extractedData.shipment_ids?.[0] ||
                          extractedData.shipmentId ||
                          extractedData.invoiceDetails?.billOfLading ||
                          'N/A';
        
        // Get shipper/consignee (ensure string values only)
        const shipper = typeof extractedData.shipper === 'object' 
                       ? (extractedData.shipper?.company || 'N/A')
                       : (extractedData.shipper || 'N/A');
        const consignee = typeof extractedData.consignee === 'object'
                         ? (extractedData.consignee?.company || 'N/A')
                         : (extractedData.consignee || 'N/A');
        
        // Get total amount
        const totalAmount = extractedData.total || 
                           extractedData.totalAmount?.amount || 
                           extractedData.totalAmount || 
                           0;
        
        const result = {
            id: upload.id,
            fileName: upload.fileName,
            carrier: carrierName,
            uploadDate: upload.uploadDate,
            processingStatus: upload.processingStatus || 'pending',
            shipmentId: shipmentId,
            invoiceNumber: invoiceNumber,
            totalAmount: totalAmount,
            currency: extractedData.totalAmount?.currency || 'CAD',
            charges: extractedData.charges || [],
            shipper: shipper,
            consignee: consignee,
            extractedData,
            rawUpload: upload,
            matchStatus: upload.matchStatus || 'pending',
            approvalStatus: upload.approvalStatus || 'pending'
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

                // Update temp record with real Firestore ID
                setUploads(prev => prev.map(upload => 
                    upload.id === tempUpload.id 
                        ? { ...upload, id: docRef.id, _isTemporary: false }
                        : upload
                ));
                
                // Update table data with real ID
                setTableData(prev => prev.map(row => 
                    row.id === tempUpload.id 
                        ? { ...row, id: docRef.id, _isTemporary: false }
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
            console.log('📊 Updating status to processing for:', tempId);
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
        
        const shipmentId = extractedData.shipment_ids?.[0] ||
                          extractedData.shipmentId ||
                          extractedData.invoiceDetails?.billOfLading ||
                          'N/A';
        
                    // Get shipper/consignee (ensure string values only)
            const shipper = typeof extractedData.shipper === 'object' 
                           ? (extractedData.shipper?.company || 'N/A')
                           : (extractedData.shipper || 'N/A');
            const consignee = typeof extractedData.consignee === 'object'
                             ? (extractedData.consignee?.company || 'N/A')
                             : (extractedData.consignee || 'N/A');
        
        const totalAmount = extractedData.total || 
                           extractedData.totalAmount?.amount || 
                           extractedData.totalAmount || 
                           0;
        
        const normalized = {
            fileName: uploadFile.name,
            uploadDate: new Date(),
            carrier: carrierName,
            invoiceNumber: invoiceNumber,
            shipmentId: shipmentId,
            totalAmount: totalAmount,
            currency: extractedData.totalAmount?.currency || 'CAD',
            charges: extractedData.charges || [],
            shipper: shipper,
            consignee: consignee,
            extractedData,
            aiResults: fullAiResults
        };
        
        console.log('✅ Normalized AI data:', normalized);
        return normalized;
    }, [carriers, selectedCarrier]);

    // Table row selection
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            setSelectedRows(tableData.map(row => row.id));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedRows(prev => {
            if (prev.includes(id)) {
                return prev.filter(rowId => rowId !== id);
            } else {
                return [...prev, id];
            }
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

    const handleMenuViewResults = () => {
        if (selectedUploadForAction) {
            setSelectedUpload(selectedUploadForAction);
            setShowPdfResults(true);
        }
        handleActionMenuClose();
    };

    const handleMenuDeleteUpload = async () => {
        if (selectedUploadForAction) {
            try {
                await deleteDoc(doc(db, 'apUploads', selectedUploadForAction.id));
                enqueueSnackbar('Upload deleted successfully', { variant: 'success' });
                loadUploads();
            } catch (error) {
                console.error('Error deleting upload:', error);
                enqueueSnackbar('Failed to delete upload', { variant: 'error' });
            }
        }
        handleActionMenuClose();
    };

    // Status chip renderer
    const getStatusChip = (status) => {
        const statusConfig = {
            completed: { color: 'success', label: 'Completed', icon: <CheckCompleteIcon sx={{ fontSize: '12px' }} /> },
            processing: { color: 'warning', label: 'Processing', icon: <PendingIcon sx={{ fontSize: '12px' }} /> },
            uploading: { color: 'info', label: 'Uploading', icon: <CloudUploadIcon sx={{ fontSize: '12px' }} /> },
            error: { color: 'error', label: 'Error', icon: <ErrorIcon sx={{ fontSize: '12px' }} /> },
            pending: { color: 'default', label: 'Pending', icon: <PendingIcon sx={{ fontSize: '12px' }} /> }
        };

        const config = statusConfig[status] || statusConfig.pending;
        
        return (
            <Chip
                size="small"
                color={config.color}
                label={config.label}
                icon={config.icon}
                sx={{ fontSize: '10px' }}
            />
        );
    };

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
        }
    }, [carriers.length]); // Only depend on carriers.length, not the full carriers array
    
    // Re-transform table data when carriers are loaded (to fix carrier names)
    useEffect(() => {
        if (carriers.length > 0 && uploads.length > 0) {
            console.log('🔄 Re-transforming table data with loaded carriers');
            const transformedTableData = uploads.map(upload => transformUploadToTableRow(upload));
            setTableData(transformedTableData);
        }
    }, [carriers, uploads, transformUploadToTableRow]);

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


                    {/* Results Table */}
                    <Paper sx={{ border: '1px solid #e5e7eb' }}>
                        <Box sx={{ borderBottom: '1px solid #e5e7eb', p: 2 }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                Recent Uploads ({tableData.length})
                            </Typography>
                        </Box>

                        {loading ? (
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
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Shipment ID</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Shipper</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Consignee</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Total</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Upload Date</TableCell>
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
                                                <TableCell><Skeleton width={90} height={20} /></TableCell>
                                                <TableCell><Skeleton width={110} height={20} /></TableCell>
                                                <TableCell><Skeleton width={110} height={20} /></TableCell>
                                                <TableCell><Skeleton width={60} height={20} /></TableCell>
                                                <TableCell><Skeleton width={80} height={20} /></TableCell>
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
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Shipment ID</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Shipper</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Consignee</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Total</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Upload Date</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {tableData.map((row) => (
                                            <TableRow key={row.id} hover sx={{ '&:hover': { backgroundColor: '#f9fafb' } }}>
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={selectedRows.includes(row.id)}
                                                        onChange={() => handleSelectRow(row.id)}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{row.fileName}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{typeof row.carrier === 'string' ? row.carrier : row.carrier?.name || 'Unknown'}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{row.invoiceNumber}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{row.shipmentId}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{typeof row.shipper === 'string' ? row.shipper : row.shipper?.company || row.shipper?.name || 'Unknown'}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{typeof row.consignee === 'string' ? row.consignee : row.consignee?.company || row.consignee?.name || 'Unknown'}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{formatCurrency(row.totalAmount, row.currency)}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{formatDate(row.uploadDate)}</TableCell>
                                                <TableCell>{getStatusChip(row.processingStatus)}</TableCell>
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
                maxWidth="lg"
                fullWidth
                PaperProps={{ sx: { height: '90vh' } }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Extraction Results</Typography>
                    <IconButton onClick={() => setShowPdfResults(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {selectedUpload && (
                        <TestResultsComparison
                            testResults={selectedUpload.aiResults || selectedUpload.rawUpload?.aiResults}
                            expectedResults={null}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowPdfResults(false)}>Close</Button>
                </DialogActions>
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
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Select Trained Carrier"
                                            variant="outlined"
                                            size="small"
                                            sx={{ fontSize: '12px' }}
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
                                    <Typography sx={{ fontSize: '16px', fontWeight: 500, mb: 1 }}>
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
                    <Button onClick={() => setUploadModalOpen(false)} sx={{ fontSize: '12px' }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default APProcessingEnterprise;
