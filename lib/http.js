'use strict';

const MAX_BODY_BYTES = 4 * 1024; // docs 04 mục 9.3: thân yêu cầu tối đa 4KB.

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendHtml(res, status, html, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(html);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

// Đọc thân yêu cầu với giới hạn kích thước; vượt -> 413 và ngắt kết nối.
function readBody(req, res) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        done = true;
        sendJson(res, 413, { error: 'Dữ liệu gửi lên quá lớn.' });
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', () => {
      if (done) return;
      done = true;
      resolve(null);
    });
  });
}

async function readJson(req, res) {
  const raw = await readBody(req, res);
  if (raw === null) return undefined; // phản hồi đã được gửi
  try {
    const parsed = JSON.parse(raw || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    sendJson(res, 400, { error: 'JSON không hợp lệ.' });
    return undefined;
  }
}

async function readForm(req, res) {
  const raw = await readBody(req, res);
  if (raw === null) return undefined;
  const params = new URLSearchParams(raw || '');
  return Object.fromEntries(params.entries());
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

// Địa chỉ dùng cho giới hạn tần suất. Chỉ tin X-Forwarded-For khi được bật rõ ràng
// bằng TRUST_PROXY, vì header này client nào cũng đặt được.
function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Bộ đếm theo cửa sổ thời gian, giữ trong bộ nhớ (docs 04 mục 9.3 và 9.6).
function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return {
    check(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || now > entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSec: 0 };
      }
      entry.count += 1;
      if (entry.count > limit) {
        return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
      }
      return { allowed: true, retryAfterSec: 0 };
    },
    reset(key) {
      hits.delete(key);
    },
    sweep() {
      const now = Date.now();
      for (const [key, entry] of hits) if (now > entry.resetAt) hits.delete(key);
    },
  };
}

module.exports = {
  sendJson,
  sendHtml,
  sendText,
  readJson,
  readForm,
  parseCookies,
  clientIp,
  escapeHtml,
  createRateLimiter,
  MAX_BODY_BYTES,
};
