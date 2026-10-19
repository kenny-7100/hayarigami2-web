import fs from 'node:fs';
import { createHash } from 'node:crypto';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function stampCorpus(file, gameFile = 'public/game/game.json') {
 const gameBytes = fs.readFileSync(gameFile);
 const game = JSON.parse(gameBytes);
 const manifest = { version: 1, gameSha256: sha256(gameBytes), sourceSha256: game.sourceSha256, corpusSha256: sha256(fs.readFileSync(file)) };
 fs.writeFileSync(`${file}.manifest.json`, JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
export function verifyCorpus(bytes, gameBytes, manifest) {
 if(manifest?.version !== 1 || manifest.gameSha256 !== sha256(gameBytes) || manifest.corpusSha256 !== sha256(bytes) || manifest.sourceSha256 !== JSON.parse(gameBytes).sourceSha256) throw new Error('Corpus provenance is stale or absent; run npm run i18n:extract');
}
