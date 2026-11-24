---
name: ec-ad-ops
description: ECブランドのMeta広告運用の基盤。商品が決まったら、商品理解の基盤（工程1）→ 損益分岐と広告の数字 → 初日の出稿設計（構成・pack・アングル・着地）→ 毎日・毎週の判定（止める・予算・疲れ・診断・来週何本）を、全商品共通の「広告運用ルールの基盤」で毎回同じ形で出す。成果物②〜④（記事・記事の指示書・動画の台本）と運用ボードもここ。「商品が決まった」「初日の構成」「pack作って」「どのアングルから」「来週何本」「止める？」「スケールしていい？」「ROAS落ちた原因」「着地どっちがいい」で使う。作るスキル：動画の台本は vsl-script、記事は references/article の仕組み（bakuro-copy・listicle-copy・ranking-copy・quiz-jp-copy）、店（PDP・商品ページ）は pdp-tsukuru、静止画は ec-static-ads、リタゲの静止画は ec-retarget-static、カゴ落ちメールは kagoochi-mail、ネイティブ広告は ec-native-ads（映像の型は今の5つ＝ZackDFilms・スケルトン・権威実写・クレイ物語・ZackD POV。作り方はこのスキルの references/video-formats.md）。通しの流れは references/flow.md。
---

# ec-ad-ops — 広告運用の基盤

このスキルは手順と出す形だけを持つ。**判断のルールはすべて [references/adops-foundation.md](references/adops-foundation.md)（広告運用ルールの基盤・全商品共通の正本）**。商品ごとの数字は <商品名>/` の 02・03 から毎回読み、ここに書かない。

## 鉄則

1. **広告の判断は基盤だけで出す。** 答えは「今の数字 → 基盤の番号 → やること → 次に見る日」の1行（基盤 0-2・14章）。基盤に無い場面は自分で埋めず、運営者 に出して基盤に足す。
2. **決めたことには基盤の番号と根拠の格を付ける**（基盤 0-3）。根拠が無い数字は置かない。
3. **実データは参考。** 全商品の試したことと結果は 03_実績の台帳.md` にためて、判断の横に添える。1つの商品の結果ではルールを変えない（基盤 15-3）。
4. **Meta・Shopify への書き込みは 運営者 の指示がある時だけ。** 作る時は停止（PAUSED）で作り、配信は承認の後。
5. **出す形は毎回テンプレートどおり。** 章の順と表の列を変えない。

## 工程（商品が決まったら、この順）

**通しの流れ（0 リサーチ → 0b 仕入れ先と商品チャンネル → 1 商品理解〈A〜K〉→ 2 お金 → 3 設計と依頼票 → 4a 台本 → 4b 映像 → 4c 記事 → 4d 店 → 4e 静止画 → 4f メール → 4g リタゲの静止画 → 5 運用 → 6 UI）と、工程をまたぐ互換性の表は [references/flow.md](references/flow.md)**（2026-10-19）。

**（2026-10-19）14段の台本の型（2026-10-08 に外へ出した物）は、`references/_archive/台本の作り方_20261008/` に写してある（古い記録。旧の `（アプリには同梱していない資料）` は使わない）。動画の台本の正本は `vsl-script`。**

**動画（VSL）の流れを1本につないだ：商品理解（F・J）→ pack分け（「動画の依頼」の表）→ 依頼票（[templates/vsl-request.md](templates/vsl-request.md)）→ 台本（`vsl-script` スキル。動画の台本の正本）→ 映像（票の映像の型の決まり）。**

| 工程 | やること | 正本 | 出すもの |
|---|---|---|---|
| 0 | 入口：A リサーチエージェント（ec-research）に探させる／B 運営者 が商品を渡す。**仕入れ先に聞き、「この商品で行く」になったら Discord に商品のチャンネルを作る**（2026-10-19） | [entry.md](references/entry.md)・[supplier.md](references/supplier.md) 1b | <商品名>/00_入口.md`（ひな形：templates/product/）・`scripts/discord_channels.json` |
| 1 | 商品理解の基盤（調査員5人＋検証役）。**最後に、根本原因を1つ決めて書く**（2026-10-07 運営者 指定）。**その後、アングルごとの台本の材料（J）を、アングル1つに1枚作る。`05_原稿の決まり.md` と `06_原稿/` の空の表も置く**（2026-10-11 運営者 指定。台本の工程では調べさせないため）。**その後、K ペルソナ（アングル × 相手、1人1枚。何のせいだと思っているか・こうなりたい・広告分析・この人への売り方）を作る。A は使い方（部位・相手ごとの分岐）・お手入れ（洗い方・交換・寿命）・同梱・使えない人まで埋める**（2026-10-19 運営者 指定） | [product-foundation.md](references/product-foundation.md)（J は末尾の「J アングルごとの台本の材料」）・**[root-cause.md](references/root-cause.md)（ルーツの探し方）** | <商品名>/01_商品理解の基盤/`（A〜G と `H_根本原因.md`。**2026-10-11 から `J_アングルごとの台本の材料/<アングル>.md` も**）。次の工程3は、F・J・**K** を入力にする |
| 2 | 損益分岐と広告の数字 | 基盤 0-4・1章 | `02_損益分岐.md`・`03_広告の数字（目標・予算）.md`（ひな形：templates/product/） |
| 3 | 初日の出稿設計（構成の型・アングルの順番・pack・着地・Meta の設定値） | 基盤 2-0・4B・10-1・11章、構成の型：[meta-structures.md](references/meta-structures.md) | [templates/01-pack-split.md](templates/01-pack-split.md) の形 → 運営者 の承認 → 停止で作る。**動画は、同じひな形の「動画の依頼」の表 → 表の本数だけ VSL の依頼票（[templates/vsl-request.md](templates/vsl-request.md)）を `<商品名>/06_原稿/依頼票/` に作る**（2026-10-11。アングルと段階は F の表と J のページから） |
| 4 | **動画（VSL）は「依頼票（`06_原稿/依頼票/`）→ `vsl-script` スキル（台本）→ 票の映像の型の決まり（映像。[video-formats.md](references/video-formats.md) の「今の5つの型」の表）→ 票の『納める場所』に納品」。動画の台本は `vsl-script` が正本**（2026-10-11 運営者 指定。票が無い動画は、先に工程3の表と票を作る。票の状態に「台本ずみ」「映像ずみ」「記事ずみ」と日付を足していく。**映像の後、同じ回で飛び先の記事を作る**＝[article.md](references/article.md)・`video-formats.md` の「動画の次は、必ず記事」。VSL のビジュアルは記事に使わない〈2026-10-12〉）。静止画の文字・本文・見出し・記事は、今までどおり下の creative-foundation.md と pack-scripts.md。<br>原稿：pack ごとに4本の原稿（静止画の文字・動画の台本・本文3案・見出し・法令の確認）。記事は ②③。 | **[creative-foundation.md](references/creative-foundation.md)（原稿の基盤・正本）**・**[root-cause.md](references/root-cause.md)**・[script-checklist.md](references/script-checklist.md)・商品の `05_原稿の決まり.md` | [templates/pack-scripts.md](templates/pack-scripts.md) の形で `<商品名>/06_原稿/` に保存。**記事は [article.md](references/article.md) の「先に読む」の道で作る**（型ごとのスキル。流れは flow.md の 4c）。承認の後に制作（動画は票の映像の型で作る：[video-formats.md](references/video-formats.md)〈今の5つの型・Remotion で編集〉。静止画は 2-9） |
| 4d | **店（PDP・商品ページ）**：記事の次に、記事の「残った疑い」を買う所で閉じる商品ページを `pdp-tsukuru` で作る。商品の事実は `00`・`A`・`02`、客は `K` から（`pdp-tsukuru/references/harness-map.md`）。土台 `_土台_記事の飛び先.md` は友だちから取るまで無い（2026-10-19） | [pdp.md](references/pdp.md) | `<商品名>/08_店/`（店の設計・`index.html`・印）。票に「店ずみ」。非公開テーマには「いいね」を待たずに置く（公開は 運営者 の指示の後） |
| 4f | **メール（カゴ落ち4通）**：店が出来た後に、レジでアドレスを入れて買わなかった人へ送る4通（1時間後・24時間後・48時間後・72時間後）を `kagoochi-mail` で作り、Shopify Messaging と Flow に入れる。声・専門家・保証は店と記事に出ている物だけを使う。有効にするのは 運営者 の指示がある時だけ（2026-11-18） | `kagoochi-mail/SKILL.md`（読み替えは `references/harness-map.md`） | `<商品名>/09_メール/カゴ落ち4通/`（店の値.json・dist・liquid・最終確認.md・前の設定.txt） |
| 4g | **リタゲの静止画（一度来た人・買う直前の人向け）**：店が出来た後に `ec-retarget-static` で作る。Meta への登録と配信は 運営者 の指示がある時だけ（2026-11-18） | `ec-retarget-static/SKILL.md`（読み替えは `references/harness-map.md`） | `<商品名>/06_原稿/リタゲ/設計/`（設計・生成の記録・配信の条件）→ `<商品名>/07_納品/Static Ads/リタゲ/<広告の名前>/`（画像.png・ヘッドライン.txt・本文.txt） |
| 5 | 毎日・毎週の運用（止める・予算・疲れ・診断・来週何本・記事の点検）。**リタゲの広告セットがある商品は、数字を読んだ日に、結果を見本に戻す**（`ec-retarget-static` の手順「配信の結果を見本に戻す」。2026-11-18）。**テストの段を `tests.json` に書く**（基盤 4C-8：分析日・夜の「明日の運用の案」・新しい広告を作った時に必ず更新。2026-10-07） | 基盤 4C・5〜10章・12章 | 判断の1行と、運用ボード、`<商品名>/tests.json` |

## 工程の継ぎ目（言われなくても次へ進む所・待つ所）

前の工程の「出すもの」が出来たら、この表の通りに動く。個別のスキルの終わりの文と食い違う時は、この表が上。

| 継ぎ目 | 動き |
|---|---|
| 0 → 0b → 1 | 待つ。買うかどうかは運営者が決める（「この商品で行く」の後に 1 へ） |
| 1 → 2 | 待つ。E・F・根本原因は運営者が確かめる（アプリの自動の立ち上げでは、案として書いて進む） |
| 2 → 3 | 続けて進む。02・03 が出来たら、同じ回で初日の出稿設計（04）を出す |
| 3 → 4 | 待つ。何を何本作るかの承認。承認の後は、設計の表にある物を 4a → 4b → 4c → 4d → 4e → 4f → 4g の順に、言われなくても作る（4g は、運営者 が「リタゲを作って」と言った時だけ） |
| 4c → 4d → 4f | 続けて進む。記事が審査に通ったら同じ回で店へ。店を下書き（非公開テーマ・商品は DRAFT）で置けたら、続けてカゴ落ちメールを作り、下書き・無効で Shopify に入れてテスト送信まで |
| 4d → 4g | 続けて進む（上の行で 4g を作る時）。店を下書きで置けたら、リタゲの静止画を設計 → 生成 → 点検 → 納品の場所に置く所まで。Meta には作らない |
| 5 の中（リタゲの数字を読んだ日） | 続けて進む。口座の数字を保存して `ec-retarget-static/scripts/sync_results.py` を実行し、結果を見本に戻す。聞かない（読むだけで、Meta を変えない） |
| 4 → 5 | 待つ。公開・配信・有効にする事は、運営者の指示がある時だけ |

工程の途中で聞いてよいのは4つ: ログインと人の確認の画面・お金のかかる生成・公開と配信と有効・運営者にしか決められない事（買うか・利益の割合・台本の1文目）。それ以外は自分で決めて進み、終わってから報告する。

## 何を聞かれたら、どこを読むか

| 依頼 | 読む | 出す形 |
|---|---|---|
| 商品を探して／この商品でやる | entry.md | 00_入口.md |
| 仕入れ先に聞いて／原価いくら？／返事来た？ | [supplier.md](references/supplier.md) | Discord に送る・返事を読む → 00_入口.md の仕入れ |
| 初日の構成・どのアングルから・pack を分けて | 基盤 1章 → 2-0 → **4B-0b（全部の広告の中身を読んで ①入口②軸③着地 を書き出す）** → 4B → 11章 | templates/01-pack-split.md（中身の表と、疲れの準備の表つき） |
| 原稿を作って | creative-foundation.md → script-checklist.md（動画の台本は、下の「VSL を作って」の行。2026-10-11） | templates/pack-scripts.md |
| 根本原因（ルーツ）を決めて／本当の原因は何？／なぜ今までの対策は効かない？ | [root-cause.md](references/root-cause.md)（商品の 01 の A〜G を読んでから） | `<商品名>/01_商品理解の基盤/H_根本原因.md`（root-cause.md の9章の形） |
| VSL を作って／この pack の動画を／このアングルで VSL を◯本（2026-10-11） | その商品の `04_初日の出稿設計.md` の「動画の依頼」の表 → `06_原稿/依頼票/` の票（無ければ [templates/vsl-request.md](templates/vsl-request.md) で作る。アングルのページ〈J〉が無ければ、先に product-foundation.md の J）→ `vsl-script` スキルに票を渡す（台本）→ 票の映像の型の決まり（[video-formats.md](references/video-formats.md) の「今の5つの型」の表） | 票1枚につき：台本（票の「納める場所」に `台本.md`・`理解メモ.md`・`相手.md`）→ 映像（票の「納める場所」）。票の状態に日付を足す |
| 静止画を作って／static ads | [static-formats.md](references/static-formats.md)（2.5章の表のとおり商品フォルダを読む → 型を選ぶ → Codex で画像 → 見出しと本文〈原稿の基盤 6章〉）。入口のスキルは `ec-static-ads` | `<商品名>/06_原稿/` に型の id つきの原稿 → 承認後に `07_納品/Static Ads/<pack>/`（画像・ヘッドライン.txt・本文.txt） |
| リタゲの静止画を作って／カゴ落ちの広告／買う直前の人向けの静止画／リタゲの結果を戻して（2026-11-18） | `ec-retarget-static` スキル（読み替えは `references/harness-map.md`）。新規向けの静止画は上の行 | `<商品名>/06_原稿/リタゲ/設計/` → `07_納品/Static Ads/リタゲ/<広告の名前>/`。配信は指示の後 |
| ネイティブ広告を作って | `ec-native-ads` スキル（2026-10-07。native-ads を複製し、商品理解の入口をハーネスに付け替えた版。読む所の対応は、そのスキルの `references/harness-map.md`）。その商品の `H_根本原因.md` が先 | `<商品名>/06_原稿/native_<pack>_<日付>.md` → 承認後に `07_納品/Native Ads/<pack>/` |
| 記事を作って／記事の依頼（ダッシュボード） | [article.md](references/article.md) の「先に読む」→ `references/article/05 記事を作る.md` の一回で作る道（型は `_VSLから型を選ぶ.md` で決め、`bakuro-copy`・`listicle-copy`・`ranking-copy`・`quiz-jp-copy` で作る） | `<商品名>/07_納品/記事/<名前>/`（html・content.json・納品メモ） |
| 店を作って／PDP／商品ページを作って／記事の飛び先の店（2026-10-19） | [pdp.md](references/pdp.md) → `pdp-tsukuru`（読み替えは `references/harness-map.md`） | `<商品名>/08_店/`。審査に通ったら待たずに非公開テーマ（公開は指示の後） |
| カゴ落ちメールを作って／放棄カートのメール／カゴ落ちメールを Shopify に入れて（2026-11-18） | `kagoochi-mail` スキル（読み替えは `references/harness-map.md`。Shopify に入れる順は `references/shopify設置.md`） | `<商品名>/09_メール/カゴ落ち4通/`。審査と最終確認が全部○の後、下書きで Shopify に入れる。有効にするのは指示の後 |
| ペルソナを作って／この商品のアングルを全部出して／相手を深めて | [product-foundation.md](references/product-foundation.md) の K（ひな形 `templates/persona.md`・指示 `templates/product-foundation/prompts.md` の K） | `<商品名>/01_商品理解の基盤/K_ペルソナ/<アングル>_<呼び名>.md`＋`_一覧.md` |
| 商品のチャンネルを作って／Discord で（商品名）に送って | [supplier.md](references/supplier.md) 1b・1 | `scripts/supplier_discord.mjs channel create`・`send --channel <名前>` |
| 使い方・洗い方を調べて | [product-foundation.md](references/product-foundation.md) の A（A-3〜A-6） | `A_商品の事実.md` の 3〜4・7 |
| 来週何本 | 基盤 1章 → 4章 → 4B | 「来週＝◯pack・◯本（言い換え◯・新しい層◯）」＋型ごとの消化の割合（4章⑦） |
| 次に何をテストする？／フックテスト・型（形式）のテスト | 基盤 **4C（テストの順番：入口 → 形式 → フック → 本文・見出し → 音）** → 4章⑥（フック替え）・4B-7（pack の中の4本） | 「今の段 → 進む条件に当たるか → 次に作る物」。`tests.json` を更新（4C-8） |
| 止める？・予算・疲れ・記事の点検 | 基盤 14章の型 | 判断の1行 |
| 疲れてきた？・次の pack の準備は？ | 基盤 6-6〜6-9・4-c | 入口ごとの疲れの比 → 準備の合図 → 準備する pack と出す日（templates/01-pack-split.md の「疲れの準備」の表） |
| ROAS が落ちた | 基盤 7章 → `scripts/fetch.py`・`scripts/analyze.py` | [templates/diagnosis.md](templates/diagnosis.md) |
| 広告が止まっている／口座が制限された／店がおかしい／予想していない事が起きた／変える前に何が起きうるか（2026-11-19） | [unexpected.md](references/unexpected.md)（9つの所 → 直せる人 → 4つの順） | 当たった所だけの報告。運営者 だけが直せる事・誰も直せない事は、その場で伝える |
| 判断を比べたい／私ならこうする、と比べて（2026-11-19） | 基盤 12-2 の9 | `<商品名>/11_判断の比べ.md`（ひな形 [templates/product/11_判断の比べ.md](templates/product/11_判断の比べ.md)）。Claude が先に書く |
| 今日サーフスケールする？／毎日の予算は？（2026-11-18） | 基盤 9-4・9-8 | 当たった番号と次の0時の額。サーフスケールは 運営者 に聞いてから |
| 記事か商品ページ直行か | 基盤 10-1・10-3 | Q 番号と理由、または着地テストの設計 |
| 特商法・返金ポリシー・規約・配送・プライバシーを作って／保証の書き方を直して | [store-legal.md](references/store-legal.md)（返金保証は30日・15日使用後が決まった形。全部の場所で同じことを言う） | templates/store-legal/ の5つの文書（ストアへの書き込みは指示がある時だけ） |
| 新しい広告アカウント | 基盤 11-4（ウォームアップ） | 準備〜4週目の表 |
| 広告の一覧を見せて | [ops-board.md](references/ops-board.md) | 運用ボード（Artifact） |

## 答える前に読み直すもの
運用の質問（どの pack を回す・何本作る・いつ再開など）に答える前に、基盤と、その商品の 02・03・初日の出稿設計・運用ボードを読み直し、決まっている計画をそのまま答える。計画を変える提案は、理由（新しい実データ・運営者 の新しい指定）がある時だけ「計画は◯◯、変えるなら理由は△△」と分けて出す。

## 数字の取り方
- 取得：`scripts/fetch.py <brand> <期間A開始> <期間A終了> <期間B開始> <期間B終了>`（読み取りのみ）。出力は `（作業フォルダ：アプリには同梱していない見本）`
- 計算：`scripts/analyze.py <作業フォルダ>`
- 基盤が求める数字（ピクセルの購入件数・新しく届いた人数など）の取得の接続は別途

## 制作の決まり（運用の外。正本だけ示す）
- **実写の画（絵コンテ・話し手・悩みの場面・手元）は、リアルに見せる型で作る**（2026-10-07 運営者 指定）：[realistic-image.md](references/realistic-image.md)（スマホで撮った1枚として書く7つ・共通の枠・場面ごとの注意・点検）。権威実写・実写の静止画に当てる
- **声は必ず ElevenLabs の V4（`eleven_v4`）**。どの型の動画でも同じ。ほかのモデル（v2・v3・turbo など）に落とさない。V4 が使えない時は止めて 運営者 に言う
- **動画（VSL）は、依頼票 → `vsl-script`（台本）→ 映像の型の決まり**（2026-10-11 運営者 指定。上の工程 3・4）。映像の型と寄せ方は、今の5つ（ZackDFilms・スケルトン・権威実写・クレイ物語・ZackD POV）：[video-formats.md](references/video-formats.md) の「今の5つの型」
- **静止画広告は、10種類の型（st01〜st10）から選び、型を変えてテストする。作る前に商品フォルダを読み、画像＋見出し＋本文を1組で出す。画像は Codex で作る**（2026-10-07 運営者 合格「はい最高」「もう完璧」）：[static-formats.md](references/static-formats.md)（st01 実体化〜st10 メッセージ画面の10種類・テストでの使い方・Codex の呼び方・止められた時の言い換え・点検）
- **実写の VSL は、リアルの型の手順で作る**（2026-10-07 運営者 合格「よすぎ。実写のVSLのハーネスこれベースでアップデートして」）：[live-action-vsl.md](references/live-action-vsl.md)（台本〈`vsl-script`〉→ リアルの型の画像〈Codex〉→ 声 → HeyGen の口パク → Wan 2.7 で動画化〈`scripts/i2v_real.py`〉→ 組み立て → 検品。全部カラー。話し手は画面いっぱい・襟元にピンマイク。見本は `（作業フォルダ：アプリには同梱していない見本）`）。運営者 の指定が無ければ、話し手が映る実写の VSL はこの手順
- 作る前と納品前のチェック：[script-checklist.md](references/script-checklist.md)（運営者 の指摘は直したらその場で足す）
- 動画の納品は成果物④のページの形。新しく作った素材は `register_assets.py` で素材庫に登録してから納品
- 参考動画から学んだこと（知識ノート。決まりではない）：[2026-10-04 ARCO 権威VSL](references/knowledge/2026-10-04-arco-authority-vsl.md)（3分30秒・160カットを測った、台本の段と秒数・言葉の種類ごとの画の当て方・字幕と重ねる効果の実測）

## UI
画面がどのデータを待っているかと、うちのどのファイルがそれを持っているかは [ui.md](references/ui.md)。

## 運用ボード（Artifact の型）
「広告の一覧を出して」「配信前の広告を並べて」→ [ops-board.md](references/ops-board.md) の型（広告マネージャの形のタブ、pack・作成済み／未作成・種類で絞り込み、広告名から詳細へ）。ひな形：templates/ops-board/。新しい商品は別の Artifact、同じ商品は同じ URL に data を差し替える。

## 使うのをやめた資料
`references/_旧/`（9/30 までの運用ルール・pack の作り方・着地・診断・根拠の付け方）。中身は基盤に移した。前のハーネス（`EC/`）の `判定.md`・`出稿.md` なども使わない。
