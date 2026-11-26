/* Find the Call: data, filters, rendering and motion. */
(() => {
  const FOR = {
    3501: "Accounting, Auditing & Accountability", 3502: "Banking, Finance & Investment", 3503: "Business Systems in Context",
    3504: "Commercial Services", 3505: "HR & Industrial Relations", 3506: "Marketing",
    3507: "Strategy, Management & Org. Behaviour", 3508: "Tourism", 3509: "Transportation, Logistics & Supply Chains",
    3599: "Other Commerce, Mgmt, Tourism & Services", 3801: "Applied Economics", 3802: "Econometrics",
    3803: "Economic Theory", 3899: "Other Economics", 4609: "Information Systems", 4801: "Commercial Law", 4905: "Statistics"
  };
  const RANK = { "A*": 0, "A": 1, "B": 2, "C": 3 };
  const PAGE = 40;
  const $ = (id) => document.getElementById(id);
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const today = new Date().toISOString().slice(0, 10);
  const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const daysLeft = (d) => Math.ceil((new Date(d + "T00:00:00") - new Date()) / 864e5);

  /* ---------- Data ---------- */
  const byJournal = new Map();
  let openCalls = 0;
  for (const c of window.CFPS || []) {
    if (c.closes && c.closes < today) continue;
    if (!byJournal.has(c.journal_id)) byJournal.set(c.journal_id, []);
    byJournal.get(c.journal_id).push(c); openCalls++;
  }
  const J = (window.JOURNALS || []).map((j) => {
    const cfps = byJournal.get(j.id) || [];
    const dl = cfps.map((c) => c.closes).filter(Boolean).sort()[0] || "9999";
    return { ...j, cfps, dl, _s: norm(j.title + " " + j.publisher + " " + j.issn + " " + j.eissn) };
  });

  const updated = window.CFPS_UPDATED ? new Date(window.CFPS_UPDATED) : null;
  const upd = updated ? updated.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "not yet";
  $("s-journals").textContent = J.length.toLocaleString();
  $("s-calls").textContent = openCalls.toLocaleString();
  $("s-updated").textContent = upd;
  $("updated").textContent = "Refreshed monthly · " + upd;
  $("foot-updated").textContent = "Refreshed monthly. Calls last refreshed " + upd + ".";

  /* ---------- State + UI ---------- */
  let rating = "", sortKey = "title", shown = PAGE;
  const chips = $("chips");
  // No field selected = all fields. Clicking a field narrows the list to the fields you pick.
  chips.innerHTML = `<label class="chip"><input type="checkbox" id="allfields" checked><span class="chip__label">All fields<span class="chip__n" id="n-all"></span></span></label>` +
    Object.entries(FOR).map(([k, v]) =>
      `<label class="chip" data-for="${k}"><input type="checkbox" value="${k}"><span class="chip__label">${esc(v)}<span class="chip__n"></span></span></label>`).join("");
  const forInputs = () => [...chips.querySelectorAll("input[value]")];
  const selectedFors = () => new Set(forInputs().filter((i) => i.checked).map((i) => +i.value));
  $("onlycfp").checked = openCalls > 0;

  const filtered = () => {
    const q = norm($("q").value.trim()), only = $("onlycfp").checked;
    const fors = selectedFors();
    const out = J.filter((j) => (!rating || j.rating === rating) && (!fors.size || fors.has(j.for)) && (!q || j._s.includes(q)) && (!only || j.cfps.length));
    out.sort((a, b) => {
      if (sortKey === "rating") return (RANK[a.rating] - RANK[b.rating]) || a.title.localeCompare(b.title);
      if (sortKey === "deadline") return a.dl.localeCompare(b.dl) || a.title.localeCompare(b.title);
      return a.title.localeCompare(b.title);
    });
    return out;
  };

  const callHtml = (c, from) => {
    const opens = c.opens ? fmt(c.opens)
      : `<span class="muted" title="The publisher doesn't state when this call opened. It is currently listed as open.">Not stated</span>`;
    let closes;
    if (c.closes) { const d = daysLeft(c.closes); closes = fmt(c.closes) + (d <= 30 ? ` <span class="soon">(${d}d)</span>` : ""); }
    else closes = c.ongoing ? `<span class="live" title="The publisher lists this call as ongoing, with no closing date">Ongoing</span>`
      : `<span class="muted" title="No closing date was found. Check the call.">Not stated</span>`;
    return `<li class="call"><div><a class="call__title" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.title || "Call for papers")} ↗</a>${from || ""}</div>
      <div class="call__dates"><div><b>Opens</b>${opens}</div><div><b>Closes</b>${closes}</div></div></li>`;
  };

  // Homepage for every journal: OpenAlex homepage if known, else the journal's ISSN record, else a web search.
  const HOME = window.HOMEPAGES || {};
  const homeOf = (j) => {
    if (HOME[j.id]) return { url: HOME[j.id], note: "Journal homepage" };
    const issn = [j.issn, j.eissn].find((s) => /^\d{4}-\d{3}[\dXx]$/.test(s || ""));
    if (issn) return { url: "https://portal.issn.org/resource/ISSN/" + issn.toUpperCase(), note: "No homepage on file. Opens the journal's ISSN record." };
    return { url: "https://www.google.com/search?q=" + encodeURIComponent(j.title + " journal"), note: "No homepage on file. Opens a web search." };
  };

  const entryHtml = (j, extra = "") => {
    const h = homeOf(j);
    return `<article class="entry">
    <div class="entry__main"><h3 class="entry__title"><a class="entry__link" href="${esc(h.url)}" target="_blank" rel="noopener" title="${esc(h.note)}">${esc(j.title)}<span class="ext" aria-hidden="true"> ↗</span><span class="sr"> (journal homepage, opens in a new tab)</span></a></h3><p class="entry__pub">${esc(j.publisher)}</p>${extra}</div>
    <div class="entry__side">
      <div class="entry__tags"><span class="pill pill--${j.rating === "A*" ? "Astar" : esc(j.rating)}">${esc(j.rating)}</span><span class="tag">${j.for} · ${esc(FOR[j.for] || "")}</span></div>
      ${j.cfps.length ? `<ul class="calls">${j.cfps.map(callHtml).join("")}</ul>` : `<p class="entry__none">No call listed here. Check the <a href="${esc(h.url)}" target="_blank" rel="noopener">journal's homepage</a>.</p>`}
    </div></article>`;
  };

  const rows = $("rows");
  let io = null;
  if ("IntersectionObserver" in window && !reduce) {
    io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  }

  function render() {
    const list = filtered();
    $("count").textContent = `${list.length.toLocaleString()} journal${list.length === 1 ? "" : "s"}`;
    rows.innerHTML = list.slice(0, shown).map(entryHtml).join("");
    rows.querySelectorAll(".entry").forEach((el) => (io ? io.observe(el) : el.classList.add("is-in")));
    updateCounts();
    const none = !list.length, only = $("onlycfp").checked;
    $("empty").hidden = !none;
    if (none && only) {
      $("empty").innerHTML = `No open calls are listed for these filters yet.<br><button class="cta__btn" id="show-all"><span>Show all journals in these filters</span></button>`;
      $("show-all").onclick = () => { $("onlycfp").checked = false; reset(); };
    } else if (none) $("empty").textContent = "No journals match these filters.";
    $("more-wrap").hidden = list.length <= shown;
    $("more").firstElementChild.textContent = `Show more (${list.length - shown} left)`;
  }
  const reset = () => { shown = PAGE; render(); };

  $("q").addEventListener("input", reset);
  $("onlycfp").addEventListener("change", reset);
  // How many journals each field would show, given the other filters (so you can see why a field is empty)
  function updateCounts() {
    const q = norm($("q").value.trim()), only = $("onlycfp").checked, n = {};
    let total = 0;
    for (const j of J) if ((!rating || j.rating === rating) && (!q || j._s.includes(q)) && (!only || j.cfps.length)) { n[j.for] = (n[j.for] || 0) + 1; total++; }
    $("n-all").textContent = total.toLocaleString();
    chips.querySelectorAll("[data-for]").forEach((el) => {
      const c = n[el.dataset.for] || 0;
      el.querySelector(".chip__n").textContent = c.toLocaleString();
      el.classList.toggle("is-zero", c === 0);
    });
  }
  const syncAll = () => { const any = selectedFors().size > 0; $("allfields").checked = !any; $("clear").hidden = !any; };
  chips.addEventListener("change", (e) => {
    if (e.target.id === "allfields") forInputs().forEach((i) => (i.checked = false));   // "All fields" = remove the narrowing
    syncAll(); reset();
  });
  $("clear").onclick = () => { forInputs().forEach((i) => (i.checked = false)); syncAll(); reset(); };
  $("more").onclick = () => { shown += PAGE; render(); };
  const tabGroup = (id, attr, set) => $(id).addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $(id).querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    set(b.dataset[attr]); reset();
  });
  tabGroup("ratings", "r", (v) => (rating = v));
  tabGroup("sorts", "k", (v) => (sortKey = v));
  render();

  /* ---------- Match my research ----------
     Plain keyword scoring in the browser: no AI, and nothing you type leaves the page.
     Your words are compared with (1) the topics each journal publishes on (OpenAlex), (2) journal titles,
     (3) the ABDC field name and (4) the titles of its open calls. Rarer words count for more (IDF). */
  const STOP = new Set(("a an and are as at be by for from has have how in into is it its of on or that the their this to was were what when which who why with within using use based about " +
    "study studies research paper papers effect effects role impact between across towards toward through").split(" "));
  const stem = (w) => {            // light suffix stripping so "organizations", "organizational" and "organizing" meet
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
    for (let i = 0; i < 3 && w.length > 4; i++) { const n = w.replace(/(ation|ing|ed|es|s|ly|al|ic|ive|ion|at)$/, ""); if (n.length < 4 || n === w) break; w = n; }
    return w.length > 3 ? w.replace(/s$/, "") : w;
  };
  const toks = (s) => norm(String(s || "")).split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
  const SYN = { ai: "artificial intelligence", genai: "generative artificial intelligence", llm: "language model", llms: "language model", ml: "machine learning",
    hr: "human resource", hrm: "human resource management", ocb: "organizational citizenship behavior", csr: "corporate social responsibility",
    esg: "environmental social governance sustainability", is: "information systems", it: "information technology", ipo: "initial public offering",
    fintech: "financial technology", crypto: "cryptocurrency blockchain", gig: "platform work", wfh: "remote work", dei: "diversity inclusion" };

  const TP = window.TOPICS || { names: [], j: {} };
  const topicToks = TP.names.map((n) => new Set(toks(n)));
  const df = new Map();
  for (const j of J) {
    const r = TP.j[j.id] || [];
    j._tp = []; const seen = new Set();
    for (let i = 0; i < r.length; i += 2) { j._tp.push({ name: TP.names[r[i]], tok: topicToks[r[i]], w: r[i + 1] / 1000 }); topicToks[r[i]].forEach((t) => seen.add(t)); }
    j._tt = new Set(toks(j.title)); j._tt.forEach((t) => seen.add(t));
    j._ff = new Set(toks(FOR[j.for]));
    for (const c of j.cfps) c._t = new Set(toks(c.title));
    seen.forEach((t) => df.set(t, (df.get(t) || 0) + 1));
  }
  const idf = (t) => Math.pow(Math.log(1 + J.length / (1 + (df.get(t) || 0))), 1.5);   // rare words count much more than common ones

  function parseQuery(topic, kw) {
    const Q = new Map(), phrases = [];
    const add = (word, wt) => { const t = stem(word); if (t.length > 1 && !STOP.has(word)) Q.set(t, Math.max(Q.get(t) || 0, wt)); };
    const addText = (text, wt) => norm(text).split(/[^a-z0-9]+/).filter(Boolean).forEach((w) => {
      add(w, wt); if (SYN[w]) toks(SYN[w]).forEach((t) => Q.set(t, Math.max(Q.get(t) || 0, wt * .6)));
    });
    addText(topic, 1);
    for (const p of kw.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)) {      // keywords count a little more, phrases get a bonus
      addText(p, 1.4);
      const ts = toks(p); if (ts.length > 1) phrases.push(ts);
    }
    return { Q, phrases };
  }

  function scoreJournal(j, { Q, phrases }, totalW) {
    let s = 0, hit = 0;
    for (const [t, qw] of Q) {
      const w = idf(t); let tf = 0;
      for (const tp of j._tp) if (tp.tok.has(t)) tf += tp.w;
      let part = w * (1 - Math.exp(-6 * tf));
      if (j._tt.has(t)) part += w * .45;
      if (j._ff.has(t)) part += w * .25;
      if (j.cfps.some((c) => c._t.has(t))) part += w * .35;
      if (part > 0) { s += part * qw; hit += qw; }
    }
    s *= .4 + .6 * (hit / totalW);                                       // reward covering more of what you typed
    // a single topic that covers several of your words is a stronger sign than words spread over different topics
    let denom = 0; for (const [t, qw] of Q) denom += idf(t) * qw;
    for (const tp of j._tp) {
      let m = 0; for (const t of tp.tok) if (Q.has(t)) m += idf(t) * Q.get(t);
      if (m) s += 2.5 * Math.sqrt(tp.w) * (m / denom) ** 2 * (denom / Q.size);
    }
    for (const ph of phrases) {
      const w = ph.reduce((a, t) => a + idf(t), 0) / ph.length; let tf = 0;
      for (const tp of j._tp) if (ph.every((t) => tp.tok.has(t))) tf += tp.w;
      if (tf) s += 1.8 * w * (1 - Math.exp(-6 * tf));
    }
    return s;
  }

  const whyTopics = (j, Q) => j._tp.map((tp) => {
    let m = 0; for (const t of tp.tok) if (Q.has(t)) m += idf(t);
    return { name: tp.name, v: m * (.4 + tp.w) };
  }).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3).map((x) => x.name);

  let mRating = "";
  function runMatch() {
    const q = parseQuery($("m-topic").value, $("m-kw").value);
    const out = $("m-out"); out.hidden = false;
    const totalW = [...q.Q.values()].reduce((a, b) => a + b, 0);
    if (!q.Q.size) {
      $("m-journals").innerHTML = `<p class="entry__none">Type a topic or a few keywords above, then press Find matches.</p>`;
      $("m-calls").innerHTML = ""; $("m-calls-none").hidden = true; return;
    }
    const scored = J.filter((j) => !mRating || j.rating === mRating).map((j) => ({ j, s: scoreJournal(j, q, totalW) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || RANK[a.j.rating] - RANK[b.j.rating]);
    const top = scored.slice(0, 8), max = scored[0] ? scored[0].s : 1;
    $("m-journals").innerHTML = top.length ? top.map(({ j }) => {
      const why = whyTopics(j, q.Q);
      return entryHtml(j, why.length ? `<p class="entry__why"><b>Fits:</b> ${why.map(esc).join(" · ")}</p>` : "");
    }).join("") : `<p class="entry__none">No journal looks close. Try more general words, or add a few keywords separated by commas.</p>`;
    $("m-journals").querySelectorAll(".entry").forEach((el) => el.classList.add("is-in"));

    const calls = [];
    for (const { j, s } of scored) for (const c of j.cfps) {
      let h = 0, tot = 0;
      for (const [t, qw] of q.Q) { const w = idf(t) * qw; tot += w; if (c._t.has(t)) h += w; }
      const sc = .6 * (h / tot) + .4 * (s / max);
      if (h > 0 || s / max > .55) calls.push({ c, j, sc });
    }
    calls.sort((a, b) => b.sc - a.sc);
    const ctop = calls.filter((x) => x.sc > .22).slice(0, 6);
    $("m-calls").innerHTML = ctop.map(({ c, j }) => callHtml(c, `<span class="call__from">${esc(j.title)} · ${esc(j.rating)}</span>`)).join("");
    $("m-calls-none").hidden = ctop.length > 0;
  }
  $("match-form").addEventListener("submit", (e) => { e.preventDefault(); runMatch(); });
  $("m-ratings").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $("m-ratings").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    mRating = b.dataset.r; if (!$("m-out").hidden) runMatch();
  });

  /* ---------- Crystal-ball widget: opens and closes the panel ---------- */
  const orb = $("orb"), oracle = $("oracle");
  const setOracle = (open) => {
    oracle.classList.toggle("is-open", open);
    document.body.classList.toggle("oracle-open", open);
    oracle.setAttribute("aria-hidden", String(!open));
    orb.setAttribute("aria-expanded", String(open));
    if (open) { setTimeout(() => $("m-topic").focus({ preventScroll: true }), 120); }
    else if (oracle.contains(document.activeElement)) orb.focus({ preventScroll: true });
  };
  orb.addEventListener("click", () => setOracle(!oracle.classList.contains("is-open")));
  $("oracle-close").addEventListener("click", () => setOracle(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && oracle.classList.contains("is-open")) setOracle(false); });

  /* ---------- Smooth scroll (Lenis), anchors ---------- */
  let lenis = null;
  window.addEventListener("load", () => {
    if (window.Lenis && !reduce) { lenis = new Lenis({ autoRaf: true }); window.lenis = lenis; }
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const t = a.getAttribute("href") === "#top" ? document.body : document.querySelector(a.getAttribute("href"));
    if (!t) return; e.preventDefault();
    lenis ? lenis.scrollTo(t, { offset: -20 }) : t.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  });

  /* ---------- Words reveal ---------- */
  document.querySelectorAll("[data-split]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true"><span class="wi" style="--i:${i}">${esc(w)}</span></span>`).join(" ");
    const go = () => el.classList.add("is-in");
    reduce ? go() : setTimeout(go, 150);
  });

  /* ---------- Menu overlay: clip-path reveal (.7s expo.out in, .32s ease-in out) ---------- */
  const menu = $("menu"), openers = [$("open-menu"), $("open-menu-2")];
  const items = [...menu.querySelectorAll(".menu__item")];
  let menuOpen = false, lastFocus = null;
  const setMenu = (open) => {
    menuOpen = open; lastFocus = open ? document.activeElement : lastFocus;
    document.body.classList.toggle("menu-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    openers.forEach((b) => b && b.setAttribute("aria-expanded", String(open)));
    if (lenis) open ? lenis.stop() : lenis.start();
    const ease = open ? "cubic-bezier(.16, 1, .3, 1)" : "cubic-bezier(.11, 0, .5, 0)";   // expo.out / power1.in
    const dur = reduce ? 0 : open ? 700 : 320;
    if (open) menu.style.visibility = "visible";
    const finalClip = open ? "inset(0 0 0 0)" : "inset(0 0 100% 0)";
    const settle = () => { menu.style.clipPath = finalClip; if (!open && !menuOpen) menu.style.visibility = "hidden"; };
    const anim = menu.animate([{ clipPath: open ? "inset(0 0 100% 0)" : "inset(0 0 0 0)" }, { clipPath: finalClip }],
      { duration: dur, easing: ease, fill: "forwards" });
    anim.onfinish = () => { settle(); anim.cancel(); };
    setTimeout(settle, dur + 80);   // also settles when the tab is in the background and frames are paused
    items.forEach((el, i) => {
      el.style.transition = open ? `opacity .6s var(--ease) ${0.25 + i * 0.07}s, transform .6s var(--ease) ${0.25 + i * 0.07}s` : "opacity .2s";
      el.style.opacity = open ? 1 : 0; el.style.transform = open ? "none" : "translateY(40px)";
    });
    if (open) $("close-menu").focus(); else lastFocus && lastFocus.focus && lastFocus.focus();
  };
  openers.forEach((b) => b && b.addEventListener("click", () => setMenu(true)));
  $("close-menu").addEventListener("click", () => setMenu(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen) setMenu(false); });

  /* ---------- Iridescent disc: drifts, tilts with pointer, spins with scroll ---------- */
  const disc = $("disc"), stage = $("stage");
  let px = 0, py = 0, t0 = performance.now();
  if (!reduce) {
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width - .5) * 2; py = ((e.clientY - r.top) / r.height - .5) * 2;
      disc.style.setProperty("--ry", (px * 16).toFixed(1) + "deg"); disc.style.setProperty("--rx", (-py * 16).toFixed(1) + "deg");
    });
    stage.addEventListener("pointerleave", () => { disc.style.setProperty("--ry", "0deg"); disc.style.setProperty("--rx", "0deg"); });
  }
  const spin = () => {
    const d = ((performance.now() - t0) / 90 + scrollY * .25) % 360;
    disc.style.setProperty("--spin", d.toFixed(1) + "deg");
    if (!reduce) requestAnimationFrame(spin);
  };
  spin();

  /* ---------- Pixel wipe: scroll-scrubbed pixel dissolve at the bottom of the ink band ---------- */
  const cv = $("wipe"), ctx = cv.getContext("2d");
  const rand = (r, c) => { const s = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453; return s - Math.floor(s); };
  const drawWipe = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const cols = w < 600 ? 28 : 56, size = w / cols, rowsN = Math.ceil(h / size);
    const rect = cv.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, 1 - rect.top / innerHeight));
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg-light").trim() || "#fcfbff";
    for (let r = 0; r < rowsN; r++) {
      const base = Math.pow((r + 1) / rowsN, 1.7) + (t - .5) * (reduce ? 0 : .7);
      for (let c = 0; c < cols; c++) if (rand(r, c) < base) ctx.fillRect(Math.floor(c * size), Math.floor(r * size + (h - rowsN * size)), Math.ceil(size), Math.ceil(size));
    }
  };
  let ticking = false;
  const headerEl = document.querySelector(".header");
  const onScroll = () => { headerEl.classList.toggle("is-stuck", scrollY > 40); orb.style.setProperty("--orb-spin", (scrollY * .3 % 360).toFixed(0) + "deg"); if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; drawWipe(); }); } };
  addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onScroll);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", onScroll);
  drawWipe();
})();
