"""LINE で出す画像に文字を入れる（元の店 tools/make_images.py の型をそのまま、色・文字・写真を survey.json から取る形にした物）。
型（元の店＝MYTREX 型）：写真を薄く敷く／白い額の中に明朝の大きな見出し・色の帯・短い一言／下の黒帯と右下の三角。
写真は gen/（images/gen.mjs で作った文字なしの写真）。ロゴは brand.logo（無ければ brand.wordmark を文字で置く）。
使い方: python3 images/make_images.py <survey.json> <gen フォルダ> <出力フォルダ> [--only 名前,名前]
  名前: r_<p>_<a>（結果）・w_<k>（不安の答え）・c_<k>（比べる）・coupon・hero・richmenu
"""
from PIL import Image, ImageDraw, ImageFont, ImageOps
import itertools, json, os, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
CFG, G, O = json.load(open(args[0])), args[1], args[2]
ONLY = set(sys.argv[sys.argv.index('--only') + 1].split(',')) if '--only' in sys.argv else None
os.makedirs(O, exist_ok=True)
T = CFG['brand']['theme']
hexrgb = lambda h: tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
INK, GOLD, BAND, BLUE, BLUE_T = hexrgb(T['ink']), hexrgb(T['frame']), hexrgb(T['band']), hexrgb(T['chart']), hexrgb(T['band_text'])
OTHER, BAR, CORNER, SOFT, PRIMARY = hexrgb(T['chart_other']), hexrgb(T['bar']), hexrgb(T['corner']), hexrgb(T['soft']), hexrgb(T['primary'])
f = lambda p, s, i=0: ImageFont.truetype(p, s, index=i)
MW6 = lambda s: f(T['font_heading'], s, T.get('font_heading_index', 0))
MW3 = lambda s: f(T['font_body'], s, T.get('font_body_index', 0))
LAT = lambda s: f(T['font_latin'], s)
W = 1040
LOGO = Image.open(CFG['brand']['logo']).convert('RGBA') if CFG['brand'].get('logo') else None

def want(name): return ONLY is None or name in ONLY

def photo(name, fade=0.55):
    im = ImageOps.fit(Image.open(f'{G}/{name}.png').convert('RGB'), (W, W), Image.LANCZOS)
    return Image.blend(im, Image.new('RGB', (W, W), 'white'), fade)

def center(d, y, text, font, fill=INK, spacing=0, width=W, x0=0):
    if spacing:
        ws = [d.textlength(ch, font=font) for ch in text]; tw = sum(ws) + spacing * (len(text) - 1); x = x0 + (width - tw) / 2
        for ch, w in zip(text, ws): d.text((x, y), ch, font=font, fill=fill); x += w + spacing
    else:
        tw = d.textlength(text, font=font); d.text((x0 + (width - tw) / 2, y), text, font=font, fill=fill)

def frame(im, top=120, bottom=W - 150):
    ov = Image.new('RGBA', (W, W), (0, 0, 0, 0)); o = ImageDraw.Draw(ov)
    o.rectangle((80, top, W - 80, bottom), fill=(255, 255, 255, 225)); im.paste(ov, (0, 0), ov); d = ImageDraw.Draw(im)
    d.rectangle((80, top, W - 80, bottom), outline=GOLD, width=2); d.rectangle((96, top + 16, W - 96, bottom - 16), outline=(40, 40, 40), width=1)
    return d

def logo(im, y=36, w=210, x=None):
    """ロゴがあれば貼る。無ければ wordmark を字間を空けて置く（元の店の小さな BRAND の代わり）"""
    if LOGO:
        lg = LOGO.resize((w, int(LOGO.height * w / LOGO.width)), Image.LANCZOS); im.paste(lg, ((W - w) // 2 if x is None else x, y), lg); return
    d = ImageDraw.Draw(im); t = CFG['brand']['wordmark']; fnt = LAT(26)
    if x is None: center(d, y + 6, t, fnt, fill=BLUE_T, spacing=6)
    else: d.text((x, y + 6), t, font=fnt, fill=BLUE_T)

def band(d, y, text):
    d.rectangle((150, y, W - 150, y + 70), fill=BAND)
    if text.isascii(): center(d, y + 16, text, LAT(38), fill=BLUE_T, spacing=10)
    else: center(d, y + 13, text, MW6(40), fill=BLUE_T, spacing=8)

def bar(im, text):
    d = ImageDraw.Draw(im); d.rectangle((0, W - 110, W, W), fill=BAR); center(d, W - 82, text, MW6(42), fill='white')
    d.polygon([(W - 90, W), (W, W - 90), (W, W)], fill=CORNER)

def card(bg, label, big, band_text, subs, bottom, out, bigfont=None, note=None, fade=0.4):
    im = photo(bg, fade); bf = bigfont or MW6(116)
    h = 84 + int(bf.size * 1.15) + 10 + 108 + 60 * len(subs) + (40 if note else 0)
    area_bottom = W - (110 if bottom else 0); top = max(110, (area_bottom - h) // 2 - 40); bot = top + h + 80
    d = frame(im, top, bot); logo(im, y=max(24, top - 80)); y = top + 50
    center(d, y, label, MW6(44)); y += 84
    center(d, y, big, bf); y += int(bf.size * 1.15) + 10
    band(d, y, band_text); y += 108
    for s_ in subs: center(d, y, s_, MW3(40)); y += 60
    if note: center(d, y - 6, note, MW3(22), fill=(90, 90, 90))
    if bottom: bar(im, bottom)
    im.save(f'{O}/{out}.jpg', quality=90)

def hero_card(bg, label, lines, subs, bottom, out):
    """写真を大きく見せて、上に文字（結果・入口の画像）"""
    im = ImageOps.fit(Image.open(f'{G}/{bg}.png').convert('RGB'), (W, W), Image.LANCZOS)
    ov = Image.new('RGBA', (W, W), (0, 0, 0, 0)); o = ImageDraw.Draw(ov)
    for i in range(470): o.line((0, i, W, i), fill=(255, 255, 255, int(235 * max(0, 1 - i / 470) ** 0.6)))
    im.paste(ov, (0, 0), ov); d = ImageDraw.Draw(im)
    logo(im, 40, 180, x=W - 230)
    d.rectangle((60, 60, 60 + d.textlength(label, font=MW6(34)) + 36, 116), outline=(60, 60, 60), width=2); d.text((78, 68), label, font=MW6(34), fill=INK)
    y = 150
    for ln in lines: d.text((60, y), ln, font=MW6(84), fill=INK); y += 108
    for s_ in subs:
        tw = d.textlength(s_, font=MW3(36)); d.rectangle((60, y + 4, 60 + tw + 28, y + 56), fill=(255, 255, 255)); d.text((74, y + 10), s_, font=MW3(36), fill=INK); y += 64
    if bottom: bar(im, bottom)
    im.save(f'{O}/{out}.jpg', quality=90)

def man(v): return f'{v // 10000}万' if v % 10000 == 0 else f'{v / 10000:.1f}万'

def chart(bg, title, per_year, ours, ours_label, basis, out):
    """3年分の棒グラフ（今の対策が毎年かかる vs うちは一度だけ）"""
    im = photo(bg, 0.82); d = ImageDraw.Draw(im); logo(im, 30, 180)
    center(d, 100, title, MW6(46)); center(d, 170, f'3年で {per_year * 3 - ours:,}円 の差', MW6(64), fill=BLUE_T)
    base, left, bw, gap = 800, 150, 110, 70; mx = max(per_year * 3, ours)
    for i, yr in enumerate([1, 2, 3]):
        x = left + i * (2 * bw + gap); h1 = int(460 * per_year * yr / mx); h2 = int(460 * ours / mx)
        d.rectangle((x, base - h1, x + bw, base), fill=OTHER); d.rectangle((x + bw, base - h2, x + 2 * bw, base), fill=BLUE)
        tx = man(per_year * yr); d.text((x + bw / 2 - d.textlength(tx, font=MW6(30)) / 2, base - h1 - 42), tx, font=MW6(30), fill=(90, 90, 90))
        to = man(ours); d.text((x + bw * 1.5 - d.textlength(to, font=MW6(30)) / 2, base - h2 - 42), to, font=MW6(30), fill=BLUE_T)
        t = f'{yr}年目'; d.text((x + bw - d.textlength(t, font=MW3(32)) / 2, base + 14), t, font=MW3(32), fill=INK)
    d.line((left - 20, base, W - 110, base), fill=(120, 120, 120), width=2)
    lab = title.replace('と比べると', '')
    d.rectangle((150, 890, 180, 916), fill=OTHER); d.text((190, 884), lab, font=MW3(30), fill=INK)
    d.rectangle((560, 890, 590, 916), fill=BLUE); d.text((600, 884), ours_label, font=MW3(30), fill=INK)
    center(d, 960, f'※購入費の一例（{basis}）', MW3(24), fill=(100, 100, 100))
    im.save(f'{O}/{out}.jpg', quality=90)

def single_chart(bg, label, total, ours, ours_label, basis, out):
    """1回の費用どうしを2本で比べる（元の店の しつけ教室）"""
    im = photo(bg, 0.82); d = ImageDraw.Draw(im); logo(im, 30, 180)
    center(d, 100, f'{label.split("（")[0]}と比べると', MW6(46)); center(d, 170, f'{total - ours:,}円 の差', MW6(64), fill=BLUE_T)
    base = 800; mx = max(total, ours)
    for i, (lab, v, col) in enumerate([(label, total, OTHER), (ours_label, ours, BLUE)]):
        x = 260 + i * 330; h = int(460 * v / mx); d.rectangle((x, base - h, x + 190, base), fill=col)
        t = f'{v:,}円'; d.text((x + 95 - d.textlength(t, font=MW6(34)) / 2, base - h - 48), t, font=MW6(34), fill=INK)
        d.text((x + 95 - d.textlength(lab, font=MW3(30)) / 2, base + 16), lab, font=MW3(30), fill=INK)
    d.line((200, base, W - 200, base), fill=(120, 120, 120), width=2)
    center(d, 960, f'※{basis}', MW3(24), fill=(100, 100, 100))
    im.save(f'{O}/{out}.jpg', quality=90)

def note_card(bg, c, out):
    """値段で勝たない対策の時：数字で比べず、違いを一言で（安い物を高く見せない）"""
    subs = [x for x in c['note'].replace('、違う', '。違う').split('。') if x][:3]
    card(bg, f"{c['label']}と比べると", c.get('big', 'ここが違います'), c.get('band', 'POINT'), subs, None, out, bigfont=MW6(96))

def richmenu(spec):
    Wm, Hm = CFG['richmenu']['size']; im = Image.new('RGB', (Wm, Hm), 'white')
    ph = ImageOps.fit(Image.open(f'{G}/hero.png').convert('RGB'), (1660, Hm), Image.LANCZOS, centering=tuple(spec.get('crop', [0.6, 0.5])))  # 写真のどこを見せるか（横, 縦。0〜1）
    ov = Image.new('RGBA', (1660, Hm), (0, 0, 0, 0)); o = ImageDraw.Draw(ov)
    for x in range(1100): o.line((x, 0, x, Hm), fill=(255, 255, 255, int(240 * max(0, 1 - x / 1100) ** 0.7)))
    ph.paste(ov, (0, 0), ov); im.paste(ph, (0, 0)); d = ImageDraw.Draw(im)
    d.text((110, 110), spec['lines'][0], font=MW6(120), fill=INK); d.text((110, 260), spec['lines'][1], font=MW6(120), fill=INK)
    tw = d.textlength(spec['band'], font=MW6(58)); d.rectangle((110, 450, max(900, 190 + tw), 540), fill=BAND); d.text((150, 468), spec['band'], font=MW6(58), fill=BLUE_T)
    d.text((110, 580), spec['sub'], font=MW3(52), fill=INK)
    d.rounded_rectangle((110, 668, 700, 770), radius=51, fill=BAR); t = spec['pill']; d.text((110 + (590 - d.textlength(t, font=MW6(52))) / 2, 690), t, font=MW6(52), fill='white')
    d.rectangle((1660, 0, Wm, Hm), fill=SOFT); d.line((1660, 0, 1660, Hm), fill=(220, 225, 232), width=4)
    rl = CFG['brand'].get('logo_right') or CFG['brand'].get('logo')
    if rl:
        kl = Image.open(rl).convert('RGBA'); lw = 470; kl = kl.resize((lw, int(kl.height * lw / kl.width)), Image.LANCZOS); im.paste(kl, (1660 + (840 - lw) // 2, 150), kl)
    else:
        center(d, 300, CFG['brand']['wordmark'], LAT(72), fill=PRIMARY, spacing=8, width=840, x0=1660)
    t = spec['right']; d.text((1660 + (840 - d.textlength(t, font=MW6(62))) / 2, 620), t, font=MW6(62), fill=PRIMARY)
    im.save(f'{O}/richmenu.png'); im.convert('RGB').save(f'{O}/richmenu.jpg', quality=88)  # LINE へは 1MB 以下の JPEG を上げる

def fillt(s, m):
    for k, v in m.items(): s = s.replace('{' + k + '}', v)
    return s

if __name__ == '__main__':
    C = CFG['images']['cards']; made = []
    if 'result' in C:
        R = C['result']; ks = R['keys']
        for combo in itertools.product(*[list(R['short'][k].keys()) for k in ks]):
            m = dict(zip(ks, combo)); out = fillt(R['out'], m)
            if not want(out) or not os.path.exists(f"{G}/{fillt(R['bg'], m)}.png"): continue
            lab = fillt(R['label'], {k: R['short'][k][m[k]][0] for k in ks})
            hero_card(fillt(R['bg'], m), lab, R['lines'], [R['short'][k][m[k]][1] for k in ks], R.get('bottom'), out); made.append(out)
    for k, w in C.get('worries', {}).items():
        out = f'w_{k}'
        if want(out) and os.path.exists(f'{G}/w_{k}.png'):
            card(f'w_{k}', w['q'], w.get('big', '大丈夫です'), w.get('band', '心配ないです'), w['subs'], None, out, bigfont=MW6(104), note=w.get('note')); made.append(out)
    ours = min(v[0] for v in CFG['offer']['prices'].values()); ours_label = f"{CFG['brand']['name'] if not CFG['brand']['name'].startswith('（') else 'このマット'}（一度だけ）"
    for k, c in CFG.get('compare', {}).get('costs', {}).items():
        out = f'c_{k}'
        if not want(out) or not os.path.exists(f'{G}/t_{k}.png'): continue
        if c['mode'] == 'chart': chart(f't_{k}', f"{c['label']}と比べると", c['per_year'], ours, ours_label, c['basis'], out)
        elif c['mode'] == 'single': single_chart(f't_{k}', c['label'], c['total'], ours, ours_label, c['basis'], out)
        else: note_card(f't_{k}', c, out)
        made.append(out)
    # 相性チェック（mode: fit_check）：結果の「合います」・不安の答えの見出し。理由と答えの文は Flex の文で出す（答えごとに画像を作らない）
    if 'fit' in C:
        c = C['fit']
        if want(c['out']) and os.path.exists(f"{G}/{c['bg']}.png"):
            card(c['bg'], c['label'], c['big'], c['band'], c['subs'], c.get('bottom'), c['out'], bigfont=MW6(150)); made.append(c['out'])
    for k, c in C.get('doubts', {}).items():
        if want(c['out']) and os.path.exists(f"{G}/{c['bg']}.png"):
            card(c['bg'], c['q'], c['big'], c.get('band', 'ANSWER'), c.get('subs', []), None, c['out'], bigfont=MW6(min(104, int(760 / max(1, len(c['big']))))), note=c.get('note')); made.append(c['out'])
    if 'coupon' in C and want('coupon') and os.path.exists(f'{G}/coupon.png'):
        c = C['coupon']; card('coupon', c['label'], c['big'], c['band'], c['subs'], c['bottom'], 'coupon', bigfont=MW6(112)); made.append('coupon')
    if 'hero' in C and want('hero') and os.path.exists(f'{G}/hero.png'):
        c = C['hero']; hero_card('hero', c['label'], c['lines'], c['subs'], c['bottom'], 'hero'); made.append('hero')
    if 'richmenu' in C and want('richmenu') and os.path.exists(f'{G}/hero.png'):
        richmenu(C['richmenu']); made.append('richmenu')
    print('作った:', ', '.join(made) or '（なし）')
