// Shopify：LINE の人ごとに1回だけ使える割引コードを作る（同じ人には同じコードを返す）。元の店 lib/shopify.js と同じ動き。
// 鍵は2通り（どちらも使う人の店の鍵。Vercel の環境変数に入れる。値はここに書かない）：
//   A. SHOPIFY_ADMIN_TOKEN（~/ec-ads/store-ad-setup/shopify_token.mjs で取った Admin API の鍵。write_discounts が要る）
//   B. SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET（Dev Dashboard のアプリを同じ組織の店に入れた時のクライアント認証。元の店はこれ）
import crypto from 'crypto';

export function createShopify(cfg, deps = {}) {
  const env = deps.env || process.env; const fetchF = deps.fetch || ((...a) => fetch(...a));
  const SHOP = env.SHOPIFY_SHOP; let cache = { tok: null, exp: 0 };
  async function token() {
    if (env.SHOPIFY_ADMIN_TOKEN) return env.SHOPIFY_ADMIN_TOKEN;
    if (cache.tok && Date.now() < cache.exp - 60000) return cache.tok;
    const r = await fetchF(`https://${SHOP}/admin/oauth/access_token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: env.SHOPIFY_CLIENT_ID, client_secret: env.SHOPIFY_CLIENT_SECRET }) });
    const j = await r.json(); if (!j.access_token) throw new Error('shopify token');
    cache = { tok: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }; return cache.tok;
  }
  async function gql(query, variables) {
    const r = await fetchF(`https://${SHOP}/admin/api/2025-01/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await token() }, body: JSON.stringify({ query, variables }) });
    const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300)); return j.data;
  }
  const C = cfg.coupon;
  const codeFor = userId => C.prefix + crypto.createHash('sha256').update(userId + (env.CODE_SALT || '')).digest('hex').slice(0, 6).toUpperCase();
  async function issueCoupon(userId, answersLabel) {
    const code = codeFor(userId);
    const found = await gql('query($c:String!){ codeDiscountNodeByCode(code:$c){ id } }', { c: code });
    if (found.codeDiscountNodeByCode) return { code, isNew: false };
    const hours = Number(env.COUPON_HOURS || C.hours), amount = env.COUPON_AMOUNT || String(C.amount);
    const d = await gql(`mutation($d: DiscountCodeBasicInput!){ discountCodeBasicCreate(basicCodeDiscount:$d){ codeDiscountNode{ id } userErrors{ field message } } }`, { d: {
      title: `${C.title_prefix}${answersLabel}`.slice(0, 250), code, startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + hours * 36e5).toISOString(),
      customerSelection: { all: true }, customerGets: { value: { discountAmount: { amount, appliesOnEachItem: false } }, items: { all: true } },
      appliesOncePerCustomer: true, usageLimit: 1, combinesWith: C.combines } });
    const e = d.discountCodeBasicCreate.userErrors; if (e && e.length) throw new Error(JSON.stringify(e));
    return { code, isNew: true, hours };
  }
  return { issueCoupon, codeFor, gql };
}
