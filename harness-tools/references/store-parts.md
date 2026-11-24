# 工程4d の続き：店と一緒に入れる部品（特商法・ポリシー・問い合わせ・CS・LINE）（2026-10-20）

決まり：PDP（店）を作る時に、ついでに Shopify に特商法・ポリシー・問い合わせフォーム・LINE を入れる。
`pdp-tsukuru` が商品ページを非公開テーマに置いた（手順14a）後、**同じ回で**、この4つを入れる。どれも運営者のアカウントに入れる。AI は全部を用意して、非公開か dry-run まで進める。お客さまに見える形にするのは、運営者の OK の後。

## 0. 始める前にそろっている物
| 物 | 場所 | 無い時 |
|---|---|---|
| ブランド名 | `00_入口.md` の商品名の行（[naming.md](naming.md)） | naming.md を先に回す |
| 運営者の情報（会社） | `harness/_運営者/<会社>/運営者情報.json` | `operator-intake.md` で聞く（運営者が初めて使う時に1回） |
| 店の情報 | `harness/_運営者/<会社>/ストア/<店>.json` | `operator-intake.md`。店から読める物は `probe-store.mjs` が先に埋める |
| 商品の保証と節 | `<商品フォルダ>/08_ストアの決まり.json` | `operator-intake.md` の商品の質問。初期値は標準の型（30日間返金保証・到着から15日以上使ってから・15日未満は受けない・全額返金）。運営者が「初期値でよい」と言った時だけ入れる |
| 運営者のログイン | Shopify（アプリの鍵は `~/.config/secrets/shopify-<店>.env`）・Gmail・LINE 公式アカウント・Vercel | 運営者にログインだけ頼む（`アカウントの持ち主.md`）。鍵は画面にも記録にも出さない |
| 商品ページ | `08_店/01_<商品>_店_<型>_v1/`（非公開テーマのプレビュー URL が `店の設計.md` の頭にある） | [pdp.md](pdp.md) を先に回す |

## 1. 4つの部品
| 部品 | 担当の決まり | 入力 | 道具 | 出す物（商品フォルダ） | だれのアカウント |
|---|---|---|---|---|---|
| (a) 特商法・ポリシー5つ（特商法の表記・返品返金・利用規約・配送・プライバシー。連絡先情報も） | [store-legal.md](store-legal.md)・`operator-intake.md`（ポリシー・CS 担当） | 会社・店・商品の3つの JSON | `scripts/store-legal/render.mjs`（足りない値があれば聞く事を出して止まる）→ `install-shopify.mjs`（初めは dry-run） | `08_店/ポリシー/`（md・html・`index.json`） | 運営者の Shopify |
| (b) 問い合わせフォームのページ | 同上 | 同じ3つの JSON・店の色（`ストア情報.json` の `theme`） | `scripts/contact-page/build.mjs` → `install-shopify.mjs --contact`（ページは `/pages/contact`） | `08_店/問い合わせ/page.zg-contact.liquid`（＋見本の html） | 運営者の Shopify（非公開テーマ） |
| (c) CS（受信箱・ラベル・スプシ・署名） | `ec-cs` の `references/新ブランド立ち上げ.md` | 店の名前・CS のメール・担当者の名前・仕入れ先の連絡先（店の JSON と会社の JSON） | `ec-cs/config/<ブランド>.json`（`config/_ひな形.json` を写す）・`gsheet-create.mjs` | `ec-cs/config/<ブランド>.json`・スプシ。商品フォルダには場所だけ書く | 運営者の Gmail・Google スプレッドシート |
| (d) LINE 診断（友だち追加 → 質問 → 商品ページへ） | [line.md](line.md)（LINE 担当） | ブランド名・色・商品ページの URL・`K` の客の言葉（質問の中身） | `tools/line-survey/`（LINE 診断の骨組み。`scripts/use-product.mjs` で商品の設定を組み込む。店に入れる部品は dry-run が既定） | `08_店/LINE/`（`survey.json`・`img/`） | 運営者の LINE 公式アカウント・Vercel |

置き場の決め：商品ごとの物は全部 `08_店/` の中（ポリシー/・問い合わせ/・LINE/）。商品の保証は `08_ストアの決まり.json`（商品フォルダの直下）。会社と店の情報は `harness/_運営者/`。道具の場所は本物では `~/.agents/skills/ec-ad-ops/scripts/`（仮ハーネスでは `tools/`）。

## 2. 何が自動で、何が人か
| 部品 | AI が全部やる | 運営者のログインが要る | OK が要る（お客さまに見える前） |
|---|---|---|---|
| (a) ポリシー | 値を集める（店から読む・商品理解から文の案）→ 足りない値を1回でまとめて聞く → 書類を作る → 点検 → dry-run | Shopify（アプリの鍵を取る時に1回） | 書類の中身（特に 住所・電話を開示請求にするか、返金保証の日数）。OK の後に `--apply` |
| (b) 問い合わせ | ページを作る → 見本を見せる → dry-run → 非公開テーマに置く | 同上 | ページを公開する（テーマを公開する時に一緒） |
| (c) CS | 設定を写して埋める → ラベル9本 → スプシ → 初回の取得 | Gmail と Google の許可（1回） | 送る返信の種類（送るのは決めた種類だけ。ほかは下書きまで） |
| (d) LINE | 質問と画像とリッチメニューを作る（共通のデザインを土台に、ブランドの色と雰囲気で）→ Bot を組む → Vercel に出す → Messaging API・LIFF・Webhook・あいさつ文を設定 | LINE 公式アカウントの作成と認証の申請（本人の操作）・LINE Developers・Vercel | 友だち追加の入口を店に出す（ポップアップ・ボタン）。Bot の文と画像 |

## 3. やる順（同じ回で、この順）
1. **同じ値の表を作る**（下の 4）。値は3つの JSON から読み、ここで食い違いを0にしてから先へ
2. **(a) ポリシー**：`render.mjs --operator … --store … --product … --out 08_店/ポリシー/`。止まったら、出た質問を1回で運営者に聞き、JSON に入れて回し直す。点検（`index.json` の `problems` が空）→ `install-shopify.mjs --dir 08_店/ポリシー/`（dry-run）
3. **(b) 問い合わせ**：`build.mjs … --out 08_店/問い合わせ/page.zg-contact.liquid --preview …` → dry-run（`install-shopify.mjs --contact … --theme-id <非公開テーマ>`）
4. **(c) CS**：`新ブランド立ち上げ.md` の 1〜5。署名は `ストア情報.json` の `shop_name` と、会社の `cs_staff_name` から
5. **(d) LINE**：`line.md` の順。商品ページの URL は 1 で非公開テーマのプレビュー、公開の時に本番の URL へ替える。`ストア情報.json` の `line_url` に友だち追加の URL を書く（ポリシーと店のボタンがそこを読む）
6. **同じ値の点検を回す**（下の 4）。0 になったら、運営者に「店・ポリシー・問い合わせ・LINE」をまとめて見せる（PC とスマホ。プレビュー URL・LINE の QR）
7. **OK の後**：ポリシーと問い合わせを `--apply`、LINE の店の部品を入れる、テーマを公開（公開は運営者の指示の後だけ）。依頼票の状態に「店の部品ずみ <日付>」

順の理由：ポリシーが先（返金の日数と問い合わせの場所が全部の部品の土台）。LINE は商品ページの URL が要るので最後。

## 4. 同じ値の点検（全部の部品で、1字も違えない。store-legal.md 4章と同じ考え）
| 値 | 正本（1か所） | 出てくる所 |
|---|---|---|
| ショップ名（ブランド名） | `ストア情報.json` の `shop_name`（＝ `00_入口.md` のブランド名） | 店のヘッダー・タイトル／ポリシー全部／問い合わせページ／CS の署名と `brand_ja`／LINE のアカウント名とあいさつ文／注文メール |
| 返金保証（名前・日数・使う日数・返金額） | `08_ストアの決まり.json` の `guarantee_*`・`use_days`・`refund_rate` | 商品ページの保証の札と FAQ（`店の印.json`・`決めた値.md`）／返品返金ポリシー・特商法・利用規約／問い合わせページの注意書き／CS の返信のひな形／LINE の文／記事・広告の原稿（`05_原稿の決まり.md`） |
| 届く日数・送料 | `ストア情報.json` の `ship_days`・`delivery_days`・`shipping_fee` | 商品ページ（ボタンの下の1行と FAQ）／配送ポリシー・特商法／CS／LINE |
| 問い合わせの場所 | `ストア情報.json` の `contact_path`・`cs_email` | ポリシー全部／商品ページのフッター／CS の受信箱／LINE のメニュー |
| 友だち追加の URL | `ストア情報.json` の `line_url` | 商品ページのポップアップ・ボタン／LINE の設定 |

点検のやり方：
- ポリシーの中は `render.mjs` の点検（`index.json` の `problems`）
- 商品ページとポリシーと広告・記事の数字は、`pdp-tsukuru` の `面の数字.py`（保証日数・届く日数）
- 残りは、正本の値（ショップ名・保証の日数・「◯日間返金保証」の文）で `08_店/` の下と `ec-cs/config/<ブランド>.json` を grep し、別の値が1つでもあれば止める。前の店の名前（同じ運営者の別の店）と、前の保証（30日・15日）が残っていないかも grep する
- 1か所を変えた時は、正本の JSON を直して、(a)〜(d) を作り直す。出来た物を手で直さない

## 5. してはいけない事
- 運営者の OK の前に、Shopify のポリシー・公開テーマ・LINE の本番の設定に書き込まない（dry-run と非公開まで）
- 見本の値（`_example` の印・questions.json の example）で作った書類を、ほかの運営者の店に入れない（`install-shopify.mjs --apply` が止める）
- 鍵・パスワードを聞かない・書かない（運営者はログインだけ）
- 担当の決まり（store-legal.md・operator-intake.md・line.md・ec-cs）の中身をここに書き写さない。ここは順番とつなぎだけ

## 前後
- 前：4d 店（[pdp.md](pdp.md)・`pdp-tsukuru` の手順14a）
- 後：5 出稿・運用（[adops-foundation.md](adops-foundation.md)）。CS は出稿の日から `ec-cs` で毎日。流れの全体は [flow.md](flow.md)
