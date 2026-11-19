# Generated artifacts and their status

## Generated and checked

- Function inventory and append-only identifier registry for static JavaScript/Python functions, including bundled analysis code.
- `.fpp` component definitions and software topologies, checked with native `fpp-check`.
- Native `fpp-to-layout` connection files, `fprime-layout` JSON positions and SVG/PNG diagrams.
- Native `fpp-to-dict` JSON dictionaries: combined workbench and linked-MISSY commands, telemetry, events and a microphone-session parameter.
- Native `fpp-to-json` AST, analysis and source-location maps. Local workstation paths are replaced with `$PROJECT` in published output.
- C++ unit-test and helper scaffolds generated with `fpp-to-cpp -u -a`. These files are generated source, not compiled or executed tests.
- Component design documents and source-code links.
- Browser command-dispatch unit tests, complete voice-interview logs, RDMLt/SOP result checks and telemetry checks.

## Runtime boundary

The running program is JavaScript in the browser. Its coded dispatcher currently handles Voice.Submit, Batch.Generate and Missy.Open. Existing namespace interactions are inventoried as source dependencies; the diagrams also show inventory membership and logical workflow links.

The operator FPP dictionary is a model contract. A live native GDS/CLI connection, binary command sequences and a compiled C++ implementation require an agreed adapter/transport and implementation. No such connection or binary is claimed here. The current supported reusable execution format is the JSON run profile.

RDMLt packages already catalogue simulation results, procedure information, timestamps, telemetry and checksums. This does not mean a native F Prime Data Product service is running. The dictionary therefore has no science data-product containers or records defined.

No laboratory controller binary or processor-specific build is supplied without a defined target and validated implementation. The generated C++ scaffolds are provided separately so they cannot be mistaken for a browser runtime dependency.
