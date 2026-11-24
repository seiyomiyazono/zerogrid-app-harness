// 画像生成の文の型（元の店で使った文をそのまま型にした物）。
// 写真：元の店 gen/gen1.sh の後ろの決まり文句 ＋ 商品の場面（survey.json の images.photos）＋ テーマの色味
// バナー：元の店の採用版のバナーの文の並びを変数にした物
export const PHOTO_TAIL = '上質なライフスタイルブランドの広告写真のトーン、やわらかい自然光、文字・ロゴ・透かしは一切入れない、正方形。';

export function photoPrompt(cfg, scene) {
  const mood = cfg.brand?.theme?.photo_mood ? `色味：${cfg.brand.theme.photo_mood}。` : '';
  return `${scene}。${mood}${PHOTO_TAIL}`;
}

export function bannerPrompt(cfg) {
  const b = cfg.images.banner; const t = cfg.brand.theme;
  return [
    '縦長3:4、日本語の文字を正確に入れる。ポップアップ用の1枚バナー。ブランド名やロゴは一切入れない。',
    `デザイン: 背景は白〜${t.banner_bg_name || '淡い水色'}のグラデーション、角丸カード風。`,
    `最上部に主見出し「${b.headline}」を太い丸ゴシック体・${t.primary_name || '濃紺'}で大きく。`,
    `その下に副見出し「${b.sub}」を中サイズ。`,
    `中央に、${b.illustration}のフラットイラスト、その横に緑の吹き出しアイコン（LINE風）と3つのチェックマーク付きの小さなチェックリスト。`,
    `イラストの下に、${t.ticket_name || 'オレンジ色'}のチケット型（切手のようなギザギザの縁）のバッジを横長に置き、中の文字は白で「${b.ticket}」（「${b.ticket_big}」だけ一回り大きく）。`,
    `その下に緑（#06C755）の横長角丸ボタン、ボタン内の文字は白で「${b.button || 'ここから追加'}」。`,
    `最下部に小さく「${b.footnote || '友だち追加は無料・いつでも解除できます'}」。`,
    '文字はすべて正確な日本語で、誤字なし。全体に清潔で信頼感のあるトーン。',
  ].join('\n');
}
