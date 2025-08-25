const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Get Firestore instance
const db = getFirestore();

/**
 * Generate comprehensive reports with multiple formats and data sources
 */
exports.generateReport = onCall(async (request) => {
    try {
        const { 
            type, 
            dateRange, 
            filters, 
            exportFormat, 
            companyId, 
            userId,
            emailRecipients = []
        } = request.data;

        // Validate required parameters
        if (!type || !companyId) {
            throw new HttpsError('invalid-argument', 'Report type and company ID are required');
        }

        logger.info(`Generating ${type} report for company ${companyId}`, {
            type,
            dateRange,
            filters,
            exportFormat,
            userId
        });

        // Calculate date range
        const { startDate, endDate } = calculateDateRange(dateRange);

        // Fetch data based on report type
        const reportData = await fetchReportData(type, companyId, startDate, endDate, filters);

        // Generate report based on format
        const report = await generateReportContent(type, reportData, exportFormat, {
            dateRange: { startDate, endDate },
            filters,
            companyId
        });

        // Save report to storage if needed
        const reportId = await saveReport(report, type, companyId, userId);

        // Send email notifications if recipients provided
        if (emailRecipients.length > 0) {
            await sendReportNotifications(report, emailRecipients, type, reportId);
        }

        return {
            success: true,
            reportId,
            report: exportFormat === 'dashboard' ? report : null,
            downloadUrl: exportFormat !== 'dashboard' ? report.downloadUrl : null
        };

    } catch (error) {
        logger.error('Error generating report:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to generate report: ${error.message}`);
    }
});

/**
 * Calculate date range based on type
 */
function calculateDateRange(dateRange) {
    const now = new Date();
    let startDate, endDate = now;

    switch (dateRange.type) {
        case 'last-7-days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'last-30-days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'last-90-days':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case 'last-year':
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            break;
        case 'custom':
            startDate = new Date(dateRange.startDate);
            endDate = new Date(dateRange.endDate);
            break;
        default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate };
}

/**
 * Fetch data for report generation
 */
async function fetchReportData(type, companyId, startDate, endDate, filters) {
    logger.info(`Fetching data for ${type} report`, { companyId, startDate, endDate, filters });

    const data = {};

    // Base shipments query
    let shipmentsQuery = db.collection('shipments')
        .where('companyID', '==', companyId)
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('createdAt', '<=', admin.firestore.Timestamp.fromDate(endDate));

    // Apply filters
    if (filters.statuses && filters.statuses.length > 0) {
        shipmentsQuery = shipmentsQuery.where('status', 'in', filters.statuses);
    }

    const shipmentsSnapshot = await shipmentsQuery.get();
    const shipments = shipmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Filter by carriers if specified
    let filteredShipments = shipments;
    if (filters.carriers && filters.carriers.length > 0 && !filters.carriers.includes('all')) {
        filteredShipments = shipments.filter(shipment => {
            const carrier = shipment.selectedRateRef?.carrier || 
                           shipment.selectedRate?.carrier || 
                           shipment.carrier;
            return filters.carriers.includes(carrier);
        });
    }

    data.shipments = filteredShipments;

    // Fetch additional data based on report type
    switch (type) {
        case 'shipment-summary':
            data.summary = calculateShipmentSummary(filteredShipments);
            break;
        case 'carrier-performance':
            data.carrierMetrics = calculateCarrierPerformance(filteredShipments);
            break;
        case 'cost-analysis':
            data.costBreakdown = calculateCostAnalysis(filteredShipments);
            break;
        case 'delivery-performance':
            data.deliveryMetrics = calculateDeliveryPerformance(filteredShipments);
            break;
        case 'customer-activity':
            data.customerMetrics = await calculateCustomerActivity(filteredShipments, companyId);
            break;
        case 'route-analysis':
            data.routeMetrics = calculateRouteAnalysis(filteredShipments);
            break;
        case 'revenue-report':
            data.revenueMetrics = calculateRevenueAnalysis(filteredShipments);
            break;
        case 'exception-report':
            data.exceptions = calculateExceptions(filteredShipments);
            break;
    }

    return data;
}

/**
 * Calculate shipment summary metrics
 */
function calculateShipmentSummary(shipments) {
    const summary = {
        totalShipments: shipments.length,
        statusBreakdown: {},
        carrierBreakdown: {},
        totalValue: 0,
        averageValue: 0,
        totalWeight: 0,
        averageWeight: 0
    };

    shipments.forEach(shipment => {
        // Status breakdown
        const status = shipment.status || 'unknown';
        summary.statusBreakdown[status] = (summary.statusBreakdown[status] || 0) + 1;

        // Carrier breakdown
        const carrier = shipment.selectedRateRef?.carrier || 
                       shipment.selectedRate?.carrier || 
                       shipment.carrier || 'unknown';
        summary.carrierBreakdown[carrier] = (summary.carrierBreakdown[carrier] || 0) + 1;

        // Value calculations
        const value = shipment.selectedRateRef?.totalCharges || 
                     shipment.selectedRate?.totalCharges || 0;
        summary.totalValue += value;

        // Weight calculations
        const weight = shipment.packages?.reduce((total, pkg) => total + (pkg.weight || 0), 0) || 0;
        summary.totalWeight += weight;
    });

    summary.averageValue = summary.totalShipments > 0 ? summary.totalValue / summary.totalShipments : 0;
    summary.averageWeight = summary.totalShipments > 0 ? summary.totalWeight / summary.totalShipments : 0;

    return summary;
}

/**
 * Calculate carrier performance metrics
 */
function calculateCarrierPerformance(shipments) {
    const carrierMetrics = {};

    shipments.forEach(shipment => {
        const carrier = shipment.selectedRateRef?.carrier || 
                       shipment.selectedRate?.carrier || 
                       shipment.carrier || 'unknown';

        if (!carrierMetrics[carrier]) {
            carrierMetrics[carrier] = {
                totalShipments: 0,
                deliveredOnTime: 0,
                totalCost: 0,
                averageCost: 0,
                averageTransitTime: 0,
                transitTimes: []
            };
        }

        const metrics = carrierMetrics[carrier];
        metrics.totalShipments++;

        // Cost calculations
        const cost = shipment.selectedRateRef?.totalCharges || 
                    shipment.selectedRate?.totalCharges || 0;
        metrics.totalCost += cost;

        // Transit time calculations
        if (shipment.deliveredAt && shipment.createdAt) {
            const transitTime = Math.ceil(
                (shipment.deliveredAt.toDate() - shipment.createdAt.toDate()) / (1000 * 60 * 60 * 24)
            );
            metrics.transitTimes.push(transitTime);
        }

        // On-time delivery
        if (shipment.status === 'delivered' && shipment.deliveredAt && shipment.estimatedDeliveryDate) {
            const delivered = shipment.deliveredAt.toDate();
            const estimated = new Date(shipment.estimatedDeliveryDate);
            if (delivered <= estimated) {
                metrics.deliveredOnTime++;
            }
        }
    });

    // Calculate averages
    Object.keys(carrierMetrics).forEach(carrier => {
        const metrics = carrierMetrics[carrier];
        metrics.averageCost = metrics.totalShipments > 0 ? metrics.totalCost / metrics.totalShipments : 0;
        metrics.averageTransitTime = metrics.transitTimes.length > 0 
            ? metrics.transitTimes.reduce((sum, time) => sum + time, 0) / metrics.transitTimes.length 
            : 0;
        metrics.onTimePercentage = metrics.totalShipments > 0 
            ? (metrics.deliveredOnTime / metrics.totalShipments) * 100 
            : 0;
    });

    return carrierMetrics;
}

/**
 * Calculate cost analysis
 */
function calculateCostAnalysis(shipments) {
    const costAnalysis = {
        totalCost: 0,
        averageCost: 0,
        costByCarrier: {},
        costByMonth: {},
        costTrends: []
    };

    shipments.forEach(shipment => {
        const cost = shipment.selectedRateRef?.totalCharges || 
                    shipment.selectedRate?.totalCharges || 0;
        costAnalysis.totalCost += cost;

        // Cost by carrier
        const carrier = shipment.selectedRateRef?.carrier || 
                       shipment.selectedRate?.carrier || 
                       shipment.carrier || 'unknown';
        costAnalysis.costByCarrier[carrier] = (costAnalysis.costByCarrier[carrier] || 0) + cost;

        // Cost by month
        const month = shipment.createdAt.toDate().toISOString().substring(0, 7);
        costAnalysis.costByMonth[month] = (costAnalysis.costByMonth[month] || 0) + cost;
    });

    costAnalysis.averageCost = shipments.length > 0 ? costAnalysis.totalCost / shipments.length : 0;

    return costAnalysis;
}

/**
 * Calculate delivery performance
 */
function calculateDeliveryPerformance(shipments) {
    const deliveryMetrics = {
        totalDelivered: 0,
        onTimeDeliveries: 0,
        lateDeliveries: 0,
        averageDeliveryTime: 0,
        onTimePercentage: 0
    };

    const deliveryTimes = [];

    shipments.forEach(shipment => {
        if (shipment.status === 'delivered' && shipment.deliveredAt) {
            deliveryMetrics.totalDelivered++;

            // Calculate delivery time
            if (shipment.createdAt) {
                const deliveryTime = Math.ceil(
                    (shipment.deliveredAt.toDate() - shipment.createdAt.toDate()) / (1000 * 60 * 60 * 24)
                );
                deliveryTimes.push(deliveryTime);
            }

            // Check if on time
            if (shipment.estimatedDeliveryDate) {
                const delivered = shipment.deliveredAt.toDate();
                const estimated = new Date(shipment.estimatedDeliveryDate);
                if (delivered <= estimated) {
                    deliveryMetrics.onTimeDeliveries++;
                } else {
                    deliveryMetrics.lateDeliveries++;
                }
            }
        }
    });

    deliveryMetrics.averageDeliveryTime = deliveryTimes.length > 0 
        ? deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length 
        : 0;

    deliveryMetrics.onTimePercentage = deliveryMetrics.totalDelivered > 0 
        ? (deliveryMetrics.onTimeDeliveries / deliveryMetrics.totalDelivered) * 100 
        : 0;

    return deliveryMetrics;
}

/**
 * Calculate customer activity
 */
async function calculateCustomerActivity(shipments, companyId) {
    const customerMetrics = {};

    // Get customer data
    const customersSnapshot = await db.collection('customers')
        .where('companyID', '==', companyId)
        .get();

    const customers = {};
    customersSnapshot.docs.forEach(doc => {
        customers[doc.data().customerID] = doc.data();
    });

    shipments.forEach(shipment => {
        const customerId = shipment.shipTo?.customerID || shipment.customerID;
        const customerName = customers[customerId]?.name || 'Unknown Customer';

        if (!customerMetrics[customerName]) {
            customerMetrics[customerName] = {
                totalShipments: 0,
                totalValue: 0,
                averageValue: 0,
                lastShipment: null
            };
        }

        const metrics = customerMetrics[customerName];
        metrics.totalShipments++;

        const value = shipment.selectedRateRef?.totalCharges || 
                     shipment.selectedRate?.totalCharges || 0;
        metrics.totalValue += value;

        if (!metrics.lastShipment || shipment.createdAt.toDate() > new Date(metrics.lastShipment)) {
            metrics.lastShipment = shipment.createdAt.toDate().toISOString();
        }
    });

    // Calculate averages
    Object.keys(customerMetrics).forEach(customer => {
        const metrics = customerMetrics[customer];
        metrics.averageValue = metrics.totalShipments > 0 ? metrics.totalValue / metrics.totalShipments : 0;
    });

    return customerMetrics;
}

/**
 * Calculate route analysis
 */
function calculateRouteAnalysis(shipments) {
    const routeMetrics = {
        topOrigins: {},
        topDestinations: {},
        routeFrequency: {}
    };

    shipments.forEach(shipment => {
        // Origin analysis
        const origin = `${shipment.shipFrom?.city}, ${shipment.shipFrom?.state}`;
        routeMetrics.topOrigins[origin] = (routeMetrics.topOrigins[origin] || 0) + 1;

        // Destination analysis
        const destination = `${shipment.shipTo?.city}, ${shipment.shipTo?.state}`;
        routeMetrics.topDestinations[destination] = (routeMetrics.topDestinations[destination] || 0) + 1;

        // Route frequency
        const route = `${origin} → ${destination}`;
        routeMetrics.routeFrequency[route] = (routeMetrics.routeFrequency[route] || 0) + 1;
    });

    return routeMetrics;
}

/**
 * Calculate revenue analysis
 */
function calculateRevenueAnalysis(shipments) {
    const revenueMetrics = {
        totalRevenue: 0,
        revenueByMonth: {},
        revenueByCarrier: {},
        profitMargins: {}
    };

    shipments.forEach(shipment => {
        const revenue = shipment.selectedRateRef?.totalCharges || 
                       shipment.selectedRate?.totalCharges || 0;
        revenueMetrics.totalRevenue += revenue;

        // Revenue by month
        const month = shipment.createdAt.toDate().toISOString().substring(0, 7);
        revenueMetrics.revenueByMonth[month] = (revenueMetrics.revenueByMonth[month] || 0) + revenue;

        // Revenue by carrier
        const carrier = shipment.selectedRateRef?.carrier || 
                       shipment.selectedRate?.carrier || 
                       shipment.carrier || 'unknown';
        revenueMetrics.revenueByCarrier[carrier] = (revenueMetrics.revenueByCarrier[carrier] || 0) + revenue;
    });

    return revenueMetrics;
}

/**
 * Calculate exceptions
 */
function calculateExceptions(shipments) {
    const exceptions = {
        delayed: [],
        cancelled: [],
        damaged: [],
        returned: []
    };

    shipments.forEach(shipment => {
        if (shipment.status === 'delayed' || shipment.status === 'exception') {
            exceptions.delayed.push(shipment);
        } else if (shipment.status === 'cancelled') {
            exceptions.cancelled.push(shipment);
        } else if (shipment.status === 'damaged') {
            exceptions.damaged.push(shipment);
        } else if (shipment.status === 'returned') {
            exceptions.returned.push(shipment);
        }
    });

    return exceptions;
}

/**
 * Generate report content based on format
 */
async function generateReportContent(type, data, format, metadata) {
    switch (format) {
        case 'pdf':
            return await generatePDFReport(type, data, metadata);
        case 'excel':
            return await generateExcelReport(type, data, metadata);
        case 'csv':
            return await generateCSVReport(type, data, metadata);
        case 'dashboard':
            return generateDashboardData(type, data, metadata);
        default:
            throw new Error(`Unsupported export format: ${format}`);
    }
}

/**
 * Generate PDF report
 */
async function generatePDFReport(type, data, metadata) {
    // This would integrate with a PDF generation service
    // For now, return a mock structure
    return {
        type: 'pdf',
        content: `PDF report for ${type}`,
        downloadUrl: `https://example.com/reports/${type}-${Date.now()}.pdf`,
        metadata
    };
}

/**
 * Generate Excel report
 */
async function generateExcelReport(type, data, metadata) {
    // This would integrate with an Excel generation service
    return {
        type: 'excel',
        content: `Excel report for ${type}`,
        downloadUrl: `https://example.com/reports/${type}-${Date.now()}.xlsx`,
        metadata
    };
}

/**
 * Generate CSV report
 */
async function generateCSVReport(type, data, metadata) {
    let csvContent = '';
    
    if (data.shipments) {
        // Generate CSV headers
        const headers = [
            'Shipment ID', 'Date', 'Status', 'Carrier', 'Origin', 'Destination', 
            'Cost', 'Weight', 'Customer'
        ];
        csvContent = headers.join(',') + '\n';

        // Add data rows
        data.shipments.forEach(shipment => {
            const row = [
                shipment.shipmentID || shipment.id,
                shipment.createdAt.toDate().toLocaleDateString(),
                shipment.status || '',
                shipment.selectedRateRef?.carrier || shipment.selectedRate?.carrier || '',
                `"${shipment.shipFrom?.city}, ${shipment.shipFrom?.state}"`,
                `"${shipment.shipTo?.city}, ${shipment.shipTo?.state}"`,
                shipment.selectedRateRef?.totalCharges || shipment.selectedRate?.totalCharges || 0,
                shipment.packages?.reduce((total, pkg) => total + (pkg.weight || 0), 0) || 0,
                shipment.shipTo?.company || ''
            ];
            csvContent += row.join(',') + '\n';
        });
    }

    return {
        type: 'csv',
        content: csvContent,
        downloadUrl: `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`,
        metadata
    };
}

/**
 * Generate dashboard data
 */
function generateDashboardData(type, data, metadata) {
    return {
        type: 'dashboard',
        data,
        metadata,
        charts: generateChartData(type, data),
        tables: generateTableData(type, data)
    };
}

/**
 * Generate chart data for dashboard
 */
function generateChartData(type, data) {
    const charts = [];

    switch (type) {
        case 'shipment-summary':
            if (data.summary) {
                charts.push({
                    type: 'pie',
                    title: 'Shipments by Status',
                    data: Object.entries(data.summary.statusBreakdown).map(([status, count]) => ({
                        label: status,
                        value: count
                    }))
                });

                charts.push({
                    type: 'bar',
                    title: 'Shipments by Carrier',
                    data: Object.entries(data.summary.carrierBreakdown).map(([carrier, count]) => ({
                        label: carrier,
                        value: count
                    }))
                });
            }
            break;

        case 'carrier-performance':
            if (data.carrierMetrics) {
                charts.push({
                    type: 'bar',
                    title: 'Average Cost by Carrier',
                    data: Object.entries(data.carrierMetrics).map(([carrier, metrics]) => ({
                        label: carrier,
                        value: metrics.averageCost
                    }))
                });

                charts.push({
                    type: 'bar',
                    title: 'On-Time Delivery Rate',
                    data: Object.entries(data.carrierMetrics).map(([carrier, metrics]) => ({
                        label: carrier,
                        value: metrics.onTimePercentage
                    }))
                });
            }
            break;
    }

    return charts;
}

/**
 * Generate table data for dashboard
 */
function generateTableData(type, data) {
    const tables = [];

    if (data.shipments) {
        tables.push({
            title: 'Recent Shipments',
            headers: ['Shipment ID', 'Date', 'Status', 'Carrier', 'Cost'],
            rows: data.shipments.slice(0, 10).map(shipment => [
                shipment.shipmentID || shipment.id,
                shipment.createdAt.toDate().toLocaleDateString(),
                shipment.status || '',
                shipment.selectedRateRef?.carrier || shipment.selectedRate?.carrier || '',
                `$${(shipment.selectedRateRef?.totalCharges || shipment.selectedRate?.totalCharges || 0).toFixed(2)}`
            ])
        });
    }

    return tables;
}

/**
 * Save report to storage
 */
async function saveReport(report, type, companyId, userId) {
    const reportId = `${type}-${companyId}-${Date.now()}`;
    
    const reportDoc = {
        id: reportId,
        type,
        companyId,
        userId,
        format: report.type,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        downloadUrl: report.downloadUrl,
        metadata: report.metadata
    };

    await db.collection('reports').doc(reportId).set(reportDoc);
    
    return reportId;
}

/**
 * Send report notifications
 */
async function sendReportNotifications(report, emailRecipients, type, reportId) {
    try {
        const sgMail = require('@sendgrid/mail');
        
        // Get SendGrid API key from environment variables
        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        
        if (!sendgridApiKey) {
            logger.warn('SendGrid API key not configured - skipping email notifications');
            return;
        }
        
        sgMail.setApiKey(sendgridApiKey);

        const emailData = {
            reportType: type,
            reportId,
            downloadUrl: report.downloadUrl,
            generatedAt: new Date().toISOString(),
            format: report.type
        };

        // Send to each recipient
        for (const email of emailRecipients) {
            const emailContent = {
                to: email,
                            from: {
                email: 'noreplys@integratedcarriers.com',
                name: 'Integrated Carriers Reports'
            },
                subject: `Report Ready: ${formatReportType(type)}`,
                html: generateReportEmailHTML(emailData, email),
                text: generateReportEmailText(emailData, email)
            };

            await sgMail.send(emailContent);
        }

        logger.info(`Sent report notifications to ${emailRecipients.length} recipients`);
    } catch (error) {
        logger.error('Error sending report notifications:', error);
        // Don't throw error - report generation should still succeed
    }
}

/**
 * Format report type for display
 */
function formatReportType(type) {
    return type.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

/**
 * Generate HTML email for report notification
 */
function generateReportEmailHTML(data, recipient) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                <h1 style="margin: 0; font-size: 24px;">Report Generated Successfully!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your ${formatReportType(data.reportType)} report is ready</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                <!-- Report Summary -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Report Details</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Report Type:</strong></td><td style="padding: 8px 0; font-weight: bold;">${formatReportType(data.reportType)}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Format:</strong></td><td style="padding: 8px 0; text-transform: uppercase;">${data.format}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Generated:</strong></td><td style="padding: 8px 0;">${new Date(data.generatedAt).toLocaleString()}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Report ID:</strong></td><td style="padding: 8px 0; font-family: monospace;">${data.reportId}</td></tr>
                    </table>
                </div>

                <!-- Download Section -->
                ${data.downloadUrl ? `
                <div style="background: #d1fae5; border: 1px solid #10b981; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                    <h3 style="color: #065f46; margin: 0 0 15px 0;">📊 Report Ready for Download</h3>
                    <p style="margin: 0 0 20px 0; color: #065f46;">
                        Your report has been generated and is ready for download.
                    </p>
                    <a href="${data.downloadUrl}" 
                       style="background: #1c277d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #1c277d; font-weight: bold;">
                       Download Report
                    </a>
                </div>
                ` : `
                <div style="background: #dbeafe; border: 1px solid #3b82f6; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                    <h3 style="color: #1e40af; margin: 0 0 15px 0;">📊 Dashboard Report Ready</h3>
                    <p style="margin: 0 0 20px 0; color: #1e40af;">
                        Your interactive dashboard report is ready to view in the SolushipX platform.
                    </p>
                    <a href="https://solushipx.web.app/reports" 
                       style="background: #1c277d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #1c277d; font-weight: bold;">
                       View Dashboard
                    </a>
                </div>
                `}

                <!-- Report Description -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">About This Report</h2>
                    <p style="margin: 0; line-height: 1.6; color: #374151;">
                        ${getReportDescription(data.reportType)}
                    </p>
                </div>

                <!-- Next Steps -->
                <div style="background: #f5f5f5; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                    <h3 style="color: #1c277d; margin: 0 0 10px 0;">What's Next?</h3>
                    <ul style="margin: 0; padding-left: 20px; line-height: 1.6; color: #374151;">
                        <li>Review the report data and insights</li>
                        <li>Share with your team members</li>
                        <li>Schedule automated delivery for regular updates</li>
                        <li>Configure additional report types as needed</li>
                    </ul>
                </div>

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                    <p style="margin: 0;">Questions about reports? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">© 2025 SolushipX. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate text email for report notification
 */
function generateReportEmailText(data, recipient) {
    return `
Report Generated Successfully!

Your ${formatReportType(data.reportType)} report is ready.

REPORT DETAILS:
- Report Type: ${formatReportType(data.reportType)}
- Format: ${data.format.toUpperCase()}
- Generated: ${new Date(data.generatedAt).toLocaleString()}
- Report ID: ${data.reportId}

${data.downloadUrl ? `
📊 REPORT READY FOR DOWNLOAD
Your report has been generated and is ready for download.
Download: ${data.downloadUrl}
` : `
📊 DASHBOARD REPORT READY
Your interactive dashboard report is ready to view in the SolushipX platform.
View Dashboard: https://solushipx.web.app/reports
`}

ABOUT THIS REPORT:
${getReportDescription(data.reportType)}

WHAT'S NEXT?
- Review the report data and insights
- Share with your team members
- Schedule automated delivery for regular updates
- Configure additional report types as needed

Questions about reports? Contact support@integratedcarriers.com

© 2025 SolushipX. All rights reserved.
    `;
}

/**
 * Get description for report type
 */
function getReportDescription(type) {
    const descriptions = {
        'shipment-summary': 'Comprehensive overview of all shipments with key metrics including status breakdowns, carrier distribution, and volume analysis.',
        'carrier-performance': 'Detailed analysis of carrier delivery times, costs, and on-time performance to help optimize your shipping strategy.',
        'cost-analysis': 'In-depth breakdown of shipping costs and trends to identify savings opportunities and budget planning.',
        'delivery-performance': 'Analysis of delivery metrics including on-time rates, average delivery times, and performance trends.',
        'customer-activity': 'Customer shipping patterns and volume analysis to understand your customer base and shipping behavior.',
        'route-analysis': 'Geographic shipping patterns and route optimization insights to improve efficiency and reduce costs.',
        'revenue-report': 'Financial analysis of shipping revenue, margins, and profitability across different carriers and routes.',
        'exception-report': 'Summary of delayed, damaged, or problematic shipments to help identify and resolve operational issues.'
    };
    
    return descriptions[type] || 'Detailed analysis and insights from your shipping data.';
} 