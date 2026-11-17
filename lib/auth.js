'use strict';

const crypto = require('crypto');
const { parseCookies } = require('./http');

// docs/04-quy-tac-du-lieu.html mục 9.6.
const COOKIE_NAME = 'dapchuot_admin';
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 giờ

// Token phiên giữ trong bộ nhớ: khởi động lại container thì mọi phiên mất hiệu lực.
const sessions = new Map();

function readAdminCredentials() {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  const missing = [];
  if (!user) missing.push('ADMIN_USER');
  if (!password) missing.push('ADMIN_PASSWORD');
  if (missing.length > 0) {
    // FN-25: thiếu biến thì KHÔNG khởi động, thay vì mở toang trang admin.
    console.error(
      `[config] Thiếu biến môi trường: ${missing.join(', ')}.\n` +
      '         Sao chép .env.example thành .env và điền giá trị trước khi chạy.'
    );
    process.exit(1);
  }
  return { user, password };
}

// So sánh thời gian cố định, không dùng === trên chuỗi.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  if (bufA.length !== bufB.length) {
    // Vẫn so sánh một lần để thời gian không phụ thuộc độ dài.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function checkLogin(username, password) {
  const creds = readAdminCredentials();
  const okUser = safeEqual(username || '', creds.user);
  const okPass = safeEqual(password || '', creds.password);
  return okUser && okPass;
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_MS });
  return token;
}

function isValidSession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function destroySession(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (token) sessions.delete(token);
}

function cookieHeader(token) {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  ];
  if (process.env.COOKIE_SECURE === '1') parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

function sweepSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) if (now > session.expiresAt) sessions.delete(token);
}

module.exports = {
  readAdminCredentials,
  checkLogin,
  createSession,
  isValidSession,
  destroySession,
  cookieHeader,
  clearCookieHeader,
  sweepSessions,
  COOKIE_NAME,
};
