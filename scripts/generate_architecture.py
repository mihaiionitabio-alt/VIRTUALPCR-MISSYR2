"""Generate FPP component models and topology inputs from the complete source inventory."""
from pathlib import Path
import hashlib
import json
import re
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'architecture/fpp'
OUT.mkdir(exist_ok=True)
cat=json.loads((ROOT/'architecture/function-catalogue.json').read_text(encoding='utf-8'))
components=cat['components']+cat.get('subcomponents',[])
def group(file):
    if file.startswith('missy/') and '#' in file:return 'LinkedMISSYFeatures'
    if file.startswith('missy/'):return 'BundledAnalysis'
    if file.startswith('data/'):return 'AssayAndLanguageData'
    if file.startswith('js/core/'):return 'InstrumentAndChemistry'
    if file.startswith('js/analysis/'):return 'AnalysisAndAcceptance'
    if file.startswith('js/export/'):return 'RDMLtAndProcedures'
    if file.startswith('js/ui/tech/') or 'technician_access' in file or 'quiz' in file:return 'TechnicianAndTraining'
    if any(x in file for x in ['voice_','batch_','profile_studio']):return 'ProfilesAndVoice'
    if file.startswith(('scripts/','tests/')):return 'DeveloperTooling'
    return 'PresentationAndNavigation'
def instance(c):return 'c'+c['code'][4:].replace('-','_')
def baseid(c):return (0x40000000+int(c['code'].split('-S')[1])*65536) if '-S' in c['code'] else int(c['code'][4:])*65536
def typename(c):return c['code'].replace('-','')+'_'+re.sub('[^A-Za-z0-9]','_',Path(c['file']).stem)
byfile={c['file']:c for c in components}
exports={}
for c in components:
    if '#' not in c['file'] and c['file'].endswith(('.js','.html')):
        text=(ROOT/c['file']).read_text(encoding='utf-8')
        for symbol in re.findall(r'\bR2\.([A-Za-z_]\w*)\s*=',text):exports.setdefault(symbol,set()).add(c['file'])
edges=set()
for c in components:
    if '#' not in c['file'] and c['file'].endswith(('.js','.html')):
        text=(ROOT/c['file']).read_text(encoding='utf-8')
        for symbol in set(re.findall(r'\bR2\.([A-Za-z_]\w*)',text)):
            owners=exports.get(symbol,set())
            if len(owners)==1:
                target=next(iter(owners))
                if target!=c['file']:edges.add((c['file'],target))
# These two UI transitions use files/windows instead of a JavaScript namespace call.
for a,b in [('js/ui/quality.js','missy/index.html'),('js/ui/voice_builder.js','js/ui/batch_runs.js')]:
    if a in byfile and b in byfile:edges.add((a,b))
nativeparts=[c for c in components if '-S' in c['code']]
for part in nativeparts:
    if part['sourceFile'] in byfile:edges.add((part['file'],part['sourceFile']))
for left,right in zip(nativeparts,nativeparts[1:]):edges.add((left['file'],right['file']))
lines=['# Generated from the MISSY source inventory. Browser software model, not a binary implementation.','module MISSYR2 {',' port Invocation(functionCode: U32)',' port InventoryLink(componentCode: U32, functionCount: U32)',' passive component InventoryIndex { output port members: [256] InventoryLink }']
for c in components:
    lines.extend([f" # {c['code']} | {c['file']} | {c['functionCount']} static functions",f' passive component {typename(c)} {{','  sync input port callIn: [256] Invocation','  output port callOut: [256] Invocation','  sync input port inventory: InventoryLink',' }'])
for c in components:lines.append(f" instance {instance(c)}: {typename(c)} base id {baseid(c)}")
groups={g:[c for c in components if group(c['file'])==g] for g in sorted({group(c['file']) for c in components})}
for i,g in enumerate(groups,1):lines.append(f' instance index{g}: InventoryIndex base id {0x10000000+i*65536}')
metadata={}
for g,items in groups.items():
    lines.extend([f' topology {g} {{',f'  instance index{g}']+[f"  instance {instance(c)}" for c in items]+['  connections Components {'])
    for i,c in enumerate(items):lines.append(f"   index{g}.members[{i}] -> {instance(c)}.inventory")
    ids={c['file'] for c in items};subset=[e for e in sorted(edges) if e[0] in ids and e[1] in ids]
    for i,(a,b) in enumerate(subset):lines.append(f"   {instance(byfile[a])}.callOut[{i}] -> {instance(byfile[b])}.callIn[{i}]")
    lines.extend(['  }',' }']);metadata[g]={'title':re.sub(r'([a-z])([A-Z])',r'\1 \2',g),'description':'Inventory membership and source namespace dependencies; no runtime arguments are recorded.','components':[c['code'] for c in items]}
# Complete atlas: every indexed source component is represented by a typed membership port.
lines.extend([' topology AllSourceComponents {']+[f'  instance index{g}' for g in groups]+[f"  instance {instance(c)}" for c in components]+['  connections Inventory {'])
for g,items in groups.items():
    for i,c in enumerate(items):lines.append(f"   index{g}.members[{i}] -> {instance(c)}.inventory")
lines.extend(['  }',' }','}'])
(OUT/'SoftwareInventory.fpp').write_text('\n'.join(lines)+'\n',encoding='utf-8')
# A small operator contract makes commands, events, telemetry and parameters explicit.
ops='''module MISSYR2 {
 passive component OperatorContract {
  command recv port cmdIn
  command reg port cmdReg
  command resp port cmdResp
  time get port timeGet
  event port eventOut
  text event port textEventOut
  telemetry port telemetryOut
  param get port paramGet
  param set port paramSet
  sync input port callIn: [256] Invocation
  output port callOut: [256] Invocation
  sync command SUBMIT_OPTION(optionNumber: U32) opcode 0x10
  sync command GENERATE_RUNS(profileDigest: string size 64) opcode 0x11
  sync command OPEN_MISSY opcode 0x12
  sync command STATUS opcode 0x13
  sync command LOAD_RDMLT(packageDigest: string size 64) opcode 0x14
  sync command APPLY_SOP(procedureId: string size 64) opcode 0x15
  sync command SHOW_RESULTS opcode 0x16
  sync command SHOW_CONTROL_PANEL opcode 0x17
  sync command SHOW_CURVES opcode 0x18
  telemetry CommandCount: U32 id 0x20
  telemetry FailureCount: U32 id 0x21
  telemetry LastDurationMs: F64 id 0x22
  telemetry LoadedRuns: U32 id 0x23
  telemetry ResultRows: U32 id 0x24
  telemetry ChartCount: U32 id 0x25
  event Started(commandCode: U32) severity activity low id 0x30 format "Command {} started"
  event Completed(commandCode: U32) severity activity low id 0x31 format "Command {} completed"
  event Failed(commandCode: U32) severity warning low id 0x32 format "Command {} failed"
  param SessionMinutes: U32 default 10 id 0x40
 }
 instance operator: OperatorContract base id 0x70000000
 deployment topology OperatorAndReview {
  instance operator
'''
flow=['js/ui/voice_builder.js','js/ui/profile_studio.js','js/ui/batch_runs.js','js/core/instrument.js','js/analysis/gmo.js','js/export/rdmlt.js','js/ui/quality.js','missy/index.html']
ops+='\n'.join(f"  instance {instance(byfile[f])}" for f in flow)+'\n  connections Workflow {\n'
for i,(a,b) in enumerate(zip(flow,flow[1:])):ops+=f"   {instance(byfile[a])}.callOut[{i}] -> {instance(byfile[b])}.callIn[{i}]\n"
ops+=f"   operator.callOut[0] -> {instance(byfile[flow[0]])}.callIn[20]\n  }}\n }}\n}}\n"
(OUT/'OperatorAndReview.fpp').write_text(ops.replace('  }\n }\n}\n','  }\n }\n system BrowserOperator: OperatorAndReview\n}\n'),encoding='utf-8')
metadata['OperatorAndReview']={'title':'Operator to PCR analysis workflow','description':'Logical workflow; the operator dictionary is a design contract. The browser command dispatcher is the current implementation.','components':[byfile[f]['code'] for f in flow]}
metadata['AllSourceComponents']={'title':'Complete source component inventory','description':'Every indexed file, including data, presentation resources, developer tools and bundled analysis.','components':[c['code'] for c in components]}
(ROOT/'architecture/topology-map.json').write_text(json.dumps({'groups':metadata,'components':components,'sourceDependencies':[list(e) for e in sorted(edges)]},indent=2)+'\n',encoding='utf-8')
print(f'Generated {len(components)} component definitions, {len(groups)+2} topologies, {len(edges)} source dependencies')
