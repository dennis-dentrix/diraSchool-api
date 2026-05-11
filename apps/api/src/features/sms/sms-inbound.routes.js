/**
 * SMS Inbound route — public endpoint called by SMS forwarders/providers.
 * No JWT auth (providers cannot send auth headers), but protected by rate limiting
 * at the server level.
 */
import express from 'express';
import { handleInboundSms } from './sms-inbound.controller.js';

const router = express.Router();

// Some providers send form-encoded POST; simple SMS forwarders often send JSON.
router.post('/inbound', handleInboundSms);

export default router;
