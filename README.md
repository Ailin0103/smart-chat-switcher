# Smart Context Router · MVP

A local Chrome extension that intercepts ChatGPT text drafts at send time and offers the right saved conversation or Project. No build step, API key, backend, or external dependencies.

## Install

1. Keep this folder on your computer (unzip the download first if needed).
2. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `smart-context-router` folder containing `manifest.json`.
4. Open the extension popup → **Manage destinations**.
5. Paste your own ChatGPT conversation or Project URLs into the sample destinations you want to use. Click **Save settings**.
6. Open or refresh a tab at `https://chatgpt.com` after installing or reloading the extension.

Sample destinations: Job Search, Paper 2, CodonBERT, Chubby Group, Dissertation. Their URLs are intentionally blank; nothing routes until you configure real destinations. Add, remove, rename, or deactivate them in settings. No Chrome Web Store publishing is needed for local installation.

Supported URL shapes:

- `https://chatgpt.com/c/CONVERSATION_ID`
- `https://chatgpt.com/g/PROJECT_ID/project`
- `https://chatgpt.com/g/PROJECT_ID/c/CONVERSATION_ID`

Copy the actual URL from your account. These examples are shapes, not usable destinations. Query strings, fragments, external domains, and generic home URLs are rejected. For the smoothest handoff, use an existing conversation URL inside a Project. A Project landing page may require opening a chat composer before inserting.

## What happens when you send

| Match | Behavior |
| --- | --- |
| High | Opens the destination in a new foreground tab, preserving your original draft. |
| Medium | Shows an in-page card with **Route with context**, **Send here**, and **Keep editing**. |
| Low / already at the saved URL | ChatGPT receives the send normally. |

At the destination, a card shows the complete handoff. Click **Insert handoff**, review the composer, then press ChatGPT's Send button. **Undo routing** closes the extension-created destination tab and returns to the original tab and its draft. Undo is a navigation undo, not a way to retract a message already sent. It is available until the handoff is dismissed, submitted, expires, or the browser session ends.

The source tab remains open. Returning to it does not automatically send anything. **Send here instead** explicitly sends the source draft there. Existing drafts at the destination are never overwritten; copy the handoff manually if you want to append it. If insertion is unsupported, the card's text box can be selected and copied.

This is automatic *routing*, followed by user-controlled final sending. It does not move chat history, create native folders, or automatically post the message in the destination. It does not promise that ChatGPT will retrieve any particular Project memory; it carries explicit text context instead.

## Local matcher

`core.js` exposes `classify(message, projects, currentURL)` as the replaceable classifier boundary.

- Exact project-name match or two distinct configured keyword matches, without competing project hits → high (0.95).
- One keyword match → medium (0.75).
- Any competing destination hits → medium (0.70).
- No match → low.
- The highest-scoring destination's exact saved URL matches the current page → stay.

Numbers describe heuristic strength, **not calibrated probabilities**. English keywords use word boundaries; Chinese keywords use substring matching. Keyword frequency does not boost a score. Only active destinations with valid URLs participate. Negation, intent, synonyms, and topic boundaries are not semantically understood. For example, “do not discuss my resume” still matches “resume.” Turn off automatic routing for suggestion-only operation if desired.

Context handoff is deliberately small: an extractive summary made from the last three rendered **user** messages, up to 300 characters each, plus the source URL and the complete current request. It excludes assistant replies and uploaded content. Context sharing can be disabled in settings. The original request is not truncated; handoffs over 30,000 characters are rejected with a recovery card.

## Privacy and permissions

- Only the `storage` API permission and a content script matching `https://chatgpt.com/*` are declared.
- Settings and destination mappings use `chrome.storage.local` and remain on the device.
- Handoff text uses `chrome.storage.session`, keyed by destination tab. It is not put in URLs, persistent local settings, analytics, or an external API.
- Handoffs become unusable after 30 minutes and are removed on their next lookup, on dismissal/submission, or when the destination closes. Chrome also clears session storage when the browser session ends. Expired entries may remain in session memory until one of those events.
- Text inserted into ChatGPT becomes visible to ChatGPT like any normal draft; sending it is your action.
- No broad `tabs` permission is needed for creating, activating, or closing the extension's destination tab.

## Files

- `manifest.json`: Manifest V3 definition.
- `core.js`: sample settings, URL validation, classifier, handoff builder.
- `content.js`: send interception, shadow-DOM cards, insertion, recovery.
- `background.js`: validates routes, opens tabs, stores handoffs, handles Undo.
- `popup.*`, `settings.*`, `ui.css`: controls and editable destinations.
- `tests/`: unit and browser-fixture checks, without dependencies.

No remote code, build system, or package installation is required. To replace the matcher with an asynchronous model, keep interception synchronous, hold the draft while classification runs, and preserve the error/Send here path. An external model would need a separately designed consent and credentials flow.

## Test

Automated logic tests (Node.js 18+):

```sh
node --test tests/*.test.cjs
```

Browser integration fixtures: open `tests/content.fixture.html` in Chrome. The page must show **ALL PASSED**. Add `?legacy=1` to exercise the old textarea and send-button markers, `?current=1` for the `Chat with ChatGPT` textarea and `Send message` button, or `?fallback=1#destination` for destination insertion when the composer has an unfamiliar label. Open with only `#destination` for the standard destination flow. These fixtures run the real content script against simulated composers and mocked Chrome APIs; they do not load the extension or connect to ChatGPT.

Manual checks on ChatGPT after loading the extension:

1. Configure Job Search and Paper 2 with two different real saved URLs. Start from a third conversation.
2. Send `Help me rewrite my resume for an interview`. Expect a new destination tab, with the original draft unsent.
3. Click **Undo routing**. Expect the original tab and intact draft.
4. Repeat, insert the handoff, review, and send. Expect one message only. The next draft should be classified normally.
5. Send `Improve my resume`. Expect a medium-confidence card. Click **Send here**, and check it sends once.
6. Send `Use my random matrix work in my resume`. Expect a suggestion rather than an automatic redirect because two destinations match.
7. Send `What is 2 + 2?`. Expect normal sending without a card.
8. In the saved Job Search conversation, send `resume interview`. Expect no redirect to itself.
9. Verify Shift+Enter creates a newline and composing Chinese text does not trigger premature routing.
10. Disable routing in the popup and verify sends are untouched. Disable automatic routing in settings and verify high matches become suggestions.
11. With an existing destination draft, try insertion: it should refuse to overwrite it. Check the handoff copy fallback.
12. Test a destination requiring sign-in/access. Return to the preserved source tab if the destination is unavailable; no message should have been posted by the extension.

## Compatibility and scope

The implementation uses the rendered ChatGPT page, not backend endpoints. ChatGPT's DOM is not a stable extension API. The composer, send button, and user-message selectors are centralized near their usage in `content.js`; they may require updates after a site redesign. The included browser fixtures and unit tests pass, but live authenticated ChatGPT behavior must be checked in your account after installation.

- Text only: attachments, voice, images, tools, and model selection do not transfer. Recognized attachment markers downgrade automatic routing to a suggestion, but marker detection is best-effort. Use **Send here** for uploads.
- Only the main composer and normal Enter, send-button click, and containing-form submit paths are covered. Edit-message flows and other send shortcuts are outside this MVP.
- Before settings load, or if the extension is unavailable, normal ChatGPT sending continues. A recognized route failure leaves the draft in place with a recovery card.
- Exact URL equality prevents routing to the same saved conversation. The MVP does not infer native Project membership from arbitrary conversation URLs.
- A source tab that has been closed cannot be restored by Undo; the destination stays open and reports the error.
- Tab-scoped handoffs avoid cross-tab text mixups. Hard refresh can redisplay an unconsumed handoff; insertion still refuses to overwrite a nonempty composer.
- Page redirects to a different URL or in-app navigation can prevent handoff display. Use a direct conversation URL and refresh the intended destination if needed.

Architecture references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage).
