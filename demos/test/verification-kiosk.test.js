/* Scenario test for demos/04-verification-kiosk.html
 *
 * Run:  node demos/test/verification-kiosk.test.js
 * Exit: 0 all green, 1 something regressed.
 *
 * Why this exists. The demo's decision logic IS the product being demonstrated,
 * so a cosmetic edit that quietly changed a verdict would misrepresent a real
 * system to a prospect. This reads the shipped HTML, runs the script it actually
 * serves inside a sandboxed context against a stub DOM, and asserts every
 * scenario. That mirrors the release discipline of the system being demonstrated:
 * prove the thing you are shipping behaves, not the thing you meant to ship.
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const HTML = path.join(__dirname, "..", "04-verification-kiosk.html");
const html = fs.readFileSync(HTML, "utf8");
const blocks = html.match(/<script>[\s\S]*?<\/script>/g) || [];
if (blocks.length !== 1) {
  console.error("expected exactly one script block in the demo, found " + blocks.length);
  process.exit(1);
}
const script = blocks[0].replace(/^<script>/, "").replace(/<\/script>$/, "");

/* ---- stub DOM, only what the demo touches ---- */
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
/* The appended line runs in the same scope as the demo script, so it can reach
   the top-level const bindings that a vm context does not otherwise expose. */
vm.runInContext(script + "\n;globalThis.__api = { score, read, ORDERS, CATALOG, fuzzyName, lotProved, labBlankLot, newSession, carrySubmit, carryAddPhoto, ghostCapture, labTwoLots, foldPrefix, slipCheck, SLIP_CASES, labFormat, parseAnswer, harnessVerdict, editGate, humanRuling, CANDIDATES, aaVerdict, AA_RUN, S, finalize, resetRun, runVerify, invalidate, svgGoods };", sandbox);
const api = sandbox.__api;

/* ---- helpers ---- */
const DEFAULTS = { swSwap: false, swShort: false, swBlur: false,
                   enDet: true, enUnit: true, enGroup: true, enFail: true };
function setSwitches(over) {
  const cfg = Object.assign({}, DEFAULTS, over || {});
  Object.keys(cfg).forEach(k => { sandbox.document.getElementById(k).checked = cfg[k]; });
}
function run(orderId, over) {
  setSwitches(over);
  const order = api.ORDERS.find(o => o.id === orderId);
  if (!order) throw new Error("unknown order " + orderId);
  return api.score(order, api.read(order));
}

/* ---- the contract ----
 * Each row is a claim the demo makes to a visitor. If one flips, the demo is
 * telling a story the production system does not actually tell.
 */
const CASES = [
  ["NB-20114", {},                              "PASS",   "happy path"],
  ["NB-20115", {},                              "PASS",   "the correct adjust part ships"],
  ["NB-20115", { swSwap: true },                "HOLD",   "variant swap caught by the deterministic check"],
  ["NB-20115", { swSwap: true, enDet: false },  "PASS",   "variant swap slips through with the check off, the real defect"],
  ["NB-20116", {},                              "PASS",   "merged order clears when group total equals sum of lines"],
  ["NB-20116", { enGroup: false },              "HOLD",   "merged order false-holds without the group rule"],
  ["NB-20117", {},                              "PASS",   "case pack clears once normalized to order units"],
  ["NB-20117", { enUnit: false },               "HOLD",   "case pack false-mismatches without normalization"],
  ["NB-20118", {},                              "HOLD",   "crowded frame, low confidence, honest false stop"],
  ["NB-20119", {},                              "REVIEW", "manual confirm only category"],
  ["NB-20120", {},                              "PASS",   "clears at exactly the floor"],
  ["NB-20114", { swShort: true },               "HOLD",   "one short"],
  ["NB-20114", { swBlur: true },                "HOLD",   "unreadable label fails closed"],
  ["NB-20114", { swBlur: true, enFail: false }, "PASS",   "unreadable label passes with fail-closed off"]
];

let failed = 0;
CASES.forEach(([id, over, want, desc]) => {
  let got;
  try { got = run(id, over).verdict; } catch (e) { got = "THREW: " + e.message; }
  const ok = got === want;
  if (!ok) failed++;
  console.log((ok ? "  ok   " : "  FAIL ") + id + "  got " + String(got).padEnd(7) +
              " want " + want.padEnd(7) + "  " + desc);
});

/* The single load-bearing number in the whole demo: the wrong part must score
   at or above the floor on name match alone, or the variant trap has no teeth. */
setSwitches({ swSwap: true });
const trap = api.ORDERS.find(o => o.id === "NB-20115");
const trapRead = api.read(trap)[0];
const trapScore = api.fuzzyName(api.CATALOG["NB-TRQ-014-ADJ"].name, trapRead.labelName);
const floor = api.CATALOG["NB-TRQ-014-ADJ"].floor;
const trapOk = trapScore >= floor;
if (!trapOk) failed++;
console.log("\n" + (trapOk ? "  ok   " : "  FAIL ") +
            "name match on the swapped part " + trapScore.toFixed(3) +
            " vs floor " + floor.toFixed(2) + "  (must be at or above the floor)");

/* Every scenario offered in the picker must be covered above. */
const missing = api.ORDERS.filter(o => !CASES.some(c => c[0] === o.id));
if (missing.length) {
  failed++;
  console.log("  FAIL untested scenarios in the picker: " + missing.map(o => o.id).join(", "));
}

/* ---- November lab: every switch has a scenario, and the harness has its rules ---- */
function check(name, ok){
  if(!ok) failed++;
  console.log((ok ? "  ok   " : "  FAIL ") + name);
}
console.log("");
const SKU = "NB-ABR-050-STD-L26-0417-A";
check("blank lot, gate on: code stops a 0.95", api.labBlankLot(true).verdict === "REVIEW" && api.labBlankLot(true).by === "code");
check("blank lot, gate off: the order ships", api.labBlankLot(false).verdict === "PASS");
check("lot read with a comment counts", api.lotProved(SKU, "L26-0417-A (matches expected)"));
check("lot borrowed from the slip does not count", !api.lotProved(SKU, "L26-0417-A per slip"));
check("denial words do not count", !api.lotProved(SKU, "not legible"));
check("CASE-FRAGMENT still passes, the documented open hole", api.lotProved(SKU, "L26-0417-A (partial, only the end visible)"));

let ses = api.newSession();
const c1 = api.carrySubmit(ses, true), c2 = api.carrySubmit(ses, true);
check("launder, guard on: first look is a real stop", c1.verdict === "REVIEW");
check("launder, guard on: same photos, raw PASS shown as REVIEW", c2.raw === "PASS" && c2.verdict === "REVIEW" && c2.fromAttempt === 1);
api.carryAddPhoto(ses);
const c3 = api.carrySubmit(ses, true);
check("launder, guard on: a new photo clears it", c3.verdict === "PASS");
ses = api.newSession(); api.carrySubmit(ses, false);
check("launder, guard off: the stop launders to a PASS", api.carrySubmit(ses, false).verdict === "PASS");

check("ghost, fresh on: photo is from after the press", api.ghostCapture(true, 30).kind === "fresh");
check("ghost, fresh on, no frame: reports the camera, saves nothing", api.ghostCapture(true, 30, false).kind === "none");
check("ghost, fresh off: photo is 7.7 s old at 30 s idle", api.ghostCapture(false, 30).age === 7.7);
check("ghost, fresh off: photo is 4.4 s old at 5 s idle", api.ghostCapture(false, 5).age === 4.4);

check("two lots, on: 5 and 5 pass", api.labTwoLots(true).verdict === "PASS");
const off = api.labTwoLots(false);
check("two lots, off: 4 and 6 false hold", off.verdict === "HOLD" && off.counts[0] === 4 && off.counts[1] === 6);

const slip = id => api.SLIP_CASES.find(c => c.id === id);
const sd = slip("CASE-SLIPDIGIT"), sl = slip("CASE-SLIPLETTER"), sw = slip("CASE-WRONGSLIP");
check("slip, fold on: N8 folds to NB and passes", api.slipCheck(sd.read, sd.expected, true).verdict === "PASS");
check("slip, fold on: OX folds to QX and passes", api.slipCheck(sl.read, sl.expected, true).verdict === "PASS");
check("slip, fold on: another order's slip always holds", api.slipCheck(sw.read, sw.expected, true).verdict === "HOLD");
check("slip, fold off: N8 false holds", api.slipCheck(sd.read, sd.expected, false).verdict === "HOLD");
check("slip: digits are never folded", api.foldPrefix("NB-20115", "NB-20114") === "NB-20115");

check("format, schema on: strict on every answer", [0,1,2].every(i => api.labFormat(true, i).path === "strict"));
check("format, schema off: prose is recovered and flagged", api.labFormat(false, 1).path === "recovered" && api.labFormat(false, 1).verdict === "REVIEW");
check("format, schema off: cut off answer holds", api.labFormat(false, 2).verdict === "HOLD");

const h2b = api.harnessVerdict("2b");
check("harness: 2b passes 7 of 8 and needs a ruling", h2b.status === "ruling" && h2b.total === 8 && h2b.failed === 1);
check("harness: the failed 2b gate is counts", api.CANDIDATES["2b"].gates.filter(g => !g.pass)[0].name === "Counts do not move");
const h258 = api.harnessVerdict("v2.58");
check("harness: v2.58 passes 7 of 9, with its rerun counted apart", h258.total === 9 && h258.failed === 2 && api.CANDIDATES["v2.58"].gates.filter(g => g.rerun && !g.pass).length === 1);
check("harness: 2b holds the true 8 gates, and control strict is a note", api.CANDIDATES["2b"].gates.length === 8 && api.CANDIDATES["2b"].gates.some(g => g.name === "Time") && !api.CANDIDATES["2b"].gates.some(g => /Control arm/.test(g.name)));
check("harness: v2.58 is rejected, no ruling offered", api.harnessVerdict("v2.58").status === "rejected" && !api.humanRuling("v2.58", true).recorded);
check("harness: a failed gate can't be edited after the run", api.editGate().allowed === false);
check("harness: a person's ruling is recorded", api.humanRuling("2b", true).recorded && api.humanRuling("2b", false).ship === false);
check("A/A: recorded run reads as a fair rig", api.aaVerdict(api.AA_RUN).fair);
check("A/A: a lopsided run does not", !api.aaVerdict({ pairs:8, identical:8, a:{PASS:8,HOLD:0,REVIEW:0}, b:{PASS:4,HOLD:4,REVIEW:0} }).fair);

/* Finalize closes the order, so a record can't sit under a newer verdict. */
const node = id => sandbox.document.getElementById(id);
setSwitches();
api.S.who = "Operator A"; api.S.order = api.ORDERS[0]; api.resetRun();
api.S.shotCount = 3; api.S.result = run("NB-20114");
api.finalize(null);
const finalResult = api.S.result;
check("finalize: closes the order", api.S.finalized === true);
check("finalize: verify, retake and finalize are all off", node("verify").disabled && node("aRetake").disabled && node("aFinalize").disabled);
check("finalize: the order's switches are locked", node("swShort").disabled && node("enDet").disabled);
api.runVerify();
check("finalize: a later verify does nothing", api.S.running === false && api.S.result === finalResult);
api.invalidate("changed");
check("finalize: the result under the record stays put", api.S.result === finalResult);
api.resetRun();
check("reset: opens a new verification", api.S.finalized === false && !node("swShort").disabled && api.S.result === null);

/* The synthetic photo draws the count the read reports. */
setSwitches();
api.ORDERS.forEach(o => {
  const reads = api.read(o);
  const drawn = (api.svgGoods(reads, false).match(/<g>/g) || []).length;
  check("photo count matches the read: " + o.id, drawn === reads.reduce((a, r) => a + r.visibleRaw, 0));
});

/* Every lab switch and button in the markup must be wired by the script. */
["labLotGate","labCarry","labFresh","labWorksheet","labFold","labSchema","hRun","hEdit","hShip","hHold","aaRun"].forEach(id => {
  check("wired: " + id, html.includes('id="' + id + '"') && script.includes('$("' + id + '").addEventListener'));
});

console.log(failed ? "\n" + failed + " failing" : "\nall " + CASES.length + " scenarios behave as specified");
process.exit(failed ? 1 : 0);
