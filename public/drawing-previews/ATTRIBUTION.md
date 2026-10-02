# Independently rendered drawing previews

Every SVG in this folder is generated from MaterialArtHub demonstration tables,
column bindings, and the same ECharts renderer used by the single-chart editor.
These previews include the complete chart canvas, axes, legends, and labels.
They contain no cropped publication image, image backplate, or original mechanism
illustration. The demonstration values are examples, not reported paper results.

The six `paper-*` templates retain selected chart structures and palette references
from Chen Liu and collaborators' [figures4papers](https://github.com/ChenLiu-1996/figures4papers),
revision `f0bb7559abe90f5e1828797126d4d133c1bd47d7`:

- `paper-immuno-comparison-auroc`: `figure_ImmunoStruct/figures/bars_comparison_IEDB.png`
- `paper-brainteaser-composition-composition-1`: `figure_Brainteaser/figures/brute_force.png`
- `paper-vigil-training-training`: `figure_VIGIL/figures/comparison_posttraining.png`
- `paper-ophthal-trend-text-trend`: `figure_ophthal_review/figures/trend_by_month.png`
- `paper-immuno-iedb-results-ablation-1`: `assets/ImmunoStruct_results_IEDB.png`
- `paper-immuno-iedb-results-distribution`: `assets/ImmunoStruct_results_IEDB.png`

Those source references use Creative Commons Attribution-NonCommercial 4.0
International (CC BY-NC 4.0); see the retained [source license](../paper-figures/LICENSE.txt).
MaterialArtHub changes: single-chart layouts, independent demo data, dynamic axes
and labels, and SVG rendering instead of publication-image cropping.

Regenerate with `node --experimental-strip-types scripts/generate-drawing-previews.mjs --check`.
The generator removes obsolete SVG files and preserves this attribution document.
