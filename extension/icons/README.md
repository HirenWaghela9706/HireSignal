# Extension Icons

Add `icon48.png` (48x48) and optionally `icon16.png`, `icon128.png` for the Chrome extension.

To add icons, update `manifest.json`:
```json
"action": {
  "default_popup": "src/popup/popup.html",
  "default_icon": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```
