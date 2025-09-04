import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    IconButton
} from '@mui/material';
import {
    CloudUpload as CloudUploadIcon,
    Description as DocumentIcon,
    Close as CloseIcon
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
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getStorage, ref, uploadBytesResumable, uploadBytes, getDownloadURL } from 'firebase/storage';
import AdminBreadcrumb from '../AdminBreadcrumb';
import TestResultsComparison from './TestResultsComparison';

const APProcessing = () => {
    const { currentUser } = useAuth();
    const { companyIdForAddress } = useCompany();
    const { enqueueSnackbar } = useSnackbar();
    const functions = getFunctions();
    const storage = getStorage();

    // State Management
    const [loading, setLoading] = useState(true);
    const [uploads, setUploads] = useState([]);
    const [selectedUpload, setSelectedUpload] = useState(null);
    const [showPdfResults, setShowPdfResults] = useState(false);
    const [pdfResults, setPdfResults] = useState([]);
    
    // Carrier and AI Processing State
    const [trainedCarriers, setTrainedCarriers] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState('');
    const [loadingCarriers, setLoadingCarriers] = useState(false);
    const [approving, setApproving] = useState(false);

    // Load trained carriers on component mount
    useEffect(() => {
        loadTrainedCarriers();
        loadUploads();
    }, []);

    const loadTrainedCarriers = async () => {
        try {
            setLoadingCarriers(true);
            const getCarriersFunc = httpsCallable(functions, 'getTrainingCarriers');
            const result = await getCarriersFunc({ status: 'active' });
            
            if (result.data?.success) {
                const carriers = result.data.data?.carriers || [];
                setTrainedCarriers(carriers);
                console.log(`Loaded ${carriers.length} trained carriers for AP Processing`);
            }
        } catch (error) {
            console.error('Error loading trained carriers:', error);
            enqueueSnackbar('Failed to load trained carriers', { variant: 'error' });
        } finally {
            setLoadingCarriers(false);
        }
    };

    const loadUploads = async () => {
        try {
            setLoading(true);
            console.log('🔍 Loading global AP uploads (all companies)');
            
            // Load all uploads globally - carrier invoices are not company-specific
            const uploadsQuery = query(
            collection(db, 'apUploads'),
            orderBy('uploadDate', 'desc'),
            limit(100)
        );

            const snapshot = await getDocs(uploadsQuery);
            console.log('✅ Global uploads query succeeded');

            const uploadsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort in memory if we couldn't use orderBy
            uploadsData.sort((a, b) => {
                const aDate = a.uploadDate?.toDate ? a.uploadDate.toDate() : new Date(a.uploadDate || 0);
                const bDate = b.uploadDate?.toDate ? b.uploadDate.toDate() : new Date(b.uploadDate || 0);
                return bDate - aDate;
            });

            console.log('✅ Loaded uploads from Firestore:', uploadsData.length, 'documents');
            console.log('📋 Upload details:', uploadsData.map(u => ({ 
                fileName: u.fileName, 
                uploadedByCompany: u.uploadedByCompany, 
                status: u.processingStatus,
                uploadDate: u.uploadDate 
            })));
            
            setUploads(uploadsData);
            } catch (error) {
            console.error('❌ Error loading uploads:', error);
            enqueueSnackbar(`Failed to load uploads: ${error.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Save completed upload to Firestore
    const saveCompletedUploadToFirestore = async (file, extractedData, aiResults) => {
        try {
            console.log('💾 Saving completed upload to Firestore...');
            
            const uploadDoc = {
                fileName: file.name,
                // Keep company info for reference but uploads are global
                uploadedByCompany: companyIdForAddress,
                carrierId: selectedCarrier,
                uploadDate: serverTimestamp(),
                processingStatus: 'completed',
                type: 'pdf',
                
                // AI Processing Results
                extractedData: extractedData,
                aiResults: aiResults,
                
                // Metadata
                metadata: {
                    uploadMethod: file.processingMethod || 'direct_base64',
                    uploadedBy: currentUser.email,
                    uploadedByCompany: companyIdForAddress,
                    processingTime: new Date().toISOString(),
                    source: 'ap-processing'
                },
                
                // Status tracking
                status: 'pending_approval',
                approvalStatus: 'pending',
                
                // Timestamps
                uploadedAt: serverTimestamp(),
                processedAt: serverTimestamp(),
                lastUpdatedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'apUploads'), uploadDoc);
            console.log('✅ Upload saved to Firestore with ID:', docRef.id);
            
            // Refresh the uploads list to show the newly saved upload
            await loadUploads();
            
            return docRef.id;
            
        } catch (error) {
            console.error('❌ Error saving upload to Firestore:', error);
            enqueueSnackbar('Warning: Upload processed but not saved permanently', { variant: 'warning' });
        }
    };

    // File upload handling
    const onDrop = useCallback((acceptedFiles) => {
        if (!selectedCarrier) {
            enqueueSnackbar('Please select a carrier first', { variant: 'warning' });
            return;
        }

        acceptedFiles.forEach(async (file) => {
            console.log('Processing file:', file.name);
            
            // Create temporary upload record
            const tempUpload = {
                id: `temp-${Date.now()}-${Math.random()}`,
                fileName: file.name,
                type: file.type,
                processingStatus: 'uploading',
                uploadDate: new Date(),
                carrier: selectedCarrier,
                _isTemporary: true
            };

            setUploads(prev => [tempUpload, ...prev]);

            // Save to Firestore immediately so it persists even if processing fails
            try {
                const uploadDoc = {
                    fileName: file.name,
                    // Keep companyId for informational purposes but don't filter by it
                    uploadedByCompany: companyIdForAddress,
                    carrierId: selectedCarrier,
                    uploadDate: serverTimestamp(),
                    processingStatus: 'uploading',
                    type: 'pdf',
                    
                    // Metadata
                    metadata: {
                        uploadMethod: 'direct_base64',
                        uploadedBy: currentUser.email,
                        uploadedByCompany: companyIdForAddress,
                        processingTime: new Date().toISOString(),
                        source: 'ap-processing'
                    },
                    
                    // Status tracking
                    status: 'processing',
                    approvalStatus: 'pending',
                    
                    // Timestamps
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

                // Start upload process with real ID
                uploadAndProcessFile(file, docRef.id);
                
            } catch (error) {
                console.error('❌ Failed to save upload to Firestore:', error);
                enqueueSnackbar('Warning: Upload may not persist if processing fails', { variant: 'warning' });
                
                // Still try to process with temp ID
                uploadAndProcessFile(file, tempUpload.id);
            }
        });
    }, [selectedCarrier]);

    const uploadAndProcessFile = async (file, tempId) => {
        try {
            console.log('🚀 Processing file directly (bypass storage):', file.name);
            
            // Process file directly with base64 to avoid Firebase Storage CORS issues
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const base64Data = e.target.result.split(',')[1]; // Remove data:mime;base64, prefix
                    console.log('📄 File converted to base64, starting AI extraction...');
                    
                // Update status to processing
                setUploads(prev => prev.map(upload =>
                        upload.id === tempId 
                            ? { ...upload, processingStatus: 'processing' }
                        : upload
                ));

                    // Process directly with base64 data
                    const fileObj = { 
                        name: file.name, 
                        uploadId: tempId,
                        base64Data: base64Data,
                        processingMethod: 'direct_base64'
                    };
                    
                    await runAIExtraction(fileObj);
                    
                    enqueueSnackbar('File processing started successfully', { variant: 'success' });
                    
                } catch (processingError) {
                    console.error('📄 Processing failed:', processingError);
            setUploads(prev => prev.map(upload =>
                        upload.id === tempId 
                            ? { ...upload, processingStatus: 'error', error: processingError.message }
                    : upload
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
                enqueueSnackbar('Failed to read file', { variant: 'error' });
            };
            
            reader.readAsDataURL(file);

        } catch (error) {
            console.error('💥 File processing error:', error);
                setUploads(prev => prev.map(upload =>
                upload.id === tempId 
                    ? { ...upload, processingStatus: 'error', error: error.message }
                        : upload
                ));
            enqueueSnackbar(`File processing failed: ${error.message}`, { variant: 'error' });
        }
    };

    const runAIExtraction = useCallback(async (file) => {
        if (!selectedCarrier) {
            enqueueSnackbar('Please select a carrier first', { variant: 'warning' });
            return;
        }

        try {
            console.log('🤖 Starting AI extraction for:', file.name);
            console.log('📋 File object received:', { 
                name: file.name, 
                hasBase64: !!file.base64Data, 
                hasUrl: !!(file.url || file.downloadURL),
                processingMethod: file.processingMethod 
            });
            
            const testCarrierModel = httpsCallable(functions, 'testCarrierModel');
            
            // Handle different file input types
            let base64Data = file.base64Data; // Use existing base64Data if available
            let fileName = file.name;
            
            // If it's a File object, convert to base64
            if (file instanceof File) {
                console.log('📄 Converting File object to base64...');
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                base64Data = btoa(String.fromCharCode.apply(null, uint8Array));
                fileName = file.name;
            }
            
            // Validate required parameters
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
                
                // Check if carrier-specific prompt was used
                const usedCarrierPrompt = result.data.testResults?.metadata?.usedCarrierSpecificPrompt;
                if (usedCarrierPrompt) {
                    console.log('🎯 AP Processing used carrier-specific AI prompt for enhanced extraction');
                    enqueueSnackbar('AI extraction completed with carrier-specific prompt!', { variant: 'success' });
                } else {
                    console.log('📋 AP Processing used generic AI prompt (no carrier-specific prompt available)');
                    enqueueSnackbar('AI extraction completed', { variant: 'success' });
                }
                
                // Process the extracted data
                const extractedData = result.data.testResults?.aiResults?.enhancedResults?.extractedData;
                if (extractedData) {
                    const normalizedData = normalizeAIDataForTable(extractedData, file, result.data.testResults);
                    
                    // Update existing Firestore record instead of creating new one
                    const uploadId = file.uploadId || file.id;
                    if (uploadId && uploadId.length > 20) { // Real Firestore ID
                        try {
                            await updateDoc(doc(db, 'apUploads', uploadId), {
                                processingStatus: 'completed',
                                extractedData: normalizedData,
                                aiResults: result.data.testResults,
                                processedAt: serverTimestamp(),
                                lastUpdatedAt: serverTimestamp()
                            });
                            console.log('✅ Updated existing Firestore record:', uploadId);
                        } catch (updateError) {
                            console.error('❌ Failed to update Firestore record:', updateError);
                        }
                    }
                    
                    // Update the upload record with completion status
                    setUploads(prev => prev.map(upload =>
                        upload.id === file.uploadId || upload.fileName === file.name
                            ? { 
                                ...upload, 
                                processingStatus: 'completed',
                                extractedData: normalizedData,
                                aiResults: result.data.testResults
                            }
                            : upload
                    ));

                    setPdfResults([normalizedData]);
                    setShowPdfResults(true);
                }
                
                return result.data.testResults;
            } else {
                throw new Error(result.data?.error || 'AI extraction failed');
            }
        } catch (error) {
            console.error('❌ AI extraction error:', error);
            enqueueSnackbar(`AI extraction failed: ${error.message}`, { variant: 'error' });
            
            // Update upload status to error
            setUploads(prev => prev.map(upload => 
                upload.id === file.uploadId || upload.fileName === file.name
                    ? { ...upload, processingStatus: 'error', error: error.message }
                    : upload
            ));
        }
    }, [functions, selectedCarrier, enqueueSnackbar]);

    const normalizeAIDataForTable = useCallback((extractedData, uploadFile, fullAiResults) => {
        if (!extractedData) return null;

        const totalAmount = extractedData.totalAmount || {};
        const charges = extractedData.charges || [];

        // Helper functions for charge mapping
        const mapChargeToCode = (description) => {
            const desc = description.toLowerCase();
            if (desc.includes('freight') || desc.includes('shipping') || desc.includes('transport')) return 'FRT';
            if (desc.includes('fuel') || desc.includes('surcharge')) return 'FSC';
            if (desc.includes('accessorial') || desc.includes('handling')) return 'ACC';
            if (desc.includes('border') || desc.includes('crossing')) return 'BOR';
            if (desc.includes('insurance') || desc.includes('protection')) return 'INS';
            return 'FRT'; // Default to freight
        };

        const normalizeChargeName = (description) => {
            const desc = description.toLowerCase();
            if (desc.includes('freight income')) return 'Freight';
            if (desc.includes('fuel')) return 'Fuel Surcharge';
            if (desc.includes('border')) return 'Border Fee';
            if (desc.includes('handling')) return 'Handling';
            if (desc.includes('insurance')) return 'Insurance';
            return description; // Return original if no mapping found
        };

        const shipment = {
            id: `ai-shipment-${Date.now()}`,
            shipmentId: extractedData.shipmentId || extractedData.trackingNumber || 'Unknown',
            trackingNumber: extractedData.trackingNumber || extractedData.shipmentId || 'Unknown',
            carrier: selectedCarrier,
            status: 'extracted',
            totalAmount: totalAmount.amount || 0,
            currency: totalAmount.currency || 'CAD',
            extractionConfidence: fullAiResults?.confidence || 0.8,
            charges: charges.map((charge, idx) => ({
                id: `ai-charge-${idx}`,
                code: mapChargeToCode(charge.description || `Charge ${idx + 1}`),
                name: normalizeChargeName(charge.description || `Charge ${idx + 1}`),
                description: charge.description || `Charge ${idx + 1}`,
                amount: charge.amount || 0,
                currency: totalAmount.currency || 'CAD',
                isExtracted: true
            })),
            shipFrom: extractedData.shipper || {},
            shipTo: extractedData.consignee || {},
            packageDetails: extractedData.packages || [],
            extractedAt: new Date(),
            fileName: uploadFile.name,
            source: 'ai_extraction'
        };

        return {
            uploadInfo: {
                fileName: uploadFile.name,
                uploadDate: new Date(),
                carrier: selectedCarrier,
                processingStatus: 'completed'
            },
            shipments: [shipment],
            summary: {
                totalShipments: 1,
                totalCharges: charges.length,
                totalAmount: totalAmount.amount || 0,
                currency: totalAmount.currency || 'CAD',
                extractionConfidence: fullAiResults?.confidence || 0.8
            },
            rawAiResults: fullAiResults
        };
    }, [selectedCarrier]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf']
        },
        multiple: true
    });

    const handleViewResults = async (upload) => {
        try {
            setSelectedUpload(upload);
            
            if (upload.extractedData) {
                setPdfResults([upload.extractedData]);
                } else {
                setPdfResults([]);
                }

                setShowPdfResults(true);
            } catch (error) {
            console.error('Error viewing results:', error);
            enqueueSnackbar('Failed to load results', { variant: 'error' });
        }
    };

    const handleClosePdfResults = () => {
        setShowPdfResults(false);
        setSelectedUpload(null);
    };

    const handleApproveAPResults = async (approvalData) => {
        try {
        setApproving(true);

            const approveAPInvoice = httpsCallable(functions, 'approveAPInvoice');
            const result = await approveAPInvoice({
                uploadId: selectedUpload?.id,
                approvalData: approvalData,
                // Remove companyId since uploads are global
                approvedBy: currentUser.email,
                approvedByCompany: companyIdForAddress
            });

            if (result.data?.success) {
                enqueueSnackbar('AP invoice approved successfully!', { variant: 'success' });
                handleClosePdfResults();
                loadUploads(); // Refresh the list
                } else {
                throw new Error(result.data?.error || 'Approval failed');
                }
            } catch (error) {
            console.error('Approval error:', error);
            enqueueSnackbar(`Approval failed: ${error.message}`, { variant: 'error' });
        } finally {
            setApproving(false);
        }
    };

    const renderUploadCard = (upload) => (
        <Card key={upload.id} elevation={0} sx={{ border: '1px solid #e5e7eb', mb: 2 }}>
                        <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                            {upload.fileName}
                                    </Typography>
                        <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                            {upload.uploadDate?.toLocaleDateString?.()} • {upload.carrier || 'No carrier'}
                                    </Typography>
                                </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                            <Chip
                            label={upload.processingStatus || 'pending'}
                                                                size="small"
                            color={
                                upload.processingStatus === 'completed' ? 'success' :
                                upload.processingStatus === 'error' ? 'error' :
                                upload.processingStatus === 'processing' ? 'warning' : 'default'
                            }
                                                                sx={{ fontSize: '10px' }}
                                                            />
                        
                        {upload.processingStatus === 'completed' && (
                                    <Button
                                        size="small"
                                variant="outlined"
                                onClick={() => handleViewResults(upload)}
                                sx={{ fontSize: '10px' }}
                            >
                                View Results
                                    </Button>
                                                            )}
                                                        </Box>
                                                    </Box>
                
                {upload.processingStatus === 'processing' && (
                    <LinearProgress sx={{ mt: 1 }} />
                )}
            </CardContent>
                            </Card>
    );

    return (
        <Box sx={{ width: '100%' }}>
            {/* Header */}
            <Box sx={{ px: 3, py: 2, mb: 3, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, fontSize: '22px' }}>
                    AP Processing
                                </Typography>
                <AdminBreadcrumb currentPage="AP Processing" />
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                    Select a trained carrier, upload an invoice, and the AI will extract all details automatically
                                </Typography>
                                        </Box>

            {/* Main Content */}
            <Box sx={{ px: 3 }}>
                {/* Carrier Selection */}
                <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                    <Typography variant="h6" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        1. Select Carrier
                                    </Typography>
                    <Autocomplete
                        value={trainedCarriers.find(c => c.id === selectedCarrier) || null}
                        onChange={(_, carrier) => setSelectedCarrier(carrier?.id || '')}
                        options={trainedCarriers}
                        getOptionLabel={(option) => option.name || ''}
                        loading={loadingCarriers}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Select Trained Carrier"
                                placeholder="Choose a carrier that has been trained for invoice processing"
                                                size="small"
                                InputProps={{
                                    ...params.InputProps,
                                    endAdornment: (
                                        <>
                                            {loadingCarriers && <CircularProgress size={20} />}
                                            {params.InputProps.endAdornment}
                                        </>
                                    )
                                }}
                            />
                        )}
                        sx={{ maxWidth: 400 }}
                    />
                            </Paper>

                {/* File Upload */}
                <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb' }}>
                    <Typography variant="h6" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        2. Upload Invoice
                                        </Typography>
                    
                    <Box
                        {...getRootProps()}
                                        sx={{
                            border: '2px dashed #d1d5db',
                            borderRadius: '8px',
                                            p: 4,
                                            textAlign: 'center',
                            cursor: selectedCarrier ? 'pointer' : 'not-allowed',
                            backgroundColor: isDragActive ? '#f3f4f6' : selectedCarrier ? '#ffffff' : '#f9fafb',
                            opacity: selectedCarrier ? 1 : 0.6,
                            transition: 'all 0.2s'
                        }}
                    >
                        <input {...getInputProps()} disabled={!selectedCarrier} />
                        <CloudUploadIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                                        <Typography variant="h6" sx={{ mb: 1, fontSize: '16px', fontWeight: 600 }}>
                            {isDragActive ? 'Drop files here' : 'Upload Invoice PDF'}
                                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            {selectedCarrier 
                                ? 'Drag & drop PDF files here, or click to select'
                                : 'Please select a carrier first'
                            }
                                        </Typography>
                                    </Box>
                                </Paper>

                {/* Recent Uploads */}
                <Paper elevation={0} sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                    <Typography variant="h6" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        Recent Uploads
                                    </Typography>
                    
                    {loading ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <CircularProgress size={24} />
                                </Box>
                    ) : uploads.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <DocumentIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                No uploads yet. Select a carrier and upload an invoice to get started.
                                    </Typography>
                                </Box>
                    ) : (
                                                    <Box>
                            {uploads.slice(0, 10).map(renderUploadCard)}
                                                    </Box>
                    )}
                                        </Paper>
                                                    </Box>

            {/* Results Dialog */}
            {showPdfResults && selectedUpload && (
                <Dialog
                    open={showPdfResults}
                    onClose={handleClosePdfResults}
                    maxWidth="lg"
                    fullWidth
                >
                <DialogTitle sx={{
                        fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        AP Processing Results - {selectedUpload.name}
                        <IconButton onClick={handleClosePdfResults} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                        {selectedUpload.aiResults && (
                            <TestResultsComparison
                                testResults={selectedUpload.aiResults}
                                expectedResults={null}
                            />
                        )}
                    </DialogContent>
                    <DialogActions sx={{ p: 2, gap: 1 }}>
                                    <Button
                                        variant="outlined"
                            onClick={handleClosePdfResults}
                                                        sx={{ fontSize: '12px' }}
                                                    >
                            Close
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            onClick={() => handleApproveAPResults(selectedUpload.extractedData)}
                            disabled={approving}
                            sx={{ fontSize: '12px' }}
                        >
                            {approving ? 'Approving...' : 'Approve for Billing'}
                        </Button>
                </DialogActions>
            </Dialog>
            )}
                                                </Box>
    );
};

export default APProcessing;
