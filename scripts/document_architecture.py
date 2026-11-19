"""Write unified application/linked-analysis design documents from validated inventories."""
from pathlib import Path
import hashlib
import json
import shutil
ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/'docs/wiki'
SDD=ROOT/'architecture/sdd'
SDD.mkdir(exist_ok=True)
cat=json.loads((ROOT/'architecture/function-catalogue.json').read_text(encoding='utf-8'))
parts=cat['components']+cat.get('subcomponents',[])
for component in parts:
    code=component['code'];rows=[f for f in cat['functions'] if (f.get('subcomponent')==code if '-S' in code else f['component']==code)]
    lines=[f'# {code} · {component.get("label",component["file"])}','',f'Source: `{component["file"]}`',f'Ownership: `{component["ownership"]}`',f'Component model: `{component["kind"]}`',f'Static functions: {len(rows)}','', '## Function codes','']
    lines += [f'- `{f["code"]}` · `{f["qualified"]}` · source line {f["line"]} · numeric ID `{f["numericId"]}`' for f in rows]
    port_rows=[p for p in cat['ports'] if p['component']==code]
    if port_rows:
        lines += ['', '## Browser command ports','']+[f'- `{p["code"]}` · `{p["name"]}` · `{p["kind"]}` · handler `{p["function"]}`' for p in port_rows]
    lines+=['','The FPP inventory ports show membership and source relationships. They are software models; existing browser APIs retain their documented behaviour. The combined operator contract carries commands, events, telemetry and session-parameter declarations for the workbench and linked analysis.']
    (SDD/(code+'.md')).write_text('\n'.join(lines)+'\n',encoding='utf-8')
text=f'''# Unified architecture and function codes

MISSY R2 and the linked MISSY analysis page are documented as **one software system**. The current inventory contains **{len(cat['functions']):,} static functions** across **{len(cat['components'])} source components**, with **{len(cat.get('subcomponents',[]))} detailed facets inside linked MISSY.

The running application remains browser-based real-time PCR simulation and data analysis. F Prime supplies the component, typed-port, command, event, parameter and telemetry modelling conventions used here.

## Codification

- Component: `R2-C0080` identifies a source module.
- Function: `R2-C0080-F00001` identifies a static function in that module.
- Linked MISSY facet: `R2-C0086-S009` identifies an inline analysis section. Its functions retain the parent component's stable function-code namespace.
- Numeric function ID: component number × 65536 + function ordinal, suitable for the model's U32 function-code field.
- Commands use the `CMD` category; events use `EVT`; telemetry has `TLM` channel codes. Category and owner are part of the identifier.

Codes are append-only. Removed identifiers remain reserved and are not recycled. Application and linked MISSY functions carry ID comments; library ownership remains identified and original licence notices are retained. Removing the ID comments from linked MISSY reproduces its prior source exactly. Code bodies and JSON keys have not been translated.

[Search the complete function catalogue](https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/architecture.html)

## Combined operator contract

The browser currently dispatches Voice.Submit, Batch.Generate and Missy.Open through coded ports. The model additionally describes linked MISSY package loading, SOP selection, results, charts and review. Its generated dictionary contains both workbench and linked-analysis commands and telemetry. It is a model dictionary, not a claim that a native GDS connection is running.

## All diagrams

All diagrams use compact S-shaped placement. Native fpp-to-layout connection files and fprime-layout JSON remain available; the renderer changes placement only. Purple connections indicate inventory membership. Orange connections indicate source dependencies, load order or logical workflow as noted in the model.

'''
for file in sorted((ROOT/'architecture/diagrams').glob('*.png')):
    target=DOCS/'images'/('arch-'+file.name);shutil.copyfile(file,target)
    svg=file.with_suffix('.svg')
    if svg.exists():shutil.copyfile(svg,DOCS/'images'/('arch-'+svg.name))
    text+='## '+file.stem+'\n\n!['+file.stem+'](images/arch-'+file.name+')\n\n'
    if svg.exists():text+='[Open scalable diagram](images/arch-'+svg.name+')\n\n'
(DOCS/'Architecture.md').write_text(text,encoding='utf-8')
# Portable, factual provenance for the supplied reference archive.
archive=Path.home()/'Downloads/fprime-devel.zip'
reference={'archive':'fprime-devel.zip','sha256':hashlib.sha256(archive.read_bytes()).hexdigest() if archive.exists() else None,'license':'Apache-2.0','purpose':'Component modelling and developer-tool reference for virtual PCR and linked data analysis','manual':'https://fprime.jpl.nasa.gov/latest/docs/user-manual/overview/03-port-comp-top/'}
(ROOT/'architecture/reference-source.json').write_text(json.dumps(reference,indent=2)+'\n',encoding='utf-8')
print('Unified design documents:',len(parts))
