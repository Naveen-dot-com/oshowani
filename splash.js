/* ═══════════════════════════════════════════════════════════
   OSHOWANI — SPLASH SCREEN v3.0
   File: splash.js

   Core change:
   The central geometry is no longer drawn as plain line circles.
   It is built from rotating particle-cloud spheres / electron clouds.
   These clouds preserve the sacred composition while giving the
   centre a living volumetric feel.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var splash = document.getElementById('splash-screen');
  if (!splash) return;
  var canvas = document.getElementById('splash-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var DPR = Math.min(window.devicePixelRatio || 1, 2.2);

  var bgCanvas = document.createElement('canvas');
  bgCanvas.id = 'splash-sphere';
  splash.insertBefore(bgCanvas, splash.firstChild);
  var bg = bgCanvas.getContext('2d');

  var W = 0, H = 0, CX = 0, CY = 0, R = 0, P = 0, FULLH = 0, VW = 0, VH = 0;

  function setupCanvas() {
    VW = window.innerWidth;
    VH = window.innerHeight;

    W = Math.min(VW * 0.82, 332, VH * 0.50);
    FULLH = W * 1.28;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(FULLH * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = FULLH + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    bgCanvas.width = Math.round(VW * DPR);
    bgCanvas.height = Math.round(VH * DPR);
    bgCanvas.style.width = VW + 'px';
    bgCanvas.style.height = VH + 'px';
    bg.setTransform(DPR, 0, 0, DPR, 0, 0);

    CX = W / 2;
    CY = FULLH * 0.41;
    R = W * 0.405;
    P = R / 3;
  }
  setupCanvas();

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut(t) { var u = 1 - t; return 1 - u * u * u; }
  function phase(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }

  var GOLDEN = Math.PI * (3 - Math.sqrt(5));

  function makeSpherePoints(count, jitter) {
    var arr = [];
    for (var i = 0; i < count; i++) {
      var y = 1 - (i / (count - 1)) * 2;
      var radius = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = GOLDEN * i;
      var j = jitter || 0;
      var jx = 1 + (Math.random() - 0.5) * j;
      var jy = 1 + (Math.random() - 0.5) * j;
      var jz = 1 + (Math.random() - 0.5) * j;
      arr.push({
        x: Math.cos(theta) * radius * jx,
        y: y * jy,
        z: Math.sin(theta) * radius * jz,
        w: Math.random(),
        a: 0.55 + Math.random() * 0.45
      });
    }
    return arr;
  }

  var bgParticles = makeSpherePoints(240, 0.05).map(function (p) {
    //p.size = p.w < 0.72 ? 0.65 + Math.random() * 0.8 : 1.4 + Math.random() * 1.6;
     p.size = p.w < 0.72 ? 0.38 + Math.random() * 0.48 : 0.88 + Math.random() * 0.95;
    p.warm = Math.random() < 0.24;
    return p;
  });

  function makeCloud(spec) {
    return {
      cx: spec.cx,
      cy: spec.cy,
      r: spec.r,
      count: spec.count,
      rotY: spec.rotY || 0,
      rotX: spec.rotX || 0,
      speedY: spec.speedY || 0,
      wobble: spec.wobble || 0,
      baseAlpha: spec.baseAlpha || 0.5,
      warmBias: spec.warmBias || 0.75,
      points: makeSpherePoints(spec.count, spec.jitter || 0.18)
    };
  }

  var clouds = [];

  function buildClouds() {
    clouds = [];

    clouds.push(makeCloud({ cx: 0, cy: 0, r: P * 1.16, count: 340, speedY: 0.0010, wobble: 0.16, baseAlpha: 0.58, warmBias: 0.90, jitter: 0.16 }));

    for (var i = 0; i < 6; i++) {
      var a = (i / 6) * Math.PI * 2;
      clouds.push(makeCloud({
        cx: Math.cos(a) * P,
        cy: Math.sin(a) * P,
        r: P * 0.98,
        count: 170,
        rotY: a,
        rotX: 0.42,
        speedY: 0.0014 + i * 0.00008,
        wobble: 0.12,
        baseAlpha: 0.44,
        warmBias: 0.80,
        jitter: 0.22
      }));
    }

    for (var j = 0; j < 6; j++) {
      var b = (j / 6) * Math.PI * 2 + Math.PI / 6;
      clouds.push(makeCloud({
        cx: Math.cos(b) * P * 0.50,
        cy: Math.sin(b) * P * 0.50,
        r: P * 0.46,
        count: 80,
        rotY: b,
        rotX: 0.8,
        speedY: 0.0019 + j * 0.00006,
        wobble: 0.18,
        baseAlpha: 0.34,
        warmBias: 0.68,
        jitter: 0.30
      }));
    }
  }
  buildClouds();

  function drawDot(x, y, size, alpha, warm, blurMul) {
    if (alpha <= 0.01 || size <= 0.12) return;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    if (blurMul > 0) {
      ctx.shadowBlur = size * blurMul;
      ctx.shadowColor = warm
        ? 'rgba(234,171,70,' + Math.min(alpha, 0.95) + ')'
        : 'rgba(255,244,220,' + Math.min(alpha * 0.8, 0.8) + ')';
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = warm
      ? 'rgba(234,183,94,' + alpha + ')'
      : 'rgba(255,246,230,' + alpha + ')';
    ctx.fill();
  }

  function drawBgDot(x, y, size, alpha, warm, blur) {
    if (alpha <= 0.01 || size <= 0.08) return;
    bg.beginPath();
    bg.arc(x, y, size, 0, Math.PI * 2);
    bg.shadowBlur = blur;
    bg.shadowColor = warm
      ? 'rgba(212,150,54,' + Math.min(alpha * 0.9, 0.85) + ')'
      : 'rgba(255,255,255,' + Math.min(alpha * 0.6, 0.5) + ')';
    bg.fillStyle = warm
      ? 'rgba(255,210,120,' + alpha + ')'
      : 'rgba(255,255,255,' + alpha + ')';
    bg.fill();
  }

  function rotatePoint(px, py, pz, rx, ry) {
    var cosY = Math.cos(ry), sinY = Math.sin(ry);
    var x1 = px * cosY + pz * sinY;
    var z1 = -px * sinY + pz * cosY;

    var cosX = Math.cos(rx), sinX = Math.sin(rx);
    var y2 = py * cosX - z1 * sinX;
    var z2 = py * sinX + z1 * cosX;

    return { x: x1, y: y2, z: z2 };
  }

  function drawBackgroundSphere(progress, frame) {
    bg.clearRect(0, 0, VW, VH);
    if (progress <= 0.003) return;

    var list = [];
    var cx = VW * 0.5;
    var cy = VH * 0.53;
    var sr = Math.min(VW, VH) * 0.53;
    var ry = frame * 0.00062;
    var rx = 0.24 + 0.05 * Math.sin(frame * 0.00031);
    var fov = 2.5;
    //var base = Math.max(0.65, Math.min(VW, VH) * 0.0034);
     var base = Math.max(0.65, Math.min(VW, VH) * 0.0034);

    for (var i = 0; i < bgParticles.length; i++) {
      var p = bgParticles[i];
      var r = rotatePoint(p.x, p.y, p.z, rx, ry + p.w * 0.35);
      var scale = fov / (fov + r.z);
      var depth = (r.z + 1) * 0.5;
      list.push({
        x: cx + r.x * sr * scale,
        y: cy + r.y * sr * scale,
        z: r.z,
        s: base * p.size * (0.24 + 0.76 * scale),
        a: (0.08 + depth * 0.92) * p.a * progress,
        warm: p.warm,
        blur: p.size > 1.5 && depth > 0.55 ? base * 5.5 * scale : 0
      });
    }

    list.sort(function (a, b) { return a.z - b.z; });

    for (var j = 0; j < list.length; j++) {
      var d = list[j];
      drawBgDot(d.x, d.y, d.s, d.a, d.warm, d.blur);
    }

    bg.shadowBlur = 0;
  }

  function strokeConstellation(points, alpha) {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(205,138,56,' + alpha + ')';
    ctx.lineWidth = 0.7;
    for (var i = 1; i < points.length; i++) {
      if (Math.abs(points[i].z - points[i - 1].z) > 0.5) continue;
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawElectronCloud(cloud, frame, visibility, index) {
    var items = [];
    var ry = cloud.rotY + frame * cloud.speedY;
    var rx = cloud.rotX + Math.sin(frame * 0.0012 + index) * cloud.wobble;
    var fov = 2.8;

    for (var i = 0; i < cloud.points.length; i++) {
      var p = cloud.points[i];
      var rp = rotatePoint(p.x, p.y, p.z, rx, ry);
      var scale = fov / (fov + rp.z);
      var depth = (rp.z + 1) * 0.5;
      items.push({
        x: CX + cloud.cx + rp.x * cloud.r * scale,
        y: CY + cloud.cy + rp.y * cloud.r * scale,
        z: rp.z,
        s: (0.30 + p.w * 1.05) * (0.36 + 0.74 * scale),
        a: (cloud.baseAlpha * p.a) * (0.12 + 0.88 * depth) * visibility,
        warm: p.w < cloud.warmBias,
        glow: depth > 0.62 && p.w > 0.62 ? 4.8 : 0,
        depth: depth
      });
    }

    items.sort(function (a, b) { return a.z - b.z; });

    var front = [];
    for (var j = 0; j < items.length; j++) {
      var dot = items[j];
      if (dot.depth > 0.60 && dot.a > 0.08) front.push(dot);
      drawDot(dot.x, dot.y, dot.s, dot.a, dot.warm, dot.glow);
    }

    strokeConstellation(front.slice(0, 40), visibility * 0.05);
    ctx.shadowBlur = 0;
  }

  function drawOuterShells(t, frame) {
    var p1 = phase(t, 0.00, 0.44);
    var p2 = phase(t, 0.16, 0.58);
    var p3 = phase(t, 0.28, 0.70);

    function ringCloud(count, dist, radius, vis, speed, alphaBase) {
      if (vis <= 0.01) return;
      for (var i = 0; i < count; i++) {
        var ang = (i / count) * Math.PI * 2 + frame * speed;
        var cx = Math.cos(ang) * dist;
        var cy = Math.sin(ang) * dist;
        drawElectronCloud({
          cx: cx,
          cy: cy,
          r: radius,
          rotY: ang,
          rotX: 0.45,
          speedY: 0.001,
          wobble: 0.08,
          baseAlpha: alphaBase,
          warmBias: 0.84,
          points: makeSpherePoints(44, 0.24)
        }, frame, vis, i + 90);
      }
    }

    ringCloud(18, R * 0.875, P * 0.34, easeOut(p1) * 0.55, 0.00022, 0.14);
    ringCloud(12, R * 0.645, P * 0.26, easeOut(p2) * 0.52, -0.00030, 0.16);
    ringCloud(1, 0, R * 0.96, easeOut(p3) * 0.18, 0.00016, 0.06);
  }

  function drawStem(t) {
    var p = easeOut(phase(t, 0.08, 0.52));
    if (p <= 0) return;

    ctx.save();
    ctx.lineWidth = 0.58;
    for (var i = 0; i < 14; i++) {
      var fr = i / 13;
      var a = Math.PI * (0.06 + 0.88 * fr);
      var sx = CX + R * 0.875 * Math.cos(a);
      var sy = CY + R * 0.875 * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (CX - sx) * p, sy + (FULLH * 0.98 - sy) * p);
      ctx.strokeStyle = 'rgba(175,106,36,' + (0.06 + 0.08 * fr) + ')';
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCoreGlow(t, frame) {
    var p = easeOut(phase(t, 0.62, 1.00));
    if (p <= 0) return;

    var pulse = 0.82 + 0.18 * Math.sin(frame * 0.003);
    var g1 = ctx.createRadialGradient(CX, CY, 0, CX, CY, P * 1.55);
    g1.addColorStop(0, 'rgba(255,236,180,' + (0.22 * p * pulse) + ')');
    g1.addColorStop(0.42, 'rgba(227,158,62,' + (0.14 * p * pulse) + ')');
    g1.addColorStop(1, 'rgba(82,36,0,0)');
    ctx.beginPath();
    ctx.arc(CX, CY, P * 1.55, 0, Math.PI * 2);
    ctx.fillStyle = g1;
    ctx.fill();

    var g2 = ctx.createRadialGradient(CX, CY, 0, CX, CY, 26 + 7 * pulse);
    g2.addColorStop(0, 'rgba(255,248,225,' + (0.92 * p) + ')');
    g2.addColorStop(0.20, 'rgba(255,214,126,' + (0.66 * p) + ')');
    g2.addColorStop(1, 'rgba(223,142,43,0)');
    ctx.beginPath();
    ctx.arc(CX, CY, 26 + 7 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = g2;
    ctx.fill();
  }

  function drawMandala(t, frame) {
    ctx.clearRect(0, 0, W, FULLH);
    drawOuterShells(t, frame);
    drawStem(t);

    var centrePhase = easeOut(phase(t, 0.34, 0.88));
    for (var i = 0; i < clouds.length; i++) {
      var vis = centrePhase;
      if (i === 0) vis *= 1.0;
      else if (i <= 6) vis *= 0.92;
      else vis *= 0.86;
      drawElectronCloud(clouds[i], frame, vis, i);
    }

    drawCoreGlow(t, frame);
  }

  var DRAW_MS = 2550;
  var MIN_SHOW = 3000;
  var RESHOW_AFTER = 1000;

  var startTime = 0;
  var pulseStart = 0;
  var raf = 0;
  var dismissed = false;
  var isShowing = false;
  var appReady = false;
  var minDone = false;
  var minTimer = 0;
  var fallTimer = 0;
  var frame = 0;

  function animationFrame(ts) {
    if (!startTime) startTime = ts;
    frame = ts;
    var t = Math.min((ts - startTime) / DRAW_MS, 1);
    drawBackgroundSphere(easeOut(phase(t, 0, 0.35)), ts);
    drawMandala(t, ts);
    if (t < 1) {
      raf = requestAnimationFrame(animationFrame);
    } else {
      raf = requestAnimationFrame(pulseFrame);
    }
  }

  function pulseFrame(ts) {
    if (dismissed) return;
    if (!pulseStart) pulseStart = ts;
    frame = ts;
    drawBackgroundSphere(1, ts);
    drawMandala(1, ts);
    raf = requestAnimationFrame(pulseFrame);
  }

  function startAnimation() {
    startTime = 0;
    pulseStart = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(animationFrame);
  }

  function startTimers() {
    clearTimeout(minTimer);
    clearTimeout(fallTimer);
    minDone = false;
    minTimer = setTimeout(function () {
      minDone = true;
      if (appReady) hideNow();
    }, MIN_SHOW);
    fallTimer = setTimeout(hideNow, 6500);
  }

  function hideNow() {
    if (dismissed) return;
    dismissed = true;
    isShowing = false;
    cancelAnimationFrame(raf);
    clearTimeout(minTimer);
    clearTimeout(fallTimer);
    splash.classList.add('splash-fade-out');
    setTimeout(function () {
      splash.style.display = 'none';
    }, 900);
  }

  window.hideSplash = function () {
    appReady = true;
    if (minDone) hideNow();
  };

  function resetCssAnimations() {
    var list = [
      splash.querySelector('.splash-title'),
      splash.querySelector('.splash-tagline'),
      canvas
    ];

    list.forEach(function (el) {
      if (!el) return;
      el.style.animation = 'none';
      el.style.opacity = '0';
      el.style.transform = el.classList && el.classList.contains('splash-title') ? 'translateY(-16px)' : '';
    });

    void splash.offsetHeight;

    list.forEach(function (el) {
      if (!el) return;
      el.style.animation = '';
      el.style.opacity = '';
      el.style.transform = '';
    });
  }

  function reshowSplash() {
    if (isShowing) return;
    dismissed = false;
    isShowing = true;
    appReady = true;
    splash.style.display = '';
    requestAnimationFrame(function () {
      splash.classList.remove('splash-fade-out');
      setupCanvas();
      buildClouds();
      resetCssAnimations();
      startAnimation();
      startTimers();
    });
  }

  var backgroundedAt = null;

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

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) reshowSplash();
  });

  window.addEventListener('resize', function () {
    setupCanvas();
    buildClouds();
  }, { passive: true });

  isShowing = true;
  startAnimation();
  startTimers();
}());
