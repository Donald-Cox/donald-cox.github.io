/* Scenario test for demos/02-inventory-sync.html
 *
 * Run:  node demos/test/inventory-sync.test.js
 * Exit: 0 all green, 1 something regressed.
 *
 * Three claims are being demonstrated and each is asserted here: the two reorder
 * rules fire on the right rows, the deleted third rule erases human intent exactly
 * as it did in production, and the silent-empty chain produces a green run that
 * wrote nothing.
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const HTML = path.join(__dirname, "..", "02-inventory-sync.html");
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
    className: "",
    style: new Proxy({}, { get: (t, k) => t[k] || "", set: (t, k, v) => { t[k] = v; return true; } }),
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { return c; }, removeChild() {}, setAttribute() {},
    addEventListener() {}, focus() {}, querySelectorAll() { return []; },
    get firstChild() { return null; }
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
vm.runInContext(script + "\n;globalThis.__api = { D, CATALOG, SYNCS, STATIONS, SEED_FORMS, setTime, assignmentOf, sortedForms, renderAll };", sandbox);
const api = sandbox.__api;

let failed = 0;
function check(desc, cond, detail) {
  if (!cond) failed++;
  console.log((cond ? "  ok   " : "  FAIL ") + desc + (cond || detail === undefined ? "" : "   got: " + detail));
}
function setSwitches(over) {
  const cfg = Object.assign({ swRule3: false, swDown: false, enGuard: true }, over || {});
  Object.keys(cfg).forEach(k => { sandbox.document.getElementById(k).checked = cfg[k]; });
}
function day(minute, over, forms) {
  setSwitches(over);
  api.D.forms = (forms || api.SEED_FORMS).slice();
  api.setTime(minute);
  return api.D;
}
function row(sku) { return api.D.rows.find(r => r.sku === sku); }

/* ---- 1. nothing happens before the first sync ---- */
{
  const d = day(0);
  check("no rows before the first sync", d.rows.length === 0, d.rows.length);
  check("no syncs counted", d.syncs === 0, d.syncs);
}

/* ---- 2. rule 1 opens a reorder ---- */
{
  const d = day(api.SYNCS[0]);
  check("the first sync writes every catalog row", d.rows.length === api.CATALOG.length, d.rows.length);
  check("a part that needs making gets today's date and a tick",
        row("NB-ROD-0500-STD").make === 5 && !!row("NB-ROD-0500-STD").roDate && row("NB-ROD-0500-STD").done === true);
  check("a part that does not need making is left alone",
        row("NB-ROD-0375-STD").make === 0 && row("NB-ROD-0375-STD").roDate === null);
  check("the run log records a completed run", d.log.some(e => e.k === "ok"));
}

/* ---- 3. rule 1 later, and rule 2 clears ---- */
{
  const d = day(api.SYNCS[1]);
  check("a part that goes short later opens its reorder then",
        row("NB-ROD-0375-STD").make === 2 && !!row("NB-ROD-0375-STD").roDate);
  check("an already open reorder is not re-stamped",
        row("NB-ROD-0500-STD").roDate === "05:00", row("NB-ROD-0500-STD").roDate);

  const e = day(api.SYNCS[2]);
  check("a part back in stock has its date cleared and its tick removed",
        row("NB-ROD-0500-STD").make === 0 && row("NB-ROD-0500-STD").roDate === null && row("NB-ROD-0500-STD").done === false);
  check("and a part that just went short opens one",
        row("NB-TRQ-014-STD").make === 1 && !!row("NB-TRQ-014-STD").roDate);
  check("three syncs have run by end of day", e.syncs === 3, e.syncs);
}

/* ---- 4. assignment is owned by people ---- */
{
  day(api.SYNCS[2]);
  const a = api.assignmentOf("NB-ABR-050-STD", api.D.now);
  check("a reassigned part follows the newest form submission",
        a.value === "Machining" && a.kind === "formula", JSON.stringify(a));
  const b = api.assignmentOf("NB-ROD-0375-STD", api.D.now);
  check("an untouched part falls back to its vendor",
        b.value === "Machining" && b.kind === "formula", JSON.stringify(b));

  /* newest wins, and a reassignment is reversible by appending a newer row */
  const forms = api.SEED_FORMS.concat([{ t: 100, sku: "NB-ABR-050-STD", to: "Inspection" }]);
  day(api.SYNCS[2], {}, forms);
  check("appending a newer submission overrides the older one",
        api.assignmentOf("NB-ABR-050-STD", api.D.now).value === "Inspection");
}

/* ---- 5. the rule that had to be deleted ---- */
{
  const off = day(api.SYNCS[2], { swRule3: false });
  check("with rule 3 off, no assignment cell is frozen",
        Object.keys(off.frozen).length === 0, JSON.stringify(off.frozen));

  const on = day(api.SYNCS[2], { swRule3: true });
  check("with rule 3 on, cells are frozen", Object.keys(on.frozen).length === 2, JSON.stringify(on.frozen));
  check("it reverts the assignment to the vendor",
        api.assignmentOf("NB-ABR-050-STD", api.D.now).value === "Finishing");
  check("and the cell is now static text rather than a formula",
        api.assignmentOf("NB-ABR-050-STD", api.D.now).kind === "frozen");
  check("the damage is reported rather than silent", on.log.some(e => e.k === "bad" && /rule 3 wrote the vendor/.test(e.m)));

  /* the part everyone actually notices: the form stops working, with no error */
  const laterForm = api.SEED_FORMS.concat([{ t: 1200, sku: "NB-ABR-050-STD", to: "Assembly" }]);
  day(1439, { swRule3: true }, laterForm);
  check("a later submission on a frozen row does nothing at all",
        api.assignmentOf("NB-ABR-050-STD", api.D.now).value === "Finishing",
        api.assignmentOf("NB-ABR-050-STD", api.D.now).value);
  check("and the same submission works fine on a row that was never frozen",
        (function () {
          const f = api.SEED_FORMS.concat([{ t: 1200, sku: "NB-ROD-0375-STD", to: "Assembly" }]);
          day(1439, { swRule3: true }, f);
          return api.assignmentOf("NB-ROD-0375-STD", api.D.now).value === "Assembly";
        })());

  check("rule 3 only ever targets rows a human had changed",
        (function () {
          const d = day(api.SYNCS[2], { swRule3: true }, []);   /* no human decisions at all */
          return Object.keys(d.frozen).length === 0;
        })());
}

/* ---- 6. the silent empty ---- */
{
  const guarded = day(api.SYNCS[0], { swDown: true, enGuard: true });
  check("with the guard on, an unreachable accounting host fails the run",
        guarded.log.some(e => e.k === "bad" && /run FAILED/.test(e.m)));
  check("and the tab is not left empty behind a green run", guarded.tabEmpty === false);

  const silent = day(api.SYNCS[0], { swDown: true, enGuard: false });
  check("with the guard off, the run reports complete",
        silent.log.some(e => e.k === "silent" && /run COMPLETE/.test(e.m)));
  check("while the tab is actually empty", silent.tabEmpty === true && silent.rows.length === 0);
  check("and the log columns that should have caught it are null",
        silent.log.some(e => /Items pulled: null. Rows written: null/.test(e.m)));
}

/* ---- 7. station tabs are pivots over the assignment column ---- */
{
  day(api.SYNCS[2]);
  const machining = api.D.rows.filter(r => api.assignmentOf(r.sku, api.D.now).value === "Machining");
  check("the reassigned part appears under its new station, not its vendor",
        machining.some(r => r.sku === "NB-ABR-050-STD"));
  const total = api.STATIONS.reduce((a, st) =>
    a + api.D.rows.filter(r => api.assignmentOf(r.sku, api.D.now).value === st).length, 0);
  check("every row lands on exactly one station tab", total === api.D.rows.length, total);
}

/* ---- 8. scrubbing is symmetric ---- */
{
  const forward = JSON.stringify(day(api.SYNCS[2]).rows);
  day(1439);
  const backward = JSON.stringify(day(api.SYNCS[2]).rows);
  check("replaying to the same time gives the same state in both directions",
        forward === backward);
}

/* The step button stops once the day has nothing left to run. */
{
  const node = id => sandbox.document.getElementById(id);
  day(0); api.renderAll();
  check("advance works before the day is done", node("stepBtn").disabled === false && node("resetBtn").className === "btn");
  day(api.SYNCS[api.SYNCS.length - 1]); api.renderAll();
  check("advance is off at day complete, and reset takes the highlight", node("stepBtn").disabled === true && node("resetBtn").className === "btn btn-p");
}

console.log(failed ? "\n" + failed + " failing" : "\nall assertions hold");
process.exit(failed ? 1 : 0);
