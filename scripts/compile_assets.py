#!/usr/bin/env python3
"""Offline PSP compressed textures to native PNG, ATRAC to AAC."""
import struct,zlib,subprocess,json
from compile_prologue import ROOT,BIAS

def texture_png(data):
    w,h=struct.unpack_from('<HH',data);kind=struct.unpack_from("<H",data,6)[0];stride=8 if kind==0 else 16
    if kind in (16,256):
        palette_count,rows=struct.unpack_from('<HH',data,8);palette=[data[16+i*4:20+i*4] for i in range(palette_count*rows)];blob=data[16+palette_count*rows*4:];rowbytes=struct.unpack_from('<H',data,14)[0];rowbytes=rowbytes if kind==256 else rowbytes//2;storage_h=(h+7)//8*8 if data[12] else h
        if len(blob)!=rowbytes*storage_h:raise ValueError('Invalid indexed texture size')
        if data[12]:
            linear=bytearray(len(blob))
            for y in range(storage_h):
                for x in range(rowbytes):linear[y*rowbytes+x]=blob[((y//8)*(rowbytes//16)+x//16)*128+(y%8)*16+x%16]
            blob=linear
        pixels=bytearray()
        for y in range(h):
            indices=[i for byte in blob[y*rowbytes:(y+1)*rowbytes] for i in ([byte] if kind==256 else [byte&15,byte>>4])]
            for index in indices[:w]:pixels.extend(palette[index])
        return rgba_png(w,h,pixels)
    if kind not in (0,1,2) or w%4 or h%4 or len(data)!=16+w*h//16*stride:raise ValueError(f'Unsupported texture: {data[:16].hex()} length={len(data)}')
    pixels=bytearray(w*h*4);p=16
    def rgb(n):return ((n>>11)*255//31,((n>>5)&63)*255//63,(n&31)*255//31)
    for y in range(0,h,4):
        for x in range(0,w,4):
            bits,c0,c1=struct.unpack_from('<IHH',data,p);a,b=rgb(c0),rgb(c1)
            colors=[(*a,255),(*b,255)]
            if c0>c1 or kind:colors.extend([(*( (2*u+v)//3 for u,v in zip(a,b)),255),(*((u+2*v)//3 for u,v in zip(a,b)),255)])
            else:colors.extend([(*((u+v)//2 for u,v in zip(a,b)),255),(0,0,0,0)])
            if kind==2:
                alpha_bits=int.from_bytes(data[p+8:p+14],'little');a0,a1=data[p+14:p+16];alpha=[a0,a1]
                if a0>a1:alpha += [((7-i)*a0+i*a1)//7 for i in range(1,7)]
                else:alpha += [((5-i)*a0+i*a1)//5 for i in range(1,5)]+[0,255]
            for i in range(16):
                rgba=list(colors[(bits>>(i*2))&3])
                if kind==1:rgba[3]=((int.from_bytes(data[p+8:p+16],'little')>>(i*4))&15)*17
                elif kind==2:rgba[3]=alpha[(alpha_bits>>(i*3))&7]
                dest=((y+i//4)*w+x+i%4)*4;pixels[dest:dest+4]=bytes(rgba)
            p+=stride
    return rgba_png(w,h,pixels)

def rgba_png(w,h,pixels):
    def chunk(k,c):return struct.pack('>I',len(c))+k+c+struct.pack('>I',zlib.crc32(k+c)&0xffffffff)
    lines=b''.join(b'\0'+pixels[y*w*4:(y+1)*w*4] for y in range(h))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>2I5B',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(lines))+chunk(b'IEND',b'')

class Assets:
    def __init__(self):
        self.eboot=(ROOT/'output/iso-inspection/PSP_GAME/SYSDIR/EBOOT.BIN').read_bytes();self.archive=(ROOT/'output/iso-inspection/PSP_GAME/USRDIR/DATA.DAT').read_bytes();self.web=ROOT/'public/game'
    def resource(self,index):
        off,size=struct.unpack_from('<II',self.eboot,0x0887A9CC-BIAS+index*8)
        if not 0<size or off+size>len(self.archive):raise ValueError('Invalid resource')
        return self.archive[off:off+size]
    def table(self,address,count):return dict(struct.iter_unpack('<II',self.eboot[address-BIAS:address-BIAS+count*8]))
    def texture(self,id,index,prefix):
        raw=self.resource(index);name=f'{prefix}-{id}.png';dest=self.web/name
        if not dest.exists():dest.write_bytes(texture_png(raw))
        w,h=struct.unpack_from('<HH',raw)
        return dict(file=name,width=w,height=h)
    def music(self,id):
        index=struct.unpack_from('<h',self.eboot,0x0887FA90-BIAS+id*20+4)[0];name=f'bgm-{id}.m4a';dest=self.web/name
        if not dest.exists():
            source=ROOT/f'output/bgm-{id}.at3';source.write_bytes(self.resource(index));subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-c:a','aac','-b:a','128k',str(dest)],check=True)
        return name

def build_assets(data,assets):
    instructions=[t for s in data['scripts'].values() for t in s['instructions']]
    ids=lambda op:sorted({t['args'][0] for t in instructions if t.get('op')==op})
    bgtable=assets.table(0x0887D9DC,396);sptable=assets.table(0x0887E63C,394)
    from compile_audio import compile_audio
    data.update(compile_audio(assets,instructions))
    from compile_animations import compile_animations
    data['animationData']=compile_animations(assets,instructions)
    data['backgroundTextures']={str(id):assets.texture(id,bgtable[id],'background') for id in ids(401)}
    data['backgrounds']={id:texture['file'] for id,texture in data['backgroundTextures'].items()}
    data['sprites']={str(id):assets.texture(id,sptable[id],'sprite') for id in ids(2201)}
    if data.get('logic'):
        logic_id=data['logic']['id']
        pack=assets.resource(logic_id+22);count=struct.unpack_from('<I',pack,4)[0];table=dict(struct.iter_unpack('<II',pack[8:8+count*8]));data['logic']['assets']={}
        for id in sorted({n['asset'] for n in data['logic']['nodes']}):
            off=table[id];end=min([p for p in table.values() if p>off]+[len(pack)]);blob=pack[off:end]
            name=f'logic-{id}.png' if logic_id==2 else f'logic-{logic_id}-{id}.png';dest=assets.web/name
            if not dest.exists():dest.write_bytes(texture_png(blob))
            w,h=struct.unpack_from('<HH',blob);data['logic']['assets'][str(id)]=dict(file=name,width=w,height=h)
    data['silentMusic']=[id for id in ids(904) if not 1<=id<53]
    # 0886529C–B8 rejects music IDs outside 1..52 before resource access.
    if set(data['silentMusic'])-{968}:raise ValueError('Unreviewed invalid music ID')
    data['music']={str(id):assets.music(id) for id in ids(904) if id not in data['silentMusic']}
    return data

def main():
    from compile_chapter import compile_data
    assets=Assets();prologue=json.loads((assets.web/'prologue.json').read_text())
    zero=compile_data(0)
    zero['scripts']={**prologue['scripts'],**zero['scripts']}
    zero=build_assets(zero,assets)
    zero['terms']={**prologue['terms'],**zero['terms']}
    zero['pageText']=json.loads((ROOT/'scripts/data/web-tutorials.json').read_text())
    common=dict(schemaVersion=1,revision=prologue['revision'],sourceSha256=prologue['sourceSha256'])
    zero.update(**common,entry=1,title='第零话 · 黒闇',scope='序章与第零话')
    titles=['第零话 · 黒闇','第一话 · 予知夢','第二话 · 心霊写真','最终话 · 流行り神',
            '小暮篇 · エレベーター幽霊','贺茂泉篇 · 座敷わらし','由香篇 · 作られた都市伝説','道明寺篇','人见篇 · よみがえり']
    names=['chapter-zero','chapter-one']+[f'chapter-{c}' for c in range(2,9)]
    chapters=[zero]
    for c in range(1,9):
        print('Compiling',titles[c],flush=True)
        chapter=build_assets(compile_data(c),assets)
        chapter.update(**common,entry=(c+1)*10000+1,title=titles[c],scope=titles[c]+'（保留原文）')
        chapters.append(chapter)
    merged={**zero}
    for key in ['scripts','terms','definitions','keywords','backgrounds','backgroundTextures','sprites','music','effects','ambient','loops','secondary']:
        merged[key]={}
        for chapter in reversed(chapters):merged[key].update(chapter.get(key,{}))
    merged['animationData']={}
    for chapter in chapters:
        for id,animation in chapter['animationData'].items():
            if id not in merged['animationData']:merged['animationData'][id]=animation
            else:
                merged['animationData'][id]['variants'].update(animation['variants'])
                merged['animationData'][id].setdefault('variantFallbacks',{}).update(animation.get('variantFallbacks',{}))
    for key in ['silentEffects','silentAmbient','silentLoops','silentMusic']:
        merged[key]=sorted({id for chapter in chapters for id in chapter.get(key,[])})
    merged['randomTable']=list(struct.unpack_from('<1000i',assets.eboot,0x08882500-BIAS))
    merged['logics']={str(c['logic']['id']):c['logic'] for c in chapters if c.get('logic')}
    merged['chapters']=[dict(id=c,entry=(c+1)*10000+1,title=title,minScript=(c+1)*10000,maxScript=(c+2)*10000-1,
        **({'next':(c+2)*10000+1} if c<8 else {})) for c,title in enumerate(titles)]
    merged.update(title='流行之神 2',scope='序章、全部主线与外传')
    for name,data in list(zip(names,chapters))+[('game',merged)]:
        data['randomTable']=merged['randomTable']
        (assets.web/f'{name}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
        print(name,':',len(data['scripts']),'scripts,',len(data['backgrounds']),'backgrounds,',len(data['sprites']),'sprites,',len(data['music']),'music tracks')
if __name__=='__main__':main()
