/* 記事の計測（うちのタグ）。`計測を入れる.py` がこの型から記事のフォルダに keisoku.js を書く。直す時はこの型を直す。
   1 Clarity（店と同じ project）  2 Meta のピクセル（店と同じ番号）  3 店へのリンクに広告の印（fbclid・utm）を引き継ぐ
   記事ごとの名前は URL の先頭（例 yururing-adv-03.vercel.app なら yururing-adv-03）から自動で取る。
   確かめで開く時は URL に ?ec_qa=1 を付けると、Meta には送らず Clarity に印だけ付く。
   形はアルコットの記事（arukoto-adv.vercel.app）のタグを写した（2026-11-18）。 */
(function () {
  if (window.__ecKeisoku) return;
  window.__ecKeisoku = 1;

  var CLARITY = '__CLARITY__';
  var PIXEL = '__PIXEL__';
  var 店 = '__STORE__';
  var 記事名 = (location.hostname.split('.')[0] || 'adv').slice(0, 40);

  var Q = null;
  try { Q = new URLSearchParams(location.search); } catch (e) {}
  var QA = !!(Q && Q.get('ec_qa') === '1');

  /* ── 1 Clarity ── */
  try {
    if (!window.clarity) {
      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', CLARITY);
    }
    clarity('set', 'page', 'page:' + 記事名);
    clarity('set', '記事', 記事名);
    clarity('set', 'store', 店.split('.')[0]);
    if (QA) clarity('set', 'ec_qa', '1');
    if (Q) ['utm_source', 'utm_campaign', 'utm_content'].forEach(function (k) {
      if (Q.get(k)) clarity('set', k, Q.get(k));
    });
    if ((Q && Q.get('fbclid')) || /facebook|instagram/.test(document.referrer || '')) clarity('set', 'from', 'meta');
  } catch (e) {}

  /* ── 2 Meta のピクセル ── */
  if (!QA) {
    try {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', PIXEL);
      fbq('track', 'PageView');
      fbq('track', 'ViewContent', { content_name: 記事名, content_category: 'advertorial' });
    } catch (e) {}
  }

  /* ── 3 店へのリンクに広告の印（fbclid・utm）を引き継ぐ ──
     記事（vercel.app）と店はドメインが違うので、
     引き継がないと店のピクセルが「どの広告から来た人か」を知れない。 */
  function 引き継ぐ() {
    if (!Q) return;
    var 鍵 = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var 持ち物 = [];
    鍵.forEach(function (k) { var v = Q.get(k); if (v) 持ち物.push([k, v]); });
    if (!持ち物.length) return;
    var as = document.querySelectorAll('a[href*="' + 店 + '"]');
    for (var i = 0; i < as.length; i++) {
      try {
        var u = new URL(as[i].href);
        for (var j = 0; j < 持ち物.length; j++) {
          if (!u.searchParams.has(持ち物[j][0])) u.searchParams.set(持ち物[j][0], 持ち物[j][1]);
        }
        as[i].href = u.toString();
      } catch (e) {}
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', 引き継ぐ);
  else 引き継ぐ();

  /* ── 記事から店へ押した事を残す ── */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest('a[href*="' + 店 + '"]') : null;
    if (!a) return;
    var c = a.getAttribute('data-cta') || 'その他';
    try { if (!QA && typeof fbq === 'function') fbq('trackCustom', 'AdvToStore', { from: 記事名, cta: c }); } catch (x) {}
    try {
      if (typeof clarity === 'function') {
        clarity('set', 'CTA', c);
        clarity('event', 'CTA-' + c);
        clarity('upgrade', '記事から商品へ');
      }
    } catch (x) {}
  }, true);
})();
