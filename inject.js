(function () {

    // Settings management
    let settings = {
        selectionStyle: 'outline',
        highlightColor: '#2563eb',
        aiModel: 'gpt-4'
    };

    let aiConfig = {
        provider: 'none',
        apiKey: '',
        model: '',
        baseUrl: '',
        isConfigured: false
    };

    // Listen for settings updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log(message)
        if (message.action === "updateSettings") {
            settings = { ...settings, ...message.settings };
        }
        if(message.action === "updateSettings" && message.settings.ai) {
            aiConfig = { ...aiConfig, ...message.settings.ai };
        }
    });

    // Check if inspector is already active and clean up first
    if (window.domInspectorActive) {
        deactivateExistingInspector();
    }

    let mouseOverHandler, clickHandler, closeButtonHandler, keyHandler;
    let currentOutlinedElement = null;
    let tooltip = null;
    let selectedElements = [];
    let isMultiSelectMode = false;
    
    // Store handlers globally so they can be accessed from other script executions
    window.domInspectorHandlers = {
        mouseOverHandler: null,
        clickHandler: null,
        closeButtonHandler: null,
        keyHandler: null
    };

    // AI Configuration Modal Functions
    function createAIConfigModal() {
        const modal = document.createElement('div');
        modal.id = 'ai-config-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(20, 20, 30, 0.92);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2147483649;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: #181a20; border-radius: 14px; padding: 28px 24px; width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.45); border: 1px solid #23262f;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px;">
                    <h2 style="margin: 0; color: #f3f4f6; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">AI Configuration</h2>
                    <button id="close-ai-config" style="background: none; border: none; font-size: 28px; cursor: pointer; color: #a1a1aa; transition: color 0.2s;">&times;</button>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1;">AI Provider:</label>
                    <select id="ai-provider" style="width: 100%; padding: 10px; background: #23262f; color: #f3f4f6; border: 1px solid #313442; border-radius: 7px; font-size: 15px; outline: none;">
                        <option value="none">None (Disable AI)</option>
                        <option value="openai">OpenAI (ChatGPT)</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="claude">Anthropic Claude</option>
                        <option value="ollama">Local Ollama</option>
                    </select>
                </div>

                <div id="api-key-section" style="margin-bottom: 20px; display: none;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1;">API Key:</label>
                    <input type="password" id="ai-api-key" placeholder="Enter your API key" 
                           style="width: 100%; padding: 10px; background: #23262f; color: #f3f4f6; border: 1px solid #313442; border-radius: 7px; font-size: 15px; outline: none;">
                    <small style="color: #71717a; font-size: 12px;">Your API key is stored locally and never sent to third parties</small>
                </div>

                <div id="ollama-url-section" style="margin-bottom: 20px; display: none;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1;">Ollama Base URL:</label>
                    <input type="text" id="ollama-url" value="" 
                           style="width: 100%; padding: 10px; background: #23262f; color: #f3f4f6; border: 1px solid #313442; border-radius: 7px; font-size: 15px; outline: none;">
                </div>

                <div id="model-section" style="margin-bottom: 20px; display: none;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #cbd5e1;">Model:</label>
                    <select id="ai-model" style="width: 100%; padding: 10px; background: #23262f; color: #f3f4f6; border: 1px solid #313442; border-radius: 7px; font-size: 15px; outline: none;">
                        <option value="">Select a model</option>
                    </select>
                </div>

                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="test-ai-connection" style="padding: 10px 18px; background: #2563eb; color: #fff; border: none; border-radius: 7px; cursor: pointer; font-size: 15px; font-weight: 600; box-shadow: 0 2px 8px rgba(37,99,235,0.12); transition: background 0.2s;" disabled>
                        Test Connection
                    </button>
                    <button id="save-ai-config" style="padding: 10px 18px; background: #10b981; color: #fff; border: none; border-radius: 7px; cursor: pointer; font-size: 15px; font-weight: 600; box-shadow: 0 2px 8px rgba(16,185,129,0.12); transition: background 0.2s;">
                        Save Configuration
                    </button>
                </div>

                <div id="ai-status-message" style="margin-top: 18px; padding: 13px; border-radius: 7px; display: none; background: #23262f; color: #f3f4f6; font-size: 14px;"></div>
            </div>
        `;

        document.body.appendChild(modal);
        setupAIConfigModal();
    }

    function setupAIConfigModal() {
        const modal = document.getElementById('ai-config-modal');
        const providerSelect = document.getElementById('ai-provider');
        const apiKeySection = document.getElementById('api-key-section');
        const ollamaUrlSection = document.getElementById('ollama-url-section');
        const modelSection = document.getElementById('model-section');
        const modelSelect = document.getElementById('ai-model');
        const testBtn = document.getElementById('test-ai-connection');
        const saveBtn = document.getElementById('save-ai-config');
        const statusDiv = document.getElementById('ai-status-message');

        // Load saved configuration
        loadAIConfig();
        providerSelect.value = aiConfig.provider;
        document.getElementById('ai-api-key').value = aiConfig.apiKey;
        document.getElementById('ollama-url').value = aiConfig.baseUrl;

        providerSelect.addEventListener('change', (e) => {
            const provider = e.target.value;
            
            apiKeySection.style.display = ['openai', 'gemini', 'claude'].includes(provider) ? 'block' : 'none';
            ollamaUrlSection.style.display = provider === 'ollama' ? 'block' : 'none';
            modelSection.style.display = provider !== 'none' ? 'block' : 'none';
            
            updateModelOptions(provider);
            testBtn.disabled = provider === 'none';
        });

        // Trigger initial setup
        providerSelect.dispatchEvent(new Event('change'));

        document.getElementById('close-ai-config').addEventListener('click', () => modal.remove());
        
        testBtn.addEventListener('click', testAIConnection);
        saveBtn.addEventListener('click', () => {
            saveAIConfiguration();
            modal.remove();
        });

        // Close modal on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    function updateModelOptions(provider) {
        const modelSelect = document.getElementById('ai-model');
        modelSelect.innerHTML = '<option value="">Select a model</option>';

        const models = {
            openai: [
                { value: 'gpt-4o', text: 'GPT-4o (Recommended)' },
                { value: 'gpt-4o-mini', text: 'GPT-4o Mini' },
                { value: 'gpt-4-turbo', text: 'GPT-4 Turbo' },
                { value: 'gpt-3.5-turbo', text: 'GPT-3.5 Turbo' }
            ],
            gemini: [
                { value: 'gemini-1.5-pro', text: 'Gemini 1.5 Pro (Recommended)' },
                { value: 'gemini-1.5-flash', text: 'Gemini 1.5 Flash' },
                { value: 'gemini-pro', text: 'Gemini Pro' }
            ],
            claude: [
                { value: 'claude-3-5-sonnet-20241022', text: 'Claude 3.5 Sonnet (Recommended)' },
                { value: 'claude-3-haiku-20240307', text: 'Claude 3 Haiku' }
            ],
            ollama: [
                { value: 'llama3.2', text: 'Llama 3.2' },
                { value: 'llama3.1', text: 'Llama 3.1' },
                { value: 'codellama', text: 'Code Llama' },
                { value: 'mistral', text: 'Mistral' },
                { value: 'custom', text: 'Custom Model Name' }
            ]
        };

        if (models[provider]) {
            models[provider].forEach(model => {
                const option = document.createElement('option');
                option.value = model.value;
                option.textContent = model.text;
                modelSelect.appendChild(option);
            });
        }

        // Set saved model if available
        if (aiConfig.model) {
            modelSelect.value = aiConfig.model;
        }

        // Handle custom model input for Ollama
        if (provider === 'ollama') {
            modelSelect.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    const customModel = prompt('Enter custom model name:');
                    if (customModel) {
                        const option = document.createElement('option');
                        option.value = customModel;
                        option.textContent = customModel;
                        option.selected = true;
                        modelSelect.insertBefore(option, modelSelect.lastElementChild);
                    }
                }
            });
        }
    }

    async function testAIConnection() {
        const statusDiv = document.getElementById('ai-status-message');
        const testBtn = document.getElementById('test-ai-connection');
        
        testBtn.disabled = true;
        testBtn.textContent = 'Testing...';
        
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#fef3c7';
        statusDiv.style.color = '#92400e';
        statusDiv.textContent = 'Testing connection...';

        try {
            const provider = document.getElementById('ai-provider').value;
            const apiKey = document.getElementById('ai-api-key').value;
            const model = document.getElementById('ai-model').value;
            const ollamaUrl = document.getElementById('ollama-url').value;

            const testResult = await testAIProvider(provider, apiKey, model, ollamaUrl);
            
            if (testResult.success) {
                statusDiv.style.background = '#d1fae5';
                statusDiv.style.color = '#065f46';
                statusDiv.textContent = testResult.message;
            } else {
                statusDiv.style.background = '#fee2e2';
                statusDiv.style.color = '#991b1b';
                statusDiv.textContent = testResult.message;
            }
        } catch (error) {
            statusDiv.style.background = '#fee2e2';
            statusDiv.style.color = '#991b1b';
            statusDiv.textContent = `Test failed: ${error.message}`;
        }

        testBtn.disabled = false;
        testBtn.textContent = 'Test Connection';
    }

    async function testAIProvider(provider, apiKey, model, baseUrl) {
        const testPrompt = "Respond with `AI connection successful` if you can see this message.";
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'callAI',
                provider,
                prompt: testPrompt,
                model,
                apiKey,
                baseUrl
            });
            
            if (response.success) {
                const result = response.response;
                if (result.toLowerCase().includes('ai connection successful') || result.toLowerCase().includes('successful')) {
                    return { success: true, message: 'Connection successful!' };
                } else {
                    return { success: true, message: 'Connected, but unexpected response. Should still work.' };
                }
            } else {
                return { success: false, message: response.error };
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    function loadAIConfig() {
        try {
            const saved = localStorage.getItem('dom-inspector-ai-config');
            if (saved) {
                aiConfig = { ...aiConfig, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Failed to load AI config:', e);
        }
    }

    function saveAIConfiguration() {
        const provider = document.getElementById('ai-provider').value;
        const apiKey = document.getElementById('ai-api-key').value;
        const model = document.getElementById('ai-model').value;
        const baseUrl = document.getElementById('ollama-url').value;

        aiConfig = {
            provider,
            apiKey,
            model,
            baseUrl,
            isConfigured: provider !== 'none' && model !== ''
        };

        try {
            localStorage.setItem('dom-inspector-ai-config', JSON.stringify(aiConfig));
            showAIStatus(aiConfig.isConfigured ? `🤖 ${provider.toUpperCase()} Ready` : '🤖 AI Disabled');
            showNotification('AI configuration saved!');
        } catch (e) {
            console.warn('Failed to save AI config:', e);
            showNotification('Failed to save AI configuration', 'error');
        }
    }

    async function callAI(prompt, provider = aiConfig.provider, apiKey = aiConfig.apiKey, model = aiConfig.model, baseUrl = aiConfig.baseUrl) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'callAI',
            provider,
            prompt,
            model,
            apiKey,
            baseUrl
        });
        
        if (response.success) {
            return response.response;
        } else {
            throw new Error(response.error);
        }
    } catch (error) {
        console.error('AI API call failed:', error);
        throw error;
    }
}

    function showAIStatus(status) {
        const statusBar = document.getElementById('ai-status-bar');
        if (statusBar) {
            statusBar.textContent = status;
        }
    }

    async function analyzeElementWithAI(element) {
        if (!aiConfig.isConfigured) {
            return "AI analysis not available. Click the 'Configure AI' button to set up your AI provider.";
        }

        try {
            const elementInfo = {
                tag: element.tagName.toLowerCase(),
                id: element.id || 'none',
                classes: element.className || 'none',
                text: element.textContent?.substring(0, 200) + (element.textContent?.length > 200 ? '...' : '') || 'no text',
                attributes: Array.from(element.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' '),
                parent: element.parentElement?.tagName?.toLowerCase() || 'none',
                children: element.children.length
            };

            const prompt = `Analyze this HTML element and provide insights:

Tag: ${elementInfo.tag}
ID: ${elementInfo.id}
Classes: ${elementInfo.classes}
Text: ${elementInfo.text}
Attributes: ${elementInfo.attributes}
Parent: ${elementInfo.parent}
Child elements: ${elementInfo.children}

Please provide:
1. Best CSS Selctor which can be used to get the element via javascript code

Keep the response concise and practical.`;

            const response = await callAI(prompt);
            return response;
        } catch (error) {
            console.error('AI analysis failed:', error);
            return `AI analysis failed: ${error.message}`;
        }
    }

    function addAIStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .ai-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid #e5e7eb;
                border-top: 2px solid #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            #analyze-ai-btn:disabled,
            #configure-ai-btn:disabled {
                background: #6b7280 !important;
                cursor: not-allowed !important;
            }
            
            .ai-config-section {
                margin-bottom: 16px;
                padding: 12px;
                background: #f8fafc;
                border-radius: 6px;
                border: 1px solid #e2e8f0;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize AI configuration
    function initializeAI() {
        loadAIConfig();
        if (aiConfig.isConfigured) {
            showAIStatus(`🤖 ${aiConfig.provider.toUpperCase()} Ready`);
        } else {
            showAIStatus('🤖 AI Not Configured');
        }
    }

    // YOUR EXISTING EVENT HANDLERS - KEEP THESE
    mouseOverHandler = e => {
        if (e.target.id !== 'dom-inspector-sidebar' && !e.target.closest('#dom-inspector-sidebar')) {
            // Clear previous outline
            if (currentOutlinedElement) {
                currentOutlinedElement.style.outline = "";
                currentOutlinedElement.style.outlineOffset = "";
            }
            
            // Apply new outline
            e.target.style.outline = "2px solid #2563eb";
            e.target.style.outlineOffset = "2px";
            currentOutlinedElement = e.target;
            
            showTooltip(e.target, e.pageX, e.pageY);
        }
    };

    const mouseLeaveHandler = e => {
        if (currentOutlinedElement && !e.target.closest('#dom-inspector-sidebar')) {
            currentOutlinedElement.style.outline = "";
            currentOutlinedElement.style.outlineOffset = "";
            currentOutlinedElement = null;
            hideTooltip();
        }
    };

    clickHandler = e => {
        if (e.target.id !== 'dom-inspector-sidebar' && !e.target.closest('#dom-inspector-sidebar')) {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.ctrlKey || e.metaKey) {
                toggleElementSelection(e.target);
            } else {
                selectElement(e.target);
            }
        }
    };

    keyHandler = e => {
        if (e.key === 'Escape') {
            deactivateInspector();
        } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            copyCurrentSelector();
        } else if (e.key === 'h') {
            toggleVisibility();
        } else if (e.key === 'm') {
            isMultiSelectMode = !isMultiSelectMode;
            updateStatus();
        }
    };

    closeButtonHandler = (e) => {
        console.log("Close button clicked");
        e.preventDefault();
        e.stopPropagation();
        deactivateInspector();
    };

    // Store handlers globally
    window.domInspectorHandlers = { mouseOverHandler, clickHandler, closeButtonHandler, keyHandler, mouseLeaveHandler };

    // YOUR EXISTING FUNCTIONS - KEEP THESE
    function deactivateExistingInspector() {
        try {
            if (window.domInspectorHandlers) {
                Object.values(window.domInspectorHandlers).forEach(handler => {
                    if (handler) {
                        document.removeEventListener("mouseover", handler, true);
                        document.removeEventListener("click", handler, true);
                        document.removeEventListener("mouseleave", handler, true);
                        document.removeEventListener("keydown", handler, true);
                    }
                });
            }
            
            const existingSidebar = document.getElementById("dom-inspector-sidebar");
            const existingTooltip = document.getElementById("dom-inspector-tooltip");
            
            if (existingSidebar) existingSidebar.remove();
            if (existingTooltip) existingTooltip.remove();
            
            document.querySelectorAll('*').forEach(el => {
                el.style.outline = "";
                el.style.outlineOffset = "";
            });
            
            window.domInspectorActive = false;
        } catch (e) {
            console.error("Error cleaning up existing inspector:", e);
        }
    }

    document.addEventListener('deactivateInspector', deactivateInspector);
    window.domInspectorActive = true;

    function createSidebar() {
        const existingSidebar = document.getElementById("dom-inspector-sidebar");
        if (existingSidebar) {
            existingSidebar.remove();
        }

        const sidebar = document.createElement("div");
        sidebar.id = "dom-inspector-sidebar";
        sidebar.innerHTML = `
                <div class="dis-header">
                <div class="dis-header-title">
                <span>CSS Sherlock</span>
                <p class="ai-status-bar"></p>
                </div>
                <div class="button-container">
                    <button id="dis-minimize" title="Minimize (H)">−</button>
                    <button id="dis-close" title="Close (ESC)">&times;</button>
                </div>
                </div>

                <div id="dis-info">
                <div style="text-align: center; padding: 40px 20px; color: #888;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                    <div style="font-size: 16px; margin-bottom: 8px;">Click any element to inspect</div>
                    <div style="font-size: 12px; line-height: 1.5;">
                    <div><kbd>Ctrl+Click</kbd> Multi-select</div>
                    <div><kbd>Ctrl+C</kbd> Copy selector</div>
                    <div><kbd>H</kbd> Toggle visibility</div>
                    <div><kbd>ESC</kbd> Close inspector</div>
                    </div>
                </div>
                </div>
        `;
        
        document.body.appendChild(sidebar);

        document.getElementById("dis-close").addEventListener("click", closeButtonHandler, true);
        document.getElementById("dis-minimize").addEventListener("click", toggleVisibility, true);
    }

    function createTooltip() {
        tooltip = document.createElement("div");
        tooltip.id = "dom-inspector-tooltip";
        tooltip.className = "dom-inspector-tooltip";
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-family: monospace;
            pointer-events: none;
            z-index: 2147483647;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            max-width: 300px;
            word-break: break-all;
            display: none;
        `;
        document.body.appendChild(tooltip);
    }

    function showTooltip(element, x, y) {
        if (!tooltip) return;
        
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
        const text = element.textContent?.substring(0, 50) + (element.textContent?.length > 50 ? '...' : '');
        
        tooltip.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${tag}${id}${classes}</div>
            ${text ? `<div style="opacity: 0.8; font-size: 11px;">${text}</div>` : ''}
        `;
        
        tooltip.style.display = 'block';
        tooltip.style.left = Math.min(x + 10, window.innerWidth - tooltip.offsetWidth - 10) + 'px';
        tooltip.style.top = Math.min(y - 10, window.innerHeight - tooltip.offsetHeight - 10) + 'px';
    }

    function hideTooltip() {
        if (tooltip) tooltip.style.display = 'none';
    }

    function selectElement(element) {
        selectedElements = [element];
        updateSidebar(element);
    }

    function toggleElementSelection(element) {
        const index = selectedElements.indexOf(element);
        if (index > -1) {
            selectedElements.splice(index, 1);
        } else {
            selectedElements.push(element);
        }
        
        if (selectedElements.length > 0) {
            updateSidebar(selectedElements[selectedElements.length - 1]);
        }
    }

    function toggleVisibility() {
        const sidebar = document.getElementById("dom-inspector-sidebar");
        if (sidebar) {
            const isMinimized = sidebar.style.transform === 'translateX(calc(100% - 60px))';
            sidebar.style.transform = isMinimized ? 'translateX(0)' : 'translateX(calc(100% - 60px))';
        }
    }

    function copyCurrentSelector() {
        if (selectedElements.length > 0) {
            const selector = getOptimizedSelector(selectedElements[0]);
            navigator.clipboard.writeText(selector);
            showNotification('Selector copied to clipboard!');
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: ${bgColor};
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            z-index: 2147483648;
            backdrop-filter: blur(10px);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 2000);
    }

    function deactivateInspector() {
        console.log("Deactivating inspector");
        
        if (!window.domInspectorActive) {
            return;
        }
        
        try {
            document.removeEventListener("mouseover", mouseOverHandler, true);
            document.removeEventListener("click", clickHandler, true);
            document.removeEventListener("mouseleave", mouseLeaveHandler, true);
            document.removeEventListener("keydown", keyHandler, true);
            document.removeEventListener('deactivateInspector', deactivateInspector);
            
            if (currentOutlinedElement) {
                currentOutlinedElement.style.outline = "";
                currentOutlinedElement.style.outlineOffset = "";
                currentOutlinedElement = null;
            }
            
            document.querySelectorAll('*').forEach(el => {
                if (el.style.outline) {
                    el.style.outline = "";
                    el.style.outlineOffset = "";
                }
            });
            
            const sidebar = document.getElementById("dom-inspector-sidebar");
            if (sidebar) {
                const closeButton = document.getElementById("dis-close");
                if (closeButton) {
                    closeButton.removeEventListener("click", closeButtonHandler, true);
                }
                
                sidebar.style.animation = "slideOut 0.2s cubic-bezier(0.16, 1, 0.3, 1)";
                
                const removeElement = () => {
                    if (sidebar && sidebar.parentNode) {
                        sidebar.remove();
                    }
                };
                
                sidebar.addEventListener("animationend", removeElement, { once: true });
                setTimeout(removeElement, 300);
            }

            // Clean up tooltip
            if (tooltip && tooltip.parentNode) {
                tooltip.remove();
            }
            
            selectedElements = [];
            currentOutlinedElement = null;
            tooltip = null;
            
            window.domInspectorActive = false;
            window.domInspectorHandlers = null;
            
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({ action: "deactivateInspector" }).catch(() => {});
                }
            } catch (e) {
                console.log("Chrome runtime not available:", e);
            }
        } catch (e) {
            console.error("Error in deactivateInspector:", e);
            const sidebar = document.getElementById("dom-inspector-sidebar");
            if (sidebar && sidebar.parentNode) {
                sidebar.remove();
            }
            window.domInspectorActive = false;
            window.domInspectorHandlers = null;
        }
    }

    // YOUR EXISTING HELPER FUNCTIONS - KEEP THESE
    function getOptimizedSelector(el) {
        if (el.id) return `#${el.id}`;
        
        let selector = el.tagName.toLowerCase();
        if (el.className) {
            const classes = [...el.classList].filter(c => !c.startsWith('dom-inspector'));
            if (classes.length > 0) {
                selector += '.' + classes.join('.');
            }
        }
        
        const parent = el.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(child => 
                child.tagName === el.tagName && 
                child.className === el.className
            );
            
            if (siblings.length > 1) {
                const index = siblings.indexOf(el) + 1;
                selector += `:nth-child(${index})`;
            }
        }
        
        return selector;
    }

    function getXPath(el) {
        if (el.id) return `//*[@id="${el.id}"]`;
        if (el === document.body) return '/html/body';
        let ix = 0;
        const siblings = el.parentNode ? el.parentNode.childNodes : [];
        for (let i = 0; i < siblings.length; i++) {
            const sib = siblings[i];
            if (sib === el) return getXPath(el.parentNode) + '/' + el.tagName.toLowerCase() + `[${ix + 1}]`;
            if (sib.nodeType === 1 && sib.tagName === el.tagName) ix++;
        }
    }

    function getFullXPath(el) {
        if (el.nodeType === Node.DOCUMENT_NODE) return '';
        const index = Array.from(el.parentNode.children).indexOf(el) + 1;
        return getFullXPath(el.parentNode) + '/' + el.tagName + '[' + index + ']';
    }

    function getJSPath(el) {
        const path = [];
        while (el) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) selector += `#${el.id}`;
            else if (el.className) selector += '.' + [...el.classList].join('.');
            path.unshift(selector);
            el = el.parentElement;
        }
        return 'document.querySelector("' + path.join(' > ') + '")';
    }

    // MODIFIED updateSidebar function with AI integration
    function updateSidebar(el) {
        const info = document.getElementById("dis-info");
        if (!info) return;

        const cssSelector = getOptimizedSelector(el);
        const outerHTML = el.outerHTML;
        const styles = window.getComputedStyle(el);
        const styleText = Array.from(styles).map(k => `${k}: ${styles.getPropertyValue(k)}`).join('; \n');

        // AI Section with Configuration
        const aiSection = `
            <div class="dis-section">
                <div class="dis-section-header">
                    <span data-type="ai">🤖 AI Analysis</span>
                    <div>
                        <button id="analyze-ai-btn" ${!aiConfig.isConfigured ? 'disabled' : ''}>
                            ${aiConfig.isConfigured ? 'Analyze' : 'Configure AI First'}
                        </button>
                    </div>
                </div>
                <div id="ai-analysis-result" class="dis-content" style="min-height: 60px; display: flex; align-items: center; justify-content: center; color: #888;">
                    ${aiConfig.isConfigured 
                        ? `Click "Analyze" for AI-powered insights about this element using ${aiConfig.provider.toUpperCase()}` 
                        : 'Click "Configure" to set up your AI provider (OpenAI, Gemini, Claude, or Local Ollama)'}
                </div>
            </div>
        `;

        info.innerHTML = `
            ${aiSection}
            ${buildSection("CSS Selector", cssSelector)}
            ${buildSection("XPath", getXPath(el))}
            ${buildSection("Full XPath", getFullXPath(el))}
            ${buildSection("JS Path", getJSPath(el))}
            ${buildSection("Outer HTML", outerHTML, true)}
            ${buildSection("Styles", styleText, true)}
        `;

        // AI configure button listener
        const configureBtn = document.getElementById('configure-ai-btn');
        if (configureBtn) {
            configureBtn.addEventListener('click', createAIConfigModal);
        }

        // AI analyze button listener
        const analyzeBtn = document.getElementById('analyze-ai-btn');
        if (analyzeBtn && aiConfig.isConfigured) {
            analyzeBtn.addEventListener('click', async () => {
                const resultDiv = document.getElementById('ai-analysis-result');
                
                analyzeBtn.disabled = true;
                analyzeBtn.textContent = 'Analyzing...';
                resultDiv.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px; color: #3b82f6;">
                        <div class="ai-spinner"></div>
                        AI is analyzing this element using ${aiConfig.provider.toUpperCase()}...
                    </div>
                `;

                try {
                    const analysis = await analyzeElementWithAI(el);
                    resultDiv.innerHTML = `<div style="line-height: 1.5; white-space: pre-wrap;">${analysis}</div>`;
                } catch (error) {
                    resultDiv.innerHTML = `<div style="color: #ef4444;">Analysis failed: ${error.message}</div>`;
                } finally {
                    analyzeBtn.disabled = false;
                    analyzeBtn.textContent = 'Analyze';
                }
            });
        }

        // Existing copy button listeners
        info.querySelectorAll("button[data-copy]").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(btn.dataset.copy);
                btn.innerHTML = "✅";
                setTimeout(() => btn.innerHTML = "📋", 1000);
            });
        });
    }

    function buildSection(title, content, isPre = false) {
        if (!content) return '';
        const escapedContent = content.replace(/"/g, '&quot;');
        const displayContent = isPre
            ? `<pre>${content.replace(/</g, "&lt;")}</pre>`
            : `<div class="dis-content">${content}</div>`;
        return `
            <div class="dis-section">
                <div class="dis-section-header">
                    <span>${title}</span>
                    <button data-copy="${escapedContent}">📋</button>
                </div>
                ${displayContent}
            </div>
        `;
    }

    // Add CSS styles for the DOM Inspector
    function addInspectorStyles() {
        const styles = `
            <style id="dom-inspector-styles">
                #dom-inspector-sidebar {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    width: 400px;
                    max-height: calc(100vh - 40px);
                    background: #181a20;
                    border: 1px solid #23262f;
                    border-radius: 12px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    z-index: 2147483647;
                    overflow: hidden;
                    backdrop-filter: blur(20px);
                    animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                @keyframes slideOut {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }

                .dis-header {
                    background: linear-gradient(135deg, #23262f 0%, #2563eb 100%);
                    color: #f3f4f6;
                    padding: 16px 20px;
                    font-weight: 600;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .dis-header button {
                    background: rgba(37, 99, 235, 0.15);
                    border: none;
                    color: #f3f4f6;
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: 8px;
                    transition: all 0.2s ease;
                }

                .dis-header button:hover {
                    background: rgba(37, 99, 235, 0.25);
                    transform: scale(1.05);
                }

                #dis-info {
                    max-height: calc(100vh - 120px);
                    overflow-y: auto;
                    padding: 20px;
                }

                .dis-section {
                    margin-bottom: 20px;
                    border: 1px solid #23262f;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #23262f;
                }

                .dis-section-header {
                    background: #23262f;
                    padding: 12px 16px;
                    font-weight: 600;
                    color: #cbd5e1;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #23262f;
                }

                .dis-section-header button {
                    background: #2563eb;
                    border: none;
                    padding: 6px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    color: #fff;
                    transition: all 0.2s ease;
                }

                .dis-section-header button:hover {
                    background: #1d4ed8;
                    transform: translateY(-1px);
                }

                .dis-content, pre {
                    padding: 16px;
                    background: #181a20;
                    font-size: 12px;
                    line-height: 1.5;
                    color: #f3f4f6;
                    max-height: 200px;
                    overflow-y: auto;
                    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
                }

                pre {
                    margin: 0;
                    white-space: pre-wrap;
                    word-break: break-all;
                }

                kbd {
                    background: #23262f;
                    border: 1px solid #313442;
                    border-radius: 3px;
                    padding: 2px 6px;
                    font-size: 11px;
                    color: #cbd5e1;
                    font-family: monospace;
                }

                #dom-inspector-sidebar::-webkit-scrollbar,
                .dis-content::-webkit-scrollbar,
                pre::-webkit-scrollbar {
                    width: 6px;
                }

                #dom-inspector-sidebar::-webkit-scrollbar-track,
                .dis-content::-webkit-scrollbar-track,
                pre::-webkit-scrollbar-track {
                    background: #23262f;
                }

                #dom-inspector-sidebar::-webkit-scrollbar-thumb,
                .dis-content::-webkit-scrollbar-thumb,
                pre::-webkit-scrollbar-thumb {
                    background: #313442;
                    border-radius: 3px;
                }

                #dom-inspector-sidebar::-webkit-scrollbar-thumb:hover,
                .dis-content::-webkit-scrollbar-thumb:hover,
                pre::-webkit-scrollbar-thumb:hover {
                    background: #2563eb;
                }

                @media (max-width: 480px) {
                    #dom-inspector-sidebar {
                        width: calc(100vw - 40px);
                        right: 20px;
                        left: 20px;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    // Initialize the inspector
    addInspectorStyles();
    createSidebar();
    createTooltip();
    
    document.addEventListener("mouseover", mouseOverHandler, true);
    document.addEventListener("click", clickHandler, true);
    document.addEventListener("mouseleave", mouseLeaveHandler, true);
    document.addEventListener("keydown", keyHandler, true);

    window.addEventListener('beforeunload', deactivateInspector);
    
    console.log("DOM Inspector Pro activated with external AI support");
})();