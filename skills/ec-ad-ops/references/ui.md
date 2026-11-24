# 工程6：UI — 新しい画面（`zerogridcompany-cell/zerogrid-dashboard-ui`）に、うちのハーネスの事実を渡す形（2026-10-19）

このファイルは、**UI の画面がどのデータを待っていて、うちのどの工程のどのファイルがそれを持っているか**の対応表と、前のダッシュボード（`（アプリのダッシュボード）`。今は無い）の出す形に足した欄。**UI にはまだ繋いでいない**（繋ぐ時は、下の JSON をそのまま返す API を作るだけ）。

## 1. 新しい UI とは何か（読んだ版：2c1a780・2026-10-18。この Mac の写し `（アプリには同梱していない社内の道具）`）
- **画面だけ**。サーバー・DB・外部 API は無い。`node server.mjs` → `http://127.0.0.1:5190`。数字と文章は全部 `public/app.js` の上の方の名前付きの定数（仮データ）。最初に読む物は `HANDOFF.md`（「この形の JSON を API で返せば、画面はそのまま動く」）
- 左上で **チャット**（ダルマ4人：分析・広告・商品・CS。承認カードもここ）と **ダッシュボード**（全体／集客：広告分析・Meta・Clarity／店：ストア分析・商品・Shopify・Clarity・Klaviyo・LINE／CS／ログ）を切り替える。右は客が実際に見る画面（商品ページ・記事・メール・LINE）
- 決まり：お金とお客さんに関わる物（予算・値段・公開・返金・返信）は**人が承認するまで何もしない**。うちの決まり（Meta・Shopify への書き込みと公開は 運営者 の指示の後。Discord は見積もりと質問だけ）と同じ
- 初めて開く人の道（`onboard.js`：Shopify → Meta → 原価）と、プラグイン＝接続（`connect.js`：Shopify・Meta・Clarity・Klaviyo・LINE・Higgsfield・ElevenLabs・Claude・Codex・GetHookd・Apify）は localStorage の中だけ

## 2. 対応表（UI の定数 ← うちの出どころ → 渡す JSON）
`scripts/ui_export.py` がこの表のとおりに写す。出す先は `scripts/ui_products.json` の `dashboard_root`（今の値 `（社内の Mac の道：アプリには無い）` は、もう無いフォルダ。回す前に今の UI の置き場に直す）の下の `products/<id>/ui/*.json` と `products/_ui/*.json`（1ファイル＝UI の定数1つ。名前も UI の言葉に合わせた）。作った数字は入れない。測っていない物は `null` のまま出し、各ファイルの `_missing` に何が無いかを書く。

| UI の定数（画面） | 1件の形（HANDOFF 3章） | うちの出どころ（正本） | 書く工程・スキル | 渡す JSON |
|---|---|---|---|---|
| `STORES`（全体・ストア分析） | `[店名, 売上, 広告費, 実利益]` | 広告費＝`products/<id>/metrics.json`（Meta の読み取り）。**売上・実利益は Shopify を繋ぐまで null** | 5（fetch.py・refresh_meta.py） | `_ui/stores.json` |
| `BOTS`（チャットの名簿） | `{id,name,role,color,state,preview,routines}` | ダルマ4人 ↔ うちのスキル（下の 3） | — | `_ui/bots.json` |
| `THREADS`（チャットの中身） | `{k:'me'|'bot', v}` | `products/<id>/requests.json`（運営者 の依頼 → Claude の `reply`） | 5（SKILL.md「依頼に対応して」） | `<id>/ui/threads.json` |
| `ASKS`（承認カード） | `{id,bot,kind:'money'|'out',level,title,num,why}` | `plan.json` の `agents[].approval`（答え無し）＋ 最新ログの `plan.items`（`meta:true` で未承認） | 3・5（plan.md・apply.md） | `<id>/ui/asks.json` |
| `TREES`（広告分析＝広告の木） | `{campaign,budget,packs:[{n,land,fmt,ads:[{id,fmt,st,ang,aw,make,head,roas,spend,cpa,note,who,land}]}],lands,tests}` | `plan.json` の `plan.packs`（pack＝広告セット。名前 `pack◯_段階_入口`）・`landing_names`・`tests.json`（段・広告ごとの `kind/base`・**4D-1 のカード `tests`**）・`now.json`（広告ごとの数字） | 3（4B・4C）・5（4C-8・4D） | `<id>/ui/tree.json` |
| `AM`（Meta の表） | `{acct,id,price,camps:[{n,on,bud,sets:[{n,on,ads:[[名前,on,形式,消化,購入,表示,クリック]]}]}]}` | `metrics.json`（campaigns・series・landings）・`config.json`（アカウント）・`plan.json`（pack・min_spend） | 5 | `<id>/ui/meta.json` |
| `RUNS`（ログ：Bot がやった仕事） | `{day,t,title,bot,res,how,frames,steps:[{k,n,d,req,res}]}` | `products/<id>/log/<日付>.json` の `entries`（`adroom.mjs log`：見た→照合→した、画面のコマ `shots`） | 5（SKILL.md「運用はダッシュボードに残す」） | `<id>/ui/runs.json` |
| `DAYS`（ログの日ごとのまとめ） | `{d,w,conc,saw,so,did,rules}` | 同じログの `summary`（`adroom.mjs summary`：見たこと→だから→したこと）と `plan` | 5 | `<id>/ui/days.json` |
| `PRODUCT`（商品：誰に・原因・競合・損益・仕入れ先） | `{name,tag,one,price,unique,who:{big,gender,age,facts},cause:{belief,truth,loop,miss},comps,pl}` | `products/<id>/profile.json`（商品カルテ）＋ `plan.json` の `name/offer/price/store/supplier`。**元は工程1の `01_商品理解の基盤/`（A・B・C・E・H）と `02_損益分岐.md`** | 1・2（new-product.md・分析日） | `<id>/ui/product.json` |
| `SUPCHAT`（商品の右：仕入れ先とのやりとり） | `[['in'|'out', 文, 時刻, 既読]]` | `（作業フォルダ：アプリには同梱していない見本）`（`supplier_discord.mjs` が読んだ写し）・`scripts/discord_channels.json`（商品のチャンネル） | 0b（supplier.md） | `<id>/ui/supplier.json` |
| `PDP`（Clarity：店） | `{name,price,stars,rev,vars,offer,visit,cart,buy,url,blocks:[[見出し,位置%,来た人%]]}` | 見出し＝`products/<id>/articles.json`。**来た人%・★・件数・訪問は Shopify・Clarity を繋ぐまで null** | 4d・5 | `<id>/ui/pdp.json` |
| `ARTS`・`SCROLLMAP`（Clarity：記事） | `{name,url,src,map:[[見出し,位置%,来た人%]]}` | 記事＝`landing_names`＋`metrics.json` の `landings`（URL・題）＋`articles.json` の見出し。来た人% は null | 4c・5 | `<id>/ui/arts.json` |
| `CS_INBOX`（CS） | `[時刻, お客さん, 店, 内容, 状態, 客の文, 返事の下書き]` | `ec-cs` の `state.json`（`<state_dir>/state.json` の `customers[]`：status ①〜④・type_main・last_customer_msg・draft） | CS（ec-cs） | `<id>/ui/cs.json` |
| `MAILS`・`KFLOWS`（Klaviyo）・LINE | — | **うちに無い**（ec-email スキルのメールは Klaviyo の数字を持たない） | — | 出さない |
| `RANGES`（期間） | 今日・昨日・7日・30日… | `metrics.json` の `today/last7/last30`（UI の 90日・今月・先月は無い） | 5 | `meta.json` の `ranges` |

## 3. ダルマ4人 ↔ うちの役（`_ui/bots.json`）
| ダルマ | UI での役 | うちのスキル・工程 | ルーティン（うちで実際に回っている物） |
|---|---|---|---|
| 分析 | 競合と自店の数字 | `ec-research`（0）・`ad-funnel`（数字）・`ec-ad-ops` 基盤 4D・4E・14章（分析日） | 毎晩 21:00 `nightly.sh`（メタの数字の読み直し）・分析日（木） |
| 広告 | Meta（読み取り。変えるのは承認の後） | `ec-ad-ops`（3・5）・`vsl-script`・`zackd-ad`・`ec-static-ads`・`ec-native-ads` | 毎晩 21:00 明日の運用の案（`adroom.mjs plan`）→ 23:30 自動承認 → 適用（`apply.md`） |
| 商品 | 仕入れ先・商品理解・店 | `ec-ad-ops`（0b supplier.md・1 product-foundation.md・4d pdp.md）・`pdp-tsukuru` | 手動（`supplier_discord.mjs check`・商品のチャンネル） |
| CS | 問い合わせ | `ec-cs` | 手動（「CS確認して」） |

## 4. 承認（`ASKS`）↔ うちの承認
| UI の種類 | うちで何にあたるか | 出どころ |
|---|---|---|
| `money`（お金が動く）：予算を上げる・値上げ・値下げ・返金 | 夜の案の `budget/start` の項目（`meta:true`）・価格の承認（`agents[price].approval`）・CS の返金（ec-cs の②要対応） | ログの `plan.items`・`plan.json`・`state.json` |
| `out`（外に出る）：記事を公開・店を公開・構成を Meta に作る・台本で作り始める | `agents[].approval` の `kind`：root（根本原因）・store（店）・structure（構成）・script（台本）、記事の公開（4c）・店の「いいね」（4d） | `plan.json`・依頼票の状態 |
UI の「承認」ボタンは今は画面の中で消えるだけ（HANDOFF 4章）。繋ぐ時は、前のダッシュボードと同じ `POST /api/approve/<id>`・`plan_answer` に落とす。**Meta・Shopify を実際に変えるのは、承認の後の適用の仕事（`apply.md`）だけ**。

## 5. 前のダッシュボードの出す形に足した欄（UI に要る物。足すだけ。前の画面は壊さない）
| ファイル | 足した欄（任意。無ければ UI 側は null） | 書く時 |
|---|---|---|
| `products/<id>/profile.json` | `who.big`（人数。例「2,800万人」）・`who.gender`（`[["男性",9.2],["女性",11.2]]`）・`who.genderCap`・`who.age`・`who.ageCap`・`who.facts`（`[["腰痛の長さ","平均 9.9年"]]`）・`competitors[].url`・`competitors[].tier` | 立ち上げ（`new-product.md` の board）・分析日。出どころは `B_市場と悩みの地図.md`・`C_競合の地図.md`（数字が無ければ書かない） |
| `products/<id>/tests.json` | 基盤 4C-8 の **`tests`（4D-1 のカード：id・kind・base・change・arms・hypothesis・start・decide・result・learned）** と `ads.<番号>.copy`（4E-1 の札）。UI の `tests[]`（比べた2本・変えた札・決着・学び）はこのカードから作る。`kind` → UI の札は entry/hook→`ang`、copy/iter/audio→`make`、landing/article→`land`、format→`fmt` | 分析日・夜の案・新しい広告を作った時（4C-8） |
| `products/<id>/log/<日付>.json` | そのまま（`entries` の saw/why/did/rule/shots → UI の `steps`、`summary` → `DAYS`）。書き込み（`fix/setup/make`）は UI の「w」の段になる | 毎回（`adroom.mjs log/summary`） |
| `plan.json` | そのまま（pack の名前 `pack◯_段階_入口` から UI の `ang`〈入口〉と `aw`〈気づき度合い：悩み自覚=PA・解決策探し=SA・商品認知=PrA〉を取る） | 3 |

## 6. 使い方
```
cd ec-ad-ops/scripts
python3 ui_export.py            # 全商品（ui_products.json の表）
python3 ui_export.py wandry     # 1商品
```
- 商品の対応（ダッシュボードの id ↔ ハーネス のフォルダ ↔ UI の店名）は `scripts/ui_products.json`。新しい商品は1行足す
- 毎晩の案・分析日・新しい広告の後に回すと、UI の JSON が今の状態になる（前のダッシュボードの手順に1行足すのは、繋ぐ時）
- 出た物の確かめ：各 JSON の `_missing`（無い欄）と `source`（どこから写したか）

## 7. 無い物・繋ぐ時に決める事
- **Shopify の売上・実利益・訪問・カート率**：うちのハーネスに正本が無い（ad-funnel の fetch.py は Meta と Shopify の着地の数だけ）。繋ぐ時に Shopify の Admin API（`shopify-admin` MCP か `ad-funnel/scripts/fetch.py` の ShopifyQL）から取る
- **Clarity の来た人%（スクロールマップ）**：店ごとに Clarity の API の鍵が要る（HANDOFF 5章）。うちは両店の鍵がある（記憶 clarity-api-access）。繋ぐ時に `ad-funnel/scripts/ops_clarity_heatmap.mjs` を見出しの位置に合わせる
- **Klaviyo・LINE**：うちに無い
- **UI の店名**：UI は「店」＝ブランド1つ。うちは商品1つ＝店1つ（ワンドライ・ハリネル）。`ui_products.json` の `store` が UI の店名
- **新しい UI のリポジトリは触らない**（友だち／Kota の物。うちは JSON を渡す側）。UI 側に直してほしい事が出たら HANDOFF 5章の「まだ決まっていない所」に沿って 運営者 から伝える
