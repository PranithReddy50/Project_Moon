require('dotenv').config();
const express = require('express');
const path    = require('path');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 5000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '';

// ── Parse JSON bodies FIRST ───────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ── CORS headers (allow fetch from same origin & file://) ─
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── Telegram sender ───────────────────────────────────────
function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[Telegram] Not configured — skipping.\nMessage:\n' + text);
    return;
  }
  const body = JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' });
  const opts = {
    hostname: 'api.telegram.org',
    path:     `/bot${BOT_TOKEN}/sendMessage`,
    method:   'POST',
    headers:  {
      'Content-Type':   'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  const req = https.request(opts, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => console.log('[Telegram Response]', d));
  });
  req.on('error', e => console.error('[Telegram Error]', e.message));
  req.write(body);
  req.end();
}

// ── /send endpoint ────────────────────────────────────────
app.post('/api/send', (req, res) => {
  console.log(req.body);
  const { actions, finalResult, deviceInfo } = req.body;

  if (!actions || !finalResult) {
    return res.status(400).json({ ok: false, error: 'Missing data' });
  }

  // Format actions: ["NO","NO","YES"] → "No,No,Yes"
  const actionsStr = actions.map(a => {
    const lower = a.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join(',');

  // Final label
  const finalLabel = {
    'YES':       'Final:YES',
    'STOP':      'Final:STOP',
    'CONFUSION': 'Final:CONFUSION'
  }[finalResult] || `Final:${finalResult}`;

  // Build message EXACTLY as required
  const msg = `📲 New Visitor\n\nUser-Agent: ${deviceInfo.userAgent}\nScreen: ${deviceInfo.screenW}x${deviceInfo.screenH}\nLanguage: ${deviceInfo.language}\nTime: ${deviceInfo.timestamp}\n\nResult: ${actionsStr}, ${finalLabel}`;

  console.log('[/send] Sending:\n' + msg);
  sendTelegram(msg);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🚀  App running → http://localhost:${PORT}\n`);
});

// ── Serve static files AFTER all API routes ───────────────
// (Critical: must come last so /send POST is never shadowed)
app.use('/images', express.static(path.join(__dirname, 'images')));
//app.use(express.static(path.join(__dirname)));
//app.use('/', express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));