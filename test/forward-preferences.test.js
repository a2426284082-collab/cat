import test from 'node:test';
import assert from 'node:assert/strict';
import {readSharePreferences,saveSharePreferences,shareExpiryDays,DEFAULT_SHARE_PREFERENCES} from '../src/forward/preferences.js';
function memoryStorage(){const m=new Map();return {getItem:key=>m.get(key)||null,setItem:(key,value)=>m.set(key,value),keys:()=>[...m.keys()],values:()=>[...m.values()]};}
test('share default preferences are saved per sales account, no customer identity or individual cat quote',()=>{
 const storage=memoryStorage();
 assert.deepEqual(readSharePreferences(11,storage),DEFAULT_SHARE_PREFERENCES);
 const saved=saveSharePreferences(11,{note:'可以慢慢看这几只小猫。',days:14,customer_name:'不能保存',cat_price:2400},storage);
 assert.deepEqual(saved,{note:'可以慢慢看这几只小猫。',days:14});
 assert.deepEqual(readSharePreferences(11,storage),saved);
 assert.deepEqual(readSharePreferences(12,storage),DEFAULT_SHARE_PREFERENCES);
 assert.doesNotMatch(storage.values()[0],/customer_name|cat_price|2400/);
});
test('malformed legacy defaults are handled safely',()=>{
 const storage=memoryStorage();
 saveSharePreferences(2,{note:'X'.repeat(600),days:45},storage);
 assert.equal(readSharePreferences(2,storage).note.length,500);
 assert.equal(readSharePreferences(2,storage).days,7);
 assert.throws(()=>saveSharePreferences('',{},storage));
});
test('saved quote validity stores duration, not a stale absolute date',()=>{
 assert.equal(shareExpiryDays('2026-11-07','2026-10-30'),8);
 assert.equal(shareExpiryDays('2026-10-30','2026-10-30'),0);
 assert.throws(()=>shareExpiryDays('2026-12-01','2026-10-30'));
 assert.throws(()=>shareExpiryDays('2026-10-29','2026-10-30'));
});
