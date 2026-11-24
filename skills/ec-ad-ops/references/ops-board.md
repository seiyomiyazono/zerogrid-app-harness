# 広告運用ボード（毎日の型）— 2026-10-02 設計

1つの商品につき1つのボード（Artifact）を作り、毎日同じ画面に日付のタブを足していく。
承認・納品はボードの中で完結する（運営者 は開くだけで、承認も動画チェックもできる）。

- 1本目（ワンドライ）：https://claude.ai/artifact/BzwTUribz2wkaaQteMtYuB
- ひな形：templates/ops-board/index.html（画面）・seed.py（台本 data.py → 広告データ・素材サムネイルを作る）

## 画面（上から）— 第2版
1. 今日の結論（1文）と「いまの状態」（配信中・停止中など）。数字の取得時刻（Meta・読み取りのみ）
2. **流れ：過去3週間＋これからの7日を1本の時間軸**：広告費（棒）・購入件数（線）、CPA（線）と ROAS（点線）、目標CPA・止める目安の線、出来事の番号（予算変更・着地変更・停止など）、これからの帯に7日分の予定（作る／出す／見る）。前の週との比較の数字
3. **パックの地図**：pack0（過去の勝ち＝実績つき）と packA〜F。各パックの狙う層、入っている動画、状態（台本のみ・承認済み・制作中・納品）、素材のそろい具合（%）。配信できる動画が0本のパックは目立たせる
4. **作る動画**：1本ずつ、狙う層／型／話し手／素材のそろい具合の棒（自社の素材庫・フリー素材・編集・口パク＝そろっている、YouTube・AI＝足りない）／承認・保留・見送り＋メモ／納品の動画／台本の表（右に使う素材のサムネイル、AIの行は「AIで生成します。なぜなら…」）。パックで絞り込める
## 素材の出どころ（台本の各行の右に出す）
- 素材庫（サムネイル付き）→ 無ければ **YouTube から探して素材化**（実写の場面。トークンを使わない）→ どうしても無い時だけ **AI生成**（行に「AIで生成します。なぜなら…」を必ず書く）
- 編集で作る（モーショングラフィックス）、口パク（HeyGen）

## データ（ボードの db）
- `overview/main`：Claude が書く（write: admin）。series[{d,spend,buy,rev,clicks}]（Meta 日別）、events[{d,t}]、winners[]（pack0 の実績）、packs[{id,name,layer,set}]、plan{today,target_cpa,cut_cpa,fetched,headline,status_note,days[{d,what,kind}]}
- `items/<動画ID>`：Claude が書く（write: admin）。key,id,pack,title,format,who,body,status（script/producing/delivered/checked）,order, rows[{t,sec,line,vis,made?,asset{kind: own|comp|free|youtube|ai|edit|avatar,label,img?,reason?}}], video[[名前,パス]], delivered_note
- `decisions/<動画ID>`：運営者 が書く。verdict（approve/hold/reject）, note, at, by
- **数字と台本（overview・items）はページと一緒に公開する `data/overview.json`・`data/items.json` から読む**（2026-10-02：db から読む方式では画面に何も出なかった。毎朝ファイルを差し替えて同じ URL に再公開する）。db は 運営者 の承認（decisions）だけ
- 描画は try で囲み、エラーは画面に出す（広告費0で購入1の日に CPA/ROAS が null になり、描画が止まって空の画面になった）
- 作り方：ad-funnel の fetch.py（--days 21）→ templates/ops-board/seed2.py（数字・パック・台本 data.py・素材の割り当て）→ ArtifactData の batch で書き込み
- 画像・動画はボードの公開ファイル（thumbs/・frames/・videos/）。新しい納品は同じボードに files を足して再公開（ページは変えない）

## 毎日の手順（Claude）
1. 毎朝 fetch.py で数字を取り直し、`overview/main` の series・events・plan を更新（流れに1日足す。データが少なければ「止めずに続けて次を作る」）
2. 作る動画を `items/` に status=script で並べる（台本・パック・素材の割り当て）
3. `decisions/` を読み、approve の広告だけ制作（作り直す範囲と費用の見込みが大きい時は先に伝える）→ status を producing → 納品で delivered、video と完成画を入れる
4. 保留・見送りのメモは次の案に反映する

## 配信前の一覧
- 同じボードURLを、配信前は「配信前の広告」一覧として使う（templates/ops-board/launch.html・seed3.py → data/launch.json）
- 形：キャンペーン → 広告セット（パック）→ 広告 の3つのタブ（広告マネージャと同じ階層）。パック・状態（作成済み／未作成）・種類で絞り込み、並び替え
- 広告の行を押すと、下の「広告の詳細」に飛ぶ（プレビュー／広告名・広告セット・狙う層・種類・話し手・遷移先・メインテキスト／原稿と使う素材）
- pack0（過去の勝ち）は Meta に登録済み（停止中）の広告をそのまま載せる。サムネイルは Meta の画像を保存して同梱

- 納品先：`<商品名>/07_納品/<種類：VSL・Static Ads・Native Ads>/<pack>_<層>/<ID>_<題名>/`（動画＋原稿.md）。ボードの作成済みと同時に入れる

## 第4版：タブ「広告運用」「動画」（2026-10-02 運営者 指定。これが今の型）
- ひな形：templates/ops-board/board.html（画面）・ops_example.json（data/ops.json の例）。動画タブは data/launch.json（第3版と同じ）
- **広告運用タブ**（上から）：
  1. いまの段階（ステップ0〜4、いまここ）
  2. 次はこうセットします（広告マネージャの形：キャンペーン→パック→広告。作成済みの広告は押すと動画タブのその広告へ。未作成は点線）
  3. なぜそうするか：数字で見る（よい週と落ちた週を項目ごとに2本の棒で比較。悪化は赤、改善は緑、変化率）
  4. 何がよくて何がよくないか（着地・年代・配置・広告ごとの ROAS。基準線＝よい週の平均、緑／黄／赤）
  5. 落ちた原因と、だからこうする（原因の割合の帯 → 原因ごとの対策を矢印で）
  6. この運用で確かめること（ツリー：目的 → pack0（基準）とテストする層 → 各広告で何を確かめるか、判定のルール）
- 数字は実データだけ（ad-funnel の fetch・原因分析）。毎日の更新は data/ops.json を差し替えて同じ URL に再公開
