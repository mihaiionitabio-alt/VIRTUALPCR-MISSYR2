"""Render native fprime-layout JSON using the MISSY colour palette."""
from pathlib import Path
from html import escape
import json
import math
import textwrap
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
M=json.loads((ROOT/'architecture/topology-map.json').read_text(encoding='utf-8'))
C={c['code'][4:].replace('-','_'):c for c in M['components']}
OUT=ROOT/'architecture/diagrams'
OUT.mkdir(exist_ok=True)
def font(size,bold=False):
    for name in [('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf'),('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]:
        if Path(name).exists():return ImageFont.truetype(name,size)
    return ImageFont.load_default()
def render(file):
    data=json.loads(file.read_text(encoding='utf-8'));top=file.parent.name.removeprefix('MISSYR2_').removesuffix('Layout');meta=M['groups'].get(top,{'title':top,'description':''});cols=data['columns'];flat=[(ci,ri,node) for ci,col in enumerate(cols) for ri,node in enumerate(col)];slots=6 if top=='AllSourceComponents' else 3;w=max(1200,slots*350+140);h=max(440,math.ceil(len(flat)/slots)*155+250)
    im=Image.new('RGB',(w,h),'#07050b');d=ImageDraw.Draw(im);svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="100%" height="100%" fill="#07050b"/><style>text{{font-family:Arial,sans-serif}}.edge{{fill:none;stroke-width:2}}</style><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#bc95c9"/></marker></defs>']
    def text(x,y,value,size=18,color='#efe0f7',bold=False):
        d.text((x,y),value,font=font(size,bold),fill=color);svg.append(f'<text x="{x}" y="{y+size}" fill="{color}" font-size="{size}" font-weight="{700 if bold else 400}">{escape(value)}</text>')
    d.rectangle((30,25,w-30,38),fill='#ff9d61');svg.append(f'<path d="M30 30H{w-30}" stroke="#ff9d61" stroke-width="13"/>');text(40,60,meta['title'],30,'#ffae70',True);text(40,108,'VIRTUALPCR / MISSYR2 · fpp-to-layout → fprime-layout · source component codes',16,'#c49ed0');text(40,141,'Purple: inventory membership   Orange: source dependency / logical workflow',15,'#bda2c8')
    nodes={};directions={}
    for index,(ci,ri,node) in enumerate(flat):
        row=index//slots;column=index%slots if row%2==0 else slots-1-index%slots;nodes[(ci,ri)]=(65+column*350,210+row*155,node);directions[(ci,ri)]=1 if row%2==0 else -1
    def point(ref,side):
        ci,ri,group,number=ref;x,y,node=nodes[(ci,ri)];right=(side=='out')==(directions[(ci,ri)]==1);return (x+(280 if right else 0),y+64+group*19)
    for edge in data['connections']:
        a,b=edge;start=point(a,'out');end=point(b,'in');source=nodes[(a[0],a[1])][2];port=source['outputPorts'][a[2]]['name'];color='#a580b6' if port=='members' else '#e6a268';sx,sy=start;tx,ty=end;dx=max(45,abs(tx-sx)*.5);p1=(sx+directions[(a[0],a[1])]*dx,sy);p2=(tx-directions[(b[0],b[1])]*dx,ty)
        pts=[]
        for i in range(31):
            t=i/30;u=1-t;pts.append((u**3*sx+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t**3*tx,u**3*sy+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t**3*ty))
        d.line(pts,fill=color,width=2);d.polygon([(tx,ty),(tx-8*directions[(b[0],b[1])],ty-4),(tx-8*directions[(b[0],b[1])],ty+4)],fill=color);svg.append(f'<path class="edge" d="M{sx} {sy} C{p1[0]} {p1[1]} {p2[0]} {p2[1]} {tx} {ty}" stroke="{color}" marker-end="url(#arrow)"/>')
    for (ci,ri),(x,y,node) in nodes.items():
        name=node['instanceName'];item=C.get(name[1:]) if name.startswith('c') else None;title=item.get('label',Path(item['file']).name) if item else ('Operator contract' if name=='operator' else name.removeprefix('index'));code=item['code'] if item else 'TOPOLOGY INDEX';count=f"{item['functionCount']:,} functions" if item else 'Typed model ports';color='#7dd7bf' if item and item['ownership']=='bundled-upstream' else '#bd92ce'
        d.rounded_rectangle((x,y,x+280,y+116),radius=18,fill='#21162c',outline=color,width=2);svg.append(f'<a href="../../architecture.html?component={code}" target="_blank"><rect x="{x}" y="{y}" width="280" height="116" rx="18" fill="#21162c" stroke="{color}" stroke-width="2"/><title>{escape(item["file"] if item else name)}</title>');text(x+15,y+12,code,14,color,True)
        for j,line in enumerate(textwrap.wrap(title,28)[:2]):text(x+15,y+36+j*20,line,17,'#f0e0fa',True)
        text(x+15,y+89,count,14,'#c6acd4');svg.append('</a>')
        for side,key in [('in','inputPorts'),('out','outputPorts')]:
            for pi,port in enumerate(node[key]):
                px=x+280 if ((side=='out')==(directions[(ci,ri)]==1)) else x;py=y+64+pi*19;d.ellipse((px-4,py-4,px+4,py+4),fill=color);svg.append(f'<circle cx="{px}" cy="{py}" r="4" fill="{color}"><title>{escape(port["name"])}: {escape(str(port["portNumbers"]))}</title></circle>')
    text(40,h-45,'Serpentine placement · connections and port indices are retained from the validated FPP layout.',14,'#bda2c8');svg.append('</svg>');(OUT/(top+'.svg')).write_text(''.join(svg),encoding='utf-8')
    im.save(OUT/(top+'.png'))
    return top
rendered=[]
for file in sorted((ROOT/'architecture/layouts').glob('**/*.json')):
    if file.name.endswith('.meta.json'):continue
    rendered.append(render(file))
thumbs=[p for p in OUT.glob('*.png') if p.stem!='AllSourceComponents'];sheet=Image.new('RGB',(2400,math.ceil(len(thumbs)/3)*650+130),'#07050b');d=ImageDraw.Draw(sheet);d.text((40,30),'MISSY R2 · Complete architecture diagram collection',font=font(38,True),fill='#ffae70')
for i,file in enumerate(sorted(thumbs)):
    tile=Image.open(file);tile.thumbnail((750,550));x=30+(i%3)*790;y=120+(i//3)*650;sheet.paste(tile,(x,y));d.text((x,y+565),file.stem,font=font(22,True),fill='#c49ed0')
sheet.save(OUT/'ArchitectureContactSheet.png');print('Rendered',len(rendered),'SVG models and',len(list(OUT.glob('*.png'))),'PNG images')
