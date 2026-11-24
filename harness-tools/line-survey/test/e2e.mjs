// 端から端までの確かめ（立ち仕事マットの設定で）。本物の受け口 api/webhook.js に、署名つきの偽の出来事を送る。
// 外への通信は fake.mjs が止め、LINE・Shopify へ行くはずだった中身を見て確かめる。
// 先に: node scripts/use-product.mjs test/fixtures/tachimat-diagnosis.json（このテストが自分で回す）
import assert from 'assert/strict'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process'; import fs from 'fs'; import vm from 'vm';
import { fakeEnv, installFakeFetch, fakeReq, fakeRes, ev, buttons } from './fake.mjs';
const R = fileURLToPath(new URL('..', import.meta.url));
// 診断の形（悩みを聞く・今の対策・比べる）の確かめ。2026-10-20 に立ち仕事マットは相性チェックへ替えたので、前の形は test/fixtures に残して仕組みの確かめに使う
const SAMPLE = process.argv[2] || fileURLToPath(new URL('./fixtures/tachimat-diagnosis.json', import.meta.url));
execFileSync('node', [R + 'scripts/use-product.mjs', SAMPLE], { stdio: 'inherit', env: { ...process.env, LIFF_ID: '2000000000-TESTLIFF' } });
Object.assign(process.env, fakeEnv({ LIFF_ID: '2000000000-TESTLIFF', SHOPIFY_CLIENT_ID: '', SHOPIFY_CLIENT_SECRET: '', SHOPIFY_ADMIN_TOKEN: 'fake-admin-token' }));
const cfg = JSON.parse(fs.readFileSync(R + 'config/survey.json'));
const F = installFakeFetch();
const handler = (await import('../api/webhook.js')).default;
let ok = 0; const t = (name, cond) => { assert.ok(cond, name); ok++; console.log('  ○ ' + name); };
async function post(events, sig) { F.calls.length = 0; const res = fakeRes(); await handler(fakeReq({ events }, sig), res); const r = F.calls.find(c => c.url.includes('message/reply')); return { res, msgs: r ? r.body.messages : [], calls: [...F.calls] }; }

// GET は 200（Vercel の生存確認）、署名が違えば 401 で何も送らない
{ const res = fakeRes(); await handler(Object.assign(fakeReq({}), { method: 'GET' }), res); t('GET は 200', res.statusCode === 200); }
{ const { res, calls } = await post([ev.follow()], 'AAAA'); t('署名が違うと 401・LINE に何も送らない', res.statusCode === 401 && calls.length === 0); }
// 友だち追加 → あいさつ＋カード
let { msgs, res } = await post([ev.follow()]);
t('友だち追加で 200', res.statusCode === 200);
t('あいさつに名前が入る', msgs[0].text.startsWith('テストさん、'));
t('カードの画像は public_url/img/hero.jpg', msgs[1].contents.hero.url === `${cfg.public_url}/img/hero.jpg${cfg.image_version}`);
t('ボタンの色はブランドの色', msgs[1].contents.footer.contents[0].color === cfg.brand.theme.primary);
// 関係ない言葉には返さない（手で返す）。「診断」なら1問目
({ msgs } = await post([ev.text('こんにちは')])); t('関係ない言葉には返さない', msgs.length === 0);
({ msgs } = await post([ev.text('診断したい')])); t('「診断」で1問目', JSON.stringify(msgs).includes('【1/4問目】'));
// 4問 → 入力中 → 結果
const pick = (m, i = 0) => buttons(m).filter(a => a.type === 'postback')[i];
({ msgs } = await post([ev.postback('s=0')]));
const answers = [0, 2, 0, 1]; let last;
for (let i = 0; i < 4; i++) { const a = pick(msgs, answers[i]); last = await post([ev.postback(a.data)]); msgs = last.msgs; }
t('4問目の後に「入力中…」を出す', last.calls.some(c => c.url.endsWith('/chat/loading/start') && c.body.loadingSeconds === 5));
t('結果の画像は r_koshi_reji（腰×レジ）', msgs[0].type === 'image' && msgs[0].originalContentUrl.includes('/img/r_koshi_reji.jpg'));
// 不安を2つ → 次へ → 今の対策 → 比べる → クーポン → 使う
let r = await post([ev.postback(pick(msgs, 1).data)]); t('不安の答えの画像 w_wobble', r.msgs[0].originalContentUrl.includes('/img/w_wobble.jpg'));
t('選んだ不安はボタンから消える', !JSON.stringify(r.msgs[1]).includes('ふらつかない'));
r = await post([ev.postback(pick(r.msgs, 0).data)]);
const next = buttons(r.msgs).find(a => a.data?.startsWith('s=g0&')); t('2つ選ぶと「もう大丈夫、次へ」', next.label === 'もう大丈夫、次へ');
r = await post([ev.postback(next.data)]); t('今の対策は6枚のカルーセル', r.msgs[1].contents.contents.length === 6);
r = await post([ev.postback(buttons(r.msgs)[3].data)]); t('比べる画像 c_shippu', r.msgs[0].contents.hero.url.includes('/img/c_shippu.jpg'));
r = await post([ev.postback(pick(r.msgs).data)]); t('クーポンのカード', r.msgs[0].altText.includes('1,000円OFF'));
r = await post([ev.postback(pick(r.msgs).data)]);
// 定期便なし → すぐ発行
const create = r.calls.find(c => c.url.includes('graphql') && c.body.query.includes('discountCodeBasicCreate'));
t('Shopify の Admin 鍵で割引を作る', r.calls.filter(c => c.url.includes('graphql')).length === 2 && !r.calls.some(c => c.url.includes('oauth/access_token')));
t('割引の管理名に答えが全部残る', create.body.variables.d.title === 'LINE原因チェック｜2時間もすると腰が重く痛む・休んでも、週明けにまた戻る・レジ・品出し・164cm以上・湿布・コルセット');
t('1人1回・1,000円・24時間', create.body.variables.d.usageLimit === 1 && create.body.variables.d.customerGets.value.discountAmount.amount === '1000' && Math.abs(new Date(create.body.variables.d.endsAt) - new Date(create.body.variables.d.startsAt) - 24 * 36e5) < 1000);
const code = create.body.variables.d.code; t('コードは LINE1000OFF-xxxxxx', /^LINE1000OFF-[0-9A-F]{6}$/.test(code));
t('おすすめは 1枚・2枚 のカルーセル', r.msgs[1].contents.contents.length === 2);
t('価格は Original の 1枚 14,800円', JSON.stringify(r.msgs[1].contents.contents[0]).includes('14,800円'));
const uri = buttons(r.msgs).find(a => a.type === 'uri').uri;
t('購入は LIFF の /go を通す', uri.startsWith('https://liff.line.me/2000000000-TESTLIFF/go?to='));
const cart = decodeURIComponent(uri.split('to=')[1]); const u = new URL(cart);
t('最初にカートを空にする（/cart/clear）', u.pathname === '/cart/clear');
t('UTM に line・bot・campaign・枚数', u.searchParams.get('utm_source') === 'line' && u.searchParams.get('utm_medium') === 'bot' && u.searchParams.get('utm_campaign') === 'tachimat_line_survey' && u.searchParams.get('utm_content') === 'n1');
const add = u.searchParams.get('return_to'); t('次に選んだバリアントだけ入れる', add.startsWith('/cart/add?id=9000000000003&quantity=1'));
t('最後に割引つきの購入手続き', decodeURIComponent(new URL('https://x' + add).searchParams.get('return_to')) === `/checkout?discount=${code}`);
t('プッシュは1通も使わない', !F.calls.some(c => /message\/(push|multicast|broadcast|narrowcast)/.test(c.url)));
// LIFF の中継ページ（public/liff/go）：広告クリックIDがあれば店の /pages/line-go を通す、無ければカートへ直行
const goHtml = fs.readFileSync(R + 'public/liff/go/index.html', 'utf8'); const js = goHtml.match(/<script>([\s\S]*?)<\/script>/)[1];
function runGo(search, stored) {
  let dest = null; const store = { tachimat_click: stored ? JSON.stringify(stored) : null };
  const ctx = { URLSearchParams, URL, Date, JSON, encodeURIComponent, location: { search, replace: d => { dest = d; } }, localStorage: { getItem: k => store[k] ?? null },
    document: { getElementById: () => ({}) }, liff: { init: async () => {} } };
  vm.runInNewContext(js, ctx); return new Promise(ok => setTimeout(() => ok(dest), 20));
}
const to = encodeURIComponent(cart);
t('クリックID無し → カートへ直行', (await runGo('?to=' + to, null)) === cart);
const d2 = await runGo('?to=' + to, { fbclid: 'FBX', at: Date.now(), ad_content: 'ad1' });
t('クリックIDあり → 店の /pages/line-go に fbclid と utm を付けて通す', d2.startsWith(cfg.site.url + '/pages/line-go?') && d2.includes('fbclid=FBX') && d2.includes('utm_campaign=tachimat_line_survey') && d2.includes('ad_content=ad1'));
t('8日前のクリックIDは使わない（7日の窓）', (await runGo('?to=' + to, { fbclid: 'OLD', at: Date.now() - 8 * 864e5 })) === cart);
t('よその URL には飛ばさない', (await runGo('?to=' + encodeURIComponent('https://evil.example/x'), null)) === cfg.site.url + cfg.site.product_path);
// テーマの部品が埋まっている
const pop = fs.readFileSync(R + 'build/theme/tachimat/line-popup.liquid', 'utf8');
t('ポップアップに LIFF・待ち時間・除外ページが入る', pop.includes("wlp_liff_id = '2000000000-TESTLIFF'") && pop.includes('wlp_delay_ms = 5000') && pop.includes("request.path contains '/pages/advertorial'") && !/__[A-Z_]+__/.test(pop));
F.restore();
console.log(`e2e（立ち仕事マット）：${ok}件 すべて通った`);
process.exit(0);
