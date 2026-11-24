// liquid/<通>.liquid を、決まった見本のカートで描いて rendered/ に書く。check.py がこれにも K2〜K4 をかける
// 使い方: node liquid描く.mjs <作業場>
// 見本は3つ: a=専用コードが期限内 / b=専用コードの期限が過ぎた / c=専用コードが無い（Flow が書けなかった）
// 描いた後に {{ や {% が残る・「様」の前が空・「合計」の後ろが空なら終了コード1。liquidjs が無い・読めないなら2
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';

const require = createRequire(process.env.ZG_REQUIRE_FROM || import.meta.url);   // アプリ：アプリの中の部品
let Liquid;
try { ({ Liquid } = require('liquidjs')); } catch { console.error('道具が無い: cd （社内の Mac の道） && npm i liquidjs@10.21.0'); process.exit(2); }

const work = path.resolve((process.argv[2] || '').replace(/^[~]/, os.homedir()));
const LIQ = path.join(work, 'liquid'), OUT = path.join(work, 'rendered');
if (!process.argv[2] || !fs.existsSync(LIQ)) { console.error('使い方: node liquid描く.mjs <作業場>（先に build.mjs）'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const eng = new Liquid();
eng.registerFilter('money', (v) => '¥' + Math.round(Number(v) / 100).toLocaleString('ja-JP')); // Shopify の money は銭（100分の1）で受ける
const now = Math.floor(Date.now() / 1000);
const item = (t, v, q) => ({ image_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', product_title: t, variant_title: v, quantity: q });
const base = {
  unsubscribe_url: '#unsubscribe',
  abandoned_checkout: { url: 'https://example.com/checkouts/abc', subtotal_price: 2389000,
    line_items: [item('見本の商品 とても長い商品名のセット（10枚組・洗濯ネットつき）', 'クラシック / LL', 1), item('見本の付属品', '1個', 2)] },
};
const cases = {
  a: { ...base, customer: { last_name: '佐藤', first_name: '花子', metafields: { kagoochi: { code4: 'MIHON-A1', deadline4: '10月23日（金）23時59分', deadline4_at: now + 86400 } } } },
  b: { ...base, customer: { last_name: '佐藤', first_name: '花子', metafields: { kagoochi: { code4: 'MIHON-OLD', deadline4: '9月1日（月）23時59分', deadline4_at: now - 86400 } } } },
  c: { ...base, customer: { last_name: '', first_name: '', metafields: {} } },
};
let bad = 0;
for (const f of fs.readdirSync(LIQ).filter((x) => x.endsWith('.liquid')).sort()) {
  const k = f.replace('.liquid', '');
  const src = fs.readFileSync(path.join(LIQ, f), 'utf8');
  for (const [c, ctx] of Object.entries(cases)) {
    let html;
    try { html = await eng.parseAndRender(src, ctx); } catch (e) { console.error(`${k}_${c}: 描けない ${e.message}`); bad++; continue; }
    const txt = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '');
    const errs = [];
    if (/\{\{|\{%/.test(html)) errs.push('Liquid の書き方が残った');
    if (/(^|\s)様/.test(txt.replace(/\s+/g, ' ')) && !/お客様/.test(txt)) errs.push('「様」の前が空');
    if (/合計\s*$/m.test(txt) || /合計\s*¥NaN/.test(txt)) errs.push('「合計」の後ろが空');
    if (c === 'b' && /MIHON-OLD|9月1日/.test(txt)) errs.push('期限の過ぎたコードが出た（偽の締切）');
    if (errs.length) { console.error(`${k}_${c}: ${errs.join('・')}`); bad++; }
    fs.writeFileSync(path.join(OUT, `${k}_${c}.html`), html);
  }
}
console.log(bad ? `× ${bad}件` : `ok → ${OUT}`);
process.exit(bad ? 1 : 0);
