#!/usr/bin/env python3
"""ナレーションの間を詰める（速度は別に atempo で上げる）。
使い方: vo_tighten.py in.wav out.wav [--gap 0.18] [--db -38]
長い無音を gap 秒に縮め、残した区間を keep.json（元の秒）に書く。アバターの口の同期や字幕の位置合わせはこの keep を使う。
テンポの決まり（2026-10-01 運営者指定）：どの声でも 間0.18秒 ＋ 全体1.2倍速。"""
import sys,re,json,subprocess
a=sys.argv; inp,out=a[1],a[2]
gap=float(a[a.index('--gap')+1]) if '--gap' in a else 0.18
db=a[a.index('--db')+1] if '--db' in a else '-38'
dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',inp],capture_output=True,text=True).stdout)
log=subprocess.run(['ffmpeg','-hide_banner','-i',inp,'-af',f'silencedetect=n={db}dB:d=0.12','-f','null','-'],capture_output=True,text=True).stderr
st=[float(x) for x in re.findall(r'silence_start: ([\d.]+)',log)]; en=[float(x) for x in re.findall(r'silence_end: ([\d.]+)',log)]
sil=[]
for s,e in zip(st,en):
    if sil and s-sil[-1][1]<0.01: sil[-1][1]=e
    else: sil.append([s,e])
keep=[]; cur=0.0
for s,e in sil:
    if e-s<=gap+0.02: continue
    if s<=0.01: cur=max(0,e-0.05); continue
    if e>=dur-0.01: keep.append([cur,s+0.12]); cur=None; break
    keep.append([cur,s+gap/2]); cur=e-gap/2
if cur is not None: keep.append([cur,dur])
keep=[[round(x,3),round(y,3)] for x,y in keep]
fc=';'.join(f"[0:a]atrim={x}:{y},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={y-x-0.012:.3f}:d=0.012[k{i}]" for i,(x,y) in enumerate(keep))
fc+=';'+''.join(f'[k{i}]' for i in range(len(keep)))+f'concat=n={len(keep)}:v=0:a=1[o]'
subprocess.run(['ffmpeg','-y','-v','error','-i',inp,'-filter_complex',fc,'-map','[o]',out],check=True)
json.dump(keep,open(out.rsplit('.',1)[0]+'.keep.json','w'))
print(json.dumps(keep)); print('out',round(sum(y-x for x,y in keep),2),'s')
