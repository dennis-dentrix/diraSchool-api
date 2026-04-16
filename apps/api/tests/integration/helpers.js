/**
 * Shared test helpers for integration tests.
 *
 * registerAndLogin — registers a school + admin, bypasses email verification
 * (we write the verified flag directly to the DB so tests don't need to
 * simulate the email flow), then logs in and returns an authenticated agent.
 */
import request from 'supertest';
import User from '../../src/features/users/User.model.js';

/**
 * Register a school + admin, mark the account as email-verified in the DB,
 * then log in and return a cookie-carrying supertest agent.
 *
 * @param {import('express').Application} app  Express app instance
 * @param {object} schoolData  Registration payload (must include email + password)
 * @returns {Promise<import('supertest').Agent>}
 */
export async function registerAndLogin(app, schoolData) {
  // 1. Register — creates school + admin (no cookie returned; must verify email first)
  await request(app).post('/api/v1/auth/register').send(schoolData);

  // 2. Bypass the email-verification step by writing directly to the DB
  await User.updateOne(
    { email: schoolData.email.toLowerCase() },
    {
      $set:   { emailVerified: true },
      $unset: { emailVerificationCode: 1, emailVerificationToken: 1, emailVerificationExpiry: 1 },
    }
  );

  // 3. Log in and capture the session cookie
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send({
    email:    schoolData.email,
    password: schoolData.password,
  });

  return agent;
}
