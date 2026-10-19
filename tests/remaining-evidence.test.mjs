import test from 'node:test';
import assert from 'node:assert/strict';
import {visibleEvidence} from '../src/game/evidenceText.ts';
test('remaining image captions follow visible layers, disappear in logic, preserve clue reveal timing',()=>{
 const state={chapterEntry:70001,mode:'page',logicVisible:false,sprites:{0:{asset:3005,alpha:0},1:{asset:3030,alpha:1}}};
 assert.deepEqual(visibleEvidence(state),['纸箱里放着事件资料档案；旧档案题名为“狗山女校神隐事件”，新档案为“人为编造的都市传说”。']);
 state.sprites[0].alpha=1;assert.ok(visibleEvidence(state).includes('墙上的字：你明天再来。'));
 state.mode='logic';assert.deepEqual(visibleEvidence(state),[]);
 state.mode='page';state.logicVisible=true;assert.deepEqual(visibleEvidence(state),[]);
});
