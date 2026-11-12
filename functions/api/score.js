// POST /api/score
// 接收一局成绩并写入 D1，返回该成绩的全球排名。
// 说明：这是休闲游戏榜单，分数由客户端上报，服务端只做范围与格式校验。

const MODES = new Set(['campaign', 'hunt', 'dock', 'endless']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function cleanName(value) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}

function intInRange(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env || !env.DB) return json({ ok: false, error: 'D1 未绑定（变量名应为 DB）' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ ok: false, error: '请求体不是合法 JSON' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ ok: false, error: '请求体为空' }, 400);

  const name = cleanName(body.name) || '无名队员';
  const mode = String(body.mode || 'campaign');
  if (!MODES.has(mode)) return json({ ok: false, error: '未知模式' }, 400);

  const score = intInRange(body.score, 0, 300000, NaN);
  if (!Number.isFinite(score)) return json({ ok: false, error: '分数无效' }, 400);

  const kills = intInRange(body.kills, 0, 3000, 0);
  const secs = intInRange(body.secs, 0, 86400, 0);
  let accuracy = null;
  if (body.accuracy !== null && body.accuracy !== undefined && body.accuracy !== '') {
    const a = Number(body.accuracy);
    if (Number.isFinite(a)) accuracy = Math.min(1, Math.max(0, a));
  }

  try {
    const created = Date.now();
    const insert = await env.DB
      .prepare('INSERT INTO scores (name, mode, score, kills, accuracy, secs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(name, mode, score, kills, accuracy, secs, created)
      .run();

    const better = await env.DB
      .prepare('SELECT COUNT(*) AS c FROM scores WHERE score > ?')
      .bind(score)
      .first();
    const rank = Math.max(1, Number((better && better.c) || 0) + 1);

    return json({
      ok: true,
      rank,
      id: insert && insert.meta ? insert.meta.last_row_id : null
    });
  } catch (err) {
    return json({ ok: false, error: '写入成绩失败：' + String((err && err.message) || err) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}
