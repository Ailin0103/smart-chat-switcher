const $ = s => document.querySelector(s);
let projects = [];
let validatedImport = null;
function currentRegistryProjects() {
  return projects.filter(project => project.id && project.name.trim()).map(project => ({...project, keywords:[...project.keywords]}));
}
function refreshActivationPrompt() {
  const prompt = $('#activation-prompt');
  if (prompt) prompt.value = SCR.createActivationPrompt();
}
function draw() {
  $('#projects').replaceChildren();
  for (const p of projects) {
    const card = document.createElement('section'); card.className = 'card';
    const row = document.createElement('div'); row.className = 'row';
    const title = document.createElement('h2'); title.textContent = p.name || 'New destination';
    const remove = document.createElement('button'); remove.textContent = 'Remove'; remove.onclick = () => {projects = projects.filter(x => x !== p); draw();};
    row.append(title, remove); card.append(row);
    for (const [key, caption, type] of [['active', 'Active', 'checkbox'], ['name', 'Name', 'text'], ['purpose', 'Purpose', 'textarea'], ['discoveryStatus', 'Discovery status', 'select'], ['discoveryBasis', 'Basis', 'textarea'], ['url', 'ChatGPT conversation or Project URL', 'url'], ['keywords', 'Supporting keywords (comma-separated)', 'text']]) {
      const label = document.createElement('label'); label.textContent = caption;
      const input = type === 'textarea' ? document.createElement('textarea') : type === 'select' ? document.createElement('select') : document.createElement('input');
      if (type === 'select') {
        for (const value of ['confirmed','needs_confirmation']) {const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}
        input.value = p.discoveryStatus || (p.url ? 'confirmed' : 'needs_confirmation');
      } else if (type !== 'textarea') input.type = type;
      if (type === 'checkbox') input.checked = p[key]; else input.value = key === 'keywords' ? p[key].join(', ') : p[key];
      if (type === 'select') input.value = p.discoveryStatus || (p.url ? 'confirmed' : 'needs_confirmation');
      if (key === 'url') input.placeholder = 'https://chatgpt.com/c/…';
      input.oninput = () => {
        p[key] = type === 'checkbox' ? input.checked : key === 'keywords' ? input.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) : input.value.trim();
        if (key === 'discoveryStatus' && p.discoveryStatus === 'needs_confirmation') {
          p.active = false;
          draw();
          return;
        }
        if (key === 'name') title.textContent = p.name;
        validatedImport = null;
        $('#apply-registry').disabled = true;
        refreshActivationPrompt();
      };
      label.append(input); card.append(label);
    }
    $('#projects').append(card);
  }
  refreshActivationPrompt();
}
function collect() {
  for (const p of projects) {
    if (!p.name) throw Error('Every destination needs a name.');
    if (p.url && !SCR.safeURL(p.url)) throw Error(p.name + ': paste a ChatGPT conversation or Project URL without query parameters or a fragment.');
    if (p.keywords.length > 50) throw Error('Use at most 50 keywords per destination.');
    if ((p.purpose || '').length > 500 || p.keywords.some(keyword => keyword.length > 100)) throw Error(p.name + ': purpose or keyword is too long.');
  }
  return {configVersion:SCR.protocol.configVersion,projects, ...Object.fromEntries(['enabled','includeContext'].map(k => [k, $('#' + k).checked]))};
}
$('#add').onclick = () => {projects.push({id: crypto.randomUUID(), name: '', purpose:'', url: '', keywords: [], discoveryStatus:'needs_confirmation', discoveryBasis:'', active:false}); draw();};
$('#save').onclick = async () => {
  try {await chrome.storage.local.set({settings: collect()}); $('#status').textContent = 'Saved. Destinations without URLs remain unconfigured.';} catch (e) {$('#status').textContent = e.message;}
};
$('#classify').onclick = () => {
  try {const r = SCR.classify($('#test').value, collect().projects, ''); $('#result').textContent = r.level === 'low' ? 'Low — stay here' : `${r.level === 'high' ? 'High' : 'Medium'} — ${r.project.name} · ${r.hits.join(', ') || 'Name match'}`;} catch (e) {$('#result').textContent = e.message;}
};
$('#copy-activation').onclick = async () => {
  refreshActivationPrompt();
  try {
    await navigator.clipboard.writeText($('#activation-prompt').value);
    $('#prompt-status').textContent = 'Discovery prompt copied.';
  } catch {
    $('#activation-prompt').focus(); $('#activation-prompt').select();
    $('#prompt-status').textContent = 'Select and copy the prompt above.';
  }
};
$('#validate-registry').onclick = () => {
  try {
    validatedImport = SCR.validateRegistryImport($('#registry-import').value, currentRegistryProjects());
    $('#registry-preview').replaceChildren();
    if (!validatedImport.hasUpdates) {
      for (const limitation of validatedImport.limitations) {const row=document.createElement('p');row.textContent=limitation;$('#registry-preview').append(row);}
      $('#apply-registry').disabled = true;
      $('#registry-status').textContent = 'No Projects were identified. No settings have changed.';
      return;
    }
    for (const project of validatedImport.projects) {
      const row = document.createElement('p');
      row.textContent = project.name + ' — ' + project.purpose + ' · Status: ' + project.discoveryStatus + ' · URL: ' + (project.url || 'not verified; routing unavailable') + ' · Keywords: ' + project.keywords.join(', ') + ' · Basis: ' + project.discoveryBasis;
      $('#registry-preview').append(row);
    }
    for (const limitation of validatedImport.limitations) {const row=document.createElement('small');row.textContent='Limitation: '+limitation;$('#registry-preview').append(row);}
    $('#apply-registry').disabled = false;
    $('#registry-status').textContent = 'Valid. Review names, status, purpose, keywords, and URL suggestions before applying.';
  } catch (error) {
    validatedImport = null;
    $('#apply-registry').disabled = true;
    $('#registry-preview').replaceChildren();
    $('#registry-status').textContent = error.message;
  }
};
$('#apply-registry').onclick = () => {
  if (!validatedImport?.hasUpdates) return;
  projects = validatedImport.projects;
  validatedImport = null;
  $('#apply-registry').disabled = true;
  $('#registry-preview').replaceChildren();
  $('#registry-status').textContent = 'Updates applied to the editor only. Review them and click Save settings to store.';
  draw();
};
$('#registry-import').addEventListener('input', () => {validatedImport = null; $('#apply-registry').disabled = true;});
chrome.storage.onChanged.addListener((changes, area) => {if (area === 'local' && changes.settings) {projects = structuredClone(SCR.migrateSettings(changes.settings.newValue).projects); draw();}});
(async () => {
  const {settings:stored} = await chrome.storage.local.get('settings');
  const settings = SCR.migrateSettings(stored);
  projects = structuredClone(settings.projects);
  for (const key of ['enabled','includeContext']) $('#' + key).checked = settings[key];
  draw();
  if (JSON.stringify(stored) !== JSON.stringify(settings)) await chrome.storage.local.set({settings});
})();
