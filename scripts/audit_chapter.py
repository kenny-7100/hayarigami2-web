#!/usr/bin/env python3
"""Inventory original chapter bytes without pretending unsupported instructions execute."""
from pathlib import Path
import argparse
import collections
import hashlib
import json
import struct
from extract_game import story_index
ROOT=Path(__file__).resolve().parents[1]

def scan(data,row):
    end=row['offset']+row['size'];p=row['offset'];tokens=[]
    while p<end:
        if data[p]==0:p+=1;continue
        start=p
        if data[p]==255:
            if p+4>end:raise ValueError(f'Truncated instruction header {p:#x}')
            length=data[p+1]
            if length<4 or p+length>end:raise ValueError(f'Invalid instruction length {p:#x}')
            op=struct.unpack_from('<H',data,p+2)[0]
            payload=data[p+4:p+length]
            tokens.append(dict(offset=p,length=length,op=op,args=list(struct.unpack('<'+'H'*(len(payload)//2),payload[:len(payload)//2*2])),payload=payload.hex()))
            p+=length
        else:
            raw=bytearray()
            while p<end and data[p] not in (0,255):
                lead=data[p]^255;raw.append(lead);p+=1
                if 0x81<=lead<0xa0 or 0xe0<=lead<0xfd:
                    if p>=end:raise ValueError(f'Truncated character {p:#x}')
                    raw.append(data[p]^255);p+=1
            tokens.append(dict(offset=start,length=p-start,hex=raw.hex()))
    return dict(**row,instructions=tokens)

def character_codes(raw):
    p=0
    while p<len(raw):
        n=2 if 0x81<=raw[p]<0xa0 or 0xe0<=raw[p]<0xfd else 1
        if p+n>len(raw):raise ValueError('Truncated glyph')
        yield raw[p:p+n].hex();p+=n

def make_report(data, rows, handlers=None, baseline=None, mapping=None, baseline_data=None):
    """Static inventory, not a claim of reachability or runtime support."""
    ops = collections.Counter()
    resource_ops = {401:'backgrounds', 904:'music', 909:'ambient', 914:'effects', 920:'loops', 925:'secondary', 2201:'sprites', 2001:'keywords', 2008:'logics', 2013:'terms'}
    resources = collections.defaultdict(set)
    codes, edges, sites = set(), [], {}
    for row in rows:
        for pc, token in enumerate(row['instructions']):
            if 'hex' in token:
                codes.update(character_codes(bytes.fromhex(token['hex'])))
                continue
            op = token['op']
            ops[op] += 1
            if op in resource_ops and token['args']:
                resources[resource_ops[op]].add(token['args'][0])
            if op == 2403 and len(token['args']) >= 2:
                resources['animationVariants'].add(':'.join(map(str, token['args'][:2])))
            sites.setdefault(str(op), []).append(dict(script=row['id'], pc=pc, offset=token['offset']))
            if op == 101:
                payload = bytes.fromhex(token['payload'])
                if len(payload) < 4:
                    raise ValueError(f"Truncated jump at {token['offset']:#x}")
                edges.append(dict(source=row['id'], target=struct.unpack_from('<I', payload)[0], offset=token['offset']))
    ids = {row['id'] for row in rows}
    new_resources = None
    if baseline_data is not None:
        new_resources = {}
        for kind, values in resources.items():
            if kind == 'animationVariants':
                known = {f'{aid}:{variant}' for aid, animation in baseline_data.get('animationData', {}).items() for variant in animation['variants']}
            else:
                known = set(baseline_data.get(kind, {}))
                if kind == 'effects':
                    known.update(str(i) for i in baseline_data.get('silentEffects', []))
            new_resources[kind] = sorted(value for value in values if str(value) not in known)

    return dict(
        sourceSha256=hashlib.sha256(data).hexdigest(), scriptCount=len(rows),
        scriptIds=sorted(ids), dialogueBlocks=ops[3], opcodes=dict(sorted(ops.items())),
        opcodeSites=sites, glyphCodes=sorted(codes),
        resourceReferences={key:sorted(values) for key,values in resources.items()},
        newResourceReferences=new_resources,
        missingGlyphs=sorted(codes-set(mapping)) if mapping is not None else None,
        unregisteredOpcodes=sorted(op for op in ops if str(op) not in handlers) if handlers is not None else None,
        newComparedToBaseline=sorted(set(ops)-baseline) if baseline is not None else None,
        externalJumps=[edge for edge in edges if edge['target'] not in ids], jumps=edges,
        caveat='Static inventory only. New relative to compiled baseline does not mean unsupported; registered native handlers do not mean Web implementation. Glyph-map misses do not imply CP932 decoding errors.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT/'output/extracted/story.dat')
    parser.add_argument('--chapter', type=int, default=0, help='0 => 10000..19999, 1 => 20000..29999; later ranges are candidates, not verified chapter metadata')
    parser.add_argument('--script', type=int, help='Inspect one original record instead of a range')
    parser.add_argument('--catalog', action='store_true', help='Print all source ID buckets without decoding or compiling')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--baseline', type=Path, default=ROOT/'public/game/game.json')
    parser.add_argument('--handlers', type=Path, default=ROOT/'output/reverse/opcode-handlers.json')
    parser.add_argument('--glyph-map', type=Path, help='Optional explicit Chinese map; do not use to classify Japanese text')
    args = parser.parse_args()
    if args.chapter < 0:
        parser.error('--chapter must be nonnegative')
    if not args.source.exists():
        parser.error(f'Missing {args.source}; run npm run extract:game first')
    data = args.source.read_bytes()
    index = story_index(data)
    if args.catalog:
        buckets = collections.defaultdict(list)
        for row in index:
            buckets[row['id']//10000].append(row['id'])
        print(json.dumps(dict(sourceSha256=hashlib.sha256(data).hexdigest(), buckets=[dict(bucket=b, count=len(ids), min=min(ids), max=max(ids), candidateEntry=b*10000+1 if b*10000+1 in ids else None) for b, ids in sorted(buckets.items())]), indent=2))
        return
    rows = [scan(data, row) for row in index if row['id'] == args.script] if args.script is not None else [scan(data, row) for row in index if (args.chapter+1)*10000 <= row['id'] < (args.chapter+2)*10000]
    if not rows:
        parser.error('No original records match the requested selection')
    baseline = None
    compiled = None
    if args.baseline.exists():
        compiled = json.loads(args.baseline.read_text())
        baseline = {t['op'] for s in compiled['scripts'].values() for t in s['instructions'] if 'op' in t}
    handlers = json.loads(args.handlers.read_text()) if args.handlers.exists() else None
    mapping = json.loads(args.glyph_map.read_text())['mapping'] if args.glyph_map else None
    report = make_report(data, rows, handlers, baseline, mapping, compiled)
    report['selection'] = dict(chapter=args.chapter, script=args.script)
    report['baselinePath'] = str(args.baseline) if baseline is not None else None
    report['baselineSha256'] = hashlib.sha256(args.baseline.read_bytes()).hexdigest() if baseline is not None else None
    report['handlersPath'] = str(args.handlers) if handlers is not None else None
    report['candidateEntry'] = (args.chapter+1)*10000+1 if args.script is None else args.script
    out = args.out or ROOT/'output'/({0:'chapter-zero',1:'chapter-one'}.get(args.chapter, f'chapter-{args.chapter}') if args.script is None else f'script-{args.script}')
    out.mkdir(parents=True, exist_ok=True)
    (out/'scripts.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2)+'\n')
    (out/'audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(f"{len(rows)} records; {report['dialogueBlocks']} dialogue blocks; {len(report['opcodes'])} opcodes")
    print('New compared to compiled baseline:', report['newComparedToBaseline'])
    print('Unregistered native opcodes:', report['unregisteredOpcodes'])
    print('External jumps:', sorted({e['target'] for e in report['externalJumps']}))
    print('Report:', out/'audit.json')

if __name__ == '__main__':
    main()
