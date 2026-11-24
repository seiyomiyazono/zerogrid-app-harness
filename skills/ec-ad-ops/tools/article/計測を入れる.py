# 記事にうちの計測（Clarity・Meta のピクセル・店へのリンクに広告の印を引き継ぐ）を入れる／入っているかを見る。
# 作った訳: 2026-11-18 ユルリングのロンチで、記事に計測が無いまま広告を出し、クリック449件・消化 7,114円の間、
#           広告を押した人が記事に着いたのか・記事から店へ押したのかが分からなかった（店の人間の訪問は1人）。
# 型は 計測/keisoku.js。記事のフォルダに keisoku.js を書き、index.html の </head> の前に読み込みの1行を入れる。
# 最終確認 C2（他社のタグが0）の grep は index.html だけを見るので、うちのタグは外のファイル keisoku.js に置く。
#
# 使い方
#   入れる : python3 計測を入れる.py <記事のフォルダ> --pixel <数字15〜16桁> --clarity <英数字10桁> --店 <店のドメイン>
#   見る   : python3 計測を入れる.py <記事のフォルダ> --検査
#   本番   : python3 計測を入れる.py <記事のフォルダ> --検査 --本番 <公開した記事のURL>
#   終了コード 0 通った / 1 落ちた
# 番号の出どころ
#   pixel  : その商品の Meta の広告セットの promoted_object.pixel_id（店の「お客様イベント」の Facebook & Instagram と同じ番号）
#   clarity: 店のページのソースの "clarity", "script", "<ここ>"（店と同じ project を使う。新しく作らない。_rules/計測.md）
#   店     : 記事のボタンが飛ぶ店のドメイン（例 yururing.shop）
import os, re, sys, urllib.error, urllib.request

読み込みの行 = '<script src="keisoku.js" defer></script>'
型 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "計測", "keisoku.js")


def 引数(名):
    return sys.argv[sys.argv.index(名) + 1] if 名 in sys.argv and sys.argv.index(名) + 1 < len(sys.argv) else None


def 番号を読む(js):
    def 取る(変数):
        m = re.search(r"var %s = '([^']*)';" % 変数, js)
        return m.group(1) if m else ""
    return 取る("PIXEL"), 取る("CLARITY"), 取る("店")


def 番号の検査(pixel, clarity, 店, 落ち):
    if not re.fullmatch(r"\d{15,16}", pixel or ""):
        落ち.append(f"ピクセルの番号が数字15〜16桁でない: 「{pixel}」")
    if not re.fullmatch(r"[a-z0-9]{10}", clarity or ""):
        落ち.append(f"Clarity の番号が英数字10桁でない: 「{clarity}」")
    if not re.fullmatch(r"[a-z0-9.-]+\.[a-z]{2,}", 店 or ""):
        落ち.append(f"店のドメインの形でない: 「{店}」")


def 取ってくる(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""


def 入れる(フォルダ):
    pixel, clarity, 店 = 引数("--pixel"), 引数("--clarity"), 引数("--店")
    落ち = []
    番号の検査(pixel, clarity, 店, 落ち)
    if 落ち:
        return 落ち
    js = open(型, encoding="utf-8").read()
    js = js.replace("__PIXEL__", pixel).replace("__CLARITY__", clarity).replace("__STORE__", 店)
    open(os.path.join(フォルダ, "keisoku.js"), "w", encoding="utf-8").write(js)
    p = os.path.join(フォルダ, "index.html")
    s = open(p, encoding="utf-8").read()
    if "keisoku.js" not in s:
        if s.count("</head>") != 1:
            return [f"index.html の </head> が {s.count('</head>')} 個（1個の時だけ入れる）"]
        open(p, "w", encoding="utf-8").write(s.replace("</head>", 読み込みの行 + "\n</head>"))
    print(f"入れた: {フォルダ}/keisoku.js（ピクセル {pixel}・Clarity {clarity}・店 {店}）と index.html の1行")
    return []


def 見る(フォルダ):
    落ち = []
    jp, ip = os.path.join(フォルダ, "keisoku.js"), os.path.join(フォルダ, "index.html")
    if not os.path.exists(jp):
        return ["keisoku.js が記事のフォルダに無い（`計測を入れる.py <記事のフォルダ> --pixel … --clarity … --店 …` で入れる）"]
    js = open(jp, encoding="utf-8").read()
    pixel, clarity, 店 = 番号を読む(js)
    番号の検査(pixel, clarity, 店, 落ち)
    for 印 in ("fbq('track', 'PageView')", "clarity.ms/tag/", "fbclid", "AdvToStore"):
        if 印 not in js:
            落ち.append(f"keisoku.js に「{印}」が無い（型 計測/keisoku.js から入れ直す）")
    s = open(ip, encoding="utf-8").read()
    数 = len(re.findall(r'<script[^>]*src="keisoku\.js"', s))
    if 数 != 1:
        落ち.append(f"index.html の keisoku.js の読み込みが {数} 行（1行にする）")
    本番 = 引数("--本番")
    if 本番:
        try:
            元 = 本番 if 本番.endswith("/") else 本番 + "/"
            状態, 頁 = 取ってくる(元)
            if 状態 != 200 or "keisoku.js" not in 頁:
                落ち.append(f"本番の記事に keisoku.js の読み込みが無い（{元} 状態 {状態}）")
            if 店 and 店 not in 頁:
                落ち.append(f"本番の記事に店（{店}）へのリンクが1本も無い")
            状態2, 本番js = 取ってくる(元 + "keisoku.js")
            if 状態2 != 200 or (pixel and pixel not in 本番js) or (clarity and clarity not in 本番js):
                落ち.append(f"本番の keisoku.js が開けないか、番号が手元と違う（{元}keisoku.js 状態 {状態2}）")
        except Exception as e:
            落ち.append(f"本番が読めない: {本番}（{e}）")
    if not 落ち:
        print(f"通った: ピクセル {pixel}・Clarity {clarity}・店 {店}" + (f"・本番 {本番}" if 本番 else ""))
    return 落ち


if __name__ == "__main__":
    if len(sys.argv) < 3 or not os.path.isdir(sys.argv[1]):
        print(__doc__ or "使い方: python3 計測を入れる.py <記事のフォルダ> --検査 | --pixel … --clarity … --店 …")
        sys.exit(1)
    落ち = 見る(sys.argv[1]) if "--検査" in sys.argv else 入れる(sys.argv[1])
    for x in 落ち:
        print("落ちた:", x)
    sys.exit(1 if 落ち else 0)
