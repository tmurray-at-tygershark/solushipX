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
    TablePagination,
    IconButton,
    Button,
    Chip,
    TextField,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stack,
    Tooltip,
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    Business as BusinessIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    LocationOn as LocationIcon,
} from '@mui/icons-material';
import './CompanyList.css';

const CompanyList = () => {
    const [companies, setCompanies] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // Mock data - replace with Firebase data
    useEffect(() => {
        const mockCompanies = [
            {
                id: '1',
                name: 'Acme Corporation',
                email: 'contact@acme.com',
                phone: '+1 (555) 123-4567',
                address: '123 Business Ave, Suite 100, New York, NY 10001',
                status: 'active',
                type: 'Enterprise',
                joinDate: '2024-01-15',
            },
            {
                id: '2',
                name: 'TechCorp Solutions',
                email: 'info@techcorp.com',
                phone: '+1 (555) 234-5678',
                address: '456 Tech Blvd, San Francisco, CA 94105',
                status: 'active',
                type: 'SMB',
                joinDate: '2024-02-01',
            },
            // Add more mock companies as needed
        ];
        setCompanies(mockCompanies);
    }, []);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleViewCompany = (company) => {
        setSelectedCompany(company);
        setIsViewDialogOpen(true);
    };

    const handleDeleteCompany = (company) => {
        setSelectedCompany(company);
        setIsDeleteDialogOpen(true);
    };

    const getStatusChip = (status) => {
        const statusConfig = {
            active: { color: 'success', label: 'Active' },
            inactive: { color: 'default', label: 'Inactive' },
            pending: { color: 'warning', label: 'Pending' },
        };

        const config = statusConfig[status] || statusConfig.inactive;
        return (
            <Chip
                label={config.label}
                color={config.color}
                size="small"
                className="status-chip"
            />
        );
    };

    const filteredCompanies = companies.filter(company =>
        Object.values(company).some(value =>
            String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <Box className="admin-companies">
            <Paper className="companies-paper">
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Company Name</TableCell>
                                <TableCell>Contact</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Join Date</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredCompanies
                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                .map((company) => (
                                    <TableRow key={company.id} hover>
                                        <TableCell>
                                            <Box className="company-name-cell">
                                                <BusinessIcon className="company-icon" />
                                                <Typography variant="body1">
                                                    {company.name}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Stack spacing={0.5}>
                                                <Box className="contact-info">
                                                    <EmailIcon fontSize="small" />
                                                    <Typography variant="body2">
                                                        {company.email}
                                                    </Typography>
                                                </Box>
                                                <Box className="contact-info">
                                                    <PhoneIcon fontSize="small" />
                                                    <Typography variant="body2">
                                                        {company.phone}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>{company.type}</TableCell>
                                        <TableCell>{getStatusChip(company.status)}</TableCell>
                                        <TableCell>{company.joinDate}</TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="View Details">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleViewCompany(company)}
                                                    >
                                                        <ViewIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Edit Company">
                                                    <IconButton size="small">
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Company">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDeleteCompany(company)}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    component="div"
                    count={filteredCompanies.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25]}
                />
            </Paper>

            {/* View Company Dialog */}
            <Dialog
                open={isViewDialogOpen}
                onClose={() => setIsViewDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box className="dialog-title">
                        <BusinessIcon className="dialog-icon" />
                        <Typography variant="h6">
                            {selectedCompany?.name}
                        </Typography>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3}>
                        <Box className="company-info-section">
                            <Typography variant="subtitle2" color="text.secondary">
                                Contact Information
                            </Typography>
                            <Stack spacing={2}>
                                <Box className="info-row">
                                    <EmailIcon />
                                    <Typography>{selectedCompany?.email}</Typography>
                                </Box>
                                <Box className="info-row">
                                    <PhoneIcon />
                                    <Typography>{selectedCompany?.phone}</Typography>
                                </Box>
                                <Box className="info-row">
                                    <LocationIcon />
                                    <Typography>{selectedCompany?.address}</Typography>
                                </Box>
                            </Stack>
                        </Box>
                        <Box className="company-info-section">
                            <Typography variant="subtitle2" color="text.secondary">
                                Company Details
                            </Typography>
                            <Stack spacing={2}>
                                <Box className="info-row">
                                    <Typography variant="body2" color="text.secondary">
                                        Type:
                                    </Typography>
                                    <Typography>{selectedCompany?.type}</Typography>
                                </Box>
                                <Box className="info-row">
                                    <Typography variant="body2" color="text.secondary">
                                        Status:
                                    </Typography>
                                    {getStatusChip(selectedCompany?.status)}
                                </Box>
                                <Box className="info-row">
                                    <Typography variant="body2" color="text.secondary">
                                        Join Date:
                                    </Typography>
                                    <Typography>{selectedCompany?.joinDate}</Typography>
                                </Box>
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Company Dialog */}
            <Dialog
                open={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
            >
                <DialogTitle>Delete Company</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete {selectedCompany?.name}? This action cannot be undone.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                    <Button color="error" variant="contained">
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CompanyList; 