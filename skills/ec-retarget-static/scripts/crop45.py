#!/usr/bin/env python3
"""生成した縦長の絵を 4:5（1080×1350）に切る。切る窓を上下に動かして、切る所と端に字か絵の輪郭が残らない位置を選ぶ。
使い方: python3 crop45.py <生成した絵.png> <出す絵.png> [--参考 <参考の絵>]
  --参考 を付けると、参考の絵の上下の余白の割合を測り、出す絵の上下の余白を同じ割合にする（縦を広げて、足りない横は左右の端の色で埋める）。
終了コード: 0=切れた・端は空 / 1=端か切る所に輪郭がある（出す絵は <名前>_要確認.png に書く） / 2=絵が開けない・大きさが足りない / 3=道具が動かせない（Pillow か numpy が無い・書き出せない）"""
import sys, os
try:
    from PIL import Image
    import numpy as np
except Exception as e:
    print("Pillow と numpy が要る（python3 に -I を付けずに動かす）: %s" % e); sys.exit(3)

EDGE = 24        # 切った後、上下の端から何画素を空けるか
LIMIT = 0.006    # その帯の中で、輪郭の画素がこの割合を超えたら落とす
DIFF = 60        # 隣の画素との色の差（RGBの合計）がこれを超えたら輪郭に数える
MIN_W = 1000     # これより幅の狭い絵は受け付けない

def edge_ratio(a):
    if a.shape[0] < 2 or a.shape[1] < 2: return 0.0
    a = a.astype(int)
    gx = np.abs(np.diff(a, axis=1)).sum(axis=2)[:-1, :]
    gy = np.abs(np.diff(a, axis=0)).sum(axis=2)[:, :-1]
    return float(((gx > DIFF) | (gy > DIFF)).mean())

def content_rows(a):
    """字か絵がある行の、最初と最後（行ごとの輪郭の割合が 1% を超える行）"""
    b = a.astype(int)
    gx = (np.abs(np.diff(b, axis=1)).sum(axis=2) > DIFF).mean(axis=1)
    rows = np.where(gx > 0.01)[0]
    return (int(rows[0]), int(rows[-1])) if len(rows) else (None, None)

def match_ref(a, ref_path):
    """参考と同じ上下の余白になる窓を返す。返すのは (切った絵, 説明) か (None, 理由)"""
    try:
        r = np.asarray(Image.open(ref_path).convert("RGB"))
    except Exception as e:
        return None, "参考の絵が開けない: %s" % e
    rt, rb = content_rows(r); ct, cb = content_rows(a)
    if rt is None or ct is None:
        return None, "字か絵のある行が見つからない"
    up, down = rt / r.shape[0], (r.shape[0] - 1 - rb) / r.shape[0]
    h, w = a.shape[0], a.shape[1]
    th = int(round((cb - ct) / (1 - up - down))); top = int(round(ct - up * th))
    if top < 0 or top + th > h:
        return None, "元の絵の上下が足りない（要る窓 %d〜%d、元の絵の高さ %d）。余白を広く取って生成し直す" % (top, top + th, h)
    w2 = int(round(th / 1.25)); c = a[top:top + th]
    if w2 > w:
        pad = (w2 - w + 1) // 2
        if max(edge_ratio(c[:, :8]), edge_ratio(c[:, -8:])) > LIMIT:
            return None, "左右の端に絵か字があるので、端の色で埋められない。余白を広く取って生成し直す"
        c = np.concatenate([np.repeat(c[:, :1], pad, axis=1), c, np.repeat(c[:, -1:], pad, axis=1)], axis=1)
        how = "左右を %d 画素ずつ端の色で埋めた" % pad
    elif w2 < w:
        # 中身が参考より縦に短い時: 横はそのまま、上の余白だけ参考と同じ割合にして 4:5 の窓を置く
        th = int(round(w * 1.25)); top = int(round(ct - up * th))
        top = max(top, cb + EDGE - th)            # 下の中身が端から EDGE 画素より内に入るまで、窓を下げる
        top = max(0, min(h - th, top))
        if cb > top + th - EDGE or ct < top + EDGE:
            return None, "上の余白を参考に合わせると、下の字か絵が切れる。余白を広く取って生成し直す"
        c = a[top:top + th]
        return c, "中身が参考より縦に短いので、上の余白だけ参考（上 %.1f%%）に合わせた。元の絵の %d〜%d 行を使い、横はそのまま" % (up * 100, top, top + th)
    else:
        how = "横はそのまま"
    return c, "参考の余白（上 %.1f%%・下 %.1f%%）に合わせた。元の絵の %d〜%d 行を使い、%s" % (up * 100, down * 100, top, top + th, how)

def main():
    argv = sys.argv[1:]; ref = None
    if "--参考" in argv:
        i = argv.index("--参考")
        if i + 1 >= len(argv):
            print(__doc__); return 3
        ref = argv[i + 1]; del argv[i:i + 2]
    if len(argv) != 2:
        print(__doc__); return 3
    src, dst = argv
    try:
        im = Image.open(src).convert("RGB")
    except Exception as e:
        print("絵が開けない: %s" % e); return 2
    w, h = im.size
    th = int(round(w * 1.25))
    if w < MIN_W or th > h:
        print("大きさが足りない（%dx%d）。縦長（aspect: portrait。1024×1536）で生成し直す" % (w, h)); return 2
    a = np.asarray(im)
    if ref:
        c, msg = match_ref(a, ref)
        if c is None:
            print("✗ 参考の余白に合わせられない: " + msg); return 1
        try:
            Image.fromarray(c).resize((1080, 1350), Image.LANCZOS).save(dst)
        except Exception as e:
            print("書き出せない: %s: %s" % (dst, e)); return 3
        print("元の絵 %dx%d → %s（1080x1350）。%s" % (w, h, dst, msg)); print("通った"); return 0
    def vals_at(top):
        return (("切る所の上", edge_ratio(a[:top])), ("切る所の下", edge_ratio(a[top + th:])),
                ("残した端の上", edge_ratio(a[top:top + EDGE])), ("残した端の下", edge_ratio(a[top + th - EDGE:top + th])))
    # 切る窓を上下に動かし、切る所と端の輪郭がいちばん少ない位置を選ぶ（絵が上か下に寄って出た時のため）
    top = min(range(0, h - th + 1, 8), key=lambda t: (max(v for _, v in vals_at(t)), abs(t - (h - th) // 2)))
    vals = vals_at(top)
    bad = [n for n, v in vals if v > LIMIT]
    out, crop, note = dst, a[top:top + th], ""
    if bad and all(n.startswith("残した端") for n in bad):
        # 切る所は空なのに端が近い時: 窓を縦に広げ、足りない横を左右の端の列で埋める（左右の端が無地の時だけ）
        for extra in range(32, h - th + 1, 16):
            t2 = max(0, min(h - th - extra, top - extra // 2)); th2 = th + extra
            w2 = int(round(th2 / 1.25)); pad = (w2 - w + 1) // 2
            sides = max(edge_ratio(a[t2:t2 + th2, :8]), edge_ratio(a[t2:t2 + th2, -8:]))
            v2 = (("切る所の上", edge_ratio(a[:t2])), ("切る所の下", edge_ratio(a[t2 + th2:])),
                  ("残した端の上", edge_ratio(a[t2:t2 + EDGE])), ("残した端の下", edge_ratio(a[t2 + th2 - EDGE:t2 + th2])), ("左右の端", sides))
            if all(v <= LIMIT for _, v in v2):
                c = a[t2:t2 + th2]
                crop = np.concatenate([np.repeat(c[:, :1], pad, axis=1), c, np.repeat(c[:, -1:], pad, axis=1)], axis=1)
                vals, bad, top, th = v2, [], t2, th2
                note = "（縦を %d 画素広げ、左右を %d 画素ずつ端の色で埋めた）" % (extra, pad)
                break
    if bad:
        base, ext = os.path.splitext(dst); out = base + "_要確認" + (ext or ".png")
    try:
        Image.fromarray(crop).resize((1080, 1350), Image.LANCZOS).save(out)
    except Exception as e:
        print("書き出せない: %s: %s" % (out, e)); return 3
    print("元の絵 %dx%d → %s（1080x1350。上 %d 画素・下 %d 画素を落とした）%s" % (w, h, out, top, h - th - top, note))
    print("輪郭の割合 " + " / ".join("%s %.4f" % x for x in vals) + "（線 %.4f）" % LIMIT)
    if bad:
        print("✗ 輪郭がある: " + "・".join(bad) + "。_要確認 の絵を開き、字と商品が切れていないかを確かめる"); return 1
    print("通った"); return 0

if __name__ == "__main__":
    sys.exit(main())
