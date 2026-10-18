"""Import numbered, human-authored UI translation batches with structural checks."""
import json
import re
import sys
from pathlib import Path

keys = json.loads(Path('localization/ui-batches/keys.json').read_text())
path = Path(sys.argv[1])
lines = path.read_text().splitlines()
locales = lines[0].split('|')[1:]
results = {locale: {} for locale in locales}
seen = set()
for line in lines[1:]:
    if not line.strip():
        continue
    cells = line.split('|')
    index = int(cells[0])
    if index in seen or not 0 <= index < len(keys) or len(cells) != len(locales) + 1:
        raise ValueError(f'Invalid batch row: {index}')
    seen.add(index)
    key = keys[index]
    expected = sorted(re.findall(r'\{\w+\}', key))
    for locale, value in zip(locales, cells[1:]):
        if not value.strip() or sorted(re.findall(r'\{\w+\}', value)) != expected:
            raise ValueError(f'Invalid translation/placeholders: {locale}:{index}')
        results[locale][key] = value
if seen != set(range(len(keys))):
    raise ValueError(f'Missing rows: {set(range(len(keys))) - seen}')
for locale, entries in results.items():
    target = Path(f'localization/ui/{locale}.json')
    existing = json.loads(target.read_text()) if target.exists() else {}
    target.write_text(json.dumps({**existing, **entries}, ensure_ascii=False, indent=2) + '\n')
print(f'Imported {len(keys)} entries each for {", ".join(locales)}')
