import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    IconButton,
    Grid,
    Alert,
    CircularProgress,
    Tooltip,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Container,
    Tabs,
    Tab,
    Switch
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Visibility as ViewIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import './Billing.css';
import AddCarrierMapping from './AddCarrierMapping';
import MappingTest from '../EDIMapping/MappingTest';
import PromptVersionManager from '../EDIMapping/PromptVersionManager';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const EDIMapping = () => {
    const navigate = useNavigate();
    const [carriers, setCarriers] = useState([]);
    const [selectedTab, setSelectedTab] = useState(0);
    const { enqueueSnackbar } = useSnackbar();

    const fetchCarriers = useCallback(async () => {
        try {
            const carriersRef = collection(db, 'ediMappings');
            const snapshot = await getDocs(carriersRef);
            const allCarriersData = [];
            for (const docSnapshot of snapshot.docs) {
                const carrierData = docSnapshot.data();
                const mappingDocRef = doc(db, 'ediMappings', docSnapshot.id, 'default', 'mapping');
                const mappingDocSnap = await getDoc(mappingDocRef);
                let mappingCount = 0;
                let lastUpdated = carrierData.updatedAt;

                if (mappingDocSnap.exists()) {
                    const mappingData = mappingDocSnap.data();
                    mappingCount = mappingData.fieldMappings?.length || 0;
                    lastUpdated = mappingData.updatedAt || carrierData.updatedAt;
                }

                allCarriersData.push({
                    id: docSnapshot.id,
                    ...carrierData,
                    mappingCount: mappingCount,
                    lastUpdated: lastUpdated?.toDate ? lastUpdated.toDate() : (lastUpdated ? new Date(lastUpdated) : new Date()),
                    isEnabled: carrierData.enabled === undefined ? true : carrierData.enabled
                });
            }
            setCarriers(allCarriersData);
        } catch (error) {
            console.error('Error fetching carriers:', error);
            enqueueSnackbar('Failed to load carriers: ' + error.message, { variant: 'error' });
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        fetchCarriers();
    }, [fetchCarriers]);

    const handleToggleEnabled = async (carrierId, currentIsEnabled) => {
        const newIsEnabled = !currentIsEnabled;
        const carrierRef = doc(db, 'ediMappings', carrierId);
        try {
            await updateDoc(carrierRef, {
                enabled: newIsEnabled,
                updatedAt: serverTimestamp()
            });
            enqueueSnackbar(`Carrier mapping ${newIsEnabled ? 'enabled' : 'disabled'} successfully.`, { variant: 'success' });
            setCarriers(prevCarriers =>
                prevCarriers.map(c =>
                    c.id === carrierId ? { ...c, isEnabled: newIsEnabled, updatedAt: new Date() } : c
                )
            );
        } catch (error) {
            console.error('Error updating carrier status:', error);
            enqueueSnackbar('Failed to update carrier status: ' + error.message, { variant: 'error' });
        }
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const handleAddCarrier = () => {
        navigate('/admin/billing/edi-mapping/new/details');
    };

    const handleViewCarrier = (carrierId) => {
        navigate(`/admin/billing/edi-mapping/${carrierId}/view/review`);
    };

    const handleEditCarrier = (carrierId) => {
        navigate(`/admin/billing/edi-mapping/${carrierId}/edit/details`);
    };

    if (carriers.length === 0 && !fetchCarriers) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Container maxWidth="xl">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" gutterBottom>
                    EDI Mapping Management
                </Typography>

                <Paper sx={{ mb: 3 }}>
                    <Tabs
                        value={selectedTab}
                        onChange={handleTabChange}
                        indicatorColor="primary"
                        textColor="primary"
                        variant="fullWidth"
                    >
                        <Tab label="Add New Mapping" />
                        <Tab label="Test Mapping" />
                        <Tab label="Manage Prompts" />
                    </Tabs>
                </Paper>

                <Grid container spacing={3}>
                    {selectedTab === 0 && (
                        <Grid item xs={12}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<AddIcon />}
                                onClick={handleAddCarrier}
                                sx={{ mb: 2 }}
                            >
                                Add New Carrier Mapping
                            </Button>

                            <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                                <TableContainer sx={{ maxHeight: 600 }}>
                                    <Table stickyHeader aria-label="carrier mappings table">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Carrier</TableCell>
                                                <TableCell>Description</TableCell>
                                                <TableCell>Mappings</TableCell>
                                                <TableCell>Last Updated</TableCell>
                                                <TableCell>Status (Enabled)</TableCell>
                                                <TableCell>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {carriers.map((carrier) => (
                                                <TableRow key={carrier.id} hover>
                                                    <TableCell>{carrier.name}</TableCell>
                                                    <TableCell>{carrier.description}</TableCell>
                                                    <TableCell>{carrier.mappingCount || 0}</TableCell>
                                                    <TableCell>
                                                        {carrier.lastUpdated?.toLocaleDateString() || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Switch
                                                            checked={carrier.isEnabled}
                                                            onChange={() => handleToggleEnabled(carrier.id, carrier.isEnabled)}
                                                            color="primary"
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip title="View/Test">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleViewCarrier(carrier.id)}
                                                            >
                                                                <ViewIcon fontSize="inherit" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Edit Mapping">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleEditCarrier(carrier.id)}
                                                            >
                                                                <EditIcon fontSize="inherit" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {carriers.length === 0 && !fetchCarriers && (
                                                <TableRow>
                                                    <TableCell colSpan={6} align="center">
                                                        <Typography sx={{ p: 2 }} color="text.secondary">No carrier mappings found.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Grid>
                    )}

                    {selectedTab === 1 && (
                        <Grid item xs={12}>
                            <MappingTest
                                carrierId={carriers[0]?.id}
                            />
                        </Grid>
                    )}

                    {selectedTab === 2 && (
                        <Grid item xs={12}>
                            <PromptVersionManager carrierId={carriers[0]?.id} />
                        </Grid>
                    )}
                </Grid>
            </Box>
        </Container>
    );
};

export default EDIMapping; 