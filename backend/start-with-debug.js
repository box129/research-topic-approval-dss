#!/usr/bin/env node
/**
 * Debug startup script - logs all errors and startup phases
 */

console.log('🔍 [DEBUG] Starting backend with debug logging...');
console.log(`🔍 [DEBUG] Node version: ${process.version}`);
console.log(`🔍 [DEBUG] Working directory: ${process.cwd()}`);
console.log(`🔍 [DEBUG] NODE_ENV: ${process.env.NODE_ENV}`);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ [UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [UNHANDLED REJECTION]', reason);
  process.exit(1);
});

console.log('🔍 [DEBUG] Loading configuration...');
const config = require('./src/config/env');
console.log(`✅ Config loaded: env=${config.env}, port=${config.port}`);

console.log('🔍 [DEBUG] Creating Express app...');
const app = require('./src/server');
app.startServer();
console.log('✅ Express app created');

console.log('🔍 [DEBUG] Server will attempt to bind to port ' + config.port);
console.log('🔍 [DEBUG] Waiting for startup...');

// startServer() owns the listen call and installs graceful signal handling.
setTimeout(() => {
  console.log('🔍 [DEBUG] Startup complete. Server should be running.');
}, 2000);
