/* N1210A Weight and Balance PWA */
(function () {
  "use strict";
  const VERSION = "1.1.0";
  const KEYS = { cfg: "wb.cfg", load: "wb.load", saved: "wb.saved", hist: "wb.hist", tab: "wb.tab" };

  const DEFAULT_CFG = {
    tail: "N1210A",
    desc: "1951 Piper PA-18, S/N 18-823, STC SA292AL envelope",
    rev: "10/23/2026",
    ew: 1188, em: 13670.75, gross: 1750,
    fwd: [[1300, 10.5], [1750, 14.0]], aft: 20.0,
    armPilot: 11, armPax: 37, armFuel: 24, fuelCap: 36, lbGal: 6.0, armBag: 57, bagMax: 50,
    podW: 25, podArm: 45.95, podF: 24.3, podM: 44.5, podB: 74.2, podMax: 150, podInEW: false
  };
  const DEFAULT_LOAD = { pilot: 200, pax: 0, fuelGal: 36, bag: 0, podOn: true, podF: 0, podM: 0, podB: 0,
    x1n: "", x1w: 0, x1a: 0, x2n: "", x2w: 0, x2a: 0, burnMode: "gal", burn: 10, hrs: 1.5, gph: 8 };

  const $ = (id) => document.getElementById(id);
  const f0 = (v) => Math.round(v).toLocaleString("en-US");
  const f1 = (v) => v.toFixed(1);
  const f2 = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const numv = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

  // ---------- storage ----------
  function get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }

  let cfg = Object.assign({}, DEFAULT_CFG, get(KEYS.cfg, {}));
  let load = Object.assign({}, DEFAULT_LOAD, get(KEYS.load, {}));
  let saved = get(KEYS.saved, []);
  let hist = get(KEYS.hist, []);
  let last = null;

  // ---------- envelope ----------
  function fwdLimit(w) {
    const p = cfg.fwd;
    if (!p || !p.length) return -Infinity;
    if (w <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (w <= p[i][0]) {
        const [w0, c0] = p[i - 1], [w1, c1] = p[i];
        return c0 + (w - w0) * (c1 - c0) / (w1 - w0);
      }
    }
    return p[p.length - 1][1];
  }
  function inLimits(w, cg) { return w <= cfg.gross + 1e-9 && cg >= fwdLimit(w) - 1e-9 && cg <= cfg.aft + 1e-9; }

  // ---------- compute ----------
  function compute() {
    const L = load, C = cfg;
    const fuelW = L.fuelGal * C.lbGal;
    const podShell = (L.podOn && !C.podInEW) ? C.podW : 0;
    const pF = L.podOn ? L.podF : 0, pM = L.podOn ? L.podM : 0, pB = L.podOn ? L.podB : 0;
    const rows = [
      ["Empty weight", C.ew, C.em / C.ew, C.em],
      ["Pilot", L.pilot, C.armPilot],
      ["Passenger", L.pax, C.armPax],
      ["Fuel " + L.fuelGal + " gal", fuelW, C.armFuel],
      ["Baggage", L.bag, C.armBag]
    ];
    if (L.podOn) {
      if (!C.podInEW) rows.push(["Pod shell", podShell, C.podArm]);
      rows.push(["Pod front", pF, C.podF], ["Pod middle", pM, C.podM], ["Pod back", pB, C.podB]);
    }
    if (L.x1w) rows.push([L.x1n || "Other", L.x1w, L.x1a]);
    if (L.x2w) rows.push([L.x2n || "Other", L.x2w, L.x2a]);
    rows.forEach(r => { if (r.length < 4) r[3] = r[1] * r[2]; });
    const toW = rows.reduce((a, r) => a + r[1], 0), toM = rows.reduce((a, r) => a + r[3], 0);
    const toCG = toW ? toM / toW : 0;
    let burnGal = L.burnMode === "time" ? L.hrs * L.gph : L.burn;
    const burnCapped = burnGal > L.fuelGal;
    burnGal = Math.min(burnGal, L.fuelGal);
    const burnW = burnGal * C.lbGal;
    const lW = toW - burnW, lM = toM - burnW * C.armFuel, lCG = lW ? lM / lW : 0;
    const podCargo = pF + pM + pB;
    return { rows, toW, toM, toCG, lW, lM, lCG, burnGal, burnW, burnCapped, podCargo,
      okTO: inLimits(toW, toCG), okL: inLimits(lW, lCG), useful: C.gross - C.ew, remaining: C.gross - toW };
  }

  // ---------- render load tab ----------
  function renderLoad() {
    const C = cfg;
    $("hdrTail").textContent = C.tail;
    $("hdrSub").textContent = C.desc + " · W&B " + C.rev + " · Empty " + f0(C.ew) + " lb @ " + f2(C.em / C.ew);
    $("limPilot").textContent = "arm +" + C.armPilot;
    $("limPax").textContent = "arm +" + C.armPax;
    $("limFuel").textContent = C.fuelCap + " gal max · " + C.lbGal + " lb/gal · +" + C.armFuel;
    $("limBag").textContent = C.bagMax + " lb max · +" + C.armBag;
    $("limPodShell").textContent = C.podInEW ? "included in empty weight" : "+" + C.podArm;
    $("podShellW").textContent = (load.podOn && !C.podInEW) ? f1(C.podW) + " lb" : (C.podInEW ? "in EW" : "off");
    $("limPodF").textContent = "+" + C.podF + " · " + C.podMax + " lb pod total";
    $("limPodM").textContent = "+" + C.podM;
    $("limPodB").textContent = "+" + C.podB;
    ["podF", "podM", "podB"].forEach(k => $(k).disabled = !load.podOn);
    $("podFields").style.opacity = load.podOn ? "1" : ".5";
    $("modeGal").classList.toggle("on", load.burnMode === "gal");
    $("modeTime").classList.toggle("on", load.burnMode === "time");
    $("burnGalRow").hidden = load.burnMode !== "gal";
    $("burnTimeRow1").hidden = load.burnMode !== "time";
    $("burnTimeRow2").hidden = load.burnMode !== "time";

    const r = compute(); last = r;
    const msgs = [];
    function stat(id, w, cg, ok, label) {
      $(id).className = "stat " + (ok ? "ok" : "bad");
      $(id + "v").textContent = f0(w) + " lb";
      const lim = fwdLimit(Math.min(w, C.gross));
      $(id + "d").textContent = "CG " + f2(cg) + (ok ? " · fwd limit " + f2(lim) + " · margin " + f2(cg - lim) : " · OUT OF LIMITS");
      if (w > C.gross) msgs.push(["bad", label + " weight " + f1(w) + " lb is over gross by " + f1(w - C.gross) + " lb."]);
      if (cg < fwdLimit(w)) msgs.push(["bad", label + " CG " + f2(cg) + " is forward of the limit (" + f2(fwdLimit(w)) + " at " + f0(w) + " lb). Move weight aft: baggage, pod back zone."]);
      if (cg > C.aft) msgs.push(["bad", label + " CG " + f2(cg) + " is aft of the " + f2(C.aft) + " limit."]);
    }
    stat("sTO", r.toW, r.toCG, r.okTO, "Takeoff");
    stat("sL", r.lW, r.lCG, r.okL, "Landing");
    $("sU").className = "stat " + (r.remaining < 0 ? "bad" : "ok");
    $("sUv").textContent = f0(r.remaining) + " lb";
    $("sUd").textContent = "Useful load " + f0(r.useful) + " lb · landing after " + f1(r.burnGal) + " gal burned";
    if (load.fuelGal > C.fuelCap) msgs.push(["bad", "Fuel " + load.fuelGal + " gal exceeds " + C.fuelCap + " gal capacity."]);
    if (load.bag > C.bagMax) msgs.push(["bad", "Baggage " + load.bag + " lb exceeds the " + C.bagMax + " lb limit."]);
    if (load.podOn && r.podCargo > C.podMax) msgs.push(["bad", "Pod cargo " + f0(r.podCargo) + " lb exceeds the " + C.podMax + " lb pod limit."]);
    if (r.burnCapped) msgs.push(["warn", "Fuel burn exceeds fuel loaded; landing computed at zero fuel."]);
    $("msgs").innerHTML = msgs.map(m => '<li class="' + m[0] + '">' + esc(m[1]) + "</li>").join("");

    $("momTable").innerHTML = "<tr><th>Item</th><th>lb</th><th>arm</th><th>moment</th></tr>" +
      r.rows.map(x => "<tr><td>" + esc(x[0]) + "</td><td>" + f1(x[1]) + "</td><td>" + f2(x[2]) + "</td><td>" + f2(x[3]) + "</td></tr>").join("") +
      '<tr class="tot"><td>Takeoff</td><td>' + f1(r.toW) + "</td><td>" + f2(r.toCG) + "</td><td>" + f2(r.toM) + "</td></tr>" +
      "<tr><td>Fuel burned " + f1(r.burnGal) + " gal</td><td>−" + f1(r.burnW) + "</td><td>" + f2(C.armFuel) + "</td><td>−" + f2(r.burnW * C.armFuel) + "</td></tr>" +
      '<tr class="tot"><td>Landing</td><td>' + f1(r.lW) + "</td><td>" + f2(r.lCG) + "</td><td>" + f2(r.lM) + "</td></tr>";

    $("chart").innerHTML = chartSVG(r, false);
    set(KEYS.load, load);
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function chartSVG(r, print) {
    const C = cfg, W = 640, H = 400, m = { l: 52, r: 16, t: 14, b: 40 };
    const cgs = C.fwd.map(p => p[1]).concat([C.aft]);
    const x0 = Math.floor(Math.min.apply(null, cgs) - 1.5), x1 = Math.ceil(Math.max.apply(null, cgs) + 2);
    const y0 = Math.floor((C.ew - 150) / 100) * 100, y1 = Math.ceil((C.gross + 60) / 100) * 100;
    const X = v => m.l + (v - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = v => H - m.b - (v - y0) / (y1 - y0) * (H - m.t - m.b);
    const cs = getComputedStyle(document.documentElement);
    const col = print ? { line: "#ccc", muted: "#555", ink: "#000", to: "#1b4a72", ldg: "#b35a10" }
      : { line: cs.getPropertyValue("--line").trim(), muted: cs.getPropertyValue("--muted").trim(), ink: cs.getPropertyValue("--ink").trim(), to: cs.getPropertyValue("--to").trim(), ldg: cs.getPropertyValue("--ldg").trim() };
    let s = "";
    for (let gx = x0; gx <= x1; gx++) {
      s += '<line x1="' + X(gx) + '" y1="' + Y(y0) + '" x2="' + X(gx) + '" y2="' + Y(y1) + '" stroke="' + col.line + '" stroke-width="1"/>';
      if ((gx - x0) % 2 === 0) s += '<text x="' + X(gx) + '" y="' + (H - m.b + 16) + '" font-size="11" text-anchor="middle" fill="' + col.muted + '">' + gx + "</text>";
    }
    for (let gy = y0; gy <= y1; gy += 100) {
      s += '<line x1="' + X(x0) + '" y1="' + Y(gy) + '" x2="' + X(x1) + '" y2="' + Y(gy) + '" stroke="' + col.line + '" stroke-width="1"/>';
      s += '<text x="' + (m.l - 6) + '" y="' + (Y(gy) + 4) + '" font-size="11" text-anchor="end" fill="' + col.muted + '">' + gy + "</text>";
    }
    s += '<text x="' + ((m.l + W - m.r) / 2) + '" y="' + (H - 6) + '" font-size="11" text-anchor="middle" fill="' + col.muted + '">CG, inches aft of datum</text>';
    const ym = (m.t + H - m.b) / 2;
    s += '<text x="12" y="' + ym + '" font-size="11" text-anchor="middle" fill="' + col.muted + '" transform="rotate(-90 12 ' + ym + ')">Weight, lb</text>';
    // envelope polygon: up the forward limit, across the top at gross, down the aft limit
    const fp = C.fwd.slice();
    const pts = [[fp[0][1], y0]].concat(fp.map(p => [p[1], p[0]]));
    if (fp[fp.length - 1][0] < C.gross) pts.push([fp[fp.length - 1][1], C.gross]);
    pts.push([C.aft, C.gross], [C.aft, y0]);
    s += '<polyline points="' + pts.map(p => X(p[0]) + "," + Y(p[1])).join(" ") + '" fill="none" stroke="' + col.ink + '" stroke-width="2"/>';
    const ecg = C.em / C.ew;
    s += '<circle cx="' + X(ecg) + '" cy="' + Y(C.ew) + '" r="4" fill="none" stroke="' + col.muted + '" stroke-width="1.5"/>';
    s += '<text x="' + (X(ecg) + 7) + '" y="' + (Y(C.ew) + 4) + '" font-size="11" fill="' + col.muted + '">Empty</text>';
    const cl = v => Math.max(x0, Math.min(x1, v)), cw = v => Math.max(y0, Math.min(y1, v));
    s += '<line x1="' + X(cl(r.toCG)) + '" y1="' + Y(cw(r.toW)) + '" x2="' + X(cl(r.lCG)) + '" y2="' + Y(cw(r.lW)) + '" stroke="' + col.to + '" stroke-width="2"/>';
    s += '<circle cx="' + X(cl(r.toCG)) + '" cy="' + Y(cw(r.toW)) + '" r="6" fill="' + col.to + '"/>';
    s += '<text x="' + (X(cl(r.toCG)) + 9) + '" y="' + (Y(cw(r.toW)) - 6) + '" font-size="12" font-weight="600" fill="' + col.to + '">T/O</text>';
    s += '<rect x="' + (X(cl(r.lCG)) - 5) + '" y="' + (Y(cw(r.lW)) - 5) + '" width="10" height="10" fill="' + col.ldg + '"/>';
    s += '<text x="' + (X(cl(r.lCG)) + 9) + '" y="' + (Y(cw(r.lW)) + 14) + '" font-size="12" font-weight="600" fill="' + col.ldg + '">LDG</text>';
    return s;
  }

  // ---------- summary text ----------
  function summaryText(r) {
    const L = load, C = cfg;
    let t = C.tail + " W&B " + new Date().toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) + "\n";
    t += "Pilot " + L.pilot + " | Pax " + L.pax + " | Fuel " + L.fuelGal + " gal | Bag " + L.bag;
    if (L.podOn) t += " | Pod F/M/B " + L.podF + "/" + L.podM + "/" + L.podB;
    if (L.x1w) t += " | " + (L.x1n || "Other") + " " + L.x1w + " @ " + L.x1a;
    if (L.x2w) t += " | " + (L.x2n || "Other") + " " + L.x2w + " @ " + L.x2a;
    t += "\nTakeoff " + f1(r.toW) + " lb @ " + f2(r.toCG) + (r.okTO ? " (within limits)" : " (OUT OF LIMITS)");
    t += "\nLanding " + f1(r.lW) + " lb @ " + f2(r.lCG) + " after " + f1(r.burnGal) + " gal" + (r.okL ? " (within limits)" : " (OUT OF LIMITS)");
    return t;
  }
  function loadLine(L) {
    let t = "Pilot " + L.pilot + " · Pax " + L.pax + " · Fuel " + L.fuelGal + " gal · Bag " + L.bag;
    if (L.podOn) t += " · Pod " + L.podF + "/" + L.podM + "/" + L.podB;
    if (L.x1w) t += " · " + (L.x1n || "Other") + " " + L.x1w;
    if (L.x2w) t += " · " + (L.x2n || "Other") + " " + L.x2w;
    return t;
  }

  // ---------- saved loadouts ----------
  function renderSaved() {
    $("savedEmpty").hidden = saved.length > 0;
    $("savedList").innerHTML = saved.map((s, i) =>
      '<li><div class="body" data-i="' + i + '"><div class="t">' + esc(s.name) + '</div><div class="s">' + esc(loadLine(s.load)) + '</div></div>' +
      '<button class="x" data-del="' + i + '" aria-label="Delete">×</button></li>').join("");
  }
  $("savedList").addEventListener("click", e => {
    const b = e.target.closest("[data-i]"), d = e.target.closest("[data-del]");
    if (d) { const i = +d.dataset.del; confirmModal("Delete loadout \"" + saved[i].name + "\"?", () => { saved.splice(i, 1); set(KEYS.saved, saved); renderSaved(); }); return; }
    if (b) { load = Object.assign({}, DEFAULT_LOAD, saved[+b.dataset.i].load); fillLoadInputs(); renderLoad(); showTab("load"); toast("Loaded " + saved[+b.dataset.i].name); }
  });
  $("btnSave").addEventListener("click", () => {
    promptModal("Loadout name", "", name => {
      if (!name) return;
      const i = saved.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
      const entry = { name, load: Object.assign({}, load) };
      if (i >= 0) saved[i] = entry; else saved.push(entry);
      set(KEYS.saved, saved); renderSaved(); toast(i >= 0 ? "Updated " + name : "Saved " + name);
    });
  });

  // ---------- history ----------
  function renderHist() {
    $("histEmpty").hidden = hist.length > 0;
    $("histList").innerHTML = hist.map((h, i) => {
      const ok = h.okTO && h.okL;
      return '<li><div class="body"><div class="t">' + esc(new Date(h.ts).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })) +
        ' <span class="tag ' + (ok ? "ok" : "bad") + '">' + (ok ? "OK" : "OUT") + '</span></div>' +
        '<div class="s">' + esc(loadLine(h.load)) + "\nT/O " + f0(h.toW) + " @ " + f2(h.toCG) + " · LDG " + f0(h.lW) + " @ " + f2(h.lCG) + '</div></div>' +
        '<button class="x" data-del="' + i + '" aria-label="Delete">×</button></li>';
    }).join("");
  }
  $("histList").addEventListener("click", e => {
    const d = e.target.closest("[data-del]");
    if (d) { hist.splice(+d.dataset.del, 1); set(KEYS.hist, hist); renderHist(); }
  });
  $("btnLog").addEventListener("click", () => {
    const r = last || compute();
    hist.unshift({ ts: Date.now(), load: Object.assign({}, load), toW: r.toW, toCG: r.toCG, lW: r.lW, lCG: r.lCG, burnGal: r.burnGal, okTO: r.okTO, okL: r.okL });
    if (hist.length > 500) hist.length = 500;
    set(KEYS.hist, hist); renderHist(); toast("Logged");
  });
  $("btnClearHist").addEventListener("click", () => confirmModal("Clear the whole flight log?", () => { hist = []; set(KEYS.hist, hist); renderHist(); }));
  $("btnExportCsv").addEventListener("click", () => {
    const head = ["date", "pilot", "pax", "fuel_gal", "baggage", "pod_on", "pod_front", "pod_mid", "pod_back", "other1", "other1_lb", "other1_arm", "other2", "other2_lb", "other2_arm", "takeoff_lb", "takeoff_cg", "burn_gal", "landing_lb", "landing_cg", "within_limits"];
    const rows = hist.map(h => [new Date(h.ts).toISOString(), h.load.pilot, h.load.pax, h.load.fuelGal, h.load.bag, h.load.podOn ? 1 : 0, h.load.podF, h.load.podM, h.load.podB,
      h.load.x1n, h.load.x1w, h.load.x1a, h.load.x2n, h.load.x2w, h.load.x2a, h.toW.toFixed(1), h.toCG.toFixed(2), h.burnGal.toFixed(1), h.lW.toFixed(1), h.lCG.toFixed(2), (h.okTO && h.okL) ? "yes" : "NO"]);
    const csv = [head].concat(rows).map(r => r.map(v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\n");
    download(cfg.tail + "-flight-log.csv", csv, "text/csv");
  });

  // ---------- share / print ----------
  $("btnShare").addEventListener("click", async () => {
    const text = summaryText(last || compute());
    if (navigator.share) { try { await navigator.share({ title: cfg.tail + " W&B", text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); } catch (e) { toast("Share not available here"); }
  });
  $("btnPrint").addEventListener("click", () => {
    const r = last || compute(), C = cfg;
    const okAll = r.okTO && r.okL;
    $("printSheet").innerHTML = "<h1>" + esc(C.tail) + " Weight and Balance</h1><div class='sub'>" + esc(C.desc) + " · W&B rev " + esc(C.rev) +
      " · " + esc(new Date().toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })) + "</div>" +
      "<table>" + $("momTable").innerHTML + "</table>" +
      "<div class='verdict'>" + (okAll ? "Within limits. " : "OUT OF LIMITS. ") + "Gross " + C.gross + " lb. Forward limit at takeoff weight " + f2(fwdLimit(Math.min(r.toW, C.gross))) + ", aft limit " + f2(C.aft) + ".</div>" +
      '<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg">' + chartSVG(r, true) + "</svg>";
    try { window.print(); } catch (e) { toast("Print not available here"); }
  });
  function download(name, content, type) {
    try {
      const blob = new Blob([content], { type }), url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    } catch (e) { toast("Download not available here"); }
  }

  // ---------- load inputs ----------
  const LOAD_FIELDS = ["pilot", "pax", "fuelGal", "bag", "podF", "podM", "podB", "x1n", "x1w", "x1a", "x2n", "x2w", "x2a", "burn", "hrs", "gph"];
  function fillLoadInputs() {
    LOAD_FIELDS.forEach(k => { $(k).value = load[k]; });
    $("podOn").checked = !!load.podOn;
  }
  LOAD_FIELDS.forEach(k => $(k).addEventListener("input", () => {
    load[k] = ($(k).type === "text") ? $(k).value : numv($(k).value);
    renderLoad();
  }));
  $("podOn").addEventListener("change", () => { load.podOn = $("podOn").checked; renderLoad(); });
  $("modeGal").addEventListener("click", () => { load.burnMode = "gal"; renderLoad(); });
  $("modeTime").addEventListener("click", () => { load.burnMode = "time"; renderLoad(); });
  $("btnReset").addEventListener("click", () => {
    const keep = { burnMode: load.burnMode, gph: load.gph };
    load = Object.assign({}, DEFAULT_LOAD, keep, { pilot: 0, fuelGal: 0, burn: 0, hrs: 0 });
    fillLoadInputs(); renderLoad();
  });

  // ---------- settings ----------
  const CFG_NUM = ["ew", "em", "gross", "aft", "armPilot", "armPax", "armFuel", "fuelCap", "lbGal", "armBag", "bagMax", "podW", "podArm", "podF", "podM", "podB", "podMax"];
  const CFG_TXT = ["tail", "desc", "rev"];
  function fillCfgInputs() {
    CFG_NUM.forEach(k => $("c_" + k).value = cfg[k]);
    CFG_TXT.forEach(k => $("c_" + k).value = cfg[k]);
    $("c_fwd").value = cfg.fwd.map(p => p[0] + ", " + p[1]).join("\n");
    $("c_podInEW").checked = !!cfg.podInEW;
    $("c_ecg").textContent = cfg.ew ? f2(cfg.em / cfg.ew) + " in" : "";
    $("verLine").textContent = "App version " + VERSION;
  }
  function parseFwd(text) {
    const pts = text.split(/\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(/[,\s]+/).map(parseFloat)).filter(p => p.length >= 2 && isFinite(p[0]) && isFinite(p[1]));
    pts.sort((a, b) => a[0] - b[0]);
    return pts.length ? pts.map(p => [p[0], p[1]]) : DEFAULT_CFG.fwd;
  }
  CFG_NUM.forEach(k => $("c_" + k).addEventListener("input", () => { cfg[k] = numv($("c_" + k).value); cfgChanged(); }));
  CFG_TXT.forEach(k => $("c_" + k).addEventListener("input", () => { cfg[k] = $("c_" + k).value; cfgChanged(); }));
  $("c_fwd").addEventListener("change", () => { cfg.fwd = parseFwd($("c_fwd").value); fillCfgInputs(); cfgChanged(); });
  $("c_podInEW").addEventListener("change", () => { cfg.podInEW = $("c_podInEW").checked; cfgChanged(); });
  function cfgChanged() { set(KEYS.cfg, cfg); $("c_ecg").textContent = cfg.ew ? f2(cfg.em / cfg.ew) + " in" : ""; renderLoad(); }
  $("btnDefaults").addEventListener("click", () => confirmModal("Restore the built-in N1210A aircraft data? Loadouts and log are kept.", () => { cfg = Object.assign({}, DEFAULT_CFG); fillCfgInputs(); cfgChanged(); toast("Defaults restored"); }));
  $("btnBackup").addEventListener("click", () => download(cfg.tail + "-wb-backup.json", JSON.stringify({ version: VERSION, cfg, load, saved, hist }, null, 1), "application/json"));
  $("fileRestore").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !d.cfg) throw 0;
        confirmModal("Replace aircraft data, loadouts and log with this backup?", () => {
          cfg = Object.assign({}, DEFAULT_CFG, d.cfg); load = Object.assign({}, DEFAULT_LOAD, d.load || {}); saved = d.saved || []; hist = d.hist || [];
          set(KEYS.cfg, cfg); set(KEYS.saved, saved); set(KEYS.hist, hist);
          fillCfgInputs(); fillLoadInputs(); renderLoad(); renderSaved(); renderHist(); loadDocs(); toast("Backup restored");
        });
      } catch (err) { toast("That file is not a W&B backup"); }
      e.target.value = "";
    };
    rd.readAsText(f);
  });


  // ---------- documents (IndexedDB) ----------
  const DB_NAME = "wb-docs", DB_STORE = "docs";
  function openDB() {
    return new Promise((res, rej) => {
      if (!("indexedDB" in window)) { rej(new Error("no idb")); return; }
      const rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true }); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    });
  }
  function dbOp(mode, fn) {
    return openDB().then(db => new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, mode), st = tx.objectStore(DB_STORE);
      const out = fn(st);
      tx.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      tx.onerror = () => rej(tx.error);
    }));
  }
  let docs = [];
  function fmtSize(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; }
  function loadDocs() {
    return dbOp("readonly", st => st.getAll()).then(all => { docs = (all || []).sort((x, y) => y.ts - x.ts); renderDocs(); }).catch(() => { docs = []; renderDocs(true); });
  }
  function renderDocs(unavailable) {
    $("docEmpty").hidden = docs.length > 0;
    if (unavailable) { $("docEmpty").textContent = "Document storage is not available in this browser."; }
    $("docList").innerHTML = docs.map(d =>
      '<li><div class="body" data-open="' + d.id + '"><div class="t">' + esc(d.name) + '</div><div class="meta">' +
      esc(new Date(d.ts).toLocaleDateString("en-US", { dateStyle: "medium" })) + " · " + fmtSize(d.size) + (d.type === "application/pdf" ? " · PDF" : "") + "</div></div>" +
      '<button class="act" data-rename="' + d.id + '">Rename</button><button class="x" data-del="' + d.id + '" aria-label="Delete">×</button></li>').join("");
    const total = docs.reduce((s, d) => s + d.size, 0);
    $("docUsage").textContent = docs.length ? docs.length + " file" + (docs.length > 1 ? "s" : "") + ", " + fmtSize(total) + ". Not included in the JSON backup; download each file to keep a copy elsewhere." : "";
  }
  $("fileDoc").addEventListener("change", e => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    if (!files.length) return;
    Promise.all(files.map(f => dbOp("readwrite", st => st.add({ name: f.name, type: f.type || "application/octet-stream", size: f.size, ts: Date.now(), blob: f }))))
      .then(() => { toast(files.length > 1 ? files.length + " documents added" : "Document added"); return loadDocs(); })
      .catch(() => toast("Could not store the file"));
  });
  $("docList").addEventListener("click", e => {
    const o = e.target.closest("[data-open]"), r = e.target.closest("[data-rename]"), d = e.target.closest("[data-del]");
    if (d) { const doc = docs.find(x => x.id === +d.dataset.del); confirmModal("Delete \"" + doc.name + "\"?", () => dbOp("readwrite", st => st.delete(doc.id)).then(loadDocs)); return; }
    if (r) { const doc = docs.find(x => x.id === +r.dataset.rename); promptModal("Document name", doc.name, name => { if (!name) return; doc.name = name; dbOp("readwrite", st => st.put(doc)).then(loadDocs); }); return; }
    if (o) { const doc = docs.find(x => x.id === +o.dataset.open); openDoc(doc); }
  });
  function openDoc(doc) {
    try {
      const url = URL.createObjectURL(doc.blob);
      const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener";
      if (doc.type !== "application/pdf" && !/^image\//.test(doc.type)) a.download = doc.name;
      document.body.appendChild(a); a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60000);
    } catch (e) { toast("Could not open the file"); }
  }

  // ---------- tabs, toast, modal ----------
  function showTab(name) {
    document.querySelectorAll(".tab").forEach(t => t.hidden = t.id !== "tab-" + name);
    document.querySelectorAll("nav.tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
    set(KEYS.tab, name); window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav.tabs button").forEach(b => b.addEventListener("click", () => showTab(b.dataset.tab)));
  let toastT;
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1800); }
  let modalCb = null;
  function promptModal(title, val, cb) { $("modalTitle").textContent = title; $("modalInput").hidden = false; $("modalInput").value = val; modalCb = () => cb($("modalInput").value.trim()); $("modal").hidden = false; setTimeout(() => $("modalInput").focus(), 50); }
  function confirmModal(title, cb) { $("modalTitle").textContent = title; $("modalInput").hidden = true; modalCb = cb; $("modal").hidden = false; }
  $("modalOk").addEventListener("click", () => { $("modal").hidden = true; const cb = modalCb; modalCb = null; if (cb) cb(); });
  $("modalCancel").addEventListener("click", () => { $("modal").hidden = true; modalCb = null; });
  $("modalInput").addEventListener("keydown", e => { if (e.key === "Enter") $("modalOk").click(); });

  // ---------- init ----------
  fillCfgInputs(); fillLoadInputs(); renderLoad(); renderSaved(); renderHist(); loadDocs();
  showTab(get(KEYS.tab, "load"));
  if (window.matchMedia) { try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderLoad); } catch (e) {} }
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }
})();
