(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.getElementById("field");
  var hud = document.getElementById("hud");
  var stormReadout = document.getElementById("storm-readout");
  var bridgeReadout = document.getElementById("bridge-readout");
  var typedMirror = document.getElementById("typed-mirror");
  var armBtn = document.getElementById("arm-audio");
  var clearBtn = document.getElementById("clear-field");
  var densUp = document.getElementById("density-up");
  var densDown = document.getElementById("density-down");

  if (!canvas) return;

  var flash = document.createElement("div");
  flash.className = "mode-flash";
  flash.setAttribute("aria-hidden", "true");
  document.body.appendChild(flash);

  var ctx = canvas.getContext("2d", { alpha: true });
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0;
  var H = 0;
  var particles = [];
  var glyphs = [];
  var ripples = [];
  var trails = [];
  var typed = "";
  var mode = "orbit";
  var prevMode = "orbit";
  var linkCount = 0;
  var pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false, px: 0, py: 0, down: false, downAt: 0 };
  var lastT = 0;
  var fps = 60;
  var frame = 0;
  var audio = null;
  var holdPulseAcc = 0;

  var baseCount = reduced
    ? 400
    : Math.min(2200, Math.floor((window.innerWidth * window.innerHeight) / 900));
  var COUNT = baseCount;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed(keepPositions) {
    var old = keepPositions ? particles.slice() : [];
    particles.length = 0;
    for (var i = 0; i < COUNT; i++) {
      if (old[i]) {
        particles.push(old[i]);
      } else {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          life: Math.random(),
        });
      }
    }
  }

  function setDensity(next) {
    COUNT = Math.max(200, Math.min(4000, next | 0));
    seed(true);
  }

  function setPointer(x, y, active) {
    if (pointer.active) {
      pointer.vx = x - pointer.px;
      pointer.vy = y - pointer.py;
    }
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = x;
    pointer.y = y;
    pointer.active = active;
    if (active && Math.hypot(pointer.vx, pointer.vy) > 2) {
      var life = Math.min(1, Math.hypot(pointer.vx, pointer.vy) / 20);
      trails.push({ x: x, y: y, a: 1, life: life });
      if (mode === "mirror") {
        trails.push({ x: twinX(x), y: y, a: 0.85, life: life });
      }
      while (trails.length > 64) trails.shift();
    }
  }

  function pulse(x, y, strength) {
    strength = strength || 1;
    ripples.push({
      x: x,
      y: y,
      r: 0,
      max: (180 + Math.random() * 120) * (0.7 + strength * 0.5),
      a: Math.min(1.2, strength),
    });
    if (mode === "mirror") {
      ripples.push({
        x: W - x,
        y: y,
        r: 0,
        max: (160 + Math.random() * 100) * (0.7 + strength * 0.5),
        a: Math.min(1, strength * 0.85),
      });
    }
    if (audio && audio.enabled) audio.click(x / W, strength);
  }

  function clearField() {
    typed = "";
    glyphs.length = 0;
    ripples.length = 0;
    trails.length = 0;
    if (typedMirror) typedMirror.textContent = "";
    seed(false);
    if (audio && audio.enabled) audio.key(36);
  }

  function flashMode() {
    flash.classList.add("on");
    window.setTimeout(function () {
      flash.classList.remove("on");
    }, 180);
  }

  function syncAudioButton() {
    if (!armBtn) return;
    var on = !!(audio && audio.enabled);
    armBtn.textContent = on ? "Sound on" : "Sound off";
    armBtn.classList.toggle("is-on", on);
    armBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  /* ── Web Audio ── */
  function createAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ac = new AC();
    var master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);

    var drone = ac.createOscillator();
    var droneGain = ac.createGain();
    var droneFilter = ac.createBiquadFilter();
    drone.type = "sawtooth";
    drone.frequency.value = 55;
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 180;
    droneGain.gain.value = 0.35;
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(master);
    drone.start();

    var lfo = ac.createOscillator();
    var lfoGain = ac.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain);
    lfoGain.connect(drone.frequency);
    lfo.start();

    var noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    var noise = ac.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    var noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 0.6;
    var noiseGain = ac.createGain();
    noiseGain.gain.value = 0;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();

    return {
      enabled: false,
      ac: ac,
      drone: drone,
      droneFilter: droneFilter,
      droneGain: droneGain,
      noiseGain: noiseGain,
      master: master,
      arm: function () {
        var self = this;
        return this.ac.resume().then(function () {
          self.enabled = true;
          self.master.gain.setTargetAtTime(0.12, self.ac.currentTime, 0.05);
        });
      },
      disarm: function () {
        var self = this;
        this.enabled = false;
        this.master.gain.setTargetAtTime(0.0001, this.ac.currentTime, 0.08);
        return this.ac.suspend().then(function () {
          return self;
        });
      },
      toggle: function () {
        if (this.enabled) return this.disarm();
        return this.arm();
      },
      setScroll: function (t) {
        if (!this.enabled) return;
        var f = 48 + t * 40;
        this.drone.frequency.setTargetAtTime(f, this.ac.currentTime, 0.4);
        this.droneFilter.frequency.setTargetAtTime(140 + t * 320, this.ac.currentTime, 0.5);
      },
      setMode: function (m) {
        if (!this.enabled) return;
        var storm = m === "storm" ? 0.045 : m === "bridge" ? 0.02 : 0.008;
        this.noiseGain.gain.setTargetAtTime(storm, this.ac.currentTime, 0.3);
        var droneLevel = m === "quiet" ? 0.12 : m === "storm" ? 0.45 : 0.35;
        this.droneGain.gain.setTargetAtTime(droneLevel, this.ac.currentTime, 0.35);
      },
      click: function (normX, strength) {
        if (!this.enabled) return;
        strength = strength || 1;
        var t0 = this.ac.currentTime;
        var osc = this.ac.createOscillator();
        var g = this.ac.createGain();
        osc.type = "triangle";
        osc.frequency.value = 220 + normX * 660;
        var peak = 0.35 * strength;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28 + strength * 0.12);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t0);
        osc.stop(t0 + 0.45);
      },
      key: function (code) {
        if (!this.enabled) return;
        var t0 = this.ac.currentTime;
        var osc = this.ac.createOscillator();
        var g = this.ac.createGain();
        osc.type = "square";
        osc.frequency.value = 110 + (code % 24) * 35;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t0);
        osc.stop(t0 + 0.2);
      },
      chime: function () {
        if (!this.enabled) return;
        var t0 = this.ac.currentTime;
        var osc = this.ac.createOscillator();
        var g = this.ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, t0);
        osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.35);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
        osc.connect(g);
        g.connect(this.master);
        osc.start(t0);
        osc.stop(t0 + 0.45);
      },
    };
  }

  function ensureAudio() {
    if (!audio) audio = createAudio();
    return audio;
  }

  function toggleSound() {
    var a = ensureAudio();
    if (!a) return;
    a.toggle().then(syncAudioButton);
  }

  /* ── Mode from scroll ── */
  function updateMode() {
    var stages = document.querySelectorAll(".stage[data-mode]");
    var best = "orbit";
    var bestScore = Infinity;
    var mid = window.innerHeight * 0.4;
    for (var i = 0; i < stages.length; i++) {
      var r = stages[i].getBoundingClientRect();
      var c = r.top + r.height * 0.35;
      var d = Math.abs(c - mid);
      if (d < bestScore && r.bottom > 0 && r.top < window.innerHeight) {
        bestScore = d;
        best = stages[i].getAttribute("data-mode") || best;
      }
    }
    if (best !== mode) {
      prevMode = mode;
      mode = best;
      flashMode();
      if (audio && audio.enabled) {
        audio.setMode(mode);
        audio.chime();
      }
    }
    var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    var t = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    if (audio) audio.setScroll(t);
  }

  function twinX(x) {
    return W - x;
  }

  function drawCursor(x, y, isTwin) {
    var pulseR = 10 + Math.sin(frame * 0.12) * 2;
    ctx.save();
    ctx.translate(x, y);
    if (isTwin) ctx.scale(-1, 1);

    ctx.beginPath();
    ctx.arc(0, 0, pulseR + 8, 0, Math.PI * 2);
    ctx.strokeStyle = isTwin ? "rgba(212,83,42,0.45)" : "rgba(14,18,16,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = isTwin ? "rgba(212,83,42,0.9)" : "rgba(14,18,16,0.85)";
    ctx.fill();

    ctx.strokeStyle = isTwin ? "rgba(212,83,42,0.75)" : "rgba(14,18,16,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -6);
    ctx.moveTo(0, 6);
    ctx.lineTo(0, 14);
    ctx.moveTo(-14, 0);
    ctx.lineTo(-6, 0);
    ctx.moveTo(6, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();

    if (isTwin) {
      ctx.fillStyle = "rgba(212,83,42,0.7)";
      ctx.font = "500 10px IBM Plex Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText("TWIN", 0, 28);
    }

    ctx.restore();
  }

  /* ── Simulation ── */
  function step(dt) {
    if (pointer.down) {
      holdPulseAcc += dt;
      if (holdPulseAcc > 0.28) {
        holdPulseAcc = 0;
        pulse(pointer.x, pointer.y, 0.55);
      }
    }

    var attract = mode === "warp" ? 0.18 : mode === "storm" ? -0.12 : mode === "bridge" ? 0.04 : 0.06;
    var damp = mode === "storm" ? 0.965 : mode === "bridge" ? 0.94 : 0.92;
    var noise = mode === "storm" ? 0.55 : mode === "grid" ? 0.05 : mode === "quiet" ? 0.04 : 0.12;
    var orbitPull = mode === "orbit" || mode === "quiet" ? 0.004 : 0;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var dx = pointer.x - p.x;
      var dy = pointer.y - p.y;
      var dist2 = dx * dx + dy * dy + 40;
      var force = attract * 9000 / dist2;

      if (pointer.active || mode === "warp") {
        p.vx += dx * force * dt;
        p.vy += dy * force * dt;
        p.vx += pointer.vx * 0.015;
        p.vy += pointer.vy * 0.015;
      }

      if (mode === "mirror" && pointer.active) {
        var mx = twinX(pointer.x) - p.x;
        var my = pointer.y - p.y;
        var md2 = mx * mx + my * my + 40;
        var mForce = attract * 9000 / md2;
        p.vx += mx * mForce * dt;
        p.vy += my * mForce * dt;
        /* twin velocity is mirrored on X */
        p.vx += -pointer.vx * 0.015;
        p.vy += pointer.vy * 0.015;
      }

      if (orbitPull) {
        var cx = W * 0.5 - p.x;
        var cy = H * 0.45 - p.y;
        p.vx += cx * orbitPull;
        p.vy += cy * orbitPull;
        p.vx += -cy * 0.002;
        p.vy += cx * 0.002;
      }

      if (mode === "grid") {
        var gx = Math.round(p.x / 28) * 28 - p.x;
        var gy = Math.round(p.y / 28) * 28 - p.y;
        p.vx += gx * 0.08;
        p.vy += gy * 0.08;
      }

      if (mode === "quiet") {
        p.vx *= 0.98;
        p.vy *= 0.98;
      }

      p.vx += (Math.random() - 0.5) * noise;
      p.vy += (Math.random() - 0.5) * noise;

      for (var r = 0; r < ripples.length; r++) {
        var rip = ripples[r];
        var rdx = p.x - rip.x;
        var rdy = p.y - rip.y;
        var rd = Math.sqrt(rdx * rdx + rdy * rdy) + 0.001;
        var band = Math.abs(rd - rip.r);
        if (band < 28) {
          var push = (1 - band / 28) * 2.2 * rip.a;
          p.vx += (rdx / rd) * push;
          p.vy += (rdy / rd) * push;
        }
      }

      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;

      if (p.x < -20) p.x = W + 20;
      if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20;
      if (p.y > H + 20) p.y = -20;
    }

    for (var g = glyphs.length - 1; g >= 0; g--) {
      var gl = glyphs[g];
      gl.life -= dt;
      gl.y -= 12 * dt;
      gl.x += gl.vx * dt;
      if (gl.life <= 0) glyphs.splice(g, 1);
    }

    for (var j = ripples.length - 1; j >= 0; j--) {
      var rp = ripples[j];
      rp.r += 220 * dt;
      rp.a -= dt * 0.7;
      if (rp.a <= 0 || rp.r > rp.max) ripples.splice(j, 1);
    }

    for (var t = trails.length - 1; t >= 0; t--) {
      trails[t].a -= dt * 1.4;
      if (trails[t].a <= 0) trails.splice(t, 1);
    }

    pointer.vx *= 0.85;
    pointer.vy *= 0.85;
  }

  function drawLinks() {
    linkCount = 0;
    if (mode !== "bridge" && mode !== "grid") return;
    var maxDist = mode === "bridge" ? 78 : 42;
    var maxDist2 = maxDist * maxDist;
    var stepN = mode === "bridge" ? 1 : 2;
    ctx.lineWidth = 1;
    for (var i = 0; i < particles.length; i += stepN) {
      var a = particles[i];
      var checked = 0;
      for (var j = i + 1; j < particles.length && checked < 18; j += stepN) {
        checked++;
        var b = particles[j];
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < maxDist2) {
          var alpha = (1 - d2 / maxDist2) * (mode === "bridge" ? 0.28 : 0.12);
          ctx.strokeStyle = "rgba(14,18,16," + alpha + ")";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          linkCount++;
        }
      }
    }
  }

  function draw() {
    var fade =
      mode === "storm"
        ? "rgba(232,226,214,0.10)"
        : mode === "bridge"
          ? "rgba(232,226,214,0.16)"
          : mode === "quiet"
            ? "rgba(232,226,214,0.28)"
            : "rgba(232,226,214,0.22)";
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);

    if (mode === "grid") {
      ctx.strokeStyle = "rgba(14,18,16,0.05)";
      ctx.lineWidth = 1;
      for (var x = 0; x < W; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (var y = 0; y < H; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    if (mode === "mirror") {
      ctx.strokeStyle = "rgba(14,18,16,0.12)";
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(W * 0.5, 0);
      ctx.lineTo(W * 0.5, H);
      ctx.stroke();
      ctx.setLineDash([]);
      drawCursor(pointer.x, pointer.y, false);
      drawCursor(twinX(pointer.x), pointer.y, true);
    }

    for (var tr = 0; tr < trails.length; tr++) {
      var trail = trails[tr];
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, 2 + trail.life * 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(198,255,61," + trail.a * 0.35 + ")";
      ctx.fill();
    }

    for (var i = 0; i < ripples.length; i++) {
      var rip = ripples[i];
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(212,83,42," + rip.a * 0.55 + ")";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawLinks();

    ctx.lineWidth = 1;
    for (var p = 0; p < particles.length; p++) {
      var a = particles[p];
      var speed = Math.min(1, Math.hypot(a.vx, a.vy) / 4);
      var ink = mode === "storm" ? "212,83,42" : mode === "bridge" ? "14,18,16" : "14,18,16";
      var accent = speed > 0.55 ? "198,255,61" : ink;
      ctx.strokeStyle = "rgba(" + accent + "," + (0.18 + speed * 0.55) + ")";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x - a.vx * 2.5, a.y - a.vy * 2.5);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(14,18,16,0.85)";
    ctx.font = "700 28px Syne, sans-serif";
    for (var g = 0; g < glyphs.length; g++) {
      var gl = glyphs[g];
      ctx.globalAlpha = Math.max(0, Math.min(1, gl.life));
      ctx.fillText(gl.ch, gl.x, gl.y);
      if (mode === "mirror") {
        ctx.globalAlpha = Math.max(0, Math.min(1, gl.life * 0.55));
        ctx.fillText(gl.ch, twinX(gl.x) - 10, gl.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    if (!lastT) lastT = t;
    var dt = Math.min(0.033, (t - lastT) / 1000);
    lastT = t;
    frame++;
    if (frame % 10 === 0) fps = Math.round(1 / (dt || 0.016));

    if (!reduced) step(dt);
    draw();

    if (hud) {
      hud.textContent =
        mode.toUpperCase() +
        " · " +
        particles.length +
        " agents · " +
        fps +
        " fps" +
        (audio && audio.enabled ? " · audio on" : " · audio silent");
    }
    if (stormReadout && mode === "storm") {
      stormReadout.textContent =
        "particles: " + particles.length + " · fps: " + fps + " · mode: storm · ripples: " + ripples.length;
    }
    if (bridgeReadout && mode === "bridge") {
      bridgeReadout.textContent = "links: " + linkCount + " · agents: " + particles.length;
    }

    requestAnimationFrame(loop);
  }

  /* ── Events ── */
  window.addEventListener("resize", function () {
    resize();
    seed(true);
  });

  window.addEventListener(
    "pointermove",
    function (e) {
      setPointer(e.clientX, e.clientY, true);
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerdown",
    function (e) {
      if (e.target.closest("a, button, input, textarea, .dock")) return;
      setPointer(e.clientX, e.clientY, true);
      pointer.down = true;
      pointer.downAt = performance.now();
      holdPulseAcc = 0;
      pulse(e.clientX, e.clientY, 1);
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerup",
    function () {
      if (pointer.down) {
        var held = (performance.now() - pointer.downAt) / 1000;
        if (held > 0.35) pulse(pointer.x, pointer.y, 1.4 + Math.min(1.5, held));
      }
      pointer.down = false;
      holdPulseAcc = 0;
    },
    { passive: true }
  );

  window.addEventListener(
    "pointerleave",
    function () {
      pointer.active = false;
      pointer.down = false;
    },
    { passive: true }
  );

  window.addEventListener(
    "scroll",
    function () {
      updateMode();
    },
    { passive: true }
  );

  window.addEventListener("keydown", function (e) {
    if (e.target.closest("input, textarea, button")) return;

    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      toggleSound();
      return;
    }

    if (e.key === "]") {
      setDensity(COUNT + 250);
      return;
    }
    if (e.key === "[") {
      setDensity(COUNT - 250);
      return;
    }

    if (e.key === "Escape") {
      clearField();
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      typed = typed.slice(0, -1);
      if (typedMirror) typedMirror.textContent = typed;
      glyphs.pop();
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      typed += e.key;
      if (typed.length > 48) typed = typed.slice(-48);
      if (typedMirror) typedMirror.textContent = typed;
      glyphs.push({
        ch: e.key,
        x: pointer.active ? pointer.x : W * 0.5 + (Math.random() - 0.5) * 120,
        y: pointer.active ? pointer.y : H * 0.45,
        vx: (Math.random() - 0.5) * 40,
        life: 2.2,
      });
      if (audio && audio.enabled) audio.key(e.key.charCodeAt(0));
      for (var i = 0; i < 12; i++) {
        var ang = Math.random() * Math.PI * 2;
        particles[(Math.random() * particles.length) | 0].vx += Math.cos(ang) * 3;
      }
    }
  });

  if (armBtn) {
    armBtn.addEventListener("click", function () {
      toggleSound();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", clearField);
  }

  if (densUp) {
    densUp.addEventListener("click", function () {
      setDensity(COUNT + 250);
    });
  }

  if (densDown) {
    densDown.addEventListener("click", function () {
      setDensity(COUNT - 250);
    });
  }

  resize();
  seed(false);
  pointer.x = W * 0.5;
  pointer.y = H * 0.4;
  syncAudioButton();
  updateMode();
  requestAnimationFrame(loop);
})();
