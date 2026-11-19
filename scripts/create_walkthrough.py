"""Render a five-minute silent walkthrough from actual application captures and scene metadata."""
from pathlib import Path
import argparse
import json
import subprocess
import textwrap
from PIL import Image,ImageDraw,ImageFont,ImageOps
import imageio_ffmpeg
p=argparse.ArgumentParser();p.add_argument('--assets',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args();assets=a.assets.resolve();scenes=json.loads((assets/'scenes.json').read_text(encoding='utf-8'));work=assets/'rendered';work.mkdir(exist_ok=True);ff=imageio_ffmpeg.get_ffmpeg_exe();W,H=1920,1080
assert sum(s['duration'] for s in scenes)==300

def font(n,bold=False):
    for file in [('C:/Windows/Fonts/arialbd.ttf' if bold else 'C:/Windows/Fonts/arial.ttf'),('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]:
        if Path(file).exists():return ImageFont.truetype(file,n)
    return ImageFont.load_default()
def lines(draw,text,size,width):
    out=[];line=''
    for word in text.split():
        trial=(line+' '+word).strip()
        if line and draw.textlength(trial,font=font(size))>width:out.append(line);line=word
        else:line=trial
    return out+[line]
def overlay(scene,path):
    im=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(im);d.rectangle((0,0,W,82),fill='#100a16');d.rectangle((30,16,W-30,24),fill='#ff9f64');d.text((44,33),scene['title'],font=font(34,True),fill='#ffb37a');d.rectangle((0,H-102,W,H),fill='#100a16')
    for i,line in enumerate(lines(d,scene['caption'],28,W-90)[:2]):d.text((44,H-87+i*36),line,font=font(28),fill='#f2e5fa')
    im.save(path)
def static_frame(scene,path):
    im=Image.new('RGB',(W,H),'#050307');shot=Image.open(assets/scene['file']).convert('RGB');shot=ImageOps.contain(shot,(W-64,H-190),Image.Resampling.LANCZOS);im.paste(shot,((W-shot.width)//2,85));top=work/(path.stem+'-overlay.png');overlay(scene,top);im=Image.alpha_composite(im.convert('RGBA'),Image.open(top));im.convert('RGB').save(path)
def stamp(seconds):
    ms=round(seconds*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
segments=[];srt=[];time=0
for i,scene in enumerate(scenes):
    dest=work/f'{i:02}.mp4';duration=scene['duration'];source=assets/scene['file'];base=[ff,'-hide_banner','-loglevel','error','-y'];extra=[]
    if scene.get('video'):
        over=work/f'{i:02}-overlay.png';overlay(scene,over);speed=scene.get('speed',1);take=scene.get('take',duration*speed);base+=['-ss',str(scene.get('offset',0)),'-t',str(take),'-i',str(source),'-loop','1','-i',str(over)]
        crop=scene.get('crop');crop_filter=(f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},' if crop else '')
        filters=f'[0:v]{crop_filter}setpts=(PTS-STARTPTS)/{speed},scale={W-64}:{H-200}:force_original_aspect_ratio=decrease,pad={W}:{H}:(ow-iw)/2:90:color=black,fps=30,tpad=stop_mode=clone:stop_duration={duration}[video];[video][1:v]overlay=0:0:shortest=1[out]';extra=['-filter_complex',filters,'-map','[out]']
    else:
        frame=work/f'{i:02}.png';static_frame(scene,frame);base+=['-loop','1','-i',str(frame)];extra=['-vf','fps=30']
    command=base+extra+['-t',str(duration),'-an','-c:v','libx264','-preset','veryfast','-crf','18','-threads','4','-pix_fmt','yuv420p','-video_track_timescale','90000',str(dest)];subprocess.run(command,check=True);segments.append(dest);srt.append(f'{i+1}\n{stamp(time)} --> {stamp(time+duration)}\n{scene["caption"]}\n');time+=duration;print(f'Scene {i+1}/{len(scenes)}: {scene["title"]}',flush=True)
manifest=work/'concat.txt';manifest.write_text(''.join("file '"+f.as_posix().replace("'","'\\''")+"'\n" for f in segments),encoding='utf-8');subprocess.run([ff,'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(manifest),'-c','copy','-movflags','+faststart',str(a.output)],check=True);a.output.with_suffix('.srt').write_text('\n'.join(srt),encoding='utf-8');print(a.output)
