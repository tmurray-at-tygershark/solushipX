import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Chip,
    TextField,
    InputAdornment,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Stack,
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import './CompanyList.css';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const CompanyList = () => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const loadCompanies = async () => {
            try {
                const companiesRef = collection(db, 'companies');
                const querySnapshot = await getDocs(companiesRef);
                const companiesData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setCompanies(companiesData);
                setLoading(false);
            } catch (err) {
                console.error('Error loading companies:', err);
                setError('Failed to load companies');
                setLoading(false);
            }
        };

        loadCompanies();
    }, []);

    const handleActionsClick = (event, company) => {
        setAnchorEl(event.currentTarget);
        setSelectedCompany(company);
    };

    const handleActionsClose = () => {
        setAnchorEl(null);
        setSelectedCompany(null);
    };

    const handleViewCompany = () => {
        if (selectedCompany) {
            navigate(`/admin/companies/${selectedCompany.id}`);
            handleActionsClose();
        }
    };

    const handleEditCompany = () => {
        if (selectedCompany) {
            navigate(`/admin/companies/${selectedCompany.id}/edit`);
            handleActionsClose();
        }
    };

    const handleDeleteCompany = () => {
        if (selectedCompany) {
            // Implement delete functionality
            console.log('Delete company:', selectedCompany.id);
            handleActionsClose();
        }
    };

    const filteredCompanies = companies.filter(company => {
        return company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.companyID.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'inactive':
                return { color: '#637381', bgcolor: '#f9fafb' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    if (loading) {
        return <Box className="admin-companies">Loading...</Box>;
    }

    if (error) {
        return <Box className="admin-companies">Error: {error}</Box>;
    }

    return (
        <Box className="admin-companies">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Companies
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                    Manage your company profiles and relationships
                </Typography>
            </Box>

            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    fullWidth
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                />
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/admin/companies/new')}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    Add Company
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Company Name</TableCell>
                            <TableCell>Company ID</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredCompanies.map((company) => (
                            <TableRow key={company.id}>
                                <TableCell>{company.name}</TableCell>
                                <TableCell>{company.companyID}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={company.status}
                                        sx={{
                                            backgroundColor: getStatusColor(company.status).bgcolor,
                                            color: getStatusColor(company.status).color,
                                            fontWeight: 500,
                                            '& .MuiChip-label': { px: 1.5 }
                                        }}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    {company.createdAt ? format(company.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                                </TableCell>
                                <TableCell>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleActionsClick(e, company)}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Actions Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleActionsClose}
            >
                <MenuItem onClick={handleViewCompany}>
                    <ListItemIcon>
                        <ViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>View Details</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleEditCompany}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Edit Company</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDeleteCompany}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Delete Company</ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default CompanyList; 