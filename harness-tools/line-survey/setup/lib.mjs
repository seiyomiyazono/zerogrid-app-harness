// 設定の道具の共通部分。鍵は ~/.config/secrets/<名前>.env（600）にだけ置き、画面・ログには出さない（長さだけ出す）。
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
export const SECRETS = path.join(os.homedir(), '.config/secrets');
export const secretFile = name => path.join(SECRETS, `${name}.env`);
export function readEnv(name) {
  const f = secretFile(name); if (!fs.existsSync(f)) return {};
  return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).replace(/^export\s+/, '').trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
}
// 足すだけ（前の値は残す）。書く前に元の写しを backups に残す
export function mergeEnv(name, add) {
  const f = secretFile(name); fs.mkdirSync(SECRETS, { recursive: true, mode: 0o700 });
  const cur = readEnv(name); const next = { ...cur, ...add };
  if (fs.existsSync(f)) fs.copyFileSync(f, `${f}.bak-${Date.now()}`);
  fs.writeFileSync(f, Object.entries(next).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 }); fs.chmodSync(f, 0o600);
  return Object.keys(add);
}
export const mask = v => (v ? `（${String(v).length}字・伏せ字）` : '（無し）');
export const args = argv => { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); o[k] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; } else o._.push(a); } return o; };
// 送る前に、何を送るかを出す（鍵は伏せる）。--apply が無ければ送らない
export async function call({ method = 'GET', url, token, body, contentType = 'application/json', apply, write }) {
  const show = body && !(body instanceof Uint8Array) ? JSON.stringify(body).slice(0, 300) : body ? `（画像 ${body.length} バイト）` : '';
  if (write && !apply) { console.log(`[dry-run] ${method} ${url} ${show}`); return { dry: true }; }
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': contentType } : {}) }, body: body ? (body instanceof Uint8Array ? body : JSON.stringify(body)) : undefined });
  const text = await r.text(); let j; try { j = JSON.parse(text); } catch { j = text; }
  console.log(`${write ? '[送った]' : '[読んだ]'} ${method} ${url} → ${r.status}`); return { status: r.status, json: j };
}
