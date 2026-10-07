# Independently rendered drawing previews

Every SVG is generated from Fesilent Reverie demonstration tables, column bindings and the same ECharts renderer and initial per-chart style as the single-chart editor. The complete canvas, axes, legends and labels are included. The demonstration values are examples, not reported paper results.

The current library contains **182** rendered previews: 139 L1502 presets, 18 paper-style references, 17 general templates and eight independently authored electrochemical presets. The web chart geometry and example tables are independently implemented. No publication-image crops or source experimental datasets are included in the preview SVGs.

## Paper-style references

The following templates retain selected chart structures and palette references from Chen Liu and collaborators' [figures4papers](https://github.com/ChenLiu-1996/figures4papers), revision `f0bb7559abe90f5e1828797126d4d133c1bd47d7`:

- `paper-immuno-comparison-auroc`: `figure_ImmunoStruct/figures/bars_comparison_IEDB.png`, panel `auroc`
- `paper-brainteaser-composition-composition-1`: `figure_Brainteaser/figures/brute_force.png`, panel `composition-1`
- `paper-dispersion-spheres-dispersion`: `figure_Dispersion/figures/illustration.png`, panel `dispersion`
- `paper-dispersion-spheres-regularization`: `figure_Dispersion/figures/illustration.png`, panel `regularization`
- `paper-vigil-radar-radar`: `figure_VIGIL/figures/comparison_radar.png`, panel `radar`
- `paper-vigil-training-training`: `figure_VIGIL/figures/comparison_posttraining.png`, panel `training`
- `paper-vigil-concept-distribution`: `figure_VIGIL/figures/concept.png`, panel `distribution`
- `paper-ophthal-trend-text-trend`: `figure_ophthal_review/figures/trend_by_month.png`, panel `text-trend`
- `paper-immuno-iedb-results-embedding-4`: `assets/ImmunoStruct_results_IEDB.png`, panel `embedding-4`
- `paper-immuno-iedb-results-ablation-1`: `assets/ImmunoStruct_results_IEDB.png`, panel `ablation-1`
- `paper-immuno-iedb-results-distribution`: `assets/ImmunoStruct_results_IEDB.png`, panel `distribution`
- `paper-immuno-iedb-results-attention`: `assets/ImmunoStruct_results_IEDB.png`, panel `attention`
- `paper-immuno-iedb-results-peptide-scatter`: `assets/ImmunoStruct_results_IEDB.png`, panel `peptide-scatter`
- `paper-immuno-iedb-results-high-frequency`: `assets/ImmunoStruct_results_IEDB.png`, panel `high-frequency`
- `paper-immuno-cedar-results-vaccine-box`: `assets/ImmunoStruct_results_CEDAR.png`, panel `vaccine-box`
- `paper-dispersion-observation-density-1`: `assets/Dispersion_observation.png`, panel `density-1`
- `paper-dispersion-observation-correlation-1`: `assets/Dispersion_observation.png`, panel `correlation-1`
- `paper-dispersion-distillation-correlation`: `assets/Dispersion_observation_distillation.png`, panel `correlation`

Those source references use Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0); see the retained [source license](../paper-figures/LICENSE.txt). Fesilent Reverie changes: single-chart layouts, independent demo data, dynamic axes and labels, and SVG rendering instead of image cropping.

## Color design references

Selected color values and same-data comparison workflow reference [plot-is-all-you-need](https://github.com/liouhai/plot-is-all-you-need), MIT. See [attribution](../plot-style-references/ATTRIBUTION.md). No publication images from that gallery are included.

Regenerate with `node --experimental-strip-types scripts/generate-drawing-previews.mjs --check`. The generator removes obsolete SVG files and preserves this attribution document.
