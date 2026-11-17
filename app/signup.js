/* ==========================================================================
   Đập Chuột — đăng ký người chơi (docs/02 §7, docs/03 §8, docs/04 §9)
   Nạp sau game.js: quản lý màn SIGNUP và việc gửi điểm lên server.
   ========================================================================== */
(function () {
  'use strict';

  var KEY_ID   = 'dapchuot.playerId';
  var KEY_NAME = 'dapchuot.playerName';

  var screenSignup = document.getElementById('screen-signup');
  var screenStart  = document.getElementById('screen-start');
  var form         = document.getElementById('signup-form');
  var btnSubmit    = document.getElementById('signup-submit');
  var elFormError  = document.getElementById('signup-error');
  var elGreeting   = document.getElementById('start-greeting');
  var elGreetName  = document.getElementById('start-greeting-name');
  var btnSwitch    = document.getElementById('btn-switch-player');

  var fields = ['fullName', 'email', 'phone'];

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* bỏ qua im lặng */ }
  }
  function storageRemove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* bỏ qua im lặng */ }
  }

  function readPlayerId() {
    var raw = storageGet(KEY_ID);
    var id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  /* ---------- Kiểm tra dữ liệu, cùng quy tắc với lib/validate.js ---------- */
  var NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '\-.,]*$/u;
  var EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  function checkFullName(raw) {
    var value = String(raw || '').trim().replace(/\s+/g, ' ');
    if (value.length < 2 || value.length > 80 || !NAME_RE.test(value)) {
      return 'Họ tên phải từ 2 đến 80 ký tự, không chứa chữ số.';
    }
    return '';
  }
  function checkEmail(raw) {
    var value = String(raw || '').trim().toLowerCase();
    if (value.length > 120 || !EMAIL_RE.test(value)) {
      return 'Email không đúng định dạng, ví dụ: ten@vidu.com';
    }
    return '';
  }
  function checkPhone(raw) {
    var cleaned = String(raw || '').replace(/[\s.\-()]/g, '');
    var message = 'Số điện thoại phải có 9–11 chữ số, ví dụ: 0901234567';
    var digits;
    if (/^\+84\d{9,10}$/.test(cleaned)) digits = '0' + cleaned.slice(3);
    else if (/^0\d{8,10}$/.test(cleaned)) digits = cleaned;
    else if (/^\d{9,11}$/.test(cleaned)) digits = cleaned.charAt(0) === '0' ? cleaned : '0' + cleaned;
    else return message;
    return (digits.length < 10 || digits.length > 11) ? message : '';
  }

  var checkers = { fullName: checkFullName, email: checkEmail, phone: checkPhone };

  function inputOf(name) { return document.getElementById('signup-' + name); }
  function errorOf(name) { return document.getElementById('signup-' + name + '-error'); }

  function showFieldError(name, message) {
    var input = inputOf(name);
    var slot = errorOf(name);
    slot.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function validateAll(silent) {
    var ok = true;
    fields.forEach(function (name) {
      var message = checkers[name](inputOf(name).value);
      if (message) ok = false;
      if (!silent) showFieldError(name, message);
    });
    return ok;
  }

  function syncSubmit() {
    btnSubmit.disabled = !validateAll(true);
  }

  /* ---------- Chuyển màn ---------- */
  function showSignup() {
    screenSignup.hidden = false;
    screenStart.hidden = true;
    var play = document.getElementById('screen-play');
    var over = document.getElementById('screen-over');
    if (play) play.hidden = true;
    if (over) over.hidden = true;
    inputOf('fullName').focus({ preventScroll: true });
  }

  function showStart(name) {
    screenSignup.hidden = true;
    screenStart.hidden = false;
    elGreetName.textContent = name || 'bạn';
    elGreeting.hidden = false;
    var btnStart = document.getElementById('btn-start');
    if (btnStart) btnStart.focus({ preventScroll: true });
  }

  /* ---------- Gửi form ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateAll(false)) return;

    btnSubmit.disabled = true;
    var labelBefore = btnSubmit.textContent;
    btnSubmit.textContent = 'Đang lưu…';
    elFormError.hidden = true;

    fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: inputOf('fullName').value,
        email: inputOf('email').value,
        phone: inputOf('phone').value
      })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { status: res.status, data: data }; });
      })
      .then(function (result) {
        if (result.status === 400 && result.data.errors) {
          fields.forEach(function (name) {
            showFieldError(name, result.data.errors[name] || '');
          });
          throw new Error('validation');
        }
        if (result.status !== 200 && result.status !== 201) {
          throw new Error(result.data.error || 'Không lưu được thông tin.');
        }
        storageSet(KEY_ID, String(result.data.playerId));
        storageSet(KEY_NAME, result.data.fullName);
        showStart(result.data.fullName);
      })
      .catch(function (err) {
        if (err.message !== 'validation') {
          elFormError.textContent = 'Không lưu được thông tin. Kiểm tra kết nối rồi thử lại.';
          elFormError.hidden = false;
        }
      })
      .finally(function () {
        btnSubmit.textContent = labelBefore;
        syncSubmit();
      });
  });

  fields.forEach(function (name) {
    var input = inputOf(name);
    input.addEventListener('input', syncSubmit);
    input.addEventListener('blur', function () {
      showFieldError(name, checkers[name](input.value));
    });
  });

  btnSwitch.addEventListener('click', function () {
    storageRemove(KEY_ID);
    storageRemove(KEY_NAME);
    form.reset();
    fields.forEach(function (name) { showFieldError(name, ''); });
    syncSubmit();
    elGreeting.hidden = true;
    showSignup();
  });

  /* ---------- Gửi điểm cuối lượt (FN-23) ---------- */
  function reportScore(score) {
    var id = readPlayerId();
    if (id === null) return;

    var attempt = 0;
    function send() {
      attempt += 1;
      fetch('/api/players/' + id + '/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: score })
      })
        .then(function (res) {
          if (res.status === 404) {
            // Bản ghi đã bị admin xoá: quên người chơi này, lần mở sau hiện lại form.
            storageRemove(KEY_ID);
            storageRemove(KEY_NAME);
            return;
          }
          if (!res.ok && attempt <= 2) setTimeout(send, 1000);
        })
        .catch(function () {
          if (attempt <= 2) setTimeout(send, 1000);
          // Hết lượt thử thì bỏ qua im lặng: màn kết thúc vẫn hiện bình thường.
        });
    }
    send();
  }

  window.DapChuotPlayer = { reportScore: reportScore };

  /* ---------- Khởi động ---------- */
  syncSubmit();
  if (readPlayerId() === null) showSignup();
  else showStart(storageGet(KEY_NAME));
})();
