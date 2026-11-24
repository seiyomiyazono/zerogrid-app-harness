// 特商法・ポリシー・CS の決まりを、会社・ストア・商品の3つの設定から作るための共通部品。
// render.mjs（書類）と ec-cs の render_rules.mjs（返信の決まり）が同じ物を使う。外の部品は使わない（node だけ）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------- 値の読み書き ----------
export function getPath(obj, key) {
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, key, val) {
  const ks = key.split('.'); let o = obj;
  for (const k of ks.slice(0, -1)) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
  o[ks[ks.length - 1]] = val;
}
export const isEmpty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.entries(v).filter(([k]) => !k.startsWith('_')).every(([, x]) => isEmpty(x)));

export function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
export function loadQuestions(p = path.join(HERE, 'questions.json')) { return loadJson(p).questions; }

// ---------- 初期値と、足りない値 ----------
// 「= …」で始まる初期値は計算で埋める物（下の derive）。それ以外の初期値は、運営者が「初期値でよい」と答えた扱いにせず、
// accept_defaults=true の時だけ入れる（聞かずに入れると、確かめていない値で書類が出るため）。
export function resolve({ operator, store, product }, { acceptDefaults = false, questions = loadQuestions() } = {}) {
  const ctx = { operator: structuredClone(operator || {}), store: structuredClone(store || {}), product: structuredClone(product || {}) };
  const usedDefaults = [];
  for (const q of questions) {
    if (!isEmpty(getPath(ctx, q.key))) continue;
    if (q.default === undefined || (typeof q.default === 'string' && q.default.startsWith('='))) continue;
    if (acceptDefaults) { setPath(ctx, q.key, structuredClone(q.default)); usedDefaults.push(q.key); }
  }
  derive(ctx);
  const missing = [];
  for (const q of questions) {
    if (q.when && !whenOk(ctx, q.when, questions)) continue;
    if (q.required && isEmpty(getPath(ctx, q.key))) missing.push(q);
    else if (q.validate && !isEmpty(getPath(ctx, q.key)) && typeof getPath(ctx, q.key) !== 'object') {
      if (!new RegExp(q.validate).test(String(getPath(ctx, q.key)))) missing.push({ ...q, invalid: getPath(ctx, q.key) });
    }
  }
  return { ctx, missing, usedDefaults };
}
// まだ答えていない項目は、その質問の初期値で見る（2026-11-04 返品の形 return_type を足した時、未回答だと保証の質問が全部消えた）
function whenOk(ctx, expr, questions = []) {
  const m = expr.match(/^([\w.]+)\s*==\s*(\S+)$/); if (!m) return true;
  let v = getPath(ctx, m[1]);
  if (isEmpty(v)) { const q = questions.find((x) => x.key === m[1]); if (q && q.default !== undefined && !(typeof q.default === 'string' && q.default.startsWith('='))) v = q.default; }
  return String(v) === m[2];
}

const PREF_COURT = { '東京都': '東京', '大阪府': '大阪', '京都府': '京都', '北海道': '札幌', '神奈川県': '横浜', '愛知県': '名古屋', '兵庫県': '神戸', '宮城県': '仙台', '石川県': '金沢', '香川県': '高松', '沖縄県': '那覇', '茨城県': '水戸', '栃木県': '宇都宮', '群馬県': '前橋', '埼玉県': 'さいたま', '岩手県': '盛岡', '三重県': '津', '滋賀県': '大津', '島根県': '松江', '愛媛県': '松山' };
export function suggestCourt(address) {
  address = address || '';
  const m = address.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/); if (!m) return '';
  const p = m[1]; return (PREF_COURT[p] || p.replace(/[県府都]$/, '')) + '地方裁判所';
}

// 計算で出す値（c.*）。書類の文は、ここで作った言い回しを全部の場所で使う（store-legal.md 4章「同じことを、全部の場所で言う」）
export function derive(ctx) {
  const { operator: o, store: s, product: p } = ctx; const c = (ctx.c = {});
  if (isEmpty(o.responsible_name) && o.representative_name) o.responsible_name = o.representative_name;
  if (isEmpty(o.privacy_established)) { const d = new Date(); o.privacy_established = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; }
  if (isEmpty(o.return_address) && o.address && s.shop_name) o.return_address = { postal_code: o.postal_code, address: o.address, recipient: `${o.legal_name} ${s.shop_name}返品係` };
  c.court_suggestion = suggestCourt(o.address);
  // 会社
  c.address_line = o.postal_code && o.address ? `〒${o.postal_code} ${o.address}` : '';
  const dis = o.disclose_on_request || {};
  const onReq = 'ご請求をいただければ、遅滞なく開示いたします。';
  c.address_display = dis.address ? onReq : c.address_line;
  c.phone_display = dis.phone ? onReq : (o.phone || '');
  c.email_display = dis.email ? onReq : (s.cs_email || '');
  c.any_on_request = !!(dis.address || dis.phone || dis.email);
  c.phone_note = o.phone_support ? '' : '※お電話でのご対応は行っておりません。お問い合わせはすべてお問い合わせフォームよりお願いいたします。';
  c.is_corporation = o.entity_type !== 'sole_proprietor';
  const ra = o.return_address || {};
  // 1行の文字で入れた人もいる（画面の自由入力）。その時はそのまま使う
  c.return_address_line = typeof o.return_address === 'string' ? o.return_address.trim() : ra.address ? `〒${ra.postal_code} ${ra.address} ${ra.recipient || ''}`.trim() : '';
  // ストア
  c.contact_url = s.store_url ? s.store_url.replace(/\/$/, '') + (s.contact_path || '/pages/contact') : '';
  c.free_shipping = /無料/.test(s.shipping_fee || '');
  c.delivery_usual = s.delivery_days?.usual || ''; c.delivery_max = s.delivery_days?.max || '';
  c.payment_lines = (s.payment_methods || []).join('\n');
  c.ship_origin_sentence = {
    overseas_warehouse: '商品は当社の海外倉庫より発送されます。そのため、国内配送に比べてお届けまでにお時間をいただきます。',
    warehouse: '商品は当社の倉庫より発送されます。ご注文の状況により、お届けまでにお時間をいただく場合があります。',
    domestic: '商品は国内の倉庫より発送されます。',
  }[s.ship_origin] || '';
  // 返品の送料（2026-11-04 使う人ごとに違う）・解決した記録の保存日数（CS）
  c.return_shipping_text = s.return_shipping_payer === 'shop' ? '返送の送料は当社が負担いたします（着払いでお送りください）' : '返送にかかる送料のみ、お客さまのご負担をお願いしております';
  if (isEmpty(s.cs_keep_days) && s.refund_max_days) s.cs_keep_days = Number(s.refund_max_days) + 30;
  // 注文の後の変更・キャンセル・戻った荷物（2026-11-04 使う人ごとに決める。配送ポリシーと CS が同じ値を使う）
  const yes = (v) => v !== 'no' && v !== false;
  c.change_lines = [
    yes(s.change_address) ? '・発送前であれば、お届け先の住所の変更を承ります' : '・ご注文後のお届け先の変更は承っておりません',
    yes(s.change_items) ? '・発送前であれば、商品・数量・サイズ・色の変更を承ります' : '・ご注文後の商品・数量・サイズ・色の変更は承っておりません',
    s.cancel_before_ship === 'no' ? '・ご注文後のキャンセルは承っておりません'
      : s.cancel_before_ship === 'accept' ? '・発送前であれば、キャンセルを承ります（お支払いいただいた金額を、そのまま返金いたします）'
      : '・発送前のキャンセルは、理由をお伺いしたうえで承ります。二重注文や、当社の事情によるお届けの大幅な遅れなどの場合は、お支払いいただいた金額をそのまま返金いたします\n・ご注文の間違いや、ご不要になったなど、お客さまのご都合によるキャンセルは承っておりません。サイズ・色・数量・お届け先の変更で解決できる場合は、発送前であれば変更で対応いたします',
    s.cancel_after_ship === 'refuse_refund' ? '・発送後にキャンセルをご希望の場合は、商品のお受け取りをお断りください。商品が当社に戻ったことを確認しだい、往復の送料を差し引いて返金いたします'
      : s.cancel_after_ship === 'no' ? '・発送後のキャンセルは承っておりません' : '・発送後のキャンセルは承れません。商品がお手元に届いた後、返品・返金ポリシーのとおりにお申し込みください',
    s.after_ship_address === 'shop' ? '・発送後のお届け先の変更・転送・再配達は、当社から配送会社へ依頼いたします。お問い合わせフォームからご連絡ください' : '・発送後のお届け先の変更・転送・再配達・日時の変更は、追跡番号を添えて、お客さまから配送会社へ直接ご依頼ください',
  ].join('\n');
  c.undeliverable_sentence = s.undeliverable === 'reship_paid' ? '受け取りのお断り、住所の誤り、保管期限の経過など、お客さまのご事情により商品が当社に戻った場合は、再送の送料をご負担いただいたうえで、お送りし直します。'
    : s.undeliverable === 'refund_minus_shipping' ? '受け取りのお断り、住所の誤り、保管期限の経過など、お客さまのご事情により商品が当社に戻った場合は、往復の送料を差し引いて返金いたします。'
    : '受け取りのお断り、住所の誤り、保管期限の経過など、お客さまのご事情により商品が当社に戻った場合は、お問い合わせフォームからご連絡ください。対応をご案内いたします。';
  c.date_spec_sentence = s.delivery_date_spec ? 'お届けの日時のご指定を承ります。ご注文時にお知らせください。' : 'お届けの日時のご指定は承っておりません。';
  c.exchange_text = p.exchange_days ? `商品到着日から${p.exchange_days}日以内${p.exchange_condition === 'any' ? '' : 'で、未使用・未開封の商品に限り'}、サイズ・色の交換を承ります。お問い合わせフォームからご連絡ください。${p.exchange_shipping === 'shop' ? '交換の送料は当社が負担いたします。' : '交換の送料（ご返送の分と、新しい商品をお送りする分）は、お客さまのご負担となります。'}` : (p.exchange && p.exchange.text) || '';
  c.cancel_refund_sentence = s.cancel_refund_timing === 'business_days_7_10'
    ? '返金時期は、当社におけるキャンセル処理完了後、通常7〜10営業日程度を目安としますが、ご利用の決済会社、金融機関その他第三者機関の処理状況により前後する場合があります。'
    : `返金時期は、キャンセルが確定した日から、元のお支払い方法へのご返金が完了するまで、最大${s.refund_max_days}日程度のお時間を頂戴しております。`;
  // 商品の保証
  // 使う日数は、いつも保証の日数の半分（割り切れない時は切り上げ）。別には決めない（2026-11-19 運営者の決め：保証を 45日・60日に変えても「半分使ってから」は同じ）
  if (Number(p.guarantee_days) > 0) p.use_days = Math.ceil(Number(p.guarantee_days) / 2);
  const rate = Number(p.refund_rate ?? NaN);
  c.full_refund = rate === 100;
  if (isEmpty(p.guarantee_name) && p.guarantee_days) p.guarantee_name = c.full_refund ? `${p.guarantee_days}日間返金保証` : `${p.guarantee_days}日間お試し保証`;
  c.refund_amount = c.full_refund ? 'お支払いいただいた全額' : `お支払いいただいた金額の${rate}%`;
  c.apply_from_day = Number(p.use_days) + 1;
  c.apply_window = `商品到着日から${p.use_days}日を過ぎた後、${p.guarantee_days}日以内`;
  c.early_partial = p.early_refund === 'partial';
  c.early_fee_rate = c.early_partial ? 100 - Number(p.early_refund_rate) : '';
  const d = p.defect || {};
  c.defect_days_phrase = d.claim_days ? `商品到着日から${d.claim_days}日以内に、` : '';
  c.defect_return_required = !!d.return_required;
  c.has_subscription = !!p.subscription?.enabled;
  c.has_exchange = !!p.exchange?.enabled;
  c.processors_text = (s.privacy_processors && s.privacy_processors.length ? s.privacy_processors : ['決済代行会社','配送業者','商品の発送を行う倉庫事業者','ECプラットフォーム提供事業者','アクセス解析事業者']).join('、');
  c.body_disclaimer = '商品説明は一般的な情報であり、医療上の診断、治療、効果を保証するものではありません。体調に不安がある場合は専門家へご相談ください。';
  return ctx;
}

// ---------- 書類をまとめて作る（render.mjs とアプリのサーバーが同じ物を使う） ----------
// 書類と Shopify のポリシーの種類（ShopPolicyType。2026-10 の Admin GraphQL で確かめた）
export const DOCS = [
  { file: '特定商取引法に基づく表記', type: 'LEGAL_NOTICE' },
  { file: '返品・返金ポリシー', type: 'REFUND_POLICY' },
  { file: '利用規約', type: 'TERMS_OF_SERVICE' },
  { file: '配送ポリシー', type: 'SHIPPING_POLICY' },
  { file: 'プライバシーポリシー', type: 'PRIVACY_POLICY' },
  { file: '連絡先情報', type: 'CONTACT_INFORMATION' },
  { file: '定期便ポリシー', type: 'SUBSCRIPTION_POLICY', only: ctx => ctx.c.has_subscription },
];

export function isExample(profiles) {
  return !!(profiles.operator?._example || profiles.store?._example || profiles.product?._example);
}

// 足りない値があれば made は空で missing に質問が入る。書き出しはしない（呼ぶ側が置き場を決める）
export function renderDocs(profiles, { templatesDir, acceptDefaults = false, questions = loadQuestions() } = {}) {
  const { ctx, missing, usedDefaults } = resolve(profiles, { acceptDefaults, questions });
  if (missing.length) return { ok: false, ctx, missing, usedDefaults, made: [], problems: [] };
  const made = [];
  for (const d of DOCS) {
    if (d.only && !d.only(ctx)) continue;
    const tpl = fs.readFileSync(path.join(templatesDir, d.file + '.md'), 'utf8');
    const md = render(tpl, ctx, path.join(templatesDir, '_部品')).trim() + '\n';
    const html = toHtml(md.replace(/^# .*\n+/, '')); // Shopify のポリシーはタイトルを別に持つので、本文から頭の見出しを外す
    made.push({ file: d.file, type: d.type, md, html });
  }
  const problems = checkDocs(made, ctx);
  const p = ctx.product;
  const index = {
    rendered_at: new Date().toISOString(),
    example: isExample(profiles),
    shop: ctx.store.shop_name, product: p.product_name,
    guarantee: { name: p.guarantee_name, days: p.guarantee_days, use_days: p.use_days, refund: ctx.c.refund_amount, window: ctx.c.apply_window },
    used_defaults: usedDefaults,
    docs: made.map(d => ({ type: d.type, title: d.file, md: d.file + '.md', html: d.file + '.html' })),
    problems,
  };
  return { ok: true, ctx, missing, usedDefaults, made, problems, index };
}

// 点検（store-legal.md 6章）：日数・返金額が全部に同じ形で入っているか、合わない言葉が残っていないか
export function checkDocs(made, ctx) {
  const problems = [];
  for (const d of made.filter(x => ['LEGAL_NOTICE', 'REFUND_POLICY', 'TERMS_OF_SERVICE'].includes(x.type))) {
    if (!d.md.includes(ctx.c.apply_window)) problems.push(`${d.file}：申し込み期間「${ctx.c.apply_window}」が無い`);
    if (!d.md.includes(ctx.c.refund_amount)) problems.push(`${d.file}：返金額「${ctx.c.refund_amount}」が無い`);
  }
  for (const d of made) {
    if (/\{\{|\}\}/.test(d.md)) problems.push(`${d.file}：{{ }} が残っている`);
    if (ctx.store.ship_origin !== 'overseas_warehouse' && /海外|通関|国際物流|中国/.test(d.md)) problems.push(`${d.file}：発送元を「海外」と書かない設定なのに、海外の言葉がある`);
    if (!ctx.c.full_refund && /全額/.test(d.md)) problems.push(`${d.file}：全額返金でないのに「全額」がある`);
    if (!ctx.c.full_refund && /返金保証/.test(d.md)) problems.push(`${d.file}：全額返金でないのに「返金保証」の名前がある（「お試し保証」などにする）`);
    if (!ctx.product.body_use && d.md.includes(ctx.c.body_disclaimer)) problems.push(`${d.file}：体に使わない商品なのに免責の文がある`);
  }
  return problems;
}

// お問い合わせページ（contact-page/page.zg-contact.liquid.tmpl）を埋める。Liquid の {{ }} はそのまま残す
export const CONTACT_THEME_DEFAULT = { primary: '#1F2937', accent: '#111111', text: '#111111', border: '#d4d7dd', soft: '#f5f6f8' };
export function buildContact(ctx, tmplPath) {
  const c2 = structuredClone(ctx);
  c2.store.theme = { ...CONTACT_THEME_DEFAULT, ...Object.fromEntries(Object.entries(c2.store.theme || {}).filter(([, v]) => !isEmpty(v))) };
  let t = fs.readFileSync(tmplPath, 'utf8');
  t = t.replace(/\{\{/g, '\u0001').replace(/\}\}/g, '\u0002').replace(/\[\[/g, '{{').replace(/\]\]/g, '}}');
  return render(t, c2, path.dirname(tmplPath)).replace(/\u0001/g, '{{').replace(/\u0002/g, '}}');
}
// ブラウザで見るだけの見本（Liquid の form を素の form に置き換える）
export function contactPreview(liquid) {
  const html = liquid.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '')
    .replace(/\{%-?\s*form[^%]*%\}/, '<form id="zg-contact" onsubmit="return false">').replace(/\{%-?\s*endform\s*-?%\}/, '</form>')
    .replace(/\{%-?\s*if[^%]*%\}[\s\S]*?\{%-?\s*endif\s*-?%\}/g, '');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>お問い合わせ（見本）</title><body style="margin:0;background:#fff">${html}</body>`;
}

// ---------- ひな形 ----------
// 書き方：{{a.b}}／{{#if a.b}}…{{else}}…{{/if}}／{{#if a.b == "x"}}／{{#unless a.b}}…{{/unless}}／{{> 部品名}}（_部品/部品名.md）
export function render(tpl, ctx, partialsDir, depth = 0) {
  if (depth > 5) throw new Error('部品の入れ子が深すぎる');
  tpl = tpl.replace(/\{\{>\s*([^}]+?)\s*\}\}/g, (_, name) => render(fs.readFileSync(path.join(partialsDir, name + '.md'), 'utf8').replace(/\n$/, ''), ctx, partialsDir, depth + 1));
  const tokens = tpl.split(/(\{\{[#/]?(?:if|unless|else)[^}]*\}\})/);
  const out = []; const stack = [{ on: true }];
  const live = () => stack.every(f => f.on);
  for (const t of tokens) {
    let m;
    if ((m = t.match(/^\{\{#(if|unless)\s+([^}]+?)\s*\}\}$/))) {
      let v = test(m[2], ctx); if (m[1] === 'unless') v = !v; stack.push({ on: v, kind: m[1] });
    } else if (/^\{\{else\}\}$/.test(t)) { const f = stack[stack.length - 1]; f.on = !f.on; }
    else if ((m = t.match(/^\{\{\/(if|unless)\}\}$/))) { if (stack.length < 2) throw new Error('閉じすぎ: ' + t); stack.pop(); }
    else if (live()) out.push(t);
  }
  if (stack.length !== 1) throw new Error('{{#if}} が閉じていない');
  let s = out.join('').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => {
    const v = getPath(ctx, k); if (k.startsWith('c.') && v === '') return ''; if (isEmpty(v)) throw new Error('値が無い: ' + k);
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  });
  return s.replace(/\n{3,}/g, '\n\n');
}
function test(expr, ctx) {
  const m = expr.match(/^([\w.]+)\s*(==|!=)\s*"([^"]*)"$/);
  if (m) { const v = String(getPath(ctx, m[1]) ?? ''); return m[2] === '==' ? v === m[3] : v !== m[3]; }
  const v = getPath(ctx, expr.trim()); return !!v && !(Array.isArray(v) && !v.length);
}

// ---------- Markdown（この形だけ）→ Shopify のポリシー用 HTML ----------
// # 見出し → h2、■ や「1. 」で始まる行 → h3、・ で始まる行 → ul、空行で段落
export function toHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const link = s => esc(s).replace(/(https:\/\/[^\s<）)]+)/g, '<a href="$1">$1</a>');
  const lines = md.split('\n'); const html = []; let list = null; let para = [];
  const flush = () => { if (para.length) { html.push('<p>' + para.map(link).join('<br>') + '</p>'); para = []; } if (list) { html.push('<ul>' + list.map(x => '<li>' + link(x) + '</li>').join('') + '</ul>'); list = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) { flush(); continue; }
    if (/^#\s/.test(l)) { flush(); html.push('<h2>' + esc(l.replace(/^#\s+/, '')) + '</h2>'); continue; }
    if (/^(■|【|第\d+条|\d+\.\s)/.test(l)) { flush(); html.push('<h3>' + esc(l.replace(/^■\s*/, '')) + '</h3>'); continue; }
    if (/^・/.test(l)) { if (para.length) { html.push('<p>' + para.map(link).join('<br>') + '</p>'); para = []; } (list ||= []).push(l.slice(1)); continue; }
    if (list) { html.push('<ul>' + list.map(x => '<li>' + link(x) + '</li>').join('') + '</ul>'); list = null; }
    para.push(l);
  }
  flush(); return html.join('\n');
}
