#!/usr/bin/env python3
"""Compile original prologue instructions into a Unicode-only Web data package.
No inferred Chinese characters: unknown glyphs fail the build.
Python standard library + ffmpeg. EBOOT layout is pinned to this local release.
"""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import zlib
from extract_game import story_index

ROOT = Path(__file__).resolve().parents[1]
BIAS = 0x08803FAC
SUPPORTED = {1,2,3,4,101,106,107,201,202,203,204,205,206,207,213,216,217,306,307,
             401,402,403,701,801,902,903,904,905,906,914,921,922,1001,1101,
             1308,1309,1311,2013,2201,2202,2203,2204,2205,2401,2402,2403,2405,2406,2407}


def decode_text(raw, mapping):
    result = []
    i = 0
    while i < len(raw):
        lead = raw[i]
        length = 2 if 0x81 <= lead < 0xa0 or 0xe0 <= lead < 0xfd else 1
        code = raw[i:i + length].hex()
        if code not in mapping:
            raise ValueError(f'Unverified translated glyph {code}; do not silently substitute')
        result.append(mapping[code])
        i += length
    return ''.join(result)


def parse_record(data, row, mapping):
    cursor, end = row['offset'], row['offset'] + row['size']
    instructions = []
    while cursor < end:
        if data[cursor] == 0:
            cursor += 1
            continue
        start = cursor
        if data[cursor] == 255:
            length = data[cursor + 1]
            if length < 4 or cursor + length > end:
                raise ValueError(f'Invalid instruction at {cursor:#x}')
            opcode, = struct.unpack_from('<H', data, cursor + 2)
            if opcode not in SUPPORTED:
                raise ValueError(f'Unsupported opcode {opcode} at {cursor:#x}')
            payload = data[cursor + 4:cursor + length]
            args = list(struct.unpack('<' + 'H' * (len(payload) // 2), payload[:len(payload)//2*2]))
            instructions.append({'offset': cursor, 'length': length, 'op': opcode, 'args': args})
            cursor += length  # Exact byte length, NOT round-up-to-four.
        else:
            text = bytearray()
            while cursor < end and data[cursor] not in (0, 255):
                lead = data[cursor] ^ 255
                text.append(lead)
                cursor += 1
                if 0x81 <= lead < 0xa0 or 0xe0 <= lead < 0xfd:
                    if cursor >= end:
                        raise ValueError('Truncated double-byte text')
                    text.append(data[cursor] ^ 255)
                    cursor += 1
            instructions.append({'offset': start, 'length': cursor - start, 'text': decode_text(text, mapping)})
    return {**row, 'instructions': instructions}


def dxt1_png(data):
    width, height = struct.unpack_from('<HH', data)
    if not width or not height or width % 4 or height % 4 or len(data) != 16 + width * height // 2:
        raise ValueError('Unexpected PSP DXT1 texture dimensions')
    pixels = bytearray(width * height * 3)
    cursor = 16
    def rgb(value):
        return ((value >> 11) * 255 // 31, ((value >> 5) & 63) * 255 // 63, (value & 31) * 255 // 31)
    for y in range(0, height, 4):
        for x in range(0, width, 4):
            bits, color0, color1 = struct.unpack_from('<IHH', data, cursor)
            cursor += 8
            a, b = rgb(color0), rgb(color1)
            palette = [a, b]
            if color0 > color1:
                palette += [tuple((2*u+v)//3 for u,v in zip(a,b)), tuple((u+2*v)//3 for u,v in zip(a,b))]
            else:
                palette += [tuple((u+v)//2 for u,v in zip(a,b)), (0,0,0)]
            for i in range(16):
                index = ((y + i//4) * width + x + i%4) * 3
                pixels[index:index+3] = bytes(palette[(bits >> (2*i)) & 3])
    def chunk(kind, content):
        return struct.pack('>I',len(content)) + kind + content + struct.pack('>I',zlib.crc32(kind+content)&0xffffffff)
    scanlines = b''.join(b'\0' + pixels[y*width*3:(y+1)*width*3] for y in range(height))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR',struct.pack('>2I5B',width,height,8,2,0,0,0)) + chunk(b'IDAT',zlib.compress(scanlines)) + chunk(b'IEND',b'')


def main():
    rawdir = ROOT / 'output/extracted'
    web = ROOT / 'public/game'
    web.mkdir(parents=True, exist_ok=True)
    data = (rawdir/'story.dat').read_bytes()
    eboot = (ROOT/'output/iso-inspection/PSP_GAME/SYSDIR/EBOOT.BIN').read_bytes()
    archive = (ROOT/'output/iso-inspection/PSP_GAME/USRDIR/DATA.DAT').read_bytes()
    mapping_file = ROOT/'scripts/data/prologue-glyph-map.json'
    mapping = json.loads(mapping_file.read_text())['mapping']
    records = [parse_record(data, row, mapping) for row in story_index(data) if row['id'] in (1,2,3,4)]
    assert [r['id'] for r in records] == [1,2,3,4]
    # Validate the static resource map before trusting addresses from this EBOOT build.
    def resource(index):
        offset, size = struct.unpack_from('<II',eboot,0x0887A9CC-BIAS+index*8)
        if size <= 0 or offset + size > len(archive):
            raise ValueError('Invalid resource boundary / unsupported EBOOT version')
        return archive[offset:offset+size]
    if not resource(1537).startswith(b'NISPACK\0'):
        raise ValueError('EBOOT resource table does not match this supported release')
    textures = dict(struct.iter_unpack('<II',eboot[0x0887D9DC-BIAS:0x0887D9DC-BIAS+396*8]))
    for asset_id in (196,515):
        (web/f'background-{asset_id}.png').write_bytes(dxt1_png(resource(textures[asset_id])))
    music = {}
    for music_id in (6,8,9):
        index, = struct.unpack_from('<h',eboot,0x0887FA90-BIAS+music_id*20+4)
        raw = resource(index)
        if not raw.startswith(b'RIFF'):
            raise ValueError('Expected ATRAC RIFF music')
        path = ROOT/f'output/bgm-{music_id}.at3'
        path.write_bytes(raw)
        dest = web/f'bgm-{music_id}.m4a'
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(path),'-c:a','aac','-b:a','128k',str(dest)],check=True)
        music[str(music_id)] = dest.name
    # Revision includes the Unicode mapping, so incompatible text conversions invalidate saves.
    revision = hashlib.sha256(data + mapping_file.read_bytes() + b'web-prologue-v1').hexdigest()[:16]
    package = {'schemaVersion':1,'revision':revision,'entry':1,'title':'序章 · 朋友的朋友',
               'sourceSha256':hashlib.sha256(data).hexdigest(), 'scripts':{str(r['id']):r for r in records},
               'backgrounds':{'196':'background-196.png','515':'background-515.png'},'music':music,
               'terms':{'1':'秘密结社','2':'NSA','3':'梯队系统','4':'GPS','108':'笔仙'},
               'scope':'原版序章 1 → 2 → 3；含姓名输入、条件跳转、术语解锁。动画节奏采用 Web 阅读方式，未实现 PSP 特效与音效。'}
    (web/'prologue.json').write_text(json.dumps(package,ensure_ascii=False,separators=(',',':'))+'\n')
    count = sum(t.get('op')==3 for r in records if r['id']!=4 for t in r['instructions'])
    print(f'Compiled prologue: {count} dialogue blocks, Unicode text, 2 backgrounds, 3 BGM tracks; revision {revision}')

if __name__ == '__main__':
    main()
