# 仕入れ先への問い合わせ（リサーチ君の仕事・工程0）

商品が決まりそうになったら、仕入れ先（Discord「Commercive private suppliers」、担当 Sara-Agent）に「この商品ありますか・いくらですか」を送り、返事（見積もりは画像が多い）を読んで原価を記録する。値下げの交渉も1回する。
送るのは 運営者 の指定（2026-10-03「共通ブラウザの Discord から送ってもらったら大丈夫」）で、確認なしで送ってよい。**注文・支払い・約束はしない**（見積もりと質問だけ。買うかどうかは 運営者）。

## いつ
| 場面 | やること |
|---|---|
| 入口A：ec-research が商品を確定した時／入口B：運営者 が商品を渡した時 | 問い合わせを送る（下の1） |
| 毎回の作業の始め・運営者 に聞かれた時 | 返事を読む（下の2） |
| 見積もりが来た時 | 原価を記録 → 粗利を計算 → 低ければ交渉（下の3） |

## 0. 送る前に：もう聞いてある商品は送らない（2026-10-07 運営者 指定）
運営者 から渡された画像が、仕入れ先の見積もりの表（紫の見出しに Picture／Quantity／Process time／Japan、行ごとに $ の値段）なら、その商品はもう聞いてある。**問い合わせは送らず**、表の値段と日数をそのまま原価として記録する（下の 3）。同じ商品を二度聞かない。

## 1. 送る
- チャンネル：#general（新しい商品の問い合わせ）。出している商品の注文・発送の連絡は商品ごとのチャンネル（ワンドライは #one-dry。一覧と id は `scripts/discord_channels.json`。新しい商品は 1b で作る）
- 文面（短い英語。今までのやりとりの形に合わせる）：
```
<商品ページの URL（競合の商品ページか Alibaba・1688 の URL）>
can you source this?
variant: <色・サイズ。無ければこの行は消す>
bundle: 1 / 2 / 3 pcs
pls quote unit cost + shipping to Japan for each bundle
```
  最後に @Sara-Agent が自動で付く。写真しか無い時は URL の代わりに画像を付ける（`--image`）
- 送り方：本文をファイルに書いて
  `node ec-ad-ops/scripts/supplier_discord.mjs send --product <商品のid> --text <本文ファイル> [--image <画像>]`
  - 統一ブラウザ（CDP 9222）の Discord を使う。ログインが切れていたら止まるので、運営者 にログインを頼む
  - 送った後、画面に自分の発言が出たことを確かめてから「送った」と記録される（`（作業フォルダ：アプリには同梱していない見本）`）。確かめられなければ「送った」と言わない
  - 試す時は `--dry`（入力欄に入れて撮るだけ。送らない・入力欄は空に戻す）

### 同じ商品を何件か見つけた時・アップセルの時（2026-10-07 運営者 指定）
- 先に AliExpress・Alibaba・1688 で**全く同じ商品**（形・柄・寸法・包装が同じ）を探し、見つけた URL を1通にまとめて送る。URL は1行に1つ。間に空行を入れて読みやすくする：
```
<URL 1>
<URL 2>
<URL 3>

can you source these?
(same product, different sellers)

bundle: 1 / 2 / 3 pcs
pls quote unit cost + shipping to Japan for each bundle
```
- アップセルとして売りたい商品の時：
```
<URL>

can you source this?
I want to sell it as an upsell for <今売っている商品の名前（英語）>

pls quote unit cost + shipping to Japan
can it ship in the same package?
```
- 改行は本文ファイルの改行のまま送られる。メンション（@Sara-Agent）は自動で最後に付く。送る前に `--dry` で入力欄の見え方（改行・メンションが効いているか）を1回確かめる
- 返事（見積もりの画像・商品の写真）が来たら、原価を `00_入口.md` に書き、画像を商品のフォルダ（ダッシュボードの `products/<id>/supplier/`）に入れて、商品情報の「仕入れ」に出す

## 1b. 商品のチャンネルを作る（2026-10-19 運営者 指定）
- **いつ**：見積もりの返事を読んで原価を記録し（2・3）、運営者 が「この商品で行く」と言った時（工程1に進む前）。問い合わせの段階（1）では作らない（#general で聞く）
- **名前**：商品の呼び名を小文字の英字とハイフンで（例 `one-dry`・`cocochi-dry`・`ohisama-pants`・`arukoto`。絵文字は付けない）。種類はテキスト。「Text Channels」の中。プライベートにしない
- **作り方**：`node ec-ad-ops/scripts/supplier_discord.mjs channel create --name <名前>`（先に `--dry` で、窓が開いて名前が入った画面を撮って確かめる。2026-10-19 に `--dry` で通した）。作れたら `scripts/discord_channels.json` に id が足される。手で作った時も、この JSON に足す
- **作った後**：チャンネルで最初の1通を送る（商品ページの URL・見積もりの要点・「今後この商品の注文と発送の連絡はここで」の英語1行。`send --channel <名前>`）。`00_入口.md` の「仕入れ」の表にチャンネル名を書く。**以後、その商品の注文・発送・質問は、全部そのチャンネル**（`send`・`check` に `--channel <名前>`）。#general は新しい商品の問い合わせだけ
- **一覧**：`node … supplier_discord.mjs channel list`（2026-10-19 に読んだ13本：general・seren・silen・negirai・kotsuraku・dr-step・nyaqua・one-dry・cocochi-dry・arukoto・ankla・melao・ohisama-pants）
- 統一ブラウザ（CDP 9222）の Discord に 運営者 がログインしている事が前提。切れていたら止まるので、運営者 にログインを頼む

## 2. 返事を読む
`node ec-ad-ops/scripts/supplier_discord.mjs check --product <id>`
- 送った後の Sara-Agent の発言を集め、画像を `（作業フォルダ：アプリには同梱していない見本）` に保存する。`ours: true` がこちらへの返事（#general は他の売り手も使うので、他の人への返事は使わない）
- 見積もりの画像は開いて読み、数字を書き写す（原通貨・単価・送料・セットごと・見積日）
- 「どのバリエーション？」などの質問が来たら答えを送る（1 と同じ方法）。答えが分からなければ 運営者 に聞く

## 3. 記録と交渉
- <商品名>/00_入口.md` の「仕入れ」の表に、送った日時・返事・原価（原通貨・円・見積日・送料込みか）を書く。原価は 02 の起点
- 粗利＝（売値 − 原価）÷ 売値。価格設定君の目標は 85〜90%（運営者 指定 2026-10-03）。売値の案がまだ無ければ、競合の売値で計算する
- 85% に届かなければ1回だけ交渉する：
```
thanks! can it be cheaper?
if I sell as 2 / 3 set bundle, what's the price?
expected volume: <月の見込み数。分からなければこの行は消す>
```
- 2回目以降の交渉・注文の数の約束は 運営者 に聞いてから

## 出どころ
- 聞くこと（商品の有無・パッケージの写真・原価）と、原価は画像で来ること：`_rules/サプライヤー.md`（2026-09-03）
- 文面の形：#general の今までのやりとり（2026-09-27〜10-03 に統一ブラウザで読んだ。「<URL> can you source this」→ Sara-Agent が返信で見積もり画像、「can it be cheaper if 2/3 set bundle」）
