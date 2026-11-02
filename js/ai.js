// Giọng nói (đọc/nhận dạng) và các tính năng AI dùng Claude API.
// Script thường (không phải module) để chạy được cả khi mở file trực tiếp; cần nạp sau js/prompts.js.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.65.0/+esm';
const MODEL = 'claude-opus-5-5';

// ---------- Text-to-speech ----------
// onEnd được gọi khi đọc xong (dùng cho chế độ gọi điện).
function speak(text, rate = 0.95, onEnd) {
  if (!('speechSynthesis' in window)) { onEnd?.(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const voices = speechSynthesis.getVoices();
  const voice = voices.find(v => v.lang.startsWith('en-US')) || voices.find(v => v.lang.startsWith('en'));
  if (voice) u.voice = voice;
  if (onEnd) { u.onend = () => onEnd(); u.onerror = () => onEnd(); }
  speechSynthesis.speak(u);
}

// ---------- Speech recognition ----------
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const canListen = !!Recognition;

function listen() {
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('Trình duyệt không hỗ trợ nhận dạng giọng nói (hãy dùng Chrome hoặc Edge).'));
    const r = new Recognition();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = e => resolve(e.results[0][0].transcript);
    r.onerror = e => reject(new Error(e.error === 'not-allowed' ? 'Bạn cần cho phép dùng micro.' : 'Không nghe rõ, hãy thử lại.'));
    r.onnomatch = () => reject(new Error('Không nghe rõ, hãy thử lại.'));
    r.start();
  });
}

// Vẽ sóng âm (độ lớn giọng theo thời gian) của micro lên canvas khi đang nói.
// Trả về hàm dừng; hình cuối cùng vẫn giữ trên canvas.
async function liveWave(canvas) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const an = ac.createAnalyser();
  an.fftSize = 1024;
  ac.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize), levels = [];
  const g = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  let raf;
  const draw = () => {
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    levels.push(Math.min(1, Math.sqrt(sum / buf.length) * 6));
    const W = canvas.width = canvas.clientWidth * dpr, H = canvas.height = canvas.clientHeight * dpr;
    g.fillStyle = getComputedStyle(canvas).color;
    const step = 4 * dpr, shown = levels.slice(-Math.floor(W / step));
    shown.forEach((lv, i) => { const h = Math.max(2 * dpr, lv * H); g.fillRect(i * step, (H - h) / 2, 2 * dpr, h); });
    raf = requestAnimationFrame(draw);
  };
  draw();
  return () => { cancelAnimationFrame(raf); stream.getTracks().forEach(t => t.stop()); ac.close(); };
}

const normalize = s => s.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();

// Chấm phát âm: tỉ lệ từ mục tiêu xuất hiện đúng thứ tự (LCS theo từ).
function pronunciationScore(target, said) {
  const a = normalize(target).split(' '), b = normalize(said).split(' ');
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  // Đánh dấu từ nào đã nói đúng để hiển thị.
  const hit = new Set();
  for (let i = a.length, j = b.length; i > 0 && j > 0;) {
    if (a[i - 1] === b[j - 1]) { hit.add(i - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--; else j--;
  }
  return { score: Math.round(100 * dp[a.length][b.length] / a.length), words: a.map((w, i) => ({ w, ok: hit.has(i) })) };
}

// ---------- Prompt dùng chung ----------
const loadPrompts = async () => EM_PROMPTS; // từ js/prompts.js
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

// Giữ đồng bộ với tutor_system_prompt trong server/app.py.
function tutorSystemPrompt(P, { level, ageGroup, scenario, name, words }) {
  return fill(P.tutor, {
    name: name || 'the learner',
    level,
    age_style: P.age[ageGroup] || P.age.adult,
    scenario: P.scenarios[scenario] || P.scenarios.free,
    words_line: words?.length ? fill(P.words_line, { words: words.join(', ') }) : '',
  });
}

// ---------- Máy chủ Python (nếu trang được mở từ server/app.py) ----------
const server = { online: false, ai: false };

async function detectServer() {
  if (!location.protocol.startsWith('http')) return server;
  try {
    const res = await fetch('api/health', { cache: 'no-store' });
    if (res.ok) Object.assign(server, { online: true, ...(await res.json()) });
  } catch { /* chạy tĩnh, không có máy chủ */ }
  return server;
}

async function serverChat({ ctx, history, onText }) {
  const res = await fetch('api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...ctx, history }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Máy chủ gia sư AI đang lỗi.');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i).replace(/^data: /, '');
      buf = buf.slice(i + 2);
      const ev = JSON.parse(line);
      if (ev.error) throw new Error(ev.error);
      if (ev.text) onText(ev.text);
      if (ev.done) return ev;
    }
  }
  throw new Error('Mất kết nối với máy chủ giữa chừng.');
}

// ---------- Claude (gọi trực tiếp từ trình duyệt bằng key của người dùng) ----------
let clientPromise = null;
let clientKey = null;

async function getClient(apiKey) {
  if (!apiKey) throw new Error('Chưa có API key. Vào Thành tích → Cài đặt để nhập Anthropic API key.');
  if (!navigator.onLine) throw new Error('Tính năng AI cần kết nối mạng. Các bài học khác vẫn dùng được offline.');
  if (!clientPromise || clientKey !== apiKey) {
    clientKey = apiKey;
    clientPromise = import(SDK_URL).then(({ default: Anthropic }) =>
      new Anthropic({ apiKey, dangerouslyAllowBrowser: true }));
  }
  return clientPromise;
}

// Gửi hội thoại và stream câu trả lời. `history` là mảng message của API (append-only).
// ctx = { level, ageGroup, scenario (id), name, words }. Trả về { stop_reason, content }.
async function chatStream({ apiKey, ctx, history, onText }) {
  if (server.ai && !apiKey) return serverChat({ ctx, history, onText });
  const [client, P] = await Promise.all([getClient(apiKey), loadPrompts()]);
  const base = {
    model: MODEL,
    max_tokens: 2048,
    system: tutorSystemPrompt(P, ctx),
    messages: history,
    output_config: { effort: 'low' },
  };
  let stream;
  try {
    stream = client.beta.messages.stream({ ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    stream.on('text', onText);
    return await stream.finalMessage();
  } catch (err) {
    // Tài khoản chưa có beta fallback → gửi lại không kèm fallback.
    if (err?.status === 400 && /fallback/i.test(err.message || '')) {
      stream = client.messages.stream(base);
      stream.on('text', onText);
      return await stream.finalMessage();
    }
    throw friendlyError(err);
  }
}

// Công cụ AI trả JSON theo schema: write | translate | story | quiz.
// vars = { level, input, extra, words }.
async function aiTask({ apiKey, task, ...vars }) {
  if (server.ai && !apiKey) {
    const res = await fetch('api/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, ...vars }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Máy chủ AI đang lỗi.');
    return data.result;
  }
  const [client, P] = await Promise.all([getClient(apiKey), loadPrompts()]);
  const t = P.tasks[task];
  const values = { level: vars.level, input: vars.input || '', extra: vars.extra || '', words: (vars.words || []).join(', ') };
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: t.max_tokens,
      system: t.system,
      messages: [{ role: 'user', content: fill(t.user, values) }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: t.schema } },
    });
    if (msg.stop_reason === 'refusal') throw new Error('AI không thể xử lý yêu cầu này. Hãy thử nội dung khác.');
    if (msg.stop_reason === 'max_tokens') throw new Error('Nội dung quá dài, hãy rút ngắn rồi thử lại.');
    return JSON.parse(msg.content.filter(b => b.type === 'text').map(b => b.text).join(''));
  } catch (err) {
    throw friendlyError(err);
  }
}

function friendlyError(err) {
  const status = err?.status;
  if (status === 401) return new Error('API key không hợp lệ. Kiểm tra lại trong Cài đặt.');
  if (status === 429) return new Error('Đang gửi quá nhiều yêu cầu, hãy đợi một chút rồi thử lại.');
  if (status >= 500) return new Error('Máy chủ AI đang bận, hãy thử lại sau.');
  if (err instanceof Error && !status) return err;
  return new Error(err?.message || 'Có lỗi khi kết nối gia sư AI.');
}
