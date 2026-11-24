# ad-funnel

Meta広告の分析シート（1枚のHTML）を、Meta・Shopify・Microsoft Clarityの実データで作る Claude Code スキル。

- 全キャンペーン ＞ キャンペーン ＞ 広告セット ＞ 広告 をカードで降りていける
- 広告ごとの一覧 → タップでその広告の詳細（クリエイティブ・数字・ファネル・日別）
- 期間は 今日（昨日の同じ時刻まで比較）・昨日・7日・14日
- ファネルは「クリックを100%として何%残ったか」＋「商品ページ＝100%でのカート・購入手続き・購入」
- 記事LP・商品ページは「何%地点まで何%残ったか」と、そこまで見た人の購入率（Clarity × Shopify を fbclid で照合）
- 記事LP・商品ページのスクショを自動で撮る（計測タグは遮断）

取得はすべて読み取りのみ。広告・ストアの設定は変えない。

## 必要なもの

- macOS（Google Chrome がインストール済み。別の場所なら `CHROME_PATH`）
- Python 3.11+ と Pillow（`pip install pillow`）
- Node.js 18+
- Meta のアクセストークン（`ads_read`）
- Shopify Admin API のトークン（`read_reports` / ShopifyQL が使えること）
- Microsoft Clarity の Data Export API トークン
- 広告のURLパラメータに `ad_id={{ad.id}}` が入っていること（深度・購入の照合に使う。`fbclid` はMetaが自動で付ける）

## セットアップ

```bash
# 1. スキルを置く
git clone <このリポ> ad-funnel
cd ad-funnel/scripts && npm i

# 2. 秘密を置く（値はここにだけ。権限は600）
mkdir -p （社内の Mac の道：アプリには無い） && chmod 700 （社内の Mac の道：アプリには無い）
printf 'META_TOKEN=...\n' > （鍵はアプリの接続で管理）
printf 'SHOPIFY_STORE=example.myshopify.com\nSHOPIFY_TOKEN=...\n' > （鍵はアプリの接続で管理）
printf 'CLARITY_TOKEN=...\n' > （鍵はアプリの接続で管理）
chmod 600 （鍵はアプリの接続で管理）

# 3. ブランド設定を作る（置き場所は AD_FUNNEL_HOME、既定 （作業フォルダ：アプリには同梱していない見本））
mkdir -p （作業フォルダ：アプリには同梱していない見本）
cp ad-funnel/assets/brand.example.json （作業フォルダ：アプリには同梱していない見本）
# → 中身をブランドに合わせて書き換える（広告アカウントID・サイト・商品ページのパス・秘密ファイル名と変数名）

# 4. 回す
ad-funnel/scripts/run.sh mybrand
open （作業フォルダ：アプリには同梱していない見本）
```

Claude Code では「広告分析して」「/ad-funnel mybrand」で動く。

## 注意

- Clarity の Data Export API は1日10回・1回1,000行まで。スキル側で1日8回に抑え、取得分を貯めて直近8日分を合わせる。
- 深度（記事・商品ページのどこまで見たか）は Clarity のサンプルなので、期間切替の対象外。
- ブランド設定・取得データ・シートはスキルの外（`AD_FUNNEL_HOME`）に保存される。スキルのフォルダに案件データは入らない。
