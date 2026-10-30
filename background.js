importScripts('core.js');
const PREFIX = 'handoff:';
const TTL = 30 * 60 * 1000;
chrome.runtime.onInstalled.addListener(async () => {
  const sessionItems = await chrome.storage.session.get(null);
  const oldContextKeys = Object.keys(sessionItems).filter(key => key.startsWith('context:'));
  if (oldContextKeys.length) await chrome.storage.session.remove(oldContextKeys);
  const {settings} = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({settings: SCR.migrateSettings(settings)});
});
chrome.tabs.onRemoved.addListener(id => chrome.storage.session.remove(PREFIX + id));
function conversationId(url) { return url.match(/\/c\/([\w-]+)/)?.[1] || null; }
async function handle(m, sender) {
  if (!sender.tab || !sender.url?.startsWith('https://chatgpt.com/')) throw Error('Unsupported sender');
  const key = PREFIX + sender.tab.id;
  if (m.type === 'route') {
    const stored = await chrome.storage.local.get('settings');
    const settings = SCR.migrateSettings(stored.settings);
    if (JSON.stringify(stored.settings) !== JSON.stringify(settings)) await chrome.storage.local.set({settings});
    const project = settings.projects.find(p => p.id === m.projectId && p.active);
    const url = SCR.safeURL(project?.url);
    if (!settings.enabled || !url || typeof m.currentRequest !== 'string') throw Error('Invalid route');
    const id = globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2);
    const sourceUrl = new URL(sender.url);
    const handoff = SCR.createReferenceHandoff({
      id,
      currentRequest: m.currentRequest,
      referenceEnabled: settings.includeContext,
      source: {
        url: sourceUrl.origin + sourceUrl.pathname,
        title: typeof m.sourceTitle === 'string' ? m.sourceTitle.slice(0, 500) : '',
        conversation_id: conversationId(sender.url),
      },
      destination: {project_id: project.id, project: project.name, url, conversation_id: conversationId(url)}
    });
    // Store before navigating, so document_start cannot race the handoff write.
    const tab = await chrome.tabs.create({url: 'about:blank', active: false, openerTabId: sender.tab.id});
    try {
      await chrome.storage.session.set({[PREFIX + tab.id]: {...handoff, project: project.name, url, sourceId: sender.tab.id, created: Date.now()}});
      await chrome.tabs.update(tab.id, {url, active: true});
      return {ok: true, handoff};
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
