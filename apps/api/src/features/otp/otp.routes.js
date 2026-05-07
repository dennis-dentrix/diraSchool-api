import { Router } from 'express';
import { protect, blockIfMustChangePassword } from '../../middleware/auth.js';
import { sendOtp, verifyOtp } from './otp.controller.js';

const router = Router();

router.use(protect, blockIfMustChangePassword);

router.post('/send',   sendOtp);
router.post('/verify', verifyOtp);

export default router;
