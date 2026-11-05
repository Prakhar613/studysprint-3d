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
  SESSION_DAYS: 30,
};
