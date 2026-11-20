"""Build the illustrated MISSY wiki from its Markdown source, without adding runtime dependencies."""
from pathlib import Path
from html import escape
import re
import shutil
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'docs/wiki'
OUT=ROOT/'wiki'
OUT.mkdir(exist_ok=True)
def inline(text):
    value=escape(text)
    value=re.sub(r'!\[([^\]]*)\]\(([^)]+)\)',lambda m:f'<img alt="{m[1]}" src="{m[2]}" loading="lazy">',value)
    value=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',lambda m:f'<a href="{m[2].replace(".md", ".html")}">{m[1]}</a>',value)
    value=re.sub(r'`([^`]+)`',r'<code>\1</code>',value)
    return re.sub(r'\*\*([^*]+)\*\*',r'<strong>\1</strong>',value)
def render(text):
    out=[];code=[];fenced=False;listing=False
    for line in text.splitlines():
        if line.startswith('```'):
            if listing:out.append('</ul>');listing=False
            if fenced:out.append('<pre><code>'+escape('\n'.join(code))+'</code></pre>');code=[]
            fenced=not fenced;continue
        if fenced:code.append(line);continue
        if line.startswith('- '):
            if not listing:out.append('<ul>');listing=True
            out.append('<li>'+inline(line[2:])+'</li>');continue
        if listing:out.append('</ul>');listing=False
        if not line.strip():continue
        match=re.match(r'^(#{1,4}) (.*)',line)
        if match:level=len(match[1]);out.append(f'<h{level}>'+inline(match[2])+f'</h{level}>')
        else:out.append('<p>'+inline(line)+'</p>')
    if listing:out.append('</ul>')
    return '\n'.join(out)
pages=sorted(SOURCE.glob('*.md'))
nav=''.join('<a href="'+p.stem+'.html">'+escape(p.stem.replace('-',' '))+'</a>' for p in pages)
css='body{margin:0;background:#08050b;color:#f0e1f8;font:17px/1.6 Arial,sans-serif}header{background:#cb9acd;color:#180d22;padding:18px 30px;font-size:23px;font-weight:bold}main{max-width:1350px;margin:28px auto;padding:20px 35px;border-left:18px solid #cb9acd;border-top:12px solid #ff9d61;border-radius:40px 0 0 30px}nav{display:flex;gap:8px;flex-wrap:wrap}a{color:#d9b1e5}nav a{background:#24172e;border-radius:20px;padding:7px 14px;text-decoration:none}h1,h2{color:#ffb06d}img{max-width:100%;height:auto;border:1px solid #6f517a;display:block;margin:24px 0}pre{overflow:auto;background:#1c1224;padding:20px}code{color:#ffc78e}p,li{max-width:1250px}footer{margin-top:40px;border-top:3px solid #cb9acd;padding-top:12px;color:#bda3c9}'
for page in pages:
    html='<!doctype html><html lang="'+('zh-CN' if page.stem.startswith('Chinese') else 'en')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MISSY · '+escape(page.stem)+'</title><link rel="canonical" href="https://mihaiionitabio-alt.github.io/VIRTUALPCR-MISSYR2/wiki/'+('' if page.stem=='Home' else page.stem+'.html')+'"><meta name="robots" content="index,follow"><style>'+css+'</style><header>MISSY R2 · Illustrated wiki</header><main><a href="../index.html">← Open workbench</a> · <a href="../architecture.html">Function catalogue</a><nav>'+nav+'</nav>'+render(page.read_text(encoding='utf-8'))+'<footer>VIRTUALPCR/MISSYR2 · research and training · version 0.4.40</footer></main></html>'
    (OUT/(page.stem+'.html')).write_text(html,encoding='utf-8')
shutil.copyfile(OUT/'Home.html',OUT/'index.html')
shutil.copytree(SOURCE/'images',OUT/'images',dirs_exist_ok=True)
print('Built',len(pages),'wiki pages')
