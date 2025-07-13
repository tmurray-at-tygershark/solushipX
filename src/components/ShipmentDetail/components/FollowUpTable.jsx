import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Chip,
    Typography,
    Box,
    Avatar,
    Tooltip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Collapse
} from '@mui/material';
import {
    Edit as EditIcon,
    MoreVert as MoreVertIcon,
    CheckCircle as CompleteIcon,
    Delete as DeleteIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    Assignment as InternalIcon,
    AccessTime as TimeIcon,
    Person as PersonIcon,
    Group as GroupIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const FollowUpTable = ({ followUps, onEditFollowUp, onRefresh, availableUsers }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedFollowUp, setSelectedFollowUp] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [completeLoading, setCompleteLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const handleMenuOpen = (event, followUp) => {
        setAnchorEl(event.currentTarget);
        setSelectedFollowUp(followUp);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedFollowUp(null);
    };

    const handleEditClick = () => {
        if (selectedFollowUp) {
            onEditFollowUp(selectedFollowUp);
        }
        handleMenuClose();
    };

    const handleCompleteClick = async () => {
        if (selectedFollowUp && !completeLoading) {
            setCompleteLoading(true);
            try {
                const { httpsCallable } = await import('firebase/functions');
                const { functions } = await import('../../../firebase');

                const completeTask = httpsCallable(functions, 'completeTask');
                await completeTask({
                    taskId: selectedFollowUp.id,
                    completionNote: 'Task marked as complete'
                });

                // Refresh the follow-up list
                if (onRefresh) {
                    onRefresh();
                }
            } catch (error) {
                console.error('Error completing task:', error);
                alert('Failed to complete task. Please try again.');
            } finally {
                setCompleteLoading(false);
            }
        }
        handleMenuClose();
    };

    const handleDeleteClick = async () => {
        if (selectedFollowUp && !deleteLoading) {
            // Show confirmation dialog
            const confirmed = window.confirm('Are you sure you want to delete this follow-up task? This action cannot be undone.');

            if (confirmed) {
                setDeleteLoading(true);
                try {
                    const { httpsCallable } = await import('firebase/functions');
                    const { functions } = await import('../../../firebase');

                    const deleteFollowUpTask = httpsCallable(functions, 'deleteFollowUpTask');
                    await deleteFollowUpTask({
                        taskId: selectedFollowUp.id
                    });

                    // Refresh the follow-up list
                    if (onRefresh) {
                        onRefresh();
                    }
                } catch (error) {
                    console.error('Error deleting task:', error);
                    alert('Failed to delete task. Please try again.');
                } finally {
                    setDeleteLoading(false);
                }
            }
        }
        handleMenuClose();
    };

    const handleExpandRow = (followUpId) => {
        const newExpandedRows = new Set(expandedRows);
        if (newExpandedRows.has(followUpId)) {
            newExpandedRows.delete(followUpId);
        } else {
            newExpandedRows.add(followUpId);
        }
        setExpandedRows(newExpandedRows);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed':
                return 'success';
            case 'pending':
                return 'secondary';
            case 'in_progress':
                return 'info';
            case 'overdue':
                return 'error';
            default:
                return 'default';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'completed':
                return 'Completed';
            case 'pending':
                return 'Incomplete';
            case 'in_progress':
                return 'In Progress';
            case 'overdue':
                return 'Overdue';
            default:
                return 'Unknown';
        }
    };

    const getActionTypeIcons = (actionTypes) => {
        if (!actionTypes || !Array.isArray(actionTypes)) return null;

        return actionTypes.map((type, index) => {
            let icon;
            let color;
            switch (type.toLowerCase()) {
                case 'email':
                    icon = <EmailIcon sx={{ fontSize: 14 }} />;
                    color = '#3b82f6';
                    break;
                case 'phone':
                    icon = <PhoneIcon sx={{ fontSize: 14 }} />;
                    color = '#10b981';
                    break;
                case 'internal':
                    icon = <InternalIcon sx={{ fontSize: 14 }} />;
                    color = '#8b5cf6';
                    break;
                default:
                    icon = <InternalIcon sx={{ fontSize: 14 }} />;
                    color = '#6b7280';
            }

            return (
                <Tooltip key={index} title={type.charAt(0).toUpperCase() + type.slice(1)}>
                    <Chip
                        icon={icon}
                        label={type}
                        size="small"
                        sx={{
                            height: 20,
                            fontSize: '10px',
                            bgcolor: color,
                            color: 'white',
                            mr: 0.5,
                            '& .MuiChip-icon': {
                                color: 'white'
                            }
                        }}
                    />
                </Tooltip>
            );
        });
    };

    const getAssigneeDisplay = (followUp) => {
        if (followUp.assignmentType === 'general') {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        General Assignment
                    </Typography>
                </Box>
            );
        }

        // Find the assigned user
        const assignedUser = availableUsers.find(user => user.id === followUp.assignedTo);
        if (assignedUser) {
            const displayName = assignedUser.firstName && assignedUser.lastName
                ? `${assignedUser.firstName} ${assignedUser.lastName}`
                : assignedUser.displayName || assignedUser.email;

            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                        src={assignedUser.photoURL || assignedUser.avatar}
                        sx={{ width: 20, height: 20, fontSize: '10px' }}
                    >
                        {displayName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Typography sx={{ fontSize: '12px' }}>
                        {displayName}
                    </Typography>
                </Box>
            );
        }

        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GroupIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    General
                </Typography>
            </Box>
        );
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';

        try {
            // Handle Firestore timestamp
            if (date.seconds) {
                return format(new Date(date.seconds * 1000), 'MMM dd, yyyy h:mm a');
            }
            // Handle regular date
            return format(new Date(date), 'MMM dd, yyyy h:mm a');
        } catch (error) {
            return 'Invalid Date';
        }
    };

    const isOverdue = (dueDate, status) => {
        if (status === 'completed') return false;
        if (!dueDate) return false;

        try {
            const due = dueDate.seconds ? new Date(dueDate.seconds * 1000) : new Date(dueDate);
            return due < new Date();
        } catch (error) {
            return false;
        }
    };

    if (!followUps || followUps.length === 0) {
        return (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 300,
                color: '#6b7280'
            }}>
                <InternalIcon sx={{ fontSize: 48, mb: 2, color: '#d1d5db' }} />
                <Typography sx={{ fontSize: '16px', fontWeight: 500, mb: 1 }}>
                    No Follow-Up Tasks
                </Typography>
                <Typography sx={{ fontSize: '14px', textAlign: 'center' }}>
                    No follow-up tasks have been created for this shipment yet.
                    <br />
                    Click "Create New" to add your first follow-up task.
                </Typography>
            </Box>
        );
    }

    return (
        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
            <Table stickyHeader size="small">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            bgcolor: '#f8fafc',
                            color: '#374151',
                            width: 40
                        }}>

                        </TableCell>
                        <TableCell sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            bgcolor: '#f8fafc',
                            color: '#374151'
                        }}>
                            Task
                        </TableCell>
                        <TableCell sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            bgcolor: '#f8fafc',
                            color: '#374151'
                        }}>
                            Actions
                        </TableCell>
                        <TableCell sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            bgcolor: '#f8fafc',
                            color: '#374151'
                        }}>
                            Due Date
                        </TableCell>
                        <TableCell sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            bgcolor: '#f8fafc',
                            color: '#374151'
                        }}>
                            Reminder
                        </TableCell>
                        <TableCell sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            bgcolor: '#f8fafc',
                            color: '#374151'
                        }}>
                            Assigned To
                        </TableCell>
                        <TableCell sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            bgcolor: '#f8fafc',
                            color: '#374151'
                        }}>
                            Status
                        </TableCell>
                        <TableCell sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            bgcolor: '#f8fafc',
                            color: '#374151',
                            width: 60
                        }}>
                            Actions
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {followUps.map((followUp) => (
                        <React.Fragment key={followUp.id}>
                            <TableRow
                                sx={{
                                    '&:hover': { bgcolor: '#f9fafb' },
                                    bgcolor: isOverdue(followUp.dueDate, followUp.status) ? '#fef2f2' : 'inherit'
                                }}
                            >
                                <TableCell sx={{ fontSize: '12px', width: 40 }}>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleExpandRow(followUp.id)}
                                        sx={{ p: 0.5 }}
                                    >
                                        {expandedRows.has(followUp.id) ?
                                            <ExpandLessIcon sx={{ fontSize: 16 }} /> :
                                            <ExpandMoreIcon sx={{ fontSize: 16 }} />
                                        }
                                    </IconButton>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', maxWidth: 200 }}>
                                    <Box>
                                        <Typography sx={{
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            mb: 0.5
                                        }}>
                                            {followUp.title}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                        {getActionTypeIcons(followUp.actionTypes)}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TimeIcon sx={{
                                            fontSize: 14,
                                            color: isOverdue(followUp.dueDate, followUp.status) ? '#ef4444' : '#6b7280'
                                        }} />
                                        <Typography sx={{
                                            fontSize: '12px',
                                            color: isOverdue(followUp.dueDate, followUp.status) ? '#ef4444' : 'inherit'
                                        }}>
                                            {formatDate(followUp.dueDate)}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TimeIcon sx={{
                                            fontSize: 14,
                                            color: '#6b7280'
                                        }} />
                                        <Typography sx={{
                                            fontSize: '12px',
                                            color: '#6b7280'
                                        }}>
                                            {followUp.reminderDate ? formatDate(followUp.reminderDate) : 'No reminder'}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {getAssigneeDisplay(followUp)}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Chip
                                        label={getStatusText(followUp.status || 'pending')}
                                        color={getStatusColor(followUp.status || 'pending')}
                                        size="small"
                                        sx={{
                                            height: 20,
                                            fontSize: '10px',
                                            fontWeight: 500
                                        }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleMenuOpen(e, followUp)}
                                        sx={{ p: 0.5 }}
                                    >
                                        <MoreVertIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell sx={{ py: 0 }} colSpan={7}>
                                    <Collapse in={expandedRows.has(followUp.id)} timeout="auto" unmountOnExit>
                                        <Box sx={{ margin: 1 }}>
                                            <Typography sx={{
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                mb: 1,
                                                color: '#374151'
                                            }}>
                                                Note:
                                            </Typography>
                                            <Typography sx={{
                                                fontSize: '12px',
                                                color: '#6b7280',
                                                lineHeight: 1.4,
                                                whiteSpace: 'pre-wrap'
                                            }}>
                                                {followUp.description || 'No additional notes for this task.'}
                                            </Typography>
                                        </Box>
                                    </Collapse>
                                </TableCell>
                            </TableRow>
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>

            {/* Action Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                    sx: {
                        width: 200,
                        maxWidth: '100%'
                    }
                }}
            >
                <MenuItem onClick={handleEditClick}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary="Edit Task"
                        primaryTypographyProps={{ fontSize: '12px' }}
                    />
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleCompleteClick} disabled={completeLoading}>
                    <ListItemIcon>
                        <CompleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary={completeLoading ? "Completing..." : "Mark Complete"}
                        primaryTypographyProps={{ fontSize: '12px' }}
                    />
                </MenuItem>
                <MenuItem onClick={handleDeleteClick} disabled={deleteLoading}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                        primary={deleteLoading ? "Deleting..." : "Delete Task"}
                        primaryTypographyProps={{ fontSize: '12px' }}
                    />
                </MenuItem>
            </Menu>
        </TableContainer>
    );
};

export default FollowUpTable; 