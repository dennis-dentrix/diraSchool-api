import express from 'express';
import { protect, blockIfMustChangePassword } from '../../middleware/auth.js';
import { getDashboard } from './dashboard.controller.js';

const router = express.Router();

// Protected — must be logged in and have changed their temp password
router.get('/', protect, blockIfMustChangePassword, getDashboard);

export default router;
