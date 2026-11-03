// 🗣️ Phiên dịch giọng nói: trò chuyện trực tiếp với người nước ngoài.
// Bạn nói tiếng Việt → app dịch và đọc to bằng tiếng của họ; họ nói → app dịch sang tiếng Việt và đọc cho bạn.
// Nghe/đọc dùng Web Speech API của trình duyệt; dịch câu tự do cần AI, câu mẫu tiếng Anh dùng được offline.
// Script thường, nạp trước js/app.js.

const INTERP_LANGS = [
  { id: 'en', flag: '🇺🇸', name: 'English', vi: 'tiếng Anh', code: 'en-US', ai: 'English' },
  { id: 'zh', flag: '🇨🇳', name: '中文', vi: 'tiếng Trung', code: 'zh-CN', ai: 'Simplified Chinese' },
  { id: 'ja', flag: '🇯🇵', name: '日本語', vi: 'tiếng Nhật', code: 'ja-JP', ai: 'Japanese' },
  { id: 'ko', flag: '🇰🇷', name: '한국어', vi: 'tiếng Hàn', code: 'ko-KR', ai: 'Korean' },
  { id: 'fr', flag: '🇫🇷', name: 'Français', vi: 'tiếng Pháp', code: 'fr-FR', ai: 'French' },
  { id: 'de', flag: '🇩🇪', name: 'Deutsch', vi: 'tiếng Đức', code: 'de-DE', ai: 'German' },
  { id: 'es', flag: '🇪🇸', name: 'Español', vi: 'tiếng Tây Ban Nha', code: 'es-ES', ai: 'Spanish' },
  { id: 'th', flag: '🇹🇭', name: 'ไทย', vi: 'tiếng Thái', code: 'th-TH', ai: 'Thai' },
];
const INTERP_DOMAINS = [
  ['daily', '💬 Đời thường', 'everyday conversation'], ['travel', '✈️ Du lịch', 'travel, hotels, restaurants, directions'],
  ['business', '💼 Công việc', 'business and office work'], ['it', '💻 IT', 'software and information technology'],
  ['medical', '🏥 Y tế', 'medical and health care'],
];
const VI = { flag: '🇻🇳', name: 'Tiếng Việt', code: 'vi-VN', ai: 'Vietnamese' };

// Câu mẫu dùng được khi không có AI/mạng (Việt → Anh).
const PHRASEBOOK = [
  ['👋 Chào hỏi', [['Xin chào, rất vui được gặp bạn.', 'Hello, nice to meet you.'], ['Bạn đến từ đâu?', 'Where are you from?'],
    ['Tôi đến từ Việt Nam.', 'I am from Vietnam.'], ['Bạn có thể nói chậm hơn không?', 'Could you speak more slowly, please?'],
    ['Xin lỗi, bạn nói lại được không?', 'Sorry, could you say that again?'], ['Cảm ơn bạn rất nhiều!', 'Thank you very much!']]],
  ['🧭 Hỏi đường', [['Nhà vệ sinh ở đâu?', 'Where is the restroom?'], ['Làm sao để đến ga tàu?', 'How do I get to the train station?'],
    ['Chỗ này có xa không?', 'Is it far from here?'], ['Bạn chỉ trên bản đồ giúp tôi được không?', 'Can you show me on the map?']]],
  ['🍜 Ăn uống', [['Cho tôi xem thực đơn.', 'Can I see the menu, please?'], ['Tôi không ăn được cay.', "I can't eat spicy food."],
    ['Cho tôi xin hóa đơn.', 'Can I have the bill, please?'], ['Món này rất ngon!', 'This is delicious!']]],
  ['🛍️ Mua sắm', [['Cái này bao nhiêu tiền?', 'How much is this?'], ['Có giảm giá không?', 'Is there a discount?'],
    ['Tôi trả bằng thẻ được không?', 'Can I pay by card?'], ['Tôi chỉ xem thôi, cảm ơn.', "I'm just looking, thank you."]]],
  ['💼 Công việc', [['Rất vui được làm việc với bạn.', 'It is a pleasure to work with you.'], ['Chúng ta có thể họp vào ngày mai không?', 'Can we have a meeting tomorrow?'],
    ['Tôi sẽ gửi email cho bạn.', 'I will send you an email.'], ['Bạn có thể giải thích thêm không?', 'Could you explain that a little more?']]],
  ['🚑 Khẩn cấp', [['Làm ơn giúp tôi!', 'Please help me!'], ['Hãy gọi xe cấp cứu.', 'Please call an ambulance.'],
    ['Tôi bị lạc.', 'I am lost.'], ['Tôi bị mất hộ chiếu.', 'I lost my passport.']]],
];

function interpretTool(box, out, ready) {
  const st = state.interp = { lang: 'en', domain: 'daily', rate: 0.95, ...state.interp };
  let turns = []; // hội thoại chỉ giữ trong bộ nhớ, không lưu lại
  let auto = false, busy = false;
  const L = () => INTERP_LANGS.find(l => l.id === st.lang) || INTERP_LANGS[0];
  const side = who => who === 'me' ? { from: VI, to: L() } : { from: L(), to: VI };

  box.innerHTML = `<b>🗣️ Phiên dịch giọng nói</b>
    <p class="muted small">Đặt điện thoại giữa hai người. Bạn bấm <b>🇻🇳 Tôi nói</b> và nói tiếng Việt, app dịch rồi đọc to cho người nước ngoài nghe.
      Họ bấm nút của họ và nói, app dịch sang tiếng Việt và đọc cho bạn.</p>
    <div class="row">
      <select id="ip-lang" style="flex:1;min-width:140px" aria-label="Ngôn ngữ của người nước ngoài">${INTERP_LANGS.map(l => `<option value="${l.id}" ${l.id === st.lang ? 'selected' : ''}>${l.flag} ${l.name} (${l.vi})</option>`).join('')}</select>
      <select id="ip-domain" style="flex:1;min-width:130px" aria-label="Lĩnh vực">${INTERP_DOMAINS.map(([id, t]) => `<option value="${id}" ${id === st.domain ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    ${ready ? '' : `<div class="banner" style="margin-top:10px">🔑 Dịch câu nói tự do cần AI: nhập API key trong <a href="#/settings">Cài đặt</a>. Không có AI bạn vẫn dùng được <b>câu mẫu tiếng Anh</b> bên dưới (chạy offline).</div>`}
    ${canListen ? '' : '<div class="banner" style="margin-top:10px">🎤 Trình duyệt này không nghe được giọng nói. Hãy dùng Chrome hoặc Edge, hoặc gõ chữ ở ô bên dưới.</div>'}
    <div class="ip-mics">
      <button class="btn ip-mic" id="ip-me" ${canListen && ready ? '' : 'disabled'}>🎤<span>🇻🇳 Tôi nói</span><small>Tiếng Việt</small></button>
      <button class="btn ip-mic ip-them" id="ip-them" ${canListen && ready ? '' : 'disabled'}>🎤<span id="ip-them-l">${L().flag} ${L().name}</span><small>Tap &amp; speak</small></button></div>
    <div class="row" style="margin-top:8px">
      <button class="btn sm ghost" id="ip-auto" ${canListen && ready ? '' : 'disabled'}>📞 Hội thoại tự động</button>
      <button class="btn sm ghost" id="ip-big" disabled>🔍 Hiện to câu dịch</button>
      <button class="btn sm ghost" id="ip-clear">🗑️ Xóa</button></div>
    <label class="small" for="ip-rate">🐢 Tốc độ đọc: <b id="ip-rate-v">${st.rate.toFixed(2)}x</b></label>
    <input type="range" id="ip-rate" min="0.6" max="1.3" step="0.05" value="${st.rate}" style="padding:0;box-shadow:none">
    <div class="composer" style="position:static;padding:8px 0 0;background:none">
      <button class="btn round ghost" id="ip-dir" title="Đổi người nói">🇻🇳</button>
      <input id="ip-text" placeholder="Hoặc gõ câu cần dịch..." autocomplete="off">
      <button class="btn round" id="ip-send" ${ready ? '' : 'disabled'} aria-label="Dịch">➤</button></div>`;
  out.innerHTML = `<div class="card"><div class="chat" id="ip-log" style="min-height:120px"><p class="muted small" id="ip-empty" style="text-align:center">Cuộc trò chuyện sẽ hiện ở đây.</p></div></div>
    <div class="card" id="ip-phrases"></div>`;
  let typeAs = 'me';

  const save2 = () => save();
  const phrases = () => {
    const el = $('#ip-phrases');
    if (st.lang !== 'en') { el.innerHTML = `<b>📚 Câu mẫu</b><p class="muted small">Câu mẫu offline hiện có cho tiếng Anh. Với ${esc(L().vi)}, hãy dùng nút micro (cần AI).</p>`; return; }
    el.innerHTML = `<b>📚 Câu mẫu (offline, Việt → Anh)</b><p class="muted small">Bấm một câu để app đọc to bằng tiếng Anh cho người đối diện.</p>
      ${PHRASEBOOK.map(([cat, list], ci) => `<details ${ci ? '' : 'open'}><summary class="small" style="font-weight:800;cursor:pointer;margin:8px 0">${cat}</summary>
        ${list.map(([vi, en], i) => `<button class="option" data-ph="${ci}-${i}" style="margin:6px 0"><b>${esc(vi)}</b><div class="muted small">${esc(en)}</div></button>`).join('')}</details>`).join('')}`;
    $$('[data-ph]', el).forEach(b => b.onclick = () => {
      const [ci, i] = b.dataset.ph.split('-').map(Number), [vi, en] = PHRASEBOOK[ci][1][i];
      addTurn('me', vi, { translation: en, pronunciation: '', note_vi: '' });
    });
  };

  function addTurn(who, text, r) {
    const { to } = side(who);
    turns.push({ who, text, tr: r.translation });
    $('#ip-empty')?.remove();
    const log = $('#ip-log');
    const canSave = (who === 'me' && to.code.startsWith('en')) || (who === 'them' && st.lang === 'en');
    const en = who === 'me' ? r.translation : text, vi = who === 'me' ? text : r.translation;
    log.insertAdjacentHTML('beforeend', `<div class="bubble ip-bubble ${who === 'me' ? 'me' : 'ai'}">
      <div class="small" style="opacity:.8">${who === 'me' ? '🇻🇳 Bạn' : `${L().flag} Người đối diện`}: ${esc(text)}</div>
      <div style="font-size:1.12rem;font-weight:800;margin-top:4px" lang="${to.code}">${to.flag} ${esc(r.translation)}</div>
      ${r.pronunciation ? `<div class="small" style="opacity:.85">🗣️ ${esc(r.pronunciation)}</div>` : ''}
      ${r.note_vi ? `<div class="small" style="opacity:.85;margin-top:4px">💡 ${esc(r.note_vi)}</div>` : ''}
      <div class="tools row" style="gap:6px">
        <button class="btn sm ${who === 'me' ? 'white' : 'ghost'}" data-replay="${turns.length - 1}">🔊 Nghe lại</button>
        ${canSave ? `<button class="btn sm ${who === 'me' ? 'white' : 'ghost'}" data-keep="${turns.length - 1}">➕ Lưu câu</button>` : ''}</div></div>`);
    const b = log.lastElementChild;
    b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    $('[data-replay]', b).onclick = () => speak(r.translation, st.rate, null, to.code);
    const keep = $('[data-keep]', b);
    if (keep) keep.onclick = () => { addCards([{ en, vi, ex: en, added: Date.now() }]); save2(); keep.disabled = true; keep.textContent = '✔ Đã lưu'; toast('Đã lưu câu vào thẻ ôn tập 🧠'); };
    $('#ip-big').disabled = false;
    gainXP(2, false);
    return new Promise(res => speak(r.translation, st.rate, res, to.code));
  }

  async function translate(who, text) {
    const { from, to } = side(who);
    const domain = INTERP_DOMAINS.find(d => d[0] === st.domain)[2];
    const ctx = turns.slice(-6).map(t => `${t.who === 'me' ? 'Vietnamese speaker' : 'Foreign speaker'}: ${t.text}`).join('\n').slice(-700);
    const r = await aiTask({ apiKey: state.settings.apiKey, task: 'interpret', level: state.profile.level, input: text,
      extra: `${from.ai} → ${to.ai}. Domain: ${domain}.\n${ctx}` });
    await addTurn(who, text, r);
  }

  async function speakTurn(who) {
    if (busy) return;
    busy = true;
    const btn = who === 'me' ? $('#ip-me') : $('#ip-them');
    const label = btn.innerHTML;
    btn.classList.add('listening');
    btn.innerHTML = `👂<span>${who === 'me' ? 'Đang nghe bạn...' : 'Listening...'}</span><small>${who === 'me' ? 'Hãy nói tiếng Việt' : 'Please speak now'}</small>`;
    let ok = false;
    try {
      const said = await listen(side(who).from.code);
      btn.innerHTML = '⏳<span>Đang dịch...</span><small>&nbsp;</small>';
      await translate(who, said);
      ok = true;
    } catch (e) { toast(e.message); }
    btn.classList.remove('listening');
    btn.innerHTML = label;
    busy = false;
    // Hội thoại tự động: dịch xong thì nghe người còn lại.
    if (auto && ok) setTimeout(() => auto && speakTurn(who === 'me' ? 'them' : 'me'), 400);
    else if (auto) setAuto(false);
  }

  function setAuto(on) {
    auto = on;
    $('#ip-auto').textContent = on ? '⏹ Dừng hội thoại' : '📞 Hội thoại tự động';
    $('#ip-auto').classList.toggle('ghost', !on);
  }

  $('#ip-lang').onchange = e => {
    st.lang = e.target.value; save2();
    $('#ip-them-l').textContent = `${L().flag} ${L().name}`;
    phrases();
  };
  $('#ip-domain').onchange = e => { st.domain = e.target.value; save2(); };
  $('#ip-rate').oninput = e => { st.rate = +e.target.value; $('#ip-rate-v').textContent = `${st.rate.toFixed(2)}x`; save2(); };
  $('#ip-me').onclick = () => speakTurn('me');
  $('#ip-them').onclick = () => speakTurn('them');
  $('#ip-auto').onclick = () => { setAuto(!auto); if (auto) speakTurn('me'); };
  $('#ip-clear').onclick = () => { turns = []; $('#ip-log').innerHTML = '<p class="muted small" id="ip-empty" style="text-align:center">Cuộc trò chuyện sẽ hiện ở đây.</p>'; $('#ip-big').disabled = true; };
  $('#ip-dir').onclick = () => {
    typeAs = typeAs === 'me' ? 'them' : 'me';
    $('#ip-dir').textContent = typeAs === 'me' ? '🇻🇳' : L().flag;
    $('#ip-text').placeholder = typeAs === 'me' ? 'Hoặc gõ câu tiếng Việt cần dịch...' : `Type in ${L().name}...`;
  };
  const sendText = async () => {
    const text = $('#ip-text').value.trim();
    if (!text || busy) return;
    busy = true; $('#ip-send').disabled = true;
    try { await translate(typeAs, text); $('#ip-text').value = ''; } catch (e) { toast(e.message); }
    busy = false; $('#ip-send').disabled = !ready;
  };
  $('#ip-send').onclick = sendText;
  $('#ip-text').onkeydown = e => { if (e.key === 'Enter' && ready) sendText(); };

  // Hiện câu dịch thật to để đưa màn hình cho người đối diện đọc.
  $('#ip-big').onclick = () => {
    const t = turns.at(-1);
    if (!t) return;
    const lang = t.who === 'me' ? L() : VI;
    const ov = document.createElement('div');
    ov.className = 'ip-overlay';
    ov.innerHTML = `<div class="ip-big-text" lang="${lang.code}">${esc(t.tr)}</div>
      <div class="row" style="justify-content:center"><button class="btn white sm" data-act="rot">🔄 Xoay cho người đối diện</button>
      <button class="btn white sm" data-act="say">🔊 Đọc</button><button class="btn white sm" data-act="close">✕ Đóng</button></div>`;
    ov.onclick = e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'rot') $('.ip-big-text', ov).classList.toggle('flip');
      else if (act === 'say') speak(t.tr, st.rate, null, lang.code);
      else if (act === 'close' || e.target === ov) ov.remove();
    };
    document.body.append(ov);
  };

  phrases();
  window.addEventListener('hashchange', () => { auto = false; $('.ip-overlay')?.remove(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }, { once: true });
}
