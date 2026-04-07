/* ═══════════════════════════════════════════════════════════
   OSHOWANI — SPLASH SCREEN v2.0
   File: splash.js

   Features:
   ✦ 220-particle 3D rotating sphere (Fibonacci distribution)
   ✦ Depth-sorted painter's algorithm + perspective projection
   ✦ Glow on near particles (shadowBlur — hardware accelerated)
   ✦ Sacred geometry mandala drawn on top
   ✦ Re-shows every time the app comes to foreground (≥30s
     in background) — works for TWA / Play Store APK / PWA
   ✦ CSS animations restart cleanly on every reshow
   ✦ pageshow (BFCache) restore handled
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Guard ─────────────────────────────────────────────── */
  var splash = document.getElementById('splash-screen');
  if (!splash) return;
  var mandalaCanvas = document.getElementById('splash-canvas');
  if (!mandalaCanvas) return;
  var mctx = mandalaCanvas.getContext('2d');
  var DPR  = window.devicePixelRatio || 1;

  /* ── Inject full-screen sphere canvas behind everything ─── */
  var sphereCanvas = document.createElement('canvas');
  sphereCanvas.id  = 'splash-sphere';
  splash.insertBefore(sphereCanvas, splash.firstChild);
  var sctx = sphereCanvas.getContext('2d');

  /* ══════════════════════════════════════════════════════════
     SIZING
  ══════════════════════════════════════════════════════════ */
  var S, SH, CX, CY, R, P;   /* mandala */
  var SW, SHGT;               /* sphere  */

  function setupCanvas() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    /* Mandala canvas */
    S  = Math.min(vw * 0.80, 320, vh * 0.50);
    SH = S * 1.26;
    mandalaCanvas.width  = Math.round(S  * DPR);
    mandalaCanvas.height = Math.round(SH * DPR);
    mandalaCanvas.style.width  = S  + 'px';
    mandalaCanvas.style.height = SH + 'px';
    mctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = S  / 2;
    CY = SH * 0.415;
    R  = S  * 0.405;
    P  = R  / 3;

    /* Sphere canvas — full viewport */
    SW   = vw;
    SHGT = vh;
    sphereCanvas.width  = Math.round(SW   * DPR);
    sphereCanvas.height = Math.round(SHGT * DPR);
    sphereCanvas.style.width  = SW   + 'px';
    sphereCanvas.style.height = SHGT + 'px';
    sctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  setupCanvas();

  /* ══════════════════════════════════════════════════════════
     3D SPHERE PARTICLES
     220 points distributed via Fibonacci / golden-angle method
     giving near-uniform coverage of the unit sphere.
  ══════════════════════════════════════════════════════════ */
  var N_PARTICLES = 220;
  var particles   = [];
  var GOLDEN      = Math.PI * (3.0 - Math.sqrt(5.0)); /* ≈ 2.3999 */

  for (var pi = 0; pi < N_PARTICLES; pi++) {
    var y0  = 1.0 - (pi / (N_PARTICLES - 1)) * 2.0;
    var r0  = Math.sqrt(Math.max(0, 1.0 - y0 * y0));
    var th0 = GOLDEN * pi;
    /* classify: 0=tiny  1=small  2=medium  3=large+glow */
    var rnd = Math.random();
    var cls = rnd < 0.38 ? 0 : rnd < 0.68 ? 1 : rnd < 0.88 ? 2 : 3;

    particles.push({
      ox: Math.cos(th0) * r0,
      oy: y0,
      oz: Math.sin(th0) * r0,
      cls: cls,
      ba: cls === 0 ? 0.14 + Math.random() * 0.18 :
          cls === 1 ? 0.28 + Math.random() * 0.26 :
          cls === 2 ? 0.48 + Math.random() * 0.30 :
                      0.68 + Math.random() * 0.28,
      sm: cls === 0 ? 0.28 + Math.random() * 0.22 :
          cls === 1 ? 0.55 + Math.random() * 0.38 :
          cls === 2 ? 0.90 + Math.random() * 0.55 :
                      1.55 + Math.random() * 0.80,
      warm: Math.random() < 0.25
    });
  }

  /* Rotation state */
  var rotY      = 0;
  var rotX      = 0.22;
  var sFrame    = 0;
  var ROT_Y_SPD = 0.00062; /* ~22 s / full revolution */

  /* Reusable projected-point array — avoids GC pressure */
  var proj = new Array(N_PARTICLES);
  for (var qi = 0; qi < N_PARTICLES; qi++) proj[qi] = {};

  function drawSphere(globalAlpha) {
    sctx.clearRect(0, 0, SW, SHGT);
    if (globalAlpha < 0.008) return;

    var scx      = SW * 0.5;
    var scy      = SHGT * 0.5;
    var sphereR  = Math.min(SW, SHGT) * 0.52;
    var FOV      = 2.6;
    var baseSize = Math.max(0.75, Math.min(SW, SHGT) * 0.0036);

    sFrame++;
    rotY += ROT_Y_SPD;
    rotX  = 0.22 + 0.06 * Math.sin(sFrame * 0.00038);

    var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    var cosX = Math.cos(rotX), sinX = Math.sin(rotX);

    /* ── Project all particles ───────────────────────────── */
    for (var i = 0; i < N_PARTICLES; i++) {
      var p  = particles[i];

      /* Y-axis rotation */
      var xr  = p.ox * cosY + p.oz * sinY;
      var zr  = -p.ox * sinY + p.oz * cosY;

      /* X-axis rotation */
      var yr2 = p.oy * cosX - zr * sinX;
      var zr2 = p.oy * sinX + zr * cosX;

      /* Perspective projection */
      var depth = FOV + zr2;
      var psc   = FOV / depth;
      var d01   = (zr2 + 1.0) * 0.5; /* 0=far, 1=near */

      var q = proj[i];
      q.sx   = scx + xr  * sphereR * psc;
      q.sy   = scy + yr2 * sphereR * psc;
      q.sz   = baseSize * p.sm * (0.22 + 0.78 * psc);
      q.al   = p.ba * (0.10 + 0.90 * d01) * globalAlpha;
      q.zz   = zr2;
      q.d01  = d01;
      q.cls  = p.cls;
      q.warm = p.warm;
    }

    /* ── Sort back-to-front (painter's algorithm) ────────── */
    proj.sort(function (a, b) { return a.zz - b.zz; });

    /* ── Draw ────────────────────────────────────────────── */
    for (var j = 0; j < N_PARTICLES; j++) {
      var q2 = proj[j];
      if (q2.al < 0.012 || q2.sz < 0.18) continue;

      sctx.save();

      /* Glow — large particles in the near hemisphere */
      if (q2.cls === 3 && q2.d01 > 0.52) {
        sctx.shadowBlur  = Math.max(3, q2.sz * 6);
        sctx.shadowColor = q2.warm
          ? 'rgba(218,155,50,'  + (q2.al * 0.95) + ')'
          : 'rgba(140,180,255,' + (q2.al * 0.90) + ')';
      } else if (q2.cls === 2 && q2.d01 > 0.68) {
        sctx.shadowBlur  = Math.max(2, q2.sz * 3);
        sctx.shadowColor = q2.warm
          ? 'rgba(210,145,40,'  + (q2.al * 0.65) + ')'
          : 'rgba(180,210,255,' + (q2.al * 0.55) + ')';
      }

      sctx.beginPath();
      sctx.arc(q2.sx, q2.sy, Math.max(0.25, q2.sz), 0, 6.2831853);
      sctx.fillStyle = q2.warm
        ? 'rgba(255,210,110,' + q2.al + ')'
        : 'rgba(255,255,255,' + q2.al + ')';
      sctx.fill();
      sctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════
     SACRED GEOMETRY MANDALA
  ══════════════════════════════════════════════════════════ */
  var gold  = function (a) { return 'rgba(196,118,36,' + a + ')'; };
  var goldB = function (a) { return 'rgba(222,158,60,' + a + ')'; };

  function arcProg(cx, cy, rad, prog, color, lw) {
    if (prog <= 0) return;
    var p   = prog > 1 ? 1 : prog;
    var len = 6.2831853 * rad;
    mctx.save();
    mctx.setLineDash([len * p, len]);
    mctx.lineDashOffset = 0;
    mctx.beginPath();
    mctx.arc(cx, cy, rad, -1.5707963, 4.7123889);
    mctx.strokeStyle = color;
    mctx.lineWidth   = lw;
    mctx.stroke();
    mctx.restore();
  }

  var easeOut = function (t) { var u = 1 - t; return 1 - u * u * u; };
  var clamp   = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var ph      = function (t, s, e) { return clamp((t - s) / (e - s), 0, 1); };

  function drawMandala(t) {
    mctx.clearRect(0, 0, S, SH);

    /* 1. Outer sphere ring — 18 circles */
    var outPh = ph(t, 0.00, 0.40), outD = R * 0.875;
    for (var oi = 0; oi < 18; oi++) {
      var oA = (oi / 18) * 6.2831853;
      var oP = easeOut(clamp(outPh * 18 - oi * 0.72, 0, 1));
      arcProg(CX + outD * Math.cos(oA), CY + outD * Math.sin(oA),
              P * 1.07, oP, gold(0.11 + oP * 0.05), 0.65);
    }

    /* 2. Converging stem lines */
    var stPh = easeOut(ph(t, 0.05, 0.46));
    mctx.save(); mctx.setLineDash([]);
    for (var li = 0; li < 14; li++) {
      var fr = li / 13, lA = Math.PI * (0.06 + 0.88 * fr);
      var sx = CX + R * 0.875 * Math.cos(lA), sy = CY + R * 0.875 * Math.sin(lA);
      mctx.beginPath(); mctx.moveTo(sx, sy);
      mctx.lineTo(sx + (CX - sx) * stPh, sy + (SH * 0.975 - sy) * stPh);
      mctx.strokeStyle = gold(0.055 + fr * 0.072);
      mctx.lineWidth   = 0.55; mctx.stroke();
    }
    mctx.restore();

    /* 3. Main outer bounding circle */
    arcProg(CX, CY, R * 0.955, easeOut(ph(t, 0.09, 0.50)), gold(0.40), 1.0);

    /* 4. Middle ring — 12 circles */
    var miPh = ph(t, 0.20, 0.58), miD = R * 0.645;
    for (var mi = 0; mi < 12; mi++) {
      var mA = (mi / 12) * 6.2831853;
      var mP = easeOut(clamp(miPh * 12 - mi * 0.58, 0, 1));
      arcProg(CX + miD * Math.cos(mA), CY + miD * Math.sin(mA),
              P, mP, gold(0.24 + mP * 0.07), 0.78);
    }

    /* 5. Flower of Life — centre + 6 petals */
    var flPh = ph(t, 0.40, 0.76);
    arcProg(CX, CY, P * 0.97, easeOut(ph(t, 0.40, 0.66)), gold(0.74), 1.0);
    for (var fi = 0; fi < 6; fi++) {
      var fA = (fi / 6) * 6.2831853;
      var fP = easeOut(clamp(flPh * 6 - fi * 0.68, 0, 1));
      arcProg(CX + P * Math.cos(fA), CY + P * Math.sin(fA),
              P * 0.97, fP, gold(0.70), 0.9);
    }

    /* 6. Inner mini-petals at P/2, offset 30° */
    var inPh = easeOut(ph(t, 0.56, 0.82));
    for (var ii = 0; ii < 6; ii++) {
      var iA = (ii / 6) * 6.2831853 + 0.5235988;
      var iP = easeOut(clamp(inPh * 6 - ii * 0.52, 0, 1));
      arcProg(CX + P * 0.50 * Math.cos(iA), CY + P * 0.50 * Math.sin(iA),
              P * 0.50, iP, goldB(0.50), 0.85);
    }

    /* 7. Centre filled sphere */
    var spPh = easeOut(ph(t, 0.60, 0.90));
    if (spPh > 0) {
      var gS = mctx.createRadialGradient(CX, CY, 0, CX, CY, P * 1.30);
      gS.addColorStop(0.00, 'rgba(222,158,60,' + (0.95 * spPh) + ')');
      gS.addColorStop(0.38, 'rgba(196,118,36,' + (0.74 * spPh) + ')');
      gS.addColorStop(0.72, 'rgba(152,80,12,'  + (0.44 * spPh) + ')');
      gS.addColorStop(1.00, 'rgba(70,25,0,0)');
      mctx.beginPath(); mctx.arc(CX, CY, P * 1.30, 0, 6.2831853);
      mctx.fillStyle = gS; mctx.fill();
    }

    /* 8. Centre glow burst */
    var glPh = easeOut(ph(t, 0.70, 1.00));
    if (glPh > 0) {
      var gG = mctx.createRadialGradient(CX, CY, 0, CX, CY, 30);
      gG.addColorStop(0.00, 'rgba(255,232,155,' + (0.94 * glPh) + ')');
      gG.addColorStop(0.28, 'rgba(255,200,100,' + (0.62 * glPh) + ')');
      gG.addColorStop(1.00, 'rgba(220,138,38,0)');
      mctx.beginPath(); mctx.arc(CX, CY, 30, 0, 6.2831853);
      mctx.fillStyle = gG; mctx.fill();

      var gD = mctx.createRadialGradient(CX, CY, 0, CX, CY, 4.5);
      gD.addColorStop(0, 'rgba(255,255,232,' + glPh + ')');
      gD.addColorStop(1, 'rgba(255,218,110,0)');
      mctx.beginPath(); mctx.arc(CX, CY, 4.5, 0, 6.2831853);
      mctx.fillStyle = gD; mctx.fill();
    }
  }

  /* ══════════════════════════════════════════════════════════
     ANIMATION LOOPS
  ══════════════════════════════════════════════════════════ */
  var DRAW_DUR = 2350;
  var MIN_SHOW = 3000;

  var t0        = null;
  var pulseT0   = null;
  var animId    = null;
  var dismissed = false;
  var isShowing = false;
  var appCalled = false;
  var timerDone = false;
  var minTimer  = null;
  var fallTimer = null;

  function tick(ts) {
    if (!t0) t0 = ts;
    var t = Math.min((ts - t0) / DRAW_DUR, 1);
    drawSphere(easeOut(ph(t, 0, 0.35)));
    drawMandala(t);
    if (t < 1) {
      animId = requestAnimationFrame(tick);
    } else {
      animId = requestAnimationFrame(pulseTick);
    }
  }

  function pulseTick(ts) {
    if (dismissed) return;
    if (!pulseT0) pulseT0 = ts;
    var el = ts - pulseT0;

    drawSphere(1.0);
    drawMandala(1);

    /* Breathing glow on centre point */
    var beat = 0.78 + 0.22 * Math.sin(el * 0.00248);
    var gr   = 24 + 10 * beat;
    var gP   = mctx.createRadialGradient(CX, CY, 0, CX, CY, gr);
    gP.addColorStop(0,    'rgba(255,232,155,' + (0.92 * beat) + ')');
    gP.addColorStop(0.32, 'rgba(255,200,100,' + (0.52 * beat) + ')');
    gP.addColorStop(1,    'rgba(220,138,38,0)');
    mctx.beginPath(); mctx.arc(CX, CY, gr, 0, 6.2831853);
    mctx.fillStyle = gP; mctx.fill();

    animId = requestAnimationFrame(pulseTick);
  }

  function startAnimation() {
    t0 = null; pulseT0 = null;
    if (animId) cancelAnimationFrame(animId);
    setTimeout(function () { animId = requestAnimationFrame(tick); }, 80);
  }

  function startTimers() {
    if (minTimer)  clearTimeout(minTimer);
    if (fallTimer) clearTimeout(fallTimer);
    minTimer = setTimeout(function () {
      timerDone = true;
      if (appCalled) doHide();
    }, MIN_SHOW);
    fallTimer = setTimeout(function () { doHide(); }, 6000);
  }

  /* ── Initial startup ────────────────────────────────────── */
  isShowing = true;
  startAnimation();
  startTimers();

  /* ── Dismiss ─────────────────────────────────────────────── */
  function doHide() {
    if (dismissed) return;
    dismissed = true;
    isShowing = false;
    if (animId) cancelAnimationFrame(animId);
    if (minTimer)  clearTimeout(minTimer);
    if (fallTimer) clearTimeout(fallTimer);
    splash.classList.add('splash-fade-out');
    setTimeout(function () { splash.style.display = 'none'; }, 900);
  }

  /* ── Public API ──────────────────────────────────────────── */
  window.hideSplash = function () {
    appCalled = true;
    if (timerDone) doHide();
  };

  /* ══════════════════════════════════════════════════════════
     RE-SHOW ON APP FOREGROUND (TWA / APK / PWA)
     Shows splash every time app resumes after ≥30s background
  ══════════════════════════════════════════════════════════ */
  var RESHOW_AFTER   = 30 * 1000;
  var backgroundedAt = null;

  function resetCSSAnimations() {
    var els = [
      splash.querySelector('.splash-title'),
      splash.querySelector('.splash-tagline'),
      mandalaCanvas
    ];
    els.forEach(function (el) {
      if (!el) return;
      el.style.animation = 'none';
      el.style.opacity   = '0';
      el.style.transform = el.classList && el.classList.contains('splash-title')
        ? 'translateY(-16px)' : '';
    });
    void splash.offsetHeight; /* force reflow */
    els.forEach(function (el) {
      if (!el) return;
      el.style.animation  = '';
      el.style.opacity    = '';
      el.style.transform  = '';
    });
  }

  function reshowSplash() {
    if (isShowing) return;
    isShowing = true;
    dismissed = false;
    appCalled = true;
    timerDone = false;

    splash.style.display = '';

    requestAnimationFrame(function () {
      splash.classList.remove('splash-fade-out');
      resetCSSAnimations();
      setupCanvas();
      startAnimation();
      startTimers();
    });
  }

  /* visibilitychange — fires on Home button / app switcher */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      backgroundedAt = Date.now();
    } else if (document.visibilityState === 'visible') {
      if (backgroundedAt !== null) {
        var away = Date.now() - backgroundedAt;
        backgroundedAt = null;
        if (away >= RESHOW_AFTER) reshowSplash();
      }
    }
  });

  /* pageshow — handles BFCache restores */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) reshowSplash();
  });

}());
