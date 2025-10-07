import nodemailer from 'nodemailer';
import { SmtpSettings, SystemSettings } from '../../models';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static async getSmtpSettings() {
    const settings = await SmtpSettings.findOne({ isActive: true });
    if (!settings) {
      throw new Error('SMTP settings not configured. Please configure email settings in Super Admin panel.');
    }
    return settings;
  }

  private static async getSystemSettings() {
    const settings = await SystemSettings.findOne();
    return settings;
  }

  private static replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    return result;
  }

  private static async createTransporter() {
    const settings = await this.getSmtpSettings();

    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure, // true for 465, false for other ports
      auth: {
        user: settings.username,
        pass: settings.password,
      },
      tls: {
        // Do not fail on invalid certs (for dev environments)
        rejectUnauthorized: false,
      },
    });

    return { transporter, settings };
  }

  /**
   * Send an email using configured SMTP settings
   */
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const { transporter, settings } = await this.createTransporter();

      const mailOptions = {
        from: `"${settings.fromName}" <${settings.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send test email to verify SMTP configuration
   */
  static async sendTestEmail(toEmail: string): Promise<boolean> {
    const testEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .success-badge { background: #10b981; color: white; padding: 10px 20px; border-radius: 6px; display: inline-block; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 SMTP Configuration Test</h1>
          </div>
          <div class="content">
            <div class="success-badge">✅ Email Sent Successfully!</div>
            <p>Congratulations! Your SMTP email configuration is working correctly.</p>
            <p>This is a test email from <strong>Flotix Fleet Management System</strong>.</p>
            <p>You can now send automated emails to:</p>
            <ul>
              <li>Welcome new admins and drivers</li>
              <li>Send login credentials</li>
              <li>Password reset links</li>
              <li>System notifications</li>
            </ul>
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <strong>Sent at:</strong> ${new Date().toLocaleString()}<br>
              <strong>System:</strong> Flotix Backend
            </p>
          </div>
          <div class="footer">
            <p>Flotix Fleet Management System</p>
            <p>This is an automated test email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: toEmail,
      subject: '✅ SMTP Test Email - Flotix',
      html: testEmailHtml,
    });
  }

  /**
   * Send welcome email with login credentials to new user
   */
  static async sendWelcomeEmail(
    userEmail: string,
    userName: string,
    userRole: string,
    temporaryPassword: string,
    companyName?: string
  ): Promise<boolean> {
    const systemSettings = await this.getSystemSettings();
    const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const appDownloadUrl = process.env.APP_DOWNLOAD_URL || 'https://flotix.com/download';

    // Determine which template to use based on role
    const isDriver = userRole === 'DRIVER';
    const isAdmin = userRole === 'ADMIN';

    let subject = '';
    let bodyTemplate = '';

    if (isAdmin && systemSettings?.adminWelcomeEmailSubject) {
      subject = systemSettings.adminWelcomeEmailSubject;
      bodyTemplate = systemSettings.adminWelcomeEmailBody;
    } else if (isDriver && systemSettings?.driverWelcomeEmailSubject) {
      subject = systemSettings.driverWelcomeEmailSubject;
      bodyTemplate = systemSettings.driverWelcomeEmailBody;
    } else {
      // Fallback to default email if templates not configured
      subject = `🎉 Welcome to Flotix - Your Login Credentials`;
      bodyTemplate = `Hello {{userName}},

Your account has been created successfully for ${companyName || 'Flotix'}.

Login Credentials:
- Email: {{userEmail}}
- Temporary Password: {{password}}

Please login at: {{loginUrl}}

For security, please change your password after first login.

Best regards,
Flotix Team`;
    }

    // Replace variables in subject and body
    const variables: Record<string, string> = {
      userName,
      userEmail,
      password: temporaryPassword,
      companyName: companyName || 'Flotix',
      loginUrl,
      appDownloadUrl,
    };

    const finalSubject = this.replaceVariables(subject, variables);
    const finalBody = this.replaceVariables(bodyTemplate, variables);

    // Send the HTML template directly (it's already formatted as HTML)
    return await this.sendEmail({
      to: userEmail,
      subject: finalSubject,
      html: finalBody,
    });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(
    userEmail: string,
    userName: string,
    resetToken: string
  ): Promise<boolean> {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const resetEmailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${userName},</h2>
            <p>We received a request to reset your password for your Flotix account.</p>

            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Your Password →</a>
            </div>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong><br>
              This password reset link is valid for 1 hour only. If you didn't request this, please ignore this email.
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="background: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px;">
              ${resetUrl}
            </p>
          </div>
          <div class="footer">
            <p>Flotix Fleet Management System</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject: '🔐 Password Reset Request - Flotix',
      html: resetEmailHtml,
    });
  }
}
