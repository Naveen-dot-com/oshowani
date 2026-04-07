/* ═══════════════════════════════════════════════════════════
   OSHOWANI — SPLASH SCREEN ANIMATION ENGINE
   File: splash.js  |  Drop alongside index.html + splash.css

   Animation sequence:
     0.00 s  ── Dark background appears (instant)
     0.30 s  ── Title slides in
     0.65 s  ── Canvas fades in; sacred geometry begins drawing
     0.90 s  ── Tagline fades in
     0.65 s–2.95 s  ── Circles draw themselves layer by layer
     2.95 s  ── Center sphere materialises; glow pulses
     ≥2.95 s ── Waits for app ready signal, then fades out
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Guard ─────────────────────────────────────────────── */
  var splash = document.getElementById('splash-screen');
  if (!splash) return;
  var canvas = document.getElementById('splash-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var DPR = window.devicePixelRatio || 1;

  /* ── Sizing ─────────────────────────────────────────────── */
  var S, SH, CX, CY, R, P;

  function setupCanvas() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    /* Canvas takes up most of the screen width, leaving room
       for title + tagline above and safe bottom margin */
    S  = Math.min(vw * 0.80, 320, vh * 0.50);
    SH = S * 1.26;            /* extra height for the stem below */
    canvas.width  = Math.round(S  * DPR);
    canvas.height = Math.round(SH * DPR);
    canvas.style.width  = S  + 'px';
    canvas.style.height = SH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = S  / 2;
    CY = SH * 0.415;   /* mandala centre — upper portion, stem below */
    R  = S  * 0.405;   /* outer bounding radius */
    P  = R  / 3;       /* petal / cell radius */
  }
  setupCanvas();

  /* ── Star field (pre-generated, fixed positions) ────────── */
  var STAR_COUNT = 48;
  var stars = [];
  /* Seed-style deterministic PRNG so stars don't shift on resize */
  var _sr = 0xDEADBEEF;
  function srnd() {
    _sr ^= _sr << 13; _sr ^= _sr >> 17; _sr ^= _sr << 5;
    return (_sr >>> 0) / 0xFFFFFFFF;
  }
  for (var si = 0; si < STAR_COUNT; si++) {
    stars.push({
      x: srnd() * S,
      y: srnd() * SH,
      r: srnd() * 1.35 + 0.18,
      a: srnd() * 0.50 + 0.12
    });
  }

  /* ── Colour helpers ─────────────────────────────────────── */
  var gold  = function(a) { return 'rgba(196,118,36,'  + a + ')'; };
  var goldB = function(a) { return 'rgba(222,158,60,'  + a + ')'; };
  var warm  = function(a) { return 'rgba(255,238,195,' + a + ')'; };

  /* ── Arc-draw helper with animated stroke-dash progress ─── */
  function arcProg(cx, cy, rad, prog, color, lw) {
    if (prog <= 0) return;
    var p   = prog > 1 ? 1 : prog;
    var len = 6.2831853 * rad;
    ctx.save();
    ctx.setLineDash([len * p, len]);
    ctx.lineDashOffset = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, -1.5707963, 4.7123889); /* -π/2 → 3π/2 */
    ctx.strokeStyle = color;
    ctx.lineWidth   = lw;
    ctx.stroke();
    ctx.restore();
  }

  /* ── Easing & phase utilities ───────────────────────────── */
  var easeOut = function(t) { var u = 1 - t; return 1 - u*u*u; };
  var clamp   = function(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  var ph      = function(t, s, e) { return clamp((t - s) / (e - s), 0, 1); };

  /* ══════════════════════════════════════════════════════════
     MAIN DRAW FRAME
     t = 0 … 1, spanning DRAW_DUR milliseconds
     Layer draw order matters for correct overlaps.
  ══════════════════════════════════════════════════════════ */
  function drawFrame(t) {
    ctx.clearRect(0, 0, S, SH);

    /* ── 1. Star particles ─────────────────────────────────── */
    var starA = easeOut(ph(t, 0, 0.30));
    for (var si = 0; si < stars.length; si++) {
      var st = stars[si];
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, 6.2831853);
      ctx.fillStyle = warm(st.a * starA);
      ctx.fill();
    }

    /* ── 2. Outer sphere ring — 18 overlapping circles ─────── */
    var outPh   = ph(t, 0.00, 0.40);
    var outDist = R * 0.875;
    for (var oi = 0; oi < 18; oi++) {
      var oAng = (oi / 18) * 6.2831853;
      var prog = easeOut(clamp(outPh * 18 - oi * 0.72, 0, 1));
      arcProg(
        CX + outDist * Math.cos(oAng),
        CY + outDist * Math.sin(oAng),
        P * 1.07, prog, gold(0.11 + prog * 0.05), 0.65
      );
    }

    /* ── 3. Bottom converging stem lines ───────────────────── */
    var stemPh  = easeOut(ph(t, 0.05, 0.46));
    var stemTipX = CX;
    var stemTipY = SH * 0.975;
    ctx.save();
    ctx.setLineDash([]);
    for (var li = 0; li < 14; li++) {
      var frac = li / 13;
      var lAng = Math.PI * (0.06 + 0.88 * frac);
      var sx   = CX + R * 0.875 * Math.cos(lAng);
      var sy   = CY + R * 0.875 * Math.sin(lAng);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (stemTipX - sx) * stemPh,
                 sy + (stemTipY - sy) * stemPh);
      ctx.strokeStyle = gold(0.055 + frac * 0.072);
      ctx.lineWidth   = 0.55;
      ctx.stroke();
    }
    ctx.restore();

    /* ── 4. Main outer bounding circle ─────────────────────── */
    arcProg(CX, CY, R * 0.955,
      easeOut(ph(t, 0.09, 0.50)), gold(0.40), 1.0);

    /* ── 5. Middle ring — 12 circles at ~2/3 R ─────────────── */
    var midPh   = ph(t, 0.20, 0.58);
    var midDist = R * 0.645;
    for (var mi = 0; mi < 12; mi++) {
      var mAng = (mi / 12) * 6.2831853;
      var mPrg = easeOut(clamp(midPh * 12 - mi * 0.58, 0, 1));
      arcProg(
        CX + midDist * Math.cos(mAng),
        CY + midDist * Math.sin(mAng),
        P, mPrg, gold(0.24 + mPrg * 0.07), 0.78
      );
    }

    /* ── 6. Inner Flower of Life — centre + 6 petals ───────── */
    var flPh = ph(t, 0.40, 0.76);
    /* Centre circle */
    arcProg(CX, CY, P * 0.97,
      easeOut(ph(t, 0.40, 0.66)), gold(0.74), 1.0);
    /* 6 petals */
    for (var fi = 0; fi < 6; fi++) {
      var fAng = (fi / 6) * 6.2831853;
      var fPrg = easeOut(clamp(flPh * 6 - fi * 0.68, 0, 1));
      arcProg(
        CX + P * Math.cos(fAng),
        CY + P * Math.sin(fAng),
        P * 0.97, fPrg, gold(0.70), 0.9
      );
    }

    /* ── 7. Inner mini-petals — 6 at P/2, rotated 30° ──────── */
    var inPh = easeOut(ph(t, 0.56, 0.82));
    for (var ii = 0; ii < 6; ii++) {
      var iAng = (ii / 6) * 6.2831853 + 0.5235988; /* +30° */
      var iPrg = easeOut(clamp(inPh * 6 - ii * 0.52, 0, 1));
      arcProg(
        CX + (P * 0.50) * Math.cos(iAng),
        CY + (P * 0.50) * Math.sin(iAng),
        P * 0.50, iPrg, goldB(0.50), 0.85
      );
    }

    /* ── 8. Centre filled sphere ────────────────────────────── */
    var spPh = easeOut(ph(t, 0.60, 0.90));
    if (spPh > 0) {
      var gSph = ctx.createRadialGradient(CX, CY, 0, CX, CY, P * 1.30);
      gSph.addColorStop(0.00, 'rgba(222,158,60,'  + (0.95 * spPh) + ')');
      gSph.addColorStop(0.38, 'rgba(196,118,36,'  + (0.74 * spPh) + ')');
      gSph.addColorStop(0.72, 'rgba(152,80,12,'   + (0.44 * spPh) + ')');
      gSph.addColorStop(1.00, 'rgba(70,25,0,0)');
      ctx.beginPath();
      ctx.arc(CX, CY, P * 1.30, 0, 6.2831853);
      ctx.fillStyle = gSph;
      ctx.fill();
    }

    /* ── 9. Centre glow burst ───────────────────────────────── */
    var glPh = easeOut(ph(t, 0.70, 1.00));
    if (glPh > 0) {
      /* Outer diffuse glow */
      var gGl = ctx.createRadialGradient(CX, CY, 0, CX, CY, 30);
      gGl.addColorStop(0.00, 'rgba(255,232,155,' + (0.94 * glPh) + ')');
      gGl.addColorStop(0.28, 'rgba(255,200,100,' + (0.62 * glPh) + ')');
      gGl.addColorStop(1.00, 'rgba(220,138,38,0)');
      ctx.beginPath();
      ctx.arc(CX, CY, 30, 0, 6.2831853);
      ctx.fillStyle = gGl;
      ctx.fill();
      /* Bright inner pin-point */
      var gDot = ctx.createRadialGradient(CX, CY, 0, CX, CY, 4.5);
      gDot.addColorStop(0,   'rgba(255,255,232,' + glPh + ')');
      gDot.addColorStop(1,   'rgba(255,218,110,0)');
      ctx.beginPath();
      ctx.arc(CX, CY, 4.5, 0, 6.2831853);
      ctx.fillStyle = gDot;
      ctx.fill();
    }
  }

  /* ══════════════════════════════════════════════════════════
     ANIMATION LOOP
  ══════════════════════════════════════════════════════════ */
  var DRAW_DUR = 2350;   /* ms: time for full geometry draw */
  var MIN_SHOW = 3000;   /* ms: minimum splash visible time */
  var t0       = null;
  var animId   = null;
  var dismissed = false;
  var appCalled = false;
  var timerDone = false;

  function tick(ts) {
    if (!t0) t0 = ts;
    var t = (ts - t0) / DRAW_DUR;
    if (t > 1) t = 1;
    drawFrame(t);
    if (t < 1) {
      animId = requestAnimationFrame(tick);
    } else {
      /* Draw complete — start pulsing glow */
      animId = requestAnimationFrame(pulse);
    }
  }

  /* ── Pulsing glow after draw completes ──────────────────── */
  var pulseT0 = null;
  function pulse(ts) {
    if (dismissed) return;
    if (!pulseT0) pulseT0 = ts;
    var elapsed = ts - pulseT0;
    /* Redraw static final frame */
    drawFrame(1);
    /* Overlay a breathing glow on the centre point */
    var beat = 0.78 + 0.22 * Math.sin(elapsed * 0.00248);
    var gr   = 24 + 10 * beat;
    var gP   = ctx.createRadialGradient(CX, CY, 0, CX, CY, gr);
    gP.addColorStop(0,   'rgba(255,232,155,' + (0.92 * beat) + ')');
    gP.addColorStop(0.32,'rgba(255,200,100,' + (0.52 * beat) + ')');
    gP.addColorStop(1,   'rgba(220,138,38,0)');
    ctx.beginPath();
    ctx.arc(CX, CY, gr, 0, 6.2831853);
    ctx.fillStyle = gP;
    ctx.fill();
    animId = requestAnimationFrame(pulse);
  }

  /* ── Start the draw animation (small delay lets CSS settle) */
  setTimeout(function() {
    animId = requestAnimationFrame(tick);
  }, 80);

  /* ── Minimum-show timer ──────────────────────────────────── */
  setTimeout(function() {
    timerDone = true;
    if (appCalled) doHide();
  }, MIN_SHOW);

  /* ── Internal hide function ─────────────────────────────── */
  function doHide() {
    if (dismissed) return;
    dismissed = true;
    if (animId) cancelAnimationFrame(animId);
    splash.classList.add('splash-fade-out');
    setTimeout(function() {
      splash.style.display = 'none';
    }, 880);
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API
     Call window.hideSplash() from app.js once the app is ready.
     The splash won't hide before MIN_SHOW ms regardless.
  ══════════════════════════════════════════════════════════ */
  window.hideSplash = function() {
    appCalled = true;
    if (timerDone) doHide();
    /* else: doHide() will be called by the timer above */
  };

  /* Safety fallback: auto-dismiss after 6 s no matter what */
  setTimeout(function() {
    doHide();
  }, 6000);

}());
