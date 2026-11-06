/* Run every demo test, plus the checks that apply across the whole set.
 *
 *   node demos/test/run-all.js
 *
 * Exit 0 means every demo still behaves as its page claims, every page is
 * self-contained, and the shared style block has not drifted.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const SRC = path.join(__dirname, "..");
const TESTS = ["intake.test.js", "inventory-sync.test.js", "production-ledger.test.js",
               "verification-kiosk.test.js", "watchtower.test.js"];

let failed = 0;
function line(ok, msg) {
  if (!ok) failed++;
  console.log((ok ? "  ok   " : "  FAIL ") + msg);
}

console.log("== per demo ==");
TESTS.forEach(t => {
  const p = path.join(__dirname, t);
  if (!fs.existsSync(p)) { line(false, t + " is missing"); return; }
  try {
    execFileSync(process.execPath, [p], { stdio: "pipe" });
    line(true, t);
  } catch (e) {
    failed++;
    console.log("  FAIL " + t);
    console.log(String(e.stdout || "").split("\n").filter(l => /FAIL/.test(l)).map(l => "      " + l).join("\n"));
  }
});

console.log("\n== across the set ==");
const pages = fs.readdirSync(SRC).filter(f => /\.html$/.test(f)).sort();
line(pages.length === 6, "six pages present, five demos and the gallery (" + pages.length + ")");

/* Self-contained: a demo that reaches the network is not publishable as one file.
   A canonical link names the page and fetches nothing, so it is the one exception. */
const EXTERNAL = /(src|href)\s*=\s*["']\s*(https?:)?\/\//i;
pages.forEach(p => {
  const t = fs.readFileSync(path.join(SRC, p), "utf8");
  const hits = t.split("\n")
    .map((l, i) => ({ l, i }))
    .filter(x => EXTERNAL.test(x.l) && !/xmlns/.test(x.l) && !/^<link rel="canonical" href="https:\/\/doncox\.ai\/[^"]*">$/.test(x.l));
  line(hits.length === 0, p + " makes no external requests" +
       (hits.length ? "  (line " + (hits[0].i + 1) + ")" : ""));
});

/* One script block per page keeps the test harness honest, and no page may build
   markup from a string: operator entered text reaches the DOM on several of these. */
pages.forEach(p => {
  const t = fs.readFileSync(path.join(SRC, p), "utf8");
  const n = (t.match(/<script>/g) || []).length;
  line(n <= 1, p + " has at most one script block (" + n + ")");
  line(!/\.innerHTML\s*=/.test(t) && !/insertAdjacentHTML/.test(t),
       p + " never builds markup from a string");
});

/* House style. These are operator visible pages and the rule is absolute.
   This file is the one place those characters legitimately appear, because a
   detector has to contain what it looks for. It scans the pages, never itself. */
pages.forEach(p => {
  const t = fs.readFileSync(path.join(SRC, p), "utf8");
  const tells = [];
  if (t.indexOf("\u2014") > -1) tells.push("em dash");
  if (t.indexOf("–") > -1) tells.push("en dash");
  if (t.indexOf("…") > -1) tells.push("ellipsis");
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)) tells.push("emoji");
  line(tells.length === 0, p + " carries no AI tells" + (tells.length ? "  (" + tells.join(", ") + ")" : ""));
});

/* Labels use a real separator, never a comma with a space in front of it. */
pages.forEach(p => {
  const t = fs.readFileSync(path.join(SRC, p), "utf8");
  const n = t.split("\n").findIndex(l => / ,[ "]/.test(l));
  line(n < 0, p + " has no spaced comma" + (n < 0 ? "" : "  (line " + (n + 1) + ")"));
});

/* Search and share tags, since these pages are in the sitemap. */
pages.forEach(p => {
  const t = fs.readFileSync(path.join(SRC, p), "utf8");
  const want = ['<meta name="description"', '<link rel="canonical"', '<meta property="og:url"', '<meta property="og:image:alt"', '<meta name="twitter:image"', '<meta name="theme-color"'];
  const missing = want.filter(w => t.indexOf(w) < 0);
  line(missing.length === 0 && /<title>[^<]* \| Donald Cox<\/title>/.test(t), p + " carries its head tags" + (missing.length ? "  (" + missing.join(", ") + ")" : ""));
});

/* The shared style block must be identical everywhere. */
const BEGIN = "/* ==== NB SHARED TOKENS v1 =";
const END = "/* ==== END NB SHARED TOKENS =";
function blockOf(text) {
  const a = text.indexOf(BEGIN);
  if (a === -1) return null;
  const b = text.indexOf(END, a);
  if (b === -1) return null;
  const e = text.indexOf("\n", b);
  /* Compare on normalised line endings. A fresh clone can arrive with CRLF
     depending on the checkout, and a byte comparison would report drift that
     does not exist. */
  return text.slice(a, e).replace(/\r\n?/g, "\n").replace(/\n$/, "");
}
const source = blockOf(fs.readFileSync(path.join(SRC, "04-verification-kiosk.html"), "utf8"));
line(!!source, "the shared style block is findable in the source of truth");
pages.forEach(p => {
  const b = blockOf(fs.readFileSync(path.join(SRC, p), "utf8"));
  line(b === source, p + " shares the exact style block");
});

/* Phone layout guards. A grid column set inline beats the media query that stacks
   it, and a grid child that may not shrink widens the whole page around a wide table. */
["02-inventory-sync.html", "03-production-ledger.html"].forEach(p => {
  const t = fs.readFileSync(path.join(SRC, p), "utf8");
  line(!/style="[^"]*grid-template-columns/.test(t), p + " sets no grid columns inline");
});
["01-intake.html", "02-inventory-sync.html"].forEach(p => {
  line(/\.scrollx\{overflow-x:auto\}/.test(fs.readFileSync(path.join(SRC, p), "utf8")), p + " defines the scroll wrapper its wide tables rely on");
});
line(/max-width:720px\)\{\s*\.ledger \.row\{flex-wrap:wrap\}\s*\.ledger \.row span\{white-space:normal\}/.test(fs.readFileSync(path.join(SRC, "01-intake.html"), "utf8")), "01-intake.html wraps its ledger rows on phones");
line(/id="log"[^>]*tabindex="0"|tabindex="0"[^>]*id="log"/.test(fs.readFileSync(path.join(SRC, "02-inventory-sync.html"), "utf8")), "02-inventory-sync.html lets a keyboard reach its scrolling log");
line(!/el\("h3"/.test(fs.readFileSync(path.join(SRC, "05-watchtower.html"), "utf8")), "05-watchtower.html keeps its dossier headings in order");
line(/\.finding \.rule\{height:auto/.test(fs.readFileSync(path.join(SRC, "05-watchtower.html"), "utf8")), "05-watchtower.html keeps finding titles out from under the shared 1px rule style");
const sync = fs.readFileSync(path.join(SRC, "02-inventory-sync.html"), "utf8");
line(/\.three>\*\{min-width:0\}/.test(sync) && /\.scrollx\{overflow-x:auto\}/.test(sync), "02-inventory-sync.html scrolls wide tables inside their panels");
const kiosk = fs.readFileSync(path.join(SRC, "04-verification-kiosk.html"), "utf8");
line(/max-width:720px\)\{\s*\.seam\{grid-template-columns:1fr\}/.test(kiosk), "04-verification-kiosk.html stacks the blind seam on phones");
line(kiosk.indexOf(".divider span{position:static") > kiosk.indexOf(".divider span{\n") && /\.divider span\{position:static/.test(kiosk), "04-verification-kiosk.html keeps the blind label out of the column under it on phones");

/* Optional check against a term list kept outside this repo. A copy without the list skips it.
   Setting SHOWCASE_BANNED_FILE or REQUIRE_LEAK_LIST turns a missing or empty list into a failure. */
const requireList = !!(process.env.SHOWCASE_BANNED_FILE || process.env.REQUIRE_LEAK_LIST);
const bannedFile = process.env.SHOWCASE_BANNED_FILE || [
  path.join(SRC, "..", "..", "banned-terms.txt"),
  path.join(SRC, "..", ".git", "info", "banned-terms")].find(f => fs.existsSync(f));
const bannedTerms = bannedFile && fs.existsSync(bannedFile)
  ? fs.readFileSync(bannedFile, "utf8").split("\n").map(s => s.trim()).filter(Boolean).join("|") : "";
const BANNED = bannedTerms ? new RegExp(bannedTerms, "i") : null;
if (BANNED || requireList) line(!!BANNED, "term list loaded" + (BANNED ? "" : ": not found or empty, so the check could not run"));
else console.log("  skip term list check: no list in this copy");
pages.forEach(p => {
  const t = fs.readFileSync(path.join(SRC, p), "utf8");
  if (!BANNED) return;
  const hit = t.split("\n").find(l => BANNED.test(l));
  line(!hit, p + " passes the term list check" + (hit ? "  (line " + (t.split("\n").indexOf(hit) + 1) + ")" : ""));
});

console.log(failed ? "\n" + failed + " check(s) failing" : BANNED ? "\neverything green" : "\ngreen, but the term list check did not run");
process.exit(failed ? 1 : 0);
