// LINE 診断の本体（どの商品でも同じ）。商品ごとの中身は products/<id>/survey.json だけ。
// 元の店（元の Bot の api/webhook.js・lib/survey.js、2026-09-27 版）を、そのまま設定で動く形にした物。
// 流れ：友だち追加 → 問い（survey.questions）→（入力中…）→ 結果画像 → 不安ごとの答えの画像（何度でも）
// → 今の対策（写真のカルーセル）→ 比べた画像 → クーポンのカード →（定期便などを聞く：offer.ask。無ければ飛ばす）
// → クーポン発行（Shopify・1人1つ）→ おすすめのカルーセル → 購入手続きへ直行（カートを空 → 入れる → checkout）。
// 回答は postback に持たせて運ぶ（サーバーに状態を置かない）。返事はすべて reply（プッシュの通数を使わない）。
//
// mode: "fit_check"（2026-10-20 運営者「LINE は最後の最後の不安だけ。本当にあなたに合うのかを確かめる」）：
// 友だち追加 → 相性の問い（使う場所・体格・足元など。選択肢に fit: ok|warn|no と理由を持たせる）→（入力中…）
// → 「あなたに合います（あなたの答えから理由3つ）」と最後の不安のカード ／ 本当に合わない答えがあれば正直に「合わないかもしれません」
// → 不安ごとの答えのカード（何度でも）→ クーポンのカード → 発行 → おすすめ（サイズの答えでバリアントを先に選ぶ）→ 購入手続きへ直行。
// 悩みを聞く問い・今の対策・比べる画像は出さない（悩みは VSL・記事・店で言い切っている）。mode が無ければ今までの診断（元の店）。
import crypto from 'crypto';

const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m));
export const enc = o => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))).toString();
export const yen = n => `${Number(n).toLocaleString()}円`;

export function createBot(cfg, deps = {}) {
  const env = deps.env || process.env;
  const SITE = env.SITE_URL || cfg.site.url;
  const BASE = env.PUBLIC_URL || cfg.public_url;
  const T = cfg.brand.theme; const PRIMARY = T.primary, INK = T.ink, MUTE = T.mute;
  const V = cfg.image_version || '';
  const Q = cfg.questions; const O = cfg.offer; const C = cfg.coupon; const FIT = cfg.mode === 'fit_check';
  const COUPON = Number(env.COUPON_AMOUNT || C.amount);
  const img = (tpl, ans = {}) => `${BASE}/img/${fill(tpl, ans)}${V}`;
  const label = (key, v) => ((Q.find(q => q.key === key) || { opts: [] }).opts.find(o => o[0] === v) || [, v])[1];
  const toolLabel = g => ((cfg.tools?.items || []).find(t => t[0] === g) || [])[1] || '';
  const opt = (key, v) => (Q.find(q => q.key === key) || { opts: [] }).opts.find(o => o[0] === v);
  const sleep = deps.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const fetchF = deps.fetch || ((...a) => fetch(...a));
  const api = (path, body, method = 'POST') => fetchF('https://api.line.me/v2/bot/' + path, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN }, body: body ? JSON.stringify(body) : undefined });
  const reply = (tok, messages) => { if (deps.onReply) deps.onReply(messages); return api('message/reply', { replyToken: tok, messages: messages.slice(0, 5) }); }; // 1回の返事は5通まで（LINE の上限）
  async function nameOf(uid) { try { const r = await api('profile/' + uid, null, 'GET'); const j = await r.json(); return j.displayName ? `${j.displayName}さん` : 'あなた'; } catch { return 'あなた'; } }

  // ---- Flex の部品（色だけテーマから）----
  const txt = (text, o = {}) => ({ type: 'text', text, wrap: true, size: 'sm', color: INK, ...o });
  const btn = (lab, data, display, style = 'primary') => ({ type: 'button', style, height: 'sm', color: style === 'primary' ? PRIMARY : undefined, action: { type: 'postback', label: lab.slice(0, 40), data, displayText: display || lab } });
  const uriBtn = (lab, uri) => ({ type: 'button', style: 'primary', height: 'md', color: PRIMARY, action: { type: 'uri', label: lab, uri } });
  const bubble = (body, o = {}) => ({ type: 'bubble', size: o.size || 'mega', ...(o.hero ? { hero: { type: 'image', url: o.hero, size: 'full', aspectRatio: o.ratio || '1:1', aspectMode: 'cover' } } : {}), body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '18px', contents: body }, ...(o.footer ? { footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '14px', contents: o.footer } } : {}) });
  const flex = (alt, contents) => ({ type: 'flex', altText: alt, contents });
  const image = url => ({ type: 'image', originalContentUrl: url, previewImageUrl: url });

  function welcome(name) {
    const c = cfg.copy;
    return [
      { type: 'text', text: fill(c.welcome, { name }) },
      flex(c.card_alt, bubble([txt(c.card_note, { size: 'xs', color: MUTE })], { hero: img('hero.jpg'), ratio: '1:1', footer: [btn(c.start_label, 's=0', c.start_label)] })),
    ];
  }
  function question(step, ans, name) {
    const q = Q[step];
    return flex(`【${step + 1}/${Q.length}問目】`, bubble([
      txt(`【${step + 1}/${Q.length}問目】`, { weight: 'bold', color: PRIMARY }),
      txt(fill(q.head, { name }), { size: 'md', weight: 'bold' }),
      { type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: q.opts.map(([v, l]) => btn(l, `s=${step + 1}&${enc({ ...ans, [q.key]: v })}`, l, 'secondary')) },
    ]));
  }
  function worryQ(ans, first) {
    const W = cfg.worries; const seen = (ans.ws || '').split(',').filter(Boolean);
    const left = W.items.filter(([k]) => !seen.includes(k));
    return flex(W.alt, bubble([
      txt(first ? W.head_first : W.head_more, { size: 'md', weight: 'bold' }),
      { type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: [
        ...left.map(([k, l]) => btn(l, `s=w&${enc({ ...ans, w: k, ws: [...seen, k].join(',') })}`, l, 'secondary')),
        btn(seen.length ? W.next_more : W.next_first, `s=${FIT ? 'cp' : 'g0'}&${enc({ ...ans, w: '' })}`, '次へ'),
      ] },
    ]));
  }
  function toolsQ(ans) {
    const t = cfg.tools;
    return [
      { type: 'text', text: t.intro },
      flex(t.alt, { type: 'carousel', contents: t.items.map(([k, l]) => bubble([txt(l, { weight: 'bold', size: 'md' })], { size: 'kilo', hero: img(t.image, { g: k }), footer: [btn(t.button, `s=g&${enc({ ...ans, g: k })}`, l)] })) }),
    ];
  }
  const compareCard = ans => flex(cfg.compare.alt, bubble([txt(cfg.compare.note, { size: 'xs', color: MUTE, align: 'center' })], { hero: img(cfg.compare.image, ans), ratio: '1:1', footer: [btn(cfg.compare.button, `s=cp&${enc(ans)}`, cfg.compare.button)] }));
  const couponOffer = ans => flex(C.alt, bubble([txt(C.note, { size: 'xs', color: MUTE, align: 'center' })], { hero: img(C.image), ratio: '1:1', footer: [btn(C.button, `s=u&${enc(ans)}`, C.button)] }));
  function askCard(ans, info) {
    const A = O.ask;
    const footer = info
      ? [btn(A.yes_label_info || A.yes_label, `s=cy&${enc(ans)}`, A.yes_label_info || A.yes_label), btn(A.no_label, `s=cn&${enc(ans)}`, A.no_label, 'secondary')]
      : [...(A.info_label ? [btn(A.info_label, `s=cq&${enc(ans)}`, A.info_label, 'secondary')] : []), btn(A.yes_label, `s=cy&${enc(ans)}`, A.yes_label), btn(A.no_label, `s=cn&${enc(ans)}`, A.no_label, 'secondary')];
    return flex(info ? A.info_alt : A.alt, bubble([txt(A.text, { size: 'sm', weight: 'bold', color: PRIMARY, align: 'center' })], { size: 'kilo', footer }));
  }

  // ---- 相性チェック（mode: fit_check）----
  // 答えから「合う／気をつければ合う／合わないかもしれない」を決める。理由は選んだ選択肢の reason（出典は _sources）
  function verdict(ans) {
    const F = cfg.fit; const reasons = [], cautions = [], blocks = [], filler = [];
    for (const q of Q) {
      const o = opt(q.key, ans[q.key]); const m = (o && o[2]) || {};
      if (m.fit === 'no') blocks.push(m.reason); else if (m.fit === 'warn') cautions.push(m.reason);
      else if (m.reason) (q.in_reasons === false ? filler : reasons).push(m.reason); // in_reasons:false（場所など）は足りない時だけ
    }
    for (const r of [...filler, ...(F.fixed_reasons || [])]) if (reasons.length < 3) reasons.push(r);
    return { level: blocks.length ? 'no' : cautions.length ? 'warn' : 'ok', reasons: reasons.slice(0, 3), cautions, blocks };
  }
  const line = (n, t, color) => ({ type: 'box', layout: 'baseline', spacing: 'sm', contents: [txt(n, { flex: 0, weight: 'bold', color: color || PRIMARY, wrap: false }), txt(t)] });
  function fitCard(ans, name) {
    const F = cfg.fit; const v = verdict(ans);
    if (v.level === 'no') return flex(F.alt_no, bubble([
      txt(fill(F.head_no, { name }), { size: 'md', weight: 'bold' }),
      ...v.blocks.map(t => line('・', t, INK)),
      ...(F.note_no ? [txt(F.note_no, { size: 'xs', color: MUTE })] : []),
    ], { hero: F.no_image ? img(F.no_image, ans) : undefined, footer: [btn(F.continue_no, `s=d0&${enc(ans)}`, F.continue_no, 'secondary'), btn(F.stop_label, `s=x&${enc(ans)}`, F.stop_label, 'secondary')] }));
    return flex(F.alt_ok, bubble([
      txt(fill(v.level === 'warn' ? F.head_warn || F.head_ok : F.head_ok, { name }), { size: 'md', weight: 'bold', color: PRIMARY }),
      txt(F.reasons_title, { size: 'xs', color: MUTE }),
      ...v.reasons.map((t, i) => line(`${i + 1}.`, t)),
      ...v.cautions.map(t => line('※', t, MUTE)),
    ], { hero: F.ok_image ? img(F.ok_image, ans) : undefined }));
  }
  function answerCard(k) {
    const A = (cfg.worries.answers || {})[k] || {}; const l = (cfg.worries.items.find(x => x[0] === k) || [])[1] || '';
    return flex(l || cfg.worries.alt, bubble([
      txt(l, { size: 'xs', color: MUTE }),
      txt(A.title || '', { size: 'lg', weight: 'bold', color: PRIMARY }),
      ...(A.body || []).map(t => txt(t)),
      ...(A.note ? [txt(A.note, { size: 'xxs', color: MUTE })] : []),
    ], { hero: A.image ? img(A.image) : undefined }));
  }

  // ---- 購入リンク ----
  const goUrl = u => (env.LIFF_ID || cfg.line.liff_id) ? `https://liff.line.me/${env.LIFF_ID || cfg.line.liff_id}/go?to=${encodeURIComponent(u)}` : u;
  function addUrl(ans, code) {
    const v = cfg.variants[fill(O.variant_key, ans)];
    const back = encodeURIComponent(`/checkout?discount=${code}`);
    const q = (k, x) => `${encodeURIComponent(k)}=${x}`;
    const S = O.subscription;
    if (S && ans.sub === '1') return `${SITE}/cart/add?${[q('items[0][id]', v), q('items[0][quantity]', 1), q('items[1][id]', S.addon_variant), q('items[1][quantity]', 1), q('items[1][selling_plan]', S.selling_plan)].join('&')}&return_to=${back}`;
    return `${SITE}/cart/add?id=${v}&quantity=1&return_to=${back}`;
  }
  function cartUrl(ans, code) {
    // 先にカートを空にしてから、選んだ商品だけ入れて購入手続きへ（前から入っていた物が混ざらないように）
    const content = O.subscription ? (ans.sub === '1' ? 'sub' : 'nosub') : fill(O.utm_content || '{' + O.item_field + '}', ans);
    const utm = `utm_source=line&utm_medium=bot&utm_campaign=${cfg.utm.campaign}&utm_content=${content}`;
    return `${SITE}/cart/clear?${utm}&return_to=${encodeURIComponent(addUrl(ans, code).replace(SITE, ''))}`;
  }
  function recommend(ans, name, code) {
    const sub = ans.sub === '1'; const S = O.subscription;
    const sz = O.size_alias ? (O.size_alias[ans[O.size_key]] || ans[O.size_key]) : ans[O.size_key]; // 例：196cm 以上も Original
    const size = (O.size_labels || {})[sz] || '';
    return [
      { type: 'text', text: fill(C.applied_text, { code, hours: Number(env.COUPON_HOURS || C.hours), yen: COUPON.toLocaleString() }) },
      flex(fill(O.alt, { name }), { type: 'carousel', contents: O.items.map(([k, l]) => {
        const a = { ...ans, ...(O.fixed || {}), [O.item_field]: k, sub: sub ? '1' : '', ...(O.size_alias ? { [O.size_key]: sz } : {}) };
        const [price, compareAt] = O.prices[fill(O.price_key, a)] || Object.values(O.prices || {})[0] || [0, 0];   // 問いが無い商品（答えが空）でも落ちない（2026-10-21）
        const after = S && sub ? Math.round(price * (1 - S.off_rate)) : price;
        return bubble([
          txt(fill(O.kicker, { name }), { size: 'xxs', color: MUTE }),
          txt(fill(O.title, { brand: cfg.brand.name, item: l }), { size: 'lg', weight: 'bold', color: PRIMARY }),
          txt(fill(O.subtitle, { item: l, size }), { size: 'xxs', color: MUTE }),
          { type: 'box', layout: 'baseline', spacing: 'sm', contents: S && sub
            ? [txt(yen(after), { size: 'xl', weight: 'bold', flex: 0, wrap: false }), txt(yen(price), { size: 'xxs', color: MUTE, decoration: 'line-through', flex: 0, wrap: false })]
            : [txt(yen(price), { size: 'xl', weight: 'bold', flex: 0, wrap: false }), ...(compareAt && compareAt > price ? [txt(yen(compareAt), { size: 'xxs', color: MUTE, decoration: 'line-through', flex: 0, wrap: false })] : [])] },
          ...(S ? [txt(sub ? S.on_text : S.off_text, { size: 'xxs', color: MUTE })] : []),
        ], { size: 'kilo', hero: img(O.image, a), footer: [uriBtn(O.buy_label, goUrl(cartUrl(a, code)))] });
      }) }),
    ];
  }
  async function finish(ev, uid, p, name) {
    const lab = FIT
      ? Q.map(q => label(q.key, p[q.key])).join('・') + ((p.ws || '') ? '｜不安:' + p.ws.split(',').map(k => (cfg.worries.items.find(x => x[0] === k) || [, k])[1]).join('・') : '')
      : Q.map(q => label(q.key, p[q.key])).join('・') + '・' + toolLabel(p.g);
    let c; try { c = await deps.issueCoupon(uid, lab); } catch (e) { console.error('coupon', e.message); }
    if (!c) return reply(ev.replyToken, [{ type: 'text', text: cfg.copy.fail_text }]);
    return reply(ev.replyToken, recommend(p, name, c.code));
  }

  async function onPostback(ev, uid) {
    const p = Object.fromEntries(new URLSearchParams(ev.postback.data)); const s = p.s; delete p.s;
    const name = await nameOf(uid);
    if (/^\d+$/.test(s)) {
      const step = Number(s);
      if (step < Q.length) return reply(ev.replyToken, [question(step, p, name)]);
      // 問いがそろった → 確かめている演出（入力中…）→ 結果
      await api('chat/loading/start', { chatId: uid, loadingSeconds: cfg.copy.loading_seconds || 5 }).catch(() => {});
      await sleep(cfg.copy.loading_wait_ms ?? 3000);
      if (FIT) return reply(ev.replyToken, verdict(p).level === 'no' ? [fitCard(p, name)] : [fitCard(p, name), worryQ(p, true)]);
      return reply(ev.replyToken, [image(img(cfg.result.image, p)), worryQ(p, true)]);
    }
    if (s === 'w') return reply(ev.replyToken, [FIT ? answerCard(p.w) : image(img(cfg.worries.image, p)), worryQ(p, false)]);
    if (FIT && s === 'd0') return reply(ev.replyToken, [worryQ(p, true)]);
    if (FIT && s === 'x') return reply(ev.replyToken, [{ type: 'text', text: fill(cfg.fit.stop_text, { name }) }]);
    if (s === 'g0') return reply(ev.replyToken, toolsQ(p));
    if (s === 'g') return reply(ev.replyToken, [compareCard(p)]);
    if (s === 'cp') return reply(ev.replyToken, [couponOffer(p)]);
    if (s === 'u') {
      if (O.ask) return reply(ev.replyToken, [image(img(O.ask.image, p)), askCard(p, false)]);
      p.sub = ''; return finish(ev, uid, p, name);
    }
    if (s === 'cq' && O.ask) return reply(ev.replyToken, [image(img(O.ask.info_image, p)), askCard(p, true)]);
    if (s === 'cy' || s === 'r' || s === 'cn') { p.sub = s === 'cn' || !O.subscription ? '' : '1'; return finish(ev, uid, p, name); }
  }

  async function handle(body, signature) {
    const sig = crypto.createHmac('sha256', env.LINE_CHANNEL_SECRET).update(body).digest('base64');
    if (sig !== signature) return 401;
    const { events = [] } = JSON.parse(body);
    const kw = new RegExp(cfg.copy.keywords);
    await Promise.all(events.map(async ev => {
      try {
        const uid = ev.source && ev.source.userId;
        if (ev.type === 'follow') return reply(ev.replyToken, welcome(await nameOf(uid)));
        if (ev.type === 'message' && ev.message.type === 'text') {
          if (kw.test(ev.message.text)) return reply(ev.replyToken, [question(0, {}, await nameOf(uid))]);
          return; // それ以外は手動チャットで返す
        }
        if (ev.type === 'postback') return onPostback(ev, uid);
      } catch (e) { console.error(e.message); }
    }));
    return 200;
  }
  return { handle, cartUrl, recommend, question, worryQ, toolsQ, welcome, label, img, verdict, fitCard, answerCard };
}
