# Chrome Web Store Submission Draft

## Product details

**Name:** Smart Chat Switcher

**Short description:**

Find a matching saved ChatGPT conversation or Project for your draft, review the handoff, and choose whether to continue there.

**Detailed description:**

Smart Chat Switcher helps you continue a ChatGPT text request in a saved conversation or Project that matches what you are working on.

Configure the destinations you want to use, add keywords in the languages and phrases you commonly use, and save your settings. When you try to send a text draft on chatgpt.com, Smart Chat Switcher reads it and checks it locally against your active destinations. If there is a match, it asks before opening another conversation.

When routing is enabled, the extension also checks up to the four most recently loaded assistant message blocks on the current ChatGPT page for an explicit `scr-route` suggestion. If one is found, it reads the latest loaded user message to prepare a confirmation. After you send at a destination, it checks loaded user-message blocks to verify that the draft appeared. This is limited to message content present in the current page; the extension does not fetch unloaded or account-wide conversation history.

Before anything is inserted, you can review the source conversation title and your exact current request. The title is only a reference and does not guarantee that ChatGPT can retrieve the original conversation. The handoff text does not include a URL, conversation ID, assistant reply, or earlier user message. The extension does not submit the message for you or transfer files, images, or attachments. You decide whether to insert the handoff and send it in ChatGPT.

Project discovery is optional. You can ask ChatGPT to prepare a JSON proposal, review it in Settings, and manually verify destination URLs before enabling new destinations. New destinations are not activated automatically.

Settings stay in Chrome storage on your device. A confirmed route temporarily stores the source page metadata and request in tab-scoped Chrome session storage. Smart Chat Switcher has no extension-owned server, analytics, or advertising service. If you choose to send the reviewed handoff, ChatGPT receives it through its normal interface.

## Privacy practices draft

**Single purpose:**

Suggest and prepare a user-confirmed handoff of the current ChatGPT text request to a user-configured saved conversation or Project using local keyword matching and optional explicit assistant-generated route suggestions.

**Permission justification: `storage`:**

Stores user-configured destinations, routing preferences, and the first-use disclosure consent version in `chrome.storage.local`. Uses `chrome.storage.session` for the temporary handoff needed by the destination tab and up to 50 per-tab SHA-256 digests to suppress repeated assistant suggestions. The digest is a bounded deduplication key, not anonymization; the reply text is not stored there.

**ChatGPT site access justification:**

The content script is limited to `https://chatgpt.com/*`. It needs the current composer text to perform the requested local keyword match; loaded message text for the optional assistant-suggestion and handoff-verification features; and current title/URL metadata to prepare navigation and a reviewable handoff. A first-use in-page disclosure and affirmative action precede message inspection.

**Remote code:**

The extension does not load or execute remote code.

**Data handling notes for the dashboard:**

The extension reads the unsent composer text when a send is attempted and compares it locally with configured names and keywords. While routing is enabled it reads up to four currently loaded assistant message blocks to detect `scr-route`; for a valid suggestion it reads the latest loaded user message, and after a destination send it compares the pending draft with loaded user-message blocks. On a user-confirmed route it reads the current page title and URL and the selected destination.

`chrome.storage.local` stores `privacyConsentVersion` and a `settings` object with `enabled`, `autoRoute` (forced false), `includeContext`, `configVersion`, and `projects`. Each project can contain `id`, `name`, `purpose`, `keywords`, `url`, `active`, `discoveryStatus`, and `discoveryBasis`. `chrome.storage.session` stores a tab-keyed handoff record: `version`, `id`, `source` (`url`, `title`, `conversation_id`), `destination` (`project_id`, `project`, `url`, `conversation_id`), `current_request`, `reference_enabled`, and `text`, plus top-level `project`, `url`, `sourceId`, and `created`. It also stores at most 50 per-tab `sha256:<64 hex characters>` suggestion keys, derived from an assistant message ID when available or its text otherwise. The digest is a bounded deduplication key, not anonymization; assistant reply text is not stored there. The 30-minute handoff age is checked only when the handoff is looked up. There is no timer, and a record already retrieved can remain past 30 minutes until it is cleared, its tab closes, or extension session storage is cleared on browser restart or extension reload/update. Dismissal, Done, or detected delivery also clears the handoff.

The prior release used ChatGPT page `sessionStorage` key `scr:seen-route-suggestions` for suggestion deduplication. Its JSON array contained up to 50 message IDs or, when no ID existed, full assistant reply text. The current release removes that legacy key the next time its content script loads on chatgpt.com. It does not read or set website session storage after that cleanup.

The extension makes no direct fetch, XHR, WebSocket, beacon, or telemetry requests and contains no analytics, advertising, or remote code. A confirmed route causes Chrome to navigate to the user-configured ChatGPT URL. The extension does not send data to an extension-owned server. If the user chooses to insert and send the reviewed handoff, ChatGPT receives the handoff through its normal interface, under ChatGPT's own terms and privacy policy.

**Suggested data-use category mapping:**

- Select **Personal communications**: the extension reads current ChatGPT drafts and message text loaded on the current page.
- Select **Website content**: message and composer text are read from the current ChatGPT page.
- Select **Web history** or the dashboard's equivalent browsing-activity category, if present: the current ChatGPT page URL/title is read for a confirmed route. This is not cross-site history collection.
- Review **Personally identifiable information** against the dashboard's definition: the extension does not extract identifiers separately, but it reads arbitrary user-authored chat text, which could contain identifiers. Select it if the dashboard classifies such content as this data type.
- Review **User activity** against the dashboard's definition: the extension handles the send action and checks destination delivery, but does not collect cross-site activity, clickstreams, or keystroke telemetry. Select it only if the dashboard classifies those narrow interactions as this category.
- Do not select health, financial/payment, authentication, or location categories solely because arbitrary user text could mention them; the extension has no feature that specifically collects or uses those data types. Follow the dashboard's current definitions if the actual deployed feature set changes.
- Do not claim that no user data is handled just because matching is local. Chrome's FAQ explicitly requires local processing/storage to be disclosed.
- Complete every limited-use certification only if it matches the released code: data is used for the single disclosed routing purpose, is not sold or used for ads, and is not shared with an extension backend or analytics provider.

## Privacy policy text draft

Smart Chat Switcher handles information from the current chatgpt.com page to provide local destination matching and user-confirmed handoffs. A first-use disclosure explains this access and asks for agreement before the content script inspects message text.

When you try to send a text draft, the extension reads the current composer text and compares it locally with destination names and keywords configured by you. It does not store a draft that has no match. While routing is enabled, it checks the text of up to four most recently loaded assistant message elements on the current page for an explicit `scr-route` suggestion. When a valid suggestion is present, it reads the latest loaded user message to prepare the request shown in the confirmation. After you send at a destination, it compares the pending draft with user-message elements loaded on that page to verify that the message appeared. It does not retrieve the complete account history or messages that are not loaded in the current page.

For a route you confirm, the extension reads the current page title and URL and the selected saved destination. `chrome.storage.local` stores `privacyConsentVersion` and a `settings` object with `enabled`, `autoRoute` (forced false), `includeContext`, `configVersion`, and `projects`. Each project can contain `id`, `name`, `purpose`, `keywords`, `url`, `active`, `discoveryStatus`, and `discoveryBasis`. `chrome.storage.session` stores a tab-keyed handoff record: `version`, `id`, `source` (`url`, `title`, `conversation_id`), `destination` (`project_id`, `project`, `url`, `conversation_id`), `current_request`, `reference_enabled`, and `text`, plus top-level `project`, `url`, `sourceId`, and `created`. It also stores at most 50 per-tab SHA-256 digests derived from assistant message IDs or, when no ID is available, assistant message text. These digests are bounded identifiers, not anonymization; assistant reply text is not persisted in extension storage.

The handoff is intended for review in the destination composer. Its text contains the source title when available and the exact current request, but not the source URL, conversation ID, assistant replies, or earlier user messages. A title does not guarantee that ChatGPT can retrieve the source conversation. The extension never sends the handoff automatically. If you choose to insert and send it, ChatGPT receives it through its normal interface and handles it under its own terms and privacy policy.

The current release removes the previous release's `scr:seen-route-suggestions` key on content-script load and otherwise does not read or write website `sessionStorage`. The legacy key held a JSON array of up to 50 message IDs or full assistant reply texts where no ID existed. Handoff age is checked only when the record is looked up: an item older than 30 minutes at that check is removed, but there is no timer guaranteeing deletion at 30 minutes. A record already retrieved can remain past that age until dismissed, marked done, detected as delivered, its tab closes, or Chrome clears extension session storage on browser restart or extension reload/update. The settings in `chrome.storage.local` remain until changed or the extension is removed. Users can remove destinations in Settings; uninstalling the extension clears its local storage. Users can clear chatgpt.com site data in Chrome to remove any legacy page session data before the updated content script next runs.

The extension makes no direct fetch, XHR, WebSocket, beacon, or telemetry requests and does not operate an extension-owned server. A confirmed route navigates Chrome to the configured ChatGPT URL; the user may separately choose to send the handoff through ChatGPT. The extension uses no analytics or advertising service and does not send user data to the developer. Its use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

Users can remove saved destinations in the extension Settings or remove the extension to clear its locally stored data.

Before publication, host this policy at a public URL and add that URL to the Developer Dashboard. Add a real developer contact method if the dashboard or applicable law requires one; none is supplied in this repository. Confirm the hosted policy reflects the final uploaded code and applicable legal requirements.

## Remaining submission items

- Capture at least one genuine 1280 x 800 screenshot of the extension UI; do not use test fixtures or synthetic product claims.
- Host the privacy policy above at a public URL and enter that URL in the developer dashboard. No public URL is currently supplied.
- Supply a developer contact address if required; no contact information is currently supplied.
- Sign in to the Chrome Web Store Developer Dashboard and complete Google's account verification directly.
- Upload `Smart-Chat-Switcher-0.2.2.zip`.
- Select the product category, listing language, distribution visibility, and regions.
- Complete the Privacy tab and certify every data-use statement only after reviewing it against the code and hosted policy.
- Submit for review; publication is not complete until Google approves the submission.
