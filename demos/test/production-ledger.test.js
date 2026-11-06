/* Scenario test for demos/03-production-ledger.html
 *
 * Run:  node demos/test/production-ledger.test.js
 * Exit: 0 all green, 1 something regressed.
 *
 * Two things are being demonstrated and both have to be right: the ledger
 * arithmetic (append only, nothing vanishes, corrections record before and after) and the
 * barcode (a visitor is invited to scan it with a phone, so it had better encode
 * what the label says).
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const HTML = path.join(__dirname, "..", "03-production-ledger.html");
const html = fs.readFileSync(HTML, "utf8");
const blocks = html.match(/<script>[\s\S]*?<\/script>/g) || [];
if (blocks.length !== 1) {
  console.error("expected exactly one script block, found " + blocks.length);
  process.exit(1);
}
const script = blocks[0].replace(/^<script>/, "").replace(/<\/script>$/, "");

function makeNode(id) {
  return {
    id, checked: false, value: "", textContent: "", disabled: false, hidden: false,
    style: new Proxy({}, { get: (t, k) => t[k] || "", set: (t, k, v) => { t[k] = v; return true; } }),
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { return c; }, removeChild() {}, setAttribute() {},
    addEventListener() {}, focus() {}, querySelectorAll() { return []; },
    get firstChild() { return null; }, get parentNode() { return null; }
  };
}
const NODES = {};
const sandbox = {
  console,
  document: {
    getElementById: id => NODES[id] || (NODES[id] = makeNode(id)),
    createElement: t => makeNode(t),
    createTextNode: t => ({ text: t }),
    querySelectorAll: () => [],
    importNode: n => n
  },
  DOMParser: function () {
    this.parseFromString = () => ({ getElementsByTagName: () => [], documentElement: {} });
  },
  requestAnimationFrame: () => {},
  setInterval: () => 0,
  setTimeout: () => 0
};
vm.createContext(sandbox);
vm.runInContext(script + "\n;globalThis.__api = { ST, VARIATIONS, WORKLIST, STAGES, C39, code39Elements, svgBarcode, startBatch, advance, complete, assign, receive, correct, printTraveller, printLabels, watch, onHand };", sandbox);
const api = sandbox.__api;

let failed = 0;
function check(desc, cond, detail) {
  if (!cond) failed++;
  console.log((cond ? "  ok   " : "  FAIL ") + desc + (cond || detail === undefined ? "" : "   got: " + detail));
}
function resetWorld(who) {
  api.ST.who = who || "Machinist";
  api.ST.rack = {}; api.ST.bad = 0; api.ST.ledger = []; api.ST.batches = [];
  api.ST.corrections = []; api.ST.seq = 0; api.ST.clock = 0; api.ST.pending = null;
  api.VARIATIONS.forEach(v => { api.ST.rack[v.id] = v.start; });
}
function totalOnRack() {
  return api.VARIATIONS.reduce((a, v) => a + api.onHand(v.id), 0);
}

/* ---- 1. Code 39 table integrity ----
   The most likely error in a hand written symbology table is a typo that changes
   how many elements are wide. Every Code 39 character is exactly nine elements
   with exactly three wide, so that is checkable without a scanner. */
{
  const keys = Object.keys(api.C39);
  check("the Code 39 table has all 44 characters", keys.length === 44, keys.length);
  const badLen = keys.filter(k => api.C39[k].length !== 9);
  check("every pattern is exactly nine elements", badLen.length === 0, badLen.join(","));
  const badWide = keys.filter(k => (api.C39[k].match(/w/g) || []).length !== 3);
  check("every pattern has exactly three wide elements", badWide.length === 0, badWide.join(","));
  const badChars = keys.filter(k => /[^nw]/.test(api.C39[k]));
  check("patterns contain only narrow and wide markers", badChars.length === 0, badChars.join(","));
  const dupes = {};
  keys.forEach(k => { dupes[api.C39[k]] = (dupes[api.C39[k]] || 0) + 1; });
  const collided = Object.keys(dupes).filter(p => dupes[p] > 1);
  check("no two characters share a pattern", collided.length === 0, collided.join(","));

  /* Round trip: elements back to characters, using widths alone. */
  const text = "B-1001";
  const els = api.code39Elements(text);
  const perChar = 10;                      /* nine elements plus one gap */
  const chars = (text.length + 2);         /* start and stop */
  check("element count matches nine per character plus gaps",
        els.length === chars * 9 + (chars - 1), els.length);
  check("bars and spaces strictly alternate within a character",
        els.slice(0, 9).every((e, i) => e.bar === (i % 2 === 0)));

  const decoded = [];
  for (let i = 0; i < chars; i++) {
    const start = i * perChar;
    const pat = els.slice(start, start + 9).map(e => (e.w === 3 ? "w" : "n")).join("");
    const hit = Object.keys(api.C39).find(k => api.C39[k] === pat);
    decoded.push(hit === undefined ? "?" : hit);
  }
  check("the barcode decodes back to its own text, framed by the start and stop character",
        decoded.join("") === "*" + text + "*", decoded.join(""));

  let threw = false;
  try { api.code39Elements("lower~case"); } catch (e) { threw = /cannot encode/.test(e.message); }
  check("an unencodable character throws rather than printing a wrong barcode", threw);

  const svg = api.svgBarcode("B-1001", 44);
  check("the barcode svg carries quiet zones on both sides",
        /^<svg[^>]*viewBox="0 0 \d+ 44"/.test(svg) && svg.indexOf('x="10"') > -1);
}

/* ---- 2. the rack is a ledger, and it conserves ---- */
{
  resetWorld();
  const before = totalOnRack();
  const r = api.startBatch("NB-ROD-0375-STD", 6);
  check("starting a batch succeeds when the rack can cover it", r.ok, r.why);
  check("the rack decrements immediately", totalOnRack() === before - 6, totalOnRack());
  check("the movement is recorded rather than the count being edited",
        api.ST.ledger.length === 1 && api.ST.ledger[0].delta === -6);
  check("the movement is attributed", api.ST.ledger[0].who === "Machinist");

  const b = r.batch;
  api.advance(b); api.advance(b);                 /* machining -> polish -> qc */
  check("the batch reaches qc", b.stage === "qc", b.stage);

  const badSplit = api.complete(b, 4, 1, 0);
  check("a split that does not account for every unit is refused", !badSplit.ok, badSplit.why);

  const ok = api.complete(b, 4, 1, 1);
  check("a split that accounts for every unit is accepted", ok.ok, ok.why);
  check("recut goes back on the rack", totalOnRack() === before - 6 + 1, totalOnRack());
  check("scrap moves to the bad pool rather than vanishing", api.ST.bad === 1, api.ST.bad);
  check("nothing is lost: good plus recut plus scrap equals the batch",
        b.good + b.recut + b.scrap === b.qty);
}

/* ---- 3. the lifecycle gates hold ---- */
{
  resetWorld();
  const b = api.startBatch("NB-ROD-0375-STD", 4).batch;
  check("assign is refused before the batch has walked the stages", !api.assign(b).ok);
  api.advance(b); api.advance(b);
  const early = api.advance(b);
  check("leaving qc is refused before the batch is completed", !early.ok, early.why);
  api.complete(b, 4, 0, 0);
  api.advance(b);
  check("the batch reaches laser", b.stage === "laser", b.stage);
  check("labels cannot print before assign", !api.printLabels(b).ok);
  check("assign succeeds after laser", api.assign(b).ok);
  check("the traveller prints once the batch is complete", api.printTraveller(b).ok);
  check("labels print once the batch is assigned", api.printLabels(b).ok);
}

/* ---- 4. the restricted step ---- */
{
  resetWorld("Machinist");
  const b = api.startBatch("NB-ROD-0375-STD", 2).batch;
  api.advance(b); api.advance(b); api.complete(b, 2, 0, 0); api.advance(b); api.assign(b);

  const wrongRole = api.receive(b, "Machinist", "demo");
  check("a role without permission cannot write into accounting", !wrongRole.ok, wrongRole.why);
  const wrongPw = api.receive(b, "Admin", "guess");
  check("the right role with the wrong password is refused", !wrongPw.ok, wrongPw.why);
  const good = api.receive(b, "Admin", "demo");
  check("the right role with the right password receives", good.ok, good.why);
  const again = api.receive(b, "Admin", "demo");
  check("a second receive on the same batch is refused", !again.ok, again.why);
}

/* ---- 5. a correction keeps the number and records before and after ---- */
{
  resetWorld("Admin");
  const b = api.startBatch("NB-ROD-0375-STD", 5).batch;
  api.advance(b); api.advance(b); api.complete(b, 5, 0, 0); api.advance(b); api.assign(b);
  api.receive(b, "Admin", "demo");

  const id = b.id, count = api.ST.batches.length, historyBefore = b.history.length;
  const c = api.correct(b, 4, "Admin");
  check("a correction succeeds", c.ok, c.why);
  check("the batch keeps its number and no new batch appears", b.id === id && api.ST.batches.length === count);
  check("the count changes in place", b.good === 4, b.good);
  check("the full row is saved before and after",
        c.entry.before.good === 5 && c.entry.after.good === 4 && api.ST.corrections.length === 1);
  check("the unit goes to the bad pool, so the arithmetic closes", api.ST.bad === 1 && b.scrap === 1, api.ST.bad);
  check("the batch history gains a correction entry", b.history.length > historyBefore);
  check("a received batch has its accounting receipt redone",
        b.history.some(h => /receipt cleared and the receipt leg run again/.test(h.what)));

  const twice = api.correct(b, 3, "Admin");
  check("a batch can be corrected more than once", twice.ok && api.ST.corrections.length === 2, twice.why);
  check("a count that does not fit the batch is refused", !api.correct(b, 99, "Admin").ok);
}

/* ---- 6. guards on bad input ---- */
{
  resetWorld();
  check("a batch larger than the rack is refused",
        !api.startBatch("NB-ROD-0375-STD", 999).ok);
  check("a part with no blanks on the rack cannot start",
        !api.startBatch("NB-ROD-0625-STD", 1).ok);
  check("a zero quantity batch is refused", !api.startBatch("NB-ROD-0375-STD", 0).ok);
  api.ST.who = null;
  check("a batch with no actor is refused", !api.startBatch("NB-ROD-0375-STD", 1).ok);
  api.ST.who = "Machinist";
  check("the rack never goes negative", api.VARIATIONS.every(v => api.onHand(v.id) >= 0));
}

/* ---- 6b. one action, one time ---- */
{
  resetWorld();
  const start = api.startBatch("NB-ROD-0375-STD", 6);
  const b = start.batch;
  check("a start has the same time in the batch history and the move log",
        b.history[0].t === api.ST.ledger[0].t && b.started === b.history[0].t);
  api.advance(b); api.advance(b);
  api.complete(b, 4, 1, 1);
  const done = b.history.find(h => /^completed/.test(h.what));
  const back = api.ST.ledger.find(m => /recut returned/.test(m.why));
  check("a recut return has the same time as the completion that caused it", done.t === back.t);
  check("a fractional quantity is refused, not floored",
        !api.startBatch("NB-ROD-0375-STD", 1.5).ok && /whole number/.test(api.startBatch("NB-ROD-0375-STD", 1.5).why));
}

/* ---- 7. the watcher sees the states the lifecycle leaves behind ---- */
{
  resetWorld();
  check("a clean shop produces no findings", api.watch().length === 0, JSON.stringify(api.watch()));
  const b = api.startBatch("NB-ROD-0375-STD", 3).batch;
  api.advance(b); api.advance(b); api.complete(b, 3, 0, 0);
  check("a batch parked at qc after completion is raised",
        api.watch().some(f => /completed at qc and has not moved/.test(f.t)));
  api.advance(b); api.assign(b);
  check("an assigned batch whose labels have not printed is raised",
        api.watch().some(f => /labels have not printed/.test(f.t)));
  api.printLabels(b);
  check("once labelled but not received, that state is raised instead",
        api.watch().some(f => /never reached accounting/.test(f.t)));
  check("the watcher writes nothing to the ledger",
        api.ST.ledger.every(m => typeof m.delta === "number"));
}

console.log(failed ? "\n" + failed + " failing" : "\nall assertions hold");
process.exit(failed ? 1 : 0);
