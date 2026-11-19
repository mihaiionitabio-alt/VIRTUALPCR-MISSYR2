"""Run native FPP/FPL tools, preserve their model outputs and render the topology diagrams."""
from pathlib import Path
import argparse
import json
import os
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--tools',type=Path,required=True);a.add_argument('--cpp',action='store_true');args=a.parse_args();tools=args.tools.resolve();py=tools/('Scripts/python.exe' if os.name=='nt' else 'bin/python');bindir=py.parent
java_home=Path(subprocess.check_output([str(py),'-c','import jdk4py;print(jdk4py.JAVA_HOME)'],text=True).strip());env={**os.environ,'JAVA_HOME':str(java_home),'PATH':str(java_home/'bin')+os.pathsep+os.environ['PATH']}
site=Path(subprocess.check_output([str(py),'-c','import sysconfig;print(sysconfig.get_paths()["purelib"])'],text=True).strip());jar=site/'fprime_fpl_layout/fpl-layout.jar';java=java_home/'bin'/('java.exe' if os.name=='nt' else 'java');logs=[]
inputs=['architecture/fpp/FrameworkTypes.fpp','architecture/fpp/SoftwareInventory.fpp','architecture/fpp/OperatorAndReview.fpp']
def run(name,*extra):
    command=[str(bindir/(name+('.exe' if os.name=='nt' else ''))),*extra,*inputs];result=subprocess.run(command,cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8');logs.append({'tool':name,'arguments':list(extra),'exit':result.returncode,'stdout':result.stdout,'stderr':result.stderr});
    if result.returncode:raise RuntimeError(name+': '+result.stderr)
for directory in ['layouts','dictionaries','ast','generated-cpp']:
    target=ROOT/'architecture'/directory;assert target.resolve().is_relative_to(ROOT.resolve());target.mkdir(exist_ok=True)
run('fpp-check');run('fpp-to-layout','-d','architecture/layouts');run('fpp-to-dict','-d','architecture/dictionaries','-p','0.4.40');run('fpp-to-json','-d','architecture/ast')
if args.cpp:run('fpp-to-cpp','-u','-a','-d','architecture/generated-cpp','-p',str(ROOT))
for file in (ROOT/'architecture/layouts').glob('**/*.txt'):
    result=subprocess.run([str(java),'-jar',str(jar)],input=file.read_text(encoding='utf-8'),capture_output=True,text=True,encoding='utf-8');
    if result.returncode:raise RuntimeError(result.stderr)
    json.loads(result.stdout);file.with_suffix('.json').write_text(result.stdout,encoding='utf-8')
def relative(value):
    if isinstance(value,str):return value.replace(str(ROOT),'$PROJECT').replace(ROOT.as_posix(),'$PROJECT')
    if isinstance(value,list):return [relative(x) for x in value]
    if isinstance(value,dict):return {k:relative(v) for k,v in value.items()}
    return value
for file in (ROOT/'architecture/ast').glob('*.json'):
    file.write_text(json.dumps(relative(json.loads(file.read_text(encoding='utf-8'))),separators=(',',':'))+'\n',encoding='utf-8')
(ROOT/'architecture/tool-validation.json').write_text(json.dumps(relative({'fpp':'3.4.0','fprime-layout':'1.0.4','checks':logs,'cppStatus':'Generated test scaffolds; not compiled or executed' if args.cpp else 'Not requested'}),indent=2)+'\n',encoding='utf-8')
subprocess.run([sys.executable,str(ROOT/'scripts/render_architecture.py')],cwd=ROOT,check=True)
print('Validated FPP models; generated layouts, dictionary, AST and diagrams.')
