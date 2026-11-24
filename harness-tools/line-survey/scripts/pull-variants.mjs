// 店の公開の商品データ（/products/<handle>.js・ログイン不要・読むだけ）から、バリアント ID と値段を取って survey.json に入れる。
// survey.json の offer.variant_map に「店の選択肢の字 → 設定の値」を書いておく：
//   "variant_map": { "options": ["c", "z", "n"], "values": { "c": { "グレー": "gray" }, "z": { "S（60×40cm）": "s" }, "n": { "6枚": "6" } } }
//   options は店の option1・option2・option3 の順に、設定のどの値に当たるか
// 使い方: node scripts/pull-variants.mjs <survey.json> [--write]   （--write が無ければ差分を出すだけ。書くのは手元の survey.json だけ）
import fs from 'node:fs';
const [src] = process.argv.slice(2); const WRITE = process.argv.includes('--write');
const cfg = JSON.parse(fs.readFileSync(src, 'utf8')); const M = cfg.offer.variant_map;
if (!M) { console.error('offer.variant_map が無い'); process.exit(2); }
const handle = cfg.site.product_path.replace(/^\/products\//, '');
const r = await fetch(`${process.env.SITE_URL || cfg.site.url}/products/${handle}.js`); if (!r.ok) { console.error('商品が読めない', r.status); process.exit(1); }
const p = await r.json(); const variants = {}, prices = {}; const unknown = new Set();
for (const v of p.variants) {
  const a = {}; let ok = true;
  M.options.forEach((key, i) => { const label = v[`option${i + 1}`]; const val = M.values[key]?.[label]; if (val === undefined) { unknown.add(`${key}:${label}`); ok = false; } else a[key] = val; });
  if (!ok) continue;
  const fill = t => t.replace(/\{(\w+)\}/g, (m, k) => a[k] ?? m);
  variants[fill(cfg.offer.variant_key)] = v.id;
  prices[fill(cfg.offer.price_key)] = [Math.round(v.price / 100), v.compare_at_price ? Math.round(v.compare_at_price / 100) : 0];
}
const diff = k => Object.keys({ ...cfg.variants, ...variants }).filter(x => cfg.variants[x] !== variants[x]);
console.log(`店の ${p.variants.length} バリアントのうち ${Object.keys(variants).length} を設定の鍵に当てた（当たらない選択肢：${[...unknown].join(' ') || 'なし'}）`);
const dv = diff(); console.log(dv.length ? `バリアントの違い ${dv.length}件：${dv.slice(0, 6).map(k => `${k} ${cfg.variants[k] ?? '無し'}→${variants[k] ?? '無し'}`).join(' ／ ')}` : 'バリアント：設定と店が一致');
const dp = Object.keys(prices).filter(k => JSON.stringify(cfg.offer.prices[k]) !== JSON.stringify(prices[k]));
console.log(dp.length ? `値段の違い：${dp.map(k => `${k} ${JSON.stringify(cfg.offer.prices[k])}→${JSON.stringify(prices[k])}`).join(' ／ ')}` : '値段：設定と店が一致（price_key の物）');
if ((p.selling_plan_groups || []).length) console.log('定期便の selling plan：', p.selling_plan_groups.map(g => g.selling_plans.map(s => `${s.id} ${s.name}`).join(',')).join(' ／ '));
if (WRITE) { cfg.variants = { ...cfg.variants, ...variants }; cfg.offer.prices = { ...cfg.offer.prices, ...prices }; fs.writeFileSync(src, JSON.stringify(cfg, null, 2) + '\n'); console.log('書いた：', src); }
