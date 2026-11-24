# AI の同僚たち（Claude Code × OpenAI dots × Grok）— 使い分けの叩き台（2026-10-02・運営者 と相談中）

詳細：[openai-dots.md](openai-dots.md)・[grok.md](grok.md)。ここは「どこで使うか」を一緒に決めるための案。決まったら決定日と理由を書き足す。

## それぞれの強み（一言で）
| | 強み | 弱み | Claude Code とのつなぎ |
|---|---|---|---|
| **Claude Code**（今のハーネス） | ファイル・プログラム・動画組み立て・検品・ハーネスの更新。自分の Mac で全部できる | 自分の Mac が動いている間だけ。定期実行は別に設定が要る | ― |
| **OpenAI dots** | 24時間クラウドで動く。4,000以上のアプリ（Gmail・Slack・Shopify・Canva）。判断だけ人へ。定期・イベント起動 | API なし。1人1体。2段階認証で止まる。Meta 広告の公式連携なし | Slack の共有チャンネル／PC 接続で共有フォルダ |
| **Grok Bot** | クラウドPCで画面操作を覚えて定期実行。Slack 常駐（チーム版） | API なし。ボット間の境界なし | Slack・シート経由 |
| **Grok API**（x_search・Imagine） | X の投稿を安く検索・分析（1,000件 $5）、15秒の音声付き動画生成 | 日本語の文字描画は未検証 | Claude Code から直接呼べる |

## ハーネスの工程ごとの案
| 工程 | 主担当（案） | 補助（案） | 理由 |
|---|---|---|---|
| ① 商品・悩みのリサーチ | Claude Code | **Grok API x_search**（X の生の声・競合広告の反応）／dots（毎朝の調査と要約） | X のリアルタイム検索は Grok が一番安く強い |
| ② pack 設計・台本 | Claude Code | dots（複数案のレビュー役） | 正本・チェックリストを読めるのは Claude Code |
| ③ 素材集め | Claude Code（素材庫・YouTube） | Grok Imagine（足りない場面の動画） | Imagine は音声付き15秒が安い（日本語の文字は入れない） |
| ④ 動画・静止画の制作と検品 | Claude Code | ― | 組み立て・字幕・口パク・検品は今の仕組み |
| ⑤ Meta への入稿・停止・予算 | Claude Code（API・承認つき） | dots（画面の確認・下書き） | Meta の公式プラグインがない。承認の決まり（停止で入れる）を守る |
| ⑥ 毎日の数字の確認と報告 | **dots の定期実行**（朝に数字を見て Slack で要約） | Claude Code（運用ボードの更新） | 自分の Mac が寝ていても動く |
| ⑦ 寝ている間の作業 | **dots**（8時間の自律作業→朝に完了・残り・保留を報告） | Claude Code（朝に受け取って制作） | 夜の待ち時間を使う |
| ⑧ CS・メール | dots（Gmail・Shopify） | Claude Code（ec-cs スキル） | 受信をきっかけに動ける |

## 次に決めること
1. dots を使うか（Pro か Business Premium の契約が要る）・どの工程から試すか
2. Claude Code ⇄ dots ⇄ Grok の受け渡し場所（Slack の専用チャンネル／共有フォルダ）
3. Grok API のキーを取るか（x_search の定点観測から）
4. 承認の線引き（お金・入稿・顧客への送信は人の承認）
