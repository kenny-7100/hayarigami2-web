#!/usr/bin/env python3
"""Offline glyph proof sheets. Requires Pillow; accepts optional hexadecimal codes."""
import json,struct,sys
from pathlib import Path
from PIL import Image,ImageDraw
from compile_prologue import ROOT

def glyph(code):
    root=ROOT/'output/extracted';font=(root/'FontA.fnt').read_bytes()
    raw=bytes.fromhex(code);a,b=raw if len(raw)==2 else (raw[0],0)
    index=a-0x20 if len(raw)==1 else (a-(0x81 if a<0xa0 else 0xc1))*192+b-0x40+0x5f
    atlas=0 if len(raw)==1 or (a,b)<(0x88,0x9f) else 1 if (a,b)<(0x98,0x73) else 2
    n=struct.unpack_from('<H',font,2+index*2)[0];t=(root/f'FontA{atlas}.ftx').read_bytes()
    size=struct.unpack_from('<I',t)[0];palette=struct.unpack_from('<H',t,10)[0]*struct.unpack_from('<H',t,12)[0]*4
    start=16+palette+n*size*size//2;blob=t[start:start+size*size//2]
    if len(blob)!=size*size//2:raise ValueError(code)
    im=Image.new('L',(size,size));im.putdata([255-((v>>shift)&15)*17 for v in blob for shift in (0,4)])
    return im

if __name__=='__main__':
    mapping=json.loads((ROOT/'scripts/data/chapter-zero-glyph-map.json').read_text())['mapping']
    codes=sys.argv[1:] or sorted(mapping)
    dest=ROOT/'output/chapter-zero/proof';dest.mkdir(parents=True,exist_ok=True)
    for offset in range(0,len(codes),120):
        page=codes[offset:offset+120];im=Image.new('RGB',(960,((len(page)+11)//12)*102),'white');draw=ImageDraw.Draw(im)
        for i,code in enumerate(page):
            x,y=i%12*80,i//12*102;im.paste(glyph(code).resize((64,64)),(x,y));draw.text((x,y+68),code,fill='black')
        im.save(dest/f'{offset}.png')
