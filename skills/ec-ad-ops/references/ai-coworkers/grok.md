# Grok（xAI）のボット・エージェント機能 — 知識ノート（調査 2026-10-02）

ソース評価：一次＝docs.x.ai（読めた）・xAI 公式 X。x.ai のブログ/規約/プランは 403 で未読。二次＝ニュース・解説（Ryze の記事は自社宣伝）。YouTube は未視聴（タイトルのみ）。【公式】【二次】【未確認】で区別。

## 1. 何があるか
| 名称 | いつ | プラン | できること | Claude Code から |
|---|---|---|---|---|
| **Grok Bot**（AIチームメイト） | ベータ 2026-08-11、対象拡大 08-21【二次】 | Cursor 有料個人／Teams・SuperGrok 個人【公式】。最安 Cursor Pro $20 か SuperGrok $30【二次】 | クラウドPCでブラウザ・ファイル・ターミナル操作、ログイン保持、手順を見せてスキル化、ルーティン（定期・イベント起動）、承認ルール【公式】。xAI×Cursor 共同、米国ホスト | **API なし**。Slack・シート・共有フォルダ経由 |
| **Team Bots** | 公開ベータ 2026-09-28【公式X】 | Teams・Enterprise | Slack にボット用ハンドル、スキル・資格情報をチーム共有、記憶は個人別 | Slack 経由 |
| **Grok Automations**（旧 Tasks） | 2026-07-16【公式】 | 定期は全員、メールトリガーは SuperGrok 以上 | 毎日・毎週などの定期実行、メール受信で起動、@でコネクタ/スキル | ― |
| **Grok Connectors** | 2026-05-06【二次】 | grok.com・アプリ | Gmail・Drive・Notion・GitHub・Canva・Stripe・**X Ads**・HubSpot など約30＋独自 MCP | ― |
| **Grok Imagine**（画像2.0・動画1.5） | 動画1.5 正式 06-16・1080p 07-31、画像2.0 08-07【二次】 | アプリは SuperGrok Lite $10〜。API あり | 動画最長15秒・音声（効果音・セリフ）同時生成、画像→動画、編集・延長。画像は1回10枚・参照5枚【公式】 | **API で呼べる** |
| **xAI API Agent Tools** | ― | 従量 | `x_search`（X 投稿検索・アカウント/期間指定・画像/動画解析）、`web_search`、コード実行、リモート MCP【公式】 | **API で呼べる（一番確実）** |
| Grok Build（CLI） | v1.0 08-07【二次】 | SuperGrok・Premium+ | ターミナルのコーディングエージェント | 外部 CLI として（未検証） |
| X 広告マネージャ内の Grok | ベータ 07-16【二次】 | 一部広告主 | 広告方針の相談・クリエイティブ補助 | ― |
| @grok（X の返信） | 以前から | 無料枠 | スレッドで答えるだけ。自分のボットにはできない | ― |

## 2. API の料金（公式 docs.x.ai）
- テキスト：grok-4.7（2026-09-21・50万トークン）入力 $2／出力 $6（100万トークンあたり）。grok-4.3 は $1.25／$2.50・100万トークン
- `x_search`：**投稿1,000件で $5**（返った件数で課金、親・引用も数える）。`web_search`・コード実行：1,000回 $5
- 旧 Live Search（search_parameters）は 2026-01-12 廃止
- 画像：grok-imagine-image-2.0 $0.04/枚。動画：grok-imagine-video-1.5 $0.08/秒（lite $0.02/秒）、最長15秒、非同期（request_id で取得）、米国リージョン
- OpenAI SDK 互換。キーは （社内の Mac の道：アプリには無い） に置く（未取得）

## 3. 制約・規約
- X での AI 自動返信ボットは X 社の書面承認が必要。投稿 API は従量（投稿 $0.015・リンク付き $0.20）→ **自動返信で集客は現実的でない**【二次】
- Grok Bot：ボット同士に境界なし（同じクラウドPC）、パスワード・2段階認証は人へ、ルーティン最大50本、モデル選択不可、米国処理
- 生成物の権利：一般規約は xAI 側にも広い利用許諾、著作権補償なし【二次・原文未読】。日本語の文字描画は未検証
- 英語プロンプトの方が安定【二次】

## 4. このハーネスでの使いどころ（案・推測）
1. **競合・口コミ・トレンドの定点観測**：`x_search` をスクリプト化して毎朝回す（安い）→ Claude が集計して運用ボードへ
2. **素材の量産**：Imagine API（9:16・15秒・音声付き、720p で1本 $1〜2）。日本語テロップは後で合成
3. **画面操作の定常業務**：Grok Bot に広告マネージャの確認・シート転記（ログイン共有と承認設計が必要、API なし）
4. **記事 LP の調査**：web_search＋x_search で生の声

## 5. 未確認
Grok Bot の対象プランは途中で変わっている（契約前にアプリで確認）／規約原文・プランページ未読／日本語文字の描画／YouTube の中身（Whisper モデル large-v3-turbo を入れれば取れる）

## 出典（主要）
docs.x.ai/grok-bot/（get-started・computer-and-apps・skills-routines-and-automations・use-cases・security）、x.ai/news/grok-automations、docs.x.ai/docs/models・pricing・guides/tools、docs.x.ai/developers/tools/x-search、x.com/bot/status/2104661562715967548、releasebot.io/updates/xai、digitalapplied.com、flaviocopes.com/grok-bot、uravation.com、get-ryze.ai（宣伝）、socialmediatoday.com、vorplabs.com/agent-tools/x-api
