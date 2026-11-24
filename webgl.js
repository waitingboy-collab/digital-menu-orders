/* ---------- WebGL: порцеланова глазура ----------
   • Прозрачен слой зад менюто: фини кобалтови вълни като глазура върху порцелан
     (продължение на пръстените в началото), леко релефни и осветени.
   • Под мишката/пръста порцеланът изпъква като мънисто; при наклон на телефона
     мънистото се търкаля и се разтяга, докато се движи.
   • Слоят не зависи от скрола и се рисува рядко, когато нищо не се движи.
   • Без WebGL или при prefers-reduced-motion менюто изглежда както преди. */
(function(){
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;

  var cv = document.createElement('canvas');
  cv.id = 'gl-glaze'; cv.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(cv, document.body.firstChild);
  var gl = cv.getContext('webgl', { antialias:false, alpha:true, premultipliedAlpha:true, powerPreference:'low-power' });
  if (!gl){ cv.remove(); return; }
  var deriv = gl.getExtension('OES_standard_derivatives');

  var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var fs = [
  deriv ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_D 1' : '',
  'precision highp float;',
  'uniform vec2 uRes; uniform float uDpr; uniform float uTime;',
  'uniform vec2 uMouse; uniform vec2 uLight; uniform float uLens; uniform float uR; uniform vec3 uSq; uniform vec2 uLdir;',
  'const vec3 PORC = vec3(.953,.957,.969);',   // --porcelain
  'const vec3 SOFT = vec3(.902,.922,.980);',   // --glaze-soft
  'const vec3 COBALT = vec3(.118,.235,.706);', // --glaze
  'const vec3 INK = vec3(.071,.094,.200);',    // --ink
  'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
  'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);',
  '  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x), u.y); }',
  'float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<3;i++){ v+=a*noise(p); p=p*2.02+11.3; a*=.5; } return v; }',
  // глазурата: две системи от пръстени, леко изкривени
  'float glaze(vec2 v){',
  '  vec2 vp = uRes / uDpr; float t = uTime;',
  '  vec2 w = vec2(fbm(v/430. + t*.02), fbm(v/430. - t*.02 + 7.)) - .5;',
  '  vec2 q = v + w*110.;',
  '  vec2 c1 = vec2(vp.x*.5 + sin(t*.05)*60., -140.);',
  '  vec2 c2 = vec2(vp.x*1.1, vp.y*1.05 + cos(t*.04)*80.);',
  '  return sin(length(q - c1)/27. - t*.18) + .8*sin(length(q - c2)/33. + t*.13); }',
  'vec4 over(vec4 d, vec3 c, float a){ return vec4(c*a + d.rgb*(1.-a), a + d.a*(1.-a)); }',
  'void main(){',
  '  float px = 1./uDpr;',
  '  vec2 v = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;',
  '  vec4 o = vec4(0.);',
  // мънисто: разтегнато по посоката на движение
  '  vec2 dm = v - uMouse;',
  '  float sa = dot(dm, uSq.xy);',
  '  vec2 dq = uSq.xy * (sa / uSq.z) + (dm - uSq.xy * sa) * sqrt(uSq.z);',
  '  float rr = length(dq), R = uR, f = min(rr / R, 1.);',
  '  float inside = uLens > .01 ? 1. - smoothstep(R - 2., R, rr) : 0.;',
  // под мънистото глазурата се разтяга (лупа), по ръба се слива с околната
  '  vec2 g = inside > 0. ? uMouse + dm * mix(1., .55 + .45*f*f, uLens) : v;',
  '  float F = glaze(g);',
  '  float k = F*1.5; float cd = .5 - abs(fract(k)-.5);',
  '#ifdef HAS_D',
  '  float aw = fwidth(k)*.9;',
  '#else',
  '  float aw = .03;',
  '#endif',
  '  float line = 1. - smoothstep(aw*.4, aw*1.2, cd);',
  // релеф на глазурата, осветен от показалеца / наклона
  '#ifdef HAS_D',
  '  float Hh = F*.5;',
  '  float K = 18.*uDpr;',
  '  vec3 nn = normalize(vec3(-dFdx(Hh)*K, -dFdy(Hh)*K, 1.));',
  '  vec2 lp = vec2(uLight.x*uDpr, uRes.y - uLight.y*uDpr);',
  '  vec3 L = normalize(vec3(lp - gl_FragCoord.xy, 300.*uDpr));',
  '  float shd = (dot(nn, L) - L.z) * (1. - inside);',
  '  o = over(o, vec3(1.), clamp(shd*.5, 0., .07));',
  '  o = over(o, COBALT, clamp(-shd*.2, 0., .025));',
  '#endif',
  '  if (inside > 0.){',
  '    o = over(o, mix(vec3(1.), SOFT, .35), inside);',
  '    vec3 dn = normalize(vec3(dq / R * 1.15, sqrt(max(1. - f*f, 0.)) + .05));',
  '    vec3 Ld = normalize(vec3(uLdir, .66));',
  '    float ds = (dot(dn, Ld) - Ld.z) * uLens;',
  '    o = over(o, COBALT, inside * line * .16);',
  '    o = over(o, vec3(1.), inside * clamp(ds*.9, 0., .6));',
  '    o = over(o, INK, inside * clamp(-ds*.35, 0., .16));',
  '    float sp = pow(max(dot(dn, normalize(Ld + vec3(0.,0.,1.))), 0.), 40.);',
  '    o = over(o, vec3(1.), inside * sp * .7 * uLens);',
  // кобалтов ръб като на чиния
  '    float rim = 1. - smoothstep(.5, .5 + px*1.5, abs(rr - R*.86));',
  '    o = over(o, COBALT, inside * rim * .35 * uLens);',
  '  } else {',
  '    o = over(o, COBALT, line * .065);',
  '  }',
  // сянка на мънистото
  '  float outer = (uLens > .01 ? smoothstep(R + 22., R, rr) : 0.) * (1. - inside);',
  '  float side = clamp(dot(dm / max(length(dm), 1.), vec2(.6, .8)), 0., 1.);',
  '  o = over(o, INK, outer * (.05 + side * .12) * uLens);',
  '  gl_FragColor = o;',
  '}'].join('\n');

  function sh(t, s){ var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
    if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)){ console.warn(gl.getShaderInfoLog(o)); return null; } return o; }
  var a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
  if (!a || !b){ cv.remove(); return; }
  var pr = gl.createProgram(); gl.attachShader(pr, a); gl.attachShader(pr, b); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)){ cv.remove(); return; }
  gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {}; ['uRes','uDpr','uTime','uMouse','uLight','uLens','uR','uSq','uLdir'].forEach(function(n){ U[n] = gl.getUniformLocation(pr, n); });
  gl.clearColor(0, 0, 0, 0);
  root.classList.add('webgl');

  var W = 0, H = 0, dpr = 1, force = true;
  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, fine ? 1.5 : 1);
    W = Math.max(1, Math.round(cv.clientWidth * dpr)); H = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== W || cv.height !== H){ cv.width = W; cv.height = H; gl.viewport(0, 0, W, H); }
    force = true; kick();
  }
  function now(){ return performance.now() / 1000; }

  var mouse = { x:-999, y:-999 }, lens = 0, lensTarget = 0, lastHuman = -10, lastScroll = -10;
  var touching = false, lastTouchT = 0, mb = { vx:0, vy:0 }, lightX = -999, lightY = -999;
  function marbleOn(){ return !fine && window.RadoTilt && window.RadoTilt.on; }

  addEventListener('pointermove', function(e){
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    lastHuman = now(); mouse.x = e.clientX; mouse.y = e.clientY; lensTarget = 1; kick();
  }, { passive:true });
  document.addEventListener('mouseleave', function(){ lensTarget = 0; kick(); });
  function onTouch(e){
    var tt = e.touches && e.touches[0]; if (!tt) return;
    var t = now(), dt = Math.max(.008, t - lastTouchT);
    if (touching && e.type === 'touchmove'){ mb.vx = (tt.clientX - mouse.x) / dt; mb.vy = (tt.clientY - mouse.y) / dt; } else { mb.vx = mb.vy = 0; }
    lastTouchT = t; lastHuman = t; touching = true; mouse.x = tt.clientX; mouse.y = tt.clientY; lensTarget = 1; kick();
  }
  addEventListener('touchstart', onTouch, { passive:true });
  addEventListener('touchmove', onTouch, { passive:true });
  function endTouch(e){ if (!e.touches || !e.touches.length){ touching = false; if (!marbleOn()) lensTarget = 0; kick(); } }
  addEventListener('touchend', endTouch, { passive:true });
  addEventListener('touchcancel', endTouch, { passive:true });
  addEventListener('scroll', function(){ lastScroll = now(); }, { passive:true });
  addEventListener('radotilt', function(){
    if (!marbleOn()) return;
    if (mouse.x < -900){ mouse.x = cv.clientWidth * .72; mouse.y = cv.clientHeight * .4; }
    lensTarget = 1; kick();
  });

  var lastStep = 0;
  function stepMarble(t){
    var dt = Math.min(.05, lastStep ? t - lastStep : .016); lastStep = t;
    if (!marbleOn() || touching) return;
    var T = window.RadoTilt, vw = cv.clientWidth, vh = cv.clientHeight, m = 46;
    mb.vx += T.x * 2400 * dt; mb.vy += T.y * 2400 * dt;
    var fr = Math.exp(-1.7 * dt); mb.vx *= fr; mb.vy *= fr;
    mouse.x += mb.vx * dt; mouse.y += mb.vy * dt;
    if (mouse.x < m){ mouse.x = m; mb.vx = Math.abs(mb.vx) * .55; }
    if (mouse.x > vw - m){ mouse.x = vw - m; mb.vx = -Math.abs(mb.vx) * .55; }
    if (mouse.y < m + 20){ mouse.y = m + 20; mb.vy = Math.abs(mb.vy) * .55; }
    if (mouse.y > vh - m){ mouse.y = vh - m; mb.vy = -Math.abs(mb.vy) * .55; }
  }

  var raf = 0, t0 = now(), lastDraw = -1;
  function frame(){
    raf = 0;
    if (document.hidden) return;
    var t = now();
    stepMarble(t);
    lens += (lensTarget - lens) * (reduce ? 1 : .15);
    var vw = cv.clientWidth, vh = cv.clientHeight, lt = reduce ? 0 : (t - t0) * .25;
    var ltx = lens > .05 ? mouse.x : vw * .5 + Math.cos(lt) * vw * .45;
    var lty = lens > .05 ? mouse.y : vh * .4 + Math.sin(lt) * vh * .35;
    if (lightX < -900){ lightX = ltx; lightY = lty; }
    lightX += (ltx - lightX) * .2; lightY += (lty - lightY) * .2;
    var speed = Math.sqrt(mb.vx * mb.vx + mb.vy * mb.vy);
    var active = Math.abs(lens - lensTarget) > .01 || (lens > .01 && (t - lastHuman < .6 || touching || speed > 4)) || Math.abs(lightX - ltx) + Math.abs(lightY - lty) > 2;
    var scrolling = t - lastScroll < .25;
    var interval = active ? (scrolling ? 1 / 30 : 0) : (scrolling ? 1e9 : 1 / 12);
    if (force || reduce || t - lastDraw >= interval){
      force = false; lastDraw = t;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uDpr, dpr);
      gl.uniform1f(U.uTime, reduce ? 0 : t - t0);
      gl.uniform2f(U.uMouse, mouse.x, mouse.y);
      gl.uniform2f(U.uLight, lightX, lightY);
      gl.uniform1f(U.uLens, lens);
      gl.uniform1f(U.uR, fine ? 120 : 80);
      var st = marbleOn() ? 1 + Math.min(speed / 1600, .45) : 1;
      gl.uniform3f(U.uSq, speed > 1 ? mb.vx / speed : 1, speed > 1 ? mb.vy / speed : 0, st);
      var T = window.RadoTilt || { x:0, y:0 };
      gl.uniform2f(U.uLdir, -.45 - T.x * .7, -.6 - T.y * .7);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (!reduce || active) raf = requestAnimationFrame(frame);
  }
  function kick(){ if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  resize(); addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden){ force = true; kick(); } });
  cv.addEventListener('webglcontextlost', function(e){ e.preventDefault(); root.classList.remove('webgl'); cv.style.display = 'none'; });
})();
