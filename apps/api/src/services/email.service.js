/**
 * Email service — ZeptoMail SMTP via nodemailer.
 *
 * All transactional email goes through ZeptoMail.
 *
 * Required env vars:
 *   ZEPTOMAIL_API_KEY   — ZeptoMail dashboard → Mail Agents → SMTP tab → API key
 *   EMAIL_FROM          — "Diraschool <noreply@yourdomain.co.ke>"
 *
 * ZeptoMail domain setup:
 *   1. zeptomail.com → Mail Agents → Add Mail Agent → your domain
 *   2. Add the SPF + DKIM + bounce DNS records they provide
 *   3. Verify in dashboard → copy the API key from the SMTP tab
 *   SMTP username is always the literal string: emailapikey
 *   SMTP password is your API key
 *   Host: smtp.zeptomail.com   Port: 587   Security: STARTTLS
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const FROM = env.EMAIL_FROM ?? 'Diraschool <noreply@diraschool.co.ke>';

// ── ZeptoMail SMTP transport ──────────────────────────────────────────────────

let _transport = null;

const getTransport = () => {
  if (!_transport) {
    if (!env.ZEPTOMAIL_API_KEY) {
      throw new Error('[Email] ZEPTOMAIL_API_KEY is not set.');
    }
    _transport = nodemailer.createTransport({
      host:   env.ZEPTOMAIL_SERVER,   // smtp.zeptomail.com (or region variant)
      port:   587,
      secure: false,                  // STARTTLS on port 587
      auth: {
        user: env.ZEPTOMAIL_USERNAME, // always the literal string: emailapikey
        pass: env.ZEPTOMAIL_API_KEY,
      },
    });
  }
  return _transport;
};

// ── Core send ─────────────────────────────────────────────────────────────────

/**
 * @param {{ to: string, subject: string, html: string }} opts
 */
const sendEmail = ({ to, subject, html }) =>
  getTransport().sendMail({ from: FROM, to, subject, html });

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Verification email — 6-digit OTP for manual entry + one-click fallback link.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.firstName
 * @param {string} opts.schoolName
 * @param {string} opts.code              6-digit OTP
 * @param {string} opts.verifyUrl         One-click fallback link
 * @param {number} [opts.expiresInMinutes=30]
 */
export const sendVerificationEmail = ({ to, firstName, schoolName, code, verifyUrl, expiresInMinutes = 30 }) =>
  sendEmail({
    to,
    subject: `${code} — verify your Diraschool account`,
    html:    _verifyTemplate({ firstName, schoolName, code, verifyUrl, expiresInMinutes }),
  });

/**
 * Invitation email sent to a newly created staff member.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.firstName
 * @param {string} opts.schoolName
 * @param {string} opts.inviteUrl         Link to set password (expires in expiresInDays)
 * @param {number} [opts.expiresInDays=7]
 */
export const sendInviteEmail = ({ to, firstName, schoolName, inviteUrl, expiresInDays = 7 }) =>
  sendEmail({
    to,
    subject: `You've been added to ${schoolName} — set your password`,
    html:    _inviteTemplate({ firstName, schoolName, inviteUrl, expiresInDays }),
  });

/**
 * Password-reset email.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.firstName
 * @param {string} opts.resetUrl
 * @param {number} [opts.expiresInHours=1]
 */
export const sendPasswordResetEmail = ({ to, firstName, resetUrl, expiresInHours = 1 }) =>
  sendEmail({
    to,
    subject: 'Reset your Diraschool password',
    html:    _resetTemplate({ firstName, resetUrl, expiresInHours }),
  });

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

const _verifyTemplate = ({ firstName, schoolName, code, verifyUrl, expiresInMinutes }) =>
  _shell(
    `Verify your email — ${schoolName}`,
    /* html */ `
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Welcome to Diraschool, ${firstName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#374151;line-height:1.6;">
        You've successfully created an account for <strong>${schoolName}</strong>.
        Verify your email to activate it — use either option below.
      </p>

      <!-- Option 1: enter the code -->
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

      <!-- Divider -->
      <p style="text-align:center;font-size:13px;color:#9ca3af;margin:20px 0;">— or —</p>

      <!-- Option 2: click the link -->
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
