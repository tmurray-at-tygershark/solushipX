import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    CircularProgress,
    Alert,
    TextField,
    InputAdornment,
    Chip,
    Tooltip
} from '@mui/material';
import { Edit as EditIcon, Search as SearchIcon, Clear as ClearIcon, VisibilityOff as VisibilityOffIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase'; // Adjust path as needed
import { useSnackbar } from 'notistack';
import EditPaymentTermsDialog from './EditPaymentTermsDialog';

const PaymentTerms = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [companies, setCompanies] = useState([]);
    const [filteredCompanies, setFilteredCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);

    const fetchCompaniesData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const companiesSnapshot = await getDocs(collection(db, 'companies'));
            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                paymentTerms: doc.data().paymentTerms || {}
            }));
            setCompanies(companiesData);
            setFilteredCompanies(companiesData);
        } catch (err) {
            console.error("Error fetching companies for payment terms:", err);
            setError("Could not load companies data.");
            enqueueSnackbar('Error fetching companies: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        fetchCompaniesData();
    }, [fetchCompaniesData]);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredCompanies(companies);
        } else {
            setFilteredCompanies(
                companies.filter(company =>
                    company.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    company.customerID?.toLowerCase().includes(searchTerm.toLowerCase()) // Use customerID for searching
                )
            );
        }
    }, [searchTerm, companies]);

    const handleEditOpen = (company) => {
        setEditingCompany(company);
        setIsEditDialogOpen(true);
    };

    const handleDialogClose = () => {
        setIsEditDialogOpen(false);
        setEditingCompany(null);
    };

    const handleSavePaymentTerms = async (companyId, termsDataToSave) => {
        // The termsDataToSave comes from EditPaymentTermsDialog and is already processed
        try {
            const companyRef = doc(db, 'companies', companyId);
            await updateDoc(companyRef, {
                paymentTerms: {
                    ...termsDataToSave, // Spread the already processed data
                    updatedAt: serverTimestamp(),
                    // TODO: Consider adding 'updatedBy: currentUser.uid' if auth context is available here
                }
            });
            enqueueSnackbar('Payment terms saved successfully!', { variant: 'success' }); // Snackbar from parent
            fetchCompaniesData(); // Refresh data to show updated terms in the table
            // The dialog will call its own onClose, so we don't call handleDialogClose() here to prevent race conditions
            // Let the dialog handle closing itself upon successful onSave completion. 
            // The onSave in dialog should return a promise that resolves or rejects.
            // For simplicity, we will let dialog close itself. Parent refreshes data.
        } catch (err) {
            console.error("Error updating payment terms in PaymentTerms tab:", err);
            enqueueSnackbar('Failed to save payment terms: ' + err.message, { variant: 'error' });
            // Rethrow error so dialog can know save failed if needed, or handle all errors here.
            throw err;
        }
    };

    const getNetTermsDisplay = (terms) => {
        if (terms === undefined || terms === null || terms === '') return 'N/A'; // Handle empty string for netTerms
        const numericTerms = Number(terms);
        return numericTerms === 0 ? 'Due on Receipt' : `Net ${numericTerms}`;
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading companies...</Typography>
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
    }

    return (
        <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 2 }}>Manage Company Payment Terms</Typography>

            <Paper sx={{ p: 2, mb: 3 }} elevation={1} variant="outlined">
                <TextField
                    fullWidth
                    label="Search Companies (by Name or Company ID)"
                    variant="outlined"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                        endAdornment: searchTerm && (
                            <IconButton onClick={() => setSearchTerm('')} size="small">
                                <ClearIcon />
                            </IconButton>
                        )
                    }}
                />
            </Paper>

            <TableContainer component={Paper} elevation={1} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Company ID</TableCell>
                            <TableCell>Company Name</TableCell>
                            <TableCell>Credit Limit</TableCell>
                            <TableCell>Net Terms</TableCell>
                            <TableCell>Reminders</TableCell>
                            <TableCell>On Credit Hold</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredCompanies.map((company) => (
                            <TableRow key={company.id} hover>
                                <TableCell>{company.companyID}</TableCell>
                                <TableCell>
                                    <Button
                                        variant="text"
                                        onClick={() => handleEditOpen(company)}
                                        sx={{
                                            padding: 0,
                                            textTransform: 'none',
                                            justifyContent: 'flex-start',
                                            color: 'primary.main',
                                            '&:hover': {
                                                textDecoration: 'underline',
                                                backgroundColor: 'transparent'
                                            }
                                        }}
                                    >
                                        {company.name}
                                    </Button>
                                </TableCell>
                                <TableCell>${(company.paymentTerms?.creditLimit || 0).toLocaleString()}</TableCell>
                                <TableCell>{getNetTermsDisplay(company.paymentTerms?.netTerms)}</TableCell>
                                <TableCell>
                                    {company.paymentTerms?.enablePaymentReminders !== undefined ?
                                        (company.paymentTerms.enablePaymentReminders ?
                                            <Chip icon={<VisibilityIcon />} label="Enabled" color="success" size="small" variant="outlined" /> :
                                            <Chip icon={<VisibilityOffIcon />} label="Disabled" color="default" size="small" variant="outlined" />
                                        ) : <Chip label="N/A" size="small" />}
                                </TableCell>
                                <TableCell>
                                    {company.paymentTerms?.onCreditHold ?
                                        <Chip label="YES" color="error" size="small" /> :
                                        <Chip label="No" color="success" size="small" variant="outlined" />}
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredCompanies.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} align="center">
                                    <Typography color="textSecondary" sx={{ p: 2 }}>
                                        {searchTerm ? 'No companies match your search.' : 'No companies found.'}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {editingCompany && (
                <EditPaymentTermsDialog
                    open={isEditDialogOpen}
                    onClose={handleDialogClose}
                    onSave={handleSavePaymentTerms}
                    companyData={editingCompany}
                />
            )}
        </Box>
    );
};

export default PaymentTerms; 