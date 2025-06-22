const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const { sendReportNotificationEmail } = require('./email/sendgridService');
const sgMail = require('@sendgrid/mail');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Get SendGrid API key from environment variables
const sendgridApiKey = process.env.SENDGRID_API_KEY;

/**
 * Send a test report notification email with CORS enabled
 */
exports.sendTestReportNotification = onCall(
    {
        cors: true, // Enable CORS for web clients
        region: 'us-central1'
    },
    async (request) => {
        try {
            const { 
                recipient, 
                subject, 
                message, 
                companyId 
            } = request.data;

            // Validate required parameters
            if (!recipient || !subject || !message) {
                throw new HttpsError('invalid-argument', 'Recipient, subject, and message are required');
            }

            logger.info(`Sending test report notification to ${recipient}`, {
                recipient,
                subject,
                companyId,
                userId: request.auth?.uid
            });

                    // Use the enhanced sendReportNotificationEmail function
        const result = await sendReportNotificationEmail('test_notification', request.auth?.uid, {
                recipientEmail: recipient,
                subject: subject,
                message: message,
                companyId: companyId
            });

            logger.info(`Test email sent successfully to ${recipient}`, {
                messageId: result.messageId,
                statusCode: result.statusCode
            });

            return {
                success: true,
                message: 'Test email sent successfully',
                messageId: result.messageId,
                statusCode: result.statusCode
            };

        } catch (error) {
            logger.error('Error sending test report notification:', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                userId: request.auth?.uid
            });

            // Return a proper HttpsError for the client
            if (error instanceof HttpsError) {
                throw error;
            } else {
                throw new HttpsError('internal', `Failed to send test email: ${error.message}`);
            }
        }
    }
);

/**
 * Send test email using SendGrid
 */
async function sendTestEmail(data) {
    const sgMail = require('@sendgrid/mail');
    
    // Get SendGrid API key from environment variables
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    
    if (!sendgridApiKey) {
        throw new Error('SendGrid API key not configured');
    }
    
    sgMail.setApiKey(sendgridApiKey);

    const emailContent = {
        to: data.recipientEmail,
                    from: {
                email: 'noreply@integratedcarriers.com',
                name: 'Integrated Carriers Reports'
            },
        subject: data.subject,
        html: generateTestEmailHTML(data),
        text: generateTestEmailText(data)
    };

    try {
        await sgMail.send(emailContent);
        logger.info(`Test email sent successfully to ${data.recipientEmail}`);
    } catch (error) {
        logger.error('SendGrid error:', error);
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

/**
 * Generate HTML content for test email
 */
function generateTestEmailHTML(data) {
    return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                <h1 style="margin: 0; font-size: 24px;">Test Report Notification</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">This is a test email from the Integrated Carriers Reports system</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                <!-- Test Message -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Test Message</h2>
                    <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #1c277d; font-size: 14px; line-height: 1.6;">
                        ${data.message.replace(/\n/g, '<br>')}
                    </div>
                </div>

                <!-- Test Details -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Test Details</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Sent To:</strong></td><td style="padding: 8px 0;">${data.recipientEmail}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Sent At:</strong></td><td style="padding: 8px 0;">${new Date(data.sentAt).toLocaleString()}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Company ID:</strong></td><td style="padding: 8px 0;">${data.companyId}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Email Type:</strong></td><td style="padding: 8px 0;">Test Report Notification</td></tr>
                    </table>
                </div>

                <!-- Success Notice -->
                <div style="background: #d1fae5; border: 1px solid #10b981; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                    <h3 style="color: #065f46; margin: 0 0 10px 0;">✅ Email System Working</h3>
                    <p style="margin: 0; color: #065f46;">
                        If you received this email, your report notification system is configured correctly and ready to send automated reports.
                    </p>
                </div>

                <!-- Next Steps -->
                <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Next Steps</h2>
                    <ul style="margin: 0; padding-left: 20px; line-height: 1.6;">
                        <li>Configure your email groups for different report types</li>
                        <li>Set up automated report schedules</li>
                        <li>Generate your first report to test the complete workflow</li>
                        <li>Review notification preferences for your team</li>
                    </ul>
                </div>

                <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                    <p style="margin: 0;">Questions about reports? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">© 2024 SolushipX. All rights reserved.</p>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate text content for test email
 */
function generateTestEmailText(data) {
    return `
Test Report Notification

This is a test email from the Integrated Carriers Reports system.

TEST MESSAGE:
${data.message}

TEST DETAILS:
- Sent To: ${data.recipientEmail}
- Sent At: ${new Date(data.sentAt).toLocaleString()}
- Company ID: ${data.companyId}
- Email Type: Test Report Notification

✅ EMAIL SYSTEM WORKING
If you received this email, your report notification system is configured correctly and ready to send automated reports.

NEXT STEPS:
- Configure your email groups for different report types
- Set up automated report schedules  
- Generate your first report to test the complete workflow
- Review notification preferences for your team

Questions about reports? Contact support@integratedcarriers.com

© 2024 SolushipX. All rights reserved.
    `;
} 