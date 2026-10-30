# Smart Chat Switcher · MVP

A local Chrome extension that intercepts ChatGPT text drafts at send time and offers the right saved conversation or Project. No build step, API key, backend, or external dependencies.

## Install

1. Keep this folder on your computer (unzip the download first if needed).
2. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the `smart-chat-switcher` folder containing `manifest.json`.
4. Open the extension popup and select **Manage destinations**.
5. Add Projects, paste their ChatGPT URLs, enter a purpose and supporting keywords, then select **Save settings**.
6. Copy the Project discovery prompt from Settings into ChatGPT. Paste its JSON-only proposal into the second Settings box, review the proposal, and apply it to the editor. Save only after reviewing the destinations.
7. Open or refresh a tab at `https://chatgpt.com` after installing or reloading the extension.

No sample Projects are prefilled. Add destinations manually or use the Project discovery prompt to prepare a proposal; enter and verify each destination URL yourself before enabling routing. No Chrome Web Store publishing is needed for local installation.

No sample Projects are prefilled. The discovery prompt asks ChatGPT to identify recurring workstreams from information genuinely available to it; it does not provide preset Project names, update memory, or activate routing. It asks for keywords in the user's commonly used languages, including natural synonyms and phrases actually used for the topic. The JSON uses the `scr-project-discovery-v1` schema and includes each candidate's status and evidence basis, plus any limitations. An empty `projects` array is valid and leaves settings unchanged.

Paste the proposal into **Review a discovery proposal**. The extension matches names against configured destinations; new entries receive local IDs and remain inactive drafts until you verify their names and URLs and explicitly activate them. Review status, evidence, keywords, limitations, and any proposed URL before applying to the editor, then use **Save settings** to persist. Existing configured IDs, URLs, and active states are preserved.

Supported URL shapes:

- `https://chatgpt.com/c/CONVERSATION_ID`
- `https://chatgpt.com/g/PROJECT_ID/project`
- `https://chatgpt.com/g/PROJECT_ID/c/CONVERSATION_ID`

Copy the actual URL from your account. These examples are shapes, not usable destinations. Query strings, fragments, external domains, and generic home URLs are rejected. For the smoothest handoff, use an existing conversation URL inside a Project. A Project landing page may require opening a chat composer before inserting.

## What happens when you send

| Match | Behavior |
| --- | --- |
| High | Shows a confirmation card. Confirming opens the destination in a new foreground tab and preserves your original draft. |
| Medium | Shows an in-page card with **Route with context**, **Send here**, and **Keep editing**. |
| Low / already at the saved URL | ChatGPT receives the send normally. |

Every switch requires your confirmation. At the destination, a card shows the source conversation title and current request for review. The model-facing handoff does not include a URL, ID, summary, or source messages. If the title is unavailable, enter it or choose **Use current request only**. Click **Insert reviewed handoff** to fill the composer, then press ChatGPT's Send button to submit. **Undo routing** closes the extension-created destination tab and returns to the original tab and its draft.

The source tab remains open. Returning to it does not automatically send anything. **Send here instead** explicitly sends the source draft there. Existing drafts at the destination are never overwritten; copy the handoff manually if you want to append it. If insertion is unsupported, the card's text box can be selected and copied.

This is user-confirmed routing followed by user-controlled final sending. It does not move chat history, create native folders, or automatically post the message in the destination. The model-facing handoff contains the source title and current request only; it does not include copied context or promise access to another conversation.

## Local matcher

`core.js` exposes `classify(message, projects, currentURL)` as the replaceable classifier boundary.

- Exact Project-name match or two distinct configured keyword matches, without competing Project hits → high (0.95).
- One keyword match → medium (0.75).
- Any competing destination hits → medium (0.70).
- No match → low.
- The highest-scoring destination's exact saved URL matches the current page → stay.

Numbers describe heuristic strength, **not calibrated probabilities**. English keywords use word boundaries. Keyword frequency does not boost a score. Only active, confirmed destinations with valid URLs participate. The local matcher does not reason about purpose, negation, quotations, or topic shifts; it only creates a confirmation suggestion. For example, the local matcher may still match “do not discuss my resume” because it contains “resume.” Assistant-generated `scr-route` suggestions are checked against the exact protocol and require user confirmation.

Context handoff is title-only: it includes the original conversation title when available and the exact unsent request. It does not copy source history or send a URL, conversation ID, or summary to the model. If the title is unavailable, the user can enter one at the destination or continue with the request only. Internal source tab/URL data is retained only for navigation and Undo.

## Privacy and permissions

- Only the `storage` API permission and a content script matching `https://chatgpt.com/*` are declared.
- Settings and destination mappings use `chrome.storage.local` and remain on the device.
- The title-only handoff package uses `chrome.storage.session`, keyed to the intended destination tab. It contains no source URL, ID, summary, or copied conversation history.
- Handoffs expire after 30 minutes and are removed on cancellation or when the destination tab closes. Chrome also clears session storage when the browser session ends.
- Text inserted into ChatGPT becomes visible to ChatGPT like any normal draft; sending it is your action.
- No broad `tabs` permission is needed for creating, activating, or closing the extension's destination tab.

## Files

- `manifest.json`: Manifest V3 definition.
- `core.js`: empty defaults, URL validation, classifier, discovery importer, handoff builder.
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

Browser integration fixtures: open `tests/content.fixture.html` in Chrome. The page must show **ALL PASSED**. Add `?legacy=1` for old composer markers, `?current=1` for the current labeled textarea, `?fallback=1#destination` for an unfamiliar composer label, or `?newchat=1#destination` for a new-chat editor. Open with only `#destination` for title-only handoff review and insertion checks.

Manual checks on ChatGPT after loading the extension:

1. Add two real destinations with different saved URLs. Start from a third conversation.
2. Send `Help me rewrite my resume for an interview`. Expect a confirmation card. Confirm it to open the destination tab; the original draft remains unsent.
3. Click **Undo routing**. Expect the original tab and intact draft.
4. Repeat, insert the handoff, review, and send. Expect one message only. The next draft should be classified normally.
5. Send `Improve my resume`. Expect a medium-confidence card. Click **Send here**, and check it sends once.
6. Send `Use my random matrix work in my resume`. Expect a local confirmation suggestion because multiple destinations match.
7. Send `What is 2 + 2?`. Expect normal sending without a card.
8. In the saved Job Search conversation, send `resume interview`. Expect no redirect to itself.
9. Verify Shift+Enter creates a newline and composing Chinese text does not trigger premature routing.
10. Disable routing in the popup and verify sends are untouched. Verify every route suggestion requires confirmation; no confidence level switches automatically.
11. With an existing destination draft, try insertion: it should refuse to overwrite it. Check the handoff copy fallback.
12. Test a destination requiring sign-in/access. Return to the preserved source tab if the destination is unavailable; no message should have been posted by the extension.

## Compatibility and scope

The implementation reads page title and URL metadata internally, but the model-facing handoff contains only the title and current request. It does not inspect source conversation messages or call backend endpoints.

- Text only: attachments, voice, images, tools, and model selection do not transfer. Recognized attachment markers are best-effort; review them before confirming a route. Use **Send here** for uploads.
- Only the main composer and normal Enter, send-button click, and containing-form submit paths are covered. Edit-message flows and other send shortcuts are outside this MVP.
- Before settings load, or if the extension is unavailable, normal ChatGPT sending continues. A recognized route failure leaves the draft in place with a recovery card.
- Exact URL equality prevents routing to the same saved conversation. The MVP does not infer native Project membership from arbitrary conversation URLs.
- A source tab that has been closed cannot be restored by Undo; the destination stays open and reports the error.
- Tab-scoped handoffs avoid cross-tab text mixups. Hard refresh can redisplay an unconsumed handoff; insertion still refuses to overwrite a nonempty composer.
- Page redirects to a different URL or in-app navigation can prevent handoff display. Use a direct conversation URL and refresh the intended destination if needed.

Architecture references: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage).
