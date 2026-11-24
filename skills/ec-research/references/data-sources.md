# データソース手順 v6

## Hookd（gethookd MCP）— 主力データソース

アプリでは zg の gethookd_<道具の名前>（例 gethookd_search_ads・gethookd_search_brands・gethookd_list_shops）で使う（ToolSearch は要らない）。**主指標は brand.active_ads（ブランドのアクティブ広告数）**。

> **探す段階は `enumeration.md` が正。** 下のキーワード掃引は「課題を指定された深掘りモード」でだけ使う。
> 引数なしの全件列挙モードでは `query` を渡さない（渡した時点で全件でなくなる）。

### 数字の信頼性（2026-08-20 検証）

Hookdの `active_ads` は Meta広告ライブラリの実カウントと **±20%以内で一致する**（Stepprs 1,462/1,258、Artuvate 586/631、CALLIXE 544/396）。
**広告本数はHookdで取る。ブラウザでMeta広告ライブラリを1社ずつ開くな**（1社5秒×450社＝35分を実際に溶かした）。

### `ads_per_brand_limit` は必ず意識して使い分ける

| 値 | 返るもの | 用途 |
|---|---|---|
| `1` | 1ブランド1行 | ブランド一覧。`meta.total_results` が**ブランド数**になる |
| `0` | 広告そのまま | ランディング先の集計（＝主力商品への集中度）、スワイプ素材 |

同条件で 538（=1）と 323,080（=0）。**単位が変わるので混同すると桁を間違える。**

### スワイプ素材はHookdの返り値から取る

`share_url` `landing_page` `page_type` `days_active` `performance_score` `display_format` `transcripts` が入っている。
`display_format=texts`（=no_media）は**質問投稿型ネイティブ**で、この形式が最長で回っていることが多い。

### 掃引の標準設定（課題を指定された深掘りモードだけ。全件列挙では使わない）

```
search_ads(
  query="<メカニズム/症状キーワード>",
  performance_scores="growing,optimized,winning",
  platform="facebook,instagram",
  geo="US",
  limit=8
)
```

- 結果ごとに必ず記録: brand.name / brand.id / **brand.active_ads** / days_active / landing_page / performance_score / display_format
- days_active < 4 の広告は無視（4日ルール）。継続日数ソートで深掘りたい時は sort_column="days_active", run_time=14 を使う
- 1検索で5ブランド未満なら別キーワードで再検索
- 結果が大きいと切れる（アプリの道具の返事は1回6万字まで）。limit は20以下にして page を増やし、必要な欄だけ research_index・write_file の research/ に残す（アプリではコマンドで JSON を読めない）
- コストは結果数課金だが実測で20件≒0.1〜0.2クレジットと軽い。終了時に remaining_credits を報告

### 補助ツール

- `list_creative_categories`（無料）: クリエイティブ型分類のID一覧
- `get_brand` / `search_brands`: ブランドの正確なactive_ads・カタログ確認
- 文字起こし：search_ads の返りの transcripts を使う（アプリでは transcribe_ad＝新しく文字起こしを頼む道具は使えない。無い時は「取得できず」と書く）
- `get_top_ads`: スパイ済みブランドの現行トップ広告

## Meta広告ライブラリ（無料・公式）— 裏取りと日本チェック

- `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=<キーワード>`
- ページ単位の「掲載中の広告 n件」でHookdの数字を裏取りできる
- **日本の空白度チェックは country=JP + 日本語キーワード**
- WebFetchはJS必須で失敗しがち⚠️ → 失敗したらWebSearchで補完し、「手動確認ポイント」に回す

## 訪問数カスケード（4段。どの段で取れたかのラベルを必ず付ける）

| 段 | 方法 | ラベル |
|---|---|---|
| ① | `https://www.similarweb.com/website/<domain>/` をWebFetch（月5万訪問以上ならほぼ出る） | ①実測 |
| ② | WebSearchで「<domain> similarweb monthly visits」→集計サイトのキャッシュ | ②間接 |
| ③ | active_ads本数と広告勢いからオーダー推定（「月数万訪問級」の粒度でよい） | ③推定⚠️ |
| ④ | 取れなかったらレポートの「手動確認ポイント」に明示（SimilarWebログインで実測可能と添える） | 手動 |

原則: **判定はactive_adsで行い、訪問数は取れたら載せる補助証拠**。Markの教え通り、このサイズ帯のブランドはSimilarWebに載っていないのが普通で、欠測は悪いシグナルではない。

## 日本市場（規模の測り方の詳細は `market-size.md` が正）

- 空白度: Meta広告ライブラリ(JP)＋楽天ランキング `https://ranking.rakuten.co.jp/`＋Amazon.co.jp／Yahoo!ショッピング。「VSL/アドバトリアル型のDTC専業がいるか」を重点確認（棚売り大手・楽天汎用品は空白扱いでOK=需要の証拠）
- 市場規模: 悩み人口の**公的統計・大規模調査**（国民生活基礎調査、有病率研究、業界調査）をWebSearchで。楽天レビュー件数・ランキング掲載も代理指標になる
- 日本の競合規模は訪問数の代わりに**楽天レビュー件数**で測る（実数で取れる）
- 広告相場の前提: CPM 100〜500円 / CPC 10〜150円（2026年時点）

## 原価・物流（最終確認用）

- CJ Dropshipping: 処理2〜3日+配送〜15日。日本の客は2週間超で不満→CJ日本倉庫在庫の有無を確認
- 売上方程式: visits × CVR 1.5〜3.5%（価格と逆相関、標準2%）× AOV（保守的に）[Mark, 発信2026-06-11]。合格基準の目安は月$200-300k。0→10万visits/月の急成長は基準未達でもgreen flag
- **advertorialドメインと本店ドメインは別々に測る**（Chad funnel型はトラフィックが記事側に集まる）[Mark, 発信2026-06-27]
- 競合のオファー構造（バンドル/サブスク/ギフト/decoy）も観測対象。AOVを上げられる商品構造か=「顧客獲得に最も金を払える広告主が勝つ」の土俵確認
