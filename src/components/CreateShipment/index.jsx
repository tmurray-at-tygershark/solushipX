import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { ShipmentFormProvider, useShipmentForm, initialFormState as contextInitialFormState } from '../../contexts/ShipmentFormContext';
import { doc, getDoc, collection, query, where, getDocs, limit, serverTimestamp, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import StepperComponent from './Stepper';
import ShipmentInfo from './ShipmentInfo';
import ShipFrom from './ShipFrom';
import ShipTo from './ShipTo';
import Packages from './Packages';
import Rates from './Rates';
import Review from './Review';
import './CreateShipment.css';
import { Paper, Box, Typography, Button, CircularProgress } from '@mui/material';
import ShipmentAgent from '../ShipmentAgent/ShipmentAgent';
import { CheckCircle, Error } from '@mui/icons-material';

// API key should be loaded from environment variables with a fallback
// Ensure the API key is properly formatted and has no whitespace
const RAW_API_KEY = process.env.REACT_APP_SOLUSHIPX_API_KEY || 'e61c3e150511db70aa0f2d2476ab8511';
const API_KEY = RAW_API_KEY ? RAW_API_KEY.trim() : 'e61c3e150511db70aa0f2d2476ab8511';

// Validate API key - ensure it's not empty or just whitespace
if (!API_KEY || API_KEY.trim() === '') {
    console.error('CRITICAL ERROR: API key is missing or invalid in CreateShipment component');
}

// Force it to the hardcoded value if there's any doubt
console.log(`API Key set to hardcoded value: ${API_KEY === 'e61c3e150511db70aa0f2d2476ab8511'}`);

// Log the API key status (but not the actual key value) for debugging
console.log('API Key Status in CreateShipment:', {
    fromEnv: !!process.env.REACT_APP_SOLUSHIPX_API_KEY,
    keyLength: API_KEY?.length || 0,
    keyStart: API_KEY ? API_KEY.substring(0, 5) : 'undefined',
    keyEnd: API_KEY ? API_KEY.substring(API_KEY.length - 5) : 'undefined',
    isValid: !!(API_KEY && API_KEY.trim() !== '')
});

// Step mapping constants
const STEPS = {
    'shipment-info': 1,
    'ship-from': 2,
    'ship-to': 3,
    'packages': 4,
    'rates': 5,
    'review': 6
};

const STEP_SLUGS = {
    1: 'shipment-info',
    2: 'ship-from',
    3: 'ship-to',
    4: 'packages',
    5: 'rates',
    6: 'review'
};

// Map URL slugs to the actual camelCase keys used in formData and Firestore
const SLUG_TO_FORMDATA_KEY_MAP = {
    'shipment-info': 'shipmentInfo',
    'ship-from': 'shipFrom',
    'ship-to': 'shipTo',
    'packages': 'packages',
    'rates': 'selectedRate', // Assuming the rates step primarily saves/updates the selectedRate
    // 'review': 'reviewData' // If review step needs to save something specific
};

const emptyAddress = () => ({
    company: '', name: '', attention: '', street: '', street2: '', city: '',
    state: '', postalCode: '', country: 'US', contactName: '',
    contactPhone: '', contactEmail: '', specialInstructions: ''
});

// Component that uses the context
const CreateShipmentContent = () => {
    const { step: urlStep, draftId: urlDraftId } = useParams();
    const navigate = useNavigate();
    const { currentUser, loading: authLoading } = useAuth();
    const { companyData, companyIdForAddress, loading: companyLoading, error: companyError } = useCompany();
    const { formData, updateFormSection, setFormData, setDraftShipmentIdentifiers, clearFormData } = useShipmentForm();

    const [currentStep, setCurrentStep] = useState(urlStep ? STEPS[urlStep] || 1 : 1);
    const [isStepLoading, setIsStepLoading] = useState(false);
    const [isDraftProcessing, setIsDraftProcessing] = useState(true);
    const [error, setError] = useState(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const hasLoggedVersion = useRef(false);
    const isNavigating = useRef(false);
    const [activeDraftId, setActiveDraftId] = useState(null);
    const [dataCompleteness, setDataCompleteness] = useState({
        shipmentInfo: { complete: false, missing: [] },
        shipFrom: { complete: false, missing: [] },
        shipTo: { complete: false, missing: [] },
        packages: { complete: false, missing: [] },
        rates: { complete: false, missing: [] }
    });

    console.log(`CreateShipmentContent RENDER: urlStep: ${urlStep}, urlDraftId: ${urlDraftId}, activeDraftId: ${activeDraftId}, isDraftProcessing: ${isDraftProcessing}, currentStep: ${currentStep}`);

    useEffect(() => {
        if (!hasLoggedVersion.current) {
            console.log('🚀 SolushipX React App - CreateShipment v0.3.3');
            hasLoggedVersion.current = true;
        }
    }, []);

    // Function to check if a shipment already exists (either as draft or completed)
    const checkShipmentExists = useCallback(async (draftId) => {
        if (!draftId || !companyIdForAddress) return false;

        try {
            console.log(`CreateShipment: Checking if shipment ${draftId} already exists...`);

            // First check if the document exists by ID
            const draftDocRef = doc(db, 'shipments', draftId);
            const draftDocSnap = await getDoc(draftDocRef);

            if (draftDocSnap.exists()) {
                const shipmentData = draftDocSnap.data();
                console.log(`CreateShipment: Found existing shipment with ID ${draftId}:`, {
                    status: shipmentData.status,
                    shipmentID: shipmentData.shipmentID,
                    companyID: shipmentData.companyID
                });
                return shipmentData;
            }

            // Also check by shipmentID in case it's a readable ID
            const shipmentQuery = query(
                collection(db, 'shipments'),
                where('shipmentID', '==', draftId),
                where('companyID', '==', companyIdForAddress),
                limit(1)
            );

            const querySnapshot = await getDocs(shipmentQuery);
            if (!querySnapshot.empty) {
                const shipmentData = querySnapshot.docs[0].data();
                console.log(`CreateShipment: Found existing shipment by shipmentID ${draftId}:`, {
                    status: shipmentData.status,
                    firestoreId: querySnapshot.docs[0].id,
                    companyID: shipmentData.companyID
                });
                return shipmentData;
            }

            console.log(`CreateShipment: No existing shipment found for ID ${draftId}`);
            return false;
        } catch (err) {
            console.error(`CreateShipment: Error checking if shipment exists:`, err);
            return false;
        }
    }, [companyIdForAddress]);

    const createNewDraftInternal = async () => {
        console.log("CreateShipment: Attempting to create NEW draft shipment locally...");
        if (!currentUser || !companyIdForAddress) {
            console.error("CreateShipment: Missing user or companyIdForAddress for new draft.");
            setError("Cannot create draft: Missing user or company information.");
            setIsDraftProcessing(false);
            return null;
        }
        try {
            const newShipmentID = `${companyIdForAddress}-DRAFT-${Date.now()}`;

            // Check if a shipment with this ID already exists
            const existingShipment = await checkShipmentExists(newShipmentID);
            if (existingShipment) {
                console.error(`CreateShipment: Shipment with ID ${newShipmentID} already exists!`);
                setError(`Cannot create shipment: ID ${newShipmentID} already exists. Please try again.`);
                setIsDraftProcessing(false);
                return null;
            }

            const initialShipmentData = {
                shipmentID: newShipmentID,
                companyID: companyIdForAddress,
                status: 'draft',
                creatorUid: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                shipFrom: { ...emptyAddress(), company: companyData?.name || '' },
                shipTo: emptyAddress(),
                packages: [{}],
                shipmentInfo: { shipmentDate: new Date().toISOString().split('T')[0] },
                rateDetails: {},
            };
            const docRef = await addDoc(collection(db, 'shipments'), initialShipmentData);
            setDraftShipmentIdentifiers(docRef.id, newShipmentID);
            setActiveDraftId(docRef.id);
            updateFormSection('shipFrom', initialShipmentData.shipFrom);
            updateFormSection('shipTo', initialShipmentData.shipTo);
            updateFormSection('packages', initialShipmentData.packages);
            updateFormSection('shipmentInfo', initialShipmentData.shipmentInfo);
            console.log("CreateShipment: New draft created:", { firestoreDocId: docRef.id, readableShipmentID: newShipmentID });
            return docRef.id;
        } catch (err) {
            console.error("CreateShipment: Error creating new draft:", err);
            setError(err.message || 'Error creating new draft shipment.');
            setIsDraftProcessing(false);
            return null;
        }
    };

    useEffect(() => {
        if (authLoading || companyLoading) return;
        if (!currentUser) {
            setError("Authentication required to create or load a shipment.");
            setIsDraftProcessing(false);
            return;
        }
        if (!companyIdForAddress) {
            console.log("CreateShipment: Waiting for companyIdForAddress for draft management...");
            return;
        }

        const manageDraftLogic = async () => {
            console.log(`CreateShipment manageDraftLogic START: urlDraftId: ${urlDraftId}, current activeDraftId: ${activeDraftId}, formData.draftId: ${formData.draftFirestoreDocId}`);
            setIsDraftProcessing(true);

            if (urlDraftId) {
                if (urlDraftId === activeDraftId && formData.draftFirestoreDocId === urlDraftId) {
                    console.log("CreateShipment: urlDraftId matches activeDraftId & context draftId. Draft already managed.");
                    setIsDraftProcessing(false);
                    return;
                }
                console.log(`CreateShipment: Attempting to load draft. URL Draft ID: ${urlDraftId}, Current Company ID for context: ${companyIdForAddress}`);
                try {
                    const draftDocRef = doc(db, 'shipments', urlDraftId);
                    console.log(`CreateShipment: Firestore document reference path: ${draftDocRef.path}`);
                    const draftDocSnap = await getDoc(draftDocRef);
                    console.log("CreateShipment: Received draftDocSnap from Firestore:", draftDocSnap);

                    console.log(`CreateShipment: draftDocSnap.exists property value: ${draftDocSnap.exists}`);
                    console.log(`CreateShipment: typeof draftDocSnap.exists: ${typeof draftDocSnap.exists}`);

                    if (draftDocSnap.exists()) {
                        console.log("CreateShipment: Draft document exists. Attempting to get data...");
                        let draftData = null;
                        try {
                            draftData = draftDocSnap.data();
                            console.log("CreateShipment: Successfully got draftData:", draftData);
                        } catch (dataError) {
                            console.error("CreateShipment: Error calling draftDocSnap.data():", dataError);
                            throw new Error(`Failed to deserialize draft data: ${dataError.message}`);
                        }

                        if (draftData.status === 'draft' && draftData.companyID === companyIdForAddress) {
                            console.log("CreateShipment: Draft is valid and belongs to company. Populating form...");

                            // Enhanced draft data processing with proper fallbacks
                            const processedDraftData = {
                                draftFirestoreDocId: urlDraftId,
                                readableShipmentID: draftData.shipmentID,

                                // ShipmentInfo with proper fallbacks
                                shipmentInfo: {
                                    shipmentType: draftData.shipmentInfo?.shipmentType || 'LTL',
                                    internationalShipment: draftData.shipmentInfo?.internationalShipment || false,
                                    shipperReferenceNumber: draftData.shipmentInfo?.shipperReferenceNumber || '',
                                    bookingReferenceNumber: draftData.shipmentInfo?.bookingReferenceNumber || '',
                                    bookingReferenceType: draftData.shipmentInfo?.bookingReferenceType || 'PO',
                                    shipmentBillType: draftData.shipmentInfo?.shipmentBillType || 'PREPAID',
                                    shipmentDate: draftData.shipmentInfo?.shipmentDate || new Date().toISOString().split('T')[0],
                                    earliestPickupTime: draftData.shipmentInfo?.earliestPickupTime || '09:00',
                                    latestPickupTime: draftData.shipmentInfo?.latestPickupTime || '17:00',
                                    earliestDeliveryTime: draftData.shipmentInfo?.earliestDeliveryTime || '09:00',
                                    latestDeliveryTime: draftData.shipmentInfo?.latestDeliveryTime || '17:00',
                                    dangerousGoodsType: draftData.shipmentInfo?.dangerousGoodsType || 'none',
                                    signatureServiceType: draftData.shipmentInfo?.signatureServiceType || 'none',
                                    holdForPickup: draftData.shipmentInfo?.holdForPickup || false,
                                    saturdayDelivery: draftData.shipmentInfo?.saturdayDelivery || false,
                                    notes: draftData.shipmentInfo?.notes || ''
                                },

                                // ShipFrom with proper fallbacks
                                shipFrom: {
                                    ...emptyAddress(),
                                    company: draftData.shipFrom?.company || companyData?.name || '',
                                    ...draftData.shipFrom
                                },

                                // ShipTo with proper fallbacks
                                shipTo: {
                                    ...emptyAddress(),
                                    ...draftData.shipTo
                                },

                                // Packages with proper fallbacks
                                packages: Array.isArray(draftData.packages) && draftData.packages.length > 0
                                    ? draftData.packages
                                    : [{}],

                                // Rate data
                                selectedRate: draftData.selectedRate || null,
                                rateDetails: draftData.rateDetails || {}
                            };

                            console.log("CreateShipment: Processed draft data with fallbacks:", processedDraftData);

                            // Use the enhanced setFormData that properly merges with initial state
                            setFormData(processedDraftData);
                            setDraftShipmentIdentifiers(urlDraftId, draftData.shipmentID);
                            setActiveDraftId(urlDraftId);
                            console.log("CreateShipment: Draft loading completed successfully");
                        } else {
                            console.error("CreateShipment: Draft not valid or access denied.", { draftStatus: draftData.status, draftCompanyID: draftData.companyID, contextCompanyID: companyIdForAddress });
                            throw new Error("Draft not valid or access denied.");
                        }
                    } else {
                        console.error(`CreateShipment: No draft shipment found with ID in Firestore: ${urlDraftId}`);
                        throw new Error(`No draft shipment found with ID: ${urlDraftId}.`);
                    }
                } catch (err) {
                    console.error("CreateShipment: Error loading draft in try/catch:", err, "Raw error object:", JSON.stringify(err));

                    // Check if this shipment exists before attempting to create a new one
                    const existingShipment = await checkShipmentExists(urlDraftId);

                    // Construct a more informative error message
                    let displayError = err.message || 'Unknown error loading draft.';
                    if (err.name && err.message) {
                        displayError = `${err.name}: ${err.message}`;
                    } else if (typeof err === 'string') {
                        displayError = err;
                    }

                    if (existingShipment) {
                        // Shipment exists but we couldn't load it properly - show error without creating new one
                        if (existingShipment.status === 'processing' || existingShipment.status === 'completed') {
                            setError(`Shipment ${urlDraftId} has already been processed and cannot be edited. Status: ${existingShipment.status}`);
                        } else if (existingShipment.companyID !== companyIdForAddress) {
                            setError(`Access denied: Shipment ${urlDraftId} belongs to a different company.`);
                        } else {
                            setError(`Error loading shipment ${urlDraftId}: ${displayError}. Please try refreshing the page or contact support.`);
                        }
                        setIsDraftProcessing(false);
                        return; // Don't create a new shipment
                    } else {
                        // No existing shipment found - safe to create a new one
                        console.log(`CreateShipment: No existing shipment found for ${urlDraftId}, creating new draft as fallback.`);
                        setError(`${displayError} Creating a new shipment instead.`);
                        clearFormData();
                        setActiveDraftId(null);
                        await createNewDraftInternal();
                    }
                }
            } else {
                if (!activeDraftId || !formData.draftFirestoreDocId) {
                    console.log("CreateShipment: No urlDraftId and no active/context draftId. Creating new draft.");
                    clearFormData();
                    await createNewDraftInternal();
                } else {
                    console.log(`CreateShipment: No urlDraftId, but an active draft (ID: ${activeDraftId || formData.draftFirestoreDocId}) seems to exist. Ensuring URL reflects this for step 1.`);
                    if (activeDraftId || formData.draftFirestoreDocId) {
                        const currentActiveDraft = activeDraftId || formData.draftFirestoreDocId;
                        if (!isNavigating.current) {
                            navigate(`/create-shipment/shipment-info/${currentActiveDraft}`, { replace: true });
                        }
                    }
                }
            }
            setIsDraftProcessing(false);
        };

        manageDraftLogic();
    }, [
        authLoading, companyLoading, currentUser, companyIdForAddress, urlDraftId,
        companyData?.name, clearFormData, setFormData, setDraftShipmentIdentifiers,
        checkShipmentExists,
    ]);

    useEffect(() => {
        // ---- START TEMPORARY TEST: Comment out body of this effect ----
        // console.log("CreateShipment: Default origin effect triggered. isDraftProcessing:", isDraftProcessing, "activeDraftId:", activeDraftId, "companyData:", !!companyData, "companyIdForAddress:", companyIdForAddress);
        // if (isDraftProcessing || !activeDraftId || !companyData || !companyIdForAddress) {
        //     // console.log("CreateShipment: Default origin effect - bailing early.");
        //     return;
        // }
        // if (formData.shipFrom && (formData.shipFrom.id || formData.shipFrom.street)) {
        //     console.log("CreateShipment: ShipFrom already populated, skipping default address fetch.");
        //     return;
        // }
        // const fetchAndSetDefaultOrigin = async () => {
        //     console.log(`CreateShipment: Potentially setting default origin for draft ${activeDraftId} as shipFrom is empty.`);
        //     setIsStepLoading(true);
        //     try {
        //         const addressesQuery = query(
        //             collection(db, 'addressBook'),
        //             where('addressClass', '==', 'company'),
        //             where('addressType', '==', 'origin'),
        //             where('addressClassID', '==', companyIdForAddress)
        //         );
        //         const addressesSnapshot = await getDocs(addressesQuery);
        //         if (!addressesSnapshot.empty) {
        //             const shipFromAddresses = addressesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        //             const defaultAddressDoc = shipFromAddresses.find(addr => addr.isDefault) || shipFromAddresses[0];
        //             if (defaultAddressDoc) {
        //                 const defaultSelectedOrigin = {
        //                     id: defaultAddressDoc.id,
        //                     company: defaultAddressDoc.companyName || companyData.name || '',
        //                     name: defaultAddressDoc.nickname || '',
        //                     attention: `${defaultAddressDoc.firstName || ''} ${defaultAddressDoc.lastName || ''}`.trim(),
        //                     street: defaultAddressDoc.address1 || '',
        //                     street2: defaultAddressDoc.address2 || '',
        //                     city: defaultAddressDoc.city || '',
        //                     state: defaultAddressDoc.stateProv || '',
        //                     postalCode: defaultAddressDoc.zipPostal || '',
        //                     country: defaultAddressDoc.country || 'US',
        //                     contactName: `${defaultAddressDoc.firstName || ''} ${defaultAddressDoc.lastName || ''}`.trim(),
        //                     contactPhone: defaultAddressDoc.phone || '',
        //                     contactEmail: defaultAddressDoc.email || '',
        //                     specialInstructions: defaultAddressDoc.specialInstructions || ''
        //                 };
        //                 console.log("CreateShipment: Applying default origin address:", defaultSelectedOrigin);
        //                 updateFormSection('shipFrom', defaultSelectedOrigin);
        //                 const shipmentDocRef = doc(db, 'shipments', activeDraftId);
        //                 await updateDoc(shipmentDocRef, { shipFrom: defaultSelectedOrigin, updatedAt: serverTimestamp() });
        //                 console.log(`CreateShipment: Default origin saved to draft ${activeDraftId}`);
        //             }
        //         }
        //     } catch (err) {
        //         console.error("CreateShipment: Error setting default origin address:", err);
        //     } finally {
        //         setIsStepLoading(false);
        //     }
        // };
        // if (!(formData.shipFrom?.id || formData.shipFrom?.street)) {
        //     fetchAndSetDefaultOrigin();
        // }
        console.log("CreateShipment: TEST - Default origin fetching logic is currently commented out.");
        // ---- END TEMPORARY TEST ----
    }, [isDraftProcessing, activeDraftId, companyData, companyIdForAddress, formData.shipFrom, updateFormSection]);

    useEffect(() => {
        if (companyError) setError(companyError);
    }, [companyError]);

    // Effect to update shipmentID when a customer is selected
    useEffect(() => {
        const updateShipmentIdWithCustomer = async () => {
            // Only regenerate if we have all required data and current ID is still a draft
            if (activeDraftId &&
                companyIdForAddress &&
                formData.shipTo?.customerID &&
                formData.readableShipmentID &&
                formData.readableShipmentID.includes('-DRAFT-')) {

                console.log("CreateShipment: Customer selected, regenerating shipmentID from draft format", {
                    companyId: companyIdForAddress,
                    customerId: formData.shipTo.customerID,
                    currentReadableId: formData.readableShipmentID
                });

                // Generate timestamp components for unique ID
                const now = new Date();
                const MM = String(now.getMonth() + 1).padStart(2, '0');
                const DD = String(now.getDate()).padStart(2, '0');
                const YY = String(now.getFullYear()).slice(-2);
                const HH = String(now.getHours()).padStart(2, '0');
                const MIN = String(now.getMinutes()).padStart(2, '0');
                const SS = String(now.getSeconds()).padStart(2, '0');
                const MMM = String(now.getMilliseconds()).padStart(3, '0');

                // Create new shipment ID with customer-based format
                const newShipmentID = `${companyIdForAddress}-${formData.shipTo.customerID}-${MM}${DD}${YY}${HH}${MIN}${SS}${MMM}`;

                try {
                    // Check if this new ID already exists (very unlikely but good to check)
                    const existingShipment = await checkShipmentExists(newShipmentID);
                    if (existingShipment) {
                        console.warn(`CreateShipment: Generated shipment ID ${newShipmentID} already exists. Using fallback.`);
                        // Add additional milliseconds as fallback
                        const fallbackId = `${newShipmentID}-${Date.now()}`;
                        const shipmentDocRef = doc(db, 'shipments', activeDraftId);
                        await updateDoc(shipmentDocRef, {
                            shipmentID: fallbackId,
                            updatedAt: serverTimestamp()
                        });
                        setDraftShipmentIdentifiers(activeDraftId, fallbackId);
                        console.log(`CreateShipment: Used fallback shipmentID: ${fallbackId}`);
                    } else {
                        // Update Firestore with new shipment ID
                        const shipmentDocRef = doc(db, 'shipments', activeDraftId);
                        await updateDoc(shipmentDocRef, {
                            shipmentID: newShipmentID,
                            updatedAt: serverTimestamp()
                        });

                        // Update context with new identifiers
                        setDraftShipmentIdentifiers(activeDraftId, newShipmentID);
                        console.log(`CreateShipment: Successfully regenerated shipmentID to ${newShipmentID} for draft ${activeDraftId}`);
                    }
                } catch (err) {
                    console.error("CreateShipment: Error regenerating shipmentID:", err);
                    setError(`Failed to update shipment ID: ${err.message}`);
                }
            }
        };

        updateShipmentIdWithCustomer();
    }, [formData.shipTo?.customerID, activeDraftId, companyIdForAddress, formData.readableShipmentID, setDraftShipmentIdentifiers, checkShipmentExists]);

    useEffect(() => {
        const targetStep = urlStep ? STEPS[urlStep] : 1;
        console.log(`URL Sync/Step Logic: urlStep: ${urlStep}, targetStep: ${targetStep}, currentStep: ${currentStep}, isNavigating: ${isNavigating.current}, activeDraftId: ${activeDraftId}, isDraftProcessing: ${isDraftProcessing}`);

        if (!isNavigating.current && targetStep !== currentStep) {
            console.log(`URL Sync: Setting currentStep from ${currentStep} to ${targetStep}`);
            setCurrentStep(targetStep);
        }

        if (!urlStep && !isDraftProcessing) {
            if (activeDraftId) {
                console.log(`URL Sync: No urlStep, activeDraftId ${activeDraftId} found. Navigating to its shipment-info.`);
                navigate(`/create-shipment/shipment-info/${activeDraftId}`, { replace: true });
            } else if (currentStep !== 1) {
                console.log("URL Sync: No urlStep, no activeDraftId. Navigating to base shipment-info for new draft creation.");
                navigate('/create-shipment/shipment-info', { replace: true });
            }
        }
    }, [urlStep, activeDraftId, isDraftProcessing, currentStep, navigate]);

    const handleStepSave = async (sectionKeyForFirestore, dataForSection) => {
        if (!activeDraftId) {
            console.warn("handleStepSave: No activeDraftId. Cannot save.");
            return;
        }
        if (!dataForSection || (typeof dataForSection === 'object' && Object.keys(dataForSection).length === 0)) {
            console.warn(`handleStepSave: Data for section '${sectionKeyForFirestore}' is empty or undefined. Skipping save.`);
            return;
        }
        console.log(`CreateShipment: Saving section '${sectionKeyForFirestore}' to draft '${activeDraftId}' with data:`, dataForSection);
        setIsStepLoading(true);
        try {
            const shipmentDocRef = doc(db, 'shipments', activeDraftId);
            await updateDoc(shipmentDocRef, {
                [sectionKeyForFirestore]: dataForSection, // Use the correct camelCase key
                updatedAt: serverTimestamp()
            });
            console.log(`CreateShipment: Section '${sectionKeyForFirestore}' saved successfully to ${activeDraftId}.`);
        } catch (err) {
            console.error(`CreateShipment: Error saving section '${sectionKeyForFirestore}' to ${activeDraftId}:`, err);
            setError(`Failed to save ${sectionKeyForFirestore} data: ${err.message}`);
        } finally {
            setIsStepLoading(false);
        }
    };

    const handleNext = (dataFromChildStep) => {
        const urlSlug = STEP_SLUGS[currentStep];
        const sectionKeyForContextAndFirestore = SLUG_TO_FORMDATA_KEY_MAP[urlSlug];

        if (!sectionKeyForContextAndFirestore) {
            console.error(`handleNext: No formData key mapping found for URL slug: ${urlSlug}`);
            // Decide how to handle this - skip save, show error, etc.
            // For now, we proceed with navigation if currentStep < 6 but log error for saving.
            if (currentStep < 6) { /* ... navigation logic ... */ }
            return;
        }

        let dataToSave = null;
        console.log(`handleNext for step ${currentStep} (urlSlug: '${urlSlug}', sectionKey: '${sectionKeyForContextAndFirestore}'): Received dataFromChildStep:`, dataFromChildStep);

        if (dataFromChildStep && typeof dataFromChildStep === 'object' && Object.keys(dataFromChildStep).length > 0) {
            console.log(`handleNext: Using dataFromChildStep for section '${sectionKeyForContextAndFirestore}'. Updating context.`);
            dataToSave = dataFromChildStep;
            updateFormSection(sectionKeyForContextAndFirestore, dataToSave);
        } else if (formData[sectionKeyForContextAndFirestore] && Object.keys(formData[sectionKeyForContextAndFirestore]).length > 0) {
            console.warn(`handleNext: No data from child for '${sectionKeyForContextAndFirestore}', using data from context. This might be stale if child didn't update context before calling onNext.`);
            dataToSave = formData[sectionKeyForContextAndFirestore];
        } else {
            console.warn(`handleNext: No data provided by child and no data in context for section '${sectionKeyForContextAndFirestore}'. Save will be skipped for this step.`);
        }

        if (dataToSave && activeDraftId) {
            handleStepSave(sectionKeyForContextAndFirestore, dataToSave);
        } else if (!activeDraftId) {
            console.warn("handleNext: Cannot save step because activeDraftId is null.");
        } else {
            console.log(`handleNext: No dataToSave for section '${sectionKeyForContextAndFirestore}', Firestore save call will be skipped by handleStepSave.`);
        }

        // Navigation logic
        if (currentStep < 6) {
            const nextStep = currentStep + 1;
            const nextStepSlug = STEP_SLUGS[nextStep];
            console.log(`CreateShipment handleNext: activeDraftId BEFORE navigation: ${activeDraftId}`);
            const path = activeDraftId ? `/create-shipment/${nextStepSlug}/${activeDraftId}` : `/create-shipment/${nextStepSlug}`;
            if (!activeDraftId && nextStep > 1) {
                console.error("CRITICAL: activeDraftId is null before navigating past step 1. This should not happen.");
                setError("Session error, please try creating a new shipment.");
                return;
            }
            console.log(`CreateShipment: Navigating to next step. Current step: ${currentStep}, Next slug: ${nextStepSlug}, Path: ${path}`);

            isNavigating.current = true;
            navigate(path, { replace: true });
            setCurrentStep(nextStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => { isNavigating.current = false; }, 50);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 1) {
            const prevStep = currentStep - 1;
            const prevStepSlug = STEP_SLUGS[prevStep];
            console.log(`CreateShipment handlePrevious: activeDraftId BEFORE navigation: ${activeDraftId}`);
            const path = activeDraftId ? `/create-shipment/${prevStepSlug}/${activeDraftId}` : `/create-shipment/${prevStepSlug}`;
            console.log(`CreateShipment: Navigating to previous step. Current step: ${currentStep}, Prev slug: ${prevStepSlug}, Path: ${path}`);

            isNavigating.current = true;
            navigate(path, { replace: true });
            setCurrentStep(prevStep);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => { isNavigating.current = false; }, 50);
        }
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        console.log('Final form data from context for submission:', formData);
        if (activeDraftId) {
            const shipmentDocRef = doc(db, 'shipments', activeDraftId);
            updateDoc(shipmentDocRef, { status: 'processing', updatedAt: serverTimestamp() })
                .then(() => {
                    console.log(`Shipment ${activeDraftId} status updated to processing.`);
                    navigate('/shipments');
                    clearFormData();
                })
                .catch(err => {
                    console.error("Error finalizing shipment:", err);
                    setError("Failed to finalize shipment.");
                });
        } else {
            setError("No active draft to submit.");
        }
    };

    // Data completeness validation function
    const validateDataCompleteness = useCallback(() => {
        const completeness = {
            shipmentInfo: { complete: false, missing: [] },
            shipFrom: { complete: false, missing: [] },
            shipTo: { complete: false, missing: [] },
            packages: { complete: false, missing: [] },
            rates: { complete: false, missing: [] }
        };

        // Validate ShipmentInfo
        const shipmentInfo = formData.shipmentInfo || {};
        const shipmentInfoRequired = ['shipmentType', 'shipmentDate'];
        const shipmentInfoMissing = shipmentInfoRequired.filter(field => !shipmentInfo[field]);
        completeness.shipmentInfo = {
            complete: shipmentInfoMissing.length === 0,
            missing: shipmentInfoMissing
        };

        // Validate ShipFrom
        const shipFrom = formData.shipFrom || {};
        const shipFromRequired = ['company', 'street', 'city', 'state', 'postalCode', 'contactName', 'contactPhone', 'contactEmail'];
        const shipFromMissing = shipFromRequired.filter(field => !shipFrom[field] || String(shipFrom[field]).trim() === '');
        completeness.shipFrom = {
            complete: shipFromMissing.length === 0,
            missing: shipFromMissing
        };

        // Validate ShipTo
        const shipTo = formData.shipTo || {};
        const shipToRequired = ['customerID', 'company', 'street', 'city', 'state', 'postalCode', 'contactName', 'contactPhone', 'contactEmail'];
        const shipToMissing = shipToRequired.filter(field => !shipTo[field] || String(shipTo[field]).trim() === '');
        completeness.shipTo = {
            complete: shipToMissing.length === 0,
            missing: shipToMissing
        };

        // Validate Packages
        const packages = formData.packages || [];
        let packagesComplete = packages.length > 0;
        let packagesMissing = [];

        if (packages.length === 0) {
            packagesMissing.push('At least one package required');
            packagesComplete = false;
        } else {
            packages.forEach((pkg, index) => {
                const required = ['itemDescription', 'packagingType', 'packagingQuantity', 'weight', 'height', 'width', 'length'];
                const missing = required.filter(field =>
                    !pkg[field] ||
                    String(pkg[field]).trim() === '' ||
                    (field === 'packagingQuantity' && (isNaN(parseInt(pkg[field])) || parseInt(pkg[field]) < 1)) ||
                    (['weight', 'height', 'width', 'length'].includes(field) && (isNaN(parseFloat(pkg[field])) || parseFloat(pkg[field]) <= 0))
                );
                if (missing.length > 0) {
                    packagesMissing.push(`Package ${index + 1}: ${missing.join(', ')}`);
                    packagesComplete = false;
                }
            });
        }

        completeness.packages = {
            complete: packagesComplete,
            missing: packagesMissing
        };

        // Validate Rates
        const selectedRate = formData.selectedRate;
        completeness.rates = {
            complete: !!selectedRate,
            missing: selectedRate ? [] : ['Rate selection required']
        };

        setDataCompleteness(completeness);
        return completeness;
    }, [formData]);

    // Update data completeness when form data changes
    useEffect(() => {
        if (!isDraftProcessing && activeDraftId) {
            validateDataCompleteness();
        }
    }, [formData, isDraftProcessing, activeDraftId, validateDataCompleteness]);

    const renderStep = () => {
        console.log('Rendering step:', currentStep, 'with form data from context. Active draft:', activeDraftId);
        const safeApiKey = API_KEY || 'e61c3e150511db70aa0f2d2476ab8511';

        const stepProps = { onNext: handleNext, onPrevious: handlePrevious, apiKey: safeApiKey, activeDraftId };

        switch (currentStep) {
            case 1: return <ShipmentInfo key={`shipment-info-${activeDraftId || 'new'}`} {...stepProps} />;
            case 2: return <ShipFrom key={`ship-from-${activeDraftId || 'new'}`} {...stepProps} />;
            case 3: return <ShipTo key={`ship-to-${activeDraftId || 'new'}`} {...stepProps} />;
            case 4: return <Packages key={`packages-${activeDraftId || 'new'}`} {...stepProps} />;
            case 5: return <Rates key={`rates-${activeDraftId || 'new'}`} {...stepProps} formData={formData} />;
            case 6: return <Review key={`review-${activeDraftId || 'new'}`} {...stepProps} onSubmit={handleSubmit} />;
            default: return <Typography>Unknown step.</Typography>;
        }
    };

    if (isDraftProcessing || authLoading || (companyLoading && !currentUser)) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Initializing shipment...</Typography>
            </Box>
        );
    }

    if (error && !activeDraftId && !urlDraftId) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}>
                <Typography color="error">{error}</Typography>
                <Button onClick={() => window.location.reload()} sx={{ mt: 2 }}>Try Again</Button>
            </Box>
        )
    }

    // Show error for protected/completed shipments
    if (error && urlDraftId && !activeDraftId) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)', px: 3 }}>
                <Typography variant="h5" color="error" sx={{ mb: 2, textAlign: 'center' }}>
                    Cannot Edit Shipment
                </Typography>
                <Typography sx={{ mb: 3, textAlign: 'center', maxWidth: 600 }}>
                    {error}
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Button
                        variant="contained"
                        onClick={() => navigate('/shipments')}
                    >
                        View All Shipments
                    </Button>
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/create-shipment/shipment-info')}
                    >
                        Create New Shipment
                    </Button>
                    <Button
                        onClick={() => window.location.reload()}
                    >
                        Try Again
                    </Button>
                </Box>

                {/* Data Completeness Summary */}
                {activeDraftId && !isDraftProcessing && (
                    <Box sx={{ mb: 3, p: 2, bgcolor: '#f8f9fa', borderRadius: 2, border: '1px solid #e9ecef' }}>
                        <Typography variant="h6" sx={{ mb: 2, color: '#495057' }}>
                            Draft Progress Summary
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                            {Object.entries(dataCompleteness).map(([key, status]) => {
                                if (key === 'rates') return null; // Skip rates in summary

                                const stepNames = {
                                    shipmentInfo: 'Shipment Info',
                                    shipFrom: 'Ship From',
                                    shipTo: 'Ship To',
                                    packages: 'Packages'
                                };

                                return (
                                    <Box key={key} sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        px: 2,
                                        py: 1,
                                        borderRadius: 1,
                                        bgcolor: status.complete ? '#d4edda' : '#fff3cd',
                                        border: status.complete ? '1px solid #c3e6cb' : '1px solid #ffeaa7'
                                    }}>
                                        {status.complete ? (
                                            <CheckCircle sx={{ color: '#155724', fontSize: 16 }} />
                                        ) : (
                                            <Error sx={{ color: '#856404', fontSize: 16 }} />
                                        )}
                                        <Typography variant="body2" sx={{
                                            color: status.complete ? '#155724' : '#856404',
                                            fontWeight: 500
                                        }}>
                                            {stepNames[key]}
                                        </Typography>
                                        {!status.complete && status.missing.length > 0 && (
                                            <Typography variant="caption" sx={{
                                                color: '#856404',
                                                fontStyle: 'italic'
                                            }}>
                                                ({status.missing.length} missing)
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                        {Object.values(dataCompleteness).some(status => !status.complete && status.missing.length > 0) && (
                            <Typography variant="body2" sx={{ mt: 2, color: '#6c757d', fontStyle: 'italic' }}>
                                💡 You can navigate to any step to complete missing information
                            </Typography>
                        )}
                    </Box>
                )}
            </Box>
        )
    }

    return (
        <div className="container-fluid" style={{ position: 'relative' }}>
            <div className="row">
                <div className="col-12">
                    <div className="container">
                        <div className="section-header">
                            <h2>Create New Shipment</h2>
                            {companyData && (
                                <p className="text-muted">
                                    Creating shipment for {companyData.name || companyData.companyName || 'Your Company'}
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="alert alert-danger alert-dismissible fade show" role="alert">
                                {error}
                                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                            </div>
                        )}

                        {isStepLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>
                        ) : (
                            <>
                                <StepperComponent
                                    currentStep={currentStep}
                                    dataCompleteness={dataCompleteness}
                                    onStepClick={(step) => {
                                        const stepSlug = STEP_SLUGS[step];
                                        const path = activeDraftId ? `/create-shipment/${stepSlug}/${activeDraftId}` : `/create-shipment/${stepSlug}`;
                                        navigate(path);
                                    }}
                                />
                                <form id="shipmentForm" className="needs-validation" noValidate onSubmit={handleSubmit}>
                                    {renderStep()}
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {companyData?.id && <ShipmentAgent
                companyId={companyData?.id}
                inModal={false}
                isPanelOpen={isChatOpen}
                setIsPanelOpen={setIsChatOpen}
                currentShipmentId={activeDraftId}
            />}
        </div>
    );
};

const CreateShipment = () => {
    return (
        <ShipmentFormProvider>
            <CreateShipmentContent />
        </ShipmentFormProvider>
    );
};

export default CreateShipment; 