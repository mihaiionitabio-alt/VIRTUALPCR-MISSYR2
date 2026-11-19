# MISSY R2 0.4.40 — review notes for Claude

- Fixed advanced interview multi-selection: individual cards toggle, Use selected cards commits, and spoken multiple option numbers are accepted together.
- Translated Chinese answer-card values, template/material names, advanced sections and read-back labels; JSON schema keys remain English.
- Added one append-only component/function code system across R2, the linked MISSY page and developer source: 114 source components, 15,071 static functions, 12 native inline facets. Dynamically compiled strings are outside static coverage. Anonymous callback keys require review when moving functions.
- Added a bounded, argument-free coded dispatcher for Voice.Submit, Batch.Generate and Missy.Open; retained existing browser APIs and numerical behaviour.
- Validated native FPP models and generated 12 compact serpentine topology diagrams, 11-command dictionaries, six telemetry channels, three events, one parameter, ASTs and 126 design documents. Removing ID comments from linked MISSY reproduces the preceding source exactly.
- Added ten illustrated wiki pages, selected operating screenshots and a searchable function catalogue. Runtime ZIP includes the used wiki HTML/images, not Markdown or tests.
- Complete final English (16 questions) and Chinese (60 questions) interviews generated four runs and opened their raw RDMLt files in MISSY. SOP and Results were populated; Chinese configured method correctly returned Accepted with review. Each run contained 25 telemetry metrics.
- Separate complete Technician PCR and 20-run MISSY import passed. The captured Control panel shows 20 experiments, 30 charts in control, two to watch, one alarming and two collecting a baseline. Alarms are displayed, not hidden to make the scene look normal.
- Wake-only and interim interruption, wake-then-command, PCM acknowledgement/navigation tones, card equivalence, paging, JSON-only history, 10/15-minute sessions, expiry, sound pause/resume, denied microphone and exit cleanup passed scripted browser tests.
- Speech input/output were substituted for repeatability. Physical microphone recognition, acoustic echo and operating-environment suitability were not measured. Chinese UI/TTS is supported; local recognition currently uses English commands.
- Generated C++ unit-test scaffolds are supplied separately and were not compiled or run. No native GDS connection, binary controller build or GDS integration-test report is claimed.
- Five-minute silent 1920×1080, 30 fps walkthrough with English SRT: startup, profile builders, voice cards, generation, 24-second integer-acquisition PCR replay, raw RDMLt files, real full-screen import progress, SOP, Results, 20-run Control panel, seven-second What if scene, architecture and wiki.

Reproduction: see docs/wiki/Reproduction.md, package.json, architecture/tool-validation.json and architecture/verification.json. The generated website is built with python scripts/build_site.py. Source and browser/runtime output remain separate.

Post-deployment verification: both complete interviews were repeated successfully on the live 0.4.40 URL, generating four additional runs and opening them in MISSY. All 13 wiki architecture images and the live native-function catalogue loaded without browser errors.
