// Pre-publish checks for the static site: required head tags, broken local links,
// external assets, and the per-page weight budget. Run: node tools/check-site.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUDGET = 200 * 1024;
const SKIP = new Set(["demos", "tools", "qa", "refs"]);
const problems = [];

function pages(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (name.startsWith(".") || (dir === ROOT && SKIP.has(name))) return [];
    if (statSync(p).isDirectory()) return pages(p);
    return extname(p) === ".html" ? [p] : [];
  });
}

function local(page, ref) {
  const path = ref.split(/[?#]/)[0];
  const p = path.startsWith("/") ? join(ROOT, path) : join(dirname(page), path);
  return existsSync(p) && statSync(p).isDirectory() ? join(p, "index.html") : p;
}

const required = [/<html lang="en">/, /<title>[^<]+<\/title>/,
  /<meta name="description" content="[^"]+">/, /<meta name="viewport"/];

const all = pages(ROOT);
if (all.length === 0) problems.push("no pages found");
for (const page of all) {
  const rel = relative(ROOT, page);
  const html = readFileSync(page, "utf8");
  for (const re of required) if (!re.test(html)) problems.push(`${rel}: missing ${re.source}`);
  for (const m of html.matchAll(/<(script|img|iframe|link|source)\b[^>]*\b(src|href)="https?:/g)) {
    if (/rel="canonical"/.test(m[0])) continue; // A canonical URL is an address, not a request.
    problems.push(`${rel}: external asset in <${m[1]}>`);
  }
  const loaded = new Set();
  for (const [, attr, ref] of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|#)/.test(ref)) continue;
    const target = local(page, ref);
    if (!existsSync(target)) { problems.push(`${rel}: broken link ${ref}`); continue; }
    if (attr === "src" || extname(target) === ".css") loaded.add(target);
  }
  let weight = Buffer.byteLength(html);
  for (const f of loaded) weight += statSync(f).size;
  if (weight > BUDGET) problems.push(`${rel}: ${Math.round(weight / 1024)} KB, budget is 200 KB`);
}

for (const p of problems) console.log(p);
process.exit(problems.length ? 1 : 0);
