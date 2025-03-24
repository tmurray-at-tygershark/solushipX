import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Button,
    Menu,
    MenuItem,
    Checkbox,
    Toolbar,
    InputBase,
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterListIcon,
    GetApp as ExportIcon,
    Add as AddIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import './Dashboard.css';

// Helper function to generate random shipment data
const generateRandomShipments = (count) => {
    const carriers = ['FedEx', 'UPS', 'DHL', 'USPS', 'Canada Post', 'Purolator'];
    const statuses = ['In Transit', 'Delivered', 'Pending', 'Awaiting Shipment'];
    const usStates = [
        { city: 'New York', state: 'NY' },
        { city: 'Los Angeles', state: 'CA' },
        { city: 'Chicago', state: 'IL' },
        { city: 'Houston', state: 'TX' },
        { city: 'Miami', state: 'FL' },
        { city: 'Seattle', state: 'WA' },
        { city: 'Boston', state: 'MA' },
        { city: 'Denver', state: 'CO' }
    ];
    const canadianProvinces = [
        { city: 'Toronto', province: 'ON' },
        { city: 'Vancouver', province: 'BC' },
        { city: 'Montreal', province: 'QC' },
        { city: 'Calgary', province: 'AB' },
        { city: 'Ottawa', province: 'ON' },
        { city: 'Edmonton', province: 'AB' },
        { city: 'Winnipeg', province: 'MB' },
        { city: 'Halifax', province: 'NS' }
    ];
    const customers = [
        'John Smith', 'Emma Wilson', 'Michael Brown', 'Sarah Davis',
        'David Miller', 'Lisa Anderson', 'James Taylor', 'Jennifer White',
        'Robert Martin', 'Maria Garcia', 'William Lee', 'Patricia Moore',
        'Christopher Clark', 'Elizabeth Hall', 'Daniel Young', 'Margaret King'
    ];

    const getRandomLocation = () => {
        const isUS = Math.random() < 0.5;
        return isUS ? usStates[Math.floor(Math.random() * usStates.length)] :
            canadianProvinces[Math.floor(Math.random() * canadianProvinces.length)];
    };

    const getRandomDate = () => {
        const start = new Date(2024, 0, 1);
        const end = new Date();
        return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    };

    const getRandomCost = () => (50 + Math.random() * 450).toFixed(2);
    const getRandomItems = () => Math.floor(1 + Math.random() * 5);

    return Array.from({ length: count }, (_, i) => {
        const origin = getRandomLocation();
        let destination;
        do {
            destination = getRandomLocation();
        } while (destination === origin);

        const items = getRandomItems();
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const carrier = carriers[Math.floor(Math.random() * carriers.length)];
        const date = getRandomDate();

        return {
            id: `SHP${String(287683 - i).padStart(6, '0')}`,
            date: date.toLocaleString(),
            customer: customers[Math.floor(Math.random() * customers.length)],
            origin: `${origin.city}, ${origin.state || origin.province}`,
            destination: `${destination.city}, ${destination.state || destination.province}`,
            status: status,
            carrier: carrier,
            trackingNumber: Math.random().toString(36).substring(2, 12).toUpperCase(),
            items: `${items} ${items === 1 ? 'item' : 'items'}`,
            deliveryStatus: status === 'Delivered' ? 'Delivered' : status === 'Awaiting Shipment' ? 'Not Started' : 'On Schedule',
            cost: `$${getRandomCost()}`
        };
    });
};

const Dashboard = () => {
    const [selectedTab, setSelectedTab] = useState('all');
    const [anchorEl, setAnchorEl] = useState(null);

    // Generate 20 random shipments instead of 50
    const shipments = generateRandomShipments(20);

    // Calculate stats
    const stats = {
        total: shipments.length,
        inTransit: shipments.filter(s => s.status === 'In Transit').length,
        delivered: shipments.filter(s => s.status === 'Delivered').length,
        awaitingShipment: shipments.filter(s => s.status === 'Awaiting Shipment').length,
        totalItems: shipments.reduce((acc, s) => acc + parseInt(s.items), 0)
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const handleMenuClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // Filter shipments based on selected tab
    const filteredShipments = shipments.filter(shipment => {
        switch (selectedTab) {
            case 'in-transit':
                return shipment.status === 'In Transit';
            case 'delivered':
                return shipment.status === 'Delivered';
            case 'awaiting':
                return shipment.status === 'Awaiting Shipment';
            default:
                return true;
        }
    });

    return (
        <Box sx={{ width: '100%', bgcolor: '#f6f6f7', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
                        Shipments: All locations
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<ExportIcon />}
                            sx={{ color: 'text.primary', borderColor: 'divider' }}
                        >
                            Export
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={handleMenuClick}
                            sx={{ color: 'text.primary', borderColor: 'divider' }}
                        >
                            More actions
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            component={Link}
                            to="/create-shipment"
                            sx={{ bgcolor: '#000', '&:hover': { bgcolor: '#333' } }}
                        >
                            Create shipment
                        </Button>
                    </Box>
                </Box>

                {/* Stats Cards */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
                    <Paper sx={{ p: 2 }}>
                        <Typography className="stats-label">Shipments</Typography>
                        <Typography className="stats-number">{stats.total}</Typography>
                        <Typography className="stats-trend up">↑ 23%</Typography>
                    </Paper>
                    <Paper sx={{ p: 2 }}>
                        <Typography className="stats-label">Items shipped</Typography>
                        <Typography className="stats-number">{stats.totalItems}</Typography>
                        <Typography className="stats-trend up">↑ 15%</Typography>
                    </Paper>
                    <Paper sx={{ p: 2 }}>
                        <Typography className="stats-label">In Transit</Typography>
                        <Typography className="stats-number">{stats.inTransit}</Typography>
                        <Typography className="stats-trend up">↑ 12%</Typography>
                    </Paper>
                    <Paper sx={{ p: 2 }}>
                        <Typography className="stats-label">Delivered</Typography>
                        <Typography className="stats-number">{stats.delivered}</Typography>
                        <Typography className="stats-trend up">↑ 18%</Typography>
                    </Paper>
                </Box>

                {/* Tabs and Filters */}
                <Paper sx={{ mb: 3 }}>
                    <Toolbar sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={selectedTab} onChange={handleTabChange}>
                            <Tab label={`All (${stats.total})`} value="all" />
                            <Tab label={`In Transit (${stats.inTransit})`} value="in-transit" />
                            <Tab label={`Delivered (${stats.delivered})`} value="delivered" />
                            <Tab label={`Awaiting Shipment (${stats.awaitingShipment})`} value="awaiting" />
                        </Tabs>
                        <Box sx={{ flexGrow: 1 }} />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Paper sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: 400 }}>
                                <SearchIcon sx={{ p: 1, color: 'action.active' }} />
                                <InputBase
                                    sx={{ ml: 1, flex: 1 }}
                                    placeholder="Search shipments"
                                />
                            </Paper>
                            <IconButton>
                                <FilterListIcon />
                            </IconButton>
                        </Box>
                    </Toolbar>

                    {/* Shipments Table */}
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox />
                                    </TableCell>
                                    <TableCell>Shipment</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Customer</TableCell>
                                    <TableCell>Origin</TableCell>
                                    <TableCell>Destination</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Carrier</TableCell>
                                    <TableCell>Items</TableCell>
                                    <TableCell>Cost</TableCell>
                                    <TableCell>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredShipments.map((shipment) => (
                                    <TableRow key={shipment.id} hover>
                                        <TableCell padding="checkbox">
                                            <Checkbox />
                                        </TableCell>
                                        <TableCell>
                                            <Link
                                                to={`/shipment/${shipment.id}`}
                                                style={{
                                                    color: '#2C6ECB',
                                                    textDecoration: 'none',
                                                    fontWeight: 500
                                                }}
                                            >
                                                {shipment.id}
                                            </Link>
                                        </TableCell>
                                        <TableCell>{shipment.date}</TableCell>
                                        <TableCell>{shipment.customer}</TableCell>
                                        <TableCell>{shipment.origin}</TableCell>
                                        <TableCell>{shipment.destination}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={shipment.status}
                                                color={
                                                    shipment.status === 'Delivered' ? 'success' :
                                                        shipment.status === 'In Transit' ? 'primary' :
                                                            'default'
                                                }
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>{shipment.carrier}</TableCell>
                                        <TableCell>{shipment.items}</TableCell>
                                        <TableCell>{shipment.cost}</TableCell>
                                        <TableCell>
                                            <IconButton size="small">
                                                <MoreVertIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* More Actions Menu */}
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                >
                    <MenuItem onClick={handleMenuClose}>Import shipments</MenuItem>
                    <MenuItem onClick={handleMenuClose}>Export selected</MenuItem>
                    <MenuItem onClick={handleMenuClose}>Print shipping labels</MenuItem>
                </Menu>
            </Box>
        </Box>
    );
};

export default Dashboard; 