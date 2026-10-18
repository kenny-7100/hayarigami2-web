#!/usr/bin/env python3
"""Render original patched font glyphs for auditing the offline Unicode mapping.
Requires Pillow; never used by the browser or normal game build.
"""
from pathlib import Path
import json
import struct
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]

def main():
    root=ROOT/'output/extracted'
    font=(root/'FontA.fnt').read_bytes()
    textures=[(root/f'FontA{i}.ftx').read_bytes() for i in range(3)]
    mapping=json.loads((ROOT/'scripts/data/prologue-glyph-map.json').read_text())['mapping']
    codes=sorted(mapping)
    sheet=Image.new('RGB',(1024,((len(codes)+15)//16)*82),'white')
    draw=ImageDraw.Draw(sheet)
    for i,code in enumerate(codes):
        raw=bytes.fromhex(code)
        a,b=raw if len(raw)==2 else (raw[0],0)
        if len(raw)==1:index,atlas=a-0x20,0
        else:
            index=(a-(0x81 if a<0xa0 else 0xc1))*192+b-0x40+0x5f
            atlas=0 if (a,b)<(0x88,0x9f) else 1 if (a,b)<(0x98,0x73) else 2
        glyph=struct.unpack_from('<H',font,2+index*2)[0]
        texture=textures[atlas]
        size=struct.unpack_from('<I',texture)[0]
        palette=struct.unpack_from('<H',texture,10)[0]*struct.unpack_from('<H',texture,12)[0]*4
        start=16+palette+glyph*size*size//2
        blob=texture[start:start+size*size//2]
        if len(blob)!=size*size//2:raise ValueError(f'Invalid glyph {code}')
        im=Image.new('L',(size,size))
        im.putdata([255-((v>>shift)&15)*17 for v in blob for shift in (0,4)])
        x,y=(i%16)*64,(i//16)*82
        sheet.paste(im.resize((48,48)),(x,y))
        draw.text((x,y+50),code,fill='black')
        draw.text((x,y+64),str(i),fill='black')
    dest=ROOT/'output/reverse/glyph-proof.png'
    dest.parent.mkdir(parents=True,exist_ok=True)
    sheet.save(dest)
    print(f'{len(codes)} glyphs: {dest}')
if __name__=='__main__':main()
