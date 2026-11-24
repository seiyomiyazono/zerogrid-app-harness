// LINE の API で済む設定（使う人の LINE の鍵で）。既定は dry-run（何を送るか出すだけ）。送るのは --apply の時だけ。
// 鍵：~/.config/secrets/line-<id>.env（LINE_CHANNEL_ID・LINE_CHANNEL_SECRET・LINE_CHANNEL_ACCESS_TOKEN・LINE_LOGIN_CHANNEL_ID・LINE_LOGIN_CHANNEL_SECRET・LIFF_ID）
// 使い方: node setup/line-api.mjs <id> <やる事> [引数] [--apply]
//   info                     読む  GET  /v2/bot/info（鍵が効くか・basic ID）
//   quota                    読む  GET  /v2/bot/message/quota と quota/consumption（月の通数）
//   webhook-get              読む  GET  /v2/bot/channel/webhook/endpoint
//   webhook-set <URL>        書く  PUT  /v2/bot/channel/webhook/endpoint
//   webhook-test [URL]       書く  POST /v2/bot/channel/webhook/test（LINE から受け口へ試しの出来事が1回飛ぶ）
//   richmenu <survey.json> <画像.jpg>  書く  validate → POST /v2/bot/richmenu → 画像 POST api-data …/content → POST /v2/bot/user/all/richmenu/{id}
//   richmenu-list            読む  GET  /v2/bot/richmenu/list
//   liff-create <URL>        書く  LINE ログインのチャネルの鍵で POST /v2/oauth/accessToken → POST /liff/v1/apps（LIFF ID を鍵のファイルに足す）
//   liff-list                読む  同じ鍵で GET /liff/v1/apps
import fs from 'node:fs'; import { readEnv, mergeEnv, mask, args, call } from './lib.mjs';
const a = args(process.argv.slice(2)); const [id, cmd, x, y] = a._; const apply = !!a.apply;
if (!id || !cmd) { console.error('使い方: node setup/line-api.mjs <id> <info|quota|webhook-get|webhook-set|webhook-test|richmenu|richmenu-list|liff-create|liff-list> [引数] [--apply]'); process.exit(2); }
const env = readEnv(`line-${id}`); const tok = env.LINE_CHANNEL_ACCESS_TOKEN; const B = 'https://api.line.me';
const needTok = () => { if (!tok) { console.error(`鍵が無い：~/.config/secrets/line-${id}.env の LINE_CHANNEL_ACCESS_TOKEN（setup/browser/line-console.mjs keys で取る）`); process.exit(1); } };
console.log(`商品 ${id} ／ チャネル ${env.LINE_CHANNEL_ID || '（未）'} ／ トークン ${mask(tok)} ／ ${apply ? '本当に送る' : 'dry-run'}`);

if (cmd === 'info') { needTok(); const r = await call({ url: `${B}/v2/bot/info`, token: tok }); if (r.json) console.log('basicId', r.json.basicId, '／ 名前', r.json.displayName, '／ 返事の設定', r.json.chatMode, r.json.markAsReadMode); }
if (cmd === 'quota') { needTok(); const q = await call({ url: `${B}/v2/bot/message/quota`, token: tok }); const c = await call({ url: `${B}/v2/bot/message/quota/consumption`, token: tok }); console.log('月の上限', q.json?.type, q.json?.value ?? '', '／ 今月使った', c.json?.totalUsage); }
if (cmd === 'webhook-get') { needTok(); const r = await call({ url: `${B}/v2/bot/channel/webhook/endpoint`, token: tok }); console.log('受け口', r.json?.endpoint, '／ 使う', r.json?.active); }
if (cmd === 'webhook-set') { needTok(); if (!/^https:\/\//.test(x || '')) { console.error('https の URL を渡す'); process.exit(2); } await call({ method: 'PUT', url: `${B}/v2/bot/channel/webhook/endpoint`, token: tok, body: { endpoint: x }, apply, write: true }); }
if (cmd === 'webhook-test') { needTok(); const r = await call({ method: 'POST', url: `${B}/v2/bot/channel/webhook/test`, token: tok, body: x ? { endpoint: x } : {}, apply, write: true }); if (r.json) console.log('結果', r.json.success, r.json.statusCode, r.json.reason || ''); }
if (cmd === 'richmenu-list') { needTok(); const r = await call({ url: `${B}/v2/bot/richmenu/list`, token: tok }); console.log('リッチメニュー', (r.json?.richmenus || []).map(m => `${m.richMenuId} ${m.name}`).join(' ／ ') || 'なし'); }
if (cmd === 'richmenu') {
  needTok(); const cfg = JSON.parse(fs.readFileSync(x, 'utf8')); const img = fs.readFileSync(y);
  if (img.length > 1024 * 1024) { console.error('画像が1MBを超える（LINE の上限）'); process.exit(1); }
  const [w, h] = cfg.richmenu.size; const fill = s => s.replace('{site}', cfg.site.url).replace('{product_path}', cfg.site.product_path);
  const body = { size: { width: w, height: h }, selected: true, name: `${cfg.id} 診断`, chatBarText: cfg.richmenu.chatBarText,
    areas: cfg.richmenu.areas.map(a => ({ bounds: { x: a.bounds[0], y: a.bounds[1], width: a.bounds[2], height: a.bounds[3] }, action: a.action.type === 'uri' ? { type: 'uri', uri: fill(a.action.uri) } : a.action })) };
  // validate は読むだけの確かめ（作らない）。dry-run でも送る
  const v = await call({ method: 'POST', url: `${B}/v2/bot/richmenu/validate`, token: tok, body }); if (v.status !== 200) { console.error('形が通らない', JSON.stringify(v.json)); process.exit(1); }
  const c = await call({ method: 'POST', url: `${B}/v2/bot/richmenu`, token: tok, body, apply, write: true }); const rid = c.json?.richMenuId || '<作ったID>';
  await call({ method: 'POST', url: `https://api-data.line.me/v2/bot/richmenu/${rid}/content`, token: tok, body: new Uint8Array(img), contentType: /\.png$/i.test(y) ? 'image/png' : 'image/jpeg', apply, write: true });
  await call({ method: 'POST', url: `${B}/v2/bot/user/all/richmenu/${rid}`, token: tok, apply, write: true });
}
async function loginToken() {
  if (!env.LINE_LOGIN_CHANNEL_ID || !env.LINE_LOGIN_CHANNEL_SECRET) { console.error('LINE ログインのチャネルの鍵が無い（setup/browser/line-console.mjs login-keys で取る）'); process.exit(1); }
  const r = await fetch(`${B}/v2/oauth/accessToken`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.LINE_LOGIN_CHANNEL_ID, client_secret: env.LINE_LOGIN_CHANNEL_SECRET }) });
  const j = await r.json(); if (!j.access_token) { console.error('LINE ログインの鍵が取れない', r.status); process.exit(1); } return j.access_token;
}
if (cmd === 'liff-list') { const t = await loginToken(); const r = await call({ url: `${B}/liff/v1/apps`, token: t }); console.log((r.json?.apps || []).map(p => `${p.liffId} ${p.view?.url}`).join(' ／ ') || 'なし'); }
if (cmd === 'liff-create') {
  if (!/^https:\/\//.test(x || '')) { console.error('LIFF の入口の URL（https://<id>-line.vercel.app/liff/）を渡す'); process.exit(2); }
  const body = { view: { type: 'full', url: x }, description: `${id} 無料診断`, features: { qrCode: false }, permanentLinkPattern: 'concat', scope: ['openid', 'profile'], botPrompt: 'aggressive' };
  if (!apply) { await call({ method: 'POST', url: `${B}/liff/v1/apps`, token: '', body, write: true }); process.exit(0); }
  const r = await call({ method: 'POST', url: `${B}/liff/v1/apps`, token: await loginToken(), body, apply, write: true });
  if (r.json?.liffId) { mergeEnv(`line-${id}`, { LIFF_ID: r.json.liffId }); console.log('LIFF ID を鍵のファイルに足した（LIFF ID は秘密ではない）', r.json.liffId); }
}
