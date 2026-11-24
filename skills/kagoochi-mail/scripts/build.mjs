// カゴ落ちメール 4通を組む（どの店でも同じ型）
// 型（固定）: 参考メールから写した段の並び・置き方・大きさ。このファイルに書く。店が変わっても変えない
// 店の値（変える）: 色・書体・ロゴ・写真・文・数字・コード。<作業場>/店の値.json に書く（見本 templates/店の値_ここちドライ.json）
// 参考: references/見本4通.md（1 Willie's Remedy／2 wuffes／3 renuherbs／4 Jack Henry）
// 使い方: node build.mjs <作業場>/店の値.json
//   → <作業場>/dist/e1〜e4.html（見本の値を入れた見る用。前に買った客の枝は e3b・e4b）・index.html（参考と並べた見比べ）・subjects.json
//   → <作業場>/liquid/e1〜e4b.liquid（Shopify Messaging の「カスタム Liquid」のメールに貼る物。差し込みは Shopify の変数）
// 段には data-dan="<通>-<段の名前>" を付ける。check.py がこの並びを型の並びと照らす
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

// 日本語は言葉の切れ目（BudouX）にだけ <wbr> を入れ、word-break:keep-all で言葉の途中で次の行に切れないようにする
const require = createRequire(process.env.ZG_REQUIRE_FROM || import.meta.url);   // アプリ：アプリの中の部品
let jpParser;
try { jpParser = require('budoux').loadDefaultJapaneseParser(); } catch { console.error('道具が無い: cd （社内の Mac の道） && npm i budoux@0.6.4'); process.exit(2); }
const jp = (html) => html.split(/(<style[\s\S]*?<\/style>|<title>[\s\S]*?<\/title>|<[^>]+>|\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\})/).map((part, i) =>
  i % 2 || !/[ぁ-んァ-ヶ一-龥]/.test(part) ? part : jpParser.parse(part).join('<wbr>')).join('');
const KEEP = 'word-break:keep-all;overflow-wrap:anywhere';

const arg = process.argv[2];
if (!arg) { console.error('使い方: node build.mjs <作業場>/店の値.json'); process.exit(2); }
const JSONP = path.resolve(arg.replace(/^[~]/, os.homedir()));
let S;
try { S = JSON.parse(fs.readFileSync(JSONP, 'utf8')); } catch (e) { console.error(`店の値.json が読めない: ${e.message}`); process.exit(2); }
const NEED = ['name', 'url', 'logo', 'logoOnDark', 'color', 'font', 'img', 'sample', 'contact', 'company', 'signer', 'e2', 'e3'];
const miss = NEED.filter((k) => S[k] == null);
if (miss.length) { console.error(`店の値.json に欄が無い: ${miss.join(' ')}`); process.exit(2); }
const WORK = path.dirname(JSONP);
const DIST = path.join(WORK, 'dist'), LIQ = path.join(WORK, 'liquid');
fs.mkdirSync(DIST, { recursive: true }); fs.mkdirSync(LIQ, { recursive: true });

const yen = (n) => '¥' + Number(n).toLocaleString('ja-JP');
const C = S.color, F = S.font;
const em = (t) => String(t).replace(/<em>/g, `<span style="color:${C.deep}">`).replace(/<\/em>/g, '</span>');

// ───────────── 差し込み（見る用は見本の値、Liquid は Shopify の変数） ─────────────
// Shopify の変数は公式の説明書で確かめた物（2026-10-20 custom-liquid のページ）: abandoned_checkout.url・abandoned_checkout.line_items（image_url・product_title・variant_title・quantity）・customer.first_name・unsubscribe_url
function slots(mode) {
  if (mode === 'preview') {
    const sm = S.sample;
    return {
      mode, name: sm.name, checkout: sm.checkout, unsub: '#unsubscribe',
      items: sm.cart.map((it) => ({ img: it.img, title: it.title, variant: it.variant, qty: it.qty, extra: it.extra || '', price: yen(it.price) })),
      first: sm.cart[0], chosen: sm.e4Chosen,
      code4: (yenTxt) => `それと、<b>あなた専用の${yenTxt}引きコード<br>（${sm.code4}）</b>をご用意しました。<br>使えるのは${sm.deadline4}までです。`,
    };
  }
  return {
    mode, name: `{{ customer.last_name | default: customer.first_name | default: 'お客' }}`,
    checkout: '{{ abandoned_checkout.url }}', unsub: '{{ unsubscribe_url }}',
    // カートの品は全部を繰り返す（2品以上のカートで欠けない。2026-10-20 試しで見つかった）
    items: null, chosen: '{% for li in abandoned_checkout.line_items %}{{ li.product_title }}　{{ li.variant_title }}{% unless forloop.last %}、{% endunless %}{% endfor %}',
    // 4通目の専用コード: Shopify Flow がカゴごとに48時間で切れるコードを作り、客のメタフィールド kagoochi.code4・kagoochi.deadline4 に書く（references/shopify設置.md の手順4）。
    // 書けていない時・期限（kagoochi.deadline4_at、秒）が過ぎた時は期限を書かず、3通目のコードがまだ使える事だけ言う（偽の締切を出さない）
    code4: (yenTxt) => `{% assign c4 = customer.metafields.kagoochi.code4 %}{% assign dl = customer.metafields.kagoochi.deadline4_at | plus: 0 %}{% assign now_s = 'now' | date: '%s' | plus: 0 %}{% if c4 != blank and dl > now_s %}それと、<b>あなた専用の${yenTxt}引きコード<br>（{{ c4 }}）</b>をご用意しました。<br>使えるのは{{ customer.metafields.kagoochi.deadline4 }}までです。{% else %}それと、<b>${yenTxt}引きのコード<br>（${S.e3.offer.code}）</b>も、まだお使いいただけます。{% endif %}`,
  };
}

// ───────────── 共通の部品（形は参考どおり・値は S から） ─────────────
const shell = (title, preheader, inner, bg = '#f4f1f2') => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;padding:0;background:${bg}}img{border:0;display:block;max-width:100%}a{color:inherit}
@media (max-width:480px){.w{width:100%!important}.col{display:block!important;width:100%!important;box-sizing:border-box}.px{padding-left:20px!important;padding-right:20px!important}.h1{font-size:24px!important}.h2{font-size:18px!important}.sm{font-size:12px!important;letter-spacing:.04em!important}.rule{width:16px!important}.pm{padding-left:14px!important;padding-right:14px!important}.lb{width:140px!important}.tight{padding-left:0!important;padding-right:0!important}}</style></head>
<body><div style="display:none;max-height:0;overflow:hidden">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg}"><tr><td align="center" style="padding:24px 0">
<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${C.page};font-family:${F.body};color:${C.ink};${KEEP}">${jp(inner)}</table>
</td></tr></table></body></html>`;
const row = (dan, html, style = '', cls = '') => `<tr data-dan="${dan}"><td${cls ? ` class="${cls}"` : ''} style="${style}">${html}</td></tr>`;
const btn = (label, href, { fill = C.button, ink = '#ffffff', border = fill, w = 260, radius = 999, size = 15 } = {}) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr><td align="center" style="background:${fill};border:2px solid ${border};border-radius:${radius}px"><a href="${href}" style="display:block;width:${w}px;padding:14px 0;font-family:${F.body};font-size:${size}px;font-weight:700;letter-spacing:.12em;color:${ink};text-decoration:none;text-align:center">${label}</a></td></tr></table>`;
const stars = (n = 5, size = 18) => `<span style="color:${C.star};font-size:${size}px;letter-spacing:2px">${'★'.repeat(n)}</span>`;
const itemRow = (img, title, sub, price) => `<tr><td width="150" style="padding:16px"><img src="${img}" width="130" alt="" style="width:130px;border-radius:4px"></td>
<td style="padding:16px 16px 16px 0;font-size:14px;line-height:1.7"><div style="font-weight:700;font-size:15px">${title}</div><div style="color:${C.mute}">${sub}</div>${price ? `<div style="font-weight:700;margin-top:4px">${price}</div>` : ''}</td></tr>`;
const cartBlock = (X, bordered) => {
  const box = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;${bordered ? `border:1px solid ${C.line};` : ''}">${rows}</table>`;
  if (X.items) return box(X.items.map((it) => itemRow(it.img, it.title, `${it.variant}<br>数量 ${it.qty}${it.extra ? `<br>${it.extra}` : ''}`, it.price)).join(''));
  return box(`{% for li in abandoned_checkout.line_items %}${itemRow('{{ li.image_url }}', '{{ li.product_title }}', '{{ li.variant_title }}<br>数量 {{ li.quantity }}', '')}{% endfor %}`
    + `<tr><td colspan="2" style="padding:0 16px 16px;font-size:14px;font-weight:700;text-align:right">合計 {{ abandoned_checkout.subtotal_price | money }}</td></tr>`);
};
const unsub = (X, color = C.mute) => `<a href="${X.unsub}" style="color:${color}">今後このお知らせを受け取らない</a>`;

// ───────────── 1通目（型: Willie's Remedy「FORGETTING SOMETHING?」・割引なし） ─────────────
// 段: ロゴ帯 → 主役の面（見出し・罫つき小見出し・枠線ボタン・カートの中身） → 絵 → 相談 → リンク2行 → 配信停止 → 大きいロゴ
function e1(X) {
  const linkRow = (dan, label, href) => row(dan, `<a href="${S.url + href}" style="font-size:15px;font-weight:700;letter-spacing:.2em;color:${C.ink};text-decoration:none">${label}</a>`, `background:${C.soft};border-top:1px solid ${C.line};padding:18px 0;text-align:center`);
  const inner = `
${row('e1-ロゴ帯', `<img src="${S.logo}" width="200" alt="${S.name}" style="width:200px;margin:0 auto">`, `background:${C.soft};padding:30px 0;text-align:center`)}
${row('e1-主役の面', `<div class="h1" style="font-family:${F.head};font-size:36px;line-height:1.35;font-weight:700;letter-spacing:.06em">何か、お忘れでは<br>ありませんか？</div>
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:18px auto 0"><tr>
    <td class="rule" style="width:46px;border-top:1px solid ${C.ink}"></td>
    <td class="sm" style="padding:0 12px;font-size:13px;letter-spacing:.14em;line-height:1.8;text-align:center">カートに入れたままになっています<br>あと一歩で、あなたのものです</td>
    <td class="rule" style="width:46px;border-top:1px solid ${C.ink}"></td></tr></table>
  <div style="height:22px"></div>
  ${btn('お会計に戻る', X.checkout, { fill: '#ffffff', ink: C.ink, border: C.ink, radius: 6, w: 240 })}
  <div style="height:28px"></div>
  ${cartBlock(X, false)}
  <div style="height:28px"></div>`, `background:${C.strong};padding:44px 40px 12px;text-align:center`, 'px')}
${row('e1-絵', `<img src="${S.img.scene2}" width="600" alt="${S.img.scene2Alt || ''}" style="width:100%">`, `background:${C.strong};padding:0`)}
${row('e1-相談', `<div class="h2" style="font-family:${F.head};font-size:24px;font-weight:700;letter-spacing:.08em;margin:22px 0 6px">わからないことは、ご相談ください</div>
  <div style="width:300px;max-width:100%;margin:0 auto 14px;border-top:1px solid ${C.ink};border-bottom:1px solid ${C.ink};height:3px"></div>
  <div style="font-size:15px;line-height:1.9">${S.contact.topics}など、気になることがあれば<br>お気軽にお問い合わせください。<br><a href="mailto:${S.contact.mail}" style="color:${C.ink}">${S.contact.mail}</a><br>${S.contact.reply}</div>
  <div style="height:22px"></div>
  ${btn('問い合わせる', 'mailto:' + S.contact.mail, { fill: '#ffffff', ink: C.ink, border: C.ink, radius: 6, w: 220 })}
  <div style="height:36px"></div>`, `background:${C.strong};padding:0 40px;text-align:center`, 'px')}
${linkRow('e1-リンク1', '公式サイト', '/')}
${linkRow('e1-リンク2', 'お問い合わせ', '/pages/contact')}
${row('e1-配信停止', `<div style="font-size:12px;color:${C.mute};line-height:1.9">${S.name}<br>${unsub(X)}</div>`, `background:${C.soft};border-top:1px solid ${C.line};padding:22px 20px 6px;text-align:center`)}
${row('e1-大きいロゴ', `<img src="${S.logo}" width="420" alt="${S.name}" style="width:70%;margin:0 auto">`, `background:${C.soft};padding:10px 0 34px;text-align:center`)}`;
  const pre = 'カートに入れたままになっています。';
  return { subject: '何か、お忘れではありませんか？', preheader: pre, html: shell('1通目', pre, inner) };
}

// ───────────── 2通目（型: wuffes「Don't forget to checkout…」・信頼） ─────────────
// 段: ブラウザで見る → ロゴ帯 → 場面の写真 → 約束の見出し → 中身2行 → ボタン → 肯定 → 数字1文 → 声のカード3枚
//     → 権威（見出し＋カード2枚。店の値に無ければ段ごと外す） → 写真 → 保証 → ボタン → ※注 → ロゴ＋印3つ → 濃いリンク帯 → 著作・配信停止・住所
function e2(X) {
  const E = S.e2;
  const card = (v) => `<td class="col" width="33%" valign="top" style="padding:0 6px 10px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid ${C.line};border-radius:10px"><tr><td style="padding:0"><img src="${v.img}" width="170" alt="" style="width:100%;height:auto;border-radius:10px 10px 0 0"></td></tr>
  <tr><td style="padding:12px 12px 14px;text-align:center"><div style="font-size:13px;font-weight:700;line-height:1.5">${v.head}</div><div style="font-size:12px;line-height:1.7;margin-top:6px">${v.body}</div><div style="margin-top:8px">${stars(5, 14)}</div><div style="font-size:12px;font-weight:700">${v.who}</div></td></tr></table></td>`;
  const fact = (f, i) => row(`e2-権威のカード${i + 1}`, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.deep};border-radius:10px"><tr>
  <td width="38%" style="padding:0"><img src="${f.img}" width="200" alt="" style="width:100%;height:100%;min-height:190px;object-fit:cover;border-radius:10px 0 0 10px"></td>
  <td style="padding:16px 14px;color:#fff"><div style="font-size:16px;font-weight:700;line-height:1.6">${f.head}</div><div style="font-size:13px;line-height:1.8;margin-top:6px">${f.body}</div><div style="font-size:12px;margin-top:10px;opacity:.9">${f.src}</div></td></tr></table>`, `background:${C.soft};padding:0 28px 16px`);
  const icon = (b) => `<td width="33%" align="center" valign="top" style="padding:6px"><img src="${b.img}" width="56" alt="" style="width:56px;margin:0 auto"><div style="font-size:13px;margin-top:8px">${b.label}</div></td>`;
  const nameRow = (img, title) => `<tr><td width="130" style="padding:10px 0"><img src="${img}" width="100" alt="" style="width:100px"></td><td style="font-size:17px;font-weight:700"><a href="${X.checkout}" style="color:${C.ink}">${title}</a></td></tr>`;
  const firstRow = X.items ? X.items.map((it) => nameRow(it.img, it.title)).join('')
    : `{% for li in abandoned_checkout.line_items %}${nameRow('{{ li.image_url }}', '{{ li.product_title }}')}{% endfor %}`;
  const A = E.authority;
  const inner = `
${row('e2-ブラウザで見る', `<span style="font-size:11px;color:${C.mute}">お手続きの画面は<a href="${X.checkout}" style="color:${C.button}">こちら</a></span>`, `background:#fff;padding:8px 16px;text-align:right`)}
${row('e2-ロゴ帯', `<img src="${S.logoOnDark}" width="170" alt="${S.name}" style="width:170px;margin:0 auto">`, `background:${C.deep};padding:18px 0;text-align:center`)}
${row('e2-場面の写真', `<img src="${S.img.scene1}" width="600" alt="" style="width:100%">`, `background:${C.soft}`)}
${row('e2-約束の見出し', `<div class="h2" style="font-family:${F.head};font-size:26px;font-weight:700;line-height:1.55;letter-spacing:.04em">${em(E.promise)}</div>`, `background:${C.soft};padding:30px 36px 10px;text-align:center`)}
${row('e2-中身2行', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${firstRow}${E.cartExtra ? nameRow(E.cartExtra.img, E.cartExtra.title) : ''}</table>`, `background:${C.soft};padding:10px 50px`, 'px')}
${row('e2-ボタン1', btn('お手続きに戻る', X.checkout, { fill: C.deep, border: C.deep, w: 230 }), `background:${C.soft};padding:16px 0 26px`)}
${row('e2-肯定', `<div class="h2" style="font-family:${F.head};font-size:24px;font-weight:700;line-height:1.55">${E.affirm}</div>`, `background:${C.soft};padding:10px 36px 14px;text-align:center`, 'px')}
${row('e2-数字1文', `<div style="font-size:14px;line-height:1.8">${E.proof}</div>`, `background:${C.soft};padding:0 50px 22px;text-align:center`, 'px')}
${row('e2-声のカード3枚', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${E.voices.map(card).join('')}</tr></table>`, `background:${C.soft};padding:0 22px 30px`)}
${A ? row('e2-権威の見出し', `<div class="h2" style="font-family:${F.head};font-size:26px;font-weight:700;color:${C.deep}">${A.head}</div><div style="font-size:14px;line-height:1.8;margin-top:10px">${A.lead}</div>`, `background:${C.soft};padding:10px 36px 20px;text-align:center`, 'px') : ''}
${A ? A.cards.map(fact).join('') : ''}
${row('e2-写真', `<img src="${S.img.scene3}" width="300" alt="" style="width:300px;margin:0 auto;border-radius:8px">`, `background:${C.soft};padding:10px 0 20px;text-align:center`)}
${row('e2-保証', `<div style="font-family:${F.head};font-size:26px;font-weight:700;color:${C.deep}">${E.guarantee.head}</div><div style="font-size:14px;line-height:1.8;margin-top:12px">${E.guarantee.body}</div>${E.guarantee.img ? `<img src="${E.guarantee.img}" width="90" alt="" style="width:90px;margin:16px auto 0">` : ''}`, `background:${C.soft};padding:10px 50px 10px;text-align:center`, 'px')}
${row('e2-ボタン2', btn('お手続きに戻る', X.checkout, { fill: C.deep, border: C.deep, w: 230 }), `background:${C.soft};padding:16px 0 22px`)}
${A && A.note ? row('e2-注', `<div style="border-top:1px solid ${C.line};padding-top:14px;font-size:11px;line-height:1.7;color:${C.mute}">${A.note}</div>`, `background:${C.soft};padding:0 30px 24px;text-align:center`) : ''}
${row('e2-ロゴと印3つ', `<img src="${S.logo}" width="150" alt="${S.name}" style="width:150px;margin:0 auto 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${E.badges.map(icon).join('')}</tr></table>`, `background:#fff;padding:26px 30px;text-align:center`)}
${row('e2-濃いリンク帯', `<a href="${S.url}" style="color:#fff;text-decoration:none">公式サイト</a>　|　<a href="${S.url}/pages/contact" style="color:#fff;text-decoration:none">お問い合わせ</a>`, `background:${C.deep};padding:14px;text-align:center;font-size:12px;letter-spacing:.1em;color:#fff`)}
${row('e2-著作と住所', `<div style="font-size:11px;line-height:1.8;color:${C.mute}">© ${X.mode === 'liquid' ? "{{ 'now' | date: '%Y' }}" : new Date().getFullYear()} ${S.name}<br>${unsub(X)}<br>${S.company}</div>`, `background:#fff;padding:18px;text-align:center`)}`;
  const pre = 'お手続きの途中で止まっています。';
  return { subject: E.subject, preheader: pre, html: shell('2通目', pre, inner) };
}

// ───────────── 3通目（型: renuherbs「"A God Send…"」・声と割引） ─────────────
// 段: ロゴ → 客の言葉の見出し → 割引（初めての客の枝だけ） → カートの中身（枠） → 太いボタン → 言葉だけでなく＋評価
//     → 声のカード3枚（縦） → ボタン → 選び直しの格子（店の値に無ければ外す） → 濃い下の帯
function e3(X, { firstTime = true } = {}) {
  const E = S.e3;
  const review = (v, i) => row(`e3-声のカード${i + 1}`, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid ${C.ink};background:#fff"><tr><td style="padding:18px 22px">
  ${stars(5, 20)}<div style="margin:8px 0 10px"><span style="background:${C.strong};padding:4px 10px;font-size:13px;font-weight:700">${v.who}　${E.verified}</span></div>
  <div style="font-size:14px;line-height:1.8"><b style="display:block;margin-bottom:4px">${v.head}</b>${v.body}</div></td></tr></table>`, `background:${C.soft};padding:0 70px 20px`, 'pm');
  const setCell = (s) => `<td width="33%" valign="top" style="padding:0 4px 16px;text-align:center"><img src="${s.img}" width="160" alt="" style="width:100%;max-width:160px;margin:0 auto"><div style="font-size:15px;font-weight:700;margin-top:8px">${s.label}</div><div style="font-size:12px;color:${C.mute}">${s.note}</div><div style="font-size:14px;margin:4px 0 10px">${yen(s.price)}</div>${btn('選ぶ', s.url, { fill: C.deep, border: C.deep, radius: 0, w: 90, size: 13 })}</td>`;
  const pre = firstTime ? `お会計で${E.offer.code}を入れると${yen(E.offer.yen)}引きです。` : E.noOfferPreheader;
  const inner = `
${row('e3-ロゴ', `<img src="${S.logo}" width="210" alt="${S.name}" style="width:210px;margin:0 auto">`, `background:${C.soft};padding:30px 0 10px;text-align:center`)}
${row('e3-客の言葉の見出し', `<div class="h1" style="font-family:${F.head};font-size:32px;line-height:1.45;font-weight:600;letter-spacing:.02em">${E.headline}</div>`, `background:${C.soft};padding:16px 24px 18px;text-align:center`)}
${firstTime ? row('e3-割引', `<div style="font-size:20px;line-height:1.5">ご注文から <b>${yen(E.offer.yen)}引き</b></div><div style="font-size:16px;margin-top:14px">お会計で <span style="background:${C.deep};color:#fff;padding:6px 12px;font-weight:700;letter-spacing:.06em">${E.offer.code}</span> を入力</div>`, `background:${C.soft};padding:6px 30px 26px;text-align:center`) : ''}
${row('e3-カートの中身', cartBlock(X, true), `background:${C.soft};padding:0 22px 26px`, 'pm')}
${row('e3-太いボタン1', btn('ご注文を完了する', X.checkout, { fill: C.deep, border: C.deep, radius: 0, w: 300, size: 18 }), `background:${C.soft};padding:0 0 40px`)}
${row('e3-言葉だけでなく', `<div class="h2" style="font-family:${F.head};font-size:28px;line-height:1.4">${E.voicesHead}</div><div style="font-size:15px;margin-top:8px">${E.rating}</div>`, `background:${C.soft};padding:0 30px 26px;text-align:center`)}
${E.voices.map(review).join('')}
${row('e3-太いボタン2', btn('ご注文を完了する', X.checkout, { fill: C.deep, border: C.deep, radius: 0, w: 300, size: 18 }), `background:${C.soft};padding:16px 0 40px`)}
${E.choices ? row('e3-選び直しの格子', `<div style="font-family:${F.head};font-size:26px;margin-bottom:20px">${E.choices.head}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${E.choices.items.map(setCell).join('')}</tr></table>`, `background:${C.soft};padding:0 24px 40px;text-align:center`) : ''}
${row('e3-濃い下の帯', `<img src="${S.logoOnDark}" width="190" alt="${S.name}" style="width:190px;max-width:70%;margin:0 auto 22px">
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto">${[0, 2].map((i) => `<tr>${E.links.slice(i, i + 2).map(([l, h]) => `<td style="padding:6px"><a href="${h.startsWith('http') ? h : S.url + h}" class="lb" style="display:block;width:190px;border:1px solid #fff;padding:8px 0;color:#fff;text-decoration:none;font-size:14px;letter-spacing:.14em;text-align:center">${l}</a></td>`).join('')}</tr>`).join('')}</table>
<div style="font-size:12px;line-height:1.8;color:#fff;margin-top:20px">${unsub(X, '#fff')}</div>`, `background:${C.deep};padding:34px 20px;text-align:center`)}`;
  return { subject: E.subject, preheader: pre, html: shell('3通目', pre, inner) };
}

// ───────────── 4通目（型: Jack Henry「still saved for you」・文字だけの手紙） ─────────────
// 段: 呼びかけ → 最後と言い切る → 失う物（本当に終わる物だけ） → 専用の割引と期限（初めての客の枝だけ） → 返信をうながす → 助けの一言
//     → 文字のリンク → お礼 → 署名 → 配信停止
function e4(X, { firstTime = true } = {}) {
  const p = (dan, t) => `<p data-dan="${dan}" style="margin:0 0 16px">${t}</p>`;
  const body = [
    p('e4-呼びかけ', `${X.name}様`),
    p('e4-最後と言い切る', 'これが最後のご案内です。'),
    p('e4-失う物', `お選びいただいた内容<br>（${X.chosen}）は、<br>そのままお会計に戻れるようにしてあります。<br>ただ、こちらからのご案内は、<br>このメールで終わりになります。`),
    firstTime ? p('e4-専用の割引と期限', X.code4(yen(S.e3.offer.yen))) : '',
    p('e4-返信をうながす', 'わからないことがあれば、<br>このメールにそのまま返信してください。'),
    p('e4-助けの一言', S.contact.e4Help),
    p('e4-文字のリンク', `<a href="${X.checkout}" style="color:#1a5fb4">お会計に戻る</a>`),
    p('e4-お礼', '見ていただき、<br>ありがとうございました。'),
    `<p data-dan="e4-署名" style="margin:0">${S.signer.role}<br>${S.signer.name}</p>`,
  ].join('');
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>4通目</title></head>
<body style="margin:0;background:#fff"><div style="max-width:600px;padding:24px 20px;text-align:left;font-family:${F.body};font-size:15px;line-height:1.8;color:#222;${KEEP}">${jp(body)}
<p data-dan="e4-配信停止" style="margin:28px 0 0;font-size:12px;color:#888"><a href="${X.unsub}" style="color:#888">今後このお知らせを受け取らない</a></p></div></body></html>`;
  return { subject: 'まだ、取ってあります', preheader: 'お選びの品は、そのまま取ってあります。', html };
}

// ───────────── 書き出し ─────────────
const make = (X) => ({ e1: e1(X), e2: e2(X), e3: e3(X), e3b: e3(X, { firstTime: false }), e4: e4(X), e4b: e4(X, { firstTime: false }) });
const pv = make(slots('preview'));
const lq = make(slots('liquid'));
// 欄の抜け（undefined・NaN）と空の型の残り（<<要入力>>）が出たら書き出さずに止める
const holes = [];
for (const [mode, set] of [['見る用', pv], ['Liquid', lq]]) for (const [k, v] of Object.entries(set)) {
  for (const t of [v.subject, v.preheader, v.html]) {
    const m = String(t).match(/undefined|NaN|\[object|&lt;&lt;要入力&gt;&gt;|<<要入力>>/g);
    if (m) holes.push(`${mode} ${k}: ${[...new Set(m)].join(' ')}`);
  }
}
if (holes.length) { console.error('店の値.json の欄が抜けている・埋まっていない（書き出さない）:\n' + holes.join('\n')); process.exit(1); }
for (const [k, v] of Object.entries(pv)) fs.writeFileSync(path.join(DIST, `${k}.html`), v.html);
for (const [k, v] of Object.entries(lq)) fs.writeFileSync(path.join(LIQ, `${k}.liquid`), v.html.replace(/<title>[\s\S]*?<\/title>/, '').replace('</body>', '{{ open_tracking_block }}</body>')); // Shopify では <title> が本文に字で出る。「独自コード」のメールは open_tracking_block が要る
// _src: 組んだ時の店の値.json の指紋。check.py が今の店の値.json と照らし、組み直し忘れを止める
const src = crypto.createHash('sha256').update(fs.readFileSync(JSONP)).digest('hex').slice(0, 16);
fs.writeFileSync(path.join(DIST, 'subjects.json'), JSON.stringify({ _src: src, ...Object.fromEntries(Object.entries(pv).map(([k, v]) => [k, { subject: v.subject, preheader: v.preheader }])) }, null, 2));
const refs = ['1通目_WilliesRemedy.jpg', '2通目_Wuffes.png', '3通目_Renuherbs.jpg', '4通目_JackHenry.png'];
const VAULT = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'references', '見本');
fs.mkdirSync(path.join(DIST, 'ref'), { recursive: true });
const lost = refs.filter((r) => { try { fs.copyFileSync(path.join(VAULT, r), path.join(DIST, 'ref', r)); return false; } catch { return true; } });
if (lost.length) { console.error(`参考の画像が写せない（審査が参考と比べられない）: ${lost.join(' ')} ← ${VAULT}`); process.exit(2); }
const idx = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>カゴ落ちメール 4通 見比べ</title><style>body{font-family:sans-serif;background:#eee;margin:0;padding:20px}h2{margin:30px 0 10px}.p{display:flex;gap:20px;align-items:flex-start}.p>div{background:#fff;padding:10px}iframe{border:0;width:620px;height:2600px}img{width:600px}</style></head><body>
${['e1', 'e2', 'e3', 'e4'].map((k, i) => `<h2>${i + 1}通目　件名「${pv[k].subject}」</h2><div class="p"><div><b>参考</b><br><img src="ref/${refs[i]}"></div><div><b>${S.name}</b><br><iframe src="${k}.html"></iframe></div></div>`).join('')}
</body></html>`;
fs.writeFileSync(path.join(DIST, 'index.html'), idx);
console.log(`ok ${Object.keys(pv).join(' ')} → ${DIST} と ${LIQ}`);
