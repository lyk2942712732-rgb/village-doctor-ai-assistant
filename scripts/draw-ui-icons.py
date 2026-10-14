"""Code-owned line icons: editable SVG masters and antialiased PNGs for WeChat."""
from pathlib import Path
from PIL import Image, ImageDraw
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1] / 'miniprogram/images/notion'
ROOT.mkdir(parents=True, exist_ok=True)
ICONS = {
    'notebook': [('rect',(5,3,19,21)),('line',(8,3,8,21)),('line',(3,7,6,7)),('line',(3,12,6,12)),('line',(3,17,6,17)),('line',(11,8,16,8)),('line',(11,12,16,12)),('line',(11,16,14,16))],
    'record': [('rect',(6,3,20,21)),('line',(10,8,16,8)),('line',(13,5,13,11)),('line',(10,14,16,14)),('line',(10,17,14,17)),('line',(3,6,3,18))],
    'folder': [('poly',[(3,8),(3,5),(9,5),(11,8),(21,8),(21,20),(3,20),(3,8)]),('line',(3,11,21,11))],
    'list': [('rect',(5,4,20,21)),('rect',(9,2,16,6)),('line',(11,10,17,10)),('line',(11,14,17,14)),('line',(11,18,17,18)),('line',(8,10,8.3,10)),('line',(8,14,8.3,14)),('line',(8,18,8.3,18))],
    'chart': [('line',(4,3,4,21)),('line',(4,21,22,21)),('poly',[(8,17),(8,12),(11,12),(11,17)]),('poly',[(14,17),(14,8),(17,8),(17,17)]),('line',(20,5,20,17))],
    'clinic': [('poly',[(3,10),(12,3),(21,10)]),('poly',[(5,9),(5,21),(19,21),(19,9)]),('rect',(10,15,14,21)),('line',(10,10,14,10)),('line',(12,8,12,12))],
    'outreach': [('circle',(7,4,13,10)),('arc',(3,11,17,23),180,360),('line',(18,10,18,16)),('line',(15,13,21,13))],
    'arrow': [('line',(4,12,20,12)),('poly',[(14,6),(20,12),(14,18)])],
    'chevron': [('poly',[(9,6),(15,12),(9,18)])],
    'plus': [('line',(12,5,12,19)),('line',(5,12,19,12))],
    'spark': [('poly',[(12,3),(14.5,9.5),(21,12),(14.5,14.5),(12,21),(9.5,14.5),(3,12),(9.5,9.5),(12,3)])],
    'calendar': [('rect',(4,6,20,21)),('line',(4,10,20,10)),('line',(8,3,8,8)),('line',(16,3,16,8)),('line',(8,14,11,14)),('line',(14,14,16,14)),('line',(8,17,11,17))],
}
for name, shapes in ICONS.items():
    svg=ET.Element('svg',{'xmlns':'http://www.w3.org/2000/svg','viewBox':'0 0 24 24','fill':'none','stroke':'#37352f','stroke-width':'1.45','stroke-linecap':'round','stroke-linejoin':'round'})
    scale=16
    img=Image.new('RGBA',(24*scale,24*scale),(255,255,255,0));draw=ImageDraw.Draw(img)
    width=round(1.45*scale);ink='#37352f'
    def points(values):return [round(x*scale) for x in values]
    for item in shapes:
        kind, coords=item[:2]
        if kind=='line':
            x1,y1,x2,y2=coords;ET.SubElement(svg,'line',dict(zip(['x1','y1','x2','y2'],map(str,coords))));draw.line(points(coords),fill=ink,width=width)
        elif kind=='rect':
            x1,y1,x2,y2=coords;ET.SubElement(svg,'rect',{'x':str(x1),'y':str(y1),'width':str(x2-x1),'height':str(y2-y1),'rx':'1'});draw.rounded_rectangle(points(coords),radius=scale,outline=ink,width=width)
        elif kind=='poly':
            ET.SubElement(svg,'polyline',{'points':' '.join(','.join(map(str,p)) for p in coords)});draw.line([tuple(points(p)) for p in coords],fill=ink,width=width,joint='curve')
        elif kind=='circle':
            x1,y1,x2,y2=coords;ET.SubElement(svg,'circle',{'cx':str((x1+x2)/2),'cy':str((y1+y2)/2),'r':str((x2-x1)/2)});draw.ellipse(points(coords),outline=ink,width=width)
        elif kind=='arc':
            x1,y1,x2,y2=coords;ET.SubElement(svg,'path',{'d':f'M {x1} {(y1+y2)/2} A {(x2-x1)/2} {(y2-y1)/2} 0 0 1 {x2} {(y1+y2)/2}'});draw.arc(points(coords),item[2],item[3],fill=ink,width=width)
    (ROOT/(name+'.svg')).write_text(ET.tostring(svg,encoding='unicode'),encoding='utf-8')
    img.resize((96,96),Image.Resampling.LANCZOS).save(ROOT/(name+'.png'))
print(f'Generated {len(ICONS)} SVG masters and PNG icons.')
