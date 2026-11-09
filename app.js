// 수호의 낱말 공사장 — 화면 4개: 홈 → 낱말 고르기 → 퍼즐 → 뜻
const app = document.getElementById('app');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const UI = {
  ko: { stages: ['중장비', '두 글자', '세 글자', '받침'], list: '목록', next: '다음 ▶' },
  en: { stages: ['Machines', 'Short', 'Blends', 'Big words'], list: 'List', next: 'Next ▶' },
};
let DATA, lang = 'ko', stage = 1, scene = 0, greeted = false;

// ---- 낱말·파일 이름 (tools/make_audio.py와 같은 규칙) ----
export const slug = (l, t) => l === 'ko'
  ? [...t].map(c => c.codePointAt(0).toString(16)).join('-')
  : t.toLowerCase().replaceAll(' ', '_');
export const pieces = (l, w) => l === 'ko'
  ? [...w].filter(c => !' -'.includes(c))
  : [...w.toLowerCase()].filter(c => c >= 'a' && c <= 'z');
const pieceFile = (l, p) => l === 'ko' ? `ko/${slug('ko', p)}.wav` : `en/letter-${p}.wav`;

// ---- 소리: 녹음 파일, 없으면 기기 음성 ----
const player = new Audio();
let finishCurrent = null;
function stopAudio() {
  player.pause();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  finishCurrent?.(false);
}
function speak(text, l, finish) {
  if (!('speechSynthesis' in window)) return finish(true);
  const u = new SpeechSynthesisUtterance(text);
  u.lang = l === 'ko' ? 'ko-KR' : 'en-US';
  u.rate = 0.9;
  u.onend = u.onerror = () => finish(true);
  speechSynthesis.speak(u);
}
function play(path, text, l = lang) {
  stopAudio();
  return new Promise(resolve => {
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      finishCurrent = null;
      player.onended = player.onerror = null;
      resolve(ok);
    };
    finishCurrent = finish;
    player.onended = () => finish(true);
    player.onerror = () => { player.onerror = null; speak(text, l, finish); };
    player.src = `audio/${path}`;
    player.play().catch(e => { if (e.name === 'NotAllowedError') speak(text, l, finish); });
  });
}
const sayWord = w => play(`${lang}/${slug(lang, w)}.wav`, w);
const sayPiece = p => play(pieceFile(lang, p), p);
const sayPhrase = k => play(`${lang}/p-${k}.wav`, DATA.phrases[lang][k]);

// ---- 진도 ----
const doneKey = () => `suho-done-${lang}`;
function doneSet() {
  try { return new Set(JSON.parse(localStorage.getItem(doneKey()) || '[]')); } catch { return new Set(); }
}
function markDone(word) {
  const s = doneSet();
  s.add(word);
  try { localStorage.setItem(doneKey(), JSON.stringify([...s])); } catch { /* 저장 못 해도 계속 */ }
}

const pic = (row, cls) => row[3]
  ? `<img class="pic ${cls}" src="img/${row[3]}" alt="">`
  : `<span class="pic emoji ${cls}" aria-hidden="true">${row[2]}</span>`;
const esc = s => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const newScene = () => { stopAudio(); return ++scene; };

// ---- S01 홈 ----
function home() {
  newScene();
  app.innerHTML = `<section class="screen home">
    <h1>수호의 낱말 공사장</h1>
    <img class="hero bob" src="img/excavator.jpg" alt="포크레인 제이커">
    <div class="row">
      <button class="clay big" data-lang="ko">한글</button>
      <button class="clay big alt" data-lang="en">English</button>
    </div></section>`;
  app.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => {
    lang = b.dataset.lang;
    document.documentElement.lang = lang;
    stage = 1;
    pick();
    sayPhrase(greeted ? 'pick' : 'hello');
    greeted = true;
  });
}

// ---- S02 낱말 고르기 ----
function pick() {
  newScene();
  const done = doneSet();
  const rows = DATA[lang].map((r, i) => [r, i]).filter(([r]) => r[0] === stage);
  app.innerHTML = `<section class="screen">
    <div class="bar">
      <button class="clay icon home-btn" aria-label="처음으로">🏠</button>
      <div class="tabs" role="group">${UI[lang].stages.map((t, k) =>
        `<button class="clay tab" data-stage="${k + 1}" aria-pressed="${k + 1 === stage}">${k + 1}. ${t}</button>`).join('')}
      </div>
    </div>
    <div class="grid">${rows.map(([r, i]) => `
      <button class="clay card" data-i="${i}" aria-label="${esc(r[1])}">
        ${pic(r, '')}<span class="label">${esc(r[1])}</span>
        ${done.has(r[1]) ? '<span class="done-mark" aria-label="완성">✓</span>' : ''}
      </button>`).join('')}
    </div></section>`;
  app.querySelector('.home-btn').onclick = home;
  app.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { stage = +b.dataset.stage; pick(); });
  app.querySelectorAll('[data-i]').forEach(b => b.onclick = () => puzzle(+b.dataset.i));
}

// ---- S03 퍼즐 ----
function puzzle(i) {
  const my = newScene();
  const row = DATA[lang][i], word = row[1];
  const ps = pieces(lang, word);
  const shown = lang === 'ko' ? [...word] : [...word.toLowerCase()];
  const units = ps.length + shown.filter(c => c === ' ' || c === '-').length * 0.4;
  const s = Math.round(Math.max(56, Math.min(120, (Math.min(innerWidth, 1100) - 40) / units - 10)));
  app.innerHTML = `<section class="screen puzzle" style="--s:${s}px">
    <div class="bar"><button class="clay icon back" aria-label="${UI[lang].list}">◀</button>
      <button class="clay icon again" aria-label="다시 듣기">🔊</button></div>
    <div class="target">${pic(row, 'pz-pic')}
      <div class="slots">${shown.map(c => c === ' ' ? '<span class="gap"></span>'
        : c === '-' ? '<span class="fixed">-</span>'
        : `<span class="slot" data-ch="${esc(c)}"></span>`).join('')}</div>
    </div>
    <div class="yard"></div>
    <img class="truck" src="img/dump-truck.jpg" alt=""></section>`;
  const yard = app.querySelector('.yard'), slotsEl = app.querySelector('.slots');
  const slots = [...app.querySelectorAll('.slot')];
  app.querySelector('.back').onclick = pick;
  app.querySelector('.again').onclick = () => sayWord(word);
  let chosen = null, toldAgain = false;

  // 조각 놓을 자리: 서로 덜 겹치게 무작위
  const W = yard.clientWidth, H = yard.clientHeight, spots = [];
  for (const _ of ps) {
    let best = null;
    for (let t = 0; t < 60; t++) {
      const p = { x: Math.random() * Math.max(0, W - s), y: Math.random() * Math.max(0, H - s - 70) };
      const d = Math.min(...spots.map(q => Math.hypot(q.x - p.x, q.y - p.y)), Infinity);
      if (!best || d > best.d) best = { ...p, d };
      if (d > s * 1.3) break;
    }
    spots.push(best);
  }
  const order = ps.map((p, k) => ({ p, k: Math.random() })).sort((a, b) => a.k - b.k).map(o => o.p);
  const els = order.map((p, k) => {
    const b = document.createElement('button');
    b.className = `clay piece c${k % 6}`;
    b.textContent = p;
    b.dataset.ch = p;
    b.setAttribute('aria-label', p);
    b.style.left = `${spots[k].x}px`;
    b.style.top = `${spots[k].y}px`;
    b.style.opacity = '0';
    yard.append(b);
    return b;
  });

  const ready = () => els.forEach(b => wire(b));
  (async () => {
    await sayWord(word);
    if (scene !== my) return;
    const truck = app.querySelector('.truck');
    if (reduced) { els.forEach(b => (b.style.opacity = '1')); truck.remove(); ready(); return; }
    // 덤프트럭이 와서 조각을 쏟고 간다
    const yr = yard.getBoundingClientRect();
    truck.style.top = `${yr.top - app.getBoundingClientRect().top + 10}px`;
    const stopX = -(innerWidth / 2 + truck.offsetWidth / 2);
    truck.style.transform = `translateX(${stopX}px)`;
    await wait(1100);
    if (scene !== my) return;
    const tr = truck.getBoundingClientRect();
    els.forEach((b, k) => {
      const r = b.getBoundingClientRect();
      b.style.transition = 'none';
      b.style.transform = `translate(${tr.left + tr.width / 2 - r.left - s / 2}px, ${tr.top + tr.height / 2 - r.top - s / 2}px) scale(.2)`;
      b.offsetWidth;
      b.style.transition = `transform .6s cubic-bezier(.3,1.4,.5,1) ${k * 0.08}s, opacity .2s ${k * 0.08}s`;
      b.style.transform = '';
      b.style.opacity = '1';
    });
    await wait(600 + els.length * 80);
    els.forEach(b => (b.style.transition = ''));
    truck.style.transform = `translateX(${-innerWidth - truck.offsetWidth - 40}px)`;
    ready();
    await wait(1200);
    truck.remove();
  })();

  function emptySlot(ch, x, y) { // (x, y) 근처의 빈 같은 글자 칸
    let best = null;
    for (const sl of slots) {
      if (sl.classList.contains('filled') || sl.dataset.ch !== ch) continue;
      const r = sl.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < s * 0.9 && (!best || d < best.d)) best = { sl, d };
    }
    return best?.sl;
  }
  function nearAnySlot(x, y) {
    return slots.some(sl => { const r = sl.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y) < s * 0.9; });
  }
  function choose(b) {
    chosen?.classList.remove('chosen');
    chosen = b === chosen ? null : b;
    chosen?.classList.add('chosen');
    slotsEl.classList.toggle('choosing', !!chosen);
  }
  function nope(el) {
    el.classList.remove('shake'); el.offsetWidth; el.classList.add('shake');
    if (!toldAgain) { toldAgain = true; sayPhrase('again'); }
  }
  function place(b, sl) {
    choose(null);
    const a = b.getBoundingClientRect();
    b.classList.add('placed');
    b.style.left = b.style.top = b.style.transform = '';
    sl.append(b);
    sl.classList.add('filled');
    const c = b.getBoundingClientRect();
    b.style.transition = 'none';
    b.style.transform = `translate(${a.left - c.left}px, ${a.top - c.top}px)`;
    b.offsetWidth;
    b.style.transition = '';
    b.style.transform = '';
    b.disabled = true;
    if (slots.every(x => x.classList.contains('filled'))) complete();
    else sayPiece(b.dataset.ch);
  }
  function wire(b) {
    b.onclick = () => { if (!b.classList.contains('placed')) { choose(b); sayPiece(b.dataset.ch); } };
    b.onkeydown = e => { // 키보드: Enter·Space는 맞는 칸에 바로
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const sl = slots.find(x => !x.classList.contains('filled') && x.dataset.ch === b.dataset.ch);
      if (sl) place(b, sl);
    };
    b.onpointerdown = e => {
      if (b.classList.contains('placed') || e.button > 0) return;
      const sx = e.clientX, sy = e.clientY;
      let moved = false;
      b.setPointerCapture(e.pointerId);
      const move = ev => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 12) return;
        if (!moved) { moved = true; b.classList.add('dragging'); choose(null); sayPiece(b.dataset.ch); }
        b.style.transform = `translate(${dx}px, ${dy}px) scale(1.1)`;
      };
      const up = ev => {
        b.removeEventListener('pointermove', move);
        b.removeEventListener('pointerup', up);
        b.removeEventListener('pointercancel', up);
        if (!moved) return; // 눌렀다 뗀 것은 click이 처리
        b.classList.remove('dragging');
        b.onclick = null;
        setTimeout(() => wire(b), 0); // 끌기 뒤 따라오는 click 무시
        const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const sl = emptySlot(b.dataset.ch, x, y);
        if (sl) return place(b, sl);
        b.style.transform = '';
        if (ev.type === 'pointerup' && nearAnySlot(x, y)) nope(b);
      };
      b.addEventListener('pointermove', move);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    };
  }
  slots.forEach(sl => sl.onclick = () => {
    if (!chosen || sl.classList.contains('filled')) return;
    if (sl.dataset.ch === chosen.dataset.ch) place(chosen, sl);
    else nope(sl);
  });

  async function complete() {
    await wait(350);
    for (const sl of slots) {
      if (scene !== my) return;
      const b = sl.firstElementChild;
      b.classList.remove('hop'); b.offsetWidth; b.classList.add('hop');
      await sayPiece(b.dataset.ch);
    }
    if (scene !== my) return;
    await sayWord(word);
    if (scene !== my) return;
    markDone(word);
    meaning(i);
  }
}

// ---- S04 뜻 ----
function meaning(i) {
  const my = newScene();
  const row = DATA[lang][i];
  app.innerHTML = `<section class="screen meaning">
    <div class="clay mean-card">${pic(row, '')}
      <div class="mean-word">${esc(row[1])}</div>
      <p class="sentence">${esc(row[4])}</p></div>
    <div class="row">
      <button class="clay big list">${UI[lang].list}</button>
      <button class="clay big alt next">${UI[lang].next}</button>
    </div></section>`;
  app.querySelector('.list').onclick = pick;
  app.querySelector('.next').onclick = () => {
    const n = (i + 1) % DATA[lang].length;
    stage = DATA[lang][n][0];
    puzzle(n);
  };
  app.querySelector('.mean-card').onclick = () => play(`${lang}/${slug(lang, row[1])}-s.wav`, row[4]);
  (async () => {
    await sayPhrase('great');
    if (scene === my) play(`${lang}/${slug(lang, row[1])}-s.wav`, row[4]);
  })();
}

const wait = ms => new Promise(r => setTimeout(r, ms));

DATA = await (await fetch('words.json')).json();
// 파일 이름 규칙 자체 검사 (make_audio.py check()와 같은 값)
console.assert(slug('ko', '기차') === 'ae30-cc28' && pieces('en', 'Yo-yo').join('') === 'yoyo', 'slug/pieces 규칙 불일치');
home();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js');
}
