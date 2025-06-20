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
        cancelShipment: { loading: false, error: null }
    });

    // Snackbar for user feedback
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
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



    // Enhanced print label function with quantity and type selection
    const handlePrintLabel = useCallback(async (quantity = 1, labelType = '4x6') => {
        try {
            setActionLoading('printLabel', true);
            showSnackbar(`Generating ${quantity} label(s)...`, 'info');

            let labels = shipmentDocuments.labels || [];

            // Fallback: If no labels but we have other documents, try to find shipping documents
            if (labels.length === 0) {
                console.log('No labels found, searching all documents for shipping documents...');
                const allDocs = Object.values(shipmentDocuments).flat();

                const potentialLabels = allDocs.filter(doc => {
                    const filename = (doc.filename || '').toLowerCase();
                    const documentType = (doc.documentType || '').toLowerCase();

                    // Look for shipping-related documents
                    return filename.includes('label') ||
                        filename.includes('shipping') ||
                        filename.includes('ship') ||
                        filename.includes('print') ||
                        // Specific eShipPlus ProLabel patterns
                        filename.includes('prolabel') ||
                        filename.includes('pro-label') ||
                        filename.includes('prolabel4x6') ||
                        filename.includes('prolabelavery') ||
                        filename.includes('4x6inch') ||
                        filename.includes('3x4inch') ||
                        documentType.includes('label') ||
                        documentType.includes('shipping') ||
                        // For freight shipments, any PDF might be a label
                        (shipment?.shipmentInfo?.shipmentType === 'freight' &&
                            filename.includes('.pdf') &&
                            !filename.includes('bol') &&
                            !filename.includes('billoflading') &&
                            !filename.includes('invoice'));
                });

                if (potentialLabels.length > 0) {
                    console.log('Found potential shipping labels:', potentialLabels);
                    labels = potentialLabels;
                    showSnackbar('Found shipping documents to print', 'info');
                } else {
                    throw new Error('No shipping labels or documents available for this shipment');
                }
            }

            let selectedLabel = labels[0];

            // Check if this is an eShipPlus carrier
            const isEShipPlusCarrier = carrierData?.name?.toLowerCase().includes('eshipplus') ||
                carrierData?.carrierID === 'ESHIPPLUS';

            // For eShipPlus, select based on label type if multiple are available
            if (isEShipPlusCarrier && labels.length > 1) {
                const typeToSearch = labelType === 'Thermal' ? 'avery3x4' : labelType;
                const typeBasedLabel = labels.find(label => {
                    const isAvery = label.filename?.toLowerCase().includes('avery') ||
                        label.docType === 1 ||
                        label.metadata?.eshipplus?.docType === 1;
                    return typeToSearch === 'avery3x4' ? isAvery : !isAvery;
                });
                if (typeBasedLabel) selectedLabel = typeBasedLabel;
            }

            if (quantity === 1) {
                // Single label - view directly
                await viewPdfInModal(
                    selectedLabel.id,
                    selectedLabel.filename,
                    `${labelType.toUpperCase()} ${labels.length > 0 ? 'Label' : 'Document'} - ${shipment?.shipmentID}`,
                    'printLabel'
                );
            } else {
                // Multiple labels - fetch PDF, multiply, and show in modal
                const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
                const result = await getDocumentDownloadUrlFunction({
                    documentId: selectedLabel.id,
                    shipmentId: shipment?.id
                });

                if (result.data.success) {
                    const response = await fetch(result.data.downloadUrl);
                    const pdfArrayBuffer = await response.arrayBuffer();
                    const multipliedPdf = await multiplyPdfLabels(pdfArrayBuffer, quantity);

                    // Create blob URL for the multiplied PDF and use modal
                    const blob = new Blob([multipliedPdf], { type: 'application/pdf' });
                    const multipliedPdfUrl = URL.createObjectURL(blob);

                    // Use the modal instead of window.open
                    await viewPdfInModal(
                        null, // No document ID for generated PDF
                        `${quantity}x-${selectedLabel.filename}`,
                        `${quantity}x ${labelType.toUpperCase()} ${labels.length > 0 ? 'Labels' : 'Documents'} - ${shipment?.shipmentID}`,
                        'printLabel',
                        multipliedPdfUrl // Pass the blob URL directly
                    );
                } else {
                    throw new Error('Failed to get download URL');
                }
            }

            showSnackbar(`${quantity} ${labels.length > 0 ? 'label(s)' : 'document(s)'} ready for printing`, 'success');
        } catch (error) {
            console.error('Error printing label:', error);
            showSnackbar('Failed to print document: ' + error.message, 'error');
        } finally {
            setActionLoading('printLabel', false);
        }
    }, [shipment?.id, shipment?.shipmentID, carrierData, shipmentDocuments, setActionLoading, showSnackbar, multiplyPdfLabels, viewPdfInModal]);

    // Enhanced BOL handler - for QuickShip, BOL should already exist from booking process
    const handlePrintBOL = useCallback(async () => {
        try {
            setActionLoading('printBOL', true);
            showSnackbar('Loading Bill of Lading...', 'info');

            const bolDocuments = shipmentDocuments.bol || [];

            if (bolDocuments.length > 0) {
                // Enhanced BOL selection with priority for generated BOL
                console.log('🔍 BOL Selection - Available BOL documents:', bolDocuments.map(doc => ({
                    id: doc.id,
                    filename: doc.filename,
                    isGeneratedBOL: doc.isGeneratedBOL,
                    replacesApiBOL: doc.replacesApiBOL,
                    docType: doc.docType,
                    carrier: doc.carrier,
                    metadata: doc.metadata
                })));

                // Priority 1: Look for explicitly generated BOL with our flags
                let generatedBOL = bolDocuments.find(doc =>
                    doc.isGeneratedBOL === true ||
                    doc.metadata?.generated === true ||
                    doc.metadata?.eshipplus?.generated === true ||
                    doc.metadata?.polaris?.generated === true ||
                    doc.metadata?.canpar?.generated === true
                );

                // Priority 2: Look for BOL with generated filename pattern
                if (!generatedBOL) {
                    generatedBOL = bolDocuments.find(doc =>
                        doc.filename?.includes('-bol') ||
                        doc.filename?.includes('generated-bol') ||
                        doc.filename?.includes('professional-bol')
                    );
                }

                if (generatedBOL) {
                    console.log('✅ Selected generated BOL document:', {
                        id: generatedBOL.id,
                        filename: generatedBOL.filename,
                        isGeneratedBOL: generatedBOL.isGeneratedBOL,
                        carrier: generatedBOL.carrier
                    });

                    showSnackbar('Opening generated BOL...', 'success');

                    await viewPdfInModal(
                        generatedBOL.id,
                        generatedBOL.filename,
                        `Generated BOL - ${shipment?.shipmentID}`,
                        'printBOL'
                    );
                } else {
                    // No generated BOL found, use the first available BOL
                    showSnackbar('Opening BOL document...', 'success');
                    await viewPdfInModal(
                        bolDocuments[0].id,
                        bolDocuments[0].filename,
                        `BOL - ${shipment?.shipmentID}`,
                        'printBOL'
                    );
                }
            } else {
                // For QuickShip, BOL should have been generated during booking
                // If no BOL exists, something went wrong during the booking process
                if (shipment?.creationMethod === 'quickship') {
                    showSnackbar('BOL document not found. The BOL should have been generated during booking. Please contact support.', 'error');
                } else {
                    // For regular shipments, offer to generate BOL
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
                } else if (result.skipped) {
                    showSnackbar(result.reason || 'Status check skipped', 'info');
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
        showSnackbar('Cancel shipment functionality coming soon', 'info');
    }, [showSnackbar]);

    return {
        actionStates,
        snackbar,
        handlePrintLabel,
        handlePrintBOL,
        handlePrintConfirmation,
        handlePrintShipment,
        handleRefreshStatus,
        handleCancelShipment,
        showSnackbar,
        setSnackbar,
        setActionLoading
    };
};
