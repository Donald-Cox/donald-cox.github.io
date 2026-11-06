// Writes sitemap.xml, adds it to robots.txt and stamps canonical and sharing tags on each page.
// Run: node tools/make-sitemap.mjs https://example.com
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const base = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https:\/\//.test(base)) { console.error("usage: make-sitemap.mjs https://your-domain"); process.exit(1); }
const paths = ["/", "/work/verification-kiosk/", "/work/operations-platform/", "/demos/",
  "/demos/01-intake.html", "/demos/02-inventory-sync.html", "/demos/03-production-ledger.html",
  "/demos/04-verification-kiosk.html", "/demos/05-watchtower.html", "/privacy/", "/terms/"];
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map(p => `<url><loc>${base}${p}</loc></url>`).join("\n")}
</urlset>
`);
if (!readFileSync("robots.txt", "utf8").includes("Sitemap:")) appendFileSync("robots.txt", `Sitemap: ${base}/sitemap.xml\n`);

for (const p of paths) {
  if (p.startsWith("/demos/")) continue; // Demo pages stay self-contained, and their tests fail on any outside link.
  const file = p.endsWith("/") ? `.${p}index.html` : `.${p}`;
  let html = readFileSync(file, "utf8");
  if (html.includes('rel="canonical"')) continue;
  const tags = [`<link rel="canonical" href="${base}${p}">`, `<meta property="og:url" content="${base}${p}">`,
    `<meta property="og:image" content="${base}/assets/og.jpg">`, `<meta name="twitter:card" content="summary_large_image">`];
  writeFileSync(file, html.replace("</head>", tags.join("\n") + "\n</head>"));
}
