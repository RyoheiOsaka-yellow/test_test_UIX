// Claude API への中継。APIキーは Netlify の環境変数 ANTHROPIC_API_KEY に置き、ブラウザには出さない。
// GET  /api/claude → {ok:true}（接続確認）
// POST /api/claude → Messages API にそのまま中継
export default async (req) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return Response.json({ ok: Boolean(key) });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!key) return Response.json({ error: { message: 'サーバーにAPIキーが設定されていません' } }, { status: 500 });
  const body = await req.text();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body,
  });
  return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json' } });
};
export const config = { path: '/api/claude' };
