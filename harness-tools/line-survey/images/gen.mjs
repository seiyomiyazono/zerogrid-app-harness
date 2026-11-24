// LINE の画像の「写真・バナー」を生成する（文字入れは make_images.py が後でする）。
// 使い方: node images/gen.mjs <survey.json> <出力フォルダ> [--only k1,k2] [--dry] [--jobs 3]
// 生成の道：
//   1. HIGGSFIELD_API_KEY があれば Higgsfield（Zero Grid の鍵。2026-10-20 時点で未着＝この道は未検証）
//   2. 無ければ Codex CLI（~/.local/bin/codex。元の店の gen/gen1.sh と同じ道。ChatGPT ログイン済みの画像生成）
// 既にファイルがある物は作り直さない（消してから回す）。
import fs from 'node:fs'; import path from 'node:path'; import { spawn } from 'node:child_process';
import { photoPrompt, bannerPrompt } from './prompts.mjs';

const [cfgPath, outDir] = process.argv.slice(2);
if (!cfgPath || !outDir) { console.error('使い方: node images/gen.mjs <survey.json> <出力フォルダ> [--only k1,k2] [--dry]'); process.exit(2); }
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry'); const ONLY = (arg('--only', '') || '').split(',').filter(Boolean); const JOBS = Number(arg('--jobs', 3));
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const jobs = [];
for (const [k, scene] of Object.entries(cfg.images?.photos || {})) jobs.push({ k, prompt: photoPrompt(cfg, scene), ratio: '1:1' });
if (cfg.images?.banner) jobs.push({ k: cfg.images.banner.key || 'popup', prompt: bannerPrompt(cfg), ratio: '3:4' });
const todo = jobs.filter(j => (!ONLY.length || ONLY.includes(j.k)) && !fs.existsSync(path.join(outDir, `${j.k}.png`)));
fs.writeFileSync(path.join(outDir, 'prompts.used.tsv'), jobs.map(j => `${j.k}\t${j.ratio}\t${j.prompt.replace(/\s+/g, ' ')}`).join('\n') + '\n');
const provider = process.env.HIGGSFIELD_API_KEY ? 'higgsfield' : 'codex';
console.log(`生成の道: ${provider} ／ 作る: ${todo.map(j => j.k).join(', ') || '（なし）'}`);
if (DRY) process.exit(0);

function run(cmd, args, opts) {
  return new Promise(ok => { const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] }); let log = '';
    p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d); p.on('close', code => ok({ code, log })); });
}
// Higgsfield：CLI（~/.local/bin/higgsfield）に鍵を環境変数で渡す想定。鍵が来たら `higgsfield generate create --help` と
// `higgsfield model list --json` で実際の名前（gpt_image_2_5 か）と鍵の渡し方を確かめて直す。ここは未検証。
async function viaHiggsfield(j) {
  const r = await run('higgsfield', ['generate', 'create', process.env.HIGGSFIELD_IMAGE_MODEL || 'gpt_image_2_5', '--prompt', j.prompt, '--aspect_ratio', j.ratio, '--wait', '--json'], { env: process.env });
  const url = (r.log.match(/https:\/\/\S+\.(?:png|jpg|jpeg|webp)/) || [])[0];
  if (r.code !== 0 || !url) return { ok: false, log: r.log };
  const b = Buffer.from(await (await fetch(url)).arrayBuffer()); fs.writeFileSync(path.join(outDir, `${j.k}.png`), b); return { ok: true, log: r.log };
}
async function viaCodex(j) {
  const codex = process.env.CODEX_BIN || `${process.env.HOME}/.local/bin/codex`;
  const ask = `画像を1枚生成して、このフォルダに ${j.k}.png という名前で保存して（コピーでよい）。縦横比 ${j.ratio}。内容：${j.prompt}`;
  const r = await run(codex, ['exec', '--skip-git-repo-check', ask], { cwd: outDir, env: process.env });
  return { ok: fs.existsSync(path.join(outDir, `${j.k}.png`)), log: r.log };
}
const queue = [...todo]; const results = [];
async function worker() { for (let j; (j = queue.shift());) {
  const t = Date.now(); const r = provider === 'higgsfield' ? await viaHiggsfield(j) : await viaCodex(j);
  fs.writeFileSync(path.join(outDir, `log_${j.k}.txt`), r.log); results.push([j.k, r.ok, Math.round((Date.now() - t) / 1000)]);
  console.log(`${r.ok ? 'できた' : '失敗'} ${j.k}（${Math.round((Date.now() - t) / 1000)}秒）`);
} }
await Promise.all(Array.from({ length: Math.min(JOBS, todo.length) }, worker));
const bad = results.filter(r => !r[1]); if (bad.length) { console.log('失敗:', bad.map(r => r[0]).join(', ')); process.exit(1); }
