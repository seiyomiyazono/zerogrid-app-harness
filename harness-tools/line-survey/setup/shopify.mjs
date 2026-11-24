// Shopify の準備（使う人の店）。鍵は ~/.config/secrets/shopify-<名前>.env（SHOP・SHOPIFY_TOKEN・SCOPES）。
// 鍵を取る所は ~/ec-ads/store-ad-setup/ の道具をそのまま使う（共通 Chrome でログイン済みなら、アプリ作成 → 店に入れる → 鍵、まで自動）。
// 使い方:
//   node setup/shopify.mjs token <店>.myshopify.com <名前> <組織ID>      … store-ad-setup/shopify_token.mjs を回す（--apply の時だけ。許可画面の「インストール」を押す）
//   node setup/shopify.mjs check <名前>                                  … 読むだけ：鍵が効くか・Bot と店の部品に要る権限がそろうか
//   node setup/shopify.mjs theme <survey.json> <名前> [--theme <ID>] [--check] [--apply]
//        店の部品（ポップアップのスニペット・LINE の中継ページ・バナー・LINE のアイコン・layout の1行・ページ）を入れる。
//        既定：入れる物の一覧だけ。--check：店を読んで、今ある物・テーマの役割を確かめる。--apply：書く（非公開テーマを --theme で渡す。MAIN には --main-ok が無いと書かない）
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process';
import { readEnv, mask, args } from './lib.mjs';
const R = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const a = args(process.argv.slice(2)); const [cmd, x, y, z] = a._;
const NEED = ['write_discounts', 'read_products', 'read_themes', 'write_themes', 'write_content'];
const gqlOf = env => async (query, variables) => {
  const r = await fetch(`https://${env.SHOP}/admin/api/2025-07/graphql.json`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': env.SHOPIFY_TOKEN }, body: JSON.stringify({ query, variables }) });
  const j = await r.json(); if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300)); return j.data;
};

if (cmd === 'token') {
  const tool = `${process.env.HOME}/ec-ads/store-ad-setup/shopify_token.mjs`;
  console.log(`使う道具：${tool}（Dev Dashboard のアプリを店に入れて Admin の鍵を取る。スコープに write_discounts・write_themes・write_content が入っている）`);
  if (!a.apply) { console.log(`[dry-run] cd ~/ec-ads/store-ad-setup && node shopify_token.mjs ${x} ${y} ${z}`); process.exit(0); }
  const r = spawnSync('node', [tool, x, y, z], { cwd: path.dirname(tool), stdio: 'inherit' }); process.exit(r.status);
}
if (cmd === 'check') {
  const env = readEnv(`shopify-${x}`); if (!env.SHOPIFY_TOKEN) { console.error(`鍵が無い：~/.config/secrets/shopify-${x}.env`); process.exit(1); }
  console.log(`店 ${env.SHOP} ／ 鍵 ${mask(env.SHOPIFY_TOKEN)}`);
  const have = (env.SCOPES || '').split(','); const miss = NEED.filter(s => !have.includes(s) && !(s.startsWith('read_') && have.includes(s.replace('read_', 'write_'))));
  console.log('権限：', miss.length ? `足りない ${miss.join(' ')}（token をやり直す）` : `そろっている（${NEED.join(' ')}）`);
  const gql = gqlOf(env); const d = await gql('{ shop { name myshopifyDomain } themes(first: 20) { nodes { id name role } } }');
  console.log('読めた：', d.shop.name, d.shop.myshopifyDomain, '／ テーマ', d.themes.nodes.map(t => `${t.role}:${t.name}`).join(' ／ '));
  const c = await gql('query($c:String!){ codeDiscountNodeByCode(code:$c){ id } }', { c: 'LINE1000OFF-CHECK0' }); console.log('割引コードを引ける：', c.codeDiscountNodeByCode === null ? 'はい（このコードは無い＝正しい）' : 'あり');
  process.exit(miss.length ? 1 : 0);
}
if (cmd === 'theme') {
  const cfg = JSON.parse(fs.readFileSync(x, 'utf8')); const th = path.join(R, 'build/theme', cfg.id);
  if (!fs.existsSync(path.join(th, 'line-popup.liquid'))) { console.error(`先に node scripts/use-product.mjs ${x}`); process.exit(1); }
  const imgDir = cfg.images?.source_dir || path.join(path.dirname(x), 'img');
  const files = [
    ['snippets/line-popup.liquid', 'TEXT', fs.readFileSync(path.join(th, 'line-popup.liquid'), 'utf8')],
    ['templates/page.line-go.liquid', 'TEXT', fs.readFileSync(path.join(th, 'page.line-go.liquid'), 'utf8')],
    [`assets/${cfg.popup.banner}`, 'BASE64', fs.existsSync(path.join(imgDir, cfg.popup.banner)) ? fs.readFileSync(path.join(imgDir, cfg.popup.banner)).toString('base64') : null],
    ['assets/line-brand-icon.png', 'BASE64', fs.readFileSync(path.join(R, 'theme/line-brand-icon.png')).toString('base64')],
  ];
  console.log('入れる物：'); for (const [f, t, b] of files) console.log(`  ${f}（${t === 'TEXT' ? b.length + '字' : b ? Math.round(b.length * 3 / 4 / 1024) + 'KB' : '★画像が無い'}）`);
  console.log(`  layout/theme.liquid の </body> の前に {% render 'line-popup' %} を1行（今の中身を読んでから足す。もうあれば足さない）`);
  console.log(`  ページ「購入手続きへ」handle=line-go・templateSuffix=line-go（LINE の購入リンクの中継。もうあれば作らない）`);
  if (!a.check && !a.apply) { console.log('[dry-run] 店は読んでいない・書いていない。--check で読む'); process.exit(0); }
  const env = readEnv(`shopify-${y}`); const gql = gqlOf(env);
  const themes = (await gql('{ themes(first: 20) { nodes { id name role } } }')).themes.nodes;
  const t = a.theme ? themes.find(n => n.id.endsWith('/' + a.theme)) : themes.find(n => n.role === 'MAIN');
  if (!t) { console.error('テーマが見つからない'); process.exit(1); }
  console.log(`テーマ ${t.name}（${t.role}）`);
  const got = await gql('query($id:ID!,$n:[String!]!){ theme(id:$id){ files(first:10, filenames:$n){ nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } } } } }', { id: t.id, n: ['layout/theme.liquid', ...files.map(f => f[0])] });
  const now = Object.fromEntries(got.theme.files.nodes.map(n => [n.filename, n.body?.content]));
  for (const [f] of files) console.log(`  ${f}：${now[f] !== undefined ? 'もうある（上書きになる）' : 'まだ無い'}`);
  const layout = now['layout/theme.liquid']; const hasRender = layout && layout.includes("render 'line-popup'");
  console.log(`  layout/theme.liquid：${layout ? (hasRender ? 'もう1行ある' : '</body> の前に足す') : '読めない'}`);
  const pg = (await gql('{ pages(first:5, query:"handle:line-go"){ nodes { id handle } } }')).pages.nodes; console.log(`  ページ line-go：${pg.length ? 'もうある' : 'まだ無い'}`);
  if (!a.apply) { console.log('[--check] 読んだだけ。書いていない'); process.exit(0); }
  if (t.role === 'MAIN' && !a['main-ok']) { console.error('公開中のテーマには書かない（非公開テーマを --theme で渡す。公開テーマへは 運営者 の OK の後に --main-ok）'); process.exit(1); }
  const up = files.filter(f => f[2]).map(([filename, type, value]) => ({ filename, body: { type, value } }));
  if (layout && !hasRender) up.push({ filename: 'layout/theme.liquid', body: { type: 'TEXT', value: layout.replace('</body>', "  {% render 'line-popup' %}\n</body>") } });
  const r = await gql('mutation($id:ID!,$files:[OnlineStoreThemeFilesUpsertFileInput!]!){ themeFilesUpsert(themeId:$id, files:$files){ upsertedThemeFiles { filename } userErrors { filename message } } }', { id: t.id, files: up });
  console.log('入れた：', r.themeFilesUpsert.upsertedThemeFiles.map(f => f.filename).join(' '), r.themeFilesUpsert.userErrors.length ? JSON.stringify(r.themeFilesUpsert.userErrors) : '');
  if (!pg.length) { const p = await gql('mutation($page:PageCreateInput!){ pageCreate(page:$page){ page { id handle } userErrors { message } } }', { page: { title: '購入手続きへ', handle: 'line-go', body: '', templateSuffix: 'line-go', isPublished: true } }); console.log('ページ：', JSON.stringify(p.pageCreate)); }
}
