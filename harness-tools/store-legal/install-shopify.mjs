#!/usr/bin/env node
// 出来た書類（render.mjs の出力）とお問い合わせページを、運営者の Shopify に入れる。
// 初期は DRY-RUN：送る mutation と中身の長さを表示するだけで、何も書き込まない。
// 使い方:
//   node install-shopify.mjs --dir <render の出力> [--contact <page.zg-contact.liquid>] [--theme-id <gid://shopify/OnlineStoreTheme/…>]
//   本当に書く時だけ:  --apply --env ~/.config/secrets/shopify-<保存名>.env   （運営者の OK の後だけ。見本の値の書類は --allow-example が無いと止める）
// 鍵（SHOPIFY_TOKEN）は画面にもログにも出さない。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a;
}, []));
if (!A.dir) { console.error('--dir が要る'); process.exit(1); }
const APPLY = A.apply === true;
const API = A['api-version'] || '2026-10';
const index = JSON.parse(fs.readFileSync(path.join(A.dir, 'index.json'), 'utf8'));

if (index.problems?.length) { console.error('書類の点検に問題が残っている。直してから：\n・' + index.problems.join('\n・')); process.exit(3); }
if (APPLY && index.example && !A['allow-example']) { console.error('見本の値で作った書類。本当の運営者の値で作り直してから入れる（どうしても入れる時だけ --allow-example）'); process.exit(4); }
if (APPLY && index.used_defaults?.length) console.error(`注意：初期値のまま入る値 ${index.used_defaults.length} 個（${index.used_defaults.join(', ')}）。運営者が確かめた事を確認してから。`);

// Admin GraphQL（2026-10）で確かめた形
const POLICY_MUTATION = `mutation shopPolicyUpdate($shopPolicy: ShopPolicyInput!) {
  shopPolicyUpdate(shopPolicy: $shopPolicy) { shopPolicy { id type title url updatedAt } userErrors { field message code } }
}`;
const PAGE_QUERY = `query contactPage($q: String!) { pages(first: 5, query: $q) { nodes { id handle title templateSuffix isPublished } } }`;
const PAGE_CREATE = `mutation pageCreate($page: PageCreateInput!) { pageCreate(page: $page) { page { id handle templateSuffix } userErrors { field message code } } }`;
const PAGE_UPDATE = `mutation pageUpdate($id: ID!, $page: PageUpdateInput!) { pageUpdate(id: $id, page: $page) { page { id handle templateSuffix } userErrors { field message code } } }`;
const THEME_UPSERT = `mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) { upsertedThemeFiles { filename } userErrors { field message code } }
}`;

const steps = [];
for (const d of index.docs) {
  const body = fs.readFileSync(path.join(A.dir, d.html), 'utf8');
  if (Buffer.byteLength(body) > 512 * 1024) { console.error(`${d.title} が 512KB を超える`); process.exit(5); }
  steps.push({ label: `ポリシー ${d.type}（${d.title}）`, query: POLICY_MUTATION, variables: { shopPolicy: { type: d.type, body } }, scope: 'write_legal_policies' });
}
if (A.contact) {
  const liquid = fs.readFileSync(A.contact, 'utf8');
  if (/\{\{\s*(store|operator|product|c)\./.test(liquid)) { console.error('お問い合わせのテンプレートに埋めていない値が残っている（tools/contact-page/build.mjs で作った物を渡す）'); process.exit(6); }
  if (!A['theme-id']) console.error('注意：--theme-id が無い。テンプレートのファイルは入れず、ページだけの手順を出す（公開中のテーマに入れない。非公開テーマの ID を渡す）');
  else steps.push({ label: 'テーマに templates/page.zg-contact.liquid', query: THEME_UPSERT, variables: { themeId: A['theme-id'], files: [{ filename: 'templates/page.zg-contact.liquid', body: { type: 'TEXT', value: liquid } }] }, scope: 'write_themes' });
  steps.push({ label: 'ページ /pages/contact（テンプレート zg-contact）', query: 'PAGE_QUERY → あれば pageUpdate、無ければ pageCreate', variables: { handle: 'contact', page: { title: 'お問い合わせ', handle: 'contact', templateSuffix: 'zg-contact', isPublished: true, body: '' } }, scope: 'write_online_store_pages', page: true });
}

function show(s) {
  const v = JSON.parse(JSON.stringify(s.variables));
  if (v.shopPolicy) v.shopPolicy.body = `<HTML ${Buffer.byteLength(v.shopPolicy.body)} バイト。頭：${v.shopPolicy.body.replace(/\s+/g, ' ').slice(0, 80)}…>`;
  if (v.files) v.files = v.files.map(f => ({ filename: f.filename, body: { type: f.body.type, value: `<${Buffer.byteLength(f.body.value)} バイト>` } }));
  return `── ${s.label}（要るスコープ：${s.scope}）\n${typeof s.query === 'string' ? s.query.split('\n')[0] : ''}\n${JSON.stringify(v, null, 1)}`;
}

if (!APPLY) {
  console.log(`DRY-RUN（何も書き込まない）。店：${index.shop}／書類 ${index.docs.length} 個${index.example ? '／見本の値' : ''}\n`);
  for (const s of steps) console.log(show(s) + '\n');
  console.log('本当に入れる時：--apply --env ~/.config/secrets/shopify-<保存名>.env を付ける（運営者の OK の後だけ）。');
  process.exit(0);
}

// ---------- ここから下は --apply の時だけ ----------
const envFile = (A.env || '').replace(/^~/, os.homedir());
if (!envFile || !fs.existsSync(envFile)) { console.error('--env の鍵のファイルが無い'); process.exit(7); }
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).replace('export ', '').trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SHOP = env.SHOP || Object.entries(env).find(([k]) => /_STORE$/.test(k))?.[1];
const TOKEN = env.SHOPIFY_TOKEN || Object.entries(env).find(([k]) => /_TOKEN$/.test(k))?.[1];
if (!SHOP || !TOKEN) { console.error('鍵のファイルに SHOP と SHOPIFY_TOKEN が無い'); process.exit(7); }
const shopHost = SHOP.includes('.') ? SHOP : `${SHOP}.myshopify.com`;
if (env.SCOPES) {
  const have = env.SCOPES.split(','); const need = [...new Set(steps.map(s => s.scope))];
  const lack = need.filter(n => !have.includes(n));
  if (lack.length) { console.error(`アプリにスコープが足りない：${lack.join(', ')}。Dev Dashboard のアプリにスコープを足して、入れ直す（store-ad-setup/README.md 4〜5）`); process.exit(8); }
}
async function gql(query, variables) {
  const r = await fetch(`https://${shopHost}/admin/api/${API}/graphql.json`, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': TOKEN }, body: JSON.stringify({ query, variables }) });
  const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300)); return j.data;
}
for (const s of steps) {
  if (s.page) {
    const found = (await gql(PAGE_QUERY, { q: 'handle:contact' })).pages.nodes.find(p => p.handle === 'contact');
    const res = found ? (await gql(PAGE_UPDATE, { id: found.id, page: { templateSuffix: 'zg-contact' } })).pageUpdate : (await gql(PAGE_CREATE, { page: s.variables.page })).pageCreate;
    console.log(s.label, res.userErrors.length ? 'NG ' + JSON.stringify(res.userErrors) : 'OK ' + res.page.id);
    continue;
  }
  const data = await gql(s.query, s.variables); const res = Object.values(data)[0];
  console.log(s.label, res.userErrors.length ? 'NG ' + JSON.stringify(res.userErrors) : 'OK');
}
console.log('入れた後：公開ページ /policies/<種類> と /pages/contact を共通 Chrome で開き、日数・返金額・店名が書類と同じか確かめる。');
