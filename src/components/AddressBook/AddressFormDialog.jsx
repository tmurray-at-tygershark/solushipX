import React from 'react';
import {
    Dialog,
    DialogContent,
    IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddressForm from './AddressForm';

const AddressFormDialog = ({
    open,
    onClose,
    onSuccess,
    editingAddress = null,
    addressType = 'from', // 'from' or 'to' - used for dialog title context
    companyId,
    initialData = {}
}) => {
    // Determine if we're editing an existing address or creating a new one
    const isEditing = editingAddress && editingAddress.id;

    // For new addresses, prepare initial data
    const formInitialData = isEditing ? {} : {
        ...initialData,
        addressClass: 'company',
        addressClassID: companyId,
        addressType: addressType === 'from' ? 'pickup' : 'delivery'
    };

    const handleSuccess = (addressId) => {
        onSuccess(addressId);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    height: '90vh',
                    maxHeight: '90vh'
                }
            }}
        >
            {/* Close button in top right */}
            <IconButton
                onClick={onClose}
                sx={{
                    position: 'absolute',
                    right: 8,
                    top: 8,
                    zIndex: 1,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 1)'
                    }
                }}
                size="small"
            >
                <CloseIcon fontSize="small" />
            </IconButton>

            <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
                <AddressForm
                    addressId={isEditing ? editingAddress.id : null}
                    onCancel={onClose}
                    onSuccess={handleSuccess}
                    isModal={true}
                    initialData={formInitialData}
                />
            </DialogContent>
        </Dialog>
    );
};

export default AddressFormDialog; 