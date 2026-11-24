#!/usr/bin/env python3
"""設計（設計_*.md）から、画像生成に渡す指示文を組む。絵に入る要素は、要素の表で4列目が「強める」の行だけ。
使い方: python3 make_prompt.py <設計_*.md> [--添付 "2枚目=実物の商品写真（…の形）" --添付 "3枚目=…"]
  1枚目の添付は、いつも参考の絵。2枚目からを --添付 で説明する。
終了コード: 0=指示文を出した / 1=設計に「強める」の行が無い・表が読めない / 3=ファイルが読めない"""
import sys, re

def main():
    a = sys.argv[1:]; extra = []
    while "--添付" in a:
        i = a.index("--添付")
        if i + 1 >= len(a): print(__doc__); return 1
        extra.append(a[i + 1]); del a[i:i + 2]
    if len(a) != 1: print(__doc__); return 1
    try: t = open(a[0], encoding="utf-8").read()
    except (OSError, UnicodeDecodeError) as e: print("読めない: %s" % e); return 3
    m = re.search(r"^## 要素の表.*$", t, re.M)
    if not m: print("「## 要素の表」の節が無い"); return 1
    sec = t[m.end():]; n = re.search(r"^## ", sec, re.M); sec = sec[:n.start()] if n else sec
    rows = []
    for line in sec.splitlines():
        if re.match(r"\|\s*\d+\s*\|", line):
            c = [x.strip() for x in re.split(r"(?<!\\)\|", line.strip().strip("|"))]
            if len(c) == 5 and c[3] == "強める": rows.append(c)
    if not rows: print("「強める」の行が無い"); return 1
    feel = re.search(r"^起こしたい気持ち[:：][ \t]*(.*)$", t, re.M)
    out = ["1枚目の添付の広告を、別の商品の日本語の広告として作り直す。1枚目と、並び・大きさの比・余白・字のかたまりの数・行数・書体と色の差を同じにする。変えるのは言葉と商品だけ。",
           "日本語の字は、下に書いたとおりに一字一句・句読点と語尾まで同じに描く。下に書いていない字・英語・ロゴ・透かしは描かない。かぎかっこの中の「／」は行の切れ目の印で、字としては描かない。",
           "画像は縦長。上下160画素は背景だけにして、字も物も置かない（後で 4:5 に切る）。",
           "添付: 1枚目=写す元の広告。" + "".join(" " + x + "。" for x in extra) + " 2枚目からの実物は、形・色・付属品を写真のとおりに描き、写真に無い部品を足さない。",
           "この絵で相手に起こしたい気持ち: " + (feel.group(1).strip() if feel else ""),
           "絵に入れる要素（これで全部。1枚目の広告にある物でも、ここに無い物は描かない）:"]
    for k, c in enumerate(rows, 1):
        out.append("%d. 1枚目のこの要素を写す: %s ／ それが相手に起こす気持ち: %s ／ この絵では: %s" % (k, c[1], c[2], c[4]))
    print("\n".join(out)); return 0

if __name__ == "__main__":
    sys.exit(main())
