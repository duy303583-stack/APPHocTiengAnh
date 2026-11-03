
// ================= Helpers =================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = $('#view');
// ?theme=dark: dùng khi app nằm trong khung điện thoại của trang giới thiệu (index.html).
const themeParam = new URLSearchParams(location.search).get('theme');
if (themeParam === 'dark' || themeParam === 'light') document.documentElement.dataset.theme = themeParam;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => dayKey(new Date());
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
const go = hash => { location.hash = hash; };

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ================= State =================
const STORE = 'engmate-v1';
const DEFAULT_STATE = {
  userId: null, updatedAt: 0,
  profile: { name: '', ageGroup: 'worker', goal: 15, level: 'A1', onboarded: false },
  xp: 0, xpByDay: {}, streak: 0, lastDay: null,
  completed: {}, passedLevels: [], certificates: [],
  srs: {}, reviewsDone: 0, chatCount: 0, badges: [],
  quests: null,
  settings: { apiKey: '', reminders: false, reminderTime: '19:00', notifiedDay: null, speechRate: 0 },
  chat: { scenario: 'free', history: [] },
  posts: [],
  weak: {}, recentMistakes: [],
  battles: { played: 0, wins: 0 }, tutorAvatar: '🦉', aiLabUses: 0,
  pronounce: {}, ipa: {}, scripts: null, interp: null,
};

let state = load();
// Bản cũ dùng 3 nhóm tuổi (teen/adult) → đổi sang 4 lứa tuổi.
function migrateAge(s) {
  s.profile.ageGroup = { teen: 'student', adult: 'worker' }[s.profile.ageGroup] || s.profile.ageGroup;
  return s;
}
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved) return migrateAge({ ...structuredClone(DEFAULT_STATE), ...saved, profile: { ...DEFAULT_STATE.profile, ...saved.profile }, settings: { ...DEFAULT_STATE.settings, ...saved.settings } });
  } catch { /* dữ liệu hỏng → bắt đầu lại */ }
  return structuredClone(DEFAULT_STATE);
}
function save() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { toast('Không lưu được tiến độ (bộ nhớ đầy?)'); }
  if (server.online) {
    clearTimeout(save.timer);
    save.timer = setTimeout(pushProgress, 1500);
  }
}

// Đồng bộ tiến độ với máy chủ Python (không gửi API key).
function pushProgress() {
  const data = { ...state, settings: { ...state.settings, apiKey: '' } };
  fetch(`api/progress/${state.userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    .catch(() => { /* offline: sẽ đồng bộ ở lần lưu sau */ });
}
async function pullProgress() {
  try {
    const res = await fetch(`api/progress/${state.userId}`, { cache: 'no-store' });
    const { data } = await res.json();
    if (data?.updatedAt > state.updatedAt) {
      const key = state.settings.apiKey;
      localStorage.setItem(STORE, JSON.stringify(data));
      state = load();
      state.settings.apiKey = key;
      return true;
    }
  } catch { /* bỏ qua */ }
  return false;
}
const aiReady = () => !!state.settings.apiKey || server.ai;

const levelIdx = l => LEVELS.indexOf(l);
const ttsRate = () => state.settings.speechRate || AGE_GROUPS.find(g => g.id === state.profile.ageGroup)?.rate || 0.95;
const applyAgeClass = () => {
  document.body.classList.toggle('kids', state.profile.ageGroup === 'kid');
  document.body.classList.toggle('senior', state.profile.ageGroup === 'senior');
};
// Nghe giọng nói, đồng thời vẽ sóng âm lên canvas (nếu có micro).
async function listenWithWave(canvas) {
  let stop = () => {};
  if (canvas) {
    canvas.hidden = false;
    try { stop = await liveWave(canvas); } catch { /* không mở được micro cho sóng âm: vẫn nhận dạng bình thường */ }
  }
  try { return await listen(); } finally { stop(); }
}
const say = text => speak(text, ttsRate());

// ================= Gamification =================
function currentStreak() {
  return state.lastDay === today() || state.lastDay === daysAgo(1) ? state.streak : 0;
}
function touchStreak() {
  if (state.lastDay === today()) return;
  state.streak = state.lastDay === daysAgo(1) ? state.streak + 1 : 1;
  state.lastDay = today();
}

const QUEST_DEFS = [
  { id: 'xp', icon: '⭐', label: 'Kiếm 50 XP', target: 50 },
  { id: 'lesson', icon: '📘', label: 'Hoàn thành 1 bài học', target: 1 },
  { id: 'review', icon: '🧠', label: 'Ôn 10 thẻ từ vựng', target: 10 },
  { id: 'chat', icon: '🤖', label: 'Gửi 3 tin nhắn cho gia sư AI', target: 3 },
];
const QUEST_REWARD = 20;

function quests() {
  if (!state.quests || state.quests.date !== today()) {
    state.quests = { date: today(), progress: {}, done: {} };
  }
  return state.quests;
}
function questProgress(id, amount) {
  const q = quests();
  const def = QUEST_DEFS.find(d => d.id === id);
  if (q.done[id]) return;
  q.progress[id] = (q.progress[id] || 0) + amount;
  if (q.progress[id] >= def.target) {
    q.done[id] = true;
    gainXP(QUEST_REWARD, false);
    toast(`✅ Nhiệm vụ hoàn thành: ${def.label} (+${QUEST_REWARD} XP)`);
    if (QUEST_DEFS.every(d => q.done[d.id])) award('quests');
  }
}

// countsForQuest=false để thưởng nhiệm vụ không tự cộng vào nhiệm vụ XP.
function gainXP(n, countsForQuest = true) {
  state.xp += n;
  state.xpByDay[today()] = (state.xpByDay[today()] || 0) + n;
  touchStreak();
  if (countsForQuest) questProgress('xp', n);
  checkBadges();
  save();
  renderTop();
}

function award(id) {
  if (state.badges.includes(id)) return;
  state.badges.push(id);
  const b = BADGES.find(x => x.id === id);
  save();
  setTimeout(() => toast(`${b.icon} Huy hiệu mới: ${b.name}!`), 600);
}
function checkBadges() {
  const s = currentStreak();
  if (Object.keys(state.completed).length >= 1) award('first-lesson');
  if (s >= 3) award('streak-3');
  if (s >= 7) award('streak-7');
  if (state.xp >= 500) award('xp-500');
  if (state.xp >= 2000) award('xp-2000');
  if (state.reviewsDone >= 50) award('review-50');
  if (state.chatCount >= 1) award('chat-1');
  if (state.certificates.length >= 1) award('certified');
  if (state.chatCount >= 100) award('talker');
  if (state.battles.wins >= 1) award('champion');
  if (state.aiLabUses >= 5) award('ai-explorer');
  if (Object.values(state.pronounce).filter(v => v >= 80).length >= 10) award('pronouncer');
}

// Lời nhắc thấu cảm: dựa vào số từ sắp quên và chuỗi ngày học.
function smartNudge() {
  const due = dueCards().length, streak = currentStreak(), name = state.profile.name;
  if (due >= 3) return `${name} ơi, có ${due} từ vựng sắp bị quên rồi, vào ôn cùng mình 3 phút nhé! 🧠`;
  if (streak >= 2) return `Chuỗi ${streak} ngày học của bạn sắp bị đứt, cố lên ${name}! 🔥`;
  return `Chỉ ${state.profile.goal} phút hôm nay thôi, ${name}. Mình đợi bạn đó! 🦉`;
}
const unlockedAvatars = () => TUTOR_AVATARS.slice(0, 1 + state.battles.wins);

const AVATARS = Object.fromEntries(AGE_GROUPS.map(g => [g.id, g.icon]));
function renderTop() {
  const p = state.profile;
  $('#avatar').textContent = p.onboarded ? AVATARS[p.ageGroup] || '🤓' : '🤓';
  $('#userName').textContent = p.onboarded ? p.name : 'EngMate';
  $('#topStats').innerHTML = '';
  if (!p.onboarded) { $('#userLevel').textContent = 'Lộ trình A1 - C2'; return; }
  const gained = renderTop.lastXP !== undefined && state.xp > renderTop.lastXP;
  renderTop.lastXP = state.xp;
  $('#userLevel').innerHTML = `Cấp ${p.level} · 🔥 ${currentStreak()} ngày · <span class="${gained ? 'xp-flash' : ''}">⭐ ${state.xp} XP</span>`;
}

// ================= Spaced repetition (SM-2) =================
function addCards(vocab) {
  for (const v of vocab) {
    if (!state.srs[v.en]) state.srs[v.en] = { ...v, ef: 2.5, reps: 0, interval: 0, due: Date.now() };
  }
}
function gradeCard(card, q) {
  if (q < 3) {
    card.lapses = (card.lapses || 0) + 1;
    card.reps = 0;
    card.interval = 0;
    card.due = Date.now() + 10 * 60 * 1000; // gặp lại sau 10 phút
  } else {
    card.reps += 1;
    card.interval = card.reps === 1 ? 1 : card.reps === 2 ? 3 : Math.round(card.interval * card.ef);
    card.due = Date.now() + card.interval * 86400000;
  }
  card.ef = Math.max(1.3, card.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
}
const dueCards = () => Object.values(state.srs).filter(c => c.due <= Date.now());
// Từ hay quên nhất: được ôn trước và được gia sư AI lồng vào hội thoại.
const hardWords = (n = 5) => Object.values(state.srs).filter(c => c.lapses).sort((a, b) => b.lapses - a.lapses).slice(0, n);

// ================= Lộ trình =================
const isUnlocked = lesson => levelIdx(lesson.level) <= levelIdx(state.profile.level);
const levelLessons = level => LESSONS.filter(l => l.level === level);
// Bài phù hợp lứa tuổi của người học (cấp nào không có thì lấy mọi bài của cấp đó).
const forMyAge = l => l.ages.includes(state.profile.ageGroup);
const myLevelLessons = level => { const ls = levelLessons(level).filter(forMyAge); return ls.length ? ls : levelLessons(level); };
const levelDone = level => myLevelLessons(level).every(l => state.completed[l.id]);
const nextLesson = () => LESSONS.find(l => isUnlocked(l) && forMyAge(l) && !state.completed[l.id])
  || LESSONS.find(l => isUnlocked(l) && !state.completed[l.id]);

// ================= Router =================
const routes = {
  onboard: viewOnboard, placement: viewPlacement, home: viewHome, path: viewPath, lesson: viewLesson,
  review: viewReview, chat: viewChat, profile: viewProfile, test: viewTest, cert: viewCert,
  settings: viewSettings, community: viewCommunity, ailab: viewAILab, battle: viewBattle,
};
function router() {
  const [name, arg] = location.hash.replace(/^#\//, '').split('/');
  document.body.classList.remove('no-tabs');
  applyAgeClass();
  if (!state.profile.onboarded && name !== 'placement') return viewOnboard();
  const fn = routes[name] || viewHome;
  $$('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === (routes[name] ? name : 'home')));
  window.scrollTo(0, 0);
  renderTop();
  fn(arg ? decodeURIComponent(arg) : undefined);
}
window.addEventListener('hashchange', router);

// ================= Onboarding & kiểm tra đầu vào =================
function viewOnboard() {
  document.body.classList.add('no-tabs');
  view.innerHTML = `
    <div class="card hero">
      <h1>Chào mừng đến với EngMate 🦉</h1>
      <p>Người bạn đồng hành học tiếng Anh cho mọi lứa tuổi, từ A1 đến C2, có gia sư AI luôn sẵn sàng trò chuyện cùng bạn.</p>
    </div>
    <div class="card">
      <label for="ob-name">Bạn tên là gì?</label>
      <input id="ob-name" placeholder="Ví dụ: Minh" value="${esc(state.profile.name)}">
      <label>Bạn thuộc nhóm tuổi nào?</label>
      <div class="row" id="ob-age">
        ${AGE_GROUPS.map(g => [g.id, `${g.icon} ${g.name}`]).map(([v, t]) =>
          `<button class="btn ghost sm ${state.profile.ageGroup === v ? 'selected' : ''}" data-v="${v}">${t}</button>`).join('')}
      </div>
      <label for="ob-goal">Mục tiêu mỗi ngày</label>
      <select id="ob-goal">
        ${[5, 10, 15, 30].map(m => `<option value="${m}" ${state.profile.goal === m ? 'selected' : ''}>${m} phút / ngày</option>`).join('')}
      </select>
      <div class="row" style="margin-top:18px">
        <button class="btn" id="ob-test">📝 Làm bài kiểm tra đầu vào</button>
        <button class="btn ghost" id="ob-skip">Tôi mới bắt đầu (A1)</button>
      </div>
    </div>`;
  let age = state.profile.ageGroup;
  $$('#ob-age button').forEach(b => b.onclick = () => {
    age = b.dataset.v;
    $$('#ob-age button').forEach(x => x.style.outline = x === b ? '2px solid var(--primary)' : '');
  });
  $(`#ob-age [data-v="${age}"]`).style.outline = '2px solid var(--primary)';
  const commit = () => {
    state.profile.name = $('#ob-name').value.trim() || 'Bạn';
    state.profile.ageGroup = age;
    state.profile.goal = +$('#ob-goal').value;
    save();
  };
  $('#ob-test').onclick = () => { commit(); go('#/placement'); };
  $('#ob-skip').onclick = () => { commit(); finishPlacement('A1'); };
}

function viewPlacement() {
  document.body.classList.add('no-tabs');
  const correctByLevel = {};
  let i = 0;
  const show = () => {
    const q = PLACEMENT[i];
    view.innerHTML = `
      <h1>Kiểm tra đầu vào</h1>
      <p class="muted">Câu ${i + 1}/${PLACEMENT.length} · Không biết thì cứ chọn "Tôi chưa biết", không sao cả!</p>
      <div class="progress"><div style="width:${100 * i / PLACEMENT.length}%"></div></div>
      <div class="card" style="margin-top:14px">
        <h2>${esc(q.q)}</h2>
        ${q.options.map((o, k) => `<button class="option" data-k="${k}">${esc(o)}</button>`).join('')}
        <button class="option muted" data-k="-1">🤷 Tôi chưa biết</button>
      </div>`;
    $$('.option').forEach(b => b.onclick = () => {
      if (+b.dataset.k === q.answer) correctByLevel[q.level] = (correctByLevel[q.level] || 0) + 1;
      i++;
      if (i < PLACEMENT.length) show();
      else {
        // Cấp độ = cấp đầu tiên chưa trả lời đúng cả 2 câu.
        const placed = LEVELS.find(l => (correctByLevel[l] || 0) < 2) || 'C2';
        finishPlacement(placed, correctByLevel);
      }
    });
  };
  show();
}

function finishPlacement(level, correctByLevel) {
  state.profile.level = level;
  state.profile.onboarded = true;
  state.passedLevels = LEVELS.slice(0, levelIdx(level));
  save();
  if (!correctByLevel) return go('#/home');
  document.body.classList.add('no-tabs');
  const total = Object.values(correctByLevel).reduce((a, b) => a + b, 0);
  view.innerHTML = `
    <div class="card hero" style="text-align:center">
      <p class="muted">Bạn trả lời đúng ${total}/${PLACEMENT.length} câu</p>
      <h1 style="font-size:3rem;margin:0">${level}</h1>
      <h2>${LEVEL_INFO[level].name}</h2>
      <p>Lộ trình của bạn bắt đầu từ cấp ${level}. Các cấp thấp hơn vẫn mở để bạn ôn lại bất cứ lúc nào.</p>
      <button class="btn white" onclick="location.hash='#/home'">Bắt đầu học 🚀</button>
    </div>`;
}

// ================= Trang chủ =================
const STEP_ICONS = ['⏱️', '📖', '✏️', '💬', '🔄'];

const DAILY_GOAL = 50; // trùng nhiệm vụ "Kiếm 50 XP"

function viewHome() {
  const L = state.profile.level;
  const next = nextLesson();
  const canTest = levelDone(L) && !state.passedLevels.includes(L);
  const todayXP = state.xpByDay[today()] || 0;
  const pct = Math.min(100, Math.round(100 * todayXP / DAILY_GOAL));
  const weekXP = Array.from({ length: 7 }, (_, i) => state.xpByDay[daysAgo(i)] || 0).reduce((x, y) => x + y, 0);
  const weekPct = Math.min(100, Math.round(100 * weekXP / (DAILY_GOAL * 7)));
  const h = new Date().getHours();
  const greet = h < 11 ? 'Chào buổi sáng! 🌞' : h < 14 ? 'Chào buổi trưa! 🌤️' : h < 18 ? 'Chào buổi chiều! 🌇' : 'Chào buổi tối! 🌙';
  const due = dueCards().length;
  const q = quests();
  const questsDone = QUEST_DEFS.filter(d => q.done[d.id]).length;
  const myRank = leaderboard().findIndex(r => r.me) + 1;
  const feature = (cls, href, icon, title, desc) =>
    `<a class="feature-card ${cls}" href="${href}"><span class="feature-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
      <span class="feature-title">${title}</span><span class="feature-desc">${desc}</span></a>`;

  view.innerHTML = `
    <div class="welcome-banner">
      <h2>${greet}</h2>
      <p>${pct >= 100 ? 'Tuyệt vời! Bạn đã đạt mục tiêu hôm nay 🎉' : `Mục tiêu hôm nay: kiếm ${DAILY_GOAL} XP (còn ${DAILY_GOAL - todayXP} XP)`}</p>
      <div class="banner-bar" role="progressbar" aria-label="Tiến độ hôm nay" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div style="width:${pct}%"></div></div>
      <div class="banner-foot"><span>${todayXP}/${DAILY_GOAL} XP hôm nay</span><span>Đã đạt ${weekPct}% mục tiêu tuần</span></div>
      ${next ? `<a class="btn white sm" href="#/lesson/${next.id}">▶ Học tiếp: ${next.icon} ${esc(next.title)}</a>` :
        canTest ? `<a class="btn white sm" href="#/test/${L}">🎓 Làm bài kiểm tra ${L}</a>` : ''}
    </div>
    ${todayXP ? '' : `<div class="banner" style="margin-top:12px">⏰ ${esc(smartNudge())}</div>`}

    <div class="section-head"><h2>Chủ đề học tập</h2><a href="#/path">Xem tất cả</a></div>
    <div class="topics">${TOPICS.map(t => `<a class="topic-card" href="#/path/${t.id}">
        <span class="topic-icon ${t.cls}" aria-hidden="true">${t.icon}</span><b>${t.name}</b><small>${t.lessons.length} bài học</small></a>`).join('')}</div>

    <div class="section-head"><h2>Tính năng AI &amp; Ôn tập</h2></div>
    <div class="feature-grid">
      ${feature('fc-ai', '#/chat', 'fa-robot', 'Gia sư AI', 'Luyện nói 1-1')}
      ${feature('fc-srs', '#/review', 'fa-brain', 'Ôn tập SRS', due ? `${due} từ cần ôn hôm nay` : 'Ghi nhớ từ vựng')}
      ${feature('fc-pronun', '#/ailab/dict', 'fa-microphone-lines', 'Phát âm', 'Chấm điểm giọng')}
      ${feature('fc-grammar', '#/ailab/write', 'fa-spell-check', 'Ngữ pháp', 'Sửa lỗi thông minh')}
      ${feature('fc-listen', '#/ailab/listen', 'fa-headphones', 'Nghe & đọc', 'Đọc to, từ mới, kịch bản')}
      ${feature('fc-interp', '#/ailab/interpret', 'fa-language', 'Phiên dịch', 'Nói chuyện với người nước ngoài')}
      ${feature('fc-lab', '#/ailab/analyze', 'fa-wand-magic-sparkles', 'Học cùng AI', 'Dịch, truyện, điểm yếu')}
      ${feature('fc-battle', '#/battle', 'fa-shield-halved', 'Đấu trường AI', `${state.battles.wins} trận thắng`)}
    </div>

    <div class="section-head"><h2>Trò chơi hóa &amp; Động lực</h2></div>
    <div class="gamification-row">
      <a class="game-card" href="#" id="g-quests"><div class="game-icon">📋</div><div class="game-title">Nhiệm vụ</div><div class="game-desc">${questsDone}/${QUEST_DEFS.length} hoàn thành</div></a>
      <a class="game-card" href="#/profile"><div class="game-icon">🏆</div><div class="game-title">Xếp hạng</div><div class="game-desc">Hạng ${myRank} tuần này</div></a>
      <a class="game-card" href="#/profile"><div class="game-icon">🎖️</div><div class="game-title">Huy hiệu</div><div class="game-desc">Đã đạt ${state.badges.length}/${BADGES.length}</div></a>
    </div>

    <div class="section-head" id="quests"><h2>🎯 Nhiệm vụ hằng ngày</h2></div>
    <div class="card">${questsHtml(q)}</div>

    <div class="section-head"><h2>Tiện ích &amp; Cộng đồng</h2></div>
    <div class="utils">
      <a class="util" href="#" id="u-offline"><div class="u-ico">☁️</div>Học offline<div class="muted small">${navigator.onLine ? 'Sẵn sàng' : 'Đang offline'}</div></a>
      <a class="util" href="#/settings"><div class="u-ico">🔔</div>Nhắc nhở<div class="muted small">${state.settings.reminders ? state.settings.reminderTime : 'Tắt'}</div></a>
      <a class="util" href="#/community"><div class="u-ico">👥</div>Cộng đồng</a>
      <a class="util" href="#/profile"><div class="u-ico">📈</div>Biểu đồ tiến độ</a>
      <a class="util" href="#/path"><div class="u-ico">📝</div>Kiểm tra định kỳ</a>
      <a class="util" href="#/profile"><div class="u-ico">📜</div>Chứng chỉ<div class="muted small">${state.certificates.length} đã đạt</div></a>
    </div>

    <div class="section-head"><h2>🎨 Giao diện app</h2></div>
    <div class="utils" id="ui-picker">
      ${UI_OPTIONS.map(o => `<a class="util" href="${o.page}" data-ui="${o.id}"><div class="u-ico">${o.icon}</div>${o.name}<div class="muted small">${currentUI() === o.id ? '✔ Đang dùng' : o.desc}</div></a>`).join('')}
      <a class="util" href="gioi-thieu.html"><div class="u-ico">🏠</div>Giới thiệu<div class="muted small">trang trình bày</div></a>
    </div>`;
  $('#g-quests').onclick = e => { e.preventDefault(); $('#quests').scrollIntoView({ behavior: 'smooth' }); };
  $$('#ui-picker [data-ui]').forEach(a => a.onclick = () => { try { localStorage.setItem(UI_KEY, a.dataset.ui); } catch { /* bỏ qua */ } });
  $('#u-offline').onclick = e => { e.preventDefault(); toast('Bài học, ôn tập và tiến độ đều dùng được khi mất mạng. Chỉ gia sư AI cần internet.'); };
}

function questsHtml(q) {
  return QUEST_DEFS.map(d => {
    const p = Math.min(q.progress[d.id] || 0, d.target);
    return `<div class="quest"><span style="font-size:1.4rem">${q.done[d.id] ? '✅' : d.icon}</span>
      <div class="grow"><div class="spread"><b>${d.label}</b><span class="muted small">${p}/${d.target}</span></div>
      <div class="progress"><div style="width:${100 * p / d.target}%"></div></div></div>
      <span class="tag">+${QUEST_REWARD} XP</span></div>`;
  }).join('');
}

// ================= Lộ trình =================
let pathAge = null; // bộ lọc lứa tuổi đang chọn ở màn Lộ trình ('all' = tất cả)

function viewPath(topicId) {
  const topic = TOPICS.find(t => t.id === topicId);
  const age = pathAge || state.profile.ageGroup;
  // Đang xem theo chủ đề thì hiện mọi bài của chủ đề đó, không lọc lứa tuổi.
  const show = l => topic ? topic.lessons.includes(l.id) : age === 'all' || l.ages.includes(age);
  const ageTags = l => l.ages.length === AGE_GROUPS.length ? '' : l.ages.map(a => AVATARS[a]).join('');
  view.innerHTML = `<h1>🗺️ Lộ trình cá nhân hóa</h1>
    <p class="muted">Mỗi bài gồm 5 bước: Khởi động → Giới thiệu → Luyện tập → Vận dụng → Ôn tập. Hoàn thành các bài dành cho lứa tuổi của bạn để mở bài kiểm tra lên cấp.</p>
    ${topic ? `<div class="card topic-filter"><b>${topic.icon} Chủ đề: ${topic.name}</b><a class="btn ghost sm" href="#/path">✕ Bỏ lọc</a></div>` : ''}
    <div class="utils" id="ages" ${topic ? 'hidden' : ''}>${[{ id: 'all', icon: '📚', name: 'Tất cả' }, ...AGE_GROUPS].map(g =>
      `<button class="btn sm ${g.id === age ? '' : 'ghost'}" style="flex:none" data-age="${g.id}">${g.icon} ${g.name}${g.id === state.profile.ageGroup ? ' (bạn)' : ''}</button>`).join('')}</div>
    ${LEVELS.map(level => {
      const locked = levelIdx(level) > levelIdx(state.profile.level);
      const passed = state.passedLevels.includes(level);
      const lessons = levelLessons(level).filter(show);
      if (topic && !lessons.length) return '';
      return `<div class="level-head"><span class="level-pill" style="background:${LEVEL_INFO[level].color}">${level}</span>
          <b>${LEVEL_INFO[level].name}</b>${passed ? '<span class="tag">✔ Đã đạt</span>' : ''}${locked ? '<span class="muted small">🔒</span>' : ''}</div>
        ${lessons.length ? lessons.map(l => {
          const c = state.completed[l.id];
          return `<a class="card lesson ${locked ? 'locked' : ''}" href="#/lesson/${l.id}">
            <div class="ico">${l.icon}</div>
            <div class="grow"><b>${esc(l.title)}</b><div><span class="tag">${l.skill}</span> <span class="small">${ageTags(l)}</span></div></div>
            <div>${c ? '⭐'.repeat(c.stars) : locked ? '🔒' : '▶️'}</div></a>`;
        }).join('') : '<p class="muted small">Chưa có bài riêng cho lứa tuổi này ở cấp độ này.</p>'}
        ${!locked ? `<a class="card lesson ${levelDone(level) ? '' : 'locked'}" href="#/test/${level}">
            <div class="ico">📝</div><div class="grow"><b>Kiểm tra định kỳ ${level}</b>
            <div class="muted small">${levelDone(level) ? 'Đạt ≥ 70% để nhận chứng chỉ nội bộ' : 'Hoàn thành các bài của bạn ở trên để mở'}</div></div></a>` : ''}`;
    }).join('')}`;
  $$('#ages [data-age]').forEach(b => b.onclick = () => { pathAge = b.dataset.age; viewPath(); });
}

// ================= Bài tập =================
// renderExercise gọi onResult(đúng/sai) một lần, rồi onContinue khi bấm "Tiếp tục".
function renderExercise(el, ex, onResult, onContinue) {
  const finish = (ok, correctText) => {
    onResult(ok);
    el.insertAdjacentHTML('beforeend', `
      <div class="feedback ${ok ? 'ok' : 'bad'}">${ok ? '🎉 Chính xác!' : `😅 Chưa đúng. Đáp án: <b>${esc(correctText)}</b>`}</div>
      <button class="btn block" style="margin-top:10px" id="ex-next">Tiếp tục</button>`);
    $('#ex-next', el).onclick = onContinue;
    $('#ex-next', el).focus();
  };

  if (ex.type === 'mc') {
    el.innerHTML = `<p class="muted small">Chọn đáp án đúng</p><h2>${esc(ex.q)}</h2>
      ${ex.options.map((o, k) => `<button class="option" data-k="${k}">${esc(o)}</button>`).join('')}`;
    $$('.option', el).forEach(b => b.onclick = () => {
      $$('.option', el).forEach(x => { x.disabled = true; if (+x.dataset.k === ex.answer) x.classList.add('correct'); });
      const ok = +b.dataset.k === ex.answer;
      if (!ok) b.classList.add('wrong');
      if (/^[A-Za-z]/.test(ex.options[ex.answer])) say(ex.q.replace(/_+/, ex.options[ex.answer]));
      finish(ok, ex.options[ex.answer]);
    });
  }

  else if (ex.type === 'match') {
    const left = shuffle(ex.pairs.map(p => p[0])), right = shuffle(ex.pairs.map(p => p[1]));
    el.innerHTML = `<p class="muted small">Nối từ với nghĩa tương ứng</p><h2>Nối từ</h2>
      <div class="match-grid"><div id="m-l"></div><div id="m-r"></div></div>`;
    $('#m-l', el).innerHTML = left.map(w => `<button class="chip option" data-w="${esc(w)}">${esc(w)}</button>`).join('');
    $('#m-r', el).innerHTML = right.map(w => `<button class="chip option" data-w="${esc(w)}">${esc(w)}</button>`).join('');
    let pick = null, errors = 0, matched = 0;
    $$('#m-l .chip', el).forEach(b => b.onclick = () => {
      if (b.classList.contains('done')) return;
      $$('#m-l .chip', el).forEach(x => x.classList.remove('selected'));
      b.classList.add('selected'); pick = b; say(b.dataset.w);
    });
    $$('#m-r .chip', el).forEach(b => b.onclick = () => {
      if (!pick || b.classList.contains('done')) return;
      const pair = ex.pairs.find(p => p[0] === pick.dataset.w);
      if (pair[1] === b.dataset.w) {
        pick.classList.remove('selected');
        pick.classList.add('done'); b.classList.add('done');
        pick.disabled = b.disabled = true; pick = null; matched++;
        if (matched === ex.pairs.length) finish(errors === 0, ex.pairs.map(p => `${p[0]} = ${p[1]}`).join(', '));
      } else {
        errors++;
        b.classList.add('wrong');
        setTimeout(() => b.classList.remove('wrong'), 500);
      }
    });
  }

  else if (ex.type === 'order') {
    const tokens = shuffle(ex.words.map((w, i) => ({ w, i })));
    const chosen = [];
    el.innerHTML = `<p class="muted small">Sắp xếp các từ thành câu đúng</p><h2>Sắp xếp câu</h2>
      <div class="chips" id="o-ans"></div><div class="chips" id="o-bank" style="border:none"></div>
      <button class="btn block" id="o-check" disabled>Kiểm tra</button>`;
    const draw = () => {
      $('#o-ans', el).innerHTML = chosen.map((t, k) => `<button class="chip" data-k="${k}">${esc(t.w)}</button>`).join('');
      $('#o-bank', el).innerHTML = tokens.map(t => `<button class="chip ${chosen.includes(t) ? 'used' : ''}" data-i="${t.i}">${esc(t.w)}</button>`).join('');
      $$('#o-ans .chip', el).forEach(b => b.onclick = () => { chosen.splice(+b.dataset.k, 1); draw(); });
      $$('#o-bank .chip', el).forEach(b => b.onclick = () => { chosen.push(tokens.find(t => t.i === +b.dataset.i)); draw(); });
      $('#o-check', el).disabled = chosen.length !== tokens.length;
    };
    draw();
    $('#o-check', el).onclick = () => {
      $('#o-check', el).remove();
      $$('.chip', el).forEach(c => c.disabled = true);
      say(ex.answer);
      finish(normalize(chosen.map(t => t.w).join(' ')) === normalize(ex.answer), ex.answer);
    };
  }

  else if (ex.type === 'listen') {
    el.innerHTML = `<p class="muted small">Nghe và gõ lại câu bạn nghe được</p><h2>Luyện nghe</h2>
      <div class="row"><button class="btn" id="l-play">🔊 Nghe</button><button class="btn ghost" id="l-slow">🐢 Nghe chậm</button></div>
      <input id="l-in" style="margin-top:12px" placeholder="Gõ câu bạn nghe được..." autocomplete="off">
      <button class="btn block" style="margin-top:10px" id="l-check">Kiểm tra</button>`;
    $('#l-play', el).onclick = () => say(ex.text);
    $('#l-slow', el).onclick = () => speak(ex.text, 0.6);
    setTimeout(() => say(ex.text), 300);
    const check = () => {
      if (!$('#l-in', el).value.trim()) return;
      $('#l-check', el).remove();
      $('#l-in', el).disabled = true;
      finish(normalize($('#l-in', el).value) === normalize(ex.answer), ex.text);
    };
    $('#l-check', el).onclick = check;
    $('#l-in', el).onkeydown = e => { if (e.key === 'Enter') check(); };
  }
}

// ================= Bài học 5 bước =================
const STEP_NAMES = ['Khởi động', 'Giới thiệu', 'Luyện tập', 'Vận dụng', 'Ôn tập'];

function viewLesson(id) {
  const L = LESSONS.find(l => l.id === id);
  if (!L || !isUnlocked(L)) return go('#/path');
  document.body.classList.add('no-tabs');
  const run = { step: 0, ex: 0, mistakes: 0, xp: 0 };

  const shell = inner => {
    view.innerHTML = `
      <div class="spread"><a href="#/path">✕ Thoát</a><span class="muted small">${L.level} · ${esc(L.title)}</span></div>
      <div class="lesson-steps" style="margin-top:12px">${STEP_NAMES.map((n, i) => `<div class="step ${i < run.step ? 'completed' : i === run.step ? 'active' : ''}"><div class="step-icon">${i < run.step ? '✅' : STEP_ICONS[i]}</div>${n}</div>`).join('')}</div>
      <div class="card" id="stage">${inner}</div>`;
    return $('#stage');
  };
  const next = () => { run.step++; steps[run.step](); window.scrollTo(0, 0); };
  const earn = n => { run.xp += n; gainXP(n); };
  const recordMistake = (lesson, ex) => {
    run.mistakes++;
    run.wrongRow = (run.wrongRow || 0) + 1;
    state.weak[lesson.grammar.title] = (state.weak[lesson.grammar.title] || 0) + 1;
    state.recentMistakes = [...state.recentMistakes, ex.q || ex.answer || ex.text].filter(Boolean).slice(-8);
    save();
    if (run.wrongRow === 3) toast(`Đừng nản nhé! 💪 Sai là cách não bộ ghi nhớ. Xem lại phần "${lesson.grammar.title}" rồi làm tiếp.`);
  };

  const steps = [
    // 1. Khởi động
    () => {
      const st = shell('<p class="tag">Bước 1 · Khởi động 🔥</p><div id="ex"></div>');
      renderExercise($('#ex', st), { type: 'mc', ...L.warmup }, ok => ok && earn(5), next);
    },
    // 2. Giới thiệu: từ vựng + ngữ pháp
    () => {
      const st = shell(`<p class="tag">Bước 2 · Giới thiệu 📖</p>
        <h2>Từ vựng mới</h2>
        ${L.vocab.map((v, i) => `<div class="vocab"><div><b>${esc(v.en)}</b> — ${esc(v.vi)}<div class="muted small"><i>${esc(v.ex)}</i></div></div>
          <button class="icon-btn" data-i="${i}" aria-label="Nghe ${esc(v.en)}">🔊</button></div>`).join('')}
        <h2>📐 ${esc(L.grammar.title)}</h2><p>${L.grammar.body}</p>
        <button class="btn block" id="go">Bắt đầu luyện tập</button>`);
      $$('.icon-btn', st).forEach(b => b.onclick = () => { const v = L.vocab[+b.dataset.i]; say(`${v.en}. ${v.ex}`); });
      $('#go', st).onclick = next;
    },
    // 3. Luyện tập
    () => {
      const drawEx = () => {
        const st = shell(`<p class="tag">Bước 3 · Luyện tập ✍️ (${run.ex + 1}/${L.exercises.length})</p>
          <div class="progress" style="margin:8px 0 12px"><div style="width:${100 * run.ex / L.exercises.length}%"></div></div><div id="ex"></div>`);
        renderExercise($('#ex', st), L.exercises[run.ex], ok => ok ? (earn(10), run.wrongRow = 0) : recordMistake(L, L.exercises[run.ex]), () => {
          run.ex++;
          run.ex < L.exercises.length ? drawEx() : next();
        });
      };
      drawEx();
    },
    // 4. Vận dụng
    () => L.apply.type === 'speak' ? applySpeak() : applyWrite(),
    // 5. Ôn tập
    () => {
      const first = !state.completed[L.id];
      const stars = run.mistakes === 0 ? 3 : run.mistakes <= 2 ? 2 : 1;
      const prev = state.completed[L.id];
      state.completed[L.id] = { stars: Math.max(stars, prev?.stars || 0), date: today() };
      addCards(L.vocab);
      earn(first ? 50 : 20);
      if (run.mistakes === 0) award('perfect');
      questProgress('lesson', 1);
      save();
      const st = shell(`<p class="tag">Bước 5 · Ôn tập 🧠</p>
        <div style="text-align:center"><div style="font-size:3rem">${'⭐'.repeat(stars)}</div>
        <h1>Hoàn thành bài học!</h1><p>+${run.xp} XP · ${run.mistakes} lỗi</p></div>
        <h2>Tóm tắt</h2>
        <p><b>Ngữ pháp:</b> ${esc(L.grammar.title)}</p>
        <p><b>Từ vựng</b> (đã thêm vào bộ thẻ ôn tập ngắt quãng):</p>
        <p>${L.vocab.map(v => `<span class="tag">${esc(v.en)}</span>`).join(' ')}</p>
        <div class="row"><a class="btn" href="#/home">Về trang chủ</a><a class="btn ghost" href="#/review">Ôn thẻ ngay</a></div>`);
    },
  ];

  function applySpeak() {
    const A = L.apply;
    const st = shell(`<p class="tag">Bước 4 · Vận dụng 🗣️</p>
      <h2>${esc(A.prompt)}</h2>
      <p style="font-size:1.25rem;font-weight:700" id="target">${esc(A.target)}</p>
      <div class="row"><button class="btn ghost" id="hear">🔊 Nghe mẫu</button>
      <button class="btn" id="mic" ${canListen ? '' : 'disabled'}>🎤 Nói</button></div>
      <canvas class="wave" id="wave" hidden aria-label="Sóng âm giọng của bạn"></canvas>
      ${canListen ? '' : '<p class="muted small">Trình duyệt này không hỗ trợ micro. Hãy dùng Chrome/Edge để luyện phát âm.</p>'}
      <div id="result"></div>
      <button class="btn ghost block" style="margin-top:12px" id="skip">Bỏ qua</button>`);
    $('#hear', st).onclick = () => say(A.target);
    $('#skip', st).onclick = next;
    $('#mic', st).onclick = async () => {
      $('#mic', st).textContent = '👂 Đang nghe...';
      try {
        const said = await listenWithWave($('#wave', st));
        const { score, words } = pronunciationScore(A.target, said);
        $('#target', st).innerHTML = words.map(w => `<span style="color:${w.ok ? 'var(--ok)' : 'var(--bad)'}">${esc(w.w)}</span>`).join(' ');
        $('#result', st).innerHTML = `<div class="feedback ${score >= 60 ? 'ok' : 'bad'}">Điểm phát âm: ${score}% <div class="small">Máy nghe được: "${esc(said)}"</div></div>
          ${score >= 60 ? '<button class="btn block" style="margin-top:10px" id="cont">Tiếp tục</button>' : '<p class="muted small">Từ màu đỏ chưa rõ. Nghe mẫu rồi thử lại nhé!</p>'}`;
        if (score >= 80) award('speaker');
        if (score >= 60) {
          $('#skip', st).remove();
          earn(Math.round(score / 4));
          $('#cont', st).onclick = next;
        }
      } catch (e) { toast(e.message); }
      $('#mic', st) && ($('#mic', st).textContent = '🎤 Nói lại');
    };
  }

  function applyWrite() {
    const A = L.apply;
    const st = shell(`<p class="tag">Bước 4 · Vận dụng ✍️</p>
      <h2>${esc(A.prompt)}</h2>
      <textarea id="txt" placeholder="Viết bằng tiếng Anh..."></textarea>
      <p class="muted small" id="wc">0/${A.minWords} từ</p>
      <button class="btn block" id="submit" disabled>Nộp bài${aiReady() ? ' & nhờ AI chấm' : ''}</button>
      <div id="result"></div>`);
    const txt = $('#txt', st);
    txt.oninput = () => {
      const n = txt.value.trim().split(/\s+/).filter(Boolean).length;
      $('#wc', st).textContent = `${n}/${A.minWords} từ`;
      $('#submit', st).disabled = n < A.minWords;
    };
    $('#submit', st).onclick = async () => {
      const btn = $('#submit', st);
      btn.disabled = true;
      txt.disabled = true;
      earn(30);
      if (aiReady()) {
        btn.textContent = '⏳ AI đang chấm bài...';
        try {
          const r = await aiTask({ apiKey: state.settings.apiKey, task: 'write', level: L.level, input: txt.value, extra: A.prompt });
          $('#result', st).innerHTML = writingFeedbackHtml(r);
        } catch (e) {
          $('#result', st).innerHTML = `<div class="feedback bad">${esc(e.message)}</div>`;
        }
      } else {
        $('#result', st).innerHTML = `<div class="feedback ok">👍 Đã nộp bài! <span class="small">Thêm API key trong Cài đặt (hoặc chạy máy chủ Python) để gia sư AI chấm và sửa lỗi chi tiết.</span></div>`;
      }
      btn.remove();
      $('#result', st).insertAdjacentHTML('beforeend', '<button class="btn block" style="margin-top:10px" id="cont">Tiếp tục</button>');
      $('#cont', st).onclick = next;
    };
  }

  steps[0]();
}

// ================= Kiểm tra định kỳ & chứng chỉ =================
function viewTest(level) {
  if (!LEVELS.includes(level) || levelIdx(level) > levelIdx(state.profile.level) || !levelDone(level)) return go('#/path');
  document.body.classList.add('no-tabs');
  const pool = shuffle(myLevelLessons(level).flatMap(l => l.exercises.filter(e => e.type !== 'match'))).slice(0, 8);
  let i = 0, correct = 0;
  const draw = () => {
    view.innerHTML = `<div class="spread"><a href="#/path">✕ Thoát</a><b>Kiểm tra ${level}</b></div>
      <p class="muted small">Câu ${i + 1}/${pool.length} · Cần đạt 70%</p>
      <div class="progress"><div style="width:${100 * i / pool.length}%"></div></div>
      <div class="card" style="margin-top:12px" id="ex"></div>`;
    renderExercise($('#ex'), pool[i], ok => ok && correct++, () => { i++; i < pool.length ? draw() : done(); });
  };
  const done = () => {
    const score = Math.round(100 * correct / pool.length);
    const passed = score >= 70;
    if (passed) {
      if (!state.passedLevels.includes(level)) state.passedLevels.push(level);
      const prev = state.certificates.find(c => c.level === level);
      if (!prev || prev.score < score) {
        state.certificates = state.certificates.filter(c => c.level !== level);
        state.certificates.push({ level, score, date: today(), code: `EM-${level}-${Date.now().toString(36).toUpperCase()}` });
      }
      const nextLevel = LEVELS[levelIdx(level) + 1];
      if (nextLevel && levelIdx(state.profile.level) <= levelIdx(level)) state.profile.level = nextLevel;
      gainXP(100);
    } else save();
    view.innerHTML = `<div class="card ${passed ? 'hero' : ''}" style="text-align:center">
      <div style="font-size:3rem">${passed ? '🏅' : '💪'}</div>
      <h1>${score}%</h1>
      <p>${passed ? `Chúc mừng! Bạn đã đạt cấp ${level}${LEVELS[levelIdx(level) + 1] ? ` và mở khóa cấp ${LEVELS[levelIdx(level) + 1]}` : ''}.` : 'Chưa đạt 70%. Ôn lại bài và thử lại nhé!'}</p>
      <div class="row" style="justify-content:center">
        ${passed ? `<a class="btn white" href="#/cert/${level}">📜 Xem chứng chỉ</a>` : `<a class="btn" href="#/test/${level}" onclick="setTimeout(()=>dispatchEvent(new HashChangeEvent('hashchange')))">Thử lại</a>`}
        <a class="btn ghost" href="#/home">Về trang chủ</a></div></div>`;
  };
  draw();
}

function viewCert(level) {
  const c = state.certificates.find(x => x.level === level);
  if (!c) return go('#/profile');
  view.innerHTML = `
    <div class="cert">
      <div style="font-size:2.5rem">🦉</div>
      <h1>CHỨNG CHỈ HOÀN THÀNH</h1>
      <p>EngMate xác nhận</p>
      <div class="name">${esc(state.profile.name)}</div>
      <p>đã hoàn thành chương trình và vượt qua bài kiểm tra cấp độ</p>
      <h2 style="font-size:1.6rem">${c.level} – ${LEVEL_INFO[c.level].name}</h2>
      <p>Điểm: <b>${c.score}%</b> · Ngày cấp: ${c.date.split('-').reverse().join('/')}</p>
      <p class="small">Mã chứng chỉ: ${c.code}<br><i>Chứng chỉ nội bộ của ứng dụng EngMate</i></p>
    </div>
    <div class="row no-print" style="margin-top:12px"><button class="btn" onclick="print()">🖨️ In / Lưu PDF</button><a class="btn ghost" href="#/profile">Quay lại</a></div>`;
}

// ================= Ôn tập (SRS) =================
function viewReview() {
  const total = Object.keys(state.srs).length;
  let queue = shuffle(dueCards()).sort((a, b) => (b.lapses || 0) - (a.lapses || 0)).slice(0, 20);
  let extra = false;
  if (!total) {
    view.innerHTML = `<h1>🧠 Ôn tập ngắt quãng</h1><div class="card">Chưa có thẻ nào. Hoàn thành một bài học để thêm từ vựng vào bộ thẻ.<br><br><a class="btn" href="#/path">Đến lộ trình</a></div>`;
    return;
  }
  const draw = () => {
    if (!queue.length) {
      const nextDue = Math.min(...Object.values(state.srs).map(c => c.due));
      view.innerHTML = `<h1>🧠 Ôn tập ngắt quãng</h1><div class="card" style="text-align:center">
        <div style="font-size:3rem">🎉</div><h2>Bạn đã ôn hết thẻ đến hạn!</h2>
        <p class="muted">Lần ôn tiếp theo: ${new Date(nextDue).toLocaleString('vi-VN')}</p>
        <button class="btn ghost" id="more">Luyện thêm 10 thẻ ngẫu nhiên</button></div>
        ${hardWords(8).length ? `<div class="card"><b>🎯 Từ bạn hay quên</b><p class="muted small">AI-SRS cho các từ này quay lại sớm hơn, và gia sư AI sẽ lồng chúng vào cuộc trò chuyện.</p>
          ${hardWords(8).map(c => `<span class="tag" style="margin:2px">${esc(c.en)} · ${c.lapses}×</span>`).join('')}</div>` : ''}`;
      $('#more').onclick = () => { queue = shuffle(Object.values(state.srs)).slice(0, 10); extra = true; draw(); };
      return;
    }
    const card = queue[0];
    view.innerHTML = `<h1>🧠 Ôn tập ngắt quãng</h1>
      <p class="muted small">${queue.length} thẻ còn lại${extra ? ' (luyện thêm)' : ''} · Tổng ${total} thẻ${card.lapses >= 2 ? ' · <span class="tag" style="background:var(--bad-soft);color:var(--bad)">Từ khó</span>' : ''}</p>
      <div class="card flashcard" id="fc"><div><div>${esc(card.en)}</div><div class="sub">Chạm để lật thẻ</div></div></div>
      <div id="grade"></div>`;
    say(card.en);
    $('#fc').onclick = () => {
      $('#fc').innerHTML = `<div><div>${esc(card.vi)}</div><div class="sub">${esc(card.en)} · <i>${esc(card.ex)}</i></div></div>`;
      $('#fc').onclick = () => say(card.ex);
      $('#grade').innerHTML = `<p class="muted small" style="text-align:center">Bạn nhớ từ này thế nào?</p><div class="grid" style="grid-template-columns:repeat(4,1fr)">
        ${[[1, '😵 Quên'], [3, '😓 Khó'], [4, '🙂 Nhớ'], [5, '😎 Dễ']].map(([q, t]) => `<button class="btn ${q < 3 ? 'ghost' : ''} sm" data-q="${q}">${t}</button>`).join('')}</div>`;
      $$('#grade button').forEach(b => b.onclick = () => {
        const q = +b.dataset.q;
        gradeCard(card, q);
        queue.shift();
        if (q < 3 && !extra) queue.push(card);
        state.reviewsDone++;
        questProgress('review', 1);
        gainXP(2);
        draw();
      });
    };
  };
  draw();
}

// ================= Gia sư AI =================
const assistantText = content => typeof content === 'string' ? content : content.filter(b => b.type === 'text').map(b => b.text).join('');
const englishPart = text => text.split('✏️')[0].trim();
const TWIST = '(Plot twist request)';

function formatAI(text) {
  const [main, ...rest] = esc(text).split('✏️');
  return rest.length ? `${main.trim()}<div class="feedback bad small" style="font-weight:400;margin-top:8px">✏️${rest.join('✏️')}</div>` : main;
}

function viewChat() {
  const scenario = CHAT_SCENARIOS.find(s => s.id === state.chat.scenario) || CHAT_SCENARIOS[0];
  const hasKey = aiReady();
  view.innerHTML = `
    <div class="spread"><h1><button class="avatar" id="tutorAv" style="display:inline-grid;width:40px;height:40px;border:none;vertical-align:middle" title="Đổi avatar gia sư">${state.tutorAvatar}</button> Gia sư AI ${hasKey ? '<span class="online">● Online</span>' : ''}</h1>
      <div class="row" style="flex-wrap:nowrap"><button class="btn ghost sm" id="call" ${hasKey && canListen ? '' : 'disabled'} title="Chế độ gọi điện: nói và nghe liên tục">📞</button>
      <button class="btn ghost sm" id="twist" ${hasKey ? '' : 'disabled'} title="Tạo tình huống bất ngờ">🎲</button>
      <button class="btn ghost sm" id="new" title="Cuộc trò chuyện mới">🔄</button></div></div>
    <div class="utils" id="scen">${CHAT_SCENARIOS.map(s => `<button class="btn sm ${s.id === scenario.id ? '' : 'ghost'}" style="flex:none" data-id="${s.id}">${s.icon} ${s.name}</button>`).join('')}</div>
    ${hasKey ? '' : `<div class="banner" style="margin-top:12px">🔑 Để trò chuyện với gia sư AI, hãy nhập Anthropic API key trong <a href="#/settings">Cài đặt</a>.</div>`}
    <div class="row small" id="speed" style="margin-top:8px">🔊 Tốc độ đọc:
      ${[0.75, 0.9, 1].map(r => `<button class="btn sm ${Math.abs(ttsRate() - r) < 0.01 ? '' : 'ghost'}" data-r="${r}">${r}x</button>`).join('')}</div>
    <div class="chat" id="msgs" style="margin-top:14px"></div>
    <canvas class="wave" id="wave" hidden aria-label="Sóng âm giọng của bạn"></canvas>
    <div class="composer">
      <button class="btn ghost round" id="mic" title="Nói bằng giọng" aria-label="Nói bằng giọng" ${canListen ? '' : 'disabled'}>🎤</button>
      <input id="in" placeholder="Nhập tiếng Anh để nói chuyện..." autocomplete="off" ${hasKey ? '' : 'disabled'}>
      <button class="btn send round" id="send" aria-label="Gửi" ${hasKey ? '' : 'disabled'}>➤</button>
    </div>`;

  const msgs = $('#msgs');
  const bubble = (role, html, raw) => {
    msgs.insertAdjacentHTML('beforeend', `<div class="bubble ${role}">${role === 'ai' ? `<b>${state.tutorAvatar}</b> ` : ''}${html}${role === 'ai' && raw ? `<div class="tools"><button class="btn ghost sm" data-say="${esc(englishPart(raw))}">🔊 Nghe</button></div>` : ''}</div>`);
    return msgs.lastElementChild;
  };
  msgs.onclick = e => { const b = e.target.closest('[data-say]'); if (b) say(b.dataset.say); };

  const greeting = `Hi ${state.profile.name}! I'm your English tutor. ${scenario.id === 'free' ? 'What would you like to talk about today?' : `Let's practise: ${scenario.name}. Say hello to start!`}`;
  bubble('ai', esc(greeting), greeting);
  for (const m of state.chat.history) {
    if (m.role === 'user') bubble('me', m.content.startsWith(TWIST) ? '🎲 Tình huống bất ngờ!' : esc(m.content));
    else { const t = assistantText(m.content); bubble('ai', formatAI(t), t); }
  }
  if (state.chat.history.length > 60) msgs.insertAdjacentHTML('beforeend', '<p class="muted small" style="text-align:center">Cuộc trò chuyện đã khá dài, bấm "Cuộc trò chuyện mới" để AI trả lời nhanh hơn.</p>');
  msgs.lastElementChild.scrollIntoView({ block: 'end' });

  $$('#scen button').forEach(b => b.onclick = () => {
    if (b.dataset.id === state.chat.scenario) return;
    state.chat = { scenario: b.dataset.id, history: [] };
    save(); viewChat();
  });
  $('#new').onclick = () => { state.chat.history = []; save(); viewChat(); };
  $('#mic').onclick = async () => {
    $('#mic').textContent = '👂';
    try { $('#in').value = await listenWithWave($('#wave')); $('#in').focus(); } catch (e) { toast(e.message); }
    $('#mic').textContent = '🎤';
  };
  $$('#speed [data-r]').forEach(b => b.onclick = () => {
    state.settings.speechRate = +b.dataset.r;
    save();
    $$('#speed [data-r]').forEach(x => x.classList.toggle('ghost', x !== b));
    say('This is how fast I will speak.');
  });

  $('#tutorAv').onclick = () => {
    const list = unlockedAvatars();
    state.tutorAvatar = list[(list.indexOf(state.tutorAvatar) + 1) % list.length];
    save();
    $('#tutorAv').textContent = state.tutorAvatar;
    if (list.length === 1) toast('Thắng ở ⚔️ Đấu trường AI để mở khóa thêm avatar cho gia sư!');
  };

  let busy = false, calling = false;
  const callBtn = $('#call');
  callBtn.onclick = () => {
    calling = !calling;
    callBtn.classList.toggle('ghost', !calling);
    callBtn.textContent = calling ? '📵' : '📞';
    toast(calling ? '📞 Đang gọi: hãy nói tiếng Anh, gia sư sẽ trả lời bằng giọng nói' : 'Đã kết thúc cuộc gọi');
    if (calling) callListen();
  };
  const callListen = async () => {
    if (!calling || busy || !location.hash.startsWith('#/chat')) return;
    try { $('#in').value = await listenWithWave($('#wave')); send(); }
    catch (e) { if (calling) { toast(e.message + ' Bấm 📵 để dừng.'); setTimeout(callListen, 800); } }
  };
  $('#twist').onclick = () => { $('#in').value = TWIST; send(); };

  const send = async () => {
    const text = $('#in').value.trim();
    if (!text || busy) return;
    busy = true;
    $('#in').value = '';
    $('#send').disabled = true;
    bubble('me', text.startsWith(TWIST) ? '🎲 Tình huống bất ngờ!' : esc(text)).scrollIntoView({ block: 'end' });
    state.chat.history.push({ role: 'user', content: text });
    const out = bubble('ai', '<span class="muted">…</span>');
    let acc = '';
    try {
      const msg = await chatStream({
        apiKey: state.settings.apiKey,
        ctx: { level: state.profile.level, ageGroup: state.profile.ageGroup, scenario: scenario.id, name: state.profile.name, words: hardWords().map(c => c.en) },
        history: state.chat.history,
        onText: d => { acc += d; out.innerHTML = formatAI(acc); out.scrollIntoView({ block: 'end' }); },
      });
      if (msg.stop_reason === 'refusal') {
        state.chat.history.pop();
        out.innerHTML = '<span class="muted">Gia sư không thể trả lời tin nhắn này. Hãy thử nói khác đi nhé.</span>';
      } else {
        state.chat.history.push({ role: 'assistant', content: msg.content });
        const t = assistantText(msg.content);
        out.remove();
        bubble('ai', formatAI(t), t).scrollIntoView({ block: 'end' });
        speak(englishPart(t), ttsRate(), () => calling && setTimeout(callListen, 300));
        state.chatCount++;
        questProgress('chat', 1);
        gainXP(5);
      }
    } catch (e) {
      state.chat.history.pop();
      out.innerHTML = `<span style="color:var(--bad)">⚠️ ${esc(e.message)}</span>`;
      if (calling) callBtn.click();
    }
    save();
    busy = false;
    $('#send').disabled = false;
    $('#in').focus();
  };
  $('#send').onclick = send;
  $('#in').onkeydown = e => { if (e.key === 'Enter') send(); };
}

// ================= Học cùng AI =================
function writingFeedbackHtml(r) {
  return `<div class="card" style="margin-top:12px">
    <div class="spread"><b>🤖 Nhận xét của gia sư AI</b><span class="tag">${Math.max(0, Math.min(10, r.score))}/10</span></div>
    <p>${esc(r.summary_vi)}</p>
    ${r.corrections.length ? `<h2>✏️ Sửa lỗi</h2>${r.corrections.map(c => `<div class="post">
      <div><s style="color:var(--bad)">${esc(c.original)}</s> → <b style="color:var(--ok)">${esc(c.corrected)}</b></div>
      <div class="muted small">${esc(c.explanation_vi)}</div></div>`).join('')}` : '<p class="feedback ok">Không có lỗi nào, tuyệt vời! 🎉</p>'}
    ${r.upgrades.length ? `<h2>🚀 Nâng cấp từ vựng</h2>${r.upgrades.map(u => `<div class="post">
      <div>${esc(u.original)} → <b style="color:var(--secondary)">${esc(u.better)}</b></div>
      <div class="muted small">${esc(u.note_vi)}</div></div>`).join('')}` : ''}
    <h2>📄 Bản viết hay hơn</h2><p style="white-space:pre-wrap">${esc(r.improved_version)}</p>
    <button class="btn ghost sm" data-say="${esc(r.improved_version)}">🔊 Nghe</button></div>`;
}

// Chỉ giữ câu hỏi trắc nghiệm hợp lệ từ AI.
const validQuestions = qs => (qs || []).filter(q =>
  Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length);

// Chạy lần lượt danh sách câu trắc nghiệm trong `el`; onEach(ok, q) sau mỗi câu, onDone(correct) khi xong.
function runQuiz(el, questions, onEach, onDone) {
  let i = 0, correct = 0;
  const draw = () => {
    el.innerHTML = `<p class="muted small">Câu ${i + 1}/${questions.length}</p><div id="qz"></div>`;
    const q = questions[i];
    renderExercise($('#qz', el), { type: 'mc', ...q }, ok => {
      if (ok) correct++;
      onEach?.(ok, q);
      if (q.explanation_vi) setTimeout(() => $('#qz .feedback', el)?.insertAdjacentHTML('beforeend', `<div class="small" style="font-weight:600;margin-top:4px">💡 ${esc(q.explanation_vi)}</div>`));
    }, () => { i++; i < questions.length ? draw() : onDone(correct); });
  };
  draw();
}

const AI_TOOLS = [
  { id: 'listen', icon: '🎧', name: 'Nghe & đọc' },
  { id: 'interpret', icon: '🗣️', name: 'Phiên dịch' },
  { id: 'write', icon: '✍️', name: 'Trợ lý viết' },
  { id: 'translate', icon: '🌐', name: 'Dịch ngữ cảnh' },
  { id: 'story', icon: '📚', name: 'Truyện AI' },
  { id: 'weak', icon: '🎯', name: 'Luyện điểm yếu' },
  { id: 'analyze', icon: '📝', name: 'Phân tích bài văn' },
  { id: 'dict', icon: '📖', name: 'Từ điển & phát âm' },
];

function viewAILab(tool = 'write') {
  if (!AI_TOOLS.some(t => t.id === tool)) tool = 'write';
  const ready = aiReady();
  const level = state.profile.level;
  view.innerHTML = `<h1>✨ Học cùng AI</h1>
    ${ready || tool === 'listen' || tool === 'interpret' ? '' : `<div class="banner">🔑 Các công cụ AI cần API key trong <a href="#/settings">Cài đặt</a> hoặc chạy máy chủ Python có ANTHROPIC_API_KEY.</div>`}
    <div class="utils">${AI_TOOLS.map(t => `<a class="btn sm ${t.id === tool ? '' : 'ghost'}" style="flex:none" href="#/ailab/${t.id}">${t.icon} ${t.name}</a>`).join('')}</div>
    <div class="card" id="tool" style="margin-top:8px"></div><div id="out"></div>`;
  const box = $('#tool'), out = $('#out');
  out.onclick = e => { const b = e.target.closest('[data-say]'); if (b) say(b.dataset.say); };

  const run = async (btn, args, render) => {
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = '⏳ AI đang xử lý...';
    out.innerHTML = '';
    try {
      const r = await aiTask({ apiKey: state.settings.apiKey, level, ...args });
      state.aiLabUses++;
      gainXP(10);
      render(r);
    } catch (e) {
      out.innerHTML = `<div class="feedback bad">${esc(e.message)}</div>`;
    }
    btn.disabled = !ready;
    btn.textContent = label;
  };

  if (tool === 'listen') listenTool(box, out, ready, level, run);

  else if (tool === 'interpret') interpretTool(box, out, ready);

  else if (tool === 'write') {
    box.innerHTML = `<b>✍️ Trợ lý viết & sửa ngữ pháp</b>
      <p class="muted small">Viết một đoạn tiếng Anh: AI sửa lỗi, giải thích vì sao bằng tiếng Việt và gợi ý từ vựng hay hơn.</p>
      <input id="w-task" placeholder="Chủ đề / đề bài (không bắt buộc)">
      <textarea id="w-text" style="margin-top:8px" placeholder="Ví dụ: Yesterday I go to school and my teacher very good..."></textarea>
      <button class="btn block" style="margin-top:10px" id="w-go" ${ready ? '' : 'disabled'}>Sửa bài cho tôi</button>`;
    $('#w-go').onclick = () => {
      const text = $('#w-text').value.trim();
      if (text.split(/\s+/).length < 3) return toast('Hãy viết ít nhất một câu nhé!');
      run($('#w-go'), { task: 'write', input: text, extra: $('#w-task').value.trim() }, r => { out.innerHTML = writingFeedbackHtml(r); });
    };
  }

  else if (tool === 'translate') {
    box.innerHTML = `<b>🌐 Dịch theo ngữ cảnh</b>
      <p class="muted small">Dán một câu tiếng Anh, AI giải thích nghĩa đúng theo ngữ cảnh thay vì dịch từng chữ.</p>
      <textarea id="t-text" style="min-height:80px" placeholder="Ví dụ: I'm going to hit the books tonight."></textarea>
      <input id="t-phrase" style="margin-top:8px" placeholder="Từ/cụm từ bạn muốn hỏi (không bắt buộc), ví dụ: hit the books">
      <button class="btn block" style="margin-top:10px" id="t-go" ${ready ? '' : 'disabled'}>Giải thích</button>`;
    $('#t-go').onclick = () => {
      const text = $('#t-text').value.trim();
      if (!text) return toast('Hãy nhập một câu tiếng Anh');
      run($('#t-go'), { task: 'translate', input: text, extra: $('#t-phrase').value.trim() }, r => {
        out.innerHTML = `<div class="card">
          <p class="muted small">Bản dịch tự nhiên</p><p style="font-size:1.1rem"><b>${esc(r.translation_vi)}</b></p>
          <div class="post"><b style="color:var(--secondary)">${esc(r.phrase)}</b> = ${esc(r.phrase_meaning_vi)}<div class="muted small">${esc(r.explanation_vi)}</div></div>
          <h2>Ví dụ khác</h2>${r.examples.map(x => `<div class="post"><div class="spread"><b>${esc(x.en)}</b><button class="icon-btn" data-say="${esc(x.en)}">🔊</button></div><div class="muted small">${esc(x.vi)}</div></div>`).join('')}
          <button class="btn ghost sm" id="t-add">➕ Thêm "${esc(r.phrase)}" vào thẻ ôn tập</button></div>`;
        $('#t-add').onclick = () => {
          addCards([{ en: r.phrase, vi: r.phrase_meaning_vi, ex: r.examples[0]?.en || text }]);
          save(); toast('Đã thêm vào bộ thẻ ôn tập 🧠'); $('#t-add').disabled = true;
        };
      });
    };
  }

  else if (tool === 'story') {
    const words = shuffle(Object.keys(state.srs)).slice(0, 6);
    box.innerHTML = `<b>📚 Truyện ngắn theo sở thích</b>
      <p class="muted small">AI viết truyện ở trình độ ${level}${words.length ? `, lồng ghép từ bạn đang học (${words.map(esc).join(', ')})` : ''}, kèm câu hỏi đọc hiểu.</p>
      <input id="s-int" placeholder="Bạn thích gì? Ví dụ: vũ trụ, phim Marvel, bóng đá">
      <button class="btn block" style="margin-top:10px" id="s-go" ${ready ? '' : 'disabled'}>Viết truyện cho tôi</button>`;
    $('#s-go').onclick = () => {
      const interests = $('#s-int').value.trim();
      if (!interests) return toast('Hãy nhập sở thích của bạn');
      run($('#s-go'), { task: 'story', input: interests, words }, r => {
        const qs = validQuestions(r.questions);
        out.innerHTML = `<div class="card"><div class="spread"><h2 style="margin:0">${esc(r.title)}</h2><button class="icon-btn" data-say="${esc(r.story)}">🔊</button></div>
          <p style="white-space:pre-wrap;font-size:1.05rem">${esc(r.story)}</p>
          <h2>📖 Từ vựng trong truyện</h2><p>${r.glossary.map(g => `<span class="tag" style="margin:2px">${esc(g.en)} · ${esc(g.vi)}</span>`).join('')}</p>
          <button class="btn ghost sm" id="s-add">➕ Thêm vào thẻ ôn tập</button></div>
          ${qs.length ? '<div class="card"><b>❓ Đọc hiểu</b><div id="s-quiz"></div></div>' : ''}`;
        $('#s-add').onclick = () => {
          addCards(r.glossary.map(g => ({ en: g.en, vi: g.vi, ex: r.title })));
          save(); toast(`Đã thêm ${r.glossary.length} từ vào bộ thẻ 🧠`); $('#s-add').disabled = true;
        };
        if (qs.length) runQuiz($('#s-quiz'), qs, ok => ok && gainXP(5), c => {
          $('#s-quiz').innerHTML = `<div class="feedback ok">Bạn trả lời đúng ${c}/${qs.length} câu đọc hiểu! 🎉</div>`;
        });
      });
    };
  }

  else if (tool === 'analyze') {
    box.innerHTML = `<b>📝 Dịch & phân tích bài văn</b>
      <p class="muted small">Dán một đoạn/bài tiếng Anh: AI dịch theo ngữ cảnh, lọc từ vựng đắt giá và bóc tách cấu trúc ngữ pháp quan trọng.</p>
      <textarea id="a-text" style="min-height:140px" placeholder="Dán bài báo, email, đoạn truyện... bằng tiếng Anh"></textarea>
      <button class="btn block" style="margin-top:10px" id="a-go" ${ready ? '' : 'disabled'}>Phân tích</button>`;
    $('#a-go').onclick = () => {
      const text = $('#a-text').value.trim();
      if (text.split(/\s+/).length < 5) return toast('Hãy dán ít nhất một câu hoàn chỉnh');
      run($('#a-go'), { task: 'analyze', input: text }, r => {
        out.innerHTML = `<div class="card"><b>🇻🇳 Bản dịch theo ngữ cảnh</b><p style="white-space:pre-wrap">${esc(r.translation_vi)}</p></div>
          <div class="card"><div class="spread"><b>💎 Từ vựng đắt giá</b><button class="btn ghost sm" id="a-add">➕ Thêm tất cả vào thẻ</button></div>
            ${r.vocabulary.map(v => `<div class="vocab"><div><b>${esc(v.en)}</b> <span class="muted small">${esc(v.ipa)}</span> — ${esc(v.vi)}
              <div class="muted small">${esc(v.note_vi)}</div></div><button class="icon-btn" data-say="${esc(v.en)}">🔊</button></div>`).join('')}</div>
          <div class="card"><b>📐 Cấu trúc ngữ pháp</b>${r.grammar.map(g => `<div class="post"><b style="color:var(--secondary)">${esc(g.structure)}</b>
            <div><i>${esc(g.example)}</i></div><div class="muted small">${esc(g.explanation_vi)}</div></div>`).join('')}</div>`;
        $('#a-add').onclick = () => {
          addCards(r.vocabulary.map(v => ({ en: v.en, vi: v.vi, ex: v.note_vi })));
          save(); toast(`Đã thêm ${r.vocabulary.length} từ vào bộ thẻ 🧠`); $('#a-add').disabled = true;
        };
      });
    };
  }

  else if (tool === 'dict') {
    // Từ điển nhanh: tra trong từ vựng có sẵn (chạy offline), tra sâu bằng AI, luyện phát âm có sóng âm.
    const known = new Map();
    for (const v of [...LESSONS.flatMap(l => l.vocab), ...Object.values(state.srs)]) if (!known.has(v.en.toLowerCase())) known.set(v.en.toLowerCase(), v);
    const practiced = Object.keys(state.pronounce).length, good = Object.values(state.pronounce).filter(v => v >= 80).length;
    box.innerHTML = `<b>📖 Từ điển tức thì & luyện phát âm</b>
      <div class="composer" style="position:static;padding:8px 0 0;background:none">
        <input id="d-q" placeholder="Gõ từ tiếng Anh hoặc tiếng Việt..." autocomplete="off">
        <button class="btn round" id="d-ai" title="Tra chi tiết bằng AI" ${ready ? '' : 'disabled'}>🤖</button></div>
      <div id="d-list"></div>
      <div style="margin-top:12px"><div class="spread small"><span>🎯 Đã luyện ${practiced} từ · ${good} từ đạt ≥80%</span><a href="#/profile">🎖️ ${state.badges.length} huy hiệu</a></div>
        <div class="progress" style="margin-top:6px"><div style="width:${Math.min(100, good * 10)}%"></div></div>
        <p class="muted small">Đạt ≥80% với 10 từ để nhận huy hiệu "Phát âm chuẩn". Từ phát âm chưa tốt sẽ được đưa vào bộ thẻ để ôn sớm hơn.</p></div>`;

    const showWord = w => {
      const meaning = w.meanings ? w.meanings.map(m => `${esc(m.vi)} <span class="muted small">– ${esc(m.definition_en)}</span>`).join('<br>') : esc(w.vi);
      out.innerHTML = `<div class="card">
        <div class="spread"><div><span style="font-size:1.6rem;font-weight:800">${esc(w.en)}</span> <span class="muted">${esc(w.ipa || '')} ${esc(w.part_of_speech || '')}</span></div>
          <div class="row" style="flex-wrap:nowrap"><button class="icon-btn" data-say="${esc(w.en)}">🔊</button><button class="icon-btn" id="d-slow" title="Đọc chậm">🐢</button></div></div>
        <p>${meaning}</p>
        ${(w.examples || (w.ex ? [{ en: w.ex, vi: '' }] : [])).map(x => `<div class="post"><div class="spread"><i>${esc(x.en)}</i><button class="icon-btn" data-say="${esc(x.en)}">🔊</button></div>${x.vi ? `<div class="muted small">${esc(x.vi)}</div>` : ''}</div>`).join('')}
        ${w.synonyms?.length ? `<p class="small">Đồng nghĩa: ${w.synonyms.map(x => `<span class="tag">${esc(x)}</span>`).join(' ')}</p>` : ''}
        ${w.pronunciation_tip_vi ? `<div class="banner" style="margin-top:8px">🗣️ ${esc(w.pronunciation_tip_vi)}</div>` : ''}
        <h2>🎤 Luyện phát âm</h2>
        <p id="d-target" style="font-size:1.3rem;font-weight:800;margin:4px 0">${esc(w.en)}</p>
        <canvas class="wave" id="d-wave" aria-label="Sóng âm giọng của bạn"></canvas>
        <button class="btn block" id="d-mic" ${canListen ? '' : 'disabled'}>🎤 Nhấn và đọc to từ này</button>
        ${canListen ? '' : '<p class="muted small">Trình duyệt này không hỗ trợ micro. Hãy dùng Chrome/Edge.</p>'}
        <div id="d-res"></div>
        <button class="btn ghost sm" style="margin-top:8px" id="d-add">➕ Thêm vào thẻ ôn tập</button></div>`;
      $('#d-slow').onclick = () => speak(w.en, 0.6);
      $('#d-add').onclick = () => { addCards([{ en: w.en, vi: w.vi || w.meanings?.[0]?.vi || '', ex: w.ex || w.examples?.[0]?.en || '' }]); save(); toast('Đã thêm vào bộ thẻ 🧠'); };
      $('#d-mic').onclick = async () => {
        const btn = $('#d-mic');
        btn.textContent = '👂 Đang nghe...';
        try {
          const said = await listenWithWave($('#d-wave'));
          const { score, words } = pronunciationScore(w.en, said);
          const key = w.en.toLowerCase();
          state.pronounce[key] = Math.max(state.pronounce[key] || 0, score);
          if (score < 60) {
            // AI-SRS: phát âm chưa đạt → từ quay lại sớm trong ôn tập và được gia sư AI dùng trong chat.
            addCards([{ en: w.en, vi: w.vi || w.meanings?.[0]?.vi || '', ex: w.ex || w.examples?.[0]?.en || '' }]);
            const card = state.srs[w.en];
            card.lapses = (card.lapses || 0) + 1;
            card.due = Math.min(card.due, Date.now() + 10 * 60 * 1000);
          }
          gainXP(score >= 80 ? 5 : 2);
          $('#d-target').innerHTML = words.map(x => `<span style="color:${x.ok ? 'var(--ok)' : 'var(--bad)'}">${esc(x.w)}</span>`).join(' ');
          $('#d-res').innerHTML = `<div class="feedback ${score >= 80 ? 'ok' : 'bad'}">Điểm: ${score}% · Máy nghe được: "${esc(said)}"
            <div class="small" style="font-weight:600">${score >= 80 ? 'Rất tốt! 🎉' : 'Nghe mẫu (🐢 đọc chậm) rồi thử lại nhé. Từ này đã được đưa vào ôn tập sớm.'}</div></div>`;
        } catch (e) { toast(e.message); }
        btn.textContent = '🎤 Đọc lại';
      };
    };

    const search = () => {
      const q = $('#d-q').value.trim().toLowerCase();
      if (!q) { $('#d-list').innerHTML = ''; return; }
      const hits = [...known.values()].filter(v => v.en.toLowerCase().includes(q) || v.vi.toLowerCase().includes(q)).slice(0, 6);
      $('#d-list').innerHTML = hits.length
        ? hits.map((v, i) => `<button class="option" data-i="${i}"><b>${esc(v.en)}</b> — ${esc(v.vi)}</button>`).join('')
        : `<p class="muted small">Không có trong từ vựng của app${ready ? ', bấm 🤖 để tra bằng AI.' : '.'}</p>`;
      $$('#d-list [data-i]').forEach(b => b.onclick = () => showWord(hits[+b.dataset.i]));
    };
    $('#d-q').oninput = search;
    $('#d-q').onkeydown = e => { if (e.key === 'Enter') (ready ? $('#d-ai').click() : search()); };
    $('#d-ai').onclick = () => {
      const q = $('#d-q').value.trim();
      if (!q) return toast('Hãy gõ một từ cần tra');
      run($('#d-ai'), { task: 'dict', input: q }, r => showWord({ ...r, en: r.word, vi: r.meanings[0]?.vi || '' }));
    };
  }

  else if (tool === 'weak') {
    const topics = Object.entries(state.weak).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const fallback = levelLessons(level).map(l => l.grammar.title);
    box.innerHTML = `<b>🎯 Luyện điểm yếu</b>
      <p class="muted small">${topics.length ? 'AI phân tích các câu bạn làm sai và tạo bài tập mới cho đúng chủ điểm đó, đến khi bạn vững thì thôi.' : 'Chưa có dữ liệu lỗi sai. Hãy chọn một chủ điểm để AI tạo bài luyện.'}</p>
      <select id="k-topic">${(topics.length ? topics.map(([t, n]) => [t, `${t} (sai ${n} lần)`]) : fallback.map(t => [t, t]))
        .map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('')}</select>
      <button class="btn block" style="margin-top:10px" id="k-go" ${ready ? '' : 'disabled'}>Tạo bài luyện</button>`;
    $('#k-go').onclick = () => {
      const topic = $('#k-topic').value;
      run($('#k-go'), { task: 'quiz', input: topic, extra: state.recentMistakes.join(' | ') }, r => {
        const qs = validQuestions(r.questions);
        if (!qs.length) { out.innerHTML = '<div class="feedback bad">AI chưa tạo được câu hỏi hợp lệ, hãy thử lại.</div>'; return; }
        out.innerHTML = `<div class="card"><b>🎯 ${esc(r.topic_vi || topic)}</b><div id="k-quiz"></div></div>`;
        runQuiz($('#k-quiz'), qs, ok => {
          if (ok) { gainXP(10); state.weak[topic] = Math.max(0, (state.weak[topic] || 0) - 1); save(); }
          else state.weak[topic] = (state.weak[topic] || 0) + 1;
        }, c => {
          $('#k-quiz').innerHTML = `<div class="feedback ${c >= qs.length * 0.8 ? 'ok' : 'bad'}">Đúng ${c}/${qs.length}. ${c >= qs.length * 0.8 ? 'Bạn đã vững chủ điểm này! 💪' : 'Hãy luyện thêm một lượt nữa nhé.'}</div>
            <button class="btn block" style="margin-top:10px" onclick="document.getElementById('k-go').click()">Luyện lượt mới</button>`;
        });
      });
    };
  }
}

// ================= Đấu trường AI =================
const AI_SKILL = { A1: 0.55, A2: 0.6, B1: 0.65, B2: 0.72, C1: 0.78, C2: 0.85 };

function viewBattle() {
  // Ưu tiên từ trong bộ thẻ; thiếu thì lấy từ các bài đã mở.
  let pool = Object.values(state.srs);
  if (new Set(pool.map(c => c.vi)).size < 4) pool = LESSONS.filter(isUnlocked).flatMap(l => l.vocab);
  const next = unlockedAvatars().length < TUTOR_AVATARS.length ? TUTOR_AVATARS[unlockedAvatars().length] : null;
  view.innerHTML = `<h1>⚔️ Đấu trường AI</h1>
    <div class="card hero" style="text-align:center">
      <div style="font-size:3rem">🧑 ⚔️ ${state.tutorAvatar}</div>
      <h2 style="margin:6px 0">Thách đấu từ vựng với AI</h2>
      <p class="muted">8 vòng · chọn nghĩa đúng thật nhanh. Đúng +10 điểm, còn bao nhiêu giây thì cộng thêm bấy nhiêu.</p>
      <p>Thắng: +50 XP${next ? ` và mở khóa avatar gia sư ${next}` : ''}</p>
      <button class="btn white" id="b-start">Bắt đầu trận đấu</button>
      <p class="muted small" style="margin-bottom:0">Thành tích: ${state.battles.wins} thắng / ${state.battles.played} trận</p>
    </div>`;
  $('#b-start').onclick = () => startBattle(pool);
}

function startBattle(pool) {
  document.body.classList.add('no-tabs');
  const rounds = shuffle(pool).slice(0, 8);
  const skill = AI_SKILL[state.profile.level] || 0.6;
  const route = location.hash;
  let r = 0, me = 0, ai = 0;

  const round = () => {
    if (location.hash !== route) return;
    if (r >= rounds.length) return finish();
    const card = rounds[r];
    const options = shuffle([card.vi, ...shuffle([...new Set(pool.map(c => c.vi))].filter(v => v !== card.vi)).slice(0, 3)]);
    const aiTime = 2 + Math.random() * 5, aiRight = Math.random() < skill;
    let left = 10, answered = false;
    view.innerHTML = `<div class="spread"><b>🧑 Bạn: ${me}</b><span class="tag">Vòng ${r + 1}/${rounds.length}</span><b>${state.tutorAvatar} AI: ${ai}</b></div>
      <div class="progress" style="margin:10px 0"><div id="b-time" style="width:100%"></div></div>
      <div class="card flashcard" style="min-height:120px">${esc(card.en)}</div>
      <div id="b-opts">${options.map(o => `<button class="option" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      <p class="muted small" id="b-ai" style="text-align:center">${state.tutorAvatar} AI đang suy nghĩ...</p>`;
    say(card.en);
    const end = (pick) => {
      if (answered) return;
      answered = true;
      clearInterval(timer);
      const ok = pick === card.vi;
      if (ok) me += 10 + Math.ceil(left);
      if (aiRight) ai += 10 + Math.max(0, Math.ceil(10 - aiTime));
      $$('#b-opts .option').forEach(b => { b.disabled = true; if (b.dataset.v === card.vi) b.classList.add('correct'); else if (b.dataset.v === pick) b.classList.add('wrong'); });
      $('#b-ai').textContent = `${state.tutorAvatar} AI ${aiRight ? 'trả lời đúng ✔' : 'trả lời sai ✘'} sau ${aiTime.toFixed(1)}s`;
      r++;
      setTimeout(round, 1300);
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
    let unlocked = null;
    if (win) {
      state.battles.wins++;
      unlocked = TUTOR_AVATARS[state.battles.wins] ?? null; // mỗi trận thắng mở thêm một avatar
    }
    gainXP(win ? 50 : tie ? 20 : 10);
    document.body.classList.remove('no-tabs');
    view.innerHTML = `<div class="card ${win ? 'hero' : ''}" style="text-align:center">
      <div style="font-size:3rem">${win ? '🏆' : tie ? '🤝' : '💪'}</div>
      <h1>${win ? 'Bạn thắng!' : tie ? 'Hòa!' : 'AI thắng lần này'}</h1>
      <p><b>${me}</b> – <b>${ai}</b></p>
      <p>+${win ? 50 : tie ? 20 : 10} XP${win && unlocked ? ` · Mở khóa avatar gia sư ${unlocked} (bấm vào avatar trong Gia sư AI để đổi)` : ''}</p>
      <div class="row" style="justify-content:center"><button class="btn ${win ? 'white' : ''}" id="b-again">Đấu lại</button><a class="btn ghost" href="#/home">Về trang chủ</a></div></div>`;
    $('#b-again').onclick = () => startBattle(pool);
  };
  round();
}

// ================= Thành tích =================
const BOTS = ['Mai Anh', 'Tuấn', 'Linh Chi', 'Quang', 'Hà My', 'Đức', 'Thảo', 'Bảo', 'Ngọc', 'Khoa'];

function weekDays() {
  const d = new Date();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(monday); x.setDate(monday.getDate() + i); return x; });
}
function seeded(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; }

function leaderboard() {
  const days = weekDays();
  const elapsed = Math.max(1, days.filter(d => dayKey(d) <= today()).length);
  const weekKey = dayKey(days[0]);
  const myXP = days.reduce((s, d) => s + (state.xpByDay[dayKey(d)] || 0), 0);
  // Người chơi mô phỏng: XP tăng dần theo số ngày đã trôi qua trong tuần.
  const rows = BOTS.map(n => ({ name: n, xp: Math.round(seeded(weekKey + n) * 90 * elapsed + 10 * elapsed) }));
  rows.push({ name: `${state.profile.name} (bạn)`, xp: myXP, me: true });
  return rows.sort((a, b) => b.xp - a.xp);
}

function viewProfile() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const vals = days.map(d => state.xpByDay[dayKey(d)] || 0);
  const max = Math.max(50, ...vals);
  const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const board = leaderboard();
  const lessonsDone = Object.keys(state.completed).length;

  view.innerHTML = `
    <div class="spread"><h1>🏆 Thành tích</h1><a class="btn ghost sm" href="#/settings">⚙️ Cài đặt</a></div>
    <div class="grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="card" style="text-align:center"><div style="font-size:1.5rem">🔥</div><b>${currentStreak()}</b><div class="muted small">ngày liên tiếp</div></div>
      <div class="card" style="text-align:center"><div style="font-size:1.5rem">⭐</div><b>${state.xp}</b><div class="muted small">tổng XP</div></div>
      <div class="card" style="text-align:center"><div style="font-size:1.5rem">📘</div><b>${lessonsDone}/${LESSONS.length}</b><div class="muted small">bài học</div></div>
      <div class="card" style="text-align:center"><div style="font-size:1.5rem">🧠</div><b>${Object.keys(state.srs).length}</b><div class="muted small">từ đã học</div></div>
    </div>

    <h2>📈 Tiến độ 7 ngày qua</h2>
    <div class="card"><div class="chart" role="img" aria-label="XP 7 ngày qua: ${vals.join(', ')}">
      ${days.map((d, i) => `<div class="bar"><b>${vals[i] || ''}</b><div style="height:${100 * vals[i] / max}%"></div>${weekday[d.getDay()]}</div>`).join('')}
    </div></div>

    <h2>🏅 Bảng xếp hạng tuần</h2>
    <div class="card">${board.map((r, i) => `<div class="board-row ${r.me ? 'me' : ''}"><span class="rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="grow">${esc(r.name)}</span><span>${r.xp} XP</span></div>`).join('')}
      <p class="muted small">Giải đấu tuần với người chơi mô phỏng, làm mới vào mỗi thứ Hai.</p></div>

    <h2>🎖️ Huy hiệu (${state.badges.length}/${BADGES.length})</h2>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">
      ${BADGES.map(b => `<div class="card badge ${state.badges.includes(b.id) ? '' : 'off'}" title="${esc(b.desc)}"><div class="b-ico">${b.icon}</div><b class="small">${b.name}</b><div class="muted small">${b.desc}</div></div>`).join('')}
    </div>

    <h2>📜 Chứng chỉ nội bộ</h2>
    <div class="card">${state.certificates.length ? state.certificates.map(c => `<div class="spread board-row"><span>🏅 Cấp ${c.level} – ${c.score}%</span><a href="#/cert/${c.level}">Xem</a></div>`).join('')
      : '<span class="muted">Hoàn thành bài kiểm tra định kỳ cuối mỗi cấp để nhận chứng chỉ.</span>'}</div>`;
}

// ================= Cộng đồng =================
const SAMPLE_POSTS = [
  { name: 'Mai Anh', text: 'Mẹo: mỗi sáng mình đọc to 5 câu mẫu trong bài, phát âm tiến bộ rõ sau 2 tuần! 💪', date: '2026-10-28', likes: 12 },
  { name: 'Tuấn', text: 'Ai đang học B1 không? Câu điều kiện loại 1 dễ nhớ nhất là: "If + hiện tại, will + V" 😄', date: '2026-10-30', likes: 8 },
  { name: 'Linh Chi', text: 'Vừa đạt chứng chỉ A2 sau 1 tháng. Chuỗi 30 ngày rồi nè 🔥', date: '2026-11-01', likes: 21 },
];

function viewCommunity() {
  const posts = [...state.posts, ...SAMPLE_POSTS];
  view.innerHTML = `<h1>👥 Cộng đồng</h1>
    <div class="card">
      <textarea id="post" placeholder="Chia sẻ mẹo học, thành tích hoặc câu hỏi của bạn..." style="min-height:80px"></textarea>
      <div class="row" style="margin-top:8px;justify-content:space-between">
        <button class="btn ghost sm" id="share-stats">📊 Chia sẻ thành tích</button>
        <button class="btn sm" id="publish">Đăng</button></div>
    </div>
    <div class="card">${posts.map((p, i) => `<div class="post"><div class="spread"><b>${esc(p.name)}</b><span class="muted small">${p.date.split('-').reverse().join('/')}</span></div>
      <p style="margin:6px 0">${esc(p.text)}</p><button class="btn ghost sm" data-like="${i}">❤️ ${p.likes}</button></div>`).join('')}</div>
    <p class="muted small">Bài đăng của bạn hiện được lưu trên thiết bị này.</p>`;
  $('#share-stats').onclick = () => {
    $('#post').value = `Mình đang học cấp ${state.profile.level} trên EngMate: 🔥 ${currentStreak()} ngày liên tiếp, ⭐ ${state.xp} XP, ${Object.keys(state.srs).length} từ vựng!`;
  };
  $('#publish').onclick = () => {
    const text = $('#post').value.trim();
    if (!text) return;
    state.posts.unshift({ name: state.profile.name, text, date: today(), likes: 0 });
    save(); viewCommunity(); toast('Đã đăng!');
  };
  $$('[data-like]').forEach(b => b.onclick = () => {
    const i = +b.dataset.like;
    posts[i].likes++;
    if (i < state.posts.length) save();
    b.textContent = `❤️ ${posts[i].likes}`;
    b.disabled = true;
  });
}

// ================= Cài đặt & nhắc nhở =================
// Các giao diện của cùng một app (index.html mở giao diện đã chọn).
const UI_KEY = 'engmate-ui';
const UI_OPTIONS = [
  { id: 'app', icon: '📱', name: 'Chuẩn', desc: 'đầy đủ tính năng', page: 'app.html' },
  { id: 'ai-tutor', icon: '🤖', name: 'Gia sư AI', desc: 'tông tím, 5 tab', page: 'ai-tutor.html' },
  { id: 'demo01', icon: '🖥️', name: 'Demo 01', desc: 'khung điện thoại', page: 'demo01.html' },
  { id: 'demo02', icon: '✨', name: 'Demo 02', desc: 'chuyển màu, gọn', page: 'demo02.html' },
];
const currentUI = () => { try { return localStorage.getItem(UI_KEY) || 'app'; } catch { return 'app'; } };

function viewSettings() {
  const s = state.settings;
  view.innerHTML = `<div class="spread"><h1>⚙️ Cài đặt</h1><a href="#/profile">← Quay lại</a></div>
    <div class="card">
      <label for="st-name">Tên hiển thị</label><input id="st-name" value="${esc(state.profile.name)}">
      <label for="st-age">Nhóm tuổi</label>
      <select id="st-age">${AGE_GROUPS.map(g => [g.id, `${g.icon} ${g.name}`]).map(([v, t]) => `<option value="${v}" ${state.profile.ageGroup === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <label for="st-goal">Mục tiêu mỗi ngày</label>
      <select id="st-goal">${[5, 10, 15, 30].map(m => `<option value="${m}" ${state.profile.goal === m ? 'selected' : ''}>${m} phút</option>`).join('')}</select>
      <label for="st-rate">Tốc độ đọc tiếng Anh</label>
      <select id="st-rate">${[[0, 'Tự động theo lứa tuổi'], [0.75, '0.75x – chậm'], [0.9, '0.9x'], [1, '1.0x – bình thường']].map(([v, t]) => `<option value="${v}" ${state.settings.speechRate === v ? 'selected' : ''}>${t}</option>`).join('')}</select>
    </div>
    <div class="card">
      <h2 style="margin-top:0">⏰ Nhắc nhở học tập</h2>
      <label class="row" style="font-weight:400"><input type="checkbox" id="st-rem" style="width:auto" ${s.reminders ? 'checked' : ''}> Nhắc tôi học mỗi ngày lúc</label>
      <input type="time" id="st-time" value="${s.reminderTime}">
      <p class="muted small">Thông báo hiện khi trang EngMate đang mở (hoặc đã cài lên màn hình chính) và hôm đó bạn chưa học.</p>
    </div>
    <div class="card">
      <h2 style="margin-top:0">🎨 Giao diện</h2>
      <p class="muted small">Cùng một app, cùng tiến độ học; chỉ khác cách trình bày. Lần sau mở app sẽ vào đúng giao diện bạn chọn.</p>
      ${UI_OPTIONS.map(o => `<label class="row" style="font-weight:600;margin:8px 0"><input type="radio" name="st-ui" value="${o.id}" style="width:auto" ${currentUI() === o.id ? 'checked' : ''}> ${o.icon} ${o.name} <span class="muted small">${o.desc}</span></label>`).join('')}
      <p class="small" style="margin-top:10px"><a href="gioi-thieu.html">🏠 Xem trang giới thiệu app</a></p>
    </div>
    <div class="card">
      <h2 style="margin-top:0">🤖 Gia sư AI (Claude)</h2>
      <label for="st-key">Anthropic API key</label>
      <input id="st-key" type="password" placeholder="sk-ant-..." value="${esc(s.apiKey)}" autocomplete="off">
      <p class="muted small">${server.ai ? '✅ Máy chủ Python đã có sẵn gia sư AI, bạn không cần nhập key.' : 'Lấy key tại console.anthropic.com.'} Key nhập ở đây chỉ được lưu trong trình duyệt trên máy này và chỉ gửi tới Anthropic.</p>
    </div>
    <button class="btn block" id="st-save">Lưu cài đặt</button>
    <div class="card" style="margin-top:16px">
      <h2 style="margin-top:0">Dữ liệu</h2>
      <div class="row"><button class="btn ghost sm" id="st-export">⬇️ Sao lưu tiến độ</button>
      <label class="btn ghost sm" style="margin:0">⬆️ Khôi phục<input type="file" id="st-import" accept=".json" hidden></label>
      <button class="btn ghost sm" id="st-retest">📝 Làm lại kiểm tra đầu vào</button>
      <button class="btn ghost sm" id="st-reset" style="color:var(--bad)">🗑️ Xóa toàn bộ</button></div>
    </div>`;

  $('#st-save').onclick = async () => {
    state.profile.name = $('#st-name').value.trim() || state.profile.name;
    state.profile.ageGroup = $('#st-age').value;
    state.profile.goal = +$('#st-goal').value;
    state.settings.speechRate = +$('#st-rate').value;
    s.apiKey = $('#st-key').value.trim();
    s.reminderTime = $('#st-time').value || '19:00';
    s.reminders = $('#st-rem').checked;
    if (s.reminders && 'Notification' in window && Notification.permission === 'default') {
      if (await Notification.requestPermission() !== 'granted') toast('Bạn chưa cho phép thông báo; nhắc nhở sẽ hiện dạng banner.');
    }
    save();
    applyAgeClass();
    toast('Đã lưu ✔');
  };
  $('#st-export').onclick = () => {
    const data = { ...state, settings: { ...state.settings, apiKey: '' } };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `engmate-${today()}.json`;
    a.click();
  };
  $('#st-import').onchange = async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!data.profile) throw new Error();
      const key = state.settings.apiKey;
      localStorage.setItem(STORE, JSON.stringify(data));
      state = load();
      state.settings.apiKey = state.settings.apiKey || key;
      save(); toast('Đã khôi phục ✔'); go('#/home');
    } catch { toast('File không hợp lệ'); }
  };
  $('#st-retest').onclick = () => go('#/placement');
  $$('input[name="st-ui"]').forEach(r => r.onchange = () => {
    try { localStorage.setItem(UI_KEY, r.value); } catch { /* bỏ qua */ }
    const page = UI_OPTIONS.find(o => o.id === r.value).page;
    if (page !== 'app.html') location.href = page;
    else toast('Đang dùng giao diện chuẩn ✔');
  });
  $('#st-reset').onclick = () => {
    if (!confirm('Xóa toàn bộ tiến độ, XP, huy hiệu và thẻ từ vựng? Không thể hoàn tác.')) return;
    localStorage.removeItem(STORE);
    state = load();
    go('#/onboard');
  };
}

function checkReminder() {
  const s = state.settings;
  if (!s.reminders || !state.profile.onboarded) return;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (hhmm < s.reminderTime || s.notifiedDay === today() || (state.xpByDay[today()] || 0) > 0) return;
  s.notifiedDay = today();
  save();
  const body = smartNudge();
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready
      .then(reg => reg.showNotification('EngMate 🦉', { body, icon: 'icon.svg', tag: 'daily' }))
      .catch(() => new Notification('EngMate 🦉', { body }));
  } else toast(body);
}

// ================= Khởi động =================
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('online', () => toast('🌐 Đã kết nối mạng'));
window.addEventListener('offline', () => toast('📴 Đang offline: bài học và ôn tập vẫn dùng được'));
if (!state.userId) { state.userId = crypto.randomUUID(); save(); }
setInterval(checkReminder, 60 * 1000);
checkReminder();
checkBadges();
router();
detectServer().then(async s => {
  if (!s.online) return;
  if (await pullProgress()) router();
  else pushProgress();
  if (location.hash.startsWith('#/chat') || location.hash.startsWith('#/settings')) router();
});
