/**
 * Email service — wraps Resend.
 *
 * All outbound email goes through this module so the delivery provider can be
 * swapped without touching any feature code.
 *
 * Resend docs: https://resend.com/docs
 * Free tier  : 3,000 emails/month, 100/day — enough for an MVP.
 *
 * Required env var:
 *   RESEND_API_KEY — get from https://resend.com/api-keys
 *   EMAIL_FROM     — e.g. "Diraschool <noreply@diraschool.co.ke>"
 *                    Must match a verified domain in your Resend dashboard.
 *                    Falls back to the Resend sandbox sender for dev.
 */
import { Resend } from 'resend';
import { env } from '../config/env.js';

let _resend = null;

/**
 * Returns (and lazily creates) the Resend client.
 * Throws clearly when the API key is missing — better than a cryptic 401.
 */
const client = () => {
  if (!_resend) {
    if (!env.RESEND_API_KEY) {
      throw new Error('[Email] RESEND_API_KEY is not set. Email delivery is disabled.');
    }
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
};

// Default sender — override with EMAIL_FROM env var once you verify a domain.
// The onboarding@resend.dev address works for testing without domain verification.
const FROM = env.EMAIL_FROM ?? 'Diraschool <onboarding@resend.dev>';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send an account invitation email to a newly created staff member.
 *
 * @param {object} opts
 * @param {string} opts.to          Recipient email address
 * @param {string} opts.firstName   Recipient first name (personalisation)
 * @param {string} opts.schoolName  School display name
 * @param {string} opts.inviteUrl   Full URL the user clicks to set their password
 * @param {number} [opts.expiresInDays=7]
 */
export const sendInviteEmail = async ({ to, firstName, schoolName, inviteUrl, expiresInDays = 7 }) => {
  return client().emails.send({
    from:    FROM,
    to,
    subject: `You've been added to ${schoolName} — set your password`,
    html:    _inviteTemplate({ firstName, schoolName, inviteUrl, expiresInDays }),
  });
};

/**
 * Send a password-reset email.
 *
 * @param {object} opts
 * @param {string} opts.to             Recipient email address
 * @param {string} opts.firstName      Recipient first name
 * @param {string} opts.resetUrl       Full URL with embedded reset token
 * @param {number} [opts.expiresInHours=1]
 */
export const sendPasswordResetEmail = async ({ to, firstName, resetUrl, expiresInHours = 1 }) => {
  return client().emails.send({
    from:    FROM,
    to,
    subject: 'Reset your Diraschool password',
    html:    _resetTemplate({ firstName, resetUrl, expiresInHours }),
  });
};

// ── HTML Templates ────────────────────────────────────────────────────────────
// Plain inline-CSS HTML — works in every email client including Gmail.

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
          <!-- Header -->
          <tr>
            <td style="background:#1a56db;padding:28px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:.5px;">
                Diraschool
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
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
