# VIRTUALPCR/MISSYR2

## Live website

site is live at https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/

Version **0.4.29** — a browser-based virtual real-time PCR workbench with Technician learning levels and MISSY analysis.

## Offline download

[Download the complete offline website](https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/downloads/MISSY_R2_workbench_site_0.4.29.zip).

Extract the ZIP and open `pcr-workbench/index.html`. Experiment files stay in your browser. The level-unlock quizzes are separate from PCR runs; starting a run does not open another quiz.

Source acknowledgements are in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).

## 0.4.29 fixes

- Loading counters stop at completion or error; failed transfers can be retried.
- Startup timeouts and cancelled transfers no longer leave stale progress screens.
- Completed guided-run results stop redrawing, preserving editable fields.
- Charts with measured points but insufficient history say “collecting baseline”.
- Older workbench run files and templates remain readable.
