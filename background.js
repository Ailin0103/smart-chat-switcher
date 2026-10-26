importScripts('core.js');
const PREFIX = 'handoff:';
const TTL = 30 * 60 * 1000;
chrome.runtime.onInstalled.addListener(async () => {
  const {settings} = await chrome.storage.local.get('settings');
  if (!settings) await chrome.storage.local.set({settings: SCR.defaults});
});
chrome.tabs.onRemoved.addListener(id => chrome.storage.session.remove(PREFIX + id));
async function handle(m, sender) {
  if (!sender.tab || !sender.url?.startsWith('https://chatgpt.com/')) throw Error('Unsupported sender');
  const key = PREFIX + sender.tab.id;
  if (m.type === 'route') {
    const {settings = SCR.defaults} = await chrome.storage.local.get('settings');
    const project = settings.projects.find(p => p.id === m.projectId && p.active);
    const url = SCR.safeURL(project?.url);
    if (!settings.enabled || !url || typeof m.text !== 'string' || m.text.length > 30000) throw Error('Invalid route or oversized handoff');
    // Store before navigating, so document_start cannot race the handoff write.
    const tab = await chrome.tabs.create({url: 'about:blank', active: false, openerTabId: sender.tab.id});
    try {
      await chrome.storage.session.set({[PREFIX + tab.id]: {text: m.text, project: project.name, url, sourceId: sender.tab.id, created: Date.now()}});
      await chrome.tabs.update(tab.id, {url, active: true});
      return {ok: true};
    } catch (e) { await chrome.tabs.remove(tab.id); throw e; }
  }
  const record = (await chrome.storage.session.get(key))[key];
  if (record && Date.now() - record.created > TTL) { await chrome.storage.session.remove(key); return {ok: true}; }
  if (m.type === 'get') return {ok: true, record: record && SCR.safeURL(sender.url) === record.url ? record : undefined};
  if (m.type === 'clear') { await chrome.storage.session.remove(key); return {ok: true}; }
  if (m.type === 'undo' && record) {
    // Only close our destination after successfully restoring the original tab.
    await chrome.tabs.update(record.sourceId, {active: true});
    await chrome.tabs.remove(sender.tab.id);
    return {ok: true};
  }
  return {ok: false, error: 'Original handoff is no longer available.'};
}
chrome.runtime.onMessage.addListener((m, sender, respond) => {
  handle(m, sender).then(respond, e => respond({ok: false, error: e.message}));
  return true;
});
