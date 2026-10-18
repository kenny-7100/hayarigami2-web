"""Chapter sound mapping from original executable tables; ffmpeg converts offline."""
import struct,subprocess
from compile_prologue import ROOT,BIAS

def compile_audio(assets,instructions):
    ids=lambda op:sorted({t['args'][0] for t in instructions if t.get('op')==op})
    e=assets.eboot
    def convert(prefix,id,raw,suffix):
        name=f'{prefix}-{id}.m4a';dest=assets.web/name
        if not dest.exists():
            src=ROOT/f'output/{prefix}-{id}.{suffix}';src.write_bytes(raw)
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(src),'-c:a','aac','-b:a','96k',str(dest)],check=True)
        return name
    stream={t[0]:t for t in struct.iter_unpack('<4h',e[0x0887fff4-BIAS:0x0887fff4-BIAS+342*8])}
    # 088657D0 calls lookup 08864C10; null returns at 088657DC.
    # These two source IDs are absent from the 342-entry stream table.
    silent_ambient=sorted(set(ids(909))-stream.keys())
    if set(silent_ambient)-{120,349}:raise ValueError(f'Unreviewed absent stream IDs {silent_ambient}')
    ambient={str(id):convert('sound',id,assets.resource(stream[id][1]),'at3') for id in ids(909) if id in stream}
    loopmap={t[0]:t for t in struct.iter_unpack('<8h',e[0x08884178-BIAS:0x088847a8-BIAS])}
    # 0883D64C lookup returns null for absent IDs; caller 0883D4AC–C0
    # returns without playback. 601 has no native loop resource.
    silent_loops=sorted(set(ids(920))-loopmap.keys())
    if set(silent_loops)-{601}:raise ValueError(f'Unreviewed absent loop IDs {silent_loops}')
    loops={str(id):convert('loop',id,assets.resource(loopmap[id][3]+688),'vag') for id in ids(920) if id in loopmap}
    effects={};silent_effects=[];table={t[0]:t for t in struct.iter_unpack('<8h',e[0x08883d64-BIAS:0x08884174-BIAS])}
    phd=(ROOT/'output/extracted/static_se.phd').read_bytes();pbd=(ROOT/'output/extracted/static_se.pbd').read_bytes();va=phd.index(b'PPVA')
    for id in ids(914):
        # 0883d5fc returns null for absent IDs; 0883d288 returns without playback.
        if id not in table:
            silent_effects.append(id);continue
        index=table[id][3];off,rate,size,_=struct.unpack_from('<4I',phd,va+32+index*16)
        if off+size>len(pbd) or size%16:raise ValueError('Invalid static effect boundary')
        raw=b'VAGp'+struct.pack('>4I',0x20,0,size,rate)+b'\0'*28+pbd[off:off+size]
        effects[str(id)]=convert('effect',id,raw,'vag')
    secondarymap={t[0]:t for t in struct.iter_unpack('<IhhIIbbh',e[0x0887fea0-BIAS:0x0887fea0-BIAS+17*20])}
    secondary={str(id):convert('secondary',id,assets.resource(secondarymap[id][1]),'at3') for id in ids(925)}
    return dict(silentEffects=silent_effects,silentAmbient=silent_ambient,silentLoops=silent_loops,effects=effects,ambient=ambient,loops=loops,secondary=secondary)
