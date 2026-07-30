(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var bg = document.getElementById("bay-bg");
  var rail = document.getElementById("rail");
  var railHint = document.getElementById("rail-hint");
  var berthCount = document.getElementById("berth-count");
  var bayStatus = document.getElementById("bay-status");
  var bayClock = document.getElementById("bay-clock");
  var pingBtn = document.getElementById("ping-bay");
  var sandbox = document.getElementById("sandbox-canvas");
  var sandboxReadout = document.getElementById("sandbox-readout");

  var projects = [];
  var activeIndex = 0;
  var beacons = [];
  var pingUntil = 0;
  var pointer = { x: 0, y: 0 };

  /* ── Background schematic ── */
  function initBackground() {
    if (!bg || reduced) return;
    var ctx = bg.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0;
    var H = 0;
    var t = 0;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      bg.width = Math.floor(W * dpr);
      bg.height = Math.floor(H * dpr);
      bg.style.width = W + "px";
      bg.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now) {
      t = now * 0.001;
      ctx.clearRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(20,32,43,0.06)";
      ctx.lineWidth = 1;
      var step = 48;
      var ox = (pointer.x * 0.02) % step;
      var oy = (pointer.y * 0.02) % step;
      for (var x = -step + ox; x < W + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (var y = -step + oy; y < H + step; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      /* bay lanes */
      ctx.strokeStyle = "rgba(31,167,160,0.12)";
      ctx.lineWidth = 2;
      for (var i = 0; i < 4; i++) {
        var ly = H * 0.25 + i * H * 0.16;
        ctx.beginPath();
        ctx.moveTo(0, ly + Math.sin(t + i) * 4);
        ctx.lineTo(W, ly + Math.sin(t + i + 1) * 4);
        ctx.stroke();
      }

      /* radar sweep from bottom-right */
      var cx = W * 0.88;
      var cy = H * 0.82;
      var ang = t * 0.7;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, Math.min(W, H) * 0.35, ang, ang + 0.45);
      ctx.closePath();
      ctx.fillStyle = "rgba(196,92,38,0.05)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(196,92,38,0.55)";
      ctx.fill();

      if (now < pingUntil) {
        var age = 1 - (pingUntil - now) / 1200;
        ctx.beginPath();
        ctx.arc(cx, cy, 20 + age * 180, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(31,167,160," + (0.45 * (1 - age)) + ")";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener(
      "pointermove",
      function (e) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      },
      { passive: true }
    );
    requestAnimationFrame(draw);
  }

  /* ── Clock / status ── */
  function tickClock() {
    if (!bayClock) return;
    var d = new Date();
    bayClock.textContent = d.toTimeString().slice(0, 8);
  }

  /* ── Berths from projects.json ── */
  function statusLabel(s) {
    return s || "empty";
  }

  function renderBerths() {
    if (!rail) return;
    rail.innerHTML = "";

    projects.forEach(function (p, index) {
      var el = document.createElement(p.href ? "a" : "article");
      el.className = "berth";
      el.dataset.index = String(index);
      if (p.href) {
        el.href = p.href;
        if (/^https?:/i.test(p.href)) {
          el.target = "_blank";
          el.rel = "noopener";
        }
      }

      var tags = (p.tags || [])
        .map(function (t) {
          return "<span>" + escapeHtml(t) + "</span>";
        })
        .join("");

      var cta =
        p.status === "shipped" && p.href
          ? "Open shipped build →"
          : p.href
            ? "Enter berth →"
            : "Pad vacant";

      el.innerHTML =
        '<div class="berth-top">' +
        '<span class="berth-code">' +
        escapeHtml(p.code || "B-??") +
        "</span>" +
        '<span class="berth-status" data-status="' +
        escapeHtml(statusLabel(p.status)) +
        '">' +
        escapeHtml(statusLabel(p.status)) +
        "</span>" +
        "</div>" +
        "<h3>" +
        escapeHtml(p.title || "Untitled") +
        "</h3>" +
        "<p>" +
        escapeHtml(p.blurb || "") +
        "</p>" +
        '<div class="berth-tags">' +
        tags +
        "</div>" +
        '<div class="berth-cta">' +
        cta +
        "</div>";

      rail.appendChild(el);
    });

    if (berthCount) berthCount.textContent = String(projects.length);
    updateActiveBerth(0);
    updateBayStatus();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function updateBayStatus() {
    if (!bayStatus) return;
    var hot = projects.some(function (p) {
      return p.status === "hot";
    });
    var queued = projects.some(function (p) {
      return p.status === "queued";
    });
    bayStatus.textContent = hot ? "hot" : queued ? "queued work" : "standing by";
  }

  function updateActiveBerth(index) {
    var cards = rail ? rail.querySelectorAll(".berth") : [];
    if (!cards.length) return;
    activeIndex = ((index % cards.length) + cards.length) % cards.length;
    cards.forEach(function (card, i) {
      card.classList.toggle("is-active", i === activeIndex);
    });
    var p = projects[activeIndex];
    if (railHint && p) {
      railHint.textContent =
        p.code + " · " + p.title + " · " + statusLabel(p.status) + " · " + (activeIndex + 1) + "/" + projects.length;
    }
  }

  function scrollToBerth(index) {
    var cards = rail ? rail.querySelectorAll(".berth") : [];
    if (!cards.length) return;
    updateActiveBerth(index);
    cards[activeIndex].scrollIntoView({ behavior: reduced ? "auto" : "smooth", inline: "center", block: "nearest" });
  }

  function loadProjects() {
    return fetch("projects.json", { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("missing projects.json");
        return res.json();
      })
      .catch(function () {
        return [
          {
            id: "fallback",
            code: "B-00",
            title: "Offline berth",
            status: "empty",
            blurb: "Could not load projects.json. Serve this folder over HTTP to populate berths.",
            href: null,
            tags: ["local"],
          },
        ];
      })
      .then(function (data) {
        projects = Array.isArray(data) ? data : [];
        renderBerths();
      });
  }

  /* ── Sandbox floor ── */
  function initSandbox() {
    if (!sandbox) return;
    var ctx = sandbox.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    function size() {
      var cssW = sandbox.clientWidth || 800;
      var cssH = Math.max(220, Math.round(cssW * 0.42));
      sandbox.width = Math.floor(cssW * dpr);
      sandbox.height = Math.floor(cssH * dpr);
      sandbox.style.height = cssH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: cssW, h: cssH };
    }

    function draw() {
      var dim = size();
      var w = dim.w;
      var h = dim.h;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = "rgba(20,32,43,0.03)";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(20,32,43,0.08)";
      for (var x = 0; x < w; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (var y = 0; y < h; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      /* center pad */
      ctx.strokeStyle = "rgba(31,167,160,0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.18, h * 0.22, w * 0.64, h * 0.56);
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(196,92,38,0.35)";
      ctx.strokeRect(w * 0.28, h * 0.34, w * 0.44, h * 0.32);
      ctx.setLineDash([]);

      var now = performance.now();
      for (var i = beacons.length - 1; i >= 0; i--) {
        var b = beacons[i];
        var age = (now - b.t) / 1000;
        if (age > 4) {
          beacons.splice(i, 1);
          continue;
        }
        var a = 1 - age / 4;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4 + age * 28, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(31,167,160," + a * 0.7 + ")";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(196,92,38," + a + ")";
        ctx.fill();
      }

      if (sandboxReadout) {
        sandboxReadout.textContent = "beacons: " + beacons.length + " · click the floor";
      }
      requestAnimationFrame(draw);
    }

    sandbox.addEventListener("pointerdown", function (e) {
      var rect = sandbox.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * (sandbox.clientWidth || rect.width);
      var y = ((e.clientY - rect.top) / rect.height) * (parseFloat(sandbox.style.height) || rect.height);
      beacons.push({ x: x, y: y, t: performance.now() });
      if (beacons.length > 24) beacons.shift();
    });

    window.addEventListener("resize", function () {
      size();
    });

    requestAnimationFrame(draw);
  }

  /* ── Events ── */
  document.getElementById("rail-prev") &&
    document.getElementById("rail-prev").addEventListener("click", function () {
      scrollToBerth(activeIndex - 1);
    });

  document.getElementById("rail-next") &&
    document.getElementById("rail-next").addEventListener("click", function () {
      scrollToBerth(activeIndex + 1);
    });

  if (rail) {
    rail.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        scrollToBerth(activeIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        scrollToBerth(activeIndex - 1);
      }
    });

    rail.addEventListener(
      "scroll",
      function () {
        var cards = rail.querySelectorAll(".berth");
        if (!cards.length) return;
        var mid = rail.scrollLeft + rail.clientWidth / 2;
        var best = 0;
        var bestDist = Infinity;
        cards.forEach(function (card, i) {
          var c = card.offsetLeft + card.offsetWidth / 2;
          var d = Math.abs(c - mid);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        updateActiveBerth(best);
      },
      { passive: true }
    );
  }

  window.addEventListener("keydown", function (e) {
    if (e.target.closest("input, textarea, button, a")) return;
    if (e.key === "ArrowRight") scrollToBerth(activeIndex + 1);
    if (e.key === "ArrowLeft") scrollToBerth(activeIndex - 1);
  });

  if (pingBtn) {
    pingBtn.addEventListener("click", function () {
      pingUntil = performance.now() + 1200;
      if (bayStatus) {
        bayStatus.textContent = "ping";
        window.setTimeout(updateBayStatus, 1300);
      }
    });
  }

  initBackground();
  initSandbox();
  tickClock();
  window.setInterval(tickClock, 1000);
  loadProjects();
})();
