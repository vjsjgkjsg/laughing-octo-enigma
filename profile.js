/**
 * profile.js — ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ HashRent
 * Зависит от: script.js (window.HR)
 */

const getUser         = ()      => window.HR.getUser();
const getBalance      = ()      => window.HR.getBalance();
const getEarned       = ()      => window.HR.getEarned();
const getTransactions = ()      => window.HR.getTransactions();
const getRented       = ()      => window.HR.getRented();
const fmt$            = (n)     => window.HR.fmt$(n);
const setText         = (id, v) => window.HR.setText(id, v);

// ─── ИНИЦИАЛИЗАЦИЯ ЭКРАНА ПРОФИЛЯ ─────────────────────────────
function initProfile() {
  const user       = getUser();
  const balance    = getBalance();
  const earned     = getEarned();
  const txns       = getTransactions();
  const rented     = getRented();
  const activeCount = rented.filter(r => r.status === 'active' || r.status === 'claimable').length;

  // Аватар и личные данные
  setText('prof-av',    user.initials);
  setText('prof-name',  user.name);
  setText('prof-uid',   user.id);
  setText('prof-email', user.email   || 'user@hashrent.kz');
  setText('prof-phone', user.phone   || '+7 700 *** **12');
  setText('prof-region',user.region  || 'Казахстан');

  // Статистика
  setText('s-rented',  activeCount);
  setText('s-earned',  fmt$(earned));
  setText('s-balance', fmt$(balance));
  setText('s-txcount', txns.length);

  // История последних 5 транзакций
  renderProfileTx(txns);
}

// ─── ИСТОРИЯ В ПРОФИЛЕ (последние 5) ──────────────────────────
function renderProfileTx(txns) {
  const el = document.getElementById('prof-tx-list');
  if (!el) return;

  const recent = txns.slice().reverse().slice(0, 5);

  if (!recent.length) {
    el.innerHTML = '<p class="tx-empty">Транзакций пока нет</p>';
    return;
  }

  el.innerHTML = recent.map(t => `
  <div class="tx-item">
    <div>
      <div class="tx-label">${t.label}</div>
      <div class="tx-sub">${t.date}</div>
    </div>
    <div class="tx-amt ${t.amount >= 0 ? 'tx-plus' : 'tx-minus'}">
      ${t.amount >= 0 ? '+' : ''}${fmt$(t.amount)}
    </div>
  </div>`).join('');
}

// ─── ГЛОБАЛЬНЫЙ ЭКСПОРТ ───────────────────────────────────────
window.initProfile = initProfile;
