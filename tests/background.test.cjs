const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const {webcrypto} = require('node:crypto');
const SCR = require('../core.js');

function setup({failUpdate = false, settings = {...SCR.defaults, projects:[{id:'job', name:'Job', active:true, url:'https://chatgpt.com/c/job'}]}} = {}) {
  let listener, removed, nextTab = 2;
  const records = {}, actions = [];
  let installListener;
  const chrome = {
    runtime: {onInstalled:{addListener(fn){installListener=fn;}}, onMessage:{addListener(fn){listener=fn;}}},
    storage: {
      local:{async get(){return {settings};},async set(value){Object.assign(records,value);}},
      session:{async get(key){return key===null?{...records}:{[key]:records[key]};},async set(obj){Object.assign(records,obj);},async remove(keys){for(const key of Array.isArray(keys)?keys:[keys])delete records[key];}}
    },
    tabs:{
      onRemoved:{addListener(fn){removed=fn;}},
      async create(args){actions.push(['create',args]);return {id:nextTab++};},
      async update(id,args){actions.push(['update',id,args]);if(failUpdate)throw Error('Tab missing');},
      async remove(id){actions.push(['remove',id]);removed(id);}
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../background.js'),'utf8'), {chrome,SCR,importScripts(){},Date,URL,crypto:webcrypto,Math});
  const send = (message, tab=1, url='https://chatgpt.com/c/source-123') => new Promise(resolve => listener(message,{tab:{id:tab},url},resolve));
  return {send,records,actions,install:()=>installListener()};
}

test('reference package is stored before navigation and scoped to target tab and URL', async()=>{
  const s=setup();
  const result=await s.send({type:'route',projectId:'job',currentRequest:'  exact request\n',sourceTitle:'Source title'});
  assert.equal(result.ok,true);
  assert.equal(result.handoff.current_request,'  exact request\n');
  assert.equal(result.handoff.source.title,'Source title');
  assert.equal(result.handoff.source.conversation_id,'source-123');
  assert.equal(result.handoff.source.url,'https://chatgpt.com/c/source-123');
  assert.ok(result.handoff.id);
  assert.ok(result.handoff.text.endsWith('Current request:\n  exact request\n'));
  assert.ok(!result.handoff.text.includes('https://chatgpt.com'));
  assert.ok(!result.handoff.text.includes('source-123'));
  assert.ok(!('handoff_summary' in result.handoff));
  assert.ok(!result.handoff.text.includes('summary'));
  assert.equal(s.actions[0][0],'create');
  assert.equal(s.actions[1][0],'update');
  assert.equal((await s.send({type:'get'})).record,undefined);
  assert.equal((await s.send({type:'get'},2,'https://chatgpt.com/c/other')).record,undefined);
  const stored=(await s.send({type:'get'},2,'https://chatgpt.com/c/job')).record;
  assert.equal(stored.text,result.handoff.text);
  assert.equal(stored.destination.project,'Job');
});

test('parallel source tabs receive distinct reference packages',async()=>{
  const s=setup();
  const first=await s.send({type:'route',projectId:'job',currentRequest:'request one',sourceTitle:'Source one'},11,'https://chatgpt.com/c/one');
  const second=await s.send({type:'route',projectId:'job',currentRequest:'request two',sourceTitle:'Source two'},12,'https://chatgpt.com/c/two');
  assert.notEqual(first.handoff.id,second.handoff.id);
  const one=(await s.send({type:'get'},2,'https://chatgpt.com/c/job')).record;
  const two=(await s.send({type:'get'},3,'https://chatgpt.com/c/job')).record;
  assert.equal(one.current_request,'request one');
  assert.equal(one.source.title,'Source one');
  assert.equal(two.current_request,'request two');
  assert.equal(two.source.title,'Source two');
});

test('navigation failure removes incomplete package and keeps source tab untouched',async()=>{
  const s=setup({failUpdate:true});
  const result=await s.send({type:'route',projectId:'job',currentRequest:'unsent request',sourceTitle:'Source'});
  assert.equal(result.ok,false);
  assert.equal(s.records['handoff:2'],undefined);
  assert.deepEqual(s.actions.slice(-2).map(action=>action[0]),['update','remove']);
  assert.equal(s.actions.some(action=>action[0]==='update'&&action[1]===1),false);
});

test('invalid route, sender and oversized unsent request are rejected',async()=>{
  const s=setup();
  assert.equal((await s.send({type:'route',projectId:'unknown',currentRequest:'a'})).ok,false);
  assert.equal((await s.send({type:'route',projectId:'job',currentRequest:'x'.repeat(30001)})).ok,false);
  assert.equal((await s.send({type:'get'},1,'https://evil.test/')).ok,false);
  assert.equal(s.actions.length,0);
});

test('dismissal clears only the destination handoff; Undo restores source',async()=>{
  const s=setup();
  await s.send({type:'route',projectId:'job',currentRequest:'request'});
  await s.send({type:'undo'},2,'https://chatgpt.com/c/job');
  assert.deepEqual(s.actions.slice(-2).map(action=>action.slice(0,2)),[['update',1],['remove',2]]);
  assert.equal(s.records['handoff:2'],undefined);
});
test('upgrade clears legacy history buffers without changing local settings',async()=>{
  const s=setup();
  s.records['context:1']={messages:[{role:'user',content:'old private buffer'}]};
  await s.install();
  assert.equal(s.records['context:1'],undefined);
});
test('new install defaults to no Projects',async()=>{
  assert.equal(SCR.defaults.projects.length,0);
  assert.equal(SCR.migrateSettings(undefined).projects.length,0);
});
test('English UI onboarding is discovery-only and contains no memory activation step',async()=>{
  const fs=require('node:fs');
  const html=fs.readFileSync(require.resolve('../settings.html'),'utf8');
  const script=fs.readFileSync(require.resolve('../settings.js'),'utf8');
  const content=fs.readFileSync(require.resolve('../content.js'),'utf8');
  assert.match(html,/Project discovery prompt/);
  assert.match(html,/Copy Project discovery prompt/);
  assert.match(html,/edit the prompt after pasting it into ChatGPT/);
  assert.match(html,/keywords you use most/);
  assert.match(html,/id="activation-prompt"[^>]*readonly/);
  assert.match(html,/Review a discovery proposal/);
  assert.doesNotMatch(html,/memory update|finish setup|memory-status/i);
  assert.match(script,/Discovery prompt copied\./);
  assert.doesNotMatch(script,/memory-status|finish-setup|Memory is managed by ChatGPT/);
  assert.match(content,/Source conversation title \(optional\)/);
});
test('registry apply replaces the editor with validated existing and newly matched Projects',async()=>{
  const fs=require('node:fs');
  const script=fs.readFileSync(require.resolve('../settings.js'),'utf8');
  assert.match(script,/validatedImport = SCR\.validateRegistryImport\([\s\S]*currentRegistryProjects\(\)\)/);
  assert.doesNotMatch(script,/discoveredProjects|refresh-projects|requestProjectScan/);
  assert.match(script,/projects = validatedImport\.projects;/);
  assert.match(script,/Updates applied to the editor only\. Review them and click Save settings to store\./);
});