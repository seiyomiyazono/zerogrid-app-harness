// Vercel の受け口。中身は lib/engine.js、商品の設定は config/survey.json（scripts/use-product.mjs <id> が products/<id>/ から写す）。
import { createRequire } from 'module';
import { createBot } from '../lib/engine.js';
import { createShopify } from '../lib/shopify.js';

const cfg = createRequire(import.meta.url)('../config/survey.json'); // require は Vercel の同梱の追跡に確実に乗る
const shop = createShopify(cfg);
const bot = createBot(cfg, { issueCoupon: shop.issueCoupon });
const raw = req => new Promise((ok, ng) => { let b = ''; req.on('data', c => b += c); req.on('end', () => ok(b)); req.on('error', ng); });

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 200; return res.end('ok'); }
  const code = await bot.handle(await raw(req), req.headers['x-line-signature']);
  res.statusCode = code; res.end(code === 200 ? 'ok' : 'bad signature');
}
