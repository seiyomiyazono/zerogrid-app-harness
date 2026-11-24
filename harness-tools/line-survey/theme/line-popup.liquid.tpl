{%- comment -%}
  line-popup — LINE無料診断ポップアップ（元の店の C案・1枚バナーを型にした物。tools/line-survey/scripts/use-product.mjs が埋める）
  ・サイト入場から {{ delay }} 秒後に1回だけ表示（sessionStorage で同一セッション内は再表示しない）
  ・右下の公式LINEアイコン（assets/line-brand-icon.png＝LINE公式ブランドアイコン（https://line.me/ja/logo の物を比率維持で縮小。元の店でも同じ物）、無加工・比率維持で縮小）は入場直後から常駐。押すとポップアップを再表示
  ・× / 背景タップ / Esc で即閉じ（アイコンは残る）
  ・バナー全体が友だち追加リンク（https://line.me/R/ti/p/@<basic_id>、別タブ）
  ・テーマエディタ内(Shopify.designMode)では出さない。既存のダイアログが開いている間は待つ
  ・画像: assets/__BANNER__（__BW__×__BH__。images/gen.mjs の popup.png から作る）
{%- endcomment -%}
{%- comment -%}記事LP(/pages/advertorial-*)は広告の着地ページ・A/Bテスト中のため出さない。出す場合はこのifを外す{%- endcomment -%}
__EXCLUDE_OPEN__
{%- assign wlp_delay_ms = __DELAY_MS__ -%}
{%- assign wlp_line_url = '__OA_URL__' -%}
{%- comment -%}LIFF経由にすると、広告クリックID（_fbc）をLINE側へ持ち越して購入まで帰属できる（2026-09-27）。空ならLINE直リンク{%- endcomment -%}
{%- assign wlp_liff_id = '__LIFF_ID__' -%}
<style>
  #wlp-root{--wlp-green:#06C755;font-family:"Noto Sans JP",-apple-system,BlinkMacSystemFont,sans-serif}
  #wlp-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(20,30,45,.55);display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;pointer-events:none;transition:opacity .3s ease}
  #wlp-root.is-open #wlp-overlay{opacity:1;pointer-events:auto}
  #wlp-card{position:relative;width:min(354px,100%);max-height:calc(100vh - 36px);max-height:calc(100dvh - 36px);border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 20px 50px rgba(0,0,0,.3);transform:translateY(16px) scale(.98);transition:transform .4s cubic-bezier(.2,.8,.2,1)}
  #wlp-root.is-open #wlp-card{transform:none}
  #wlp-link{display:block;line-height:0;-webkit-tap-highlight-color:transparent}
  #wlp-link img{display:block;width:100%;height:auto;max-height:calc(100vh - 36px);max-height:calc(100dvh - 36px);object-fit:contain;background:__SOFT__}
  #wlp-close{position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.94);border:0;padding:0;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);display:grid;place-items:center;color:#333;z-index:2}
  #wlp-close svg{width:16px;height:16px}
  #wlp-fab{position:fixed;right:14px;bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:2147482000;display:flex;align-items:center;gap:10px;cursor:pointer;-webkit-tap-highlight-color:transparent;background:none;border:0;padding:0}
  #wlp-fab .wlp-lbl{background:#fff;border-radius:999px;padding:7px 12px;font-size:12px;font-weight:900;color:__INK__;box-shadow:0 4px 14px rgba(0,0,0,.18);white-space:nowrap}
  #wlp-fab .wlp-ic{display:block;width:56px;height:56px;line-height:0}
  #wlp-fab .wlp-ic img{display:block;width:56px;height:56px}
  @media (prefers-reduced-motion:reduce){#wlp-overlay,#wlp-card,#wlp-fab{transition:none}}
  {%- if template contains 'product' -%}#wlp-fab{bottom:calc(112px + env(safe-area-inset-bottom,0px))}@media(min-width:990px){#wlp-fab{bottom:calc(18px + env(safe-area-inset-bottom,0px))}}{%- endif -%}
</style>
<div id="wlp-root" data-delay="{{ wlp_delay_ms }}" hidden>
  <div id="wlp-overlay" role="dialog" aria-modal="true" aria-label="LINE追加で無料診断">
    <div id="wlp-card">
      <button type="button" id="wlp-close" aria-label="閉じる"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg></button>
      <a id="wlp-link" href="{{ wlp_line_url }}" data-liff="{{ wlp_liff_id }}" target="_blank" rel="noopener" aria-label="LINE友だち追加（ここから追加）">
        <img src="{{ '__BANNER__' | asset_url }}" width="__BW__" height="__BH__" alt="__ALT__" loading="lazy" decoding="async">
      </a>
    </div>
  </div>
  <button type="button" id="wlp-fab" aria-label="LINE無料診断を開く">
    <span class="wlp-lbl">__FAB_LABEL__</span>
    <span class="wlp-ic"><img src="{{ 'line-brand-icon.png' | asset_url }}" width="176" height="176" alt="LINE" decoding="async"></span>
  </button>
</div>
<script>
(function(){
  if (window.Shopify && Shopify.designMode) return;
  var root = document.getElementById('wlp-root'); if (!root) return;
  var KEY = '__STORAGE_KEY__';
  var delay = parseInt(root.getAttribute('data-delay'), 10) || 5000;
  var closeBtn = document.getElementById('wlp-close');
  var overlay = document.getElementById('wlp-overlay');
  var fab = document.getElementById('wlp-fab');
  var link = document.getElementById('wlp-link');
  var store = { get: function(){ try { return sessionStorage.getItem(KEY); } catch(e){ return null; } }, set: function(v){ try { sessionStorage.setItem(KEY, v); } catch(e){} } };
  root.hidden = false;
  function open(){ root.classList.add('is-open'); store.set('shown'); }
  function close(){ root.classList.remove('is-open'); }
  function otherDialogOpen(){
    var els = document.querySelectorAll('[role="dialog"], dialog[open], .modal.is-open, .popup.is-open');
    for (var i = 0; i < els.length; i++) { var el = els[i]; if (root.contains(el)) continue; var r = el.getBoundingClientRect(); var cs = getComputedStyle(el); if (r.width > 40 && r.height > 40 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.1) return true; }
    return false;
  }
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && root.classList.contains('is-open')) close(); });
  fab.addEventListener('click', open);
  // LIFFの入口へ、広告クリックID（Metaピクセルの _fbc / URLの fbclid）と広告の識別（utm）を渡す。LINE側の端末に保存して購入時に復元する
  function ck(n){ var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function liffUrl(){
    var id = link.getAttribute('data-liff'); if (!id || id.indexOf('__') === 0) return null;
    var q = new URLSearchParams(location.search); var fbc = ck('_fbc'); var fbclid = q.get('fbclid') || (fbc ? fbc.split('.').slice(3).join('.') : '');
    var p = new URLSearchParams(); if (fbclid) p.set('fbclid', fbclid); var fbp = ck('_fbp'); if (fbp) p.set('fbp', fbp);
    var c = q.get('utm_content') || '', t = q.get('utm_term') || '', g = q.get('utm_campaign') || '';
    try { var ss = sessionStorage; if (c || t || g) ss.setItem('__AD_KEY__', JSON.stringify({ c: c, t: t, g: g })); else { var o = JSON.parse(ss.getItem('__AD_KEY__') || '{}'); c = o.c || ''; t = o.t || ''; g = o.g || ''; } } catch(e){}
    if (c) p.set('ad_content', c); if (t) p.set('ad_term', t); if (g) p.set('ad_campaign', g);
    var s = p.toString(); return 'https://liff.line.me/' + id + (s ? '?' + s : '');
  }
  try { var u0 = liffUrl(); if (u0) link.href = u0; } catch(e){}
  link.addEventListener('click', function(){ try { var u = liffUrl(); if (u) link.href = u; } catch(e){} setTimeout(close, 300); });
  if (store.get()) return;
  var tries = 0;
  function tryOpen(){ if (otherDialogOpen() && tries++ < 60) { setTimeout(tryOpen, 1000); return; } open(); }
  setTimeout(tryOpen, delay);
})();
</script>
__EXCLUDE_CLOSE__
