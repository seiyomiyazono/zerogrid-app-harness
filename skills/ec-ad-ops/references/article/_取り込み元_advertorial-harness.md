# 取り込み元（2026-10-12）

この `ec/構造/`・`ec/wiki/`・`ec/決めたこと.md` は、https://github.com/tokunaritakakura-code/advertorial-harness（d7b7934・2026-10-12）の `vault/ec/` をそのまま写した物。

| 取り込んだ物 | 置いた場所 |
|---|---|
| `claude-skills/`（quiz-jp-copy・kata-tsukuru・bakuro-copy・ranking-copy・website-copy・fukikae） | `<名前>/` |
| `claude-code/`（ec-harness の検査・kata-tsukuru の runs・team-room の引き継ぎ資料・adv-kata） | `（アプリには同梱していない社内の道具）` |
| `examples/`（作った見本3本＋SASAE で殻にした「パッドの敵」） | `（アプリには同梱していない社内の道具）` |
| `claude-hooks/kiji-guard.py` | `（社内の Mac の道：アプリには無い）`（settings.json の PreToolUse Bash・PostToolUse Write|Edit） |
| 道具用の Python（Playwright・Pillow・numpy・OpenCV） | `_env/venv/bin/python`（`python3` に無い時はこれで打つ） |

運営者 のハーネスからの入口は `ec-ad-ops/references/article.md`（記事の作り方）と `video-formats.md`（動画の後に記事）。SASAE で作った実例は `（作業フォルダ：アプリには同梱していない見本）`。

# 取り込み（2026-10-20）: advertorial-automation 6884358・pdp-tsukuru c906a23

友だちの最新版に合わせた。元は `（作業フォルダ：アプリには同梱していない見本）`（2566010 の後の 237e6ba・e809ba0・af6a82a・d91ab5c・6884358）と `（作業フォルダ：アプリには同梱していない見本）`（afb72a3 の後の cd2e066〜c906a23）。3方向でまぜ、パスはうちの書き方にし、運営者 の決まり（`ec-ad-ops/references/article.md`）の行は消さずに残した。食い違う所は 運営者 の決まりを取った。入れる前の元は `（作業フォルダ：アプリには同梱していない見本）`（`` からの同じ相対パス）。

| 入れた物 | 置いた場所 | 中身 |
|---|---|---|
| 記事の型を VSL ごとに選び分ける（237e6ba） | `型/_VSLから型を選ぶ.md`・`05 記事を作る.md` 手順2・`決めたこと.md` | 普通の中を3つ（物語型・権威の暴露・調査暴露型）に分け、VSL の線で選ぶ |
| 物語型・調査暴露型の段の芯（新規） | `型/A03 派生 物語型記事/_分解.md`・`型/A03 派生 調査暴露型記事/_分解.md` | 段の表。生の段・画像は友だちの手元（うちには無い）と書いた |
| 声と研究を本物から取る（237e6ba） | `05 記事を作る.md` 手順5・`型/_仕掛けの棚.md` の H | 声は原文のまま4本以上。友だちの `voc.py` はうちに無いので `voc` スキルかアプリの専用 Chrome で取る |
| 題の型（6884358。新規） | `型/_題の型.md`・`役/編集長.md` 関門10・`05` 手順9 | 題の関門・型・声の決まり |
| 残った疑いの重さ（d91ab5c） | `型/_買うまでの15の事.md`「残った疑いの重さと答え方」・`05` 手順3・5c・5④・`役/編集長.md` 関門11・`tools/article/記事の検査.py` 6d・7・8・`adv-kata/新規.sh` の表 | 重さ1は値段の段より前の本文で答え切る。FAQ と「〜によります」で済ませない |
| 審査の箱の店の分かれ道（e809ba0・af6a82a） | `tools/article/審査を回す.py` | `店の印.json` があれば pdp-tsukuru の `店の検査を回す.py` と `ストア担当の審査.md` の2節を使う。絵の一覧（16枚を1枚に）・`絵と説明の一覧.tsv`・`照らし合わせ_<回>.txt` も束に入れる。img/ を直した回も「直した」と数える |
| 値段の段の道具（237e6ba） | `tools/article/kata-tsukuru/値段の段を組む.py` | 送料無料がセールの間だけの時の書き方・内訳・3年の比べの直し。「星」の出し分けと顔写真なしはうちのまま |
| 4スキルの SKILL.md（6884358） | `bakuro-copy`・`listicle-copy`・`quiz-jp-copy`・`ranking-copy` | C3 の書き方。C5（VSL のビジュアルを使わない）はそのまま（C4 は 2026-10-20 に外した） |
| 名前替え「テスト用に決めた値.md」→「決めた値.md」 | 記事の文書・スキル全部。道具（`審査を回す.py`・`引き継ぎの検査.py`・`記事の仕上がり検査.py`）は両方の名前を受ける | 前の作業フォルダ（立ち仕事マットの記事など）はそのまま通る |
| pdp-tsukuru c906a23 | `pdp-tsukuru/` | 店だけの審査の箱 `scripts/審査を回す.py`・`絵を置く.py`・`往復とカート.mjs`・`照らし合わせの指示文.md`・`直しの記録.md`・`見本/`。SKILL.md は友だちの新しい形に、うちの読み替えを入れ直した（`references/harness-map.md` 5章） |
| VSL→記事の受け渡しに重さ | `vsl-script/references/記事と分ける.md` 5章・`15の対応表.md` 2-3 | 引き継ぎ票に秒と「残した疑いと重さの候補」の1行。約束した事と最後の問いは重さ1で、票の ⑭ に入れない |

入れなかった物と理由:

| 物 | 理由 |
|---|---|
| `skill-creator/check-undug.py`・`team-room/isolation.mjs` | うちのハーネスに無い部分（部屋・skill-creator の友だち版） |
| 決めたことの CS の行（返金・倉庫・Telegram・arukoto-cs）13行 | 友だちの店の CS の決め。記事・店の仕組みに関係しない。うちの CS は `ec-cs` スキル |
| 決めたことの「advertorial-automation を公開にする」「店の部分は上げない」 | 友だちの GitHub の扱い。うちは commit・push を本人の指示の時だけにしている |
| 審査の決まりの「Claude が決めた専門家の名前と生成した顔は落とさない」 | 友だちの元の文のまま（2026-10-20 に戻した。pdp-tsukuru の `ストア担当の審査.md` も元の行） |
| 審査の箱の「部屋が止まった時に出し直す」（team-room の room.db を読む） | うちは部屋を立てず、回ごとに新しいサブエージェントに頼む |
| `founder-adv` スキル・`voc-research` の道具・`fedotoff-200`・`kokochi-4hon` の生の資料 | 友だちの手元だけにある。文書には「うちには無い。〜で代える」と書いた |

# 取り込み（2026-11-19）: advertorial-automation adb12f8・pdp-tsukuru 5f43aec


- **pdp-tsukuru**：`pdp-tsukuru/` を 5f43aec の中身にそのまま入れ替えた（1字も足していない）。前の版は `（作業フォルダ：アプリには同梱していない見本）`。アプリ用の読み替え（置き場を商品フォルダの `08_店/` に・絵の道具をアプリの画像作りに・playwright の探し先）は、原本ではなくアプリの `scripts/bundle-skills.mjs`（REWRITE・SCRIPT_PATCH）と `server/core/skill-scripts-list.mjs` に入れた
- **記事**：6884358 の後の5コミット（27861e4・efc8746・6ecb500・1c6b033・adb12f8）の変更を当てた。当てた物：`bakuro-copy`・`listicle-copy`・`ranking-copy` の SKILL.md、`quiz-jp-copy/references/組み方.md`、`kata-tsukuru/templates/最終確認_共通.md`、`型/_VSLから型を選ぶ.md`、`決めたこと.md`、`05 記事を作る.md`（権威の暴露の手本を advertorial-07 に・見せ方の国）、道具の `値段の段を組む.py`・`幅の検査.py`・`画像の置き方.py`・`記事の仕上がり検査.py`、参考の写し `型の資料/runs/kokochi-4hon/advertorial-07/`・`資料/針マット/ここちドライの手本/手本の見た目_08.md`。友だちの行はそのまま入れ、変えたのは置き場の書き方だけ。前の版は `（作業フォルダ：アプリには同梱していない見本）`
- **当てなかった物**：`審査を回す.py`（友だちは `claude -p` で審査役を起こす形に替えた。うちは回ごとに新しい審査役に束を渡す形で、アプリもこの形で動いているので、うちのまま）。道具の、Dia のブラウザを前提にした行（うちはアプリの専用 Chrome か headless）。`README.md`・`chatgpt-image` の MCP・`skill-creator`
