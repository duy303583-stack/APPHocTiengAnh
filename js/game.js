// 🎮 Trung tâm Gamification: Chạm trán AI, Đấu trường 60 giây, Đường đua chuỗi ngày, Giải đấu tuần,
// Nhiệm vụ ngày/tuần/sự kiện, Cửa hàng đá quý, Bang hội & Boss.
// App không có máy chủ nhiều người chơi: đối thủ ngẫu nhiên, giải đấu và bang hội dùng người chơi mô phỏng;
// đấu thật thì có "2 người cùng máy" và "thách đấu bạn bè" qua đường link.
// Script thường, nạp trước js/app.js; dùng các hàm chung của app.js lúc chạy.

const GAME_TABS = [
  ['battle', '⚔️', 'Chạm trán AI'], ['pvp', '🏟️', 'Đấu 60 giây'], ['streak', '🔥', 'Chuỗi ngày'],
  ['league', '🏆', 'Giải đấu'], ['quests', '📋', 'Nhiệm vụ'], ['shop', '🛍️', 'Cửa hàng'], ['guild', '🛡️', 'Bang hội'],
];
const DIFFS = {
  easy: { name: 'Dễ', icon: '🙂', skill: 0.45, t: [4, 8], xp: 30, gems: 5 },
  normal: { name: 'Thường', icon: '😤', skill: null, t: [2, 6], xp: 50, gems: 10 },
  hard: { name: 'Khó', icon: '😈', skill: 0.9, t: [1.2, 3.5], xp: 80, gems: 25 },
};
const MODES = {
  quick: { icon: '⚡', name: 'Nhanh tay lẹ mắt', desc: 'Nhìn từ tiếng Anh, chọn nghĩa đúng' },
  reflex: { icon: '🔁', name: 'Phản xạ nghĩa', desc: 'Nhìn nghĩa tiếng Việt, chọn từ tiếng Anh' },
  fill: { icon: '✍️', name: 'Điền từ', desc: 'Chọn từ còn thiếu trong câu' },
};
const TIERS = [['Đồng', '🥉'], ['Bạc', '🥈'], ['Vàng', '🥇'], ['Bạch Kim', '💠'], ['Kim Cương', '💎'], ['Cao Thủ', '👑']];
const LEAGUE_SIZE = 30, PROMOTE = 5, DEMOTE = 5;
const BOT_FIRST = ['Mai', 'Tuấn', 'Linh', 'Quang', 'Hà', 'Đức', 'Thảo', 'Bảo', 'Ngọc', 'Khoa', 'Lan', 'Huy', 'Vy', 'Nam', 'Trang', 'Phúc', 'An', 'Minh', 'Yến', 'Sơn'];
const STREAK_CHESTS = [[3, 10], [7, 50], [30, 200], [100, 1000]];
const FREEZE_PRICE = 50, MAX_FREEZES = 2;
const RARE_OUTFITS = ['🧞', '🧜', '🦚'];
const SHOP = {
  outfit: { title: '👗 Trang phục cho Gia sư AI', items: [['🧙', 'Phù thủy', 120], ['🤠', 'Cao bồi', 120], ['🥷', 'Ninja', 150], ['🧛', 'Bá tước', 150], ['🦸', 'Siêu anh hùng', 250], ['🎅', 'Ông già Noel', 200], ['👑', 'Nhà vua', 300]] },
  voice: { title: '🎙️ Giọng nói của Gia sư AI', items: [['deep', 'Giọng trầm ấm', 80, 0.8], ['bright', 'Giọng trong trẻo', 80, 1.25], ['robot', 'Giọng robot', 100, 0.55]] },
  title: { title: '🏷️ Danh hiệu độc quyền', items: [['Chiến Thần Phát Âm', '🗣️', 150], ['Chúa Tể Ngữ Pháp', '📐', 150], ['Vua Từ Vựng', '📚', 150], ['Chiến Binh Lửa', '🔥', 100], ['Kẻ Hủy Diệt Boss', '🐲', 200]] },
  frame: { title: '🖼️ Khung viền avatar', items: [['gold', 'Viền vàng', 80], ['fire', 'Viền lửa', 120], ['rainbow', 'Viền cầu vồng', 150], ['diamond', 'Viền kim cương', 250]] },
  sfx: { title: '🔔 Âm thanh khi làm bài đúng', items: [['chime', 'Chuông ngân', 60], ['coin', 'Đồng xu', 60], ['fanfare', 'Kèn chiến thắng', 100]] },
};
const EVENTS = [
  { id: 'halloween', icon: '🎃', name: 'Lễ hội Bí ngô', from: '10-15', to: '11-05', badge: 'Thợ săn Bí ngô' },
  { id: 'xmas', icon: '🎄', name: 'Giáng sinh an lành', from: '12-01', to: '12-31', badge: 'Tuần lộc chăm học' },
  { id: 'tet', icon: '🧧', name: 'Tết đến xuân về', from: '01-01', to: '02-20', badge: 'Lì xì tri thức' },
  { id: 'summer', icon: '☀️', name: 'Hè rực rỡ', from: '06-01', to: '08-31', badge: 'Chiến binh mùa hè' },
  { id: 'school', icon: '🎒', name: 'Mùa tựu trường', from: '09-01', to: '09-30', badge: 'Học sinh gương mẫu' },
];
const EVENT_TASKS = [['wins', '⚔️ Thắng 3 trận Chạm trán AI', 3], ['words', '🆕 Học 15 từ mới', 15], ['streak', '🔥 Giữ chuỗi 3 ngày', 3]];
const WEEKLY = [
  ['xp', '⭐ Kiếm 300 XP trong tuần', 300, 30], ['days', '📅 Học 5 ngày trong tuần', 5, 40], ['wins', '⚔️ Thắng 3 trận Chạm trán AI', 3, 25],
  ['pvp', '🏟️ Chơi 3 trận Đấu 60 giây', 3, 25], ['words', '🆕 Thêm 20 từ mới vào sổ', 20, 30],
];
const BOSSES = [['Rồng Ngữ Pháp', '🐲'], ['Quái Vật Từ Vựng', '👾'], ['Titan Phát Âm', '🗿'], ['Bạch Tuộc Thì Động Từ', '🐙']];
const GUILD_SUGGEST = [['Đội Cú Đêm', '🦉'], ['Biệt đội A1', '🚀'], ['Hội Ngữ Pháp', '📐'], ['Câu lạc bộ Phát Âm', '🎤']];

// ---------- Tiện ích ----------
function rng(seed) { // mulberry32: cùng seed → cùng dãy số (dùng cho thách đấu bạn bè)
  let a = Math.floor(seed) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rshuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const weekKeyOf = d => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dayKey(x); };
const thisWeek = () => weekKeyOf(new Date());
const weekXP = wk => Array.from({ length: 7 }, (_, i) => { const d = new Date(wk + 'T00:00'); d.setDate(d.getDate() + i); return state.xpByDay[dayKey(d)] || 0; }).reduce((a, b) => a + b, 0);
const daysElapsed = () => ((new Date().getDay() + 6) % 7) + 1;

function g() { // dữ liệu gamification trong state (tạo khi thiếu, reset theo tuần)
  state.gems ??= 0; state.freezes ??= 0; state.chests ??= {}; state.bestStreak = Math.max(state.bestStreak || 0, currentStreak());
  state.owned ??= { outfit: [], voice: [], title: [], frame: [], sfx: [] };
  state.equipped ??= {};
  state.evBadges ??= [];
  if (!state.wk || state.wk.week !== thisWeek()) state.wk = { week: thisWeek(), wins: 0, pvp: 0, words: 0, claimed: {} };
  const ev = activeEvent();
  if (ev && (!state.ev || state.ev.id !== ev.key)) state.ev = { id: ev.key, wins: 0, words: 0, done: false };
  return state;
}
function addGems(n, why) { g(); state.gems += n; save(); if (why) toast(`💎 +${n} đá quý · ${why}`); }
function activeEvent(d = new Date()) {
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const e = EVENTS.find(e => md >= e.from && md <= e.to);
  return e && { ...e, key: `${e.id}-${d.getFullYear()}`, end: new Date(`${d.getFullYear()}-${e.to}T23:59:59`) };
}

// Gọi từ app.js khi có từ mới / thắng trận.
function gameOnNewWords(n) { if (!n) return; g(); state.wk.words += n; if (state.ev) state.ev.words += n; }
function gameOnWin() { g(); state.wk.wins++; if (state.ev) state.ev.wins++; }

// Thẻ hồi sinh: lỡ đúng 1 ngày thì dùng thẻ để giữ chuỗi (app.js gọi trước khi tính chuỗi).
function useStreakFreeze() {
  g();
  if (state.lastDay === daysAgo(2) && state.freezes > 0) {
    state.freezes--; state.lastDay = daysAgo(1);
    setTimeout(() => toast('🧊 Đã dùng Thẻ hồi sinh: chuỗi ngày được giữ nguyên!'), 800);
  }
}

// Trang trí header: đá quý, danh hiệu, khung avatar, giọng gia sư.
function decorateTop() {
  g();
  const av = $('#avatar');
  av.className = 'avatar' + (state.equipped.frame ? ` frame-${state.equipped.frame}` : '');
  $('#topStats').innerHTML = `<a class="stat-badge gem" href="#/game/shop" title="Đá quý">💎 ${state.gems}</a>`;
  if (state.equipped.title) $('#userLevel').insertAdjacentHTML('afterbegin', `<span class="title-tag">${esc(state.equipped.title)}</span> `);
  const v = SHOP.voice.items.find(i => i[0] === state.equipped.voice);
  window.EM_PITCH = v ? v[3] : 1;
}

let sfxCtx = null;
function playCorrect() {
  const id = state.equipped?.sfx;
  if (!id || !(window.AudioContext || window.webkitAudioContext)) return;
  sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)();
  const notes = { chime: [[880, 0], [1320, 0.12]], coin: [[988, 0], [1319, 0.08]], fanfare: [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]] }[id];
  for (const [f, t] of notes) {
    const o = sfxCtx.createOscillator(), gn = sfxCtx.createGain(), at = sfxCtx.currentTime + t;
    o.type = id === 'coin' ? 'square' : 'sine'; o.frequency.value = f;
    gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(0.18, at + 0.02); gn.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    o.connect(gn).connect(sfxCtx.destination); o.start(at); o.stop(at + 0.4);
  }
}

// ---------- Câu hỏi ----------
function wordPool(fixed) {
  const base = fixed ? LESSONS.filter(l => ['A1', 'A2'].includes(l.level)).flatMap(l => l.vocab) // cố định để thách đấu công bằng
    : [...Object.values(state.srs), ...LESSONS.filter(isUnlocked).flatMap(l => l.vocab)];
  const seen = new Set();
  return base.filter(v => v.en && v.vi && !seen.has(v.en.toLowerCase()) && seen.add(v.en.toLowerCase()));
}
function makeQ(mode, pool, r = Math.random) {
  if (mode === 'mix') mode = ['quick', 'reflex', 'fill'][Math.floor(r() * 3)];
  const blanks = pool.filter(v => v.ex && new RegExp(`\\b${v.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(v.ex));
  if (mode === 'fill' && blanks.length >= 1) {
    const c = blanks[Math.floor(r() * blanks.length)];
    const others = rshuffle(pool.filter(v => v.en !== c.en), r).slice(0, 3).map(v => v.en);
    return { prompt: c.ex.replace(new RegExp(`\\b${c.en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '_____'), hint: c.vi, answer: c.en, options: rshuffle([c.en, ...others], r), say: c.ex };
  }
  const c = pool[Math.floor(r() * pool.length)];
  const rev = mode === 'reflex';
  const key = rev ? 'en' : 'vi';
  const others = rshuffle([...new Set(pool.map(v => v[key]))].filter(x => x !== c[key]), r).slice(0, 3);
  return { prompt: rev ? c.vi : c.en, hint: rev ? 'Chọn từ tiếng Anh' : 'Chọn nghĩa tiếng Việt', answer: c[key], options: rshuffle([c[key], ...others], r), say: rev ? null : c.en };
}

// ---------- Màn hình chính ----------
function viewGame(arg = 'battle') {
  g(); leagueSync();
  if (arg.startsWith('ch.')) return viewChallenge(arg.slice(3));
  const tab = GAME_TABS.some(t => t[0] === arg) ? arg : 'battle';
  const tier = TIERS[state.league.tier];
  view.innerHTML = `<h1>🎮 Trung tâm Gamification</h1>
    <div class="card hero game-hero"><div class="gh-stat"><b>💎 ${state.gems}</b><span>đá quý</span></div>
      <div class="gh-stat"><b>${flame(currentStreak()).icon} ${currentStreak()}</b><span>ngày liên tiếp</span></div>
      <div class="gh-stat"><b>${tier[1]} ${tier[0]}</b><span>giải đấu tuần</span></div>
      <div class="gh-stat"><b>${state.tutorAvatar}</b><span>gia sư của bạn</span></div></div>
    <div class="utils">${GAME_TABS.map(([id, i, n]) => `<a class="btn sm ${id === tab ? '' : 'ghost'}" style="flex:none" href="#/game/${id}">${i} ${n}</a>`).join('')}</div>
    <div id="gm"></div>`;
  ({ battle: tabBattle, pvp: tabPvp, streak: tabStreak, league: tabLeague, quests: tabQuests, shop: tabShop, guild: tabGuild })[tab]($('#gm'));
}

// ===== 1. Chạm trán AI =====
function tabBattle(el) {
  const pool = wordPool();
  let mode = 'quick', diff = 'normal';
  el.innerHTML = `<div class="card"><b>⚔️ Chạm trán AI</b><p class="muted small">8 vòng đấu với Bot AI. Đúng +10 điểm, còn bao nhiêu giây cộng thêm bấy nhiêu. Thắng AI khó được nhiều XP, đá quý và cơ hội mở khóa trang phục hiếm.</p>
      <label>Mini-game</label><div class="pick-grid" id="gm-mode">${Object.entries(MODES).map(([id, m]) => `<button class="option ${id === mode ? 'selected' : ''}" data-v="${id}"><b>${m.icon} ${m.name}</b><div class="muted small">${m.desc}</div></button>`).join('')}</div>
      <label>Độ khó của Bot</label><div class="row" id="gm-diff">${Object.entries(DIFFS).map(([id, d]) => `<button class="btn sm ${id === diff ? '' : 'ghost'}" data-v="${id}">${d.icon} ${d.name}</button>`).join('')}</div>
      <p class="small" id="gm-prize"></p>
      <button class="btn block" id="gm-go" ${pool.length >= 4 ? '' : 'disabled'}>⚔️ Vào trận</button>
      ${pool.length >= 4 ? '' : '<p class="muted small">Hãy học ít nhất một bài để có từ vựng thi đấu.</p>'}
      <p class="muted small" style="margin-bottom:0">Thành tích: ${state.battles.wins} thắng / ${state.battles.played} trận · Trang phục hiếm: ${RARE_OUTFITS.map(o => state.owned.outfit.includes(o) ? o : '❔').join(' ')}</p></div>`;
  const prize = () => {
    const d = DIFFS[diff];
    $('#gm-prize').innerHTML = `🏆 Thắng: <b>+${d.xp} XP</b>, <b>+${d.gems} 💎</b>${diff === 'hard' ? ', <b>35% cơ hội mở trang phục hiếm</b>' : ''} · Thua: +10 XP, +1 💎`;
  };
  $$('#gm-mode [data-v]', el).forEach(b => b.onclick = () => { mode = b.dataset.v; $$('#gm-mode .option', el).forEach(x => x.classList.toggle('selected', x === b)); });
  $$('#gm-diff [data-v]', el).forEach(b => b.onclick = () => { diff = b.dataset.v; $$('#gm-diff .btn', el).forEach(x => x.classList.toggle('ghost', x !== b)); prize(); });
  $('#gm-go', el).onclick = () => startAIBattle(mode, diff, pool);
  prize();
}

function startAIBattle(mode, diff, pool) {
  document.body.classList.add('no-tabs');
  const D = DIFFS[diff], skill = D.skill ?? ({ A1: .55, A2: .6, B1: .65, B2: .72, C1: .78, C2: .85 }[state.profile.level] || .6);
  const route = location.hash, ROUNDS = 8;
  let r = 0, me = 0, ai = 0;
  const round = () => {
    if (location.hash !== route) return;
    if (r >= ROUNDS) return finish();
    const q = makeQ(mode, pool);
    const aiTime = D.t[0] + Math.random() * (D.t[1] - D.t[0]), aiRight = Math.random() < skill;
    let left = 10, answered = false;
    view.innerHTML = `<div class="spread"><b>🧑 Bạn: ${me}</b><span class="tag">${MODES[mode].icon} Vòng ${r + 1}/${ROUNDS} · ${D.icon} ${D.name}</span><b>${state.tutorAvatar} AI: ${ai}</b></div>
      <div class="progress" style="margin:10px 0"><div id="b-time" style="width:100%"></div></div>
      <div class="card flashcard" style="min-height:120px;font-size:${mode === 'fill' ? '1.15rem' : '1.7rem'}">${esc(q.prompt)}<div class="sub">${esc(q.hint)}</div></div>
      <div id="b-opts">${q.options.map(o => `<button class="option" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      <p class="muted small" id="b-ai" style="text-align:center">${state.tutorAvatar} AI đang suy nghĩ...</p>`;
    if (q.say) say(q.say);
    const end = pick => {
      if (answered) return;
      answered = true; clearInterval(timer);
      const ok = pick === q.answer;
      if (ok) { me += 10 + Math.ceil(left); playCorrect(); }
      if (aiRight) ai += 10 + Math.max(0, Math.ceil(10 - aiTime));
      $$('#b-opts .option').forEach(b => { b.disabled = true; if (b.dataset.v === q.answer) b.classList.add('correct'); else if (b.dataset.v === pick) b.classList.add('wrong'); });
      $('#b-ai').textContent = `${state.tutorAvatar} AI ${aiRight ? 'trả lời đúng ✔' : 'trả lời sai ✘'} sau ${aiTime.toFixed(1)}s`;
      r++; setTimeout(round, 1200);
    };
    const timer = setInterval(() => {
      if (location.hash !== route) return clearInterval(timer);
      left -= 0.1;
      $('#b-time').style.width = `${Math.max(0, left * 10)}%`;
      if (10 - left >= aiTime && !answered) $('#b-ai').textContent = `${state.tutorAvatar} AI đã trả lời!`;
      if (left <= 0) end(null);
    }, 100);
    $$('#b-opts .option').forEach(b => b.onclick = () => end(b.dataset.v));
  };
  const finish = () => {
    state.battles.played++;
    const win = me > ai, tie = me === ai;
    let rare = null;
    if (win) {
      state.battles.wins++; gameOnWin();
      if (diff === 'hard' && Math.random() < 0.35) {
        rare = RARE_OUTFITS.find(o => !state.owned.outfit.includes(o));
        if (rare) state.owned.outfit.push(rare);
      }
    }
    const xp = win ? D.xp : tie ? 20 : 10, gems = win ? D.gems : tie ? 3 : 1;
    state.gems += gems;
    gainXP(xp);
    document.body.classList.remove('no-tabs');
    view.innerHTML = `<div class="card ${win ? 'hero' : ''}" style="text-align:center">
      <div style="font-size:3rem">${win ? '🏆' : tie ? '🤝' : '💪'}</div>
      <h1>${win ? 'Bạn thắng!' : tie ? 'Hòa!' : 'AI thắng lần này'}</h1>
      <p><b>${me}</b> – <b>${ai}</b> · ${D.icon} ${D.name} · ${MODES[mode].icon} ${MODES[mode].name}</p>
      <p>+${xp} XP · +${gems} 💎${rare ? `<br>✨ Mở khóa trang phục hiếm <span style="font-size:2rem">${rare}</span>! Vào Cửa hàng để mặc cho gia sư.` : ''}</p>
      <div class="row" style="justify-content:center"><button class="btn ${win ? 'white' : ''}" id="b-again">Đấu lại</button><a class="btn ghost" href="#/game/battle">Đổi chế độ</a></div></div>`;
    $('#b-again').onclick = () => startAIBattle(mode, diff, pool);
  };
  round();
}

// ===== 2. Đấu trường 60 giây =====
function tabPvp(el) {
  el.innerHTML = `<div class="card"><b>🏟️ Đấu trường sinh tử 60 giây</b><p class="muted small">Trả lời liên tục các câu hỏi từ vựng và điền từ. Ai đúng nhiều hơn trong 60 giây là người thắng.</p>
      <button class="option" id="pv-bot"><b>🎲 Ghép cặp ngẫu nhiên</b><div class="muted small">Gặp một đối thủ trình độ tương đương (người chơi mô phỏng)</div></button>
      <button class="option" id="pv-local"><b>👥 2 người cùng máy</b><div class="muted small">Đặt điện thoại giữa hai người, mỗi người một nửa màn hình. Đấu thật, ai bấm đúng trước được điểm</div></button>
      <button class="option" id="pv-friend"><b>🔗 Thách đấu bạn bè</b><div class="muted small">Chơi 60 giây rồi gửi link cho bạn. Bạn chơi đúng bộ câu hỏi đó và so điểm với bạn</div></button>
      <p class="muted small" style="margin-bottom:0">Tuần này: ${state.wk.pvp} trận.</p></div>`;
  const pool = wordPool(true);
  $('#pv-bot', el).onclick = () => runDuel({ pool, bot: true });
  $('#pv-local', el).onclick = () => runLocalDuel(pool);
  $('#pv-friend', el).onclick = () => runDuel({ pool, seed: Math.floor(Math.random() * 1e9) });
}

// Một người chơi 60 giây; bot=true có đối thủ mô phỏng; seed → bộ câu hỏi cố định để thách đấu.
function runDuel({ pool, bot = false, seed = null, rival = null }) {
  document.body.classList.add('no-tabs');
  const route = location.hash, r = seed !== null ? rng(seed) : Math.random;
  const opp = bot ? { name: `${pick2(BOT_FIRST)} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}.`, acc: 0.55 + Math.random() * 0.3 } : null;
  let me = 0, them = 0, left = 60, lock = 0, q;
  view.innerHTML = `<div class="spread"><b>🧑 Bạn: <span id="d-me">0</span></b><span class="tag" id="d-left">⏱ 60s</span>
      <b>${bot ? `🤺 ${esc(opp.name)}: <span id="d-them">0</span>` : rival ? `🎯 ${esc(rival.n)}: ${rival.p}` : '🔗 Thách đấu'}</b></div>
    <div class="progress" style="margin:10px 0"><div id="d-time" style="width:100%"></div></div>
    <div class="card flashcard" id="d-q" style="min-height:120px"></div><div id="d-opts"></div>`;
  const next = () => {
    q = makeQ('mix', pool, r);
    $('#d-q').innerHTML = `${esc(q.prompt)}<div class="sub">${esc(q.hint)}</div>`;
    $('#d-q').style.fontSize = q.prompt.length > 30 ? '1.1rem' : '1.6rem';
    $('#d-opts').innerHTML = q.options.map(o => `<button class="option" data-v="${esc(o)}">${esc(o)}</button>`).join('');
    $$('#d-opts .option').forEach(b => b.onclick = () => {
      if (Date.now() < lock) return;
      if (b.dataset.v === q.answer) { me++; $('#d-me').textContent = me; playCorrect(); next(); }
      else { b.classList.add('wrong'); lock = Date.now() + 1200; } // sai: khóa 1,2 giây
    });
  };
  let botAt = Date.now() + 2500 + Math.random() * 2500;
  const timer = setInterval(() => {
    if (location.hash !== route) return clearInterval(timer);
    left -= 0.1;
    $('#d-time').style.width = `${Math.max(0, left / 0.6)}%`;
    $('#d-left').textContent = `⏱ ${Math.ceil(Math.max(0, left))}s`;
    if (bot && Date.now() >= botAt) { if (Math.random() < opp.acc) $('#d-them').textContent = ++them; botAt = Date.now() + 2200 + Math.random() * 3000; }
    if (left <= 0) { clearInterval(timer); done(); }
  }, 100);
  const done = () => {
    document.body.classList.remove('no-tabs');
    state.wk.pvp++;
    const vs = bot ? them : rival ? rival.p : null;
    const win = vs !== null && me > vs, tie = vs !== null && me === vs;
    const xp = vs === null ? 20 : win ? 40 : tie ? 25 : 15, gems = win ? 10 : tie ? 4 : 2;
    state.gems += gems; gainXP(xp);
    const link = seed !== null ? `${location.href.split('#')[0]}#/game/ch.${b64(JSON.stringify({ s: seed, n: state.profile.name, p: me }))}` : '';
    view.innerHTML = `<div class="card ${win ? 'hero' : ''}" style="text-align:center"><div style="font-size:3rem">${vs === null ? '🎯' : win ? '🏆' : tie ? '🤝' : '💪'}</div>
      <h1>${vs === null ? `Bạn được ${me} điểm!` : win ? 'Bạn thắng!' : tie ? 'Hòa!' : 'Thua sát nút!'}</h1>
      ${vs !== null ? `<p><b>${me}</b> – <b>${vs}</b> ${bot ? `(${esc(opp.name)})` : `(${esc(rival.n)})`}</p>` : ''}
      <p>+${xp} XP · +${gems} 💎</p>
      ${link ? `<p class="small">Gửi link này cho bạn bè, họ sẽ chơi đúng bộ câu hỏi của bạn:</p><input id="d-link" readonly value="${esc(link)}" onclick="this.select()">
        <div class="row" style="justify-content:center;margin-top:8px"><button class="btn sm" id="d-copy">📋 Sao chép link</button>${navigator.share ? '<button class="btn sm ghost" id="d-share">📤 Chia sẻ</button>' : ''}</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:10px"><a class="btn ghost" href="#/game/pvp">Về Đấu trường</a></div></div>`;
    if (link) {
      $('#d-copy').onclick = () => navigator.clipboard?.writeText(link).then(() => toast('Đã sao chép link thách đấu 🔗'), () => $('#d-link').select());
      if ($('#d-share')) $('#d-share').onclick = () => navigator.share({ title: 'Thách đấu EngMate', text: `Mình được ${me} điểm trong 60 giây, bạn dám thử không?`, url: link }).catch(() => {});
    }
  };
  next();
}
const pick2 = a => a[Math.floor(Math.random() * a.length)];
const b64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

function viewChallenge(code) {
  let c;
  try { c = JSON.parse(unb64(code)); if (!Number.isFinite(c.s) || !Number.isFinite(c.p)) throw 0; } catch { view.innerHTML = '<div class="card">Link thách đấu không hợp lệ. <a href="#/game/pvp">Về Đấu trường</a></div>'; return; }
  c.n = String(c.n || 'Bạn bè').slice(0, 30);
  view.innerHTML = `<div class="card hero" style="text-align:center"><div style="font-size:3rem">🔗⚔️</div><h1>${esc(c.n)} thách đấu bạn!</h1>
    <p>${esc(c.n)} được <b>${c.p} điểm</b> trong 60 giây. Bạn sẽ chơi đúng bộ câu hỏi đó.</p>
    <button class="btn white" id="ch-go">Nhận lời thách đấu</button></div>`;
  $('#ch-go').onclick = () => runDuel({ pool: wordPool(true), seed: c.s, rival: c });
}

// 2 người cùng máy: nửa trên xoay ngược cho người ngồi đối diện.
function runLocalDuel(pool) {
  document.body.classList.add('no-tabs');
  const route = location.hash;
  const sc = [0, 0], lock = [0, 0];
  let left = 60, q;
  const half = i => `<div class="duel-half ${i ? '' : 'flip'}" data-p="${i}"><div class="spread"><b>${i ? '🔵 Người 2' : '🔴 Người 1'}: <span class="d-sc">0</span></b><span class="d-left">60s</span></div>
    <div class="duel-q"></div><div class="duel-opts"></div></div>`;
  const wrap = document.createElement('div');
  wrap.className = 'duel2';
  wrap.innerHTML = `${half(0)}<div class="duel-mid"><button class="btn sm ghost" id="dl-quit">✕ Thoát</button></div>${half(1)}`;
  document.body.append(wrap);
  const next = () => {
    q = makeQ('mix', pool);
    $$('.duel-half', wrap).forEach(h => {
      const p = +h.dataset.p;
      $('.duel-q', h).innerHTML = `${esc(q.prompt)}<div class="muted small">${esc(q.hint)}</div>`;
      $('.duel-opts', h).innerHTML = q.options.map(o => `<button class="option" data-v="${esc(o)}">${esc(o)}</button>`).join('');
      $$('.option', h).forEach(b => b.onclick = () => {
        if (Date.now() < lock[p]) return;
        if (b.dataset.v === q.answer) { sc[p]++; $('.d-sc', h).textContent = sc[p]; playCorrect(); next(); }
        else { b.classList.add('wrong'); lock[p] = Date.now() + 1500; }
      });
    });
  };
  const stop = () => { clearInterval(timer); wrap.remove(); document.body.classList.remove('no-tabs'); };
  const timer = setInterval(() => {
    if (location.hash !== route) return stop();
    left -= 0.1;
    $$('.d-left', wrap).forEach(x => { x.textContent = `${Math.ceil(Math.max(0, left))}s`; });
    if (left <= 0) {
      stop();
      state.wk.pvp++; gainXP(20);
      const w = sc[0] === sc[1] ? 'Hòa!' : sc[0] > sc[1] ? '🔴 Người 1 thắng!' : '🔵 Người 2 thắng!';
      view.innerHTML = `<div class="card hero" style="text-align:center"><div style="font-size:3rem">🏁</div><h1>${w}</h1><p>🔴 ${sc[0]} – ${sc[1]} 🔵</p><p>+20 XP cho chủ máy</p>
        <div class="row" style="justify-content:center"><button class="btn white" id="dl-again">Đấu lại</button><a class="btn ghost" href="#/game/pvp">Về Đấu trường</a></div></div>`;
      $('#dl-again').onclick = () => runLocalDuel(pool);
    }
  }, 100);
  $('#dl-quit', wrap).onclick = () => { stop(); viewGame('pvp'); };
  next();
}

// ===== 3. Đường đua chuỗi ngày =====
function flame(s) {
  return s >= 100 ? { icon: '🌋', name: 'Lửa Huyền Thoại', next: null } : s >= 30 ? { icon: '☄️', name: 'Lửa Thiêng', next: 100 } : s >= 7 ? { icon: '🔥', name: 'Lửa Rực Cháy', next: 30 }
    : s >= 3 ? { icon: '🔥', name: 'Ngọn Lửa Nhỏ', next: 7 } : s >= 1 ? { icon: '🕯️', name: 'Đốm Lửa', next: 3 } : { icon: '🪵', name: 'Chưa nhóm lửa', next: 1 };
}
function tabStreak(el) {
  const s = currentStreak(), f = flame(s), best = state.bestStreak;
  el.innerHTML = `<div class="card" style="text-align:center"><div class="flame-big">${f.icon}</div><h2 style="margin:4px 0">${f.name}</h2>
      <p><b>${s}</b> ngày liên tiếp · kỷ lục ${best} ngày</p>
      ${f.next ? `<div class="progress"><div style="width:${Math.round(100 * s / f.next)}%"></div></div><p class="muted small">Còn ${f.next - s} ngày để nâng cấp ngọn lửa</p>` : '<p>Bạn đã đạt cấp lửa cao nhất! 👑</p>'}</div>
    <div class="card"><b>🎁 Rương kho báu theo mốc</b>${STREAK_CHESTS.map(([d, gems]) => {
      const got = state.chests[d], can = best >= d && !got;
      return `<div class="quest"><span style="font-size:1.6rem">${got ? '📭' : can ? '🎁' : '🔒'}</span><div class="grow"><b>Chuỗi ${d} ngày</b><div class="muted small">${gems} 💎</div>
        <div class="progress" style="height:8px"><div style="width:${Math.min(100, 100 * best / d)}%"></div></div></div>
        <button class="btn sm ${can ? '' : 'ghost'}" data-chest="${d}" ${can ? '' : 'disabled'}>${got ? 'Đã mở' : can ? 'Mở rương' : `${Math.min(best, d)}/${d}`}</button></div>`;
    }).join('')}</div>
    <div class="card"><b>🧊 Thẻ hồi sinh chuỗi ngày</b><p class="muted small">Lỡ quên học một ngày? Thẻ tự động dùng để giữ chuỗi. Mang tối đa ${MAX_FREEZES} thẻ.</p>
      <div class="spread"><span>Đang có: <b>${'🧊'.repeat(state.freezes) || '0'}</b></span><button class="btn sm" id="st-buy" ${state.freezes >= MAX_FREEZES || state.gems < FREEZE_PRICE ? 'disabled' : ''}>Mua · ${FREEZE_PRICE} 💎</button></div></div>`;
  $$('[data-chest]', el).forEach(b => b.onclick = () => {
    const d = +b.dataset.chest, gems = STREAK_CHESTS.find(c => c[0] === d)[1];
    state.chests[d] = today(); addGems(gems, `Rương chuỗi ${d} ngày`); viewGame('streak');
  });
  $('#st-buy', el).onclick = () => { state.gems -= FREEZE_PRICE; state.freezes++; save(); toast('🧊 Đã mua Thẻ hồi sinh'); viewGame('streak'); };
}

// ===== 4. Giải đấu tuần =====
function leagueRows(week, tier, elapsed, myXP) {
  const rows = Array.from({ length: LEAGUE_SIZE - 1 }, (_, i) => {
    const s = seeded(`${week}|${tier}|${i}`);
    return { name: `${BOT_FIRST[Math.floor(seeded(`${week}n${tier}${i}`) * BOT_FIRST.length)]} ${String.fromCharCode(65 + (i * 7 + tier) % 26)}.`, xp: Math.round(s * (55 + tier * 22) * elapsed + 4 * elapsed) };
  });
  rows.push({ name: `${state.profile.name} (bạn)`, xp: myXP, me: true });
  return rows.sort((a, b) => b.xp - a.xp || (a.me ? -1 : 1));
}
function leagueBoard() { g(); leagueSync(); return leagueRows(thisWeek(), state.league.tier, daysElapsed(), weekXP(thisWeek())); }
// Hết tuần: chốt hạng tuần cũ → thăng/rớt hạng và thưởng đá quý.
function leagueSync() {
  state.league ??= { tier: 0, week: thisWeek() };
  const L = state.league;
  if (L.week === thisWeek()) return;
  const rows = leagueRows(L.week, L.tier, 7, weekXP(L.week));
  const rank = rows.findIndex(r => r.me) + 1, from = L.tier;
  if (rank <= PROMOTE && L.tier < TIERS.length - 1) L.tier++;
  else if (rank > LEAGUE_SIZE - DEMOTE && L.tier > 0) L.tier--;
  const gems = rank === 1 ? 50 : rank === 2 ? 30 : rank === 3 ? 20 : rank <= 10 ? 10 : 0;
  state.gems = (state.gems || 0) + gems;
  L.last = { week: L.week, rank, from, to: L.tier, gems };
  L.week = thisWeek();
  save();
  setTimeout(() => toast(`🏆 Tuần trước hạng ${rank}${L.tier > from ? ' · Thăng hạng!' : L.tier < from ? ' · Rớt hạng' : ''}${gems ? ` · +${gems} 💎` : ''}`), 900);
}
function tabLeague(el) {
  const rows = leagueBoard(), t = state.league.tier, last = state.league.last;
  const end = new Date(thisWeek() + 'T00:00'); end.setDate(end.getDate() + 7);
  const hrs = Math.max(0, Math.round((end - Date.now()) / 3600000));
  el.innerHTML = `<div class="card"><div class="tier-track">${TIERS.map(([n, i], k) => `<span class="${k === t ? 'on' : k < t ? 'past' : ''}" title="${n}">${i}</span>`).join('')}</div>
      <h2 style="margin:6px 0">${TIERS[t][1]} Giải ${TIERS[t][0]}</h2>
      <p class="muted small">${LEAGUE_SIZE} người cùng trình độ · Top ${PROMOTE} thăng hạng, ${DEMOTE} người cuối rớt hạng · Còn ${Math.floor(hrs / 24)} ngày ${hrs % 24} giờ.</p>
      ${last ? `<div class="banner" style="margin:0">Tuần trước: hạng ${last.rank}${last.to > last.from ? ` → thăng lên ${TIERS[last.to][0]} 🎉` : last.to < last.from ? ` → rớt xuống ${TIERS[last.to][0]}` : ''}${last.gems ? ` · +${last.gems} 💎` : ''}</div>` : ''}</div>
    <div class="card">${rows.map((r, i) => `${i === PROMOTE ? '<div class="zone up">⬆️ Vùng thăng hạng</div>' : ''}${i === LEAGUE_SIZE - DEMOTE ? '<div class="zone down">⬇️ Vùng rớt hạng</div>' : ''}
      <div class="board-row ${r.me ? 'me' : ''}"><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="grow">${esc(r.name)}</span><span>${r.xp} XP</span></div>`).join('')}
      <p class="muted small">Người chơi trong giải là người chơi mô phỏng (app chưa có máy chủ nhiều người chơi). XP của bạn là XP thật trong tuần.</p></div>`;
}

// ===== 5. Nhiệm vụ =====
function tabQuests(el) {
  const q = quests(), wk = state.wk, ev = activeEvent();
  const weekDays7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(wk.week + 'T00:00'); d.setDate(d.getDate() + i); return state.xpByDay[dayKey(d)] ? 1 : 0; }).reduce((a, b) => a + b, 0);
  const wval = { xp: weekXP(wk.week), days: weekDays7, wins: wk.wins, pvp: wk.pvp, words: wk.words };
  el.innerHTML = `<div class="card"><b>☀️ Nhiệm vụ hằng ngày</b><p class="muted small">Mỗi nhiệm vụ: +20 XP và +5 💎.</p>${questsHtml(q)}</div>
    <div class="card"><b>📅 Nhiệm vụ tuần</b>${WEEKLY.map(([id, label, target, gems]) => {
      const v = Math.min(target, wval[id]), done = v >= target, got = wk.claimed[id];
      return `<div class="quest"><div class="grow"><div class="spread"><span>${label}</span><span class="small">${v}/${target}</span></div><div class="progress" style="height:8px"><div style="width:${100 * v / target}%"></div></div></div>
        <button class="btn sm ${done && !got ? '' : 'ghost'}" data-wk="${id}" ${done && !got ? '' : 'disabled'}>${got ? '✔' : `${gems} 💎`}</button></div>`;
    }).join('')}</div>
    ${ev ? (() => {
      const e = state.ev, val = { wins: e.wins, words: e.words, streak: currentStreak() };
      const all = EVENT_TASKS.every(([id, , t]) => val[id] >= t);
      const days = Math.max(0, Math.ceil((ev.end - Date.now()) / 86400000));
      return `<div class="card event-card"><b>${ev.icon} Sự kiện: ${ev.name}</b><p class="muted small">Còn ${days} ngày · Hoàn thành cả 3 thử thách để nhận huy hiệu giới hạn <b>${ev.icon} ${ev.badge}</b> và 50 💎.</p>
        ${EVENT_TASKS.map(([id, label, t]) => `<div class="quest"><div class="grow"><div class="spread"><span>${label}</span><span class="small">${Math.min(t, val[id])}/${t}</span></div><div class="progress" style="height:8px"><div style="width:${Math.min(100, 100 * val[id] / t)}%"></div></div></div></div>`).join('')}
        <button class="btn block" id="ev-claim" ${all && !e.done ? '' : 'disabled'}>${e.done ? '✔ Đã nhận huy hiệu' : `Nhận ${ev.icon} ${ev.badge}`}</button></div>`;
    })() : `<div class="card"><b>🎉 Sự kiện theo mùa</b><p class="muted small">Hiện chưa có sự kiện. Sắp tới: ${EVENTS.map(e => `${e.icon} ${e.name} (${e.from.split('-').reverse().join('/')})`).join(' · ')}</p></div>`}
    ${state.evBadges.length ? `<div class="card"><b>🏅 Huy hiệu sự kiện đã săn</b><p>${state.evBadges.map(b => `<span class="tag" style="margin:2px">${b.icon} ${esc(b.name)}</span>`).join('')}</p></div>` : ''}`;
  $$('[data-wk]', el).forEach(b => b.onclick = () => {
    const [id, , , gems] = WEEKLY.find(w => w[0] === b.dataset.wk);
    state.wk.claimed[id] = true; addGems(gems, 'Nhiệm vụ tuần'); viewGame('quests');
  });
  if ($('#ev-claim', el)) $('#ev-claim', el).onclick = () => {
    state.ev.done = true;
    state.evBadges.push({ id: state.ev.id, icon: ev.icon, name: `${ev.badge} ${new Date().getFullYear()}` });
    addGems(50, `Sự kiện ${ev.name}`); viewGame('quests');
  };
}

// ===== 6. Cửa hàng =====
function tabShop(el) {
  const outfits = [...new Set([...unlockedAvatars(), ...state.owned.outfit])];
  el.innerHTML = `<div class="card spread"><span>Bạn có <b>💎 ${state.gems}</b> đá quý</span><span class="muted small">Kiếm thêm từ nhiệm vụ, đấu trường, rương chuỗi ngày</span></div>
    <div class="card"><b>🦉 Gia sư đang mặc</b><div class="row" style="margin-top:6px">${outfits.map(o => `<button class="avatar-pick ${o === state.tutorAvatar ? 'on' : ''}" data-wear="${o}">${o}</button>`).join('')}</div></div>
    ${Object.entries(SHOP).map(([cat, c]) => `<div class="card"><b>${c.title}</b><div class="shop-grid">${c.items.map(it => {
      const id = it[0], name = cat === 'outfit' ? it[1] : cat === 'title' ? it[0] : it[1], price = cat === 'title' ? it[2] : it[2];
      const icon = cat === 'outfit' ? it[0] : cat === 'title' ? it[1] : cat === 'frame' ? `<span class="avatar mini frame-${id}">🦉</span>` : cat === 'voice' ? '🎙️' : '🔔';
      const owned = state.owned[cat].includes(id), on = cat === 'outfit' ? state.tutorAvatar === id : state.equipped[cat] === id;
      return `<div class="shop-item ${on ? 'on' : ''}"><div class="si-ico">${icon}</div><b class="small">${esc(name)}</b>
        ${owned ? `<button class="btn sm ${on ? '' : 'ghost'}" data-equip="${cat}|${esc(id)}">${on ? (cat === 'outfit' ? 'Đang mặc' : 'Bỏ dùng') : 'Dùng'}</button>`
          : `<button class="btn sm" data-buy="${cat}|${esc(id)}|${price}" ${state.gems < price ? 'disabled' : ''}>${price} 💎</button>`}
        ${cat === 'voice' || cat === 'sfx' ? `<button class="icon-btn" data-try="${cat}|${esc(id)}" title="Nghe thử">▶</button>` : ''}</div>`;
    }).join('')}</div></div>`).join('')}`;
  $$('[data-wear]', el).forEach(b => b.onclick = () => { state.tutorAvatar = b.dataset.wear; save(); viewGame('shop'); });
  $$('[data-buy]', el).forEach(b => b.onclick = () => {
    const [cat, id, price] = b.dataset.buy.split('|');
    if (state.gems < +price) return toast('Chưa đủ đá quý');
    state.gems -= +price; state.owned[cat].push(id);
    if (cat === 'outfit') state.tutorAvatar = id; else state.equipped[cat] = id;
    save(); toast('🛍️ Đã mua và dùng ngay!'); renderTop(); viewGame('shop');
  });
  $$('[data-equip]', el).forEach(b => b.onclick = () => {
    const [cat, id] = b.dataset.equip.split('|');
    if (cat === 'outfit') state.tutorAvatar = id; else state.equipped[cat] = state.equipped[cat] === id ? null : id;
    save(); renderTop(); viewGame('shop');
  });
  $$('[data-try]', el).forEach(b => b.onclick = () => {
    const [cat, id] = b.dataset.try.split('|');
    if (cat === 'sfx') { const old = state.equipped.sfx; state.equipped.sfx = id; playCorrect(); state.equipped.sfx = old; }
    else { const old = window.EM_PITCH; window.EM_PITCH = SHOP.voice.items.find(i => i[0] === id)[3]; speak('Hello! I am your English tutor.', ttsRate()); window.EM_PITCH = old; }
  });
}

// ===== 7. Bang hội & Boss =====
function guildMembers(G) { return G.members.map((n, i) => ({ name: n, xp: Math.round(seeded(`${thisWeek()}|${G.name}|${i}`) * 70 * daysElapsed() + 5 * daysElapsed()) })); }
function tabGuild(el) {
  const G = state.guild;
  if (!G) {
    el.innerHTML = `<div class="card"><b>🛡️ Bang hội học tập</b><p class="muted small">Cùng đồng đội góp XP mỗi tuần để hạ Boss từ vựng, nhận thưởng cho cả bang và tặng tim cho nhau giữ lửa học.</p>
        ${GUILD_SUGGEST.map(([n, i], k) => `<button class="option" data-join="${k}"><b>${i} ${n}</b><div class="muted small">${5 + k} thành viên · đang tuyển</div></button>`).join('')}
        <label for="gd-name">Hoặc tự lập bang hội</label><div class="row" style="flex-wrap:nowrap"><input id="gd-name" maxlength="24" placeholder="Tên bang hội"><button class="btn" id="gd-make">Lập</button></div>
        <p class="muted small" style="margin-bottom:0">Thành viên khác trong bang là người chơi mô phỏng (cần máy chủ để lập bang với bạn bè thật).</p></div>`;
    const join = (name, icon, size) => {
      const pool = shuffle(BOT_FIRST);
      state.guild = { name, icon, members: pool.slice(0, size), joined: today(), sent: {}, recv: {}, bonus: {}, claimed: null };
      save(); toast(`🛡️ Đã vào bang ${name}`); viewGame('guild');
    };
    $$('[data-join]', el).forEach(b => b.onclick = () => { const [n, i] = GUILD_SUGGEST[+b.dataset.join]; join(n, i, 5 + +b.dataset.join); });
    $('#gd-make', el).onclick = () => { const n = $('#gd-name').value.trim(); if (n.length < 3) return toast('Tên bang ít nhất 3 ký tự'); join(n, '⚜️', 5); };
    return;
  }
  const wk = thisWeek(), members = guildMembers(G), mine = weekXP(wk);
  const [bossName, bossIcon] = BOSSES[Math.floor(seeded(wk + G.name) * BOSSES.length)];
  const hp = 2500 + 500 * G.members.length, bonus = G.bonus[wk] || 0;
  const dmg = mine + members.reduce((s, m) => s + m.xp, 0) + bonus, dead = dmg >= hp;
  const sentToday = G.sent[today()] || {};
  const recv = G.recv[today()] ?? Math.floor(seeded(today() + G.name) * 3) + 1;
  el.innerHTML = `<div class="card"><div class="spread"><b>${G.icon} ${esc(G.name)}</b><span class="muted small">${G.members.length + 1} thành viên</span></div></div>
    <div class="card boss-card ${dead ? 'dead' : ''}"><div class="boss-ico">${dead ? '💀' : bossIcon}</div><h2 style="margin:4px 0">Boss tuần: ${bossName}</h2>
      <div class="progress boss-hp"><div style="width:${Math.max(0, 100 - 100 * dmg / hp)}%"></div></div>
      <p class="small">${dead ? 'Đã hạ gục Boss! 🎉' : `Máu còn ${Math.max(0, hp - dmg)}/${hp}`} · Bạn gây <b>${mine + bonus}</b> sát thương (XP tuần + tim tặng)</p>
      <button class="btn block" id="gd-reward" ${dead && G.claimed !== wk ? '' : 'disabled'}>${G.claimed === wk ? '✔ Đã nhận thưởng tuần này' : dead ? 'Nhận thưởng: 40 💎 + 30 XP' : 'Cả bang cùng học để hạ Boss!'}</button></div>
    <div class="card"><div class="spread"><b>💗 Tim đồng đội</b><button class="btn sm ${recv ? '' : 'ghost'}" id="gd-recv" ${recv ? '' : 'disabled'}>${recv ? `Nhận ${recv} tim (+${recv} 💎)` : 'Đã nhận hôm nay'}</button></div>
      <p class="muted small">Tặng tim giúp đồng đội giữ lửa: mỗi tim +10 sát thương lên Boss và +1 💎 cho bạn.</p>
      <div class="board-row me"><span class="rank">🧑</span><span class="grow">${esc(state.profile.name)} (bạn)</span><span>${mine} XP</span></div>
      ${members.sort((a, b) => b.xp - a.xp).map(m => `<div class="board-row"><span class="rank">👤</span><span class="grow">${esc(m.name)}</span><span>${m.xp} XP</span>
        <button class="icon-btn" data-heart="${esc(m.name)}" ${sentToday[m.name] ? 'disabled' : ''} title="Tặng tim">${sentToday[m.name] ? '💖' : '🤍'}</button></div>`).join('')}
      <button class="btn ghost sm" style="margin-top:10px;color:var(--bad)" id="gd-leave">Rời bang</button></div>`;
  $('#gd-reward', el).onclick = () => { G.claimed = wk; state.gems += 40; gainXP(30); toast('🐲 Hạ Boss! +40 💎 +30 XP'); viewGame('guild'); };
  $('#gd-recv', el).onclick = () => { G.recv[today()] = 0; addGems(recv, 'Tim từ đồng đội'); viewGame('guild'); };
  $$('[data-heart]', el).forEach(b => b.onclick = () => {
    (G.sent[today()] ||= {})[b.dataset.heart] = true;
    G.bonus[wk] = (G.bonus[wk] || 0) + 10;
    addGems(1, `Đã tặng tim cho ${b.dataset.heart}`); viewGame('guild');
  });
  $('#gd-leave', el).onclick = () => { if (confirm('Rời bang hội?')) { state.guild = null; save(); viewGame('guild'); } };
}
