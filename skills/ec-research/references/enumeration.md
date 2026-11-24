# 全件列挙（v6・2026-08-20 運営者指示）— 探す段階でキーワードを使わない

## なぜ変えたか

v5までは「感情的サブニッチを生成 → キーワードで掃引」だった。この設計は**引いたキーワードの外にある商品が構造的に見つからない**。

2026-08-20の実例。`active_ads_count>=1000` で引いた最初の40社のリスト、5番目にこれが入っていた。

```
3271  Vision Beam  135d  https://vionb.com/pages/5-reasons-overstimulated-brains
```

`products.json` も叩いて `Fade - Sleep Earplugs $39.00` を見ていたのに、**「39商品＝カタログ」だけで捨てた**。
代わりに提出したのが首の後ろのコブ（70点）。**当たりは最初から手元にあった。**

だから探す段階は**キーワードではなく全件列挙**にする。

## 母集団の実サイズ（2026-08-20 実測）

`mcp__zg__gethookd_search_ads` の `meta.total_results` を読む。`ads_per_brand_limit=1` を付けると**ブランド数**、
外すと**広告本数**になる（同条件で 538 vs 323,080。単位が違うので必ず付ける）。

| 条件 | Shopifyの社数 | 全部取るコスト |
|---|---|---|
| 広告 **1,000本+** | **538社** | 5.4クレジット・数十秒 |
| 広告 500本+ | 2,008社 | 20クレジット |
| 広告 100本+ | 18,344社 | 183クレジット（予算オーバー） |
| 広告1,000本+（プラットフォーム不問） | 962社 | ― Shopifyは全体の56% |

**1,000本以上のShopifyは538社しかない。全部見られる。**

## 一次スイープ（商品を見つける）

```
mcp__zg__gethookd_search_ads
  active_ads_count    = 1000        ブランドのアクティブ広告の下限
  technologies        = shopify
  ads_per_brand_limit = 1           ← 必須。1ブランド1行になる
  limit               = 50
  page                = 1..11       538社 ÷ 50 = 11ページ
```

- **`query` は渡さない。** キーワードを入れた時点で全件でなくなる
- `page` の上限は20、`limit` の上限は100。1クエリの天井は2,000件
- 2,000件を超える母集団（500本以上=2,008社など）は `active_ads_count_max` で帯を割る
  （500-999 / 1000-1999 / 2000-4999 / 5000+）。帯は重ならないので取りこぼしも重複も出ない
- 結果は zg の research_index（research/banger-index.json）に保存する。**次回は差分だけ**

## 二次（見つけた商品の競合を全部拾う）— 無料

一次には**分割型オペレーターが出てこない**。ペルソナページに割っているので1ページあたりが1,000本未満になる。

実例: Cevera（trycevera.com）は合計722本だが、7つのペルソナページ（Dorothy Callahan 132／Barbara Linfield 177／
Dr. Linda Marsh, DPT 138／Posture Health Daily 128／Posture After 60 110／Carol M. Bennett, PT／The Posture Project）に
割れていて、最大でも177本。`search_brands("cevera")` は0件を返す。

**でもHookdは持っている。** `search_brands("posture")` を叩くと `external_id=1064763600047131`（=Posture Health Daily）が返り、
これは trycevera.com のページIDと完全一致する。**収録漏れではなく、ブランド名ではなく着地ドメインでまとめるべきだった、というだけ。**

だから二次はこうする。

1. 一次で見つけた商品の**カテゴリ語**で `search_brands`（無料・0クレジット）
2. 返ってきたブランドの `external_id`（=FacebookのページID）を着地ドメインで名寄せ
3. 同一ドメインのページの `active_ads` を**合算**してブランドの真の本数にする

分割型を一次で拾おうとすると18,344社＝183クレジットで予算オーバー。**見つける段階には要らない情報**なので切る。

## 残る穴と、それが実害にならない理由

穴は「分割型で、どのページも1,000本未満で、どのカテゴリからも一次で引っかからない」オペレーターだけ。
分割型は必ず何かの商品カテゴリに属する。そのカテゴリに1,000本級が1社もいないなら、そもそもバンガー基準を満たさない。
**取りこぼしても損しない層。**

## Hookdの数字の信頼性（2026-08-20 検証済み）

`active_ads` は Meta広告ライブラリの実カウントと **±20%以内で一致する**。

| ブランド | Hookd | Meta実測 |
|---|---|---|
| Stepprs | 1,462 | 1,258 |
| Artuvate | 586 | 631 |
| CALLIXE | 544 | 396 |

**だから広告本数はHookdで取る。ブラウザでMeta広告ライブラリを1社ずつ開くな**（1社5秒×450社＝35分を実際に溶かした）。
Metaを使うのは、Hookdに無いブランドを名指しで確認する時だけ。

## `search_ads` の使えるフィルタ（探索の骨）

| フィルタ | 用途 |
|---|---|
| `active_ads_count` / `_max` | 帯分割。全件列挙の主軸 |
| `technologies` | `shopify` でDS土俵に絞る |
| `run_time` / `_max` | 継続日数。長く回っている＝効いている |
| `page_type` | `vsl_page` `quiz_page` `opt_in_page` などファネル型で絞る |
| `performance_scores` | `winning`(91+) `optimized`(81-90) |
| `ad_format` | `video`(VSL) `image` `texts`(=no_media。質問投稿型ネイティブ) |
| `geo` | 日本の空白確認に `JP` |
| `ads_per_brand_limit` | **1=ブランド一覧 / 0=広告そのまま**。用途で必ず使い分ける |

返り値には `share_url` `landing_page` `page_type` `days_active` `performance_score` `transcripts` が入っている。
**スワイプ素材はここから取る**（ブラウザでMetaを開く必要はない）。

## 2026-10-20 の実測（通しテスト）
- `search_ads` の返りは1広告あたり約2〜5KB（本文・transcripts・brand を含む）。Claude Code の保存結果は約100KB で切れるので、`limit=50` だと1ページに **20件前後しか読めない**。`limit` は 20 以下にして `page` を増やすか、保存ファイルを `raw_decode` で1件ずつ読む
- `list_shops`（`shopify_detected=true, min_live_ads_count=1000, sort=most_live_ads, limit=50`）は店1行（domain・monthly_visits・live_ads_count・product_count）で軽く、バンガー基準の訪問数も同時に取れる。Phase 1 の第一候補にする（この日は 500／timeout が続き確かめられていない）
- Hookd が落ちている時は、前回の research/banger-index.json（research_index）を土台にし、各店の `/products.json` を zg の research_stores（deep:false）で取って（8並列・1回40店）Phase 2〜3 を回せる
