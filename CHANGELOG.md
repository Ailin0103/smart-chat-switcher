# Changelog

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