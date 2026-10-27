(() => {
  let settings = SCR.defaults, ready = false, busy = false, bypass = false, pending = null, destination = false, hadDestinationDraft = false;
  let host, panel;
  const visible = el => {
    if (!el || !el.isConnected || el.closest('[aria-hidden="true"]') || !el.getClientRects().length) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0;
  };
  const sendSelector = 'button[data-testid="send-button"], button#composer-submit-button, button[type="submit"][aria-label="Send" i], button[type="submit"][aria-label="Send message" i]';
  let lastFocusedComposer = null;
  const isEditor = el => el instanceof HTMLTextAreaElement || el?.matches?.('[contenteditable="true"][role="textbox"]');
  document.addEventListener('focusin', event => {
    const el = event.target;
    if (isEditor(el) && el.closest('main') && visible(el) && !el.disabled) lastFocusedComposer = el;
  }, true);
  const composer = () => {
    const known = [...document.querySelectorAll('div[contenteditable="true"][role="textbox"][aria-label="Ask ChatGPT" i], #prompt-textarea[contenteditable="true"], textarea#prompt-textarea, textarea[aria-label="Chat with ChatGPT" i][placeholder="Ask ChatGPT" i]')].find(el => visible(el) && !el.disabled);
    if (known) return known;
    const active = document.activeElement;
    if (isEditor(active) && active.closest('main') && visible(active) && !active.disabled) return active;
    if (isEditor(lastFocusedComposer) && lastFocusedComposer.closest('main') && visible(lastFocusedComposer) && !lastFocusedComposer.disabled) return lastFocusedComposer;
    const candidates = [...document.querySelectorAll('main form textarea, main form [contenteditable="true"][role="textbox"]')].filter(el => visible(el) && !el.disabled && [...el.closest('form').querySelectorAll(sendSelector)].some(visible));
    return candidates.length === 1 ? candidates[0] : null;
  };
  const value = el => el ? ('value' in el ? el.value : el.innerText).trim() : '';
  const sendButton = () => {
    const form = composer()?.closest('form');
    if (!form) return null;
    return [...form.querySelectorAll(sendSelector)].find(visible) || null;
  };
  const rpc = async data => {
    const result = await chrome.runtime.sendMessage(data);
    if (!result?.ok) throw Error(result?.error || 'Extension unavailable. Refresh this page.');
    return result;
  };
  function hide() { host?.remove(); host = panel = null; }
  function show(title, body, actions = [], text) {
    hide(); host = document.createElement('div');
    host.style.cssText = 'position:fixed;bottom:100px;right:24px;z-index:2147483647;max-width:calc(100vw - 32px)';
    const shadow = host.attachShadow({mode: 'closed'});
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}section{box-sizing:border-box;width:390px;max-width:calc(100vw - 32px);padding:22px;background:#fff;color:#172b2a;border:1px solid #cddbd6;border-radius:18px;box-shadow:0 12px 50px #0003;font:14px/1.5 system-ui}h2{font-size:17px;margin:0 0 8px}p{margin:0 0 14px}button{font:inherit;border:1px solid #baccc5;border-radius:9px;background:#edf5f0;color:#173e31;padding:8px 12px;margin:4px 6px 0 0;cursor:pointer}button:focus-visible,textarea:focus-visible{outline:3px solid #48a784}textarea{box-sizing:border-box;width:100%;height:160px;font:13px/1.5 system-ui;padding:10px;border:1px solid #baccc5;border-radius:8px}small{display:block;color:#547268;margin-bottom:8px}';
    panel = document.createElement('section'); panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Smart Context Router');
    const label = document.createElement('small'); label.textContent = 'SMART CONTEXT ROUTER';
    const heading = document.createElement('h2'); heading.textContent = title;
    const description = document.createElement('p'); description.textContent = body; description.setAttribute('role', 'status');
    panel.append(label, heading, description);
    if (text !== undefined) { const area = document.createElement('textarea'); area.value = text; area.readOnly = true; area.setAttribute('aria-label', 'Handoff text to copy'); panel.append(area); }
    for (const [name, fn] of actions) {
      const button = document.createElement('button'); button.textContent = name;
      button.onclick = async () => { button.disabled = true; try { await fn(); } catch (e) { description.textContent = e.message; } finally { button.disabled = false; } };
      panel.append(button);
    }
    shadow.append(style, panel); document.documentElement.append(host);
  }
  function sendHere() {
    pending = null; hide();
    const button = sendButton();
    if (!button || button.disabled) { bypass = true; show('Ready to send here', 'Use ChatGPT’s Send button. This draft will stay here.', [['Close', hide]]); return; }
    bypass = true; button.click();
    setTimeout(() => { bypass = false; }, 0);
  }
  async function route(result, message) {
    if (value(composer()) !== message) { pending = null; hide(); return; }
    busy = true;
    try {
      const excerpts = [...document.querySelectorAll('[data-message-author-role="user" i], [data-turn="user" i]')]
        .map(el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(-3);
      const text = SCR.handoff(message, excerpts, location.origin + location.pathname, settings.includeContext);
      await rpc({type: 'route', projectId: result.project.id, text});
      pending = null;
      const contextStatus = !settings.includeContext
        ? 'Previous context sharing is off.'
        : excerpts.length
          ? 'Included ' + excerpts.length + ' prior user message' + (excerpts.length === 1 ? '' : 's') + '.'
          : 'No prior user messages were detected; only the current request was handed off.';
      show('Opened ' + result.project.name, contextStatus + ' Your original draft is still here. Undo is available in the destination tab.', [['Send here instead', sendHere], ['Dismiss', hide]]);
    } catch (e) {
      pending = null;
      show('Could not route', e.message + ' Your draft is still here.', [['Send here', sendHere], ['Dismiss', hide]]);
    } finally { busy = false; }
  }
  function intercept(event) {
    const el = composer();
    if (!el) return;
    if (event.type === 'keydown' && (event.target !== el && !el.contains(event.target) || event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.altKey || event.metaKey)) return;
    if (event.type === 'click' && event.target.closest?.('button') !== sendButton()) return;
    if (event.type === 'submit' && event.target !== el.closest('form')) return;
    if (destination) { hadDestinationDraft = !!value(el); return; }
    if (bypass) return;
    if (!ready || !settings.enabled) return;
    const message = value(el);
    if (!message) return;
    const result = SCR.classify(message, settings.projects, location.origin + location.pathname);
    if (result.level === 'low') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy || pending === message) return;
    pending = message;
    // Attachments cannot be transferred through a text handoff.
    const attachment = document.querySelector('[data-testid*="attachment"], [data-testid*="file-preview"], [data-testid*="upload-preview"]');
    if (result.level === 'high' && settings.autoRoute && !attachment) { void route(result, message); return; }
    show('Continue in ' + result.project.name + '?', 'Matched: ' + (result.hits.join(', ') || result.project.name) + '. Only text is carried over; check attachments before routing.', [
      ['Route with context', () => route(result, message)], ['Send here', sendHere], ['Keep editing', () => {pending = null; hide(); el.focus();}]
    ]);
  }
  for (const type of ['keydown', 'click', 'submit']) window.addEventListener(type, intercept, true);
  document.addEventListener('input', e => { if (e.target === composer() || composer()?.contains(e.target)) {pending = null; bypass = false;} }, true);
  function insert(text) {
    const el = composer();
    if (!el) throw Error('Open the destination chat composer, then try Insert again. You can also copy the handoff below.');
    if (value(el)) throw Error('The destination already has a draft. Clear it yourself, or copy the handoff to append it.');
    el.focus();
    if (el instanceof HTMLTextAreaElement) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, text);
      el.dispatchEvent(new Event('input', {bubbles: true}));
    } else {
      // Use the browser editing pipeline so ProseMirror/React observes the transaction.
      if (!document.execCommand('insertText', false, text)) throw Error('Automatic insertion is unavailable. Copy the handoff below and paste it.');
    }
    if (value(el) !== text.trim()) throw Error('Could not verify the complete draft. Review it or copy the handoff below.');
  }
  async function init() {
    try {
      settings = (await chrome.storage.local.get('settings')).settings || SCR.defaults;
      ready = true;
      const {record} = await rpc({type: 'get'});
      if (!record) return;
      destination = true;
      show('Routed to ' + record.project, 'Review the context handoff, then insert it and send with ChatGPT. Undo returns to the untouched source draft.', [
        ['Insert handoff', () => { insert(record.text); show('Handoff inserted', 'Review the draft and press ChatGPT’s Send button when ready.', [['Undo routing', () => rpc({type: 'undo'})], ['Done', async () => {await rpc({type: 'clear'}); hide();}]]); }],
        ['Undo routing', () => rpc({type: 'undo'})], ['Dismiss', async () => {await rpc({type: 'clear'}); destination = false; hide();}]
      ], record.text);
    } catch (e) { console.warn('Smart Context Router:', e.message); }
  }
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.settings) settings = changes.settings.newValue || SCR.defaults; });
  // Re-enable classification after the handed-off draft has been submitted and cleared.
  setInterval(() => { if (destination && hadDestinationDraft && composer() && !value(composer())) {destination = false; hide(); void rpc({type: 'clear'}).catch(() => {});} }, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else void init();
})();
