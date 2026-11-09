'use strict';
const http = require('node:http');
const config = require('./src/config');
const { createRouter, createHandler } = require('./src/http');
const { userFromRequest, cleanupSessions } = require('./src/auth');
const bank = require('./src/questionBank');
const hub = require('./src/hub');
const { sentinelUserId } = require('./src/db');

function createServer() {
  sentinelUserId();
  bank.seedLocal();

  const router = createRouter();
  for (const name of ['auth', 'quiz', 'contests', 'progress', 'community', 'chat', 'content', 'tutor']) {
    require(`./src/routes/${name}`).register(router);
  }
  const handler = createHandler(router, {
    beforeApi(req) {
      req.user = userFromRequest(req);
    },
  });
  const server = http.createServer(handler);
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  return server;
}

function start() {
  const server = createServer();
  bank.startSync();
  cleanupSessions();
  const sweep = setInterval(cleanupSessions, 6 * 60 * 60 * 1000);
  sweep.unref();

  server.listen(config.PORT, config.HOST, () => {
    console.log(`StudySprint is running on http://localhost:${config.PORT} (${config.IS_PROD ? 'production' : 'development'})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    hub.closeAll();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (require.main === module) start();

module.exports = { createServer };
