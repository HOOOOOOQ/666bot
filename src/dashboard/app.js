'use strict';

const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';
const sessionStore = hasDOM ? sessionStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const localStore = hasDOM ? localStorage : { getItem: () => null, setItem: () => {} };

const state = {
  adminKey: '',
  token: sessionStore.getItem('666_session') || '',
  guildId: localStore.getItem('666_guild_id') || '',
  data: null,
  settings: null,
  section: 'economy',
  commands: [],
  categories: [],
  timer: null,
  page: 'overview',
};

const PAGE_META = {
  overview: ['Overview', 'Ringkasan live seluruh sistem 666 RPG'],
  economy: ['Economy', 'Wallet, bank, transaksi, dan sirkulasi koin'],
  hunting: ['Hunting', 'Monster, rarity, dan pemburu terbaik'],
  pets: ['Pets', 'Koleksi pet dan progres hatch'],
  battle: ['Battle', 'Arena PvP, rating, dan hasil terbaru'],
  minigames: ['Gambling', 'Riwayat permainan dan house edge transparan'],
  quests: ['Quests', 'Quest, achievement, dan progres pemain'],
  market: ['Market', 'Listing, penjualan, dan transaksi P2P'],
  guilds: ['Guilds', 'Guild, bank, dan klasemen war'],
  worldboss: ['World Boss', 'HP shared, kontribusi damage, dan reward'],
  statistics: ['Statistics', 'Statistik agregat & chart 7 hari'],
  settings: ['Settings', 'Semua konfigurasi game per guild'],
  'drop-rates': ['Drop Rates', 'Editor persentase dengan validasi 100%'],
  transactions: ['Transactions', 'Audit log seluruh transaksi ekonomi'],
  commands: ['Commands', 'Aktif/nonaktifkan command tanpa restart'],
  categories: ['Categories', 'Kelola kategori command per guild'],
};

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const num = (value) => Number(value || 0).toLocaleString('id-ID');
const money = (value) => `${num(value)} 🪙`;
const dt = (value) => (value ? new Date(value).toLocaleString('id-ID') : '—');
const initials = (value) => esc(String(value || '?').slice(0, 2).toUpperCase());

function toast(message, kind = 'ok') {
  const el = $('#toast');
  el.textContent = message;
  el.style.borderLeftColor = kind === 'error' ? 'var(--red)' : 'var(--green)';
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3500);
}

async function api(path, options = {}) {
  const auth = state.token
    ? { Authorization: `Bearer ${state.token}` }
    : { 'x-admin-key': state.adminKey };
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...auth,
      ...(options.headers || {}),
    },
  });
  const json = await response.json().catch(() => ({ ok: false, error: 'invalid_response' }));
  if (!response.ok || json.ok === false) {
    const error = new Error(json.message || json.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = json;
    throw error;
  }
  return json;
}

function withGuild(path) {
  const url = new URL(path, window.location.origin);
  if (state.guildId) url.searchParams.set('guildId', state.guildId);
  return url.pathname + url.search;
}

function metricCard(label, value, sub = '') {
  return `<div class="card"><h3>${esc(label)}</h3><div class="metric">${value}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
}

function progress(pct) {
  return `<div class="progress"><i style="width:${Math.max(0, Math.min(100, Number(pct) || 0))}%"></i></div>`;
}

function table(headers, rows, empty = 'Belum ada data.') {
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
  return `<div class="card" style="padding:0;overflow:auto"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

function userCell(user) {
  return `<div style="display:flex;align-items:center;gap:9px"><span class="user-avatar">${initials(user.username || user.userId)}</span><div><div style="font-weight:700">${esc(user.username || 'Player')}</div><div class="mono">${esc(user.userId || '')}</div></div></div>`;
}

function drawChart(canvas, labels, series, options = {}) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(300, rect.width) * dpr;
  canvas.height = Math.max(160, rect.height) * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.clearRect(0, 0, width, height);
  const pad = { left: 44, right: 14, top: 18, bottom: 26 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.data);
  const max = Math.max(1, ...all);
  ctx.strokeStyle = '#202028';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
    ctx.fillStyle = '#747483'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(num(Math.round(max - (max / 4) * i)), pad.left - 8, y + 3);
  }
  const step = plotW / Math.max(1, labels.length - 1);
  series.forEach((s) => {
    ctx.beginPath();
    s.data.forEach((value, index) => {
      const x = pad.left + (labels.length > 1 ? step * index : plotW / 2);
      const y = pad.top + plotH - (value / max) * plotH;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.lineTo(pad.left + (labels.length > 1 ? step * (labels.length - 1) : plotW / 2), pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = s.fill;
    ctx.fill();
  });
  ctx.fillStyle = '#747483'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
  labels.forEach((label, index) => {
    const x = pad.left + (labels.length > 1 ? step * index : plotW / 2);
    ctx.fillText(label.slice(5), x, height - 7);
  });
  if (options.title) {
    ctx.fillStyle = '#c9c9d3'; ctx.font = '600 11px Inter, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(options.title, pad.left, 11);
  }
}

function renderOverview() {
  const { overview, charts, topPlayers, topHunters, topBattlers, guilds, listings, boss, transactions } = state.data;
  const cards = [
    metricCard('Total Players', num(overview.players), `${num(overview.activePlayers)} aktif 7 hari`),
    metricCard('Coin Circulation', money(overview.coinCirculation), `${num(overview.transactions)} transaksi`),
    metricCard('Hunts & Monsters', num(overview.hunts), `${num(overview.monsters)} monster tersimpan`),
    metricCard('Battles & Pets', num(overview.battles), `${num(overview.pets)} pet`),
  ].join('');
  return `
    <div class="grid cols-4">${cards}</div>
    <div class="split section">
      <div class="card"><div class="section-head"><div><h2>Volume Ekonomi</h2><p>7 hari terakhir</p></div></div><div class="chart-wrap"><canvas id="chartMain"></canvas></div></div>
      <div class="card"><h3>Live Systems</h3>
        <div style="display:grid;gap:12px;margin-top:14px">
          <div><div class="sub">Market listings</div><div class="metric" style="font-size:22px">${num(listings.length)}</div></div>
          <div><div class="sub">Guilds</div><div class="metric" style="font-size:22px">${num(overview.guilds)}</div></div>
          <div><div class="sub">World boss HP</div><div class="metric" style="font-size:22px">${boss?.boss ? `${num(boss.boss.hp)} / ${num(boss.boss.hpMax)}` : '—'}</div>${boss?.boss ? progress((boss.boss.hp / boss.boss.hpMax) * 100) : ''}</div>
        </div>
      </div>
    </div>
    <div class="section"><div class="section-head"><div><h2>Top Players</h2><p>Berdasarkan total kekayaan</p></div><a class="btn ghost" href="/dashboard/economy">Lihat economy</a></div>
      ${table(['#', 'Player', 'Wallet', 'Bank', 'Level'], topPlayers.map((u, i) => `<tr><td>${i + 1}</td><td>${userCell(u)}</td><td>${money(u.wallet)}</td><td>${money(u.bank)}</td><td><span class="badge red">Lv.${u.level}</span></td></tr>`))}
    </div>
    <div class="grid cols-2 section">
      <div>${table(['#', 'Hunter', 'Kills', 'Shiny'], topHunters.map((u, i) => `<tr><td>${i + 1}</td><td>${userCell(u)}</td><td>${num(u.huntKills)}</td><td>✨ ${num(u.shinyCount)}</td></tr>`))}</div>
      <div>${table(['#', 'Battler', 'ELO', 'W/L'], topBattlers.map((u, i) => `<tr><td>${i + 1}</td><td>${userCell(u)}</td><td>${num(u.battleRating)}</td><td>${u.battleWins}/${u.battleLosses}</td></tr>`))}</div>
    </div>
    <div class="section">${table(['Waktu', 'User', 'Tipe', 'Jumlah', 'Status'], transactions.slice(0, 12).map((t) => `<tr><td>${dt(t.createdAt)}</td><td class="mono">${esc(t.userId)}</td><td><span class="badge">${esc(t.type)}</span></td><td class="${t.amount >= 0 ? 'pos' : 'neg'}">${t.amount > 0 ? '+' : ''}${num(t.amount)}</td><td>${t.status === 'completed' ? '✅' : esc(t.status)}</td></tr>`))}</div>
  `;
}

function renderEconomy() {
  const { overview, transactions, topPlayers } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Coin Circulation', money(overview.coinCirculation), 'wallet + bank')}
    ${metricCard('Transaksi', num(overview.transactions), 'semua tipe')}
    ${metricCard('Players', num(overview.players), `${num(overview.activePlayers)} aktif`)}
    ${metricCard('Market Trades', num(overview.marketTransactions), 'P2P marketplace')}
  </div>
  <div class="section"><div class="section-head"><div><h2>Transaksi Terbaru</h2><p>Audit log — anti double reward</p></div><a class="btn ghost" href="/dashboard/transactions">Semua log</a></div>
  ${table(['Waktu', 'User', 'Tipe', 'Jumlah', 'Status'], transactions.map((t) => `<tr><td>${dt(t.createdAt)}</td><td class="mono">${esc(t.userId)}</td><td><span class="badge red">${esc(t.type)}</span></td><td>${t.amount > 0 ? '+' : ''}${num(t.amount)}</td><td>${esc(t.status)}</td></tr>`))}</div>
  <div class="section"><h2 style="font-size:17px">Top Wealth</h2>${table(['#', 'Player', 'Wallet', 'Bank', 'Total'], topPlayers.map((u, i) => `<tr><td>${i + 1}</td><td>${userCell(u)}</td><td>${money(u.wallet)}</td><td>${money(u.bank)}</td><td>${money((u.wallet || 0) + (u.bank || 0))}</td></tr>`))}</div>`;
}

function renderHunting() {
  const { overview, topHunters } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Total Hunts', num(overview.hunts), 'monster tertangkap')}
    ${metricCard('Monster Tersimpan', num(overview.monsters), 'kandang pemain')}
    ${metricCard('Unique Species', '29', 'common → secret')}
    ${metricCard('Shiny Hunters', num(topHunters.reduce((s, u) => s + (u.shinyCount || 0), 0)), 'total shiny')}
  </div>
  <div class="section">${table(['#', 'Hunter', 'Hunt Lv', 'Kills', 'Shiny', 'Legendary', 'Mythical', 'Secret'], topHunters.map((u, i) => `<tr><td>${i + 1}</td><td>${userCell(u)}</td><td>${u.huntLevel}</td><td>${num(u.huntKills)}</td><td>✨${num(u.shinyCount)}</td><td>🟡${num(u.legendaryCount)}</td><td>🔴${num(u.mythicalCount)}</td><td>☠️${num(u.secretCount)}</td></tr>`))}</div>
  <div class="section"><div class="card"><h3>Rarity Drop Table</h3><div class="sub">Atur persentase di <a href="/dashboard/drop-rates" style="color:var(--red)">Drop Rates editor</a>. Total wajib 100%.</div></div></div>`;
}

function renderPets() {
  const { overview } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Total Pets', num(overview.pets), 'semua pemain')}
    ${metricCard('Pet Species', '15', 'dengan skill unik')}
    ${metricCard('Egg Types', '3', 'basic • rare • legendary')}
    ${metricCard('Active Bonus', 'ON', 'hunt & battle')}
  </div>
  <div class="section card"><h3>Pet System</h3><p class="sub">Hatch, feed, equip, upgrade, evolve. Semua nilai bisa diubah di Settings → Pets. Bonus pet aktif dihitung otomatis ke stat battle.</p></div>`;
}

function renderBattle() {
  const { overview, recentBattles, topBattlers } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Battles Selesai', num(overview.battles), 'turn-based PvP')}
    ${metricCard('Top ELO', num(topBattlers[0]?.battleRating || 1000), topBattlers[0]?.username || '—')}
    ${metricCard('Win Leader', num(topBattlers[0]?.battleWins || 0), 'kemenangan')}
    ${metricCard('Anti Win-Trade', 'Aktif', 'reward dikurangi matchup berulang')}
  </div>
  <div class="section">${table(['Waktu', 'Challenger', 'Opponent', 'Status', 'Winner', 'Reward'], recentBattles.map((b) => `<tr><td>${dt(b.createdAt)}</td><td class="mono">${esc(b.challengerId)}</td><td class="mono">${esc(b.opponentId)}</td><td><span class="badge ${b.status === 'completed' ? 'green' : ''}">${esc(b.status)}</span></td><td class="mono">${esc(b.winnerId || '—')}</td><td>${money(b.reward || 0)}</td></tr>`))}</div>
  <div class="section">${table(['#', 'Battler', 'ELO', 'Wins', 'Losses', 'Streak'], topBattlers.map((u, i) => `<tr><td>${i + 1}</td><td>${userCell(u)}</td><td>${num(u.battleRating)}</td><td>${num(u.battleWins)}</td><td>${num(u.battleLosses)}</td><td>${num(u.battleStreak)}</td></tr>`))}</div>`;
}

function renderMinigames() {
  const { recentGames, overview } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Total Games', num(overview.games), 'tercatat di game_history')}
    ${metricCard('House Edge', 'Transparan', 'dari settings')}
    ${metricCard('RNG', 'Crypto', 'crypto.randomInt')}
    ${metricCard('Games', '8', 'coinflip … rps')}
  </div>
  <div class="section">${table(['Waktu', 'User', 'Game', 'Bet', 'Hasil', 'Payout'], recentGames.map((g) => `<tr><td>${dt(g.createdAt)}</td><td class="mono">${esc(g.userId)}</td><td><span class="badge red">${esc(g.game)}</span></td><td>${money(g.bet)}</td><td>${g.won ? '✅ Menang' : '❌ Kalah'}</td><td>${money(g.payout)}</td></tr>`))}</div>
  <div class="card section"><h3>House Edge</h3><p class="sub">Payout = bet × multiplier × (1 − houseEdge%). Tidak ada manipulasi hasil tersembunyi; RNG memakai crypto.randomInt yang dapat diaudit di source code.</p></div>`;
}

function renderQuests() {
  const { quests, overview } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Quest Progress', num(overview.quests), 'baris progress tersimpan')}
    ${metricCard('Achievements', num(overview.achievements), 'badge terbuka')}
    ${metricCard('Quest Types', '4', 'daily • weekly • special • hidden')}
    ${metricCard('Rank System', '8', 'Rookie → Ascended')}
  </div>
  <div class="section">${table(['User', 'Quest', 'Tipe', 'Progress', 'Claimed'], quests.map((q) => `<tr><td class="mono">${esc(q.userId)}</td><td>${esc(q.questId)}</td><td>${esc(q.type)}</td><td>${num(q.progress)} / ${num(q.target)}${progress((q.progress / q.target) * 100)}</td><td>${q.claimed ? '✅' : '—'}</td></tr>`))}</div>`;
}

function renderMarket() {
  const { listings, overview } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Active Listings', num(listings.length), 'market_listings')}
    ${metricCard('Market Trades', num(overview.marketTransactions), 'market_transactions')}
    ${metricCard('Listing Fee', 'dari Settings', 'anti spam')}
    ${metricCard('Trade Confirm', '2 pihak', 'item dikunci')}
  </div>
  <div class="section">${table(['Listing', 'Item', 'Rarity', 'Harga', 'Seller', 'Expires'], listings.map((l) => `<tr><td class="mono">${esc(String(l._id).slice(-6))}</td><td>${esc(l.itemSnapshot?.name || l.itemId)}</td><td>${esc(l.itemSnapshot?.rarity || l.itemType)}</td><td>${money(l.price)}</td><td class="mono">${esc(l.sellerId)}</td><td>${dt(l.expiresAt)}</td></tr>`))}</div>`;
}

function renderGuilds() {
  const { guilds, overview } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Guilds', num(overview.guilds), 'terdaftar')}
    ${metricCard('Top Guild', esc(guilds[0]?.name || '—'), `${guilds[0]?.warPoints || 0} war points`)}
    ${metricCard('Guild Bank', money(guilds.reduce((s, g) => s + (g.bank || 0), 0)), 'total')}
    ${metricCard('Guild Wars', 'Weekly', 'season otomatis')}
  </div>
  <div class="section">${table(['#', 'Guild', 'Level', 'Members', 'Bank', 'War Pts', 'W/L'], guilds.map((g, i) => `<tr><td>${i + 1}</td><td><strong>${esc(g.name)}</strong><div class="mono">${esc(String(g._id).slice(-6))}</div></td><td>${g.level}</td><td>${g.memberCount}/${g.maxMembers}</td><td>${money(g.bank)}</td><td>${num(g.warPoints)}</td><td>${g.wins}/${g.losses}</td></tr>`))}</div>`;
}

function renderWorldboss() {
  const { boss, topBoss } = state.data;
  const b = boss?.boss;
  return `${b ? `<div class="card"><div class="section-head"><div><h2>👹 ${esc(b.name)}</h2><p>Status: ${esc(b.status)} • Shared HP di MongoDB</p></div><span class="badge red">${num(b.hp)} / ${num(b.hpMax)} HP</span></div>${progress((b.hp / b.hpMax) * 100)}<div class="sub" style="margin-top:10px">ATK ${num(b.attack)} • DEF ${num(b.defense)} • Ends ${dt(b.endsAt)}</div></div>` : '<div class="card"><h3>World Boss</h3><p class="sub">Belum ada boss aktif. Scheduler akan spawn sesuai interval di Settings.</p></div>'}
  <div class="section">${table(['#', 'Player', 'Damage', 'Attacks', 'Rewarded'], topBoss.map((c, i) => `<tr><td>${i + 1}</td><td class="mono">${esc(c.userId)}</td><td>${num(c.damage)}</td><td>${c.attacks}</td><td>${c.rewarded ? '✅' : '—'}</td></tr>`))}</div>`;
}

function renderStatistics() {
  const { overview, charts } = state.data;
  return `<div class="grid cols-4">
    ${metricCard('Players', num(overview.players), 'total')}
    ${metricCard('Active Players', num(overview.activePlayers), '7 hari')}
    ${metricCard('Coin Circulation', money(overview.coinCirculation), '')}
    ${metricCard('Transactions', num(overview.transactions), '')}
    ${metricCard('Hunts', num(overview.hunts), '')}
    ${metricCard('Monsters', num(overview.monsters), '')}
    ${metricCard('Pets', num(overview.pets), '')}
    ${metricCard('Battles', num(overview.battles), '')}
    ${metricCard('Market Trades', num(overview.marketTransactions), '')}
    ${metricCard('Guilds', num(overview.guilds), '')}
    ${metricCard('World Boss Sessions', num(overview.bossSessions), '')}
    ${metricCard('Achievements', num(overview.achievements), '')}
  </div>
  <div class="section card"><div class="section-head"><div><h2>Activity 7 Hari</h2><p>Transaksi, hunts, battles, market</p></div></div><div class="chart-wrap" style="height:280px"><canvas id="chartStats"></canvas></div></div>
  <div class="section">${table(['Tanggal', 'Transaksi', 'Volume', 'Hunts', 'Battles', 'Market'], charts.map((c) => `<tr><td>${esc(c.date)}</td><td>${num(c.transactions)}</td><td>${money(c.volume)}</td><td>${num(c.hunts)}</td><td>${num(c.battles)}</td><td>${num(c.market)}</td></tr>`))}</div>
  <p class="sub">Auto-refresh setiap 30 detik. Generated: ${dt(overview.generatedAt)}</p>`;
}

function renderLogin() {
  $('#loginPanel').hidden = false;
  $('#content').hidden = true;
  $('#guildIdInput').value = state.guildId || '';
  $('#adminKeyInput').value = '';
}

function settingField(section, key, field, value) {
  const id = `set_${section}_${key}`;
  if (field.type === 'boolean') {
    return `<div class="field"><label>${esc(field.label)}</label><label class="row"><input type="checkbox" data-section="${section}" data-key="${key}" id="${id}" ${value ? 'checked' : ''}/> <span class="sub">${value ? 'Aktif' : 'Nonaktif'}</span></label></div>`;
  }
  if (field.type === 'number') {
    return `<div class="field"><label>${esc(field.label)}</label><input type="number" id="${id}" data-section="${section}" data-key="${key}" value="${esc(value)}" min="${field.min ?? ''}" max="${field.max ?? ''}" step="${field.step ?? 1}" /></div>`;
  }
  return `<div class="field"><label>${esc(field.label)}</label><input type="text" id="${id}" data-section="${section}" data-key="${key}" value="${esc(value)}" maxlength="${field.maxLength || 64}" /></div>`;
}

function renderCommands() {
  const items = state.commands || [];
  const enabled = items.filter((entry) => entry.enabled).length;
  return `<div class="grid cols-3 section">
    ${metricCard('Commands', num(items.length), 'terdaftar di registry')}
    ${metricCard('Enabled', num(enabled), 'aktif di guild ini')}
    ${metricCard('Disabled', num(items.length - enabled), 'disembunyikan dari handler')}
  </div>
  <div class="section card"><div class="section-head"><div><h2>Command Management</h2><p>Perubahan langsung disimpan ke MongoDB dan aktif tanpa restart.</p></div></div>
    ${table(['Command', 'Kategori', 'Status', 'Aksi'], items.map((entry) => `<tr><td class="mono">${esc(entry.name)}</td><td><span class="badge">${esc(entry.category)}</span></td><td>${entry.enabled ? '✅ ON' : '⛔ OFF'}</td><td><button class="btn ${entry.enabled ? 'ghost' : 'primary'}" data-toggle-command="${esc(entry.name.replace(/^6/, ''))}" data-enabled="${entry.enabled ? 'false' : 'true'}">${entry.enabled ? 'Disable' : 'Enable'}</button></td></tr>`))}
  </div>`;
}

function renderCategories() {
  const items = state.categories || [];
  return `<div class="section"><div class="section-head"><div><h2>Category Management</h2><p>Matikan satu kategori untuk menonaktifkan semua command di dalamnya.</p></div></div>
    <div class="grid cols-2">${items.map((category) => `<div class="card"><div class="section-head"><div><h3>${category.emoji} ${esc(category.label)}</h3><p>${esc(category.blurb)}</p></div><button class="btn ${category.enabled ? 'ghost' : 'primary'}" data-toggle-category="${esc(category.id)}" data-enabled="${category.enabled ? 'false' : 'true'}">${category.enabled ? 'Disable' : 'Enable'}</button></div><div class="sub">${num(category.commands.length)} commands • ${num(category.commands.filter((c) => c.enabled).length)} aktif</div><div class="mono" style="margin-top:8px;font-size:11px">${category.commands.map((c) => esc(c.name.replace(/^6/, ''))).join(' · ')}</div></div>`).join('')}</div>
  </div>`;
}

function renderSettings() {
  const settings = state.settings;
  if (!settings) return '<div class="loading"><div class="spinner"></div> Memuat settings…</div>';
  const sections = ['economy', 'hunting', 'pets', 'battle', 'minigames', 'market', 'guild', 'worldBoss'];
  const active = state.section;
  const schema = settings.schema?.[active] || {};
  const values = active === 'economy' ? settings.economy : (settings.game?.[active] || {});
  const fields = Object.entries(schema.fields || {}).map(([key, field]) => settingField(active, key, field, values[key]));
  return `<div class="tabs">${sections.map((s) => `<button class="tab ${s === active ? 'active' : ''}" data-settings-tab="${s}">${esc(settings.schema?.[s]?.label || s)}</button>`).join('')}</div>
  <div class="card"><div class="section-head"><div><h2>${esc(schema.label || active)}</h2><p>Perubahan langsung berlaku tanpa restart. Tersimpan per guild + history.</p></div><span class="badge green">${esc(state.guildId)}</span></div>
    <div class="form-grid">${fields.join('')}</div>
    <div class="settings-actions"><button class="btn primary" id="saveSettingsBtn">Simpan ${esc(schema.label || active)}</button><button class="btn ghost" id="resetSettingsBtn">Reset ke default</button></div>
  </div>
  <div class="section"><div class="section-head"><div><h2>Change History</h2><p>Audit perubahan konfigurasi</p></div></div>
    ${table(['Waktu', 'Section', 'Actor', 'Ringkasan'], (settings.history || []).map((h) => `<tr><td>${dt(h.createdAt)}</td><td><span class="badge red">${esc(h.section)}</span></td><td>${esc(h.actor)}</td><td class="mono">${esc(JSON.stringify(h.after).slice(0, 120))}</td></tr>`), 'Belum ada perubahan.')}
  </div>`;
}

function renderDropRates() {
  const settings = state.settings;
  if (!settings) return '<div class="loading"><div class="spinner"></div> Memuat drop rates…</div>';
  const rates = settings.dropRates || settings.game?.dropRates || {};
  const renderTable = (key, label) => {
    const tableData = rates[key] || {};
    const rows = Object.entries(tableData).map(([rarity, value]) => `<div class="rate-row" data-table="${key}" data-rarity="${rarity}">
      <strong style="text-transform:capitalize">${esc(rarity)}</strong>
      <input type="number" min="0" max="100" step="0.01" value="${esc(value)}" class="rate-input" />
      <div class="rate-bar"><i style="width:${Math.min(100, Number(value) || 0)}%"></i></div>
      <span class="rate-pct">${Number(value).toFixed(2)}%</span>
    </div>`).join('');
    return `<div class="card"><div class="section-head"><div><h2>${esc(label)}</h2><p>Total harus tepat 100%.</p></div><span class="sum" id="sum_${key}">0%</span></div>${rows}</div>`;
  };
  return `<div class="grid cols-2">${renderTable('monster', 'Monster Rarity Table')}${renderTable('pet', 'Pet Egg Rarity Table')}</div>
  <div class="settings-actions"><button class="btn primary" id="saveDropBtn">Simpan Drop Rates</button><button class="btn ghost" id="resetDropBtn">Reset Default</button><a class="btn ghost" href="/dashboard/settings">Buka Settings</a></div>
  <div class="card section"><h3>Preview</h3><p class="sub">Perubahan disimpan ke <code>game_settings.dropRates</code> dan dipakai hunt/hatch berikutnya tanpa restart. Rarity dengan 0% dinonaktifkan; distribusi otomatis mengikuti tabel.</p><div id="dropPreview" class="sub"></div></div>`;
}

async function renderTransactions() {
  const result = await api(withGuild('/api/dashboard/transactions?limit=100'));
  return `<div class="card"><div class="section-head"><div><h2>Audit Log</h2><p>100 transaksi terbaru</p></div><button class="btn ghost" onclick="window.print()">Print</button></div>
    ${table(['Waktu', 'User', 'Tipe', 'Jumlah', 'Status', 'Idempotency'], result.data.map((t) => `<tr><td>${dt(t.createdAt)}</td><td class="mono">${esc(t.userId)}</td><td><span class="badge red">${esc(t.type)}</span></td><td>${t.amount > 0 ? '+' : ''}${num(t.amount)}</td><td>${esc(t.status)}</td><td class="mono">${esc(t.idempotencyKey)}</td></tr>`))}
  </div>`;
}

function updateDropSums() {
  for (const key of ['monster', 'pet']) {
    let sum = 0;
    document.querySelectorAll(`.rate-row[data-table="${key}"]`).forEach((row) => {
      const value = Math.max(0, Number(row.querySelector('input').value) || 0);
      sum += value;
      row.querySelector('.rate-pct').textContent = `${value.toFixed(2)}%`;
      row.querySelector('.rate-bar i').style.width = `${Math.min(100, value)}%`;
    });
    const el = document.getElementById(`sum_${key}`);
    if (el) {
      el.textContent = `${sum.toFixed(2)}% ${Math.abs(sum - 100) < 0.001 ? '✅' : '❌'}`;
      el.className = `sum ${Math.abs(sum - 100) < 0.001 ? 'ok' : 'bad'}`;
    }
  }
  const preview = document.getElementById('dropPreview');
  if (preview) preview.textContent = 'Tabel aktif akan langsung dipakai RNG berbobot pada hunt/hatch berikutnya. Tidak ada cache permanen.';
}

function bindPage() {
  document.querySelectorAll('[data-toggle-command]').forEach((button) => {
    button.onclick = async () => {
      try {
        await api(withGuild('/api/dashboard/commands'), { method: 'PATCH', body: JSON.stringify({ command: button.dataset.toggleCommand, enabled: button.dataset.enabled === 'true' }) });
        toast('Command diperbarui tanpa restart.');
        await loadMetaPanels();
        render();
      } catch (error) { toast(error.message, 'error'); }
    };
  });
  document.querySelectorAll('[data-toggle-category]').forEach((button) => {
    button.onclick = async () => {
      try {
        await api(withGuild('/api/dashboard/categories'), { method: 'PATCH', body: JSON.stringify({ category: button.dataset.toggleCategory, enabled: button.dataset.enabled === 'true' }) });
        toast('Kategori diperbarui tanpa restart.');
        await loadMetaPanels();
        render();
      } catch (error) { toast(error.message, 'error'); }
    };
  });
  document.querySelectorAll('[data-settings-tab]').forEach((button) => {
    button.onclick = () => { state.section = button.dataset.settingsTab; render(); };
  });
  const saveSettings = document.getElementById('saveSettingsBtn');
  if (saveSettings) saveSettings.onclick = async () => {
    const values = {};
    document.querySelectorAll('[data-section]').forEach((input) => {
      const section = input.dataset.section;
      if (section !== state.section) return;
      values[input.dataset.key] = input.type === 'checkbox' ? input.checked : input.value;
    });
    try {
      await api(withGuild(`/api/dashboard/settings/${state.section}`), { method: 'PATCH', body: JSON.stringify({ values }) });
      toast('Settings tersimpan. Berlaku tanpa restart.');
      await loadSettings();
      render();
    } catch (error) { toast(error.message, 'error'); }
  };
  const resetSettings = document.getElementById('resetSettingsBtn');
  if (resetSettings) resetSettings.onclick = async () => {
    if (!confirm(`Reset ${state.section} ke default?`)) return;
    try {
      await api(withGuild(`/api/dashboard/settings/${state.section}/reset`), { method: 'POST', body: '{}' });
      toast('Section di-reset ke default.');
      await loadSettings();
      render();
    } catch (error) { toast(error.message, 'error'); }
  };
  document.querySelectorAll('.rate-input').forEach((input) => input.addEventListener('input', updateDropSums));
  if (document.querySelector('.rate-input')) updateDropSums();
  const saveDrop = document.getElementById('saveDropBtn');
  if (saveDrop) saveDrop.onclick = async () => {
    const payload = { monster: {}, pet: {} };
    document.querySelectorAll('.rate-row').forEach((row) => {
      payload[row.dataset.table][row.dataset.rarity] = Number(row.querySelector('input').value) || 0;
    });
    for (const key of ['monster', 'pet']) {
      const sum = Object.values(payload[key]).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) > 0.001) return toast(`Total ${key} harus 100% (sekarang ${sum.toFixed(2)}%).`, 'error');
    }
    try {
      await api(withGuild('/api/dashboard/drop-rates'), { method: 'PATCH', body: JSON.stringify(payload) });
      toast('Drop rates disimpan & langsung aktif.');
      await loadSettings();
      render();
    } catch (error) { toast(error.message, 'error'); }
  };
  const resetDrop = document.getElementById('resetDropBtn');
  if (resetDrop) resetDrop.onclick = async () => {
    if (!confirm('Reset drop rates ke default?')) return;
    try {
      await api(withGuild('/api/dashboard/drop-rates/reset'), { method: 'POST', body: '{}' });
      toast('Drop rates di-reset.');
      await loadSettings();
      render();
    } catch (error) { toast(error.message, 'error'); }
  };
}

function drawCurrentCharts() {
  if (!state.data) return;
  const { charts } = state.data;
  if ($('#chartMain')) drawChart($('#chartMain'), charts.map((c) => c.date), [
    { data: charts.map((c) => c.volume), color: '#ff2d3f', fill: 'rgba(255,45,63,.12)' },
  ], { title: 'Volume koin' });
  if ($('#chartStats')) drawChart($('#chartStats'), charts.map((c) => c.date), [
    { data: charts.map((c) => c.hunts), color: '#ff8a00', fill: 'rgba(255,138,0,.08)' },
    { data: charts.map((c) => c.battles), color: '#38bdf8', fill: 'rgba(56,189,248,.06)' },
    { data: charts.map((c) => c.market), color: '#a855f7', fill: 'rgba(168,85,247,.06)' },
  ], { title: 'Hunts (oranye) • Battles (biru) • Market (ungu)' });
}

function render() {
  const page = state.page;
  const meta = PAGE_META[page] || PAGE_META.overview;
  document.title = `666 SYSTEM — ${meta[0]}`;
  $('#pageTitle').textContent = meta[0];
  $('#pageSubtitle').textContent = meta[1];
  $('#guildPill').textContent = state.guildId ? `Guild: ${state.guildId}` : 'Guild: global';
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  const container = $('#page');
  if (!$('#content').hidden) {
    if (page === 'settings') container.innerHTML = renderSettings();
    else if (page === 'drop-rates') container.innerHTML = renderDropRates();
    else if (page === 'overview') container.innerHTML = renderOverview();
    else if (page === 'economy') container.innerHTML = renderEconomy();
    else if (page === 'hunting') container.innerHTML = renderHunting();
    else if (page === 'pets') container.innerHTML = renderPets();
    else if (page === 'battle') container.innerHTML = renderBattle();
    else if (page === 'minigames') container.innerHTML = renderMinigames();
    else if (page === 'quests') container.innerHTML = renderQuests();
    else if (page === 'market') container.innerHTML = renderMarket();
    else if (page === 'guilds') container.innerHTML = renderGuilds();
    else if (page === 'worldboss') container.innerHTML = renderWorldboss();
    else if (page === 'statistics') container.innerHTML = renderStatistics();
    else if (page === 'transactions') container.innerHTML = '<div class="loading"><div class="spinner"></div> Memuat audit log…</div>';
    else if (page === 'commands') container.innerHTML = renderCommands();
    else if (page === 'categories') container.innerHTML = renderCategories();
    else container.innerHTML = renderOverview();
    if (page === 'transactions') renderTransactions().then((html) => { container.innerHTML = html; }).catch((error) => { container.innerHTML = `<div class="alert error">${esc(error.message)}</div>`; });
    bindPage();
    drawCurrentCharts();
  }
}

async function loadData() {
  if (!state.token && !state.adminKey) return;
  $('#loading').hidden = false;
  try {
    const [dataResult, settingsResult, commandsResult, categoriesResult] = await Promise.all([
      api(withGuild('/api/dashboard/data')),
      state.guildId ? api(withGuild('/api/dashboard/settings')) : Promise.resolve(null),
      state.guildId ? api(withGuild('/api/dashboard/commands')).catch(() => null) : Promise.resolve(null),
      state.guildId ? api(withGuild('/api/dashboard/categories')).catch(() => null) : Promise.resolve(null),
    ]);
    state.data = dataResult.data;
    if (settingsResult) state.settings = settingsResult.data;
    if (commandsResult) state.commands = commandsResult.data.commands || [];
    if (categoriesResult) state.categories = categoriesResult.data || [];
    $('#connectionStatus').className = 'status-dot online';
    $('#connectionText').textContent = 'Live • MongoDB';
    $('#globalError').hidden = true;
    if (state.page === 'settings' || state.page === 'drop-rates') await loadSettings();
    render();
  } catch (error) {
    $('#connectionStatus').className = 'status-dot offline';
    $('#connectionText').textContent = 'Disconnected';
    if (error.status === 401) {
      state.adminKey = '';
      state.token = '';
      sessionStore.removeItem('666_session');
      renderLogin();
      $('#loginHint').textContent = 'Admin key / sesi ditolak. Periksa DASHBOARD_ADMIN_KEY.';
    } else {
      $('#globalError').hidden = false;
      $('#globalError').textContent = `Gagal memuat: ${error.message}`;
    }
  } finally {
    $('#loading').hidden = true;
  }
}

async function loadMetaPanels() {
  if (!state.guildId) return;
  const [commandsResult, categoriesResult] = await Promise.all([
    api(withGuild('/api/dashboard/commands')).catch(() => null),
    api(withGuild('/api/dashboard/categories')).catch(() => null),
  ]);
  if (commandsResult) state.commands = commandsResult.data.commands || [];
  if (categoriesResult) state.categories = categoriesResult.data || [];
}

async function loadSettings() {
  if (!state.guildId) return;
  const result = await api(withGuild('/api/dashboard/settings'));
  state.settings = result.data;
}

async function connect() {
  const adminKey = $('#adminKeyInput').value.trim();
  state.guildId = $('#guildIdInput').value.trim();
  if (!adminKey) return toast('Admin key wajib diisi.', 'error');
  if (state.guildId && !/^\d{17,20}$/.test(state.guildId)) return toast('Guild ID harus snowflake 17-20 digit.', 'error');
  try {
    const response = await fetch('/api/dashboard/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey }),
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.ok) throw new Error(json.message || json.error || 'Admin key ditolak.');
    state.token = json.data.token;
    state.adminKey = '';
    sessionStore.setItem('666_session', state.token);
    sessionStore.removeItem('666_admin_key');
    localStore.setItem('666_guild_id', state.guildId);
    $('#loginHint').textContent = '';
    $('#loginPanel').hidden = true;
    $('#content').hidden = false;
    await loadData();
  } catch (error) {
    toast(error.message, 'error');
    $('#loginHint').textContent = error.message;
  }
}

function updateClock() {
  const el = $('#lastUpdated');
  if (el) el.textContent = dt(new Date());
}

function init() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const page = parts[0] === 'dashboard' && parts[1] ? parts[1] : 'overview';
  state.page = PAGE_META[page] ? page : 'overview';
  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  $('#refreshBtn').onclick = () => loadData().then(() => toast('Data di-refresh.'));
  $('#settingsBtn').onclick = () => { $('#loginPanel').hidden = false; $('#content').hidden = true; renderLogin(); };
  $('#connectBtn').onclick = connect;
  $('#adminKeyInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
  $('#guildIdInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
  document.querySelectorAll('.nav a').forEach((a) => { a.onclick = () => { $('#sidebar').classList.remove('open'); }; });
  if (state.token) {
    $('#loginPanel').hidden = true;
    $('#content').hidden = false;
    loadData();
  } else {
    renderLogin();
  }
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (state.token && !['settings', 'drop-rates'].includes(state.page)) loadData();
  }, 30000);
}

if (hasDOM) window.addEventListener('DOMContentLoaded', init);

if (typeof module !== 'undefined' && module.exports) module.exports = { state, api, render, hasDOM };
