/* Scenario test for demos/05-watchtower.html
 *
 * Run:  node demos/test/watchtower.test.js
 * Exit: 0 all green, 1 something regressed.
 *
 * The detection rules are the thing being demonstrated. A rule that quietly stops
 * firing, or starts firing on clean traffic, turns this demo into a claim the real
 * console does not support.
 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const HTML = path.join(__dirname, "..", "05-watchtower.html");
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
  setTimeout: () => 0,
  Date: Date
};
vm.createContext(sandbox);
vm.runInContext(script + "\n;globalThis.__api = { STATE, RULES, STREAM, sweep, resetAll, ingest, evaluate, SWEEP_MINUTES };", sandbox);
const api = sandbox.__api;

function setSwitch(id, on) { sandbox.document.getElementById(id).checked = on; }
function runSweeps(n, over) {
  setSwitch("swDark", !!(over && over.dark));
  setSwitch("swDead", !!(over && over.dead));
  api.resetAll();
  for (let i = 0; i < n; i++) api.sweep();
  return api.STATE;
}
function ruleIds(state) { return state.findings.map(f => f.rule.id).sort(); }

let failed = 0;
function check(desc, cond, detail) {
  if (!cond) failed++;
  console.log((cond ? "  ok   " : "  FAIL ") + desc + (cond || detail === undefined ? "" : "   got: " + detail));
}

/* ---- 1. the clean shift ---- */
{
  const st = runSweeps(10);
  const ids = ruleIds(st);
  check("every scripted execution is ingested", st.execs.length === api.STREAM.length, st.execs.length);
  check("exactly four findings are raised on a clean shift", st.findings.length === 4, JSON.stringify(ids));
  check("the sibling-at-floor rule fires", ids.indexOf("sibling_at_floor") >= 0);
  check("the named-contradiction rule fires", ids.indexOf("named_contradiction_discarded") >= 0);
  check("the inert-floor rule fires", ids.indexOf("category_floor_inert") >= 0);
  check("the false-stop rule fires", ids.indexOf("false_hold_blurry_slip") >= 0);
  check("no station is reported silent while both are reporting",
        ids.indexOf("station_silent") < 0);
  check("no component is reported dead when none is",
        ids.indexOf("component_silent") < 0);

  const flagged = st.findings.filter(f => f.kind === "exec").map(f => f.exec.id).sort();
  check("findings land only on the four seeded orders",
        JSON.stringify(flagged) === JSON.stringify(["NB-20103", "NB-20104", "NB-20106", "NB-20108"]),
        JSON.stringify(flagged));

  const clean = st.execs.filter(e => ["NB-20101","NB-20102","NB-20105","NB-20107","NB-20109","NB-20110"].indexOf(e.id) >= 0);
  check("no rule fires on ordinary passing traffic",
        clean.every(e => api.RULES.every(r => !r.test(e))));
}

/* ---- 2. every finding is explainable ---- */
{
  const st = runSweeps(10);
  check("every rule carries the incident that created it",
        st.findings.every(f => f.rule.why && f.rule.why.length > 80));
  check("every finding carries a triage assessment",
        st.findings.every(f => f.rule.triage && f.rule.triage.length > 40));
  check("every finding carries a severity",
        st.findings.every(f => ["concern", "watch", "info"].indexOf(f.rule.sev) >= 0));
}

/* ---- 3. a station goes dark ---- */
{
  const st = runSweeps(10, { dark: true });
  const ids = ruleIds(st);
  check("the dark station is raised", ids.indexOf("station_silent") >= 0, JSON.stringify(ids));
  check("nothing from that station is ingested after it goes dark",
        st.execs.filter(e => e.station === "B" && e.t >= 10).length === 0);
  check("and the failure count a dashboard would show stays zero",
        st.execs.filter(e => e.verdict === "ERROR").length === 0);
  check("findings that depend on the dark station's traffic correctly do not appear",
        ids.indexOf("false_hold_blurry_slip") < 0 && ids.indexOf("named_contradiction_discarded") < 0);
  check("the silence is only raised once, not every sweep",
        st.findings.filter(f => f.rule.id === "station_silent").length === 1);
}

/* ---- 4. a component dies while still billing ---- */
{
  const st = runSweeps(10, { dead: true });
  const ids = ruleIds(st);
  check("the dead component is raised", ids.indexOf("component_silent") >= 0, JSON.stringify(ids));
  check("and only once", st.findings.filter(f => f.rule.id === "component_silent").length === 1);
}

/* ---- 5. the collector observes and does not mutate ---- */
{
  const before = JSON.stringify(api.STREAM);
  runSweeps(10, { dark: true, dead: true });
  check("the observed stream is never modified by the collector",
        JSON.stringify(api.STREAM) === before);
}

/* ---- 5b. the header runs on the same clock as the findings ---- */
{
  const node = id => sandbox.document.getElementById(id);
  runSweeps(0);
  check("no pass rate is shown before the first order", node("dPass").textContent === "-", node("dPass").textContent);
  check("the clock starts at the top of the shift", node("clock").textContent === "07:00:00", node("clock").textContent);
  runSweeps(2);
  check("the clock moves with the sweeps", node("clock").textContent === "07:10:00", node("clock").textContent);
}

/* ---- 6. nothing is raised before there is anything to see ---- */
{
  const st = runSweeps(1);
  check("the first sweep on a quiet shift raises nothing",
        st.findings.length === 0, JSON.stringify(ruleIds(st)));
}

console.log(failed ? "\n" + failed + " failing" : "\nall assertions hold");
process.exit(failed ? 1 : 0);
