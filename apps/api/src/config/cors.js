import { env } from './env.js';

const allowedOrigins = [
  env.CLIENT_URL,
  env.CLIENT_URL_STAGING,
  'http://localhost:3001',
  'http://localhost:5173',
  'https://www.diraschool.com',
  'www.diraschool.com',
  'diraschool.com',
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
