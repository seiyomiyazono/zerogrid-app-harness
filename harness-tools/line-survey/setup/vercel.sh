#!/bin/bash
# Bot を使う人の Vercel に出す。使う人は `npx vercel@latest login` でログインするだけ（ブラウザが開く・人の操作）。
# 使い方: bash setup/vercel.sh <survey.json> [--apply]
#   1. 設定を組み込む（scripts/use-product.mjs）→ 検査（scripts/check.mjs --deploy）→ テスト（npm test）
#   2. プロジェクト <id>-line を作る／つなぐ（vercel link）
#   3. 鍵を入れる（~/.config/secrets/line-<id>.env と shopify-<id>.env から。値は標準入力で渡し、画面に出さない）
#   4. 本番に出す（vercel deploy --prod）→ GET で "ok" が返るのを確かめる
# --apply が無ければ、2〜4 は何をするかを出すだけ。
set -euo pipefail
CFG="${1:?survey.json を渡す}"; APPLY="${2:-}"
R="$(cd "$(dirname "$0")/.." && pwd)"; cd "$R"
ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$CFG','utf8')).id)")
LINE_ENV="$HOME/.config/secrets/line-$ID.env"; SHOP_ENV="$HOME/.config/secrets/shopify-$ID.env"
run() { if [ "$APPLY" = "--apply" ]; then "$@"; else echo "[dry-run] $*"; fi; }
get() { grep -E "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2-; }

echo "== 1. 組み込み・検査・テスト（手元だけ）"
LIFF_ID="$(get LIFF_ID "$LINE_ENV" || true)" node scripts/use-product.mjs "$CFG"
if [ "$APPLY" = "--apply" ]; then node scripts/check.mjs config/survey.json --img public/img --deploy; else node scripts/check.mjs config/survey.json --img public/img || true; fi
npm test --silent >/dev/null && echo "テスト：通った"

echo "== 2. Vercel"
if npx --yes vercel@latest whoami >/dev/null 2>&1; then echo "Vercel：ログイン済み"; else echo "Vercel：ログインしていない → 人が npx vercel@latest login（ブラウザで許可）"; [ "$APPLY" = "--apply" ] && exit 3; fi
run npx --yes vercel@latest link --yes --project "$ID-line"

echo "== 3. 鍵（値は出さない）"
for K in LINE_CHANNEL_SECRET LINE_CHANNEL_ACCESS_TOKEN LIFF_ID; do V="$(get $K "$LINE_ENV" || true)"; echo "$K: ${#V}字"; [ -n "$V" ] && { if [ "$APPLY" = "--apply" ]; then printf %s "$V" | npx --yes vercel@latest env add "$K" production --force >/dev/null; else echo "[dry-run] vercel env add $K production（標準入力）"; fi; }; done
SHOP="$(get SHOP "$SHOP_ENV" || true)"; TOK="$(get SHOPIFY_TOKEN "$SHOP_ENV" || true)"; echo "SHOPIFY_SHOP: ${SHOP:-（無し）} ／ SHOPIFY_ADMIN_TOKEN: ${#TOK}字"
HAS_SALT=""; [ "$APPLY" = "--apply" ] && npx --yes vercel@latest env ls production 2>/dev/null | grep -q CODE_SALT && HAS_SALT=1
SALT=""; [ -z "$HAS_SALT" ] && SALT="$(openssl rand -hex 8)"
for P in "SHOPIFY_SHOP:$SHOP" "SHOPIFY_ADMIN_TOKEN:$TOK" "CODE_SALT:$SALT"; do K="${P%%:*}"; V="${P#*:}"; [ -n "$V" ] && { if [ "$APPLY" = "--apply" ]; then printf %s "$V" | npx --yes vercel@latest env add "$K" production --force >/dev/null; else echo "[dry-run] vercel env add $K production（標準入力）"; fi; }; done
echo "（CODE_SALT は初回だけ入れる。もう入っていれば触らない。入れ直すとクーポンのコードが変わる）"

echo "== 4. 出す"
run npx --yes vercel@latest deploy --prod --yes
if [ "$APPLY" = "--apply" ]; then curl -s "https://$ID-line.vercel.app/api/webhook" | grep -q ok && echo "受け口：ok"; else echo "[dry-run] curl https://$ID-line.vercel.app/api/webhook → ok を待つ"; fi
echo "次：node setup/line-api.mjs $ID webhook-set https://$ID-line.vercel.app/api/webhook --apply → webhook-test --apply"
