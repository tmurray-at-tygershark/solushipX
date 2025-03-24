import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    InputAdornment,
    useTheme,
    Button,
    InputBase
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Customers = () => {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    // Mock data - replace with actual API call
    const customers = [
        {
            accountNumber: 'ACC001',
            company: 'Acme Corporation',
            status: 'Active'
        },
        {
            accountNumber: 'ACC002',
            company: 'Tech Solutions Inc',
            status: 'Active'
        },
        {
            accountNumber: 'ACC003',
            company: 'Global Industries',
            status: 'Inactive'
        },
        {
            accountNumber: 'ACC004',
            company: 'Innovation Labs',
            status: 'Suspended'
        }
    ];

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'active':
                return 'success';
            case 'inactive':
                return 'default';
            case 'suspended':
                return 'error';
            default:
                return 'default';
        }
    };

    const filteredCustomers = customers.filter(customer =>
        customer.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.company.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Box sx={{ p: 3 }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ width: '100%' }}
            >
                <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
                    {/* Page Header */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 4
                    }}>
                        <Typography
                            variant="h3"
                            component="h2"
                            sx={{
                                fontWeight: 800,
                                color: '#000',
                                letterSpacing: '-0.02em'
                            }}
                        >
                            Customers
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                startIcon={<i className="fas fa-download"></i>}
                                sx={{
                                    borderColor: '#000',
                                    color: '#000',
                                    '&:hover': {
                                        borderColor: '#000',
                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                    }
                                }}
                            >
                                Export
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<i className="fas fa-plus"></i>}
                                sx={{
                                    bgcolor: '#000',
                                    '&:hover': {
                                        bgcolor: '#333'
                                    }
                                }}
                            >
                                Create Customer
                            </Button>
                            <IconButton
                                sx={{
                                    border: '1px solid #000',
                                    color: '#000',
                                    '&:hover': {
                                        bgcolor: 'rgba(0, 0, 0, 0.04)'
                                    }
                                }}
                            >
                                <i className="fas fa-ellipsis-v"></i>
                            </IconButton>
                        </Box>
                    </Box>

                    {/* Search Bar */}
                    <Paper
                        component="div"
                        sx={{
                            p: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            mb: 3,
                            boxShadow: 'none',
                            border: '1px solid #dfe3e8'
                        }}
                    >
                        <SearchIcon sx={{ p: 1, color: 'action.active' }} />
                        <InputBase
                            sx={{ ml: 1, flex: 1 }}
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </Paper>

                    {/* Customers Table */}
                    <Paper
                        elevation={0}
                        sx={{
                            borderRadius: 2,
                            border: '1px solid #e0e0e0',
                            overflow: 'hidden'
                        }}
                    >
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>ACCOUNT #</TableCell>
                                        <TableCell>Company</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredCustomers.map((customer) => (
                                        <TableRow key={customer.accountNumber}>
                                            <TableCell>{customer.accountNumber}</TableCell>
                                            <TableCell>{customer.company}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={customer.status}
                                                    color={getStatusColor(customer.status)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    onClick={() => navigate(`/customers/${customer.accountNumber}`)}
                                                    sx={{ color: '#000' }}
                                                >
                                                    <i className="fas fa-chevron-right"></i>
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Box>
            </motion.div>
        </Box>
    );
};

export default Customers; 