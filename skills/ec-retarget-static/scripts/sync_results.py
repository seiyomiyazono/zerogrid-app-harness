#!/usr/bin/env python3
"""口座の広告の数字（Meta の広告のコネクタが返した物をそのまま保存した JSON）から、リタゲの結果を見本に戻す所までを1回で通す。
使い方:
  python3 sync_results.py <口座の数字.json> --設計 <設計のフォルダ> --期間 "<いつからいつ>" [--記録 <フォルダ>]
      口座の数字.json: 広告ごと（level=ad）の name・adset_name・campaign_name・amount_spent・omni_purchase・omni_purchase_values。
                       コネクタの返事（{"ad_entities": …}）のままでも、広告の並びだけでもよい。次のページがある時は、ページごとのファイルを並べて渡す。
      <設計のフォルダ>/配信の条件.md を読む（templates/配信の条件.md を写して、配信を始める日に1回書く。オファーか相手を変えた日に書き直す）。
  道具がやる事:
      1 リタゲの広告と新規の広告を、配信の条件の「リタゲの印」（キャンペーンか広告セットの名前に入っている言葉）で分ける。「新規の印」の行があれば、新規はその言葉が入っている広告だけ
      2 新規の入口を、その期間に消化が大きい新規の広告の上から3本の名前で作る
      3 口座の広告の名前を、配信の条件の「広告と設計」の表で、設計の名前（か見本のファイル名）に読み替える
      4 samples.py record を呼んで、判定つきで _結果.tsv に書く
終了コード: 0=戻した / 1=入力か配信の条件が足りない / 2=リタゲの広告が0本（その期間に出ていない） / 3=ファイルが読めない・書けない・JSON や数字として読めない / 4=結びつく見本が0件"""
import sys, os, json, re, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
NEED = ["商品", "時期", "オファー", "相手", "リタゲの印"]
OPTIONAL = ["新規の印"]

def val(x):
    """数字を読む。空は0。読めない値は止める（黙って0にしない）"""
    if isinstance(x, dict): x = x.get("value")
    if x is None or str(x).strip() == "": return 0.0
    try: return float(str(x).replace(",", "").replace("円", "").strip())
    except ValueError: raise ValueError("数字として読めない値: %r" % (x,))

def load_ads(path):
    d = json.load(open(path, encoding="utf-8"))
    if isinstance(d, dict):
        for k in ("ad_entities", "data", "ads"):
            if k in d: d = d[k]; break
    if isinstance(d, str): d = json.loads(d)
    if not isinstance(d, list): raise ValueError("広告の並びが無い")
    return [a for a in d if isinstance(a, dict) and a.get("name")]

def read_cond(path):
    txt = open(path, encoding="utf-8").read()
    cond = {}; names = {}; part = ""
    for line in txt.splitlines():
        if line.startswith("## "): part = line[3:].strip(); continue
        c = [x.strip().strip("`") for x in line.strip().strip("|").split("|")]
        if not line.strip().startswith("|") or len(c) < 2 or set(c[0]) <= set("-: ") or c[1].startswith("<"): continue
        if part.startswith("広告と設計"):
            if c[0] not in ("口座の広告の名前",): names[c[0]] = c[1]
        elif c[0] in NEED + OPTIONAL: cond[c[0]] = c[1]
    return cond, names

def main():
    a = sys.argv[1:]; files = []; o = {}
    i = 0
    while i < len(a):
        if a[i].startswith("--"):
            if i + 1 >= len(a) or a[i + 1].startswith("--"): print("値が無い: %s" % a[i]); return 1
            o[a[i][2:]] = a[i + 1]; i += 2
        else: files.append(os.path.expanduser(a[i])); i += 1
    miss = [n for n in ("設計", "期間") if not o.get(n, "").strip()]
    if not files or miss: print(__doc__ if not files else "足りない: " + "・".join("--" + m for m in miss)); return 1
    ddir = os.path.expanduser(o["設計"]); cpath = os.path.join(ddir, "配信の条件.md")
    if not os.path.isfile(cpath): print("配信の条件が無い: %s（templates/配信の条件.md を写して書く）" % cpath); return 1
    try:
        cond, names = read_cond(cpath)
        ads = [x for f in files for x in load_ads(f)]
    except (OSError, ValueError) as e: print("読めない: %s" % e); return 3
    miss = [n for n in NEED if not cond.get(n)]
    if miss: print("配信の条件に足りない行: " + "・".join(miss)); return 1
    marks = [m.strip() for m in re.split(r"[、,]", cond["リタゲの印"]) if m.strip()]
    def has(x, ms): return any(m in (x.get("campaign_name") or "") or m in (x.get("adset_name") or "") for m in ms)
    nmarks = [m.strip() for m in re.split(r"[、,]", cond.get("新規の印", "")) if m.strip()]
    try:
        rt = [x for x in ads if has(x, marks) and val(x.get("amount_spent")) > 0]
        new = sorted([x for x in ads if not has(x, marks) and (not nmarks or has(x, nmarks))], key=lambda x: -val(x.get("amount_spent")))
        for x in rt: val(x.get("omni_purchase")); val(x.get("omni_purchase_values"))
    except ValueError as e: print("読めない: %s" % e); return 3
    if not rt: print("リタゲの広告が0本（印: %s。その期間に消化が無い）" % "・".join(marks)); return 2
    if not new: print("新規の広告が0本。口座の数字に、新規のキャンペーンの広告も入れて取り直す"); return 1
    entry = " ／ ".join("%s（%s・消化%d円）" % (x["name"], x.get("adset_name") or "", val(x.get("amount_spent"))) for x in new[:3])
    try:
        fd, tsv = tempfile.mkstemp(suffix=".tsv", prefix="_結果の下書き_", dir=ddir); os.close(fd)   # 商品フォルダの中に作る（外に書けない所でも回るように）
        with open(tsv, "w", encoding="utf-8") as f:
            f.write("広告セット\t広告の名前\t消化\t購入\t売上\n")
            for x in rt:
                f.write("%s\t%s\t%d\t%d\t%d\n" % (x.get("adset_name") or "", names.get(x["name"], x["name"]),
                        val(x.get("amount_spent")), val(x.get("omni_purchase")), val(x.get("omni_purchase_values"))))
    except OSError as e: print("書けない: %s" % e); return 3
    print("リタゲの広告 %d 本・新規の広告 %d 本。新規の入口: %s" % (len(rt), len(new), entry), flush=True)
    r = subprocess.run([sys.executable, os.path.join(HERE, "samples.py"), "record", tsv, "--商品", cond["商品"], "--設計", ddir,
                        "--期間", o["期間"], "--時期", cond["時期"], "--オファー", cond["オファー"], "--新規の入口", entry, "--相手", cond["相手"]] + (["--記録", o["記録"]] if o.get("記録") else []))
    os.remove(tsv)
    return r.returncode

if __name__ == "__main__":
    sys.exit(main())
