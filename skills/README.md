# 同梱した手順書（スキル）

作り方：`node scripts/bundle-skills.mjs`（原本から毎回作り直す。手で直さない）。作った日：2026-11-19

入れた物：手順・規格・ひな形（.md と templates の中のひな形）・手順書が渡す見本の絵・ダルマが回してよい道具（server/core/skill-scripts-list.mjs の一覧と、その部品・ひな形。社内の道は直してある）。入れない物：個人の知識ノート（knowledge）・古い版（_archive・_旧・_前の版）・集めた生データ（資料・raw・runs・data）・一覧に無いスクリプト・動画・バックアップ・鍵・CS の実データ（ec-cs は入れない。共通ルールの CS対応・サプライヤー・資格情報の棚卸しも入れない）。

| スキル | ファイル数 |
|---|---|
| ec-ad-ops | 510 |
| ec-research | 14 |
| ad-funnel | 3 |
| vsl-script | 32 |
| zackd-ad | 4 |
| ec-static-ads | 1 |
| ec-native-ads | 8 |
| pdp-tsukuru | 31 |
| bakuro-copy | 1 |
| listicle-copy | 1 |
| ranking-copy | 1 |
| quiz-jp-copy | 3 |
| kata-tsukuru | 3 |
| natural-japanese | 17 |
| ec-retarget-static | 6 |
| kagoochi-mail | 11 |
| _rules | 15 |

運営者個人の物（本人の言葉の引用・反応・商品への判断・個人の決まりのファイル）は抜いた（1 ファイルを外すか手順だけにした）。検査：`node scripts/bundle-skills.mjs --check`。

道具：247 ファイル（回せる道具 55。アプリの run_skill_script が回す）。

# 直した社内専用の道・呼び名

| 何を | 何か所 |
|---|---|
| ハーネスの道（newec_harness/） | 41 |
| 社内の作業フォルダ（ec-ads） | 34 |
| デスクトップの資料 | 76 |
| 運営者の名前（英字） | 548 |
| 古いダッシュボード | 4 |
| そのほかの社内の Mac の道 | 37 |
| 店の絵の道具 | 9 |
| オーナーの名前 | 1 |
| スキルの置き場（~/.agents/skills） | 541 |
| 社内の道具の道 | 29 |
| 共通 Chrome | 34 |
| codex の置き場 | 5 |
| スキルの置き場（~/.claude/skills） | 10 |
| 共通 Chrome のプロファイル | 3 |
| 自社の Meta 広告ID | 8 |
| 社内の店の住所 | 1 |
| ハーネスの道（~/Desktop） | 8 |
| 共通ルールの道（EC/） | 4 |
| ハーネスの名前（newec_harness） | 2 |
| 鍵の置き場 | 14 |
| 社内の問い合わせメール | 1 |
| 個人の決まりのファイル名 | 3 |
| 個人の決まりの見出し | 1 |
| 個人の添削の記録のファイル名 | 4 |
| 店の絵の道具の引数 | 8 |
| 店の設計の置き場 | 1 |

合計 1427 か所。読み替えの前提は `_アプリでの読み方.md`。
