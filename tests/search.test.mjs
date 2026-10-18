import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch } from '../src/game/search.ts';
test('player lookup handles whitespace, full-width input, case and multiple search words', () => {
  assert.ok(matchesSearch('ＥＳＰ研究所', 'esp'));
  assert.ok(matchesSearch('ウィリアム・Ｈ・マムラー', 'ｈ'));
  assert.ok(matchesSearch('Spirit Photography', '  PHOTO spirit  '));
  assert.ok(matchesSearch('超能力 テレパシー', '超能力　テレパシー'));
  assert.ok(matchesSearch('اكتشاف الحقيقة', 'الحقيقة'));
  assert.ok(matchesSearch('anything', '  '));
  assert.equal(matchesSearch('超能力', '超能力 写真'), false);
});
