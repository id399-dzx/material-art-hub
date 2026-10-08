# Official data chart examples

`/chart-examples` uses the complete visible Apache ECharts gallery: 39 categories, 329 distinct examples and 365 category entries. Category membership and order are checked against an independent capture of the official gallery DOM.

## Fidelity

- Gallery previews are original WebP bytes, including the original dark previews; they are displayed at their original 4:3 aspect ratio without recoloring or cropping.
- The 329 JavaScript examples are copied verbatim from the deployed official site. The 263 TypeScript sources are copied from upstream revision `88ca004030e999073a15303e5fe32462b8fefae2`.
- The editor is built from the official Vue source. Chart code, chart CSS, datasets and textures retain their original contents. Navigation, editor chrome, mobile controls and execution isolation are adapted. HTML export also includes compiled TypeScript, the actual extension libraries and absolute data paths.
- Its separate ECharts 6.1.0 runtime matches the official gallery; the existing scientific template editor keeps its existing runtime.

## Assets and execution

All previews, editor libraries, source files, JSON, SVG, CSV, images and HDR textures are served locally under `/echarts-official`. Large binary GPS/street chunks use fixed Next.js streaming rewrites to the same pinned public Apache repository. No arbitrary destination or private data proxy is exposed. Rendering these large examples still requires a network connection and suitable browser hardware, as on the original gallery.

User chart code runs inside an opaque `srcdoc` iframe without `allow-same-origin`. It can run custom rendering functions, timers, DOM and sample interactions, but cannot read the website session. Both sides check the messaging window. The trusted editor chrome supports original JS/TS editing, formatting, automatic/manual execution, full code/configuration, rendering controls, screenshots, HTML export, sharing and external code playgrounds. Mobile views switch between the code and chart without reducing chart dimensions to zero.

## Reproduction and checks

The `provenance-*.json` files record metadata selection, original Git blob hashes, source SHA256 hashes, package archive integrity and runtime file hashes. License and notice files remain alongside their corresponding dependencies.

```sh
node scripts/vendor-echarts-catalog.mjs
node --experimental-strip-types scripts/vendor-echarts-sources.mjs
node scripts/vendor-echarts-data.mjs
node scripts/vendor-echarts-runtime.mjs
node scripts/build-echarts-editor.mjs
node vendor/echarts-examples/build/verify-download.js
node --experimental-strip-types --test src/lib/chart-examples/*.test.mjs
```

The upstream build source is in `vendor/echarts-examples`; its dependencies are only needed when rebuilding that editor. Checked-in static editor output is used by normal website builds. Before refreshing the mirror, review any upstream changes rather than automatically changing the documented gallery snapshot.

Source: https://github.com/apache/echarts-examples — Apache License 2.0. Individual runtime dependency licenses are preserved in `/echarts-official/vendors`.
