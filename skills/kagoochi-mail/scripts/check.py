#!/usr/bin/env python3
"""カゴ落ちメール4通の最終確認の箱を、機械で判定する。手で○を付けない。

使い方: python3 check.py <作業場> [--本番]   （<作業場>/店の値.json・dist/・liquid/ がある所。先に build.mjs）
  --本番: Shopify に載せる前（手順10）。K7 も見る
書く物: <作業場>/最終確認.md（箱ごとの○×と理由・指紋）・shots/<通>_390.png・_600.png・shots/4通_390.png（4通を横に並べた1枚）・rendered/（Liquid を見本のカートで描いた物）
終了コード: 0=全部○ / 1=×あり / 2=道具が動かない・作業場が足りない・組み直し忘れ（メールの出来のせいではない）

箱（SKILL.md の「合格の線」と同じ番号）:
  K1 段の並びが参考4本の型と同じ（data-dan の並び。外してよい段だけ外れてよい）・声は2通目3件・3通目3件・印は3つ
  K2 言えない言葉・空の型の残り・欄の抜けが0（共通の言葉＋check.ng。件名・前置き文・本文・Liquid・描いた Liquid。字の形をそろえて照らす）
  K3 390px と 600px で、1〜2文字落ち・はみ出し・切れ・読めない画像が0（dist の6枚と描いた Liquid）。2通目の声の写真は横3:縦2。ロゴと印の地が透けている。Liquid は1通50KB以内で描ける
  K4 割引は初めての客の枝（e3・e4）だけ（件名・前置き文も見る）。塗ってはいけない色（check.noFillColor）を色の欄に使っていない
  K5 声は店の表示と一字一句同じ（店のレビュー.tsv の「名前<TAB>本文」の組）。2通目の専門家は店と記事に出ている人（店の専門家.tsv）の名前・写真・言葉と同じ
  K6 編集長が PASS（審査を回す.py が書いた 審査_<回>.json の印と全文の指紋が合い、指紋が今のメールと同じ）
  K7（--本番だけ）Liquid に手元のファイル・.example の URL・見本の名前とコードが残っていない
"""
import hashlib, html as htmllib, json, os, re, subprocess, sys, unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
COMMON_NG = ["今だけ", "在庫わずか", "残りわずか", "先着", "最安", "No.1", "日本一", "絶対に治", "必ず治", "完治"]
HOLES = ["<<要入力>>", "undefined", "NaN", "[object"]
DISCOUNT = re.compile(r"円引き|%引き|引きコード|割引|OFF|クーポン|円お得|\d+%\s*オフ", re.I)  # 「引き出し」「引き締め」は拾わない

# 型の段の並び（build.mjs の data-dan と同じ名前）。末尾が ? の段は、店の値に無ければ外してよい
ORDER = {
    "e1": ["ロゴ帯", "主役の面", "絵", "相談", "リンク1", "リンク2", "配信停止", "大きいロゴ"],
    "e2": ["ブラウザで見る", "ロゴ帯", "場面の写真", "約束の見出し", "中身2行", "ボタン1", "肯定", "数字1文", "声のカード3枚",
           "権威の見出し?", "権威のカード1?", "権威のカード2?", "写真", "保証", "ボタン2", "注?", "ロゴと印3つ", "濃いリンク帯", "著作と住所"],
    "e3": ["ロゴ", "客の言葉の見出し", "割引", "カートの中身", "太いボタン1", "言葉だけでなく", "声のカード1", "声のカード2", "声のカード3",
           "太いボタン2", "選び直しの格子?", "濃い下の帯"],
    "e4": ["呼びかけ", "最後と言い切る", "失う物", "専用の割引と期限", "返信をうながす", "助けの一言", "文字のリンク", "お礼", "署名", "配信停止"],
}
ORDER["e3b"] = [d for d in ORDER["e3"] if d != "割引"]
ORDER["e4b"] = [d for d in ORDER["e4"] if d != "専用の割引と期限"]
MAILS = ["e1", "e2", "e3", "e3b", "e4", "e4b"]

JS = r"""async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
  window.scrollTo(0, 0);
  await Promise.all([...document.images].map(i => i.decode ? Promise.race([i.decode().catch(() => {}), new Promise(r => setTimeout(r, 3000))]) : null));
  await document.fonts.ready;
  const W = document.documentElement.clientWidth;
  const broken = [...document.images].filter(i => i.naturalWidth === 0 && getComputedStyle(i).display !== 'none').map(i => (i.currentSrc || i.src).slice(-60));
  const P = /[、。？！「」『』（）()・…\s!?／|]/;
  const orphans = [];
  for (const el of document.querySelectorAll('p,div,td,span,b,a')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!el.getBoundingClientRect().width || getComputedStyle(el).display === 'none') continue;
    if (el.closest('[style*="display:none"]')) continue;
    const chars = []; const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = walk.nextNode())) for (let i = 0; i < n.textContent.length; i++) {
      const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
      const b = rg.getClientRects()[0]; if (b && b.width) chars.push([n.textContent[i], b.left, b.top]);
    }
    if (chars.length < 6) continue;
    // 行は「次の字が左に戻って下に下がった所」で分ける。<br> で分けた行もそれぞれの行として見る
    const lines = [[]];
    for (let i = 0; i < chars.length; i++) { if (i && chars[i][1] < chars[i - 1][1] - 2 && chars[i][2] > chars[i - 1][2] + 2) lines.push([]); lines[lines.length - 1].push(chars[i]); }
    for (let k = 1; k < lines.length; k++) {
      // 前の行の右端が箱の右端まで来ている（折り返しで落ちた）時だけ数える。<br> で切った短い行は数えない
      const box = el.getBoundingClientRect(); const prev = lines[k - 1]; const right = prev[prev.length - 1][1];
      const wrapped = right > box.right - 40;
      const rest = lines[k].map(c => c[0]).filter(c => !P.test(c));
      const onlyPunct = rest.length === 0 && lines[k].length > 0 && lines[k].length <= 2 && k === lines.length - 1;
      const headPunct = /^[、。，．」』）)！？]/.test(lines[k].map(c => c[0]).join(''));  // 行頭に句読点・閉じ括弧（試し5回目で審査だけが見つけた）
      if (headPunct) orphans.push(prev.map(c => c[0]).join('').slice(-14) + '｜' + lines[k].map(c => c[0]).join(''));
      else if (wrapped && (onlyPunct || (rest.length > 0 && rest.length <= 2))) orphans.push(prev.map(c => c[0]).join('').slice(-14) + '｜' + lines[k].map(c => c[0]).join(''));
    }
  }
  const clipped = [...document.querySelectorAll('div,span,b,a,p,td')].filter(e => {
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return false;
    const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false;
    const r = e.getBoundingClientRect(); if (!r.width) return false;
    return r.right > W + 2;
  }).slice(0, 5).map(e => e.textContent.trim().slice(0, 24));
  const voiceImgs = [...document.querySelectorAll('[data-dan="e2-声のカード3枚"] img')].filter(i => i.naturalWidth).map(i => +(i.naturalWidth / i.naturalHeight).toFixed(2));
  return {voiceImgs, scrollW: document.documentElement.scrollWidth, W, broken, orphans: [...new Set(orphans)], clipped};
}"""

def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def norm(t):
    """照らす前に字の形をそろえる（HTML の字の書き方を戻し、全角を半角に、空白を詰める）"""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", htmllib.unescape(t)))


def text_of(h):
    t = re.sub(r"<style.*?</style>", "", h, flags=re.S)
    t = re.sub(r"\{%.*?%\}", "", t, flags=re.S)
    t = re.sub(r"<[^>]+>", "", t)
    return norm(t)


def rendered(work):
    d = os.path.join(work, "rendered")
    return sorted(os.path.join(d, f) for f in os.listdir(d) if f.endswith(".html")) if os.path.isdir(d) else []


def fingerprint(work):
    h = hashlib.sha256()
    for k in MAILS:
        for sub, ext in (("dist", ".html"), ("liquid", ".liquid")):
            p = os.path.join(work, sub, k + ext)
            h.update((k + ext).encode()); h.update(open(p, "rb").read())
    h.update(open(os.path.join(work, "dist", "subjects.json"), "rb").read())
    return h.hexdigest()[:16]


def k1(work, S):
    bad = []
    for k in MAILS:
        got = [d.split("-", 1)[1] for d in re.findall(r'data-dan="([^"]+)"', read(os.path.join(work, "dist", k + ".html")))]
        want = ORDER[k]
        need = [d for d in want if not d.endswith("?")]
        allowed = [d.rstrip("?") for d in want]
        if [d for d in got if d in need] != need:
            bad.append(f"{k}: 要る段が欠けた／順が違う（出た並び {' → '.join(got)}）")
        elif [d for d in allowed if d in got] != got:
            bad.append(f"{k}: 型に無い段か順の違い（{' → '.join(got)}）")
    for sec, n in (("e2", 3), ("e3", 3)):
        if len(S[sec].get("voices") or []) != n: bad.append(f"{sec}.voices が {len(S[sec].get('voices') or [])} 件（{n} 件にする）")
    if len(S["e2"].get("badges") or []) != 3: bad.append("e2.badges が3つでない")
    return (not bad), "；".join(bad) or "6通とも型の並び・声3件ずつ・印3つ"


def k2(work, S):
    ng = COMMON_NG + list((S.get("check") or {}).get("ng") or [])
    subs = json.loads(read(os.path.join(work, "dist", "subjects.json")))
    hits = []
    for k in MAILS:
        t = text_of(read(os.path.join(work, "dist", k + ".html"))) + text_of(read(os.path.join(work, "liquid", k + ".liquid"))) + norm(subs[k]["subject"] + subs[k]["preheader"])
        hits += [f"{k}:{w}" for w in ng + HOLES if norm(w) in t]
    for p in rendered(work):
        t = text_of(read(p))
        hits += [f"{os.path.basename(p)}:{w}" for w in ng + HOLES if norm(w) in t]
    raw = json.dumps(S, ensure_ascii=False)
    if "<<要入力>>" in raw: hits.append("店の値.json に <<要入力>> が残っている")
    return (not hits), ("出た: " + "、".join(sorted(set(hits)))) if hits else f"{len(ng)}語と空の型の残り・欄の抜けが0"


def k3(work, S):
    bad = []
    big = [k for k in MAILS if os.path.getsize(os.path.join(work, "liquid", k + ".liquid")) > 50_000]
    if big: bad.append(f"Liquid が 50KB を超えた（カスタム Liquid の段の上限）: {' '.join(big)}")
    r = subprocess.run(["node", os.path.join(HERE, "liquid描く.mjs"), work], capture_output=True, text=True, timeout=300)
    if r.returncode == 2: raise RuntimeError("liquid描く.mjs が動かない: " + r.stderr.strip()[-300:])
    if r.returncode == 1: bad += [f"Liquid: {l}" for l in r.stderr.strip().splitlines()]
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise RuntimeError("道具が無い: pip install playwright")
    pages = [(k, os.path.join(work, "dist", k + ".html"), True) for k in MAILS] + [(os.path.basename(p)[:-5], p, False) for p in rendered(work) if p.endswith("_a.html")]
    with sync_playwright() as pw:
        try:
            b = pw.chromium.launch(headless=True, executable_path=__import__("os").environ.get("HONE_CHROMIUM") or None)
        except Exception as e:
            raise RuntimeError(f"Chromium が立たない: {e} → python3 -m playwright install chromium")
        for w in (390, 600):
            for k, path, shot in pages:
                pg = b.new_page(viewport={"width": w, "height": 900})
                pg.goto("file://" + path, wait_until="load", timeout=30000)
                r = pg.evaluate(JS)
                if r["scrollW"] > r["W"] + 1: bad.append(f"{k}@{w}: 横にはみ出し（{r['scrollW']}px）")
                bad += [f"{k}@{w}: 1〜2文字落ち「{o}」" for o in r["orphans"]]
                bad += [f"{k}@{w}: 切れ「{c}」" for c in r["clipped"]]
                bad += [f"{k}@{w}: 読めない画像 {x}" for x in r["broken"]]
                if w == 600 and k == "e2":
                    bad += [f"e2: 声の写真の形が横3:縦2でない（{q}）" for q in r["voiceImgs"] if not 1.45 <= q <= 1.55]
                if shot:
                    os.makedirs(os.path.join(work, "shots"), exist_ok=True)
                    pg.screenshot(path=os.path.join(work, "shots", f"{k}_{w}.png"), full_page=True)  # 審査役と本人が見る画像
                pg.close()
        b.close()
    four(work)  # 本人に見せる並べ画像は、毎回いまの4通で作り直す
    bad += clear_ground(work, S)
    return (not bad), "；".join(bad[:14]) or "390px と 600px で0・Liquid も描けた・ロゴと印の地が透けている"


def four(work):
    """shots/4通_390.png: 1〜4通目（初めての客の枝）の 390px を横に並べた1枚（手順9で本人に送る）"""
    from PIL import Image, ImageDraw, ImageFont
    ims = [Image.open(os.path.join(work, "shots", f"{k}_390.png")).convert("RGB") for k in ("e1", "e2", "e3", "e4")]
    gap, top = 24, 50
    c = Image.new("RGB", (390 * 4 + gap * 5, max(i.height for i in ims) + top + gap), "#eeeeee"); d = ImageDraw.Draw(c)
    try:
        f = ImageFont.truetype("/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc", 26)
    except Exception:
        f = ImageFont.load_default()
    for n, (im, t) in enumerate(zip(ims, ["1通目 30〜60分後", "2通目 24時間後", "3通目 48時間後", "4通目 72時間後"])):
        x = gap + n * (390 + gap); c.paste(im, (x, top)); d.text((x, 12), t, fill="#333", font=f)
    c.save(os.path.join(work, "shots", "4通_390.png"))


def clear_ground(work, S):
    """ロゴ・保証の絵・印3つは、地を透かした画像（四隅が透明）でないと帯の上に白い四角が浮く（試しと審査で3回落ちた）"""
    import io, urllib.request
    try:
        from PIL import Image
    except ImportError:
        raise RuntimeError("道具が無い: pip install pillow")
    srcs = [("logo", S["logo"]), ("logoOnDark", S["logoOnDark"])] + [(f"e2.badges[{i}]", b["img"]) for i, b in enumerate(S["e2"]["badges"])]
    if S["e2"]["guarantee"].get("img"): srcs.append(("e2.guarantee.img", S["e2"]["guarantee"]["img"]))
    bad = []
    for name, src in srcs:
        try:
            if src.startswith("http"):
                data = urllib.request.urlopen(urllib.request.Request(src, headers={"User-Agent": "Mozilla/5.0"}), timeout=30).read()
            else:
                p = src[7:] if src.startswith("file://") else src
                data = open(p if os.path.isabs(p) else os.path.join(work, p), "rb").read()
            if data.lstrip()[:4] in (b"<svg", b"<?xm"):
                continue  # SVG は地を描かない限り透ける
            im = Image.open(io.BytesIO(data)).convert("RGBA")
        except Exception as e:
            raise RuntimeError(f"{name} の画像が読めない: {src[:60]} {e}")
        w, h = im.size
        if any(im.getpixel(c)[3] > 10 for c in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))):
            bad.append(f"{name} の地が透けていない（四隅が不透明）")
    return bad


def k4(work, S):
    code = S["e3"]["offer"]["code"]; c4 = S["sample"].get("code4", "")
    subs = json.loads(read(os.path.join(work, "dist", "subjects.json")))
    bad = []
    for k in MAILS:
        t = text_of(read(os.path.join(work, "dist", k + ".html"))) + norm(subs[k]["subject"] + subs[k]["preheader"])
        lq = read(os.path.join(work, "liquid", k + ".liquid"))
        has = bool(DISCOUNT.search(t)) or code in t or (c4 and c4 in t) or code in lq or "kagoochi.code4" in lq
        if k in ("e3", "e4") and not has: bad.append(f"{k}: 初めての客の枝に割引が無い")
        if k not in ("e3", "e4") and has: bad.append(f"{k}: 割引を出してはいけない通・枝に割引がある")
    nf = ((S.get("check") or {}).get("noFillColor") or "").lower()
    if nf and nf in [str(v).lower() for v in S["color"].values() if v and v != S["color"].get("ink")]:
        bad.append(f"塗ってはいけない色 {nf} を面の色に使っている")
    return (not bad), "；".join(bad) or "割引は e3・e4 だけ・塗らない色も守った"


def inside(work, p):
    return os.path.realpath(os.path.expanduser(p)).startswith(os.path.realpath(work) + os.sep)


def k5(work, S):
    src = (S.get("check") or {}).get("reviewsSource") or ""
    if not src or not inside(work, src):
        return False, f"check.reviewsSource が作業場の中の 店のレビュー.tsv でない（今: {src or '空'}）"
    p = os.path.expanduser(src)
    if not os.path.exists(p):
        return False, f"reviewsSource が無い: {p}"
    pairs = {}
    for l in read(p).splitlines():
        if not l.strip() or l.startswith("#") or "\t" not in l: continue
        who, body = l.split("\t")[:2]  # 3列目（★の数）は照らさない
        pairs.setdefault(norm(re.sub(r"さん$", "", who.strip())), set()).add(norm(re.sub(r"<[^>]+>", "", body)))
    if not pairs:
        return False, "店のレビュー.tsv に「名前<TAB>本文」の行が無い"
    bad = []
    for sec in ("e2", "e3"):
        for v in S[sec]["voices"]:
            who = norm(re.sub(r"さん$", "", re.sub(r"<[^>]+>", "", v["who"]).strip()))
            body = norm(re.sub(r"<[^>]+>", "", v["body"]))
            if who not in pairs: bad.append(f"{sec}:{v['who']} の名前が店の表示に無い")
            elif body not in pairs[who]: bad.append(f"{sec}:{v['who']} の本文が、店の表示のこの人の本文と同じでない（「{v['body'][:16]}…」）")
            # 太字の一言は本文の言い換え: 一言の漢字のかたまり・2字以上のカタカナが本文に出たら×（2026-10-20 審査で2回続けて落ちた）
            rep = [w for w in re.findall(r"[一-龥々]+|[ァ-ヶー]{2,}", norm(v.get("head", ""))) if w in body]
            if rep: bad.append(f"{sec}:{v['who']} の太字の一言が本文と同じ言葉（{'・'.join(rep)}）")
    # 2通目の専門家のカードは、店と記事に出ている人（店の専門家.tsv）の名前・写真・言葉と同じ（どの商品でも、出ている人だけを使う）
    A = S["e2"].get("authority")
    if A:
        es = (S.get("check") or {}).get("expertsSource") or ""
        if not es or not inside(work, es) or not os.path.exists(os.path.expanduser(es)):
            bad.append(f"e2.authority があるのに check.expertsSource が作業場の中の 店の専門家.tsv でない（今: {es or '空'}）")
        else:
            people = []
            for l in read(os.path.expanduser(es)).splitlines():
                c = l.split("\t")
                if l.startswith("#") or len(c) < 4: continue
                people.append((norm(c[0]), c[2].strip(), norm(re.sub(r"<[^>]+>", "", c[3]))))
            if not people: bad.append("店の専門家.tsv に「名前<TAB>肩書き<TAB>写真<TAB>言葉」の行が無い")
            for i, cd in enumerate(A.get("cards") or []):
                src, body = norm(re.sub(r"<[^>]+>", "", cd.get("src", ""))), norm(re.sub(r"<[^>]+>", "", cd.get("body", "")))
                mine = [p for p in people if p[0] and p[0] in src]
                if not mine: bad.append(f"e2 専門家{i + 1}「{cd.get('src', '')[:16]}」が店と記事に出ている人（店の専門家.tsv）に無い"); continue
                if cd.get("img") not in {p[1] for p in mine}: bad.append(f"e2 専門家{i + 1} の写真が 店の専門家.tsv の写真と違う")
                if body not in {p[2] for p in mine}: bad.append(f"e2 専門家{i + 1} の本文が、その人の出どころの言葉と同じでない")
                rep = [w for w in re.findall(r"[一-龥々]+|[ァ-ヶー]{2,}", norm(re.sub(r"<[^>]+>", "", cd.get("head", "")))) if w in body]
                if rep: bad.append(f"e2 専門家{i + 1} の太字の一言が本文と同じ言葉（{'・'.join(rep)}）")
    # 3通目の見出し（かぎ括弧の客の言葉）も、店のレビューのどれかの本文の中にそのまま有る（2026-10-20 審査: 記事の人の声を見出しにしていた）
    hl = norm(re.sub(r"<[^>]+>", "", S["e3"]["headline"])).strip("「」")
    if not any(hl in b for bs in pairs.values() for b in bs):
        bad.append(f"e3.headline「{hl[:20]}…」が店のレビューのどの本文にも無い")
    return (not bad), "；".join(bad) or "声6件・3通目の見出し・専門家が店と記事の表示と同じ"


def k6(work, S, fp):
    rounds = sorted(int(m.group(1)) for f in os.listdir(work) for m in [re.fullmatch(r"審査_(\d+)\.md", f)] if m)
    if not rounds:
        return False, "まだ審査に出していない（scripts/審査を回す.py）"
    n = rounds[-1]
    sig, full = os.path.join(work, f"審査_{n}.json"), os.path.join(work, f"審査_{n}_全文.txt")
    if not (os.path.exists(sig) and os.path.exists(full)):
        return False, f"審査_{n} の印（.json）か全文（_全文.txt）が無い。審査を回す.py が書いた物でない"
    j = json.loads(read(sig))
    if j.get("全文") != hashlib.sha256(open(full, "rb").read()).hexdigest() or not re.search(r'"decision"\s*:\s*"' + j.get("decision", "?") + '"', read(full)):
        return False, f"審査_{n}.json の印が全文と合わない"
    if j.get("decision") != "PASS":
        return False, f"審査_{n} が FAIL"
    if j.get("指紋") != fp:
        return False, f"審査_{n} の後にメールが変わった（審査の指紋 {j.get('指紋')}・今 {fp}）。出し直す"
    return True, f"審査_{n} が PASS・印と指紋が合う"


def k7(work, S):
    bad = []
    sample = [S["sample"].get("name", ""), S["sample"].get("code4", "")]
    for k in MAILS:
        lq = read(os.path.join(work, "liquid", k + ".liquid"))
        for m in re.findall(r'(?:src|href)="([^"]+)"', lq):
            if m.startswith(("file:", "/")) or ".example" in m or not m.startswith(("http", "mailto:", "{{", "#")):
                bad.append(f"{k}: 手元か仮の URL {m[:50]}")
        bad += [f"{k}: 見本の値「{x}」が残った" for x in sample if x and x in lq]
    return (not bad), "；".join(sorted(set(bad))[:10]) or "手元・仮の URL と見本の値が0"


def main(argv):
    if len(argv) < 2:
        print(__doc__); return 2
    work = os.path.abspath(os.path.expanduser(argv[1])); prod = "--本番" in argv
    try:
        jp = os.path.join(work, "店の値.json")
        S = json.loads(read(jp))
        subs = json.loads(read(os.path.join(work, "dist", "subjects.json")))
        for k in MAILS:
            read(os.path.join(work, "dist", k + ".html")); read(os.path.join(work, "liquid", k + ".liquid"))
        fp = fingerprint(work)
    except Exception as e:
        print(f"作業場が足りない（先に node build.mjs <作業場>/店の値.json）: {e}", file=sys.stderr); return 2
    if subs.get("_src") != hashlib.sha256(open(jp, "rb").read()).hexdigest()[:16]:
        print("店の値.json が組んだ後に変わっている。node build.mjs で組み直してから回す", file=sys.stderr); return 2
    rows = []
    for name, fn in (("K1", k1), ("K2", k2), ("K3", k3), ("K4", k4), ("K5", k5)):
        try:
            ok, why = fn(work, S)
        except Exception as e:
            print(f"{name} を判定できない: {e}", file=sys.stderr); return 2
        rows.append((name, ok, why))
    rows.append(("K6",) + k6(work, S, fp))
    rows.append(("K7",) + k7(work, S) if prod else ("K7", True, "本番前でないので見ていない（手順10で --本番）"))
    out = ["# カゴ落ちメール 最終確認", "", "読む人: 4通を作った Claude と編集長。", "読む時: 審査に出す前と、本人に見せる前。", "読まなくていい条件: なし。", "",
           f"指紋: {fp}", "", "| 箱 | 判定 | 理由 |", "|---|---|---|"]
    out += [f"| {n} | {'○' if ok else '×'} | {why.replace('|', '／')} |" for n, ok, why in rows]
    open(os.path.join(work, "最終確認.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
    for n, ok, why in rows:
        print(f"{n} {'○' if ok else '×'} {why}")
    return 0 if all(ok for _, ok, _ in rows) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
