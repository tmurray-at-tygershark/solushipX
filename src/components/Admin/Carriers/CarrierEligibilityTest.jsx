import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Alert,
    Divider,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Card,
    CardContent
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BugReportIcon from '@mui/icons-material/BugReport';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { getEligibleCarriers, getAllCarriers } from '../../../utils/carrierEligibility';

const CarrierEligibilityTest = () => {
    const [testData, setTestData] = useState({
        shipmentType: 'courier',
        originCountry: 'US',
        destinationCountry: 'CA',
        weight: 100,
        length: 12,
        width: 12,
        height: 12
    });

    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [allCarriers, setAllCarriers] = useState([]);

    useEffect(() => {
        loadAllCarriers();
    }, []);

    const loadAllCarriers = async () => {
        try {
            const carriers = await getAllCarriers();
            setAllCarriers(carriers);
        } catch (error) {
            console.error('Failed to load carriers:', error);
        }
    };

    const runEligibilityTest = async () => {
        setLoading(true);
        setResults(null);

        // Capture console logs
        const originalLog = console.log;
        const logs = [];
        console.log = (...args) => {
            logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' '));
            originalLog(...args);
        };

        try {
            const shipmentData = {
                shipFrom: {
                    country: testData.originCountry,
                    state: testData.originCountry === 'CA' ? 'BC' : 'WA',
                    city: testData.originCountry === 'CA' ? 'Vancouver' : 'Seattle'
                },
                shipTo: {
                    country: testData.destinationCountry,
                    state: testData.destinationCountry === 'CA' ? 'ON' : 'NY',
                    city: testData.destinationCountry === 'CA' ? 'Toronto' : 'New York'
                },
                packages: [{
                    weight: testData.weight,
                    length: testData.length,
                    width: testData.width,
                    height: testData.height
                }],
                shipmentInfo: {
                    shipmentType: testData.shipmentType,
                    serviceLevel: 'any'
                }
            };

            const eligibleCarriers = await getEligibleCarriers(shipmentData);

            setResults({
                eligibleCarriers,
                logs: logs.slice() // Copy logs
            });
        } catch (error) {
            setResults({
                error: error.message,
                logs: logs.slice()
            });
        } finally {
            console.log = originalLog; // Restore original console.log
            setLoading(false);
        }
    };

    const getCarrierDetails = (carrierKey) => {
        return allCarriers.find(c => c.key === carrierKey);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                <BugReportIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Carrier Eligibility Debugging Tool
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                This tool helps debug carrier eligibility issues by showing detailed logs and carrier configurations.
            </Alert>

            <Grid container spacing={3}>
                {/* Test Configuration */}
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>Test Configuration</Typography>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Shipment Type</InputLabel>
                            <Select
                                value={testData.shipmentType}
                                label="Shipment Type"
                                onChange={(e) => setTestData({ ...testData, shipmentType: e.target.value })}
                            >
                                <MenuItem value="courier">Courier</MenuItem>
                                <MenuItem value="freight">Freight</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Origin Country</InputLabel>
                            <Select
                                value={testData.originCountry}
                                label="Origin Country"
                                onChange={(e) => setTestData({ ...testData, originCountry: e.target.value })}
                            >
                                <MenuItem value="CA">Canada</MenuItem>
                                <MenuItem value="US">United States</MenuItem>
                                <MenuItem value="MX">Mexico</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Destination Country</InputLabel>
                            <Select
                                value={testData.destinationCountry}
                                label="Destination Country"
                                onChange={(e) => setTestData({ ...testData, destinationCountry: e.target.value })}
                            >
                                <MenuItem value="CA">Canada</MenuItem>
                                <MenuItem value="US">United States</MenuItem>
                                <MenuItem value="MX">Mexico</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            label="Weight (lbs)"
                            type="number"
                            value={testData.weight}
                            onChange={(e) => setTestData({ ...testData, weight: parseFloat(e.target.value) || 0 })}
                            sx={{ mb: 2 }}
                        />

                        <Grid container spacing={1}>
                            <Grid item xs={4}>
                                <TextField
                                    fullWidth
                                    label="Length"
                                    type="number"
                                    value={testData.length}
                                    onChange={(e) => setTestData({ ...testData, length: parseFloat(e.target.value) || 0 })}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <TextField
                                    fullWidth
                                    label="Width"
                                    type="number"
                                    value={testData.width}
                                    onChange={(e) => setTestData({ ...testData, width: parseFloat(e.target.value) || 0 })}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <TextField
                                    fullWidth
                                    label="Height"
                                    type="number"
                                    value={testData.height}
                                    onChange={(e) => setTestData({ ...testData, height: parseFloat(e.target.value) || 0 })}
                                />
                            </Grid>
                        </Grid>

                        <Button
                            fullWidth
                            variant="contained"
                            onClick={runEligibilityTest}
                            disabled={loading}
                            startIcon={<PlayArrowIcon />}
                            sx={{ mt: 2 }}
                        >
                            {loading ? 'Testing...' : 'Run Eligibility Test'}
                        </Button>
                    </Paper>
                </Grid>

                {/* Results */}
                <Grid item xs={12} md={8}>
                    {results && (
                        <Paper sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Test Results</Typography>

                            {results.error ? (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    <strong>Error:</strong> {results.error}
                                </Alert>
                            ) : (
                                <Alert
                                    severity={results.eligibleCarriers?.length > 0 ? "success" : "warning"}
                                    sx={{ mb: 2 }}
                                >
                                    <strong>Found {results.eligibleCarriers?.length || 0} eligible carriers</strong>
                                    {results.eligibleCarriers?.length > 0 && (
                                        <Box sx={{ mt: 1 }}>
                                            {results.eligibleCarriers.map(carrier => (
                                                <Chip
                                                    key={carrier.key}
                                                    label={`${carrier.name} (${carrier.isCustomCarrier ? 'DB' : 'Static'})`}
                                                    color="success"
                                                    size="small"
                                                    sx={{ mr: 1, mb: 1 }}
                                                />
                                            ))}
                                        </Box>
                                    )}
                                </Alert>
                            )}

                            {/* Detailed Logs */}
                            <Accordion defaultExpanded>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="subtitle1">Detailed Eligibility Logs</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Box
                                        sx={{
                                            bgcolor: '#f5f5f5',
                                            p: 2,
                                            borderRadius: 1,
                                            maxHeight: 400,
                                            overflow: 'auto',
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {results.logs?.join('\n') || 'No logs available'}
                                    </Box>
                                </AccordionDetails>
                            </Accordion>
                        </Paper>
                    )}
                </Grid>

                {/* All Carriers Summary */}
                <Grid item xs={12}>
                    <Paper sx={{ p: 2 }}>
                        <Typography variant="h6" gutterBottom>All Carriers Summary</Typography>

                        <Grid container spacing={2}>
                            {allCarriers.map(carrier => (
                                <Grid item xs={12} md={6} lg={4} key={carrier.key}>
                                    <Card variant="outlined">
                                        <CardContent>
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', flex: 1 }}>
                                                    {carrier.name}
                                                </Typography>
                                                <Chip
                                                    label={carrier.isCustomCarrier ? 'Database' : 'Static'}
                                                    size="small"
                                                    color={carrier.isCustomCarrier ? 'primary' : 'default'}
                                                />
                                            </Box>

                                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                                Key: {carrier.key} | Priority: {carrier.priority}
                                            </Typography>

                                            {carrier.isCustomCarrier && (
                                                <>
                                                    <Divider sx={{ my: 1 }} />
                                                    <Typography variant="caption" display="block">
                                                        <strong>Type:</strong> {getCarrierDetails(carrier.key)?.type || 'Unknown'}
                                                    </Typography>
                                                    <Typography variant="caption" display="block">
                                                        <strong>Courier Services:</strong> {getCarrierDetails(carrier.key)?.supportedServices?.courier?.length || 0}
                                                    </Typography>
                                                    <Typography variant="caption" display="block">
                                                        <strong>Freight Services:</strong> {getCarrierDetails(carrier.key)?.supportedServices?.freight?.length || 0}
                                                    </Typography>
                                                    <Typography variant="caption" display="block">
                                                        <strong>Geographic Routing:</strong> {getCarrierDetails(carrier.key)?.eligibilityRules?.geographicRouting?.countryToCountry ? '✅' : '❌'} Country-to-Country
                                                    </Typography>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))}
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default CarrierEligibilityTest; 