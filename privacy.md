# Smart Chat Switcher Privacy Policy

**Last updated: November 3, 2026**

Smart Chat Switcher is a Chrome extension for suggesting a user-confirmed handoff of a ChatGPT text request to a saved ChatGPT conversation or Project. This policy describes the current release's handling of information from `chatgpt.com`. Information handled locally is still user data and is described here.

## Information the extension reads

Before inspecting message text for the routing feature, the extension displays an in-page disclosure and asks you to agree. When you try to send a text draft, it reads the current composer text and compares it locally with the names and keywords of your configured destinations.

While routing is enabled, the extension also checks up to the four most recently loaded assistant message elements on the current ChatGPT page for an explicit `scr-route` routing suggestion. If it finds one, it reads the latest loaded user message to prepare the request shown in a confirmation prompt. After you send a handoff in the destination, the extension compares the pending draft with user-message elements loaded on that page to verify delivery. It does not retrieve your complete account history or messages that are not loaded on the current page.

When you confirm a route, the extension reads the current page title and URL and the selected destination configuration. The source URL is reduced to its origin and path. The destination opens only after your confirmation.

## How information is used

Draft text is matched against configured destination names and keywords in the browser. A draft with no match is not saved by the extension. Routing suggestions are not automatic: you choose whether to open the suggested destination.

For a confirmed route, the extension prepares a handoff for your review. Its text contains the source conversation title when available and the exact current request. It does not include the source URL, conversation ID, earlier user messages, assistant replies, or a generated conversation summary. A title is only a reference and does not guarantee that ChatGPT can retrieve the source conversation. The extension does not insert or submit the handoff without your action. If you choose to insert and send it, ChatGPT receives it through its normal interface and handles it under its own terms and privacy policy.

## Information stored

`chrome.storage.local` stores the first-use consent version and routing settings. Settings can include the enabled state, context-reference preference, configuration version, and configured destinations. A destination can include its ID, name, purpose, keywords, ChatGPT URL, active state, and optional discovery status and evidence.

`chrome.storage.session` stores a tab-scoped handoff after you confirm a route. It can contain the current request, source title, source URL and conversation ID, destination details, handoff text, source tab ID, and creation time. This temporary storage also contains at most 50 per-tab SHA-256 digests used to suppress repeated assistant suggestions. When ChatGPT provides a message ID, the digest is derived from that ID; otherwise it is derived from the assistant message text. A digest is a bounded deduplication identifier, not anonymization. Assistant reply text is not stored in extension storage by this feature.

The current release removes the previous release's `scr:seen-route-suggestions` key from the ChatGPT page's `sessionStorage` when the content script loads. The previous key could contain message IDs or, when an ID was unavailable, full assistant reply text. After removing that legacy key, the current release does not read or write website `sessionStorage`.

## Retention and deletion

Handoff age is checked when the extension looks up the handoff. If it is more than 30 minutes old at that lookup, it is removed. There is no timer that guarantees deletion exactly at 30 minutes, and a handoff already retrieved by a page can remain in extension session storage until another cleanup event.

Handoffs are also removed when dismissed or completed, when delivery is detected, when the destination tab closes, or when Chrome clears extension session storage, including on browser restart or extension reload/update. Chrome's `storage.local` settings remain until you change them or remove the extension. You can remove destinations in Settings. Uninstalling the extension clears its local storage. To remove any legacy page `sessionStorage` data before the updated content script next runs, clear site data for `chatgpt.com` in Chrome.

## Sharing and security

The extension contains no remote code, analytics, or advertising service. Its code makes no direct `fetch`, XMLHttpRequest, WebSocket, beacon, or telemetry requests and does not operate an extension-owned server. The extension does not transmit your data to its developer, analytics providers, or advertisers. Chrome navigates to your configured ChatGPT URL only after you confirm a route. If you choose to insert and send the handoff, you submit it to ChatGPT through ChatGPT's normal interface; ChatGPT then handles it under its own terms and privacy policy.

## Chrome Web Store User Data Policy

The extension uses information accessed through Chrome APIs only to provide its disclosed routing features. It does not sell user data, use it for advertising, or transfer it to an extension backend or analytics provider. Its use of user data is limited to the extension's single purpose and complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

No developer contact address is currently published in this repository. A contact method should be added here if required by the Chrome Web Store or applicable law before submission.