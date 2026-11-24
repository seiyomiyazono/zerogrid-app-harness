// 端から端までの確かめ（相性チェック mode: fit_check・立ち仕事マット）。本物の受け口 api/webhook.js に、署名つきの偽の出来事を送る。
// 外への通信は fake.mjs が止め、LINE・Shopify へ行くはずだった中身を見て確かめる。
import assert from 'assert/strict'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process'; import fs from 'fs';
import { fakeEnv, installFakeFetch, fakeReq, fakeRes, ev, buttons } from './fake.mjs';
const R = fileURLToPath(new URL('..', import.meta.url));
const SAMPLE = process.argv[2] || fileURLToPath(new URL('../products/tachimat-fitcheck/survey.json', import.meta.url));
execFileSync('node', [R + 'scripts/use-product.mjs', SAMPLE], { stdio: 'inherit', env: { ...process.env, LIFF_ID: '2000000000-TESTLIFF' } });
Object.assign(process.env, fakeEnv({ LIFF_ID: '2000000000-TESTLIFF', SHOPIFY_CLIENT_ID: '', SHOPIFY_CLIENT_SECRET: '', SHOPIFY_ADMIN_TOKEN: 'fake-admin-token' }));
const cfg = JSON.parse(fs.readFileSync(R + 'config/survey.json'));
const F = installFakeFetch();
const handler = (await import('../api/webhook.js')).default;
let ok = 0; const t = (name, cond) => { assert.ok(cond, name); ok++; console.log('  ○ ' + name); };
async function post(events) { F.calls.length = 0; const res = fakeRes(); await handler(fakeReq({ events }), res); const r = F.calls.find(c => c.url.includes('message/reply')); return { res, msgs: r ? r.body.messages : [], calls: [...F.calls] }; }
const pb = m => buttons(m).filter(a => a.type === 'postback');
const S = JSON.stringify;
const Q = cfg.questions; const qi = k => Q.findIndex(q => q.key === k);
// 問いに順に答える（値で選ぶ）
async function answer(vals) {
  let { msgs } = await post([ev.postback('s=0')]); let last;
  for (const q of Q) { const i = q.opts.findIndex(o => o[0] === vals[q.key]); const a = pb(msgs)[i < 0 ? 0 : i]; last = await post([ev.postback(a.data)]); msgs = last.msgs; }
  return last;
}

t('mode は fit_check', cfg.mode === 'fit_check');
// 友だち追加 → あいさつ＋カード（買う前の相性チェック）
let { msgs } = await post([ev.follow()]);
t('あいさつに名前が入る', msgs[0].text.startsWith('テストさん、'));
t('カードの言葉は「買う前に、あなたに合うか」', msgs[1].altText.includes('買う前に') && msgs[1].altText.includes('合うか'));
t('ボタンは「チェックする」', pb(msgs)[0].label === 'チェックする');
({ msgs } = await post([ev.text('相性を知りたい')])); t('「相性」で1問目', S(msgs).includes(`【1/${Q.length}問目】`));
// 悩みを聞く問いが無い
t('問いに「困っている・つらい・悩み」が無い', !Q.some(q => /困って|つらい|悩/.test(q.head)));
t('問いは 使う場所・身長・足元・床', S(Q.map(q => q.key)) === S(['a', 'z', 'k', 'f']));

// 1. 合う人：レジ・163cm以下・靴・硬い床 → 入力中 → 合います（理由3つ、答えから）＋最後の不安
let r = await answer({ a: 'p1', z: 'mini', k: 'shoes', f: 'hard' });
t('4問目の後に「入力中…」', r.calls.some(c => c.url.endsWith('/chat/loading/start')));
t('結果は2通（合いますのカード・不安のカード）', r.msgs.length === 2 && r.msgs[0].altText.includes('合います'));
const card = S(r.msgs[0]);
t('合いますの画像 fit_ok.jpg', r.msgs[0].contents.hero.url.includes('/img/fit_ok.jpg'));
t('理由は3つ（1. 2. 3.）', (card.match(/"text":"\d\."/g) || []).length === 3);
t('理由は答えから（身長→Mini・靴・床）', card.includes('Mini') && card.includes('靴') && card.includes('硬い床'));
t('合わない人のボタンは出ない', !card.includes('s=x&'));
t('不安の問いのボタンが6つ＋次へ', pb(r.msgs[1]).length === cfg.worries.items.length + 1);
// 2. 不安を2つ → 答えのカード（1つ目は画像つき）→ 選んだ不安は消える
let w = await post([ev.postback(pb(r.msgs[1])[0].data)]);
const A1 = cfg.worries.answers[cfg.worries.items[0][0]];
t('答えのカードに見出しと本文', S(w.msgs[0]).includes(A1.title) && S(w.msgs[0]).includes(A1.body[0]));
t('1つ目の答えは画像つき（d_d1.jpg）', w.msgs[0].contents.hero.url.includes('/img/d_d1.jpg'));
t('選んだ不安はボタンから消える', !S(w.msgs[1]).includes(cfg.worries.items[0][1]));
w = await post([ev.postback(pb(w.msgs[1])[1].data)]);
t('2つ目の答えは文だけ（画像なし）', !w.msgs[0].contents.hero);
const next = pb(w.msgs[1]).find(a => a.data.startsWith('s=cp&'));
t('2つ選ぶと「もう大丈夫、次へ」→ クーポンへ（今の対策・比べるは出さない）', next.label === cfg.worries.next_more);
// 3. クーポン → 発行 → おすすめ（身長の答えでサイズが決まっている）
r = await post([ev.postback(next.data)]); t('クーポンのカード（回答のお礼）', r.msgs[0].altText.includes('回答のお礼'));
r = await post([ev.postback(pb(r.msgs)[0].data)]);
const create = r.calls.find(c => c.url.includes('graphql') && c.body.query.includes('discountCodeBasicCreate'));
t('割引の管理名に答えと不安が残る', create.body.variables.d.title.startsWith('LINE相性チェック｜レジ・品出し・163cm以下・') && create.body.variables.d.title.includes('｜不安:'));
t('1人1回・1,000円・24時間', create.body.variables.d.usageLimit === 1 && create.body.variables.d.customerGets.value.discountAmount.amount === '1000' && Math.abs(new Date(create.body.variables.d.endsAt) - new Date(create.body.variables.d.startsAt) - 24 * 36e5) < 1000);
const code = create.body.variables.d.code;
t('おすすめは 1枚・2枚 のカルーセル', r.msgs[1].contents.contents.length === 2);
t('サイズは答えのとおり Mini', S(r.msgs[1]).includes(cfg.offer.size_labels.mini));
const uri = buttons(r.msgs).find(a => a.type === 'uri').uri; const cart = new URL(decodeURIComponent(uri.split('to=')[1]));
t('購入は LIFF の /go → カートを空に', uri.startsWith('https://liff.line.me/2000000000-TESTLIFF/go?to=') && cart.pathname === '/cart/clear');
t('入れるのは Mini の1枚のバリアント', cart.searchParams.get('return_to').startsWith(`/cart/add?id=${cfg.variants['mini|1']}&quantity=1`));
t('最後に割引つきの購入手続き', decodeURIComponent(new URL('https://x' + cart.searchParams.get('return_to')).searchParams.get('return_to')) === `/checkout?discount=${code}`);
t('UTM に line・bot・相性チェックの campaign', cart.searchParams.get('utm_source') === 'line' && cart.searchParams.get('utm_campaign') === cfg.utm.campaign);

// 4. 注意つきで合う：196cm以上 → Original を選び、※の行が出る。購入は Original
r = await answer({ a: 'p3', z: 'big', k: 'socks', f: 'hard' });
t('注意つき：見出しが「1つだけ気をつける点」', S(r.msgs[0]).includes('気をつける点') && S(r.msgs[0]).includes('※'));
w = await post([ev.postback(pb(r.msgs[1]).find(a => a.data.startsWith('s=cp&')).data)]);
w = await post([ev.postback(pb(w.msgs)[0].data)]);
const uri2 = decodeURIComponent(decodeURIComponent(buttons(w.msgs).find(a => a.type === "uri").uri));
t('196cm以上は Original のバリアント（size_alias）', uri2.includes(`id=${cfg.variants['orig|1']}`) && S(w.msgs[1]).includes(cfg.offer.size_labels.orig));

// 5. 合わない人：ヒールのある靴 → 正直に「合わないかもしれません」。不安のカードを勝手に出さない
r = await answer({ a: 'p5', z: 'orig', k: 'heel', f: 'hard' });
t('合わない：1通だけ・「合わないかもしれません」', r.msgs.length === 1 && S(r.msgs[0]).includes('合わないかもしれません'));
t('合わない理由は A の「使えない人」から（ヒール）', S(r.msgs[0]).includes('ヒール'));
t('合わない人にクーポンを押しつけない（ボタンは「答えを見る」「やめておく」だけ）', S(pb(r.msgs).map(a => a.data.slice(0, 4))) === S(['s=d0', 's=x&']));
const stop = await post([ev.postback(pb(r.msgs)[1].data)]);
t('「やめておく」はお礼の文だけ・割引を作らない', stop.msgs.length === 1 && stop.msgs[0].type === 'text' && !stop.calls.some(c => c.url.includes('graphql')));
const go = await post([ev.postback(pb(r.msgs)[0].data)]);
t('「それでも答えを見る」で不安のカード', S(go.msgs[0]).includes(cfg.worries.head_first));
t('プッシュは1通も使わない', !F.calls.some(c => /message\/(push|multicast|broadcast|narrowcast)/.test(c.url)));
const pop = fs.readFileSync(R + 'build/theme/tachimat/line-popup.liquid', 'utf8');
t('ポップアップの言葉は「買う前に、あなたに合うか30秒でチェック」', pop.includes('買う前に、あなたに合うか30秒でチェック') && pop.includes('相性チェック'));
F.restore();
console.log(`e2e（相性チェック・立ち仕事マット）：${ok}件 すべて通った`);
process.exit(0);
