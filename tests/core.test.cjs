const {test} = require('node:test');
const assert = require('node:assert/strict');
const {defaults, safeURL, classify, createReferenceHandoff, suggestKeywords} = require('../core.js');
const list = [{id:'job',name:'Job Search',purpose:'Career applications',keywords:['resume','cover letter','job search','interview'],url:'https://chatgpt.com/c/job',active:true},{id:'paper',name:'Paper 2',purpose:'Academic research',keywords:['paper 2','random matrix','lyapunov','non-adherence'],url:'https://chatgpt.com/c/paper',active:true},{id:'codon',name:'CodonBERT',purpose:'Protein language model research',keywords:['codonbert','codon','protein','tokenization'],url:'https://chatgpt.com/c/codon',active:true},{id:'thesis',name:'Dissertation',purpose:'Dissertation work',keywords:['dissertation','thesis','defense'],url:'https://chatgpt.com/c/thesis',active:true}];
test('high, medium and low English routing', () => {
  assert.equal(classify('resume and interview', list).level, 'high');
  assert.equal(classify('resume please', list).level, 'medium');
  assert.equal(classify('What is the weather?', list).level, 'low');
  assert.equal(classify('resume and interview', list).project.id, 'job');
  assert.equal(classify('CodonBERT training', list).level, 'high');
});
test('multilingual Project keywords match messages in the user language', () => {
  const bilingual = {...list[0], keywords:['resume','CV','简历','求职材料']};
  assert.equal(classify('帮我修改简历', [bilingual], 'https://chatgpt.com/c/other').level, 'medium');
  assert.equal(classify('Could you review my CV?', [bilingual], 'https://chatgpt.com/c/other').level, 'medium');
});
test('ambiguity downgrades; current context stays; inactive/unconfigured ignored', () => {
  assert.equal(classify('resume for my dissertation', list).level, 'medium');
  assert.equal(classify('resume interview', list, list[0].url).level, 'low');
  assert.equal(classify('resume interview', [{...list[0], active:false}]).level, 'low');
  assert.equal(classify('resume interview', defaults.projects).level, 'low');
});
test('word boundaries, duplicate keyword resistance and URL validation', () => {
  assert.equal(classify('proteins and codons', list).level, 'low');
  assert.equal(classify('resume', [{...list[0], keywords:['resume','Resume']}]).level, 'medium');
  for (const url of ['javascript:alert(1)', 'https://chatgpt.com.evil/c/x', 'http://chatgpt.com/c/x', 'https://chatgpt.com/', 'https://chatgpt.com/c/x?q=secret', 'https://user@chatgpt.com/c/x']) assert.equal(safeURL(url), null);
  assert.equal(safeURL('https://chatgpt.com/g/g-p-abc/project'), 'https://chatgpt.com/g/g-p-abc/project');
});
test('reference handoff contains only English title instruction and exact request, never URL, ID, or history', () => {
  const request = '  Review this resume\nkeep exact whitespace  ';
  const source = {url:'https://chatgpt.com/c/source-123', title:'Resume planning', conversation_id:'source-123'};
  const destination = {project_id:'job', project:'Job Search', url:'https://chatgpt.com/c/job', conversation_id:'job'};
  const pkg = createReferenceHandoff({id:'handoff-1', currentRequest:request, source, destination});
  assert.equal(pkg.current_request, request);
  assert.equal(pkg.source.title, 'Resume planning');
  assert.equal(pkg.source.conversation_id, 'source-123');
  assert.equal(pkg.destination.project, 'Job Search');
  assert.ok(pkg.text.includes('Source conversation: "Resume planning"'));
  assert.ok(!pkg.text.includes('https://chatgpt.com'));
  assert.ok(!pkg.text.includes('source-123'));
  assert.ok(pkg.text.endsWith('Current request:\n' + request));
  assert.ok(pkg.text.includes('If you cannot identify or access it, say so and ask me for the necessary context. Do not fabricate its contents.'));
  assert.ok(!pkg.text.includes('private historical message'));
  assert.ok(!('handoff_summary' in pkg));
  assert.ok(!/USER:|ASSISTANT:|Context excerpts/.test(pkg.text));
});
test('missing source title falls back to request only and oversized request rejected', () => {
  const pkg = createReferenceHandoff({id:'handoff-2',currentRequest:'verbatim',source:{url:'https://chatgpt.com/c/private-id'},destination:{},referenceEnabled:true});
  assert.equal(pkg.text, 'Current request:\nverbatim');
  assert.ok(!pkg.text.includes('private-id'));
  assert.throws(() => createReferenceHandoff({currentRequest:'x'.repeat(30001),source:{},destination:{}}), /too large/);
});
test('discovery prompt asks ChatGPT to identify recurring work and returns JSON only', () => {
  const prompt = SCR.createActivationPrompt([list[0]], [{name:'Job Searching',url:'https://chatgpt.com/g/g-p-job/project'}]);
  assert.ok(prompt.includes('Please identify my recurring projects and workstreams from the conversation context, saved memory'));
  assert.ok(prompt.includes('Do not ask me to prepare a Project list first.'));
  assert.ok(prompt.includes('If I use more than one language, include natural keywords in each relevant language'));
  assert.ok(prompt.includes('the actual terms, synonyms, and informal phrases I use'));
  assert.ok(prompt.includes('"简历"'));
  assert.ok(prompt.includes('"schema": "scr-project-discovery-v1"'));
  assert.ok(prompt.includes('"supporting_keywords": ["<relevant keyword or phrase>"]'));
  assert.ok(prompt.includes('"status": "confirmed"'));
  assert.ok(prompt.includes('"limitations": []'));
  assert.ok(prompt.includes('If you have no usable information about my projects, return an empty projects array'));
  assert.ok(prompt.includes('Do not update memory or activate routing yet.'));
  assert.ok(prompt.includes('Output JSON only, without Markdown fences or additional commentary.'));
  assert.ok(!/Job Search|Paper 2|Please update your saved memory|```scr-route/.test(prompt));
});
test('registry import updates a matching configured Project without replacing its URL or active state', () => {
  const current = [{id:'job',name:'Job Search',purpose:'Old purpose',url:'https://chatgpt.com/g/g-p-job/project',keywords:['old'],active:true}];
  const imported = {schema:'scr-project-discovery-v1',limitations:[],projects:[{name:'Job Search',purpose:'Career applications',supporting_keywords:['resume','interview'],url:'',status:'confirmed',basis:'The saved context identifies this Project.'}]};
  const updated = SCR.validateRegistryImport(imported,current);
  assert.equal(updated.projects[0].purpose,'Career applications');
  assert.deepEqual(updated.projects[0].keywords,['resume','interview']);
  assert.equal(updated.projects[0].url,current[0].url);
  assert.equal(updated.projects[0].active,true);
  assert.throws(()=>SCR.validateRegistryImport({...imported,schema:'old-schema'},current),/scr-project-discovery-v1/);
  assert.throws(()=>SCR.validateRegistryImport({...imported,projects:[{...imported.projects[0],project_id:'unknown'}]},current),/exactly name, purpose/);
  assert.throws(()=>SCR.validateRegistryImport({...imported,projects:[{...imported.projects[0],url:'https://chatgpt.com/c/x'}]},current),/Invalid ChatGPT Project URL/);
  assert.throws(()=>SCR.validateRegistryImport({...imported,projects:[{...imported.projects[0],url:'https://chatgpt.com/g/g-p-other/project'}]},current),/conflicts with the configured URL/);
});
test('route parser accepts exact current protocol only', () => {
  const projects = [list[0]];
  const valid = '```scr-route\n{"schema":1,"protocol_token":"scr-route","config_version":"1.2","project_id":"job","reason":"The task purpose shifted to job applications."}\n```';
  const parsed = SCR.parseRouteSuggestion(valid,projects);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.project.id,'job');
  assert.equal(SCR.parseRouteSuggestion(valid.replace('"protocol_token":"scr-route"','"protocol_token":"old-token"'),projects,'1.2').ok,false);
  assert.equal(SCR.parseRouteSuggestion(valid.replace('"project_id":"job"','"project_id":"unknown"'),projects,'1.2').ok,false);
  assert.equal(SCR.parseRouteSuggestion(valid.replace('"reason":', '"handoff_summary":"x","reason":'),projects).ok,false);
});
test('project names produce editable keyword suggestions without saving settings', () => {
  const before=JSON.stringify(defaults.projects);
  assert.deepEqual(defaults.projects,[]);
  const job=suggestKeywords('Job Searching');
  assert.ok(job.includes('resume'));
  assert.ok(job.includes('interview'));
  const paper=suggestKeywords('Paper 2');
  assert.ok(paper.includes('literature review'));
  const unknown=suggestKeywords('My New Space');
  assert.deepEqual(unknown,['New','Space']);
  assert.deepEqual(suggestKeywords('项目名称'),[]);
  assert.equal(JSON.stringify(defaults.projects),before);
});
test('settings migration preserves IDs, names, descriptions, URLs and old local config', () => {
  const migrated=SCR.migrateSettings({enabled:false,autoRoute:true,projects:[{id:'custom',name:'项目 A',purpose:'用户原文',url:'https://chatgpt.com/c/custom',keywords:['custom'],active:true}]});
  assert.equal(migrated.enabled,false);
  assert.equal(migrated.autoRoute,false);
  assert.equal(migrated.projects[0].id,'custom');
  assert.equal(migrated.projects[0].name,'项目 A');
  assert.equal(migrated.projects[0].purpose,'用户原文');
  assert.equal(migrated.projects[0].url,'https://chatgpt.com/c/custom');
  assert.equal(migrated.configVersion,'1.2');
  assert.equal(SCR.defaults.autoRoute,false);
});
test('default registry has no preset Projects and migration removes only untouched legacy placeholders', () => {
  assert.deepEqual(defaults.projects,[]);
  const migrated=SCR.migrateSettings({projects:[
    {id:'job',name:'Job Search',purpose:'Career applications and resume work.',url:'',keywords:['resume','cover letter','job search','interview'],active:true},
    {id:'custom',name:'Research Project',purpose:'Custom purpose',url:'https://chatgpt.com/g/g-custom/project',keywords:['custom'],active:true},
    {id:'paper',name:'Paper 2',purpose:'My edited purpose',url:'',keywords:['paper 2','random matrix','lyapunov','non-adherence'],active:true}
  ]});
  assert.deepEqual(migrated.projects.map(project=>project.id),['custom','paper']);
  assert.equal(migrated.projects[1].purpose,'My edited purpose');
});
test('discovery import retains inactive drafts, validates supplied URLs, and handles empty results', () => {
  const proposal={schema:'scr-project-discovery-v1',limitations:[],projects:[{name:'Research Space',purpose:'Recent work on studies',supporting_keywords:['research','paper'],url:'',status:'confirmed',basis:'Found in recent saved context.'}]};
  const imported=SCR.validateRegistryImport(proposal,[]);
  assert.equal(imported.hasUpdates,true);
  assert.equal(imported.projects.length,1);
  assert.ok(imported.projects[0].id);
  assert.equal(imported.projects[0].name,'Research Space');
  assert.equal(imported.projects[0].url,'');
  assert.equal(imported.projects[0].purpose,proposal.projects[0].purpose);
  assert.deepEqual(imported.projects[0].keywords,proposal.projects[0].supporting_keywords);
  assert.equal(imported.projects[0].active,false,'newly discovered projects need explicit user activation');
  const uncertain=SCR.validateRegistryImport({schema:'scr-project-discovery-v1',limitations:[],projects:[{...proposal.projects[0],status:'needs_confirmation',url:''}]},[]);
  assert.equal(uncertain.projects[0].url,'');
  assert.equal(uncertain.projects[0].active,false);
  const withURL=SCR.validateRegistryImport({schema:'scr-project-discovery-v1',limitations:[],projects:[{...proposal.projects[0],url:'https://chatgpt.com/g/g-p-research/project'}]},[]);
  assert.equal(withURL.projects[0].url,'https://chatgpt.com/g/g-p-research/project');
  assert.equal(withURL.projects[0].active,false);
  assert.equal(SCR.classify('research paper',withURL.projects).level,'low');
  const empty=SCR.validateRegistryImport({schema:'scr-project-discovery-v1',projects:[],limitations:['No project context available.']},[]);
  assert.equal(empty.hasUpdates,false);
  assert.equal(empty.projects.length,0);
});
test('empty default discovery prompt has no preset Projects or memory activation', () => {
  const prompt=SCR.createActivationPrompt(defaults.projects);
  assert.deepEqual(defaults.projects,[]);
  assert.ok(prompt.includes('Please identify my recurring projects and workstreams'));
  assert.ok(prompt.includes('"projects": ['));
  assert.ok(!prompt.includes('Job Search'));
  assert.ok(!prompt.includes('Paper 2'));
  assert.ok(!prompt.includes('Please update your saved memory'));
  assert.ok(prompt.includes('Do not update memory or activate routing yet.'));
});
