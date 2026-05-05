/* ═══════════════════════════════════════════════════
   SCRIPT.JS — Full Game + Session Storage + Auto-Send
═══════════════════════════════════════════════════ */

const SESSION_KEY = 'fqa_session';

// ── Game State ────────────────────────────────────
let noCount    = 0;
let gameOver   = false;
let finalPhase = false;
let actions    = [];   // ["NO","NO","YES"] etc.

const MAX_NO = 5;

const subtexts = [
  "Think again Moon,I don't have any other opinion",
  "Who answers my chocolate question",
  "I thought you stand on your words Moon",
  "Then what about Juice",
  "Last Question…...."
];

const YES_SCALES  = [1,1.13,1.27,1.43,1.60,1.80];
const YES_PADDING = ["0.88rem 2.5rem","1rem 2.9rem","1.1rem 3.3rem","1.22rem 3.8rem","1.35rem 4.3rem","1.5rem 5rem"];
const NO_SCALES   = [1,0.86,0.72,0.60,0.50,0.42];
const NO_PADDING  = ["0.75rem 2rem","0.65rem 1.7rem","0.55rem 1.4rem","0.45rem 1.1rem","0.38rem 0.88rem","0.32rem 0.7rem"];

// ── DOM refs ──────────────────────────────────────
const body          = document.body;
const themeToggle   = document.getElementById('theme-toggle');
const mainQuestion  = document.getElementById('main-question');
const subtext       = document.getElementById('subtext');
const yesBtn        = document.getElementById('yes-btn');
const noBtn         = document.getElementById('no-btn');
const questionCard  = document.getElementById('question-card');
const resultCard    = document.getElementById('result-card');
const resultAnimArea= document.getElementById('result-anim-area');
const resultEmoji   = document.getElementById('result-emoji');
const resultMessage = document.getElementById('result-message');
const canvas        = document.getElementById('particle-canvas');
const ctx           = canvas.getContext('2d');

// ═══════════════════════════════════════════════════
//  DEVICE INFO (auto — no popup)
// ═══════════════════════════════════════════════════
function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    screenW:   screen.width,
    screenH:   screen.height,
    language:  navigator.language || navigator.userLanguage || 'unknown',
    timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  };
}

// ═══════════════════════════════════════════════════
//  SESSION STORAGE HELPERS
// ═══════════════════════════════════════════════════
function saveSession() {
  const data = {
    actions,
    noCount,
    finalResult: null,   // updated on game over
    deviceInfo: getDeviceInfo(),
    sent: false
  };
  // Preserve finalResult if already set
  const existing = loadSession();
  if (existing && existing.finalResult) data.finalResult = existing.finalResult;
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch(e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function markSessionSent() {
  try {
    const data = loadSession();
    if (data) { data.sent = true; localStorage.setItem(SESSION_KEY, JSON.stringify(data)); }
  } catch(e) {}
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

function setFinalResult(result) {
  try {
    const data = loadSession() || { actions, deviceInfo: getDeviceInfo(), sent: false };
    data.actions = actions;
    data.finalResult = result;
    data.deviceInfo = getDeviceInfo();
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch(e) {}
}

// ═══════════════════════════════════════════════════
//  ON PAGE LOAD — check & send previous session
// ═══════════════════════════════════════════════════
(function checkPreviousSession() {
  const prev = loadSession();
  if (!prev) return;                              // nothing stored — fresh start
  if (prev.sent) { clearSession(); return; }      // already sent → clear and fresh start
  if (!prev.finalResult) { clearSession(); return; } // incomplete (no final action) → discard

  // Has complete unsent data → send it, then clear
  console.log('[Session] Sending previous session data...');
  sendToBackend(prev.actions, prev.finalResult, prev.deviceInfo)
    .finally(() => {
      clearSession();
    });
})();

// ═══════════════════════════════════════════════════
//  BACKEND SEND
// ═══════════════════════════════════════════════════
async function sendToBackend(actionsArr, finalResult, deviceInfo) {
  const payload = { actions: actionsArr, finalResult, deviceInfo };
  try {
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.ok) markSessionSent();
    return json;
  } catch(e) {
    //console.log('[Backend] Not reachable — standalone mode.');
    console.error('[Backend Error]', e);
  }
}

// Called on game completion
function finalSend(result) {
  setFinalResult(result);
  const data = loadSession();
  if (data) {
    sendToBackend(data.actions, data.finalResult, data.deviceInfo)
      .then(() => clearSession());
  }
}

// ═══════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════
let particles = [];

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function isNight() { return body.classList.contains('moon-mode'); }

function newParticle() {
  const night = isNight();
  const hue   = night ? Math.random()*50+240 : Math.random()*35+25;
  return {
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height,
    r:     Math.random() * 2.5 + 0.7,
    vx:    (Math.random()-0.5)*0.32,
    vy:    -(Math.random()*0.4+0.12),
    alpha: Math.random()*0.45+0.12,
    hue
  };
}

function initParticles() {
  particles = Array.from({length:65}, newParticle);
}

function drawParticles() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const night = isNight();
  particles.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fillStyle = night
      ? `hsla(${p.hue},68%,72%,${p.alpha})`
      : `hsla(${p.hue},82%,64%,${p.alpha})`;
    ctx.fill();
    p.x += p.vx; p.y += p.vy;
    if (p.y<-10||p.x<-10||p.x>canvas.width+10) {
      Object.assign(p, newParticle());
      p.y = canvas.height + 10;
    }
  });
  requestAnimationFrame(drawParticles);
}

// ═══════════════════════════════════════════════════
//  THEME TOGGLE
// ═══════════════════════════════════════════════════
themeToggle.addEventListener('change', () => {
  const night = themeToggle.checked;
  body.classList.toggle('cid-mode',  !night);
  body.classList.toggle('moon-mode',  night);
  particles.forEach(p => { p.hue = newParticle().hue; });
});

// ═══════════════════════════════════════════════════
//  SUBTEXT CHANGE
// ═══════════════════════════════════════════════════
function changeSubtext(text) {
  subtext.classList.add('fade-out');
  setTimeout(() => {
    subtext.textContent = text;
    subtext.classList.remove('fade-out');
  }, 310);
}

// ═══════════════════════════════════════════════════
//  NO DODGE
// ═══════════════════════════════════════════════════
function dodgeNo() {
  const range = 90 + noCount * 10;
  const rx = (Math.random()-0.5)*range;
  const ry = (Math.random()-0.5)*range;
  noBtn.style.position  = 'relative';
  noBtn.style.left      = rx + 'px';
  noBtn.style.top       = ry + 'px';
  noBtn.style.transition = 'left .28s ease,top .28s ease,transform .35s cubic-bezier(0.34,1.56,0.64,1),padding .4s ease';
}

// ═══════════════════════════════════════════════════
//  PHASE 1 — YES click (early, within 5 NOs)
// ═══════════════════════════════════════════════════
function handleYesPhase1() {
  if (gameOver) return;
  gameOver = true;
  actions.push('YES');
  saveSession();
  finalSend('YES');
  hideCard(() => showHappy());
}

function showHappy() {
  resultCard.classList.add('visible');
  resultEmoji.textContent = '🎉';
  resultMessage.textContent = "Nice 😄 I am Looking for this!";
  // Floating nose rings
  launchFloatingRings();
  // Inline rings in result area
  for (let i=0;i<3;i++) {
    const el = document.createElement('div');
    el.innerHTML = makeRingSVG(42+i*6);
    el.firstChild.classList.add('droop-ring');
    el.firstChild.style.animationDuration = (1.8+i*.3)+'s';
    resultAnimArea.appendChild(el.firstChild);
  }
}

// ═══════════════════════════════════════════════════
//  PHASE 1 — NO click
// ═══════════════════════════════════════════════════
noBtn.addEventListener('click', () => {
  if (gameOver) return;
  if (finalPhase) { handleFinalNo(); return; }
  handleNoPhase1();
});

yesBtn.addEventListener('click', () => {
  if (gameOver) return;
  if (finalPhase) { handleFinalYes(); return; }
  handleYesPhase1();
});

function handleNoPhase1() {
  noCount++;
  actions.push('NO');
  saveSession();

  changeSubtext(subtexts[Math.min(noCount-1, MAX_NO-1)]);

  // Grow YES
  const si = Math.min(noCount, YES_SCALES.length-1);
  yesBtn.style.transform = `scale(${YES_SCALES[si]})`;
  yesBtn.style.padding   = YES_PADDING[si];
  yesBtn.classList.add('glowing');

  // Shrink & dodge NO
  const ni = Math.min(noCount, NO_SCALES.length-1);
  noBtn.style.transform = `scale(${NO_SCALES[ni]})`;
  noBtn.style.padding   = NO_PADDING[ni];
  dodgeNo();

  if (noCount >= MAX_NO) {
    finalPhase = true;
    setTimeout(switchToFinal, 650);
  }
}

// ═══════════════════════════════════════════════════
//  SWITCH TO FINAL QUESTION
// ═══════════════════════════════════════════════════
function switchToFinal() {
  mainQuestion.style.opacity   = '0';
  mainQuestion.style.transform = 'translateY(-12px)';

  setTimeout(() => {
    mainQuestion.innerHTML    = 'Did I make you uncomfortable <br/> in anyway?';
    mainQuestion.style.transition = 'opacity .5s ease,transform .5s ease';
    mainQuestion.style.opacity   = '1';
    mainQuestion.style.transform = 'translateY(0)';

    changeSubtext(' This will be your final answer Moon…  ');

    // Reset button sizes
    yesBtn.style.transform = 'scale(1)';
    yesBtn.style.padding   = '0.88rem 2.5rem';
    yesBtn.classList.remove('glowing');
    yesBtn.querySelector('span').textContent = 'YES ';

    noBtn.style.transform = 'scale(1)';
    noBtn.style.padding   = '0.75rem 2rem';
    noBtn.style.left      = '0';
    noBtn.style.top       = '0';
    noBtn.querySelector('span').textContent = 'NO ';
  }, 430);
}

// ═══════════════════════════════════════════════════
//  FINAL PHASE — YES = SAD (stop)
// ═══════════════════════════════════════════════════
function handleFinalYes() {
  if (gameOver) return;
  gameOver = true;
  actions.push('YES');
  saveSession();
  finalSend('STOP');
  hideCard(() => showSad());
}

function showSad() {
  resultCard.classList.add('visible');
  resultEmoji.textContent = '🙂';
  resultMessage.textContent = "Alright… Sorry, I'll stop all these from Today🙂";
  body.classList.add('sad-dim');

  for (let i=0;i<2;i++) {
    const el = document.createElement('div');
    el.innerHTML = makeRingSVG(50+i*10);
    el.firstChild.classList.add('droop-ring');
    resultAnimArea.appendChild(el.firstChild);
  }
}

// ═══════════════════════════════════════════════════
//  FINAL PHASE — NO = CONFUSION
// ═══════════════════════════════════════════════════
function handleFinalNo() {
  if (gameOver) return;
  gameOver = true;
  actions.push('NO');
  saveSession();
  finalSend('CONFUSION');
  hideCard(() => showConfusion());
}

function showConfusion() {
  resultCard.classList.add('visible');
  resultEmoji.textContent = '🥻';
  resultMessage.textContent = " By the way you Look gorgeous in violet saree ";

  for (let i=0;i<3;i++) {
    const wrap = document.createElement('span');
    wrap.className = 'spin-ring';
    wrap.style.animationDirection = i%2===0 ? 'normal' : 'reverse';
    wrap.style.animationDuration  = (.8+i*.2)+'s';
    wrap.innerHTML = makeRingSVG(40+i*6);
    resultAnimArea.appendChild(wrap);
  }

  let n = 0;
  const id = setInterval(() => {
    resultCard.classList.remove('confusion-shake');
    void resultCard.offsetWidth;
    resultCard.classList.add('confusion-shake');
    if (++n >= 8) clearInterval(id);
  }, 900);
}

// ═══════════════════════════════════════════════════
//  CARD TRANSITION
// ═══════════════════════════════════════════════════
function hideCard(cb) {
  questionCard.style.opacity   = '0';
  questionCard.style.transform = 'scale(0.88)';
  questionCard.style.transition = 'opacity .45s ease,transform .45s ease';
  setTimeout(() => { questionCard.style.display='none'; cb(); }, 460);
}

// ═══════════════════════════════════════════════════
//  NOSE RING SVG BUILDER
// ═══════════════════════════════════════════════════
function makeRingSVG(px) {
  const night = isNight();
  const id    = 'rg_' + Math.random().toString(36).slice(2,8);
  const c1    = night ? '#f5f0ff' : '#ffe066';
  const c2    = night ? '#c4b5fd' : '#f0a500';
  const c3    = night ? '#6d28d9' : '#c8700a';
  const gem   = night ? '#c4b5fd' : '#f87060';
  const gb    = night ? '#7c3aed' : '#f0a500';
  // open hoop — not closed ring
  return `<svg viewBox="0 0 90 58" xmlns="http://www.w3.org/2000/svg"
    width="${px}" height="${Math.round(px*0.65)}" style="display:inline-block;vertical-align:middle">
    <defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="50%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient></defs>
    <path d="M45,54 A34,34 0 1,1 44.9,54"
      fill="none" stroke="url(#${id})" stroke-width="10" stroke-linecap="round"/>
    <circle cx="45" cy="20" r="11" fill="${gem}" stroke="${gb}" stroke-width="2"/>
    <polygon points="45,12 51,20 45,26 39,20" fill="rgba(255,255,255,0.55)"/>
  </svg>`;
}

// ═══════════════════════════════════════════════════
//  LAUNCH FLOATING RINGS (happy)
// ═══════════════════════════════════════════════════
function launchFloatingRings() {
  const pxArr = [55,42,68,48,72,38,62,50,44,60];
  const durs  = [2.4,2.9,2.1,3.2,2.6,3.0,2.3,2.8,3.4,2.7];
  pxArr.forEach((px,i) => {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'float-ring';
      el.innerHTML = makeRingSVG(px);
      el.style.left              = (Math.random()*85+5)+'vw';
      el.style.bottom            = '-70px';
      el.style.animationDuration = durs[i]+'s';
      el.style.animationDelay    = (i*0.15)+'s';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), (durs[i]+1.5)*1000);
    }, i*130);
  });
}

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initParticles();
drawParticles();
// NOTE: Do NOT call saveSession() here — it would overwrite the previous
// session before checkPreviousSession() can send it. Session is only
// written when the user clicks YES or NO.
