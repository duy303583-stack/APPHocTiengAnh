// 🎧 Nghe & đọc: đọc to văn bản (TTS), hướng dẫn phát âm từ mới, kịch bản đọc mỗi ngày, sổ tay từ vựng.
// Chạy hoàn toàn trên máy (Web Speech API); AI chỉ dùng khi có để tra IPA và viết kịch bản mới.
// Script thường, nạp trước js/app.js; dùng các hàm chung của app.js lúc chạy.

// Từ thông dụng được coi là "đã biết" (không gạch chân là từ mới).
const BASIC_WORDS = new Set(`a about after again all also always am an and any are around as ask at away back bad be because been before
being best better big book both boy bring but buy by call came can car child children city come could day did do does dog done
door down each eat end even every eye family far father feel few find first five for four friend from fun game gave get girl give
go going good got great had hand happy has have he head hear help her here him his home hot house how i if in into is it its just
keep kind know last learn left let life like little live long look lot love made make man many may me mean men might mom money
more morning most mother much must my name need never new next nice night no not now of off often oh ok okay old on once one only
open or other our out over own people place play please put read really right room run said same saw say school see she should
show sit small so some soon start stay still stop study such sun sure take talk teacher tell than thank thanks that the their
them then there these they thing things think this those three time to today together told too took tree two under until up us
use very wait walk want was water way we week well went were what when where which while who why will with woman word words
work world would write year years yes yesterday you young your hello hi bye good-bye goodbye i'm you're it's don't can't didn't
isn't that's let's he's she's we're they're i'll i've
sit sits practice practices sentence sentences loud slow clear plan plans tomorrow diary dear turn turns sunday tonight
café cafe park library bus window proud tired excited confident end feel feels again here job thanks next
monday tuesday wednesday thursday friday saturday sunday`.split(/\s+/));

const LISTEN_NAMES = ['Minh', 'Lan', 'Tom', 'Anna', 'Huy', 'Mai', 'Ben', 'Linh', 'Sara', 'Khoa'];
const VI_CHARS = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const wordKey = w => w.toLowerCase().replace(/[’]/g, "'").replace(/^'+|'+$/g, '');

// Tách âm tiết gần đúng theo nhóm nguyên âm (đủ để đọc chậm từng phần).
function syllables(word) {
  const w = word.toLowerCase();
  const parts = w.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/g);
  if (!parts || parts.join('') !== w) return [w];
  // "-e" câm ở cuối (make, time) không thành âm tiết riêng.
  if (parts.length > 1 && /^[^aeiouy]*e$/.test(parts[parts.length - 1])) parts.splice(-2, 2, parts.at(-2) + parts.at(-1));
  return parts;
}

// Nghĩa có sẵn trong app (bài học + thẻ ôn tập), dùng được offline.
function knownMeanings() {
  const m = new Map();
  for (const v of [...LESSONS.flatMap(l => l.vocab), ...Object.values(state.srs)]) {
    const k = wordKey(v.en);
    if (!m.has(k) || (!m.get(k).vi && v.vi)) m.set(k, v);
  }
  return m;
}

const isSaved = w => Object.keys(state.srs).some(k => wordKey(k) === wordKey(w));
// Dạng gốc gần đúng: reads → read, studied → study, slowly → slow.
const stems = k => [k, k.replace(/'s$/, ''), k.replace(/s$/, ''), k.replace(/es$/, ''), k.replace(/ies$/, 'y'), k.replace(/ied$/, 'y'),
  k.replace(/ed$/, ''), k.replace(/d$/, ''), k.replace(/ing$/, ''), k.replace(/ing$/, 'e'), k.replace(/ly$/, ''), k.replace(/er$/, '')];
const isNewWord = (w, meanings) => {
  const k = wordKey(w);
  if (k.length < 3 || /\d/.test(k) || stems(k).some(x => BASIC_WORDS.has(x))) return false;
  if (/^[A-Z][a-z]/.test(w) && LISTEN_NAMES.includes(w.replace(/'s$/, ''))) return false;
  const done = meanings.get(k);
  return !(done && (isSaved(k) || LESSONS.some(l => state.completed[l.id] && l.vocab.some(v => wordKey(v.en) === k))));
};

// Biến văn bản thành các câu, mỗi từ tiếng Anh bấm được.
function readingHtml(text, meanings) {
  const sentences = text.replace(/\r/g, '').split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(Boolean);
  const html = sentences.map((s, i) => `<span class="sent" data-s="${i}">${
    s.split(/([A-Za-zÀ-ỹ'’-]+)/).map(tok => {
      if (!/^[A-Za-z'’-]+$/.test(tok) || !/[A-Za-z]/.test(tok)) return esc(tok);
      const cls = isSaved(tok) ? 'saved' : isNewWord(tok, meanings) ? 'new' : '';
      return `<span class="w ${cls}" data-w="${esc(tok)}">${esc(tok)}</span>`;
    }).join('')}</span>`).join(' ');
  return { sentences, html };
}

// ---------- Kịch bản đọc offline: ghép từ vựng các bài đã mở theo nhiều khung truyện ----------
function offlineScript() {
  const pool = [...LESSONS.filter(isUnlocked).flatMap(l => l.vocab), ...Object.values(state.srs)].filter(v => v.ex && /^[A-Z]/.test(v.ex));
  const items = shuffle(pool).filter((v, i, a) => a.findIndex(x => x.ex === v.ex) === i).slice(0, 4);
  const [a, b] = shuffle(LISTEN_NAMES);
  const words = items.map(v => v.en);
  const when = pick(['This morning', 'Today', 'After school', 'After work', 'On Sunday', 'Tonight']);
  const place = pick(['at home', 'in the park', 'at a small café', 'on the bus', 'in the library', 'by the window']);
  const feel = pick(['proud', 'happy', 'confident', 'a little tired but happy', 'excited']);
  const frames = [
    () => ({
      title: `${a}'s reading practice`,
      text: [`${when}, ${a} sits ${place} and practices English.`,
        `${a} wants to remember new words like ${words.map(w => `"${w}"`).join(', ')}.`,
        `${a} reads each sentence out loud, slowly and clearly.`,
        ...items.map(v => v.ex),
        `In the end, ${a} feels ${feel} and plans to read again tomorrow.`].join(' '),
    }),
    () => ({
      title: `A short talk: ${a} and ${b}`,
      text: [`${a}: Hi ${b}! Can we practice English together ${place}?`, `${b}: Sure! Let's take turns reading.`,
        ...items.map((v, i) => `${i % 2 ? b : a}: ${v.ex}`),
        `${a}: Great job! Your pronunciation is getting better.`, `${b}: Thanks! See you next time.`].join('\n'),
    }),
    () => ({
      title: `${a}'s diary`,
      text: [`Dear diary, ${when.toLowerCase()} was a good day.`, `I studied English ${place} for fifteen minutes.`,
        `My new words were ${words.map(w => `"${w}"`).join(', ')}.`, `Here are the sentences I read today.`,
        ...items.map(v => v.ex), `I feel ${feel}. I will keep going!`].join(' '),
    }),
  ];
  return { ...pick(frames)(), words: items.map(v => ({ en: v.en, vi: v.vi })) };
}

let pdfLib = null;
async function readPdf(file) {
  if (!navigator.onLine && !pdfLib) throw new Error('Lần đầu mở PDF cần có mạng để tải bộ đọc PDF.');
  pdfLib = pdfLib || await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS + 'pdf.min.js';
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; res(window.pdfjsLib); };
    s.onerror = () => rej(new Error('Không tải được bộ đọc PDF.'));
    document.head.append(s);
  });
  const doc = await pdfLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    pages.push(c.items.map(t => t.str).join(' '));
  }
  return pages.join('\n\n').replace(/[ \t]+/g, ' ').trim();
}

// ---------- Công cụ 🎧 Nghe & đọc (một tab trong "Học cùng AI") ----------
function listenTool(box, out, ready, level, run) {
  let mode = 'text', sentences = [], playing = 0, current = -1, rewarded = false, script = null;
  let rate = state.settings.listenRate || 0.9;
  let meanings = knownMeanings();
  state.ipa = state.ipa || {};
  const SAMPLE = 'Welcome to EngMate! Tap any word to see how to say it. Words with a dotted line are new for you. You can also paste your own text, open a PDF, or create a new reading script.';

  box.innerHTML = `<b>🎧 Nghe & đọc thông minh</b>
    <p class="muted small">Đọc to văn bản, tự đánh dấu từ mới kèm phiên âm và cách đọc chậm, tạo kịch bản đọc mới bao nhiêu lần cũng được. Đọc bằng giọng của máy, chạy cả khi offline.</p>
    <div class="utils" style="padding-bottom:4px">${[['text', '📄 Văn bản'], ['script', '🗞️ Kịch bản mỗi ngày'], ['book', '📒 Sổ tay từ']]
      .map(([id, t]) => `<button class="btn sm ${id === mode ? '' : 'ghost'}" style="flex:none" data-mode="${id}">${t}</button>`).join('')}</div>
    <div id="ls-pane"></div>`;
  const pane = $('#ls-pane', box);
  $$('[data-mode]', box).forEach(b => b.onclick = () => {
    mode = b.dataset.mode;
    $$('[data-mode]', box).forEach(x => x.classList.toggle('ghost', x !== b));
    stop(); draw();
  });

  const langOf = text => {
    const v = $('#ls-lang')?.value || 'auto';
    return v === 'auto' ? (VI_CHARS.test(text) ? 'vi-VN' : 'en-US') : v;
  };
  const controls = () => `<div class="row" style="margin-top:10px">
      <button class="btn sm" id="ls-play">▶ Đọc</button><button class="btn sm ghost" id="ls-pause" disabled>⏸ Tạm dừng</button>
      <button class="btn sm ghost" id="ls-stop" disabled>⏹ Dừng</button>
      <select id="ls-lang" style="width:auto;padding:6px 10px"><option value="auto">🌐 Tự nhận</option><option value="en-US">🇺🇸 English</option><option value="vi-VN">🇻🇳 Tiếng Việt</option></select></div>
    <label class="small" for="ls-rate">🐢 Tốc độ đọc: <b id="ls-rate-v">${rate.toFixed(2)}x</b></label>
    <input type="range" id="ls-rate" min="0.5" max="1.5" step="0.05" value="${rate}" style="padding:0;box-shadow:none">`;

  // ----- đọc từng câu, tô sáng câu đang đọc -----
  function highlight(i) {
    $$('.sent.reading', out).forEach(s => s.classList.remove('reading'));
    const s = $(`.sent[data-s="${i}"]`, out);
    if (s) { s.classList.add('reading'); s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
  function playFrom(i) {
    if (!sentences.length) return toast('Chưa có nội dung để đọc');
    const id = ++playing;
    current = i;
    setButtons(true);
    const step = () => {
      if (id !== playing) return;
      if (current >= sentences.length) {
        highlight(-1); setButtons(false); playing++;
        if (!rewarded) { rewarded = true; gainXP(5); toast('Đọc xong cả bài! +5 XP 🎧'); }
        return;
      }
      highlight(current);
      const text = sentences[current];
      speak(text, rate, () => { if (id === playing) { current++; step(); } }, langOf(text));
    };
    step();
  }
  function stop() {
    playing++;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    highlight(-1); setButtons(false);
  }
  function setButtons(on) {
    const p = $('#ls-pause'), s = $('#ls-stop'), b = $('#ls-play');
    if (!b) return;
    b.textContent = on ? '⏮ Đọc lại' : '▶ Đọc';
    p.disabled = s.disabled = !on;
    p.textContent = '⏸ Tạm dừng';
  }
  function wireControls(getText) {
    $('#ls-play').onclick = () => { stop(); render(getText()); playFrom(0); };
    $('#ls-stop').onclick = stop;
    $('#ls-pause').onclick = () => {
      if (speechSynthesis.paused) { speechSynthesis.resume(); $('#ls-pause').textContent = '⏸ Tạm dừng'; }
      else { speechSynthesis.pause(); $('#ls-pause').textContent = '▶ Tiếp tục'; }
    };
    $('#ls-rate').oninput = e => {
      rate = +e.target.value;
      $('#ls-rate-v').textContent = `${rate.toFixed(2)}x`;
      state.settings.listenRate = rate; save();
    };
  }

  // ----- hiển thị văn bản đọc -----
  function render(text, extra = '') {
    if (!text.trim()) { out.innerHTML = ''; sentences = []; return; }
    meanings = knownMeanings();
    const r = readingHtml(text, meanings);
    sentences = r.sentences;
    rewarded = false;
    const nNew = new Set($$('.w.new', Object.assign(document.createElement('div'), { innerHTML: r.html })).map(w => wordKey(w.dataset.w))).size;
    out.innerHTML = `<div class="card">
        <div class="spread small"><span class="muted">${sentences.length} câu · <span class="w new" style="cursor:default">từ mới</span> ${nNew} · <span class="w saved" style="cursor:default">đã lưu</span></span>
          <span class="muted">Bấm vào câu để đọc từ đó</span></div>
        <div class="read-text" id="ls-read">${r.html}</div>
        <div class="selbar" id="ls-sel" hidden><span id="ls-sel-w"></span><input id="ls-sel-vi" placeholder="Nghĩa tiếng Việt (tùy chọn)"><button class="btn sm" id="ls-sel-save">➕ Lưu từ</button></div>
      </div>${extra}<div id="ls-word"></div>`;
    const read = $('#ls-read');
    read.onclick = e => {
      if (getSelection().toString().trim()) return; // đang bôi đen để lưu
      const w = e.target.closest('.w');
      if (w) return wordCard(w.dataset.w, w.closest('.sent').textContent);
      const s = e.target.closest('.sent');
      if (s) { stop(); playFrom(+s.dataset.s); }
    };
    // Bôi đen một từ/cụm từ → hiện thanh "Lưu từ".
    const onSelect = () => setTimeout(() => {
      const sel = getSelection(), t = sel.toString().trim().replace(/\s+/g, ' ');
      const bar = $('#ls-sel');
      if (!bar) return;
      if (!t || t.split(' ').length > 6 || !read.contains(sel.anchorNode) || !/[A-Za-z]/.test(t)) { bar.hidden = true; return; }
      bar.hidden = false;
      bar.dataset.w = t;
      bar.dataset.ex = sel.anchorNode.parentElement?.closest('.sent')?.textContent || '';
      $('#ls-sel-w').textContent = `“${t}”`;
      $('#ls-sel-vi').value = meanings.get(wordKey(t))?.vi || '';
    });
    read.onmouseup = read.ontouchend = onSelect;
    $('#ls-sel-save').onclick = () => {
      const bar = $('#ls-sel');
      saveWord(bar.dataset.w, $('#ls-sel-vi').value.trim(), bar.dataset.ex);
      bar.hidden = true; getSelection().removeAllRanges();
    };
  }

  function saveWord(en, vi, ex) {
    if (isSaved(en)) return toast('Từ này đã có trong sổ tay');
    addCards([{ en, vi: vi || meanings.get(wordKey(en))?.vi || '(chưa có nghĩa)', ex: ex || '', ipa: state.ipa[wordKey(en)] || '', added: Date.now() }]);
    save();
    $$('.w[data-w]', out).filter(w => wordKey(w.dataset.w) === wordKey(en)).forEach(w => { w.classList.remove('new'); w.classList.add('saved'); });
    toast(`Đã lưu “${en}” vào sổ tay & thẻ ôn tập 🧠`);
  }

  // ----- thẻ hướng dẫn phát âm của một từ -----
  function wordCard(word, sentence) {
    const k = wordKey(word), m = meanings.get(k), ipa = state.ipa[k];
    const syl = syllables(k);
    const el = $('#ls-word');
    el.innerHTML = `<div class="card word-card">
      <div class="spread"><div><span style="font-size:1.6rem;font-weight:800">${esc(k)}</span>
        ${isNewWord(k, meanings) ? '<span class="tag" style="background:var(--accent-soft);color:var(--accent)">Từ mới</span>' : ''}</div>
        <button class="icon-btn" id="lw-close" title="Đóng">✕</button></div>
      <p style="margin:4px 0"><b>Phiên âm:</b> <span id="lw-ipa">${ipa ? esc(ipa) : `<span class="muted small">${ready ? 'bấm 🤖 để tra IPA' : 'cần AI để tra IPA'}</span>`}</span></p>
      <p style="margin:4px 0"><b>Nghĩa:</b> <span id="lw-vi">${m?.vi ? esc(m.vi) : '<span class="muted small">chưa có trong từ vựng của app</span>'}</span></p>
      <p style="margin:4px 0"><b>Đánh vần:</b> ${esc(k.toUpperCase().split('').join(' - '))}</p>
      <p style="margin:4px 0"><b>Âm tiết (gần đúng):</b> ${syl.map(esc).join(' · ')}</p>
      <div id="lw-tip"></div>
      <div class="row" style="margin-top:8px">
        <button class="btn sm" id="lw-say">🔊 Nghe</button><button class="btn sm ghost" id="lw-slow">🐢 Đọc chậm</button>
        ${syl.length > 1 ? '<button class="btn sm ghost" id="lw-syl">🧩 Từng âm tiết</button>' : ''}
        <button class="btn sm ghost" id="lw-spell">🔤 Đánh vần</button>
        <button class="btn sm ghost" id="lw-ai" ${ready ? '' : 'disabled'}>🤖 Tra IPA & nghĩa</button></div>
      <canvas class="wave" id="lw-wave" hidden aria-label="Sóng âm giọng của bạn"></canvas>
      <div class="row" style="margin-top:8px">
        <button class="btn sm ghost" id="lw-mic" ${canListen ? '' : 'disabled title="Trình duyệt không hỗ trợ micro, hãy dùng Chrome/Edge"'}>🎤 Đọc theo</button>
        <button class="btn sm ghost" id="lw-save" ${isSaved(k) ? 'disabled' : ''}>${isSaved(k) ? '✔ Đã lưu' : '➕ Lưu vào sổ tay'}</button></div>
      <div id="lw-res"></div></div>`;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    $('#lw-close').onclick = () => { el.innerHTML = ''; };
    $('#lw-say').onclick = () => speak(k, rate);
    $('#lw-slow').onclick = () => speak(k, 0.5);
    $('#lw-spell').onclick = () => speak(k.toUpperCase().split('').join(', '), 0.7);
    if ($('#lw-syl')) $('#lw-syl').onclick = () => {
      let i = 0;
      const next = () => { if (i < syl.length) speak(syl[i++], 0.55, () => setTimeout(next, 250)); else setTimeout(() => speak(k, 0.6), 300); };
      next();
    };
    $('#lw-save').onclick = () => { saveWord(k, m?.vi, sentence); $('#lw-save').disabled = true; $('#lw-save').textContent = '✔ Đã lưu'; };
    $('#lw-ai').onclick = async () => {
      const b = $('#lw-ai');
      b.disabled = true; b.textContent = '⏳ Đang tra...';
      try {
        const r = await aiTask({ apiKey: state.settings.apiKey, task: 'dict', level, input: k });
        state.ipa[k] = r.ipa;
        if (state.srs[k] && !state.srs[k].ipa) state.srs[k].ipa = r.ipa;
        save();
        $('#lw-ipa').textContent = r.ipa;
        $('#lw-vi').textContent = r.meanings.map(x => x.vi).join('; ');
        meanings.set(k, { en: k, vi: r.meanings[0]?.vi || '' });
        if (r.pronunciation_tip_vi) $('#lw-tip').innerHTML = `<div class="banner" style="margin:8px 0 0">🗣️ ${esc(r.pronunciation_tip_vi)}</div>`;
        b.textContent = '✔ Đã tra';
      } catch (e) { toast(e.message); b.disabled = false; b.textContent = '🤖 Tra IPA & nghĩa'; }
    };
    $('#lw-mic').onclick = async () => {
      const b = $('#lw-mic'), wave = $('#lw-wave');
      wave.hidden = false; b.textContent = '👂 Đang nghe...';
      try {
        const said = await listenWithWave(wave);
        const { score } = pronunciationScore(k, said);
        state.pronounce[k] = Math.max(state.pronounce[k] || 0, score);
        if (score >= 90) questProgress('pron', 1);
        gainXP(score >= 80 ? 3 : 1);
        $('#lw-res').innerHTML = `<div class="feedback ${score >= 80 ? 'ok' : 'bad'}">Điểm ${score}% · máy nghe được: "${esc(said)}"
          <div class="small" style="font-weight:600">${score >= 80 ? 'Chuẩn rồi! 🎉' : 'Nghe 🐢 đọc chậm hoặc 🧩 từng âm tiết rồi thử lại nhé.'}</div></div>`;
      } catch (e) { toast(e.message); }
      b.textContent = '🎤 Đọc lại';
    };
  }

  // ----- các phần -----
  function draw() {
    out.innerHTML = '';
    if (mode === 'text') {
      pane.innerHTML = `<textarea id="ls-text" style="margin-top:8px;min-height:110px" placeholder="Dán tin nhắn, bài báo, đoạn văn... (tiếng Anh hoặc tiếng Việt)">${esc(SAMPLE)}</textarea>
        <div class="row" style="margin-top:8px"><label class="btn sm ghost" style="margin:0;font-weight:800;cursor:pointer">📂 Mở file .txt / .pdf
          <input type="file" id="ls-file" accept=".txt,.pdf,text/plain,application/pdf" hidden></label>
          <button class="btn sm ghost" id="ls-show">👁 Đánh dấu từ mới</button></div>
        ${controls()}`;
      const getText = () => $('#ls-text').value;
      wireControls(getText);
      $('#ls-show').onclick = () => render(getText());
      $('#ls-file').onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          $('#ls-text').value = '⏳ Đang mở file...';
          $('#ls-text').value = /\.pdf$/i.test(f.name) || f.type === 'application/pdf' ? await readPdf(f) : await f.text();
          if (!$('#ls-text').value.trim()) toast('File không có chữ (có thể là PDF dạng ảnh scan).');
          render(getText());
        } catch (err) { $('#ls-text').value = ''; toast(err.message); }
      };
      render(getText());
    } else if (mode === 'script') {
      const n = state.scripts?.date === today() ? state.scripts.count : 0;
      pane.innerHTML = `<div class="row" style="margin-top:8px">
          <button class="btn sm" id="ls-new">🎲 Tạo kịch bản mới</button>
          <button class="btn sm ghost" id="ls-ai" ${ready ? '' : 'disabled'}>🤖 Kịch bản AI</button></div>
        <input id="ls-topic" style="margin-top:8px" placeholder="Chủ đề cho kịch bản AI (không bắt buộc), ví dụ: đi siêu thị" ${ready ? '' : 'hidden'}>
        <p class="muted small" id="ls-count">Hôm nay bạn đã tạo ${n} kịch bản. Bấm bao nhiêu lần cũng được, mỗi lần một nội dung mới.</p>
        ${ready ? '' : '<p class="muted small">🎲 Kịch bản offline ghép từ vựng các bài bạn đã mở. Nhập API key trong <a href="#/settings">Cài đặt</a> để AI viết kịch bản hoàn toàn mới.</p>'}
        ${controls()}`;
      const countUp = () => {
        state.scripts = state.scripts?.date === today() ? { date: today(), count: state.scripts.count + 1 } : { date: today(), count: 1 };
        save();
        $('#ls-count').textContent = `Hôm nay bạn đã tạo ${state.scripts.count} kịch bản. Bấm bao nhiêu lần cũng được, mỗi lần một nội dung mới.`;
      };
      const show = s => {
        script = s;
        for (const w of s.words || []) if (w.ipa) state.ipa[wordKey(w.en)] = w.ipa;
        render(`${s.title}.\n${s.text}`, `
          ${s.translation_vi ? `<details class="card"><summary><b>🇻🇳 Bản dịch</b></summary><p style="white-space:pre-wrap">${esc(s.translation_vi)}</p></details>` : ''}
          ${s.words?.length ? `<div class="card"><b>📌 Từ cần chú ý</b>${s.words.map(w => `<div class="vocab"><div><b>${esc(w.en)}</b>
            ${w.ipa ? `<span class="muted small">${esc(w.ipa)}</span>` : ''} — ${esc(w.vi)}${w.tip_vi ? `<div class="muted small">🗣️ ${esc(w.tip_vi)}</div>` : ''}</div>
            <div class="row" style="flex-wrap:nowrap"><button class="icon-btn" data-say="${esc(w.en)}">🔊</button><button class="icon-btn" data-slow="${esc(w.en)}" title="Đọc chậm">🐢</button></div></div>`).join('')}</div>` : ''}`);
        $$('[data-slow]', out).forEach(b => b.onclick = e => { e.stopPropagation(); speak(b.dataset.slow, 0.5); });
        for (const w of s.words || []) if (!meanings.has(wordKey(w.en))) meanings.set(wordKey(w.en), w);
        countUp();
      };
      wireControls(() => script ? `${script.title}.\n${script.text}` : '');
      $('#ls-new').onclick = () => {
        let s, tries = 0;
        do { s = offlineScript(); } while (script && s.text === script.text && ++tries < 5);
        if (!s.words.length) return toast('Hãy hoàn thành một bài học để có từ vựng cho kịch bản');
        show(s);
      };
      $('#ls-ai').onclick = () => run($('#ls-ai'), {
        task: 'script', input: $('#ls-topic').value.trim(),
        words: shuffle(Object.keys(state.srs)).slice(0, 4), extra: `${today()}-${Math.random().toString(36).slice(2, 8)}`,
      }, show);
      $('#ls-new').click();
    } else {
      const cards = Object.values(state.srs).sort((a, b) => (b.added || 0) - (a.added || 0));
      pane.innerHTML = `<p class="muted small" style="margin-top:8px">${cards.length} từ trong sổ tay. Mọi từ đều nằm trong bộ thẻ <a href="#/review">ôn tập ngắt quãng</a>.</p>`;
      out.innerHTML = cards.length ? `<div class="card">${cards.slice(0, 60).map(c => `<div class="vocab"><div><b>${esc(c.en)}</b>
          ${(c.ipa || state.ipa[wordKey(c.en)]) ? `<span class="muted small">${esc(c.ipa || state.ipa[wordKey(c.en)])}</span>` : ''} — ${esc(c.vi)}
          ${c.ex ? `<div class="muted small"><i>${esc(c.ex)}</i></div>` : ''}</div>
          <div class="row" style="flex-wrap:nowrap"><button class="icon-btn" data-say="${esc(c.en)}">🔊</button><button class="icon-btn" data-slow="${esc(c.en)}" title="Đọc chậm">🐢</button></div></div>`).join('')}</div>`
        : '<div class="card muted">Chưa có từ nào. Ở tab 📄 Văn bản, bấm vào một từ hoặc bôi đen rồi bấm "Lưu từ".</div>';
      $$('[data-slow]', out).forEach(b => b.onclick = e => { e.stopPropagation(); speak(b.dataset.slow, 0.5); });
    }
  }
  draw();
  // Rời màn hình thì dừng đọc.
  window.addEventListener('hashchange', stop, { once: true });
}
