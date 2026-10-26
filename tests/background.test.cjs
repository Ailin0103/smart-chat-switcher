const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const SCR = require('../core.js');
function setup({failUpdate = false, settings = {...SCR.defaults, projects:[{id:'job', name:'Job', active:true, url:'https://chatgpt.com/c/job'}]}} = {}) {
  let listener, removed; const records = {}, actions = [];
  const chrome = {
    runtime: {onInstalled:{addListener(){}}, onMessage:{addListener(fn){listener=fn;}}},
    storage: {local:{async get(){return {settings};}}, session:{async get(key){return {[key]:records[key]};},async set(obj){Object.assign(records,obj);},async remove(key){delete records[key];}}},
    tabs:{onRemoved:{addListener(fn){removed=fn;}}, async create(args){actions.push(['create',args]);return {id:2};}, async update(id,args){actions.push(['update',id,args]);if(failUpdate)throw Error('Tab missing');},async remove(id){actions.push(['remove',id]);removed(id);}}
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../background.js'),'utf8'), {chrome, SCR, importScripts(){}, Date});
  const send = (message, tab=1, url='https://chatgpt.com/c/source') => new Promise(resolve => listener(message,{tab:{id:tab},url},resolve));
  return {send, records, actions};
}
test('handoff scoped to destination tab and URL, undo restores source', async () => {
  const s=setup(); assert.equal((await s.send({type:'route',projectId:'job',text:'draft'})).ok,true);
  assert.equal((await s.send({type:'get'})).record,undefined);
  assert.equal((await s.send({type:'get'},2,'https://chatgpt.com/c/other')).record,undefined);
  assert.equal((await s.send({type:'get'},2,'https://chatgpt.com/c/job')).record.text,'draft');
  await s.send({type:'undo'},2,'https://chatgpt.com/c/job');
  assert.deepEqual(s.actions.slice(-2).map(x=>x.slice(0,2)),[['update',1],['remove',2]]);
  assert.equal(s.records['handoff:2'],undefined);
});
test('invalid destination, sender and excessive text are rejected',async()=>{
  const s=setup();
  assert.equal((await s.send({type:'route',projectId:'unknown',text:'a'})).ok,false);
  assert.equal((await s.send({type:'route',projectId:'job',text:'x'.repeat(30001)})).ok,false);
  assert.equal((await s.send({type:'get'},1,'https://evil.test/')).ok,false);
  assert.equal(s.actions.length,0);
});
test('failed route cleans new tab and expired handoffs are discarded',async()=>{
  const s=setup({failUpdate:true});
  assert.equal((await s.send({type:'route',projectId:'job',text:'draft'})).ok,false);
  assert.equal(s.records['handoff:2'],undefined);
  const a=setup(); a.records['handoff:1']={created:0};
  assert.equal((await a.send({type:'get'})).record,undefined);
  assert.equal(a.records['handoff:1'],undefined);
});
