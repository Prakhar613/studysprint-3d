'use strict';
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const IS_PROD = process.env.NODE_ENV === 'production';

module.exports = {
  ROOT,
  DATA_DIR,
  IS_PROD,
  PORT: Number(process.env.PORT) || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  DB_PATH: process.env.DB_PATH || path.join(DATA_DIR, 'studysprint.db'),
  // Secure cookies need HTTPS. Browsers still accept them on http://localhost.
  COOKIE_SECURE: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : IS_PROD,
  // Set TRUST_PROXY=true only when running behind a reverse proxy you control (Nginx, Render, Fly, ...).
  TRUST_PROXY: process.env.TRUST_PROXY === 'true',
  ADMIN_USERS: (process.env.ADMIN_USERS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  SYNC_QUESTIONS: process.env.SYNC_QUESTIONS !== 'false',
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || '',
  // AI tutor. Set ONE provider key to switch it on (leave all empty to switch it off; the rest of the site is unaffected).
  // Free options: GROQ_API_KEY (recommended) or GEMINI_API_KEY. Also supported: OPENROUTER_API_KEY, ANTHROPIC_API_KEY.
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  TUTOR_PROVIDER: (process.env.TUTOR_PROVIDER || '').toLowerCase(), // groq | gemini | openrouter | anthropic (default: whichever key is set)
  TUTOR_API_KEY: process.env.TUTOR_API_KEY || '', // optional: one generic key for the chosen provider
  TUTOR_MODEL: process.env.TUTOR_MODEL || '', // optional: override the provider's default model
  TUTOR_API_URL: process.env.TUTOR_API_URL || '', // optional: override the endpoint (used by tests)
  TUTOR_DAILY_LIMIT: Number(process.env.TUTOR_DAILY_LIMIT) || 40, // messages per student per IST day
  SESSION_DAYS: 30,
};
