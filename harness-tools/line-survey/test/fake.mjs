// テスト用の偽の LINE・Shopify。外には1通も出さない（fetch を差し替える）。
import crypto from 'crypto'; import { EventEmitter } from 'events';
export const SECRET = 'testsecret';
export function fakeEnv(extra = {}) {
  return { LINE_CHANNEL_SECRET: SECRET, LINE_CHANNEL_ACCESS_TOKEN: 'fake-token', SHOPIFY_SHOP: 'fake-shop.myshopify.com', SHOPIFY_CLIENT_ID: 'cid', SHOPIFY_CLIENT_SECRET: 'csec', CODE_SALT: 'salt', ...extra };
}
export function installFakeFetch() {
  const calls = []; const real = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url); const body = opts.body && typeof opts.body === 'string' ? (() => { try { return JSON.parse(opts.body); } catch { return opts.body; } })() : opts.body ? String(opts.body) : null;
    calls.push({ url: u, method: opts.method || 'GET', body });
    const json = o => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
    if (!/^https:\/\/(api\.line\.me|api-data\.line\.me|fake-shop\.myshopify\.com)\//.test(u)) throw new Error('外への通信を止めた: ' + u);
    if (u.includes('/v2/bot/profile/')) return json({ displayName: 'テスト' });
    if (u.includes('/v2/bot/message/reply') || u.includes('/chat/loading/start')) return json({});
    if (u.includes('/admin/oauth/access_token')) return json({ access_token: 'fake-admin', expires_in: 3600 });
    if (u.includes('/graphql.json')) {
      if (body.query.includes('codeDiscountNodeByCode')) return json({ data: { codeDiscountNodeByCode: null } });
      return json({ data: { discountCodeBasicCreate: { codeDiscountNode: { id: 'gid://x/1' }, userErrors: [] } } });
    }
    return json({});
  };
  return { calls, restore: () => { globalThis.fetch = real; } };
}
export const sign = body => crypto.createHmac('sha256', SECRET).update(body).digest('base64');
export function fakeReq(bodyObj, sig) {
  const body = JSON.stringify(bodyObj); const req = new EventEmitter(); req.method = 'POST'; req.headers = { 'x-line-signature': sig === undefined ? sign(body) : sig };
  setImmediate(() => { req.emit('data', body); req.emit('end'); }); return req;
}
export function fakeRes() { const res = { statusCode: 0, out: '' }; res.end = t => { res.out = t; res.done = true; }; return res; }
let n = 0;
export const ev = { follow: () => ({ type: 'follow', replyToken: 'rt' + (++n), source: { userId: 'Utest1' } }),
  text: t => ({ type: 'message', replyToken: 'rt' + (++n), source: { userId: 'Utest1' }, message: { type: 'text', text: t } }),
  postback: d => ({ type: 'postback', replyToken: 'rt' + (++n), source: { userId: 'Utest1' }, postback: { data: d } }) };
// 返事の中から、押せるボタンを全部取り出す
export function buttons(messages) {
  const out = []; const walk = o => { if (!o || typeof o !== 'object') return; if (o.type === 'button' && o.action) out.push(o.action); for (const v of Object.values(o)) walk(v); };
  walk(messages); return out;
}
