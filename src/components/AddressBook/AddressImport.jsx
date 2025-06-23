import React, { useState, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Grid,
    Alert,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stepper,
    Step,
    StepLabel,
    Card,
    CardContent,
    LinearProgress,
    Collapse,
    Tooltip,
    TextField,
    Checkbox,
    FormControlLabel,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TableContainer
} from '@mui/material';
import {
    CloudUpload as UploadIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Download as DownloadIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { collection, addDoc, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from 'notistack';

const AddressImport = ({ onClose, onImportComplete }) => {
    const { companyIdForAddress } = useCompany();
    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();
    const fileInputRef = useRef(null);

    // Stepper state
    const [activeStep, setActiveStep] = useState(0);
    const steps = ['Upload CSV', 'Review & Edit', 'Import Results'];

    // File upload state
    const [selectedFile, setSelectedFile] = useState(null);
    const [parsedData, setParsedData] = useState([]);
    const [parseError, setParseError] = useState(null);

    // Validation and editing state
    const [validationResults, setValidationResults] = useState([]);
    const [editingRowId, setEditingRowId] = useState(null);
    const [editingFieldId, setEditingFieldId] = useState(null);
    const [editingData, setEditingData] = useState({});
    const [originalCellValue, setOriginalCellValue] = useState('');

    // Selection state
    const [selectedRecords, setSelectedRecords] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);

    // Import state
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importResults, setImportResults] = useState(null);

    // Configuration state
    const [importOptions, setImportOptions] = useState({
        skipErrorRecords: false,
        defaultStatus: 'active',
        defaultCountry: 'CA'
    });

    // Fixed CSV template format - no mapping required
    const csvTemplate = {
        headers: [
            'company_name', 'first_name', 'last_name', 'email', 'phone',
            'street_address', 'address_line_2', 'city', 'state_province',
            'postal_code', 'country', 'open_time', 'close_time',
            'special_instructions', 'is_residential'
        ],
        sample: [
            'Rosenberg Fans Canada Ltd.,Andrew,Liu,andrewliu@rosenbergcanada.com,9055651038,6685 Tomken Road,Unit 12,MISSISSAUGA,ON,L5T2C5,CA,8:00,17:00,,false',
            'Al Tier02,Al,,alex@apollologistics.ca,416-484-9797,1881 Steeles Ave. W.,Suite 404,NORTH YORK,ON,M3H0A1,CA,9:00,18:00,,false'
        ]
    };

    // Field definitions with validation rules
    const fieldDefinitions = {
        company_name: { label: 'Company Name', required: true, type: 'text', width: 150 },
        first_name: { label: 'First Name', required: false, type: 'text', width: 100 },
        last_name: { label: 'Last Name', required: false, type: 'text', width: 100 },
        email: { label: 'Email', required: false, type: 'email', width: 180 },
        phone: { label: 'Phone', required: false, type: 'phone', width: 130 },
        street_address: { label: 'Street Address', required: true, type: 'text', width: 180 },
        address_line_2: { label: 'Address Line 2', required: false, type: 'text', width: 120 },
        city: { label: 'City', required: true, type: 'text', width: 120 },
        state_province: { label: 'State/Province', required: true, type: 'text', width: 100 },
        postal_code: { label: 'Postal Code', required: true, type: 'text', width: 100 },
        country: { label: 'Country', required: true, type: 'country', width: 80 },
        open_time: { label: 'Open Time', required: false, type: 'time', width: 90 },
        close_time: { label: 'Close Time', required: false, type: 'time', width: 90 },
        special_instructions: { label: 'Instructions', required: false, type: 'text', width: 150 },
        is_residential: { label: 'Residential', required: false, type: 'boolean', width: 100 }
    };

    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'text/csv') {
            setSelectedFile(file);
            parseCSV(file);
        } else {
            setParseError('Please select a valid CSV file.');
        }
    };

    const parseCSV = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n').filter(line => line.trim());

                if (lines.length < 2) {
                    setParseError('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Parse headers and validate against template
                const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const expectedHeaders = csvTemplate.headers;

                // Check if headers match template exactly
                const headerMismatch = headers.length !== expectedHeaders.length ||
                    !headers.every((header, index) => header === expectedHeaders[index]);

                if (headerMismatch) {
                    setParseError(
                        `CSV headers don't match the required template. Expected: ${expectedHeaders.join(', ')}`
                    );
                    return;
                }

                // Parse data rows
                const data = lines.slice(1).map((line, index) => {
                    const row = parseCSVLine(line);
                    const rowData = {
                        _id: `row_${index}`,
                        _rowIndex: index + 2, // +2 because we start from line 2 (after header)
                        _hasErrors: false,
                        _errors: {},
                        _warnings: {}
                    };

                    headers.forEach((header, i) => {
                        rowData[header] = (row[i] || '').trim();
                    });

                    return rowData;
                });

                setParsedData(data);
                setParseError(null);

                // Automatically validate data and move to next step
                validateAllData(data);

            } catch (error) {
                setParseError(`Error parsing CSV: ${error.message}`);
            }
        };
        reader.readAsText(file);
    };

    const validateRecord = (record) => {
        const errors = {};
        const warnings = {};

        // Validate required fields
        Object.entries(fieldDefinitions).forEach(([field, config]) => {
            if (config.required && (!record[field] || record[field] === '')) {
                errors[field] = `${config.label} is required`;
            }
        });

        // Validate email format
        if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
            errors.email = 'Invalid email format';
        }

        // Validate phone number (basic)
        if (record.phone && !/^[\d\s\-\+\(\)\.]+$/.test(record.phone)) {
            warnings.phone = 'Phone number format may be invalid';
        }

        // Validate country code
        if (record.country && !['US', 'CA', 'USA', 'CAN', 'United States', 'Canada'].includes(record.country)) {
            warnings.country = 'Country should be US or CA';
        }

        // Validate time format
        if (record.open_time && record.open_time !== '' && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(record.open_time)) {
            warnings.open_time = 'Should be in HH:MM format';
        }
        if (record.close_time && record.close_time !== '' && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(record.close_time)) {
            warnings.close_time = 'Should be in HH:MM format';
        }

        // Validate boolean fields
        if (record.is_residential && record.is_residential !== '' &&
            !['true', 'false', '1', '0', 'yes', 'no'].includes(record.is_residential.toLowerCase())) {
            warnings.is_residential = 'Should be true/false or yes/no';
        }

        return { errors, warnings };
    };

    const validateAllData = (data) => {
        const results = data.map(record => {
            const { errors, warnings } = validateRecord(record);
            const hasErrors = Object.keys(errors).length > 0;
            const hasWarnings = Object.keys(warnings).length > 0;

            return {
                ...record,
                _hasErrors: hasErrors,
                _errors: errors,
                _warnings: warnings,
                _status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'valid'
            };
        });

        setValidationResults(results);

        // Initialize all records as selected
        const allRecordIds = new Set(results.map(r => r._id));
        setSelectedRecords(allRecordIds);
        setSelectAll(true);

        setActiveStep(1);
    };

    const handleCellClick = (recordId, field) => {
        const record = validationResults.find(r => r._id === recordId);
        if (!record) return;

        setEditingRowId(recordId);
        setEditingFieldId(field);
        setOriginalCellValue(record[field] || '');

        // Initialize editing data with current record data
        const editData = { ...record };
        delete editData._id;
        delete editData._rowIndex;
        delete editData._hasErrors;
        delete editData._errors;
        delete editData._warnings;
        delete editData._status;
        setEditingData(editData);
    };

    const handleCellChange = (recordId, field, value) => {
        setEditingData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleCellBlur = (recordId, field) => {
        // Save the changes when user clicks away or presses Enter
        const currentRecord = validationResults.find(r => r._id === recordId);
        if (!currentRecord) return;

        const updatedRecord = { ...currentRecord, ...editingData };
        const { errors, warnings } = validateRecord(updatedRecord);
        const hasErrors = Object.keys(errors).length > 0;
        const hasWarnings = Object.keys(warnings).length > 0;

        const updatedResults = validationResults.map(record => {
            if (record._id === recordId) {
                return {
                    ...record,
                    ...editingData,
                    _hasErrors: hasErrors,
                    _errors: errors,
                    _warnings: warnings,
                    _status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'valid'
                };
            }
            return record;
        });

        setValidationResults(updatedResults);
        setEditingRowId(null);
        setEditingFieldId(null);
        setEditingData({});
        setOriginalCellValue('');

        // Show success message if error was fixed
        if (currentRecord._errors[field] && !errors[field]) {
            enqueueSnackbar('Field updated successfully', { variant: 'success' });
        }
    };

    const handleCancelCellEdit = () => {
        setEditingRowId(null);
        setEditingFieldId(null);
        setEditingData({});
        setOriginalCellValue('');
    };

    // Selection handlers
    const handleSelectRecord = (recordId) => {
        const newSelection = new Set(selectedRecords);
        if (newSelection.has(recordId)) {
            newSelection.delete(recordId);
        } else {
            newSelection.add(recordId);
        }
        setSelectedRecords(newSelection);
        setSelectAll(newSelection.size === validationResults.length);
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedRecords(new Set());
            setSelectAll(false);
        } else {
            const allRecordIds = new Set(validationResults.map(r => r._id));
            setSelectedRecords(allRecordIds);
            setSelectAll(true);
        }
    };

    // Legacy functions for backward compatibility (if needed elsewhere)
    const handleEditClick = (record) => {
        // This function is no longer used but kept for compatibility
    };

    const handleEditChange = (field, value) => {
        // This function is no longer used but kept for compatibility
    };

    const handleSaveEdit = () => {
        // This function is no longer used but kept for compatibility
    };

    const handleCancelEdit = () => {
        // This function is no longer used but kept for compatibility
    };

    const renderEditableCell = (record, field) => {
        const fieldDef = fieldDefinitions[field];
        const isEditing = editingRowId === record._id && editingFieldId === field;
        const value = isEditing ? (editingData[field] || '') : (record[field] || '');
        const hasError = record._errors[field];
        const hasWarning = record._warnings[field];
        const hasIssue = hasError || hasWarning;

        // Always render editing field if this specific cell is being edited
        if (isEditing) {
            if (fieldDef.type === 'boolean') {
                return (
                    <TableCell key={field} sx={{ minWidth: fieldDef.width }}>
                        <FormControl size="small" fullWidth>
                            <Select
                                value={value}
                                onChange={(e) => handleCellChange(record._id, field, e.target.value)}
                                onBlur={() => handleCellBlur(record._id, field)}
                                autoFocus
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="">-</MenuItem>
                                <MenuItem value="true">Yes</MenuItem>
                                <MenuItem value="false">No</MenuItem>
                            </Select>
                        </FormControl>
                    </TableCell>
                );
            }

            if (fieldDef.type === 'country') {
                return (
                    <TableCell key={field} sx={{ minWidth: fieldDef.width }}>
                        <FormControl size="small" fullWidth>
                            <Select
                                value={value}
                                onChange={(e) => handleCellChange(record._id, field, e.target.value)}
                                onBlur={() => handleCellBlur(record._id, field)}
                                autoFocus
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="CA">CA</MenuItem>
                                <MenuItem value="US">US</MenuItem>
                            </Select>
                        </FormControl>
                    </TableCell>
                );
            }

            return (
                <TableCell key={field} sx={{ minWidth: fieldDef.width }}>
                    <TextField
                        size="small"
                        value={value}
                        onChange={(e) => handleCellChange(record._id, field, e.target.value)}
                        onBlur={() => handleCellBlur(record._id, field)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleCellBlur(record._id, field);
                            }
                            if (e.key === 'Escape') {
                                handleCancelCellEdit();
                            }
                        }}
                        error={!!hasError}
                        helperText={hasError}
                        autoFocus
                        fullWidth
                        sx={{
                            '& .MuiInputBase-input': { fontSize: '12px' },
                            '& .MuiFormHelperText-root': { fontSize: '10px' }
                        }}
                    />
                </TableCell>
            );
        }

        // Render display cell
        return (
            <TableCell
                key={field}
                onClick={() => handleCellClick(record._id, field)}
                sx={{
                    fontSize: '12px',
                    color: '#374151',
                    minWidth: fieldDef.width,
                    backgroundColor: hasError ? '#ffeaa7' : hasWarning ? '#fdcb6e' : 'inherit',
                    border: hasError ? '1px solid #e17055' : hasWarning ? '1px solid #fdcb6e' : 'inherit',
                    cursor: 'pointer',
                    '&:hover': {
                        backgroundColor: hasError ? '#ffdd7a' : hasWarning ? '#f39c12' : '#f8fafc',
                        transform: 'scale(1.01)',
                        transition: 'all 0.2s ease-in-out'
                    }
                }}
            >
                <Box sx={{ position: 'relative' }}>
                    {fieldDef.type === 'boolean' ? (
                        <Chip
                            label={value ? 'Yes' : 'No'}
                            size="small"
                            color={value === 'true' || value === 'yes' || value === '1' ? 'primary' : 'default'}
                            sx={{ fontSize: '11px' }}
                        />
                    ) : (
                        value || '-'
                    )}
                    {hasIssue && (
                        <Tooltip title={`${hasError || hasWarning} (Click to edit)`} arrow>
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: -2,
                                    right: -2,
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: hasError ? '#e17055' : '#fdcb6e',
                                    animation: 'pulse 2s infinite'
                                }}
                            />
                        </Tooltip>
                    )}
                </Box>
            </TableCell>
        );
    };

    const normalizeRecord = (record) => {
        // Normalize country codes
        let country = record.country || importOptions.defaultCountry;
        if (['USA', 'United States'].includes(country)) country = 'US';
        if (['CAN', 'Canada'].includes(country)) country = 'CA';

        // Normalize boolean values
        let isResidential = false;
        if (record.is_residential) {
            const val = record.is_residential.toLowerCase();
            isResidential = ['true', '1', 'yes'].includes(val);
        }

        // Normalize times
        const openTime = record.open_time || '';
        const closeTime = record.close_time || '';

        return {
            companyName: record.company_name || '',
            firstName: record.first_name || '',
            lastName: record.last_name || '',
            email: record.email || '',
            phone: record.phone || '',
            street: record.street_address || '',
            street2: record.address_line_2 || '',
            city: record.city || '',
            state: record.state_province || '',
            postalCode: record.postal_code || '',
            country,
            specialInstructions: record.special_instructions || '',
            isResidential,
            status: importOptions.defaultStatus,
            // Business hours structure
            businessHours: {
                useCustomHours: false,
                defaultHours: {
                    open: openTime,
                    close: closeTime
                },
                customHours: {
                    monday: { open: '', close: '', closed: false },
                    tuesday: { open: '', close: '', closed: false },
                    wednesday: { open: '', close: '', closed: false },
                    thursday: { open: '', close: '', closed: false },
                    friday: { open: '', close: '', closed: false },
                    saturday: { open: '', close: '', closed: false },
                    sunday: { open: '', close: '', closed: false }
                }
            },
            // Legacy fields for backward compatibility
            openHours: openTime,
            closeHours: closeTime,
            // Additional required fields
            addressClass: 'customer',
            addressClassID: companyIdForAddress,
            addressType: 'contact',
            // Metadata
            companyID: companyIdForAddress,
            createdBy: currentUser?.uid || 'system',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
    };

    const performImport = async () => {
        setImporting(true);
        setImportProgress(0);

        try {
            // Only import selected records
            const selectedValidationResults = validationResults.filter(record =>
                selectedRecords.has(record._id)
            );

            const recordsToImport = importOptions.skipErrorRecords
                ? selectedValidationResults.filter(record => record._status !== 'error')
                : selectedValidationResults;

            const batch = writeBatch(db);
            const successRecords = [];
            const failedRecords = [];

            for (let i = 0; i < recordsToImport.length; i++) {
                try {
                    const record = recordsToImport[i];

                    // Skip records with errors if option is enabled
                    if (importOptions.skipErrorRecords && record._hasErrors) {
                        continue;
                    }

                    const normalizedRecord = normalizeRecord(record);
                    const docRef = doc(collection(db, 'addressBook'));
                    batch.set(docRef, normalizedRecord);

                    successRecords.push({
                        ...record,
                        docId: docRef.id
                    });

                    setImportProgress(Math.round(((i + 1) / recordsToImport.length) * 100));
                } catch (error) {
                    failedRecords.push({
                        ...recordsToImport[i],
                        error: error.message
                    });
                }
            }

            await batch.commit();

            const errorCount = validationResults.filter(r => r._status === 'error').length;
            const warningCount = validationResults.filter(r => r._status === 'warning').length;

            setImportResults({
                total: recordsToImport.length,
                successful: successRecords.length,
                failed: failedRecords.length,
                errors: errorCount,
                warnings: warningCount,
                successRecords,
                failedRecords
            });

            setActiveStep(2);
            enqueueSnackbar(`Successfully imported ${successRecords.length} addresses`, { variant: 'success' });

        } catch (error) {
            console.error('Import error:', error);
            enqueueSnackbar(`Import failed: ${error.message}`, { variant: 'error' });
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        const headers = csvTemplate.headers.join(',');
        const samples = csvTemplate.sample.join('\n');
        const csvContent = `${headers}\n${samples}`;

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'address_import_template.csv';
        link.click();
        window.URL.revokeObjectURL(url);
    };

    const resetImport = () => {
        setActiveStep(0);
        setSelectedFile(null);
        setParsedData([]);
        setValidationResults([]);
        setImportResults(null);
        setParseError(null);
        setEditingRowId(null);
        setEditingFieldId(null);
        setEditingData({});
        setOriginalCellValue('');
        setSelectedRecords(new Set());
        setSelectAll(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getStatusCounts = () => {
        const selectedResults = validationResults.filter(r => selectedRecords.has(r._id));
        const valid = selectedResults.filter(r => r._status === 'valid').length;
        const warnings = selectedResults.filter(r => r._status === 'warning').length;
        const errors = selectedResults.filter(r => r._status === 'error').length;
        return {
            valid,
            warnings,
            errors,
            total: selectedResults.length,
            totalRecords: validationResults.length,
            selectedCount: selectedRecords.size
        };
    };

    const statusCounts = getStatusCounts();

    return (
        <>
            <style>
                {`
                    @keyframes pulse {
                        0% {
                            opacity: 1;
                        }
                        50% {
                            opacity: 0.5;
                        }
                        100% {
                            opacity: 1;
                        }
                    }
                `}
            </style>
            <Dialog open={true} onClose={onClose} maxWidth="xl" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Import Addresses from CSV
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={downloadTemplate}
                            size="small"
                            sx={{ fontSize: '12px' }}
                        >
                            Download Template
                        </Button>
                    </Box>
                </DialogTitle>

                <DialogContent>
                    <Box sx={{ mb: 3 }}>
                        <Stepper activeStep={activeStep} alternativeLabel>
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: '12px', color: '#374151' } }}>
                                        {label}
                                    </StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Box>

                    {/* Step 1: File Upload */}
                    {activeStep === 0 && (
                        <Box>
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                        Upload CSV File
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px', color: '#6b7280' }}>
                                        Select a CSV file using the exact template format. The system will automatically validate your data.
                                    </Typography>

                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileSelect}
                                        style={{ display: 'none' }}
                                        ref={fileInputRef}
                                    />

                                    <Button
                                        variant="contained"
                                        startIcon={<UploadIcon />}
                                        onClick={() => fileInputRef.current?.click()}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Select CSV File
                                    </Button>

                                    {selectedFile && (
                                        <Alert severity="success" sx={{ mt: 2 }}>
                                            File selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                                        </Alert>
                                    )}

                                    {parseError && (
                                        <Alert severity="error" sx={{ mt: 2 }}>
                                            {parseError}
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                        Required CSV Format
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px', color: '#6b7280' }}>
                                        Your CSV must use exactly this header format (copy and paste recommended):
                                    </Typography>

                                    <Box sx={{ fontFamily: 'monospace', fontSize: '12px', bgcolor: '#f5f5f5', p: 2, borderRadius: 1, mb: 2 }}>
                                        {csvTemplate.headers.join(',')}
                                    </Box>

                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        Required fields: company_name, street_address, city, state_province, postal_code, country
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {/* Step 2: Review & Edit */}
                    {activeStep === 1 && (
                        <Box>
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                        Review & Edit Data
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px', color: '#6b7280' }}>
                                        Review your data below. Click on any field to edit it directly. Records with errors are highlighted in yellow/orange. Select which addresses to import using the checkboxes.
                                    </Typography>

                                    <Grid container spacing={2} sx={{ mb: 3 }}>
                                        <Grid item xs={3}>
                                            <Card sx={{ bgcolor: '#e8f5e8' }}>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <CheckIcon color="success" sx={{ fontSize: 40 }} />
                                                    <Typography variant="h4" sx={{ fontSize: '24px' }}>{statusCounts.valid}</Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>Valid</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Card sx={{ bgcolor: '#fff3cd' }}>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <WarningIcon color="warning" sx={{ fontSize: 40 }} />
                                                    <Typography variant="h4" sx={{ fontSize: '24px' }}>{statusCounts.warnings}</Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>Warnings</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Card sx={{ bgcolor: '#f8d7da' }}>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                                                    <Typography variant="h4" sx={{ fontSize: '24px' }}>{statusCounts.errors}</Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>Errors</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Card sx={{ bgcolor: '#f0f0f0' }}>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h4" sx={{ fontSize: '24px' }}>{statusCounts.total}</Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>Total</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    </Grid>

                                    <Box sx={{ mb: 3 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>
                                                Selected: {statusCounts.selectedCount} of {statusCounts.totalRecords} records
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                <Button
                                                    size="small"
                                                    onClick={handleSelectAll}
                                                    variant={selectAll ? "outlined" : "contained"}
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    {selectAll ? 'Deselect All' : 'Select All'}
                                                </Button>
                                            </Box>
                                        </Box>

                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={importOptions.skipErrorRecords}
                                                    onChange={(e) => setImportOptions(prev => ({
                                                        ...prev,
                                                        skipErrorRecords: e.target.checked
                                                    }))}
                                                    size="small"
                                                />
                                            }
                                            label={
                                                <Typography sx={{ fontSize: '12px', color: '#374151' }}>
                                                    Skip records with validation errors during import
                                                </Typography>
                                            }
                                        />
                                    </Box>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                        Address Data
                                    </Typography>

                                    <TableContainer sx={{ maxHeight: 600, border: '1px solid #e0e0e0' }}>
                                        <Table stickyHeader size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell
                                                        sx={{
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            minWidth: 60,
                                                            backgroundColor: '#f8fafc',
                                                            color: '#374151'
                                                        }}
                                                    >
                                                        <Checkbox
                                                            checked={selectAll}
                                                            onChange={handleSelectAll}
                                                            indeterminate={selectedRecords.size > 0 && selectedRecords.size < validationResults.length}
                                                            size="small"
                                                            sx={{ padding: 0 }}
                                                        />
                                                    </TableCell>
                                                    {csvTemplate.headers.map(header => (
                                                        <TableCell
                                                            key={header}
                                                            sx={{
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                minWidth: fieldDefinitions[header]?.width || 100,
                                                                backgroundColor: '#f8fafc',
                                                                color: '#374151'
                                                            }}
                                                        >
                                                            {fieldDefinitions[header]?.label || header}
                                                            {fieldDefinitions[header]?.required && (
                                                                <span style={{ color: 'red' }}> *</span>
                                                            )}
                                                        </TableCell>
                                                    ))}
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {validationResults.map((record) => (
                                                    <TableRow
                                                        key={record._id}
                                                        sx={{
                                                            backgroundColor: record._status === 'error' ? '#fff5f5' :
                                                                record._status === 'warning' ? '#fffbeb' :
                                                                    'inherit',
                                                            '&:hover': { backgroundColor: '#f9fafb' }
                                                        }}
                                                    >
                                                        <TableCell sx={{ fontSize: '12px', color: '#374151' }}>
                                                            <Checkbox
                                                                checked={selectedRecords.has(record._id)}
                                                                onChange={() => handleSelectRecord(record._id)}
                                                                size="small"
                                                                sx={{ padding: 0 }}
                                                            />
                                                        </TableCell>
                                                        {csvTemplate.headers.map(header =>
                                                            renderEditableCell(record, header)
                                                        )}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {/* Step 3: Import Results */}
                    {activeStep === 2 && importResults && (
                        <Box>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                        Import Complete
                                    </Typography>

                                    <Grid container spacing={2} sx={{ mb: 3 }}>
                                        <Grid item xs={3}>
                                            <Card sx={{ bgcolor: '#e8f5e8' }}>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <CheckIcon color="success" sx={{ fontSize: 40 }} />
                                                    <Typography variant="h4" sx={{ fontSize: '24px' }}>{importResults.successful}</Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>Imported</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Card sx={{ bgcolor: '#f8d7da' }}>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                                                    <Typography variant="h4" sx={{ fontSize: '24px' }}>{importResults.failed}</Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>Failed</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Card sx={{ bgcolor: '#f8d7da' }}>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h4" sx={{ fontSize: '24px' }}>{importResults.errors}</Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>Skipped (Errors)</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                        <Grid item xs={3}>
                                            <Card sx={{ bgcolor: '#f0f0f0' }}>
                                                <CardContent sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h4" sx={{ fontSize: '24px' }}>{importResults.total}</Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>Total Processed</Typography>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    </Grid>

                                    <Alert severity="success">
                                        Successfully imported {importResults.successful} out of {importResults.total} addresses.
                                    </Alert>
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {/* Import Progress */}
                    {importing && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="body2" gutterBottom sx={{ fontSize: '12px', color: '#374151' }}>
                                Importing addresses... {importProgress}%
                            </Typography>
                            <LinearProgress variant="determinate" value={importProgress} />
                        </Box>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={onClose} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>

                    {activeStep === 1 && (
                        <Button
                            onClick={performImport}
                            variant="contained"
                            disabled={importing || selectedRecords.size === 0 || (importOptions.skipErrorRecords && statusCounts.valid === 0)}
                            startIcon={importing ? <CircularProgress size={20} /> : <UploadIcon />}
                            sx={{ fontSize: '12px' }}
                        >
                            {importing ? 'Importing...' : `Import ${importOptions.skipErrorRecords ? statusCounts.valid + statusCounts.warnings : statusCounts.total} Records`}
                        </Button>
                    )}

                    {activeStep === 2 && (
                        <>
                            <Button onClick={resetImport} variant="outlined" sx={{ fontSize: '12px' }}>
                                Import More
                            </Button>
                            <Button
                                onClick={() => {
                                    onImportComplete?.();
                                    onClose();
                                }}
                                variant="contained"
                                sx={{ fontSize: '12px' }}
                            >
                                Done
                            </Button>
                        </>
                    )}
                </DialogActions>
            </Dialog>
        </>
    );
};

export default AddressImport; 