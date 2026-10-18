"""Build an auditable translation inventory; never change the source game package."""
import argparse
import hashlib
import json
from pathlib import Path


def fingerprint(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def extract(game):
    entries = []

    def add(key, text, kind, **context):
        if isinstance(text, str) and text.strip():
            entries.append(dict(key=key, source=text, sourceHash=fingerprint(text), kind=kind, **context))

    for script_id, script in sorted(game['scripts'].items(), key=lambda item: int(item[0])):
        chapter = next((c['id'] for c in game.get('chapters', []) if c['minScript'] <= int(script_id) <= c['maxScript']), None)
        block = script['offset']
        instructions = script['instructions']
        for index, ins in enumerate(instructions):
            if ins.get('op') in (1, 3):
                block = ins['offset']
            # Keep adjacent source instructions as context, including keyword/style controls.
            context = dict(script=int(script_id), chapter=chapter, block=block, offset=ins['offset'],
                           sourceLanguage=script.get('language', 'mixed'),
                           before=instructions[max(0, index - 3):index], after=instructions[index + 1:index + 4])
            for field in ('text', 'label'):
                if field in ins:
                    add(f'script.{script_id}.{ins["offset"]}.{field}', ins[field], 'script-fragment', **context)
    # Runtime credits use full label text as their stable key; retain instruction records above for provenance.
    credit_labels = sorted({ins['label'] for sid, script in game['scripts'].items()
                            if 6100 <= int(sid) < 6300
                            for ins in script['instructions'] if ins.get('label', '').strip()})
    for label in credit_labels:
        add(f'label.{label}', label, 'credit-label')
    for collection in ('keywords', 'terms', 'definitions', 'pageText'):
        for key, text in game.get(collection, {}).items():
            add(f'{collection}.{key}', text, collection)
    for chapter in game.get('chapters', []):
        add(f'chapter.{chapter["id"]}.title', chapter['title'], 'chapter', chapter=chapter['id'])
    diagrams = game.get('logics', {})
    if game.get('logic') and str(game['logic']['id']) not in diagrams:
        diagrams = {**diagrams, str(game['logic']['id']): game['logic']}
    for logic_id, diagram in diagrams.items():
        for key, text in diagram['descriptions'].items():
            add(f'logic.{logic_id}.description.{key}', text, 'character-description', logic=logic_id)
        for field in diagram['fields']:
            for choice in field['choices']:
                add(f'logic.{logic_id}.field.{field["id"]}.choice.{choice["id"]}', choice['description'], 'relation-description', logic=logic_id)
    return entries


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', default='public/game/game.json')
    parser.add_argument('--out', default='output/localization')
    args = parser.parse_args()
    raw = Path(args.game).read_bytes()
    game = json.loads(raw)
    entries = extract(game)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with (out / 'source.jsonl').open('w') as file:
        for entry in entries:
            file.write(json.dumps(entry, ensure_ascii=False) + '\n')
    kinds = sorted({e['kind'] for e in entries})
    report = dict(gameSha256=hashlib.sha256(raw).hexdigest(), sourceSha256=game['sourceSha256'],
                  entries=len(entries), characters=sum(len(e['source']) for e in entries),
                  byKind={kind: dict(entries=sum(e['kind'] == kind for e in entries),
                                     characters=sum(len(e['source']) for e in entries if e['kind'] == kind)) for kind in kinds})
    (out / 'inventory.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
