import React, { useState, useEffect, useCallback } from 'react';
import { useCompany } from '../../../contexts/CompanyContext';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Alert,
    IconButton,
    Divider,
    Chip,
    LinearProgress
} from '@mui/material';
import {
    Close as CloseIcon,
    Edit as EditIcon,
    Warning as WarningIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { functions } from '../../../firebase';
import { httpsCallable } from 'firebase/functions';

// Import the MODERN form components and provider
import { ShipmentFormProvider } from '../../../contexts/ShipmentFormContext';
import CreateShipmentX from '../../CreateShipment/CreateShipmentX';
import QuickShip from '../../CreateShipment/QuickShip';

const EditShipmentModal = ({
    open,
    onClose,
    shipment,
    onShipmentUpdated,
    showNotification,
    companyIdForAddress,
    isAdmin,
    userRole
}) => {
    const [loading, setLoading] = useState(false);
    const [formMode, setFormMode] = useState(null); // 'quickship' or 'advanced'
    const [prePopulatedData, setPrePopulatedData] = useState(null);

    // Determine which form to use based on shipment creation method
    useEffect(() => {
        if (shipment && open) {
            const creationMethod = shipment.creationMethod;

            // Extract customer ID from various possible locations in shipment data
            let customerId = shipment.customerId || shipment.customerID || shipment.customer?.id || shipment.shipTo?.customerID;

            console.log('🔍 Initial customer ID extraction:', {
                customerId,
                from_customerId: shipment.customerId,
                from_customerID: shipment.customerID,
                from_customer_id: shipment.customer?.id,
                from_shipTo_customerID: shipment.shipTo?.customerID
            });

            // REVERSE ENGINEERING APPROACH: Extract customer ID from address records if not found directly
            if (!customerId && shipment.shipTo) {
                console.log('🔍 Checking shipTo address for customer ID:', {
                    addressClass: shipment.shipTo.addressClass,
                    addressClassID: shipment.shipTo.addressClassID,
                    customerID: shipment.shipTo.customerID,
                    addressId: shipment.shipTo.addressId
                });

                // Check if shipTo address has customer relationship data
                if (shipment.shipTo.addressClass === 'customer' && shipment.shipTo.addressClassID) {
                    customerId = shipment.shipTo.addressClassID;
                    console.log('🔍 Reverse engineered customer ID from shipTo addressClassID:', customerId);
                }
                // Also check for customerID in shipTo address data
                else if (shipment.shipTo.customerID) {
                    customerId = shipment.shipTo.customerID;
                    console.log('🔍 Found customer ID in shipTo.customerID:', customerId);
                }
            }

            // Also check shipFrom address as backup
            if (!customerId && shipment.shipFrom) {
                console.log('🔍 Checking shipFrom address for customer ID:', {
                    addressClass: shipment.shipFrom.addressClass,
                    addressClassID: shipment.shipFrom.addressClassID,
                    customerID: shipment.shipFrom.customerID
                });

                if (shipment.shipFrom.addressClass === 'customer' && shipment.shipFrom.addressClassID) {
                    customerId = shipment.shipFrom.addressClassID;
                    console.log('🔍 Reverse engineered customer ID from shipFrom addressClassID:', customerId);
                }
            }

            console.log('🔧 EditShipmentModal: Opening for shipment:', {
                shipmentID: shipment.shipmentID,
                creationMethod,
                companyID: shipment.companyID || shipment.companyId,
                extractedCustomerID: customerId,
                shipToAddressClass: shipment.shipTo?.addressClass,
                shipToAddressClassID: shipment.shipTo?.addressClassID,
                companyIdForAddress,
                isAdmin,
                userRole
            });

            // Create prePopulated data with customer selection
            const prepopulatedInfo = {
                selectedCustomerId: customerId,
                companyId: shipment.companyID || shipment.companyId,
                // Flag to indicate this is edit mode to handle timing properly
                isEditMode: true,
                // Add timing flag to help with race conditions
                requiresCustomerSelection: !!customerId
            };

            console.log('📋 Setting prePopulatedData for edit:', prepopulatedInfo);

            // CRITICAL DEBUG: Log exactly what we're trying to match
            console.log('🎯 CRITICAL: Customer ID to select in QuickShip dropdown:', {
                extractedCustomerId: customerId,
                shipmentCompanyID: shipment.companyID || shipment.companyId,
                currentCompanyContext: companyIdForAddress,
                shipmentData: {
                    customerId: shipment.customerId,
                    customerID: shipment.customerID,
                    shipTo_customerID: shipment.shipTo?.customerID,
                    shipTo_addressClass: shipment.shipTo?.addressClass,
                    shipTo_addressClassID: shipment.shipTo?.addressClassID,
                    shipTo_companyName: shipment.shipTo?.companyName,
                    shipTo_company: shipment.shipTo?.company
                }
            });
            setPrePopulatedData(prepopulatedInfo);

            if (creationMethod === 'quickship') {
                setFormMode('quickship');
            } else {
                // Default to advanced for all other shipments (including legacy)
                setFormMode('advanced');
            }
        }
    }, [shipment, open, companyIdForAddress, isAdmin, userRole]);

    // Handle successful shipment update
    const handleShipmentUpdated = useCallback((updatedShipment) => {
        showNotification('Shipment updated successfully!', 'success');

        if (onShipmentUpdated) {
            onShipmentUpdated(updatedShipment);
        }

        onClose();
    }, [onShipmentUpdated, onClose, showNotification]);

    // Handle close
    const handleClose = useCallback(() => {
        setFormMode(null);
        onClose();
    }, [onClose]);

    if (!formMode) {
        return null; // Don't render until we know which form to use
    }

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth={false}
            fullWidth
            PaperProps={{
                sx: {
                    width: '95vw',
                    height: '95vh',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    m: 2
                }
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e0e0e0',
                    p: 2
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EditIcon />
                    <Typography variant="h6">
                        Edit {formMode === 'quickship' ? 'Quick Ship' : 'Advanced'} Shipment
                    </Typography>
                    <Chip
                        label={shipment?.shipmentID || 'N/A'}
                        variant="outlined"
                        size="small"
                    />
                </Box>
                <IconButton onClick={handleClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0, height: '100%', overflow: 'hidden' }}>
                {/* Warning about editing booked shipments */}
                <Alert
                    severity="warning"
                    icon={<WarningIcon />}
                    sx={{ m: 2, mb: 0 }}
                >
                    <Typography variant="body2">
                        <strong>Editing Booked Shipment:</strong> Changes to addresses, packages, or weights may require
                        document regeneration and carrier notification. Significant changes might require cancellation
                        and rebooking.
                    </Typography>
                </Alert>

                {/* Render the appropriate form */}
                <Box sx={{ height: 'calc(100% - 80px)', overflow: 'auto' }}>
                    {formMode === 'quickship' ? (
                        <ShipmentFormProvider>
                            <QuickShip
                                isModal={true}
                                onClose={onClose}
                                showCloseButton={false}
                                editMode={true}
                                editShipment={shipment}
                                onShipmentUpdated={onShipmentUpdated}
                                showNotification={showNotification}
                                // Pass customer information for proper dropdown population
                                prePopulatedData={prePopulatedData}
                            />
                        </ShipmentFormProvider>
                    ) : (
                        <CreateShipmentX
                            isModal={true}
                            onClose={handleClose}
                            draftId={shipment?.id} // Pass the shipment ID as draft ID for editing
                            onShipmentCreated={handleShipmentUpdated}
                            editMode={true}
                            editShipment={shipment}
                            // Pass customer information for proper dropdown population
                            prePopulatedData={prePopulatedData}
                        />
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default EditShipmentModal; 