const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// Constants
const SEND_FROM_EMAIL = 'noreply@integratedcarriers.com';

// Get SendGrid API key from environment variables or Firebase config
const sendgridApiKey = process.env.SENDGRID_API_KEY;

// Initialize SendGrid only if API key is available
if (sendgridApiKey) {
    sgMail.setApiKey(sendgridApiKey);
} else {
    console.warn('SendGrid API key not found in environment variables');
}

/**
 * Email templates and utilities
 */
const EMAIL_TEMPLATES = {
    shipment_created: {
        subject: (data) => `Shipment Created:  ${data.shipmentNumber}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">Shipment Successfully Created!</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your shipment is now in the system and ready for pickup</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Shipment Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Shipment #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.shipmentNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Company ID:</strong></td><td style="padding: 8px 0;">${data.companyID || 'N/A'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Customer ID:</strong></td><td style="padding: 8px 0;">${data.customerID || 'N/A'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Created:</strong></td><td style="padding: 8px 0;">${new Date(data.createdAt).toLocaleDateString()}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0; color: #1c277d; font-weight: bold; text-transform: capitalize;">${data.status || 'pending'}</td></tr>
                        </table>
                    </div>

                    <!-- Shipment Information -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Information</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${(data.shipmentInfo && data.shipmentInfo.shipmentType) || 'package'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${(data.shipmentInfo && data.shipmentInfo.referenceNumber) || data.shipmentNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Bill Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${(data.shipmentInfo && data.shipmentInfo.billType) || 'prepaid'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Pickup Window:</strong></td><td style="padding: 8px 0;">${(data.shipmentInfo && data.shipmentInfo.pickupWindow) ? `${data.shipmentInfo.pickupWindow.earliest} - ${data.shipmentInfo.pickupWindow.latest}` : '09:00 - 17:00'}</td></tr>
                            ${data.estimatedDeliveryDate ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Est. Delivery:</strong></td><td style="padding: 8px 0;">${new Date(data.estimatedDeliveryDate).toLocaleDateString()}</td></tr>` : ''}
                        </table>
                    </div>

                    <!-- Carrier & Service -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Carrier & Service</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${(data.carrier && data.carrier.name) || data.carrier || 'Unknown'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td><td style="padding: 8px 0;">${(data.carrier && data.carrier.service) || 'Standard Service'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.trackingNumber || 'Pending'}</td></tr>
                            ${data.transitDays > 0 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Transit Time:</strong></td><td style="padding: 8px 0;">${data.transitDays} ${data.transitDays === 1 ? 'day' : 'days'}</td></tr>` : ''}
                        </table>
                    </div>

                    <!-- Service Options -->
                    ${(data.shipmentInfo && (data.shipmentInfo.holdForPickup || data.shipmentInfo.saturdayDelivery || data.shipmentInfo.signatureRequired)) || data.isInternational ? `
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Service Options</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            ${(data.shipmentInfo && data.shipmentInfo.holdForPickup) ? '<tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Hold for Pickup:</strong></td><td style="padding: 8px 0;">Yes</td></tr>' : ''}
                            ${(data.shipmentInfo && data.shipmentInfo.saturdayDelivery) ? '<tr><td style="padding: 8px 0; color: #666;"><strong>Saturday Delivery:</strong></td><td style="padding: 8px 0;">Yes</td></tr>' : ''}
                            ${(data.shipmentInfo && data.shipmentInfo.signatureRequired) ? '<tr><td style="padding: 8px 0; color: #666;"><strong>Signature Required:</strong></td><td style="padding: 8px 0;">Yes</td></tr>' : ''}
                            ${data.isInternational ? '<tr><td style="padding: 8px 0; color: #666;"><strong>International:</strong></td><td style="padding: 8px 0;">Yes</td></tr>' : ''}
                        </table>
                    </div>
                    ` : ''}

                    <!-- Rate Information -->
                    ${(data.rate && data.rate.totalCharges > 0) ? `
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Rate Details</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            ${data.rate.freightCharge > 0 ? `<tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Freight:</strong></td><td style="padding: 8px 0;">$${data.rate.freightCharge.toFixed(2)}</td></tr>` : ''}
                            ${data.rate.fuelCharge > 0 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Fuel:</strong></td><td style="padding: 8px 0;">$${data.rate.fuelCharge.toFixed(2)}</td></tr>` : ''}
                            ${data.rate.serviceCharges > 0 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td><td style="padding: 8px 0;">$${data.rate.serviceCharges.toFixed(2)}</td></tr>` : ''}
                            ${data.rate.accessorialCharges > 0 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Accessorial:</strong></td><td style="padding: 8px 0;">$${data.rate.accessorialCharges.toFixed(2)}</td></tr>` : ''}
                            <tr style="border-top: 2px solid #1c277d;"><td style="padding: 12px 0 8px 0; color: #1c277d; font-weight: bold;"><strong>Total:</strong></td><td style="padding: 12px 0 8px 0; font-weight: bold; font-size: 18px; color: #1c277d;">$${data.rate.totalCharges.toFixed(2)} ${data.rate.currency || 'USD'}</td></tr>
                        </table>
                    </div>
                    ` : ''}

                    <!-- Addresses -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Address Information</h2>
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px; margin-right: 20px;">
                                <h4 style="color: #000; margin: 0 0 10px 0;">Ship From:</h4>
                                <p style="margin: 0; line-height: 1.5;">
                                    ${data.origin && data.origin.company ? `<strong>${data.origin.company}</strong><br>` : ''}
                                    ${data.origin && data.origin.contact ? `${data.origin.contact}<br>` : ''}
                                    ${data.origin && data.origin.street ? `${data.origin.street}<br>` : ''}
                                    ${data.origin && data.origin.street2 ? `${data.origin.street2}<br>` : ''}
                                    ${data.origin ? `${data.origin.city}, ${data.origin.state} ${data.origin.postalCode}<br>` : ''}
                                    ${data.origin && data.origin.country ? data.origin.country : ''}
                                    ${data.origin && data.origin.phone ? `<br>Phone: ${data.origin.phone}` : ''}
                                </p>
                            </div>
                            <div style="flex: 1; min-width: 200px;">
                                <h4 style="color: #000; margin: 0 0 10px 0;">Ship To:</h4>
                                <p style="margin: 0; line-height: 1.5;">
                                    ${data.destination && data.destination.company ? `<strong>${data.destination.company}</strong><br>` : ''}
                                    ${data.destination && data.destination.contact ? `${data.destination.contact}<br>` : ''}
                                    ${data.destination && data.destination.street ? `${data.destination.street}<br>` : ''}
                                    ${data.destination && data.destination.street2 ? `${data.destination.street2}<br>` : ''}
                                    ${data.destination ? `${data.destination.city}, ${data.destination.state} ${data.destination.postalCode}<br>` : ''}
                                    ${data.destination && data.destination.country ? data.destination.country : ''}
                                    ${data.destination && data.destination.phone ? `<br>Phone: ${data.destination.phone}` : ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Package Information -->
                    ${(data.packages && data.packages.length > 0) ? `
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Package Information</h2>
                        <p style="margin: 0 0 15px 0; color: #666;"><strong>Total: ${data.totalPackages || data.packages.length} package${(data.totalPackages || data.packages.length) > 1 ? 's' : ''}, ${data.totalWeight || 0} lbs</strong></p>
                        ${data.packages.slice(0, 3).map(pkg => `
                            <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                                <strong>Package ${pkg.number}:</strong> ${pkg.description}<br>
                                <span style="color: #666;">Qty: ${pkg.quantity}, Weight: ${pkg.weight} lbs, Dimensions: ${pkg.dimensions.length}" × ${pkg.dimensions.width}" × ${pkg.dimensions.height}"</span>
                                ${pkg.declaredValue > 0 ? `<br><span style="color: #666;">Value: $${pkg.declaredValue.toFixed(2)}</span>` : ''}
                            </div>
                        `).join('')}
                        ${data.packages.length > 3 ? `<p style="margin: 10px 0 0 0; color: #666; font-style: italic;">...and ${data.packages.length - 3} more package${data.packages.length - 3 > 1 ? 's' : ''}</p>` : ''}
                    </div>
                    ` : ''}

                    ${data.shipmentNumber ? `
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Track Your Shipment</h3>
                        <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #1c277d;">${data.shipmentNumber}</p>
                        <a href="https://solushipx.web.app/tracking/${data.shipmentNumber}" 
                           style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #000;">
                           Track Shipment
                        </a>
                    </div>
                    ` : ''}

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
Shipment Successfully Created!

SHIPMENT SUMMARY
- Shipment #: ${data.shipmentNumber}
- Company ID: ${data.companyID || 'N/A'}
- Customer ID: ${data.customerID || 'N/A'}
- Created: ${new Date(data.createdAt).toLocaleDateString()}
- Status: ${data.status || 'pending'}

SHIPMENT INFORMATION
- Type: ${(data.shipmentInfo && data.shipmentInfo.shipmentType) || 'package'}
- Reference #: ${(data.shipmentInfo && data.shipmentInfo.referenceNumber) || data.shipmentNumber}
- Bill Type: ${(data.shipmentInfo && data.shipmentInfo.billType) || 'prepaid'}
- Pickup Window: ${(data.shipmentInfo && data.shipmentInfo.pickupWindow) ? `${data.shipmentInfo.pickupWindow.earliest} - ${data.shipmentInfo.pickupWindow.latest}` : '09:00 - 17:00'}
${data.estimatedDeliveryDate ? `- Est. Delivery: ${new Date(data.estimatedDeliveryDate).toLocaleDateString()}` : ''}

CARRIER & SERVICE
- Carrier: ${(data.carrier && data.carrier.name) || data.carrier || 'Unknown'}
- Service: ${(data.carrier && data.carrier.service) || 'Standard Service'}
- Tracking #: ${data.trackingNumber || 'Pending'}
${data.transitDays > 0 ? `- Transit Time: ${data.transitDays} ${data.transitDays === 1 ? 'day' : 'days'}` : ''}

ADDRESSES
Ship From:
${data.origin && data.origin.company ? `${data.origin.company}\n` : ''}${data.origin && data.origin.contact ? `${data.origin.contact}\n` : ''}${data.origin && data.origin.street ? `${data.origin.street}\n` : ''}${data.origin && data.origin.street2 ? `${data.origin.street2}\n` : ''}${data.origin ? `${data.origin.city}, ${data.origin.state} ${data.origin.postalCode}\n` : ''}${data.origin && data.origin.country ? data.origin.country : ''}${data.origin && data.origin.phone ? `\nPhone: ${data.origin.phone}` : ''}

Ship To:
${data.destination && data.destination.company ? `${data.destination.company}\n` : ''}${data.destination && data.destination.contact ? `${data.destination.contact}\n` : ''}${data.destination && data.destination.street ? `${data.destination.street}\n` : ''}${data.destination && data.destination.street2 ? `${data.destination.street2}\n` : ''}${data.destination ? `${data.destination.city}, ${data.destination.state} ${data.destination.postalCode}\n` : ''}${data.destination && data.destination.country ? data.destination.country : ''}${data.destination && data.destination.phone ? `\nPhone: ${data.destination.phone}` : ''}

${(data.packages && data.packages.length > 0) ? `PACKAGES
Total: ${data.totalPackages || data.packages.length} package${(data.totalPackages || data.packages.length) > 1 ? 's' : ''}, ${data.totalWeight || 0} lbs

${data.packages.slice(0, 3).map(pkg => 
    `Package ${pkg.number}: ${pkg.description}\nQty: ${pkg.quantity}, Weight: ${pkg.weight} lbs, Dimensions: ${pkg.dimensions.length}" × ${pkg.dimensions.width}" × ${pkg.dimensions.height}"\n${pkg.declaredValue > 0 ? `Value: $${pkg.declaredValue.toFixed(2)}\n` : ''}`
).join('\n')}${data.packages.length > 3 ? `...and ${data.packages.length - 3} more package${data.packages.length - 3 > 1 ? 's' : ''}\n` : ''}` : ''}

${(data.rate && data.rate.totalCharges > 0) ? `RATE DETAILS
${data.rate.freightCharge > 0 ? `Freight: $${data.rate.freightCharge.toFixed(2)}\n` : ''}${data.rate.fuelCharge > 0 ? `Fuel: $${data.rate.fuelCharge.toFixed(2)}\n` : ''}${data.rate.serviceCharges > 0 ? `Service: $${data.rate.serviceCharges.toFixed(2)}\n` : ''}${data.rate.accessorialCharges > 0 ? `Accessorial: $${data.rate.accessorialCharges.toFixed(2)}\n` : ''}Total: $${data.rate.totalCharges.toFixed(2)} ${data.rate.currency || 'USD'}` : ''}

${data.shipmentNumber ? `Track your shipment: https://solushipx.web.app/tracking/${data.shipmentNumber}` : ''}

Need help? Contact us at support@integratedcarriers.com
        `
    },

    shipment_delivered: {
        subject: (data) => `Shipment Delivered # ${data.shipmentNumber}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">Shipment Delivered!</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your package has been successfully delivered</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Delivery Confirmation</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Shipment #:</strong></td><td style="padding: 8px 0;">${data.shipmentNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Delivered:</strong></td><td style="padding: 8px 0;">${new Date(data.deliveredAt).toLocaleString()}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${data.carrier}</td></tr>
                            ${data.signature ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Signed by:</strong></td><td style="padding: 8px 0;">${data.signature}</td></tr>` : ''}
                        </table>
                    </div>

                    <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Delivery Complete!</h3>
                        <p style="margin: 0; color: #000;">Package delivered to: ${data.destination.city}, ${data.destination.state}</p>
                    </div>

                    ${data.shipmentNumber ? `
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Track Your Shipment</h3>
                        <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #1c277d;">${data.shipmentNumber}</p>
                        <a href="https://solushipx.web.app/tracking/${data.shipmentNumber}" 
                           style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #000;">
                           View Delivery Details
                        </a>
                    </div>
                    ` : ''}

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Thank you for choosing SolushipX!</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
Shipment Delivered!

Delivery Details:
- Shipment #: ${data.shipmentNumber}
- Delivered: ${new Date(data.deliveredAt).toLocaleString()}
- Carrier: ${data.carrier}
${data.signature ? `- Signed by: ${data.signature}` : ''}

Delivered to: ${data.destination.city}, ${data.destination.state}

${data.shipmentNumber ? `View delivery details: https://solushipx.web.app/tracking/${data.shipmentNumber}` : ''}

Thank you for choosing SolushipX!
        `
    },

    shipment_delayed: {
        subject: (data) => `Shipment Delayed # ${data.shipmentNumber}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">Shipment Delay Notice</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your shipment has encountered a delay</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Delay Information</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Shipment #:</strong></td><td style="padding: 8px 0;">${data.shipmentNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Original ETA:</strong></td><td style="padding: 8px 0;">${new Date(data.originalETA).toLocaleDateString()}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>New ETA:</strong></td><td style="padding: 8px 0;">${new Date(data.newETA).toLocaleDateString()}</td></tr>
                            ${data.reason ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Reason:</strong></td><td style="padding: 8px 0;">${data.reason}</td></tr>` : ''}
                        </table>
                    </div>

                    <div style="background: #f5f5f5; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">What's Next?</h3>
                        <p style="margin: 0; color: #000;">We're actively monitoring your shipment and will notify you of any further updates. Thank you for your patience.</p>
                    </div>

                    ${data.shipmentNumber ? `
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Track Your Shipment</h3>
                        <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #1c277d;">${data.shipmentNumber}</p>
                        <a href="https://solushipx.web.app/tracking/${data.shipmentNumber}" 
                           style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #000;">
                           Track Shipment
                        </a>
                    </div>
                    ` : ''}

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Questions? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
Shipment Delay Notice

Delay Information:
- Shipment #: ${data.shipmentNumber}
- Original ETA: ${new Date(data.originalETA).toLocaleDateString()}
- New ETA: ${new Date(data.newETA).toLocaleDateString()}
${data.reason ? `- Reason: ${data.reason}` : ''}

We're actively monitoring your shipment and will notify you of any further updates.

${data.shipmentNumber ? `Track your shipment: https://solushipx.web.app/tracking/${data.shipmentNumber}` : ''}

Questions? Contact support@integratedcarriers.com
        `
    },

    status_changed: {
        subject: (data) => `Status Update # ${data.shipmentNumber}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">Shipment Status Update</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your shipment status has been updated</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Status Update Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Status Update</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Shipment #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.shipmentNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Previous Status:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${data.previousStatus}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Current Status:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #1c277d; text-transform: capitalize;">${data.currentStatus}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Updated:</strong></td><td style="padding: 8px 0;">${new Date(data.updatedAt).toLocaleString()}</td></tr>
                        </table>
                    </div>

                    <!-- Carrier & Tracking Information -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Tracking Information</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${(data.carrier && data.carrier.name) || data.carrier || 'Unknown'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Service:</strong></td><td style="padding: 8px 0;">${(data.carrier && data.carrier.service) || 'Standard Service'}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.trackingNumber || 'N/A'}</td></tr>
                            ${data.estimatedDeliveryDate ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Est. Delivery:</strong></td><td style="padding: 8px 0;">${new Date(data.estimatedDeliveryDate).toLocaleDateString()}</td></tr>` : ''}
                            ${data.transitDays > 0 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Transit Time:</strong></td><td style="padding: 8px 0;">${data.transitDays} ${data.transitDays === 1 ? 'day' : 'days'}</td></tr>` : ''}
                        </table>
                    </div>

                    <!-- Route Information -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Route Information</h2>
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px; margin-right: 20px;">
                                <h4 style="color: #000; margin: 0 0 10px 0;">From:</h4>
                                <p style="margin: 0; line-height: 1.5;">
                                    ${data.origin && data.origin.company ? `<strong>${data.origin.company}</strong><br>` : ''}
                                    ${data.origin ? `${data.origin.city}, ${data.origin.state}<br>` : ''}
                                    ${data.origin && data.origin.country ? data.origin.country : ''}
                                </p>
                            </div>
                            <div style="flex: 1; min-width: 200px;">
                                <h4 style="color: #000; margin: 0 0 10px 0;">To:</h4>
                                <p style="margin: 0; line-height: 1.5;">
                                    ${data.destination && data.destination.company ? `<strong>${data.destination.company}</strong><br>` : ''}
                                    ${data.destination ? `${data.destination.city}, ${data.destination.state}<br>` : ''}
                                    ${data.destination && data.destination.country ? data.destination.country : ''}
                                </p>
                            </div>
                        </div>
                    </div>

                    ${data.description ? `
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">What This Means</h3>
                        <p style="margin: 0; color: #000;">${data.description}</p>
                    </div>
                    ` : ''}

                    <!-- Package Summary -->
                    ${data.totalPackages > 0 ? `
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Package Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Total Packages:</strong></td><td style="padding: 8px 0;">${data.totalPackages}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Total Weight:</strong></td><td style="padding: 8px 0;">${data.totalWeight} lbs</td></tr>
                            ${data.isInternational ? '<tr><td style="padding: 8px 0; color: #666;"><strong>International:</strong></td><td style="padding: 8px 0;">Yes</td></tr>' : ''}
                            ${data.isFreight ? '<tr><td style="padding: 8px 0; color: #666;"><strong>Freight:</strong></td><td style="padding: 8px 0;">Yes</td></tr>' : ''}
                        </table>
                    </div>
                    ` : ''}

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                            <h3 style="color: #1c277d; margin: 0 0 10px 0;">Track Your Shipment</h3>
                            <p style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #1c277d;">${data.shipmentNumber}</p>
                            <a href="https://solushipx.web.app/tracking/${data.shipmentNumber}" 
                               style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #000;">
                               Track Shipment
                            </a>
                        </div>
                        <p style="margin: 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                        <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">Questions? Contact us at support@integratedcarriers.com</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
Shipment Status Update

STATUS UPDATE
- Shipment #: ${data.shipmentNumber}
- Previous Status: ${data.previousStatus}
- Current Status: ${data.currentStatus}
- Updated: ${new Date(data.updatedAt).toLocaleString()}

TRACKING INFORMATION
- Carrier: ${(data.carrier && data.carrier.name) || data.carrier || 'Unknown'}
- Service: ${(data.carrier && data.carrier.service) || 'Standard Service'}
- Tracking #: ${data.trackingNumber || 'N/A'}
${data.estimatedDeliveryDate ? `- Est. Delivery: ${new Date(data.estimatedDeliveryDate).toLocaleDateString()}` : ''}
${data.transitDays > 0 ? `- Transit Time: ${data.transitDays} ${data.transitDays === 1 ? 'day' : 'days'}` : ''}

ROUTE INFORMATION
From: ${data.origin && data.origin.company ? `${data.origin.company}, ` : ''}${data.origin ? `${data.origin.city}, ${data.origin.state}` : ''}${data.origin && data.origin.country ? `, ${data.origin.country}` : ''}
To: ${data.destination && data.destination.company ? `${data.destination.company}, ` : ''}${data.destination ? `${data.destination.city}, ${data.destination.state}` : ''}${data.destination && data.destination.country ? `, ${data.destination.country}` : ''}

${data.totalPackages > 0 ? `PACKAGE SUMMARY
- Total Packages: ${data.totalPackages}
- Total Weight: ${data.totalWeight} lbs
${data.isInternational ? '- International: Yes' : ''}
${data.isFreight ? '- Freight: Yes' : ''}` : ''}

${data.description ? `What This Means: ${data.description}` : ''}

Track your shipment: https://solushipx.web.app/tracking/${data.shipmentNumber}

Questions? Contact support@integratedcarriers.com
        `
    },

    customer_note_added: {
        subject: (data) => `New Note Added - ${data.customerName}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">New Customer Note Added</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">A new note has been added to customer ${data.customerName}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Note Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Note Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Customer:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.customerName}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Customer ID:</strong></td><td style="padding: 8px 0;">${data.customerID}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Added By:</strong></td><td style="padding: 8px 0;">${data.createdByName}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td><td style="padding: 8px 0;">${new Date(data.createdAt).toLocaleDateString()} ${new Date(data.createdAt).toLocaleTimeString()}</td></tr>
                            ${data.type ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Note Type:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${data.type}</td></tr>` : ''}
                            ${data.priority ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Priority:</strong></td><td style="padding: 8px 0; text-transform: capitalize; color: ${data.priority === 'critical' || data.priority === 'urgent' ? '#dc2626' : data.priority === 'high' ? '#ea580c' : data.priority === 'medium' ? '#0891b2' : '#16a34a'}; font-weight: bold;">${data.priority}</td></tr>` : ''}
                            ${data.status ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Status:</strong></td><td style="padding: 8px 0; text-transform: capitalize;">${data.status}</td></tr>` : ''}
                        </table>
                    </div>

                    <!-- Note Content -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Note Content</h2>
                        <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #1c277d; font-size: 14px; line-height: 1.6;">
                            ${data.content.replace(/\n/g, '<br>')}
                        </div>
                    </div>

                    <!-- Attachments -->
                    ${(data.attachments && data.attachments.length > 0) ? `
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Attachments (${data.attachments.length})</h2>
                        ${data.attachments.map(attachment => {
                            if (attachment.type === 'link') {
                                return `
                                    <div style="border: 1px solid #e9ecef; padding: 12px; margin-bottom: 10px; border-radius: 4px; background: #f8f9fa;">
                                        <strong>🔗 Link:</strong> <a href="${attachment.url}" target="_blank" style="color: #1c277d; text-decoration: none;">${attachment.title || attachment.url}</a><br>
                                        <small style="color: #666;">URL: ${attachment.url}</small>
                                    </div>
                                `;
                            } else if (attachment.type === 'image') {
                                return `
                                    <div style="border: 1px solid #e9ecef; padding: 12px; margin-bottom: 10px; border-radius: 4px; background: #f8f9fa;">
                                        <strong>🖼️ Image:</strong> ${attachment.name}<br>
                                        <small style="color: #666;">Size: ${attachment.size ? (attachment.size / 1024 / 1024).toFixed(1) + 'MB' : 'Unknown'}</small><br>
                                        <small style="color: #999; font-style: italic;">View this attachment by opening the note in SolushipX</small>
                                    </div>
                                `;
                            } else {
                                return `
                                    <div style="border: 1px solid #e9ecef; padding: 12px; margin-bottom: 10px; border-radius: 4px; background: #f8f9fa;">
                                        <strong>📎 File:</strong> ${attachment.name}<br>
                                        <small style="color: #666;">Size: ${attachment.size ? (attachment.size / 1024 / 1024).toFixed(1) + 'MB' : 'Unknown'}</small><br>
                                        <small style="color: #999; font-style: italic;">Download this file by opening the note in SolushipX</small>
                                    </div>
                                `;
                            }
                        }).join('')}
                    </div>
                    ` : ''}

                    <!-- View Note Button -->
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">View Customer & Note</h3>
                        <p style="margin: 0 0 15px 0; color: #666;">Click below to view the full customer details and collaborate on this note</p>
                        <a href="${data.noteUrl}" 
                           style="background: #1c277d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; border: 2px solid #1c277d; font-weight: 600;">
                           📝 View Customer & Note
                        </a>
                        <br><br>
                        <p style="margin: 0; color: #666; font-size: 12px;">
                            Direct link: <a href="${data.noteUrl}" style="color: #1c277d; word-break: break-all;">${data.noteUrl}</a>
                        </p>
                    </div>

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
New Customer Note Added

SUMMARY
- Customer: ${data.customerName}
- Customer ID: ${data.customerID}  
- Added By: ${data.createdByName}
- Date: ${new Date(data.createdAt).toLocaleDateString()} ${new Date(data.createdAt).toLocaleTimeString()}
${data.type ? `- Note Type: ${data.type}` : ''}
${data.priority ? `- Priority: ${data.priority.toUpperCase()}` : ''}
${data.status ? `- Status: ${data.status}` : ''}

NOTE CONTENT
${data.content}

${(data.attachments && data.attachments.length > 0) ? `ATTACHMENTS (${data.attachments.length})
${data.attachments.map(attachment => {
    if (attachment.type === 'link') {
        return `🔗 Link: ${attachment.title || attachment.url}\n   URL: ${attachment.url}`;
    } else if (attachment.type === 'image') {
                                return `🖼️ Image: ${attachment.name}\n   Size: ${attachment.size ? (attachment.size / 1024 / 1024).toFixed(1) + 'MB' : 'Unknown'}\n   (View by opening the note in Integrated Carriers)`;
    } else {
                                return `📎 File: ${attachment.name}\n   Size: ${attachment.size ? (attachment.size / 1024 / 1024).toFixed(1) + 'MB' : 'Unknown'}\n   (Download by opening the note in Integrated Carriers)`;
    }
}).join('\n\n')}` : ''}

View customer details and collaborate: ${data.noteUrl}

Need help? Contact us at support@integratedcarriers.com
        `
    },

    quickship_customer_confirmation: {
        subject: (data) => `Shipment Confirmation: ${data.shipmentId}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">QuickShip Booking Confirmed!</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your shipment has been booked with ${data.carrier}</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Shipment Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipment Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Shipment ID:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.shipmentId}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${data.carrier}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Tracking #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.trackingNumber || data.shipmentId}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Ship Date:</strong></td><td style="padding: 8px 0;">${data.shipDate}</td></tr>
                            ${data.referenceNumber ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${data.referenceNumber}</td></tr>` : ''}
                        </table>
                    </div>

                    <!-- Addresses -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Shipping Addresses</h2>
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px; margin-right: 20px;">
                                <h4 style="color: #000; margin: 0 0 10px 0;">Ship From:</h4>
                                <p style="margin: 0; line-height: 1.5;">
                                    <strong>${data.shipFromCompany}</strong><br>
                                    ${data.shipFromAddress}
                                </p>
                            </div>
                            <div style="flex: 1; min-width: 200px;">
                                <h4 style="color: #000; margin: 0 0 10px 0;">Ship To:</h4>
                                <p style="margin: 0; line-height: 1.5;">
                                    <strong>${data.shipToCompany}</strong><br>
                                    ${data.shipToAddress}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Package Information -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Package Details</h2>
                        <p style="margin: 0 0 10px 0; color: #666;">
                            <strong>Total: ${data.totalPieces} piece${data.totalPieces > 1 ? 's' : ''}, ${data.totalWeight} lbs</strong>
                        </p>
                    </div>

                    <!-- Rate Breakdown -->
                    ${data.rateBreakdown && data.rateBreakdown.length > 0 ? `
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Rate Details</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            ${data.rateBreakdown.map(rate => `
                                <tr>
                                    <td style="padding: 8px 0; color: #666;">${rate.description}:</td>
                                    <td style="padding: 8px 0; text-align: right;">${rate.currency} $${rate.amount}</td>
                                </tr>
                            `).join('')}
                            <tr style="border-top: 2px solid #1c277d;">
                                <td style="padding: 12px 0 8px 0; color: #1c277d; font-weight: bold;">Total:</td>
                                <td style="padding: 12px 0 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #1c277d;">${data.currency} $${data.totalCharges}</td>
                            </tr>
                        </table>
                    </div>
                    ` : ''}

                    <!-- Important Notice -->
                    <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 0; margin-bottom: 20px;">
                        <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">Important Information</h3>
                        <p style="margin: 0; color: #92400e; font-size: 14px;">
                            This is a QuickShip manual booking. Please ensure all packages are properly labeled and ready for pickup.
                            Bill of Lading (BOL) and Carrier Confirmation documents are attached to this email.
                        </p>
                    </div>

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Questions? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
QuickShip Booking Confirmed!

SHIPMENT SUMMARY
- Shipment ID: ${data.shipmentId}
- Carrier: ${data.carrier}
- Tracking #: ${data.trackingNumber || data.shipmentId}
- Ship Date: ${data.shipDate}
${data.referenceNumber ? `- Reference #: ${data.referenceNumber}` : ''}

SHIPPING ADDRESSES
Ship From:
${data.shipFromCompany}
${data.shipFromAddress}

Ship To:
${data.shipToCompany}
${data.shipToAddress}

PACKAGE DETAILS
Total: ${data.totalPieces} piece${data.totalPieces > 1 ? 's' : ''}, ${data.totalWeight} lbs

${data.rateBreakdown && data.rateBreakdown.length > 0 ? `RATE DETAILS
${data.rateBreakdown.map(rate => `${rate.description}: ${rate.currency} $${rate.amount}`).join('\n')}
Total: ${data.currency} $${data.totalCharges}` : ''}

IMPORTANT INFORMATION
This is a QuickShip manual booking. Please ensure all packages are properly labeled and ready for pickup.
Bill of Lading (BOL) and Carrier Confirmation documents are attached to this email.

Questions? Contact support@integratedcarriers.com
        `
    },

    quickship_carrier_notification: {
        subject: (data) => `Carrier Confirmation - Order ${data.orderNumber}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">New Carrier Confirmation</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Order ${data.orderNumber} is ready for pickup</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Carrier Information -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Carrier Information</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Carrier:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.carrierName}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Contact:</strong></td><td style="padding: 8px 0;">${data.contactName}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Order #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.orderNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Confirmation #:</strong></td><td style="padding: 8px 0;">${data.confirmationNumber}</td></tr>
                        </table>
                    </div>

                    <!-- Pickup Information -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1976d2; margin: 0 0 15px 0; font-size: 18px;">Pickup Details</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Company:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.pickupCompany}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Contact:</strong></td><td style="padding: 8px 0;">${data.pickupContact}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Phone:</strong></td><td style="padding: 8px 0;">${data.pickupPhone}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Date:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.pickupDate}</td></tr>
                        </table>
                        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-left: 4px solid #1976d2;">
                            <strong>Address:</strong><br>
                            ${data.pickupAddress}
                        </div>
                    </div>

                    <!-- Delivery Information -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1976d2; margin: 0 0 15px 0; font-size: 18px;">Delivery Details</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Company:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.deliveryCompany}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Contact:</strong></td><td style="padding: 8px 0;">${data.deliveryContact}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Phone:</strong></td><td style="padding: 8px 0;">${data.deliveryPhone}</td></tr>
                        </table>
                        <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-left: 4px solid #1976d2;">
                            <strong>Address:</strong><br>
                            ${data.deliveryAddress}
                        </div>
                    </div>

                    <!-- Shipment Details -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1976d2; margin: 0 0 15px 0; font-size: 18px;">Shipment Details</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Total Pieces:</strong></td><td style="padding: 8px 0;">${data.totalPieces} pieces</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Total Weight:</strong></td><td style="padding: 8px 0;">${data.totalWeight} lbs</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Reference #:</strong></td><td style="padding: 8px 0;">${data.referenceNumber || 'N/A'}</td></tr>
                            ${data.totalCharges ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Total Value:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #1976d2;">${data.currency} $${data.totalCharges}</td></tr>` : ''}
                        </table>
                    </div>

                    <!-- Package Details -->
                    ${(data.packages && data.packages.length > 0) ? `
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1976d2; margin: 0 0 15px 0; font-size: 18px;">Package Details</h2>
                        ${data.packages.map((pkg, index) => `
                            <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
                                <strong>Package ${index + 1}:</strong> ${pkg.description} ${pkg.packagingType ? `(${pkg.packagingType})` : ''}<br>
                                <span style="color: #666;">Pieces: ${pkg.pieces}, Weight: ${pkg.weight} lbs, Dimensions: ${pkg.dimensions}</span>
                            </div>
                        `).join('')}
                    </div>
                    ` : ''}

                    <!-- Special Instructions -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1976d2; margin: 0 0 15px 0; font-size: 18px;">Special Instructions</h2>
                        <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #1976d2;">
                            ${data.specialInstructions}
                        </div>
                    </div>

                    <!-- QuickShip Notice -->
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 0; border-left: 4px solid #1976d2; margin-bottom: 20px;">
                        <h3 style="color: #1976d2; margin: 0 0 10px 0;">QuickShip Information</h3>
                        <p style="margin: 0; color: #1565c0;">This is a QuickShip manual booking with pre-negotiated rates. All pricing has been confirmed. Carrier confirmation document is attached to this email.</p>
                    </div>

                    <!-- Action Required -->
                    <div style="background: #fff3cd; padding: 20px; border-radius: 0; border-left: 4px solid #ffc107; margin-bottom: 20px;">
                        <h3 style="color: #856404; margin: 0 0 10px 0;">Action Required</h3>
                        <p style="margin: 0; color: #856404;">Please confirm receipt of this pickup assignment and provide expected pickup time within 2 hours.</p>
                    </div>

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Questions about this pickup? Reply to this email or contact Integrated Carriers</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
Carrier Confirmation - Order ${data.orderNumber}

CARRIER ASSIGNMENT
- Carrier: ${data.carrierName}
- Contact: ${data.contactName}
- Order #: ${data.orderNumber}
- Confirmation #: ${data.confirmationNumber}
- Service Type: ${data.serviceType || 'QuickShip Manual Entry'}

PICKUP DETAILS
- Company: ${data.pickupCompany}
- Contact: ${data.pickupContact}
- Phone: ${data.pickupPhone}
- Date: ${data.pickupDate}
- Address: ${data.pickupAddress}

DELIVERY DETAILS
- Company: ${data.deliveryCompany}
- Contact: ${data.deliveryContact}
- Phone: ${data.deliveryPhone}
- Address: ${data.deliveryAddress}

SHIPMENT DETAILS
- Total Pieces: ${data.totalPieces} pieces
- Total Weight: ${data.totalWeight} lbs
- Reference #: ${data.referenceNumber || 'N/A'}
${data.totalCharges ? `- Total Value: ${data.currency} $${data.totalCharges}` : ''}

${(data.packages && data.packages.length > 0) ? `PACKAGE DETAILS
${data.packages.map((pkg, index) => `Package ${index + 1}: ${pkg.description} ${pkg.packagingType ? `(${pkg.packagingType})` : ''}\nPieces: ${pkg.pieces}, Weight: ${pkg.weight} lbs, Dimensions: ${pkg.dimensions}`).join('\n\n')}` : ''}

SPECIAL INSTRUCTIONS
${data.specialInstructions}

QUICKSHIP INFORMATION
This is a QuickShip manual booking with pre-negotiated rates. All pricing has been confirmed. Carrier confirmation document is attached to this email.

ACTION REQUIRED: Please confirm receipt of this pickup assignment and provide expected pickup time within 2 hours.

                Questions? Reply to this email or contact Integrated Carriers.
        `
    },

    invoice_generated: {
        subject: (data) => `Invoice ${data.invoiceNumber} from Integrated Carriers`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">New Invoice Available</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your monthly shipping charges invoice is ready</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Invoice Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Invoice Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Invoice #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.invoiceNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Company:</strong></td><td style="padding: 8px 0;">${data.companyName}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Due Date:</strong></td><td style="padding: 8px 0;">${data.dueDate}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Payment Terms:</strong></td><td style="padding: 8px 0;">${data.paymentTerms}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Shipments:</strong></td><td style="padding: 8px 0;">${data.shipmentCount}</td></tr>
                        </table>
                    </div>

                    <!-- Amount Due -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Amount Due</h3>
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1c277d;">${data.currency} $${data.totalAmount}</p>
                    </div>

                    <!-- Payment Instructions -->
                    <div style="background: #e8f4fd; padding: 20px; border-radius: 0; border-left: 4px solid #1c277d; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Payment Instructions</h3>
                        <p style="margin: 0; color: #000;">Please remit payment within the specified terms. The detailed invoice is attached as a PDF. For questions, contact our billing department.</p>
                    </div>

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Questions? Contact us at <a href="mailto:billing@integratedcarriers.com" style="color: #1c277d;">billing@integratedcarriers.com</a></p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 Integrated Carriers. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
New Invoice Available

INVOICE SUMMARY
- Invoice #: ${data.invoiceNumber}
- Company: ${data.companyName}
- Due Date: ${data.dueDate}
- Payment Terms: ${data.paymentTerms}
- Shipments: ${data.shipmentCount}

AMOUNT DUE: ${data.currency} $${data.totalAmount}

PAYMENT INSTRUCTIONS
Please remit payment within the specified terms. The detailed invoice is attached as a PDF. For questions, contact our billing department.

Questions? Contact billing@integratedcarriers.com
© 2024 Integrated Carriers. All rights reserved.
        `
    },

    invoice_generated: {
        subject: (data) => `Invoice ${data.invoiceNumber} from Integrated Carriers`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">New Invoice Available</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Your monthly shipping charges invoice is ready</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Invoice Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Invoice Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Invoice #:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.invoiceNumber}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Company:</strong></td><td style="padding: 8px 0;">${data.companyName}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Due Date:</strong></td><td style="padding: 8px 0;">${data.dueDate}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Payment Terms:</strong></td><td style="padding: 8px 0;">${data.paymentTerms}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Shipments:</strong></td><td style="padding: 8px 0;">${data.shipmentCount}</td></tr>
                        </table>
                    </div>

                    <!-- Amount Due -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Amount Due</h3>
                        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1c277d;">${data.currency} $${data.totalAmount}</p>
                    </div>

                    <!-- Payment Instructions -->
                    <div style="background: #e8f4fd; padding: 20px; border-radius: 0; border-left: 4px solid #1c277d; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Payment Instructions</h3>
                        <p style="margin: 0; color: #000;">Please remit payment within the specified terms. The detailed invoice is attached as a PDF. For questions, contact our billing department.</p>
                    </div>

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Questions? Contact us at <a href="mailto:billing@integratedcarriers.com" style="color: #1c277d;">billing@integratedcarriers.com</a></p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 Integrated Carriers. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
New Invoice Available

INVOICE SUMMARY
- Invoice #: ${data.invoiceNumber}
- Company: ${data.companyName}
- Due Date: ${data.dueDate}
- Payment Terms: ${data.paymentTerms}
- Shipments: ${data.shipmentCount}

AMOUNT DUE: ${data.currency} $${data.totalAmount}

PAYMENT INSTRUCTIONS
Please remit payment within the specified terms. The detailed invoice is attached as a PDF. For questions, contact our billing department.

Questions? Contact billing@integratedcarriers.com
© 2024 Integrated Carriers. All rights reserved.
        `
    },

    quickship_internal_notification: {
        subject: (data) => `QuickShip Booked - ${data.shipmentId}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                    <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                    <h1 style="margin: 0; font-size: 24px;">QuickShip Booking Alert</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">A new QuickShip order has been booked</p>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                    <!-- Booking Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Booking Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Shipment ID:</strong></td><td style="padding: 8px 0; font-weight: bold;">${data.shipmentId}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Carrier:</strong></td><td style="padding: 8px 0;">${data.carrier}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Booked By:</strong></td><td style="padding: 8px 0;">${data.bookedBy}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Total Charges:</strong></td><td style="padding: 8px 0; font-weight: bold; color: #1c277d;">${data.currency} $${data.totalCharges}</td></tr>
                        </table>
                    </div>

                    <!-- Route Information -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Route Information</h2>
                        <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px; margin-right: 20px;">
                                <h4 style="color: #000; margin: 0 0 10px 0;">From:</h4>
                                <p style="margin: 0; line-height: 1.5;">
                                    <strong>${data.shipFromCompany}</strong><br>
                                    ${data.shipFromAddress}
                                </p>
                            </div>
                            <div style="flex: 1; min-width: 200px;">
                                <h4 style="color: #000; margin: 0 0 10px 0;">To:</h4>
                                <p style="margin: 0; line-height: 1.5;">
                                    <strong>${data.shipToCompany}</strong><br>
                                    ${data.shipToAddress}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Package Summary -->
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Package Summary</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Total Pieces:</strong></td><td style="padding: 8px 0;">${data.totalPieces}</td></tr>
                            <tr><td style="padding: 8px 0; color: #666;"><strong>Total Weight:</strong></td><td style="padding: 8px 0;">${data.totalWeight} lbs</td></tr>
                        </table>
                    </div>

                    <!-- Financial Breakdown -->
                    ${(data.rateBreakdown && data.rateBreakdown.length > 0) ? `
                    <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Financial Breakdown</h2>
                        ${data.rateBreakdown.map(rate => `
                            <div style="border-bottom: 1px solid #eee; padding: 8px 0; display: flex; justify-content: space-between;">
                                <span>${rate.description}</span>
                                <div style="text-align: right;">
                                    <span style="color: #28a745; margin-right: 10px;">Cost: ${rate.currency} $${rate.cost}</span>
                                    <span style="color: #1c277d; font-weight: bold;">Charge: ${rate.currency} $${rate.charge}</span>
                                </div>
                            </div>
                        `).join('')}
                        <div style="border-top: 2px solid #1c277d; padding: 12px 0; display: flex; justify-content: space-between; font-weight: bold;">
                            <span>Total Revenue:</span>
                            <span style="color: #1c277d; font-size: 18px;">${data.currency} $${data.totalCharges}</span>
                        </div>
                    </div>
                    ` : ''}

                    <div style="background: #e8f4fd; padding: 20px; border-radius: 0; border-left: 4px solid #1c277d; margin-bottom: 20px;">
                        <h3 style="color: #1c277d; margin: 0 0 10px 0;">Internal Note</h3>
                        <p style="margin: 0; color: #000;">This is an automatically generated internal notification for QuickShip booking. Please follow up with carrier coordination and customer service as needed.</p>
                    </div>

                    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                        <p style="margin: 0;">Internal SolushipX Notification</p>
                        <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                    </div>
                </div>
            </div>
        `,
        text: (data) => `
QuickShip Booking Alert

BOOKING SUMMARY
- Shipment ID: ${data.shipmentId}
- Carrier: ${data.carrier}
- Booked By: ${data.bookedBy}
- Total Charges: ${data.currency} $${data.totalCharges}

ROUTE INFORMATION
From: ${data.shipFromCompany}
${data.shipFromAddress}

To: ${data.shipToCompany}
${data.shipToAddress}

PACKAGE SUMMARY
- Total Pieces: ${data.totalPieces}
- Total Weight: ${data.totalWeight} lbs

${(data.rateBreakdown && data.rateBreakdown.length > 0) ? `FINANCIAL BREAKDOWN
${data.rateBreakdown.map(rate => `${rate.description}: Cost ${rate.currency} $${rate.cost} | Charge ${rate.currency} $${rate.charge}`).join('\n')}
Total Revenue: ${data.currency} $${data.totalCharges}` : ''}

Internal Note: This is an automatically generated internal notification for QuickShip booking. Please follow up with carrier coordination and customer service as needed.
        `
    }
};

/**
 * Main function to send notification emails using the new subscription system
 */
async function sendNotificationEmail(type, companyId, data, notificationId = null) {
    try {
        logger.info(`Sending ${type} notification for company ${companyId}`, { notificationId, type });

        if (!sendgridApiKey) {
            throw new Error('SendGrid API key not configured');
        }

        if (!EMAIL_TEMPLATES[type]) {
            throw new Error(`Unknown email template type: ${type}`);
        }

        // Get notification subscribers for this company and notification type
        const subscriberEmails = await getCompanyNotificationSubscribersV2(companyId, type);
        
        if (subscriberEmails.length === 0) {
            logger.info(`No subscribers found for ${type} notification`, { 
                companyId,
                notificationType: type
            });
            return { success: true, count: 0 };
        }

        const template = EMAIL_TEMPLATES[type];
        const subject = template.subject(data);
        const html = template.html(data);
        const text = template.text(data);

        // Create individual messages for each subscriber (no BCC)
        const messages = subscriberEmails.map(email => ({
            to: email,
            from: {
                email: 'support@integratedcarriers.com',
                name: 'Integrated Carriers Notifications'
            },
            replyTo: {
                email: 'support@integratedcarriers.com',
                name: 'Tyler from Integrated Carriers'
            },
            subject,
            html,
            text,
            customArgs: {
                notification_id: notificationId || `${type}_${Date.now()}`,
                notification_type: type,
                shipment_number: data.shipmentNumber,
                company_id: companyId,
                recipient_email: email
            },
            trackingSettings: {
                clickTracking: { enable: true },
                openTracking: { enable: true }
            }
        }));

        // Send individual emails
        await sgMail.send(messages);

        // Log successful sends
        for (const email of subscriberEmails) {
            await logNotification({
                email: email,
                companyId: companyId,
                type,
                notificationId: notificationId || `${type}_${Date.now()}`,
                status: 'sent',
                sentAt: new Date(),
                data: {
                    shipmentNumber: data.shipmentNumber,
                    subject
                }
            });
        }

        logger.info(`Successfully sent ${type} notifications`, { 
            count: subscriberEmails.length, 
            notificationId,
            shipmentNumber: data.shipmentNumber,
            companyId
        });

        return { success: true, count: subscriberEmails.length };

    } catch (error) {
        logger.error(`Failed to send ${type} notification`, {
            error: error.message,
            notificationId,
            companyId
        });
        
        // Log the full SendGrid error response
        if (error.response) {
            logger.error('SendGrid error details:', {
                statusCode: error.code,
                body: error.response.body,
                errors: error.response.body?.errors
            });
            
            // Log the specific error messages
            if (error.response.body?.errors && Array.isArray(error.response.body.errors)) {
                error.response.body.errors.forEach((err, index) => {
                    logger.error(`SendGrid error ${index + 1}:`, {
                        message: err.message,
                        field: err.field,
                        help: err.help
                    });
                });
            }
        }

        // Log failed attempts for available emails
        const subscriberEmails = await getCompanyNotificationSubscribers(companyId, type).catch(() => []);
        for (const email of subscriberEmails) {
            await logNotification({
                email: email,
                companyId: companyId,
                type,
                notificationId: notificationId || `${type}_${Date.now()}`,
                status: 'failed',
                error: error.message,
                sentAt: new Date(),
                data: {
                    shipmentNumber: data.shipmentNumber
                }
            });
        }

        throw error;
    }
}

/**
 * Get notification subscribers for a company and notification type using separate collection
 */
async function getCompanyNotificationSubscribersV2(companyId, notificationType) {
    try {
        logger.info(`Getting notification subscribers for company ${companyId}, type: ${notificationType}`);

        if (!companyId) {
            logger.warn(`Cannot get subscribers: companyId is ${companyId}`);
            return [];
        }

        // Query the notificationSubscriptions collection
        const subscriptionsSnapshot = await db.collection('notificationSubscriptions')
            .where('companyId', '==', companyId)
            .where('notificationType', '==', notificationType)
            .where('subscribed', '==', true)
            .get();

        const subscriberEmails = [];
        subscriptionsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.userEmail) {
                subscriberEmails.push(data.userEmail);
            }
        });

        logger.info(`Found ${subscriberEmails.length} subscribers for ${notificationType}`, {
            companyId,
            notificationType,
            subscriberEmails
        });

        return subscriberEmails;

    } catch (error) {
        logger.error(`Failed to get notification subscribers for company ${companyId}`, { 
            error: error.message, 
            notificationType 
        });
        return [];
    }
}

/**
 * Update user's notification subscriptions using separate collection
 */
async function updateUserNotificationSubscriptionsV2(userId, companyId, notificationPreferences) {
    try {
        logger.info(`Updating notification subscriptions for user ${userId} in company ${companyId}`, {
            preferences: notificationPreferences
        });

        // Get user email
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error(`User ${userId} not found`);
        }
        
        const userData = userDoc.data();
        const userEmail = userData.email;

        if (!userEmail) {
            throw new Error(`User ${userId} has no email address`);
        }

        // Define notification types
        const notificationTypes = [
            'shipment_created',
            'shipment_delivered', 
            'shipment_delayed',
            'status_changed',
            'customer_note_added'
        ];

        const batch = db.batch();
        const timestamp = new Date();

        // Process each notification type
        for (const notificationType of notificationTypes) {
            // Create subscription document ID for this user/company/type combination
            const subscriptionId = `${userId}_${companyId}_${notificationType}`;
            const subscriptionRef = db.collection('notificationSubscriptions').doc(subscriptionId);

            // Determine if user should be subscribed to this type
            let shouldSubscribe = false;
            if (notificationPreferences.hawkeye_mode) {
                shouldSubscribe = true; // Hawkeye mode subscribes to everything
            } else {
                shouldSubscribe = notificationPreferences[notificationType] === true;
            }

            // Create or update the subscription document
            const subscriptionData = {
                userId: userId,
                userEmail: userEmail,
                companyId: companyId,
                notificationType: notificationType,
                subscribed: shouldSubscribe,
                updatedAt: timestamp
            };

            // Add subscribedAt timestamp only if this is a new subscription
            const existingDoc = await subscriptionRef.get();
            if (!existingDoc.exists && shouldSubscribe) {
                subscriptionData.subscribedAt = timestamp;
            }

            batch.set(subscriptionRef, subscriptionData, { merge: true });
        }

        // Commit all changes
        await batch.commit();

        // Get the updated subscription status to return
        const updatedSubscriptions = await getUserCompanyNotificationStatusV2(userId, companyId);

        logger.info(`Successfully updated notification subscriptions for user ${userId}`, {
            companyId,
            userEmail,
            preferences: notificationPreferences,
            result: updatedSubscriptions
        });

        return { success: true, subscriptions: updatedSubscriptions };

    } catch (error) {
        logger.error(`Failed to update notification subscriptions for user ${userId}`, {
            error: error.message,
            companyId
        });
        throw error;
    }
}

/**
 * Get user's notification subscription status for a company using separate collection
 */
async function getUserCompanyNotificationStatusV2(userId, companyId) {
    try {
        logger.info(`Getting notification status for user ${userId} in company ${companyId}`);

        if (!userId || !companyId) {
            throw new Error('Missing userId or companyId');
        }

        // Query all subscriptions for this user/company combination
        const subscriptionsSnapshot = await db.collection('notificationSubscriptions')
            .where('userId', '==', userId)
            .where('companyId', '==', companyId)
            .get();

        // Build preferences object
        const preferences = {
            shipment_created: false,
            shipment_delivered: false,
            shipment_delayed: false,
            status_changed: false,
            customer_note_added: false,
            hawkeye_mode: false
        };

        let allSubscribed = true;
        subscriptionsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.notificationType && preferences.hasOwnProperty(data.notificationType)) {
                preferences[data.notificationType] = data.subscribed === true;
                if (!data.subscribed) {
                    allSubscribed = false;
                }
            }
        });

        // Check if this is hawkeye mode (all notifications enabled)
        const notificationTypes = ['shipment_created', 'shipment_delivered', 'shipment_delayed', 'status_changed', 'customer_note_added'];
        const allTypesEnabled = notificationTypes.every(type => preferences[type] === true);
        preferences.hawkeye_mode = allTypesEnabled;

        logger.info(`Retrieved notification status for user ${userId}`, {
            companyId,
            preferences
        });

        return preferences;

    } catch (error) {
        logger.error(`Failed to get notification status for user ${userId}`, {
            error: error.message,
            companyId
        });
        throw error;
    }
}

/**
 * Migration function to move data from company records to separate collection
 */
async function migrateNotificationSubscriptionsToCollection(companyId) {
    try {
        logger.info(`Starting migration of notification subscriptions for company ${companyId}`);

        // Get company document
        let companyDoc = null;
        let companySnapshot = await db.collection('companies').where('companyID', '==', companyId).get();
        
        if (!companySnapshot.empty) {
            companyDoc = companySnapshot.docs[0];
        } else {
            const directDoc = await db.collection('companies').doc(companyId).get();
            if (directDoc.exists) {
                companyDoc = directDoc;
            }
        }
        
        if (!companyDoc) {
            throw new Error(`Company with ID ${companyId} not found`);
        }

        const companyData = companyDoc.data();
        const notificationSubscriptions = companyData.notificationSubscriptions || {};

        if (Object.keys(notificationSubscriptions).length === 0) {
            logger.info(`No existing subscriptions found for company ${companyId}`);
            return { success: true, migratedCount: 0 };
        }

        const batch = db.batch();
        let migratedCount = 0;
        const timestamp = new Date();

        // Process each notification type
        for (const [notificationType, subscriberEmails] of Object.entries(notificationSubscriptions)) {
            if (Array.isArray(subscriberEmails)) {
                for (const email of subscriberEmails) {
                    // Try to find the user by email
                    const userSnapshot = await db.collection('users').where('email', '==', email).get();
                    
                    if (!userSnapshot.empty) {
                        const userDoc = userSnapshot.docs[0];
                        const userId = userDoc.id;
                        
                        // Create subscription document
                        const subscriptionId = `${userId}_${companyId}_${notificationType}`;
                        const subscriptionRef = db.collection('notificationSubscriptions').doc(subscriptionId);
                        
                        const subscriptionData = {
                            userId: userId,
                            userEmail: email,
                            companyId: companyId,
                            notificationType: notificationType,
                            subscribed: true,
                            subscribedAt: timestamp,
                            updatedAt: timestamp,
                            migratedFrom: 'company_record'
                        };

                        batch.set(subscriptionRef, subscriptionData);
                        migratedCount++;
                    } else {
                        logger.warn(`User with email ${email} not found, skipping migration for this subscription`);
                    }
                }
            }
        }

        // Commit the migration
        if (migratedCount > 0) {
            await batch.commit();
        }

        logger.info(`Successfully migrated ${migratedCount} notification subscriptions for company ${companyId}`);

        return { success: true, migratedCount };

    } catch (error) {
        logger.error(`Failed to migrate notification subscriptions for company ${companyId}`, {
            error: error.message
        });
        throw error;
    }
}

/**
 * Log notification attempts for analytics and debugging
 */
async function logNotification(notificationData) {
    try {
        await db.collection('notificationLogs').add({
            ...notificationData,
            createdAt: new Date()
        });
    } catch (error) {
        logger.error('Failed to log notification', { error: error.message, notificationData });
    }
}

/**
 * Default notification preferences
 */
function getDefaultPreferences() {
    return {
        shipment_created: true,
        shipment_delivered: true,
        shipment_delayed: true,
        status_changed: true,
        customer_note_added: true,
        hawkeye_mode: false
    };
}

/**
 * Get notification subscribers for a company and notification type using company record (legacy)
 */
async function getCompanyNotificationSubscribers(companyId, notificationType) {
    try {
        logger.info(`Getting notification subscribers for company ${companyId}, type: ${notificationType} (legacy method)`);

        if (!companyId) {
            logger.warn(`Cannot get subscribers: companyId is ${companyId}`);
            return [];
        }

        // Try to get company document - first by companyID field, then by document ID
        let companyDoc = null;
        let companySnapshot = await db.collection('companies').where('companyID', '==', companyId).get();
        
        if (!companySnapshot.empty) {
            companyDoc = companySnapshot.docs[0];
        } else {
            // Fallback: try as document ID
            const directDoc = await db.collection('companies').doc(companyId).get();
            if (directDoc.exists) {
                companyDoc = directDoc;
            }
        }
        
        if (!companyDoc) {
            logger.warn(`Company with companyID or document ID ${companyId} not found`);
            return [];
        }
        const companyData = companyDoc.data();
        const notificationSubscriptions = companyData.notificationSubscriptions || {};
        
        // Get subscribers for this specific notification type
        const subscriberEmails = notificationSubscriptions[notificationType] || [];
        
        logger.info(`Found ${subscriberEmails.length} subscribers for ${notificationType}`, {
            companyId,
            notificationType,
            subscriberEmails
        });

        return subscriberEmails;

    } catch (error) {
        logger.error(`Failed to get notification subscribers for company ${companyId}`, { 
            error: error.message, 
            notificationType 
        });
        return [];
    }
}

/**
 * Update user's notification subscriptions in company record (legacy)
 */
async function updateUserNotificationSubscriptions(userId, companyId, notificationPreferences) {
    try {
        logger.info(`Updating notification subscriptions for user ${userId} in company ${companyId} (legacy method)`, {
            preferences: notificationPreferences
        });

        // Get user email
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error(`User ${userId} not found`);
        }
        
        const userData = userDoc.data();
        const userEmail = userData.email;

        if (!userEmail) {
            throw new Error(`User ${userId} has no email address`);
        }

        // Try to get company document - first by companyID field, then by document ID
        let companyDoc = null;
        let companySnapshot = await db.collection('companies').where('companyID', '==', companyId).get();
        
        if (!companySnapshot.empty) {
            companyDoc = companySnapshot.docs[0];
            logger.info(`Found company by companyID field: ${companyId}`);
        } else {
            // Fallback: try as document ID
            const directDoc = await db.collection('companies').doc(companyId).get();
            if (directDoc.exists) {
                companyDoc = directDoc;
                logger.info(`Found company by document ID: ${companyId}`);
            }
        }
        
        if (!companyDoc) {
            throw new Error(`Company with companyID or document ID ${companyId} not found`);
        }
        const companyData = companyDoc.data();
        const currentSubscriptions = companyData.notificationSubscriptions || {};

        // Define notification types
        const notificationTypes = [
            'shipment_created',
            'shipment_delivered', 
            'shipment_delayed',
            'status_changed'
        ];

        // Build new subscription structure
        const newSubscriptions = { ...currentSubscriptions };

        // Remove user email from all notification types first
        for (const notificationType of notificationTypes) {
            if (!newSubscriptions[notificationType]) {
                newSubscriptions[notificationType] = [];
            }
            // Remove user email if it exists
            newSubscriptions[notificationType] = newSubscriptions[notificationType].filter(
                email => email !== userEmail
            );
        }

        // Add user email to notification types they're subscribed to
        if (notificationPreferences.hawkeye_mode) {
            // Hawkeye mode: add to all notification types
            for (const notificationType of notificationTypes) {
                if (!newSubscriptions[notificationType].includes(userEmail)) {
                    newSubscriptions[notificationType].push(userEmail);
                }
            }
        } else {
            // Individual subscriptions: add only to selected types
            for (const notificationType of notificationTypes) {
                if (notificationPreferences[notificationType] === true) {
                    if (!newSubscriptions[notificationType].includes(userEmail)) {
                        newSubscriptions[notificationType].push(userEmail);
                    }
                }
            }
        }

        // Update company document with new subscription structure
        await companyDoc.ref.update({
            notificationSubscriptions: newSubscriptions,
            updatedAt: new Date()
        });

        logger.info(`Successfully updated notification subscriptions for user ${userId}`, {
            companyId,
            userEmail,
            newSubscriptions
        });

        return { success: true, subscriptions: newSubscriptions };

    } catch (error) {
        logger.error(`Failed to update notification subscriptions for user ${userId}`, {
            error: error.message,
            companyId,
            notificationPreferences
        });
        throw error;
    }
}

/**
 * Get current notification subscriptions for a user in a company (legacy)
 */
async function getUserCompanyNotificationStatus(userId, companyId) {
    try {
        // Get user email
        const userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error(`User ${userId} not found`);
        }
        
        const userData = userDoc.data();
        const userEmail = userData.email;

        // Try to get company document - first by companyID field, then by document ID
        let companyDoc = null;
        let companySnapshot = await db.collection('companies').where('companyID', '==', companyId).get();
        
        if (!companySnapshot.empty) {
            companyDoc = companySnapshot.docs[0];
        } else {
            // Fallback: try as document ID
            const directDoc = await db.collection('companies').doc(companyId).get();
            if (directDoc.exists) {
                companyDoc = directDoc;
            }
        }
        
        if (!companyDoc) {
            throw new Error(`Company with companyID or document ID ${companyId} not found`);
        }
        const companyData = companyDoc.data();
        const notificationSubscriptions = companyData.notificationSubscriptions || {};

        // Check which notification types the user is subscribed to
        const userSubscriptions = {
            shipment_created: notificationSubscriptions.shipment_created?.includes(userEmail) || false,
            shipment_delivered: notificationSubscriptions.shipment_delivered?.includes(userEmail) || false,
            shipment_delayed: notificationSubscriptions.shipment_delayed?.includes(userEmail) || false,
            status_changed: notificationSubscriptions.status_changed?.includes(userEmail) || false
        };

        // Check if hawkeye mode (subscribed to all)
        const allNotificationTypes = ['shipment_created', 'shipment_delivered', 'shipment_delayed', 'status_changed'];
        const hawkeye_mode = allNotificationTypes.every(type => userSubscriptions[type]);

        return {
            ...userSubscriptions,
            hawkeye_mode
        };

    } catch (error) {
        logger.error(`Failed to get user notification status`, {
            error: error.message,
            userId,
            companyId
        });
        return getDefaultPreferences();
    }
}

const getEmailTemplate = (templateType, data = {}) => {
    const templates = {
        report_generated: {
            subject: `✅ Report Generated Successfully - ${data.reportType || 'Report'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Report Generated Successfully</h1>
                            <p style="color: #64748b; margin: 10px 0 0 0;">Your ${data.reportType || 'report'} is ready for download</p>
                        </div>
                        
                        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">Report Details</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr><td style="padding: 5px 0; color: #64748b;">Report Type:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.reportType || 'N/A'}</td></tr>
                                <tr><td style="padding: 5px 0; color: #64748b;">Generated:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'Just now'}</td></tr>
                                <tr><td style="padding: 5px 0; color: #64748b;">Format:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.format || 'PDF'}</td></tr>
                                ${data.recordCount ? `<tr><td style="padding: 5px 0; color: #64748b;">Records:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.recordCount}</td></tr>` : ''}
                            </table>
                        </div>
                        
                        ${data.downloadUrl ? `
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${data.downloadUrl}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                                    📥 Download Report
                                </a>
                            </div>
                        ` : ''}
                        
                        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center;">
                            <p style="color: #64748b; font-size: 12px; margin: 0;">
                                This is an automated notification from SolushipX Reports
                            </p>
                        </div>
                    </div>
                </div>
            `
        },
        
        report_failed: {
            subject: `❌ Report Generation Failed - ${data.reportType || 'Report'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #dc2626; margin: 0; font-size: 24px;">Report Generation Failed</h1>
                            <p style="color: #64748b; margin: 10px 0 0 0;">There was an issue generating your ${data.reportType || 'report'}</p>
                        </div>
                        
                        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                            <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 16px;">Error Details</h3>
                            <p style="color: #991b1b; margin: 0; font-size: 14px;">${data.errorMessage || 'An unexpected error occurred during report generation.'}</p>
                        </div>
                        
                        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">Report Details</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr><td style="padding: 5px 0; color: #64748b;">Report Type:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.reportType || 'N/A'}</td></tr>
                                <tr><td style="padding: 5px 0; color: #64748b;">Attempted:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.attemptedAt ? new Date(data.attemptedAt).toLocaleString() : 'Just now'}</td></tr>
                                <tr><td style="padding: 5px 0; color: #64748b;">Format:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.format || 'PDF'}</td></tr>
                            </table>
                        </div>
                        
                        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                            <h3 style="color: #1d4ed8; margin: 0 0 10px 0; font-size: 16px;">Next Steps</h3>
                            <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
                                <li>Check your report configuration for any missing data</li>
                                <li>Verify that your date ranges and filters are valid</li>
                                <li>Try generating the report again</li>
                                <li>Contact support if the problem persists</li>
                            </ul>
                        </div>
                        
                        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center;">
                            <p style="color: #64748b; font-size: 12px; margin: 0;">
                                This is an automated notification from SolushipX Reports
                            </p>
                        </div>
                    </div>
                </div>
            `
        },

        schedule_reminder: {
            subject: `⏰ Scheduled Report Reminder - ${data.reportName || 'Report'}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #1e293b; margin: 0; font-size: 24px;">Scheduled Report Reminder</h1>
                            <p style="color: #64748b; margin: 10px 0 0 0;">Your report "${data.reportName}" is scheduled to run soon</p>
                        </div>
                        
                        <div style="background-color: #fef3c7; border: 1px solid #fde68a; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                            <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">⏰ Upcoming Execution</h3>
                            <p style="color: #78350f; margin: 0; font-size: 14px;">Next run: ${data.nextRun ? new Date(data.nextRun).toLocaleString() : 'Soon'}</p>
                        </div>
                        
                        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">Schedule Details</h3>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr><td style="padding: 5px 0; color: #64748b;">Report Name:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.reportName || 'N/A'}</td></tr>
                                <tr><td style="padding: 5px 0; color: #64748b;">Frequency:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.frequency || 'N/A'}</td></tr>
                                <tr><td style="padding: 5px 0; color: #64748b;">Recipients:</td><td style="padding: 5px 0; color: #1e293b; font-weight: 500;">${data.recipientCount || 0}</td></tr>
                            </table>
                        </div>
                        
                        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center;">
                            <p style="color: #64748b; font-size: 12px; margin: 0;">
                                This is an automated reminder from Integrated Carriers Reports
                            </p>
                        </div>
                    </div>
                </div>
            `
        },

        test_notification: {
            subject: data.subject || 'Test Notification from Integrated Carriers Reports',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: #1e293b; margin: 0; font-size: 24px;">🧪 Test Notification</h1>
                            <p style="color: #64748b; margin: 10px 0 0 0;">This is a test email from Integrated Carriers Reports</p>
                        </div>
                        
                        <div style="background-color: #f1f5f9; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                            <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px;">Message</h3>
                            <p style="color: #475569; margin: 0; line-height: 1.6;">${data.message || 'This is a test notification from the Integrated Carriers Reports system.'}</p>
                        </div>
                        
                        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                            <h3 style="color: #065f46; margin: 0 0 10px 0; font-size: 16px;">✅ Email System Working</h3>
                            <p style="color: #047857; margin: 0; font-size: 14px;">If you're reading this, your email notifications are configured correctly!</p>
                        </div>
                        
                        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center;">
                            <p style="color: #64748b; font-size: 12px; margin: 0;">
                                Sent at ${new Date().toLocaleString()} • SolushipX Reports System
                            </p>
                        </div>
                    </div>
                </div>
            `
        }
    };

    return templates[templateType] || {
        subject: 'Notification from Integrated Carriers',
        html: `<p>${data.message || 'You have a new notification.'}</p>`
    };
};

/**
 * Send report notification email using SendGrid
 */
async function sendReportNotificationEmail(templateType, userId, data = {}) {
    try {
        logger.info(`Sending ${templateType} report notification email`, { userId, recipient: data.recipientEmail });

        // Get the email template
        const template = getEmailTemplate(templateType, data);
        
        const msg = {
            to: data.recipientEmail || data.recipient,
            from: {
                email: SEND_FROM_EMAIL,
                name: SEND_FROM_NAME
            },
            subject: template.subject,
            html: template.html
        };

        const response = await sgMail.send(msg);
        logger.info(`Email sent successfully to ${msg.to}`, { 
            messageId: response[0].headers['x-message-id'],
            statusCode: response[0].statusCode 
        });

        return {
            success: true,
            messageId: response[0].headers['x-message-id'],
            statusCode: response[0].statusCode
        };
    } catch (error) {
        logger.error('Failed to send report notification email:', {
            error: error.message,
            code: error.code,
            response: error.response?.body,
            templateType,
            userId
        });

        throw new Error(`Failed to send ${templateType} notification: ${error.message}`);
    }
}

// Add the missing sendEmail function before the module exports
async function sendEmail(emailData) {
    try {
        if (!sendgridApiKey) {
            throw new Error('SendGrid API key not configured');
        }

        // Validate recipient
        if (!emailData.to || emailData.to.trim() === '') {
            logger.warn('Cannot send email: No recipient specified', {
                subject: emailData.subject,
                templateId: emailData.templateId
            });
            return { success: false, message: 'No recipient specified' };
        }

        // Prepare base message data
        const msg = {
            to: emailData.to,
            from: emailData.from || SEND_FROM_EMAIL,
            subject: emailData.subject,
            text: emailData.text || '',
            html: emailData.html || ''
        };

        // Handle dynamic templates
        if (emailData.templateId) {
            // Get the template data
            const templateData = EMAIL_TEMPLATES[emailData.templateId] || EMAIL_TEMPLATES.generic;
            
            // Generate subject, text, and HTML from template
            msg.subject = templateData.subject(emailData.dynamicTemplateData || {});
            msg.text = templateData.text(emailData.dynamicTemplateData || {});
            msg.html = templateData.html(emailData.dynamicTemplateData || {});
        }

        // Handle attachments from URLs
        if (emailData.attachments && emailData.attachments.length > 0) {
            msg.attachments = [];
            
            for (const attachment of emailData.attachments) {
                if (attachment.url) {
                    try {
                        // Download file from URL
                        const response = await fetch(attachment.url);
                        
                        if (!response.ok) {
                            logger.warn(`Failed to download attachment from ${attachment.url}: ${response.statusText}`);
                            continue;
                        }
                        
                        // Get array buffer and convert to Node.js Buffer
                        const arrayBuffer = await response.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        const base64Content = buffer.toString('base64');
                        
                        msg.attachments.push({
                            content: base64Content,
                            filename: attachment.filename || 'attachment.pdf',
                            type: attachment.type || 'application/pdf',
                            disposition: attachment.disposition || 'attachment',
                            content_id: attachment.content_id || undefined
                        });
                        
                        logger.info(`Successfully attached ${attachment.filename} to email`);
                    } catch (error) {
                        logger.error(`Error downloading attachment from ${attachment.url}:`, error);
                        // Continue with other attachments if one fails
                    }
                } else if (attachment.content) {
                    // Direct base64 content provided
                    msg.attachments.push({
                        content: attachment.content,
                        filename: attachment.filename || 'attachment.pdf',
                        type: attachment.type || 'application/pdf',
                        disposition: attachment.disposition || 'attachment',
                        content_id: attachment.content_id || undefined
                    });
                }
            }
        }

        // Send the email
        await sgMail.send(msg);
        
        logger.info('Email sent successfully', {
            to: emailData.to,
            subject: msg.subject,
            attachmentCount: msg.attachments?.length || 0,
            templateId: emailData.templateId || 'custom'
        });
        
        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        logger.error('Error sending email:', error);
        
        // Log the full SendGrid error response with detailed information
        if (error.response) {
            logger.error('SendGrid error response:', {
                statusCode: error.code,
                body: JSON.stringify(error.response.body, null, 2),
                headers: error.response.headers
            });
            
            // Log the specific error messages
            if (error.response.body?.errors && Array.isArray(error.response.body.errors)) {
                error.response.body.errors.forEach((err, index) => {
                    logger.error(`SendGrid error ${index + 1}:`, {
                        message: err.message,
                        field: err.field,
                        help: err.help,
                        fullError: JSON.stringify(err, null, 2)
                    });
                });
            }
        } else {
            logger.error('SendGrid error without response:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
        }
        
        throw error;
    }
}

/**
 * Send email with attachment
 * @param {Object} emailData - Email configuration with attachment
 */
async function sendEmailWithAttachment(emailData) {
    try {
        const msg = {
            to: emailData.to,
            from: 'noreply@integratedcarriers.com',
            subject: emailData.subject,
            html: emailData.html || '',
            text: emailData.text || '',
            attachments: emailData.attachments || []
        };

        if (emailData.templateId && EMAIL_TEMPLATES[emailData.templateId]) {
            const template = EMAIL_TEMPLATES[emailData.templateId];
            msg.subject = template.subject(emailData.dynamicTemplateData || {});
            msg.html = template.html(emailData.dynamicTemplateData || {});
            msg.text = template.text(emailData.dynamicTemplateData || {});
        }

        await sgMail.send(msg);
        console.log(`Email with attachment sent successfully to ${emailData.to}`);
        
    } catch (error) {
        console.error('Error sending email with attachment:', error);
        throw error;
    }
}

module.exports = {
    sendEmail, // Add the missing sendEmail function
    sendEmailWithAttachment, // Add attachment support function
    sendNotificationEmail, // Main function for shipment notifications
    sendReportNotificationEmail, // Function for report notifications
    getEmailTemplate,
    // Legacy functions (for backward compatibility)
    getCompanyNotificationSubscribers,
    updateUserNotificationSubscriptions,
    getUserCompanyNotificationStatus,
    // New V2 functions (collection-based)
    getCompanyNotificationSubscribersV2,
    updateUserNotificationSubscriptionsV2,
    getUserCompanyNotificationStatusV2,
    migrateNotificationSubscriptionsToCollection,
    logNotification,
    getDefaultPreferences
}; 