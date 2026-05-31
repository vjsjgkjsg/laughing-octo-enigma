/**
 * script.js — ЯДРО СИСТЕМЫ HashRent
 * Глобальное состояние, localStorage, навигация, общие утилиты
 */

// ─── КОНСТАНТЫ ───────────────────────────────────────────────
const STORAGE_KEYS = {
  USER:        'hr_user',
  BALANCE:     'hr_balance',
  EARNED:      'hr_earned',
  RENTED:      'hr_rented',
  TRANSACTIONS:'hr_transactions',
  THEME:       'hr_theme',
};

const MAX_ACTIVE_MINERS = 5;

// ─── ГЕНЕРАЦИЯ ID ─────────────────────────────────────────────
function generateUserId() {
  return 'HR-' + Math.floor(100000 + Math.random() * 900000);
}

// ─── ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ ───────────────────────────────
function initUser() {
  let user = loadJSON(STORAGE_KEYS.USER);
  if (!user || !user.id) {
    user = {
      id:       generateUserId(),
      name:     'Алексей Нуров',
      initials: 'АН',
      email:    'user@hashrent.kz',
      phone:    '+7 700 *** **12',
      region:   'Казахстан',
      tier:     'Gold',
    };
    saveJSON(STORAGE_KEYS.USER, user);
  }
  return user;
}

// ─── ЧТЕНИЕ / ЗАПИСЬ ──────────────────────────────────────────
function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ─── ПОЛЬЗОВАТЕЛЬ ─────────────────────────────────────────────
function getUser()        { return loadJSON(STORAGE_KEYS.USER) || initUser(); }
function saveUser(user)   { saveJSON(STORAGE_KEYS.USER, user); }

// ─── БАЛАНС ───────────────────────────────────────────────────
function getBalance()     { return parseFloat(localStorage.getItem(STORAGE_KEYS.BALANCE) || '0'); }
function getEarned()      { return parseFloat(localStorage.getItem(STORAGE_KEYS.EARNED)  || '0'); }

function setBalance(val) {
  const safe = Math.max(0, parseFloat(val.toFixed(2)));
  localStorage.setItem(STORAGE_KEYS.BALANCE, safe);
  return safe;
}

function setEarned(val) {
  const safe = parseFloat(Math.max(0, val).toFixed(2));
  localStorage.setItem(STORAGE_KEYS.EARNED, safe);
  return safe;
}

/**
 * Атомарное изменение баланса.
 * delta > 0 — пополнение, delta < 0 — списание.
 * Возвращает { ok, newBalance }
 */
function updateBalance(delta) {
  const current = getBalance();
  const next    = parseFloat((current + delta).toFixed(2));
  if (next < 0) return { ok: false, newBalance: current };
  setBalance(next);
  if (delta > 0) setEarned(getEarned() + delta);
  return { ok: true, newBalance: next };
}

// ─── ТРАНЗАКЦИИ ───────────────────────────────────────────────
function getTransactions() { return loadJSON(STORAGE_KEYS.TRANSACTIONS) || []; }

function addTransaction(label, amount) {
  const txns = getTransactions();
  txns.push({
    id:    Date.now(),
    label,
    amount: parseFloat(amount.toFixed(2)),
    date:  new Date().toLocaleString('ru-RU', {
      day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }),
  });
  saveJSON(STORAGE_KEYS.TRANSACTIONS, txns);
}

// ─── АРЕНДОВАННЫЕ МАЙНЕРЫ ─────────────────────────────────────
function getRented()      { return loadJSON(STORAGE_KEYS.RENTED) || []; }
function saveRented(list) { saveJSON(STORAGE_KEYS.RENTED, list); }

// ─── ТЕМА ─────────────────────────────────────────────────────
function getTheme()       { return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark'; }

function applyTheme(t) {
  localStorage.setItem(STORAGE_KEYS.THEME, t);
  const map = { dark: '', light: 'theme-light', pure: 'theme-pure' };
  document.body.className = map[t] || '';
  document.querySelectorAll('.theme-dot').forEach((d, i) => {
    d.classList.toggle('active', ['dark', 'light', 'pure'][i] === t);
  });
}

// ─── НАВИГАЦИЯ (SPA) ──────────────────────────────────────────
let _currentScreen = 'home';
let _timerHandle   = null;

function navigate(screen) {
  // Остановить таймеры предыдущего экрана
  if (_timerHandle) { clearInterval(_timerHandle); _timerHandle = null; }

  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.bar-btn').forEach(el => el.classList.remove('active'));

  const screenEl = document.getElementById('screen-' + screen);
  const navBtn   = document.getElementById('nav-' + screen);
  if (!screenEl) return;

  screenEl.classList.add('active');
  if (navBtn) navBtn.classList.add('active');
  _currentScreen = screen;

  // Вызвать init конкретного экрана
  const initFns = {
    home:     () => window.initHome?.(),
    mining:   () => { window.initMining?.(); _timerHandle = setInterval(() => window.tickTimers?.(), 1000); },
    profile:  () => window.initProfile?.(),
    withdraw: () => window.initWithdraw?.(),
    more:     () => {},
  };
  initFns[screen]?.();
}

// ─── ТОСТ ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type = 'default') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show' + (type === 'error' ? ' toast-error' : '');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ─── ХЕЛПЕРЫ ──────────────────────────────────────────────────
function fmt$(n) { return '$' + Math.abs(parseFloat(n)).toFixed(2); }
function fmtTimer(ms) {
  if (ms <= 0) return '00:00:00';
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, min, sec].map(x => String(x).padStart(2, '0')).join(':');
}

function el(id) { return document.getElementById(id); }
function setText(id, val) { const e = el(id); if (e) e.textContent = val; }

// ─── ГЛАВНАЯ СТРАНИЦА ─────────────────────────────────────────
function initHome() {
  const user = getUser();
  setText('home-uid',     user.id);
  setText('home-name',    user.name);
  setText('home-av',      user.initials);
  setText('home-balance', fmt$(getBalance()));

  const active = getRented().filter(r => r.status === 'active' || r.status === 'claimable');
  const daily  = active.reduce((sum, r) => {
    const m = (window.MINERS || []).find(x => x.id === r.id);
    return m ? sum + m.profit / m.durationDays : sum;
  }, 0);
  setText('home-today', '+' + fmt$(daily));
}

// ─── ЭКСПОРТ (РАНЬШЕ DOMContentLoaded — читается mining.js сразу) ──
window.HR = {
  getUser, saveUser,
  getBalance, getEarned, setBalance, setEarned, updateBalance,
  getTransactions, addTransaction,
  getRented, saveRented,
  MAX_ACTIVE_MINERS,
  showToast, navigate,
  fmt$, fmtTimer, el, setText,
};
window.navigate   = navigate;
window.applyTheme = applyTheme;
window.showToast  = showToast;
window.initHome   = initHome;

// ─── СТАРТ ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initUser();
  applyTheme(getTheme());
  navigate('home');
});
