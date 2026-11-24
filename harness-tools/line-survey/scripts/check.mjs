// survey.json の検査。0件になるまで本人に見せない・出さない。
// 使い方: node scripts/check.mjs <survey.json> [--img <画像フォルダ>] [--deploy]
//   既定（設計の検査）：形・LINE の上限・押せる道を全部たどった時の返事。画像の抜けと仮の値は「注意」で数える
//   --deploy（出す前）：画像の抜け・仮の値も「だめ」にする
// LINE の上限（Messaging API リファレンス）：ボタンの字 40・postback の data 300・displayText 300・altText 400・
// カルーセル 12枚・1回の返事 5通・URI 1000字（https だけ）・bubble 30KB・カルーセル 50KB・リッチメニューの字 14・画像 1MB 以下の JPEG/PNG
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { createBot } from '../lib/engine.js';
const R = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = process.argv[2]; if (!src) { console.error('使い方: node scripts/check.mjs <survey.json> [--img <dir>] [--deploy]'); process.exit(2); }
const DEPLOY = process.argv.includes('--deploy');
const cfg = JSON.parse(fs.readFileSync(src, 'utf8'));
const ii = process.argv.indexOf('--img'); const imgDir = ii > 0 ? process.argv[ii + 1] : (cfg.images?.source_dir || path.join(path.dirname(src), 'img'));
let combos, files, paths = 0, maxPb = 0, maxUri = 0; const replies = [];
const bad = [], warn = []; const no = m => bad.push(m); const care = m => (DEPLOY ? bad : warn).push(m);

// ---- 1. 形（schema/survey.schema.json の必須と同じ）----
const schema = JSON.parse(fs.readFileSync(path.join(R, 'schema/survey.schema.json'), 'utf8'));
function need(obj, sch, at) {
  if (!sch || obj === undefined) return;
  if (sch.type === 'object' && sch.properties) {
    if (obj === null) { if (!(sch.nullable)) no(`${at}: null は使えない`); return; }
    for (const k of sch.required || []) if (obj[k] === undefined) no(`${at}.${k} が無い`);
    for (const [k, s] of Object.entries(sch.properties)) need(obj[k], s, `${at}.${k}`);
  }
  if (sch.type === 'array' && Array.isArray(obj) && sch.items) obj.forEach((x, i) => need(x, sch.items, `${at}[${i}]`));
  if (sch.type === 'array' && !Array.isArray(obj)) no(`${at}: 配列でない`);
  if (sch.pattern && typeof obj === 'string' && !new RegExp(sch.pattern).test(obj)) no(`${at}: 形が違う（${obj}）`);
}
need(cfg, schema, 'survey');
const FIT = cfg.mode === 'fit_check';
// mode ごとの必須（schema の allOf の if/then/else）
for (const r of schema.allOf || []) { const hit = r.if?.properties?.mode?.const === cfg.mode; for (const k of (hit ? r.then : r.else)?.required || []) if (cfg[k] === undefined) no(`survey.${k} が無い（mode: ${cfg.mode || 'diagnosis'}）`); }
if (FIT && cfg.fit) need(cfg.fit, schema.properties.fit, 'survey.fit');
if (bad.length) report();
if (bad.length) { report(); }

// ---- 2. 中身の決まり ----
const Q = cfg.questions; const RESERVED = ['s', 'w', 'ws', 'g', 'sub'];
const keys = Q.map(q => q.key);
if (new Set(keys).size !== keys.length) no('問いの key が重なっている');
for (const k of keys) if (RESERVED.includes(k)) no(`問いの key「${k}」は Bot が使う名前（${RESERVED.join('・')}）`);
if (Q.length < 2 || Q.length > 6) no(`問いの数 ${Q.length}（2〜6。元の店は4。多いと離脱する）`);
const L = (s, n, what) => { if ([...String(s)].length > n) no(`${what}「${s}」が${[...String(s)].length}字（上限${n}）`); };
for (const q of Q) {
  if (q.opts.length < 2 || q.opts.length > 6) no(`問い ${q.key} の選択肢 ${q.opts.length}（2〜6）`);
  for (const [v, l] of q.opts) { L(l, 40, 'ボタンの字'); if (!/^[a-z0-9]{1,10}$/.test(v)) no(`選択肢の値「${v}」は英小文字・数字10字まで（postback に入る）`); }
  L(q.head.replace('{name}', 'ああああああああああさん'), 120, '問いの文');
}
if (cfg.worries.items.length > 6) no(`不安の数 ${cfg.worries.items.length}（6まで。1枚のカードに「次へ」と並ぶ）`);
for (const [k, l] of cfg.worries.items) { L(l, 40, 'ボタンの字'); if (!/^[a-z0-9_]{1,24}$/.test(k)) no(`不安の値「${k}」は英小文字・数字24字まで`); }
if (!FIT) {
for (const [k] of cfg.tools.items) if (!/^[a-z0-9_]{1,24}$/.test(k)) no(`対策の値「${k}」は英小文字・数字24字まで`);
if (cfg.tools.items.length > 12) no(`今の対策 ${cfg.tools.items.length}（カルーセルは12枚まで）`);
if (!cfg.worries.image) no('survey.worries.image が無い（診断の不安の答えの画像）');
}
if (cfg.offer.items.length > 12) no(`おすすめ ${cfg.offer.items.length}（カルーセルは12枚まで）`);
// ---- 2b. 相性チェック（fit_check）の決まり ----
const NG = /治る|治す|治り|治ります|完治|消える|消えます|改善します|効果があります|必ず効|医師が推奨|医師も/;
if (FIT) {
  const S = cfg._sources || {}; const A = cfg.worries.answers || {};
  for (const q of Q) for (const o of q.opts) {
    const m = o[2]; if (!m) continue;
    if (!['ok', 'warn', 'no'].includes(m.fit || 'ok')) no(`選択肢 ${q.key}.${o[0]} の fit は ok・warn・no のどれか`);
    if (m.reason) { L(m.reason, 60, '結果の理由'); if (NG.test(m.reason)) no(`言えない言葉（治る・消える など）：${q.key}.${o[0]}「${m.reason}」`); }
    if ((m.fit === 'no' || m.fit === 'warn') && !m.reason) no(`選択肢 ${q.key}.${o[0]} は ${m.fit} なのに理由（reason）が無い`);
    if ((m.fit === 'no' || m.fit === 'warn') && !S[`q.${q.key}.${o[0]}`]) care(`出典が無い：q.${q.key}.${o[0]}（合わない・注意の理由は A の「使えない人」の行を _sources に）`);
  }
  if (!Q.some(q => q.key === cfg.offer.size_key)) no(`サイズの問い（offer.size_key=${cfg.offer.size_key}）が無い。バリアントを答えから選べない`);
  for (const [k] of cfg.worries.items) {
    const a = A[k]; if (!a || !a.title || !(a.body || []).length) { no(`不安「${k}」の答え（worries.answers.${k} の title と body）が無い`); continue; }
    L(a.title, 40, '答えの見出し'); for (const t of a.body) { L(t, 120, '答えの本文'); }
    if (a.body.length > 4) no(`不安「${k}」の答えが${a.body.length}行（4行まで。短く）`);
    for (const t of [a.title, ...a.body]) if (NG.test(t)) no(`言えない言葉（治る・消える など）：worries.answers.${k}「${t}」`);
    if (/下書き/.test(a.note || '')) care(`不安「${k}」の答えが機械の下書きのまま（言葉を直す）`);
    if (!S[`worry.${k}`]) care(`出典が無い：worry.${k}（記事の残った疑い・FAQ・K・B の行と、答えの A の行を _sources に）`);
  }
  for (const t of [cfg.fit.head_ok, cfg.fit.head_no, ...(cfg.fit.fixed_reasons || [])]) if (NG.test(t || '')) no(`言えない言葉：fit「${t}」`);
  for (const s of [cfg.fit.continue_no, cfg.fit.stop_label]) L(s, 20, 'ボタンの字（決まり文句は20字まで）');
  if (Q.some(q => /困って|つらい|悩/.test(q.head))) care('相性チェックに悩みを聞く問いがある（悩みは VSL・記事・店で言い切っている。LINE は合うかだけ）');
}
for (const s of [cfg.copy.start_label, ...(FIT ? [] : [cfg.tools.button, cfg.compare.button]), cfg.coupon.button, cfg.offer.buy_label, cfg.worries.next_first, cfg.worries.next_more, ...(cfg.offer.ask ? [cfg.offer.ask.yes_label, cfg.offer.ask.no_label, cfg.offer.ask.info_label, cfg.offer.ask.yes_label_info].filter(Boolean) : [])]) L(s, 20, 'ボタンの字（決まり文句は20字まで）');
if (!FIT) for (const [k] of cfg.tools.items) if (!cfg.compare.costs?.[k]) no(`今の対策「${k}」の費用（compare.costs.${k}）が無い`);
for (const [k, c] of Object.entries(FIT ? {} : cfg.compare.costs || {})) {
  if (c.mode === 'chart' && !(c.per_year > 0)) no(`compare.costs.${k}: chart には per_year が要る`);
  if (c.mode === 'single' && !(c.total > 0)) no(`compare.costs.${k}: single には total が要る`);
  if (c.mode === 'note' && !c.note) no(`compare.costs.${k}: note には note が要る`);
  if (c.mode !== 'note' && !c.basis) no(`compare.costs.${k}: 数字の出どころ（basis）が無い`);
}
if (!/^https:\/\//.test(cfg.site.url) || !/^https:\/\//.test(cfg.public_url)) no('site.url と public_url は https');
if (cfg.richmenu) { L(cfg.richmenu.chatBarText, 14, 'リッチメニューの字'); if (cfg.richmenu.areas.length > 20) no('リッチメニューの押せる所は20まで'); }
for (const x of cfg._notes?.example_values || []) care(`仮の値：${x}`);

if (bad.length) report(); // 中身の決まりで止まったら、道はたどらない（壊れた設定で Bot が落ちるため）
// ---- 3. 押せる道を全部たどる（LINE には送らない。fetch を偽物にする）----
const sent = []; const fakeFetch = async (url, o = {}) => { sent.push({ url, body: o.body }); return new Response(JSON.stringify({ displayName: 'ああああああああああ' }), { status: 200 }); };
const bot = createBot(cfg, { env: { LINE_CHANNEL_SECRET: 'x', LINE_CHANNEL_ACCESS_TOKEN: 'x', LIFF_ID: process.env.LIFF_ID || cfg.line.liff_id || '2000000000-XXXXXXXX' }, fetch: fakeFetch, sleep: async () => {}, issueCoupon: async () => ({ code: cfg.coupon.prefix + 'ABCDEF' }), onReply: m => replies.push(m) });
import crypto from 'node:crypto';
const send = async e => { const b = JSON.stringify({ events: [e] }); const c = await bot.handle(b, crypto.createHmac('sha256', 'x').update(b).digest('base64')); if (c !== 200) no('署名つきの出来事が通らない'); return replies[replies.length - 1] || []; };
const acts = m => { const out = []; const w = o => { if (o && typeof o === 'object') { if (o.type === 'button' && o.action) out.push(o.action); Object.values(o).forEach(w); } }; w(m); return out; };
const pb = d => ({ type: 'postback', replyToken: 't', source: { userId: 'Ucheck' }, postback: { data: d } });
const seenData = new Set();
await send({ type: 'follow', replyToken: 't', source: { userId: 'Ucheck' } });
// 問いの組み合わせを全部
combos = Q.reduce((acc, q) => acc.flatMap(a => q.opts.map(([v]) => ({ ...a, [q.key]: v }))), [{}]);
const tail = async (data, chooseWorries) => {
  let m = await send(pb(data));
  if (chooseWorries) for (let i = 0; i < cfg.worries.items.length; i++) { const w = acts(m).filter(a => a.type === 'postback' && a.data.startsWith('s=w&')); if (!w.length) break; m = await send(pb(w[w.length - 1].data)); }
  const next = acts(m).find(a => a.type === 'postback' && a.data.startsWith('s=g0&')); if (!next) { no('不安のカードに「次へ」が無い'); return; }
  m = await send(pb(next.data));
  for (const t of acts(m).filter(a => a.type === 'postback' && a.data.startsWith('s=g&'))) {
    let m2 = await send(pb(t.data)); const cp = acts(m2).find(a => a.data?.startsWith('s=cp&')); m2 = await send(pb(cp.data));
    const u = acts(m2).find(a => a.data?.startsWith('s=u&')); m2 = await send(pb(u.data));
    const ends = [];
    if (acts(m2).some(a => a.type === 'uri')) ends.push(m2);
    for (const c of acts(m2).filter(a => a.type === 'postback' && /^s=c[yn]&/.test(a.data))) ends.push(await send(pb(c.data)));
    const cq = acts(m2).find(a => a.data?.startsWith('s=cq&')); if (cq) { const m3 = await send(pb(cq.data)); for (const c of acts(m3).filter(a => /^s=c[yn]&/.test(a.data || ''))) ends.push(await send(pb(c.data))); }
    for (const e of ends) { paths++; if (!acts(e).some(a => a.type === 'uri')) no('最後に購入ボタンが無い道がある'); }
    if (!chooseWorries) break; // 不安を全部選ぶ道でだけ、対策を全部たどる（数を抑える）
  }
};
// 相性チェックの道：結果 →（合わない人は「それでも見る」か「やめる」）→ 不安 → クーポン → 購入
const level = { ok: 0, warn: 0, no: 0 };
const fitTail = async (data, chooseWorries) => {
  let m = await send(pb(data));
  const d0 = acts(m).find(a => a.type === 'postback' && a.data.startsWith('s=d0&'));
  const x = acts(m).find(a => a.type === 'postback' && a.data.startsWith('s=x&'));
  if (d0) { level.no++; if (!x) no('合わない人のカードに「やめておく」が無い'); else { const e = await send(pb(x.data)); if (!e.length || e[0].type !== 'text') no('「やめておく」の返事が無い'); } m = await send(pb(d0.data)); }
  else { const card = m[0]; const txt = JSON.stringify(card); txt.includes('※') ? level.warn++ : level.ok++; const n = (txt.match(/"text":"\d\."/g) || []).length; if (n !== 3) no(`合う人の理由が${n}つ（3つにする。選択肢の reason か fit.fixed_reasons）：${data.slice(0, 80)}`); }
  if (chooseWorries) for (let i = 0; i < cfg.worries.items.length; i++) { const w = acts(m).filter(a => a.type === 'postback' && a.data.startsWith('s=w&')); if (!w.length) break; m = await send(pb(w[w.length - 1].data)); }
  const next = acts(m).find(a => a.type === 'postback' && a.data.startsWith('s=cp&')); if (!next) { no('不安のカードに「次へ」（クーポン）が無い'); return; }
  m = await send(pb(next.data)); const u = acts(m).find(a => a.data?.startsWith('s=u&')); if (!u) { no('クーポンのカードにボタンが無い'); return; }
  m = await send(pb(u.data)); paths++; if (!acts(m).some(a => a.type === 'uri')) no('最後に購入ボタンが無い道がある');
};
if (FIT) {
  for (const c of combos) await fitTail(`s=${Q.length}&${new URLSearchParams(c)}`, false);
  await fitTail(`s=${Q.length}&${new URLSearchParams(Object.fromEntries(Q.map(q => [q.key, q.opts.reduce((a, b) => (a[0].length >= b[0].length ? a : b))[0]])))}`, true);
  if (!level.ok) no('どの答えでも「合います」にならない');
} else {
for (const c of combos) { const last = Q.length; await tail(`s=${last}&${new URLSearchParams(c)}`, false); }
await tail(`s=${Q.length}&${new URLSearchParams(Object.fromEntries(Q.map(q => [q.key, q.opts.reduce((a, b) => (a[0].length >= b[0].length ? a : b))[0]])))}`, true);
}
// 返事ごとの上限
const imgs = new Set(); const vkeys = new Set();
for (const m of replies) {
  if (m.length > 5) no(`1回の返事が${m.length}通（5まで）`);
  for (const x of m) {
    if (x.type === 'flex') { L(x.altText, 400, 'altText'); const kb = Buffer.byteLength(JSON.stringify(x.contents)) / 1024; if (x.contents.type === 'carousel') { if (x.contents.contents.length > 12) no('カルーセルが12枚を超える'); if (kb > 50) no(`カルーセル ${kb.toFixed(1)}KB（50KBまで）`); } else if (kb > 30) no(`カード ${kb.toFixed(1)}KB（30KBまで）`); }
    if (x.type === 'image') imgs.add(x.originalContentUrl);
    const w = o => { if (o && typeof o === 'object') { if (o.type === 'image' && o.url) imgs.add(o.url); Object.values(o).forEach(w); } }; w(x);
    for (const a of acts(x)) {
      L(a.label, 40, 'ボタンの字');
      if (a.type === 'postback') { seenData.add(a.data); maxPb = Math.max(maxPb, Buffer.byteLength(a.data)); if (Buffer.byteLength(a.data) > 300) no(`postback が${Buffer.byteLength(a.data)}バイト（300まで）：${a.data.slice(0, 60)}…`); if (a.displayText) L(a.displayText, 300, 'displayText'); }
      if (a.type === 'uri') { maxUri = Math.max(maxUri, a.uri.length); if (a.uri.length > 1000) no(`購入リンクが${a.uri.length}字（1000まで）`); if (!/^https:\/\//.test(a.uri)) no('リンクが https でない'); const dec = decodeURIComponent(decodeURIComponent(a.uri)); if (/undefined/.test(dec)) no(`リンクに undefined（バリアントが引けない）：${dec.slice(0, 120)}`); vkeys.add(dec); }
    }
  }
}
if (sent.some(s => /message\/push|multicast|broadcast|narrowcast/.test(s.url))) no('プッシュ配信を使っている（通数を食う）');
// 画像の抜け
files = [...imgs].map(u => decodeURI(u.split('/img/')[1] || '').replace(/\?.*$/, '')).filter(Boolean);
const missing = files.filter(f => !fs.existsSync(path.join(imgDir, f)));
const extra = ['richmenu.jpg', cfg.popup?.banner].filter(Boolean).filter(f => !fs.existsSync(path.join(imgDir, f)));
if (missing.length) care(`画像が無い ${missing.length}/${files.length}枚（${imgDir}）：${missing.slice(0, 8).join(' ')}${missing.length > 8 ? ' …' : ''}`);
if (extra.length) care(`リッチメニュー・ポップアップの画像が無い：${extra.join(' ')}`);
for (const f of files.filter(f => fs.existsSync(path.join(imgDir, f)))) if (fs.statSync(path.join(imgDir, f)).size > 1024 * 1024) no(`画像 ${f} が1MBを超える（LINE の上限）`);
if (fs.existsSync(path.join(imgDir, 'richmenu.jpg')) && fs.statSync(path.join(imgDir, 'richmenu.jpg')).size > 1024 * 1024) no('richmenu.jpg が1MBを超える');
report();

function report() {
  if (FIT && combos && typeof level !== 'undefined') try { console.log(`相性チェック：合う ${level.ok}・注意つきで合う ${level.warn}・合わないかもしれない ${level.no}（答えの組み合わせごと）`); } catch {}
  try {
  console.log(`検査 ${cfg.id}${FIT ? '（相性チェック）' : ''}：問い ${cfg.questions?.length}・組み合わせ ${combos ? combos.length : '-'}・たどった道 ${paths}・返事 ${replies.length}回・ボタン ${seenData.size}種・画像 ${files ? files.length : '-'}種・postback 最長 ${maxPb}/300バイト・リンク最長 ${maxUri}/1000字`);
  } catch { console.log(`検査 ${cfg.id}：形の検査で止めた`); } // 形で止めた時は、道をたどる前なので数が無い
  const group = a => { const m = new Map(); for (const x of a) { const k = x.replace(/[:：].*$/, '').slice(0, 60) === x ? x : x; m.set(k, (m.get(k) || 0) + 1); } return [...m]; };
  for (const [w, n] of group(warn)) console.log('  注意: ' + w + (n > 1 ? `（ほか${n - 1}件）` : ''));
  const seen = new Map(); for (const b of bad) { const k = b.slice(0, 40); if (!seen.has(k)) seen.set(k, [b, 0]); seen.get(k)[1]++; }
  for (const [, [b, n]] of seen) console.log('  だめ: ' + b + (n > 1 ? `（同じ種類ほか${n - 1}件）` : ''));
  console.log(`だめ: ${bad.length}件${DEPLOY ? '（出す前の検査）' : '（設計の検査。画像の抜けと仮の値は注意。出す前は --deploy）'}`);
  process.exit(bad.length ? 1 : 0);
}
