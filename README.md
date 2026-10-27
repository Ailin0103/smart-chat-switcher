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

At the destination, a card shows the source reference and request for review. Edit the text or choose **Use request only**, then click **Insert reviewed handoff**. This only fills the composer; press ChatGPT's Send button to submit. If you clear the draft before sending, **Reinsert handoff** restores the reviewed text. **Undo routing** closes the extension-created destination tab and returns to the original tab and its draft; it cannot retract a message already sent.

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

Context handoff is reference-based: it includes the source conversation title, URL, conversation ID when present, and the exact unsent request. It does not copy source history or assume that ChatGPT can access a URL or ID. The destination prompt asks ChatGPT to retrieve the source only if accessible and to state when it cannot. The package is stored temporarily in `chrome.storage.session` for the intended destination tab, written before navigation, and never saved in persistent settings or URLs. Turn off **Include a reference to the source conversation** to send only the request.

## Privacy and permissions

- Only the `storage` API permission and a content script matching `https://chatgpt.com/*` are declared.
- Settings and destination mappings use `chrome.storage.local` and remain on the device.
- The reference handoff package uses `chrome.storage.session`, keyed to the intended destination tab. It contains only source metadata and the unsent request, not copied conversation history.
- Handoffs expire after 30 minutes and are removed on cancellation or when the destination tab closes. Chrome also clears session storage when the browser session ends.
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

Browser integration fixtures: open `tests/content.fixture.html` in Chrome. The page must show **ALL PASSED**. Add `?legacy=1` for old composer markers, `?current=1` for the current labeled textarea, `?fallback=1#destination` for an unfamiliar composer label, or `?newchat=1#destination` for a new-chat editor. Open with only `#destination` for source-reference review and insertion checks. Fixtures verify prompt contents and routing only; they cannot establish whether ChatGPT can retrieve another conversation. See [CONTEXT_REFERENCE_TEST.md](CONTEXT_REFERENCE_TEST.md) for the retrieval evaluation and status.

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

The implementation reads page title and URL metadata only; it does not inspect conversation message DOM or call backend endpoints. ChatGPT is not guaranteed to expose one conversation to another. A reference is not proof of retrieval. The included fixtures and unit tests test package formatting and routing, not ChatGPT's cross-conversation retrieval ability.

- Text only: attachments, voice, images, tools, and model selection do not transfer. Recognized attachment markers downgrade automatic routing to a suggestion, but marker detection is best-effort. Use **Send here** for uploads.
- Only the main composer and normal Enter, send-button click, and containing-form submit paths are covered. Edit-message flows and other send shortcuts are outside this MVP.
- Before settings load, or if the extension is unavailable, normal ChatGPT sending continues. A recognized route failure leaves the draft in place with a recovery card.
- Exact URL equality prevents routing to the same saved conversation. The MVP does not infer native Project membership from arbitrary conversation URLs.
- A source tab that has been closed cannot be restored by Undo; the destination stays open and reports the error.
- Tab-scoped handoffs avoid cross-tab text mixups. Hard refresh can redisplay an unconsumed handoff; insertion still refuses to overwrite a nonempty composer.
- Page redirects to a different URL or in-app navigation can prevent handoff display. Use a direct conversation URL and refresh the intended destination if needed.

Architecture references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage).
