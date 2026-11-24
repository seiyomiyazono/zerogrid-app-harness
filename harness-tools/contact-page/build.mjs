#!/usr/bin/env node
// お問い合わせページのテンプレートを、店・商品の値で埋める（Liquid の {{ }} はそのまま残す）。
// 使い方: node build.mjs --operator <運営者情報.json> --store <ストア情報.json> --product <商品の決まり.json> --out <page.zg-contact.liquid> [--preview <見本.html>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = [process.env.STORE_LEGAL_LIB, path.join(HERE, '../store-legal/lib.mjs')].filter(Boolean).find(p => fs.existsSync(p));
const { loadJson, resolve, buildContact, contactPreview } = await import(LIB);
const A = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => { if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1]]); return a; }, []));
for (const k of ['operator', 'store', 'product', 'out']) if (!A[k]) { console.error(`--${k} が要る`); process.exit(1); }
const { ctx, missing } = resolve({ operator: loadJson(A.operator), store: loadJson(A.store), product: loadJson(A.product) });
if (missing.length) { console.error('足りない値があるので作らない（tools/store-legal/render.mjs で何を聞くか出る）：' + missing.map(q => q.key).join(', ')); process.exit(2); }
const out = buildContact(ctx, path.join(HERE, 'page.zg-contact.liquid.tmpl'));
fs.writeFileSync(A.out, out);
console.log('作った：', A.out, `（種類 ${(out.match(/<option value="[^"]/g) || []).length} 個）`);
if (A.preview) {
  fs.writeFileSync(A.preview, contactPreview(out));
  console.log('見本：', A.preview);
}
