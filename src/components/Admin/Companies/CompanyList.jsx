import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Tooltip,
    Pagination,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import './Companies.css';

const CompanyList = () => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const { userRole } = useAuth();

    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        fetchCompanies();
    }, [page]);

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            const companiesRef = collection(db, 'companies');
            const q = query(
                companiesRef,
                orderBy('name'),
                where('status', '==', 'active')
            );
            const querySnapshot = await getDocs(q);
            const companiesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCompanies(companiesData);
            setTotalPages(Math.ceil(companiesData.length / ITEMS_PER_PAGE));
        } catch (err) {
            setError('Error fetching companies: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (company = null) => {
        setSelectedCompany(company);
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setSelectedCompany(null);
        setOpenDialog(false);
    };

    const handleSearch = (event) => {
        setSearchTerm(event.target.value);
        setPage(1);
    };

    const filteredCompanies = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const paginatedCompanies = filteredCompanies.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    return (
        <Box className="companies-container">
            <Box className="companies-header">
                <Typography variant="h4" className="companies-title">
                    Companies
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Add Company
                </Button>
            </Box>

            <Paper className="companies-search">
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={handleSearch}
                />
            </Paper>

            <TableContainer component={Paper} className="companies-table">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Company Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedCompanies.map((company) => (
                            <TableRow key={company.id}>
                                <TableCell>{company.name}</TableCell>
                                <TableCell>{company.email}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={company.status}
                                        color={company.status === 'active' ? 'success' : 'default'}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    {new Date(company.createdAt?.toDate()).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="View Details">
                                        <IconButton
                                            color="primary"
                                            onClick={() => handleOpenDialog(company)}
                                        >
                                            <ViewIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit Company">
                                        <IconButton
                                            color="primary"
                                            onClick={() => handleOpenDialog(company)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Company">
                                        <IconButton
                                            color="error"
                                            onClick={() => handleOpenDialog(company)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box className="companies-pagination">
                <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(e, value) => setPage(value)}
                    color="primary"
                    showFirstButton
                    showLastButton
                />
            </Box>

            {/* Company Form Dialog */}
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    {selectedCompany ? 'Edit Company' : 'Add New Company'}
                </DialogTitle>
                <DialogContent>
                    {/* Company form will be implemented here */}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button variant="contained" color="primary">
                        {selectedCompany ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CompanyList; 