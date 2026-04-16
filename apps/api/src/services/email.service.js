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
const isProviderConfigured = (provider) =>
  provider === 'zeptomail' ? isZeptoConfigured() : isResendConfigured();

const getZeptoTransport = () => {
  if (!_zeptoTransport) {
    if (!isZeptoConfigured()) {
      throw new Error('[Email] ZEPTOMAIL_API_KEY is not set.');
    }
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
    if (!isResendConfigured()) {
      throw new Error('[Email] RESEND_API_KEY is not set.');
    }
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
    logger.error('[Email] Failed to persist EmailEvent', {
      to,
      template,
      provider,
      err: err.message,
    });
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
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject,
    html,
  });

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

const getProviderOrder = () => {
  const primary = env.EMAIL_PRIMARY_PROVIDER === 'resend' ? 'resend' : 'zeptomail';
  if (!env.EMAIL_FAILOVER_ENABLED) return [primary];
  return primary === 'zeptomail' ? ['zeptomail', 'resend'] : ['resend', 'zeptomail'];
};

const sendEmail = async ({ to, subject, html, template, meta = {} }) => {
  const attempts = [];
  const providers = getProviderOrder().filter(isProviderConfigured);

  if (providers.length === 0) {
    const configured = [];
    if (isZeptoConfigured()) configured.push('zeptomail');
    if (isResendConfigured()) configured.push('resend');
    const configuredText = configured.length > 0 ? configured.join(', ') : 'none';
    throw new Error(
      `[Email] No eligible providers for current config. primary=${env.EMAIL_PRIMARY_PROVIDER}, failover=${env.EMAIL_FAILOVER_ENABLED}, configured=${configuredText}.`
    );
  }

  for (let i = 0; i < providers.length; i += 1) {
    const provider = providers[i];
    const fallbackUsed = i > 0;
    try {
      const result =
        provider === 'zeptomail'
          ? await sendViaZepto({ to, subject, html })
          : await sendViaResend({ to, subject, html });

      await persistEmailEvent({
        to,
        subject,
        template,
        ...result,
        status: 'sent',
        fallbackUsed,
        attemptOrder: i + 1,
        meta,
      });

      logger.info('[Email] Sent email', {
        to,
        template,
        provider,
        fallbackUsed,
        providerOrder: getProviderOrder(),
        providerMessageId: result.providerMessageId,
      });

      return result;
    } catch (err) {
      const normalized = normalizeError(err);
      attempts.push({ provider, ...normalized });
      await persistEmailEvent({
        to,
        subject,
        template,
        provider,
        status: 'failed',
        errorMessage: normalized.message,
        errorCode: normalized.code,
        fallbackUsed,
        attemptOrder: i + 1,
        meta,
      });
      logger.warn('[Email] Email provider failed', {
        to,
        template,
        provider,
        fallbackUsed,
        err: normalized.message,
      });
    }
  }

  if (!isZeptoConfigured() && !isResendConfigured()) {
    throw new Error('[Email] No provider configured. Set ZEPTOMAIL_API_KEY or RESEND_API_KEY.');
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
  if (
    rawStatus.includes('bounce') ||
    rawStatus.includes('complain') ||
    rawStatus.includes('fail')
  ) {
    normalizedStatus = 'failed';
  }

  return {
    providerStatus: rawStatus,
    normalizedStatus,
    raw: data,
  };
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
  expiresInDays = 7,
  meta = {},
}) =>
  sendEmail({
    to,
    subject: `You've been added to ${schoolName} — set your password`,
    html: _inviteTemplate({ firstName, schoolName, inviteUrl, expiresInDays }),
    template: 'invite',
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

const _inviteTemplate = ({ firstName, schoolName, inviteUrl, expiresInDays }) =>
  _shell(
    `Invitation to ${schoolName}`,
    `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Hello ${firstName},</h2>
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
