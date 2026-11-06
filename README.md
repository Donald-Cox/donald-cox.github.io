# donald-cox.github.io

My portfolio site, live at https://doncox.ai: case studies of the AI systems I build and run, plus browser demos of the shop-floor systems on made-up data.

Plain HTML, CSS and a little JavaScript, served by GitHub Pages from `main`. No build step.

## Checks

    node tools/check-site.mjs      # head tags, broken links, external assets, 200 KB page budget
    node demos/test/run-all.js     # every demo still behaves the way its page says

## Demos

The demos in `demos/` run entirely in the browser on made-up data.
