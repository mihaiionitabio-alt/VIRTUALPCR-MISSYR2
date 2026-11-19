# Verification and limits

## End-to-end browser checks

- Complete English interview: 16 answered questions, configurable extraction/replicate/control counts, two generated runs, two raw RDMLt files opened in MISSY, populated SOP Results and 25 telemetry metrics per run.
- Complete Chinese interview: 60 answered questions, all advanced sections, multiple selected cards, two samples per run, two generated runs and native MISSY review. The configured method produced Accepted with review; result rows and reasons remain available.
- Native wake/navigation PCM cues, interim wake interruption, separate wake word followed by command, optional card-list interruption, correct cue order and no navigation cue for an unchanged view.
- Default 10-minute and custom session duration, expiry, wake-window expiry, external sound pause/resume, local-voice failure, denied microphone and panel exit cleanup.
- Large cards, mouse/number-key/voice selection, paged choices, EN–Chinese–EN labels and JSON-only saved history.
- A 20-run import into MISSY: 20 raw RDMLt files, 25 telemetry metrics per run and 96 available control-chart entries; 30 charts in control at capture time.
- A complete Technician PCR with integer-cycle acquisitions and recorded thermal/optical data.
- Coded command dispatcher: synchronous results, asynchronous error propagation, duplicate binding rejection, bounded status events and no argument/transcript retention.

Speech recognition and local speech output are scripted test inputs; Web Audio buffers are real. Physical microphone acoustics, speaker echo, recognition accuracy and environmental operation were not measured. The UI is designed to reduce manual interaction; testing does not establish suitability for a particular operating environment.

Generated GTest scaffolds have not been compiled or run. Browser checks are not GDS Integration Test API results. Model validation is not proof of PCR scientific validity, clinical validity or hardware equivalence.
