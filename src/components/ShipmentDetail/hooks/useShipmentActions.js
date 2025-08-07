import { useState, useCallback } from 'react';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';
import html2pdf from 'html2pdf.js';
import { PDFDocument } from 'pdf-lib';
import { hasPermission, PERMISSIONS } from '../../../utils/rolePermissions';

export const useShipmentActions = (shipment, carrierData, shipmentDocuments = { labels: [], bol: [], other: [] }, viewPdfInModal, statusUpdateFunctions = {}, userRole = null) => {
    // Enhanced state for action buttons with individual loading states
    const [actionStates, setActionStates] = useState({
        printLabel: { loading: false, error: null },
        printBOL: { loading: false, error: null },
        printConfirmation: { loading: false, error: null },
        printShipment: { loading: false, error: null },
        refreshStatus: { loading: false, error: null },
        generateBOL: { loading: false, error: null },
        cancelShipment: { loading: false, error: null },
        regenerateBOL: { loading: false, error: null },
        regenerateConfirmation: { loading: false, error: null },
        editShipment: { loading: false, error: null },
        archiveShipment: { loading: false, error: null }
    });

    // Snackbar for user feedback
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Enhanced state for regeneration dialog with loading support
    const [regenerationDialog, setRegenerationDialog] = useState({
        open: false,
        isLoading: false,
        documentType: null,
        onViewDocument: null
    });

    // Helper to update action loading states
    const setActionLoading = useCallback((action, loading, error = null) => {
        setActionStates(prev => ({
            ...prev,
            [action]: { loading, error }
        }));
    }, []);

    // Helper to show snackbar messages
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    // Helper to show regeneration success dialog
    const showRegenerationDialog = useCallback((documentType, onViewDocument) => {
        setRegenerationDialog({
            open: true,
            isLoading: false,
            documentType,
            onViewDocument
        });
    }, []);

    // Helper to show regeneration loading dialog
    const showRegenerationLoading = useCallback((documentType) => {
        setRegenerationDialog({
            open: true,
            isLoading: true,
            documentType,
            onViewDocument: null
        });
    }, []);

    // Helper to close regeneration dialog
    const closeRegenerationDialog = useCallback(() => {
        setRegenerationDialog({
            open: false,
            isLoading: false,
            documentType: null,
            onViewDocument: null
        });
    }, []);

    // Helper function to multiply PDF labels
    const multiplyPdfLabels = useCallback(async (pdfArrayBuffer, quantity) => {
        try {
            const sourcePdf = await PDFDocument.load(pdfArrayBuffer);
            const targetPdf = await PDFDocument.create();

            // Get the first page from source PDF
            const [firstPage] = await targetPdf.copyPages(sourcePdf, [0]);
            const { width, height } = firstPage.getSize();

            // Add the page multiple times
            for (let i = 0; i < quantity; i++) {
                const [copiedPage] = await targetPdf.copyPages(sourcePdf, [0]);
                targetPdf.addPage(copiedPage);
            }

            return await targetPdf.save();
        } catch (error) {
            console.error('Error multiplying PDF labels:', error);
            throw error;
        }
    }, []);

    // Enhanced label handler with multiplicative printing
    const handlePrintLabel = useCallback(async () => {
        try {
            setActionLoading('printLabel', true);
            showSnackbar('Loading shipping labels...', 'info');

            const allDocs = [
                ...(shipmentDocuments.labels || []),
                ...(shipmentDocuments.other || []),
                ...(shipmentDocuments.documents || [])
            ];

            const actualLabels = allDocs.filter(doc => {
                const filename = (doc.filename || '').toLowerCase();
                const documentType = (doc.documentType || '').toLowerCase();

                const isBOL = filename.includes('bol') ||
                    filename.includes('billoflading') ||
                    filename.includes('bill_of_lading') ||
                    documentType.includes('bol') ||
                    documentType === 'bill_of_lading';

                const isConfirmation = filename.includes('confirmation') ||
                    filename.includes('carrier') ||
                    documentType === 'carrier_confirmation' ||
                    doc.docType === 7;

                if (isBOL || isConfirmation) return false;

                return filename.includes('label') ||
                    filename.includes('prolabel') ||
                    filename.includes('shipping_label') ||
                    documentType.includes('label') ||
                    documentType === 'shipping_label' ||
                    doc.docType === 1;
            });

            if (actualLabels.length > 0) {
                const selectedDoc = actualLabels[0];
                showSnackbar('Opening shipping label...', 'success');

                if (shipment?.packages?.length > 1) {
                    const multipliedPdfBuffer = await multiplyPdfLabels(selectedDoc.downloadUrl, shipment.packages.length);
                    const blob = new Blob([multipliedPdfBuffer], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);

                    await viewPdfInModal(
                        url,
                        `${selectedDoc.filename}_x${shipment.packages.length}`,
                        `Shipping Labels (${shipment.packages.length} copies) - ${shipment?.shipmentID}`,
                        'printLabel',
                        true
                    );
                } else {
                    await viewPdfInModal(
                        selectedDoc.id,
                        selectedDoc.filename,
                        `Shipping Label - ${shipment?.shipmentID}`,
                        'printLabel'
                    );
                }
            } else {
                const isQuickShip = shipment?.creationMethod === 'quickship';
                if (isQuickShip) {
                    showSnackbar('No shipping labels found. Labels should have been generated during QuickShip booking. Please contact support.', 'error');
                } else {
                    showSnackbar('No shipping labels found for this shipment', 'warning');
                }
            }

        } catch (error) {
            console.error('Error printing labels:', error);
            showSnackbar(`Failed to print labels: ${error.message}`, 'error');
        } finally {
            setActionLoading('printLabel', false);
        }
    }, [shipment?.id, shipment?.shipmentID, shipment?.creationMethod, shipmentDocuments, setActionLoading, showSnackbar, multiplyPdfLabels, viewPdfInModal]);

    // Enhanced BOL handler - ALWAYS show the LATEST regenerated BOL
    const handlePrintBOL = useCallback(async () => {
        try {
            setActionLoading('printBOL', true);
            showSnackbar('Loading Latest BOL...', 'info');

            const bolDocuments = shipmentDocuments.bol || [];

            if (bolDocuments.length > 0) {
                console.log('🔍 BOL Selection - Available BOL documents:', bolDocuments.map(doc => ({
                    id: doc.id,
                    filename: doc.filename,
                    isGeneratedBOL: doc.isGeneratedBOL,
                    docType: doc.docType,
                    carrier: doc.carrier,
                    metadata: doc.metadata,
                    createdAt: doc.createdAt,
                    regeneratedAt: doc.regeneratedAt,
                    version: doc.version,
                    isLatest: doc.isLatest
                })));

                // Smart BOL selection with priority for latest regenerated documents
                const sortedBOLs = [...bolDocuments].sort((a, b) => {
                    // Priority 1: Documents marked as latest
                    if (a.isLatest && !b.isLatest) return -1;
                    if (!a.isLatest && b.isLatest) return 1;
                    
                    // Priority 2: Higher version numbers (more recent regenerations)
                    const aVersion = a.version || 0;
                    const bVersion = b.version || 0;
                    if (aVersion !== bVersion) return bVersion - aVersion;
                    
                    // Priority 3: Most recently regenerated documents
                    const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                    const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                    if (aRegenTime && bRegenTime) {
                        return bRegenTime - aRegenTime;
                    }
                    if (aRegenTime && !bRegenTime) return -1;
                    if (!aRegenTime && bRegenTime) return 1;
                    
                    // Priority 4: SOLUSHIP naming convention (our standard format)
                    const aIsSoluship = (a.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                    const bIsSoluship = (b.filename || '').toUpperCase().startsWith('SOLUSHIP-');
                    if (aIsSoluship && !bIsSoluship) return -1;
                    if (!aIsSoluship && bIsSoluship) return 1;
                    
                    // Priority 5: Generated BOL flags
                    const aIsGenerated = a.isGeneratedBOL === true || a.metadata?.generated === true;
                    const bIsGenerated = b.isGeneratedBOL === true || b.metadata?.generated === true;
                    if (aIsGenerated && !bIsGenerated) return -1;
                    if (!aIsGenerated && bIsGenerated) return 1;
                    
                    // Priority 6: Newest creation date
                    const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                    const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                    return bCreatedTime - aCreatedTime;
                });

                const selectedBOL = sortedBOLs[0];
                
                console.log('✅ Selected LATEST BOL document:', {
                    id: selectedBOL.id,
                    filename: selectedBOL.filename,
                    isLatest: selectedBOL.isLatest,
                    version: selectedBOL.version,
                    regeneratedAt: selectedBOL.regeneratedAt,
                    isGeneratedBOL: selectedBOL.isGeneratedBOL,
                    selectionReason: selectedBOL.isLatest ? 'marked as latest' : 
                                    selectedBOL.version > 0 ? `version ${selectedBOL.version}` :
                                    selectedBOL.regeneratedAt ? 'recently regenerated' :
                                    (selectedBOL.filename || '').toUpperCase().startsWith('SOLUSHIP-') ? 'SOLUSHIP format' : 'fallback'
                });

                showSnackbar('Opening latest BOL...', 'success');

                await viewPdfInModal(
                    selectedBOL.id,
                    selectedBOL.filename,
                    `Bill of Lading - ${shipment?.shipmentID}`,
                    'printBOL'
                );
            } else {
                // No BOL documents found
                if (shipment?.creationMethod === 'quickship') {
                    showSnackbar('BOL not found. The document should have been generated during booking. Please contact support.', 'error');
                } else {
                    showSnackbar('No BOL document found for this shipment', 'warning');
                }
            }

        } catch (error) {
            console.error('Error printing BOL:', error);
            showSnackbar(`Failed to print BOL: ${error.message}`, 'error');
        } finally {
            setActionLoading('printBOL', false);
        }
    }, [shipment?.id, shipment?.shipmentID, shipment?.creationMethod, shipmentDocuments, setActionLoading, showSnackbar, viewPdfInModal]);

    // Enhanced Carrier Confirmation handler - ALWAYS show the LATEST regenerated confirmation
    const handlePrintConfirmation = useCallback(async () => {
        try {
            setActionLoading('printConfirmation', true);
            showSnackbar('Loading Latest Carrier Confirmation...', 'info');

            // Check all document collections for carrier confirmations
            const allDocs = [
                ...(shipmentDocuments.carrierConfirmations || []),
                ...(shipmentDocuments.documents || []),
                ...(shipmentDocuments.other || []),
                ...(shipmentDocuments.bol || []), // Sometimes confirmations are misclassified
                ...(shipmentDocuments.labels || []) // Sometimes confirmations are misclassified
            ];
            
            // Look for carrier confirmation documents with enhanced filtering
            const confirmationDocuments = allDocs.filter(doc => {
                const filename = (doc.filename || '').toLowerCase();
                const documentType = (doc.documentType || '').toLowerCase();
                
                return doc.docType === 7 || // Carrier confirmation type
                       documentType === 'carrier_confirmation' ||
                       filename.includes('carrier_confirmation') ||
                       filename.includes('carrier-confirmation') ||
                       (filename.includes('carrier') && filename.includes('confirmation')) ||
                       filename.includes('pickup_confirmation') ||
                       filename.includes('pickup-confirmation');
            });

            if (confirmationDocuments.length > 0) {
                console.log('🔍 Carrier Confirmation Selection - Available documents:', confirmationDocuments.map(doc => ({
                    id: doc.id,
                    filename: doc.filename,
                    docType: doc.docType,
                    documentType: doc.documentType,
                    carrier: doc.carrier,
                    createdAt: doc.createdAt,
                    regeneratedAt: doc.regeneratedAt,
                    version: doc.version,
                    isLatest: doc.isLatest
                })));

                // Smart Carrier Confirmation selection with priority for latest regenerated documents
                const sortedConfirmations = [...confirmationDocuments].sort((a, b) => {
                    // Priority 1: Documents marked as latest
                    if (a.isLatest && !b.isLatest) return -1;
                    if (!a.isLatest && b.isLatest) return 1;
                    
                    // Priority 2: Higher version numbers (more recent regenerations)
                    const aVersion = a.version || 0;
                    const bVersion = b.version || 0;
                    if (aVersion !== bVersion) return bVersion - aVersion;
                    
                    // Priority 3: Most recently regenerated documents
                    const aRegenTime = a.regeneratedAt?.toDate?.() || a.regeneratedAt || null;
                    const bRegenTime = b.regeneratedAt?.toDate?.() || b.regeneratedAt || null;
                    if (aRegenTime && bRegenTime) {
                        return bRegenTime - aRegenTime;
                    }
                    if (aRegenTime && !bRegenTime) return -1;
                    if (!aRegenTime && bRegenTime) return 1;
                    
                    // Priority 4: Carrier confirmation specific document types
                    if (a.docType === 7 && b.docType !== 7) return -1;
                    if (a.docType !== 7 && b.docType === 7) return 1;
                    
                    // Priority 5: Newest creation date
                    const aCreatedTime = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
                    const bCreatedTime = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
                    return bCreatedTime - aCreatedTime;
                });

                const selectedDoc = sortedConfirmations[0];
                
                console.log('✅ Selected LATEST carrier confirmation document:', {
                    id: selectedDoc.id,
                    filename: selectedDoc.filename,
                    docType: selectedDoc.docType,
                    documentType: selectedDoc.documentType,
                    isLatest: selectedDoc.isLatest,
                    version: selectedDoc.version,
                    regeneratedAt: selectedDoc.regeneratedAt,
                    selectionReason: selectedDoc.isLatest ? 'marked as latest' : 
                                    selectedDoc.version > 0 ? `version ${selectedDoc.version}` :
                                    selectedDoc.regeneratedAt ? 'recently regenerated' :
                                    selectedDoc.docType === 7 ? 'carrier confirmation type' : 'fallback'
                });

                showSnackbar('Opening latest carrier confirmation...', 'success');

                await viewPdfInModal(
                    selectedDoc.id,
                    selectedDoc.filename,
                    `Carrier Confirmation - ${shipment?.shipmentID}`,
                    'printConfirmation'
                );
            } else {
                // No carrier confirmation found
                if (shipment?.creationMethod === 'quickship') {
                    showSnackbar('Carrier confirmation not found. The document should have been generated during booking. Please contact support.', 'error');
                } else {
                    showSnackbar('No carrier confirmation document found for this shipment', 'warning');
                }
            }

        } catch (error) {
            console.error('Error printing carrier confirmation:', error);
            showSnackbar(`Failed to print carrier confirmation: ${error.message}`, 'error');
        } finally {
            setActionLoading('printConfirmation', false);
        }
    }, [shipment?.id, shipment?.shipmentID, shipment?.creationMethod, shipmentDocuments, setActionLoading, showSnackbar, viewPdfInModal]);

    // Enhanced shipment print handler
    const handlePrintShipment = useCallback(async () => {
        try {
            setActionLoading('printShipment', true);
            showSnackbar('Generating shipment PDF...', 'info');

            const element = document.getElementById('shipment-detail-content');
            if (!element) {
                throw new Error('Shipment detail content not found');
            }

            const opt = {
                margin: 0.5,
                filename: `shipment-${shipment?.shipmentID || shipment?.id}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false
                },
                jsPDF: {
                    unit: 'in',
                    format: 'a4',
                    orientation: 'portrait'
                }
            };

            await html2pdf().set(opt).from(element).save();
            showSnackbar('Shipment PDF downloaded successfully', 'success');
        } catch (error) {
            console.error('Error generating shipment PDF:', error);
            showSnackbar('Failed to generate shipment PDF: ' + error.message, 'error');
        } finally {
            setActionLoading('printShipment', false);
        }
    }, [shipment?.shipmentID, shipment?.id, setActionLoading, showSnackbar]);

    const handleRefreshStatus = useCallback(async () => {
        const { forceSmartRefresh, clearUpdateState, refreshShipment } = statusUpdateFunctions;
        
        if (!forceSmartRefresh) {
            showSnackbar('Status refresh functionality not available', 'warning');
            return;
        }

        try {
            setActionLoading('refreshStatus', true);
            clearUpdateState?.();
            showSnackbar('Checking shipment status...', 'info');

            const result = await forceSmartRefresh();

            if (result && result.success) {
                if (result.statusChanged) {
                    showSnackbar(
                        `Status updated: ${result.previousStatus} → ${result.newStatus}`,
                        'success'
                    );

                    // Refresh the shipment data to get updated information
                    refreshShipment?.();

                    // If tracking updates were also received, mention them
                    if (result.trackingUpdatesCount > 0) {
                        setTimeout(() => {
                            showSnackbar(
                                `${result.trackingUpdatesCount} new tracking events added to history`,
                                'info'
                            );
                        }, 2000);
                    }
                } else if (result.updated) {
                    if (result.trackingUpdatesCount > 0) {
                        showSnackbar(
                            `Status confirmed. ${result.trackingUpdatesCount} new tracking events added.`,
                            'success'
                        );
                    } else {
                        showSnackbar('Status confirmed - no new updates', 'success');
                    }
                    
                    // Refresh the shipment data even if status didn't change
                    refreshShipment?.();
                } else {
                    showSnackbar(result.reason || 'Status check skipped', 'info');
                }
            } else {
                const errorMessage = result?.error || 'Failed to refresh status';
                showSnackbar(`Failed to check status: ${errorMessage}`, 'error');
            }

        } catch (error) {
            console.error('Error in smart status refresh:', error);
            showSnackbar('Failed to refresh status. Please try again.', 'error');
        } finally {
            setActionLoading('refreshStatus', false);
        }
    }, [statusUpdateFunctions, setActionLoading, showSnackbar]);

    const handleCancelShipment = useCallback(async () => {
        // This is a placeholder - the actual cancel functionality
        // is handled by the CancelShipmentModal component  
        // The parent component should handle opening the cancel modal
        return true; // Indicate readiness for cancel operation
    }, []);

    // NEW: Document Regeneration Handlers
    const handleRegenerateBOL = useCallback(async (reason = 'User requested regeneration') => {
        try {
            // Show loading dialog immediately
            showRegenerationLoading('bol');
            setActionLoading('regenerateBOL', true);

            const regenerateBOLFunction = httpsCallable(functions, 'regenerateBOL');

            const result = await regenerateBOLFunction({
                shipmentId: shipment?.shipmentID || shipment?.id,
                firebaseDocId: shipment?.id,
                reason: reason
            });

            if (result.data && result.data.success) {
                // Trigger document refresh after successful regeneration
                if (statusUpdateFunctions.fetchShipmentDocuments) {
                    try {
                        await statusUpdateFunctions.fetchShipmentDocuments();
                        
                        // Update dialog to success state with VIEW button
                        showRegenerationDialog('bol', () => {
                            // This will trigger the BOL viewing function
                            handlePrintBOL();
                        });
                    } catch (error) {
                        console.error('Error refreshing documents:', error);
                        // Close loading dialog and show error
                        closeRegenerationDialog();
                        showSnackbar('BOL regenerated but failed to refresh document list. Please refresh the page.', 'warning');
                    }
                } else {
                    // Close loading dialog and show success message
                    closeRegenerationDialog();
                    showSnackbar('BOL document regenerated successfully!', 'success');
                }
            } else {
                throw new Error(result.data?.error || 'Failed to regenerate BOL');
            }

        } catch (error) {
            console.error('Error regenerating BOL:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            
            // Close loading dialog and show error
            closeRegenerationDialog();
            showSnackbar(`Failed to regenerate BOL: ${errorMessage}`, 'error');
            
            // Show additional help message
            setTimeout(() => {
                showSnackbar('Please try again or contact support if the issue persists', 'warning');
            }, 2000);
        } finally {
            setActionLoading('regenerateBOL', false);
        }
    }, [shipment?.shipmentID, shipment?.id, setActionLoading, showSnackbar, statusUpdateFunctions, showRegenerationDialog, showRegenerationLoading, closeRegenerationDialog, handlePrintBOL]);

    const handleRegenerateCarrierConfirmation = useCallback(async (reason = 'User requested regeneration') => {
        try {
            // Show loading dialog immediately
            showRegenerationLoading('carrierConfirmation');
            setActionLoading('regenerateConfirmation', true);

            console.log('🔍 REGENERATION DEBUG: Current carrier and shipment data:', {
                carrierData: carrierData,
                shipmentCarrier: shipment?.carrier,
                shipmentSelectedCarrier: shipment?.selectedCarrier,
                carrierDataKeys: carrierData ? Object.keys(carrierData) : [],
                carrierDataAccountNumber: carrierData?.accountNumber,
                carrierDataApiCredentials: carrierData?.apiCredentials,
                shipmentCreationMethod: shipment?.creationMethod
            });

            // Get carrier details from shipment or carrierData
            const carrierDetails = {
                name: carrierData?.name || shipment?.selectedCarrier || shipment?.carrier || 'Unknown Carrier',
                contactEmail: carrierData?.contactEmail || carrierData?.email || '',
                contactName: carrierData?.contactName || '',
                contactPhone: carrierData?.contactPhone || carrierData?.phone || '',
                accountNumber: carrierData?.accountNumber || '',
                apiCredentials: carrierData?.apiCredentials || {}
            };

            console.log('🔍 REGENERATION DEBUG: Constructed carrierDetails for cloud function:', carrierDetails);

            const regenerateConfirmationFunction = httpsCallable(functions, 'regenerateCarrierConfirmation');
            const result = await regenerateConfirmationFunction({
                shipmentId: shipment?.shipmentID || shipment?.id,
                firebaseDocId: shipment?.id,
                carrierDetails: carrierDetails,
                reason: reason
            });

            if (result.data && result.data.success) {
                // Trigger document refresh after successful regeneration
                if (statusUpdateFunctions.fetchShipmentDocuments) {
                    try {
                        await statusUpdateFunctions.fetchShipmentDocuments();
                        
                        // Update dialog to success state with VIEW button
                        showRegenerationDialog('carrierConfirmation', () => {
                            // This will trigger the carrier confirmation viewing function
                            handlePrintConfirmation();
                        });
                    } catch (error) {
                        console.error('Error refreshing documents:', error);
                        // Close loading dialog and show error
                        closeRegenerationDialog();
                        showSnackbar('Carrier confirmation regenerated but failed to refresh document list. Please refresh the page.', 'warning');
                    }
                } else {
                    // Close loading dialog and show success message
                    closeRegenerationDialog();
                    showSnackbar('Carrier confirmation regenerated successfully!', 'success');
                }
            } else {
                throw new Error(result.data?.error || 'Failed to regenerate carrier confirmation');
            }

        } catch (error) {
            console.error('Error regenerating carrier confirmation:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            
            // Close loading dialog and show error
            closeRegenerationDialog();
            showSnackbar(`Failed to regenerate carrier confirmation: ${errorMessage}`, 'error');
            
            // Show additional help message
            setTimeout(() => {
                showSnackbar('Please try again or contact support if the issue persists', 'warning');
            }, 2000);
        } finally {
            setActionLoading('regenerateConfirmation', false);
        }
    }, [shipment?.shipmentID, shipment?.id, carrierData, setActionLoading, showSnackbar, statusUpdateFunctions, showRegenerationDialog, showRegenerationLoading, closeRegenerationDialog, handlePrintConfirmation]);

    const handleEditShipment = useCallback(async () => {
        setActionLoading('editShipment', true);
        showSnackbar('Opening shipment editor...', 'info');
        
        // Set a timeout to simulate opening the modal
        setTimeout(() => {
            setActionLoading('editShipment', false);
            // The actual modal opening will be handled by the parent component
            // This function just needs to indicate that editing is starting
        }, 500);
    }, [setActionLoading, showSnackbar]);

    const handleArchiveShipment = useCallback(async () => {
        try {
            setActionLoading('archiveShipment', true);
            showSnackbar('Archiving shipment...', 'info');
            
            // Call the archive cloud function
            const archiveShipmentFunction = httpsCallable(functions, 'archiveShipment');
            const result = await archiveShipmentFunction({
                shipmentId: shipment?.shipmentID || shipment?.id,
                firebaseDocId: shipment?.id,
                reason: 'User requested archive from shipment detail'
            });

            if (result.data && result.data.success) {
                showSnackbar('Shipment archived successfully', 'success');
                
                // Refresh the shipment data to reflect the change
                if (statusUpdateFunctions.refreshShipment) {
                    await statusUpdateFunctions.refreshShipment();
                }
                
                // Optionally, navigate back to the shipments list after a delay
                // This will be handled by the parent component if needed
            } else {
                throw new Error(result.data?.error || 'Failed to archive shipment');
            }
        } catch (error) {
            console.error('Error archiving shipment:', error);
            const errorMessage = error.message || 'Unknown error occurred';
            showSnackbar(`Failed to archive shipment: ${errorMessage}`, 'error');
        } finally {
            setActionLoading('archiveShipment', false);
        }
    }, [shipment?.shipmentID, shipment?.id, setActionLoading, showSnackbar, statusUpdateFunctions]);

    // Check permissions for carrier confirmations
    const canViewCarrierConfirmations = hasPermission(userRole, PERMISSIONS.VIEW_CARRIER_CONFIRMATION);
    const canGenerateCarrierConfirmations = hasPermission(userRole, PERMISSIONS.GENERATE_CARRIER_CONFIRMATIONS);

    // TEMPORARY DEBUG: Log permission check for super admin
    if (userRole === 'superadmin') {
        console.log('🔐 SUPER ADMIN PERMISSIONS CHECK:', {
            userRole,
            canViewCarrierConfirmations,
            canGenerateCarrierConfirmations,
            shipmentId: shipment?.shipmentID,
            hasRegenerateFunction: !!handleRegenerateCarrierConfirmation
        });
    }

    return {
        actionStates,
        snackbar,
        regenerationDialog,
        handlePrintLabel,
        handlePrintBOL,
        // Only provide carrier confirmation functions if user has permissions
        handlePrintConfirmation: canViewCarrierConfirmations ? handlePrintConfirmation : null,
        handlePrintShipment,
        handleRefreshStatus,
        handleCancelShipment,
        handleRegenerateBOL,
        // Only provide regeneration function if user can generate confirmations
        handleRegenerateCarrierConfirmation: canGenerateCarrierConfirmations ? handleRegenerateCarrierConfirmation : null,
        handleEditShipment,
        handleArchiveShipment,
        showSnackbar,
        setSnackbar,
        setActionLoading,
        showRegenerationDialog,
        closeRegenerationDialog,
        // Add permission flags for UI components to check
        canViewCarrierConfirmations,
        canGenerateCarrierConfirmations
    };
};
