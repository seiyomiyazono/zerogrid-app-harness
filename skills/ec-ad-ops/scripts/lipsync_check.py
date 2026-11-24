#!/usr/bin/env python3
"""アバターの口の動きと声が合っているかを数字で確かめる。
使い方: lipsync_check.py <アバター.mp4> <生成に渡した声.wav> [口の切り出し w:h:x:y（既定 200:110:317:320＝834x1112の岸本施設長）]
口の周りのフレーム差（開け閉め）と声の大きさの相関を、ずれ・伸び率を変えて探す。
目安（2026-10-01実測）：合っている＝相関0.4以上・ずれ0±2フレーム／合っていない＝0.15未満。
注意：Seedanceの出力は24fps。声の長さが動画の長さより短いと口が合わなかった（生成前に声を動画の秒数ちょうどまで無音で埋める）。"""
import subprocess,re,sys,math
def mouth(v,crop):
    out=subprocess.run(['ffmpeg','-hide_banner','-i',v,'-vf',f'crop={crop},tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG','-f','null','-'],capture_output=True,text=True).stderr
    return [float(x) for x in re.findall(r'YAVG=([\d.]+)',out)]
def env(a,fps=24):
    out=subprocess.run(['ffmpeg','-hide_banner','-i',a,'-af',f'aresample=48000,asetnsamples={48000//fps},astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level','-f','null','-'],capture_output=True,text=True).stderr
    return [max(-60,float(x)) if x!='-inf' else -60 for x in re.findall(r'RMS_level=(-?[\d.inf]+)',out)]
def corr(a,b):
    n=min(len(a),len(b));
    if n<20: return -1
    a=a[:n];b=b[:n];ma=sum(a)/n;mb=sum(b)/n
    num=sum((x-ma)*(y-mb) for x,y in zip(a,b));da=math.sqrt(sum((x-ma)**2 for x in a));db=math.sqrt(sum((y-mb)**2 for y in b))
    return num/(da*db+1e-9)
v,a=sys.argv[1],sys.argv[2]; crop=sys.argv[3] if len(sys.argv)>3 else '200:110:317:320'
m=mouth(v,crop); e=env(a)
# 口の開閉は音の大きさ（少し遅れ）に追従する。音の伸び率 s と ずれ off を探す
best=[]
for s in [0.94,0.96,0.98,1.0,1.02,1.04,1.053,1.06]:
    es=[e[min(len(e)-1,int(i/s))] for i in range(int(len(e)*s))]
    for off in range(-15,16):
        mm=m[off:] if off>=0 else [0]*(-off)+m
        best.append((corr(es,mm),s,off))
best.sort(reverse=True); print(v,'frames',len(m),'audio',len(e)); print(best[:5])
