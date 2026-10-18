#!/usr/bin/env python3
"""Compile chapter zero into Unicode Web records. All source offsets remain auditable."""
import hashlib,json,struct,subprocess
from pathlib import Path
from audit_chapter import scan,character_codes
from compile_prologue import ROOT,BIAS,decode_text,dxt1_png
from extract_game import story_index

class Decoder:
    def __init__(self):
        self.mapping=json.loads((ROOT/'scripts/data/chapter-zero-glyph-map.json').read_text())['mapping'];self.missing=set()
    def text(self,raw,xor=False,trim=True):
        if xor:raw=bytes(x^255 for x in raw)
        codes=list(character_codes(raw));self.missing.update(set(codes)-self.mapping.keys())
        # Dictionary renderer 0884cc0c / 0884cc58 inserts name fields 0 / 1.
        special={'876c':'{surname}','876d':'{givenName}'}
        text=''.join(special.get(c,self.mapping.get(c,'�')) for c in codes)
        return text.strip() if trim else text

class JapaneseDecoder:
    """Strict offline CP932 decoding for untranslated source records."""
    def text(self, raw, xor=False, trim=True):
        if xor: raw=bytes(x^255 for x in raw)
        special={'876c':'{surname}','876d':'{givenName}','876e':' ',
                 '8785':'—','8786':'—','8787':'—','8789':'鬼'}
        text=''.join(special[c] if c in special else bytes.fromhex(c).decode('cp932') for c in character_codes(raw))
        return text.strip() if trim else text

def compile_data(chapter=0):
    if chapter not in range(9):raise ValueError('Unsupported chapter')
    patched=Decoder();dec=patched if chapter==0 else JapaneseDecoder()
    if chapter>=1:
        for name in ['chapter-one-glyph-map.json','remaining-keyword-glyph-map.json']:
            patched.mapping.update(json.loads((ROOT/'scripts/data'/name).read_text())['mapping'])
    root=ROOT/'output/extracted';raw=(root/'story.dat').read_bytes()
    records={r['id']:r for r in story_index(raw)}
    wanted={id for id in records if (chapter+1)*10000<=id<(chapter+2)*10000}
    # Include transitive jumps and spawned presentation scripts, preserving source records.
    scripts=[];seen=set()
    while wanted-seen:
        id=min(wanted-seen);seen.add(id);script=scan(raw,records[id]);scripts.append(script)
        for t in script['instructions']:
            if t.get('op') in (101,1301):
                target=t['args'][0]+t['args'][1]*65536
                if target not in records:raise ValueError(f'Missing source record {target}')
                wanted.add(target)
    exact={445568:(12,'7891789100000000'),463532:(10,'789178910000'),472732:(12,'7891789100000000')}
    # Dispatcher 08823c60 advances by encoded length for unregistered instructions.
    # Only the three pinned translation-patch sites are accepted here.
    for s in scripts:
        s['language']='ja' if chapter>=1 and s['id']!=20101 else 'zh-CN'
        for t in s['instructions']:
            if 'hex'in t:t['text']=(patched if s['id']==20101 else dec).text(bytes.fromhex(t.pop('hex')),trim=False)
            else:
                payload=bytes.fromhex(t.pop('payload'));op=t['op']
                if op==37240:
                    if (t['length'],payload.hex())!=exact.get(t['offset']):raise ValueError('Unrecognized patch instruction')
                if op in (1310,1401):t['label']=(patched if s['id']<10000 else dec).text(payload[2 if op==1310 else 4:].split(b'\0')[0],True)
    k=(root/'keyword.dat').read_bytes();keywords={}
    for i in range(struct.unpack_from('<I',k)[0]):
        id,_,off=struct.unpack_from('<HHI',k,4+i*28)
        if {0:4600,1:4700,2:4800,3:4900,4:5100,5:5000,6:5200}.get(chapter,0)<=id<{0:4700,1:4800,2:4900,3:5000,4:5200,5:5100,6:5300}.get(chapter,0):keywords[str(id)]=patched.text(k[off:k.index(0,off)])
    logic_ids={t['args'][0] for s in scripts for t in s['instructions'] if t.get('op')==2008}
    if len(logic_ids)>1:raise ValueError('Multiple chapter logic maps require explicit selection')
    logic_id=next(iter(logic_ids),0)
    l=(root/'logic.dat').read_bytes();p=dict(struct.iter_unpack('<II',l[4:68]))[logic_id];ns=list(l[p+8:p+13]);ptr=struct.unpack_from('<'+'I'*sum(ns),l,p+16)
    groups=[];i=0
    for n in ns:groups.append(ptr[i:i+n]);i+=n
    choices={}
    for q in groups[3]:
        gid,count=l[q:q+2];entries=[]
        for j in range(count):
            pos=q+4+j*48;id=struct.unpack_from('<H',l,pos)[0]
            entries.append(dict(id=id,description=dec.text(l[pos+2:pos+48].split(b'\0')[0],True)))
        choices[gid]=entries
    fields=[]
    for q in groups[1]:
        on,off=l[q+10:q+12];flags=list(struct.unpack_from('<'+'H'*(on+off),l,q+14))
        fields.append(dict(id=l[q+8],x=struct.unpack_from('<h',l,q+2)[0],y=struct.unpack_from('<h',l,q+4)[0],on=flags[:on],off=flags[on:],choices=choices[l[q+12]]))
    descriptions={}
    for q in groups[2]:
        id,lines=struct.unpack_from('<HH',l,q);pos=q+4;out=[]
        for _ in range(lines):
            end=l.index(0,pos);out.append(dec.text(l[pos:end],True));pos=end+1
        descriptions[id]='\n'.join(out).strip()
    nodes=[]
    for q in groups[0]:
        on,off=l[q+28:q+30];flags=list(struct.unpack_from('<'+'H'*(on+off),l,q+30));asset,x,y,z,w,h=struct.unpack_from('<6h',l,q+2)
        nodes.append(dict(asset=asset,x=x,y=y,z=z,width=w,height=h,description=l[q+27],on=flags[:on],off=flags[on:]))
    variants={}
    for q in groups[4]:
        id,count=struct.unpack_from('<HH',l,q);variants[id]=[dict(flag=f,description=d) for f,d in struct.iter_unpack('<HH',l[q+4:q+4+count*4])]
    occult=(root/'OccultFile.dat').read_bytes();table=dict(struct.iter_unpack('<II',occult[4:4+struct.unpack_from('<I',occult)[0]*8]));terms={}
    ids={t['args'][0] for s in scripts for t in s['instructions'] if t.get('op')==2013} | ({1,2,3,4,108} if chapter==0 else set())
    definitions={}
    for id in ids:
        q=table[id];terms[str(id)]=dec.text(occult[q+8:q+72].split(b'\0')[0],True)
        end=min([v for v in table.values() if v>q]+[len(occult)])
        lines=occult[q+93:end].rstrip(b'\0').split(b'\0')
        if chapter>=1:lines=lines[:struct.unpack_from('<H',occult,q+6)[0]]
        definitions[str(id)]='\n'.join(dec.text(line,True) for line in lines)
    result=dict(scripts={str(s['id']):s for s in scripts},keywords=keywords,terms=terms,definitions=definitions,logic=dict(id=logic_id,width=struct.unpack_from('<H',l,p)[0],height=struct.unpack_from('<H',l,p+2)[0],fields=fields,nodes=nodes,descriptions=descriptions,variants=variants))
    if not logic_ids:result.pop('logic')
    if patched.missing:
        (ROOT/'output/chapter-zero/additional-glyphs.json').write_text(json.dumps(sorted(patched.missing)));raise ValueError(f'{len(patched.missing)} missing additional glyphs')
    return result

if __name__=='__main__':
    result=compile_data();(ROOT/'output/chapter-zero/compiled.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('Compiled chapter text and logic')
