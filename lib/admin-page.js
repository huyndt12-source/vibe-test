'use strict';

const { escapeHtml } = require('./http');

const HEAD = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Quản trị — Đập Chuột</title>
<link rel="stylesheet" href="/design/tokens.css">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    background: var(--color-bg, #fdf6ec);
    color: var(--color-ink-900, #1d1b1a);
    font-family: var(--font-body, system-ui, sans-serif);
    font-size: var(--text-base, 1rem);
    line-height: 1.5;
  }
  a { color: inherit; }
  .bar {
    display: flex; align-items: center; justify-content: space-between; gap: 1rem;
    padding: .85rem 1.25rem;
    background: var(--color-ink-900, #1d1b1a); color: #fff;
  }
  .bar__title { margin: 0; font-family: var(--font-display, inherit); font-size: var(--text-xl, 1.25rem); }
  .wrap { max-width: 78rem; margin: 0 auto; padding: 1.25rem; }
  .tools { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; margin-bottom: 1rem; }
  .tools form { display: flex; gap: .5rem; flex: 1 1 18rem; }
  input[type="search"], input[type="text"], input[type="password"] {
    flex: 1; min-width: 0;
    padding: .6rem .75rem; min-height: 44px;
    border: 2px solid var(--color-ink-900, #1d1b1a);
    border-radius: var(--radius-sm, .5rem);
    background: #fff; color: inherit; font: inherit;
  }
  input:focus-visible, button:focus-visible, th button:focus-visible {
    outline: 3px solid var(--color-focus, #2563eb); outline-offset: 2px;
  }
  .btn {
    padding: .6rem 1rem; min-height: 44px;
    border: 2px solid var(--color-ink-900, #1d1b1a);
    border-radius: var(--radius-sm, .5rem);
    background: var(--color-accent, #ffd166); color: var(--color-ink-900, #1d1b1a);
    font: inherit; font-weight: 700; cursor: pointer;
  }
  .btn--ghost { background: #fff; }
  .btn--danger { background: var(--color-danger, #d64545); color: #fff; border-color: var(--color-danger, #d64545); }
  .btn[disabled] { opacity: .5; cursor: not-allowed; }
  .table-wrap { overflow-x: auto; border: 2px solid var(--color-ink-900, #1d1b1a); border-radius: var(--radius-md, .75rem); background: #fff; }
  table { border-collapse: collapse; width: 100%; min-width: 56rem; }
  th, td { padding: .6rem .75rem; text-align: left; border-bottom: 1px solid rgba(0,0,0,.12); white-space: nowrap; }
  th { background: var(--color-surface-alt, #f6ecd9); font-size: var(--text-sm, .9rem); }
  th button { background: none; border: 0; padding: 0; font: inherit; font-weight: 700; cursor: pointer; text-decoration: underline dotted; }
  td.mono, th.mono { font-family: var(--font-mono, ui-monospace, monospace); }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tbody tr:nth-child(even) { background: rgba(0,0,0,.025); }
  .empty { padding: 2rem 1rem; text-align: center; }
  .pager { display: flex; gap: .75rem; align-items: center; justify-content: center; margin-top: 1rem; }
  .live { margin: .75rem 0 0; min-height: 1.5rem; font-weight: 700; }
  dialog { border: 2px solid var(--color-ink-900, #1d1b1a); border-radius: var(--radius-md, .75rem); padding: 1.25rem; max-width: 26rem; }
  dialog::backdrop { background: rgba(0,0,0,.5); }
  .dialog__actions { display: flex; gap: .75rem; justify-content: flex-end; margin-top: 1.25rem; }
  .login { max-width: 24rem; margin: 4rem auto; padding: 1.5rem; background: #fff; border: 2px solid var(--color-ink-900, #1d1b1a); border-radius: var(--radius-md, .75rem); }
  .login h1 { margin-top: 0; font-family: var(--font-display, inherit); }
  .login label { display: block; margin: .85rem 0 .3rem; font-weight: 700; }
  .login input { width: 100%; }
  .login .btn { width: 100%; margin-top: 1.25rem; }
  .alert { margin: 0 0 1rem; padding: .75rem; border-radius: var(--radius-sm, .5rem); background: #fdecea; color: #8a1c1c; border: 1px solid #d64545; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
</style>
</head>
<body>`;

function loginPage({ message = '', blocked = false } = {}) {
  return `${HEAD}
<main class="login">
  <h1>Quản trị</h1>
  ${message ? `<p class="alert" role="alert">${escapeHtml(message)}</p>` : ''}
  <form method="POST" action="/admin/login">
    <label for="username">Tên đăng nhập</label>
    <input id="username" name="username" type="text" autocomplete="username" required autofocus>
    <label for="password">Mật khẩu</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button class="btn" type="submit"${blocked ? ' disabled' : ''}>Đăng nhập</button>
  </form>
</main>
</body>
</html>`;
}

function listPage() {
  return `${HEAD}
<header class="bar">
  <h1 class="bar__title">Đăng ký · <span id="total">…</span> người</h1>
  <form method="POST" action="/admin/logout">
    <button class="btn btn--ghost" type="submit">Đăng xuất</button>
  </form>
</header>

<main class="wrap">
  <div class="tools">
    <form id="search-form" role="search">
      <label class="sr-only" for="q">Tìm tên, email hoặc số điện thoại</label>
      <input id="q" name="q" type="search" placeholder="Tìm tên, email hoặc số điện thoại">
      <button class="btn btn--ghost" type="submit">Tìm</button>
    </form>
    <a class="btn" id="export" href="/api/admin/players.csv">Xuất CSV</a>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th><button type="button" data-sort="full_name">Họ tên</button></th>
          <th class="mono"><button type="button" data-sort="email">Email</button></th>
          <th class="mono"><button type="button" data-sort="phone">Điện thoại</button></th>
          <th class="num"><button type="button" data-sort="best_score">Điểm cao nhất</button></th>
          <th class="num"><button type="button" data-sort="plays">Số lượt</button></th>
          <th><button type="button" data-sort="created_at">Thời điểm đăng ký</button></th>
          <th><button type="button" data-sort="last_played_at">Lần chơi gần nhất</button></th>
          <th><span class="sr-only">Hành động</span></th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
    <div class="empty" id="empty" hidden></div>
  </div>

  <p class="live" id="live" aria-live="polite"></p>

  <div class="pager">
    <button class="btn btn--ghost" id="prev" type="button">‹ Trước</button>
    <span id="page-info">Trang 1 / 1</span>
    <button class="btn btn--ghost" id="next" type="button">Sau ›</button>
  </div>
</main>

<dialog id="confirm">
  <h2 id="confirm-title" style="margin-top:0">Xoá người chơi?</h2>
  <p id="confirm-body"></p>
  <p><strong>Không thể hoàn tác.</strong></p>
  <div class="dialog__actions">
    <button class="btn btn--ghost" id="confirm-cancel" type="button">Huỷ</button>
    <button class="btn btn--danger" id="confirm-ok" type="button">Xoá</button>
  </div>
</dialog>

<script src="/admin/admin.js"></script>
</body>
</html>`;
}

module.exports = { loginPage, listPage };
