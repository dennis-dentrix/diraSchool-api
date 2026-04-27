/**
 * SMS Inbound route — public endpoint called by Africa's Talking.
 * No JWT auth (AT cannot send auth headers), but protected by rate limiting
 * at the server level.
 */
import express from 'express';
import { handleInboundSms } from './sms-inbound.controller.js';

const router = express.Router();

// Africa's Talking sends form-encoded POST when school's number receives an SMS.
router.post('/inbound', handleInboundSms);

export default router;
