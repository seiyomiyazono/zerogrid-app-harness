#!/usr/bin/env python3
"""リタゲの静止画の設計（設計_*.md）と生成の記録を検査する。
使い方: python3 check_plan.py <設計のフォルダ> [--納品前]
  <設計のフォルダ> には、その商品のリタゲの設計を全部置く（前の回の分も。疑いの重なりを比べるため）。
  --納品前 を付けると、同じフォルダの 生成の記録.md も要る。
終了コード: 0=全部通った / 1=落ちた行がある / 2=設計が0枚（まだ書いていない） / 3=道具が動かせない（フォルダが無い・ファイルが読めない）"""
import sys, os, re, glob

NEED = ["相手", "新規で聞いた事", "今の気持ち", "疑い", "疑いの出どころ", "起こしたい気持ち", "消す事実", "参考", "参考の数字"]
MIN_ROWS = 6
EMPTY = {"", "-", "—", "ー", "?", "？", "tbd", "なし", "未定", "同上"}
IMG = (".jpg", ".jpeg", ".png", ".webp")
SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def empty(x):
    x = x.strip().strip("`").strip()
    return x.lower() in EMPTY or x.startswith("<")

def section(t, head):
    m = re.search(r"^## %s.*$" % re.escape(head), t, re.M)
    if not m: return None
    rest = t[m.end():]
    n = re.search(r"^## ", rest, re.M)
    return rest[:n.start()] if n else rest

def table(sec, ncol):
    """最初の表だけを読む。返すのは (行の一覧, 落ちた理由の一覧)"""
    rows, bad, seen_head, started = [], [], False, False
    for line in sec.splitlines():
        if not line.strip().startswith("|"):
            if started: break
            continue
        started = True
        body = line.strip().strip("|")
        if "---" in body and set(body.replace("|", "").strip()) <= set("-: "):
            continue
        c = [x.strip() for x in re.split(r"(?<!\\)\|", body)]
        if not seen_head:
            seen_head = True; continue
        if len(c) != ncol:
            bad.append("列が %d 個の行がある（%d 個要る）: %s" % (len(c), ncol, line.strip()[:40])); continue
        rows.append(c)
    return rows, bad

def norm(d):
    d = re.sub(r"[\s　、。・,.!！?？「」『』（）()…]", "", d)
    return re.sub(r"(のでは|のか|か)$", "", d)

def find_ref(ref, d):
    ref = ref.strip().strip("`").strip()
    cands = [ref, os.path.join(d, ref)] + glob.glob(os.path.join(SKILL, "references", "見本", "**", os.path.basename(ref)), recursive=True)
    for c in cands:
        c = os.path.expanduser(c)
        if os.path.isfile(c) and c.lower().endswith(IMG): return c
    return None

def is_loser(path):
    """見本の一覧で判定が「負け」の絵か"""
    idx = os.path.join(SKILL, "references", "見本", "_一覧.tsv")
    if not os.path.isfile(idx): return False
    name = os.path.basename(path)
    for line in open(idx, encoding="utf-8").read().splitlines()[1:]:
        c = line.split("\t")
        if len(c) >= 4 and c[1] == name and c[3] == "負け": return True
    return False

PICK_DIRS = []   # 設計のフォルダの1つ上（samples.py の --記録 の置き場）も見る

def was_picked(path):
    """見本が samples.py pick の記録（_選んだ記録.tsv）にあるか"""
    name = os.path.basename(path)
    for d in [os.path.join(SKILL, "references", "見本")] + PICK_DIRS:
        log = os.path.join(d, "_選んだ記録.tsv")
        if os.path.isfile(log) and any(len(c) >= 4 and c[3] == name for c in (l.split("\t") for l in open(log, encoding="utf-8").read().splitlines()[1:])): return True
    return False

def check_design(p, d, bad, doubts):
    n = os.path.basename(p)
    t = open(p, encoding="utf-8").read()
    f = {}
    for k in NEED:
        hits = re.findall(r"^%s[:：][ \t]*(.*)$" % re.escape(k), t, re.M)
        if not hits: bad.append("%s: 「%s:」の行が無い" % (n, k)); f[k] = ""
        elif len(hits) > 1: bad.append("%s: 「%s:」の行が %d つある（1つにする）" % (n, k, len(hits))); f[k] = hits[0]
        else:
            f[k] = hits[0]
            if empty(hits[0]): bad.append("%s: 「%s」が空" % (n, k))
    dv = f["疑い"].strip()
    if dv and not empty(dv):
        if re.search(r"[・／/]", dv): bad.append("%s: 疑いに2つ並んでいる（1枚に1つ）: 「%s」" % (n, dv))
        doubts.setdefault(norm(dv), []).append((n, dv))
    if f["参考"] and not empty(f["参考"]):
        rp = find_ref(f["参考"], d)
        if not rp: bad.append("%s: 参考の絵（jpg・png・webp のファイル）が見つからない: %s" % (n, f["参考"]))
        elif is_loser(rp): bad.append("%s: 参考が、見本の一覧で「負け」の絵（写さない例）: %s" % (n, f["参考"]))
        elif os.sep + "見本" + os.sep in rp and not was_picked(rp): bad.append("%s: 参考の見本が、選んだ記録に無い（samples.py pick が出した見本を使う）: %s" % (n, os.path.basename(rp)))
    sec = section(t, "要素の表")
    if sec is None: bad.append("%s: 「## 要素の表」の節が無い" % n)
    else:
        rows, b = table(sec, 5); bad += ["%s: 要素の表: %s" % (n, x) for x in b]
        if len(rows) < MIN_ROWS: bad.append("%s: 要素の表が %d 行（%d 行以上要る）" % (n, len(rows), MIN_ROWS))
        strong = 0
        for r in rows:
            if not re.fullmatch(r"\d+", r[0]): bad.append("%s: 要素の表の1列目が番号でない行がある: %s" % (n, r[0]))
            if any(empty(x) for x in (r[1], r[2], r[4])): bad.append("%s: 要素の表の %s 行目に空の欄がある" % (n, r[0]))
            if r[3] == "強める":
                strong += 1
                if r[4].strip() == "入れない": bad.append("%s: 要素の表の %s 行目は「強める」なのに、うちの要素が「入れない」" % (n, r[0]))
            elif r[3] == "強めない":
                if r[4].strip() != "入れない": bad.append("%s: 要素の表の %s 行目は「強めない」なので、うちの要素は「入れない」と書く（絵に入るのは「強める」の行だけ）" % (n, r[0]))
            else: bad.append("%s: 要素の表の %s 行目の4列目は「強める」か「強めない」: %s" % (n, r[0], r[3]))
        if strong < 4: bad.append("%s: 「強める」の行が %d 行（4行以上要る）" % (n, strong))
    fsec = section(t, "事実の出どころ")
    facts = ""
    if fsec is None: bad.append("%s: 「## 事実の出どころ」の節が無い" % n)
    else:
        rows, b = table(fsec, 2); bad += ["%s: 事実の出どころ: %s" % (n, x) for x in b]
        if not rows: bad.append("%s: 事実の出どころの表が0行" % n)
        for r in rows:
            if any(empty(x) for x in r): bad.append("%s: 事実の出どころに空の欄がある: %s" % (n, r[0][:20]))
        facts = fsec
    csec = section(t, "見出しと本文")
    if csec is None: bad.append("%s: 「## 見出しと本文」の節が無い" % n)
    else:
        for tok in set(re.findall(r"\d[\d,]*\s*(?:円|日間|日|％|%|個|点)", csec)):
            if re.sub(r"\s", "", tok) not in re.sub(r"\s", "", facts):
                bad.append("%s: 見出しと本文の「%s」が、事実の出どころの表に無い" % (n, tok))

def check_log(d, bad):
    p = os.path.join(d, "生成の記録.md")
    if not os.path.isfile(p):
        bad.append("生成の記録.md が無い（生成ごとに1行書く）"); return
    rows, b = table(open(p, encoding="utf-8").read(), 4); bad += ["生成の記録: %s" % x for x in b]
    if not rows: bad.append("生成の記録の表が0行")
    for r in rows:
        for label, cell in (("参考の絵", r[1]), ("実物の写真", r[2])):
            paths = [x.strip().strip("`") for x in re.split(r"[、,]|<br>", cell) if x.strip()]
            def there(x):   # 「skills:<スキルの中の道>」は、スキルを並べたフォルダから探す
                return os.path.isfile(os.path.join(os.path.dirname(SKILL), x[len("skills:"):]) if x.startswith("skills:") else os.path.expanduser(x))
            if not paths or not all(there(x) for x in paths):
                bad.append("生成の記録: %s の「%s」に、無いファイルか空がある" % (r[0][:30], label))
        if not re.search(r"\d+\s*[x×]\s*\d+", r[3]): bad.append("生成の記録: %s の「返った大きさ」が 幅x高さ の形でない" % r[0][:30])

def main():
    args = [a for a in sys.argv[1:] if a != "--納品前"]
    if len(args) != 1:
        print(__doc__); return 3
    d = args[0]
    if not os.path.isdir(d):
        print("フォルダが無い: %s" % d); return 3
    PICK_DIRS.append(os.path.dirname(os.path.abspath(d)))
    files = sorted(glob.glob(os.path.join(d, "設計_*.md")))
    stray = [os.path.basename(x) for x in glob.glob(os.path.join(d, "設計*.md")) if x not in files]
    if not files and not stray:
        print("設計が0枚: %s に 設計_<広告の名前>.md がまだ無い" % d); return 2
    bad, doubts = [], {}
    for s in stray: bad.append("名前が 設計_<広告の名前>.md の形でないファイルがある（見ていない）: %s" % s)
    for p in files:
        try: check_design(p, d, bad, doubts)
        except (UnicodeDecodeError, OSError) as e:
            print("読めない（UTF-8 で保存する）: %s: %s" % (p, e)); return 3
    for k, ns in doubts.items():
        if len(ns) > 1: bad.append("同じ疑いが %d 枚にある（枚ごとに別の疑い）: %s" % (len(ns), " / ".join("%s「%s」" % x for x in ns)))
    if "--納品前" in sys.argv: check_log(d, bad)
    print("設計 %d 枚を見た" % len(files))
    if bad:
        for b in bad: print("✗ " + b)
        print("落ちた %d 件" % len(bad)); return 1
    print("通った"); return 0

if __name__ == "__main__":
    sys.exit(main())
