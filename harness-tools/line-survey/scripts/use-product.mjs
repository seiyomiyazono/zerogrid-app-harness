// 出す前に、商品の設定を Bot に組み込む。
// 使い方: node scripts/use-product.mjs <products/<id>/survey.json か そのフォルダ> [--img <画像フォルダ>]
// 作る物（どれも手元だけ。LINE・Shopify には何も送らない）：
//   config/survey.json      … Bot が読む設定（webhook が require する）
//   public/img/             … LINE に出す画像（images.source_dir か <商品フォルダ>/img から写す）
//   public/liff/            … LIFF の入口と購入の中継（templates/liff を埋めた物）
//   build/theme/<id>/       … 店に入れるスニペットと中継ページ（入れるのは setup/theme-install.mjs。既定は dry-run）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const R = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let src = process.argv[2]; if (!src) { console.error('使い方: node scripts/use-product.mjs <survey.json>'); process.exit(2); }
if (fs.statSync(src).isDirectory()) src = path.join(src, 'survey.json');
const cfg = JSON.parse(fs.readFileSync(src, 'utf8'));
const i = process.argv.indexOf('--img');
const imgDir = i > 0 ? process.argv[i + 1] : (cfg.images?.source_dir || path.join(path.dirname(src), 'img'));
const env = process.env; const liff = env.LIFF_ID || cfg.line.liff_id || ''; const site = env.SITE_URL || cfg.site.url;
const oa = `https://line.me/R/ti/p/${cfg.line.oa_basic_id}`;
const T = cfg.brand.theme;
const rep = (s, m) => Object.entries(m).reduce((a, [k, v]) => a.split(k).join(String(v)), s);

fs.mkdirSync(path.join(R, 'config'), { recursive: true });
fs.writeFileSync(path.join(R, 'config/survey.json'), JSON.stringify(cfg, null, 2));

const pub = path.join(R, 'public/img'); fs.rmSync(pub, { recursive: true, force: true }); fs.mkdirSync(pub, { recursive: true });
let n = 0; if (fs.existsSync(imgDir)) for (const f of fs.readdirSync(imgDir)) if (/\.(jpe?g|png|webp)$/i.test(f)) { fs.copyFileSync(path.join(imgDir, f), path.join(pub, f)); n++; }

const liffMap = { __LIFF_ID__: liff, __OA_URL__: oa, __CLICK_KEY__: `${cfg.id}_click`, __TITLE__: `${cfg.brand.name} 無料診断`, __SITE__: site, __PRODUCT_PATH__: cfg.site.product_path,
  __LIFF_GIFT__: `診断後に${Number(cfg.coupon.amount).toLocaleString()}円OFFクーポンをプレゼント。`, __SOFT__: T.soft, __INK__: T.ink };
for (const f of ['index.html', 'go/index.html']) { const o = path.join(R, 'public/liff', f); fs.mkdirSync(path.dirname(o), { recursive: true }); fs.writeFileSync(o, rep(fs.readFileSync(path.join(R, 'templates/liff', f), 'utf8'), liffMap)); }

const P = cfg.popup; const ex = (P.exclude_paths || []);
const th = path.join(R, 'build/theme', cfg.id); fs.mkdirSync(th, { recursive: true });
const popMap = { __EXCLUDE_OPEN__: ex.length ? `{%- unless ${ex.map(x => `request.path contains '${x}'`).join(' or ')} -%}` : '', __EXCLUDE_CLOSE__: ex.length ? '{%- endunless -%}' : '',
  __DELAY_MS__: P.delay_ms, __OA_URL__: oa, __LIFF_ID__: liff, __BANNER__: P.banner, __BW__: P.banner_w, __BH__: P.banner_h, __STORAGE_KEY__: P.storage_key, __AD_KEY__: `${cfg.id}_ad`,
  __FAB_LABEL__: P.fab_label, __ALT__: P.alt.replace(/"/g, ''), __INK__: T.ink, __SOFT__: T.soft };
fs.writeFileSync(path.join(th, 'line-popup.liquid'), rep(fs.readFileSync(path.join(R, 'theme/line-popup.liquid.tpl'), 'utf8'), popMap));
fs.writeFileSync(path.join(th, 'page.line-go.liquid'), rep(fs.readFileSync(path.join(R, 'theme/page.line-go.liquid.tpl'), 'utf8'), { __PRODUCT_PATH__: cfg.site.product_path }));
const left = [...fs.readdirSync(th).map(f => [f, fs.readFileSync(path.join(th, f), 'utf8')]), ...['index.html', 'go/index.html'].map(f => [f, fs.readFileSync(path.join(R, 'public/liff', f), 'utf8')])].filter(([, s]) => /__[A-Z_]+__/.test(s));
console.log(`設定 ${cfg.id} ／ 画像 ${n}枚（${imgDir}）／ LIFF ${liff ? 'あり' : 'なし（購入リンクは直接カートへ）'} ／ テーマの部品 build/theme/${cfg.id}/`);
if (left.length) { console.error('埋まっていない札:', left.map(([f, s]) => f + ':' + s.match(/__[A-Z_]+__/g).join(',')).join(' ')); process.exit(1); }
