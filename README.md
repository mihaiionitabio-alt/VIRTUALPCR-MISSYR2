# VIRTUALPCR/MISSYR2

## Live website

site is live at https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/

Version **0.4.30** — a browser-based virtual real-time PCR workbench with Technician learning levels and MISSY analysis.

## Offline download

[Download the complete offline website](https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/downloads/MISSY_R2_workbench_site_0.4.30.zip).

Extract the ZIP and open `pcr-workbench/index.html`. Experiment files stay in your browser. The level-unlock quizzes are separate from PCR runs; starting a run does not open another quiz.

Source acknowledgements are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).

## 0.4.30 fixes

- Loading counters stop at completion or error; failed transfers can be retried.
- Startup timeouts and cancelled transfers no longer leave stale progress screens.
- Completed guided-run results stop redrawing, preserving editable fields.
- Charts with measured points but insufficient history say “collecting baseline”.
- Older workbench run files and templates remain readable.

## Sources and credits

The welcome page links to the [sources and credits](https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/credits.html): scientific references, source repositories, example-data credits and licence notices. The static page and `data/credits.json` are included in the offline website. Run `python scripts/build_credits.py` after editing the curated source list.

## JSON batch generation (0.4.30)

On the welcome page, **Create JSON profile** opens a configurable profile builder. Start from a template, set run count and seed, edit DNA, mix, reagent/handling and programme fields, and configure sample materials, labels and extraction dates. Select optional fault scenarios; selected faults rotate across the batch, one per run. Use **Download profile** to save settings. **Run JSON profile** accepts a saved file or pasted JSON without navigating the Technician tabs.

The format is `missy-r2-batch/1`: `count` is a positive integer; `seed` is a positive 32-bit integer; `template` uses the existing Technician template fields; `samples` contains material preset keys, extraction dates and labels; `sample` contains the first sample's composition; `extractions` preserves extraction/control metadata; `scenarioIds` lists armable scenario IDs (empty for normal runs). Starting from a template is recommended because crop, assay, layout and scenario requirements must agree.

Generation runs sequentially with progress and cancellation. Completed runs remain in the current browser tab and appear in Quality manager, including normal SOP and MISSY hand-off. Individual `.rdmlt` downloads and a generated-file ZIP are available in the runner. Each package retains the batch profile in `source/run-input.json`. Save both profile and output files before closing the tab. Large batches retain raw telemetry in browser memory; cancel and download completed runs when needed. This is an offline simulator, not executable JavaScript: uploaded profiles are parsed as JSON.

Implementation: `js/ui/batch.js`; example profile: `data/batch-example.json`. Browser checks covered two complete normal runs opened together in MISSY (both Accepted, 17 result rows each), sample controls, profile import/export, a labelled light-source fault, ZIP output and cancellation.

## Development preview: multi-configuration plans

The public main branch has been restored to 0.4.29. This development worktree is a preview, not deployed to GitHub Pages.

The compact builder groups controls into collapsible sections and maintains a configuration sidebar. Set the first configuration's file count, choose **Duplicate configuration**, change one parameter and give that variant its own file count. Each configuration is a complete independent snapshot; editing one does not alter the others. The sidebar shows total output count and differences against the baseline. Profiles download as `missy-r2-batch-plan/1` with a `configurations` array; each entry retains the original `missy-r2-batch/1` schema and its own `count`. Existing single-configuration profiles remain accepted. The runner executes the groups in order, preserves their distinct inputs in RDMLt and files all completed runs in Quality manager.

Verified: two baseline runs at ambient 22 °C and one variant at 24 °C generated three completed runs with input values [22, 22, 24]; profile round-trip, mobile layout and rollback of the live site also passed. Example: `data/batch-plan-example.json`.

## Combined Claude/development preview

This local preview adopts the shared live/batch run engine and typed builder from the supplied Claude 0.4.30 package, adds compatibility with earlier batch plans, and adds built-in extraction/replicate/control-count design to Technician and JSON runs. The public main branch remains at 0.4.29. Examples: `data/claude-example.missy-runs.json` and `data/custom-design.missy-runs.json`. The controls in Technician Sample and Plate apply to live runs and are preserved in templates, SOP layout and RDMLt metadata. Original method acceptance rules remain applicable.
