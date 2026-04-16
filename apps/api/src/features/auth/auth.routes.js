import express from 'express';
import rateLimit from 'express-rate-limit';
import {
<<<<<<< HEAD
  registerSchool,
  login,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
  acceptInvite,
  verifyEmail,
  verifyEmailByToken,
  resendVerification,
=======
  registerSchool, login, logout, getMe, changePassword,
  forgotPassword, resetPassword, acceptInvite,
  verifyEmail, resendVerification,
>>>>>>> efe73423fd6ede0a8ef64087cc643b364dbf41b5
} from './auth.controller.js';
import {
  validateRegisterSchool,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateAcceptInvite,
  validateResendVerification,
<<<<<<< HEAD
  validateVerifyEmail,
=======
>>>>>>> efe73423fd6ede0a8ef64087cc643b364dbf41b5
} from './auth.validator.js';
import { protect, blockIfMustChangePassword } from '../../middleware/auth.js';

const router = express.Router();

// Tight rate limit on auth endpoints — 20 requests per 15 minutes
// Disabled in test environment so the test suite doesn't hit the limit
const authLimiter =
  process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: { message: 'Too many attempts. Please try again in 15 minutes.' },
        standardHeaders: true,
        legacyHeaders: false,
      });

// ── Public routes ─────────────────────────────────────────────────────────────
<<<<<<< HEAD
router.post('/register', authLimiter, validateRegisterSchool, registerSchool);
router.post('/login', authLimiter, validateLogin, login);
router.post('/forgot-password', authLimiter, validateForgotPassword, forgotPassword);
router.post('/reset-password/:token', validateResetPassword, resetPassword);
router.post('/accept-invite/:token', validateAcceptInvite, acceptInvite);
router.post('/verify-email', authLimiter, validateVerifyEmail, verifyEmail);
router.get('/verify-email/:token', verifyEmailByToken);
router.post('/resend-verification', authLimiter, validateResendVerification, resendVerification);
=======
router.post('/register',       authLimiter, validateRegisterSchool, registerSchool);
router.post('/login',          authLimiter, validateLogin,          login);
router.post('/forgot-password',       authLimiter, validateForgotPassword,      forgotPassword);
router.post('/reset-password/:token',             validateResetPassword,       resetPassword);
router.post('/accept-invite/:token',              validateAcceptInvite,        acceptInvite);
router.get( '/verify-email/:token',                                            verifyEmail);
router.post('/resend-verification',   authLimiter, validateResendVerification, resendVerification);
>>>>>>> efe73423fd6ede0a8ef64087cc643b364dbf41b5

// ── Protected routes ──────────────────────────────────────────────────────────
router.post('/logout', protect, logout);
router.get('/me', protect, blockIfMustChangePassword, getMe);

// Change-password is accessible even when mustChangePassword = true (that's the point)
router.post('/change-password', protect, validateChangePassword, changePassword);

export default router;
