const API = '/api/emission';
let startedMs = null;

function fmt(ms) {
  let s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return [h, m, x].map(v => String(v).padStart(2, '0')).join(':');
}

function render() {
  const timer = document.querySelector('#timer');
  if (timer && startedMs) timer.textContent = fmt(Date.now() - startedMs);
}

function statusText(data) {
  if (data.source === 'error') return 'Ошибка связи с STALZONE API';
  if (data.source === 'waiting') return 'Ожидание API…';
  return data.active ? '☢️ ВЫБРОС ИДЁТ' : 'API ONLINE';
}

async function sync() {
  try {
    const r = await fetch(API, { cache: 'no-store' });
    if (!r.ok) throw new Error('API response ' + r.status);
    const d = await r.json();

    const raw = d.lastEmission;
    const t = raw ? Date.parse(raw) : NaN;
    if (!Number.isFinite(t)) throw new Error('Нет времени последнего завершённого выброса');

    startedMs = t;
    document.querySelector('#started').textContent =
      'Последний выброс закончился: ' + new Date(t).toLocaleString('ru-RU');
    document.querySelector('.online').textContent = statusText(d);
    document.querySelector('.safe').textContent = d.active ? '● ВЫБРОС ИДЁТ' : '● БЕЗОПАСНО';
  } catch (e) {
    document.querySelector('#started').textContent = 'STALZONE API ещё не подключён';
    document.querySelector('.online').textContent = '● API WAITING';
  }
  render();
}

sync();
setInterval(sync, 60000);
setInterval(render, 1000);

const botLink = document.querySelector('#botLink');
if (botLink) botLink.href = 'https://t.me/';
