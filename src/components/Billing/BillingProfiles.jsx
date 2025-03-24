import React, { useState } from 'react';
import {
    Box,
    Grid,
    Paper,
    Typography,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Stack,
    Chip
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Business as BusinessIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const BillingProfiles = () => {
    const [openDialog, setOpenDialog] = useState(false);
    const [profiles, setProfiles] = useState([
        {
            id: 1,
            name: 'Main Office',
            company: 'SolushipX Inc.',
            address: '123 Business Ave, Suite 100',
            city: 'San Francisco',
            state: 'CA',
            postalCode: '94105',
            country: 'US',
            isDefault: true
        },
        {
            id: 2,
            name: 'Warehouse',
            company: 'SolushipX Inc.',
            address: '456 Industrial Blvd',
            city: 'Oakland',
            state: 'CA',
            postalCode: '94601',
            country: 'US',
            isDefault: false
        }
    ]);

    const handleOpenDialog = () => {
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
    };

    const handleDeleteProfile = (id) => {
        setProfiles(profiles.filter(profile => profile.id !== id));
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Billing Profiles
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenDialog}
                    sx={{
                        bgcolor: '#000',
                        '&:hover': { bgcolor: '#333' }
                    }}
                >
                    Add Profile
                </Button>
            </Box>

            <Grid container spacing={3}>
                {profiles.map((profile) => (
                    <Grid item xs={12} md={6} key={profile.id}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 3,
                                    border: '1px solid #eee',
                                    borderRadius: 2,
                                    position: 'relative'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <BusinessIcon sx={{ color: '#666', mr: 1 }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        {profile.name}
                                    </Typography>
                                    {profile.isDefault && (
                                        <Chip
                                            label="Default"
                                            size="small"
                                            sx={{ ml: 1, bgcolor: '#f0f0f0' }}
                                        />
                                    )}
                                </Box>

                                <Stack spacing={1}>
                                    <Typography variant="body2" color="text.secondary">
                                        {profile.company}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {profile.address}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {profile.city}, {profile.state} {profile.postalCode}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {profile.country}
                                    </Typography>
                                </Stack>

                                <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                                    <IconButton size="small" sx={{ mr: 1 }}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleDeleteProfile(profile.id)}
                                        sx={{ color: '#ff4d4f' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Paper>
                        </motion.div>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Add Billing Profile</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <TextField
                            fullWidth
                            label="Profile Name"
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Company Name"
                            margin="normal"
                            required
                        />
                        <TextField
                            fullWidth
                            label="Address"
                            margin="normal"
                            required
                        />
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="City"
                                    margin="normal"
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="State/Province"
                                    margin="normal"
                                    required
                                />
                            </Grid>
                        </Grid>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Postal Code"
                                    margin="normal"
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Country"
                                    margin="normal"
                                    required
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCloseDialog}
                        sx={{
                            bgcolor: '#000',
                            '&:hover': { bgcolor: '#333' }
                        }}
                    >
                        Add Profile
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default BillingProfiles; 