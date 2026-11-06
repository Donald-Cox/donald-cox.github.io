/* Scenario test for demos/01-intake.html
 *
 * Run:  node demos/test/intake.test.js
 * Exit: 0 all green, 1 something regressed.
 *
 * The reconciliation logic is the thing being demonstrated. Each assertion below
 * is a claim the demo makes to a visitor, so a silent change here would mean the
 * demo describes a system that does not behave that way.
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const HTML = path.join(__dirname, "..", "01-intake.html");
const html = fs.readFileSync(HTML, "utf8");
const blocks = html.match(/<script>[\s\S]*?<\/script>/g) || [];
if (blocks.length !== 1) {
  console.error("expected exactly one script block, found " + blocks.length);
  process.exit(1);
}
const script = blocks[0].replace(/^<script>/, "").replace(/<\/script>$/, "");

function makeNode(id) {
  return {
    id, checked: false, value: "", textContent: "", disabled: false,
    style: new Proxy({}, { get: (t, k) => t[k] || "", set: (t, k, v) => { t[k] = v; return true; } }),
    dataset: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
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
vm.runInContext(script + "\n;globalThis.__api = { readFrames, aggregate, crossRef, commitPlan, genSku, canonicalLot, isCompleteLot, PACKING_LIST, CASES, S };", sandbox);
const api = sandbox.__api;

const DEFAULTS = { swBlank: false, swLong: false, enComplete: true, enBleed: true, enLenGuard: true };
function setSwitches(over) {
  const cfg = Object.assign({}, DEFAULTS, over || {});
  Object.keys(cfg).forEach(k => { sandbox.document.getElementById(k).checked = cfg[k]; });
}
function run(over) {
  setSwitches(over);
  const reads = api.readFrames();
  const agg = api.aggregate(reads);
  const xref = api.crossRef(reads, agg);
  return { reads, agg, xref };
}

let failed = 0;
function check(desc, cond, detail) {
  if (!cond) failed++;
  console.log((cond ? "  ok   " : "  FAIL ") + desc + (cond || detail === undefined ? "" : "   got: " + detail));
}

/* ---- 1. the clean pallet ---- */
{
  const r = run({});
  const byLot = {};
  r.agg.lots.forEach(L => { byLot[L.lot] = L.cases; });
  check("clean pallet resolves 6 lots", r.agg.lots.length === 6, r.agg.lots.length);
  check("the short printed case merges into its sibling lot", byLot["L26-0419-A"] === 2, byLot["L26-0419-A"]);
  check("total cases equal the packing list total (10)",
        r.agg.lots.reduce((a, L) => a + L.cases, 0) === 10);
  check("no frame is left unaccounted for", r.agg.dead.length === 0, r.agg.dead.length);
  check("all three products agree across list, side and close ups",
        r.xref.every(x => x.agree), JSON.stringify(r.xref));
}

/* ---- 2. the completeness defect ---- */
{
  const r = run({ enComplete: false });
  const byLot = {};
  r.agg.lots.forEach(L => { byLot[L.lot] = L.cases; });
  check("strict completeness loses the short printed case", byLot["L26-0419-A"] === 1, byLot["L26-0419-A"]);
  check("and the loss shows up as a cross reference discrepancy",
        r.xref.some(x => x.product === "ABR-080" && !x.agree));
  check("the drop is surfaced in a note rather than being silent",
        r.agg.notes.some(n => n.k === "stop"));
}

/* ---- 3. the bleed guard ---- */
{
  const on = run({ enBleed: true });
  const off = run({ enBleed: false });
  const onLot = on.agg.lots.find(L => L.lot === "L26-0419-A");
  const offLot = off.agg.lots.find(L => L.lot === "L26-0419-A");
  check("with the guard on, the neighbouring case edge is dropped", onLot.cases === 2, onLot.cases);
  check("with the guard off, a phantom case appears", offLot.cases === 3, offLot.cases);
  check("the phantom is flagged, not hidden", offLot.flags.indexOf("phantom") >= 0);
  check("and it breaks the cross reference",
        off.xref.some(x => x.product === "ABR-080" && !x.agree));
}

/* ---- 4. the blank frame ---- */
{
  const r = run({ swBlank: true });
  check("a blank frame is reported as producing no lot", r.agg.dead.length === 1, r.agg.dead.length);
  check("the affected product falls short on close ups",
        r.xref.some(x => x.product === "ABR-120" && x.close === 2 && x.list === 3));
  check("the packing list count is untouched by the bad photograph",
        r.xref.find(x => x.product === "ABR-120").list === 3);
}

/* ---- 5. the downstream name cap ---- */
{
  const shortSku = api.genSku("ABR-050", "L26-0417-A");
  check("a normal generated name fits the 31 character cap", shortSku.length <= 31, shortSku.length);

  const r = run({ swLong: true });
  api.S.lots = r.agg.lots; api.S.dest = {};
  r.agg.lots.forEach(L => { api.S.dest[L.lot] = "sell"; });

  setSwitches({ swLong: true, enLenGuard: true });
  const guarded = api.commitPlan();
  check("with the guard on, over-cap lots are refused rather than written",
        guarded.problems.some(p => p.k === "stop" && /guard errors instead of truncating/.test(p.t)));
  check("and nothing over-cap reaches the ledger",
        guarded.items.every(i => i.sku.length <= 31));

  setSwitches({ swLong: true, enLenGuard: false });
  const unguarded = api.commitPlan();
  const merged = unguarded.items.filter(i => i.merged.length > 0);
  check("with the guard off, two distinct lots silently merge onto one record",
        merged.length === 1 && merged[0].merged.length === 1,
        JSON.stringify(unguarded.items.map(i => [i.sku, i.merged])));
  check("the surviving record keeps only 31 characters",
        merged.length === 1 && merged[0].sku.length === 31,
        merged.length ? merged[0].sku.length : "no merge");
  check("the merge is reported as a stop, which is how it was eventually found",
        unguarded.problems.some(p => p.k === "stop" && /Silent merge/.test(p.t)));
}

/* ---- 6. canonical lot ---- */
{
  check("a two segment code canonicalises onto its three segment sibling",
        api.canonicalLot("L26-0419") === "L26-0419-A", api.canonicalLot("L26-0419"));
  check("a longer supplier format is kept whole, never trimmed",
        api.canonicalLot("L26-0417-A-0442-B") === "L26-0417-A-0442-B", api.canonicalLot("L26-0417-A-0442-B"));
  check("a genuine fragment is not accepted as a complete lot",
        api.isCompleteLot("L26", false) === false);
  check("a short but real lot is accepted by the corrected rule",
        api.isCompleteLot("L26-0419", false) === true);
  check("and rejected by the strict rule that lost real lots",
        api.isCompleteLot("L26-0419", true) === false);
}

console.log(failed ? "\n" + failed + " failing" : "\nall assertions hold");
process.exit(failed ? 1 : 0);
