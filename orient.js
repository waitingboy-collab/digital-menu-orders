/* ---------- Наклон на телефона (жироскоп) ----------
   Публикува window.RadoTilt = { on, x, y } — наклон спрямо това как държиш телефона
   (x: наляво/надясно, y: напред/назад, от -1 до 1) и събитие "radotilt".
   Базата бавно се нагласява, така че ефектът реагира на промяната в наклона.
   На iPhone браузърът иска разрешение, затова се показва малък бутон. */
(function(){
  'use strict';
  var T = window.RadoTilt = { on:false, x:0, y:0 };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (reduce || !touch || !('DeviceOrientationEvent' in window)) return;

  var bx = null, by = 0, sx = 0, sy = 0, lastT = 0, RANGE = 22;
  function angle(){
    var a = (screen.orientation && typeof screen.orientation.angle === 'number') ? screen.orientation.angle : (window.orientation || 0);
    return ((a % 360) + 360) % 360;
  }
  function onOrient(e){
    if (e.beta == null || e.gamma == null) return;
    var a = angle(), gx, gy;
    if (a === 90){ gx = e.beta; gy = -e.gamma; }
    else if (a === 270){ gx = -e.beta; gy = e.gamma; }
    else { gx = e.gamma; gy = e.beta; }
    var now = performance.now(), dt = lastT ? Math.min(.1, (now - lastT) / 1000) : .016; lastT = now;
    if (bx === null){ bx = gx; by = gy; }
    var k = Math.min(1, dt * .45);            // базата догонва за ~2 секунди
    bx += (gx - bx) * k; by += (gy - by) * k;
    var tx = Math.max(-1, Math.min(1, (gx - bx) / RANGE));
    var ty = Math.max(-1, Math.min(1, (gy - by) / RANGE));
    sx += (tx - sx) * .25; sy += (ty - sy) * .25;
    T.x = sx; T.y = sy;
    if (!T.on){ T.on = true; if (btn){ btn.remove(); btn = null; } }
    window.dispatchEvent(new Event('radotilt'));
  }
  function listen(){ addEventListener('deviceorientation', onOrient, { passive:true }); }

  var btn = null;
  listen();                                   // Android и повечето браузъри: работи директно
  var needsAsk = typeof DeviceOrientationEvent.requestPermission === 'function';
  if (!needsAsk) return;

  var KEY = 'rado-tilt-dismissed';
  try { if (localStorage.getItem(KEY)) return; } catch(_){}
  function label(){ return document.documentElement.lang === 'bg' ? 'Наклони телефона — включи ефекта' : 'Tilt your phone — enable effect'; }
  btn = document.createElement('div');
  btn.className = 'tilt-ask';
  btn.innerHTML = '<button type="button" class="go"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.2" transform="rotate(-14 12 12)"/><path d="M3 9.5c-.8 1.7-.8 3.3 0 5M21 9.5c.8 1.7.8 3.3 0 5"/></svg><span></span></button><button type="button" class="x">×</button>';
  var span = btn.querySelector('span'), x = btn.querySelector('.x');
  function relabel(){ span.textContent = label(); x.setAttribute('aria-label', document.documentElement.lang === 'bg' ? 'Затвори' : 'Close'); }
  relabel();
  new MutationObserver(relabel).observe(document.documentElement, { attributes:true, attributeFilter:['lang'] });
  x.addEventListener('click', function(){ try { localStorage.setItem(KEY, '1'); } catch(_){} btn.remove(); });
  btn.querySelector('.go').addEventListener('click', function(){
    DeviceOrientationEvent.requestPermission().then(function(r){
      if (r !== 'granted') { try { localStorage.setItem(KEY, '1'); } catch(_){} }
      btn.remove();
    }).catch(function(){ btn.remove(); });
  });
  // бутонът е нужен само ако няма данни без разрешение (iPhone)
  setTimeout(function(){ if (!T.on && btn) document.body.appendChild(btn); }, 1800);
})();
