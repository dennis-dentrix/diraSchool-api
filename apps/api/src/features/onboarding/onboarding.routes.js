import express from 'express';
import { protect, blockIfMustChangePassword } from '../../middleware/auth.js';
import { getOnboardingStatus, completeOnboarding } from './onboarding.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword);

router.get('/status', getOnboardingStatus);
router.post('/complete', completeOnboarding);

export default router;
