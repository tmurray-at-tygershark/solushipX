import { useState, useCallback } from 'react';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';
import html2pdf from 'html2pdf.js';
import { PDFDocument } from 'pdf-lib';

export const useShipmentActions = (shipment, carrierData, shipmentDocuments = { labels: [], bol: [], other: [] }, viewPdfInModal, statusUpdateFunctions = {}) => {
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

    // Enhanced BOL handler - ALWAYS show Generic BOL attached to email confirmations
    const handlePrintBOL = useCallback(async () => {
        try {
            setActionLoading('printBOL', true);
            showSnackbar('Loading Generic BOL...', 'info');

            const bolDocuments = shipmentDocuments.bol || [];

            if (bolDocuments.length > 0) {
                console.log('🔍 BOL Selection - Available BOL documents:', bolDocuments.map(doc => ({
                    id: doc.id,
                    filename: doc.filename,
                    isGeneratedBOL: doc.isGeneratedBOL,
                    docType: doc.docType,
                    carrier: doc.carrier,
                    metadata: doc.metadata
                })));

                // ALWAYS prioritize Generic BOL that's attached to email confirmations
                // Look for the SOLUSHIP-{shipmentID}-BOL.pdf pattern (Generic BOL)
                const genericBOL = bolDocuments.find(doc => {
                    const filename = (doc.filename || '').toUpperCase();
                    return filename.startsWith('SOLUSHIP-') && filename.endsWith('-BOL.PDF');
                });

                if (genericBOL) {
                    console.log('✅ Using Generic BOL (SOLUSHIP pattern):', {
                        id: genericBOL.id,
                        filename: genericBOL.filename,
                        isGeneratedBOL: genericBOL.isGeneratedBOL
                    });

                    showSnackbar('Opening Generic BOL...', 'success');

                    await viewPdfInModal(
                        genericBOL.id,
                        genericBOL.filename,
                        `Bill of Lading - ${shipment?.shipmentID}`,
                        'printBOL'
                    );
                } else {
                    // Fall back to any available BOL if no Generic BOL found
                    const fallbackBOL = bolDocuments[0];
                    console.log('⚠️ No Generic BOL found, using fallback BOL:', {
                        id: fallbackBOL.id,
                        filename: fallbackBOL.filename,
                        isGeneratedBOL: fallbackBOL.isGeneratedBOL
                    });

                    showSnackbar('Opening available BOL...', 'success');

                    await viewPdfInModal(
                        fallbackBOL.id,
                        fallbackBOL.filename,
                        `Bill of Lading - ${shipment?.shipmentID}`,
                        'printBOL'
                    );
                }
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

    // Carrier Confirmation handler - for QuickShip and manual carriers
    const handlePrintConfirmation = useCallback(async () => {
        try {
            setActionLoading('printConfirmation', true);
            showSnackbar('Loading Carrier Confirmation...', 'info');

            // Check all document collections for carrier confirmations
            const allDocs = [
                ...(shipmentDocuments.carrierConfirmations || []),
                ...(shipmentDocuments.documents || []),
                ...(shipmentDocuments.other || []),
                ...(shipmentDocuments.bol || []), // Sometimes confirmations are misclassified
                ...(shipmentDocuments.labels || []) // Sometimes confirmations are misclassified
            ];
            
            // Look for carrier confirmation documents
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
                    carrier: doc.carrier
                })));

                // Use the first available carrier confirmation document
                const selectedDoc = confirmationDocuments[0];
                
                console.log('✅ Selected carrier confirmation document:', {
                    id: selectedDoc.id,
                    filename: selectedDoc.filename,
                    docType: selectedDoc.docType,
                    documentType: selectedDoc.documentType
                });

                showSnackbar('Opening carrier confirmation...', 'success');

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

    return {
        actionStates,
        snackbar,
        regenerationDialog,
        handlePrintLabel,
        handlePrintBOL,
        handlePrintConfirmation,
        handlePrintShipment,
        handleRefreshStatus,
        handleCancelShipment,
        handleRegenerateBOL,
        handleRegenerateCarrierConfirmation,
        handleEditShipment,
        handleArchiveShipment,
        showSnackbar,
        setSnackbar,
        setActionLoading,
        showRegenerationDialog,
        closeRegenerationDialog
    };
};
