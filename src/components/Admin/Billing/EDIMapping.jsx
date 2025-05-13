import React, { useState, useEffect } from 'react';
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
    Tab
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Visibility as ViewIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { adminDb } from '../../../firebase';
import './Billing.css';
import AddCarrierMapping from './AddCarrierMapping';
import MappingTest from '../EDIMapping/MappingTest';
import PromptVersionManager from '../EDIMapping/PromptVersionManager';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const EDIMapping = () => {
    const navigate = useNavigate();
    const [carriers, setCarriers] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedTab, setSelectedTab] = useState(0);
    const [showAddCarrierDialog, setShowAddCarrierDialog] = useState(false);
    const { enqueueSnackbar } = useSnackbar();
    const [carrierMetrics, setCarrierMetrics] = useState({});

    useEffect(() => {
        fetchCarriers();
    }, []);

    const fetchCarriers = async () => {
        try {
            setLoading(true);
            const carriersRef = collection(adminDb, 'ediMappings');
            const snapshot = await getDocs(carriersRef);
            const allCarriers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCarriers(allCarriers);

            // Fetch metrics for each carrier
            const metrics = {};
            for (const carrier of allCarriers) {
                const mappingDoc = await getDoc(doc(adminDb, 'ediMappings', carrier.id, 'default', 'mapping'));
                if (mappingDoc.exists()) {
                    const mappingData = mappingDoc.data();
                    metrics[carrier.id] = {
                        mappingCount: mappingData.fieldMappings?.length || 0,
                        lastUpdated: mappingData.updatedAt?.toDate() || new Date(),
                        status: carrier.enabled ? 'Active' : 'Disabled'
                    };
                }
            }
            setCarrierMetrics(metrics);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching carriers:', error);
            enqueueSnackbar('Failed to load carriers. Please try again.', { variant: 'error' });
            setLoading(false);
        }
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const handleAddCarrier = () => {
        navigate('/admin/billing/edi-mapping/new');
    };

    const handleViewCarrier = (carrierId) => {
        navigate(`/admin/billing/edi-mapping/${carrierId}/view`);
    };

    const handleEditCarrier = (carrierId) => {
        navigate(`/admin/billing/edi-mapping/${carrierId}/edit`);
    };

    if (loading) {
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
                                <TableContainer sx={{ maxHeight: 440 }}>
                                    <Table stickyHeader aria-label="carrier mappings table">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Carrier</TableCell>
                                                <TableCell>Description</TableCell>
                                                <TableCell>Mappings</TableCell>
                                                <TableCell>Last Updated</TableCell>
                                                <TableCell>Status</TableCell>
                                                <TableCell>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {carriers.map((carrier) => (
                                                <TableRow key={carrier.id}>
                                                    <TableCell>{carrier.name}</TableCell>
                                                    <TableCell>{carrier.description}</TableCell>
                                                    <TableCell>{carrierMetrics[carrier.id]?.mappingCount || 0}</TableCell>
                                                    <TableCell>
                                                        {carrierMetrics[carrier.id]?.lastUpdated?.toLocaleDateString() || 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={carrierMetrics[carrier.id]?.status || 'Unknown'}
                                                            color={carrierMetrics[carrier.id]?.status === 'Active' ? 'success' : 'default'}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip title="View">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleViewCarrier(carrier.id)}
                                                            >
                                                                <ViewIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Edit">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleEditCarrier(carrier.id)}
                                                            >
                                                                <EditIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Grid>
                    )}

                    {selectedTab === 1 && (
                        <Grid item xs={12}>
                            <MappingTest
                                carrierId={selectedCarrier}
                            />
                        </Grid>
                    )}

                    {selectedTab === 2 && (
                        <Grid item xs={12}>
                            <PromptVersionManager carrierId={selectedCarrier} />
                        </Grid>
                    )}
                </Grid>
            </Box>
        </Container>
    );
};

export default EDIMapping; 