"""Offline animation tables/atlases. Browser receives Unicode-free native Web data.

EBOOT: package lookup 08852d7c, node tree 088621dc, keyframes 0886257c,
cell/transform/color sampling 08862680, child variant commands 08861f54.
"""
import struct
from compile_prologue import ROOT

def package_index(id):
    if 100 <= id < 1000: return (id-100)//100+2
    if 1000 <= id < 1400: return (id-1000)//100+9
    if id==1400:return 11
    if id==1700:return 12
    if 5400<=id<6000:return (id-5400)//100+13
    if 6000<=id<9000:return (id-6000)//100+16
    raise ValueError(f'Unsupported animation package {id}')

def compile_animations(assets,instructions):
    from compile_assets import texture_png
    ids={t['args'][0] for t in instructions if t.get('op')==2403}
    packages=[(ROOT/'output/extracted/anm0000.dat').read_bytes()]
    packages += [assets.resource(i) for i in sorted({package_index(id) for id in ids if id>=100})]
    result={}
    for raw in packages:
        position=16
        for _ in range(struct.unpack_from('<I',raw)[0]):
            size,id=struct.unpack_from('<IH',raw,position)
            if size<60 or position+size>len(raw):raise ValueError('Invalid animation block')
            b=raw[position:position+size];position+=size
            counts=struct.unpack_from('<9H',b,6);offsets=struct.unpack_from('<9I',b,24)
            sizes=[8,12,12,8,16,16,16,16,4]
            for n,p,stride in zip(counts,offsets,sizes):
                if p+n*stride>len(b):raise ValueError('Animation table outside block')
            table=lambda group,fmt:[list(struct.unpack_from(fmt,b,offsets[group]+i*sizes[group])) for i in range(counts[group])]
            variants={str(r[0]):dict(start=r[1],end=r[2]) for r in table(0,'<4h')}
            nodes=table(1,'<I4h');frames=table(2,'<6h');transforms=table(6,'<6hi')
            colors=table(7,'<16B');commands=[r[0] for r in table(8,'<i')]
            cells=[];textures={}
            for tex,pal,blend,flip,u,v,w,h in table(5,'<8H'):
                if not w or not h:
                    cells.append(None);continue
                if tex>=counts[4] or pal>=counts[3]:
                    # Original 6200's terminal cell 8 points outside its six texture
                    # descriptors. Native descriptor access (088627D8–E4) reads a
                    # zero-width/height descriptor there. Preserve an empty terminal
                    # draw, pinned to the source cell rather than hiding other errors.
                    if id==6200 and len(cells)==8 and (tex,pal,u,v,w,h)==(16,1,0,0,480,272) and struct.unpack_from('<HH',b,offsets[4]+tex*16+4)==(0,0):
                        cells.append(None);continue
                    raise ValueError(f'Invalid animation cell id={id} tex={tex} pal={pal} counts={counts}')
                key=f'{tex}-{pal}'
                if key not in textures:
                    po,n=struct.unpack_from('<II',b,offsets[3]+pal*8)
                    desc=b[offsets[4]+tex*16:offsets[4]+(tex+1)*16]
                    off,tw,th=struct.unpack_from('<IHH',desc)
                    stride=struct.unpack_from('<H',desc,10)[0];bits=desc[12];swizzle=desc[15]
                    if bits not in (4,8) or swizzle not in (0,1):raise ValueError(f'Unsupported animation texture {desc.hex()}')
                    rows=(th+7)//8*8 if swizzle else th
                    count=stride*rows*bits//8
                    if off+count>len(b) or po+n*4>len(b):raise ValueError('Animation texture outside block')
                    header=struct.pack('<4H',tw,th,0,16 if bits==4 else 256)+struct.pack('<HHBBH',n,1,swizzle,0,stride)
                    blob=header+b[po:po+n*4]+b[off:off+count]
                    name=f'animation-{id}-{key}.png';dest=assets.web/name
                    if not dest.exists():dest.write_bytes(texture_png(blob))
                    textures[key]=dict(file=name,width=tw,height=th)
                cells.append(dict(texture=key,u=u,v=v,width=w,height=h,flipX=bool(flip&255),flipY=bool(flip>>8),blend=blend))
            result[str(id)]=dict(variants=variants,nodes=nodes,frames=frames,transforms=transforms,colors=colors,commands=commands,cells=cells,textures=textures)
    for t in instructions:
        if t.get('op')==2403:
            id,variant=t['args'][:2]
            animation=result[str(id)]
            if str(variant) not in animation['variants']:
                # Native 088614B0–C0 falls back to the first variant table row.
                first=next(iter(animation['variants']),None)
                if first is None:raise ValueError(f'Animation has no variants {id}')
                animation.setdefault('variantFallbacks',{})[str(variant)]=int(first)
                animation['variants'][str(variant)]=dict(animation['variants'][first])
    return result
