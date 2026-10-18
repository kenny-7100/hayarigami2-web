#!/usr/bin/env python3
"""Extract the local PSP ISO into a reproducible, browser-readable asset manifest.
No original executables are run. Requires Python 3 and bsdtar.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def unpack_sfo(data):
    magic, _, keys, values, count = struct.unpack_from('<5I', data)
    if magic != 0x46535000:
        raise ValueError('Invalid PARAM.SFO')
    result = {}
    for i in range(count):
        key, fmt, size, _, offset = struct.unpack_from('<HHIII', data, 20 + 16 * i)
        name = data[keys + key:].split(b'\0', 1)[0].decode('utf-8')
        value = data[values + offset:values + offset + size]
        result[name] = struct.unpack('<I', value)[0] if fmt == 0x404 else value.rstrip(b'\0').decode('utf-8')
    return result


def unpack_nispack(data):
    """Offsets are relative to the NISPACK header, NOT DATA.DAT's start."""
    for match in re.finditer(b'NISPACK\0', data):
        base = match.start()
        endian, count = struct.unpack_from('<II', data, base + 8)
        if endian != 0 or not 0 < count < 10000 or base + 16 + count * 44 > len(data):
            continue
        entries = []
        for i in range(count):
            at = base + 16 + i * 44
            raw, offset, size, stamp = struct.unpack_from('<32sIII', data, at)
            name = raw.split(b'\0', 1)[0].decode('ascii')
            if not re.fullmatch(r'[\w.\-]+', name) or name in ('.', '..'):
                raise ValueError(f'Unsafe archive path: {name}')
            if offset < 16 + count * 44 or base + offset + size > len(data):
                raise ValueError(f'Out-of-bounds archive entry: {name}')
            entries.append({'name': name, 'offset': base + offset, 'size': size, 'stamp': stamp})
        return base, entries
    raise ValueError('No supported NISPACK directory found')


def read_keywords(data):
    count, = struct.unpack_from('<I', data)
    if 4 + count * 28 > len(data):
        raise ValueError('Invalid keyword index')
    result = []
    for i in range(count):
        at = 4 + i * 28
        identifier, size, offset = struct.unpack_from('<HHI', data, at)
        if offset + size > len(data):
            raise ValueError('Keyword outside file')
        text = data[offset:offset + size].rstrip(b'\0').decode('cp932', errors='replace').strip()
        if text:
            result.append({'id': identifier, 'text': text, 'offset': offset,
                           'uncertain': '\ufffd' in text or '㌻' in text})
    return result


def story_index(data):
    start, count = struct.unpack_from('<II', data)
    if start != 8 + count * 8 or start > len(data):
        raise ValueError('Unsupported story index')
    records = []
    for i in range(count):
        identifier, offset = struct.unpack_from('<II', data, 8 + i * 8)
        if not start <= offset < len(data):
            raise ValueError('Story offset outside file')
        records.append({'id': identifier, 'offset': offset})
    if any(a['offset'] > b['offset'] for a, b in zip(records, records[1:])):
        raise ValueError('Story index is not ordered')
    for i, record in enumerate(records):
        record['size'] = (records[i + 1]['offset'] if i + 1 < count else len(data)) - record['offset']
    return records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('iso', nargs='?', type=Path, default=ROOT / 'hg2.iso')
    args = parser.parse_args()
    staging = ROOT / 'output' / 'iso-inspection'
    staging.mkdir(parents=True, exist_ok=True)
    members = ['PSP_GAME/PARAM.SFO', 'PSP_GAME/ICON0.PNG', 'PSP_GAME/PIC1.PNG', 'PSP_GAME/SYSDIR/EBOOT.BIN', 'PSP_GAME/USRDIR/DATA.DAT']
    subprocess.run(['bsdtar', '-xf', str(args.iso.resolve()), '-C', str(staging), *members], check=True)
    data = (staging / members[-1]).read_bytes()
    base, entries = unpack_nispack(data)
    rawdir = ROOT / 'output' / 'extracted'
    webdir = ROOT / 'public' / 'game'
    rawdir.mkdir(parents=True, exist_ok=True)
    webdir.mkdir(parents=True, exist_ok=True)
    for entry in entries:
        content = data[entry['offset']:entry['offset'] + entry['size']]
        (rawdir / entry['name']).write_bytes(content)
        if entry['name'].endswith('.png') and content.startswith(b'\x89PNG\r\n\x1a\n'):
            (webdir / entry['name']).write_bytes(content)
    for name in ['ICON0.PNG', 'PIC1.PNG']:
        (webdir / name).write_bytes((staging / 'PSP_GAME' / name).read_bytes())
    records = story_index((rawdir / 'story.dat').read_bytes())
    (rawdir / 'story-index.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    manifest = {
        'schemaVersion': 1,
        'metadata': unpack_sfo((staging / 'PSP_GAME/PARAM.SFO').read_bytes()),
        'dataSha256': hashlib.sha256(data).hexdigest(),
        'dataSize': len(data), 'archiveOffset': base, 'entries': entries,
        'storyRecordCount': len(records),
        'keywords': read_keywords((rawdir / 'keyword.dat').read_bytes()),
        'images': [{'name': name, 'url': name} for name in
                   ['PIC1.PNG', 'ICON0.PNG', 'background.png', 'playsave.png', 'systemsave.png']
                   if (webdir / name).exists()],
    }
    (webdir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Extracted {len(entries)} resources; {len(records)} story index records; {len(manifest["keywords"])} nonempty keywords')
    print(f'Web assets: {webdir}')


if __name__ == '__main__':
    main()
