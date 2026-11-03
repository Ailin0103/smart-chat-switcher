(() => {
  try { sessionStorage.removeItem('scr:seen-route-suggestions'); } catch {}
  let settings = SCR.defaults, ready = false, busy = false, bypass = false, pending = null, destination = false, destinationDraft = '', destinationSubmitPending = false;
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
  const rawValue = el => el ? ('value' in el ? el.value : el.innerText) : '';
  const normalizeDraft = text => String(text).replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
  function sourceTitle() {
    const pageTitle = document.title.trim().replace(/\s*(?:[-|·])\s*ChatGPT\s*$/i, '').trim();
    if (pageTitle && !/^(?:ChatGPT|New chat)$/i.test(pageTitle)) return pageTitle;
    const active = document.querySelector('a[aria-current="page"][href]');
    if (active && new URL(active.href).pathname === location.pathname && /\/c\/|\/g\/[^/]+\/c\//.test(location.pathname)) {
      return (active.innerText || active.getAttribute('aria-label') || '').trim();
    }
    return '';
  }
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
  function show(title, body, actions = [], text, sourceTitleValue, requestTitleEntry = false) {
    hide(); host = document.createElement('div');
    host.style.cssText = 'position:fixed;bottom:100px;right:24px;z-index:2147483647;max-width:calc(100vw - 32px)';
    const shadow = host.attachShadow({mode: 'closed'});
    const style = document.createElement('style');
    style.textContent = ':host{all:initial}section{box-sizing:border-box;width:390px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;padding:22px;background:#fff;color:#172b2a;border:1px solid #cddbd6;border-radius:18px;box-shadow:0 12px 50px #0003;font:14px/1.5 system-ui}h2{font-size:17px;margin:0 0 8px}p{margin:0 0 14px}button{font:inherit;border:1px solid #baccc5;border-radius:9px;background:#edf5f0;color:#173e31;padding:8px 12px;margin:4px 6px 0 0;cursor:pointer}button:focus-visible,textarea:focus-visible{outline:3px solid #48a784}textarea{box-sizing:border-box;width:100%;height:180px;font:13px/1.5 system-ui;padding:10px;border:1px solid #baccc5;border-radius:8px}small{display:block;color:#547268;margin-bottom:8px}';
    panel = document.createElement('section'); panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Smart Chat Switcher');
    const label = document.createElement('small'); label.textContent = 'SMART CHAT SWITCHER';
    const heading = document.createElement('h2'); heading.textContent = title;
    const description = document.createElement('p'); description.textContent = body; description.setAttribute('role', 'status');
    panel.append(label, heading, description);
    if (requestTitleEntry) {
      const sourceLabel = document.createElement('label'); sourceLabel.textContent = 'Source conversation title (optional)';
      const sourceInput = document.createElement('input'); sourceInput.type = 'text'; sourceInput.value = sourceTitleValue || ''; sourceInput.setAttribute('aria-label', 'Source conversation title');
      sourceLabel.append(sourceInput); panel.append(sourceLabel);
    }
    if (text !== undefined) { const area = document.createElement('textarea'); area.value = text; area.setAttribute('aria-label', 'Review and edit handoff text'); panel.append(area); }
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
  async function route(result, message, {fromAssistantSuggestion = false} = {}) {
    if (!fromAssistantSuggestion && rawValue(composer()) !== message) { pending = null; hide(); return; }
    busy = true;
    try {
          await rpc({type: 'route', projectId: result.project.id, currentRequest: message, sourceTitle: sourceTitle()});
      pending = null;
      show('Opened ' + result.project.name, 'The source conversation title and current request were prepared. The original conversation remains open.', [['Send here instead', sendHere], ['Dismiss', hide]]);
    } catch (e) {
      pending = null;
      const preserved = fromAssistantSuggestion ? 'The request remains in the source conversation.' : 'Your original request is still in the source composer.';
      show('Could not route', e.message + ' ' + preserved + ' You can retry without losing it.', [
        ['Retry routing', () => {pending = message; return route(result, message, {fromAssistantSuggestion});}], ['Send here', sendHere], ['Dismiss', hide]
      ]);
    } finally { busy = false; }
  }
  function intercept(event) {
    const el = composer();
    if (!el) return;
    if (event.type === 'keydown' && (event.target !== el && !el.contains(event.target) || event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229 || event.ctrlKey || event.altKey || event.metaKey)) return;
    if (event.type === 'click' && event.target.closest?.('button') !== sendButton()) return;
    if (event.type === 'submit' && event.target !== el.closest('form')) return;
    if (destination) {
      if (value(el)) { destinationDraft = rawValue(el); destinationSubmitPending = true; }
      return;
    }
    if (bypass) return;
    if (!ready || !settings.enabled) return;
    const message = rawValue(el);
    if (!message.trim()) return;
    const result = SCR.classify(message, settings.projects, location.origin + location.pathname);
    if (result.level === 'low') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy || pending === message) return;
    pending = message;
    // Attachments cannot be transferred through a text handoff.
    const attachment = document.querySelector('[data-testid*="attachment"], [data-testid*="file-preview"], [data-testid*="upload-preview"]');
    show('Continue in ' + result.project.name + '?', 'Matched: ' + (result.hits.join(', ') || result.project.name) + '. Only text is carried over; check attachments before routing.', [
      ['Route with context', () => route(result, message)], ['Send here', sendHere], ['Keep editing', () => {pending = null; hide(); el.focus();}]
    ]);
  }
  for (const type of ['keydown', 'click', 'submit']) window.addEventListener(type, intercept, true);
  const seenRouteSuggestions = new Set();
  const pendingRouteSuggestions = new Map();
  function routeSuggestionIdentity(messageNode, text) {
    const messageId = messageNode.getAttribute('data-message-id');
    return messageId ? 'message-id:' + messageId : text;
  }
  async function routeSuggestionKey(identity) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
    const digest = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return 'sha256:' + digest;
  }
  function latestUserRequest() {
    const messages = [...document.querySelectorAll('[data-message-author-role="user" i]')];
    const last = messages.at(-1);
    return (last?.innerText || last?.textContent || '').replace(/\r\n?/g, '\n');
  }
  async function inspectAssistantRouteSuggestions() {
    if (!ready || !settings.enabled) return;
    const messages = [...document.querySelectorAll('[data-message-author-role="assistant" i]')];
    for (const messageNode of messages.slice(-4)) {
      const text = messageNode.innerText || messageNode.textContent || '';
      if (!/```scr-route/i.test(text)) continue;
      const dedupeKey = await routeSuggestionKey(routeSuggestionIdentity(messageNode, text));
      if (!ready || !settings.enabled || !messageNode.isConnected) continue;
      if (seenRouteSuggestions.has(dedupeKey) || pendingRouteSuggestions.has(dedupeKey)) continue;
      const timer = setTimeout(async () => {
        pendingRouteSuggestions.delete(dedupeKey);
        const currentText = messageNode.innerText || messageNode.textContent || '';
        if (!ready || !settings.enabled || !messageNode.isConnected || seenRouteSuggestions.has(dedupeKey) || await routeSuggestionKey(routeSuggestionIdentity(messageNode, currentText)) !== dedupeKey) return;
        handleRouteSuggestion(currentText, dedupeKey);
      }, 900);
      pendingRouteSuggestions.set(dedupeKey, {timer});
    }
  }
  function handleRouteSuggestion(text, dedupeKey) {
      seenRouteSuggestions.add(dedupeKey);
      if (seenRouteSuggestions.size > 50) seenRouteSuggestions.delete(seenRouteSuggestions.values().next().value);
      void rpc({type:'markSeenRouteSuggestion', key:dedupeKey}).catch(() => {});
      const parsed = SCR.parseRouteSuggestion(text, settings.projects, settings.configVersion || SCR.protocol.configVersion);
      if (!parsed.ok) {
        show('Routing suggestion not accepted', parsed.error + ' Copy the latest activation prompt and use the registered Project IDs.', [['Dismiss', hide]]);
        return;
      }
      const request = latestUserRequest();
      if (!request.trim()) {
        show('Routing suggestion needs a request', 'No preceding user request could be identified. Continue manually or provide the request before switching.', [['Dismiss', hide]]);
        return;
      }
      show('Continue in ' + parsed.project.name + '?', parsed.reason + ' ChatGPT suggested this Project. Confirm before switching.', [
        ['Continue in Project', () => route(parsed, request, {fromAssistantSuggestion:true})], ['Stay here', hide]
      ]);
  }
  let routeSuggestionTimer;
  if (document.documentElement) new MutationObserver(() => {
    clearTimeout(routeSuggestionTimer);
    routeSuggestionTimer = setTimeout(inspectAssistantRouteSuggestions, 250);
  }).observe(document.documentElement, {subtree:true, childList:true, characterData:true});
  document.addEventListener('input', e => {
    if (e.target !== composer() && !composer()?.contains(e.target)) return;
    pending = null; bypass = false;
    if (destination && value(composer())) destinationDraft = rawValue(composer());
  }, true);
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
    if (normalizeDraft(value(el)) !== normalizeDraft(text)) throw Error('Could not verify the complete draft. Review it or copy the handoff below.');
  }
  function waitForComposer(timeout = 15000) {
    if (composer()) return Promise.resolve(true);
    return new Promise(resolve => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (composer()) { clearInterval(timer); resolve(true); }
        else if (Date.now() - started >= timeout) { clearInterval(timer); resolve(false); }
      }, 100);
    });
  }
  async function init() {
    try {
      const stored = await chrome.storage.local.get(['settings','privacyConsentVersion']);
      settings = SCR.migrateSettings(stored.settings);
      if (stored.privacyConsentVersion !== 1) {
        show('Privacy and page access', 'Before routing starts, this extension reads the draft when you try to send and matches it against your saved keywords on this device. It checks up to four loaded assistant messages for routing suggestions, may read the latest loaded user message for a suggestion, and checks loaded user messages after a destination send. It stores up to 50 fixed-length SHA-256 digests per tab to suppress repeat suggestions, not the reply text. After you confirm a route, it temporarily stores the source title, URL and ID, destination, and request. You choose whether to insert and send a reviewed handoff. A confirmed route opens your saved ChatGPT URL; no data is sent to an extension server or analytics.', [
          ['Agree and continue', async () => {
            ready = true;
            try {
              await chrome.storage.local.set({privacyConsentVersion:1});
              hide();
              await init();
            } catch (e) {
              ready = false;
              throw e;
            }
          }],
          ['Not now', hide]
        ]);
        return;
      }
      ready = true;
      const {keys = []} = await rpc({type:'getSeenRouteSuggestions'});
      for (const key of keys) if (typeof key === 'string' && key.length <= 80) seenRouteSuggestions.add(key);
      inspectAssistantRouteSuggestions();
      const {record} = await rpc({type: 'get'});
      if (!record) return;
      destination = true;
      const composerReady = await waitForComposer();
      const currentRequest = typeof record.current_request === 'string' ? record.current_request : '';
      let approvedText = record.text;
      const reviewText = () => panel?.querySelector('[aria-label="Review and edit handoff text"]')?.value || record.text;
      const updateReviewWithTitle = () => {
        const title = panel?.querySelector('[aria-label="Source conversation title"]')?.value.trim();
        if (!title) throw Error('Enter a source conversation title first, or continue with the request only.');
        approvedText = SCR.createReferenceHandoff({currentRequest, source:{title}, destination:record.destination, id:record.id, referenceEnabled:true}).text;
        const area = panel?.querySelector('[aria-label="Review and edit handoff text"]');
        if (area) area.value = approvedText;
      };
      const insertApproved = () => {
        insert(approvedText);
        show('Handoff inserted', 'Review the draft and press ChatGPT’s Send button when ready. Nothing has been submitted.', [
          ['Reinsert handoff', insertApproved], ['Undo routing', () => rpc({type: 'undo'})], ['Done', async () => {await rpc({type: 'clear'}); hide();}]
        ]);
      };
      const insertReviewed = () => { approvedText = reviewText(); insertApproved(); };
      show('Routed to ' + record.project, (composerReady ? 'Review or edit the source reference and request, then insert it into the composer. It will not be sent automatically.' : 'The destination composer did not appear yet. Review or copy the handoff below and retry Insert when the composer is ready.') + ' ChatGPT may not be able to access the source conversation.', [
        ...(record.reference_enabled && !record.source?.title ? [['Add title reference', updateReviewWithTitle]] : []),
        ['Insert reviewed handoff', insertReviewed], ['Use current request only', () => { approvedText = 'Current request:\n' + currentRequest; const area = panel?.querySelector('[aria-label="Review and edit handoff text"]'); if (area) area.value = approvedText; }],
        ['Undo routing', () => rpc({type: 'undo'})], ['Dismiss', async () => {await rpc({type: 'clear'}); destination = false; hide();}]
      ], record.text, '', Boolean(record.reference_enabled && !record.source?.title));
    } catch (e) {
      ready = false;
      console.warn('Smart Chat Switcher:', e.message);
      show('Could not start Smart Chat Switcher', e.message + ' Reload the extension and refresh this ChatGPT tab, then retry.', [
        ['Retry', init], ['Dismiss', hide]
      ]);
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) settings = changes.settings.newValue || SCR.defaults;
  });
  // Keep the extension-created package available until the destination user message is confirmed in history.
  setInterval(() => {
    if (!destination || !destinationSubmitPending || !destinationDraft || value(composer())) return;
    const delivered = [...document.querySelectorAll('[data-message-author-role="user" i], [data-turn="user" i]')]
      .some(el => normalizeDraft(el.innerText || el.textContent || '') === normalizeDraft(destinationDraft));
    if (delivered) { destination = false; destinationSubmitPending = false; destinationDraft = ''; hide(); void rpc({type: 'clear'}).catch(() => {}); }
  }, 1000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else void init();
})();
