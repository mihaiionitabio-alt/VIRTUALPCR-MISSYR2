# Reproduce the architecture and checks

The browser runtime needs no Node, Java or compiler. The following tools are for source maintenance and model generation only.

```text
npm ci --ignore-scripts
npm run architecture:generate
npm run architecture:check
npm run test:architecture
python scripts/generate_architecture.py
python -m venv .fpp-tools
.fpp-tools/Scripts/python -m pip install fprime-fpp==3.4.0 fprime-fpl-layout==1.0.4 jdk4py==25.0.2.1
python scripts/build_fpp_artifacts.py --tools .fpp-tools --cpp
python scripts/build_site.py
```

On Unix, use `.fpp-tools/bin/python`. Diagram rendering additionally uses Pillow. The native FPP package used here requires Java 25; the isolated tool environment provides it without changing browser operation.

The inventory generator uses Acorn and Python ASTs. Function identifiers are append-only. Removed function keys remain reserved. Rerunning generation and then `architecture:check` must be clean. Source equations and bundled dependencies are not wrapped or rewritten to change their numerical behaviour; application functions carry comments containing their codes.

Static source definitions are covered. Runtime-generated source strings and implicit browser-generated handlers are outside static-function coverage. The linked MISSY page uses the same identifier system, with detailed facets for its inline modules. Its code is annotated using ID comments; removing those comments reproduces the preceding source exactly. Library ownership and licence notices remain recorded.

## Reference material

- [F Prime components, ports and topologies](https://fprime.jpl.nasa.gov/latest/docs/user-manual/overview/03-port-comp-top/)
- [Commands, events, telemetry and parameters](https://fprime.jpl.nasa.gov/latest/docs/user-manual/overview/04-cmd-evt-chn-prm/)
- [FPP tooling and topology visualization](https://nasa.github.io/fpp/fpp-users-guide.html)
- [F Prime Layout](https://github.com/fprime-community/fprime-layout)

The supplied `fprime-devel.zip` is recorded as the reference archive. F Prime concepts and tool outputs describe MISSY's software structure and operator tooling.

When moving or renaming functions, review the identifier diff deliberately. Anonymous callbacks use lexical scope and ordinal keys; verify that their comments and catalogue entries retain the intended mapping.

Complete browser checks are available as `npm run test:browser`. Set `ROOT` to the built site directory, `OUT` to a temporary evidence directory and `BROWSER_PATH` to an installed full Chrome executable. Recording also requires Playwright's FFmpeg support (`npx playwright-core install ffmpeg`). The test scripts explicitly substitute local speech input and output for repeatability.
