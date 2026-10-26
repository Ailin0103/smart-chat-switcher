# Changelog

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