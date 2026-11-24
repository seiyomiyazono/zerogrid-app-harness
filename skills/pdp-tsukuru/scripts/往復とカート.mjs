// 横送りの写真を全枚往復できるか、セットを1つずつカートに入れて個数と金額が表示どおりかを数える（references/dame-list.md の G の2つ）。
//
// 使い方: node 往復とカート.mjs <URL> [--カートなし] [--ピクセルなし]
//   往復: 390px で開き、小さい写し（.hero_thumb_slider の8枚）を順に押して、大きい写真（.hero_image_slider）がその枚だけ見えているかを全枚で見る（行きと帰り）
//   カート: 非公開テーマのプレビュー URL で回す（カートは Shopify の /cart.js でしか動かない）。ローカルの index.html は --カートなし
//          カートを数える前に <html> の data-kata-err（型の動き.js が付ける「商品データが読めない」の印）を見て、あれば終了コード 1
//          選ぶ物があれば1つ目を選び、セット（#tiers の .tier）を1つずつ選んで #atc を押し、カートの合計（#kcTotal）が変わるまで最大20秒待ち、
//          合計がそのセットの値段（その .tier の data-price）と同じか、品数（/cart.js の型番の名前の数×個数の合計）がそのセットの数（data-n）と同じかを見る。見たらカートを空にする
//   計測: カートと同じ時に回す。Shopify が計測を差し込む {{ content_for_header }} がページに入っているか（window.ShopifyAnalytics が有るか）を見る。
//          Meta のピクセルの合図（facebook.com/tr へ送ろうとした ev の名前）を数え、商品ページで PageView と ViewContent、カートに入れた時に AddToCart、会計の画面で InitiateCheckout が出るかを見る。
//          ブラウザから Meta へ送る分だけ止めて、名前を数える。店の側から Meta へ送る分（Conversions API）と Shopify の分析は止まらないので、回した日時を記録に残す。Meta のピクセルを入れていない店は --ピクセルなし（content_for_header だけ見る）
//   失敗の時: /cart/add.js を 429 にして #atc を押し、カートの引き出し（#kc）が閉じていて、誤りの字（#buyErr）が出ているかを見る。戻して押し直し、合計が出るかを見る
//   カートの絵: 1つ目のセットを入れた時の引き出し（#kc）を、回した場所の「カートの引き出し.png」に撮る
//   会計: 1つ目のセットを入れて /checkout を開き、会計の画面（URL に /checkouts/）が開いて、画面にそのセットの値段が有るかを見る。支払いはしない。何も入力しない
// 終了コード: 0 全部合った / 1 どれかが合わない・商品データが読めない / 2 引数が足りない / 3 ページが取れない / 4 実行環境が壊れている
// process.exit はブラウザを閉じた後に呼ぶ
const { 引く, EXE } = await import(new URL('./lib.mjs', import.meta.url));

const 引数 = process.argv.slice(2);
const URL_ = 引数.find(a => !a.startsWith('--'));
const カートなし = 引数.includes('--カートなし');
const ピクセルなし = 引数.includes('--ピクセルなし');
if (!URL_) { console.error('使い方: node 往復とカート.mjs <URL> [--カートなし] [--ピクセルなし]'); process.exit(2); }

const chromium = 引く();
let browser;
try { browser = await chromium.launch({ executablePath: EXE, headless: true }); } catch (e) { console.error('環境が壊れている: Chromium を起動できない / ' + e.message); process.exit(4); }
const 落ち = [];
let 終わり = 0;
try {
  // 名乗り（userAgent）は本物の iPhone の Safari にする。画面なしの Chrome の名乗り（HeadlessChrome）のままだと、Shopify がロボットと見て Meta のピクセルを動かさず、合図が0になる
  const 場 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  // Meta へ送ろうとした合図の名前を数えて、送信は止める（ピクセルの部品 fbevents.js は止めない。止めると合図そのものが出ない）
  const 合図 = [];
  await 場.route(/facebook\.com\/tr/, r => { const u = r.request().url(); const d = r.request().postData() || ''; const m = u.match(/[?&]ev=([^&]+)/) || d.match(/name="ev"\s+([A-Za-z]+)/) || d.match(/ev=([A-Za-z]+)/); if (m) 合図.push(m[1]); r.abort(); });
  const 合図を待つ = async (名, 秒) => { for (let i = 0; i < 秒 * 2 && !合図.includes(名); i++) await page.waitForTimeout(500); return 合図.includes(名); };
  const page = await 場.newPage();
  let 開けた = true;
  try { await page.goto(URL_, { waitUntil: 'load', timeout: 90000 }); } catch (e) { console.error('ページが取れない:', e.message); 終わり = 3; 開けた = false; }
  if (開けた) {
  await page.waitForTimeout(800);

  // 往復: 小さい写し（.hero_thumb_slider .slick-slide）を 1→最後→1 の順に押し、大きい写真（.hero_image_slider .slick-slide）がその枚だけ見えているか
  const 枚 = await page.$$eval('.hero_thumb_slider .slick-slide', xs => xs.length).catch(() => 0);
  const 大枚 = await page.$$eval('.hero_image_slider .slick-slide', xs => xs.length).catch(() => 0);
  if (!枚) 落ち.push('往復: .hero_thumb_slider に小さい写しが無い（空の型の作りが変わっている）');
  if (枚 !== 大枚) 落ち.push(`往復: 小さい写し ${枚} 枚と大きい写真 ${大枚} 枚の数が違う`);
  const 順 = [...Array(枚).keys()]; const 行き帰り = [...順, ...順.slice(0, -1).reverse()];
  for (const i of 行き帰り) {
    await page.evaluate(i => { const t = document.querySelectorAll('.hero_thumb_slider .slick-slide')[i]; t && t.click(); }, i);
    await page.waitForTimeout(400);
    const 見え = await page.$$eval('.hero_image_slider .slick-slide', ss => ss.map(s => { const r = s.getBoundingClientRect(); const st = getComputedStyle(s); const im = s.querySelector('img'); return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !!im && im.naturalWidth > 0 && s.classList.contains('slick-current'); }));
    const 見えた = 見え.map((v, k) => v ? k : -1).filter(k => k >= 0);
    if (見えた.length !== 1 || 見えた[0] !== i) { 落ち.push(`往復: ${i + 1}枚目の小さい写しを押したのに、大きい写真で見えているのが ${見えた.length ? 見えた.map(k => k + 1).join('・') + '枚目' : '0枚'}（絵が無いか、替わっていない）`); break; }
  }
  console.log(`往復: ${枚}枚を行き帰り ${行き帰り.length}回押した`);

  // カート: セットごとに入れて、合計がそのセットの値段と同じか・品数がセットの数と同じか
  if (!カートなし) {
    await page.waitForTimeout(1500);   // 商品データ（window.KATA_P。無い時は /products/<HANDLE>.js）を読み終わるのを待つ
    console.log(`商品データ: ページへの埋め込み（window.KATA_P）${await page.evaluate(() => !!(window.KATA_P && window.KATA_P.variants)) ? '有る' : '無い（開いた後に取りに行く形。置く時に chunk.mjs を通していない）'}`);
    const 印 = await page.evaluate(() => document.documentElement.getAttribute('data-kata-err'));
    // 計測: {{ content_for_header }} が入っているか・商品ページを開いた合図が出るか
    const 分析 = await page.evaluate(() => typeof window.ShopifyAnalytics === 'object' && !!window.ShopifyAnalytics);
    if (!分析) 落ち.push('計測: ページに {{ content_for_header }} が入っていない（window.ShopifyAnalytics が無い）。Shopify の分析と Meta のピクセルが商品ページに入らない。テンプレートが {% layout none %} の時は、</head> の前に {{ content_for_header }} を入れて置き直す（references/Shopifyに置く.md の手順4）');
    if (分析 && !ピクセルなし) for (const 名 of ['PageView', 'ViewContent']) { if (!(await 合図を待つ(名, 15))) 落ち.push(`計測: 商品ページを開いて15秒待っても、Meta の合図 ${名} が出ない（出た合図: ${合図.join('・') || '無し'}。Meta のピクセルを入れていない店は --ピクセルなし）`); }
    console.log(`計測: content_for_header ${分析 ? '有る' : '無い'} / 商品ページで出た合図 ${合図.join('・') || '無し'}`);
    if (印) {
      落ち.push(`カート: ${印}（HANDLE・型番の名前を見る。型番の名前に「<数><数え方>」が要る）`);
    } else {
      const セット = await page.$$eval('#tiers .tier', xs => xs.map(x => x.dataset.n));
      if (!セット.length) 落ち.push('カート: #tiers にセットが無い');
      for (const n of セット) {
        await page.evaluate(() => { const o = document.querySelector('#sizes [data-opt]'); if (o && !o.classList.contains('is-on')) o.click(); });
        await page.evaluate(n => document.querySelector(`#tiers .tier[data-n="${n}"]`).click(), n);
        await page.waitForTimeout(400);
        const 値段 = await page.$eval(`#tiers .tier[data-n="${n}"]`, e => String(e.dataset.price).replace(/[^\d]/g, ''));
        const 前 = await page.$eval('#kcTotal', e => e.textContent).catch(() => '');
        await page.evaluate(() => document.querySelector('#atc').click());
        // 合計の表示が変わるまで最大20秒待つ（変わらなければその時の表示で比べる）
        await page.waitForFunction(前 => { const e = document.querySelector('#kcTotal'); return e && e.textContent !== 前; }, 前, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(300);
        const 合計 = await page.$eval('#kcTotal', e => e.textContent.replace(/[^\d]/g, '')).catch(() => '');
        // 品数: カートの中身（/cart.js）の、型番の名前の数（「3個セット」の 3）×個数の合計
        const 品数 = await page.evaluate(async () => { try { const c = await (await fetch('/cart.js', { cache: 'no-store' })).json(); return String((c.items || []).reduce((a, it) => a + (Number((String(it.variant_title || '').match(/(\d+)/) || [])[1]) || 0) * it.quantity, 0)); } catch (e) { return ''; } });
        const 誤り = await page.$eval('#buyErr', e => e.hidden ? '' : e.textContent.trim()).catch(() => '');
        console.log(`カート: ${n}個のセット 値段 ${値段} → 合計 ${合計}（品数 ${品数}）${誤り ? ' 表示: ' + 誤り : ''}`);
        if (!合計 || 合計 !== 値段) 落ち.push(`カート: ${n}個のセットの合計 ${合計 || '取れない'} が値段 ${値段} と違う${誤り ? '（' + 誤り + '）' : ''}`);
        if (品数 !== String(n)) 落ち.push(`カート: ${n}個のセットを入れたのに品数が ${品数 || '取れない'}`);
        // カートの引き出しを撮る（参考のページにカートは無く、並べて見る係は見ない。回した人が Read で開いて、専門家の丸い写真で顔が分かるか・字が切れていないかを見る）
        if (n === セット[0]) { await page.locator('#kc').screenshot({ path: 'カートの引き出し.png' }).then(() => console.log('カートの絵: ' + process.cwd() + '/カートの引き出し.png')).catch(e => 落ち.push('カートの絵が撮れない: ' + e.message.slice(0, 80))); }
        if (n === セット[0] && 分析 && !ピクセルなし && !(await 合図を待つ('AddToCart', 10))) 落ち.push(`計測: カートに入れて10秒待っても、Meta の合図 AddToCart が出ない（出た合図: ${合図.join('・') || '無し'}）`);
        // 空にする
        await page.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST' }); });
        await page.waitForTimeout(3000);   // 間を空ける（続けて叩くと、店が 429 を返してカートに入らない）
      }
      if (セット.length) {
        const n = セット[0];
        const 値段 = await page.$eval(`#tiers .tier[data-n="${n}"]`, e => String(e.dataset.price).replace(/[^\d]/g, ''));
        const 選ぶ = async () => { await page.evaluate(() => { const o = document.querySelector('#sizes [data-opt]'); if (o && !o.classList.contains('is-on')) o.click(); }); await page.evaluate(n => document.querySelector(`#tiers .tier[data-n="${n}"]`).click(), n); await page.waitForTimeout(400); };
        // 失敗の時: カートに入れる通信を 429 にして押す → 引き出しが閉じていて、誤りの字が出ている
        await page.keyboard.press('Escape'); await page.waitForTimeout(600);
        await page.route(/\/cart\/add(\.js)?(\?|$)/, r => r.fulfill({ status: 429, contentType: 'text/plain', body: 'Too many requests' }));
        await 選ぶ(); await page.evaluate(() => document.querySelector('#atc').click()); await page.waitForTimeout(4000);
        const 失敗 = await page.evaluate(() => { const k = document.getElementById('kc'), e = document.getElementById('buyErr'); return { 開いている: !!k && k.classList.contains('open'), 字: e && !e.hidden ? e.textContent.trim() : '' }; });
        console.log(`失敗の時: 引き出し ${失敗.開いている ? '開いたまま' : '閉じている'} / 誤りの字「${失敗.字}」`);
        if (失敗.開いている) 落ち.push('失敗の時: /cart/add.js が失敗したのに、カートの引き出しが開いたまま残る（空の型の addToCart の catch で closeCart() を呼ぶ）');
        if (!失敗.字) 落ち.push('失敗の時: /cart/add.js が失敗したのに、誤りの字（#buyErr）が出ない');
        await page.unroute(/\/cart\/add(\.js)?(\?|$)/); await page.waitForTimeout(2500);
        // 押し直して入るか → そのまま会計の画面へ
        await page.evaluate(async () => { await fetch('/cart/clear.js', { method: 'POST' }); }); await page.waitForTimeout(2500);
        await 選ぶ(); const 前2 = await page.$eval('#kcTotal', e => e.textContent).catch(() => '');
        await page.evaluate(() => document.querySelector('#atc').click());
        await page.waitForFunction(前 => { const e = document.querySelector('#kcTotal'); return e && e.textContent !== 前; }, 前2, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const 合計2 = await page.$eval('#kcTotal', e => e.textContent.replace(/[^\d]/g, '')).catch(() => '');
        const 誤り2 = await page.$eval('#buyErr', e => e.hidden ? '' : e.textContent.trim()).catch(() => '');
        console.log(`押し直し: 合計 ${合計2 || '取れない'}${誤り2 ? ' 表示: ' + 誤り2 : ''}`);
        if (合計2 !== 値段) 落ち.push(`失敗の時: 失敗の後に同じページで押し直しても、合計 ${合計2 || '取れない'} が値段 ${値段} にならない${誤り2 ? '（' + 誤り2 + '）' : ''}`);
        // 会計: 会計の画面が開いて、そのセットの値段が画面に有る
        let 会計の番 = 0;
        try { const r = await page.goto(new URL('/checkout', page.url()).href, { waitUntil: 'load', timeout: 90000 }); 会計の番 = r ? r.status() : 0; } catch (e) { 会計の番 = 0; }
        await page.waitForTimeout(6000);
        const 会計の字 = (await page.evaluate(() => document.body.innerText).catch(() => '')).replace(/[\s,，]/g, '');
        const 値段が有る = new RegExp('[¥￥]' + 値段 + '(?!\\d)').test(会計の字);   // 「¥」の直後にその値段が来て、後ろに数字が続かない
        const 会計に居る = /\/checkouts\//.test(page.url());
        console.log(`会計: 返事 ${会計の番} / 会計の画面 ${会計に居る ? '開いた' : '開かない（' + page.url().slice(0, 80) + '）'} / 値段 ${値段} が画面に ${値段が有る ? '有る' : '無い'}`);
        if (会計の番 !== 200 || !会計に居る) 落ち.push(`会計: カートに ${n}個のセットを入れて /checkout を開いたのに、会計の画面が開かない（返事 ${会計の番}・${page.url().slice(0, 80)}）`);
        else if (!値段が有る) 落ち.push(`会計: 会計の画面に、カートに入れたセットの値段 ${値段} が無い`);
        if (会計に居る && 分析 && !ピクセルなし && !(await 合図を待つ('InitiateCheckout', 10))) 落ち.push(`計測: 会計の画面を開いて10秒待っても、Meta の合図 InitiateCheckout が出ない（出た合図: ${合図.join('・') || '無し'}）`);
        console.log(`計測: 全部で出た合図 ${[...new Set(合図)].join('・') || '無し'}`);
        await page.evaluate(async () => { try { await fetch('/cart/clear.js', { method: 'POST' }); } catch (e) {} }).catch(() => {});
      }
    }
  }
  }
} catch (e) {
  console.error('環境が壊れている: ' + e.message); 終わり = 4;
} finally {
  await browser.close();
}
if (終わり) { if (落ち.length) { console.log(`途中までに落ちた ${落ち.length}件`); 落ち.forEach(x => console.log(' - ' + x)); } process.exit(終わり); }
if (落ち.length) { console.log(`落ちた ${落ち.length}件`); 落ち.forEach(x => console.log(' - ' + x)); process.exit(1); }
console.log('通った');
