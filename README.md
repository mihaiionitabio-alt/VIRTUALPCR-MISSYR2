# VIRTUALPCR/MISSYR2

[Open the live website](https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/) · [Download offline 0.4.35](https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/downloads/MISSY_R2_workbench_site_0.4.35.zip)

Version **0.4.35**, under active development. A browser-based virtual real-time PCR workbench for research and training, with Technician learning levels and bundled MISSY analysis. It is not validated for laboratory use.

## Features

- Prepare a virtual 384-well plate; configure samples, DNA extractions, PCR replicates, controls, reagents, handling, programmes and teaching fault scenarios.
- Follow amplification and block-temperature traces, then review results, SOP evidence and telemetry in MISSY.
- Build reusable JSON run profiles using **Assisted**, **Visual blocks** or **Audio interview**; run multiple independent configurations with their own repeat counts.
- Generate raw `.rdmlt` packages containing fluorescence, run metadata, SOPs and simulated instrument telemetry. RDMLt is this project's draft telemetry package around an RDML core.
- Use English or Simplified Chinese, keyboard/mouse controls, optional local speech recognition and MISSY-style full-screen panels.
- Keep experiment processing on your computer. Saved Audio history contains structured JSON settings/decisions, not raw conversation wording.

## Offline use

Download and extract the whole ZIP, then open `pcr-workbench/index.html` in a compatible desktop browser. No installation or server is needed for ordinary simulation and analysis. A supported browser and initial language-pack installation are needed for optional on-device voice recognition. Speech support depends on the browser and installed pack; typed controls remain available.

The JSON Create and Run shortcuts are on the welcome page. The profile format is `missy-r2-batch/1`; use the builders or examples in `data/` to create independent run groups. Download profiles to reuse settings. Generation runs sequentially; completed runs remain available in the current browser tab and Quality manager. Download output files before closing the tab. Large batches and telemetry use browser memory.

## 0.4.35 startup-log clarification

- Give each of the 72 loaded components a distinct English and Chinese name.
- Mark events as LOADED, with elapsed startup time and the interval since the previous component, instead of showing repeated generic OK labels.
- State that the log reports component loading, not diagnostic test results.
- Validate unique labels, paths and the declared module count during the build; prevent duplicate onload notifications from inflating the counter.
- Preserve 0.4.34 navigation, animal shortcuts, sound settings and visible microphone controls.

## Sources and development

[Sources and credits](https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/credits.html), [source notices](THIRD_PARTY_NOTICES.txt) and embedded dependency notices document the supplied references and code ancestry. Preserve these notices when redistributing; do not assume a single licence covers every bundled asset.

Build the static website and matching offline ZIP with `python scripts/build_site.py`. The GitHub Pages workflow publishes `_site` from `main`. Simulator outputs are artificial teaching data and do not establish real sample results, instrument qualification or clinical validity.
