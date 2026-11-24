#!/usr/bin/env python3
"""見本の広告の絵を、型ごとに並べる・足す・結果で選ぶ・配信の結果を見本に戻す。
使い方:
  python3 samples.py pick <型の番号> --商品 <商品の名前> --時期 <通常|セール中>
      商品の名前は、商品フォルダの名前をそのまま使う（pick と record で1字でも違うと、同じ商品の結果として数えない）。
      その型から参考にする見本を1枚、配信の結果で選んで出す（選んだ事は _選んだ記録.tsv に残る）。
      勝った見本として出すのは、同じ商品・同じ時期で勝った見本だけ（リタゲの結果は、その前に出した新規の広告・オファー・時期で変わるため）。
      4回に1回と、同じ条件の勝ちが無い時は、試す見本を出す（その商品で使った回数の少ない物 → 他の商品か他の時期で勝った物 → 長く出ている日数の長い物）。同じ商品で負けた見本は出さない。
  python3 samples.py record <結果.tsv> --商品 <商品の名前> --設計 <設計のフォルダ> --期間 "<いつからいつ>" --時期 <通常|セール中> --オファー "<その期間のオファー>" --新規の入口 "<その期間に新規で消化が最大の広告の入口と飛び先>" --相手 "<リタゲの相手の決め方>"
      配信の結果を見本に戻す。結果.tsv の列は 広告セット・広告の名前・消化・購入・売上（タブ区切り・1行目は列の名前）。
      広告の名前は 設計_<広告の名前>.md と同じ名前。その設計の「参考」の見本に結果が付く。
      判定は広告セットごと: 勝ち＝購入3件以上で1件あたりが最も安い／負け＝購入0件で、勝ちの1件あたりの2倍以上を使った／それ以外は未定。
  pick と record に --記録 <フォルダ> を付けると、_結果.tsv と _選んだ記録.tsv をそのフォルダに書く（スキルのフォルダに書けない所で使う。読むのは、スキルに入っている記録と両方）。
  python3 samples.py list [型の番号]            その型の見本を、勝ち → 長く出ている → 未定 → 負け の順で出す（番号なしは全部の型の枚数）
  python3 samples.py add <型の番号> <絵のファイル> --店 <名前> --判定 <勝ち|長く出ている|未定|負け> --数字 "<消化・購入・ROAS か 日数>" --絵の作り "<写っている物>" --字 "<絵の字の原文>" --出どころ "<共有リンクか口座の名前>"
終了コード: 0=出来た / 1=入力が足りない・型や判定が決まりの外・絵でない / 2=選べる見本が0枚 / 3=一覧が読めない・書けない・列が足りない / 4=結びつく見本が0件"""
import sys, os, csv, shutil, re

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(HERE, "references", "見本")
INDEX = os.path.join(ROOT, "_一覧.tsv")
TYPES = {"1": "型1_急がせるオファー", "2": "型2_商品が主役", "3": "型3_保証", "4": "型4_最後の機会",
         "5": "型5_セットとおまけ", "6": "型6_レビューと証拠", "7": "型7_疑いへの答え"}
JUDGE = ["勝ち", "長く出ている", "未定", "負け"]
COLS = ["型", "ファイル", "店", "判定", "数字", "絵の作り", "絵の字の原文", "出どころ"]
IMG = (".jpg", ".jpeg", ".png", ".webp")
RESULT = os.path.join(ROOT, "_結果.tsv")
PICKS = os.path.join(ROOT, "_選んだ記録.tsv")
RCOLS = ["記録した日", "期間", "商品", "時期", "オファー", "新規の入口", "相手", "広告セット", "広告の名前", "見本", "型", "消化", "購入", "売上", "勝ちとの比", "判定"]
SEASONS = ["通常", "セール中"]
PCOLS = ["選んだ日", "商品", "型", "見本", "選んだ理由"]
EXPLORE_EVERY = 4   # 何回に1回、結果の無い見本を選ぶか
WIN_MIN = 3         # 勝ちに要る購入の件数
LOSE_X = 2.0        # 勝ちの1件あたりの何倍を使って0件なら負けか

def load_tsv(path):
    if not os.path.isfile(path): return []
    with open(path, encoding="utf-8") as f: return list(csv.DictReader(f, delimiter="\t"))

def save_tsv(path, cols, rows):
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, delimiter="\t"); w.writeheader(); w.writerows(rows)

def num(x):
    try: return float(str(x).replace(",", "").replace("円", "").strip() or 0)
    except ValueError: return 0.0

def opts(rest):
    o = {}
    for i in range(0, len(rest) - 1, 2): o[rest[i].lstrip("-")] = rest[i + 1]
    return o

def logs(o):
    """記録の置き場。--記録 <フォルダ> が有れば、書くのはそこ（スキルのフォルダに書けない所で使う）。読むのは、スキルに入っている記録と両方"""
    d = o.get("記録", "").strip()
    if not d: return RESULT, PICKS, [], []
    d = os.path.expanduser(d); os.makedirs(d, exist_ok=True)
    return os.path.join(d, "_結果.tsv"), os.path.join(d, "_選んだ記録.tsv"), load_tsv(RESULT), load_tsv(PICKS)

def cmd_pick(args):
    if not args or args[0] not in TYPES: print("型の番号は 1〜7"); return 1
    k = args[0]; o = opts(args[1:]); prod = o.get("商品", "").strip(); season = o.get("時期", "").strip()
    if not prod: print("足りない: --商品"); return 1
    if season not in SEASONS: print("--時期 は %s のどちらか" % "・".join(SEASONS)); return 1
    rows = [r for r in load() if r["型"] == k]
    rpath, ppath, seed_r, seed_p = logs(o)
    seen = {}                                   # 同じ商品・広告・期間の結果は1行に（スキルの記録と --記録 の両方にある時）
    for x in seed_r + load_tsv(rpath): seen[(x["商品"], x["広告の名前"], x["期間"])] = x
    results = list(seen.values()); mine_p = load_tsv(ppath); picks = seed_p + mine_p
    used = {}
    for p in picks:
        if p["商品"] == prod: used[p["見本"]] = used.get(p["見本"], 0) + 1
    same = [x for x in results if x["商品"] == prod and x.get("時期") == season]      # 同じ商品・同じ時期
    mine = [x for x in results if x["商品"] == prod]
    def cnt(rs, f, j): return sum(1 for x in rs if x["見本"] == f and x["判定"] == j)
    def ratio(f):
        v = [num(x["勝ちとの比"]) for x in same if x["見本"] == f and num(x["勝ちとの比"]) > 0]
        return sum(v) / len(v) if v else 9.0
    pool = [r for r in rows if r["判定"] != "負け" and not (cnt(mine, r["ファイル"], "負け") > 0 and cnt(mine, r["ファイル"], "勝ち") == 0)]
    if not pool: print("選べる見本が0枚（%s）。samples.py add で足す" % TYPES[k]); return 2
    proven = sorted([r for r in pool if cnt(same, r["ファイル"], "勝ち") > 0], key=lambda r: (-cnt(same, r["ファイル"], "勝ち"), ratio(r["ファイル"])))
    def elsewhere(r): return cnt(results, r["ファイル"], "勝ち") > 0
    fresh = sorted([r for r in pool if r not in proven], key=lambda r: (used.get(r["ファイル"], 0), 0 if elsewhere(r) else 1, 0 if r["判定"] == "長く出ている" else 1, -days(r)))
    n_before = sum(1 for p in picks if p["型"] == k and p["商品"] == prod)
    explore = bool(fresh) and (not proven or n_before % EXPLORE_EVERY == EXPLORE_EVERY - 1)
    if explore:
        r = fresh[0]
        why = "試す見本（この商品・この時期での勝ちが%s。この商品で使った回数 %d。%s%s）" % ("まだ無い" if not proven else "ある中の、4回に1回の試し", used.get(r["ファイル"], 0), "別の条件での勝ちあり・" if elsewhere(r) else "", r["数字"])
    else:
        r = proven[0]; why = "同じ商品・同じ時期（%s）で勝った見本（勝ち %d 回・勝ちとの比 %.2f）" % (season, cnt(same, r["ファイル"], "勝ち"), ratio(r["ファイル"]))
    try:
        import datetime
        mine_p.append({"選んだ日": datetime.date.today().isoformat(), "商品": prod, "型": k, "見本": r["ファイル"], "選んだ理由": why})
        save_tsv(ppath, PCOLS, mine_p)
    except OSError as e: print("書けない: %s" % e); return 3
    print(os.path.join(ROOT, TYPES[k], r["ファイル"])); print("理由: " + why); return 0

def cmd_record(args):
    if not args: print(__doc__); return 1
    src = os.path.expanduser(args[0]); o = opts(args[1:])
    miss = [n for n in ("商品", "設計", "期間", "時期", "オファー", "新規の入口", "相手") if not o.get(n, "").strip()]
    if miss: print("足りない: " + "・".join("--" + m for m in miss)); return 1
    if o["時期"] not in SEASONS: print("--時期 は %s のどちらか" % "・".join(SEASONS)); return 1
    if not os.path.isfile(src): print("結果のファイルが無い: %s" % src); return 3
    data = load_tsv(src); need = ["広告セット", "広告の名前", "消化", "購入", "売上"]
    if not data or any(c not in data[0] for c in need): print("結果.tsv の列が足りない（%s）" % "・".join(need)); return 1
    samples = {r["ファイル"]: r for r in load()}; ddir = os.path.expanduser(o["設計"])
    def sample_of(ad):
        p = os.path.join(ddir, "設計_%s.md" % ad)
        if os.path.isfile(p):
            m = re.search(r"^参考[:：][ \t]*(.*)$", open(p, encoding="utf-8").read(), re.M)
            if m:
                b = os.path.basename(m.group(1).strip().strip("`"))
                if b in samples: return b
        return ad if ad in samples else None
    best = {}
    for r in data:
        sp, pu = num(r["消化"]), num(r["購入"])
        if pu >= WIN_MIN: best[r["広告セット"]] = min(best.get(r["広告セット"], 1e18), sp / pu)   # 比べる相手は「勝ち」だけ。勝ちが無い広告セットは全部「未定」
    import datetime
    today = datetime.date.today().isoformat(); rpath = logs(o)[0]; results = load_tsv(rpath); added = 0; skipped = []
    for r in data:
        s = sample_of(r["広告の名前"])
        if not s: skipped.append(r["広告の名前"]); continue
        sp, pu = num(r["消化"]), num(r["購入"]); b = best.get(r["広告セット"])
        if b is None: j, ratio = "未定", ""
        elif pu >= WIN_MIN and sp / pu <= b * 1.0001: j, ratio = "勝ち", "1.00"
        elif pu == 0 and sp >= LOSE_X * b: j, ratio = "負け", ""
        else: j, ratio = "未定", ("%.2f" % ((sp / pu) / b) if pu >= 1 else "")
        results = [x for x in results if not (x["商品"] == o["商品"] and x["広告の名前"] == r["広告の名前"] and x["期間"] == o["期間"])]
        results.append({"記録した日": today, "期間": o["期間"], "商品": o["商品"], "時期": o["時期"], "オファー": o["オファー"], "新規の入口": o["新規の入口"], "相手": o["相手"], "広告セット": r["広告セット"], "広告の名前": r["広告の名前"], "見本": s, "型": samples[s]["型"],
                        "消化": "%d" % sp, "購入": "%d" % pu, "売上": "%d" % num(r["売上"]), "勝ちとの比": ratio, "判定": j}); added += 1
    if not added:
        print("結びつく見本が0件（広告の名前が 設計_<広告の名前>.md と合っていない）: %s" % "・".join(skipped[:5])); return 4
    try: save_tsv(rpath, RCOLS, results)
    except OSError as e: print("書けない: %s" % e); return 3
    print("結果を %d 件、見本に戻した。結びつかなかった広告 %d 件%s" % (added, len(skipped), ("（" + "・".join(skipped[:5]) + "）") if skipped else "")); return 0

def load():
    if not os.path.isfile(INDEX): return []
    with open(INDEX, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))

def save(rows):
    with open(INDEX, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, delimiter="\t"); w.writeheader(); w.writerows(rows)

def days(r):
    m = re.search(r"(\d+)\s*日", r.get("数字", "")); return int(m.group(1)) if m else 0

def cmd_list(args):
    rows = load()
    if not args:
        for k, name in TYPES.items():
            rs = [r for r in rows if r["型"] == k]
            print("%s: %d 枚（勝ち %d・長く出ている %d・未定 %d・負け %d）" % ((name, len(rs)) + tuple(sum(1 for r in rs if r["判定"] == j) for j in JUDGE)))
        return 0
    k = args[0]
    if k not in TYPES:
        print("型の番号は 1〜7: %s" % k); return 1
    rs = sorted([r for r in rows if r["型"] == k], key=lambda r: (JUDGE.index(r["判定"]) if r["判定"] in JUDGE else 9, -days(r)))
    print("%s: %d 枚" % (TYPES[k], len(rs)))
    for r in rs:
        mark = "（写さない例）" if r["判定"] == "負け" else ""
        print("- [%s]%s %s｜%s｜%s" % (r["判定"], mark, os.path.join(ROOT, TYPES[k], r["ファイル"]), r["店"], r["数字"]))
        print("    絵: %s" % r["絵の作り"][:120]); print("    字: %s" % r["絵の字の原文"][:120])
    return 0

def cmd_add(args):
    if len(args) < 2:
        print(__doc__); return 1
    k, src = args[0], os.path.expanduser(args[1]); opt = {}
    rest = args[2:]
    for i in range(0, len(rest) - 1, 2):
        opt[rest[i].lstrip("-")] = rest[i + 1]
    need = ["店", "判定", "数字", "絵の作り", "字", "出どころ"]
    miss = [n for n in need if not opt.get(n, "").strip()]
    if k not in TYPES: print("型の番号は 1〜7: %s" % k); return 1
    if miss: print("足りない: " + "・".join("--" + m for m in miss)); return 1
    if opt["判定"] not in JUDGE: print("判定は %s のどれか: %s" % ("・".join(JUDGE), opt["判定"])); return 1
    if not (os.path.isfile(src) and src.lower().endswith(IMG)): print("絵のファイル（jpg・png・webp）でない: %s" % src); return 1
    try:
        rows = load()
        d = os.path.join(ROOT, TYPES[k]); os.makedirs(d, exist_ok=True)
        name = os.path.basename(src)
        if any(r["ファイル"] == name for r in rows):
            print("同じ名前の見本がもうある: %s" % name); return 1
        shutil.copy2(src, os.path.join(d, name))
        rows.append({"型": k, "ファイル": name, "店": opt["店"], "判定": opt["判定"], "数字": opt["数字"], "絵の作り": opt["絵の作り"], "絵の字の原文": opt["字"], "出どころ": opt["出どころ"]})
        save(rows)
    except OSError as e:
        print("書けない: %s" % e); return 3
    print("足した: %s/%s（その型は %d 枚になった）" % (TYPES[k], name, sum(1 for r in rows if r["型"] == k))); return 0

def main():
    a = sys.argv[1:]
    cmds = {"list": cmd_list, "add": cmd_add, "pick": cmd_pick, "record": cmd_record}
    if not a or a[0] not in cmds:
        print(__doc__); return 1
    try:
        return cmds[a[0]](a[1:])
    except KeyError as e:
        print("一覧か記録の列が足りない: %s" % e); return 3
    except (OSError, csv.Error) as e:
        print("一覧が読めない: %s" % e); return 3

if __name__ == "__main__":
    sys.exit(main())
