#!/usr/bin/env node
// 運営者の Shopify から、聞かなくても分かる値を読む（読むだけ。書き込まない）。
// 使い方: node probe-store.mjs --env ~/.config/secrets/shopify-<保存名>.env [--out <ストア情報の下書き.json>]
// 出す物：ストア情報の下書き（_auto に「どこから取ったか」）＋会社の住所の候補＋今入っているポリシー＋定期の販売プラン。鍵は表示しない。
import fs from 'node:fs';
import os from 'node:os';

const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1]]); return a; }, []));
const envFile = (A.env || '').replace(/^~/, os.homedir());
if (!fs.existsSync(envFile)) { console.error('--env の鍵のファイルが無い'); process.exit(1); }
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).replace('export ', '').trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SHOP = env.SHOP || Object.entries(env).find(([k]) => /_STORE$/.test(k))?.[1];
const TOKEN = env.SHOPIFY_TOKEN || Object.entries(env).find(([k]) => /_TOKEN$/.test(k))?.[1];
const host = SHOP.includes('.') ? SHOP : `${SHOP}.myshopify.com`;

async function gql(query) {
  const r = await fetch(`https://${host}/admin/api/2026-10/graphql.json`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': TOKEN }, body: JSON.stringify({ query }) });
  const j = await r.json(); return j.errors ? { error: (j.errors[0]?.message || JSON.stringify(j.errors)).slice(0, 160) } : j.data;
}
// スコープが無い所は、そこだけ空にして続ける（例：read_legal_policies が無い店）
const shop = await gql(`{ shop { name email contactEmail myshopifyDomain primaryDomain { url } currencyCode
  billingAddress { company address1 address2 city province zip phone countryCodeV2 } } }`);
const policies = await gql(`{ shop { shopPolicies { type title url updatedAt } } }`);
const plans = await gql(`{ sellingPlanGroups(first: 10) { nodes { name merchantCode sellingPlans(first: 5) { nodes { name billingPolicy { ... on SellingPlanRecurringBillingPolicy { interval intervalCount minCycles } } } } } } }`);
const theme = await gql(`{ themes(first: 1, roles: [MAIN]) { nodes { id name files(filenames: ["config/settings_data.json"]) { nodes { body { ... on OnlineStoreThemeFileBodyText { content } } } } } } }`);

const s = shop.shop || {}; const b = s.billingAddress || {};
const draft = { _auto: {}, _読めなかった: {} };
const put = (k, v, src) => { if (v != null && v !== '') { draft[k] = v; draft._auto[k] = src; } };
put('shop_name', s.name, 'shop.name');
put('store_url', s.primaryDomain?.url, 'shop.primaryDomain.url');
put('myshopify_domain', s.myshopifyDomain, 'shop.myshopifyDomain');
put('cs_email', s.contactEmail || s.email, 'shop.contactEmail');
if (shop.error) draft._読めなかった.shop = shop.error;
if (policies.error) draft._読めなかった.shopPolicies = policies.error + '（read_legal_policies が要る）';
if (plans.error) draft._読めなかった.sellingPlanGroups = plans.error;
const groups = plans.sellingPlanGroups?.nodes || [];
if (theme.themes?.nodes?.[0]) {
  const raw = theme.themes.nodes[0].files?.nodes?.[0]?.body?.content || '';
  const hex = [...new Set((raw.match(/#[0-9a-fA-F]{6}\b/g) || []).map(x => x.toUpperCase()))].slice(0, 8);
  draft._theme_colors_seen = { theme: theme.themes.nodes[0].name, colors: hex, note: 'この中から primary（見出し）と accent（ボタン）を運営者に確かめる' };
} else if (theme.error) draft._読めなかった.theme = theme.error;

const out = {
  store: draft,
  operator_candidates: { _auto: 'shop.billingAddress（会社の住所と同じとは限らない。運営者に確かめる）', legal_name: b.company || null, postal_code: b.zip || null, address: [b.province, b.city, b.address1, b.address2].filter(Boolean).join('') || null, phone: b.phone || null, country: b.countryCodeV2 || null },
  current_policies: policies.shop?.shopPolicies || null,
  subscription_groups: groups.map(g => ({ name: g.name, plans: g.sellingPlans.nodes.map(p => ({ name: p.name, ...(p.billingPolicy || {}) })) })),
  hint: groups.length ? '定期の販売プランがある → 商品の決まりの subscription を聞く' : '定期の販売プランは無い（subscription.enabled=false の候補）',
};
const txt = JSON.stringify(out, null, 1);
if (A.out) fs.writeFileSync(A.out, txt);
console.log(txt);
