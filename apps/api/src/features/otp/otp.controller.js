/**
 * OTP controller — parent phone number verification via SMS.
 *
 * POST /api/v1/otp/send   — generate & send a 6-digit OTP to the parent's phone
 * POST /api/v1/otp/verify — verify the OTP and mark phoneVerified = true
 *
 * Rate limiting:
 *   - Max 3 send attempts per phone per 10-minute window (tracked in Redis)
 *   - OTP expires after 10 minutes
 *   - Max 5 verify attempts before the OTP is invalidated
 */
import crypto from 'node:crypto';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { getRedis } from '../../config/redis.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import User from '../users/User.model.js';
import { ROLES } from '../../constants/index.js';
import { normalisePhone, isValidKenyanPhone } from '../sms/sms-inbound.controller.js';
import {
  sendViaConfiguredSmsProvider,
  smsProviderConfigured,
  smsProviderName,
} from '../sms/sms-provider.service.js';

const OTP_TTL_SECONDS    = 10 * 60;   // 10 minutes
const MAX_SEND_ATTEMPTS  = 3;
const MAX_VERIFY_ATTEMPTS = 5;

function otpKey(phone)         { return `otp:code:${phone}`; }
function sendRateKey(phone)    { return `otp:send_rate:${phone}`; }
function verifyRateKey(phone)  { return `otp:verify_rate:${phone}`; }

function generateOtp() {
  return String(crypto.randomInt(100000, 999999));
}

/**
 * POST /api/v1/otp/send
 * Body: { phone: string }
 * Auth: protected — parent role only
 */
export const sendOtp = asyncHandler(async (req, res) => {
  const redis = getRedis();
  if (!redis) return sendError(res, 'OTP service temporarily unavailable.', 503);

  const rawPhone = req.body?.phone ?? req.user?.phone;
  const phone = normalisePhone(rawPhone);
  if (!phone || !isValidKenyanPhone(phone)) {
    return sendError(res, 'A valid Kenyan phone number is required.', 400);
  }

  if (req.user.role !== ROLES.PARENT) {
    return sendError(res, 'Phone verification is for parent accounts only.', 403);
  }

  if (req.user.phoneVerified) {
    return sendError(res, 'Phone number is already verified.', 400);
  }

  // Rate limit: max 3 sends per 10 minutes per phone
  const rateKey   = sendRateKey(phone);
  const sendCount = await redis.incr(rateKey);
  if (sendCount === 1) await redis.expire(rateKey, OTP_TTL_SECONDS);
  if (sendCount > MAX_SEND_ATTEMPTS) {
    return sendError(res, 'Too many OTP requests. Please wait 10 minutes before trying again.', 429);
  }

  const otp = generateOtp();
  await redis.setex(otpKey(phone), OTP_TTL_SECONDS, JSON.stringify({ otp, attempts: 0 }));

  if (!smsProviderConfigured()) {
    return sendError(res, `SMS provider is not configured on this server (${smsProviderName()}).`, 503);
  }

  // Send via configured SMS provider
  try {
    await sendViaConfiguredSmsProvider({
      recipients: [phone],
      message: `Your Diraschool verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`,
      senderId: env.AT_SENDER_ID,
    });
    logger.info('[OTP] Sent', { phone, provider: smsProviderName(), userId: req.user._id });
  } catch (err) {
    logger.error('[OTP] SMS send failed', { phone, provider: smsProviderName(), err: err.message });
    return sendError(res, 'Failed to send OTP. Please try again.', 502);
  }

  return sendSuccess(res, { message: `OTP sent to ${phone}. Valid for 10 minutes.` });
});

/**
 * POST /api/v1/otp/verify
 * Body: { phone: string, otp: string }
 * Auth: protected — parent role only
 */
export const verifyOtp = asyncHandler(async (req, res) => {
  const redis = getRedis();
  if (!redis) return sendError(res, 'OTP service temporarily unavailable.', 503);

  const { otp: submittedOtp } = req.body;
  const rawPhone = req.body?.phone ?? req.user?.phone;
  const phone = normalisePhone(rawPhone);

  if (!phone || !isValidKenyanPhone(phone)) {
    return sendError(res, 'A valid Kenyan phone number is required.', 400);
  }
  if (!submittedOtp) {
    return sendError(res, 'OTP is required.', 400);
  }

  // Max verify attempts
  const verifyRKey = verifyRateKey(phone);
  const verifyCount = await redis.incr(verifyRKey);
  if (verifyCount === 1) await redis.expire(verifyRKey, OTP_TTL_SECONDS);
  if (verifyCount > MAX_VERIFY_ATTEMPTS) {
    await redis.del(otpKey(phone));
    return sendError(res, 'Too many incorrect attempts. Please request a new OTP.', 429);
  }

  const stored = await redis.get(otpKey(phone));
  if (!stored) {
    return sendError(res, 'OTP expired or not found. Please request a new one.', 400);
  }

  const { otp: correctOtp } = JSON.parse(stored);

  // Constant-time comparison to prevent timing attacks
  const match = crypto.timingSafeEqual(
    Buffer.from(submittedOtp.trim().padEnd(6, '0')),
    Buffer.from(correctOtp.padEnd(6, '0'))
  );

  if (!match) {
    return sendError(res, 'Incorrect OTP. Please try again.', 400);
  }

  // Valid — mark phone as verified, clean up Redis
  await Promise.all([
    redis.del(otpKey(phone)),
    redis.del(verifyRKey),
    redis.del(sendRateKey(phone)),
    User.findByIdAndUpdate(req.user._id, { phoneVerified: true, phone }),
  ]);

  logger.info('[OTP] Phone verified', { phone, userId: req.user._id });

  return sendSuccess(res, { message: 'Phone number verified successfully.' });
});
