// "Ask about my work" panel. Opens only when asked, and the page works fully without it.
document.addEventListener("DOMContentLoaded", function () {
  var meta = document.querySelector('meta[name="ask-endpoint"]');
  var endpoint = meta ? meta.content.trim() : "";
  var EMAIL = "don@doncox.ai";
  var UNAVAILABLE = "The live answers are unavailable right now. Try again shortly or email " + EMAIL + ".";
  var OFF = "The live answers aren't switched on right now. Email Donald at " + EMAIL + ".";
  var SUGGESTED = ["What does the shipping kiosk do?", "How does he stop a model making bad decisions?", "What results has this work produced?"];
  var TIMEOUT = 30000, MAX_TURNS = 6, MAX_LEN = 500;
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var motion = window.gsap && !reduced;
  var localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  var wantsStub = localHost && new URLSearchParams(location.search).get("askstub") === "1";
  var history = [], busy = false, open = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var toggle = el("button", "ask-toggle", "Ask about my work");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "ask-panel");
  var panel = el("section", "ask-panel");
  panel.id = "ask-panel";
  panel.setAttribute("aria-label", "Ask about my work");
  panel.hidden = true;
  var head = el("div", "ask-head");
  var title = el("h2", "ask-title", "Ask about my work");
  var close = el("button", "ask-close", "Close");
  close.type = "button";
  head.append(title, close);
  var log = el("div", "ask-log");
  log.setAttribute("aria-live", "polite");
  var chips = el("div", "ask-chips");
  var form = el("form", "ask-form");
  var label = el("label", "ask-label", "Your question");
  label.htmlFor = "ask-input";
  var input = el("input");
  input.id = "ask-input";
  input.autocomplete = "off";
  input.maxLength = MAX_LEN;
  var send = el("button", "ask-send", "Ask");
  send.type = "submit";
  var row = el("div", "ask-row");
  row.append(input, send);
  form.append(label, row);
  var note = el("p", "ask-note");
  note.append("A Claude model answers from verified facts about this work, and checks in code hold it to them. ");
  var privacy = el("a", null, "Privacy");
  privacy.href = "/privacy/";
  note.append(privacy);
  if (!endpoint && !wantsStub) note.hidden = true;
  panel.append(head, log, chips, form, note);
  document.body.append(toggle, panel);

  // On a phone the keyboard would cover the answer, so focus only moves on devices with a real pointer.
  var touch = matchMedia("(pointer: coarse)").matches;

  function setChips(list) {
    chips.textContent = "";
    list.forEach(function (q) {
      var b = el("button", "ask-chip", q);
      b.type = "button";
      b.addEventListener("click", function () { ask(q); });
      chips.append(b);
    });
  }

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  // Shows the fade at the bottom of the log only while there is more to read below it.
  function cue() { log.classList.toggle("has-more", log.scrollHeight - log.clientHeight - log.scrollTop > 4); }
  log.addEventListener("scroll", cue, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(cue).observe(log);

  // An answer opens at its own question, so the reader starts at the top of it.
  function toQuestion() {
    var all = log.querySelectorAll(".ask-q"), q = all[all.length - 1];
    if (q) log.scrollTop += q.getBoundingClientRect().top - log.getBoundingClientRect().top;
  }

  function show(node, keep) {
    log.append(node);
    keep();
    cue();
    if (motion) gsap.from(node, { autoAlpha: 0, y: 8, duration: .45, ease: "expo.out", onUpdate: keep, onComplete: cue });
  }

  // Known addresses in an answer become real links. Only this fixed list is ever linked, and the text stays a text node.
  var LINKS = { "don@doncox.ai": "mailto:don@doncox.ai", "doncox.ai/donald-cox-resume.pdf": "/donald-cox-resume.pdf", "github.com/donald-cox": "https://github.com/Donald-Cox", "adaptautomations.com": "https://adaptautomations.com/", "doncox.ai": "/" };
  function linked(text) {
    var p = el("p"), at = 0, m;
    var re = /(?:https?:\/\/)?(?:www\.)?(don@doncox\.ai|doncox\.ai\/donald-cox-resume\.pdf|github\.com\/donald-cox|adaptautomations\.com|doncox\.ai)\/?/gi;
    while ((m = re.exec(text))) {
      var end = m.index + m[0].length, before = text.charAt(m.index - 1), after = text.charAt(end);
      if (/[\w@.\/-]/.test(before) || /[\w@\/-]/.test(after) || (after === "." && /\w/.test(text.charAt(end + 1)))) continue;
      p.append(text.slice(at, m.index));
      var a = el("a", null, m[0]);
      a.href = LINKS[m[1].toLowerCase()];
      if (/^https:/.test(a.href)) a.rel = "noopener";
      p.append(a);
      at = end;
    }
    p.append(text.slice(at));
    return p;
  }

  function norm(q) { return q.trim().toLowerCase().replace(/[?.!\s]+$/, ""); }
  function wasAnswered(q) { return history.some(function (h) { return norm(h.question) === norm(q); }); }

  // Never offers a question already answered here. After a failed request the suggested questions come back so the visitor can retry.
  function nextChips(data) {
    var list = (Array.isArray(data.follow_ups) ? data.follow_ups : []).filter(function (q) { return typeof q === "string" && !wasAnswered(q); });
    var least = data.kind !== "fallback" ? 2 : endpoint || window.askStub ? 3 : 0;
    SUGGESTED.forEach(function (q) { if (list.length < least && list.indexOf(q) < 0 && !wasAnswered(q)) list.push(q); });
    return list.slice(0, 3);
  }

  function showAnswer(data) {
    var box = el("div", "ask-a");
    box.append(linked(data.answer));
    if (Array.isArray(data.citations) && data.citations.length) {
      var src = el("p", "ask-src");
      src.append("Sources: ");
      var seen = {};
      data.citations.forEach(function (c) {
        if (!c || typeof c.href !== "string" || seen[c.label] || !/^\/(?![\/\\])/.test(c.href)) return;
        seen[c.label] = 1;
        if (src.children.length) src.append(", ");
        var a = el("a", null, c.label);
        a.href = c.href;
        a.addEventListener("click", function (e) {
          var u = new URL(a.href);
          if (u.pathname === location.pathname && u.hash) { e.preventDefault(); location.hash = u.hash; }
        });
        src.append(a);
      });
      if (src.children.length) box.append(src);
    }
    setChips(nextChips(data));
    show(box, toQuestion);
  }

  function fly(key) {
    if (!/^[a-z]+$/.test(key || "") || key === "none") return;
    var ch = document.querySelector('.ch[data-cam="' + key + '"]');
    if (!ch) return;
    ch.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    if (window.siteMap && window.siteMap.pulse) setTimeout(function () { window.siteMap.pulse(key); }, reduced ? 0 : 900);
  }

  function request(question) {
    if (window.askStub) return window.askStub(question);
    if (!endpoint) return Promise.resolve({ kind: "fallback", answer: OFF, citations: [], focus: "none", follow_ups: [] });
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, history: history.slice(-MAX_TURNS) }),
      signal: ctrl.signal,
    }).then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j || typeof j.answer !== "string") throw new Error("bad reply");
        return j;
      })
      .catch(function () { return { kind: "fallback", answer: UNAVAILABLE, citations: [], focus: "none", follow_ups: [] }; })
      .finally(function () { clearTimeout(timer); });
  }

  function ask(question) {
    question = question.trim().slice(0, MAX_LEN);
    if (!question || busy) return;
    busy = true;
    send.disabled = true;
    input.value = "";
    chips.textContent = "";
    show(el("p", "ask-q", question), scrollDown);
    var wait = el("p", "ask-wait", "Reading the facts");
    show(wait, scrollDown);
    request(question).then(function (data) {
      wait.remove();
      if (data.kind !== "fallback") history.push({ question: question, answer: data.answer.slice(0, 1000) });
      showAnswer(data);
      if (data.kind !== "fallback") fly(data.focus);
    }).finally(function () {
      busy = false;
      send.disabled = false;
      if (open && !touch) input.focus({ preventScroll: true });
    });
  }

  function setOpen(next) {
    open = next;
    toggle.setAttribute("aria-expanded", String(next));
    if (motion) gsap.killTweensOf(panel);
    if (next) {
      panel.hidden = false;
      toggle.classList.add("is-open");
      if (!log.children.length) setChips(SUGGESTED);
      if (motion) gsap.fromTo(panel, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .5, ease: "expo.out" });
      if (!touch) input.focus({ preventScroll: true });
    } else {
      toggle.classList.remove("is-open");
      var done = function () { panel.hidden = true; toggle.focus({ preventScroll: true }); };
      if (motion) gsap.to(panel, { opacity: 0, y: 12, duration: .22, ease: "power2.in", onComplete: done });
      else done();
    }
  }

  toggle.addEventListener("click", function () { setOpen(!open); });
  close.addEventListener("click", function () { setOpen(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) setOpen(false); });
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); });

  if (wantsStub) {
    var s = document.createElement("script");
    s.src = "/assets/ask-stub.js";
    document.head.append(s);
  }
});
