# 台帳 — 調査済み商品の唯一の正

> **アプリでは**：Google スプレッドシートと sheet.mjs・gauth.mjs は使わない。zg の **ledger_check**（keys を渡すとその key が調べ済みか、渡さないと全部の行。candidates を渡すと中央の台帳でも確かめ、ほかの店が使っている商品は exclude:true）・**ledger_record**（entries に下の「列」と同じ名前のキー。見送りは note 必須、中央へ出す理由の札 reason も）・**ledger_claim**（確定した1件の key と名前。taken ならほかの店が先）を使う。中央の台帳がつながっていない時は、ワークスペースの research/ledger.json（Read で読める。write_file では書かない）に書かれる。
> 読み替え：`doctor`・`keys`・`has` → ledger_check／`upsert` → ledger_record／確定 → ledger_claim／`obs`（観測タブ）→ research_stores の observe:true／`delete` → 無い（運営者に頼まれた時だけ、運営者に伝える）。下の「接続」「CLI」は社内の版の説明で、アプリでは使わない。

**原則: スプレッドシートが正。載っていれば調査済み、載っていなければ未調査。**
運営者が行を消したら「調査していないこと」になる（＝また候補として出してよい）。Obsidianやこのスキル内の過去ログを除外リストとして使ってはいけない。

## 接続(2026-08-18 済み)

- 台帳: https://docs.google.com/spreadsheets/d/1ftCD9wfOFaLqOGUwrjLszQwQ5pwEc-JDbqKp7JDH_7w/edit (運営者のマイドライブ)
- 認証: OAuth(PKCE) — GCPプロジェクト `zerogrid-ops` のデスクトップクライアント。スコープは **drive.file のみ**(このスクリプトが作ったファイルしか触れない)
- 保管: `（鍵はアプリの接続で管理）`(クライアント) / `（鍵はアプリの接続で管理）`(refresh_token) / `（鍵はアプリの接続で管理）`(シートID) すべて600
- 再認可が要る時(revoke後など): `node ec-research/scripts/gauth.mjs` → 統一Chromeで同意
- 組織ポリシーでサービスアカウント鍵は作れない(`iam.disableServiceAccountKeyCreation`が強制)。sheet.mjsはSA鍵方式にも対応しているが、この環境ではOAuth側が使われる

## CLI

```bash
node ec-research/scripts/sheet.mjs <cmd>
```

| cmd | 用途 |
|---|---|
| `doctor` | 接続診断。足りないものを列挙して exit 2 |
| `create [title]` | 台帳スプレッドシートを新規作成してIDをenvに書く(初回のみ) |
| `whoami` | サービスアカウントのメール（共有相手） |
| `init` | タブ+ヘッダ行を用意（冪等） |
| `keys` | key/課題/商品/スコア/判定/日付だけJSONで（**除外リスト作成はこれ**） |
| `list [--json]` | 全列 |
| `has <key>` | 調査済み=exit 0 / 未調査=exit 3 |
| `upsert '<JSON>'` | 1件or配列。keyが一致すれば上書き、なければ追記。初回調査日は保持される |
| `delete <key>` | 行ごと削除（運営者に明示的に頼まれた時だけ） |

## 列

`調査日 / key / 課題(サブニッチ) / 商品(形態) / スコア / 判定 / ドロップシップ可否 / 仕入れ・原価 / 海外DS競合 / 市場規模(JP) / メモ・見送り理由 / レポートURL / 更新日`

upsertに渡すJSONのキー: `date, key, niche, product, score, verdict, dropship, sourcing, competitors, market, note, report, updated`（date/updatedは省略可＝自動）

```bash
node scripts/sheet.mjs upsert '[{"niche":"いびき×パートナー","product":"睡眠用耳栓","score":93,"verdict":"確定","dropship":"○ CJ/Alibaba同等品あり","sourcing":"Alibaba $2.8/MOQ100","competitors":"Earship(DS,82本) / Hears(DS,421本)","market":"別室夫婦43.1% 悩み人口約1000万","note":"単品では粗利$25未達→2セットバンドル前提","report":"https://claude.ai/code/artifact/..."}]'
```

`key` は**短く手で付ける**（`いびき-耳栓` `立ち仕事足底-インソール` のように「課題-商品形態」で10〜15文字）。省略すると課題名+商品名から自動生成されるが長くて読みにくいので必ず指定する。同じ課題で商品形態を変えて再調査する場合は**別key**として追加する（例: `足底の痛み-フットローラー` と `足底の痛み-マッサージインソール` は別行）。

## 書き込むもの / 書き込まないもの

- 書く: **実際に調べた候補すべて**（Phase 4 の深掘りまで行ったもの）。1位だけでなく見送りも `判定=見送り` + 理由付きで書く。次回それを再調査しないため
- 書かない: 全件列挙で名前が出ただけで、深掘りしていない候補（これを書くと未探索の芽を潰す）

## 判定の語彙

`確定`（今回の1本）/ `見送り`（理由必須）/ `保留`（条件が揃えば再挑戦。条件をメモに書く）/ `再調査可`（運営者が手で戻した時）

## 未接続のとき

`doctor` が落ちたら **リサーチは止めずに続行**し、「台帳なし＝全部未調査扱い」で進める。ただし冒頭に一行警告を出し、最後の報告で「台帳に書き戻せていない。接続すれば次回から重複調査が消える」と接続手順を添えること。
