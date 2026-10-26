const {test} = require('node:test');
const assert = require('node:assert/strict');
const {defaults, safeURL, classify, handoff} = require('../core.js');
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
test('context bounded, current message preserved, context can be disabled', () => {
  const text = handoff('my request', ['old', ...Array(3).fill('x'.repeat(600))], 'source', true);
  assert.ok(!text.includes('old')); assert.equal(text.split('\n').filter(line => /^x+$/.test(line)).join('').length, 900);
  assert.ok(text.endsWith('Current request:\nmy request'));
  assert.equal(handoff('hello', ['private'], 'source', false), 'Current request:\nhello');
});
