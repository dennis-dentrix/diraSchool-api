import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import EmailEvent from '../features/email/EmailEvent.model.js';

const FROM = env.EMAIL_FROM ?? 'Diraschool <noreply@contact.diraschool.com>';

let _zeptoTransport = null;
let _resend = null;

const isZeptoConfigured = () => Boolean(env.ZEPTOMAIL_API_KEY);
const isResendConfigured = () => Boolean(env.RESEND_API_KEY);

const getZeptoTransport = () => {
  if (!_zeptoTransport) {
    if (!isZeptoConfigured()) throw new Error('[Email] ZEPTOMAIL_API_KEY is not set.');
    _zeptoTransport = nodemailer.createTransport({
      host: env.ZEPTOMAIL_SERVER,
      port: 587,
      secure: false,
      auth: {
        user: env.ZEPTOMAIL_USERNAME,
        pass: env.ZEPTOMAIL_API_KEY,
      },
    });
  }
  return _zeptoTransport;
};

const getResendClient = () => {
  if (!_resend) {
    if (!isResendConfigured()) throw new Error('[Email] RESEND_API_KEY is not set.');
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
};

const normalizeError = (err) => ({
  message: err?.message ?? 'Unknown email delivery error',
  code: err?.code ? String(err.code) : undefined,
});

const persistEmailEvent = async ({
  to,
  subject,
  template,
  provider,
  status,
  providerStatus,
  providerMessageId,
  accepted = [],
  rejected = [],
  errorMessage,
  errorCode,
  fallbackUsed = false,
  attemptOrder = 1,
  meta = {},
}) => {
  try {
    await EmailEvent.create({
      to,
      subject,
      template,
      provider,
      status,
      providerStatus,
      providerMessageId,
      accepted,
      rejected,
      errorMessage,
      errorCode,
      fallbackUsed,
      attemptOrder,
      schoolId: meta.schoolId ?? undefined,
      userId: meta.userId ?? undefined,
      deliveredAt: status === 'delivered' ? new Date() : undefined,
      lastCheckedAt: status === 'delivered' ? new Date() : undefined,
      meta,
    });
  } catch (err) {
    logger.error('[Email] Failed to persist EmailEvent', { to, template, provider, err: err.message });
  }
};

const sendViaZepto = async ({ to, subject, html }) => {
  const info = await getZeptoTransport().sendMail({ from: FROM, to, subject, html });
  return {
    provider: 'zeptomail',
    providerMessageId: info?.messageId,
    accepted: Array.isArray(info?.accepted) ? info.accepted : [],
    rejected: Array.isArray(info?.rejected) ? info.rejected : [],
    providerStatus: info?.response ?? 'accepted',
  };
};

const sendViaResend = async ({ to, subject, html }) => {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({ from: FROM, to: [to], subject, html });

  if (error) {
    const err = new Error(error.message || 'Resend API error');
    err.code = error.name || error.statusCode || 'RESEND_ERROR';
    throw err;
  }

  return {
    provider: 'resend',
    providerMessageId: data?.id,
    accepted: [to],
    rejected: [],
    providerStatus: data?.id ? 'accepted' : 'unknown',
  };
};

// ZeptoMail is always primary; Resend is fallback when configured.
const getProviderOrder = () => {
  const providers = ['zeptomail'];
  if (isResendConfigured()) providers.push('resend');
  return providers;
};

const sendEmail = async ({ to, subject, html, template, meta = {} }) => {
  const providers = getProviderOrder().filter((p) =>
    p === 'zeptomail' ? isZeptoConfigured() : isResendConfigured()
  );

  if (providers.length === 0) {
    throw new Error('[Email] No provider configured. Set ZEPTOMAIL_API_KEY.');
  }

  const attempts = [];

  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i];
    const fallbackUsed = i > 0;
    try {
      const result =
        provider === 'zeptomail'
          ? await sendViaZepto({ to, subject, html })
          : await sendViaResend({ to, subject, html });

      await persistEmailEvent({
        to, subject, template, ...result,
        status: 'sent', fallbackUsed, attemptOrder: i + 1, meta,
      });

      logger.info('[Email] Sent email', {
        to, template, provider, fallbackUsed,
        providerMessageId: result.providerMessageId,
      });

      return result;
    } catch (err) {
      const normalized = normalizeError(err);
      attempts.push({ provider, ...normalized });
      await persistEmailEvent({
        to, subject, template, provider,
        status: 'failed',
        errorMessage: normalized.message,
        errorCode: normalized.code,
        fallbackUsed, attemptOrder: i + 1, meta,
      });
      logger.warn('[Email] Email provider failed', {
        to, template, provider, fallbackUsed, err: normalized.message,
      });
    }
  }

  const failureSummary = attempts.map((a) => `${a.provider}: ${a.message}`).join(' | ');
  throw new Error(`[Email] All providers failed. ${failureSummary}`);
};

export const refreshResendDeliveryStatus = async (providerMessageId) => {
  if (!providerMessageId) throw new Error('Missing providerMessageId.');
  const resend = getResendClient();
  const { data, error } = await resend.emails.get(providerMessageId);

  if (error) {
    const err = new Error(error.message || 'Resend status lookup failed');
    err.code = error.name || error.statusCode || 'RESEND_STATUS_ERROR';
    throw err;
  }

  const rawStatus = String(data?.last_event || data?.status || 'unknown').toLowerCase();
  let normalizedStatus = 'sent';
  if (rawStatus.includes('deliver')) normalizedStatus = 'delivered';
  if (rawStatus.includes('bounce') || rawStatus.includes('complain') || rawStatus.includes('fail')) {
    normalizedStatus = 'failed';
  }

  return { providerStatus: rawStatus, normalizedStatus, raw: data };
};

export const sendVerificationEmail = ({
  to, firstName, schoolName, code, verifyUrl, expiresInMinutes = 30, meta = {},
}) =>
  sendEmail({
    to,
    subject: `${code} — verify your Diraschool account`,
    html: _verifyTemplate({ firstName, schoolName, code, verifyUrl, expiresInMinutes }),
    template: 'verification',
    meta,
  });

export const sendInviteEmail = ({
  to, firstName, schoolName, inviteUrl, childName, expiresInDays = 7, meta = {},
}) =>
  sendEmail({
    to,
    subject: `You've been added to ${schoolName} — set your password`,
    html: _inviteTemplate({ firstName, schoolName, inviteUrl, childName, expiresInDays }),
    template: 'invite',
    meta,
  });

export const sendParentEnrollmentEmail = ({
  to, firstName, schoolName, childName, isAdditionalChild = false, meta = {},
}) =>
  sendEmail({
    to,
    subject: `${childName} has been enrolled at ${schoolName}`,
    html: _parentEnrollmentTemplate({ firstName, schoolName, childName, isAdditionalChild }),
    template: 'parent-enrollment',
    meta,
  });

export const sendNewSchoolNotification = ({
  schoolName, schoolEmail, schoolPhone, county, adminName, meta = {},
}) =>
  sendEmail({
    to: 'diraschadmin@diraschool.com',
    subject: `New school registered — ${schoolName}`,
    html: _newSchoolTemplate({ schoolName, schoolEmail, schoolPhone, county, adminName }),
    template: 'new-school-notification',
    meta,
  });

export const sendSubscriptionConfirmationEmail = ({
  to, schoolName, amount, currency = 'KES', billingCycle, studentCount, merchantReference, paidAt, meta = {},
}) =>
  sendEmail({
    to,
    subject: `Subscription confirmed — ${schoolName}`,
    html: _subscriptionConfirmTemplate({ schoolName, amount, currency, billingCycle, studentCount, merchantReference, paidAt }),
    template: 'subscription-confirmation',
    meta,
  });

export const sendPasswordResetEmail = ({
  to, firstName, resetUrl, expiresInHours = 1, meta = {},
}) =>
  sendEmail({
    to,
    subject: 'Reset your Diraschool password',
    html: _resetTemplate({ firstName, resetUrl, expiresInHours }),
    template: 'password-reset',
    meta,
  });

export const sendSenderIdRequestNotification = ({
  schoolName, schoolId, senderIdRequested, requestedByEmail, meta = {},
}) =>
  sendEmail({
    to: 'diraschadmin@diraschool.com',
    subject: `SMS Sender ID request — ${schoolName}`,
    html: _senderIdRequestTemplate({ schoolName, schoolId, senderIdRequested, requestedByEmail }),
    template: 'sender-id-request',
    meta,
  });

export const sendSenderIdReviewedEmail = ({
  to, schoolName, action, senderIdApproved, rejectionReason, meta = {},
}) =>
  sendEmail({
    to,
    subject: action === 'approve'
      ? `Your SMS Sender ID has been approved — ${senderIdApproved}`
      : 'Your SMS Sender ID request was not approved',
    html: _senderIdReviewedTemplate({ schoolName, action, senderIdApproved, rejectionReason }),
    template: 'sender-id-reviewed',
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

const _fmtKes = (n) => `KES ${Math.round(n).toLocaleString('en-KE')}`;
const _fmtCycle = (c) => ({ 'per-term': 'Per Term', annual: 'Annual (3 terms, 15% off)', 'multi-year': '3-Year Annual (20% off)' }[c] ?? c);
const _fmtDate = (d) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

const _subscriptionConfirmTemplate = ({ schoolName, amount, currency, billingCycle, studentCount, merchantReference, paidAt }) =>
  _shell(
    `Subscription confirmed — ${schoolName}`,
    `
      <h2 style="margin:0 0 8px;font-size:20px;color:#111827;">Payment received — you're all set!</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Thank you — <strong>${schoolName}</strong>'s DiraSchool subscription has been activated.
        Your school now has full access to all features.
      </p>
      <table cellpadding="0" cellspacing="0"
             style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <tr style="background:#f0f4ff;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;width:160px;border:1px solid #dbeafe;">Amount paid</td>
          <td style="padding:10px 14px;color:#111827;font-weight:700;border:1px solid #dbeafe;">${_fmtKes(amount)} (incl. 16% VAT)</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Billing cycle</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${_fmtCycle(billingCycle)}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Enrolled students</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${studentCount ?? '—'}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Payment date</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${_fmtDate(paidAt)}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Reference</td>
          <td style="padding:10px 14px;color:#6b7280;font-family:'Courier New',monospace;font-size:12px;border:1px solid #e5e7eb;">${merchantReference}</td>
        </tr>
      </table>
      <p style="margin:0 0 12px;font-size:14px;color:#374151;line-height:1.6;">
        Log in to your DiraSchool dashboard to view your billing details and download a full invoice.
        Keep this email as your payment receipt.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Questions? Reply to this email or contact us at
        <a href="mailto:contact@diraschool.com" style="color:#1a56db;">contact@diraschool.com</a>.
      </p>
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

const _senderIdRequestTemplate = ({ schoolName, schoolId, senderIdRequested, requestedByEmail }) =>
  _shell(
    `SMS Sender ID request — ${schoolName}`,
    `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Sender ID approval needed</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        A school has requested a custom SMS Sender ID. Review and approve or reject it in the superadmin panel.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;width:160px;border:1px solid #e5e7eb;">School</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${schoolName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Requested by</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${requestedByEmail}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Requested Sender ID</td>
          <td style="padding:10px 14px;font-family:monospace;font-size:16px;font-weight:700;color:#1a56db;border:1px solid #e5e7eb;">${senderIdRequested}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">School ID</td>
          <td style="padding:10px 14px;font-family:monospace;color:#6b7280;border:1px solid #e5e7eb;">${schoolId}</td>
        </tr>
        <tr style="background:#f9fafb;">
          <td style="padding:10px 14px;font-weight:600;color:#374151;border:1px solid #e5e7eb;">Requested at</td>
          <td style="padding:10px 14px;color:#111827;border:1px solid #e5e7eb;">${new Date().toUTCString()}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
        Log in to the superadmin panel → Schools → find this school → SMS tab to approve or reject.
      </p>
    `
  );

const _senderIdReviewedTemplate = ({ schoolName, action, senderIdApproved, rejectionReason }) =>
  _shell(
    action === 'approve' ? `Sender ID approved — ${senderIdApproved}` : 'Sender ID request not approved',
    action === 'approve'
      ? `
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Your Sender ID has been approved ✓</h2>
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
          Great news! Your custom SMS Sender ID for <strong>${schoolName}</strong> has been approved.
          Your messages will now be delivered using:
        </p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;text-align:center;margin:0 0 20px;">
          <span style="font-family:monospace;font-size:24px;font-weight:700;color:#15803d;letter-spacing:2px;">${senderIdApproved}</span>
        </div>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
          No action is needed — your school's SMS messages will automatically use this Sender ID.
          It may take up to 24 hours to become active on all networks.
        </p>
      `
      : `
        <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Sender ID request not approved</h2>
        <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
          Unfortunately, your SMS Sender ID request for <strong>${schoolName}</strong> could not be approved at this time.
        </p>
        ${rejectionReason ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 20px;">
          <p style="margin:0;font-size:14px;color:#b91c1c;line-height:1.6;"><strong>Reason:</strong> ${rejectionReason}</p>
        </div>` : ''}
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
          You can submit a new request from your school's Settings page. If you have questions, reply to this email.
        </p>
      `
  );
