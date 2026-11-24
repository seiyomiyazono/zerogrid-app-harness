# OpenAI「dots」（ChatGPT の常時稼働エージェント）— 知識ノート（調査 2026-10-02）

ソース評価：一次＝openai.com/index/introducing-dots・DevDay 2026 Recap・help.openai.com（常駐 Chrome で本文取得、写し：（作業フォルダ：アプリには同梱していない見本））。二次＝VentureBeat・Platformer・eesel・The Keyword・Flavio Copes・ロリポップ・ITmedia。X＝@codexneo4（解説＋宣伝あり）・@higgsfield_ai。運営者 の言う「ChatGPT の Bot」＝dots（2026-10-02 確認）。

## 1. 何か
- 2026-09-29 DevDay 2026 発表。モデル GPT-6 Astra。**1体ごとに専用のクラウドPCとブラウザ**、24時間動く「同僚」。ゴールと任せる範囲を渡すと自分で進め、判断が要る時だけ戻ってくる
- プラン：**Pro（月$100/$200/$500）・Business Premium（月$100〜125）**、Enterprise はベータ（管理者が有効化）。Free/Go/Plus/Business 通常席は不可。Pro は EEA・英国・スイス不可＝**日本は対象**（段階配布）
- 料金：最初の1体はプラン内。**今は1人1体**、追加は今後（価格未発表）。dot との会話は上限に数えない（Codex/Work に回した作業は数える）。公開1か月は利用量を枠に数えない
- 作成はデスクトップアプリかPCブラウザのみ（作った後はスマホからも話せる）

## 2. できること（公式）
| 機能 | 中身 | 制限 |
|---|---|---|
| 自律作業 | ゴールから次の手を決めて並行で進める | 判断は人へ |
| 定期実行 | 毎朝の確認・リマインド。Scheduled 画面で管理。起動＝自分で再開時刻／固定スケジュール／Slack 投稿などのイベント | ― |
| 先回り調査 | 接続アプリを読んで役立つことを探し記憶する | **読み取り専用** |
| ブラウザ・PC操作 | クラウドのブラウザ・デスクトップ。画面をいつでも見て触れる。自分のPC接続は任意（既定オフ）→ 手元のファイル・コマンド・ブラウザ | ― |
| コード・資料 | Codex のクラウド環境でタスク、ChatGPT Work で文書・表・スライド・Sites | Codex/Work の枠を使う |
| アプリ連携 | 4,000以上（Gmail・ドライブ・GitHub・Slack・**Shopify**・Canva・HubSpot など）。Slack は dot 専用アカウント | dot 専用メールアドレスはない。自作 MCP を直接つなげるかは未確認 |
| 連絡 | ChatGPT・Slack・Teams・音声通話（SMS は米国 Pro ベータ） | dot から電話は不可。Slack では持ち主の指示だけで動く |
| 記憶 | ChatGPT の記憶＋自分で作る記憶、手段をまたいで引き継ぐ | 1件ずつ見る・消すは不可（リセットのみ） |
| 承認 | 4段階のルール（聞かずに実行／事前承認で実行／毎回聞く／人に引き継ぐ）＋自動レビュー | 送金・パスワード変更は人。完全削除・インストールは毎回承認 |
| 見える化 | Activity View（進行中・予定・完了と実際の手順）、一時停止・リセット | ― |

- **dot 同士でチームを組む機能は「将来の構想」**（公式）。X の「3体の Dots が相談して合意」は Higgsfield 独自構成（GPT-6.1 Sol 表記など公式と食い違い）か複数アカウント
- 組織向けの「専門 dot」（調達・請求書・メールマーケ・CS）は企業限定で試験中

## 3. API・Claude Code との連携
- **dots の API はない**。似たことは Agents API（Codex 基盤・長時間・複数エージェント・MCP・コンピュータ操作）／Agents SDK／Responses API で作れる
- ChatGPT Work の予定タスクは Gmail 新着・Slack 投稿・GitHub PR で起動（2026-08-25〜）。MCP Events にも対応
- Claude Code との受け渡し（案）：①**Slack の共有チャンネル**（dot は独自アカウントで参加。Claude 側は Slack MCP の認証が必要）②**自分のPC接続で共有フォルダ**（dot がファイル読み書き・コマンド実行）③GitHub・Google ドライブ ④Agents API を Claude Code から叩く

## 4. 弱点
2段階認証・本人確認・reCAPTCHA で止まる／クラウドPCはログインし直しが必要／確認が多い・遅い（Slack 返信3分の例）／権限の広いトークンを使ってしまう例／プロンプトインジェクションは減らすが無くならない／記憶を個別に消せない／**Meta・Google の公式広告プラグインはない**（Adspirer＝一時停止の下書き作成、Windsor.ai＝分析の第三者製品で補う）

## 5. 活用例
クリエイティブ（文字起こしから切り抜き場面選び・SNS 下書き）／ローンチ資料の直し／請求書作成→承認後送信／EC（Shopify で割引・在庫、Canva で販促物、HubSpot）／広告（Adspirer で下書き、Windsor で分析）／リサーチ・事務（入力15分で2時間分）。X で流行：寝る前に「8時間、承認の範囲で自律的に進め、朝に完了・残り・保留理由を報告」と頼む（@paji_a ほか・原文は raw/ に一部）

## 6. 取り違えやすいもの
workspace agents（2026-04-22・チーム共有・Business 以上）／ChatGPT Work（07-09・長めのタスク）／Team tasks（DevDay・チームの定期業務）／Pulse（終了）／custom GPTs（廃止予定→プラグイン）／Grok Bot（xAI×Cursor の別製品 → grok.md）

## 出典
openai.com/index/introducing-dots/、openai.com/index/devday-2026-recap/、help.openai.com（20001530・20001554・20001529・6825453・9793128・20001516・20001155）、openai.com/index/introducing-workspace-agents-in-chatgpt/、developers.openai.com/api/docs/guides/agents、venturebeat.com、9to5google.com、platformer.news、eesel.ai、thekeyword.co、flaviocopes.com/openai-dots/、lolipop.jp、itmedia.co.jp、x.com/higgsfield_ai/status/2105133471949901866、x.com/codexneo4（raw/ に本文）
