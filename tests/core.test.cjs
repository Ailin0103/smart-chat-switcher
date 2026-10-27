const {test} = require('node:test');
const assert = require('node:assert/strict');
const {defaults, safeURL, classify, createReferenceHandoff} = require('../core.js');
const list = defaults.projects.map(p => ({...p, url: 'https://chatgpt.com/c/' + p.id}));
test('high, medium, low and bilingual routing', () => {
  assert.equal(classify('resume and interview', list).level, 'high');
  assert.equal(classify('resume please', list).level, 'medium');
  assert.equal(classify('What is the weather?', list).level, 'low');
  assert.equal(classify('帮我改简历准备面试', list).project.id, 'job');
  assert.equal(classify('CodonBERT training', list).level, 'high');
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
test('reference handoff preserves source metadata and exact unsent request', () => {
  const request = '  我想看看简历\nkeep exact whitespace  ';
  const source = {url:'https://chatgpt.com/c/source-123', title:'Resume planning', conversation_id:'source-123'};
  const destination = {project_id:'job', project:'Job Search', url:'https://chatgpt.com/c/job', conversation_id:'job'};
  const pkg = createReferenceHandoff({id:'handoff-1', currentRequest:request, source, destination});
  assert.equal(pkg.current_request, request);
  assert.equal(pkg.source.title, 'Resume planning');
  assert.equal(pkg.source.conversation_id, 'source-123');
  assert.equal(pkg.destination.project, 'Job Search');
  assert.ok(pkg.text.includes('Title: Resume planning'));
  assert.ok(pkg.text.includes('URL: https://chatgpt.com/c/source-123'));
  assert.ok(pkg.text.includes('Conversation ID: source-123'));
  assert.ok(pkg.text.endsWith('Current request:\n' + request));
  assert.ok(pkg.text.includes('If you cannot access the source conversation'));
  assert.ok(!pkg.text.includes('private historical message'));
});
test('reference can be omitted and oversized request rejected without truncation', () => {
  const pkg = createReferenceHandoff({id:'handoff-2',currentRequest:'verbatim',source:{},destination:{},referenceEnabled:false});
  assert.equal(pkg.text, 'Current request:\nverbatim');
  assert.throws(() => createReferenceHandoff({currentRequest:'x'.repeat(30001),source:{},destination:{}}), /too large/);
});
test('reference package handles title-only, title-plus-ID and title-plus-URL', () => {
  const currentRequest='Continue this task';
  const titleOnly=createReferenceHandoff({currentRequest,source:{title:'Private topic'},destination:{}}).text;
  const titleAndId=createReferenceHandoff({currentRequest,source:{title:'Private topic',conversation_id:'conv-secret-42'},destination:{}}).text;
  const titleAndUrl=createReferenceHandoff({currentRequest,source:{title:'Private topic',url:'https://chatgpt.com/c/conv-secret-42'},destination:{}}).text;
  assert.match(titleOnly,/Title: Private topic/);
  assert.match(titleOnly,/URL: Unavailable/);
  assert.match(titleAndId,/Conversation ID: conv-secret-42/);
  assert.match(titleAndUrl,/URL: https:\/\/chatgpt\.com\/c\/conv-secret-42/);
  for (const text of [titleOnly,titleAndId,titleAndUrl]) assert.ok(text.endsWith('Current request:\n'+currentRequest));
});
