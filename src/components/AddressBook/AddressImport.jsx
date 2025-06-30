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
import { collection, addDoc, writeBatch, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
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
    const steps = ['Upload CSV', 'Map Fields', 'Review & Edit', 'Import Results'];

    // File upload state
    const [selectedFile, setSelectedFile] = useState(null);
    const [rawParsedData, setRawParsedData] = useState([]);
    const [rawHeaders, setRawHeaders] = useState([]);
    const [parsedData, setParsedData] = useState([]);
    const [parseError, setParseError] = useState(null);

    // Field mapping state
    const [fieldMappings, setFieldMappings] = useState({});
    const [mappingComplete, setMappingComplete] = useState(false);
    const [autoMappingApplied, setAutoMappingApplied] = useState(false);

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

    // Updated CSV template format for customer-address organizational structure
    const csvTemplate = {
        headers: [
            'company_id', 'customer_id', 'customer_name', 'address_nickname',
            'company_name', 'first_name', 'last_name', 'email', 'phone', 'phone_ext',
            'street_address', 'address_line_2', 'city', 'state_province',
            'postal_code', 'country', 'open_time', 'close_time',
            'special_instructions', 'is_residential', 'address_type'
        ],
        sample: [
            'APL,XRISI,X Rider Simulators,Main Office,X Rider Simulators,John,Smith,john@xrider.com,416-555-0123,123,123 Main Street,Suite 100,TORONTO,ON,M5V3A8,CA,9:00,17:00,Please use rear entrance,false,destination',
            'APL,DWSLOG,DWS Logistics,Warehouse,DWS Logistics Inc,Sarah,Johnson,sarah@dwslogistics.com,905-555-0456,,456 Industrial Ave,,MISSISSAUGA,ON,L5T2C5,CA,8:00,18:00,Loading dock #3,false,destination'
        ]
    };

    // Field definitions with validation rules for customer-address structure
    const fieldDefinitions = {
        company_id: { label: 'Company ID', required: true, type: 'text', width: 100 },
        customer_id: { label: 'Customer ID', required: true, type: 'text', width: 100 },
        customer_name: { label: 'Customer Name', required: true, type: 'text', width: 150 },
        address_nickname: { label: 'Address Nickname', required: false, type: 'text', width: 120 },
        company_name: { label: 'Company Name', required: true, type: 'text', width: 150 },
        first_name: { label: 'First Name', required: false, type: 'text', width: 100 },
        last_name: { label: 'Last Name', required: false, type: 'text', width: 100 },
        email: { label: 'Email', required: false, type: 'email', width: 180 },
        phone: { label: 'Phone', required: false, type: 'phone', width: 130 },
        phone_ext: { label: 'Phone Extension', required: false, type: 'text', width: 100 },
        street_address: { label: 'Street Address', required: true, type: 'text', width: 180 },
        address_line_2: { label: 'Address Line 2', required: false, type: 'text', width: 120 },
        city: { label: 'City', required: true, type: 'text', width: 120 },
        state_province: { label: 'State/Province', required: true, type: 'text', width: 100 },
        postal_code: { label: 'Postal Code', required: true, type: 'text', width: 100 },
        country: { label: 'Country', required: true, type: 'country', width: 80 },
        open_time: { label: 'Open Time', required: false, type: 'time', width: 90 },
        close_time: { label: 'Close Time', required: false, type: 'time', width: 90 },
        special_instructions: { label: 'Instructions', required: false, type: 'text', width: 150 },
        is_residential: { label: 'Residential', required: false, type: 'boolean', width: 100 },
        address_type: { label: 'Address Type', required: false, type: 'address_type', width: 120 }
    };

    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        let escapeNext = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (escapeNext) {
                current += char;
                escapeNext = false;
            } else if (char === '\\' && inQuotes) {
                escapeNext = true;
            } else if (char === '"') {
                // Handle escaped quotes
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // Skip the next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim().replace(/^"(.*)"$/, '$1')); // Remove surrounding quotes
        return result;
    };

    // Auto-detect field mappings based on common column names
    const autoDetectFieldMappings = (headers) => {
        const mappings = {};
        const lowerHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

        // Define mapping patterns for auto-detection
        const detectionPatterns = {
            company_id: ['companyid', 'company_id', 'compid', 'comp_id'],
            customer_id: ['customerid', 'customer_id', 'custid', 'cust_id', 'clientid', 'client_id'],
            customer_name: ['customername', 'customer_name', 'custname', 'cust_name', 'clientname', 'client_name', 'businessname', 'business_name'],
            address_nickname: ['addressnickname', 'address_nickname', 'nickname', 'addressname', 'address_name', 'locationname', 'location_name'],
            company_name: ['companyname', 'company_name', 'company', 'businessname', 'business_name', 'organization', 'org'],
            first_name: ['firstname', 'first_name', 'fname', 'givenname', 'given_name'],
            last_name: ['lastname', 'last_name', 'lname', 'surname', 'familyname', 'family_name'],
            email: ['email', 'emailaddress', 'email_address', 'mail'],
            phone: ['phone', 'phonenumber', 'phone_number', 'telephone', 'tel', 'mobile', 'cellphone', 'cell_phone'],
            phone_ext: ['phoneext', 'phone_ext', 'extension', 'ext', 'phone_extension', 'phoneextension'],
            street_address: ['streetaddress', 'street_address', 'address', 'address1', 'street', 'addressline1', 'address_line_1'],
            address_line_2: ['addressline2', 'address_line_2', 'address2', 'suite', 'apartment', 'apt', 'unit'],
            city: ['city', 'town', 'municipality'],
            state_province: ['state', 'province', 'stateprovince', 'state_province', 'region'],
            postal_code: ['postalcode', 'postal_code', 'zipcode', 'zip_code', 'zip', 'postcode'],
            country: ['country', 'countrycode', 'country_code', 'nation'],
            open_time: ['opentime', 'open_time', 'openhours', 'open_hours', 'starttime', 'start_time'],
            close_time: ['closetime', 'close_time', 'closehours', 'close_hours', 'endtime', 'end_time'],
            special_instructions: ['specialinstructions', 'special_instructions', 'instructions', 'notes', 'comments', 'remarks'],
            is_residential: ['isresidential', 'is_residential', 'residential', 'residentialaddress', 'residential_address'],
            address_type: ['addresstype', 'address_type', 'type', 'category', 'kind']
        };

        // Try to match each header to our required fields
        headers.forEach((header, index) => {
            const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

            // Find matching field
            for (const [requiredField, patterns] of Object.entries(detectionPatterns)) {
                if (patterns.includes(cleanHeader)) {
                    mappings[requiredField] = header;
                    break;
                }
            }
        });

        console.log('[AddressImport] Auto-detected mappings:', mappings);
        return mappings;
    };

    // Apply field mappings to convert raw data to our expected format
    const applyFieldMappings = (rawData, mappings) => {
        return rawData.map(row => {
            const mappedRow = {
                _id: row._id,
                _rowIndex: row._rowIndex,
                _hasErrors: false,
                _errors: {},
                _warnings: {}
            };

            // Apply mappings with smart defaults for address imports
            Object.entries(fieldDefinitions).forEach(([requiredField, config]) => {
                const sourceField = mappings[requiredField];
                if (sourceField && row[sourceField] !== undefined) {
                    mappedRow[requiredField] = row[sourceField];
                } else {
                    // Set smart defaults for address imports
                    if (requiredField === 'address_type') {
                        mappedRow[requiredField] = 'destination'; // Default all imports to destination
                    } else {
                        mappedRow[requiredField] = ''; // Default empty value
                    }
                }
            });

            return mappedRow;
        });
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];

        // Reset previous state
        setParseError(null);
        setRawParsedData([]);
        setValidationResults([]);
        setSelectedRecords(new Set());
        setFieldMappings({});
        setActiveStep(0);

        if (!file) {
            setParseError('No file selected.');
            return;
        }

        // Check file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setParseError('File size too large. Please select a CSV file smaller than 10MB.');
            return;
        }

        // Check file type
        const validTypes = ['text/csv', 'application/csv', 'text/plain'];
        const validExtensions = ['.csv', '.txt'];
        const fileName = file.name.toLowerCase();
        const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));

        if (!validTypes.includes(file.type) && !hasValidExtension) {
            setParseError('Please select a valid CSV file (.csv extension).');
            return;
        }

        console.log(`[AddressImport] Processing file: ${file.name} (${Math.round(file.size / 1024)}KB)`);
        setSelectedFile(file);
        parseCSV(file);
    };

    const parseCSV = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                if (!text || text.trim() === '') {
                    setParseError('CSV file is empty or could not be read.');
                    return;
                }

                // Advanced CSV parsing that handles multi-line fields and quoted content
                const parseCSVContent = (csvText) => {
                    const rows = [];
                    let currentRow = [];
                    let currentField = '';
                    let inQuotes = false;
                    let i = 0;

                    while (i < csvText.length) {
                        const char = csvText[i];
                        const nextChar = csvText[i + 1];

                        if (char === '"') {
                            if (inQuotes && nextChar === '"') {
                                // Escaped quote
                                currentField += '"';
                                i += 2;
                                continue;
                            } else {
                                // Toggle quote state
                                inQuotes = !inQuotes;
                            }
                        } else if (char === ',' && !inQuotes) {
                            // Field separator
                            currentRow.push(currentField.trim());
                            currentField = '';
                        } else if ((char === '\n' || char === '\r') && !inQuotes) {
                            // Row separator (only when not in quotes)
                            if (currentField || currentRow.length > 0) {
                                currentRow.push(currentField.trim());
                                if (currentRow.some(field => field.length > 0)) {
                                    rows.push(currentRow);
                                }
                                currentRow = [];
                                currentField = '';
                            }
                            // Skip \r\n combinations
                            if (char === '\r' && nextChar === '\n') {
                                i++;
                            }
                        } else if (char !== '\r') {
                            // Regular character (skip standalone \r)
                            currentField += char;
                        }
                        i++;
                    }

                    // Add final field and row if needed
                    if (currentField || currentRow.length > 0) {
                        currentRow.push(currentField.trim());
                        if (currentRow.some(field => field.length > 0)) {
                            rows.push(currentRow);
                        }
                    }

                    return rows;
                };

                const allRows = parseCSVContent(text);

                if (allRows.length < 2) {
                    setParseError('CSV file must contain at least a header row and one data row.');
                    return;
                }

                // Parse headers
                const headers = allRows[0];
                if (headers.length === 0) {
                    setParseError('Invalid CSV header row - no columns found.');
                    return;
                }

                console.log(`[AddressImport] Found ${headers.length} columns: ${headers.join(', ')}`);
                setRawHeaders(headers);

                // Parse data rows
                const data = [];
                const parseErrors = [];
                const dataRows = allRows.slice(1);

                dataRows.forEach((row, index) => {
                    try {
                        // Skip completely empty rows
                        if (row.every(field => !field || field.trim() === '')) {
                            return;
                        }

                        const rowData = {
                            _id: `row_${index}`,
                            _rowIndex: index + 2, // +2 because we start from line 2 (after header)
                            _hasErrors: false,
                            _errors: {},
                            _warnings: {}
                        };

                        // Map each column to the corresponding header
                        headers.forEach((header, j) => {
                            rowData[header] = (row[j] || '').trim();
                        });

                        // Only add rows that have some meaningful data
                        const hasData = Object.values(rowData).some(value =>
                            value && typeof value === 'string' && value.trim() !== '' &&
                            !value.startsWith('_') // Exclude our internal fields
                        );

                        if (hasData) {
                            data.push(rowData);
                        }
                    } catch (rowError) {
                        parseErrors.push(`Row ${index + 2}: ${rowError.message}`);
                        console.warn(`Error parsing CSV row ${index + 2}:`, rowError);
                    }
                });

                if (data.length === 0) {
                    setParseError(`No valid data rows found. ${parseErrors.length > 0 ? 'Errors: ' + parseErrors.join('; ') : ''}`);
                    return;
                }

                // Filter out duplicate rows (based on key fields)
                const uniqueData = [];
                const seenRows = new Set();

                data.forEach(row => {
                    // Create a key based on company_id, customer_id, and street address
                    const key = `${row.CompanyID || row.company_id || ''}_${row.customer_id || row.Customer_ID || ''}_${row.address1 || row.street_address || ''}`.toLowerCase();

                    if (!seenRows.has(key) && key !== '__') {
                        seenRows.add(key);
                        uniqueData.push(row);
                    }
                });

                if (parseErrors.length > 0 && parseErrors.length > uniqueData.length * 0.5) {
                    setParseError(`Too many parsing errors (${parseErrors.length} errors for ${uniqueData.length} valid rows). Please check your CSV format.`);
                    return;
                }

                setRawParsedData(uniqueData);
                setParseError(null);

                console.log(`[AddressImport] Successfully parsed ${uniqueData.length} unique rows from ${allRows.length - 1} total rows with ${parseErrors.length} errors`);

                // Check if headers match our template exactly (auto-detect)
                const expectedHeaders = csvTemplate.headers;
                const exactMatch = headers.length === expectedHeaders.length &&
                    headers.every((header, index) => header === expectedHeaders[index]);

                if (exactMatch) {
                    // Perfect match - skip mapping step
                    console.log('[AddressImport] Exact template match detected, skipping field mapping');
                    const autoMappings = {};
                    headers.forEach(header => {
                        autoMappings[header] = header;
                    });
                    setFieldMappings(autoMappings);
                    setMappingComplete(true);
                    setAutoMappingApplied(true);

                    // Apply mappings and proceed to validation
                    const mappedData = applyFieldMappings(uniqueData, autoMappings);
                    setParsedData(mappedData);
                    validateAllData(mappedData);
                } else {
                    // Need field mapping
                    console.log('[AddressImport] Custom CSV detected, proceeding to field mapping');
                    setActiveStep(1); // Go to mapping step

                    // Try to auto-detect common field mappings
                    const autoMappings = autoDetectFieldMappings(headers);
                    setFieldMappings(autoMappings);
                    setAutoMappingApplied(Object.keys(autoMappings).length > 0);
                }

            } catch (error) {
                setParseError(`Error parsing CSV: ${error.message}`);
            }
        };
        reader.readAsText(file);
    };

    const validateRecord = async (record, existingCustomers = new Set()) => {
        const errors = {};
        const warnings = {};

        // Validate required fields
        Object.entries(fieldDefinitions).forEach(([field, config]) => {
            if (config.required && (!record[field] || record[field] === '')) {
                errors[field] = `${config.label} is required`;
            }
        });

        // Validate customer exists (if we have the customer data)
        if (record.customer_id && existingCustomers.size > 0) {
            const customerKey = `${record.company_id}_${record.customer_id}`;
            if (!existingCustomers.has(customerKey)) {
                warnings.customer_id = 'Customer may not exist in the system';
            }
        }

        // Validate email format
        if (record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
            errors.email = 'Invalid email format';
        }

        // Validate phone number (basic)
        if (record.phone && !/^[\d\s\-\+\(\)\.]+$/.test(record.phone)) {
            warnings.phone = 'Phone number format may be invalid';
        }

        // Validate phone extension (basic)
        if (record.phone_ext && !/^[\d]+$/.test(record.phone_ext)) {
            warnings.phone_ext = 'Phone extension should contain only numbers';
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

        // Validate address type
        if (record.address_type && !['contact', 'destination', 'billing'].includes(record.address_type.toLowerCase())) {
            warnings.address_type = 'Should be contact, destination, or billing';
        }

        // Auto-set address_type to destination if empty (for imports)
        if (!record.address_type || record.address_type === '') {
            record.address_type = 'destination';
        }

        // Validate customer ID format (basic alphanumeric check)
        if (record.customer_id && !/^[A-Z0-9]+$/.test(record.customer_id)) {
            warnings.customer_id = 'Customer ID should be uppercase alphanumeric';
        }

        // Validate company ID format
        if (record.company_id && !/^[A-Z0-9]+$/.test(record.company_id)) {
            warnings.company_id = 'Company ID should be uppercase alphanumeric';
        }

        return { errors, warnings };
    };

    // Field mapping handlers
    const handleFieldMapping = (requiredField, sourceField) => {
        setFieldMappings(prev => ({
            ...prev,
            [requiredField]: sourceField
        }));
    };

    const handleClearMapping = (requiredField) => {
        setFieldMappings(prev => {
            const newMappings = { ...prev };
            delete newMappings[requiredField];
            return newMappings;
        });
    };

    const handleApplyMappings = async () => {
        // Check if all required fields are mapped
        const requiredFields = Object.entries(fieldDefinitions)
            .filter(([field, config]) => config.required)
            .map(([field]) => field);

        const missingMappings = requiredFields.filter(field => !fieldMappings[field]);

        if (missingMappings.length > 0) {
            setParseError(`Please map all required fields: ${missingMappings.join(', ')}`);
            return;
        }

        // Apply mappings to raw data
        const mappedData = applyFieldMappings(rawParsedData, fieldMappings);
        setParsedData(mappedData);
        setMappingComplete(true);

        // Proceed to validation
        await validateAllData(mappedData);
    };

    const handleResetMappings = () => {
        setFieldMappings({});
        setAutoMappingApplied(false);
        setParseError(null);
    };

    const validateAllData = async (data) => {
        if (!data || data.length === 0) {
            setParseError('No data to validate.');
            return;
        }

        try {
            console.log(`[AddressImport] Starting validation for ${data.length} records`);

            // Fetch existing customers for validation with timeout
            const existingCustomers = new Set();
            try {
                const customersSnapshot = await Promise.race([
                    getDocs(collection(db, 'customers')),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Customer data fetch timeout')), 10000)
                    )
                ]);

                customersSnapshot.forEach(doc => {
                    const customerData = doc.data();
                    if (customerData.companyID && customerData.customerID) {
                        existingCustomers.add(`${customerData.companyID}_${customerData.customerID}`);
                    }
                });
                console.log('[AddressImport] Loaded existing customers for validation:', existingCustomers.size);
            } catch (customerError) {
                console.warn('[AddressImport] Could not load customers for validation:', customerError);
                // Continue without customer validation
            }

            // Validate records in batches to prevent overwhelming the system
            const batchSize = 50;
            const results = [];

            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (record, index) => {
                        try {
                            const { errors, warnings } = await validateRecord(record, existingCustomers);
                            const hasErrors = Object.keys(errors).length > 0;
                            const hasWarnings = Object.keys(warnings).length > 0;

                            return {
                                ...record,
                                _hasErrors: hasErrors,
                                _errors: errors,
                                _warnings: warnings,
                                _status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'valid'
                            };
                        } catch (validationError) {
                            console.error(`[AddressImport] Error validating record ${i + index + 1}:`, validationError);
                            return {
                                ...record,
                                _hasErrors: true,
                                _errors: { general: `Validation error: ${validationError.message}` },
                                _warnings: {},
                                _status: 'error'
                            };
                        }
                    })
                );
                results.push(...batchResults);
                console.log(`[AddressImport] Validated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)}`);
            }

            if (results.length === 0) {
                setParseError('No records could be validated.');
                return;
            }

            setValidationResults(results);

            // Initialize all records as selected
            const allRecordIds = new Set(results.map(r => r._id));
            setSelectedRecords(allRecordIds);
            setSelectAll(true);

            console.log(`[AddressImport] Validation complete: ${results.length} records processed`);
            setActiveStep(2); // Always go to review step after validation
        } catch (error) {
            console.error('[AddressImport] Error during validation:', error);
            setParseError(`Validation error: ${error.message}. Please try again or contact support.`);
        }
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

    const handleCellBlur = async (recordId, field) => {
        // Save the changes when user clicks away or presses Enter
        const currentRecord = validationResults.find(r => r._id === recordId);
        if (!currentRecord) return;

        const updatedRecord = { ...currentRecord, ...editingData };
        const { errors, warnings } = await validateRecord(updatedRecord);
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

            if (fieldDef.type === 'address_type') {
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
                                <MenuItem value="contact">Contact</MenuItem>
                                <MenuItem value="destination">Destination</MenuItem>
                                <MenuItem value="billing">Billing</MenuItem>
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
        if (!record) {
            throw new Error('Record is null or undefined');
        }

        // Validate required fields exist
        if (!record.company_id || !record.customer_id || !record.street_address) {
            throw new Error('Missing required fields: company_id, customer_id, or street_address');
        }

        // Normalize country codes
        let country = record.country || importOptions.defaultCountry;
        if (['USA', 'United States', 'UNITED STATES'].includes(country.toUpperCase())) country = 'US';
        if (['CAN', 'Canada', 'CANADA'].includes(country.toUpperCase())) country = 'CA';

        // Validate country
        if (!['US', 'CA'].includes(country)) {
            console.warn(`[AddressImport] Invalid country code '${country}' for record ${record._rowIndex}, defaulting to CA`);
            country = 'CA';
        }

        // Normalize boolean values
        let isResidential = false;
        if (record.is_residential) {
            const val = record.is_residential.toString().toLowerCase().trim();
            isResidential = ['true', '1', 'yes', 'y'].includes(val);
        }

        // Normalize address type - default all imports to destination for immediate ship-from/ship-to availability
        let addressType = (record.address_type || 'destination').toString().toLowerCase().trim();
        if (!['contact', 'destination', 'billing'].includes(addressType)) {
            console.warn(`[AddressImport] Invalid address type '${addressType}' for record ${record._rowIndex}, defaulting to destination`);
            addressType = 'destination';
        }

        // Ensure all imported addresses default to destination for shipping availability
        if (!record.address_type || record.address_type === '') {
            addressType = 'destination';
        }

        // Normalize and validate times
        const normalizeTime = (time) => {
            if (!time) return '';
            const timeStr = time.toString().trim();
            // Basic time validation - accept HH:MM format
            if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeStr)) {
                return ''; // Return empty string for invalid times
            }
            return timeStr;
        };

        const openTime = normalizeTime(record.open_time);
        const closeTime = normalizeTime(record.close_time);

        return {
            // Address nickname for better identification
            nickname: record.address_nickname || '',

            // Contact information
            companyName: record.company_name || '',
            firstName: record.first_name || '',
            lastName: record.last_name || '',
            email: record.email || '',
            phone: record.phone || '',
            phoneExt: record.phone_ext || '',

            // Address information
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

            // Customer-Address organizational structure
            addressClass: 'customer',
            addressClassID: record.customer_id || '',
            addressType: addressType,

            // Company and customer relationship
            companyID: record.company_id || '',
            customerID: record.customer_id || '',
            customerName: record.customer_name || '',

            // Company owner information for proper display
            ownerCompanyName: record.customer_name || '',
            ownerCompanyID: record.company_id || '',
            ownerCompanyLogo: '', // Will be populated if available

            // Metadata
            createdBy: currentUser?.uid || 'system',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
    };

    const performImport = async () => {
        if (!validationResults || validationResults.length === 0) {
            enqueueSnackbar('No data to import', { variant: 'error' });
            return;
        }

        if (selectedRecords.size === 0) {
            enqueueSnackbar('Please select at least one record to import', { variant: 'error' });
            return;
        }

        setImporting(true);
        setImportProgress(0);

        try {
            console.log(`[AddressImport] Starting import process for ${selectedRecords.size} selected records`);

            // Only import selected records
            const selectedValidationResults = validationResults.filter(record =>
                selectedRecords.has(record._id)
            );

            const recordsToImport = importOptions.skipErrorRecords
                ? selectedValidationResults.filter(record => record._status !== 'error')
                : selectedValidationResults;

            if (recordsToImport.length === 0) {
                enqueueSnackbar('No valid records to import after filtering', { variant: 'warning' });
                setImporting(false);
                return;
            }

            console.log(`[AddressImport] Importing ${recordsToImport.length} records (skip errors: ${importOptions.skipErrorRecords})`);

            const successRecords = [];
            const failedRecords = [];
            const batchSize = 25; // Smaller batches for better reliability

            // Process records in batches
            for (let batchStart = 0; batchStart < recordsToImport.length; batchStart += batchSize) {
                const batchEnd = Math.min(batchStart + batchSize, recordsToImport.length);
                const batchRecords = recordsToImport.slice(batchStart, batchEnd);

                try {
                    const batch = writeBatch(db);
                    const batchSuccessRecords = [];

                    for (let i = 0; i < batchRecords.length; i++) {
                        try {
                            const record = batchRecords[i];

                            // Skip records with errors if option is enabled
                            if (importOptions.skipErrorRecords && record._hasErrors) {
                                console.log(`[AddressImport] Skipping record ${record._rowIndex} due to errors`);
                                continue;
                            }

                            // Validate record before normalization
                            if (!record.company_id || !record.customer_id || !record.street_address) {
                                throw new Error('Missing required fields: company_id, customer_id, or street_address');
                            }

                            const normalizedRecord = normalizeRecord(record);

                            // Additional validation on normalized record
                            if (!normalizedRecord.companyID || !normalizedRecord.customerID || !normalizedRecord.street) {
                                throw new Error('Record normalization failed - missing critical data');
                            }

                            const docRef = doc(collection(db, 'addressBook'));
                            batch.set(docRef, normalizedRecord);

                            batchSuccessRecords.push({
                                ...record,
                                docId: docRef.id,
                                normalizedRecord
                            });

                        } catch (recordError) {
                            console.error(`[AddressImport] Error processing record ${batchRecords[i]._rowIndex}:`, recordError);
                            failedRecords.push({
                                ...batchRecords[i],
                                error: recordError.message
                            });
                        }
                    }

                    // Commit batch if there are records to commit
                    if (batchSuccessRecords.length > 0) {
                        await batch.commit();
                        successRecords.push(...batchSuccessRecords);
                        console.log(`[AddressImport] Successfully committed batch ${Math.floor(batchStart / batchSize) + 1} with ${batchSuccessRecords.length} records`);
                    }

                } catch (batchError) {
                    console.error(`[AddressImport] Error committing batch ${Math.floor(batchStart / batchSize) + 1}:`, batchError);
                    // Mark all records in this batch as failed
                    batchRecords.forEach(record => {
                        failedRecords.push({
                            ...record,
                            error: `Batch commit failed: ${batchError.message}`
                        });
                    });
                }

                // Update progress
                const progress = Math.round((batchEnd / recordsToImport.length) * 100);
                setImportProgress(progress);
            }

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

            console.log(`[AddressImport] Import complete: ${successRecords.length} successful, ${failedRecords.length} failed`);

            setActiveStep(3); // Go to results step after import

            if (successRecords.length > 0) {
                enqueueSnackbar(`Successfully imported ${successRecords.length} addresses`, { variant: 'success' });
            }

            if (failedRecords.length > 0) {
                enqueueSnackbar(`${failedRecords.length} records failed to import`, { variant: 'warning' });
            }

        } catch (error) {
            console.error('[AddressImport] Critical import error:', error);
            enqueueSnackbar(`Import failed: ${error.message}. Please try again.`, { variant: 'error' });

            // Reset to review step so user can try again
            setActiveStep(2);
        } finally {
            setImporting(false);
            setImportProgress(0);
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
        setRawParsedData([]);
        setRawHeaders([]);
        setParsedData([]);
        setValidationResults([]);
        setImportResults(null);
        setParseError(null);
        setFieldMappings({});
        setMappingComplete(false);
        setAutoMappingApplied(false);
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
                                        Select any CSV file with address data. Our smart mapping system will help you match your columns to our required fields.
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
                                        Optional: Use Our Template Format
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px', color: '#6b7280' }}>
                                        If you prefer to use our exact template format, your CSV can use this header format to skip the mapping step:
                                    </Typography>

                                    <Box sx={{ fontFamily: 'monospace', fontSize: '11px', bgcolor: '#f5f5f5', p: 2, borderRadius: 1, mb: 2, overflowX: 'auto' }}>
                                        {csvTemplate.headers.join(',')}
                                    </Box>

                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                        <strong>Required fields:</strong> company_id, customer_id, customer_name, company_name, street_address, city, state_province, postal_code, country<br />
                                        <strong>Optional fields:</strong> address_type (defaults to "destination"), phone, email, address_nickname, etc.
                                    </Typography>

                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        <strong>Customer-Address Structure:</strong><br />
                                        • <strong>company_id:</strong> Company identifier (e.g., APL)<br />
                                        • <strong>customer_id:</strong> Unique customer identifier (e.g., XRISI)<br />
                                        • <strong>customer_name:</strong> Customer business name<br />
                                        • <strong>address_type:</strong> contact, destination, or billing (defaults to "destination")<br />
                                        • <strong>address_nickname:</strong> Optional friendly name for the address<br />
                                        <br />
                                        <strong>📍 Import Note:</strong> All imported addresses default to "destination" type and are immediately available for ship-from and ship-to selection in shipment creation.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {/* Step 2: Field Mapping */}
                    {activeStep === 1 && (
                        <Box>
                            <Card sx={{ mb: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                        Map Your CSV Fields
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px', color: '#6b7280' }}>
                                        Map your CSV columns to our required fields. {autoMappingApplied && 'We\'ve automatically detected some mappings for you.'}
                                    </Typography>

                                    {autoMappingApplied && (
                                        <Alert severity="info" sx={{ mb: 3 }}>
                                            Auto-mapping applied! We detected {Object.keys(fieldMappings).length} field mappings.
                                            Please review and adjust as needed.
                                        </Alert>
                                    )}

                                    <Alert severity="success" sx={{ mb: 3 }}>
                                        📍 <strong>Address Import:</strong> All imported addresses will be set as "destination" type by default, making them immediately available for ship-from and ship-to selection in shipment creation.
                                    </Alert>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                                Your CSV Columns ({rawHeaders.length})
                                            </Typography>
                                            <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto', border: '1px solid #e5e7eb' }}>
                                                {rawHeaders.map((header, index) => (
                                                    <Chip
                                                        key={index}
                                                        label={header}
                                                        variant="outlined"
                                                        size="small"
                                                        sx={{
                                                            m: 0.5,
                                                            fontSize: '11px',
                                                            backgroundColor: Object.values(fieldMappings).includes(header) ? '#e8f5e8' : 'inherit'
                                                        }}
                                                    />
                                                ))}
                                            </Paper>
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                                Required Fields Mapping
                                            </Typography>
                                            <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                                                {Object.entries(fieldDefinitions).map(([requiredField, config]) => (
                                                    <Box key={requiredField} sx={{ mb: 2 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                            <Typography sx={{
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                color: '#374151',
                                                                minWidth: 150
                                                            }}>
                                                                {config.label}
                                                                {config.required && <span style={{ color: 'red' }}> *</span>}
                                                            </Typography>
                                                        </Box>
                                                        <FormControl size="small" fullWidth>
                                                            <Select
                                                                value={fieldMappings[requiredField] || ''}
                                                                onChange={(e) => handleFieldMapping(requiredField, e.target.value)}
                                                                displayEmpty
                                                                sx={{ fontSize: '12px' }}
                                                            >
                                                                <MenuItem value="">
                                                                    <em style={{ color: '#9ca3af' }}>Select column...</em>
                                                                </MenuItem>
                                                                {rawHeaders.map((header, index) => (
                                                                    <MenuItem key={index} value={header} sx={{ fontSize: '12px' }}>
                                                                        {header}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        {fieldMappings[requiredField] && (
                                                            <Button
                                                                size="small"
                                                                onClick={() => handleClearMapping(requiredField)}
                                                                sx={{ mt: 0.5, fontSize: '10px' }}
                                                            >
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Grid>
                                    </Grid>

                                    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                                        <Button
                                            variant="outlined"
                                            onClick={handleResetMappings}
                                            size="small"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Reset Mappings
                                        </Button>
                                        <Button
                                            variant="contained"
                                            onClick={handleApplyMappings}
                                            size="small"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Apply Mappings & Continue
                                        </Button>
                                    </Box>

                                    {parseError && (
                                        <Alert severity="error" sx={{ mt: 2 }}>
                                            {parseError}
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Preview mapped data */}
                            {Object.keys(fieldMappings).length > 0 && (
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                            Mapping Preview (First 3 Rows)
                                        </Typography>
                                        <TableContainer sx={{ border: '1px solid #e0e0e0' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        {Object.entries(fieldDefinitions).map(([field, config]) => (
                                                            <TableCell key={field} sx={{
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                backgroundColor: '#f8fafc',
                                                                color: fieldMappings[field] ? '#374151' : '#9ca3af'
                                                            }}>
                                                                {config.label}
                                                                {config.required && <span style={{ color: 'red' }}> *</span>}
                                                            </TableCell>
                                                        ))}
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {rawParsedData.slice(0, 3).map((row, index) => (
                                                        <TableRow key={index}>
                                                            {Object.keys(fieldDefinitions).map(field => {
                                                                const sourceField = fieldMappings[field];
                                                                const value = sourceField ? row[sourceField] : '';
                                                                return (
                                                                    <TableCell key={field} sx={{
                                                                        fontSize: '11px',
                                                                        color: value ? '#374151' : '#9ca3af',
                                                                        backgroundColor: !value && fieldDefinitions[field].required ? '#fef2f2' : 'inherit'
                                                                    }}>
                                                                        {value || '-'}
                                                                    </TableCell>
                                                                );
                                                            })}
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </CardContent>
                                </Card>
                            )}
                        </Box>
                    )}

                    {/* Step 3: Review & Edit */}
                    {activeStep === 2 && (
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

                    {/* Step 4: Import Results */}
                    {activeStep === 3 && importResults && (
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
                    <Button
                        onClick={onClose}
                        sx={{ fontSize: '12px' }}
                        disabled={importing}
                    >
                        Cancel
                    </Button>

                    {activeStep === 1 && (
                        <Button
                            onClick={() => setActiveStep(0)}
                            variant="outlined"
                            sx={{ fontSize: '12px' }}
                        >
                            Back
                        </Button>
                    )}

                    {activeStep === 2 && (
                        <>
                            <Button
                                onClick={() => setActiveStep(1)}
                                variant="outlined"
                                sx={{ fontSize: '12px' }}
                                disabled={importing}
                            >
                                Back to Mapping
                            </Button>
                            <Button
                                onClick={performImport}
                                variant="contained"
                                disabled={importing || selectedRecords.size === 0 || (importOptions.skipErrorRecords && statusCounts.valid === 0)}
                                startIcon={importing ? <CircularProgress size={20} /> : <UploadIcon />}
                                sx={{ fontSize: '12px' }}
                            >
                                {importing ? `Importing... ${importProgress}%` : `Import ${importOptions.skipErrorRecords ? statusCounts.valid + statusCounts.warnings : statusCounts.total} Records`}
                            </Button>
                        </>
                    )}

                    {activeStep === 3 && (
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