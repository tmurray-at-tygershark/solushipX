import React, { useState } from 'react';
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
    TablePagination,
    Chip,
    IconButton,
    Tooltip,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    Visibility as ViewIcon,
    Download as DownloadIcon,
    Delete as DeleteIcon,
    MoreVert as MoreIcon,
    Refresh as RefreshIcon,
    History as HistoryIcon,
    CheckCircle as SuccessIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import TestResultsComparison from './TestResultsComparison';

export default function TestingHistory({
    carrierId,
    testingHistory = [],
    isLoading = false,
    onRefresh
}) {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedTest, setSelectedTest] = useState(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [contextTest, setContextTest] = useState(null);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleViewDetails = (test) => {
        setSelectedTest(test);
        setDetailsDialogOpen(true);
        setContextMenu(null);
    };

    const handleContextMenu = (event, test) => {
        event.preventDefault();
        setContextMenu(
            contextMenu === null
                ? { mouseX: event.clientX + 2, mouseY: event.clientY - 6 }
                : null
        );
        setContextTest(test);
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
        setContextTest(null);
    };

    const getAccuracyColor = (accuracy) => {
        if (accuracy >= 0.9) return 'success';
        if (accuracy >= 0.7) return 'warning';
        return 'error';
    };

    const getStatusIcon = (accuracy) => {
        if (accuracy >= 0.8) return <SuccessIcon sx={{ color: '#10b981', fontSize: 16 }} />;
        if (accuracy >= 0.6) return <WarningIcon sx={{ color: '#f59e0b', fontSize: 16 }} />;
        return <ErrorIcon sx={{ color: '#ef4444', fontSize: 16 }} />;
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'N/A';

        let date;
        if (timestamp.seconds) {
            // Firestore timestamp
            date = new Date(timestamp.seconds * 1000);
        } else {
            date = new Date(timestamp);
        }

        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    const formatPercentage = (value) => `${Math.round((value || 0) * 100)}%`;

    const paginatedHistory = testingHistory.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!carrierId) {
        return (
            <Alert severity="info" sx={{ fontSize: '12px' }}>
                Select a carrier to view testing history
            </Alert>
        );
    }

    if (testingHistory.length === 0) {
        return (
            <Paper sx={{ p: 6, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                <HistoryIcon sx={{ fontSize: 64, color: '#d1d5db', mb: 2 }} />
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 1 }}>
                    No Testing History
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                    Run some tests to see the history here
                </Typography>
                <Button
                    variant="outlined"
                    onClick={onRefresh}
                    startIcon={<RefreshIcon />}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Refresh
                </Button>
            </Paper>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Testing History ({testingHistory.length} tests)
                </Typography>
                <Button
                    variant="outlined"
                    onClick={onRefresh}
                    startIcon={<RefreshIcon />}
                    size="small"
                    sx={{ fontSize: '12px' }}
                    disabled={isLoading}
                >
                    Refresh
                </Button>
            </Box>

            {/* History Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>File Name</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Test Type</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Accuracy</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Confidence</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Quality</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Date</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedHistory.map((test, index) => (
                            <TableRow
                                key={test.id || index}
                                hover
                                onContextMenu={(e) => handleContextMenu(e, test)}
                                sx={{ cursor: 'context-menu' }}
                            >
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Tooltip title={test.fileName}>
                                        <Typography sx={{
                                            fontSize: '12px',
                                            maxWidth: 200,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {test.fileName}
                                        </Typography>
                                    </Tooltip>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Chip
                                        label={test.testType === 'accuracy_test' ? 'Accuracy' : 'Quality'}
                                        size="small"
                                        color={test.testType === 'accuracy_test' ? 'primary' : 'default'}
                                        sx={{ fontSize: '10px' }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {formatPercentage(test.accuracyMetrics?.overall)}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {formatPercentage(test.accuracyMetrics?.confidence)}
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={test.accuracyMetrics?.extractionQuality || 'medium'}
                                        size="small"
                                        color={getAccuracyColor(test.accuracyMetrics?.overall || 0)}
                                        sx={{ fontSize: '10px' }}
                                    />
                                </TableCell>
                                <TableCell>
                                    {getStatusIcon(test.accuracyMetrics?.overall || 0)}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {formatDate(test.timestamps?.processed)}
                                </TableCell>
                                <TableCell>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleViewDetails(test)}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        <ViewIcon fontSize="small" />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleContextMenu(e, test)}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        <MoreIcon fontSize="small" />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={testingHistory.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    sx={{
                        '& .MuiTablePagination-toolbar': { fontSize: '12px' },
                        '& .MuiTablePagination-selectLabel': { fontSize: '12px' },
                        '& .MuiTablePagination-displayedRows': { fontSize: '12px' }
                    }}
                />
            </TableContainer>

            {/* Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={handleCloseContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem onClick={() => handleViewDetails(contextTest)} sx={{ fontSize: '12px' }}>
                    <ListItemIcon>
                        <ViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>View Details</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        // Handle download of test results
                        handleCloseContextMenu();
                    }}
                    sx={{ fontSize: '12px' }}
                >
                    <ListItemIcon>
                        <DownloadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Download Results</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        // Handle delete test
                        handleCloseContextMenu();
                    }}
                    sx={{ fontSize: '12px', color: '#ef4444' }}
                >
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" sx={{ color: '#ef4444' }} />
                    </ListItemIcon>
                    <ListItemText>Delete Test</ListItemText>
                </MenuItem>
            </Menu>

            {/* Test Details Dialog */}
            <Dialog
                open={detailsDialogOpen}
                onClose={() => setDetailsDialogOpen(false)}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    Test Details - {selectedTest?.fileName}
                    <IconButton onClick={() => setDetailsDialogOpen(false)} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {selectedTest && (
                        <TestResultsComparison
                            testResults={selectedTest}
                            expectedResults={selectedTest?.expectedResults}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </Box>
    );
}
