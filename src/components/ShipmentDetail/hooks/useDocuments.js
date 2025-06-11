import { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';

export const useDocuments = (shipmentId, shipmentStatus) => {
    const [shipmentDocuments, setShipmentDocuments] = useState({
        labels: [],
        bol: [],
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
                    other: documents.other?.length || 0,
                    allDocuments: Object.values(documents).flat().length
                });

                // Fallback: If no labels detected but we have "other" documents that might be labels
                if (documents.labels?.length === 0 && documents.other?.length > 0) {
                    console.log('No labels detected, checking "other" documents for potential labels...');

                    // Check if any "other" documents might be labels based on filename or metadata
                    const potentialLabels = documents.other.filter(doc => {
                        const filename = (doc.filename || '').toLowerCase();
                        const documentType = (doc.documentType || '').toLowerCase();

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
                            documentType.includes('shipping');
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