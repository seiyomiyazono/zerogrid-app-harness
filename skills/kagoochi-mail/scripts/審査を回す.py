#!/usr/bin/env python3
"""4通を編集長の審査に出し、作業場に 審査_<回>.md を書く。部屋（team-room）は要らない（pdp-tsukuru の 審査を回す.py と同じ形）。

使い方: python3 審査を回す.py <作業場> [--待つ分 40] [--モデル opus]

出す前に道具が自分で確かめる物（通らなければ出さずに終了コード2）:
  - check.py の K1〜K5 が全部○（最終確認.md を書き直す）
  - 前の回から dist/・liquid/ が変わっていなければ出し直さない
  - 前の回が FAIL なら、直し_<前の回>.md に指摘の件数以上の行がある
審査のしかた: 書いた本人でない Claude（既定 Opus）を `claude -p` で1つ起こし、references/審査の決まり.md の「## 審査の決まり」で
  作業場の物を読ませる。読むだけ（Edit・Write・Bash・Agent を使わせない）。
終了コード: 0 PASS（指摘なし）／ 3 PASS だが書き方の指摘あり ／ 1 FAIL ／ 2 出せなかった
"""
import hashlib, json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
RULES = os.path.join(SKILL, "references", "審査の決まり.md")
sys.path.insert(0, HERE)
import check  # noqa: E402


def opt(argv, name, default):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default


def rules():
    t = open(RULES, encoding="utf-8").read()
    m = re.search(r"^## 審査の決まり\s*$(.*?)(?=^## |\Z)", t, re.M | re.S)
    return m.group(1).strip()


def last_round(work):
    rs = sorted(int(m.group(1)) for f in os.listdir(work) for m in [re.fullmatch(r"審査_(\d+)\.md", f)] if m)
    if not rs:
        return 0, None, 0, None
    t = open(os.path.join(work, f"審査_{rs[-1]}.md"), encoding="utf-8").read()
    fp = re.search(r"^指紋: (\w+)", t, re.M)
    return rs[-1], ("FAIL" if re.search(r"^判定: FAIL", t, re.M) else "PASS"), len(re.findall(r"^\d+\. ", t, re.M)), fp.group(1) if fp else None


def ask(work, n):
    S = json.load(open(os.path.join(work, "店の値.json"), encoding="utf-8"))
    facts = [os.path.expanduser(x) for x in (S.get("check") or {}).get("facts") or []]
    shots = sorted(f"shots/{f}" for f in os.listdir(os.path.join(work, "shots")) if f.endswith(".png"))
    prev = [f for f in (f"審査_{n - 1}.md", f"直し_{n - 1}.md") if os.path.exists(os.path.join(work, f))]
    reads = ["最終確認.md", "店の値.json", "dist/subjects.json"] + shots + ["dist/ref/ の参考4枚"] + [f"liquid/{k}.liquid" for k in check.MAILS] + prev
    return f"""あなたは編集長。カゴ落ちメール4通を作った本人ではない。{n} 回目の審査をする。
作業場（今いる所）: {work}
読む物（全部読む。画像は Read で開いて見る）: {"、".join(reads)}
画像は全部 Read で開く（shots/e1〜e4_390.png と dist/ref/ の4枚は必ず。開かずに出した判定は使われない）
店の事実の写し（作業場の外。Read で開く）: {"、".join(facts) or "なし（無ければ店の事実の行は FAIL）"}
型と段の名前: {SKILL}/SKILL.md の「4通の段」。参考の段の効果: {SKILL}/references/見本4通.md

## 審査の決まり
{rules()}

最後の行に、判定の JSON を1つだけ1行で書く（コードの囲みなし）。鍵は decision（PASS か FAIL）と reasons（直す所だけの文の配列。合っていた所は入れない）の2つだけ。本人にしか決められない事は reasons に入れず、本文に書く。"""


def pick_json(out):
    """審査役の答えから最後の {"decision": …} を、入れ子の括弧ごと拾う（2026-10-20 試しで、正規表現では5回中4回読めなかった）"""
    found = None
    for m in re.finditer(r'\{\s*"decision"', out):
        try:
            d, _ = json.JSONDecoder().raw_decode(out[m.start():])
            found = d
        except ValueError:
            continue
    return found


def reviewer(work, prompt, minutes, model):
    S = json.load(open(os.path.join(work, "店の値.json"), encoding="utf-8"))
    dirs = [SKILL]
    dirs += sorted({os.path.dirname(os.path.expanduser(x)) for x in (S.get("check") or {}).get("facts") or []})
    cmd = ["claude", "-p", prompt, "--model", model, "--output-format", "stream-json", "--verbose"]
    for d in dirs:
        cmd += ["--add-dir", d]
    cmd += ["--allowedTools", "Read", "Glob", "Grep", "--disallowedTools", "Edit", "Write", "NotebookEdit", "Bash", "Agent", "WebFetch", "WebSearch"]
    r = subprocess.run(cmd, cwd=work, capture_output=True, text=True, timeout=minutes * 60)
    out, opened = "", set()
    for line in r.stdout.splitlines():
        try:
            ev = json.loads(line)
        except ValueError:
            continue
        if ev.get("type") == "result":
            out = ev.get("result") or ""
        for c in ((ev.get("message") or {}).get("content") or []) if isinstance((ev.get("message") or {}).get("content"), list) else []:
            if c.get("type") == "tool_use" and c.get("name") == "Read":
                opened.add(os.path.realpath(os.path.join(work, (c.get("input") or {}).get("file_path", ""))))
    return r.returncode, out, opened, (r.stderr or "")[-600:]


def write(work, n, verdict, reasons, fp):
    head = [f"# 編集長の審査 {n}回目", "", "読む人: 4通を直す Claude。", "読む時: 直す前に全部。", "読まなくていい条件: なし。", "", f"指紋: {fp}", ""]
    if verdict == "FAIL":
        head += [f"判定: FAIL（{len(reasons)}件）。全部直し、直し_{n}.md に1件1行（どの通・どの段・何をどう変えたか）を書いてから、もう一度 `審査を回す.py`。回数の上限は無い。", ""]
    else:
        head += ["判定: PASS。" + (f"下の {len(reasons)} 件は書き方の指摘。直して check.py の K1〜K5 を通す。" if reasons else "直す所なし。"), ""]
    head += [f"{i}. {x}" for i, x in enumerate(reasons, 1)]
    open(os.path.join(work, f"審査_{n}.md"), "w", encoding="utf-8").write("\n".join(head) + "\n")


def main(argv):
    if len(argv) < 2:
        print(__doc__); return 2
    work = os.path.abspath(os.path.expanduser(argv[1])); minutes = int(opt(argv, "--待つ分", "40")); model = opt(argv, "--モデル", "opus")
    r = subprocess.run([sys.executable, os.path.join(HERE, "check.py"), work], capture_output=True, text=True, timeout=1800)
    if r.returncode == 2:
        print("check.py が動かない:", r.stderr.strip()[-400:]); return 2
    if any(re.match(r"K[1-5] ×", l) for l in r.stdout.splitlines()):
        print("K1〜K5 に × がある。審査には出さない。最終確認.md を見て直す"); return 2
    prev, prev_v, prev_n, prev_fp = last_round(work)
    fp = check.fingerprint(work); n = prev + 1
    if prev and prev_fp == fp:
        print(f"{prev}回目から dist/・liquid/ が変わっていない。出し直さない（審査_{prev}.md を直す）"); return 2
    if prev_v == "FAIL":
        fix = os.path.join(work, f"直し_{prev}.md")
        lines = sum(1 for l in open(fix, encoding="utf-8") if re.match(r"\s*(- |\d+\. )", l)) if os.path.exists(fix) else 0  # 1件1行は「- 」か「1. 」で書く
        if lines < prev_n:
            print(f"直し_{prev}.md の行が {lines}（指摘は {prev_n} 件）。1件1行書いてから出す"); return 2
    must = [os.path.realpath(os.path.join(work, "shots", f"{k}_390.png")) for k in ("e1", "e2", "e3", "e4")]
    must += [os.path.realpath(os.path.join(work, "dist", "ref", f)) for f in sorted(os.listdir(os.path.join(work, "dist", "ref")))]
    if len(must) < 8:
        print("dist/ref/ に参考の画像4枚がそろっていない。build.mjs を回し直す"); return 2
    # claude コマンドが使えない所では、同じ頼みを別の係（書いた本人でない Claude・人）に渡し、答えをファイルで受ける
    if "--頼みだけ" in argv:
        extra = "\n\n答えの JSON には \"opened\": [開いた画像の絶対パス…] も入れる。下の画像を全部開いてから判定する:\n" + "\n".join(must)
        open(os.path.join(work, f"審査_{n}_頼み.txt"), "w", encoding="utf-8").write(ask(work, n) + extra + "\n")
        print(f"頼みを書いた: {os.path.join(work, f'審査_{n}_頼み.txt')}。答えをファイルに受けて --答え <ファイル> で渡す"); return 0
    given = opt(argv, "--答え", "")
    for tryno in ((1,) if given else (1, 2)):  # 答えの形が読めない時は1回だけ頼み直す
        if given:
            full = open(os.path.expanduser(given), encoding="utf-8").read(); d = pick_json(full); code, err = 0, ""
            opened = {os.path.realpath(os.path.expanduser(x)) for x in ((d or {}).get("opened") or [])}
            open(os.path.join(work, f"審査_{n}_全文.txt"), "w", encoding="utf-8").write(full + "\n")
            if d and d.get("decision") in ("PASS", "FAIL"):
                break
            print("渡された答えから判定が読めなかった"); continue
        print(f"{n}回目を審査役（{model}）に出した（{tryno}回目の依頼）。判定を待つ（最大 {minutes} 分）")
        try:
            code, full, opened, err = reviewer(work, ask(work, n), minutes, model)
        except subprocess.TimeoutExpired:
            print(f"{minutes} 分の間に判定が出なかった。--待つ分 を延ばしてもう一度"); return 2
        open(os.path.join(work, f"審査_{n}_全文.txt"), "w", encoding="utf-8").write(full + "\n")  # 読めなくても全文は残す
        d = pick_json(full)
        if code == 0 and d and d.get("decision") in ("PASS", "FAIL"):
            break
        print(f"審査役の答えが読めなかった（終了コード {code}）。{err.strip()[-200:]}")
    else:
        print(f"2回とも判定が読めなかった。審査_{n}_全文.txt を見る"); return 2
    missed = [os.path.relpath(m, work) for m in must if m not in opened]
    if missed:
        print(f"審査役が画像を開かずに判定した（{' '.join(missed)}）。判定に使わない。もう一度走らせる"); return 2
    v, reasons = d["decision"], [str(x) for x in d.get("reasons") or []]
    full_p = os.path.join(work, f"審査_{n}_全文.txt")
    json.dump({"decision": v, "指紋": fp, "全文": hashlib.sha256(open(full_p, "rb").read()).hexdigest(), "開いた画像": len(must)},
              open(os.path.join(work, f"審査_{n}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    write(work, n, v, reasons, fp)
    if v == "FAIL":
        print(f"FAIL（{n}回目・{len(reasons)}件）。{os.path.join(work, f'審査_{n}.md')}"); return 1
    print(f"PASS（{n}回目）" + (f"。書き方の指摘 {len(reasons)} 件。直して出し直す（直すと指紋が変わるので、もう一度この道具）" if reasons else "")); return 3 if reasons else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
