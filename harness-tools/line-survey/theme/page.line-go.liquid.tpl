{%- comment -%}
  line-go — LINEのBotから購入手続きへ進む前に踏む中継ページ（2026-09-27）
  ・URLの fbclid をMetaピクセルが _fbc として保存できるよう、通常のページを1回描画してから to へ進む
  ・to はストア内パスだけ許可（/cart/clear?... を想定）。ad_content/ad_term/ad_campaign は元の広告の記録用（注文の着地URLに残る）
{%- endcomment -%}
<style>#lg{max-width:420px;margin:0 auto;padding:70px 20px;text-align:center;font-family:"Noto Sans JP",-apple-system,sans-serif;color:#12335a}#lg h1{font-size:18px;margin:0 0 10px}#lg p{font-size:13px;color:#3b4b5e;line-height:1.8}#lg a{color:#1c65ad}</style>
<div id="lg"><h1>購入手続きへ進んでいます…</h1><p id="lg-p">そのままお待ちください。</p></div>
<script>
(function(){
  var q = new URLSearchParams(location.search); var to = q.get('to') || '__PRODUCT_PATH__';
  if (!/^\/(cart|checkout|products|pages)\b/.test(to) || /^\/\//.test(to)) to = '__PRODUCT_PATH__';
  document.getElementById('lg-p').innerHTML = '進まない場合は <a href="' + to.replace(/"/g, '') + '">こちら</a>';
  var go = function(){ location.replace(to); };
  // ピクセルのページ表示イベントが送られるまで少し待つ
  if (document.readyState === 'complete') setTimeout(go, 1500); else window.addEventListener('load', function(){ setTimeout(go, 1500); });
})();
</script>
