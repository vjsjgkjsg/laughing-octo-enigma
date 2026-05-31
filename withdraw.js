/**
 * withdraw.js — ВЫВОД СРЕДСТВ HashRent
 * Зависит от: script.js (window.HR)
 */

const getBalance      = ()      => window.HR.getBalance();
const updateBalance   = (d)     => window.HR.updateBalance(d);
const addTransaction  = (l, a)  => window.HR.addTransaction(l, a);
const getTransactions = ()      => window.HR.getTransactions();
const showToast       = (m, t)  => window.HR.showToast(m, t);
const fmt$            = (n)     => window.HR.fmt$(n);
const setText         = (id, v) => window.HR.setText(id, v);

// ─── СОСТОЯНИЕ ────────────────────────────────────────────────
let _method = 'crypto'; // 'crypto' | 'bank'

// ─── ИНИЦИАЛИЗАЦИЯ ЭКРАНА ВЫВОДА ──────────────────────────────
function initWithdraw() {
  setText('wd-bal', fmt$(getBalance()));
  renderTxList();
  selectMethod(_method); // восстановить выбранный метод
}

// ─── ВЫБОР МЕТОДА ─────────────────────────────────────────────
function selectMethod(method) {
  _method = method;

  document.getElementById('m-crypto')?.classList.toggle('sel', method === 'crypto');
  document.getElementById('m-bank')?.classList.toggle('sel',   method === 'bank');

  const addrLabel = document.getElementById('wd-addr-label');
  const addrInput = document.getElementById('wd-addr');
  if (addrLabel && addrInput) {
    if (method === 'crypto') {
      addrLabel.textContent    = 'Адрес кошелька USDT (TRC-20)';
      addrInput.placeholder    = 'Txxxxxxxxxxxxxxxxxxxxxxx';
    } else {
      addrLabel.textContent    = 'Номер счёта IBAN';
      addrInput.placeholder    = 'KZ00 0000 0000 0000 0000';
    }
  }
}

// ─── ВАЛИДАЦИЯ И ОТПРАВКА ─────────────────────────────────────
function doWithdraw() {
  const addrEl = document.getElementById('wd-addr');
  const sumEl  = document.getElementById('wd-sum');

  const addr = addrEl?.value.trim() || '';
  const amt  = parseFloat(sumEl?.value || '0');

  // Валидация
  if (!addr) {
    showToast('Введите адрес кошелька или IBAN', 'error');
    addrEl?.focus();
    return;
  }
  if (isNaN(amt) || amt < 10) {
    showToast('Минимальная сумма вывода — $10', 'error');
    sumEl?.focus();
    return;
  }

  const FEE   = 1;
  const total = parseFloat((amt + FEE).toFixed(2));

  const { ok } = updateBalance(-total);
  if (!ok) {
    showToast('Недостаточно средств (учтите комиссию $' + FEE + ')', 'error');
    return;
  }

  const methodLabel = _method === 'crypto' ? 'USDT TRC-20' : 'SWIFT/IBAN';
  addTransaction(`Вывод ${methodLabel}: ${fmt$(amt)}`, -total);

  // Сброс формы
  if (addrEl) addrEl.value = '';
  if (sumEl)  sumEl.value  = '';

  setText('wd-bal', fmt$(getBalance()));
  renderTxList();

  showToast(`✓ Заявка на вывод ${fmt$(amt)} отправлена`);
}

// ─── ИСТОРИЯ ТРАНЗАКЦИЙ ───────────────────────────────────────
function renderTxList() {
  const el  = document.getElementById('tx-list');
  if (!el) return;

  const txns   = getTransactions().slice().reverse().slice(0, 15);

  if (!txns.length) {
    el.innerHTML = '<p class="tx-empty">Транзакций пока нет</p>';
    return;
  }

  el.innerHTML = txns.map(t => `
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
window.selectMethod = selectMethod;
window.doWithdraw   = doWithdraw;
window.initWithdraw = initWithdraw;
