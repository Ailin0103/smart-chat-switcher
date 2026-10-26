const $ = s => document.querySelector(s);
let projects = [];
function draw() {
  $('#projects').replaceChildren();
  for (const p of projects) {
    const card = document.createElement('section'); card.className = 'card';
    const row = document.createElement('div'); row.className = 'row';
    const title = document.createElement('h2'); title.textContent = p.name || 'New destination';
    const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.onclick = () => {projects = projects.filter(x => x !== p); draw();};
    row.append(title, remove); card.append(row);
    for (const [key, caption, type] of [['active', 'Active', 'checkbox'], ['name', 'Name', 'text'], ['url', 'ChatGPT conversation or Project URL', 'url'], ['keywords', 'Keywords / phrases (comma-separated)', 'text']]) {
      const label = document.createElement('label'); label.textContent = caption;
      const input = document.createElement('input'); input.type = type;
      if (type === 'checkbox') input.checked = p[key]; else input.value = key === 'keywords' ? p[key].join(', ') : p[key];
      if (key === 'url') input.placeholder = 'https://chatgpt.com/c/…';
      input.oninput = () => {p[key] = type === 'checkbox' ? input.checked : key === 'keywords' ? input.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) : input.value.trim(); if (key === 'name') title.textContent = p.name;};
      label.append(input); card.append(label);
    }
    $('#projects').append(card);
  }
}
function collect() {
  for (const p of projects) {
    if (!p.name) throw Error('Every destination needs a name.');
    if (p.url && !SCR.safeURL(p.url)) throw Error(p.name + ': paste a ChatGPT conversation or Project URL without query parameters or a fragment.');
    if (p.keywords.length > 50) throw Error('Use at most 50 keywords per destination.');
  }
  return {projects, ...Object.fromEntries(['enabled','autoRoute','includeContext'].map(k => [k, $('#' + k).checked]))};
}
$('#add').onclick = () => {projects.push({id: crypto.randomUUID(), name: '', url: '', keywords: [], active: true}); draw();};
$('#save').onclick = async () => {
  try {await chrome.storage.local.set({settings: collect()}); $('#status').textContent = 'Saved. Destinations without URLs remain unconfigured.';} catch (e) {$('#status').textContent = e.message;}
};
$('#classify').onclick = () => {
  try {const r = SCR.classify($('#test').value, collect().projects, ''); $('#result').textContent = r.level === 'low' ? 'Low — stay here' : `${r.level === 'high' ? 'High' : 'Medium'} — ${r.project.name} · ${r.hits.join(', ') || 'Name match'}`;} catch (e) {$('#result').textContent = e.message;}
};
(async () => {const {settings = SCR.defaults} = await chrome.storage.local.get('settings'); projects = structuredClone(settings.projects); for (const k of ['enabled','autoRoute','includeContext']) $('#' + k).checked = settings[k]; draw();})();
