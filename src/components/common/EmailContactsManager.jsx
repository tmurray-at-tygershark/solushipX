import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    TextField,
    Chip,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Grid,
    Alert,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Menu,
    MenuItem,
    Divider,
    Card,
    CardContent,
    CardHeader
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    LocationOn as LocationIcon,
    Edit as EditIcon,
    ContentCopy as CopyIcon,
    FileCopy as FileCopyIcon,
    MoreVert as MoreVertIcon,
    Email as EmailIcon
} from '@mui/icons-material';

const CONTACT_TYPES = [
    { id: 'dispatch', label: 'Dispatch', icon: '🚛', color: '#e3f2fd', darkColor: '#1976d2' },
    { id: 'customer_service', label: 'Customer Service', icon: '📞', color: '#f3e5f5', darkColor: '#7b1fa2' },
    { id: 'quotes', label: 'Quotes', icon: '💰', color: '#e8f5e8', darkColor: '#388e3c' },
    { id: 'billing_adjustments', label: 'Billing Adjustments', icon: '📊', color: '#fff3e0', darkColor: '#f57c00' },
    { id: 'claims', label: 'Claims', icon: '📋', color: '#ffebee', darkColor: '#d32f2f' },
    { id: 'sales_reps', label: 'Sales Reps', icon: '🤝', color: '#e0f2f1', darkColor: '#00796b' },
    { id: 'customs', label: 'Customs', icon: '🛃', color: '#fce4ec', darkColor: '#c2185b' },
    { id: 'other', label: 'Other', icon: '📧', color: '#f5f5f5', darkColor: '#616161' }
];

const EmailContactsManager = ({
    value = [],
    onChange,
    mode = 'full', // 'full' or 'compact'
    maxTerminals = 10,
    maxEmailsPerType = 5
}) => {
    const [terminals, setTerminals] = useState([]);
    const [expandedTerminals, setExpandedTerminals] = useState({});
    const [addTerminalDialog, setAddTerminalDialog] = useState(false);
    const [newTerminalName, setNewTerminalName] = useState('');
    const [editingTerminal, setEditingTerminal] = useState(null);
    const [editingTerminalName, setEditingTerminalName] = useState('');
    const [copyToAllDialog, setCopyToAllDialog] = useState(false);
    const [copyToAllEmail, setCopyToAllEmail] = useState('');
    const [copyToAllTerminalId, setCopyToAllTerminalId] = useState('');
    const [terminalMenuAnchor, setTerminalMenuAnchor] = useState(null);
    const [selectedTerminalForMenu, setSelectedTerminalForMenu] = useState(null);

    // Initialize terminals from value with useCallback to prevent infinite re-renders
    const initializeTerminals = useCallback(() => {
        if (value && Array.isArray(value) && value.length > 0) {
            setTerminals(value);
            // Expand the first terminal by default if none are expanded
            if (Object.keys(expandedTerminals).length === 0 && value.length > 0) {
                setExpandedTerminals({ [value[0].id]: true });
            }
        } else {
            // Initialize with default terminal
            const defaultTerminal = {
                id: 'default',
                name: 'Default Terminal',
                isDefault: true,
                contacts: CONTACT_TYPES.map(type => ({
                    type: type.id,
                    emails: []
                }))
            };
            setTerminals([defaultTerminal]);
            setExpandedTerminals({ 'default': true });
        }
    }, [value, expandedTerminals]);

    // Initialize terminals when component mounts or value changes
    useEffect(() => {
        initializeTerminals();
    }, [initializeTerminals]);

    // Update parent when terminals change - use useCallback to prevent unnecessary calls
    const notifyParent = useCallback((newTerminals) => {
        if (onChange && JSON.stringify(newTerminals) !== JSON.stringify(terminals)) {
            console.log('📧 EmailContactsManager: Notifying parent of change:', newTerminals);
            onChange(newTerminals);
        }
    }, [onChange, terminals]);

    useEffect(() => {
        notifyParent(terminals);
    }, [terminals, notifyParent]);

    const handleAddTerminal = useCallback(() => {
        if (!newTerminalName.trim()) return;

        const newTerminal = {
            id: `terminal_${Date.now()}`,
            name: newTerminalName.trim(),
            isDefault: false,
            contacts: CONTACT_TYPES.map(type => ({
                type: type.id,
                emails: []
            }))
        };

        const updatedTerminals = [...terminals, newTerminal];
        setTerminals(updatedTerminals);
        setExpandedTerminals(prev => ({ ...prev, [newTerminal.id]: true }));
        setNewTerminalName('');
        setAddTerminalDialog(false);

        // Notify parent immediately
        if (onChange) {
            onChange(updatedTerminals);
        }
    }, [newTerminalName, terminals, onChange]);

    const handleDeleteTerminal = useCallback((terminalId) => {
        const updatedTerminals = terminals.filter(t => t.id !== terminalId);
        setTerminals(updatedTerminals);
        setExpandedTerminals(prev => {
            const newExpanded = { ...prev };
            delete newExpanded[terminalId];
            return newExpanded;
        });

        // Notify parent immediately
        if (onChange) {
            onChange(updatedTerminals);
        }
    }, [terminals, onChange]);

    const handleRenameTerminal = useCallback((terminalId, newName) => {
        if (!newName.trim()) return;

        const updatedTerminals = terminals.map(terminal =>
            terminal.id === terminalId
                ? { ...terminal, name: newName.trim() }
                : terminal
        );
        setTerminals(updatedTerminals);
        setEditingTerminal(null);
        setEditingTerminalName('');

        // Notify parent immediately
        if (onChange) {
            onChange(updatedTerminals);
        }
    }, [terminals, onChange]);

    const handleAddEmail = useCallback((terminalId, contactType) => {
        const updatedTerminals = terminals.map(terminal => {
            if (terminal.id === terminalId) {
                return {
                    ...terminal,
                    contacts: terminal.contacts.map(contact => {
                        if (contact.type === contactType) {
                            return {
                                ...contact,
                                emails: [...contact.emails, '']
                            };
                        }
                        return contact;
                    })
                };
            }
            return terminal;
        });

        setTerminals(updatedTerminals);

        // CRITICAL FIX: Notify parent of email changes
        if (onChange) {
            onChange(updatedTerminals);
        }
    }, [terminals, onChange]);

    const handleUpdateEmail = useCallback((terminalId, contactType, emailIndex, newEmail) => {
        const updatedTerminals = terminals.map(terminal => {
            if (terminal.id === terminalId) {
                return {
                    ...terminal,
                    contacts: terminal.contacts.map(contact => {
                        if (contact.type === contactType) {
                            const newEmails = [...contact.emails];
                            newEmails[emailIndex] = newEmail;
                            return { ...contact, emails: newEmails };
                        }
                        return contact;
                    })
                };
            }
            return terminal;
        });

        setTerminals(updatedTerminals);

        // CRITICAL FIX: Notify parent of email changes
        if (onChange) {
            onChange(updatedTerminals);
        }
    }, [terminals, onChange]);

    const handleDeleteEmail = useCallback((terminalId, contactType, emailIndex) => {
        const updatedTerminals = terminals.map(terminal => {
            if (terminal.id === terminalId) {
                return {
                    ...terminal,
                    contacts: terminal.contacts.map(contact => {
                        if (contact.type === contactType) {
                            const newEmails = contact.emails.filter((_, index) => index !== emailIndex);
                            return { ...contact, emails: newEmails };
                        }
                        return contact;
                    })
                };
            }
            return terminal;
        });

        setTerminals(updatedTerminals);

        // CRITICAL FIX: Notify parent of email changes
        if (onChange) {
            onChange(updatedTerminals);
        }
    }, [terminals, onChange]);

    // FIXED: Properly implement duplicate terminal functionality
    const handleDuplicateTerminal = useCallback((terminalToCopy) => {
        const copyNumber = terminals.filter(t => t.name.startsWith(terminalToCopy.name)).length;
        const newTerminal = {
            id: `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // More unique ID
            name: `${terminalToCopy.name} ${copyNumber > 1 ? copyNumber : 'Copy'}`,
            isDefault: false,
            contacts: terminalToCopy.contacts.map(contact => ({
                type: contact.type,
                emails: [...contact.emails] // Deep copy emails array
            }))
        };

        const updatedTerminals = [...terminals, newTerminal];
        setTerminals(updatedTerminals);
        setExpandedTerminals(prev => ({ ...prev, [newTerminal.id]: true }));
        setTerminalMenuAnchor(null);
        setSelectedTerminalForMenu(null);

        // Notify parent immediately
        if (onChange) {
            onChange(updatedTerminals);
        }
    }, [terminals, onChange]);

    // NEW: Copy email to all contact types in a terminal
    const handleCopyToAllInTerminal = useCallback(() => {
        if (!copyToAllEmail.trim() || !copyToAllTerminalId) return;

        const updatedTerminals = terminals.map(terminal => {
            if (terminal.id === copyToAllTerminalId) {
                return {
                    ...terminal,
                    contacts: terminal.contacts.map(contact => ({
                        ...contact,
                        emails: contact.emails.length > 0 ? [copyToAllEmail.trim(), ...contact.emails.slice(1)] : [copyToAllEmail.trim()]
                    }))
                };
            }
            return terminal;
        });

        console.log('📧 Copy to All - Before update:', terminals);
        console.log('📧 Copy to All - After update:', updatedTerminals);

        setTerminals(updatedTerminals);

        // CRITICAL FIX: Immediately notify parent of the changes
        if (onChange) {
            onChange(updatedTerminals);
        }

        setCopyToAllDialog(false);
        setCopyToAllEmail('');
        setCopyToAllTerminalId('');
    }, [copyToAllEmail, copyToAllTerminalId, terminals, onChange]);

    const getTotalEmailCount = useCallback(() => {
        return terminals.reduce((total, terminal) => {
            return total + terminal.contacts.reduce((terminalTotal, contact) => {
                return terminalTotal + contact.emails.filter(email => email && email.trim()).length;
            }, 0);
        }, 0);
    }, [terminals]);

    const handleToggleExpanded = useCallback((terminalId) => {
        setExpandedTerminals(prev => ({
            ...prev,
            [terminalId]: !prev[terminalId]
        }));
    }, []);

    const handleStartEditTerminal = useCallback((terminalId) => {
        const terminal = terminals.find(t => t.id === terminalId);
        if (terminal) {
            setEditingTerminal(terminalId);
            setEditingTerminalName(terminal.name);
        }
    }, [terminals]);

    const handleTerminalMenuOpen = useCallback((event, terminal) => {
        event.stopPropagation();
        setTerminalMenuAnchor(event.currentTarget);
        setSelectedTerminalForMenu(terminal);
    }, []);

    const handleTerminalMenuClose = useCallback(() => {
        setTerminalMenuAnchor(null);
        setSelectedTerminalForMenu(null);
    }, []);

    const handleOpenCopyToAll = useCallback((terminalId) => {
        setCopyToAllTerminalId(terminalId);
        setCopyToAllDialog(true);
        handleTerminalMenuClose();
    }, [handleTerminalMenuClose]);

    if (mode === 'compact') {
        return (
            <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    {terminals.length} Terminal{terminals.length !== 1 ? 's' : ''}, {getTotalEmailCount()} Total Contacts
                </Typography>
                <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setExpandedTerminals(prev => {
                        const allExpanded = Object.keys(prev).every(key => prev[key]);
                        const newState = {};
                        terminals.forEach(terminal => {
                            newState[terminal.id] = !allExpanded;
                        });
                        return newState;
                    })}
                    sx={{ fontSize: '12px' }}
                >
                    {Object.values(expandedTerminals).some(Boolean) ? 'Collapse All' : 'Expand All'}
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600 }}>
                        Email Contacts by Type
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                        {terminals.length} Terminal{terminals.length !== 1 ? 's' : ''} • {getTotalEmailCount()} Total Contacts
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => setAddTerminalDialog(true)}
                    disabled={terminals.length >= maxTerminals}
                    sx={{ fontSize: '12px' }}
                >
                    Add Terminal
                </Button>
            </Box>

            {/* Note about optional emails */}
            <Alert severity="info" sx={{ mb: 2, fontSize: '11px' }}>
                📧 Email contacts are optional. Group your emails by function (Dispatch, Customer Service, etc.).
            </Alert>

            {/* Terminals */}
            {terminals.map((terminal) => (
                <Card key={terminal.id} sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                    <CardHeader
                        avatar={<LocationIcon sx={{ color: '#666' }} />}
                        title={
                            <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="h6" sx={{ fontSize: '13px', fontWeight: 600 }}>
                                    {terminal.name}
                                </Typography>
                                {terminal.isDefault && (
                                    <Chip
                                        label="Default"
                                        size="small"
                                        sx={{ height: '18px', fontSize: '10px' }}
                                        color="primary"
                                    />
                                )}
                            </Box>
                        }
                        subheader={
                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#666' }}>
                                {terminal.contacts.reduce((total, contact) =>
                                    total + contact.emails.filter(email => email && email.trim()).length, 0
                                )} contacts configured
                            </Typography>
                        }
                        action={
                            <Box display="flex" gap={1}>
                                <Tooltip title="Terminal Actions">
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleTerminalMenuOpen(e, terminal)}
                                    >
                                        <MoreVertIcon sx={{ fontSize: '16px' }} />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Rename Terminal">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleStartEditTerminal(terminal.id)}
                                        disabled={terminal.isDefault}
                                    >
                                        <EditIcon sx={{ fontSize: '16px' }} />
                                    </IconButton>
                                </Tooltip>
                                {!terminal.isDefault && (
                                    <Tooltip title="Delete Terminal">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDeleteTerminal(terminal.id)}
                                            color="error"
                                        >
                                            <DeleteIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        }
                        sx={{
                            backgroundColor: terminal.isDefault ? '#f8f9fa' : '#ffffff',
                            pb: 1
                        }}
                    />
                    <CardContent sx={{ pt: 0 }}>
                        <Grid container spacing={2}>
                            {CONTACT_TYPES.map((contactType) => {
                                const terminalContact = terminal.contacts.find(c => c.type === contactType.id);
                                const emailCount = terminalContact?.emails.filter(email => email && email.trim()).length || 0;

                                return (
                                    <Grid item xs={12} sm={6} md={4} key={contactType.id}>
                                        <Paper
                                            sx={{
                                                p: 2,
                                                backgroundColor: contactType.color,
                                                border: `1px solid ${contactType.darkColor}20`,
                                                borderLeft: `4px solid ${contactType.darkColor}`,
                                                height: '100%'
                                            }}
                                        >
                                            {/* Contact Type Header */}
                                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                <Box display="flex" alignItems="center">
                                                    <Typography sx={{ mr: 0.5, fontSize: '16px' }}>
                                                        {contactType.icon}
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px', fontWeight: 600, color: contactType.darkColor }}>
                                                        {contactType.label}
                                                    </Typography>
                                                </Box>
                                                <Chip
                                                    label={emailCount}
                                                    size="small"
                                                    sx={{
                                                        height: '20px',
                                                        fontSize: '10px',
                                                        backgroundColor: contactType.darkColor + '20',
                                                        color: contactType.darkColor,
                                                        fontWeight: 600
                                                    }}
                                                />
                                            </Box>

                                            {/* Email List */}
                                            {terminalContact?.emails && terminalContact.emails.length > 0 ? (
                                                <Box mb={1}>
                                                    {terminalContact.emails.map((email, emailIndex) => (
                                                        <Box key={`${terminal.id}-${contactType.id}-${emailIndex}`} display="flex" gap={1} mb={1}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                type="email"
                                                                placeholder={`${contactType.label} email`}
                                                                value={email || ''}
                                                                onChange={(e) => handleUpdateEmail(terminal.id, contactType.id, emailIndex, e.target.value)}
                                                                sx={{
                                                                    '& .MuiInputBase-input': { fontSize: '11px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '11px' },
                                                                    '& .MuiOutlinedInput-root': {
                                                                        backgroundColor: 'white'
                                                                    }
                                                                }}
                                                            />
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleDeleteEmail(terminal.id, contactType.id, emailIndex)}
                                                                sx={{ color: contactType.darkColor }}
                                                            >
                                                                <DeleteIcon sx={{ fontSize: '14px' }} />
                                                            </IconButton>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            ) : (
                                                <Box mb={1}>
                                                    <Typography variant="body2" sx={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>
                                                        No emails configured
                                                    </Typography>
                                                </Box>
                                            )}

                                            {/* Add Email Button */}
                                            <Button
                                                fullWidth
                                                variant="outlined"
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => handleAddEmail(terminal.id, contactType.id)}
                                                disabled={(terminalContact?.emails.length || 0) >= maxEmailsPerType}
                                                sx={{
                                                    fontSize: '10px',
                                                    borderColor: contactType.darkColor,
                                                    color: contactType.darkColor,
                                                    '&:hover': {
                                                        borderColor: contactType.darkColor,
                                                        backgroundColor: contactType.darkColor + '10'
                                                    }
                                                }}
                                            >
                                                Add Email
                                            </Button>
                                        </Paper>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    </CardContent>
                </Card>
            ))}

            {terminals.length === 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                    No terminals configured. Click "Add Terminal" to create your first terminal.
                </Alert>
            )}

            {/* Terminal Actions Menu */}
            <Menu
                anchorEl={terminalMenuAnchor}
                open={Boolean(terminalMenuAnchor)}
                onClose={handleTerminalMenuClose}
            >
                <MenuItem
                    onClick={() => handleDuplicateTerminal(selectedTerminalForMenu)}
                    disabled={terminals.length >= maxTerminals}
                >
                    <CopyIcon sx={{ mr: 1, fontSize: '16px' }} />
                    Duplicate Terminal
                </MenuItem>
                <MenuItem
                    onClick={() => handleOpenCopyToAll(selectedTerminalForMenu?.id)}
                >
                    <FileCopyIcon sx={{ mr: 1, fontSize: '16px' }} />
                    Copy Email to All Types
                </MenuItem>
            </Menu>

            {/* Add Terminal Dialog */}
            <Dialog open={addTerminalDialog} onClose={() => setAddTerminalDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add New Terminal</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Terminal Name"
                        value={newTerminalName}
                        onChange={(e) => setNewTerminalName(e.target.value)}
                        placeholder="e.g., Toronto Terminal, Vancouver Hub, etc."
                        sx={{ mt: 1 }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleAddTerminal();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddTerminalDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleAddTerminal}
                        variant="contained"
                        disabled={!newTerminalName.trim()}
                    >
                        Add Terminal
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Rename Terminal Dialog */}
            {editingTerminal && (
                <Dialog
                    open={Boolean(editingTerminal)}
                    onClose={() => {
                        setEditingTerminal(null);
                        setEditingTerminalName('');
                    }}
                    maxWidth="sm"
                    fullWidth
                >
                    <DialogTitle>Rename Terminal</DialogTitle>
                    <DialogContent>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Terminal Name"
                            value={editingTerminalName}
                            onChange={(e) => setEditingTerminalName(e.target.value)}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleRenameTerminal(editingTerminal, editingTerminalName);
                                }
                            }}
                            sx={{ mt: 1 }}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => {
                            setEditingTerminal(null);
                            setEditingTerminalName('');
                        }}>Cancel</Button>
                        <Button
                            onClick={() => handleRenameTerminal(editingTerminal, editingTerminalName)}
                            variant="contained"
                            disabled={!editingTerminalName.trim()}
                        >
                            Rename
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* Copy to All Dialog */}
            <Dialog open={copyToAllDialog} onClose={() => setCopyToAllDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Copy Email to All Contact Types</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2, color: '#666' }}>
                        Enter an email address to copy to all contact types in this terminal. This will replace the first email in each category.
                    </Typography>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Email Address"
                        type="email"
                        value={copyToAllEmail}
                        onChange={(e) => setCopyToAllEmail(e.target.value)}
                        placeholder="e.g., dispatch@carrier.com"
                        sx={{ mt: 1 }}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleCopyToAllInTerminal();
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCopyToAllDialog(false)}>Cancel</Button>
                    <Button
                        onClick={handleCopyToAllInTerminal}
                        variant="contained"
                        disabled={!copyToAllEmail.trim()}
                    >
                        Copy to All
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EmailContactsManager; 