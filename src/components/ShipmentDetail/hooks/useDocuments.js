import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';

export const useDocuments = (shipmentId, shipmentStatus) => {
    const [shipmentDocuments, setShipmentDocuments] = useState({
        labels: [],
        bol: [],
        carrierConfirmations: [],
        documents: [],
        other: []
    });
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [documentsError, setDocumentsError] = useState(null);

    // Enhanced function to fetch shipment documents
    const fetchShipmentDocuments = useCallback(async () => {
        if (!shipmentId) {
            console.log('No shipment ID available for document fetch');
            return;
        }

        try {
            setDocumentsLoading(true);
            setDocumentsError(null);
            console.log('Fetching documents for shipment:', shipmentId);

            const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
            const result = await getShipmentDocumentsFunction({
                shipmentId: shipmentId,
                organized: true // Request organized structure
            });

            if (result.data && result.data.success) {
                const documents = result.data.data;

                console.log('Raw documents fetched:', result.data.metadata?.documentDetails);
                console.log('Categorized documents:', {
                    labels: documents.labels?.length || 0,
                    bol: documents.bol?.length || 0,
                    carrierConfirmations: documents.carrierConfirmations?.length || 0,
                    documents: documents.documents?.length || 0,
                    other: documents.other?.length || 0,
                    allDocuments: Object.values(documents).flat().length
                });

                // Debug: Log all documents with their key properties
                const allDocs = Object.values(documents).flat();
                console.log('🔍 All fetched documents details:', allDocs.map(doc => ({
                    id: doc.id,
                    filename: doc.filename,
                    documentType: doc.documentType,
                    docType: doc.docType,
                    category: Object.keys(documents).find(key => documents[key].includes(doc))
                })));

                // Enhanced categorization: Look for carrier confirmations in "other" category
                if (documents.other?.length > 0) {
                    console.log('Checking "other" documents for carrier confirmations...');
                    
                    const confirmationDocs = documents.other.filter(doc => {
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
                    
                    if (confirmationDocs.length > 0) {
                        console.log('Found carrier confirmations in "other" category:', confirmationDocs);
                        // Move confirmations to carrierConfirmations array
                        documents.carrierConfirmations = [...(documents.carrierConfirmations || []), ...confirmationDocs];
                        // Remove them from other
                        documents.other = documents.other.filter(doc =>
                            !confirmationDocs.some(conf => conf.id === doc.id)
                        );
                        console.log('Moved carrier confirmations. New counts:', {
                            carrierConfirmations: documents.carrierConfirmations.length,
                            other: documents.other.length
                        });
                    }
                }

                // Fallback: If no labels detected but we have "other" documents that might be labels
                if (documents.labels?.length === 0 && documents.other?.length > 0) {
                    console.log('No labels detected, checking "other" documents for potential labels...');

                    // Check if any "other" documents might be labels based on filename or metadata
                    const potentialLabels = documents.other.filter(doc => {
                        const filename = (doc.filename || '').toLowerCase();
                        const documentType = (doc.documentType || '').toLowerCase();

                        // Exclude BOL and carrier confirmation documents first
                        const isBOL = filename.includes('bol') || 
                                    filename.includes('billoflading') || 
                                    filename.includes('bill_of_lading') ||
                                    documentType.includes('bol') ||
                                    documentType === 'bill_of_lading';
                                    
                        const isConfirmation = filename.includes('confirmation') || 
                                             (filename.includes('carrier') && filename.includes('confirmation')) ||
                                             documentType === 'carrier_confirmation' ||
                                             doc.docType === 7;
                        
                        if (isBOL || isConfirmation) {
                            return false; // Don't move BOL or confirmation docs to labels
                        }

                        // Only look for actual shipping labels with specific patterns
                        return (filename.includes('label') && !filename.includes('confirmation')) ||
                               filename.includes('shipping_label') ||
                               // Specific eShipPlus ProLabel patterns
                               filename.includes('prolabel') ||
                               filename.includes('pro-label') ||
                               filename.includes('prolabel4x6') ||
                               filename.includes('prolabelavery') ||
                               filename.includes('4x6inch') ||
                               filename.includes('3x4inch') ||
                               (documentType.includes('label') && !documentType.includes('confirmation')) ||
                               documentType === 'shipping_label' ||
                               doc.docType === 1; // eShipPlus label type
                    });

                    if (potentialLabels.length > 0) {
                        console.log('Found potential labels in "other" category:', potentialLabels);
                        // Move potential labels to the labels array
                        documents.labels = [...(documents.labels || []), ...potentialLabels];
                        // Remove them from other
                        documents.other = documents.other.filter(doc =>
                            !potentialLabels.some(label => label.id === doc.id)
                        );
                        console.log('Moved potential labels to labels category. New counts:', {
                            labels: documents.labels.length,
                            other: documents.other.length
                        });
                    }
                }

                setShipmentDocuments(documents);

                console.log('Documents fetched successfully with fallback processing:', {
                    labels: documents.labels?.length || 0,
                    bol: documents.bol?.length || 0,
                    other: documents.other?.length || 0,
                    metadata: result.data.metadata
                });
            } else {
                throw new Error(result.data?.error || 'Failed to fetch documents');
            }

        } catch (error) {
            console.error('Error fetching shipment documents:', error);
            setDocumentsError(error.message);
            // Set empty structure on error
            setShipmentDocuments({
                labels: [],
                bol: [],
                carrierConfirmations: [],
                documents: [],
                other: []
            });
        } finally {
            setDocumentsLoading(false);
        }
    }, [shipmentId]);

    // Effect to fetch shipment documents
    useEffect(() => {
        // Fetch documents for all shipments except draft status
        if (shipmentId && shipmentStatus !== 'draft') {
            fetchShipmentDocuments();
        }
    }, [shipmentId, shipmentStatus, fetchShipmentDocuments]);

    return {
        shipmentDocuments,
        documentsLoading,
        documentsError,
        fetchShipmentDocuments
    };
}; 