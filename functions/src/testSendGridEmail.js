const { onCall } = require('firebase-functions/v2/https');
const sgMail = require('@sendgrid/mail');
const logger = require('firebase-functions/logger');

// Get SendGrid API key from environment variables
const sendgridApiKey = process.env.SENDGRID_API_KEY;

if (sendgridApiKey) {
    sgMail.setApiKey(sendgridApiKey);
    logger.info('SendGrid API key loaded for test function');
} else {
    logger.error('SendGrid API key not found');
}

exports.testSendGridEmail = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    try {
        // Allow unauthenticated testing for SendGrid validation
        if (!request.auth) {
            logger.info('Running unauthenticated SendGrid test');
        }

        const { recipientEmail } = request.data || {};
        
        if (!recipientEmail) {
            throw new Error('Recipient email is required');
        }

        logger.info(`Sending test email to: ${recipientEmail}`);

        const msg = {
            to: recipientEmail,
            from: {
                email: 'noreplys@integratedcarriers.com',
                name: 'SolushipX'
            },
            subject: 'SendGrid Test Email - SolushipX System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f46e5;">🚀 SendGrid Test Email</h2>
                    <p>Hello!</p>
                    <p>This is a test email from the SolushipX system to confirm that SendGrid integration is working properly.</p>
                    <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #374151;">Test Details:</h3>
                        <ul style="color: #6b7280;">
                            <li><strong>Sender:</strong> noreplys@integratedcarriers.com</li>
                            <li><strong>Service:</strong> SendGrid</li>
                            <li><strong>System:</strong> SolushipX</li>
                            <li><strong>Time:</strong> ${new Date().toISOString()}</li>
                        </ul>
                    </div>
                    <p>If you received this email, the SendGrid configuration is working correctly! ✅</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        This is an automated test email from SolushipX.<br>
                        Please do not reply to this email.
                    </p>
                </div>
            `,
            text: `
SendGrid Test Email - SolushipX System

Hello!

This is a test email from the SolushipX system to confirm that SendGrid integration is working properly.

Test Details:
- Sender: noreplys@integratedcarriers.com
- Service: SendGrid
- System: SolushipX
- Time: ${new Date().toISOString()}

If you received this email, the SendGrid configuration is working correctly!

---
This is an automated test email from SolushipX.
Please do not reply to this email.
            `
        };

        const response = await sgMail.send(msg);
        
        logger.info('Test email sent successfully', {
            recipient: recipientEmail,
            messageId: response[0].headers['x-message-id'],
            statusCode: response[0].statusCode
        });

        return {
            success: true,
            message: `Test email sent successfully to ${recipientEmail}`,
            messageId: response[0].headers['x-message-id'],
            statusCode: response[0].statusCode
        };

    } catch (error) {
        logger.error('Error sending test email:', {
            message: error.message,
            code: error.code,
            response: error.response?.body
        });

        return {
            success: false,
            error: error.message,
            details: error.response?.body
        };
    }
});
