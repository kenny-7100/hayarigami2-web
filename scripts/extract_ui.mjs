import ts from 'typescript';
import fs from 'node:fs';
const files = ['src/App.tsx', 'src/game/LogicBoard.tsx', 'src/game/StoryText.tsx', 'src/game/storage.ts', 'src/i18n/LanguagePicker.tsx', 'src/i18n/GameLocaleProvider.tsx', 'src/components/GameConfirmation.tsx', 'src/components/SearchField.tsx'];
const entries = new Map();
for (const file of files) {
 const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 function visit(node) {
  if (ts.isStringLiteral(node) || ts.isJsxText(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
   const value = node.text.trim().replace(/\s+/g, ' ');
   if (/\p{Script=Han}/u.test(value)) entries.set(value, [...(entries.get(value) ?? []), file]);
  }
  ts.forEachChild(node, visit);
 }
 visit(source);
}
fs.writeFileSync('localization/ui/source.json', JSON.stringify(Object.fromEntries([...entries].sort()), null, 2) + '\n');
console.log([...entries.keys()].join('\n'));
