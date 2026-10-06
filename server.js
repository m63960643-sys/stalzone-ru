const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const REGION = (process.env.STALZONE_REGION || 'RU').toUpperCase();
const API_BASE = (process.env.STALZONE_API_BASE_URL || 'https://eapi.stalzone.com').replace(/\/$/, '');
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 60000);

let cache = {
  lastEmission: null,
  currentStart: null,
  previousStart: null,
  previousEnd: null,
  active: false,
  source: 'waiting'
};
let lastSeenCurrentStart = null;
let initialized = false;
let pollInFlight = false;

function asIso(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

async function fetchEmission() {
  const clientId = process.env.STALZONE_CLIENT_ID;
  const clientSecret = process.env.STALZONE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('STALZONE_CLIENT_ID / STALZONE_CLIENT_SECRET are not configured');
  }

  const url = `${API_BASE}/${encodeURIComponent(REGION)}/emission`;
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Client-Id': clientId,
      'Client-Secret': clientSecret
    }
  });

  const text = await r.text();
  if (!r.ok) {
    let detail = text.slice(0, 400);
    try {
      const body = JSON.parse(text);
      detail = body.title || body.detail || text.slice(0, 400);
    } catch {}
    throw new Error(`STALZONE API ${r.status}: ${detail}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('STALZONE API returned invalid JSON');
  }

  const currentStart = asIso(data.currentStart);
  const previousStart = asIso(data.previousStart);
  const previousEnd = asIso(data.previousEnd);

  // The timer is supposed to count from the end of the last completed
  // emission, not from its start. While an emission is active, keep the
  // completed-emission timer based on previousEnd and expose currentStart
  // separately for Telegram notifications/status.
  const lastEmission = previousEnd || previousStart || currentStart;

  return {
    lastEmission,
    currentStart,
    previousStart,
    previousEnd,
    active: Boolean(currentStart),
    source: 'official-api'
  };
}

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });

  if (!r.ok) {
    const body = await r.text();
    console.error(`Telegram send failed: ${r.status} ${body.slice(0, 300)}`);
    return false;
  }
  return true;
}

function formatRu(iso) {
  return iso
    ? new Date(iso).toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        dateStyle: 'short',
        timeStyle: 'medium'
      }) + ' MSK'
    : '—';
}

async function poll() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const next = await fetchEmission();
    const newEmissionStarted = initialized
      && Boolean(next.currentStart)
      && next.currentStart !== lastSeenCurrentStart;

    lastSeenCurrentStart = next.currentStart || lastSeenCurrentStart;
    initialized = true;
    cache = next;

    if (newEmissionStarted) {
      await telegram(
        `☢️ НАЧАЛСЯ ВЫБРОС!\n\n` +
        `Регион: 🇷🇺 ${REGION}\n` +
        `Время начала: ${formatRu(next.currentStart)}\n` +
        `Сайт: https://stalzone-ru.onrender.com`
      );
    }
  } catch (error) {
    cache.source = 'error';
    console.error(`[poll] ${error.message}`);
  } finally {
    pollInFlight = false;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function contentType(filePath) {
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/html; charset=utf-8';
}

const root = __dirname;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/api/emission') {
    return sendJson(res, 200, cache);
  }

  if (url.pathname === '/health') {
    return sendJson(res, 200, { ok: true, source: cache.source, region: REGION });
  }

  let requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }

  res.writeHead(200, { 'content-type': contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`Running on ${HOST}:${PORT}`);
  console.log(`STALZONE API: ${API_BASE}/${REGION}/emission`);
  poll();
  setInterval(poll, POLL_MS);
});
