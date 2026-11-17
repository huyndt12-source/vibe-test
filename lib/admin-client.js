/* Script của trang admin, phục vụ tại /admin/admin.js. */
(function () {
  'use strict';

  var state = { q: '', page: 1, sort: 'created_at', dir: 'desc', pages: 1 };

  var elRows = document.getElementById('rows');
  var elEmpty = document.getElementById('empty');
  var elTotal = document.getElementById('total');
  var elLive = document.getElementById('live');
  var elPageInfo = document.getElementById('page-info');
  var elPrev = document.getElementById('prev');
  var elNext = document.getElementById('next');
  var elExport = document.getElementById('export');
  var elForm = document.getElementById('search-form');
  var elQ = document.getElementById('q');
  var dlg = document.getElementById('confirm');
  var pending = null;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function params(extra) {
    var p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    p.set('sort', state.sort);
    p.set('dir', state.dir);
    if (!extra || !extra.noPage) p.set('page', String(state.page));
    return p;
  }

  function syncExport() {
    var p = params({ noPage: true });
    elExport.href = '/api/admin/players.csv?' + p.toString();
    elExport.textContent = state.q ? 'Xuất CSV (kết quả tìm kiếm)' : 'Xuất CSV';
  }

  function syncSortHeaders() {
    var buttons = document.querySelectorAll('th button[data-sort]');
    for (var i = 0; i < buttons.length; i += 1) {
      var th = buttons[i].parentNode;
      if (buttons[i].getAttribute('data-sort') === state.sort) {
        th.setAttribute('aria-sort', state.dir === 'asc' ? 'ascending' : 'descending');
      } else {
        th.removeAttribute('aria-sort');
      }
    }
  }

  function row(player) {
    var name = esc(player.fullName);
    return '<tr data-id="' + player.id + '">' +
      '<td>' + name + '</td>' +
      '<td class="mono">' + esc(player.email) + '</td>' +
      '<td class="mono">' + esc(player.phone) + '</td>' +
      '<td class="num">' + esc(player.bestScore) + '</td>' +
      '<td class="num">' + esc(player.plays) + '</td>' +
      '<td>' + esc(player.createdAt) + '</td>' +
      '<td>' + esc(player.lastPlayedAt) + '</td>' +
      '<td><button class="btn btn--danger" type="button" data-delete="' + player.id +
        '" aria-label="Xoá ' + name + '">✕</button></td>' +
      '</tr>';
  }

  function load() {
    syncExport();
    syncSortHeaders();
    return fetch('/api/admin/players?' + params().toString(), { credentials: 'same-origin' })
      .then(function (res) {
        if (res.status === 401) { window.location.href = '/admin'; return null; }
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        elTotal.textContent = data.total;
        state.pages = Math.max(1, Math.ceil(data.total / data.pageSize));
        if (state.page > state.pages) { state.page = state.pages; return load(); }

        elRows.innerHTML = data.rows.map(row).join('');
        if (data.rows.length === 0) {
          elEmpty.hidden = false;
          elEmpty.innerHTML = state.q
            ? 'Không tìm thấy bản ghi nào khớp «' + esc(state.q) + '». ' +
              '<button class="btn btn--ghost" type="button" id="clear">Xoá bộ lọc</button>'
            : 'Chưa có người chơi nào đăng ký.';
          var clear = document.getElementById('clear');
          if (clear) clear.addEventListener('click', function () {
            elQ.value = ''; state.q = ''; state.page = 1; load();
          });
        } else {
          elEmpty.hidden = true;
          elEmpty.innerHTML = '';
        }

        elPageInfo.textContent = 'Trang ' + state.page + ' / ' + state.pages;
        elPrev.disabled = state.page <= 1;
        elNext.disabled = state.page >= state.pages;
        if (state.q) elLive.textContent = 'Tìm thấy ' + data.total + ' bản ghi.';
      })
      .catch(function () {
        elLive.textContent = 'Không tải được danh sách. Thử lại sau.';
      });
  }

  elForm.addEventListener('submit', function (e) {
    e.preventDefault();
    state.q = elQ.value.trim();
    state.page = 1;
    load();
  });

  var debounce = null;
  elQ.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      state.q = elQ.value.trim();
      state.page = 1;
      load();
    }, 300);
  });

  document.addEventListener('click', function (e) {
    var sortBtn = e.target.closest ? e.target.closest('th button[data-sort]') : null;
    if (sortBtn) {
      var column = sortBtn.getAttribute('data-sort');
      if (state.sort === column) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort = column; state.dir = 'asc'; }
      state.page = 1;
      load();
      return;
    }
    var delBtn = e.target.closest ? e.target.closest('button[data-delete]') : null;
    if (delBtn) {
      var tr = delBtn.closest('tr');
      pending = {
        id: delBtn.getAttribute('data-delete'),
        name: tr.children[0].textContent,
        email: tr.children[1].textContent,
      };
      document.getElementById('confirm-body').textContent =
        'Xoá ' + pending.name + ' (' + pending.email + ') khỏi danh sách đăng ký.';
      dlg.showModal();
      document.getElementById('confirm-cancel').focus();
    }
  });

  document.getElementById('confirm-cancel').addEventListener('click', function () {
    pending = null;
    dlg.close();
  });

  document.getElementById('confirm-ok').addEventListener('click', function () {
    if (!pending) return;
    var target = pending;
    pending = null;
    dlg.close();
    fetch('/api/admin/players/' + encodeURIComponent(target.id), {
      method: 'DELETE',
      credentials: 'same-origin',
    })
      .then(function (res) {
        if (res.status === 401) { window.location.href = '/admin'; return; }
        var message;
        if (res.status === 404) message = 'Bản ghi đã được xoá trước đó.';
        else if (res.ok) message = 'Đã xoá ' + target.name + '.';
        else message = 'Không xoá được. Thử lại sau.';
        // Đặt thông báo SAU khi bảng tải xong, nếu không nó bị số kết quả ghi đè.
        load().then(function () { elLive.textContent = message; });
      })
      .catch(function () {
        elLive.textContent = 'Không xoá được. Kiểm tra kết nối.';
      });
  });

  elPrev.addEventListener('click', function () {
    if (state.page > 1) { state.page -= 1; load(); }
  });
  elNext.addEventListener('click', function () {
    if (state.page < state.pages) { state.page += 1; load(); }
  });

  load();
})();
