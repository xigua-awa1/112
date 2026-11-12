// GET /api/leaderboard?limit=20&mode=all
// 需要 Cloudflare Pages 项目的 D1 绑定，变量名必须为 DB。

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

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env || !env.DB) return json({ ok: false, error: 'D1 未绑定（变量名应为 DB）' }, 500);

  const url = new URL(request.url);
  const limitRaw = parseInt(url.searchParams.get('limit') || '20', 10);
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));
  const mode = url.searchParams.get('mode') || 'all';

  try {
    let result;
    if (mode === 'all') {
      result = await env.DB
        .prepare('SELECT id, name, mode, score, kills, accuracy, secs, created_at FROM scores ORDER BY score DESC, created_at ASC LIMIT ?')
        .bind(limit)
        .all();
    } else {
      if (!MODES.has(mode)) return json({ ok: false, error: '未知模式' }, 400);
      result = await env.DB
        .prepare('SELECT id, name, mode, score, kills, accuracy, secs, created_at FROM scores WHERE mode = ? ORDER BY score DESC, created_at ASC LIMIT ?')
        .bind(mode, limit)
        .all();
    }
    return json({ ok: true, rows: (result && result.results) || [] });
  } catch (err) {
    return json({ ok: false, error: '读取排行榜失败：' + String((err && err.message) || err) }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}
