# CSS Sherlock

CSS Sherlock is a browser extension that helps you investigate and analyze CSS styles on web pages. Like its namesake detective, it helps you uncover and understand the CSS styling mysteries of any webpage.

## Features

- Inspect and analyze CSS styles on any webpage
- Easy-to-use popup interface
- Sidebar view for detailed CSS information
- Icon available in multiple resolutions (16px, 32px, 48px, 128px)

## Installation

1. Clone this repository or download the source code
2. Open your browser's extension management page
   - For Chrome: navigate to `chrome://extensions/`
   - For Firefox: navigate to `about:addons`
3. Enable Developer Mode
4. Load the extension:
   - For Chrome: Click "Load unpacked" and select the extension directory

## Project Structure

```
├── content.js          # Content script that runs on web pages
├── inject.js           # Injection script for the extension
├── manifest.json       # Extension manifest file
├── popup.html         # Popup interface HTML
├── popup.js           # Popup functionality
├── service-worker.js  # Service worker for background tasks
├── sidebar.css        # Styles for the sidebar interface
└── icons/            # Extension icons
    ├── icon.svg
    ├── icon128.png
    ├── icon16.png
    ├── icon32.png
    └── icon48.png
```

## Usage

1. Click on the CSS Sherlock extension icon in your browser toolbar
2. Use the popup interface to start inspecting CSS on the current webpage
3. The sidebar will show detailed information about the selected elements' CSS properties

## License

This project is licensed under the terms included in the [LICENSE](LICENSE) file.

## Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

---

Developed with ❤️ by [aravindr31](https://github.com/aravindr31)
