// 検査が本当に止めるかの確かめ：わざと壊した設定を作って check.mjs に通し、だめが出るのを見る
import fs from 'fs'; import os from 'os'; import path from 'path'; import { spawnSync } from 'child_process'; import assert from 'assert/strict'; import { fileURLToPath } from 'url';
const R = fileURLToPath(new URL('..', import.meta.url));
// 診断の形の見本（架空の値。test/fixtures）
const base = JSON.parse(fs.readFileSync(R + 'test/fixtures/tachimat-diagnosis.json'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'line-check-'));
const cases = [
  ['ボタンの字が41字', c => { c.questions[0].opts[0][1] = 'あ'.repeat(41); }, /ボタンの字/],
  ['対策が13枚', c => { c.tools.items = Array.from({ length: 13 }, (_, i) => ['t' + i, '対策' + i]); for (const [k] of c.tools.items) c.compare.costs[k] = { mode: 'note', label: 'x', note: 'x' }; }, /12枚まで/],
  ['不安の値が長い（postback が300バイトを超えないための決まり）', c => { c.worries.items[0][0] = 'w'.repeat(40); }, /不安の値/],
  ['予約された key', c => { c.questions[0].key = 'g'; }, /Bot が使う名前/],
  ['バリアントが引けない', c => { delete c.variants[Object.keys(c.variants)[0]]; }, /undefined/],
  ['出す前の検査で画像の抜け', c => { c.images.source_dir = dir; if (c._notes) delete c._notes.example_values; }, /画像が無い/, ['--deploy']],
  ['費用の出どころが無い', c => { delete Object.values(c.compare.costs).find(x => x.basis).basis; }, /出どころ/],
];
// 相性チェック（fit_check）の決まり
const fit = JSON.parse(fs.readFileSync(R + 'products/tachimat-fitcheck/survey.json'));
const fcases = [
  ['合わない選択肢に理由が無い', c => { const o = c.questions.find(q => q.key === 'k').opts.find(o => o[2]?.fit === 'no'); delete o[2].reason; }, /理由（reason）が無い/],
  ['答えに「治る」', c => { const k = c.worries.items[0][0]; c.worries.answers[k].body[0] = '腰痛が治ります'; }, /言えない言葉/],
  ['不安の答えが無い', c => { delete c.worries.answers[c.worries.items[1][0]]; }, /の答え（worries.answers/],
  ['fit が無い', c => { delete c.fit; }, /survey.fit が無い/],
  ['サイズの問いが無い', c => { c.questions = c.questions.filter(q => q.key !== 'z'); }, /サイズの問い/],
  ['理由が3つにならない', c => { c.fit.fixed_reasons = []; for (const q of c.questions) for (const o of q.opts) if (o[2] && q.key !== 'z') delete o[2].reason; for (const q of c.questions) for (const o of q.opts) if (o[2] && !o[2].reason) o[2].fit = 'ok'; }, /理由が/],
];
let n = 0;
for (const [name, edit, re, extra = []] of fcases.map(([a, e, r, x]) => [a, e, r, x, fit])) cases.push([name, edit, re, extra, fit]);
for (const [name, edit, re, extra = [], from = base] of cases) {
  const c = structuredClone(from); edit(c); const f = path.join(dir, 's.json'); fs.writeFileSync(f, JSON.stringify(c));
  const r = spawnSync('node', [R + 'scripts/check.mjs', f, ...extra], { encoding: 'utf8' });
  assert.equal(r.status, 1, name + ': 止まらなかった\n' + r.stdout); assert.match(r.stdout, re, name + ': 理由が違う\n' + r.stdout); n++; console.log('  ○ 止めた: ' + name);
}
fs.rmSync(dir, { recursive: true, force: true });
console.log(`検査の確かめ：${n}件 すべて止めた`);
