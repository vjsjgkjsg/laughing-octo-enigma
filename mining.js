/**
 * mining.js — ЛОГИКА МАЙНИНГА HashRent
 * Зависит от: script.js (window.HR)
 */

// ─── КАТАЛОГ МАЙНЕРОВ ─────────────────────────────────────────
const MINERS = [
  {
    id: 1, name: 'Antminer S19 Pro', model: 'BTC',
    desc: '110 TH/s · 3250W · SHA-256 · Bitmain',
    rent: 10, profit: 20, durationDays: 1, durLabel: '24 часа', emoji: '⚡',
  },
  {
    id: 2, name: 'Antminer S21 Hyd', model: 'BTC',
    desc: '335 TH/s · 5360W · SHA-256 · Bitmain',
    rent: 18, profit: 40, durationDays: 2, durLabel: '48 часов', emoji: '🔥',
  },
  {
    id: 3, name: 'Whatsminer M50S++', model: 'BTC',
    desc: '136 TH/s · 3100W · SHA-256 · MicroBT',
    rent: 14, profit: 30, durationDays: 3, durLabel: '72 часа', emoji: '💎',
  },
  {
    id: 4, name: 'Antminer L7', model: 'LTC',
    desc: '9.5 GH/s · 3425W · Scrypt · Bitmain',
    rent: 12, profit: 25, durationDays: 7, durLabel: '7 дней', emoji: '🌊',
  },
  {
    id: 5, name: 'Antminer E9 Pro', model: 'ETC',
    desc: '3680 MH/s · 2200W · Ethash · Bitmain',
    rent: 16, profit: 34, durationDays: 1, durLabel: '24 часа', emoji: '🟣',
  },
  {
    id: 6, name: 'Whatsminer M30S+', model: 'BTC',
    desc: '102 TH/s · 3400W · SHA-256 · MicroBT',
    rent: 9, profit: 18, durationDays: 30, durLabel: '30 дней', emoji: '⚙️',
  },
];

// Публикуем каталог глобально (нужен initHome для расчёта daily)
window.MINERS = MINERS;

// ─── ХЕЛПЕРЫ — берём из window.HR в момент вызова ────────────
const getRented        = ()      => window.HR.getRented();
const saveRented       = (l)     => window.HR.saveRented(l);
const updateBalance    = (d)     => window.HR.updateBalance(d);
const addTransaction   = (l, a)  => window.HR.addTransaction(l, a);
const showToast        = (m, t)  => window.HR.showToast(m, t);
const fmt$             = (n)     => window.HR.fmt$(n);
const fmtTimer         = (ms)    => window.HR.fmtTimer(ms);
const setText          = (id, v) => window.HR.setText(id, v);
const MAX_ACTIVE_MINERS = 5;

function getMinerById(id)  { return MINERS.find(m => m.id === id); }
function getContract(id)   { return getRented().find(r => r.id === id); }

/** Все контракты со статусом active или claimable */
function getActiveContracts() {
  return getRented().filter(r => r.status === 'active' || r.status === 'claimable');
}

// ─── АРЕНДА МАЙНЕРА ───────────────────────────────────────────
function rentMiner(id) {
  const miner     = getMinerById(id);
  if (!miner) return;

  const contracts = getRented();
  const active    = contracts.filter(r => r.status === 'active' || r.status === 'claimable');

  // Лимит активных
  if (active.length >= MAX_ACTIVE_MINERS) {
    showToast(`Максимум ${MAX_ACTIVE_MINERS} активных майнеров`, 'error');
    return;
  }

  // Проверка: уже запущен этот майнер?
  const existing = contracts.find(r => r.id === id &&
    (r.status === 'active' || r.status === 'claimable'));
  if (existing) {
    showToast('Этот майнер уже активен', 'error');
    return;
  }

  // Списание аренды
  const { ok } = updateBalance(-miner.rent);
  if (!ok) {
    showToast('Недостаточно средств', 'error');
    return;
  }

  addTransaction('Аренда: ' + miner.name, -miner.rent);

  // Создание контракта
  const now      = Date.now();
  const duration = miner.durationDays * 24 * 60 * 60 * 1000; // ms
  contracts.push({
    id:        miner.id,
    status:    'active',
    startedAt: now,
    endsAt:    now + duration,
  });
  saveRented(contracts);

  renderBuyPanel();
  renderMyPanel();
  updateMyCount();
  showToast('✓ ' + miner.name + ' запущен!');
}

// ─── CLAIM ДОХОДА ─────────────────────────────────────────────
function claimMiner(id) {
  const contracts = getRented();
  const contract  = contracts.find(r => r.id === id && r.status === 'claimable');
  if (!contract) return;

  const miner = getMinerById(id);
  if (!miner) return;

  // Начислить доход
  updateBalance(+miner.profit);
  addTransaction('Доход: ' + miner.name, +miner.profit);

  // Автоперезапуск цикла
  const now      = Date.now();
  const duration = miner.durationDays * 24 * 60 * 60 * 1000;
  contract.status    = 'active';
  contract.startedAt = now;
  contract.endsAt    = now + duration;
  saveRented(contracts);

  renderMyPanel();
  showToast('✓ Получено ' + fmt$(miner.profit) + ' · Цикл перезапущен');
}

// ─── ТИКИ ТАЙМЕРОВ ────────────────────────────────────────────
function tickTimers() {
  const now       = Date.now();
  const contracts = getRented();
  let   changed   = false;

  contracts.forEach(r => {
    if (r.status === 'active' && now >= r.endsAt) {
      r.status = 'claimable';
      changed  = true;
    }
  });

  if (changed) {
    saveRented(contracts);
    renderMyPanel();
    return;
  }

  // Обновить countdown без полного перерендера
  document.querySelectorAll('[data-timer]').forEach(el => {
    const contract = contracts.find(r => r.id === parseInt(el.dataset.timer));
    if (!contract) return;
    const left = Math.max(0, contract.endsAt - now);
    el.textContent = fmtTimer(left);
    const miner  = getMinerById(contract.id);
    const total  = miner ? miner.durationDays * 86400000 : 1;
    const pct    = Math.min(100, ((total - left) / total) * 100);
    const fill   = el.closest('.active-card')?.querySelector('.timer-fill');
    if (fill) fill.style.width = pct.toFixed(1) + '%';
  });
}

window.tickTimers = tickTimers;

// ─── РЕНДЕР: КАТАЛОГ ──────────────────────────────────────────
function renderBuyPanel() {
  const panel = document.getElementById('panel-buy');
  if (!panel) return;

  const contracts = getRented();
  const active    = contracts.filter(r => r.status === 'active' || r.status === 'claimable');
  const limitHit  = active.length >= MAX_ACTIVE_MINERS;

  panel.innerHTML = MINERS.map(miner => {
    const contract  = contracts.find(r => r.id === miner.id &&
      (r.status === 'active' || r.status === 'claimable'));
    const isActive  = !!contract;
    const roi       = Math.round((miner.profit / miner.rent - 1) * 100);
    const disabled  = isActive || limitHit;
    const btnLabel  = isActive
      ? 'Уже активен'
      : limitHit
        ? 'Лимит достигнут'
        : 'Арендовать — ' + fmt$(miner.rent);

    return `
    <div class="miner-card">
      <div class="miner-img-wrap">
        <span class="miner-img-icon" aria-hidden="true">${miner.emoji}</span>
        <span class="badge badge-gold miner-badge-model">${miner.model}</span>
        <span class="badge ${isActive ? 'badge-red' : 'badge-gray'} miner-badge-status">
          ${isActive ? 'Активен' : 'Доступен'}
        </span>
      </div>
      <div class="miner-body">
        <div class="miner-name">${miner.name}</div>
        <div class="miner-desc">${miner.desc}</div>
        <div class="miner-stats">
          <div class="miner-stat">
            <div class="miner-stat-label">Аренда</div>
            <div class="miner-stat-val">${fmt$(miner.rent)}</div>
          </div>
          <div class="miner-stat">
            <div class="miner-stat-label">Доход</div>
            <div class="miner-stat-val success-text">${fmt$(miner.profit)}</div>
          </div>
          <div class="miner-stat">
            <div class="miner-stat-label">Срок</div>
            <div class="miner-stat-val gold-text dur-text">${miner.durLabel}</div>
          </div>
        </div>
        <div class="info-note">
          ROI цикла: +${roi}% · Доход зачисляется по завершении цикла
        </div>
        <button
          class="btn-gold"
          onclick="rentMiner(${miner.id})"
          ${disabled ? 'disabled' : ''}
        >${btnLabel}</button>
      </div>
    </div>`;
  }).join('');
}

// ─── РЕНДЕР: МОИ МАЙНЕРЫ ──────────────────────────────────────
function renderMyPanel() {
  const panel = document.getElementById('panel-my');
  if (!panel) return;

  const now      = Date.now();
  const active   = getRented().filter(r => r.status === 'active' || r.status === 'claimable');

  updateMyCount();

  if (!active.length) {
    panel.innerHTML = `
    <div class="empty-state">
      <i class="ti ti-cpu" aria-hidden="true"></i>
      <p class="empty-title">Нет активных майнеров</p>
      <p>Перейдите в каталог и арендуйте оборудование</p>
    </div>`;
    return;
  }

  panel.innerHTML = active.map(contract => {
    const miner     = getMinerById(contract.id);
    if (!miner) return '';
    const left      = Math.max(0, contract.endsAt - now);
    const total     = miner.durationDays * 86400000;
    const pct       = Math.min(100, ((total - left) / total) * 100).toFixed(1);
    const claimable = contract.status === 'claimable';

    return `
    <div class="active-card${claimable ? ' claimable' : ''}">
      <div class="active-header">
        <div class="active-icon" aria-hidden="true">${miner.emoji}</div>
        <div class="active-info">
          <div class="active-name">${miner.name}</div>
          <div class="active-meta">${miner.model} · ${miner.durLabel} цикл</div>
        </div>
        <span class="badge ${claimable ? 'badge-gold' : 'badge-green'}">
          ${claimable ? 'Готово' : 'Активен'}
        </span>
      </div>

      <div class="timer-bar">
        <div class="timer-fill" style="width:${pct}%"></div>
      </div>
      <div class="timer-row">
        <span class="timer-label">Осталось:</span>
        <span class="timer-text" data-timer="${contract.id}">${fmtTimer(left)}</span>
        <span class="timer-pct">${pct}%</span>
      </div>

      <div class="active-footer">
        <div class="active-reward">
          <span class="reward-label">Доход цикла:</span>
          <span class="reward-val">+${fmt$(miner.profit)}</span>
        </div>
        ${claimable
          ? `<button class="btn-gold btn-claim" onclick="claimMiner(${contract.id})">Получить доход</button>`
          : `<button class="btn-outline btn-wait" disabled>Ожидание…</button>`
        }
      </div>
    </div>`;
  }).join('');
}

// ─── СЧЁТЧИК В ТАБЕ ───────────────────────────────────────────
function updateMyCount() {
  const cnt = getActiveContracts().length;
  setText('my-count', cnt ? `(${cnt})` : '');
}

// ─── ПЕРЕКЛЮЧЕНИЕ ТАБОВ ───────────────────────────────────────
function switchTab(tab) {
  document.getElementById('tab-buy').classList.toggle('active', tab === 'buy');
  document.getElementById('tab-my').classList.toggle('active',  tab === 'my');
  document.getElementById('panel-buy').style.display = tab === 'buy' ? 'block' : 'none';
  document.getElementById('panel-my').style.display  = tab === 'my'  ? 'block' : 'none';
  if (tab === 'my')  renderMyPanel();
  if (tab === 'buy') renderBuyPanel();
}

// ─── ИНИЦИАЛИЗАЦИЯ ЭКРАНА МАЙНИНГА ────────────────────────────
function initMining() {
  renderBuyPanel();
  renderMyPanel();
}

// ─── ГЛОБАЛЬНЫЙ ЭКСПОРТ ───────────────────────────────────────
window.MINERS    = MINERS;
window.rentMiner = rentMiner;
window.claimMiner = claimMiner;
window.switchTab = switchTab;
window.initMining = initMining;
window.tickTimers = tickTimers;
