// State management
let isActive = false;
let settings = {
    selectionStyle: 'outline',
    highlightColor: '#2563eb',
    ai: {
        provider: 'none',
        apiKey: '',
        model: '',
        baseUrl: 'http://localhost:11434',
        isConfigured: false
    }
};

// Load saved settings
chrome.storage.sync.get(['settings'], (result) => {
    if (result.settings) {
        settings = { ...settings, ...result.settings };
        document.getElementById('selection-style').value = settings.selectionStyle;
        document.getElementById('highlight-color').value = settings.highlightColor;
        
        // Set AI settings
        if (settings.ai) {
            document.getElementById('ai-provider').value = settings.ai.provider;
            document.getElementById('ai-api-key').value = settings.ai.apiKey;
            document.getElementById('ollama-url').value = settings.ai.baseUrl;
            updateAIConfigSections(settings.ai.provider);
            if (settings.ai.model) {
                updateModelOptions(settings.ai.provider, settings.ai.model);
            }
        }
    }
});

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-section`).classList.add('active');
    });
});

// Inspector activation
const activateButton = document.getElementById("activate");
const statusElement = document.getElementById("status");

function updateButtonState() {
    activateButton.textContent = isActive ? "Deactivate Inspector" : "Activate Inspector";
    statusElement.textContent = isActive ? "Inspector is active" : "";
}

activateButton.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!isActive) {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["inject.js"]
        });
        isActive = true;
        await chrome.tabs.sendMessage(tab.id, { 
            action: "updateSettings", 
            settings: settings 
        });
    } else {
        await chrome.tabs.sendMessage(tab.id, { action: "deactivateInspector" });
        isActive = false;
    }
    updateButtonState();
});

// AI Provider Management
function updateAIConfigSections(provider) {
    const apiKeySection = document.getElementById('api-key-section');
    const ollamaUrlSection = document.getElementById('ollama-url-section');
    const modelSection = document.getElementById('model-section');
    const testSection = document.getElementById('test-connection-section');

    apiKeySection.style.display = ['openai', 'gemini', 'claude'].includes(provider) ? 'block' : 'none';
    ollamaUrlSection.style.display = provider === 'ollama' ? 'block' : 'none';
    modelSection.style.display = provider !== 'none' ? 'block' : 'none';
    testSection.style.display = provider !== 'none' ? 'block' : 'none';
    
    document.getElementById('test-ai-connection').disabled = provider === 'none';
    
    if (provider !== 'none') {
        updateModelOptions(provider);
    }
}

function updateModelOptions(provider, selectedModel = '') {
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
            if (model.value === selectedModel) {
                option.selected = true;
            }
            modelSelect.appendChild(option);
        });
    }
}

async function testAIConnection() {
    const statusDiv = document.getElementById('ai-status-message');
    const testBtn = document.getElementById('test-ai-connection');
    
    testBtn.disabled = true;
    const originalText = testBtn.textContent;
    testBtn.innerHTML = '<span class="ai-spinner"></span>Testing...';
    
    statusDiv.style.display = 'block';
    statusDiv.className = 'warning';
    statusDiv.textContent = 'Testing connection...';

    try {
        const provider = document.getElementById('ai-provider').value;
        const apiKey = document.getElementById('ai-api-key').value;
        const model = document.getElementById('ai-model').value;
        const baseUrl = document.getElementById('ollama-url').value;

        const response = await chrome.runtime.sendMessage({
            action: 'callAI',
            provider,
            prompt: "Respond with `AI connection successful` if you can see this message.",
            model,
            apiKey,
            baseUrl
        });
        
        if (response.success) {
            statusDiv.className = 'success';
            statusDiv.textContent = 'Connection successful!';
        } else {
            statusDiv.className = 'error';
            statusDiv.textContent = `Connection failed: ${response.error}`;
        }
    } catch (error) {
        statusDiv.className = 'error';
        statusDiv.textContent = `Test failed: ${error.message}`;
    }

    testBtn.disabled = false;
    testBtn.textContent = originalText;
}

// Settings management
document.getElementById('save-settings').addEventListener('click', async () => {
    const provider = document.getElementById('ai-provider').value;
    const newSettings = {
        selectionStyle: document.getElementById('selection-style').value,
        highlightColor: document.getElementById('highlight-color').value,
        ai: {
            provider,
            apiKey: document.getElementById('ai-api-key').value,
            model: document.getElementById('ai-model').value,
            baseUrl: document.getElementById('ollama-url').value,
            isConfigured: provider !== 'none'
        }
    };

    // Save to storage
    await chrome.storage.sync.set({ settings: newSettings });
    settings = newSettings;

    // Update active inspector if any
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (isActive) {
        await chrome.tabs.sendMessage(tab.id, { 
            action: "updateSettings", 
            settings: settings 
        });
    }

    statusElement.textContent = "Settings saved!";
    setTimeout(() => {
        if (!isActive) statusElement.textContent = "";
    }, 2000);
});

// AI Provider change handler
document.getElementById('ai-provider').addEventListener('change', (e) => {
    updateAIConfigSections(e.target.value);
});

// Test connection button handler
document.getElementById('test-ai-connection').addEventListener('click', testAIConnection);

// Custom Ollama model handler
document.getElementById('ai-model').addEventListener('change', (e) => {
    const provider = document.getElementById('ai-provider').value;
    if (provider === 'ollama' && e.target.value === 'custom') {
        const customModel = prompt('Enter custom model name:');
        if (customModel) {
            const option = document.createElement('option');
            option.value = customModel;
            option.textContent = customModel;
            option.selected = true;
            e.target.insertBefore(option, e.target.lastElementChild);
        }
    }
});

// Listen for deactivation message from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "deactivateInspector") {
        isActive = false;
        updateButtonState();
    }
});