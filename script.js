(function () {
  "use strict";

  var list = document.getElementById("projects");
  var tally = document.getElementById("tally");

  var STATUS_LABELS = {
    hot: "In progress",
    queued: "Up next",
    shipped: "Shipped",
    empty: "Open",
  };

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Deterministic random so the art looks the same on every load */
  function seeded(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function r1(n) {
    return Math.round(n * 10) / 10;
  }

  /* ── Project art (200×200 inline SVG) ── */

  /* A wireframe mesh on a table, with the camera's orbit around it */
  function scanArt() {
    var out = '<ellipse class="art-faint" cx="100" cy="142" rx="74" ry="18" stroke-dasharray="3 4"/>';
    var R = 50;
    var squash = 0.28;

    function point(phi, th) {
      var r = R * Math.cos(phi);
      return r1(100 + r * Math.cos(th)) + " " + r1(138 - R * Math.sin(phi) + r * squash * Math.sin(th));
    }

    /* Draws a curve, solid where it faces the viewer and faint behind */
    function curve(fn, steps) {
      var front = "";
      var back = "";
      for (var i = 0; i < steps; i++) {
        var a = fn(i / steps);
        var b = fn((i + 1) / steps);
        var seg = "M" + point(a[0], a[1]) + "L" + point(b[0], b[1]);
        if (Math.sin((a[1] + b[1]) / 2) >= 0) front += seg;
        else back += seg;
      }
      return (
        '<path class="art-faint" d="' + back + '" stroke-width="1"/>' +
        '<path class="art-stroke" d="' + front + '" stroke-width="1.3" stroke-linecap="round"/>'
      );
    }

    for (var k = 0; k < 5; k++) {
      var phi = (k / 5) * (Math.PI / 2);
      out += curve(function (t) { return [phi, t * Math.PI * 2]; }, 36);
    }
    for (var m = 0; m < 10; m++) {
      var th = (m / 10) * Math.PI * 2 + 0.2;
      out += curve(function (t) { return [t * (Math.PI / 2), th]; }, 10);
    }
    out +=
      '<ellipse class="art-accent-stroke" cx="100" cy="112" rx="86" ry="30" stroke-width="1.5" stroke-dasharray="2 5"/>' +
      '<path class="art-accent-stroke" d="M36 125 L84 102 M36 131 L86 150" stroke-width="1" opacity="0.6"/>' +
      '<rect class="art-accent" x="18" y="122" width="18" height="12" rx="2" transform="rotate(-12 27 128)"/>';
    return out;
  }

  /* A resistor with its bands read and a detection box around it */
  function resistorArt() {
    var bands = [
      [68, "#7a4a21"],
      [84, "#1b1b1b"],
      [100, "#c92a2a"],
      [126, "#c9a227"],
    ];
    var out =
      '<line class="art-stroke" x1="14" y1="100" x2="186" y2="100" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="52" y="80" width="96" height="40" rx="18" fill="#e3c99a"/>';
    bands.forEach(function (b) {
      out += '<rect x="' + b[0] + '" y="80.5" width="7" height="39" fill="' + b[1] + '"/>';
    });
    out +=
      '<rect class="art-accent-stroke" x="42" y="66" width="116" height="68" rx="4" stroke-width="2"/>' +
      '<rect class="art-accent" x="42" y="45" width="62" height="18" rx="3"/>' +
      '<text class="art-label" x="50" y="58">1.0 kΩ</text>' +
      '<text class="art-caption" x="42" y="154">brn blk red gld</text>';
    return out;
  }

  /* An audio waveform, partly downloaded */
  function downloadArt() {
    var rand = seeded(7);
    var out = "";
    var x0 = 34;
    var width = 132;
    var done = 0.64;
    for (var x = x0; x <= x0 + width; x += 6) {
      var env = Math.sin(((x - x0) / width) * Math.PI);
      var h = 6 + (0.35 + rand() * 0.65) * 50 * env;
      var cls = x < x0 + width * done ? "art-accent-stroke" : "art-stroke";
      out +=
        '<line class="' + cls + '" x1="' + x + '" y1="' + r1(84 - h / 2) + '" x2="' + x + '" y2="' + r1(84 + h / 2) +
        '" stroke-width="3.2" stroke-linecap="round"' + (cls === "art-stroke" ? ' opacity="0.3"' : "") + "/>";
    }
    out +=
      '<rect class="art-track" x="' + x0 + '" y="132" width="' + width + '" height="6" rx="3"/>' +
      '<rect class="art-accent" x="' + x0 + '" y="132" width="' + r1(width * done) + '" height="6" rx="3"/>' +
      '<text class="art-caption" x="' + x0 + '" y="158">m4a · 64%</text>' +
      '<text class="art-caption" x="' + (x0 + width) + '" y="158" text-anchor="end">3.1 MB</text>';
    return out;
  }

  /* A field of static */
  function noiseArt() {
    var rand = seeded(42);
    var out = "";
    var cell = 16;
    var gap = 3;
    var start = (200 - (9 * cell + 8 * gap)) / 2;
    for (var row = 0; row < 9; row++) {
      for (var col = 0; col < 9; col++) {
        var v = rand();
        var x = start + col * (cell + gap);
        var y = start + row * (cell + gap);
        if (v < 0.03) {
          out += '<rect class="art-accent" x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell + '" rx="2"/>';
        } else if (v > 0.2) {
          out +=
            '<rect class="art-ink" x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell +
            '" rx="2" opacity="' + r1(Math.pow(v, 2.2) * 0.9) + '"/>';
        }
      }
    }
    return out;
  }

  /* A camera crosshair over colored shapes, with the named reading below */
  function swatchArt() {
    return (
      '<circle cx="70" cy="76" r="34" fill="#e9c46a"/>' +
      '<circle cx="128" cy="88" r="40" fill="#2a9d8f"/>' +
      '<circle cx="90" cy="122" r="24" fill="#e76f51"/>' +
      '<circle cx="128" cy="88" r="13" fill="none" stroke="#fff" stroke-width="2.5"/>' +
      '<path d="M128 69v10M128 97v10M109 88h10M137 88h10" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>' +
      '<circle cx="64" cy="70" r="5" fill="#fff" stroke="#15171a" stroke-width="1.5"/>' +
      '<rect class="art-panel" x="30" y="150" width="140" height="30" rx="6"/>' +
      '<rect x="38" y="157" width="16" height="16" rx="3" fill="#2a9d8f"/>' +
      '<text class="art-name" x="62" y="170">Teal</text>' +
      '<text class="art-caption" x="162" y="169" text-anchor="end">#2A9D8F</text>'
    );
  }

  /* An old phone on its side, showing dashboard tiles */
  function dashArt() {
    return (
      '<rect class="art-stroke" x="14" y="46" width="172" height="108" rx="16" stroke-width="2.5"/>' +
      '<circle class="art-ink" cx="176" cy="100" r="2.2"/>' +
      '<rect class="art-panel" x="28" y="58" width="80" height="84" rx="6"/>' +
      '<text class="art-clock" x="68" y="102" text-anchor="middle">07:42</text>' +
      '<text class="art-caption" x="68" y="120" text-anchor="middle">Sun · 25 Oct</text>' +
      '<rect class="art-panel" x="114" y="58" width="54" height="40" rx="6"/>' +
      '<circle class="art-accent" cx="127" cy="78" r="5.5"/>' +
      '<path class="art-accent-stroke" d="M127 68v-2M127 88v2M117 78h-2M137 78h2" stroke-width="1.5" stroke-linecap="round"/>' +
      '<text class="art-name" x="163" y="83" text-anchor="end">18°</text>' +
      '<rect class="art-panel" x="114" y="102" width="54" height="40" rx="6"/>' +
      '<text class="art-caption" x="121" y="118">timer</text>' +
      '<rect class="art-track" x="121" y="126" width="40" height="5" rx="2.5"/>' +
      '<rect class="art-accent" x="121" y="126" width="26" height="5" rx="2.5"/>'
    );
  }

  function fallbackArt() {
    return (
      '<circle class="art-faint" cx="100" cy="100" r="44" stroke-width="1.5"/>' +
      '<path class="art-faint" d="M100 40v120M40 100h120" stroke-width="1.5"/>' +
      '<circle class="art-accent" cx="100" cy="100" r="5"/>'
    );
  }

  var ART = {
    scan: scanArt,
    resistor: resistorArt,
    download: downloadArt,
    noise: noiseArt,
    swatch: swatchArt,
    dash: dashArt,
  };

  function artSvg(name) {
    var draw = ART[name] || fallbackArt;
    return '<svg viewBox="0 0 200 200" role="presentation" focusable="false">' + draw() + "</svg>";
  }

  /* ── Rendering ── */

  function formatUpdated(value) {
    var m = /^(\d{4})-(\d{2})/.exec(value || "");
    if (!m) return "";
    return "Updated " + MONTHS[parseInt(m[2], 10) - 1] + " " + m[1];
  }

  function isSlot(p) {
    return !p.href && (p.status === "queued" || p.status === "empty" || !p.status);
  }

  function renderProject(p, number) {
    var status = STATUS_LABELS[p.status] ? p.status : "empty";
    var slot = isSlot(p);
    var li = document.createElement("li");
    li.className = "project" + (slot ? " project--slot" : "");

    var meta = "";
    if (!slot) meta += "<span>" + (number < 10 ? "0" : "") + number + "</span>";
    meta += '<span class="status" data-status="' + status + '">' + STATUS_LABELS[status] + "</span>";
    var updated = formatUpdated(p.updated);
    if (updated) meta += "<span>" + updated + "</span>";

    var tags = (p.tags || [])
      .map(function (t) {
        return "<li>" + escapeHtml(t) + "</li>";
      })
      .join("");

    var action = "";
    if (p.href) {
      var external = /^https?:/i.test(p.href);
      action =
        '<a href="' + escapeHtml(p.href) + '"' + (external ? ' target="_blank" rel="noopener"' : "") + ">" +
        (status === "shipped" ? "Open it" : "Open the build") + (external ? " ↗" : " →") + "</a>";
    } else if (!slot) {
      action = '<span class="project-private">Private while in progress</span>';
    }

    li.innerHTML =
      (slot ? "" : '<div class="project-art" aria-hidden="true">' + artSvg(p.art) + "</div>") +
      '<div class="project-body">' +
      '<div class="project-meta">' + meta + "</div>" +
      '<h2 class="project-title">' + escapeHtml(p.title || "Untitled") + "</h2>" +
      '<p class="project-blurb">' + escapeHtml(p.blurb || "") + "</p>" +
      (tags && !slot ? '<ul class="project-tags">' + tags + "</ul>" : "") +
      (action ? '<div class="project-action">' + action + "</div>" : "") +
      "</div>";
    return li;
  }

  function renderTally(projects) {
    if (!tally) return;
    var counts = {};
    projects.forEach(function (p) {
      var s = STATUS_LABELS[p.status] ? p.status : "empty";
      counts[s] = (counts[s] || 0) + 1;
    });
    var parts = [];
    if (counts.hot) parts.push(counts.hot + " in progress");
    if (counts.shipped) parts.push(counts.shipped + " shipped");
    if (counts.queued) parts.push(counts.queued + " up next");
    tally.textContent = parts.join(" · ");
  }

  function render(projects) {
    list.innerHTML = "";
    var number = 0;
    projects.forEach(function (p) {
      if (!isSlot(p)) number++;
      list.appendChild(renderProject(p, number));
    });
    renderTally(projects);
  }

  function showLoadError() {
    list.innerHTML =
      '<li class="load-error">Couldn’t load <code>projects.json</code>. ' +
      "Serve this folder over HTTP (see the README) to see the projects.</li>";
  }

  if (!list) return;

  fetch("projects.json", { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("missing projects.json");
      return res.json();
    })
    .then(function (data) {
      render(Array.isArray(data) ? data : []);
    })
    .catch(showLoadError);
})();
