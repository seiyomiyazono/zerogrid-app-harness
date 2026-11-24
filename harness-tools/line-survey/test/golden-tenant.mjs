// 移植の確かめ（運営者の端末だけ）：最初の店の本物の Bot（<GOLDEN_BOT_DIR>/api/webhook.js・読むだけで import）と、
// この汎用 Bot にその店の本番の設定（<ZG_TENANT_DATA>/<GOLDEN_TENANT>/line-survey/survey.json）を入れた物へ、同じ出来事を送り、
// LINE への返事と Shopify への割引の作成が1文字まで同じかを比べる。外への通信は fake.mjs が止める。
// 店の本番の設定はアプリに同梱しない。どちらかが無い端末では飛ばす。
import fs from 'fs'; import os from 'os'; import path from 'path'; import assert from 'assert/strict'; import { pathToFileURL } from 'url';
const HOME = os.homedir(), TENANT = process.env.GOLDEN_TENANT || 'wandry';
const CFG = path.join(process.env.ZG_TENANT_DATA || path.join(HOME, 'ec-ads', 'zerogrid-tenant-data'), TENANT, 'line-survey', 'survey.json');
const BOT = path.join(process.env.GOLDEN_BOT_DIR || path.join(HOME, 'ec-ads', `${TENANT}-line`), 'api', 'webhook.js');
if (!fs.existsSync(BOT) || !fs.existsSync(CFG)) { console.log('本物の Bot か店の本番の設定が無い端末なので、本物との一致は飛ばす'); process.exit(0); }
import { fakeEnv, installFakeFetch, fakeReq, fakeRes, ev, buttons, sign } from './fake.mjs';
const cfg = JSON.parse(fs.readFileSync(CFG));
Object.assign(process.env, fakeEnv({ LIFF_ID: cfg.line?.liff_id || '2000000000-TESTLIFF' }));
delete process.env.SITE_URL; delete process.env.PUBLIC_URL; delete process.env.COUPON_AMOUNT; delete process.env.COUPON_HOURS;
const F = installFakeFetch();
const orig = (await import(pathToFileURL(BOT).href)).default;
const { createBot } = await import('../lib/engine.js'); const { createShopify } = await import('../lib/shopify.js');
const shop = createShopify(cfg);
const bot = createBot(cfg, { issueCoupon: shop.issueCoupon, sleep: async () => {} });

const strip = calls => calls.filter(c => /message\/reply|graphql|loading/.test(c.url)).map(c => {
  const b = JSON.parse(JSON.stringify(c.body)); if (b?.variables?.d) { delete b.variables.d.startsAt; delete b.variables.d.endsAt; } if (b?.replyToken) delete b.replyToken; return [c.url.replace(/^https:\/\/[^/]+/, ''), b];
});
async function both(e) {
  const body = { events: [e] };
  F.calls.length = 0; const res = fakeRes(); await orig(fakeReq(body), res); const a = strip(F.calls);
  F.calls.length = 0; const s = JSON.stringify(body); await bot.handle(s, sign(s)); const b = strip(F.calls);
  assert.deepEqual(b, a, '返事が本物と違う: ' + JSON.stringify(e).slice(0, 120));
  return (b.find(([u]) => u.includes('message/reply')) || [, { messages: [] }])[1].messages;
}
// 押し方の型（各返事で何番目の postback ボタンを押すか。足りなければ0番）
const paths = [
  { name: '全部いちばん上・定期便つける', pick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1] },
  { name: '下の選択肢・不安2つ・何が届く→つけない', pick: [0, 4, 3, 2, 2, 0, 1, 4, 3, 0, 0, 0, 1] },
  { name: '不安なし・しつけ教室・つけない', pick: [0, 2, 1, 1, 1, 5, 2, 0, 0, 2] },
  { name: '何も使っていない・何が届く→加入', pick: [0, 1, 2, 0, 0, 5, 3, 0, 0, 0, 0] },
];
let steps = 0, compared = 0; const kinds = new Set();
// 入口：友だち追加・言葉で始める・関係ない言葉
await both(ev.follow()); await both(ev.text('診断したい')); await both(ev.text('こんにちは')); compared += 3;
// 署名が違えば 401
{ const res = fakeRes(); await orig(fakeReq({ events: [] }, 'bad'), res); const g = await bot.handle('{"events":[]}', 'bad'); assert.equal(res.statusCode, 401); assert.equal(g, 401); }
for (const p of paths) {
  let msgs = await both(ev.follow()); let i = 0;
  for (let guard = 0; guard < 30; guard++) {
    const pb = buttons(msgs).filter(a => a.type === 'postback'); if (!pb.length) break;
    const a = pb[Math.min(p.pick[i++] ?? 0, pb.length - 1)];
    msgs = await both(ev.postback(a.data)); steps++; compared++;
  }
  const uri = buttons(msgs).filter(a => a.type === 'uri'); assert.ok(uri.length >= 1, p.name + ': 最後に購入ボタンが無い');
  kinds.add(decodeURIComponent(decodeURIComponent(uri[0].uri)).includes('selling_plan') ? '定期便つき' : '定期便なし');
  console.log(`同じ: ${p.name}（${i}回押して、購入ボタン ${uri.length}つ）`);
}
assert.deepEqual([...kinds].sort(), ['定期便つき', '定期便なし'].sort(), '定期便のあり・なしの両方を通っていない');
F.restore();
console.log(`本物の Bot と一致：${compared}件の出来事、署名の拒否も一致`);
process.exit(0);
