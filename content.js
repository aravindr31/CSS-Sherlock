// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "deactivateInspector") {
        // Dispatch a custom event that inject.js can listen for
        document.dispatchEvent(new CustomEvent('deactivateInspector'));
    } else if (message.action === "getInspectorState") {
        // Return the current state of the inspector
        sendResponse({ 
            isActive: window.domInspectorActive || false 
        });
    } else if (message.action === "updateSettings") {
        // Update settings based on the message
        document.dispatchEvent(new CustomEvent('updateSettings', { detail: message.settings }));
        sendResponse({ success: true });
    }
    
    return true; // Keep the message channel open for async response
});