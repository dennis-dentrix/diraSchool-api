import { env } from './env.js';

const allowedOrigins = [
  env.CLIENT_URL,
  env.CLIENT_URL_STAGING,
  // Local dev
  'http://localhost:3001',
  'http://localhost:5173',
  // Production — browsers always include scheme, so both www and bare domain needed
  'https://diraschool.com',
  'https://www.diraschool.com',
].filter(Boolean);

export const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, mobile apps, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS policy`));
  },
  credentials: true, // Required for HTTP-only cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
