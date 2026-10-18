"""Import full-scene prologue translations; preserve source IDs and structural references."""
import json
import re
import sys
from pathlib import Path
source = [json.loads(line) for line in Path('output/localization/prologue.jsonl').read_text().splitlines()]
lines = Path(sys.argv[1]).read_text().splitlines()
locales = lines[0].split('|')[1:]
sha = json.loads(Path('public/game/game.json').read_text())['sourceSha256']
results = {}
for locale in locales:
    path = Path(f'localization/story/{locale}.json')
    results[locale] = json.loads(path.read_text()) if path.exists() else dict(locale=locale, sourceSha256=sha, strings={}, rich={})
seen = set()
for line in lines[1:]:
    if not line.strip(): continue
    cells = line.split('|')
    index = int(cells[0])
    if index in seen or len(cells) != len(locales) + 1: raise ValueError(index)
    seen.add(index)
    entry = source[index]
    original = json.loads(entry['source'])
    for locale, text in zip(locales, cells[1:]):
        text = text.replace('\\n', '\n')
        parts = []
        if index == 5:
            parts = [dict(ref=0, text=text), dict(ref=1)]
        else:
            for piece in re.split(r'(\{name[01]\})', text):
                if not piece: continue
                if re.fullmatch(r'\{name[01]\}', piece):
                    field = int(piece[-2])
                    ref = next(i for i,p in enumerate(original) if p.get('name') == field)
                    parts.append(dict(ref=ref))
                else: parts.append(dict(text=piece))
        results[locale]['rich'][entry['key']] = dict(source=entry['source'], parts=parts, status='draft')
if seen != set(range(len(source))): raise ValueError(f'Missing prologue passages: {set(range(len(source))) - seen}')
for locale, catalog in results.items():
    Path(f'localization/story/{locale}.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
print(f'Imported {len(source)} complete passages for {", ".join(locales)} (draft; review pending).')
