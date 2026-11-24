#!/usr/bin/env node
// 会社・ストア・商品の3つの設定から、特商法の表記と各ポリシーを Markdown と HTML で出す。
// 使い方:
//   node render.mjs --operator <運営者情報.json> --store <ストア情報.json> --product <商品の決まり.json> --out <出す場所> [--accept-defaults] [--templates <ひな形の場所>]
// 足りない値があれば、書類は出さずに「聞くこと」を出して止まる（終了コード 2）。
// --accept-defaults は、運営者が「初期値でよい」と答えた後だけ付ける（付けると、聞いていない値も初期値で埋まる）。
import fs from 'node:fs';
import path from 'node:path';
import { HERE, loadJson, loadQuestions, renderDocs } from './lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]); return a;
}, []));
for (const k of ['operator', 'store', 'product', 'out']) if (!args[k]) { console.error(`--${k} が要る`); process.exit(1); }

// ひな形の場所：仮ハーネスでは skills/ec-ad-ops/templates/store-legal、本物では ~/.agents/skills/ec-ad-ops/templates/store-legal
const TPL = args.templates || [
  path.resolve(HERE, '../templates/store-legal'), // アプリに同梱した置き場（harness-tools/templates/store-legal）
  path.resolve(HERE, '../../templates/store-legal'),
  path.resolve(HERE, '../../skills/ec-ad-ops/templates/store-legal'),
].find(p => fs.existsSync(p));
if (!TPL) { console.error('ひな形が見つからない。--templates で場所を渡す'); process.exit(1); }

export { DOCS } from './lib.mjs';

const profiles = { operator: loadJson(args.operator), store: loadJson(args.store), product: loadJson(args.product) };
const questions = loadQuestions();
const { ctx, missing, usedDefaults, made, problems, index } = renderDocs(profiles, { templatesDir: TPL, acceptDefaults: !!args['accept-defaults'], questions });

if (missing.length) {
  console.log(`書類を出せません。足りない値が ${missing.length} 個あります。運営者に、まとめて1回で聞いてください。\n`);
  for (const lv of ['会社', 'ストア', '商品']) {
    const qs = missing.filter(q => q.level === lv); if (!qs.length) continue;
    console.log(`■ ${lv}`);
    for (const q of qs) {
      const def = q.default !== undefined ? `（初期値：${typeof q.default === 'object' ? JSON.stringify(q.default) : q.default}）` : '';
      const sug = q.key === 'operator.court' && ctx.c.court_suggestion ? `（案：${ctx.c.court_suggestion}）` : '';
      console.log(`・${q.q}${def}${sug}${q.invalid !== undefined ? `　※今の値「${q.invalid}」は形が合わない` : ''}\n　　[${q.key}] ${q.why}`);
    }
    console.log('');
  }
  process.exit(2);
}

fs.mkdirSync(args.out, { recursive: true });
for (const d of made) {
  fs.writeFileSync(path.join(args.out, d.file + '.md'), d.md);
  fs.writeFileSync(path.join(args.out, d.file + '.html'), d.html);
}
fs.writeFileSync(path.join(args.out, 'index.json'), JSON.stringify(index, null, 1));
console.log(`出した書類 ${made.length} 個 → ${args.out}`);
if (usedDefaults.length) console.log(`初期値で埋めた値 ${usedDefaults.length} 個（運営者が確かめるまで仮）：${usedDefaults.join(', ')}`);
if (problems.length) { console.log('点検で見つかった事：\n・' + problems.join('\n・')); process.exit(3); }
console.log('点検：問題なし');
