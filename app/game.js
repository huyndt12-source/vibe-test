/* ==========================================================================
   Đập Chuột — logic game
   Theo docs/02-chuc-nang.html và docs/04-quy-tac-du-lieu.html
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Hằng số (docs/04 §1) ---------- */
  var GRID_SIZE      = 9;
  var ROUND_MS       = 30000;
  var UP_MIN_MS      = 600;
  var UP_MAX_MS      = 1200;
  var GAP_MIN_MS     = 200;
  var GAP_MAX_MS     = 500;
  var WARN_SECONDS   = 5;
  var STUN_MS        = 150;
  var POINTS_PER_HIT = 1;
  var TICK_MS        = 100;

  var KEY_HIGH_SCORE = 'dapchuot.highScore';
  var KEY_SOUND_ON   = 'dapchuot.soundOn';

  /* ---------- 2. DOM ---------- */
  var screenEls = {
    START:   document.getElementById('screen-start'),
    PLAYING: document.getElementById('screen-play'),
    OVER:    document.getElementById('screen-over')
  };
  var board          = document.getElementById('board');
  var elScore        = document.getElementById('hud-score');
  var elTime         = document.getElementById('hud-time');
  var elStartBest    = document.getElementById('start-best');
  var elStartBestVal = document.getElementById('start-best-value');
  var elOverScore    = document.getElementById('over-score');
  var elOverBest     = document.getElementById('over-best');
  var elRecord       = document.getElementById('record');
  var btnStart       = document.getElementById('btn-start');
  var btnReplay      = document.getElementById('btn-replay');
  var soundButtons   = [].slice.call(document.querySelectorAll('[data-sound-toggle]'));

  /* ---------- 3. Mô hình state (docs/04 §3) ---------- */
  var state = {
    phase: 'START',
    score: 0,
    highScore: 0,
    endAt: 0,
    activeHole: null,
    isWhacked: false,
    lastHole: null,
    timers: { tick: null, down: null, spawn: null },
    soundOn: true,
    isNewRecord: false
  };

  var holes = [];          // { el, mouse }
  var shownSeconds = null; // số giây đang vẽ trên màn hình
  var pressedHole = null;  // ô mà pointerdown bắt đầu

  /* ---------- 4. Bộ lưu trữ (docs/04 §6) ---------- */
  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* bỏ qua im lặng */ }
  }
  function readHighScore() {
    var n = parseInt(storageGet(KEY_HIGH_SCORE), 10);
    return (typeof n === 'number' && isFinite(n) && n > 0) ? Math.floor(n) : 0;
  }
  function readSoundOn() {
    var raw = storageGet(KEY_SOUND_ON);
    return raw === null ? true : raw === '1';   // thiếu khóa → bật
  }

  /* ---------- 5. Âm thanh (docs/02 §5) ---------- */
  var audioCtx = null;
  var audioBroken = false;

  function ensureAudio() {
    if (audioBroken || audioCtx) return audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { audioBroken = true; setSoundOn(false); return null; }
    try {
      audioCtx = new Ctx();
    } catch (e) {
      audioBroken = true; setSoundOn(false); return null;
    }
    return audioCtx;
  }

  function beep(fromHz, toHz, ms, type, gainPeak) {
    if (!state.soundOn || audioBroken) return;
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(fromHz, now);
      osc.frequency.exponentialRampToValueAtTime(toHz, now + ms / 1000);
      gain.gain.setValueAtTime(gainPeak, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + ms / 1000 + 0.02);
    } catch (e) {
      audioBroken = true;   // không ghi lỗi ra Console
    }
  }
  function sfxHit()     { beep(880, 180, 80, 'square', 0.18); }
  function sfxTimeUp()  { beep(420, 110, 400, 'sawtooth', 0.16); }

  function renderSoundButtons() {
    soundButtons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', state.soundOn ? 'true' : 'false');
      btn.setAttribute('aria-label', state.soundOn ? 'Tắt âm thanh' : 'Bật âm thanh');
      btn.disabled = audioBroken;
      var icon = btn.querySelector('[data-sound-icon]');
      if (icon) icon.textContent = state.soundOn ? '🔊' : '🔇';
    });
  }
  function setSoundOn(on) {
    state.soundOn = !!on && !audioBroken;
    storageSet(KEY_SOUND_ON, state.soundOn ? '1' : '0');
    renderSoundButtons();
  }

  /* ---------- 6. Lưới ---------- */
  /* FN-14: nếu ảnh không tải được, ô vẫn chơi được — rơi về emoji */
  function makeFallback(char, modifier) {
    var span = document.createElement('span');
    span.className = 'mouse__fallback ' + modifier;
    span.textContent = char;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function onArtBroken() { board.classList.add('is-art-broken'); }

  function makeMouseImg(file, modifier) {
    var img = document.createElement('img');
    img.className = 'mouse__img ' + modifier;
    img.src = '../assets/' + file;
    img.alt = '';            // hình trang trí, trạng thái đã có ở aria-label của ô
    img.draggable = false;
    img.addEventListener('error', onArtBroken);
    return img;
  }

  function buildBoard() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < GRID_SIZE; i++) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'hole';
      el.dataset.index = String(i);
      el.dataset.mouse = 'none';
      el.disabled = true;                       // chỉ mở khóa khi PLAYING
      el.setAttribute('aria-label', 'Hang ' + (i + 1) + ' — trống');
      var mouth = document.createElement('span');
      mouth.className = 'hole__mouth';
      var mouse = document.createElement('span');
      mouse.className = 'mouse';
      mouse.appendChild(makeMouseImg('mouse.png', 'mouse__img--up'));
      mouse.appendChild(makeMouseImg('mouse-stunned.png', 'mouse__img--hit'));
      mouse.appendChild(makeFallback('🐭', 'mouse__fallback--up'));
      mouse.appendChild(makeFallback('😵', 'mouse__fallback--hit'));
      mouth.appendChild(mouse);
      el.appendChild(mouth);
      frag.appendChild(el);
      holes.push({ el: el, mouse: mouse });
    }
    board.appendChild(frag);
  }
  function setBoardLocked(locked) {
    for (var i = 0; i < holes.length; i++) holes[i].el.disabled = locked;
  }

  function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

  /* Chọn thẳng trong tập 8 ô còn lại — không vòng lặp thử lại (docs/04 §4) */
  function pickHole(lastHole) {
    if (lastHole === null) return randInt(0, GRID_SIZE - 1);
    var r = randInt(0, GRID_SIZE - 2);
    return r >= lastHole ? r + 1 : r;
  }

  /* ---------- 7. Hẹn giờ: luôn hủy trước khi tạo ---------- */
  function clearTimer(name) {
    if (state.timers[name] === null) return;
    if (name === 'tick') clearInterval(state.timers[name]);
    else clearTimeout(state.timers[name]);
    state.timers[name] = null;
  }
  function clearAllTimers() { clearTimer('tick'); clearTimer('down'); clearTimer('spawn'); }

  /* ---------- 8. Chuột ---------- */
  function setMouseState(index, value) {
    var el = holes[index].el;
    el.dataset.mouse = value;
    el.setAttribute('aria-label', 'Hang ' + (index + 1) + (value === 'none' ? ' — trống' : ' — có chuột'));
  }

  function removeMouse() {
    if (state.activeHole === null) return;
    var i = state.activeHole;
    setMouseState(i, 'none');
    state.lastHole = i;          // cập nhật khi chuột rời mặt đất, dù vì lý do gì
    state.activeHole = null;
    state.isWhacked = false;
    clearTimer('down');
  }

  function spawnMouse() {
    if (state.phase !== 'PLAYING') return;
    var index = pickHole(state.lastHole);
    state.activeHole = index;
    state.isWhacked = false;
    setMouseState(index, 'up');

    clearTimer('down');
    state.timers.down = setTimeout(function () {
      removeMouse();
      scheduleSpawn();
    }, randInt(UP_MIN_MS, UP_MAX_MS));
  }

  function scheduleSpawn() {
    if (state.phase !== 'PLAYING') return;
    clearTimer('spawn');
    state.timers.spawn = setTimeout(spawnMouse, randInt(GAP_MIN_MS, GAP_MAX_MS));
  }

  /* ---------- 9. Đập (docs/04 §5) ---------- */
  function showPlusOne(index) {
    var plus = document.createElement('span');
    plus.className = 'plus';
    plus.textContent = '+1';
    holes[index].el.appendChild(plus);
    setTimeout(function () {
      if (plus.parentNode) plus.parentNode.removeChild(plus);
    }, 420);
  }

  function whack(index) {
    if (state.phase !== 'PLAYING') return;            // lớp phòng thứ hai
    if (index !== state.activeHole) return;           // ô trống / sai ô → 0 điểm
    if (state.isWhacked) return;                      // đang "choáng" → 0 điểm

    state.isWhacked = true;
    state.score += POINTS_PER_HIT;
    elScore.textContent = String(state.score);

    clearTimer('down');
    setMouseState(index, 'hit');
    showPlusOne(index);
    sfxHit();

    state.timers.down = setTimeout(function () {
      removeMouse();
      scheduleSpawn();
    }, STUN_MS);
  }

  /* chỉ tính khi pointerdown và pointerup cùng một ô */
  function holeOf(event) {
    var el = event.target && event.target.closest ? event.target.closest('.hole') : null;
    return el ? parseInt(el.dataset.index, 10) : null;
  }
  board.addEventListener('pointerdown', function (e) { pressedHole = holeOf(e); });
  board.addEventListener('pointercancel', function () { pressedHole = null; });
  board.addEventListener('pointerup', function (e) {
    var index = holeOf(e);
    if (index !== null && index === pressedHole) whack(index);
    pressedHole = null;
  });

  /* ---------- 10. Đồng hồ (docs/02 §4) ---------- */
  function renderTime(seconds) {
    if (seconds === shownSeconds) return;
    shownSeconds = seconds;
    elTime.textContent = String(seconds);
    elTime.classList.toggle('is-warning', seconds <= WARN_SECONDS);
  }

  /* ---------- 11. State machine (docs/04 §2) ---------- */
  function showScreen(phase) {
    Object.keys(screenEls).forEach(function (key) {
      screenEls[key].hidden = (key !== phase);
    });
  }

  function enterStart() {
    state.phase = 'START';
    clearAllTimers();
    removeMouse();
    setBoardLocked(true);
    state.highScore = readHighScore();
    if (state.highScore > 0) {
      elStartBestVal.textContent = String(state.highScore);
      elStartBest.hidden = false;
    } else {
      elStartBest.hidden = true;
    }
    showScreen('START');
  }

  function enterPlaying() {
    clearAllTimers();                 // quy tắc một đồng hồ
    removeMouse();

    state.phase = 'PLAYING';
    state.score = 0;
    state.lastHole = null;
    state.activeHole = null;
    state.isWhacked = false;
    state.isNewRecord = false;
    state.endAt = Date.now() + ROUND_MS;

    elScore.textContent = '0';
    shownSeconds = null;
    renderTime(ROUND_MS / 1000);
    showScreen('PLAYING');
    setBoardLocked(false);

    state.timers.tick = setInterval(function () {
      var remain = state.endAt - Date.now();
      if (remain <= 0) { enterOver(); return; }
      renderTime(Math.ceil(remain / 1000));
    }, TICK_MS);

    scheduleSpawn();
  }

  function enterOver() {
    state.phase = 'OVER';             // chặn tính điểm trước khi dọn dẹp
    clearAllTimers();
    removeMouse();
    setBoardLocked(true);
    renderTime(0);

    state.isNewRecord = state.score > state.highScore;
    if (state.isNewRecord) {
      state.highScore = state.score;
      storageSet(KEY_HIGH_SCORE, String(state.highScore));
    }

    elOverScore.textContent = String(state.score);
    elOverBest.textContent = String(state.highScore);
    elRecord.hidden = !state.isNewRecord;

    sfxTimeUp();
    showScreen('OVER');
    btnReplay.focus({ preventScroll: true });
  }

  /* ---------- 12. Nối sự kiện ---------- */
  btnStart.addEventListener('click', function () {
    ensureAudio();                    // khởi tạo trong tương tác đầu tiên
    enterPlaying();
  });
  btnReplay.addEventListener('click', enterPlaying);

  soundButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!audioBroken) ensureAudio();
      setSoundOn(!state.soundOn);
    });
  });

  /* ---------- 13. Khởi động ---------- */
  buildBoard();
  state.soundOn = readSoundOn();
  renderSoundButtons();
  enterStart();
  btnStart.focus({ preventScroll: true });
})();
