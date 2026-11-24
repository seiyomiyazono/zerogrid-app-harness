// LINE の管理画面（LINE Official Account Manager・LINE Developers）を、共通 Chrome（surasura の connect.mjs）で進める。
// 使う人は共通 Chrome で LINE にログインするだけ（login）。残りはこの道具が進める。既定は dry-run（開いて読むだけ。押さない・書かない）。
// 鍵は画面にもログにも出さない（長さだけ）。押すのは --apply の時だけ。ロボット確認・本人確認（SMS）は越えない＝人に返す。
// 使い方: node setup/browser/line-console.mjs <やる事> [引数] [--apply]
//   login                       ログインの画面を前に出す（人がログイン。2段階認証も人）
//   probe                       読む：Developers のプロバイダー一覧・Manager のアカウント一覧
//   oa-create                   アカウント作成フォームを前に出す（人が入力・送信。規約の同意と本人の情報なので自動にしない）
//   messaging-api <@basicId> [--provider <名前>]   Manager の「Messaging API を利用する」（プロバイダーを選ぶ＝チャネルができる）
//   keys <id> <チャネルID>       Developers：チャネルシークレットと長期のアクセストークン（無ければ「発行」）→ line-<id>.env
//   login-channel <プロバイダーID> <名前> <id>   Developers：LINE ログインのチャネルを作る → 鍵を line-<id>.env（LIFF 用）
//   oa-response <@basicId>       Manager の応答設定：Webhook オン・自動応答オフ・あいさつオフ（あいさつは Bot が送るので二重にしない）
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath, pathToFileURL } from 'node:url';
// 共通 Chrome の道具の置き場：ZG_SURASURA（surasura のフォルダ）か SURASURA_CONNECT（connect.mjs そのもの）。無ければ ~/.claude/skills/surasura
const CONNECT = process.env.SURASURA_CONNECT || path.join(process.env.ZG_SURASURA || path.join(os.homedir(), '.claude', 'skills', 'surasura'), 'scripts', 'connect.mjs');
if (!fs.existsSync(CONNECT)) { console.error(`共通 Chrome の道具（connect.mjs）が見つかりません：${CONNECT}\nZG_SURASURA か SURASURA_CONNECT で場所を教えてください`); process.exit(2); }
const { connect, openLoginTab } = await import(pathToFileURL(CONNECT).href);
import { mergeEnv, mask, args } from '../lib.mjs';
const a = args(process.argv.slice(2)); const [cmd, x, y, z] = a._; const apply = !!a.apply;
const SHOTS = process.env.ZG_SHOTS_DIR || path.join(os.tmpdir(), 'line-console-shots'); fs.mkdirSync(SHOTS, { recursive: true });
const DEV = 'https://developers.line.biz/console', MGR = 'https://manager.line.biz';
const say = (...m) => console.log(...m);
const loggedOut = async p => /access\.line\.me|account\.line\.biz\/login|\/login/.test(p.url()) || /ログイン|Log in/.test((await p.title().catch(() => '')) || '') && !(await p.locator('body').innerText().catch(() => '')).includes('プロバイダー');

if (cmd === 'login') { await openLoginTab(`${DEV}/`); say('共通 Chrome に LINE のログイン画面を出した。ログインが終わったら probe を回す'); process.exit(0); }
if (cmd === 'oa-create') { await openLoginTab('https://entry.line.biz/form/entry/unverified'); say('アカウント作成のフォームを出した。人が入力して送る（名前・業種・メール・規約の同意）。終わったら probe で basic ID を拾う'); process.exit(0); }

const { browser, newTab } = await connect(); const p = await newTab(); await p.setViewportSize({ width: 1400, height: 950 });
const go = async u => { await p.goto(u, { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(5000); };
const text = async () => (await p.locator('body').innerText().catch(() => '')).replace(/\n+/g, '\n');
const shot = async n => { await p.screenshot({ path: path.join(SHOTS, `${cmd}-${n}.png`) }).catch(() => {}); };
const done = async code => { await p.close().catch(() => {}); browser.close(); process.exit(code); };
try {
  if (cmd === 'probe') {
    await go(`${DEV}/`); if (await loggedOut(p)) { say('Developers：ログインしていない → login を回して人がログイン'); await done(3); }
    const provs = await p.$$eval('a[href*="/console/provider/"]', as => [...new Set(as.map(a => (a.innerText || '').trim().split('\n')[0] + ' ' + a.getAttribute('href').match(/provider\/(\d+)/)?.[1]))]);
    say('Developers：ログイン済み。プロバイダー', provs.length, '件：', provs.join(' ／ '));
    await go(`${MGR}/`); const t = await text();
    const ids = [...new Set((t.match(/@[0-9a-z]{6,12}/g) || []))]; say('Manager：アカウント', ids.length, '件', ids.join(' '));
    await shot(1); await done(0);
  }
  if (cmd === 'messaging-api') {
    if (!x) { say('@basicId を渡す'); await done(2); }
    await go(`${MGR}/account/${x}/setting/messaging-api`); if (await loggedOut(p)) { say('ログインしていない'); await done(3); }
    const t = await text(); await shot(1);
    const ch = t.match(/Channel ID\s*\n?\s*(\d{10})|チャネルID\s*\n?\s*(\d{10})/);
    if (ch) { say('Messaging API はもう使える。チャネルID', ch[1] || ch[2]); await done(0); }
    const b = p.getByRole('button', { name: /Messaging APIを利用する|Enable Messaging API/ });
    say('Messaging API は未設定。「利用する」ボタン', await b.count() ? 'あり' : '見つからない');
    if (!apply) { say('[dry-run] 押していない'); await done(0); }
    await b.first().click(); await p.waitForTimeout(3000); await shot(2);
    if (a.provider) { await p.getByText(a.provider, { exact: true }).first().click().catch(() => say('プロバイダー名が見つからない：画面で人が選ぶ')); }
    for (const n of [/同意する|Agree/, /OK|はい/]) { const c = p.getByRole('button', { name: n }); if (await c.count()) { await c.first().click(); await p.waitForTimeout(3000); } }
    await go(`${MGR}/account/${x}/setting/messaging-api`); const t2 = await text(); await shot(3);
    const ch2 = t2.match(/(?:Channel ID|チャネルID)\s*\n?\s*(\d{10})/); say(ch2 ? `できた。チャネルID ${ch2[1]}` : '確かめられない（画面を見る：shots/messaging-api-3.png）'); await done(ch2 ? 0 : 1);
  }
  if (cmd === 'keys') {
    if (!x || !y) { say('<id> <チャネルID> を渡す'); await done(2); }
    await go(`${DEV}/channel/${y}/basics`); if (await loggedOut(p)) { say('ログインしていない'); await done(3); }
    const t = await text(); const sec = (t.match(/(?:Channel secret|チャネルシークレット)[\s\S]{0,80}?\b([0-9a-f]{32})\b/i) || [])[1];
    say('チャネルシークレット', sec ? `見つけた${mask(sec)}` : '見つからない（画面の形が違う・権限なし）');
    await go(`${DEV}/channel/${y}/messaging-api`); let t2 = await text();
    const findTok = s => (s.match(/(?:Channel access token|チャネルアクセストークン)[\s\S]{0,400}?([A-Za-z0-9+/=]{120,})/) || [])[1];
    let tok = findTok(t2); say('長期のアクセストークン', tok ? `見つけた${mask(tok)}` : 'まだ無い（「発行」が要る）'); await shot(1);
    if (!apply) { say('[dry-run] 押していない・保存していない'); await done(sec ? 0 : 1); }
    if (!tok) { const b = p.getByRole('button', { name: /^(Issue|発行)$/ }); if (await b.count()) { await b.first().click(); await p.waitForTimeout(4000); t2 = await text(); tok = findTok(t2); } }
    if (!sec || !tok) { say('取れなかった物がある。保存しない'); await done(1); }
    const k = mergeEnv(`line-${x}`, { LINE_CHANNEL_ID: y, LINE_CHANNEL_SECRET: sec, LINE_CHANNEL_ACCESS_TOKEN: tok }); say(`~/.config/secrets/line-${x}.env に保存した：${k.join('・')}`); await done(0);
  }
  if (cmd === 'login-channel') {
    if (!x || !y || !z) { say('<プロバイダーID> <チャネル名> <id> を渡す'); await done(2); }
    await go(`${DEV}/provider/${x}`); if (await loggedOut(p)) { say('ログインしていない'); await done(3); }
    const t = await text(); await shot(1);
    say('プロバイダーの画面', /Create a new channel|新規チャネル作成/.test(t) ? '「新規チャネル作成」あり' : '「新規チャネル作成」が見つからない（権限を確かめる）');
    const exists = t.includes(y); say(`「${y}」は`, exists ? 'もうある' : 'まだ無い');
    if (!apply) { say('[dry-run] 作っていない'); await done(0); }
    if (exists) { say('同じ名前があるので作らない。keys と同じ手で鍵を取る'); await done(0); }
    // 最初に通した時（2026-09-27）の手順：新規チャネル作成 → LINEログイン → 地域 日本 → 名前・説明 → アプリタイプ ウェブアプリ → メール → 規約に同意 → 作成 → 公開
    await p.getByText(/Create a new channel|新規チャネル作成/).first().click(); await p.waitForTimeout(3000);
    await p.getByText(/^LINE Login$|^LINEログイン$/).first().click(); await p.waitForTimeout(4000); await shot(2);
    say('ここから先の入力欄（名前・説明・アプリタイプ・メール・同意）は画面の形を見て人と確かめながら進める（未検証）。shots/login-channel-2.png'); await done(1);
  }
  if (cmd === 'oa-response') {
    if (!x) { say('@basicId を渡す'); await done(2); }
    await go(`${MGR}/account/${x}/setting/response`); if (await loggedOut(p)) { say('ログインしていない'); await done(3); }
    const t = await text(); await shot(1);
    const near = re => { const m = t.match(re); return m ? m[0].replace(/\n/g, ' ').slice(0, 60) : '見つからない'; };
    say('Webhook：', near(/Webhook[\s\S]{0,30}/)); say('応答メッセージ：', near(/応答メッセージ[\s\S]{0,30}/)); say('あいさつメッセージ：', near(/あいさつメッセージ[\s\S]{0,30}/));
    if (!apply) { say('[dry-run] 切り替えていない。目標：Webhook オン・応答メッセージ オフ・あいさつ オフ'); await done(0); }
    say('切り替えは画面の形を確かめてから入れる（未実装：トグルの形が見えたら足す）'); await done(1);
  }
  say('やる事が分からない：', cmd); await done(2);
} catch (e) { say('止まった：', e.message.slice(0, 200)); await shot('err'); await done(1); }
