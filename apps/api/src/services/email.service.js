/**
 * Email service — Resend (primary) with ZeptoMail fallback.
 *
 * Send flow:
 *   1. Try Resend API first (clean API, 3k free/month).
 *   2. If Resend fails for any reason (rate limit, network, quota), retry
 *      immediately via ZeptoMail SMTP (10k one-time free, then pay-as-you-go).
 *   3. If both fail the error is thrown — the BullMQ worker will retry the job
 *      with exponential backoff.
 *
 * This gives you resilience at zero extra cost:
 *   - Resend free tier handles normal volume.
 *   - ZeptoMail catches the overflow or any Resend outage.
 *   - Both use your verified domain so deliverability stays high.
 *
 * Required env vars:
 *   RESEND_API_KEY        — https://resend.com/api-keys
 *   ZEPTOMAIL_API_KEY     — ZeptoMail dashboard → SMTP → API key
 *   EMAIL_FROM            — "Diraschool <noreply@yourdomain.co.ke>"
 *                           Domain must be verified in BOTH Resend and ZeptoMail.
 *
 * ZeptoMail domain setup:
 *   1. zeptomail.com → Mail Agents → Add Mail Agent → your domain
 *   2. Add the SPF + DKIM + bounce DNS records they provide
 *   3. Verify in dashboard → copy the API key from the SMTP tab
 *   SMTP username is always the literal string: emailapikey
 *   SMTP password is your API key
 */
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { env } from '../config/env.js';

const FROM = env.EMAIL_FROM ?? 'Diraschool <noreply@diraschool.co.ke>';

// ── Resend client (primary) ───────────────────────────────────────────────────

let _resend = null;

const getResendClient = () => {
  if (!_resend) {
    if (!env.RESEND_API_KEY) {
      throw new Error('[Email] RESEND_API_KEY is not set.');
    }
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
};

// ── ZeptoMail SMTP transport (fallback) ──────────────────────────────────────

let _zepto = null;

const getZeptoTransport = () => {
  if (!_zepto) {
    if (!env.ZEPTOMAIL_API_KEY) {
      throw new Error('[Email] ZEPTOMAIL_API_KEY is not set.');
    }
    _zepto = nodemailer.createTransport({
      host:   env.ZEPTOMAIL_SERVER,    // smtp.zeptomail.com (or region-specific)
      port:   587,
      secure: false,                   // STARTTLS on port 587
      auth: {
        user: env.ZEPTOMAIL_USERNAME,  // 'emailapikey' (ZeptoMail's fixed SMTP username)
        pass: env.ZEPTOMAIL_API_KEY,
      },
    });
  }
  return _zepto;
};

// ── Unified send with automatic fallback ─────────────────────────────────────

/**
 * Send a transactional email.
 * Tries Resend first; falls back to ZeptoMail on any failure.
 *
 * @param {{ to: string, subject: string, html: string }} opts
 */
const sendEmail = async ({ to, subject, html }) => {
  // ── Primary: Resend ───────────────────────────────────────
  if (env.RESEND_API_KEY) {
    try {
      const result = await getResendClient().emails.send({
        from: FROM, to, subject, html,
      });
      // Resend returns { data: { id }, error: null } on success
      // and { data: null, error: {...} } on failure
      if (!result.error) {
        return result;
      }
      console.warn(`[Email] Resend failed (${result.error.message}), switching to ZeptoMail…`);
    } catch (err) {
      console.warn(`[Email] Resend threw (${err.message}), switching to ZeptoMail…`);
    }
  }

  // ── Fallback: ZeptoMail ───────────────────────────────────
  if (env.ZEPTOMAIL_API_KEY) {
    return getZeptoTransport().sendMail({ from: FROM, to, subject, html });
  }

  throw new Error('[Email] No email provider is configured. Set RESEND_API_KEY and/or ZEPTOMAIL_API_KEY.');
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send an account invitation email to a newly created staff member.
 *
 * @param {object} opts
 * @param {string} opts.to            Recipient email
 * @param {string} opts.firstName     Recipient first name
 * @param {string} opts.schoolName    School display name
 * @param {string} opts.inviteUrl     Full URL the user clicks to set their password
 * @param {number} [opts.expiresInDays=7]
 */
export const sendInviteEmail = async ({ to, firstName, schoolName, inviteUrl, expiresInDays = 7 }) => {
  return sendEmail({
    to,
    subject: `You've been added to ${schoolName} — set your password`,
    html:    _inviteTemplate({ firstName, schoolName, inviteUrl, expiresInDays }),
  });
};

/**
 * Send a 6-digit OTP verification email to a newly registered school admin.
 *
 * @param {object} opts
 * @param {string} opts.to                Recipient email
 * @param {string} opts.firstName         Recipient first name
 * @param {string} opts.schoolName        School name
 * @param {string} opts.code              6-digit OTP
 * @param {number} [opts.expiresInMinutes=15]
 */
export const sendVerificationEmail = async ({ to, firstName, schoolName, code, expiresInMinutes = 15 }) => {
  return sendEmail({
    to,
    subject: `${code} — your Diraschool verification code`,
    html:    _verifyTemplate({ firstName, schoolName, code, expiresInMinutes }),
  });
};

/**
 * Send a temporary-password email to a newly created staff member.
 *
 * @param {object} opts
 * @param {string} opts.to            Recipient email
 * @param {string} opts.firstName     Recipient first name
 * @param {string} opts.schoolName    School display name
 * @param {string} opts.tempPassword  Plaintext temp password (shown once)
 */
export const sendTempPasswordEmail = async ({ to, firstName, schoolName, tempPassword }) => {
  return sendEmail({
    to,
    subject: `Your ${schoolName} login details — Diraschool`,
    html:    _tempPasswordTemplate({ firstName, schoolName, tempPassword }),
  });
};

/**
 * Send a password-reset email.
 *
 * @param {object} opts
 * @param {string} opts.to              Recipient email
 * @param {string} opts.firstName       Recipient first name
 * @param {string} opts.resetUrl        Full URL with embedded reset token
 * @param {number} [opts.expiresInHours=1]
 */
export const sendPasswordResetEmail = async ({ to, firstName, resetUrl, expiresInHours = 1 }) => {
  return sendEmail({
    to,
    subject: 'Reset your Diraschool password',
    html:    _resetTemplate({ firstName, resetUrl, expiresInHours }),
  });
};

// ── HTML Templates ────────────────────────────────────────────────────────────

const _shell = (title, body) => /* html */ `<!DOCTYPE html>
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

const _verifyTemplate = ({ firstName, schoolName, code, expiresInMinutes }) =>
  _shell(
    `Verify your email — ${schoolName}`,
    /* html */ `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Welcome to Diraschool, ${firstName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        You've successfully created an account for <strong>${schoolName}</strong>.
        Enter the code below to verify your email address and activate your account.
      </p>
      <div style="margin:28px 0;text-align:center;">
        <div style="display:inline-block;background:#f0f4ff;border:2px dashed #1a56db;
                    border-radius:10px;padding:20px 36px;">
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280;letter-spacing:.5px;text-transform:uppercase;">
            Verification Code
          </p>
          <p style="margin:0;font-size:38px;font-weight:700;color:#1a56db;letter-spacing:8px;
                    font-family:'Courier New',monospace;">
            ${code}
          </p>
        </div>
      </div>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        This code expires in <strong>${expiresInMinutes} minutes</strong>.
        If it expires, you can request a new one from the login screen.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you didn't create a Diraschool account, you can safely ignore this email.
      </p>
    `
  );

const _tempPasswordTemplate = ({ firstName, schoolName, tempPassword }) =>
  _shell(
    `Your login details — ${schoolName}`,
    /* html */ `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Hello ${firstName},</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        An account has been created for you on <strong>Diraschool</strong>
        for <strong>${schoolName}</strong>.
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        Use the temporary password below to log in. You will be asked to set a
        new password immediately after signing in.
      </p>
      <div style="margin:28px 0;text-align:center;">
        <div style="display:inline-block;background:#f0f4ff;border:2px dashed #1a56db;
                    border-radius:10px;padding:20px 36px;">
          <p style="margin:0 0 6px;font-size:13px;color:#6b7280;letter-spacing:.5px;text-transform:uppercase;">
            Temporary Password
          </p>
          <p style="margin:0;font-size:28px;font-weight:700;color:#1a56db;letter-spacing:4px;
                    font-family:'Courier New',monospace;">
            ${tempPassword}
          </p>
        </div>
      </div>
      <p style="margin:0 0 12px;font-size:13px;color:#ef4444;">
        ⚠ Do not share this password with anyone.
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;" />
      <p style="margin:0;font-size:13px;color:#6b7280;">
        If you weren't expecting this email, contact your school administrator.
      </p>
    `
  );

const _inviteTemplate = ({ firstName, schoolName, inviteUrl, expiresInDays }) =>
  _shell(
    `Invitation to ${schoolName}`,
    /* html */ `
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
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
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
    /* html */ `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Hello ${firstName},</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        We received a request to reset the password for your Diraschool account.
      </p>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        Click the button below to choose a new password.
        This link expires in <strong>${expiresInHours} hour${expiresInHours !== 1 ? 's' : ''}</strong>.
      </p>
      ${_btn(resetUrl, 'Reset My Password →')}
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
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
