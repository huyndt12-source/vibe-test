'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const db = require('./lib/db');
const auth = require('./lib/auth');
const csv = require('./lib/csv');
const adminPage = require('./lib/admin-page');
const { validateRegistration, validateScore } = require('./lib/validate');
const {
  sendJson, sendHtml, sendText, readJson, readForm, clientIp, createRateLimiter,
} = require('./lib/http');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PAGE_SIZE = 20;

// Thiếu ADMIN_USER / ADMIN_PASSWORD thì thoát ngay, không chạy với admin mở toang.
auth.readAdminCredentials();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
};

// docs 04 mục 9.3: 10 lượt đăng ký/phút/IP. Mục 9.6: 5 lần đăng nhập sai/10 phút.
const signupLimiter = createRateLimiter({ limit: 10, windowMs: 60 * 1000 });
const loginLimiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

setInterval(() => {
  signupLimiter.sweep();
  loginLimiter.sweep();
  auth.sweepSessions();
}, 5 * 60 * 1000).unref();

function toApiRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    bestScore: row.best_score,
    plays: row.plays,
    createdAt: csv.formatVn(row.created_at),
    lastPlayedAt: csv.formatVn(row.last_played_at),
  };
}

// ----- API cho người chơi -----

async function handleRegister(req, res) {
  const limit = signupLimiter.check(clientIp(req));
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    sendJson(res, 429, { error: 'Bạn thử quá nhiều lần. Chờ một phút rồi thử lại.' });
    return;
  }

  const body = await readJson(req, res);
  if (body === undefined) return;

  const check = validateRegistration(body);
  if (!check.ok) {
    sendJson(res, 400, { errors: check.errors });
    return;
  }

  const player = await db.upsertPlayer(check.data);
  sendJson(res, player.is_new ? 201 : 200, {
    playerId: player.id,
    fullName: player.full_name,
  });
}

async function handleScore(req, res, id) {
  const body = await readJson(req, res);
  if (body === undefined) return;

  const check = validateScore(body.score);
  if (!check.ok) {
    sendJson(res, 400, { error: check.error });
    return;
  }

  const updated = await db.addScore(id, check.value);
  if (!updated) {
    sendJson(res, 404, { error: 'Không tìm thấy người chơi.' });
    return;
  }
  sendJson(res, 200, { bestScore: updated.best_score, plays: updated.plays });
}

// ----- Admin -----

async function handleLogin(req, res) {
  const ip = clientIp(req);
  const limit = loginLimiter.check(ip);
  if (!limit.allowed) {
    sendHtml(res, 429, adminPage.loginPage({ message: 'Thử lại sau 10 phút.', blocked: true }));
    return;
  }

  const form = await readForm(req, res);
  if (form === undefined) return;

  if (!auth.checkLogin(form.username, form.password)) {
    // Không nói rõ sai tên hay sai mật khẩu.
    sendHtml(res, 401, adminPage.loginPage({
      message: 'Tên đăng nhập hoặc mật khẩu không đúng.',
    }));
    return;
  }

  loginLimiter.reset(ip);
  const token = auth.createSession();
  res.writeHead(303, { Location: '/admin', 'Set-Cookie': auth.cookieHeader(token) }).end();
}

function handleLogout(req, res) {
  auth.destroySession(req);
  res.writeHead(303, { Location: '/admin', 'Set-Cookie': auth.clearCookieHeader() }).end();
}

async function handleAdminList(req, res, url) {
  const q = (url.searchParams.get('q') || '').trim();
  const sort = url.searchParams.get('sort') || 'created_at';
  const dir = url.searchParams.get('dir') || 'desc';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);

  const result = await db.listPlayers({ q, sort, dir, page, limit: PAGE_SIZE });
  sendJson(res, 200, {
    total: result.total,
    page,
    pageSize: PAGE_SIZE,
    rows: result.rows.map(toApiRow),
  });
}

async function handleAdminCsv(req, res, url) {
  const q = (url.searchParams.get('q') || '').trim();
  const sort = url.searchParams.get('sort') || 'created_at';
  const dir = url.searchParams.get('dir') || 'desc';

  // limit null: xuất đúng tập đang lọc, bỏ qua phân trang (FN-29).
  const result = await db.listPlayers({ q, sort, dir, limit: null });
  const body = csv.build(result.rows);
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${csv.fileName()}"`,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function handleAdminDelete(req, res, id) {
  const count = await db.deletePlayer(id);
  if (count === 0) {
    sendJson(res, 404, { error: 'Bản ghi đã được xoá trước đó.' });
    return;
  }
  sendJson(res, 200, { deleted: count });
}

// ----- Static -----

function serveStatic(req, res, pathname) {
  let target = pathname;
  if (target.endsWith('/')) target += 'index.html';

  const filePath = path.join(ROOT, target);
  // Chặn path traversal: chỉ phục vụ file bên trong ROOT.
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.log(`404 ${req.method} ${target}`);
      sendText(res, 404, 'Not Found');
      return;
    }
    const type = TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    console.log(`200 ${req.method} ${target}`);
    res.writeHead(200, { 'Content-Type': type }).end(data);
  });
}

// ----- Router -----

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    sendText(res, 400, 'Bad Request');
    return;
  }
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method || 'GET';

  try {
    // --- API người chơi (không cần đăng nhập) ---
    if (pathname === '/api/players' && method === 'POST') {
      await handleRegister(req, res);
      return;
    }
    const scoreMatch = pathname.match(/^\/api\/players\/(\d+)\/score$/);
    if (scoreMatch && method === 'POST') {
      await handleScore(req, res, Number(scoreMatch[1]));
      return;
    }

    // --- Đăng nhập / đăng xuất admin ---
    if (pathname === '/admin/login' && method === 'POST') {
      await handleLogin(req, res);
      return;
    }
    if (pathname === '/admin/logout' && method === 'POST') {
      handleLogout(req, res);
      return;
    }

    // --- Mọi thứ khác dưới /admin và /api/admin đều cần phiên hợp lệ (FN-30) ---
    const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
    if (isAdminArea && !auth.isValidSession(req)) {
      if (pathname.startsWith('/api/admin/')) {
        sendJson(res, 401, { error: 'Cần đăng nhập.' });
      } else {
        // Trả thẳng form đăng nhập, không chuyển hướng, không kèm dữ liệu nào.
        sendHtml(res, 401, adminPage.loginPage());
      }
      return;
    }

    if (pathname === '/admin' && method === 'GET') {
      sendHtml(res, 200, adminPage.listPage());
      return;
    }
    if (pathname === '/admin/admin.js' && method === 'GET') {
      const body = fs.readFileSync(path.join(ROOT, 'lib', 'admin-client.js'));
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      }).end(body);
      return;
    }
    if (pathname === '/api/admin/players.csv' && method === 'GET') {
      await handleAdminCsv(req, res, url);
      return;
    }
    if (pathname === '/api/admin/players' && method === 'GET') {
      await handleAdminList(req, res, url);
      return;
    }
    const delMatch = pathname.match(/^\/api\/admin\/players\/(\d+)$/);
    if (delMatch && method === 'DELETE') {
      await handleAdminDelete(req, res, Number(delMatch[1]));
      return;
    }
    if (isAdminArea) {
      sendText(res, 404, 'Not Found');
      return;
    }

    // --- Game ---
    if (pathname === '/') {
      res.writeHead(302, { Location: '/app/' }).end();
      return;
    }
    serveStatic(req, res, pathname);
  } catch (err) {
    // Không bao giờ để một yêu cầu lỗi làm sập tiến trình.
    console.error(`[500] ${method} ${pathname}:`, err.message);
    if (res.headersSent) {
      res.end();
      return;
    }
    const busy = err.code === '57014' || /timeout|ECONNREFUSED/i.test(err.message);
    if (pathname.startsWith('/api/')) {
      sendJson(res, busy ? 503 : 500, {
        error: busy ? 'Hệ thống đang bận, thử lại sau.' : 'Lỗi hệ thống.',
      });
    } else {
      sendText(res, busy ? 503 : 500, busy ? 'Hệ thống đang bận, thử lại sau.' : 'Lỗi hệ thống.');
    }
  }
});

db.init()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Game Đập Chuột đang chạy tại http://localhost:${PORT}`);
      console.log(`Trang quản trị: http://localhost:${PORT}/admin`);
    });
  })
  .catch((err) => {
    console.error('[db] không kết nối được database, thoát:', err.message);
    process.exit(1);
  });

process.on('SIGTERM', () => {
  server.close(() => db.pool.end().then(() => process.exit(0), () => process.exit(0)));
});
