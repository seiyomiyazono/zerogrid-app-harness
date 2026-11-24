# kagoochi-mail を入れる手順

読む人: このスキルを自分の Claude Code に入れて使う人（初めての人）。
読む時: 入れる時に1回。上から順に。
読まなくていい条件: もう入れてあり、`node scripts/build.mjs` と `python3 scripts/check.py` が動く人。

このスキルは、どの商品でもカゴ落ちメール4通（30〜60分後・24時間後・48時間後・72時間後）を参考4本の型どおりに作り、Shopify Messaging＋Shopify Flow に貼る Liquid まで出す。使い方は `SKILL.md`。

## 入れる

| # | やる事 | コマンド |
|---|---|---|
| 1 | スキルの置き場に写す | ハーネス（`zerogrid-app-skills`）の `skills/kagoochi-mail/` をそのまま使う。置き場を移さない |
| 2 | Node の部品を入れる（Liquid を描く liquidjs・日本語の折り返しの budoux） | `cd skills/kagoochi-mail && npm install` |
| 3 | Python の部品を入れる（画面で崩れを数える Playwright・画像を見る Pillow） | `pip3 install playwright pillow && python3 -m playwright install chromium` |
| 4 | 動くか確かめる（見本のここちドライの値で組む） | 下の「確かめる」 |

要る物: Node 18 以上・Python 3.10 以上・Claude Code（`claude` コマンド。審査役を起こすのに使う）。

## 確かめる

```bash
mkdir -p /tmp/kagoochi-try && cp skills/kagoochi-mail/templates/店の値_ここちドライ.json /tmp/kagoochi-try/店の値.json
node skills/kagoochi-mail/scripts/build.mjs /tmp/kagoochi-try/店の値.json
```

`ok e1 e2 e3 e3b e4 e4b` と出れば組む道具は動いている。`/tmp/kagoochi-try/dist/index.html` をブラウザで開くと、参考4本と並べた4通が見える。見本の値のままでは `check.py` の K5 が「店のレビュー.tsv が作業場の外」で × になる（店ごとに手順2で作る物なので、それで正しい）。

## 使う

Claude Code で「この商品のカゴ落ちメール作って」と頼むと、`SKILL.md` の手順1〜11で進む。

| 自分の環境に合わせる所 | どこ |
|---|---|
| 商品のフォルダ | 手順1の `<店のフォルダ>`（作者の環境では `（アプリには同梱していない資料）`） |
| GitHub の置き場 | 手順11の `tokunaritakakura-code` を自分のアカウントに替える |
| 写真と商品の事実の出どころ | `SKILL.md` の関門「連携時に決める所」。商品リサーチと連携する時に決める |
| Shopify の操作 | `references/shopify設置.md`。ブラウザを操作する道具は各自の物でよい（画面を撮る・座標で押す・字を打つ、ができる物） |

## 中身

| 物 | 役目 |
|---|---|
| `SKILL.md` | 指示書（関門 → 参考 → 手順） |
| `scripts/build.mjs` | 型（4通の段）に店の値.json を入れて、見る用の HTML と Shopify に貼る Liquid を出す |
| `scripts/check.py` | 最終確認 K1〜K7 を機械で判定する |
| `scripts/審査を回す.py` | 書いた本人でない Claude（編集長）に審査させる |
| `scripts/liquid描く.mjs` | Liquid を見本のカートで描いて確かめる |
| `templates/` | 空の店の値（`店の値_空.json`）と、埋め終わった見本（`店の値_ここちドライ.json`） |
| `references/` | 参考4本の画像と段の割り・見本の設計・審査の決まり・Shopify に載せる手順・送る道具の比べ |
| `直しの記録.md` | 試しで見つかった穴と、止める検査 |

## 最後の確かめ

- [ ] 入れる — 確かめ: `node skills/kagoochi-mail/scripts/build.mjs <作業場>/店の値.json` が `ok e1 e2 e3 e3b e4 e4b` と出す
- [ ] 画面の検査の道具 — 確かめ: `python3 skills/kagoochi-mail/scripts/check.py <作業場>` の K3 が「Chromium が立たない」と出さない
- [ ] 審査の道具 — 確かめ: `python3 skills/kagoochi-mail/scripts/審査を回す.py <作業場> --頼みだけ` が `審査_<回>_頼み.txt` を書く

