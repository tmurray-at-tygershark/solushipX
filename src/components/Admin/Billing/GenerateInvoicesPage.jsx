import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography,
    CircularProgress,
    Alert,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    Card,
    CardContent,
    Divider,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Switch,
    FormControlLabel,
    Tooltip,
    Badge,
    Stack,
    Autocomplete
} from '@mui/material';
import {
    CheckCircleOutline as CheckCircleIcon,
    NavigateNext,
    NavigateBefore,
    Download as DownloadIcon,
    Email as EmailIcon,
    Receipt as ReceiptIcon,
    AccountBalance as AccountBalanceIcon,
    Send as SendIcon,
    Preview as PreviewIcon,
    Business as BusinessIcon,
    LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import { formatCurrencyWithPrefix, formatInvoiceCurrency, CURRENCIES, calculateTax } from '../../../utils/currencyUtils';

const steps = [
    'Review Uninvoiced Shipments',
    'Configure Invoice Settings',
    'Generate & Send Invoices',
    'Process Complete'
];

const TAX_RATES = {
    CAD: 0.13, // 13% HST for Canada
    USD: 0.00  // No tax for US invoices by default
};

const PAYMENT_TERMS_OPTIONS = [
    { value: 'Due on Receipt', label: 'Due on Receipt', days: 0 },
    { value: 'Net 15', label: 'Net 15 Days', days: 15 },
    { value: 'Net 30', label: 'Net 30 Days', days: 30 },
    { value: 'Net 45', label: 'Net 45 Days', days: 45 },
    { value: 'Net 60', label: 'Net 60 Days', days: 60 }
];

const GenerateInvoicesPage = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [activeStep, setActiveStep] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedShipments, setSelectedShipments] = useState({});
    const [uninvoicedShipments, setUninvoicedShipments] = useState([]);
    const [groupedShipments, setGroupedShipments] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [invoiceSettings, setInvoiceSettings] = useState({
        includeShipmentDetails: true,
        includeChargeBreakdown: true,
        emailToCustomers: true,
        paymentTerms: 'Net 30',
        invoicePrefix: 'INV',
        groupByCompany: true,
        currency: 'USD',
        taxRate: 0.00,
        enableTax: false,
        testEmail: '',
        enableTestMode: false
    });
    const [generationResults, setGenerationResults] = useState({
        successful: 0,
        failed: 0,
        totalInvoices: 0,
        invoiceNumbers: []
    });
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [testEmailSent, setTestEmailSent] = useState(false);
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        fetchUninvoicedShipments();
    }, []);

    const fetchUninvoicedShipments = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all shipments and filter locally (since we need to check multiple conditions)
            const shipmentsRef = collection(db, 'shipments');
            const shipmentsQuery = query(
                shipmentsRef,
                where('status', '!=', 'draft'),
                orderBy('status'),
                orderBy('createdAt', 'desc')
            );
            const shipmentsSnapshot = await getDocs(shipmentsQuery);

            const shipments = shipmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter for uninvoiced shipments using the same logic as BillingDashboard
            const uninvoicedShipments = shipments.filter(shipment => {
                // Use same uninvoiced logic as BillingDashboard
                const isUninvoiced = !shipment.invoiceStatus || shipment.invoiceStatus === 'uninvoiced';
                return isUninvoiced;
            });

            // Filter out shipments without charges, invalid data, or draft status
            const validShipments = uninvoicedShipments.filter(shipment => {
                const charges = getShipmentCharges(shipment);
                const isDraft = shipment.status?.toLowerCase() === 'draft';
                return charges > 0 && shipment.companyID && !isDraft;
            });

            // Group shipments by company
            const grouped = validShipments.reduce((acc, shipment) => {
                const companyId = shipment.companyID;
                if (!acc[companyId]) {
                    acc[companyId] = {
                        company: shipment.companyName || companyId,
                        shipments: [],
                        totalCharges: 0
                    };
                }
                const charges = getShipmentCharges(shipment);
                acc[companyId].shipments.push(shipment);
                acc[companyId].totalCharges += charges;
                return acc;
            }, {});

            setUninvoicedShipments(validShipments);
            setGroupedShipments(grouped);

            // Auto-detect currency from shipments and update invoice settings
            const detectedCurrency = detectShipmentsCurrency(validShipments);
            setInvoiceSettings(prev => ({
                ...prev,
                currency: detectedCurrency,
                taxRate: TAX_RATES[detectedCurrency] || 0,
                enableTax: detectedCurrency === 'CAD'
            }));

            // Pre-select all shipments by default
            const initialSelection = {};
            validShipments.forEach(shipment => {
                initialSelection[shipment.id] = true;
            });
            setSelectedShipments(initialSelection);

        } catch (err) {
            console.error('Error fetching uninvoiced shipments:', err);
            setError('Failed to load uninvoiced shipments: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getShipmentCharges = (shipment) => {
        // Use markup rates (what customer pays)
        if (shipment.markupRates?.totalCharges) {
            return shipment.markupRates.totalCharges;
        }

        return shipment.totalCharges ||
            shipment.selectedRate?.totalCharges ||
            shipment.selectedRate?.pricing?.total ||
            0;
    };

    // Helper function to get the currency from a shipment
    const getShipmentCurrency = (shipment) => {
        // Priority order for currency detection
        if (shipment.markupRates?.currency) {
            return shipment.markupRates.currency;
        }
        if (shipment.currency) {
            return shipment.currency;
        }
        if (shipment.selectedRate?.pricing?.currency) {
            return shipment.selectedRate.pricing.currency;
        }
        if (shipment.selectedRate?.currency) {
            return shipment.selectedRate.currency;
        }
        // Default fallback
        return 'CAD';
    };

    // Helper function to detect the predominant currency from all shipments
    const detectShipmentsCurrency = (shipments) => {
        if (!shipments || shipments.length === 0) return 'USD';

        const currencyCount = {};
        shipments.forEach(shipment => {
            const currency = getShipmentCurrency(shipment);
            currencyCount[currency] = (currencyCount[currency] || 0) + 1;
        });

        // Return the most common currency
        return Object.keys(currencyCount).reduce((a, b) =>
            currencyCount[a] > currencyCount[b] ? a : b
        );
    };

    // Helper function to get the correct date for different shipment types
    const getShipmentDate = (shipment) => {
        if (shipment.creationMethod === 'quickship') {
            // For QuickShip: bookedAt (primary) > bookingTimestamp > createdAt (fallback)
            if (shipment.bookedAt) {
                return shipment.bookedAt?.toDate ?
                    shipment.bookedAt.toDate() :
                    new Date(shipment.bookedAt);
            } else if (shipment.bookingTimestamp) {
                return new Date(shipment.bookingTimestamp);
            } else if (shipment.createdAt) {
                return shipment.createdAt?.toDate ?
                    shipment.createdAt.toDate() :
                    new Date(shipment.createdAt);
            }
        } else {
            // For regular shipments: createdAt (primary) > bookingTimestamp (fallback)
            if (shipment.createdAt) {
                return shipment.createdAt?.toDate ?
                    shipment.createdAt.toDate() :
                    new Date(shipment.createdAt);
            } else if (shipment.bookingTimestamp) {
                return new Date(shipment.bookingTimestamp);
            }
        }
        return null;
    };

    const getSelectedShipmentsByCompany = () => {
        const selected = uninvoicedShipments.filter(shipment => selectedShipments[shipment.id]);
        return selected.reduce((acc, shipment) => {
            const companyId = shipment.companyID;
            if (!acc[companyId]) {
                acc[companyId] = {
                    company: shipment.companyName || companyId,
                    companyId: companyId,
                    shipments: [],
                    totalCharges: 0
                };
            }
            const charges = getShipmentCharges(shipment);
            acc[companyId].shipments.push(shipment);
            acc[companyId].totalCharges += charges;
            return acc;
        }, {});
    };

    const generateInvoices = async () => {
        try {
            setIsProcessing(true);
            const selectedByCompany = getSelectedShipmentsByCompany();
            const companies = Object.keys(selectedByCompany);

            let successful = 0;
            let failed = 0;
            const invoiceNumbers = [];

            // Generate invoice for each company
            for (const companyId of companies) {
                try {
                    const companyData = selectedByCompany[companyId];
                    const invoiceNumber = await generateInvoiceForCompany(companyData);
                    invoiceNumbers.push(invoiceNumber);
                    successful++;

                    // Mark shipments as invoiced
                    const updatePromises = companyData.shipments.map(shipment =>
                        updateDoc(doc(db, 'shipments', shipment.id), {
                            invoiceStatus: 'invoiced',
                            invoiceNumber: invoiceNumber,
                            invoicedAt: serverTimestamp()
                        })
                    );
                    await Promise.all(updatePromises);

                } catch (error) {
                    console.error(`Failed to generate invoice for company ${companyId}:`, error);
                    failed++;
                }
            }

            setGenerationResults({
                successful,
                failed,
                totalInvoices: companies.length,
                invoiceNumbers
            });

            enqueueSnackbar(`Successfully generated ${successful} invoices`, { variant: 'success' });

        } catch (error) {
            console.error('Error generating invoices:', error);
            enqueueSnackbar('Failed to generate invoices: ' + error.message, { variant: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const generateInvoiceForCompany = async (companyData) => {
        // Create invoice record in database
        const invoiceNumber = `${invoiceSettings.invoicePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Calculate invoice totals with proper tax handling
        const subtotal = companyData.totalCharges;
        const taxCalc = calculateTax(
            subtotal,
            invoiceSettings.enableTax ? invoiceSettings.taxRate : 0,
            invoiceSettings.currency
        );

        // Prepare line items from shipments
        const lineItems = companyData.shipments.map(shipment => {
            // Get shipment date with fallback for regular invoices
            const shipmentDate = getShipmentDate(shipment);
            const validDate = shipmentDate || new Date(); // Use current date as fallback

            return {
                shipmentId: shipment.shipmentID || shipment.id,
                orderNumber: shipment.orderNumber || shipment.shipmentInfo?.orderNumber || 'N/A',
                trackingNumber: shipment.trackingNumber || shipment.shipmentInfo?.carrierTrackingNumber || 'TBD',
                description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
                carrier: shipment.carrier,
                service: shipment.selectedRate?.service?.name || shipment.service || 'Standard',
                date: validDate, // Use the validated date
                charges: getShipmentCharges(shipment),
                chargeBreakdown: getChargeBreakdown(shipment),
                packages: shipment.packages?.length || shipment.packageCount || 1,
                weight: shipment.totalWeight || shipment.weight || 0,
                consignee: shipment.shipTo?.companyName || shipment.shipTo?.company || 'N/A'
            };
        });

        const invoiceData = {
            invoiceNumber,
            companyId: companyData.companyId,
            companyName: companyData.company,
            issueDate: new Date(),
            dueDate: calculateDueDate(invoiceSettings.paymentTerms),
            status: 'pending',
            lineItems,
            subtotal: taxCalc.subtotal,
            tax: taxCalc.tax,
            total: taxCalc.total,
            currency: invoiceSettings.currency,
            paymentTerms: invoiceSettings.paymentTerms,
            taxRate: invoiceSettings.enableTax ? invoiceSettings.taxRate : 0,
            settings: invoiceSettings,
            createdAt: serverTimestamp(),
            shipmentIds: companyData.shipments.map(s => s.id)
        };

        // Save invoice to database
        await addDoc(collection(db, 'invoices'), invoiceData);

        // Generate PDF and send email if enabled
        if (invoiceSettings.emailToCustomers) {
            try {
                await triggerInvoiceGeneration(
                    invoiceData,
                    companyData.companyId,
                    false,
                    null
                );
            } catch (emailError) {
                console.error('Failed to send invoice email:', emailError);
                // Don't fail the whole process if email fails
            }
        }

        return invoiceNumber;
    };

    const getChargeBreakdown = (shipment) => {
        const breakdown = [];

        // Enhanced charge breakdown extraction
        if (shipment.markupRates) {
            const rates = shipment.markupRates;

            // Extract freight charges
            if (rates.freightCharges > 0) {
                breakdown.push({
                    description: 'Freight Charges',
                    amount: rates.freightCharges
                });
            }

            // Extract fuel surcharge
            if (rates.fuelCharges > 0) {
                breakdown.push({
                    description: 'Fuel Surcharge',
                    amount: rates.fuelCharges
                });
            }

            // Extract service charges
            if (rates.serviceCharges > 0) {
                breakdown.push({
                    description: 'Service Charges',
                    amount: rates.serviceCharges
                });
            }

            // Extract accessorial charges
            if (rates.accessorialCharges > 0) {
                breakdown.push({
                    description: 'Accessorial Charges',
                    amount: rates.accessorialCharges
                });
            }

            // Extract other common charges
            if (rates.hazmatFee > 0) {
                breakdown.push({
                    description: 'Hazmat Fee',
                    amount: rates.hazmatFee
                });
            }

            if (rates.residentialDelivery > 0) {
                breakdown.push({
                    description: 'Residential Delivery',
                    amount: rates.residentialDelivery
                });
            }

            if (rates.signatureRequired > 0) {
                breakdown.push({
                    description: 'Signature Required',
                    amount: rates.signatureRequired
                });
            }

            if (rates.insurance > 0) {
                breakdown.push({
                    description: 'Insurance',
                    amount: rates.insurance
                });
            }
        }

        // Check for charges in selectedRate structure
        else if (shipment.selectedRate) {
            const rate = shipment.selectedRate;

            // Extract from rate breakdown if available
            if (rate.breakdown && Array.isArray(rate.breakdown)) {
                rate.breakdown.forEach(charge => {
                    if (charge.amount > 0) {
                        breakdown.push({
                            description: charge.name || charge.description || 'Charge',
                            amount: charge.amount
                        });
                    }
                });
            }

            // Extract from rate charges if available
            else if (rate.charges && Array.isArray(rate.charges)) {
                rate.charges.forEach(charge => {
                    if (charge.amount > 0) {
                        breakdown.push({
                            description: charge.name || charge.description || 'Charge',
                            amount: charge.amount
                        });
                    }
                });
            }

            // Extract from direct rate properties
            else {
                const baseRate = rate.baseRate || rate.freightRate || 0;
                const fuelSurcharge = rate.fuelSurcharge || rate.fuel || 0;
                const taxes = rate.taxes || rate.tax || 0;

                if (baseRate > 0) {
                    breakdown.push({
                        description: 'Base Freight',
                        amount: baseRate
                    });
                }

                if (fuelSurcharge > 0) {
                    breakdown.push({
                        description: 'Fuel Surcharge',
                        amount: fuelSurcharge
                    });
                }

                if (taxes > 0) {
                    breakdown.push({
                        description: 'Taxes',
                        amount: taxes
                    });
                }
            }
        }

        // If no detailed breakdown available, create estimated breakdown from total charges
        if (breakdown.length === 0) {
            const totalCharges = getShipmentCharges(shipment);

            if (totalCharges > 0) {
                // Create reasonable estimates based on industry standards
                const freightEstimate = totalCharges * 0.75; // 75% freight
                const fuelEstimate = totalCharges * 0.20;    // 20% fuel surcharge
                const taxEstimate = totalCharges * 0.05;     // 5% taxes/fees

                breakdown.push({
                    description: 'Freight Charges',
                    amount: freightEstimate
                });

                breakdown.push({
                    description: 'Fuel Surcharge',
                    amount: fuelEstimate
                });

                if (taxEstimate > 0) {
                    breakdown.push({
                        description: 'Taxes & Fees',
                        amount: taxEstimate
                    });
                }
            }
        }

        return breakdown;
    };

    const calculateDueDate = (paymentTerms) => {
        const termOption = PAYMENT_TERMS_OPTIONS.find(opt => opt.value === paymentTerms);
        const days = termOption ? termOption.days : 30;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);
        return dueDate;
    };

    // Helper function to trigger invoice generation via Firestore (no CORS issues)
    const triggerInvoiceGeneration = async (invoiceData, companyId, testMode = false, testEmail = null) => {
        return new Promise((resolve, reject) => {
            // Create a request document in Firestore
            addDoc(collection(db, 'invoiceRequests'), {
                invoiceData,
                companyId,
                testMode,
                testEmail,
                status: 'pending',
                createdAt: serverTimestamp()
            }).then((docRef) => {
                // Listen for status updates on the document
                const unsubscribe = onSnapshot(doc(db, 'invoiceRequests', docRef.id), (doc) => {
                    const data = doc.data();
                    if (data?.status === 'completed') {
                        unsubscribe();
                        resolve(data.result);
                    } else if (data?.status === 'failed') {
                        unsubscribe();
                        reject(new Error(data.error || 'Invoice generation failed'));
                    }
                });

                // Timeout after 60 seconds
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Invoice generation timed out'));
                }, 60000);
            }).catch(reject);
        });
    };

    const sendTestInvoice = async () => {
        if (!invoiceSettings.testEmail) {
            enqueueSnackbar('Please enter a test email address', { variant: 'warning' });
            return;
        }

        try {
            setIsSendingTest(true);

            // Create comprehensive test data with 20 random shipments
            const testShipments = [
                // Shipment 1 - Purolator
                {
                    id: 'TS-001', shipmentID: 'TS-2025-001', carrier: 'Purolator', service: 'Ground',
                    shipFrom: { city: 'Toronto', state: 'ON', street: '100 King St W', postalCode: 'M5X 1A1', country: 'CA' },
                    shipTo: { city: 'Vancouver', state: 'BC', street: '555 Granville St', postalCode: 'V6C 1X6', country: 'CA' },
                    packages: 2, weight: 45.5, charges: 89.50, references: 'PO-2025-001, INV-445566'
                },

                // Shipment 2 - FedEx
                {
                    id: 'TS-002', shipmentID: 'TS-2025-002', carrier: 'FedEx', service: 'Express',
                    shipFrom: { city: 'Montreal', state: 'QC', street: '1250 René-Lévesque Blvd', postalCode: 'H3B 4W8', country: 'CA' },
                    shipTo: { city: 'Calgary', state: 'AB', street: '888 - 3 St SW', postalCode: 'T2P 5C5', country: 'CA' },
                    packages: 1, weight: 12.3, charges: 67.25, references: 'REF-789012, ORDER-334455'
                },

                // Shipment 3 - UPS
                {
                    id: 'TS-003', shipmentID: 'TS-2025-003', carrier: 'UPS', service: 'Ground',
                    shipFrom: { city: 'Ottawa', state: 'ON', street: '90 Sparks St', postalCode: 'K1P 5B4', country: 'CA' },
                    shipTo: { city: 'Winnipeg', state: 'MB', street: '201 Portage Ave', postalCode: 'R3B 3K6', country: 'CA' },
                    packages: 3, weight: 78.9, charges: 125.75, references: 'WO-556677, TICKET-998877'
                },

                // Shipment 4 - Canpar Express
                {
                    id: 'TS-004', shipmentID: 'TS-2025-004', carrier: 'Canpar Express', service: 'Overnight',
                    shipFrom: { city: 'Halifax', state: 'NS', street: '1801 Hollis St', postalCode: 'B3J 3N4', country: 'CA' },
                    shipTo: { city: 'Toronto', state: 'ON', street: '481 University Ave', postalCode: 'M5G 2E9', country: 'CA' },
                    packages: 1, weight: 5.8, charges: 45.30, references: 'RUSH-001, PRIORITY-223344'
                },

                // Shipment 5 - Canada Post
                {
                    id: 'TS-005', shipmentID: 'TS-2025-005', carrier: 'Canada Post', service: 'Xpresspost',
                    shipFrom: { city: 'Edmonton', state: 'AB', street: '10665 Jasper Ave', postalCode: 'T5J 3S9', country: 'CA' },
                    shipTo: { city: 'Saskatoon', state: 'SK', street: '244 - 2nd Ave S', postalCode: 'S7K 1K9', country: 'CA' },
                    packages: 4, weight: 156.2, charges: 198.40, references: 'BULK-2025, MULTI-667788'
                },

                // Shipment 6 - DHL
                {
                    id: 'TS-006', shipmentID: 'TS-2025-006', carrier: 'DHL', service: 'Express',
                    shipFrom: { city: 'Quebec City', state: 'QC', street: '1150 Claire-Fontaine', postalCode: 'G1R 5G4', country: 'CA' },
                    shipTo: { city: 'Moncton', state: 'NB', street: '655 Main St', postalCode: 'E1C 1E8', country: 'CA' },
                    packages: 2, weight: 34.7, charges: 112.85, references: 'INTL-445566, EXPORT-112233'
                },

                // Shipment 7 - Purolator Express
                {
                    id: 'TS-007', shipmentID: 'TS-2025-007', carrier: 'Purolator', service: 'Express',
                    shipFrom: { city: 'London', state: 'ON', street: '200 Queens Ave', postalCode: 'N6A 1J3', country: 'CA' },
                    shipTo: { city: 'Windsor', state: 'ON', street: '350 City Hall Square W', postalCode: 'N9A 6S1', country: 'CA' },
                    packages: 1, weight: 23.4, charges: 56.90, references: 'LOCAL-778899, SAME-DAY-445566'
                },

                // Shipment 8 - FedEx Ground
                {
                    id: 'TS-008', shipmentID: 'TS-2025-008', carrier: 'FedEx', service: 'Ground',
                    shipFrom: { city: 'Victoria', state: 'BC', street: '1175 Douglas St', postalCode: 'V8W 2E1', country: 'CA' },
                    shipTo: { city: 'Kelowna', state: 'BC', street: '1435 Water St', postalCode: 'V1Y 1J4', country: 'CA' },
                    packages: 5, weight: 234.6, charges: 287.30, references: 'HEAVY-001, FREIGHT-889900'
                },

                // Shipment 9 - UPS Express Saver
                {
                    id: 'TS-009', shipmentID: 'TS-2025-009', carrier: 'UPS', service: 'Express Saver',
                    shipFrom: { city: 'Charlottetown', state: 'PE', street: '165 Richmond St', postalCode: 'C1A 1J1', country: 'CA' },
                    shipTo: { city: 'Sydney', state: 'NS', street: '320 Esplanade', postalCode: 'B1P 1A7', country: 'CA' },
                    packages: 2, weight: 67.8, charges: 143.20, references: 'MARITIME-223344, ISLAND-556677'
                },

                // Shipment 10 - Canpar Ground
                {
                    id: 'TS-010', shipmentID: 'TS-2025-010', carrier: 'Canpar Express', service: 'Ground',
                    shipFrom: { city: 'Thunder Bay', state: 'ON', street: '290 Red River Rd', postalCode: 'P7B 1A5', country: 'CA' },
                    shipTo: { city: 'Sudbury', state: 'ON', street: '200 Brady St', postalCode: 'P3E 5L3', country: 'CA' },
                    packages: 3, weight: 89.1, charges: 167.45, references: 'NORTHERN-667788, MINING-334455'
                },

                // Shipment 11 - Canada Post Regular
                {
                    id: 'TS-011', shipmentID: 'TS-2025-011', carrier: 'Canada Post', service: 'Regular Parcel',
                    shipFrom: { city: 'Regina', state: 'SK', street: '2045 Broad St', postalCode: 'S4P 1Y3', country: 'CA' },
                    shipTo: { city: 'Brandon', state: 'MB', street: '410 - 9th St', postalCode: 'R7A 6A2', country: 'CA' },
                    packages: 1, weight: 15.6, charges: 28.75, references: 'PRAIRIE-445566, AGRI-778899'
                },

                // Shipment 12 - DHL Ground
                {
                    id: 'TS-012', shipmentID: 'TS-2025-012', carrier: 'DHL', service: 'Ground',
                    shipFrom: { city: 'St. Johns', state: 'NL', street: '10 Fort William Pl', postalCode: 'A1C 1K4', country: 'CA' },
                    shipTo: { city: 'Corner Brook', state: 'NL', street: '1 Confederation Dr', postalCode: 'A2H 6J7', country: 'CA' },
                    packages: 2, weight: 43.2, charges: 134.60, references: 'NFLD-889900, REMOTE-112233'
                },

                // Shipment 13 - Purolator Ground
                {
                    id: 'TS-013', shipmentID: 'TS-2025-013', carrier: 'Purolator', service: 'Ground',
                    shipFrom: { city: 'Kitchener', state: 'ON', street: '200 King St W', postalCode: 'N2G 4Y7', country: 'CA' },
                    shipTo: { city: 'Barrie', state: 'ON', street: '70 Collier St', postalCode: 'L4M 1H2', country: 'CA' },
                    packages: 4, weight: 112.8, charges: 203.15, references: 'TECH-223344, MANUFACTURING-556677'
                },

                // Shipment 14 - FedEx Priority Overnight
                {
                    id: 'TS-014', shipmentID: 'TS-2025-014', carrier: 'FedEx', service: 'Priority Overnight',
                    shipFrom: { city: 'Whitehorse', state: 'YT', street: '2121 - 2nd Ave', postalCode: 'Y1A 1C2', country: 'CA' },
                    shipTo: { city: 'Yellowknife', state: 'NT', street: '4920 - 52 St', postalCode: 'X1A 2P8', country: 'CA' },
                    packages: 1, weight: 8.9, charges: 189.50, references: 'ARCTIC-667788, URGENT-998877'
                },

                // Shipment 15 - UPS Ground
                {
                    id: 'TS-015', shipmentID: 'TS-2025-015', carrier: 'UPS', service: 'Ground',
                    shipFrom: { city: 'Iqaluit', state: 'NU', street: '924 Mivvik St', postalCode: 'X0A 0H0', country: 'CA' },
                    shipTo: { city: 'Rankin Inlet', state: 'NU', street: 'Sivulliq Ave', postalCode: 'X0C 0G0', country: 'CA' },
                    packages: 3, weight: 76.4, charges: 456.80, references: 'NUNAVUT-334455, ARCTIC-112233'
                },

                // Shipment 16 - Canpar Express
                {
                    id: 'TS-016', shipmentID: 'TS-2025-016', carrier: 'Canpar Express', service: 'Express',
                    shipFrom: { city: 'Guelph', state: 'ON', street: '1 Carden St', postalCode: 'N1H 3A1', country: 'CA' },
                    shipTo: { city: 'Cambridge', state: 'ON', street: '50 Dickson St', postalCode: 'N1R 1T7', country: 'CA' },
                    packages: 2, weight: 54.3, charges: 78.90, references: 'REGIONAL-445566, EXPRESS-778899'
                },

                // Shipment 17 - Canada Post Priority
                {
                    id: 'TS-017', shipmentID: 'TS-2025-017', carrier: 'Canada Post', service: 'Priority',
                    shipFrom: { city: 'Red Deer', state: 'AB', street: '4914 - 48 Ave', postalCode: 'T4N 3T5', country: 'CA' },
                    shipTo: { city: 'Lethbridge', state: 'AB', street: '910 - 4 Ave S', postalCode: 'T1J 4E4', country: 'CA' },
                    packages: 1, weight: 29.7, charges: 65.40, references: 'ALBERTA-889900, OIL-223344'
                },

                // Shipment 18 - DHL Express
                {
                    id: 'TS-018', shipmentID: 'TS-2025-018', carrier: 'DHL', service: 'Express',
                    shipFrom: { city: 'Sherbrooke', state: 'QC', street: '145 Wellington St N', postalCode: 'J1H 5B7', country: 'CA' },
                    shipTo: { city: 'Trois-Rivières', state: 'QC', street: '1425 Place du Frère-André', postalCode: 'G8Z 3R8', country: 'CA' },
                    packages: 3, weight: 98.6, charges: 156.75, references: 'QUEBEC-556677, FRENCH-334455'
                },

                // Shipment 19 - Purolator Express
                {
                    id: 'TS-019', shipmentID: 'TS-2025-019', carrier: 'Purolator', service: 'Express',
                    shipFrom: { city: 'Nanaimo', state: 'BC', street: '455 Wallace St', postalCode: 'V9R 5B7', country: 'CA' },
                    shipTo: { city: 'Prince George', state: 'BC', street: '1100 Patricia Blvd', postalCode: 'V2L 3V9', country: 'CA' },
                    packages: 2, weight: 67.2, charges: 134.50, references: 'BC-INTERIOR-667788, FORESTRY-998877'
                },

                // Shipment 20 - FedEx Ground
                {
                    id: 'TS-020', shipmentID: 'TS-2025-020', carrier: 'FedEx', service: 'Ground',
                    shipFrom: { city: 'Peterborough', state: 'ON', street: '500 George St N', postalCode: 'K9H 3R9', country: 'CA' },
                    shipTo: { city: 'Kingston', state: 'ON', street: '216 Ontario St', postalCode: 'K7L 2Z3', country: 'CA' },
                    packages: 5, weight: 189.4, charges: 267.85, references: 'FINAL-112233, COMPLETE-445566'
                }
            ];

            // Create complete test company data structure instead of relying on database lookup
            const testCompanyData = {
                companyId: 'TEST_COMPANY', // Use a test ID that doesn't require database lookup
                company: 'Tyger Shark Inc',
                companyInfo: {
                    name: 'Tyger Shark Inc',
                    companyID: 'TEST_COMPANY',
                    address: {
                        street: '123 Business Street, Suite 100',
                        city: 'Toronto',
                        state: 'ON',
                        postalCode: 'M5V 3A8',
                        country: 'Canada'
                    },
                    phone: '(416) 555-0123',
                    email: 'billing@tygershark.com',
                    billingAddress: {
                        address1: '123 Business Street, Suite 100',
                        city: 'Toronto',
                        stateProv: 'ON',
                        zipPostal: 'M5V 3A8',
                        country: 'CA',
                        email: 'billing@tygershark.com'
                    }
                },
                shipments: testShipments, // Use all 20 shipments for comprehensive test
                totalCharges: testShipments.reduce((sum, shipment) => sum + shipment.charges, 0),
                // Add mock test mode flag to bypass company lookup
                testMode: true
            };

            const testInvoiceNumber = `TEST-${Date.now()}`;
            const subtotal = testCompanyData.totalCharges;
            const taxCalc = calculateTax(subtotal, invoiceSettings.enableTax ? invoiceSettings.taxRate : 0, invoiceSettings.currency);

            const testInvoiceData = {
                invoiceNumber: testInvoiceNumber,
                companyId: testCompanyData.companyId,
                companyName: testCompanyData.company,
                issueDate: new Date(),
                dueDate: calculateDueDate(invoiceSettings.paymentTerms),
                status: 'test',
                lineItems: testCompanyData.shipments.map((shipment, index) => {
                    // Get shipment date with fallback to current date for test
                    const shipmentDate = getShipmentDate(shipment);
                    const testDate = shipmentDate || new Date(Date.now() - (index * 24 * 60 * 60 * 1000)); // Use current date minus index days as fallback

                    return {
                        shipmentId: shipment.shipmentID || shipment.id,
                        orderNumber: shipment.orderNumber || `ORD-${Date.now()}-${index + 1}`,
                        trackingNumber: shipment.trackingNumber || `1Z${Math.random().toString(36).substr(2, 9).toUpperCase()}${index}`,
                        description: `Shipment from ${shipment.shipFrom?.city || 'Toronto'} to ${shipment.shipTo?.city || 'Vancouver'}`,
                        carrier: shipment.carrier, // Use actual carrier from test data
                        service: shipment.service, // Use actual service from test data
                        date: testDate,
                        charges: shipment.charges, // Use actual charges from test data
                        chargeBreakdown: [
                            { description: 'Freight Charges', amount: shipment.charges * 0.75 },
                            { description: 'Fuel Surcharge', amount: shipment.charges * 0.20 },
                            { description: 'Additional Fees', amount: shipment.charges * 0.05 }
                        ],
                        packages: shipment.packages, // Use actual package count
                        weight: shipment.weight, // Use actual weight
                        weightUnit: shipment.weightUnit || 'lbs',
                        references: shipment.references,
                        shipFrom: shipment.shipFrom, // Use actual shipFrom data
                        shipTo: shipment.shipTo // Use actual shipTo data
                    };
                }),
                subtotal: taxCalc.subtotal,
                tax: taxCalc.tax,
                total: taxCalc.total,
                currency: invoiceSettings.currency,
                paymentTerms: invoiceSettings.paymentTerms,
                settings: { ...invoiceSettings, testEmail: invoiceSettings.testEmail },
                testMode: true
            };

            // Trigger invoice generation via Firestore (no CORS issues)
            await triggerInvoiceGeneration(
                testInvoiceData,
                testCompanyData.companyId,
                true,
                invoiceSettings.testEmail
            );

            setTestEmailSent(true);
            enqueueSnackbar(`Test invoice sent successfully to ${invoiceSettings.testEmail}`, { variant: 'success' });

        } catch (error) {
            console.error('Error sending test invoice:', error);
            enqueueSnackbar('Failed to send test invoice: ' + error.message, { variant: 'error' });
        } finally {
            setIsSendingTest(false);
        }
    };

    const handleNext = () => {
        if (activeStep === 0) {
            const count = Object.values(selectedShipments).filter(Boolean).length;
            if (count === 0) {
                enqueueSnackbar('Please select at least one shipment to invoice', { variant: 'warning' });
                return;
            }
            setActiveStep(1);
        } else if (activeStep === 1) {
            setActiveStep(2);
        } else if (activeStep === 2) {
            generateInvoices().then(() => {
                setActiveStep(3);
            });
        } else if (activeStep === 3) {
            // Reset and start over
            setActiveStep(0);
            setSelectedShipments({});
            setGenerationResults({ successful: 0, failed: 0, totalInvoices: 0, invoiceNumbers: [] });
            fetchUninvoicedShipments();
        }
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleSelectShipment = (shipmentId) => {
        setSelectedShipments(prev => ({
            ...prev,
            [shipmentId]: !prev[shipmentId]
        }));
    };

    const handleSelectAllClick = (event) => {
        if (event.target.checked) {
            const newSelecteds = {};
            uninvoicedShipments.forEach(s => newSelecteds[s.id] = true);
            setSelectedShipments(newSelecteds);
        } else {
            setSelectedShipments({});
        }
    };

    const numSelected = Object.values(selectedShipments).filter(Boolean).length;
    const rowCount = uninvoicedShipments.length;

    function getStepContent(step) {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Select Shipments to Invoice
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '12px' }}>
                            Review uninvoiced shipments below. Uncheck any shipments to exclude from this invoice run.
                        </Typography>

                        {/* Summary Cards */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                                            Total Shipments
                                        </Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                            {uninvoicedShipments.length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                                            Companies
                                        </Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                            {Object.keys(groupedShipments).length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                                            Total Value
                                        </Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                            {formatInvoiceCurrency(
                                                Object.values(groupedShipments).reduce((sum, group) => sum + group.totalCharges, 0),
                                                invoiceSettings.currency
                                            )}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        <TableContainer component={Paper} elevation={1} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                color="primary"
                                                indeterminate={numSelected > 0 && numSelected < rowCount}
                                                checked={rowCount > 0 && numSelected === rowCount}
                                                onChange={handleSelectAllClick}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Shipment ID</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Company</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Date</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Carrier</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Route</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600 }}>Amount</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 3 }}>
                                                    <CircularProgress size={24} />
                                                    <Typography sx={{ mt: 1, fontSize: '12px' }}>Loading shipments...</Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : uninvoicedShipments.length > 0 ? (
                                        uninvoicedShipments.map((shipment) => {
                                            const charges = getShipmentCharges(shipment);
                                            const createdDate = getShipmentDate(shipment);

                                            return (
                                                <TableRow
                                                    key={shipment.id}
                                                    hover
                                                    onClick={() => handleSelectShipment(shipment.id)}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell padding="checkbox">
                                                        <Checkbox
                                                            color="primary"
                                                            checked={selectedShipments[shipment.id] || false}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {shipment.shipmentID || shipment.id}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {shipment.companyName || shipment.companyID}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {createdDate ? createdDate.toLocaleDateString() : 'Invalid Date'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {shipment.carrier || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px' }}>
                                                            {shipment.shipFrom?.city}, {shipment.shipFrom?.state}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            → {shipment.shipTo?.city}, {shipment.shipTo?.state}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontSize: '12px' }}>
                                                        {formatInvoiceCurrency(charges, invoiceSettings.currency)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 4 }}>
                                                    <ReceiptIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                        No uninvoiced shipments found
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Typography sx={{ mt: 2, fontSize: '12px', color: '#6b7280' }}>
                            Selected {numSelected} of {rowCount} shipments for invoicing.
                        </Typography>
                    </Box>
                );

            case 1:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Configure Invoice Settings
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '12px' }}>
                            Customize how your invoices will be generated and delivered.
                        </Typography>

                        <Grid container spacing={3}>
                            {/* Invoice Format Section */}
                            <Grid item xs={12}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                        Invoice Format
                                    </Typography>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Invoice Prefix"
                                                value={invoiceSettings.invoicePrefix}
                                                onChange={(e) => setInvoiceSettings(prev => ({
                                                    ...prev,
                                                    invoicePrefix: e.target.value
                                                }))}
                                                size="small"
                                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                                InputProps={{ sx: { fontSize: '12px' } }}
                                            />
                                        </Grid>
                                    </Grid>

                                    <Box sx={{ mt: 2 }}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={invoiceSettings.includeShipmentDetails}
                                                    onChange={(e) => setInvoiceSettings(prev => ({
                                                        ...prev,
                                                        includeShipmentDetails: e.target.checked
                                                    }))}
                                                    size="small"
                                                />
                                            }
                                            label={<Typography sx={{ fontSize: '12px' }}>Include shipment details</Typography>}
                                        />

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={invoiceSettings.includeChargeBreakdown}
                                                    onChange={(e) => setInvoiceSettings(prev => ({
                                                        ...prev,
                                                        includeChargeBreakdown: e.target.checked
                                                    }))}
                                                    size="small"
                                                />
                                            }
                                            label={<Typography sx={{ fontSize: '12px' }}>Include charge breakdown</Typography>}
                                        />

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={invoiceSettings.emailToCustomers}
                                                    onChange={(e) => setInvoiceSettings(prev => ({
                                                        ...prev,
                                                        emailToCustomers: e.target.checked
                                                    }))}
                                                    size="small"
                                                />
                                            }
                                            label={<Typography sx={{ fontSize: '12px' }}>Email invoices to customers</Typography>}
                                        />
                                    </Box>
                                </Paper>
                            </Grid>

                            {/* Test Invoice Section */}
                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                        Test Invoice
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                        Send a test invoice to verify formatting and email delivery
                                    </Typography>

                                    <TextField
                                        fullWidth
                                        label="Test Email Address"
                                        type="email"
                                        value={invoiceSettings.testEmail}
                                        onChange={(e) => setInvoiceSettings(prev => ({
                                            ...prev,
                                            testEmail: e.target.value
                                        }))}
                                        size="small"
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{ sx: { fontSize: '12px' } }}
                                        sx={{ mb: 2 }}
                                    />

                                    <Button
                                        variant="outlined"
                                        startIcon={isSendingTest ? <CircularProgress size={16} /> : <SendIcon />}
                                        onClick={sendTestInvoice}
                                        disabled={isSendingTest || !invoiceSettings.testEmail || numSelected === 0}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                        fullWidth
                                    >
                                        {isSendingTest ? 'Sending Test...' : 'Send Test Invoice'}
                                    </Button>

                                    {testEmailSent && (
                                        <Alert severity="success" sx={{ mt: 2, fontSize: '11px' }}>
                                            Test invoice sent successfully! Check your email.
                                        </Alert>
                                    )}
                                </Paper>
                            </Grid>

                            {/* Enhanced Invoice Preview */}
                            <Grid item xs={12}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                        Invoice Preview
                                    </Typography>

                                    {Object.keys(getSelectedShipmentsByCompany()).length > 0 ? (
                                        <Box>
                                            <Typography variant="body2" sx={{ mb: 2, fontSize: '12px' }}>
                                                Will generate {Object.keys(getSelectedShipmentsByCompany()).length} invoice(s):
                                            </Typography>
                                            <Grid container spacing={2}>
                                                {Object.values(getSelectedShipmentsByCompany()).map((company, idx) => {
                                                    const taxCalc = calculateTax(
                                                        company.totalCharges,
                                                        invoiceSettings.enableTax ? invoiceSettings.taxRate : 0,
                                                        invoiceSettings.currency
                                                    );
                                                    return (
                                                        <Grid item xs={12} sm={6} md={4} key={idx}>
                                                            <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                                                <CardContent sx={{ p: 2 }}>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                        {company.company}
                                                                    </Typography>
                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {company.shipments.length} shipment(s)
                                                                    </Typography>
                                                                    <Divider sx={{ my: 1 }} />
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                                        <span>Subtotal:</span>
                                                                        <span>{formatInvoiceCurrency(taxCalc.subtotal, invoiceSettings.currency)}</span>
                                                                    </Box>
                                                                    {invoiceSettings.enableTax && (
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                                            <span>Tax ({(invoiceSettings.taxRate * 100).toFixed(1)}%):</span>
                                                                            <span>{formatInvoiceCurrency(taxCalc.tax, invoiceSettings.currency)}</span>
                                                                        </Box>
                                                                    )}
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, mt: 1 }}>
                                                                        <span>Total:</span>
                                                                        <span>{formatInvoiceCurrency(taxCalc.total, invoiceSettings.currency)}</span>
                                                                    </Box>
                                                                </CardContent>
                                                            </Card>
                                                        </Grid>
                                                    );
                                                })}
                                            </Grid>
                                        </Box>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                            No shipments selected for invoicing
                                        </Typography>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                );

            case 2:
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                        <CircularProgress size={60} sx={{ mb: 3 }} />
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Generating Invoices...
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>
                            Creating PDF invoices and sending email notifications...
                        </Typography>
                    </Box>
                );

            case 3:
                return (
                    <Box sx={{ textAlign: 'center', py: 5 }}>
                        <CheckCircleIcon color="success" sx={{ fontSize: 70, mb: 2 }} />
                        <Typography variant="h5" gutterBottom sx={{ fontSize: '18px', fontWeight: 600, color: '#374151' }}>
                            Invoice Generation Complete!
                        </Typography>

                        <Grid container spacing={2} sx={{ mt: 2, mb: 3, maxWidth: 600, mx: 'auto' }}>
                            <Grid item xs={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#16a34a' }}>
                                            {generationResults.successful}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                            Successful
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#dc2626' }}>
                                            {generationResults.failed}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                            Failed
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                            {generationResults.totalInvoices}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                            Total
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {generationResults.invoiceNumbers.length > 0 && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="body1" sx={{ mb: 2, fontSize: '12px', fontWeight: 600 }}>Generated Invoice Numbers:</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                                    {generationResults.invoiceNumbers.map((number, idx) => (
                                        <Chip
                                            key={idx}
                                            label={number}
                                            variant="outlined"
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, fontSize: '12px' }}>
                            Invoices are now available in the Invoices dashboard for review and management.
                        </Typography>
                    </Box>
                );

            default:
                return 'Unknown step';
        }
    }

    if (error) {
        return (
            <Box sx={{ width: '100%' }}>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3, mx: 2 }}>
                    <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>
                        {error}
                    </Alert>
                    <Button
                        variant="contained"
                        onClick={fetchUninvoicedShipments}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Retry
                    </Button>
                </Paper>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3, mx: 2 }}>
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel sx={{
                                '& .MuiStepLabel-label': { fontSize: '12px' }
                            }}>
                                {label}
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Box sx={{ minHeight: 400 }}>
                    {getStepContent(activeStep)}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2, mt: 3, borderTop: '1px solid #e5e7eb' }}>
                    <Button
                        color="inherit"
                        disabled={activeStep === 0 || isProcessing}
                        onClick={handleBack}
                        sx={{ mr: 1, fontSize: '12px' }}
                        startIcon={<NavigateBefore />}
                        size="small"
                    >
                        Back
                    </Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button
                        onClick={handleNext}
                        variant="contained"
                        disabled={isProcessing || (activeStep === 2 && isProcessing)}
                        endIcon={activeStep !== steps.length - 1 && <NavigateNext />}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {activeStep === steps.length - 1 ? 'Generate More Invoices' :
                            activeStep === 0 ? `Continue with ${numSelected} Shipments` :
                                activeStep === 1 ? 'Generate Invoices' :
                                    'Next'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default GenerateInvoicesPage; 