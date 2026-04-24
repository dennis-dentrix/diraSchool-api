import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import EmailEvent from '../features/email/EmailEvent.model.js';

const FROM = env.EMAIL_FROM ?? 'Diraschool <noreply@contact.diraschool.com>';

let _transport = null;

const getTransport = () => {
  if (!_transport) {
    if (!env.ZEPTOMAIL_API_KEY) {
      throw new Error('[Email] ZEPTOMAIL_API_KEY is not set.');
    }
    _transport = nodemailer.createTransport({
      host: env.ZEPTOMAIL_SERVER,
      port: 587,
      secure: false,
      auth: {
        user: env.ZEPTOMAIL_USERNAME,
        pass: env.ZEPTOMAIL_API_KEY,
      },
    });
  }
  return _transport;
};

const persistEmailEvent = async ({
  to,
  subject,
  template,
  status,
  providerStatus,
  providerMessageId,
  accepted = [],
  rejected = [],
  errorMessage,
  errorCode,
  meta = {},
}) => {
  try {
    await EmailEvent.create({
      to,
      subject,
      template,
      provider: 'zeptomail',
      status,
      providerStatus,
      providerMessageId,
      accepted,
      rejected,
      errorMessage,
      errorCode,
      schoolId: meta.schoolId ?? undefined,
      userId: meta.userId ?? undefined,
      deliveredAt: status === 'delivered' ? new Date() : undefined,
      lastCheckedAt: status === 'delivered' ? new Date() : undefined,
      meta,
    });
  } catch (err) {
    logger.error('[Email] Failed to persist EmailEvent', { to, template, err: err.message });
  }
};

const sendEmail = async ({ to, subject, html, template, meta = {} }) => {
  try {
    const info = await getTransport().sendMail({ from: FROM, to, subject, html });

    await persistEmailEvent({
      to,
      subject,
      template,
      status: 'sent',
      providerStatus: info?.response ?? 'accepted',
      providerMessageId: info?.messageId,
      accepted: Array.isArray(info?.accepted) ? info.accepted : [to],
      rejected: Array.isArray(info?.rejected) ? info.rejected : [],
      meta,
    });

    logger.info('[Email] Sent email', { to, template, providerMessageId: info?.messageId });

    return { providerMessageId: info?.messageId };
  } catch (err) {
    await persistEmailEvent({
      to,
      subject,
      template,
      status: 'failed',
      errorMessage: err?.message ?? 'Unknown delivery error',
      errorCode: err?.code ? String(err.code) : undefined,
      meta,
    });

    logger.warn('[Email] Email provider failed', { to, template, err: err?.message });

    throw err;
  }
};

export const sendVerificationEmail = ({
  to,
  firstName,
  schoolName,
  code,
  verifyUrl,
  expiresInMinutes = 30,
  meta = {},
}) =>
  sendEmail({
    to,
    subject: `${code} — verify your Diraschool account`,
    html: _verifyTemplate({ firstName, schoolName, code, verifyUrl, expiresInMinutes }),
    template: 'verification',
    meta,
  });

export const sendInviteEmail = ({
  to,
  firstName,
  schoolName,
  inviteUrl,
  childName,
  expiresInDays = 7,
  meta = {},
}) =>
  sendEmail({
    to,
    subject: `You've been added to ${schoolName} — set your password`,
    html: _inviteTemplate({ firstName, schoolName, inviteUrl, childName, expiresInDays }),
    template: 'invite',
    meta,
  });

export const sendParentEnrollmentEmail = ({
  to,
  firstName,
  schoolName,
  childName,
  isAdditionalChild = false,
  meta = {},
}) =>
  sendEmail({
    to,
    subject: `${childName} has been enrolled at ${schoolName}`,
    html: _parentEnrollmentTemplate({ firstName, schoolName, childName, isAdditionalChild }),
    template: 'parent-enrollment',
    meta,
  });

export const sendNewSchoolNotification = ({
  schoolName,
  schoolEmail,
  schoolPhone,
  county,
  adminName,
  meta = {},
}) =>
  sendEmail({
    to: 'diraschadmin@diraschool.com',
    subject: `New school registered — ${schoolName}`,
    html: _newSchoolTemplate({ schoolName, schoolEmail, schoolPhone, county, adminName }),
    template: 'new-school-notification',
    meta,
  });

export const sendPasswordResetEmail = ({
  to,
  firstName,
  resetUrl,
  expiresInHours = 1,
  meta = {},
}) =>
  sendEmail({
    to,
    subject: 'Reset your Diraschool password',
    html: _resetTemplate({ firstName, resetUrl, expiresInHours }),
    template: 'password-reset',
    meta,
  });

const _shell = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:600px;width:100%;">
          <tr>
            <td style="background:#1a56db;padding:28px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.5px;">
                Diraschool
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <tr>
            <td style="background:#f4f6f9;padding:20px 40px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;">
                This email was sent by Diraschool School Management System.<br/>
                If you didn't expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const _btn = (url, label) =>
  `<a href="${url}"
     style="display:inline-block;background:#1a56db;color:#ffffff;
            padding:14px 28px;border-radius:6px;text-decoration:none;
            font-size:15px;font-weight:600;margin:24px 0;"
  >${label}</a>`;

const _verifyTemplate = ({ firstName, schoolName, code, verifyUrl, expiresInMinutes }) =>
  _shell(
    `Verify your email — ${schoolName}`,
    `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Welcome to Diraschool, ${firstName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        You've successfully created an account for <strong>${schoolName}</strong>.
        Verify your email to activate it — use either option below.
      </p>
      <p style="margin:20px 0 8px;font-size:12px;font-weight:700;color:#6b7280;
                letter-spacing:.8px;text-transform:uppercase;">
        Option 1 — Enter this code on the verification screen
      </p>
      <div style="text-align:center;margin-bottom:4px;">
        <div style="display:inline-block;background:#f0f4ff;border:2px solid #1a56db;
                    border-radius:10px;padding:18px 40px;">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;
                    letter-spacing:.5px;">Verification Code</p>
          <p style="margin:0;font-size:40px;font-weight:800;color:#1a56db;letter-spacing:10px;
                    font-family:'Courier New',monospace;">${code}</p>
        </div>
      </div>
      <p style="text-align:center;font-size:13px;color:#9ca3af;margin:20px 0;">— or —</p>
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;
                letter-spacing:.8px;text-transform:uppercase;">
        Option 2 — Click the link to verify instantly
      </p>
      ${_btn(verifyUrl, 'Verify My Email →')}
      <p style="margin:0 0 0;font-size:12px;color:#6b7280;">
        Or copy into your browser:<br/>
        <span style="color:#1a56db;word-break:break-all;">${verifyUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Both options expire in <strong>${expiresInMinutes} minutes</strong>.
        If they expire, request a new code from the login screen.
      </p>
    `
  );

const _inviteTemplate = ({ firstName, schoolName, inviteUrl, childName, expiresInDays }) =>
  _shell(
    `Invitation to ${schoolName}`,
    `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Hello ${firstName},</h2>
      ${childName ? `
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        Your child <strong>${childName}</strong> has been successfully enrolled at
        <strong>${schoolName}</strong>.
      </p>
      ` : ''}
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        Your account has been created on <strong>Diraschool</strong> for
        <strong>${schoolName}</strong>.
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        Click the button below to set your password and access your account.
        This link expires in <strong>${expiresInDays} days</strong>.
      </p>
      ${_btn(inviteUrl, 'Set My Password →')}
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">
        Or copy this link into your browser:<br/>
        <span style="color:#1a56db;word-break:break-all;">${inviteUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you weren't expecting this invitation, contact your school administrator.
      </p>
    `
  );

const _parentEnrollmentTemplate = ({ firstName, schoolName, childName, isAdditionalChild }) =>
  _shell(
    `${childName} enrolled at ${schoolName}`,
    `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Hello ${firstName},</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        ${
  isAdditionalChild
    ? `Your child <strong>${childName}</strong> has been added to your parent account at <strong>${schoolName}</strong>.`
    : `Your child <strong>${childName}</strong> has been successfully enrolled at <strong>${schoolName}</strong>.`
}
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        You can sign in to your existing Diraschool parent portal account to view fees, attendance,
        results, and report cards.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If this update is unexpected, contact your school administrator.
      </p>
    `
  );

const _newSchoolTemplate = ({ schoolName, schoolEmail, schoolPhone, county, adminName }) =>
  _shell(
    `New school registered — ${schoolName}`,
    `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">New school registration</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        A new school has just signed up for a free trial on Diraschool.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;width:140px;border:1px solid #e5e7eb;">School name</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${schoolName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Admin email</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${schoolEmail}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Admin name</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${adminName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Phone</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${schoolPhone || '—'}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">County</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${county || '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Registered at</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${new Date().toUTCString()}</td>
        </tr>
      </table>
    `
  );

const _resetTemplate = ({ firstName, resetUrl, expiresInHours }) =>
  _shell(
    'Reset your Diraschool password',
    `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Hello ${firstName},</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        We received a request to reset the password for your Diraschool account.
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        Click the button below to choose a new password.
        This link expires in <strong>${expiresInHours} hour${expiresInHours !== 1 ? 's' : ''}</strong>.
      </p>
      ${_btn(resetUrl, 'Reset My Password →')}
      <p style="margin:4px 0 0;font-size:12px;color:#6b7280;">
        Or copy this link into your browser:<br/>
        <span style="color:#1a56db;word-break:break-all;">${resetUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you didn't request a password reset, ignore this email — your password
        won't change.
      </p>
    `
  );
