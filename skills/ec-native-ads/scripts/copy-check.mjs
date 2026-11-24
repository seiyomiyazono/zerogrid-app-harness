#!/usr/bin/env node
// copy-check.mjs <file.md|file.html> — ネイティブ広告/アドバトリアル本文の機械検査
// 目視は品質保証にならない(人間のAI文判定精度31〜57%)。書き終わったら必ずこれを回す。
// 規格の正: references/jp-writing-style.md の機械検査チェックリスト1〜20
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: node copy-check.mjs <file.md|file.html>'); process.exit(1); }
let raw = fs.readFileSync(file, 'utf8');
if (/\.html?$/i.test(file)) {
  raw = raw.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '\n');
}

// --- 案の分割(「## 広告」「案N」「<!-- 案」等) -----------------------------
const splitRe = /^#{1,3}\s*(?:広告\s*\d+|案\s*\d+).*$/gm;
let ads = [];
const marks = [...raw.matchAll(splitRe)];
if (marks.length >= 2) {
  for (let i = 0; i < marks.length; i++) {
    const s = marks[i].index, e = i + 1 < marks.length ? marks[i + 1].index : raw.length;
    ads.push({ name: marks[i][0].replace(/^#+\s*/, '').trim(), text: raw.slice(s, e) });
  }
} else {
  ads = [{ name: file, text: raw }];
}

// --- 禁止パターン ----------------------------------------------------------
const BANS = [
  ['発明比喩(語り手が作った言い回し)', /音が下に降り|世界が遠くな|時が止ま|心が折れる音|闇に溶け|世界から音が消え/g],
  ['司会進行(コピーライターの声)',   /を書きます|話をさせてください。?$|(?:湧き|思い|感じ|考え)ませんか|答えは[^。]{0,12}でした|条件[はが][3-9]つ|順番に書き|結論から言うと、?私/g],
  ['記号箇条書き(AIっぽい)',        /^\s*[-*・]?\s*[✅✔☑■◆▶→▼]\s*\S/gm],
  ['売り手の口ぶり',                 /だからこその|ご用意して|用意しています|取り揃え|自信を持って|ぜひお試し/g],
  ['AI癖語',                         /重要です|魅力的|徹底的|と言えるでしょう|注目されて|いかがでしたか|実現し|活用し/g],
  ['開発者語り(禁止)',               /私が(?:開発|作った)|作った本人|弊社|当社|私たち(?:が|は|で)(?:開発|作|お届け|ご提供)/g],
];
const SOFT = [
  ['段落頭の接続詞(2回以上でNG)',    /^(また|さらに|一方で|そして)[、,]/gm, 2],
];

// --- 文単位の検査 ----------------------------------------------------------
const bodyOf = t => t
  .replace(/^#+.*$/gm, '').replace(/^\s*(CTA|推奨LP|ヘッドライン|語り手|構成メモ|HEADLINE)\s*[:：].*$/gm, '')
  .replace(/\*\*/g, '').trim();

const sentences = t => bodyOf(t).split(/(?<=[。?？!！])\s*/).map(s => s.trim()).filter(s => s.length > 1);

let fail = 0, warn = 0;
const bad = (ad, msg) => { fail++; console.log(`  ✗ [${ad}] ${msg}`); };
const soft = (ad, msg) => { warn++; console.log(`  ! [${ad}] ${msg}`); };

for (const ad of ads) {
  console.log(`\n=== ${ad.name} ===`);
  const body = bodyOf(ad.text);
  const ss = sentences(ad.text);
  console.log(`  本文 ${body.replace(/\s/g, '').length}字 / ${ss.length}文`);

  for (const [label, re] of BANS) {
    const hits = [...body.matchAll(re)].map(m => m[0].trim());
    if (hits.length) bad(ad.name, `${label}: ${[...new Set(hits)].slice(0, 6).join(' / ')} (${hits.length}件)`);
  }
  for (const [label, re, lim] of SOFT) {
    const n = [...body.matchAll(re)].length;
    if (n >= lim) soft(ad.name, `${label}: ${n}件`);
  }

  // 文末3連続
  const tail = s => (s.match(/(です|ます|でした|ました|ません|でしょう|だ|た|る|い|ね|よ|か)[。?？!！]$/) || [,'その他'])[1];
  for (let i = 0; i + 2 < ss.length; i++) {
    const [a, b, c] = [tail(ss[i]), tail(ss[i + 1]), tail(ss[i + 2])];
    if (a === b && b === c && a !== 'その他') { bad(ad.name, `同一文末3連続「${a}」: ${ss[i].slice(0, 18)}…`); break; }
  }

  // 読点ゼロ文の比率
  const zero = ss.filter(s => !s.includes('、')).length / (ss.length || 1);
  if (zero < 0.25) soft(ad.name, `読点ゼロ文が${Math.round(zero * 100)}%(基準25%以上) → 読点を間引く`);

  // 必須要素
  const must = [
    ['打消し表示', /個人の感想|個人差/],
    ['P.S.',      /P\.?\s?S\.?/i],
    ['P.P.S.',    /P\.?\s?P\.?\s?S\.?/i],
    ['伝聞ヘッジ', /そうです|らしい|と言われて|と出てきま/],
  ];
  for (const [label, re] of must) if (!re.test(ad.text)) bad(ad.name, `${label}が無い`);
}

// --- 文体リズム(ファイル全体・参考値) ---------------------------------------
{
  const all = ads.map(a => bodyOf(a.text)).join('\n');
  const ss = all.split(/(?<=[。?？!！])\s*/).map(s => s.trim()).filter(s => s.length > 1);
  const L = ss.map(s => s.length);
  const frag = L.filter(x => x <= 12).length, longs = L.filter(x => x > 90).length;
  const med = L.slice().sort((a, b) => a - b)[Math.floor(L.length / 2)];
  console.log(`\n=== 文体リズム(全体) ===\n  ${ss.length}文 / 中央値${med}字 / 破片文(12字以下)${frag}本 / 90字超${longs}本`);
  if (frag / ss.length < 0.05) soft('全体', '破片文が5%未満 → 転換点に「勝てませんでした。」型の一文段落を足す');
  if (longs === 0) soft('全体', '90字超の暴走長文が0本 → 感情ピークに1本だけ入れる');
  if (!/いや、|というか、|正確には|……いや/.test(all)) soft('全体', '自己訂正が0 → 「3日目……いや、正確には4日目かな」型を1つ');
}

// --- 案どうしの重複(冒頭差し替えの検出) -----------------------------------
// 行の完全一致では言い換えを取りこぼすので、文字8-gramの重なりで測る
if (ads.length >= 2) {
  console.log(`\n=== 案間の重複(文字8-gram) ===`);
  const shingles = ad => {
    const t = bodyOf(ad.text).replace(/\s/g, '');
    const S = new Set();
    for (let i = 0; i + 8 <= t.length; i++) S.add(t.slice(i, i + 8));
    return S;
  };
  const cache = ads.map(shingles);
  for (let i = 0; i < ads.length; i++) for (let j = i + 1; j < ads.length; j++) {
    const A = cache[i], B = cache[j];
    const shared = [...A].filter(g => B.has(g)).length;
    const r = shared / Math.min(A.size, B.size || 1);
    const msg = `${ads[i].name} × ${ads[j].name}: 重複 ${Math.round(r * 100)}%`;
    if (r > 0.30) { fail++; console.log(`  ✗ ${msg} → 冒頭差し替えになっている。発見の経路・感情の山・行動の変化まで別にする`); }
    else console.log(`  ○ ${msg}`);
  }
}

console.log(`\n${fail === 0 ? '合格' : `不合格 ${fail}件`}${warn ? ` / 要確認 ${warn}件` : ''}`);
process.exit(fail ? 1 : 0);
