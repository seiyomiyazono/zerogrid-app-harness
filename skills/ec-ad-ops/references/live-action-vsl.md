# 実写VSL の作り方（リアルの型）— 全商品共通（2026-10-07）

2026-10-07 運営者 が、この作り方で作った冒頭78秒を合格にした（「よすぎ。実写のVSLのハーネスこれベースでアップデートして」）。
今の権威実写の作り方は [video-formats/authority-live-video.md](video-formats/authority-live-video.md) が正。この資料は、そこから指されている元の作り方（リアルの型）。台本は `vsl-script` スキル。

- ひな形：`templates/authority-vsl/real_build_example.py`・`real_prompts_example.md`・`real_codex_task_example.txt`
- 前からの手順（物語型・B-main 第3版）は [authority-vsl-production.md](authority-vsl-production.md)。声・口パク・字幕・音・検品・納品の細かい決まりはそちらが正で、**下の表の項目だけ、この手順が上書きする**

## 0. 前の手順から変わった所
| 項目 | 前（authority-vsl-production） | この手順 |
|---|---|---|
| 台本 | 物語型の段（名乗る → 物語 → ループ …） | `vsl-script` スキルの台本（台本の形と中身は vsl-script の決まりが正）。話し手は名乗らない・名前テロップなし |
| 画像 | ChatGPT（Codex）で実写の静止画 | 同じ道具で、プロンプトは必ず [realistic-image.md](realistic-image.md) の型（場面の文＋共通の枠） |
| 色 | 悩みは白黒、解決はカラー | **全部カラー**（合格の見本がカラー。スマホで撮った画のリアルさを白黒で消さない）。`bw=False` を全カットに付ける |
| 動かす指示 | 「static camera, sharp focus」 | 手持ちのスマホ・小さい動き1つ・スローにしない（3章の文） |
| 動画化の形 | Wan 2.7 1080p・3:4 | Wan 2.7 1080p・**9:16**・5秒（12.5クレジット）。編集で 4:5 に切る（`cy` で上下の位置を合わせる） |
| 声 | EIKO（女性の話し手） | 話し手の年齢・性別に合うスタメン（見本は50代男性に Koji）。一続きに1回読む決まりは同じ |
| 話し手のカットの画面 | 上下にぼかした背景、下に青い帯、その中に話し手 | **話し手を画面いっぱい（4:5）に出す。青い帯・ぼかしの背景なし。頭の上の余白は小さく**。`build.py` の頭に `import vsl_edit; vsl_edit.AV_FULL = True`。HeyGen の縦9:16から拡大せずに 1080×1350 を切り出す（上から切る量は `vsl_edit.AV_FULL_Y`、標準200） |
| 話し手のピンマイク | 無し | **話し手の襟元に、小さい黒のクリップ式ピンマイクを付ける（標準）**。作り方は4章 |
| 素材 | 素材庫の実写＋新規生成 | 新規生成だけで組める（素材庫に合う実写があれば使ってよい） |

## 1. 流れ（1本。見本の実測の時間つき）
1. **台本**：`vsl-script` スキルで書いた台本。行ごとに「話し手が映る／場面の画」を決める（2章）
2. **画像のプロンプト**：`prompts.md` に、共通の枠2つ（人物／物・手元）と、カットごとの場面の文を書く（realistic-image.md）
3. **画像を作る**：Codex 内蔵の imagegen。1枚 約3分（見本は12枚で約35分）。裏で回して、先に声へ進む
4. **声**：`python3 build.py take` で一続きに1回読む → whisper で台本と照合
5. **口パク**：話し手の画像と声ができたら、画像の残りを待たずに HeyGen へ（1本にまとめて投入）
6. **動画化**：`scripts/i2v_real.py <作業フォルダ>`。画像ができた順に Wan 2.7 へ投入する（1本 約1〜2分）
7. **組み立て**：`python3 build.py`（`vsl_block.build_block` → `finalize2`）
8. **検品** → 音量の仕上げ → 納品

見本の所要：約1時間10分（うち画像の待ちが約35分）。使った量：Higgsfield 150クレジット（12本）、HeyGen 42秒の1本。

## 2. 行と画の割り当て
台本の形と中身は vsl-script の決まりが正（下の「◯段」は、見本を作った時の台本の段）。
- **話し手が映る行**：言い切る所。1段の「あなたのせいではない」「20秒ください」、2段の最後の問い、3段の診断、4段の否定と名前。見本は77.7秒のうち約37秒
- **場面の画の行**：2段（ヴィランを使う瞬間・試した事・どん底）、4段の仕組み。**台本で物を並べたら、言うたびにその物の画に切り替える**（script-checklist 14。`at=[...]` で切り替え）
- 1つの画は4.5秒まで。足りない時は同じ素材の寄り（`ss` と `z`）を1回。**同じ画を3回以上使わない**（見本は顔をしかめる女性が3回、タオルの寄りが続いた。全尺では画を足す）
- **同じ人物が2カット以上に出る時は、先にその人の参照画像を1枚作り、ほかのカットはそれを参照に渡す**（見本は参照なしで作り、同じ女性のつもりの2カットで髪型が違った。参照を渡す作り方は次の1本で確かめる：未検証）
- 強調の色文字（`emph`）：あなたのせいではない＝緑、診断・根本原因の名前＝赤

## 3. 画像と動画化
- 画像：realistic-image.md の型。話し手は「胸から上・顔は上寄りの中央・話している途中・名札と服の文字なし」
- Codex の呼び方：`codex exec --skip-git-repo-check -s workspace-write -C <作業フォルダ> "$(cat task.txt)" < /dev/null > gen.log 2>&1 &`
  - **`< /dev/null` を必ず付ける**（付けないと入力待ちで止まり、1枚も出ない。2026-10-07 に20分止まった）
  - task.txt には「内蔵の imagegen を使う・外の API を使わない・1枚できるたびに `img/<名前>.png` に保存する」と書く（ひな形 `real_codex_task_example.txt`）
- 動かす指示（`motions.json` に、カットごとに英語1文）＋共通の文：
```
Handheld smartphone video, tiny natural hand shake, real-time speed (no slow motion), one small natural movement only, no camera move, no zoom, no cinematic look, same lighting and colors as the photo, skin texture and background detail stay unchanged, no text, no subtitles.
```
- 動きは小さく1つ（タオルを顔から離して顔をしかめる／注ぎ続ける／たたんでなでる）。物だけの画は、スマホが少し寄る・少し横にずれる
- できた動画は、頭と終わりのコマを並べて見る（肌がのっぺりしていないか・手や物の形・背景の溶け）

## 4. 口パク（HeyGen）
- 決まりは authority-vsl-production 3章のまま（顔の行の声を全部つないで1本だけ作る・切り分ける）
- **話し手にはピンマイクを付ける（標準）**。話し手の画像ができたら、その画像を Codex の imagegen に入力として渡し、マイクだけ足す（人物・服・背景は変えない）。最初から場面の文に入れてもよい（realistic-image.md 4章の文）。指示の文（見本で使った物）：
```
Edit ./img/speaker.png: add a small black lavalier (pin) microphone with a tiny foam windscreen clipped to the left side of his shirt collar placket, with a thin black cable running down and disappearing behind the apron. An ordinary cheap clip-on mic for phone recording, slightly crooked, realistic size (about 1 cm), small natural shadow. Keep EVERYTHING else exactly the same: the same person, face, expression, open mouth, hair, skin texture, clothes, background, framing, lighting, iPhone snapshot look, vertical 9:16. No text, no logo. Save as ./img/speaker-mic.png.
```
  - マイクは口パクの前に付ける（後から付けると口パクを作り直す事になり、HeyGen を二重に使う）
  - できた画像で、顔が同じ人のままか・マイクの大きさと位置が自然かを見てから HeyGen へ
- **投入の後にブラウザのタブが閉じて止まった時は、作り直さない**（二重にクレジットを使う）。`node scripts/heygen_download.mjs <キャッシュの heygen.mp4 のパス>` で、できあがった最新の1本を待って落とす。その後 `build.py` を回せば、切り分けから続く

## 5. 組み立ての落とし穴
- **切り替えの語（`at`）は、読みの仮名に直した後の文字で書く**（script-checklist 30）。`vsl_auto.READ` に足した語（例：臭い→におい、本体→ほんたい）が `at` の中にあると見つからず、画が切り替わらない。見本で2か所ずれた（`at=['タオルのにおい']` で直った）
- 読みを足す：数字・読みが分かれる語は `vsl_auto.READ += [...]`（見本：20秒・1ミリ・何か月・生乾き臭・皮脂・臭い）
- 9:16 の素材を 4:5 に切るので、顔や手元が切れる時は `cy='ih*0.4'` のように上下を合わせる
- BGM：フック・問題・原因は緊張の曲（見本は「暗いパッドと心拍の緊張BGM」）。全尺では段に合わせて替える（video-formats.md の手順5・`bgm_check.py`）
- 仕上げの音量：`finalize2` の出力は約 −16 LUFS だった。`-af "volume=4dB,alimiter=limit=0.8:level=false"` で約 −13 LUFS・ピーク −1.7 dBTP

## 6. 検品（出す前に）
authority-vsl-production 6章の全部に加えて：
| # | 問い |
|---|---|
| 1 | 1.3秒おきのコマ一覧で、台本で言っている物と画が合っているか（切り替えのずれ） |
| 2 | 声だけの段階（BGM を入れる前）の文字起こしが、台本と1行ずつ合っているか。BGM 入りの文字起こしは行が抜けやすいので、声だけの方で確かめる |
| 3 | 「うっ」のような短い声が、聞いて分かるか（見本では文字起こしに出なかった） |
| 4 | 同じ人物のカットで、顔・髪・服が同じか |
| 5 | 同じ画が3回以上出ていないか |
| 6 | 口パク：SyncNet（`scripts/syncscore.sh`）で確信度6以上・ずれ±1 |
| 7 | 効果音とフックのライザーが入っているか（見本には入れていない。全尺では入れる） |
| 8 | 話し手の全カットで、ピンマイクが同じ位置に付いているか（消えたり動いたりしていないか） |

## 7. 見本でまだやっていない事（次の1本で確かめる）
- 5段以降（放っておくと・解決・商品・締め）。商品が写る画は実物の写真を参照に渡す（生成だけで作らない）
- 人物の参照画像で、カットをまたいで同じ人にする作り方
- 効果音・ライザー・BGM の切り替え・`bgm_check.py`
- SyncNet での口パクの測定
