# Changelog

## 0.2.2

- Added first-use page-data disclosure and consent, moved assistant-suggestion deduplication to bounded extension session storage, and clarified data handling and retention.
- Removed visible Project scanning and its background/session-storage path; Projects are configured manually.
- Improved Project discovery prompts with multilingual keywords and topic-specific synonyms.
- Added Smart Chat Switcher extension icons and prompt customization guidance.

## 0.2.1

- Removed prefilled sample Projects from fresh installs; removes only untouched legacy sample placeholders during migration while preserving customized destinations.
- Replaced the memory activation prompt with a JSON-only Project discovery prompt based on work ChatGPT can genuinely identify; no preset Projects are included.
- Added review-first import for `scr-project-discovery-v1`, including limitations, empty-result no-op behavior, evidence/status display, and inactive drafts for new candidates.
- Preserves configured IDs, URLs, and active states; new proposals stay inactive until reviewed and explicitly enabled by the user.
- Removed visible Project scanning; Project destinations are added and verified manually.

## 0.2.0

- Made the built-in product and prompts English-only while preserving user-supplied Project names and purposes.
- Changed model-facing handoff to source title plus the exact current request only; removed URL, ID, summaries, and source messages from the handoff text.
- Added optional title entry/request-only fallback, strict `scr-route` suggestion validation with user confirmation and duplicate suppression, and validation of ChatGPT-returned registry proposals.
- Added an activation prompt that requests persistent memory honestly, onboarding copy/acknowledgement that never claims memory was verified, and settings migration for stable Project metadata.

## 0.1.9

- Added local editable keyword suggestions based on user-entered destination names.

## 0.1.8

- Replaced history copying with a reference-only handoff containing source title, URL, conversation ID when available, and the exact unsent request.
- Stored the uniquely identified package in `chrome.storage.session` before navigation and kept the existing destination-tab isolation and manual review/submit flow.
- Explicitly asks the destination not to fabricate source context if the referenced conversation is inaccessible.
- Removed DOM history extraction and the session conversation buffer. Added reference-format tests and documented that live retrieval accuracy remains unverified without an authenticated account.

## 0.1.6

- Normalized whitespace when verifying inserted handoff text so ChatGPT editor paragraph and line-break rendering does not produce a false insertion failure.
- Kept full-text and order verification, and added a fixture that converts handoff lines into editor paragraphs.

## 0.1.5

- Read prior user messages from both `data-message-author-role="user"` and `data-turn="user"` markers.
- Report the number of prior user-message excerpts included in the source-tab route confirmation, or explain when none were detected or sharing is disabled.
- Added integration coverage for the alternate user-turn marker and captured handoff context.

## 0.1.4

- Improved extraction of prior user-message text and made the successful route card report how many excerpts were included, or explain when none were detected.
- Added a browser fixture assertion that prior conversation text is present in the handoff.

## 0.1.3

- Remembered the last focused visible chat editor in the main page so handoffs can be inserted into a newly started conversation after focus moves to the extension card.
- Added a conservative focused-editor fallback for new chats without a detectable Send button.
- Kept existing-draft protection and added a new-chat insertion fixture.

## 0.1.2

- Improved destination composer detection for handoff insertion. If known ChatGPT selectors do not match, the extension accepts only a unique visible editor inside the main chat form that contains a recognized ChatGPT Send button.
- Kept existing-draft protection: handoff insertion refuses to overwrite a non-empty destination composer.
- Added a browser fixture for destination composers with unfamiliar labels and documented the fixture variants.
- Updated the extension version to 0.1.2.

## 0.1.1

- Added support for ChatGPT's id-less `contenteditable` composer and aria-labeled Send button, while retaining older textarea and send-button selectors.
- Scoped send interception and the Send here action to the visible composer and its form to avoid unrelated editors and buttons.
- Added simulated browser coverage for modern, legacy, and current ChatGPT composer structures, routing confidence levels, draft preservation, Enter behavior, IME composition, Undo, and loop prevention.
- Updated the extension version to 0.1.1.

## 0.1.0

- Initial private repository upload and first extension version.