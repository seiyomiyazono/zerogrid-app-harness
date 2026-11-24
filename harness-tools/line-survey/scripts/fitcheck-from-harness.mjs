// 商品フォルダ（newec_harness/<商品>/）から、相性チェック（mode: fit_check）の survey.json を組む。
// 使い方: node scripts/fitcheck-from-harness.mjs <商品フォルダ> --out <survey.json> [--base <今の survey.json>] [--id <英字id>] [--llm auto|on|off] [--pack <出典の束.json>]
//   1. 機械の部分（毎回同じ結果）：出典を探して行番号つきで束ねる → 問い（A の 使い方の場面・サイズ・使えない人 の表から）
//      → 不安（記事の「残った疑い」・記事の よくある質問・店の設計の疑い・B ⑤の壁・K の壁）→ 答え（FAQ の答え、無ければ A の近い行）
//      → 店・LINE・値段・画像の値は --base（無ければ --out の今の物）から引き継ぐ
//   2. 言葉（claude -p があれば）：機械の下書きの字だけを、やさしい短い日本語に直す。キー・値・出典は変えさせない。だめなら下書きのまま
//   3. 書いた後に scripts/check.mjs を回す（呼ぶ側で）
// 手順と決まりは scripts/survey-from-harness.md の「相性チェック」。
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const R = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv = process.argv.slice(2); const flag = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const DIR = argv[0]; const OUT = flag('--out');
if (!DIR || !OUT || !fs.existsSync(DIR)) { console.error('使い方: node scripts/fitcheck-from-harness.mjs <商品フォルダ> --out <survey.json> [--base <survey.json>] [--id <id>] [--llm auto|on|off]'); process.exit(2); }
const LLM = flag('--llm', 'auto'); const CLAUDE = process.env.CLAUDE_BIN || 'claude'; // アプリから呼ぶ時は置き場を渡す
const rel = f => path.relative(DIR, f);
const read = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '');
const lines = f => read(f).split('\n');
const first = (dir, re) => { if (!fs.existsSync(dir)) return null; const f = fs.readdirSync(dir).find(x => re.test(x)); return f ? path.join(dir, f) : null; };
const walk = (d, re, out = []) => { if (!fs.existsSync(d)) return out; for (const x of fs.readdirSync(d)) { const p = path.join(d, x); if (x.startsWith('_') || x.startsWith('.') || /^審査/.test(x)) continue; /* 下書き・審査の写しは数えない */ if (fs.statSync(p).isDirectory()) walk(p, re, out); else if (re.test(x)) out.push(p); } return out; };
const cut = (s, n) => { const a = [...String(s)]; return a.length <= n ? String(s) : a.slice(0, n - 1).join('') + '…'; };
const clean = s => String(s).replace(/\*\*/g, '').replace(/`/g, '').trim();
const bigrams = s => { const t = String(s).replace(/[\s、。・「」（）()？?！!:：,.]/g, ''); const o = new Set(); for (let i = 0; i < t.length - 1; i++) o.add(t.slice(i, i + 2)); return o; };
const sim = (a, b) => { const A = bigrams(a), B = bigrams(b); if (!A.size || !B.size) return 0; let n = 0; for (const x of A) if (B.has(x)) n++; return n / Math.min(A.size, B.size); };
const src = (file, line, text) => ({ file: rel(file), line, text: cut(clean(text), 160) });

// ---- 1. 出典を探す ----
const BASE_DIR = path.join(DIR, '01_商品理解の基盤');
const F = {
  A: first(BASE_DIR, /^A_/), B: first(BASE_DIR, /^B_/), E: first(BASE_DIR, /^E_/), G: first(BASE_DIR, /^G_/),
  K: path.join(BASE_DIR, 'K_ペルソナ'), store: walk(path.join(DIR, '08_店'), /^店の設計\.md$/),
  ports: walk(path.join(DIR, '07_納品', '記事'), /^移植表\.md$/), faqs: walk(path.join(DIR, '07_納品', '記事'), /^(コメント欄|index|本文)\.html$/),
};
if (!F.A) { console.error('A_商品の事実.md が無い（工程1の商品理解が要る）'); process.exit(1); }
const pack = { product: path.basename(DIR), read: [], doubts: [], facts: {} };

// markdown の表：見出し（# …）の下の表を {head, rows:[{cells, line}]} で
function tables(file) {
  const L = lines(file); const out = []; let sec = '', cur = null;
  L.forEach((l, i) => {
    if (/^#/.test(l)) sec = l.replace(/^#+\s*/, '');
    if (/^\|/.test(l)) { const cells = l.split('|').slice(1, -1).map(c => c.trim()); if (!cur) { cur = { sec, head: cells, rows: [] }; out.push(cur); } else if (!cells.every(c => /^:?-+:?$/.test(c))) cur.rows.push({ cells, line: i + 1 }); }
    else cur = null;
  });
  return out;
}
const AT = tables(F.A); pack.read.push(rel(F.A));
const row = (secRe, nameRe) => { for (const t of AT) if (secRe.test(t.sec)) for (const r of t.rows) if (nameRe.test(r.cells[0])) return { ...r, head: t.head }; return null; };

// ---- 2. 不安の候補（重い順） ----
const cand = []; // {label, from:[src], score, answer?:{body, src}}
function addDoubt(label, s, score, answer) {
  label = clean(label).replace(/[「」『』]/g, '').replace(/[：:].*$/, ''); if (!label || /値段|価格|いくら/.test(label)) { if (label) pack.doubts.push({ label, skipped: '値段はおすすめのカードで出す' }); return; }
  const hit = cand.find(c => sim(c.label, label) >= 0.34 || (answer && c.answer && sim(c.answer.body.join(''), answer.body.join('')) >= 0.6));
  if (hit) { hit.from.push(s); hit.score += score; if (!hit.answer && answer) hit.answer = answer; return; }
  cand.push({ label, from: [s], score, answer });
}
for (const f of F.ports) { // 記事の移植表「見終わった人の状態」の「残った疑い」
  pack.read.push(rel(f)); lines(f).forEach((l, i) => { if (/^\|\s*残った疑い\s*\|/.test(l)) for (const m of l.matchAll(/「([^」]{3,40})」/g)) addDoubt(m[1], src(f, i + 1, l), 3); });
}
for (const f of F.store) { // 店の設計.md の疑いの表（| 疑い | 重さ | …）
  pack.read.push(rel(f)); for (const t of tables(f)) if (t.head[0] && /疑い/.test(t.head[0])) for (const r of t.rows) addDoubt(r.cells[0], src(f, r.line, r.cells.join(' ')), 4 - Math.min(3, Number(r.cells[1]) || 3));
}
for (const f of F.faqs) { // 記事・店の「よくある質問」（h3 と p の組）
  const s = read(f); const at = s.indexOf('よくある質問'); if (at < 0) continue; pack.read.push(rel(f));
  const lineOf = needle => s.slice(0, s.indexOf(needle)).split('\n').length;
  let n = 0;
  for (const m of s.slice(at).matchAll(/<h3[^>]*>(.*?)<\/h3>\s*<p[^>]*>(.*?)<\/p>/gs)) {
    const q = m[1].replace(/<[^>]+>/g, ''), a = m[2].replace(/<[^>]+>/g, ''); n++;
    if (/合わなかったら|返金|返品/.test(q)) { pack.facts.guarantee = { text: a, src: src(f, lineOf(m[0]), a) }; continue; }
    const body = a.split(/(?<=。)/).map(x => x.trim()).filter(Boolean).slice(0, 3);
    addDoubt(q, src(f, lineOf(m[0]), q + ' ' + a), Math.max(0.5, 2 - n * 0.2), { body, src: src(f, lineOf(m[0]), a) });
  }
}
if (F.B) { // B ⑤ の「壁」
  pack.read.push(rel(F.B)); let inWall = false;
  lines(F.B).forEach((l, i) => { if (/^\*\*壁/.test(l)) inWall = true; else if (/^#|^\*\*/.test(l)) inWall = false; else if (inWall && /^- /.test(l)) addDoubt(l.replace(/^- /, '').replace(/（.*$/, ''), src(F.B, i + 1, l), 2); });
}
if (fs.existsSync(F.K)) for (const f of walk(F.K, /\.md$/)) { // K の「壁」（記事を押した一番の理由など）
  lines(f).forEach((l, i) => { const m = l.match(/\*\*壁\*\*[：:]\s*「([^」]+)」/); if (m) addDoubt(m[1], src(f, i + 1, l), 2); });
}
// 答えが無い疑いは、A の行から一番近い物を下書きにする（言葉は 3. で直す）
// 探すのは A の「使い方」「仕組み」の章と E の日本語の行だけ（英語の原文・和訳の行は答えにしない）
const secLines = (f, re) => { let on = false; return lines(f).map((t, i) => { if (/^#/.test(t)) on = re.test(t); return on ? { t, i: i + 1, f } : null; }).filter(Boolean); };
const Alines = [...secLines(F.A, /使い方|仕組み/), ...(F.E ? secLines(F.E, /強み|他にない/) : [])]
  .filter(x => x.t.length > 20 && !/^#|^\|\s*-|和訳|原文/.test(x.t) && (x.t.match(/[A-Za-z]/g) || []).length < x.t.length * 0.2);
for (const c of cand) if (!c.answer) {
  const top = Alines.map(x => ({ ...x, s: sim(c.label, x.t) })).sort((a, b) => b.s - a.s).slice(0, 5); const best = top[0];
  c.more = top.slice(1).map(x => src(x.f, x.i, x.t)); // 言葉を直す時に、近い行を5つまで見せる（答えはこの中の事実だけ）
  if (best) { const t = clean(best.t.replace(/^[-\d.\s]+/, '').replace(/^\|/, '')); const parts = t.split(/(?<=。)/).filter(Boolean); c.answer = { body: parts.slice(0, 2).map(x => cut(x, 110)), src: src(best.f, best.i, best.t), draft: true }; }
}
cand.sort((a, b) => b.score - a.score);

// ---- 3. 問い（A の表から。合わない人は A の「使えない人」の行だけ） ----
const Q = []; const S = {};
const put = (k, v) => { S[k] = [...(S[k] || []), v]; };
const kAngles = fs.existsSync(path.join(F.K, '_一覧.md')) ? [...read(path.join(F.K, '_一覧.md')).matchAll(/^\|\s*([^|_]+)_[^|]*\|/gm)].map(m => m[1].trim()).filter(x => !/アングル|-/.test(x)) : [];
{ // 使う場所（A-4 の場面の表のうち、置き場所が書いてある行）
  const t = AT.find(t => /使い方/.test(t.sec) && /場面/.test(t.head[0] || '') && /置く/.test(t.head[1] || ''));
  if (t) {
    const rows = t.rows.filter(r => r.cells[1] && r.cells[1] !== '—' && !/サイズ/.test(r.cells[0]));
    const order = r => { const i = kAngles.findIndex(a => r.cells[0].includes(a) || (a === '在宅デスク' && /在宅|デスク/.test(r.cells[0]))); return i < 0 ? 99 : i; };
    const opts = [...rows].sort((a, b) => order(a) - order(b)).slice(0, 5).map((r, i) => {
      const lab = r.cells[0].replace(/（.*?）/g, '').trim(); const v = 'p' + (i + 1);
      put(`q.a.${v}`, src(F.A, r.line, r.cells.join(' ')));
      return [v, cut(lab, 20), { fit: 'ok', reason: cut(`${lab}の、立つ所の足元に置いて使えます`, 60) }];
    });
    opts.push(['other', 'その他', { fit: 'ok', reason: '立つ所の足元に置くだけで使えます' }]);
    Q.push({ key: 'a', head: '{name}が、いちばん長く立つ場所は？', in_reasons: false, opts }); // 場所は割引の名前に残して B に戻す。理由はサイズ・足元・床から
  }
}
{ // サイズ（A-3 の「対象の身長」の行と、表の頭の型の名前）
  const r = row(/仕様/, /身長/);
  if (r) {
    const cm = s => [...s.matchAll(/約?(\d{3})cm/g)].map(m => Number(m[1]));
    const cols = r.head.slice(1).map((h, i) => ({ h, v: r.cells[i + 1] || '', key: /mini/i.test(h) ? 'mini' : 'orig' }));
    const small = cols.find(c => c.key === 'mini'), big = cols.find(c => c.key === 'orig');
    if (small && big) {
      const lo = cm(small.v)[0], hi = cm(small.v)[1] || cm(big.v)[1];
      put('q.z', src(F.A, r.line, r.cells.join(' ')));
      const sizeRow = row(/使い方/, /サイズ/); if (sizeRow) put('q.z', src(F.A, sizeRow.line, sizeRow.cells.join(' ')));
      const opts = [['mini', `${lo}cm以下`, { fit: 'ok', reason: `身長${lo}cm以下なので、小さい方（Mini）が合う大きさです` }],
        ['orig', hi ? `${lo + 1}〜${hi - 1}cm` : `${lo + 1}cm以上`, { fit: 'ok', reason: `身長${lo + 1}cm以上なので、大きい方（Original）が合う大きさです` }]];
      if (hi) { opts.push(['big', `${hi}cm以上`, { fit: 'warn', reason: `${hi}cm以上だと、大きい方でも小さく感じるかもしれません` }]); put('q.z.big', src(F.A, r.line, r.cells.join(' '))); }
      Q.push({ key: 'z', head: '身長は？（マットの大きさを選びます）', opts });
    }
  }
}
{ // 足元（A-6 の「靴」の行・A-4 の 靴あり／靴下／素足 の行）
  const shoe = row(/使えない/, /^靴$/); const has = n => row(/使い方/, new RegExp('^' + n));
  const opts = [];
  if (has('靴あり')) { opts.push(['shoes', '靴（スニーカー・支給の靴）', { fit: 'ok', reason: '靴のまま乗れます。靴の時が一番合うという声もあります' }]); put('q.k.shoes', src(F.A, has('靴あり').line, has('靴あり').cells.join(' '))); }
  if (/安全靴|工場/.test(read(F.A))) opts.push(['safety', '安全靴', { fit: 'ok', reason: '安全靴のままでも使えます' }]);
  if (has('靴下') || has('素足')) { opts.push(['socks', '靴下・素足', { fit: 'ok', reason: '靴下でも素足でも乗れます' }]); put('q.k.socks', src(F.A, (has('靴下') || has('素足')).line, (has('靴下') || has('素足')).cells.join(' '))); }
  if (shoe && /ハイヒール|ヒール/.test(shoe.cells.join(''))) { opts.push(['heel', 'ヒールのある靴', { fit: 'no', reason: 'ヒールのある靴では使えません（表面に傷がつきます）' }]); put('q.k.heel', src(F.A, shoe.line, shoe.cells.join(' '))); }
  if (opts.length >= 2) Q.push({ key: 'k', head: 'ふだん、足元は？', opts });
}
{ // 床（A-6 の「床」の行・A-3 の「床への接し方」）
  const fl = row(/使えない/, /^床$/), touch = row(/仕様/, /床/);
  const opts = [['hard', '硬い床（木・タイル・コンクリート）', { fit: 'ok', reason: '硬い床でも、乗っている時は動きません' }]];
  if (touch) put('q.f.hard', src(F.A, touch.line, touch.cells.join(' ')));
  if (touch && /カーペット/.test(touch.cells.join(''))) opts.push(['carpet', '毛足の短いカーペット', { fit: 'ok', reason: '毛足の短いカーペットの上でも使えます' }]);
  if (fl && /シャギー|毛足/.test(fl.cells.join(''))) { opts.push(['shaggy', '毛足の長いラグ', { fit: 'warn', reason: '毛足の長いラグだと、縁が引っかかる事があります' }]); put('q.f.shaggy', src(F.A, fl.line, fl.cells.join(' '))); }
  if (opts.length >= 2) Q.push({ key: 'f', head: '置く所の床は？', opts });
}
const weight = row(/使えない/, /体重/); if (weight) pack.facts.weight = src(F.A, weight.line, weight.cells.join(' '));

// ---- 4. 組む（店・LINE・値段・画像は前の設定から） ----
const basePath = flag('--base') || (fs.existsSync(OUT) ? OUT : null);
const base = basePath ? JSON.parse(fs.readFileSync(basePath, 'utf8')) : {};
const id = flag('--id', base.id || 'product');
const days = (pack.facts.guarantee?.text.match(/(\d+)日間?の返金保証/) || [])[1];
const doubts = cand.slice(0, 6).map((c, i) => ({ ...c, key: 'd' + (i + 1) }));
const keep = (k, d) => (base[k] !== undefined ? base[k] : d);
const cfg = {
  ...(path.resolve(OUT).startsWith(R + path.sep) ? { $schema: path.relative(path.dirname(path.resolve(OUT)), path.join(R, 'schema/survey.schema.json')) } : {}), // 道具の中に書く時だけ
  id, name: keep('name', path.basename(DIR)), mode: 'fit_check',
  _notes: {
    made_by: `scripts/fitcheck-from-harness.mjs（${new Date().toISOString().slice(0, 10)}）。問いと不安は商品フォルダの出典から機械で組み、言葉は ${'{LLM}'}`,
    direction: '運営者 2026-10-20「LINE は最後の最後の不安だけ。本当にあなたに合うのかを確かめて、クーポンを渡す」。悩みは聞かない',
    read: pack.read, skipped: pack.doubts,
    example_values: [...new Set([...(base._notes?.example_values || (basePath ? [] : ['brand.* — ブランド名・色は未定（仮）', 'line.* / public_url / site.url — まだ LINE も店も無い', 'variants.* — 仮の番号。店ができたら scripts/pull-variants.mjs で取り直す', 'offer.prices — 記事の値段の段の値（他のサイズも同じ値で仮）'])).filter(x => !/compare|tools|worries の答え/.test(x)), '不安の答え — 同型の事実（A）と記事の FAQ から。仕入れ品の仕様が来たら確かめて直す', ...(base.mode !== 'fit_check' ? ['images.banner — ポップアップのバナーの字を「買う前に、あなたに合うか30秒でチェック」で作り直す（images/gen.mjs --only popup。前の診断の字のままなら出さない）'] : [])])],
  },
  _sources: {},
  brand: keep('brand', { name: '（ブランド名 未定）', logo: null, wordmark: id.toUpperCase(), theme: { primary: '#2D5A47', band: '#DCEBE3', band_text: '#2D5A47', chart: '#5E9C80', chart_other: '#BAC0C6', ink: '#1C1C1C', mute: '#6B7280', soft: '#F2F6F3', bar: '#141414', corner: '#E3A04F', frame: '#B8A07A', font_heading: '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc', font_heading_index: 1, font_body: '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc', font_body_index: 0, font_latin: '/System/Library/Fonts/Supplemental/Didot.ttc' } }),
  site: keep('site', { url: `https://example-${id}.myshopify.com`, product_path: `/products/${id}` }),
  line: keep('line', { oa_basic_id: '@example', liff_id: '' }),
  public_url: keep('public_url', `https://${id}-line.vercel.app`),
  image_version: keep('image_version', '?v=1'),
  copy: { ...(base.copy || {}), welcome: base.copy?.welcome || '{name}、友だち追加ありがとうございます',
    card_alt: '買う前に、あなたに合うか30秒でチェック', card_note: `${Q.length}つの質問に答えるだけ。回答のお礼に${Number(base.coupon?.amount || 1000).toLocaleString()}円OFFクーポン。`,
    start_label: 'チェックする', keywords: 'チェック|クーポン|相性|診断', loading_seconds: 5, loading_wait_ms: 3000,
    fail_text: base.copy?.fail_text || 'クーポンの発行に失敗しました。お手数ですが「クーポン」と送ってください。担当が確認します。' },
  questions: Q,
  fit: { alt_ok: '相性チェックの結果：あなたに合います', alt_no: '相性チェックの結果', head_ok: '{name}に、合います', head_warn: '{name}に、合います（1つだけ気をつける点）',
    head_no: '{name}には、合わないかもしれません', reasons_title: 'あなたの答えから',
    fixed_reasons: days ? [`合わなければ、${days}日間の返金保証があります`] : [], note_no: '無理に買わないでください。気になる点の答えは、下のボタンから見られます。',
    continue_no: 'それでも答えを見る', stop_label: '今回はやめておく',
    stop_text: '答えてくださって、ありがとうございました。合わない物はおすすめしません。ほかに知りたい事があれば、このトークに送ってください。', ok_image: 'fit_ok.jpg' },
  worries: { alt: '最後に気になること', head_first: '最後に、気になることはありますか？', head_more: 'ほかに、気になることはありますか？', next_first: '特にない、次へ', next_more: 'もう大丈夫、次へ',
    items: doubts.map(d => [d.key, cut(d.label, 40)]),
    answers: Object.fromEntries(doubts.map(d => [d.key, { title: cut((d.answer?.body[0] || '').split(/(?<=。)/)[0], 40), body: (d.answer?.body || []).slice(1).length ? d.answer.body.slice(1) : d.answer?.body || [], ...(d.answer?.draft ? { note: '※下書き（A の近い行）。言葉を直してから出す' } : {}) }])) },
  coupon: { ...(base.coupon || { amount: 1000, hours: 24, prefix: 'LINE1000OFF-', combines: { orderDiscounts: false, productDiscounts: true, shippingDiscounts: true }, button: 'クーポンを使う', image: 'coupon.jpg' }),
    title_prefix: 'LINE相性チェック｜', alt: `回答のお礼に ${Number(base.coupon?.amount || 1000).toLocaleString()}円OFFクーポン`, note: '回答ありがとうございました',
    applied_text: base.coupon?.applied_text || '{yen}円OFFクーポン（{code}）を自動で適用しました。\n本日限り・{hours}時間有効です。' },
  offer: { ...(base.offer || defaultOffer()), ask: null, subscription: null, size_key: 'z', ...(Q.find(q => q.key === 'z')?.opts.some(o => o[0] === 'big') ? { size_alias: { big: 'orig' } } : {}) },
  variants: keep('variants', defaultVariants()), utm: { campaign: `${id.replace(/-/g, '_')}_line_fitcheck` },
  popup: { ...(base.popup || { delay_ms: 5000, exclude_paths: ['/pages/advertorial'], banner: 'line-popup.webp', banner_w: 1086, banner_h: 1448, storage_key: `${id}_line_popup_v1` }),
    alt: `LINE追加で、買う前に、あなたに合うか30秒でチェック。回答のお礼に${Number(base.coupon?.amount || 1000).toLocaleString()}円OFFクーポン。ここから追加`, fab_label: '相性チェック', storage_key: `${id}_line_fitcheck_v1` },
  richmenu: { ...(base.richmenu || { size: [2500, 843], areas: [{ bounds: [0, 0, 1660, 843], action: { type: 'postback', data: 's=0' } }, { bounds: [1660, 0, 840, 843], action: { type: 'uri', uri: '{site}{product_path}?utm_source=line&utm_medium=richmenu' } }] }), chatBarText: '相性チェック' },
  images: fitImages(base.images || {}, doubts),
};
// 記事の値段の段（値段の段_入力.json）があれば、値段・セットの名前・色をそろえる（記事 → 店 → LINE で同じ数字・同じ色）
const priceIn = walk(path.join(DIR, '07_納品', '記事'), /^値段の段_入力\.json$/)[0];
if (priceIn) {
  const P = JSON.parse(read(priceIn)); const size0 = Object.keys(cfg.offer.size_labels || {})[0] || 'mini';
  if (Array.isArray(P.セット) && cfg.offer.prices) {
    for (const x of P.セット) { const k = `${size0}|${x.数}`; if (cfg.offer.prices[k]) cfg.offer.prices[k] = [x.値段, x.通常 > x.値段 ? x.通常 : 0]; }
    cfg.offer.items = (cfg.offer.items || []).map(([v, l]) => [v, (P.セット.find(x => String(x.数) === String(v)) || {}).名前 || l]);
    cfg._sources['offer.prices'] = [src(priceIn, 1, `セット ${P.セット.map(x => `${x.名前} ${x.値段}円`).join('・')}（${size0} の値段。他のサイズは前の設定の仮）`)];
  }
  if (P.色?.主 && cfg.brand.theme) { Object.assign(cfg.brand.theme, { primary: P.色.主, band: P.色.淡い || cfg.brand.theme.band, band_text: P.色.濃い || cfg.brand.theme.band_text, chart: P.色.枠 || cfg.brand.theme.chart }); cfg._sources['brand.theme'] = [src(priceIn, 1, `記事の色 ${JSON.stringify(P.色)}`)]; }
  if (P.保証の日数 && !cfg.fit.fixed_reasons.length) cfg.fit.fixed_reasons = [`合わなければ、${P.保証の日数}日間の返金保証があります`];
}
cfg.richmenu.areas = cfg.richmenu.areas.map(a => (a.action.type === 'postback' ? { ...a, action: { ...a.action, displayText: 'チェックする' } } : a));
for (const [k, v] of Object.entries(S)) cfg._sources[k] = v;
for (const d of doubts) cfg._sources[`worry.${d.key}`] = [...d.from, ...(d.answer ? [d.answer.src] : []), ...(d.answer?.draft ? d.more || [] : [])];
if (pack.facts.guarantee) cfg._sources['fit.fixed_reasons'] = [pack.facts.guarantee.src];
if (pack.facts.weight) cfg._sources['fact.weight'] = [pack.facts.weight];

// 前の設定が無い時のおすすめ：サイズの答え × 記事の値段の段のセット（無ければ1つ）。バリアントは仮の番号（店ができたら pull-variants.mjs）
function sets() { const f = walk(path.join(DIR, '07_納品', '記事'), /^値段の段_入力\.json$/)[0]; const P = f ? JSON.parse(read(f)) : {}; return Array.isArray(P.セット) && P.セット.length ? P.セット : [{ 名前: '1つ', 数: 1, 値段: 0, 通常: 0 }]; }
function sizes() { const z = Q.find(q => q.key === 'z'); return z ? [...new Set(z.opts.map(o => (o[0] === 'big' ? 'orig' : o[0])))] : ['one']; }
function defaultOffer() {
  const S = sets(), Z = sizes(); const dims = r => { const w = row(/仕様/, /^幅/), d = row(/仕様/, /^奥行/); if (!w || !d) return ''; const i = r === 'mini' ? 2 : 1; const n = x => (x.match(/約([\d.]+)cm/) || [])[1]; return n(w.cells[i] || '') && n(d.cells[i] || '') ? `（約${Math.round(n(w.cells[i]))}×${Math.round(n(d.cells[i]))}cm）` : ''; };
  return { alt: '{name}におすすめ', kicker: '{name}におすすめ', title: '{brand} {item}', subtitle: '{size}｜送料無料', item_field: 'n', items: S.map(x => [String(x.数), x.名前]), fixed: {},
    image: 'p_{z}_{n}.jpg', size_key: 'z', size_labels: Object.fromEntries(Z.map(z => [z, (z === 'mini' ? 'Mini' : z === 'orig' ? 'Original' : '1サイズ') + dims(z)])),
    variant_key: '{z}|{n}', price_key: '{z}|{n}', prices: Object.fromEntries(Z.flatMap(z => S.map(x => [`${z}|${x.数}`, [x.値段, x.通常 > x.値段 ? x.通常 : 0]]))), buy_label: '購入する', utm_content: 'n{n}' };
}
function defaultVariants() { let n = 9000000000001; return Object.fromEntries(sizes().flatMap(z => sets().map(x => [`${z}|${x.数}`, n++]))); }
function fitImages(I, ds) {
  const photos = I.photos || {}; const pick = (...ks) => ks.find(k => photos[k]) || Object.keys(photos)[0] || 'hero';
  return { ...I, source_dir: undefined,
    banner: I.banner ? { ...I.banner, headline: '買う前に、あなたに合うか', sub: '30秒でチェックできます', ticket: `回答のお礼に ${Number(base.coupon?.amount || 1000).toLocaleString()}円OFFクーポン プレゼント` } : undefined,
    cards: {
      fit: { bg: pick('hero'), out: 'fit_ok', label: '相性チェックの結果', big: '合います', band: 'FIT CHECK', subs: ['あなたの答えから', '理由は下に3つ'] },
      doubts: {}, // 言葉を直した後に入れる（下の 5b）
      _doubt_bg: pick('bg_reji', 'w_wobble', 'hero'),
      coupon: I.cards?.coupon || { label: '回答のお礼に・本日限り', big: '1,000円OFF', band: 'COUPON PRESENT', subs: ['24時間で消えるクーポンです', 'お一人さま1回'], bottom: 'クーポンを使う' },
      hero: { label: '公式LINE', lines: ['買う前に、', 'あなたに合うか'], subs: [`${Q.length}つの質問で30秒`], bottom: '回答のお礼に 1,000円OFF' },
      richmenu: { ...(I.cards?.richmenu || { crop: [0.6, 0.78], right: '商品を見る ›' }), lines: ['買う前に、', '合うかチェック'], band: '30秒 相性チェック', sub: '回答のお礼に 1,000円OFF', pill: 'タップしてチェック ›' },
    } };
}

// ---- 5. 言葉を直す（claude -p があれば）----
function hasClaude() { const r = spawnSync(CLAUDE, ['--version'], { encoding: 'utf8' }); return r.status === 0; }
let used = '機械の下書きのまま（claude が無い・--llm off）';
if (LLM !== 'off' && (LLM === 'on' || hasClaude())) {
  const words = { questions: cfg.questions.map(q => ({ key: q.key, head: q.head, opts: q.opts.map(o => [o[0], o[1], o[2]?.reason || '']) })),
    worries: cfg.worries.items.map(([k, l]) => ({ key: k, label: l, title: cfg.worries.answers[k].title, body: cfg.worries.answers[k].body, sources: cfg._sources[`worry.${k}`].map(s => s.text) })) };
  const prompt = `あなたは日本の EC の LINE 公式アカウントの「買う前の相性チェック」の言葉を直す人。悩みは広告・記事・店で言い切ってあるので、ここでは「本当にあなたに合うのか」を確かめるだけ。
次の JSON の字だけを、50代の女性に一度で分かる、やさしい短い日本語に直して、同じ形の JSON だけを返す。前置きも説明も書かない。
決まり：
- key・値（opts の1つ目）・数・並び・sources は変えない。opts の2つ目＝ボタンの字（20字まで）、3つ目＝結果の理由（「〜なので」「〜でも」で、その答えに合う訳を1行。45字まで）
- worries の label＝お客さんの心の声の問い（25字まで）。title＝答えの一言（20字まで。「置けます」「ふらつきません」のように言い切る）、body＝1〜3行（各60字まで）
- 答えの中身は sources に書いてある事実だけ。数字は sources のまま。無い事は書かない
- 治る・治す・消える・改善・効果がある・医師・研究の数字・必ず、は書かない。不安を煽らない。絵文字を使わない
- head は {name} をそのまま残す
${JSON.stringify(words, null, 1)}`;
  // 言葉を直すだけなので、道具・MCP・本人の設定は使わせない（server/cs/judge.mjs と同じ切り離し。2026-10-29 セキュリティの見直し）。
  // 古い CLI に無い引数は付けない（--help に出る物だけ）。作業フォルダは空の一時フォルダ
  const help = spawnSync(CLAUDE, ['--help'], { encoding: 'utf8', timeout: 20000 }).stdout || '';
  const has = (f) => help.includes(f);
  const iso = ['--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--disallowedTools', 'Bash,Edit,MultiEdit,Write,Read,Glob,Grep,LS,WebFetch,WebSearch,NotebookEdit,NotebookRead,Task,TodoWrite,Skill',
    ...(has('--tools ') ? ['--tools', ''] : []), ...(has('--safe-mode') ? ['--safe-mode'] : []), ...(has('--no-session-persistence') ? ['--no-session-persistence'] : []),
    ...(has('--setting-sources') ? ['--setting-sources', 'project'] : [])];
  const cwd = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'zg-fitcheck-'));
  const r = spawnSync(CLAUDE, ['-p', prompt, '--output-format', 'text', ...iso], { encoding: 'utf8', timeout: 240000, maxBuffer: 8 << 20, cwd });
  try { fs.rmSync(cwd, { recursive: true, force: true }); } catch {}
  try {
    const j = JSON.parse((r.stdout || '').replace(/^[\s\S]*?```(?:json)?\s*|\s*```[\s\S]*$/g, '').trim() || r.stdout);
    const ok = j.questions?.length === cfg.questions.length && j.questions.every((q, i) => q.key === cfg.questions[i].key && q.opts.length === cfg.questions[i].opts.length && q.opts.every((o, k) => o[0] === cfg.questions[i].opts[k][0]))
      && j.worries?.length === cfg.worries.items.length && j.worries.every((w, i) => w.key === cfg.worries.items[i][0] && Array.isArray(w.body) && w.body.length >= 1);
    if (!ok) throw new Error('形が変わった');
    j.questions.forEach((q, i) => { const Q0 = cfg.questions[i]; Q0.head = q.head.includes('{name}') || !Q0.head.includes('{name}') ? q.head : Q0.head; q.opts.forEach((o, k) => { Q0.opts[k][1] = cut(o[1], 40); if (o[2] && Q0.opts[k][2]) Q0.opts[k][2].reason = cut(o[2], 60); }); });
    j.worries.forEach((w, i) => { const k = cfg.worries.items[i][0]; cfg.worries.items[i][1] = cut(w.label, 40); const A = cfg.worries.answers[k]; A.title = cut(w.title, 40); A.body = w.body.slice(0, 3).map(t => cut(t, 120)); delete A.note; });
    used = 'claude -p で直した（キー・値・出典は機械のまま）';
  } catch (e) { used = `機械の下書きのまま（claude の返事が使えなかった：${e.message.slice(0, 60)}）`; }
}
cfg._notes.made_by = cfg._notes.made_by.replace('{LLM}', used);
// ---- 5b. 不安の答えのカードの画像（見本として1枚目だけ。ほかは文のカード）----
{ const C = cfg.images.cards; const k = doubts[0]?.key;
  if (k) { const A = cfg.worries.answers[k]; C.doubts = { [k]: { bg: C._doubt_bg, out: `d_${k}`, q: cut(cfg.worries.items[0][1], 16), big: A.title.replace(/。$/, ''), band: 'ANSWER', subs: [], note: '答えは、この下の文に' } }; A.image = `d_${k}.jpg`; }
  delete C._doubt_bg; }
if (flag('--pack')) fs.writeFileSync(flag('--pack'), JSON.stringify({ ...pack, candidates: cand }, null, 2));
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(cfg, null, 2) + '\n');
console.log(`書いた: ${OUT}｜問い ${Q.length}（${Q.map(q => q.key).join('・')}）｜不安 ${doubts.length}（候補 ${cand.length}）｜出典 ${Object.keys(cfg._sources).length}｜言葉: ${used}`);
