# 実写の画像の作り方（リアルに見せる型）— 全商品共通

実写の画（権威実写・実写の静止画・記事の実写画像）を新しく作る時は、必ずこの型でプロンプトを書く。画像を作る道具は Codex 内蔵の imagegen（Higgsfield は画像に使わない）。

- 元になった調べ：X の投稿 約300件（長文プロンプトつき217件の言葉を数え、リアルさに関わる上位30件ほどを読んだ）
- この型で作った動画の見本と、動画にするまでの手順：[live-action-vsl.md](live-action-vsl.md)
- 根拠の格：X の投稿は作例つきの個人の知見。配信の実績ではない。合格の根拠は 運営者 の目（3枚）

## 1. 考え方
AI 感の正体は「きれいすぎること」。広告の写真ではなく、**家族がスマホで何気なく撮った1枚**として書く。

## 2. リアルに見せる7つ（毎回ぜんぶ入れる）
| # | 何を書くか | 書き方 | 入れない言葉 |
|---|---|---|---|
| 1 | カメラはスマホ | iPhone の広角24mm・手持ち・奥までピントが合う・明暗の幅がせまい・暗い所に少しノイズ | cinematic・8K・masterpiece・とろけるボケ・85mm f/1.8・portrait mode |
| 2 | 撮った理由 | だれが、なぜ撮った1枚か（娘が話している父を撮った／夫が戸口から偶然撮った／本人が片手で見下ろして撮った）。動作の途中の一瞬 | ポーズ・カメラ目線の笑顔（話し手のカット以外はカメラを見ない） |
| 3 | 肌と髪の粗 | 毛穴・小じわ・左右の非対称・クマ・色むら・はねた毛・濡れ髪。モデルではない普通の人 | smooth skin・flawless・glowing・beautiful |
| 4 | 光はそろえない | 蛍光灯1本・窓の光と電球が混ざる・白飛び・色かぶり | soft studio light・golden hour・rim light |
| 5 | 構図をくずす | 中心からずらす・少し傾ける・物が画面の端で切れる | perfectly centered・symmetrical |
| 6 | 生活感 | 散らかった棚・洗濯物・使い古した服のしわと毛玉。日本の家の物 | minimal・clean background |
| 7 | 打ち消しを言葉で | スタジオではない・広告ではない・レタッチなし・CGI ではない・文字なし・ロゴなし | — |

## 3. プロンプトの形
「場面の文（1枚ごと）」＋「共通の枠（毎回同じ文）」。英語で書く（集めた作例の多くが英語で、合格の3枚も英語）。

**場面の文に入れる物（この順）**
1. だれが（年齢・日本人・髪・肌の特徴・着古した服）、どこで、**何をしている途中か**
2. 表情（小さく、作らない。しかめる・目を半分閉じる・口が少し開く）
3. どこから撮ったか（戸口から胸の高さで／本人の目線で見下ろして／腕をのばして）と、画面の端で切れる物
4. 背景にある日本の家の物を3〜5つ（名前で）
5. 光（何の明かりが、どこから、どんな色かぶりで）
6. 撮った理由（Capture reason: …）

**共通の枠（人物のカット）**
```
Shot on an iPhone 15 Pro main camera (24mm equivalent), handheld, vertical 9:16. Ordinary unedited camera-roll photo taken by a family member, not a professional. Deep focus: background stays mostly sharp, no creamy bokeh, no portrait mode. Smartphone Smart HDR look with limited dynamic range: window or lamp highlights slightly blown, shadows a little noisy, fine luminance noise in dark areas, mild JPEG sharpening. Uneven mixed lighting with a slight white-balance cast. Slightly off-center, slightly tilted framing, something cropped at the frame edge. Real Japanese person with ordinary looks (not a model): visible pores, fine lines, slight facial asymmetry, uneven skin tone, under-eye shadows, a few flyaway hairs, no makeup retouching. Lived-in Japanese home with everyday clutter. Clothing has real wrinkles and pilling. Not studio photography, not cinematic, not an advertisement, not beauty-retouched, not CGI, no text, no watermark, no logo.
```

**共通の枠（物・手元のカット）**：上の「Real Japanese person … no makeup retouching.」の1文を、次の文に替える。
```
Any visible hands are real Japanese adult hands with fine lines, knuckle creases, short unpolished nails.
```

## 4. 場面ごとの気をつける所
- **話し手（口パクの元）**：カメラを見て、話している途中（口が少し開く）。胸から上、顔は画面の上寄りの中央、頭の上に少し余白（HeyGen の出力の上側を切り出して使うため）。手は画面の外か、動かさない位置。名札・服の文字は無し。**襟元に小さい黒のクリップ式ピンマイクを付ける（権威系の実写の標準。2026-10-07 運営者）**：`A small black clip-on lavalier microphone with a tiny foam windscreen is clipped to the shirt collar placket, slightly crooked, thin black cable running down behind the clothing.` 画面は編集で 4:5 に切って画面いっぱいに出すので、胸の上（マイクの位置）まで必ず入れる
- **悩みの場面**：カメラを見ない。困っている体の状態を、動作の途中で
- **手元・物の寄り**：本人の目線か、すぐ横から。**形が複雑な動作（くつ下を半分脱ぐ、ひもを結ぶ、等）は崩れやすい**ので、動作が終わった後の状態で書く（「脱いだ後の足首に跡」）
- **店・商品棚・ボトル**：「ラベルは無地、読める文字とロゴは無し」と書く。他社の商品に見える形を指定しない
- **自社の商品が写る画**：この型だけで作らない。実物の写真を参照に渡す（script-checklist 35）

## 5. 動かす時（画像 → 動画）
- 動かす指示にも同じ考え方を入れる：手持ちのスマホで撮った動画、わずかな手ぶれ、動きは小さく1つ、スローモーションにしない、映画のようなカメラの動きを付けない、字幕・文字なし
- 画像のリアルさが動画で残っているか（肌がのっぺりしていないか・背景が溶けていないか）を、コマを並べて目で見る。崩れたカットは、動きを小さくして作り直すか、別の画像に替える

## 6. 点検（画像を出す前に）
| # | 問い |
|---|---|
| 1 | 7つが全部プロンプトに入っているか。入れない言葉（cinematic・8K・bokeh など）が混ざっていないか |
| 2 | 撮った理由が書いてあるか。話し手以外がカメラを見ていないか |
| 3 | 拡大して見て、手・指・物の形が崩れていないか。崩れた画は出さない |
| 4 | 読める文字・ロゴ・他社の商品に見える物が写っていないか（カレンダーの数字のような背景の文字は、読めないくらい小さければ可） |
| 5 | 日本の家・日本人に見えるか |
