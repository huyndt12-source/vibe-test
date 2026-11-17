'use strict';

const { Pool } = require('pg');

// Lược đồ theo docs/04-quy-tac-du-lieu.html mục 9.1.
// Email lưu ở dạng chữ thường (chuẩn hóa trong lib/validate.js) nên ràng buộc
// UNIQUE bắt được cả "An@vd.com" và "an@vd.com" mà không cần extension citext.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id             SERIAL PRIMARY KEY,
  full_name      TEXT        NOT NULL,
  email          TEXT        NOT NULL UNIQUE,
  phone          TEXT        NOT NULL,
  best_score     INTEGER     NOT NULL DEFAULT 0,
  plays          INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_played_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_players_created_at ON players (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_full_name  ON players (full_name);
CREATE INDEX IF NOT EXISTS idx_players_phone      ON players (phone);
`;

const pool = new Pool({
  host: process.env.PGHOST || 'db',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Lỗi của client đang nằm im trong pool không được làm sập tiến trình.
pool.on('error', (err) => {
  console.error('[db] lỗi client trong pool:', err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

// Chờ database sẵn sàng rồi tạo bảng. Compose đã có healthcheck, nhưng vẫn thử
// lại để không phụ thuộc hoàn toàn vào thứ tự khởi động.
async function init({ retries = 10, delayMs = 2000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      await pool.query(SCHEMA);
      console.log('[db] đã kết nối và bảo đảm lược đồ players');
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`[db] chưa kết nối được (${err.message}) — thử lại ${attempt}/${retries}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ----- Người chơi -----

// FN-22: email mới thì thêm, email đã có thì cập nhật tên + điện thoại mới nhất.
// created_at, best_score và plays của bản ghi cũ được giữ nguyên.
async function upsertPlayer({ fullName, email, phone }) {
  const sql = `
    INSERT INTO players (full_name, email, phone)
    VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          phone     = EXCLUDED.phone
    RETURNING id, full_name, (created_at = now()) AS is_new`;
  const { rows } = await query(sql, [fullName, email, phone]);
  return rows[0];
}

// FN-23: plays luôn +1; best_score chỉ tăng, không bao giờ giảm.
async function addScore(id, score) {
  const sql = `
    UPDATE players
       SET plays          = plays + 1,
           best_score     = GREATEST(best_score, $2),
           last_played_at = now()
     WHERE id = $1
    RETURNING best_score, plays`;
  const { rows } = await query(sql, [id, score]);
  return rows[0] || null;
}

const SORT_COLUMNS = {
  full_name: 'full_name',
  email: 'email',
  phone: 'phone',
  best_score: 'best_score',
  plays: 'plays',
  created_at: 'created_at',
  last_played_at: 'last_played_at',
};

// Escape % và _ để từ khóa tìm kiếm không biến thành ký tự đại diện (TC-71).
function likePattern(q) {
  return `%${String(q).replace(/([%_\\])/g, '\\$1')}%`;
}

// FN-26, FN-27. limit = null nghĩa là lấy hết, dùng cho xuất CSV (FN-29).
async function listPlayers({ q = '', sort = 'created_at', dir = 'desc', page = 1, limit = 20 } = {}) {
  const column = SORT_COLUMNS[sort] || 'created_at';
  const direction = String(dir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const where = q ? 'WHERE full_name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1' : '';
  const params = q ? [likePattern(q)] : [];

  const countSql = `SELECT COUNT(*)::int AS total FROM players ${where}`;
  const { rows: countRows } = await query(countSql, params);
  const total = countRows[0].total;

  let sql = `
    SELECT id, full_name, email, phone, best_score, plays, created_at, last_played_at
      FROM players ${where}
     ORDER BY ${column} ${direction}, id DESC`;
  if (limit !== null) {
    const safePage = Math.max(1, Number(page) || 1);
    sql += ` LIMIT ${Number(limit)} OFFSET ${(safePage - 1) * Number(limit)}`;
  }
  const { rows } = await query(sql, params);
  return { total, rows };
}

async function deletePlayer(id) {
  const { rowCount } = await query('DELETE FROM players WHERE id = $1', [id]);
  return rowCount;
}

module.exports = { init, query, upsertPlayer, addScore, listPlayers, deletePlayer, pool };
