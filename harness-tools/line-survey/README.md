# line-survey — 商品ごとの LINE 診断 Bot（仮ハーネス 2026-10-20）

**2026-10-20 の向き**：新しい商品は「買う前の相性チェック」（`mode: "fit_check"`。悩みは聞かず、本当に合うかと最後の不安だけ → クーポン → 購入）。作り方は `scripts/survey-from-harness.md` の頭、道具は `scripts/fitcheck-from-harness.mjs`、見本は `products/tachimat-fitcheck/`。元の店の診断（mode 無し）はそのまま動く（本物との一致のテストあり）。

元の店の LINE（2026-09-27 版）を、どの商品でも動く形にした物。本体は1つで、商品ごとに変わる物は `products/<id>/survey.json` の1ファイルだけ。

- 仕組みは元の店と同じ：Vercel の受け口・署名の確かめ・友だち追加／言葉／ボタンの振り分け・「入力中…」・Flex のカード・答えはボタンの中に持ち回る（サーバーに貯めない）・返事は全部 reply（プッシュの通数を使わない）・人ごとの割引コード（Shopify）・カートを空 → 入れる → 割引つきの購入手続き（utm つき）・LIFF で広告のクリック ID を持ち越す（`/pages/line-go` を通す）・サイトのポップアップ。
- 移植の確かめ：`test/golden-tenant.mjs` が本物の元の店 Bot と同じ出来事を送り、LINE への返事と割引の作成が1文字まで同じかを比べる（53件一致・2026-10-20）。

## ファイル
| 物 | 場所 |
|---|---|
| 本体（どの商品でも同じ） | `lib/engine.js`（流れ・Flex）・`lib/shopify.js`（割引コード）・`api/webhook.js`（Vercel の受け口） |
| 商品ごとの設定 | `products/<id>/survey.json`（形は `schema/survey.schema.json`）。`products/tachimat-fitcheck/` は相性チェックの見本（前の診断の形の立ち仕事マットは `test/fixtures/tachimat-diagnosis.json`） |
| 設定の作り方 | `scripts/survey-from-harness.md`（商品フォルダから survey.json を作る手順と頼む文） |
| 検査 | `node scripts/check.mjs <survey.json> [--deploy]`（LINE の上限・押せる道を全部たどる・画像の抜け・仮の値） |
| 組み込み | `node scripts/use-product.mjs <survey.json>`（config/・public/img・public/liff・build/theme/<id>/ を作る） |
| 店のバリアント | `node scripts/pull-variants.mjs <survey.json> [--write]`（公開の商品データを読むだけ） |
| 画像 | `images/gen.mjs`（写真・バナーの生成。Higgsfield → 無ければ Codex）・`images/make_images.py`（文字入れ）・`images/style-guide.md` |
| 設定の道具 | `setup/line-api.mjs`・`setup/browser/line-console.mjs`・`setup/vercel.sh`・`setup/shopify.mjs` |
| テスト | `npm test`（診断の e2e 33件・相性チェックの e2e 37件・本物との一致 53件・検査が止めるか 13件） |

## 立ち上げの手順（使う人はログインだけ）

既定は全部 dry-run。書くのは `--apply` を付けた時だけ。`--apply` は 運営者（または使う人）の OK の後。

| 順 | やる事 | どうやるか | 人がすること |
|---|---|---|---|
| 0 | 共通 Chrome で LINE にログイン | `node setup/browser/line-console.mjs login` → `probe` | **ログイン（2段階認証も）** |
| 1 | LINE 公式アカウントを作る | `line-console.mjs oa-create` がフォームを出す | **フォームの入力と送信（名前・業種・メール・規約の同意）。自動にしない** |
| 1b | 認証済アカウントの申請（任意） | 管理画面の申請フォーム | **本人の申請・本人確認（申込者の携帯）・審査 5〜10営業日。自動にできない** |
| 2 | Messaging API を使う（プロバイダー → チャネルができる） | `line-console.mjs messaging-api <@basicId> --provider <名前>`（ブラウザ） | 初めてのプロバイダー作成で規約の同意が出たら押す |
| 3 | チャネルシークレット・長期トークン → `~/.config/secrets/line-<id>.env` | `line-console.mjs keys <id> <チャネルID>`（ブラウザ。トークンが無ければ「発行」を押す。値は出さない） | なし |
| 4 | Manager の応答設定（Webhook オン・応答メッセージ オフ・あいさつ オフ） | `line-console.mjs oa-response <@basicId>`（今は読むだけ。切り替えは画面の形を見てから足す） | 切り替え（未自動・下の「分かっていない事」） |
| 5 | Shopify の鍵（割引・テーマ・ページの権限） | `setup/shopify.mjs token <店> <id> <組織ID>`（`~/ec-ads/store-ad-setup` の道具。ブラウザ）→ `shopify.mjs check <id>` | 許可画面の「インストール」は道具が押す。店の課金は人 |
| 6 | 店のバリアント・値段を設定へ | `scripts/pull-variants.mjs <survey.json> --write`（公開データを読む） | なし |
| 7 | 画像 | `images/gen.mjs` → `images/make_images.py`（style-guide.md） | 見て OK |
| 8 | 検査 | `scripts/check.mjs <survey.json> --deploy` が 0件 | なし |
| 9 | Bot を出す（使う人の Vercel） | `bash setup/vercel.sh <survey.json> --apply`（link・鍵を標準入力で env add・deploy --prod・GET で ok） | **初回だけ `npx vercel@latest login`** |
| 10 | Webhook の URL を入れて試す | API：`line-api.mjs <id> webhook-set https://<id>-line.vercel.app/api/webhook --apply` → `webhook-test --apply` | なし |
| 11 | LINE ログインのチャネル＋LIFF | チャネル作成はブラウザ（`line-console.mjs login-channel`。入力欄は未自動）→ 鍵は `keys` と同じ手 → LIFF は API（`line-api.mjs <id> liff-create https://<id>-line.vercel.app/liff/ --apply`）→ LIFF_ID を Vercel に入れて出し直す | チャネル作成の入力（今は人） |
| 12 | リッチメニュー | API：`line-api.mjs <id> richmenu <survey.json> <img>/richmenu.jpg --apply`（validate → 作成 → 画像 → 全員に） | なし |
| 13 | 店にポップアップと中継ページ | `node scripts/use-product.mjs` → `setup/shopify.mjs theme <survey.json> <id> --check` → 非公開テーマに `--theme <ID> --apply` | 公開テーマへは **運営者 の OK の後**（`--main-ok`） |
| 14 | 自分の LINE で最後まで通す | 友だち追加 → 4問 → 購入手続きまで | **実機で1回** |

あいさつ：友だち追加のあいさつは Bot が送る（`copy.welcome`）。Manager のあいさつメッセージをオンのままにすると二重になるので、4 でオフにする。

## 2026-10-20 に確かめた事・確かめていない事
- 確かめた：`npm test` 全部通る。本物の元の店 Bot と返事・割引の作成が一致（4つの道・53件）。LINE API の読むだけの呼び出し（info・quota・webhook-get・richmenu-list）が元の店の鍵で 200。立ち仕事マットのリッチメニューの形を LINE の validate に通した（200・作っていない）。Shopify の試しの店（nn1n1g）で鍵・権限・テーマの読み取り（`check`・`theme --check`）。公開の商品データから元の店の 27 バリアントと値段が設定と一致。Vercel は共通の端末でログイン済み（dry-run のみ）。
- 確かめていない：`--apply` の書き込みは全部（LINE・Shopify・Vercel に何も書いていない）。ブラウザの道具は共通 Chrome が LINE からログアウトしていたので、`probe` が「ログインしていない」を見分けた所まで（画面の中の押し場所は未検証）。Higgsfield の道（鍵が無い）。`vercel env add --force` の書き方は CLI の版で違う可能性。
